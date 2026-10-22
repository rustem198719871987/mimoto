// Названия городов России: как они записаны в базе DB-IP (латиницей) -> по-русски.
// Ключи нормализуются функцией normCity: без пояснений в скобках, без апострофов, в нижнем регистре.
// Покрывают ~95% российских IP-адресов в базе; для остальных сайт предлагает выбрать город из списка.

// Города федерального значения: все районы и посёлки внутри них считаем самим городом
const REGION_CITY = {
  "moscow": "Москва",
  "st.-petersburg": "Санкт-Петербург",
  "sebastopol city": "Севастополь",
};

const CITY = {
  // миллионники и крупные центры
  "moscow": "Москва", "st petersburg": "Санкт-Петербург", "saint petersburg": "Санкт-Петербург",
  "novosibirsk": "Новосибирск", "yekaterinburg": "Екатеринбург", "ekaterinburg": "Екатеринбург",
  "kazan": "Казань", "nizhny novgorod": "Нижний Новгород", "nizhniy novgorod": "Нижний Новгород",
  "chelyabinsk": "Челябинск", "samara": "Самара", "ufa": "Уфа", "rostov-on-don": "Ростов-на-Дону",
  "krasnodar": "Краснодар", "omsk": "Омск", "voronezh": "Воронеж", "perm": "Пермь", "volgograd": "Волгоград",
  "krasnoyarsk": "Красноярск", "saratov": "Саратов", "tyumen": "Тюмень", "tolyatti": "Тольятти", "togliatti": "Тольятти",
  "izhevsk": "Ижевск", "barnaul": "Барнаул", "ulyanovsk": "Ульяновск", "irkutsk": "Иркутск", "khabarovsk": "Хабаровск",
  "makhachkala": "Махачкала", "yaroslavl": "Ярославль", "vladivostok": "Владивосток", "orenburg": "Оренбург",
  "tomsk": "Томск", "kemerovo": "Кемерово", "novokuznetsk": "Новокузнецк", "ryazan": "Рязань", "astrakhan": "Астрахань",
  "naberezhnye chelny": "Набережные Челны", "penza": "Пенза", "kirov": "Киров", "lipetsk": "Липецк",
  "cheboksary": "Чебоксары", "balashikha": "Балашиха", "kaliningrad": "Калининград", "tula": "Тула",
  "kursk": "Курск", "sevastopol": "Севастополь", "sebastopol": "Севастополь", "stavropol": "Ставрополь",
  "sochi": "Сочи", "ulan-ude": "Улан-Удэ", "tver": "Тверь", "magnitogorsk": "Магнитогорск", "ivanovo": "Иваново",
  "bryansk": "Брянск", "belgorod": "Белгород", "surgut": "Сургут", "vladimir": "Владимир", "chita": "Чита",
  "arkhangelsk": "Архангельск", "nizhny tagil": "Нижний Тагил", "simferopol": "Симферополь", "kaluga": "Калуга",
  "smolensk": "Смоленск", "volzhsky": "Волжский", "yakutsk": "Якутск", "saransk": "Саранск", "cherepovets": "Череповец",
  "kurgan": "Курган", "vologda": "Вологда", "oryol": "Орёл", "orel": "Орёл", "vladikavkaz": "Владикавказ",
  "podolsk": "Подольск", "grozny": "Грозный", "murmansk": "Мурманск", "tambov": "Тамбов", "sterlitamak": "Стерлитамак",
  "petrozavodsk": "Петрозаводск", "kostroma": "Кострома", "nizhnevartovsk": "Нижневартовск", "novorossiysk": "Новороссийск",
  "yoshkar-ola": "Йошкар-Ола", "taganrog": "Таганрог", "komsomolsk-on-amur": "Комсомольск-на-Амуре", "syktyvkar": "Сыктывкар",
  "nalchik": "Нальчик", "nizhnekamsk": "Нижнекамск", "shakhty": "Шахты", "dzerzhinsk": "Дзержинск", "bratsk": "Братск",
  "orsk": "Орск", "angarsk": "Ангарск", "blagoveshchensk": "Благовещенск", "engels": "Энгельс", "veliky novgorod": "Великий Новгород",
  "stary oskol": "Старый Оскол", "pskov": "Псков", "korolyov": "Королёв", "korolev": "Королёв", "mytishchi": "Мытищи",
  "lyubertsy": "Люберцы", "biysk": "Бийск", "prokopyevsk": "Прокопьевск", "yuzhno-sakhalinsk": "Южно-Сахалинск",
  "armavir": "Армавир", "balakovo": "Балаково", "abakan": "Абакан", "norilsk": "Норильск", "khimki": "Химки",
  "syzran": "Сызрань", "kamensk-uralsky": "Каменск-Уральский", "kamensk-uralskiy": "Каменск-Уральский",
  "petropavlovsk-kamchatskiy": "Петропавловск-Камчатский", "petropavlovsk-kamchatsky": "Петропавловск-Камчатский",
  "ussuriysk": "Уссурийск", "volgodonsk": "Волгодонск", "maykop": "Майкоп", "maikop": "Майкоп", "elista": "Элиста",
  "cherkessk": "Черкесск", "gorno-altaysk": "Горно-Алтайск", "khanty-mansiysk": "Ханты-Мансийск", "salekhard": "Салехард",
  "magadan": "Магадан", "anadyr": "Анадырь", "kyzyl": "Кызыл", "birobidzhan": "Биробиджан", "nazran": "Назрань",
  "magas": "Магас", "pyatigorsk": "Пятигорск", "kislovodsk": "Кисловодск", "essentuki": "Ессентуки",
  "essentuki urban district": "Ессентуки", "nevinnomyssk": "Невинномысск", "novocheboksarsk": "Новочебоксарск",
  "kovrov": "Ковров", "murom": "Муром", "obninsk": "Обнинск", "seversk": "Северск", "berdsk": "Бердск",
  "kopeysk": "Копейск", "snezhinsk": "Снежинск", "satka": "Сатка", "zlatoust": "Златоуст", "miass": "Миасс",
  "pervouralsk": "Первоуральск", "asbest": "Асбест", "verkhnyaya pyshma": "Верхняя Пышма", "pyshma": "Пышма",
  "glazov": "Глазов", "sarapul": "Сарапул", "votkinsk": "Воткинск", "rybinsk": "Рыбинск", "noyabrsk": "Ноябрьск",
  "novy urengoy": "Новый Уренгой", "nadym": "Надым", "tarko-sale": "Тарко-Сале", "ukhta": "Ухта", "vorkuta": "Воркута",
  "apatity": "Апатиты", "severodvinsk": "Северодвинск", "velikiye luki": "Великие Луки", "vyborg": "Выборг",
  "gatchina": "Гатчина", "vsevolozhsk": "Всеволожск", "kingisepp": "Кингисепп", "kirishi": "Кириши", "luga": "Луга",
  "kudrovo": "Кудрово", "bugry": "Бугры", "kolpino": "Колпино", "pargolovo": "Парголово", "shushary": "Шушары",
  "petergof": "Петергоф", "zelenograd": "Зеленоград", "ust-ilimsk": "Усть-Илимск", "shelekhov": "Шелехов",
  "artyom": "Артём", "artem": "Артём", "nakhodka": "Находка", "spassk-dalniy": "Спасск-Дальний", "chuguyevka": "Чугуевка",
  "svobodnyy": "Свободный", "tynda": "Тында", "mezhdurechensk": "Междуреченск", "anzhero-sudzhensk": "Анжеро-Судженск",
  "belovo": "Белово", "yurga": "Юрга", "ishim": "Ишим", "tobolsk": "Тобольск", "zheleznogorsk": "Железногорск",
  "sosnovoborsk": "Сосновоборск", "achinsk": "Ачинск", "kansk": "Канск", "kaspiysk": "Каспийск", "khasavyurt": "Хасавюрт",
  "derbent": "Дербент", "budyonnovsk": "Будённовск", "yeysk": "Ейск", "tuapse": "Туапсе", "tikhoretsk": "Тихорецк",
  "belorechensk": "Белореченск", "anapa": "Анапа", "gelendzhik": "Геленджик", "taman": "Тамань", "sirius": "Сириус",
  "aksay": "Аксай", "kamensk-shakhtinsky": "Каменск-Шахтинский", "donetsk": "Донецк", "novokuybyshevsk": "Новокуйбышевск",
  "novomoskovsk": "Новомосковск", "uzlovaya": "Узловая", "shebekino": "Шебекино", "alexeyevka": "Алексеевка",
  "ostrogozhsk": "Острогожск", "kimry": "Кимры", "ostashkov": "Осташков", "konakovo": "Конаково", "bologoye": "Бологое",
  "shuya": "Шуя", "aleksandrov": "Александров", "arzamas": "Арзамас", "kstovo": "Кстово", "bor": "Бор",
  "pervomaysk": "Первомайск", "balabanovo": "Балабаново", "zherdevka": "Жердевка", "velizh": "Велиж",
  "tymovskoye": "Тымовское", "kozyrevsk": "Козыревск", "innopolis": "Иннополис",
  // Подмосковье
  "noginsk": "Ногинск", "dubna": "Дубна", "kolomna": "Коломна", "chernogolovka": "Черноголовка", "shchyolkovo": "Щёлково",
  "shchelkovo": "Щёлково", "elektrostal": "Электросталь", "krasnogorsk": "Красногорск", "ramenskoye": "Раменское",
  "tomilino": "Томилино", "dolgoprudny": "Долгопрудный", "dmitrov": "Дмитров", "klin": "Клин", "voskresensk": "Воскресенск",
  "reutov": "Реутов", "domodedovo": "Домодедово", "lytkarino": "Лыткарино", "serpukhov": "Серпухов", "pushchino": "Пущино",
  "lobnya": "Лобня", "pushkino": "Пушкино", "sergiyev posad": "Сергиев Посад", "fryazino": "Фрязино", "odintsovo": "Одинцово",
  "stupino": "Ступино", "shatura": "Шатура", "nakhabino": "Нахабино", "mozhaysk": "Можайск", "khotkovo": "Хотьково",
  "monino": "Монино", "vidnoye": "Видное", "volokolamsk": "Волоколамск", "dzerzhinsky": "Дзержинский", "istra": "Истра",
  "solnechnogorsk": "Солнечногорск", "zhukovsky": "Жуковский", "orekhovo-zuyevo": "Орехово-Зуево", "naro-fominsk": "Наро-Фоминск",
  "chekhov": "Чехов", "ivanteyevka": "Ивантеевка", "krasnoznamensk": "Краснознаменск", "medvezhi ozera": "Медвежьи Озёра",
  // Татарстан и соседи — рядом с магазином
  "arsk": "Арск", "zelenodolsk": "Зеленодольск", "almetyevsk": "Альметьевск", "bugulma": "Бугульма", "chistopol": "Чистополь",
  "leninogorsk": "Лениногорск", "yelabuga": "Елабуга", "elabuga": "Елабуга", "aznakayevo": "Азнакаево", "buinsk": "Буинск",
  "laishevo": "Лаишево", "baltasi": "Балтаси", "kukmor": "Кукмор", "mamadysh": "Мамадыш", "menzelinsk": "Мензелинск",
  "verkhniy uslon": "Верхний Услон", "stolbishche": "Столбище", "vysokaya gora": "Высокая Гора",
};

function normCity(s) {
  return String(s || "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/[’'`ʼ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

module.exports = { CITY, REGION_CITY, normCity };
