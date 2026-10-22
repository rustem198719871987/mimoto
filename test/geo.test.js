// Определение города по IP: npm test
// Проверка на настоящей базе DB-IP запускается, если указать путь к ней:
//   MIMOTO_GEO_DB=/путь/dbip-city-lite.mmdb npm test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { cityFromRecord } = require("../src/geo");

const rec = (city, region, country = "RU") => ({
  country: { iso_code: country },
  city: city && { names: { en: city } },
  subdivisions: region && [{ names: { en: region } }],
});

test("названия из базы переводятся на русский", () => {
  assert.equal(cityFromRecord(rec("Kazan’", "Tatarstan Republic")), "Казань");
  assert.equal(cityFromRecord(rec("Nizhny Novgorod", "Nizhny Novgorod Oblast")), "Нижний Новгород");
  assert.equal(cityFromRecord(rec("Rostov-on-Don", "Rostov")), "Ростов-на-Дону");
  assert.equal(cityFromRecord(rec("Tver'", "Tver Oblast")), "Тверь");
  assert.equal(cityFromRecord(rec("Essentuki Urban District", "Stavropol Kray")), "Ессентуки");
});

test("районы Москвы и Петербурга считаются самим городом", () => {
  assert.equal(cityFromRecord(rec("Moscow (Tsentralnyy administrativnyy okrug)", "Moscow")), "Москва");
  assert.equal(cityFromRecord(rec("Lyublino", "Moscow")), "Москва");
  assert.equal(cityFromRecord(rec("Kolpino", "St.-Petersburg")), "Санкт-Петербург");
});

test("не Россия или неизвестный город — без догадки", () => {
  assert.equal(cityFromRecord(rec("Mountain View", "California", "US")), null);
  assert.equal(cityFromRecord(rec("Неведомое", "Tver Oblast")), null);
  assert.equal(cityFromRecord(null), null);
  assert.equal(cityFromRecord({ country: { iso_code: "RU" } }), null);
});

const DB = process.env.MIMOTO_GEO_DB;
test("настоящая база DB-IP", { skip: !DB || !fs.existsSync(DB) ? "укажите MIMOTO_GEO_DB" : false }, () => {
  const { createGeo } = require("../src/geo");
  const path = require("node:path");
  const geo = createGeo({ dir: path.dirname(DB), log: { log() {}, error() {} }, autoUpdate: false });
  assert.equal(geo.cityForIp("87.250.250.242"), "Москва"); // Яндекс
  assert.equal(geo.cityForIp("178.204.0.1"), "Казань");    // Таттелеком
  assert.equal(geo.cityForIp("8.8.8.8"), null);            // не Россия
});
