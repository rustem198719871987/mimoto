// Проверки API магазина: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../src/app");
const { formatOrder } = require("../src/telegram");

const PASSWORD = "test-password-123";
let server, base, dataDir, cookie;
const silent = { error() {}, warn() {}, log() {} };

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mimoto-"));
  const app = createApp({ dataDir, adminPassword: PASSWORD, sessionSecret: "s".repeat(64), log: silent });
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const req = (method, url, body, { auth = true, csrf = true, headers = {} } = {}) =>
  fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(auth && cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { "X-MM": "1" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
const json = async (r) => ({ status: r.status, body: await r.json() });

const PRODUCT = { name: "Мотоцикл эндуро MiMoto X300", cat: "enduro", price: 199900, stock: "in", specs: [{ k: "Двигатель", v: "4Т, 280 см³" }] };
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4cf0000000049454e44ae426082", "hex");

test("витрина отдаёт страницу, категории и пустой каталог", async () => {
  const page = await fetch(base + "/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /MiMoto/);
  assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);
  assert.match(await (await fetch(base + "/js/categories.js")).text(), /window\.CATS=.*enduro/);
  assert.deepEqual((await json(await fetch(base + "/api/products"))).body, []);
  assert.equal((await fetch(base + "/admin")).status, 200);
});

test("админка закрыта без входа и с неверным паролем", async () => {
  assert.equal((await req("GET", "/api/admin/products", undefined, { auth: false })).status, 401);
  assert.equal((await req("POST", "/api/admin/login", { password: "wrong" })).status, 401);
  const ok = await req("POST", "/api/admin/login", { password: PASSWORD });
  assert.equal(ok.status, 200);
  const setCookie = ok.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  cookie = setCookie.split(";")[0];
  assert.deepEqual((await json(await req("GET", "/api/admin/me"))).body, { admin: true });
  // подделанная cookie не проходит
  const forged = cookie.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  assert.equal((await fetch(base + "/api/admin/products", { headers: { Cookie: forged } })).status, 401);
});

test("изменение без заголовка X-MM отклоняется (защита от CSRF)", async () => {
  assert.equal((await req("POST", "/api/admin/products", PRODUCT, { csrf: false })).status, 403);
});

let pid, hiddenId;
test("создание, проверка и быстрая правка товара", async () => {
  const bad = await json(await req("POST", "/api/admin/products", { ...PRODUCT, price: 0 }));
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /цену/);
  assert.equal((await req("POST", "/api/admin/products", { ...PRODUCT, cat: "boat" })).status, 400);

  const c = await json(await req("POST", "/api/admin/products", PRODUCT));
  assert.equal(c.status, 201);
  pid = c.body.id;
  assert.equal(c.body.price, 199900);
  assert.deepEqual(c.body.specs, PRODUCT.specs);

  hiddenId = (await json(await req("POST", "/api/admin/products", { ...PRODUCT, name: "Скрытый", hidden: true }))).body.id;
  const pub = (await json(await fetch(base + "/api/products"))).body;
  assert.deepEqual(pub.map((p) => p.id), [pid], "скрытый товар не виден на витрине");

  const p = await json(await req("PATCH", `/api/admin/products/${pid}`, { price: 189900, old: 199900, hit: true }));
  assert.equal(p.status, 200);
  assert.equal(p.body.price, 189900);
  assert.equal(p.body.old, 199900);
  assert.equal(p.body.hit, true);
  assert.equal(p.body.name, PRODUCT.name, "быстрая правка не трогает остальные поля");
  assert.equal((await req("PATCH", `/api/admin/products/${pid}`, { old: 100 })).status, 400, "старая цена ниже текущей");
});

test("заказ: цена берётся из базы, данные проверяются", async () => {
  const bad = await json(await req("POST", "/api/orders", { kind: "order", name: "Иван", phone: "123", items: [{ id: pid, qty: 1 }] }, { auth: false }));
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /телефон/i);
  assert.equal((await req("POST", "/api/orders", { kind: "order", name: "Иван", phone: "+7 900 000-00-00", items: [{ id: hiddenId, qty: 1 }] }, { auth: false })).status, 400);

  const o = await json(await req("POST", "/api/orders",
    { kind: "order", name: "Иван", phone: "+7 900 000-00-00", delivery: "pickup", payment: "credit", items: [{ id: pid, qty: 2, price: 1 }] }, { auth: false }));
  assert.equal(o.status, 201);
  assert.match(o.body.number, /^MM-\d{5}$/);

  const cb = await req("POST", "/api/orders", { kind: "callback", name: "Пётр", phone: "89000000000" }, { auth: false });
  assert.equal(cb.status, 201);

  const list = (await json(await req("GET", "/api/admin/orders"))).body;
  assert.equal(list.newCount, 2);
  const order = list.orders.find((x) => x.kind === "order");
  assert.equal(order.total, 189900 * 2);
  assert.equal(order.items[0].name, PRODUCT.name);

  const upd = await json(await req("PATCH", `/api/admin/orders/${order.id}`, { status: "work", note: "Перезвонить в субботу" }));
  assert.equal(upd.body.status, "work");
  assert.equal(upd.body.note, "Перезвонить в субботу");
  assert.equal((await json(await req("GET", "/api/admin/orders?status=work"))).body.orders.length, 1);
});

test("товар «нет в наличии» нельзя заказать", async () => {
  await req("PATCH", `/api/admin/products/${pid}`, { stock: "out" });
  const r = await json(await req("POST", "/api/orders", { kind: "order", name: "Иван", phone: "+79000000000", items: [{ id: pid, qty: 1 }] }, { auth: false }));
  assert.equal(r.status, 400);
  assert.match(r.body.error, /закончился/);
  await req("PATCH", `/api/admin/products/${pid}`, { stock: "in" });
});

test("фото: принимаются только картинки, удаляются вместе с товаром", async () => {
  const txt = new FormData();
  txt.append("photo", new Blob(["<script>alert(1)</script>"], { type: "image/png" }), "x.png");
  assert.equal((await req("POST", "/api/admin/upload", txt)).status, 400);

  const fd = new FormData();
  fd.append("photo", new Blob([PNG], { type: "image/png" }), "bike.png");
  const up = await json(await req("POST", "/api/admin/upload", fd));
  assert.equal(up.status, 201);
  assert.match(up.body.photo, /^[0-9a-f]{32}\.png$/);
  const img = await fetch(`${base}/uploads/${up.body.photo}`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");

  const c = (await json(await req("POST", "/api/admin/products", { ...PRODUCT, name: "С фото", photo: up.body.photo }))).body;
  assert.equal(c.photo, up.body.photo);
  assert.equal((await req("DELETE", `/api/admin/products/${c.id}`)).status, 200);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fs.existsSync(path.join(dataDir, "uploads", up.body.photo)), false);
});

test("экспорт и импорт каталога", async () => {
  const exp = await req("GET", "/api/admin/export");
  assert.match(exp.headers.get("content-disposition"), /attachment/);
  const items = await exp.json();
  assert.equal(items.length, 2);

  items[0].price = 175000;
  items.push({ id: "new-1", name: "Питбайк MiMoto P190", cat: "pit", price: 109900 }, { name: "", price: 5 });
  const r = (await json(await req("POST", "/api/admin/import", items))).body;
  assert.equal(r.updated, 2);
  assert.equal(r.added, 1);
  assert.equal(r.skipped.length, 1);
  const all = (await json(await req("GET", "/api/admin/products"))).body;
  assert.equal(all.find((p) => p.id === items[0].id).price, 175000);
});

test("выход завершает сессию", async () => {
  const out = await req("POST", "/api/admin/logout");
  assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
});

test("текст уведомления в Telegram", () => {
  const text = formatOrder({ kind: "order", number: "MM-00007", name: "Иван", phone: "+79000000000",
    items: [{ name: "X300", price: 100000, qty: 2 }], total: 200000, delivery: "pickup", payment: "credit", comment: "" }, "https://mimoto.ru");
  assert.match(text, /Заказ MM-00007/);
  assert.match(text, /Итого: 200\s000 ₽/);
  assert.match(text, /Самовывоз, Арск/);
  assert.match(text, /https:\/\/mimoto\.ru\/admin/);
});
