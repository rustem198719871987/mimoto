// Город посетителя по IP — чтобы сразу спросить «Москва — это ваш город?».
// База: DB-IP IP to City Lite (https://db-ip.com, лицензия CC BY 4.0 — на сайте стоит ссылка на DB-IP).
// Файл скачивается на сервер раз в месяц и лежит в DATA_DIR/geo; поиск идёт локально,
// IP-адрес никуда не отправляется и не сохраняется.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { pipeline } = require("node:stream/promises");
const { Readable } = require("node:stream");
const { Reader } = require("mmdb-lib");
const { CITY, REGION_CITY, normCity } = require("./geo-cities");

const FILE = "dbip-city-lite.mmdb";
const MAX_AGE_MS = 35 * 24 * 3600 * 1000;

// Город по записи базы: по-русски или null, если город не из России или нет в словаре
function cityFromRecord(rec) {
  if (!rec || !rec.country || rec.country.iso_code !== "RU") return null;
  const region = rec.subdivisions && rec.subdivisions[0] && rec.subdivisions[0].names && rec.subdivisions[0].names.en;
  if (region && REGION_CITY[normCity(region)]) return REGION_CITY[normCity(region)];
  const en = rec.city && rec.city.names && rec.city.names.en;
  return (en && CITY[normCity(en)]) || null;
}

function monthUrl(d) {
  const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `https://download.db-ip.com/free/dbip-city-lite-${ym}.mmdb.gz`;
}

function createGeo({ dir, log = console, autoUpdate = true }) {
  const file = path.join(dir, FILE);
  let reader = null, loading = false;

  function load() {
    try {
      reader = new Reader(fs.readFileSync(file));
      log.log(`Определение города: база загружена (${reader.metadata.databaseType}, ${new Date(reader.metadata.buildEpoch).toISOString().slice(0, 10)})`);
    } catch (e) {
      if (e.code !== "ENOENT") log.error("Определение города: не удалось прочитать базу:", e.message);
      reader = null;
    }
  }

  // Скачиваем свежий выпуск: сначала текущего месяца, если его ещё нет — прошлого
  async function download() {
    if (loading) return;
    loading = true;
    try {
      fs.mkdirSync(dir, { recursive: true });
      const now = new Date();
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      for (const url of [monthUrl(now), monthUrl(prev)]) {
        const res = await fetch(url, { signal: AbortSignal.timeout(10 * 60 * 1000) }).catch(() => null);
        if (!res || !res.ok || !res.body) continue;
        const tmp = file + ".tmp";
        await pipeline(Readable.fromWeb(res.body), zlib.createGunzip(), fs.createWriteStream(tmp));
        new Reader(fs.readFileSync(tmp)); // проверяем, что файл читается, прежде чем заменить старый
        fs.renameSync(tmp, file);
        load();
        return;
      }
      log.error("Определение города: не удалось скачать базу DB-IP, попробую позже.");
    } catch (e) {
      log.error("Определение города: ошибка при обновлении базы:", e.message);
    } finally {
      loading = false;
    }
  }

  function refreshIfOld() {
    let age = Infinity;
    try { age = Date.now() - fs.statSync(file).mtimeMs; } catch { /* файла ещё нет */ }
    if (age > MAX_AGE_MS) download();
  }

  load();
  if (autoUpdate) {
    setTimeout(refreshIfOld, 5000).unref();
    setInterval(refreshIfOld, 24 * 3600 * 1000).unref();
  }

  function cityForIp(ip) {
    if (!reader || !ip) return null;
    try { return cityFromRecord(reader.get(String(ip).replace(/^::ffff:/, ""))); } catch { return null; }
  }

  return { cityForIp, ready: () => !!reader };
}

module.exports = { createGeo, cityFromRecord };
