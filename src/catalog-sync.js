// Каталог из репозитория: catalog/katalog.json загружается в базу при запуске сайта.
// Каждая версия файла применяется один раз (по хешу содержимого), поэтому правки в админке
// между версиями не перезаписываются при обычном перезапуске.
//
// При новой версии файла:
//  - товары из файла добавляются или обновляются; фото и отметка «Хит» из админки сохраняются;
//  - удаляются только товары, которые были в прошлой версии файла (или демо-примеры), а в новой их нет;
//  - товары, добавленные вручную в админке, не трогаются.
const fs = require("node:fs");
const crypto = require("node:crypto");
const validate = require("./validate");

function syncCatalog({ db, file, demoIds = [], log = console, onPhotoDropped = () => {} }) {
  if (!file || !fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const hash = crypto.createHash("sha256").update(text).digest("hex");

  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const getMeta = db.prepare("SELECT value FROM meta WHERE key = ?");
  const setMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  if ((getMeta.get("catalog_hash") || {}).value === hash) return null; // эта версия уже загружена

  let items;
  try { items = JSON.parse(text); } catch (e) { log.error("Каталог: файл повреждён, пропускаю:", e.message); return null; }
  if (!Array.isArray(items)) { log.error("Каталог: в файле не список товаров, пропускаю."); return null; }

  let prevIds;
  try { prevIds = JSON.parse((getMeta.get("catalog_ids") || {}).value || "null"); } catch { prevIds = null; }
  // Первая загрузка каталога заменяет демо-примеры из scripts/seed-products.json
  const removable = new Set(prevIds || demoIds);

  const get = db.prepare("SELECT * FROM products WHERE id = ?");
  const now = new Date().toISOString();
  const ins = db.prepare(`INSERT INTO products (id,name,cat,price,old_price,hit,stock,hidden,rate,reviews,descr,specs,photo,sort,created_at,updated_at)
    VALUES (:id,:name,:cat,:price,:old,:hit,:stock,:hidden,:rate,:rev,:desc,:specs,:photo,:sort,:now,:now)`);
  const upd = db.prepare(`UPDATE products SET name=:name,cat=:cat,price=:price,old_price=:old,hit=:hit,stock=:stock,hidden=:hidden,
    rate=:rate,reviews=:rev,descr=:desc,specs=:specs,photo=:photo,sort=:sort,updated_at=:now WHERE id=:id`);
  const del = db.prepare("DELETE FROM products WHERE id = ?");

  const ids = [], skipped = [], dropped = [];
  let added = 0, updated = 0, removed = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const raw of items) {
      const id = raw && typeof raw.id === "string" && validate.ID_RE.test(raw.id) ? raw.id : null;
      const { value: p, error } = validate.product(raw);
      if (!id || error) { skipped.push(`${(raw && raw.name) || "?"}: ${error || "нет id"}`); continue; }
      const cur = get.get(id);
      if (cur) { p.photo = cur.photo ?? null; p.hit = !!cur.hit; } // фото и «Хит» ведутся в админке
      const row = { id, name: p.name, cat: p.cat, price: p.price, old: p.old, hit: p.hit ? 1 : 0, stock: p.stock, hidden: p.hidden ? 1 : 0,
        rate: p.rate, rev: p.rev, desc: p.desc, specs: JSON.stringify(p.specs), photo: p.photo, sort: p.sort, now };
      if (cur) { upd.run(row); updated++; } else { ins.run(row); added++; }
      ids.push(id);
    }
    if (ids.length) {
      const keep = new Set(ids);
      for (const id of removable) {
        if (keep.has(id)) continue;
        const cur = get.get(id);
        if (cur) { del.run(id); removed++; if (cur.photo) dropped.push(cur.photo); }
      }
      setMeta.run("catalog_ids", JSON.stringify(ids));
    }
    setMeta.run("catalog_hash", hash);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  dropped.forEach(onPhotoDropped);
  const result = { added, updated, removed, skipped };
  log.log(`Каталог загружен: добавлено ${added}, обновлено ${updated}, удалено ${removed}${skipped.length ? `, пропущено ${skipped.length}: ${skipped.slice(0, 3).join("; ")}` : ""}`);
  return result;
}

module.exports = { syncCatalog };
