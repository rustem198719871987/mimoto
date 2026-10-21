// HTTP-приложение магазина: витрина, публичное API и админка.
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const express = require("express");
const multer = require("multer");

const CATS = require("./categories");
const { open, rowToProduct, rowToOrder, orderNumber } = require("./db");
const validate = require("./validate");
const { createAuth } = require("./auth");
const { createNotifier } = require("./telegram");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

// Простое ограничение частоты по IP (в памяти процесса).
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, list] of hits) if (!list.some((t) => now - t < windowMs)) hits.delete(ip);
  }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const list = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: message });
    list.push(now);
    hits.set(req.ip, list);
    next();
  };
}

// Тип картинки по первым байтам файла, а не по имени.
function imageExt(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

function createApp(config) {
  const log = config.log || console;
  const uploadsDir = path.join(config.dataDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const db = open(path.join(config.dataDir, "shop.db"));
  const auth = createAuth({ password: config.adminPassword, secret: config.sessionSecret });
  const notifier = createNotifier({ token: config.telegramToken, chatId: config.telegramChatId, siteUrl: config.siteUrl, log });

  const now = () => new Date().toISOString();
  const newId = () => "p" + crypto.randomBytes(6).toString("hex");

  const q = {
    visible: db.prepare("SELECT * FROM products WHERE hidden = 0 ORDER BY sort, name"),
    all: db.prepare("SELECT * FROM products ORDER BY sort, name"),
    get: db.prepare("SELECT * FROM products WHERE id = ?"),
    insert: db.prepare(`INSERT INTO products (id,name,cat,price,old_price,hit,stock,hidden,rate,reviews,descr,specs,photo,sort,created_at,updated_at)
      VALUES (:id,:name,:cat,:price,:old,:hit,:stock,:hidden,:rate,:rev,:desc,:specs,:photo,:sort,:now,:now)`),
    update: db.prepare(`UPDATE products SET name=:name,cat=:cat,price=:price,old_price=:old,hit=:hit,stock=:stock,hidden=:hidden,
      rate=:rate,reviews=:rev,descr=:desc,specs=:specs,photo=:photo,sort=:sort,updated_at=:now WHERE id=:id`),
    del: db.prepare("DELETE FROM products WHERE id = ?"),
    photoUses: db.prepare("SELECT COUNT(*) AS n FROM products WHERE photo = ?"),
    allPhotos: db.prepare("SELECT DISTINCT photo FROM products WHERE photo IS NOT NULL"),
    maxSort: db.prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM products"),
    orderInsert: db.prepare(`INSERT INTO orders (kind,name,phone,delivery,payment,comment,items,total,created_at)
      VALUES (:kind,:name,:phone,:delivery,:payment,:comment,:items,:total,:now)`),
    orders: db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 500"),
    ordersBy: db.prepare("SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 500"),
    orderGet: db.prepare("SELECT * FROM orders WHERE id = ?"),
    orderUpdate: db.prepare("UPDATE orders SET status = :status, note = :note WHERE id = :id"),
    newCount: db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'"),
  };

  const params = (id, p) => ({
    id, name: p.name, cat: p.cat, price: p.price, old: p.old, hit: p.hit ? 1 : 0, stock: p.stock, hidden: p.hidden ? 1 : 0,
    rate: p.rate, rev: p.rev, desc: p.desc, specs: JSON.stringify(p.specs), photo: p.photo, sort: p.sort, now: now(),
  });
  const photoExists = (name) => !!name && validate.PHOTO_RE.test(name) && fs.existsSync(path.join(uploadsDir, name));
  function dropPhotoIfUnused(name) {
    if (!name || !validate.PHOTO_RE.test(name) || q.photoUses.get(name).n > 0) return;
    fs.rm(path.join(uploadsDir, name), { force: true }, () => {});
  }
  function tx(fn) {
    db.exec("BEGIN IMMEDIATE");
    try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
  }

  // Фото, загруженные, но так и не привязанные к товару, удаляем через сутки.
  function cleanOrphanPhotos() {
    const used = new Set(q.allPhotos.all().map((r) => r.photo));
    for (const f of fs.readdirSync(uploadsDir)) {
      if (!validate.PHOTO_RE.test(f) || used.has(f)) continue;
      const full = path.join(uploadsDir, f);
      if (Date.now() - fs.statSync(full).mtimeMs > 24 * 3600 * 1000) fs.rmSync(full, { force: true });
    }
  }
  cleanOrphanPhotos();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy ?? 1);

  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": [
        "default-src 'self'",
        "img-src 'self' data:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "script-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    });
    next();
  });

  // ---------- публичная часть ----------
  app.get("/js/categories.js", (req, res) => {
    res.type("application/javascript").set("Cache-Control", "no-cache").send(`window.CATS=${JSON.stringify(CATS)};`);
  });

  app.get("/api/products", (req, res) => {
    res.set("Cache-Control", "no-cache").json(q.visible.all().map(rowToProduct));
  });

  const orderLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 8, message: "Слишком много заявок подряд. Попробуйте через 10 минут или позвоните нам." });
  app.post("/api/orders", express.json({ limit: "50kb" }), orderLimit, (req, res) => {
    if (req.body && req.body.website) return res.json({ number: orderNumber(0) }); // ловушка для ботов
    const { value, error } = validate.order(req.body);
    if (error) return res.status(400).json({ error });

    const items = [];
    for (const i of value.items) {
      const r = q.get.get(i.id);
      if (!r || r.hidden) return res.status(400).json({ error: "Один из товаров больше не продаётся. Обновите страницу." });
      if (value.kind === "order" && r.stock === "out") return res.status(400).json({ error: `«${r.name}» закончился. Уберите его из корзины.` });
      items.push({ id: r.id, name: r.name, price: r.price, qty: i.qty });
    }
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const info = q.orderInsert.run({ ...value, items: JSON.stringify(items), total, now: now() });
    const order = rowToOrder(q.orderGet.get(info.lastInsertRowid));
    notifier.notify(order);
    res.status(201).json({ number: order.number });
  });

  // ---------- вход в админку ----------
  const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Слишком много попыток входа. Подождите 15 минут." });
  app.post("/api/admin/login", express.json({ limit: "2kb" }), loginLimit, (req, res) => {
    if (!auth.enabled) return res.status(503).json({ error: "Пароль администратора не задан на сервере (ADMIN_PASSWORD)." });
    if (!auth.checkPassword(String((req.body && req.body.password) || ""))) return res.status(401).json({ error: "Неверный пароль." });
    auth.login(req, res);
    res.json({ ok: true });
  });
  app.post("/api/admin/logout", (req, res) => { auth.logout(req, res); res.json({ ok: true }); });
  app.get("/api/admin/me", (req, res) => res.json({ admin: auth.isAdmin(req) }));

  // ---------- админка: всё ниже требует входа ----------
  const admin = express.Router();
  admin.use(auth.requireAdmin);
  admin.use(express.json({ limit: "5mb" }));

  admin.get("/products", (req, res) => res.json(q.all.all().map(rowToProduct)));

  admin.post("/products", (req, res) => {
    const { value, error } = validate.product(req.body);
    if (error) return res.status(400).json({ error });
    if (value.photo && !photoExists(value.photo)) value.photo = null;
    if (!value.sort) value.sort = q.maxSort.get().m + 10;
    const id = newId();
    q.insert.run(params(id, value));
    res.status(201).json(rowToProduct(q.get.get(id)));
  });

  admin.put("/products/:id", (req, res) => {
    const cur = q.get.get(req.params.id);
    if (!cur) return res.status(404).json({ error: "Товар не найден." });
    const { value, error } = validate.product(req.body);
    if (error) return res.status(400).json({ error });
    if (value.photo && !photoExists(value.photo)) value.photo = null;
    q.update.run(params(cur.id, value));
    if (cur.photo !== value.photo) dropPhotoIfUnused(cur.photo);
    res.json(rowToProduct(q.get.get(cur.id)));
  });

  admin.patch("/products/:id", (req, res) => {
    const cur = q.get.get(req.params.id);
    if (!cur) return res.status(404).json({ error: "Товар не найден." });
    const { value, error } = validate.productPatch(req.body, rowToProduct(cur));
    if (error) return res.status(400).json({ error });
    q.update.run(params(cur.id, value));
    res.json(rowToProduct(q.get.get(cur.id)));
  });

  admin.delete("/products/:id", (req, res) => {
    const cur = q.get.get(req.params.id);
    if (!cur) return res.status(404).json({ error: "Товар не найден." });
    q.del.run(cur.id);
    dropPhotoIfUnused(cur.photo);
    res.json({ ok: true });
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  admin.post("/upload", upload.single("photo"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Выберите файл." });
    const ext = imageExt(req.file.buffer);
    if (!ext) return res.status(400).json({ error: "Подходят только JPG, PNG или WebP." });
    const name = crypto.randomBytes(16).toString("hex") + "." + ext;
    fs.writeFileSync(path.join(uploadsDir, name), req.file.buffer);
    res.status(201).json({ photo: name });
  });

  admin.get("/export", (req, res) => {
    const stamp = new Date().toISOString().slice(0, 10);
    res.set("Content-Disposition", `attachment; filename="mimoto-tovary-${stamp}.json"`);
    res.type("application/json").send(JSON.stringify(q.all.all().map(rowToProduct), null, 2));
  });

  // Импорт: товары с тем же id обновляются, остальные добавляются. Формат — как у экспорта.
  admin.post("/import", (req, res) => {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: "В файле должен быть список товаров." });
    let added = 0, updated = 0;
    const skipped = [];
    tx(() => {
      for (const [n, raw] of req.body.entries()) {
        const { value, error } = validate.product(raw);
        if (error) { skipped.push(`№${n + 1}: ${error}`); continue; }
        if (value.photo && !photoExists(value.photo)) value.photo = null;
        const id = raw && typeof raw.id === "string" && validate.ID_RE.test(raw.id) ? raw.id : newId();
        if (q.get.get(id)) { q.update.run(params(id, value)); updated++; } else { q.insert.run(params(id, value)); added++; }
      }
    });
    res.json({ added, updated, skipped });
  });

  admin.get("/orders", (req, res) => {
    const status = validate.ORDER_STATUS[req.query.status] ? req.query.status : null;
    const rows = status ? q.ordersBy.all(status) : q.orders.all();
    res.json({ orders: rows.map(rowToOrder), newCount: q.newCount.get().n });
  });

  admin.patch("/orders/:id", (req, res) => {
    const cur = q.orderGet.get(+req.params.id || 0);
    if (!cur) return res.status(404).json({ error: "Заявка не найдена." });
    const b = req.body || {};
    const status = validate.ORDER_STATUS[b.status] ? b.status : cur.status;
    const note = "note" in b ? String(b.note ?? "").slice(0, 2000) : cur.note;
    q.orderUpdate.run({ id: cur.id, status, note });
    res.json(rowToOrder(q.orderGet.get(cur.id)));
  });

  app.use("/api/admin", admin);
  app.use("/api", (req, res) => res.status(404).json({ error: "Нет такого адреса API." }));

  app.use("/uploads", express.static(uploadsDir, { maxAge: "30d", immutable: true, index: false }));
  app.get("/admin", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "admin.html")));
  app.use(express.static(PUBLIC_DIR, { index: "index.html", maxAge: "1h" }));

  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Файл больше 10 МБ. Уменьшите фото." : "Не удалось принять файл." });
    }
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Неверный формат данных." });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Слишком большой запрос." });
    log.error(err);
    res.status(500).json({ error: "Ошибка сервера. Попробуйте ещё раз." });
  });

  app.locals.db = db;
  return app;
}

module.exports = { createApp, imageExt };
