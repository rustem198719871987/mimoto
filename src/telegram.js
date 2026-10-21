// Уведомления о новых заявках в Telegram. Работает, если заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.
const { KINDS, DELIVERY, PAYMENT } = require("./validate");

const rub = (n) => n.toLocaleString("ru-RU") + " ₽";

function formatOrder(o, siteUrl) {
  const lines = [`🏍 ${KINDS[o.kind]} ${o.number}`, `Имя: ${o.name || "—"}`, `Телефон: ${o.phone}`];
  if (o.items.length) {
    lines.push("", "Товары:");
    for (const i of o.items) lines.push(`• ${i.name} × ${i.qty} — ${rub(i.price * i.qty)}`);
    lines.push(`Итого: ${rub(o.total)}`);
  }
  if (o.delivery) lines.push(`Получение: ${DELIVERY[o.delivery]}`);
  if (o.payment) lines.push(`Оплата: ${PAYMENT[o.payment]}`);
  if (o.comment) lines.push("", `Комментарий: ${o.comment}`);
  if (siteUrl) lines.push("", `${siteUrl.replace(/\/$/, "")}/admin`);
  return lines.join("\n");
}

function createNotifier({ token, chatId, siteUrl, log = console }) {
  const enabled = !!(token && chatId);
  async function notify(order) {
    if (!enabled) return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: formatOrder(order, siteUrl), disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) log.error(`Telegram: ответ ${res.status} ${await res.text()}`);
    } catch (e) {
      log.error("Telegram: не удалось отправить уведомление:", e.message);
    }
  }
  return { notify, enabled };
}

module.exports = { createNotifier, formatOrder };
