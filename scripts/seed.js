// Загрузка примеров товаров в пустую базу: npm run seed
// Если товары уже есть, скрипт ничего не меняет (добавьте --force, чтобы дописать примеры).
const path = require("node:path");
const { open } = require("../src/db");
const validate = require("../src/validate");

try { process.loadEnvFile(path.join(__dirname, "..", ".env")); } catch { /* .env необязателен */ }

const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, "..", "data"));
require("node:fs").mkdirSync(dataDir, { recursive: true });
const db = open(path.join(dataDir, "shop.db"));

const count = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
if (count > 0 && !process.argv.includes("--force")) {
  console.log(`В базе уже ${count} товаров — ничего не меняю. Запустите с --force, чтобы добавить примеры.`);
  process.exit(0);
}

const items = require("./seed-products.json");
const ins = db.prepare(`INSERT OR IGNORE INTO products (id,name,cat,price,old_price,hit,stock,hidden,rate,reviews,descr,specs,photo,sort,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)`);
const now = new Date().toISOString();
let n = 0;
for (const raw of items) {
  const { value: p, error } = validate.product(raw);
  if (error) { console.warn(`Пропуск ${raw.id}: ${error}`); continue; }
  n += ins.run(raw.id, p.name, p.cat, p.price, p.old, +p.hit, p.stock, +p.hidden, p.rate, p.rev, p.desc, JSON.stringify(p.specs), p.sort, now, now).changes;
}
console.log(`Добавлено примеров товаров: ${n}. Замените их своими в админке (/admin).`);
