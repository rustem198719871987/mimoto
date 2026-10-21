// Проверка и очистка данных, пришедших из браузера.
const CATS = require("./categories");

const CAT_IDS = new Set(CATS.map((c) => c.id));
const STOCK = { in: "В наличии", order: "Под заказ", out: "Нет в наличии" };
const PHOTO_RE = /^[0-9a-f]{32}\.(jpg|png|webp)$/;
const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;

const str = (v, max) => String(v ?? "").trim().slice(0, max);
const int = (v) => (Number.isFinite(+v) ? Math.round(+v) : NaN);

// Полная проверка товара (создание, замена, импорт). Возвращает {value} или {error}.
function product(input) {
  const x = input && typeof input === "object" ? input : {};
  const name = str(x.name, 200);
  if (!name) return { error: "Укажите название товара." };
  if (!CAT_IDS.has(x.cat)) return { error: "Выберите категорию из списка." };
  const price = int(x.price);
  if (!(price > 0) || price > 100_000_000) return { error: "Укажите цену больше нуля." };
  const old = x.old == null || x.old === "" ? null : int(x.old);
  if (old !== null && !(old > price)) return { error: "Старая цена должна быть больше текущей." };
  const stock = STOCK[x.stock] ? x.stock : "in";
  const specs = (Array.isArray(x.specs) ? x.specs : [])
    .filter((s) => s && str(s.k, 80))
    .slice(0, 40)
    .map((s) => ({ k: str(s.k, 80), v: str(s.v, 200) }));
  return {
    value: {
      name,
      cat: x.cat,
      price,
      old,
      hit: !!x.hit,
      stock,
      hidden: !!x.hidden,
      rate: Math.min(5, Math.max(0, Number.isFinite(+x.rate) ? Math.round(+x.rate * 10) / 10 : 0)),
      rev: Math.max(0, int(x.rev) || 0),
      desc: str(x.desc, 4000),
      specs,
      photo: typeof x.photo === "string" && PHOTO_RE.test(x.photo) ? x.photo : null,
      sort: int(x.sort) || 0,
    },
  };
}

// Быстрая правка из таблицы админки: только эти поля.
function productPatch(input, current) {
  const x = input && typeof input === "object" ? input : {};
  const next = { ...current };
  if ("price" in x) next.price = x.price;
  if ("old" in x) next.old = x.old;
  if ("stock" in x) next.stock = x.stock;
  if ("hit" in x) next.hit = x.hit;
  if ("hidden" in x) next.hidden = x.hidden;
  if ("sort" in x) next.sort = x.sort;
  return product(next);
}

module.exports = { product, productPatch, CAT_IDS, STOCK, ID_RE, PHOTO_RE };
