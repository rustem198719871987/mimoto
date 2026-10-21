(function(){
"use strict";
let P=[],byId={},loaded=false,dbState="loading"; // loading | ok | off
const visible=()=>P.filter(p=>!p.hidden);
function normal(id,x){
  x=x||{};
  return {id,name:String(x.name||"Без названия"),cat:catById[x.cat]?x.cat:CATS[0].id,price:Math.max(0,Math.round(+x.price||0)),old:+x.old>0?Math.round(+x.old):null,
    hit:!!x.hit,stock:STOCK[x.stock]?x.stock:"in",hidden:!!x.hidden,rate:Math.min(5,Math.max(0,+x.rate||0)),rev:Math.max(0,Math.round(+x.rev||0)),
    desc:String(x.desc||""),specs:Array.isArray(x.specs)?x.specs.filter(s=>s&&s.k).map(s=>({k:String(s.k),v:String(s.v==null?"":s.v)})):[],
    photo:typeof x.photo==="string"&&PHOTO_RE.test(x.photo)?x.photo:null,sort:+x.sort||0};
}
function setProducts(list){P=list.sort((a,b)=>a.sort-b.sort||a.name.localeCompare(b.name,"ru"));byId=Object.fromEntries(P.map(p=>[p.id,p]));loaded=true}
function waitMsg(){return `<div class="empty"><p style="margin:0;font-weight:600">${dbState==="off"?"Не удалось загрузить каталог. Обновите страницу.":"Загружаем каталог…"}</p></div>`}
const PERKS=[
 ["Доставка по всей России",'<path d="M2 14l7-2 4-8 2 1-2 7 6-1 2-3h2l-1 5 1 5h-2l-2-3-6-1 2 7-2 1-4-8-7-2z"/>'],
 ["Гарантия на все товары",'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M5 15l7-5 7 5"/>'],
 ["Рассрочка без процентов",'<circle cx="12" cy="12" r="9"/><path d="M8 16l8-8"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/>'],
 ["Быстрый возврат товара",'<path d="M4 10a8 8 0 0 1 14-4l2 2"/><path d="M20 4v4h-4"/><path d="M20 14a8 8 0 0 1-14 4l-2-2"/><path d="M4 20v-4h4"/>'],
 ["Самовывоз через 60 минут",'<path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10M7.5 5l9 4"/>']
];
const SLIDES=[
 {kick:"Хранение мототехники.",title:"Сохраните технику в идеале до следующего сезона!",text:"Консервация, мойка и тёплый бокс на зиму. Весной заберёте готовый к выезду мотоцикл.",art:"enduro",dark:false,cta:"Оставить заявку",act:"callback"},
 {kick:"Сезон снегоходов открыт.",title:"Снегоходы и буксировщики в наличии",text:"Подготовим технику к зиме, поможем с регистрацией и прицепом.",art:"snow",dark:true,cta:"Смотреть снегоходы",act:"cat:snow"},
 {kick:"Рассрочка 0%.",title:"Забирай мото сегодня — плати частями",text:"Без первого взноса и переплаты на срок до 36 месяцев. Решение за 15 минут.",art:"pit",dark:false,cta:"Подобрать технику",act:"quiz"}
];

/* ---------- состояние ---------- */
let cart=store.get("cart",{}); // {id: qty}
let favs=new Set(store.get("favs",[]).map(String));
let filter={cat:null,q:"",favOnly:false,sort:"pop",limit:12};
let quiz={step:1,type:null,budget:null};
const saveCart=()=>{store.set("cart",cart);renderCounts()};
const saveFavs=()=>{store.set("favs",[...favs]);renderCounts()};

function renderCounts(){
  $("#cartCount").textContent=Object.values(cart).reduce((a,b)=>a+b,0);
  $("#favCount").textContent=favs.size;
}
function toast(t){const el=$("#toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2200)}

/* ---------- карточка товара ---------- */
function card(p){
  const fav=favs.has(p.id);
  const sale=p.old?Math.round((1-p.price/p.old)*100):0;
  return `<article class="card">
   <div class="pic">
     ${picHtml(p)}
     ${p.hit?'<span class="tag-hit">ХИТ</span>':""}
     ${sale?`<span class="tag-sale">−${sale}%</span>`:""}
     <button class="fav" data-fav="${p.id}" aria-pressed="${fav}" aria-label="${fav?"Убрать из избранного":"В избранное"}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${K}" stroke-width="2" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></button>
     <div class="mark">MIMOTO<span>MOTO</span></div>
   </div>
   <h3><button data-detail="${p.id}">${esc(p.name)}</button></h3>
   ${stockHtml(p)}
   <div class="rate">${p.rev?`<svg width="18" height="18" viewBox="0 0 24 24" fill="${Y}" aria-hidden="true"><path d="M12 2l3 7 7 .6-5.3 4.7 1.6 7.2L12 17.8 5.7 21.5l1.6-7.2L2 9.6 9 9z"/></svg><b>${p.rate.toFixed(1)}</b> · ${p.rev} ${plural(p.rev,"отзыв","отзыва","отзывов")}`:"Пока нет отзывов"}</div>
   <div class="price-row">
     <div class="price">${rub(p.price)}${p.old?`<s>${rub(p.old)}</s>`:""}</div>
     <div class="credit">В рассрочку<b>от ${rub(monthly(p.price))} / мес.</b></div>
   </div>
   <div class="card-act">
     <button class="btn btn-k" data-detail="${p.id}">Подробнее</button>
     ${addBtn(p)}
   </div>
  </article>`;
}
function picHtml(p){return p.photo?`<img src="${photoUrl(p.photo)}" alt="${esc(p.name)}" loading="lazy">`:art(p.cat,p.name)}
function stockHtml(p){return `<div class="stock ${p.stock}">${p.stock==="in"?"В наличии в Арске":STOCK[p.stock]}</div>`}
function addBtn(p,extra){return p.stock==="out"?`<button class="btn btn-y" disabled ${extra||""}>Нет в наличии</button>`:`<button class="btn btn-y" data-add="${p.id}" ${extra||""}>${cart[p.id]?"В корзине":"В корзину"}</button>`}

/* ---------- город ---------- */
const CITIES=["Арск","Казань","Москва","Санкт-Петербург","Екатеринбург","Новосибирск","Краснодар","Нижний Новгород","Ростов-на-Дону"];
let city=store.get("city",null);
const SHOP_CITY="Арск";
function cityShort(){return city||SHOP_CITY}
function renderCity(ask){
  $("#cityName").textContent=city||"Выберите ваш город";
  const pop=$("#cityPop");
  if(ask==="confirm"){
    pop.innerHTML=`<p><b>${SHOP_CITY}</b> — это ваш город?</p><div class="row"><button data-city="${SHOP_CITY}">Да</button><button data-city-list>Нет</button></div>`;
    pop.hidden=false;
  }else if(ask==="list"){
    pop.innerHTML=`<p>Выберите город</p><div class="city-list">${CITIES.map(c=>`<button data-city="${c}">${c}</button>`).join("")}</div>`;
    pop.hidden=false;
  }else pop.hidden=true;
  $("#cityBtn").setAttribute("aria-expanded",String(!pop.hidden));
}

/* ---------- шапка: меню, навигация ---------- */
function renderNav(){
  $("#catNav").innerHTML=CATS.map(c=>`<button data-cat="${c.id}" aria-pressed="${filter.cat===c.id}">${c.name}</button>`).join("");
  $("#mega").innerHTML=CATS.map(c=>`<button data-cat="${c.id}">${art(c.id,"")}${c.name}</button>`).join("");
  $("#fCats").innerHTML=CATS.map(c=>`<button class="flink" data-cat="${c.id}">${c.name}</button>`).join("");
}

/* ---------- слайдер ---------- */
let slideI=0,slideT;
function renderSlider(){
  const s=$("#slider");
  s.querySelectorAll(".slide").forEach(n=>n.remove());
  SLIDES.forEach((sl,i)=>{
    const d=document.createElement("div");
    d.className="slide"+(i===slideI?" on":"");
    d.setAttribute("aria-hidden",String(i!==slideI));
    const H=i===0?"h1":"h2";
    d.innerHTML=`<div class="slide-bg${sl.dark?" dark":""}"></div><div class="slide-in"><div><p class="kick">${sl.kick}</p><${H}>${sl.title}</${H}><p>${sl.text}</p><button class="btn btn-y" data-act="${sl.act}" ${i!==slideI?'tabindex="-1"':""}>${sl.cta}</button></div><div class="slide-art">${art(sl.art,sl.title)}</div></div>`;
    s.insertBefore(d,s.firstChild);
  });
  $("#dots").innerHTML=SLIDES.map((_,i)=>`<button aria-label="Слайд ${i+1}" aria-current="${i===slideI}" data-slide="${i}"></button>`).join("");
}
function go(i){slideI=(i+SLIDES.length)%SLIDES.length;renderSlider();restart()}
function restart(){clearInterval(slideT);if(!matchMedia("(prefers-reduced-motion: reduce)").matches)slideT=setInterval(()=>go(slideI+1),7000)}

/* ---------- хиты ---------- */
function renderHits(){const h=visible().filter(p=>p.hit);$("#hits").innerHTML=!loaded?waitMsg():h.length?h.map(card).join(""):`<div class="empty"><p style="margin:0">Скоро здесь появятся хиты продаж.</p></div>`}

/* ---------- подбор ---------- */
const BUDGETS=[["до 100 000 ₽",0,100000],["100 000 – 200 000 ₽",100000,200000],["200 000 – 400 000 ₽",200000,400000],["от 400 000 ₽",400000,1e9],["Пока не знаю",0,1e9]];
function renderQuiz(){
  const st=$("#quizSteps").children;
  [...st].forEach((s,i)=>s.classList.toggle("on",i<quiz.step));
  const b=$("#quizBody");
  if(quiz.step===1){
    b.innerHTML=`<p style="margin:0 0 18px;font-size:17px">Какой тип техники вас интересует?</p><div class="types">${CATS.map(c=>`<button class="type" data-qtype="${c.id}" aria-pressed="${quiz.type===c.id}">${art(c.id,"")}${c.quiz}</button>`).join("")}</div>`;
  }else if(quiz.step===2){
    b.innerHTML=`<p style="margin:0 0 18px;font-size:17px">${catById[quiz.type].quiz}: на какой бюджет рассчитываете?</p><div class="budgets">${BUDGETS.map((x,i)=>`<button data-qbud="${i}">${x[0]}</button>`).join("")}</div><button class="link-btn" data-qback style="margin-top:14px">← Изменить тип техники</button>`;
  }else{
    const [lbl,lo,hi]=BUDGETS[quiz.budget];
    let list=visible().filter(p=>p.cat===quiz.type&&p.price>=lo&&p.price<hi);
    const exact=list.length>0;
    if(!exact)list=visible().filter(p=>p.cat===quiz.type).sort((a,b)=>Math.abs(a.price-lo)-Math.abs(b.price-lo)).slice(0,3);
    b.innerHTML=`<div class="quiz-res"><div><p style="margin:0 0 16px;font-size:17px">${exact?`Подходит ${list.length} ${plural(list.length,"модель","модели","моделей")}`:"В этом бюджете моделей нет — вот ближайшие"} · ${catById[quiz.type].quiz}, ${lbl}</p><div class="grid">${list.map(card).join("")}</div><button class="link-btn" data-qreset style="margin-top:14px">← Начать подбор заново</button></div>
    <form class="panel" id="quizForm" novalidate><h3>Получите консультацию</h3><p style="margin:0;color:#D9D8D2;font-size:14px">Менеджер расскажет о наличии, тест-драйве и рассрочке.</p>
    <div class="field"><label for="qName">Имя</label><input id="qName" autocomplete="given-name" required></div>
    <div class="field"><label for="qPhone">Телефон</label><input id="qPhone" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" required></div>
    <p class="err" id="qErr" hidden></p>
    <button class="btn btn-y" type="submit">Жду звонка</button><p class="note" style="color:var(--muted-d);margin:0">Нажимая кнопку, вы соглашаетесь с <a style="color:var(--white)" href="/privacy.html" target="_blank" rel="noopener">политикой обработки персональных данных</a>.</p><input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true"></form></div>`;
  }
}

/* ---------- популярные категории ---------- */
function renderPop(){
  if(!loaded){$("#pop").innerHTML=waitMsg();return}
  const ids=["enduro","pit","atv","snow"].filter(id=>visible().some(p=>p.cat===id));
  $("#pop").innerHTML=ids.map(id=>{
    const items=visible().filter(p=>p.cat===id);
    const min=Math.min(...items.map(p=>p.price));
    return `<div class="pop-card">${art(id,catById[id].name)}<div class="pop-from"><span>от ${rub(min)}</span></div><h3>${catById[id].name}</h3><ul>${items.slice(0,4).map(p=>`<li><button data-detail="${p.id}">${esc(p.name)}</button></li>`).join("")}</ul><button class="see-all" data-cat="${id}">Смотреть все <i aria-hidden="true">›</i></button></div>`;
  }).join("");
}

/* ---------- каталог ---------- */
function renderCatalog(){
  let list=visible();
  if(filter.cat)list=list.filter(p=>p.cat===filter.cat);
  if(filter.favOnly)list=list.filter(p=>favs.has(p.id));
  if(filter.q){const q=filter.q.toLowerCase();list=list.filter(p=>(p.name+" "+catById[p.cat].name).toLowerCase().includes(q))}
  if(filter.sort==="asc")list.sort((a,b)=>a.price-b.price);
  else if(filter.sort==="desc")list.sort((a,b)=>b.price-a.price);
  else if(filter.sort==="sale")list=list.filter(p=>p.old);
  else list.sort((a,b)=>(b.hit||0)-(a.hit||0)||b.rev-a.rev);
  const title=filter.favOnly?"избранное":filter.q?`по запросу «${filter.q}»`:filter.cat?catById[filter.cat].name.toLowerCase():"всей техники";
  $("#catTitle").textContent=title;
  $("#catCount").textContent=`${list.length} ${plural(list.length,"товар","товара","товаров")}`;
  const shown=list.slice(0,filter.limit);
  $("#grid").innerHTML=!loaded?waitMsg():shown.length?shown.map(card).join("")+(list.length>shown.length?`<div class="more" style="grid-column:1/-1"><button class="btn btn-k" data-more>Показать ещё ${list.length-shown.length}</button></div>`:""):`<div class="empty"><p style="margin:0 0 12px;font-weight:600">${filter.favOnly?"В избранном пока пусто. Нажмите на сердечко на карточке товара.":"Ничего не нашлось. Попробуйте другой запрос или категорию."}</p><button class="btn btn-y" data-reset>Показать всю технику</button></div>`;
  $("#chips").innerHTML=`<button class="chip" data-cat="" aria-pressed="${!filter.cat&&!filter.favOnly&&!filter.q}">Все</button>`+CATS.map(c=>`<button class="chip" data-cat="${c.id}" aria-pressed="${filter.cat===c.id}">${c.name}</button>`).join("");
  $("#catNav").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(filter.cat===b.dataset.cat)));
}
function showCat(id){filter={...filter,cat:id||null,q:"",favOnly:false,limit:12};$("#q").value="";renderCatalog();$("#catalog").scrollIntoView({behavior:"smooth"})}

/* ---------- преимущества ---------- */
function renderPerks(){$("#perks").innerHTML=PERKS.map((x,i)=>`<div class="perk"><span class="n" aria-hidden="true">${i+1}</span><svg viewBox="0 0 24 24" fill="none" stroke="${K}" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">${x[1]}</svg><b>${x[0]}</b></div>`).join("")}

/* ---------- оверлеи ---------- */
let lastFocus=null;
function openLayer(html,kind){
  lastFocus=document.activeElement;
  $("#layer").innerHTML=`<div class="scrim" data-close></div>`+(kind==="drawer"?`<aside class="drawer" role="dialog" aria-modal="true" aria-label="Корзина">${html}</aside>`:`<div class="modal" role="dialog" aria-modal="true">${html}</div>`);
  setTimeout(()=>{const t=$("#layer").querySelector("[autofocus]")||$("#layer").querySelector(".icon-btn");t&&t.focus()},20);
}
function closeLayer(){$("#layer").innerHTML="";lastFocus&&lastFocus.focus&&lastFocus.focus()}
const X=`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

function openDetail(id){
  const p=byId[id];
  openLayer(`<div class="modal-h"><span class="note">${catById[p.cat].name}</span><button class="icon-btn" data-close aria-label="Закрыть">${X}</button></div>
  <div class="modal-b"><div class="pd"><div class="pic" style="aspect-ratio:4/3">${picHtml(p)}${p.hit?'<span class="tag-hit">ХИТ</span>':""}<div class="mark">MIMOTO<span>MOTO</span></div></div>
  <div><h2 class="h2" style="font-size:28px">${esc(p.name)}</h2>
  <div style="margin-top:12px">${stockHtml(p)}</div>
  ${p.desc?`<p style="margin:12px 0 0;white-space:pre-line">${esc(p.desc)}</p>`:""}
  ${p.specs.length?`<dl class="specs">${p.specs.map(s=>`<div><dt>${esc(s.k)}</dt><dd>${esc(s.v)}</dd></div>`).join("")}</dl>`:'<div style="height:14px"></div>'}
  <div class="price-row" style="margin-bottom:14px"><div class="price" style="font-size:30px">${rub(p.price)}${p.old?`<s>${rub(p.old)}</s>`:""}</div><div class="credit">В рассрочку<b>от ${rub(monthly(p.price))} / мес.</b></div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${addBtn(p,"autofocus")}<button class="btn btn-o" data-open="callback">Задать вопрос</button></div></div></div></div>`);
}
function openCart(){
  const ids=Object.keys(cart).filter(id=>byId[id]);
  const sum=ids.reduce((s,id)=>s+byId[id].price*cart[id],0);
  openLayer(`<div class="drawer-h"><h2 class="disp">Корзина</h2><button class="icon-btn" data-close aria-label="Закрыть корзину">${X}</button></div>
  <div class="drawer-b">${ids.length?ids.map(id=>{const p=byId[id];return `<div class="line"><div class="pic">${picHtml(p)}</div><div><div class="nm">${esc(p.name)}</div><div class="qty"><button data-qty="${id}" data-d="-1" aria-label="Меньше">−</button><span aria-live="polite">${cart[id]}</span><button data-qty="${id}" data-d="1" aria-label="Больше">+</button></div><br><button class="rm" data-rm="${id}">Удалить</button></div><b style="white-space:nowrap;font-variant-numeric:tabular-nums">${rub(p.price*cart[id])}</b></div>`}).join(""):`<div class="empty" style="grid-column:auto"><p style="margin:0 0 12px;font-weight:600">Корзина пуста</p><button class="btn btn-y" data-close data-goto="catalog">Перейти в каталог</button></div>`}</div>
  ${ids.length?`<div class="drawer-f"><div class="total"><span>Итого</span><b>${rub(sum)}</b></div><div class="credit" style="white-space:normal">В рассрочку от <b style="display:inline">${rub(monthly(sum))} / мес.</b> на 36 месяцев</div><button class="btn btn-y" data-checkout>Оформить заказ</button></div>`:""}`,"drawer");
}
function openCheckout(){
  const ids=Object.keys(cart).filter(id=>byId[id]);
  const sum=ids.reduce((s,id)=>s+byId[id].price*cart[id],0);
  openLayer(`<div class="modal-h"><h2 class="h2">Оформление заказа</h2><button class="icon-btn" data-close aria-label="Закрыть">${X}</button></div>
  <div class="modal-b"><form class="form" id="orderForm" novalidate>
   <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
    <div class="field"><label for="oName">Имя и фамилия</label><input id="oName" autocomplete="name" required autofocus></div>
    <div class="field"><label for="oPhone">Телефон</label><input id="oPhone" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" required></div>
   </div>
   <fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;margin-bottom:8px">Получение</legend><div class="seg">
    <label><input type="radio" name="dlv" value="pickup" checked> Самовывоз, ${SHOP_CITY}</label>
    <label><input type="radio" name="dlv" value="city"> Доставка по городу</label>
    <label><input type="radio" name="dlv" value="russia"> Транспортная компания</label></div></fieldset>
   <fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;margin-bottom:8px">Оплата</legend><div class="seg">
    <label><input type="radio" name="pay" value="receipt" checked> При получении</label>
    <label><input type="radio" name="pay" value="credit"> Рассрочка 0%</label>
    <label><input type="radio" name="pay" value="invoice"> Счёт для юрлица</label></div></fieldset>
   <div class="field"><label for="oCom">Комментарий</label><textarea id="oCom" placeholder="Например, удобное время звонка"></textarea></div>
   <div class="total" style="border-top:2px solid var(--black);padding-top:12px"><span>${ids.length} ${plural(ids.length,"позиция","позиции","позиций")}</span><b>${rub(sum)}</b></div>
   <p class="err" id="oErr" hidden></p>
   <button class="btn btn-y" type="submit">Подтвердить заказ</button>
   <p class="note" style="margin:0">Оплата на сайте не принимается: менеджер позвонит и подтвердит заказ.</p><p class="note" style="margin:0">Нажимая кнопку, вы соглашаетесь с <a href="/privacy.html" target="_blank" rel="noopener">политикой обработки персональных данных</a>.</p><input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
  </form></div>`);
}
function openCallback(){
  openLayer(`<div class="modal-h"><h2 class="h2">Заказать звонок</h2><button class="icon-btn" data-close aria-label="Закрыть">${X}</button></div>
  <div class="modal-b"><form class="form" id="cbForm" novalidate style="max-width:460px">
   <p style="margin:0">Перезвоним в рабочее время и ответим на вопросы о технике, наличии и рассрочке.</p>
   <div class="field"><label for="cbName">Имя</label><input id="cbName" autocomplete="given-name" required autofocus></div>
   <div class="field"><label for="cbPhone">Телефон</label><input id="cbPhone" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" required></div>
   <p class="err" id="cbErr" hidden></p>
   <button class="btn btn-y" type="submit">Жду звонка</button>
   <p class="note" style="margin:0">Нажимая кнопку, вы соглашаетесь с <a href="/privacy.html" target="_blank" rel="noopener">политикой обработки персональных данных</a>.</p><input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
  </form></div>`);
}
function done(title,text){
  openLayer(`<div class="modal-h"><span></span><button class="icon-btn" data-close aria-label="Закрыть">${X}</button></div><div class="modal-b"><div class="ok-box"><div class="big"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${K}" stroke-width="3" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></div><h2 class="h2" style="font-size:30px">${title}</h2><p style="margin:0;max-width:44ch">${text}</p><button class="btn btn-k" data-close autofocus>Продолжить покупки</button></div></div>`);
}
function phoneOk(v){return v.replace(/\D/g,"").length>=10}
function validate(nameId,phoneId,errId){
  const n=$("#"+nameId).value.trim(),ph=$("#"+phoneId).value;
  const e=$("#"+errId);
  if(!n){e.textContent="Укажите имя, чтобы менеджер знал, как к вам обращаться.";e.hidden=false;$("#"+nameId).focus();return false}
  if(!phoneOk(ph)){e.textContent="Введите номер телефона полностью, минимум 10 цифр.";e.hidden=false;$("#"+phoneId).focus();return false}
  e.hidden=true;return n;
}

/* ---------- события ---------- */
function addToCart(id){if(!byId[id])return;cart[id]=(cart[id]||0)+1;saveCart();toast("Добавлено в корзину: "+byId[id].name);refreshCards()}
function refreshCards(){renderHits();renderCatalog();renderPop();if(quiz.step===3)renderQuiz()}

document.addEventListener("click",e=>{
  const t=e.target.closest("button,a,.scrim");
  if(!t)return;
  const d=t.dataset;
  if(d.adm){admAction(d.adm,d.id);return}
  if(d.close!==undefined&&(t.classList.contains("scrim")||t.tagName==="BUTTON")){closeLayer();if(d.goto)$("#"+d.goto).scrollIntoView({behavior:"smooth"});return}
  if(d.cat!==undefined){$("#mega").hidden=true;$("#megaBtn").setAttribute("aria-expanded","false");showCat(d.cat);return}
  if(d.add){addToCart(d.add);if($("#layer").firstChild&&!$(".drawer"))closeLayer();return}
  if(d.detail){openDetail(d.detail);return}
  if(d.fav){const id=d.fav;favs.has(id)?favs.delete(id):favs.add(id);saveFavs();toast(favs.has(id)?"Добавлено в избранное":"Убрано из избранного");refreshCards();return}
  if(d.qty){const id=d.qty;cart[id]=Math.max(0,(cart[id]||0)+(+d.d));if(!cart[id])delete cart[id];saveCart();openCart();refreshCards();return}
  if(d.rm){delete cart[d.rm];saveCart();openCart();refreshCards();return}
  if(d.checkout!==undefined){openCheckout();return}
  if(d.open==="callback"){openCallback();return}
  if(d.slide){go(+d.slide);return}
  if(d.rail){$("#hits").scrollBy({left:(+d.rail)*$("#hits").clientWidth*.8,behavior:"smooth"});return}
  if(d.qtype){quiz.type=d.qtype;quiz.step=2;renderQuiz();return}
  if(d.qbud){quiz.budget=+d.qbud;quiz.step=3;renderQuiz();return}
  if(d.qback!==undefined){quiz.step=1;renderQuiz();return}
  if(d.qreset!==undefined){quiz={step:1,type:null,budget:null};renderQuiz();return}
  if(d.more!==undefined){filter.limit+=12;renderCatalog();return}
  if(d.reset!==undefined){filter={cat:null,q:"",favOnly:false,sort:filter.sort,limit:12};$("#q").value="";renderCatalog();return}
  if(d.city){city=d.city;store.set("city",city);renderCity();refreshCards();toast("Город: "+city);return}
  if(d.cityList!==undefined){renderCity("list");return}
  if(d.act){const a=d.act;if(a==="callback")openCallback();else if(a==="quiz")$("#quiz").scrollIntoView({behavior:"smooth"});else if(a.startsWith("cat:"))showCat(a.slice(4));return}
});
$("#cityBtn").addEventListener("click",e=>{e.stopPropagation();$("#cityPop").hidden?renderCity(city?"list":"confirm"):renderCity()});
$("#megaBtn").addEventListener("click",()=>{const m=$("#mega");m.hidden=!m.hidden;$("#megaBtn").setAttribute("aria-expanded",String(!m.hidden))});
document.addEventListener("click",e=>{
  if(!e.target.closest(".catalog-btn")){$("#mega").hidden=true;$("#megaBtn").setAttribute("aria-expanded","false")}
  if(!e.target.closest("#cityPop")&&!e.target.closest("#cityBtn")&&!$("#cityPop").hidden&&city)renderCity();
},true);
$("#cartBtn").addEventListener("click",openCart);
$("#favBtn").addEventListener("click",()=>{filter={...filter,favOnly:true,cat:null,q:"",limit:12};$("#q").value="";renderCatalog();$("#catalog").scrollIntoView({behavior:"smooth"})});
$("#searchForm").addEventListener("submit",e=>{e.preventDefault();filter={...filter,q:$("#q").value.trim(),cat:null,favOnly:false,limit:12};renderCatalog();$("#catalog").scrollIntoView({behavior:"smooth"})});
$("#sort").addEventListener("change",e=>{filter.sort=e.target.value;renderCatalog()});
$("#prevSlide").addEventListener("click",()=>go(slideI-1));
$("#nextSlide").addEventListener("click",()=>go(slideI+1));
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("#layer").firstChild){closeLayer();return}if(!$("#admin").hidden){adm.view==="edit"?admAction("list"):closeAdmin();return}$("#mega").hidden=true;if(city)renderCity();$("#chat").hidden=true}});
document.addEventListener("submit",e=>{
  const f=e.target;
  if(f.id==="orderForm"){e.preventDefault();(async()=>{const n=validate("oName","oPhone","oErr");if(!n)return;
    const num=await sendOrder({kind:"order",name:n,phone:$("#oPhone").value,delivery:f.dlv.value,payment:f.pay.value,comment:$("#oCom").value,items:Object.entries(cart).map(([id,qty])=>({id,qty})),website:hp(f)},$("#oErr"),f.querySelector("[type=submit]"));
    if(!num)return;cart={};saveCart();refreshCards();done("Заказ "+num+" оформлен",`${esc(n)}, спасибо! Менеджер позвонит, чтобы подтвердить наличие, доставку и оплату.`)})()}
  else if(f.id==="cbForm"){e.preventDefault();(async()=>{const n=validate("cbName","cbPhone","cbErr");if(!n)return;
    const num=await sendOrder({kind:"callback",name:n,phone:$("#cbPhone").value,website:hp(f)},$("#cbErr"),f.querySelector("[type=submit]"));
    if(num)done("Заявка принята",`${esc(n)}, перезвоним в рабочее время.`)})()}
  else if(f.id==="quizForm"){e.preventDefault();(async()=>{const n=validate("qName","qPhone","qErr");if(!n)return;
    const c=catById[quiz.type],b=BUDGETS[quiz.budget];
    const num=await sendOrder({kind:"quiz",name:n,phone:$("#qPhone").value,comment:`Подбор: ${c?c.quiz:"—"}, бюджет ${b?b[0]:"—"}`,website:hp(f)},$("#qErr"),f.querySelector("[type=submit]"));
    if(num)done("Заявка принята",`${esc(n)}, менеджер позвонит и расскажет о моделях из подборки.`)})()}
});
/* чат */
$("#chatFab").addEventListener("click",()=>{const c=$("#chat");c.hidden=!c.hidden;$("#chatFab").setAttribute("aria-expanded",String(!c.hidden));if(!c.hidden)$("#chatIn").focus()});
$("#chatClose").addEventListener("click",()=>{$("#chat").hidden=true;$("#chatFab").setAttribute("aria-expanded","false")});
$("#chatForm").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.target,err=$("#chatErr"),v=$("#chatIn").value.trim(),ph=$("#chatPhone").value;
  if(!v){err.textContent="Напишите вопрос.";err.hidden=false;$("#chatIn").focus();return}
  if(!phoneOk(ph)){err.textContent="Оставьте телефон, чтобы мы могли ответить: минимум 10 цифр.";err.hidden=false;$("#chatPhone").focus();return}
  const num=await sendOrder({kind:"question",phone:ph,comment:v,website:hp(f)},err,f.querySelector("[type=submit]"));
  if(!num)return;
  const b=$("#chatB");b.insertAdjacentHTML("beforeend",`<div class="msg me">${esc(v)}</div><div class="msg them">Спасибо! Менеджер перезвонит или напишет вам в рабочее время.</div>`);
  $("#chatIn").value="";f.querySelector("[type=submit]").disabled=false;b.scrollTop=b.scrollHeight});

/* ---------- загрузка каталога и отправка заявок ---------- */
async function loadProducts(){
  try{
    const r=await fetch("/api/products",{headers:{Accept:"application/json"}});
    if(!r.ok)throw new Error(r.status);
    setProducts((await r.json()).map(x=>normal(x.id,x)));dbState="ok";
    let changed=false;for(const id of Object.keys(cart))if(!byId[id]){delete cart[id];changed=true}
    if(changed)saveCart();
  }catch(e){dbState="off"}
  refreshCards();renderCounts();
}
async function sendOrder(payload,errEl,btn){
  errEl.hidden=true;if(btn)btn.disabled=true;
  try{
    const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||"Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.");
    return data.number;
  }catch(e){
    errEl.textContent=e.message&&!/fetch|network/i.test(e.message)?e.message:"Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
    errEl.hidden=false;if(btn)btn.disabled=false;return null;
  }
}
const hp=f=>{const h=f.querySelector("[name=website]");return h?h.value:""};

/* старт */
renderNav();renderCity(city?null:"confirm");renderSlider();restart();renderHits();renderQuiz();renderPop();renderCatalog();renderPerks();renderCounts();
loadProducts();
})();
