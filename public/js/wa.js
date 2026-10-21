/* Покупка через WhatsApp: номер магазина и тексты сообщений.
   Один файл для витрины (браузер) и сервера (короткие ссылки /w для QR-кодов),
   чтобы сообщение по кнопке и по QR-коду всегда было одинаковым. */
(function (root) {
  "use strict";

  // Номер WhatsApp и телефон для звонков — меняется только здесь
  const SHOP = { phone: "79172270808", phoneText: "+7 (917) 227-08-08" };

  const BUDGETS = [
    ["до 100 000 ₽", 0, 100000],
    ["100 000 – 200 000 ₽", 100000, 200000],
    ["200 000 – 400 000 ₽", 200000, 400000],
    ["от 400 000 ₽", 400000, 1e9],
    ["Пока не знаю", 0, 1e9],
  ];

  const rub = (n) => n.toLocaleString("ru-RU").replace(/,/g, " ") + " ₽";

  // kind: product {name, price} | cart {items:[{name, price, qty}]} | quiz {cat, budget} | soon {name} | consult
  function text(kind, d) {
    if (kind === "product") return `Здравствуйте! Хочу купить: ${d.name}, цена ${rub(d.price)}. Подскажите по наличию и оплате.`;
    if (kind === "cart") {
      const sum = d.items.reduce((s, i) => s + i.price * i.qty, 0);
      return "Здравствуйте! Хочу купить:\n" + d.items.map((i) => `• ${i.name} × ${i.qty} — ${rub(i.price * i.qty)}`).join("\n") + `\nИтого: ${rub(sum)}`;
    }
    if (kind === "quiz") return `Здравствуйте! Подбираю технику: ${d.cat || "—"}, бюджет ${d.budget || "—"}. Помогите выбрать.`;
    if (kind === "soon") return `Здравствуйте! Когда появится ${d.name}?`;
    return "Здравствуйте! Хочу проконсультироваться по технике MiMoto.";
  }

  const url = (t) => "https://wa.me/" + SHOP.phone + "?text=" + encodeURIComponent(t);

  // Короткий адрес для QR-кода: сервер соберёт тот же текст и перенаправит в WhatsApp.
  // ref: product/soon — id товара; cart — [{id, qty}]; quiz — {cat: id категории, budget: номер варианта}
  function shortPath(kind, ref) {
    if (kind === "product") return "/w?p=" + ref;
    if (kind === "soon") return "/w?s=" + ref;
    if (kind === "cart") return "/w?c=" + ref.map((i) => i.id + "." + i.qty).join(",");
    if (kind === "quiz") return "/w?q=" + ref.cat + "." + ref.budget;
    return "/w";
  }

  const api = { SHOP, BUDGETS, rub, text, url, shortPath };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MMwa = api;
})(this);
