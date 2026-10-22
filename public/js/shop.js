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
 ["Самовывоз через 60 минут",'<path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10M7.5 5l9 4"/>']
];
const SLIDES=[
 {kick:"Сезонная распродажа.",title:"Скидки до 70% на всю технику",text:"Эндуро, питбайки, электросамокаты, электровелосипеды, квадроциклы и снегоходы — по сниженным ценам, пока идёт сезон распродаж.",art:"sale",dark:true,cta:"Смотреть скидки",act:"sale"},
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
function addBtn(p,extra){return p.stock==="out"?`<button class="btn btn-y" disabled ${extra||""}>Нет в наличии</button>`:`<button class="btn btn-y" data-buy="${p.id}" ${extra||""}>Купить</button>`}
function cartBtn(p){return p.stock==="out"?"":`<button class="btn btn-o" data-add="${p.id}">${cart[p.id]?"В корзине":"В корзину"}</button>`}

/* ---------- город ---------- */
const CITIES=["Арск","Казань","Москва","Санкт-Петербург","Екатеринбург","Новосибирск","Краснодар","Нижний Новгород","Ростов-на-Дону"];
let city=store.get("city",null);
const SHOP_CITY="Арск";
let guess=null; // город, определённый сервером по IP (база DB-IP)
// Пока посетитель не выбрал город, спрашиваем про город, определённый по IP; не получилось — про Арск
async function detectCity(){
  try{
    const r=await fetch("/api/geo",{headers:{Accept:"application/json"},signal:AbortSignal.timeout(3000)});
    if(r.ok){const d=await r.json();if(d&&typeof d.city==="string"&&d.city)guess=d.city}
  }catch(e){}
  if(!city)renderCity("confirm");
}
function cityShort(){return city||SHOP_CITY}
function renderCity(ask){
  $("#cityName").textContent=city||"Выберите ваш город";
  const pop=$("#cityPop");
  if(ask==="confirm"){
    const g=guess||SHOP_CITY;
    pop.innerHTML=`<p><b>${esc(g)}</b> — это ваш город?</p><div class="row"><button data-city="${esc(g)}">Да</button><button data-city-list>Нет</button></div>`;
    pop.hidden=false;
  }else if(ask==="list"){
    const list=guess&&!CITIES.includes(guess)?[guess,...CITIES]:CITIES;
    pop.innerHTML=`<p>Выберите город</p><div class="city-list">${list.map(c=>`<button data-city="${esc(c)}">${esc(c)}</button>`).join("")}</div>`;
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
const {SHOP,BUDGETS}=MMwa;
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
    <div class="panel"><h3>Обсудить подборку</h3><p style="margin:0;color:#D9D8D2;font-size:14px">Напишите нам в WhatsApp — расскажем о наличии, тест-драйве и рассрочке. Сообщение с вашей подборкой уже готово.</p>
    <button class="btn btn-wa" data-buy-quiz>${WA_ICON} Написать в WhatsApp</button></div></div>`;
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
  ${city&&city!==SHOP_CITY?`<p class="note" style="margin:8px 0 0;font-size:14px">Доставка в г. ${esc(city)} — сроки и стоимость подскажем в WhatsApp.</p>`:""}
  ${p.desc?`<p style="margin:12px 0 0;white-space:pre-line">${esc(p.desc)}</p>`:""}
  ${p.specs.length?`<dl class="specs">${p.specs.map(s=>`<div><dt>${esc(s.k)}</dt><dd>${esc(s.v)}</dd></div>`).join("")}</dl>`:'<div style="height:14px"></div>'}
  <div class="price-row" style="margin-bottom:14px"><div class="price" style="font-size:30px">${rub(p.price)}${p.old?`<s>${rub(p.old)}</s>`:""}</div><div class="credit">В рассрочку<b>от ${rub(monthly(p.price))} / мес.</b></div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${addBtn(p,"autofocus")}${cartBtn(p)||`<button class="btn btn-o" data-soon="${p.id}">Узнать о поступлении</button>`}</div></div></div></div>`);
}
function openCart(){
  const ids=Object.keys(cart).filter(id=>byId[id]);
  const sum=ids.reduce((s,id)=>s+byId[id].price*cart[id],0);
  openLayer(`<div class="drawer-h"><h2 class="disp">Корзина</h2><button class="icon-btn" data-close aria-label="Закрыть корзину">${X}</button></div>
  <div class="drawer-b">${ids.length?ids.map(id=>{const p=byId[id];return `<div class="line"><div class="pic">${picHtml(p)}</div><div><div class="nm">${esc(p.name)}</div><div class="qty"><button data-qty="${id}" data-d="-1" aria-label="Меньше">−</button><span aria-live="polite">${cart[id]}</span><button data-qty="${id}" data-d="1" aria-label="Больше">+</button></div><br><button class="rm" data-rm="${id}">Удалить</button></div><b style="white-space:nowrap;font-variant-numeric:tabular-nums">${rub(p.price*cart[id])}</b></div>`}).join(""):`<div class="empty" style="grid-column:auto"><p style="margin:0 0 12px;font-weight:600">Корзина пуста</p><button class="btn btn-y" data-close data-goto="catalog">Перейти в каталог</button></div>`}</div>
  ${ids.length?`<div class="drawer-f"><div class="total"><span>Итого</span><b>${rub(sum)}</b></div><div class="credit" style="white-space:normal">В рассрочку от <b style="display:inline">${rub(monthly(sum))} / мес.</b> на 36 месяцев</div><button class="btn btn-wa" data-buy-cart>${WA_ICON} Купить через WhatsApp</button></div>`:""}`,"drawer");
}
/* ---------- покупка через WhatsApp ---------- */
// Сайт не собирает данные покупателя: «Купить» открывает WhatsApp магазина с готовым сообщением.
// На компьютере показываем QR-код для телефона, на телефоне — кнопку, которая сразу открывает WhatsApp.
const WA_ICON=`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z"/></svg>`;
// Сообщение для WhatsApp и короткая ссылка для QR-кода (тексты — в wa.js, общие с сервером)
function waRequest(kind,arg){
  if(kind==="product"||kind==="soon"){const p=byId[arg];return{text:MMwa.text(kind,p),path:MMwa.shortPath(kind,p.id)}}
  if(kind==="cart"){
    const ids=Object.keys(cart).filter(id=>byId[id]);
    return{text:MMwa.text("cart",{items:ids.map(id=>({name:byId[id].name,price:byId[id].price,qty:cart[id]}))}),path:MMwa.shortPath("cart",ids.map(id=>({id,qty:cart[id]})))};
  }
  if(kind==="quiz"){const c=catById[quiz.type],b=BUDGETS[quiz.budget];return{text:MMwa.text("quiz",{cat:c&&c.quiz,budget:b&&b[0]}),path:MMwa.shortPath("quiz",{cat:quiz.type,budget:quiz.budget})}}
  return{text:MMwa.text("consult"),path:MMwa.shortPath("consult")};
}
function qrSvg(url){try{const q=qrcode(0,"M");q.addData(url);q.make();return q.createSvgTag({cellSize:4,margin:12,scalable:true})}catch(e){return ""}}
function openBuy(kind,arg){
  const {text,path}=waRequest(kind,arg),url=MMwa.url(text);
  const p=kind==="product"?byId[arg]:null;
  const head=kind==="product"||kind==="cart"?"Покупка через WhatsApp":"Написать в WhatsApp";
  openLayer(`<div class="modal-h"><h2 class="h2" style="font-size:26px">${head}</h2><button class="icon-btn" data-close aria-label="Закрыть">${X}</button></div>
  <div class="modal-b"><div class="buy">
    <div class="buy-qr"><div class="qr">${qrSvg(location.origin+path)}</div><p class="note" style="margin:0;text-align:center">Наведите камеру телефона на код — откроется WhatsApp с готовым сообщением</p></div>
    <div class="buy-info">
      ${p?`<div class="buy-item"><div class="pic">${picHtml(p)}</div><div><div style="font-weight:600;line-height:1.3">${esc(p.name)}</div><div class="price" style="font-size:20px;margin-top:6px">${rub(p.price)}</div></div></div>`:""}
      <div class="field"><span style="font-size:13px;font-weight:600">Сообщение, которое получит менеджер</span><div class="wa-msg">${esc(text)}</div></div>
      <a class="btn btn-wa" href="${esc(url)}" target="_blank" rel="noopener" autofocus>${WA_ICON} Открыть WhatsApp</a>
      <p style="margin:0;font-size:14px">Или позвоните: <a href="tel:+${SHOP.phone}" style="font-weight:700;white-space:nowrap">${SHOP.phoneText}</a></p>
    </div>
  </div></div>`);
}

/* ---------- события ---------- */
function addToCart(id){if(!byId[id])return;cart[id]=(cart[id]||0)+1;saveCart();toast("Добавлено в корзину: "+byId[id].name);refreshCards()}
function refreshCards(){renderHits();renderCatalog();renderPop();if(quiz.step===3)renderQuiz()}

document.addEventListener("click",e=>{
  const t=e.target.closest("button,a,.scrim");
  if(!t)return;
  const d=t.dataset;
  if(d.close!==undefined&&(t.classList.contains("scrim")||t.tagName==="BUTTON")){closeLayer();if(d.goto)$("#"+d.goto).scrollIntoView({behavior:"smooth"});return}
  if(d.cat!==undefined){$("#mega").hidden=true;$("#megaBtn").setAttribute("aria-expanded","false");showCat(d.cat);return}
  if(d.buy){openBuy("product",d.buy);return}
  if(d.buyCart!==undefined){openBuy("cart");return}
  if(d.buyQuiz!==undefined){openBuy("quiz");return}
  if(d.soon){openBuy("soon",d.soon);return}
  if(d.add){addToCart(d.add);if($("#layer").firstChild&&!$(".drawer"))closeLayer();return}
  if(d.detail){openDetail(d.detail);return}
  if(d.fav){const id=d.fav;favs.has(id)?favs.delete(id):favs.add(id);saveFavs();toast(favs.has(id)?"Добавлено в избранное":"Убрано из избранного");refreshCards();return}
  if(d.qty){const id=d.qty;cart[id]=Math.max(0,(cart[id]||0)+(+d.d));if(!cart[id])delete cart[id];saveCart();openCart();refreshCards();return}
  if(d.rm){delete cart[d.rm];saveCart();openCart();refreshCards();return}
  if(d.open==="callback"){openBuy("consult");return}
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
  if(d.act){const a=d.act;if(a==="callback")openBuy("consult");else if(a==="quiz")$("#quiz").scrollIntoView({behavior:"smooth"});else if(a==="sale"){filter={...filter,cat:null,q:"",favOnly:false,sort:"sale",limit:12};$("#q").value="";$("#sort").value="sale";renderCatalog();$("#catalog").scrollIntoView({behavior:"smooth"})}else if(a.startsWith("cat:"))showCat(a.slice(4));return}
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
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("#layer").firstChild){closeLayer();return}$("#mega").hidden=true;if(city)renderCity()}});
/* ---------- загрузка каталога ---------- */
$("#chatFab").addEventListener("click",()=>openBuy("consult"));
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
/* старт */
renderNav();if(city)renderCity();else detectCity();renderSlider();restart();renderHits();renderQuiz();renderPop();renderCatalog();renderPerks();renderCounts();
loadProducts();
})();
