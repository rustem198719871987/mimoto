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

CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT    NOT NULL,
  name       TEXT    NOT NULL DEFAULT '',
  phone      TEXT    NOT NULL,
  delivery   TEXT,
  payment    TEXT,
  comment    TEXT    NOT NULL DEFAULT '',
  items      TEXT    NOT NULL DEFAULT '[]',
  total      INTEGER NOT NULL DEFAULT 0,
  status     TEXT    NOT NULL DEFAULT 'new',
  note       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status, id);
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

function rowToOrder(r) {
  let items = [];
  try { items = JSON.parse(r.items); } catch { items = []; }
  return {
    id: r.id,
    number: orderNumber(r.id),
    kind: r.kind,
    name: r.name,
    phone: r.phone,
    delivery: r.delivery,
    payment: r.payment,
    comment: r.comment,
    items,
    total: r.total,
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
  };
}

const orderNumber = (id) => "MM-" + String(id).padStart(5, "0");

module.exports = { open, rowToProduct, rowToOrder, orderNumber };
