// Проверки API магазина: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../src/app");

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
  // после обновления сайта браузер должен сразу брать новые стили и скрипты
  for (const f of ["/css/admin.css", "/js/shop.js", "/"]) assert.equal((await fetch(base + f)).headers.get("cache-control"), "no-cache", f);
  assert.match((await fetch(base + "/img/logo-mark.jpg")).headers.get("cache-control"), /max-age=3600/);
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

test("сайт не принимает данные покупателей: API заявок отсутствует", async () => {
  const r = await req("POST", "/api/orders", { kind: "order", name: "Иван", phone: "+79000000000" }, { auth: false });
  assert.equal(r.status, 404);
});

test("наличие «нет в наличии» сохраняется и видно на витрине", async () => {
  await req("PATCH", `/api/admin/products/${pid}`, { stock: "out" });
  const pub = (await json(await fetch(base + "/api/products"))).body;
  assert.equal(pub.find((p) => p.id === pid).stock, "out");
  await req("PATCH", `/api/admin/products/${pid}`, { stock: "in" });
});

test("короткие ссылки из QR-кодов ведут в WhatsApp с тем же текстом, что и кнопка", async () => {
  const wa = require("../public/js/wa.js");
  const go = async (path) => {
    const r = await fetch(base + path, { redirect: "manual" });
    assert.equal(r.status, 302);
    const loc = r.headers.get("location");
    assert.ok(loc.startsWith("https://wa.me/79172270808?text="), loc);
    return decodeURIComponent(loc.split("text=")[1]);
  };
  const p = (await json(await req("GET", "/api/admin/products"))).body.find((x) => x.id === pid);
  assert.equal(await go(wa.shortPath("product", pid)), wa.text("product", p));
  assert.equal(await go(wa.shortPath("cart", [{ id: pid, qty: 2 }])), wa.text("cart", { items: [{ name: p.name, price: p.price, qty: 2 }] }));
  assert.match(await go(wa.shortPath("quiz", { cat: "pit", budget: 1 })), /Питбайк, бюджет 100 000 – 200 000 ₽/);
  assert.equal(await go(wa.shortPath("product", hiddenId)), wa.text("consult"), "скрытый товар не раскрывается");
  assert.equal(await go("/w?p=../../etc"), wa.text("consult"));
  assert.equal(await go("/w"), wa.text("consult"));
});
