// Загрузка каталога из catalog/katalog.json при запуске: npm test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { open } = require("../src/db");
const { syncCatalog } = require("../src/catalog-sync");

const silent = { log() {}, error() {} };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mimoto-cat-"));
const db = open(path.join(dir, "shop.db"));
const file = path.join(dir, "katalog.json");
const now = new Date().toISOString();
const insert = (id, name, extra = {}) =>
  db.prepare(`INSERT INTO products (id,name,cat,price,hit,photo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, name, "enduro", 100000, extra.hit ? 1 : 0, extra.photo ?? null, now, now);
const ids = () => db.prepare("SELECT id FROM products ORDER BY id").all().map((r) => r.id);
const row = (id) => db.prepare("SELECT * FROM products WHERE id = ?").get(id);
const write = (items) => fs.writeFileSync(file, JSON.stringify(items));
const sync = () => syncCatalog({ db, file, demoIds: ["p01", "p02"], log: silent });

test("первая загрузка заменяет демо-примеры и не трогает товары из админки", () => {
  insert("p01", "Демо 1"); insert("p02", "Демо 2"); insert("pa1b2c3d4e5f6", "Добавлен вручную");
  write([
    { id: "kugoo-m4", name: "Электросамокат Kugoo M4", cat: "kick", price: 37990 },
    { id: "trike-x1", name: "Трицикл WenBox X1", cat: "trike", price: 85000 },
  ]);
  const r = sync();
  assert.deepEqual([r.added, r.updated, r.removed], [2, 0, 2]);
  assert.deepEqual(ids(), ["kugoo-m4", "pa1b2c3d4e5f6", "trike-x1"]);
});

test("та же версия файла повторно не применяется — правки из админки остаются", () => {
  db.prepare("UPDATE products SET price = 35990 WHERE id = 'kugoo-m4'").run();
  assert.equal(sync(), null);
  assert.equal(row("kugoo-m4").price, 35990);
});

test("новая версия: обновляет товары, сохраняет фото и «Хит», убирает выбывшие", () => {
  db.prepare("UPDATE products SET hit = 1, photo = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg' WHERE id = 'kugoo-m4'").run();
  write([{ id: "kugoo-m4", name: "Электросамокат Kugoo M4", cat: "kick", price: 39990 }]);
  const r = sync();
  assert.deepEqual([r.added, r.updated, r.removed], [0, 1, 1]);
  const m4 = row("kugoo-m4");
  assert.equal(m4.price, 39990);
  assert.equal(m4.hit, 1);
  assert.equal(m4.photo, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg");
  assert.deepEqual(ids(), ["kugoo-m4", "pa1b2c3d4e5f6"], "ручной товар на месте, выбывший удалён");
});

test("повреждённый или пустой файл ничего не удаляет", () => {
  fs.writeFileSync(file, "{не json");
  assert.equal(sync(), null);
  write([]);
  sync();
  assert.deepEqual(ids(), ["kugoo-m4", "pa1b2c3d4e5f6"]);
});

test("настоящий catalog/katalog.json проходит проверку целиком", () => {
  const items = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "catalog", "katalog.json"), "utf8"));
  const db2 = open(path.join(dir, "real.db"));
  fs.writeFileSync(path.join(dir, "real.json"), JSON.stringify(items));
  const r = syncCatalog({ db: db2, file: path.join(dir, "real.json"), log: silent });
  assert.equal(r.skipped.length, 0, r.skipped.join("; "));
  assert.equal(r.added, items.length);
  assert.equal(new Set(items.map((p) => p.id)).size, items.length, "id не повторяются");
});
