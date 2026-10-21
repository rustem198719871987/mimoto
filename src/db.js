// SQLite-база магазина: один файл data/shop.db, отдельный сервер базы не нужен.
const { DatabaseSync } = require("node:sqlite");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS products (
  id         TEXT PRIMARY KEY,
  name       TEXT    NOT NULL,
  cat        TEXT    NOT NULL,
  price      INTEGER NOT NULL,
  old_price  INTEGER,
  hit        INTEGER NOT NULL DEFAULT 0,
  stock      TEXT    NOT NULL DEFAULT 'in',
  hidden     INTEGER NOT NULL DEFAULT 0,
  rate       REAL    NOT NULL DEFAULT 0,
  reviews    INTEGER NOT NULL DEFAULT 0,
  descr      TEXT    NOT NULL DEFAULT '',
  specs      TEXT    NOT NULL DEFAULT '[]',
  photo      TEXT,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
`;

function open(file) {
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

// Строка таблицы -> товар в формате API (тот же формат, что у экспорта из прототипа).
function rowToProduct(r) {
  let specs = [];
  try { specs = JSON.parse(r.specs); } catch { specs = []; }
  return {
    id: r.id,
    name: r.name,
    cat: r.cat,
    price: r.price,
    old: r.old_price ?? null,
    hit: !!r.hit,
    stock: r.stock,
    hidden: !!r.hidden,
    rate: r.rate,
    rev: r.reviews,
    desc: r.descr,
    specs,
    photo: r.photo ?? null,
    sort: r.sort,
  };
}

module.exports = { open, rowToProduct };
