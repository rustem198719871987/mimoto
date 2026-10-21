// Точка входа: читает настройки из окружения (.env) и запускает сервер.
const path = require("node:path");
const crypto = require("node:crypto");
const { createApp } = require("./src/app");

try { process.loadEnvFile(path.join(__dirname, ".env")); } catch { /* .env необязателен: в Docker переменные приходят из compose */ }

const env = process.env;
if (!env.ADMIN_PASSWORD) console.warn("ВНИМАНИЕ: ADMIN_PASSWORD не задан — вход в админку отключён.");
if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 10) console.warn("ВНИМАНИЕ: пароль администратора короче 10 символов.");
if (!env.SESSION_SECRET) console.warn("SESSION_SECRET не задан — после перезапуска сервера придётся войти в админку заново.");

const app = createApp({
  dataDir: path.resolve(env.DATA_DIR || path.join(__dirname, "data")),
  adminPassword: env.ADMIN_PASSWORD || "",
  sessionSecret: env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  telegramToken: env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: env.TELEGRAM_CHAT_ID || "",
  siteUrl: env.SITE_URL || "",
});

const port = +env.PORT || 3000;
app.listen(port, () => console.log(`MiMoto запущен: http://localhost:${port}  (админка: /admin)`));
