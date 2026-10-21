// Вход в админку по паролю из ADMIN_PASSWORD. Сессия — подписанная cookie, без хранения на сервере.
const crypto = require("node:crypto");

const COOKIE = "mm_admin";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 часов

function createAuth({ password, secret }) {
  const key = Buffer.from(secret);
  const sign = (payload) => crypto.createHmac("sha256", key).update(payload).digest("base64url");
  const digest = (s) => crypto.createHash("sha256").update(String(s)).digest();

  function checkPassword(given) {
    if (!password) return false;
    return crypto.timingSafeEqual(digest(given), digest(password));
  }

  function issue() {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TTL_MS })).toString("base64url");
    return payload + "." + sign(payload);
  }

  function verify(token) {
    if (typeof token !== "string") return false;
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;
    const expected = sign(payload);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    try {
      return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
    } catch {
      return false;
    }
  }

  function readCookie(req) {
    const raw = req.headers.cookie || "";
    for (const part of raw.split(";")) {
      const i = part.indexOf("=");
      if (i > 0 && part.slice(0, i).trim() === COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
    }
    return null;
  }

  function setCookie(req, res, value, maxAgeMs) {
    const attrs = [`${COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
    if (req.secure) attrs.push("Secure");
    res.setHeader("Set-Cookie", attrs.join("; "));
  }

  const login = (req, res) => setCookie(req, res, issue(), TTL_MS);
  const logout = (req, res) => setCookie(req, res, "", 0);
  const isAdmin = (req) => verify(readCookie(req));

  // Защита админских запросов: валидная сессия + свой заголовок на изменяющих запросах
  // (чужой сайт не может отправить его без CORS, это закрывает CSRF вместе с SameSite=Strict).
  function requireAdmin(req, res, next) {
    if (!isAdmin(req)) return res.status(401).json({ error: "Войдите в админку заново." });
    if (req.method !== "GET" && req.get("X-MM") !== "1") return res.status(403).json({ error: "Запрос отклонён." });
    next();
  }

  return { checkPassword, login, logout, isAdmin, requireAdmin, enabled: !!password };
}

module.exports = { createAuth };
