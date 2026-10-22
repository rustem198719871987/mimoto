/* Админка MiMoto: каталог товаров. Все данные — через /api/admin/* */
(function(){
"use strict";

const XI=`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

let P=[],byId={},loaded=false;
let adm={view:"list",q:"",cat:"",edit:null,photo:undefined,confirm:null};

function toast(t){const el=$("#toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2600)}

class AuthError extends Error{}
async function api(method,url,body,isForm){
  const opt={method,headers:{"X-MM":"1",Accept:"application/json"},credentials:"same-origin"};
  if(body!==undefined){if(isForm)opt.body=body;else{opt.headers["Content-Type"]="application/json";opt.body=JSON.stringify(body)}}
  let r;
  try{r=await fetch(url,opt)}catch(e){throw new Error("Нет связи с сервером. Проверьте интернет.")}
  const data=await r.json().catch(()=>({}));
  if(r.status===401&&!url.endsWith("/login")){renderLogin("Сессия закончилась. Войдите снова.");throw new AuthError("auth")}
  if(!r.ok)throw new Error(data.error||"Ошибка сервера. Попробуйте ещё раз.");
  return data;
}
const fail=e=>{if(!(e instanceof AuthError))toast(e.message)};

/* ---------- вход ---------- */
function renderLogin(msg){
  $("#app").innerHTML=`<div class="login"><form id="loginForm" novalidate>
    <img src="/img/logo-mark.jpg" alt="MiMoto" width="600" height="372">
    <h1 class="disp">Вход в админку</h1>
    <div class="field"><label for="pw">Пароль</label><input id="pw" type="password" autocomplete="current-password" required autofocus></div>
    <p class="err" id="loginErr" ${msg?"":"hidden"}>${msg?esc(msg):""}</p>
    <button class="btn btn-y" type="submit">Войти</button>
  </form></div>`;
  $("#pw").focus();
}
async function login(){
  const err=$("#loginErr"),pw=$("#pw").value;
  if(!pw){err.textContent="Введите пароль.";err.hidden=false;return}
  try{await api("POST","/api/admin/login",{password:pw});await start()}
  catch(e){err.textContent=e.message;err.hidden=false;$("#pw").select()}
}

/* ---------- каркас ---------- */
function renderShell(){
  $("#app").innerHTML=`<div class="adm-head"><div class="wrap">
    <h2 class="disp" tabindex="-1" style="font-size:22px"><span style="color:var(--yellow)">Mi</span>MOTO</h2>
    <nav class="tabs" aria-label="Разделы"><span class="tab" aria-current="page">Товары</span></nav>
    <span style="flex:1"></span>
    <a class="lnk" href="/" target="_blank" rel="noopener">Открыть сайт</a>
    <button class="logout" data-act="logout">Выйти</button>
  </div></div><div id="view"></div>`;
  renderView();
}
function renderView(){
  if(adm.view==="edit")$("#view").innerHTML=formHtml();else renderProductsView();
}

/* ---------- товары: список ---------- */
async function loadProducts(){P=await api("GET","/api/admin/products");byId=Object.fromEntries(P.map(p=>[p.id,p]));loaded=true}
function renderProductsView(){
  $("#view").innerHTML=`<div class="wrap">
    <div class="adm-tools">
      <div class="field"><label for="admQ">Поиск товара</label><input id="admQ" type="search" value="${esc(adm.q)}" placeholder="Название или код" autocomplete="off"></div>
      <div class="field sm"><label for="admCat">Категория</label><select id="admCat"><option value="">Все категории</option>${CATS.map(c=>`<option value="${c.id}" ${adm.cat===c.id?"selected":""}>${c.name}</option>`).join("")}</select></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-y" data-act="new">+ Добавить товар</button>
        <a class="mini" href="/api/admin/export" style="display:inline-flex;align-items:center;text-decoration:none;color:inherit">Экспорт JSON</a>
        <label class="mini" for="admImport" style="display:inline-flex;align-items:center;cursor:pointer" title="Добавить новые товары и обновить существующие">Импорт JSON</label><input type="file" id="admImport" accept="application/json,.json" hidden>
        <label class="mini" for="admReplace" style="display:inline-flex;align-items:center;cursor:pointer" title="Каталог станет точно как в файле: товары, которых нет в файле, удалятся">Заменить каталог</label><input type="file" id="admReplace" accept="application/json,.json" hidden>
      </div>
    </div>
    <p class="save-state" style="margin:0 0 12px;color:var(--muted)"><span id="admCount"></span> <span id="saveState" aria-live="polite">Цена, наличие и флажки сохраняются сразу при изменении.</span></p>
    <div class="adm-table-box"><table class="adm-table"><thead><tr><th>Фото</th><th>Товар</th><th>Категория</th><th>Цена, ₽</th><th>Старая цена, ₽</th><th>Наличие</th><th>Хит</th><th>На сайте</th><th></th></tr></thead><tbody id="admRows"></tbody></table></div>
  </div>`;
  renderRows();
}
function renderRows(){
  const box=$("#admRows");if(!box)return;
  const q=adm.q.toLowerCase();
  const list=P.filter(p=>(!adm.cat||p.cat===adm.cat)&&(!q||(p.name+" "+p.id).toLowerCase().includes(q)));
  const hid=P.filter(p=>p.hidden).length;
  $("#admCount").textContent=`${P.length} ${plural(P.length,"товар","товара","товаров")}${hid?`, скрыто ${hid}`:""}.`;
  if(!list.length){box.innerHTML=`<tr><td colspan="9"><div class="adm-msg">${P.length?"Ничего не найдено.":"Товаров пока нет. Нажмите «Добавить товар» или загрузите файл через «Импорт JSON»."}</div></td></tr>`;return}
  box.innerHTML=list.map(p=>{const L=esc(p.name);return `<tr class="${p.hidden?"is-hidden":""}">
    <td><div class="thumb">${p.photo?`<img src="${photoUrl(p.photo)}" alt="">`:art(p.cat,"")}</div></td>
    <td style="min-width:260px"><div class="nm">${L}</div>${p.hidden?'<span class="chip-s">скрыт</span>':""}${p.hit?'<span class="chip-s k">хит</span>':""}${p.photo?"":'<span class="chip-s">нет фото</span>'}</td>
    <td>${catById[p.cat]?catById[p.cat].name:esc(p.cat)}</td>
    <td><input type="number" min="1" step="100" value="${p.price}" data-f="price" data-id="${p.id}" aria-label="Цена: ${L}"></td>
    <td><input type="number" min="0" step="100" value="${p.old||""}" placeholder="—" data-f="old" data-id="${p.id}" aria-label="Старая цена: ${L}"></td>
    <td><select data-f="stock" data-id="${p.id}" aria-label="Наличие: ${L}">${Object.entries(STOCK).map(([k,v])=>`<option value="${k}" ${p.stock===k?"selected":""}>${v}</option>`).join("")}</select></td>
    <td><input type="checkbox" data-f="hit" data-id="${p.id}" ${p.hit?"checked":""} aria-label="Хит продаж: ${L}"></td>
    <td><input type="checkbox" data-f="show" data-id="${p.id}" ${p.hidden?"":"checked"} aria-label="Показывать на сайте: ${L}"></td>
    <td><div class="adm-act">${adm.confirm===p.id?`<span style="font-weight:600">Удалить?</span><button class="mini solid-danger" data-act="del-yes" data-id="${p.id}">Да, удалить</button><button class="mini" data-act="del-no">Нет</button>`:`<button class="mini" data-act="edit" data-id="${p.id}">Изменить</button><button class="mini danger" data-act="del" data-id="${p.id}" aria-label="Удалить: ${L}">Удалить</button>`}</div></td>
  </tr>`}).join("");
}
async function inlineSave(el){
  const id=el.dataset.id,f=el.dataset.f,st=$("#saveState"),p=byId[id];
  let patch;
  if(f==="price")patch={price:Math.round(+el.value)};
  else if(f==="old")patch={old:el.value===""?null:Math.round(+el.value)};
  else if(f==="stock")patch={stock:el.value};
  else if(f==="hit")patch={hit:el.checked};
  else if(f==="show")patch={hidden:!el.checked};
  st.textContent="Сохраняем…";
  try{const np=await api("PATCH","/api/admin/products/"+id,patch);Object.assign(p,np);st.innerHTML=`Сохранено: ${esc(np.name)}.`;renderRows()}
  catch(e){st.innerHTML=`<span class="err">${esc(e.message)}</span>`;renderRows()}
}

/* ---------- товары: форма ---------- */
function blank(){const maxSort=P.reduce((m,p)=>Math.max(m,p.sort),0);return{id:null,name:"",cat:adm.cat||(CATS[0]&&CATS[0].id),price:"",old:null,hit:false,stock:"in",hidden:false,rate:0,rev:0,desc:"",specs:[],photo:null,sort:maxSort+10}}
function formHtml(){
  const p=adm.edit,isNew=!p.id,ph=adm.photo===undefined?p.photo:adm.photo;
  return `<div class="wrap"><form class="adm-form" id="admForm" novalidate>
   <div class="form">
    <div style="display:flex;align-items:center;gap:8px"><button type="button" class="mini" data-act="list">← К списку</button><h2 class="h2" style="font-size:28px" tabindex="-1">${isNew?"Новый товар":"Редактирование"}</h2></div>
    <div class="field"><label for="fName">Название</label><input id="fName" value="${esc(p.name)}" required placeholder="Например, Мотоцикл эндуро MiMoto X300"></div>
    <div class="adm-grid">
      <div class="field"><label for="fCat">Категория</label><select id="fCat">${CATS.map(c=>`<option value="${c.id}" ${p.cat===c.id?"selected":""}>${c.name}</option>`).join("")}</select></div>
      <div class="field"><label for="fStock">Наличие</label><select id="fStock">${Object.entries(STOCK).map(([k,v])=>`<option value="${k}" ${p.stock===k?"selected":""}>${v}</option>`).join("")}</select></div>
      <div class="field"><label for="fPrice">Цена, ₽</label><input id="fPrice" type="number" min="1" step="100" value="${p.price||""}" required></div>
      <div class="field"><label for="fOld">Старая цена, ₽</label><input id="fOld" type="number" min="0" step="100" value="${p.old||""}" placeholder="Для скидки"></div>
    </div>
    <div style="display:flex;gap:4px 28px;flex-wrap:wrap">
      <label class="chk"><input type="checkbox" id="fHit" ${p.hit?"checked":""}> Хит продаж</label>
      <label class="chk"><input type="checkbox" id="fShow" ${p.hidden?"":"checked"}> Показывать на сайте</label>
    </div>
    <div class="field"><label for="fDesc">Описание</label><textarea id="fDesc" style="height:110px" placeholder="Пара предложений о модели">${esc(p.desc)}</textarea></div>
    <div class="field"><label for="fSpecs">Характеристики</label><textarea id="fSpecs" style="height:150px" placeholder="Двигатель: 4Т, 250 см³">${esc(p.specs.map(s=>s.k+": "+s.v).join("\n"))}</textarea><p class="hint">Каждая характеристика с новой строки, название и значение через двоеточие.</p></div>
    <div class="adm-grid">
      <div class="field"><label for="fRate">Рейтинг (0–5)</label><input id="fRate" type="number" min="0" max="5" step="0.1" value="${p.rate||""}"></div>
      <div class="field"><label for="fRev">Отзывов</label><input id="fRev" type="number" min="0" step="1" value="${p.rev||""}"></div>
      <div class="field"><label for="fSort">Порядок</label><input id="fSort" type="number" step="1" value="${p.sort}"><p class="hint">Меньше число — выше в списке.</p></div>
    </div>
    <p class="err" id="fErr" hidden></p>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-y" type="submit" id="fSave">${isNew?"Добавить товар":"Сохранить"}</button><button class="btn btn-o" type="button" data-act="list">Отмена</button></div>
   </div>
   <div>
    <div class="field"><span style="font-size:13px;font-weight:600">Фото</span>
      <div class="photo-box">${ph?`<img src="${photoUrl(ph)}" alt="Фото товара">`:art(p.cat,"Фото не загружено")}</div>
      <label class="btn btn-k" for="fPhoto" style="cursor:pointer">${ph?"Заменить фото":"Загрузить фото"}</label><input type="file" id="fPhoto" accept="image/png,image/jpeg,image/webp" hidden>
      ${ph?'<button type="button" class="link-btn" data-act="photo-rm">Убрать фото</button>':""}
      <p class="hint" id="fPhotoState" aria-live="polite">JPG, PNG или WebP. Большие фото уменьшатся сами. Лучше светлый фон и формат 4:3.</p>
    </div>
   </div>
  </form></div>`;
}
const FIELDS=["fName","fCat","fStock","fPrice","fOld","fDesc","fSpecs","fRate","fRev","fSort"];
function collect(){const o={};FIELDS.forEach(i=>{o[i]=$("#"+i).value});o.fHit=$("#fHit").checked;o.fShow=$("#fShow").checked;return o}
function refill(o){Object.entries(o).forEach(([k,v])=>{const el=$("#"+k);if(!el)return;if(el.type==="checkbox")el.checked=v;else el.value=v})}
function rerenderForm(){const keep=collect();$("#view").innerHTML=formHtml();refill(keep)}
// Фото с телефона весят 3–8 МБ: уменьшаем до 1600 px по длинной стороне и сохраняем в JPEG ~85%.
// Так снимок занимает 200–400 КБ — меньше места на диске сервера и быстрее загрузка сайта.
const MAX_SIDE=1600;
async function shrinkPhoto(file){
  try{
    const img=await createImageBitmap(file);
    const k=Math.min(1,MAX_SIDE/Math.max(img.width,img.height));
    if(k===1&&file.size<800*1024){img.close();return file}
    const c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);img.close();
    const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.85));
    return blob&&blob.size<file.size?blob:file;
  }catch(e){return file}
}
async function uploadPhoto(file){
  const st=$("#fPhotoState");if(!file)return;
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)){st.textContent="Подходят только JPG, PNG или WebP.";return}
  if(file.size>40*1024*1024){st.textContent="Файл больше 40 МБ. Выберите другое фото.";return}
  st.textContent="Уменьшаем и загружаем фото…";
  const photo=await shrinkPhoto(file);
  if(photo.size>10*1024*1024){st.textContent="Не удалось уменьшить фото до 10 МБ. Выберите другое фото.";return}
  const fd=new FormData();fd.append("photo",photo,"photo.jpg");
  try{const r=await api("POST","/api/admin/upload",fd,true);adm.photo=r.photo;rerenderForm();$("#fPhotoState").textContent="Фото загружено. Нажмите «Сохранить», чтобы применить."}
  catch(e){if(!(e instanceof AuthError))st.textContent=e.message}
}
async function saveProduct(){
  const o=collect(),err=$("#fErr"),p=adm.edit;
  const bad=(m,f)=>{err.textContent=m;err.hidden=false;$("#"+f).focus()};
  const name=o.fName.trim(),price=Math.round(+o.fPrice),old=o.fOld===""?null:Math.round(+o.fOld);
  if(!name)return bad("Укажите название товара.","fName");
  if(!(price>0))return bad("Укажите цену больше нуля.","fPrice");
  if(old&&old<=price)return bad("Старая цена должна быть больше текущей, иначе скидка не покажется.","fOld");
  const specs=o.fSpecs.split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.indexOf(":");return i>0?{k:l.slice(0,i).trim(),v:l.slice(i+1).trim()}:{k:l,v:""}});
  const body={name,cat:o.fCat,price,old:old||null,hit:o.fHit,stock:o.fStock,hidden:!o.fShow,rate:+o.fRate||0,rev:+o.fRev||0,desc:o.fDesc.trim(),specs,photo:(adm.photo===undefined?p.photo:adm.photo)||null,sort:Math.round(+o.fSort)||0};
  err.hidden=true;$("#fSave").disabled=true;
  try{
    await api(p.id?"PUT":"POST","/api/admin/products"+(p.id?"/"+p.id:""),body);
    toast(p.id?"Изменения сохранены":"Товар добавлен");
    await loadProducts();toList();
  }catch(e){$("#fSave").disabled=false;if(!(e instanceof AuthError)){err.textContent=e.message;err.hidden=false}}
}
function toList(){adm.view="list";adm.edit=null;adm.photo=undefined;renderView()}
let pendingReplace=null;
async function readJson(file){
  const st=$("#saveState");
  try{const arr=JSON.parse(await file.text());if(!Array.isArray(arr))throw 0;return arr}
  catch(e){st.textContent="Файл не похож на список товаров. Выберите файл, сохранённый через «Экспорт JSON».";return null}
}
async function importFile(file,replace){
  const st=$("#saveState");const arr=await readJson(file);if(!arr)return;
  if(replace){
    const ids=new Set(arr.map(x=>x&&x.id).filter(Boolean));
    const gone=P.filter(p=>!ids.has(p.id));
    pendingReplace=arr;
    st.innerHTML=`<b>Заменить каталог?</b> В файле ${arr.length} ${plural(arr.length,"товар","товара","товаров")}. ${gone.length?`Будут удалены ${gone.length} ${plural(gone.length,"товар","товара","товаров")}, которых нет в файле (вместе с их фото).`:"Удалять ничего не придётся."} <button class="mini solid-danger" data-act="replace-yes">Да, заменить</button> <button class="mini" data-act="replace-no">Отмена</button>`;
    return;
  }
  await runImport(arr,false);
}
async function runImport(arr,replace){
  const st=$("#saveState");st.textContent="Импортируем…";
  try{const r=await api("POST","/api/admin/import"+(replace?"?replace=1":""),arr);await loadProducts();renderRows();
    $("#saveState").innerHTML=`Добавлено: ${r.added}, обновлено: ${r.updated}${r.removed?`, удалено: ${r.removed}`:""}${r.skipped.length?`, пропущено: ${r.skipped.length} (${esc(r.skipped.slice(0,3).join("; "))}${r.skipped.length>3?"…":""})`:""}.`;renderRows()}
  catch(e){if(!(e instanceof AuthError))st.textContent=e.message}
}

/* ---------- события ---------- */
document.addEventListener("submit",e=>{
  if(e.target.id==="loginForm"){e.preventDefault();login()}
  else if(e.target.id==="admForm"){e.preventDefault();saveProduct()}
});
document.addEventListener("click",async e=>{
  const t=e.target.closest("button");if(!t)return;const d=t.dataset;
  const a=d.act;if(!a)return;
  try{
    if(a==="logout"){await api("POST","/api/admin/logout");renderLogin();return}
    if(a==="new"||a==="edit"){adm.edit=a==="new"?blank():{...byId[d.id],specs:byId[d.id].specs.slice()};adm.photo=undefined;adm.view="edit";renderView();window.scrollTo(0,0);$("#fName").focus();return}
    if(a==="list"){toList();return}
    if(a==="del"){adm.confirm=d.id;renderRows();return}
    if(a==="del-no"){adm.confirm=null;renderRows();return}
    if(a==="del-yes"){adm.confirm=null;await api("DELETE","/api/admin/products/"+d.id);await loadProducts();renderRows();toast("Товар удалён");return}
    if(a==="photo-rm"){adm.photo=null;rerenderForm();return}
    if(a==="replace-yes"){const arr=pendingReplace;pendingReplace=null;if(arr)await runImport(arr,true);return}
    if(a==="replace-no"){pendingReplace=null;$("#saveState").innerHTML=`Замена каталога отменена.`;renderRows();return}
  }catch(er){fail(er)}
});
document.addEventListener("change",e=>{
  const el=e.target;
  if(el.matches("#admRows [data-f]"))inlineSave(el);
  else if(el.id==="admImport"||el.id==="admReplace"){const f=el.files[0];el.value="";if(f)importFile(f,el.id==="admReplace")}
  else if(el.id==="fPhoto")uploadPhoto(el.files[0]);
  else if(el.id==="admCat"){adm.cat=el.value;renderRows()}
});
document.addEventListener("input",e=>{if(e.target.id==="admQ"){adm.q=e.target.value;renderRows()}});
document.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&e.target.matches("#admRows input[type=number]")){e.preventDefault();e.target.blur()}
  if(e.key==="Escape"&&adm.view==="edit")toList();
});

async function start(){
  try{await loadProducts()}catch(e){if(!(e instanceof AuthError))$("#app").innerHTML=`<p class="adm-msg" style="margin:40px auto;max-width:480px">${esc(e.message)}</p>`;return}
  renderShell();
}
(async()=>{
  try{const r=await fetch("/api/admin/me",{credentials:"same-origin"});const d=await r.json();d.admin?start():renderLogin()}
  catch(e){renderLogin("Нет связи с сервером.")}
})();
})();
