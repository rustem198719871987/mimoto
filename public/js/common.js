/* Общие помощники витрины и админки MiMoto. Категории приходят из /js/categories.js */
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const rub=n=>n.toLocaleString("ru-RU").replace(/,/g," ")+" ₽";
const monthly=p=>Math.ceil(p/36/10)*10;
const store={get(k,d){try{const v=localStorage.getItem("mimoto:"+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem("mimoto:"+k,JSON.stringify(v))}catch(e){}}};

/* ---------- иллюстрации техники (SVG, цвета логотипа) ---------- */
const Y="#FCCB05",K="#0A0A0A",G="#3A3A3A";
function wheel(x,y,r){return `<circle cx="${x}" cy="${y}" r="${r}" fill="${K}"/><circle cx="${x}" cy="${y}" r="${r*.62}" fill="#2A2A2A"/><circle cx="${x}" cy="${y}" r="${r*.28}" fill="${Y}"/><circle cx="${x}" cy="${y}" r="${r*.1}" fill="${K}"/>`}
const ART={
 enduro:()=>`${wheel(48,92,26)}${wheel(158,92,26)}
  <path d="M48 92 L98 78" stroke="${K}" stroke-width="7" stroke-linecap="round"/>
  <path d="M158 92 L130 34" stroke="${G}" stroke-width="7" stroke-linecap="round"/>
  <rect x="84" y="62" width="30" height="22" rx="3" fill="${K}"/><circle cx="99" cy="73" r="6" fill="${G}"/>
  <path d="M60 52 L92 50 L132 46 L140 58 L112 66 L74 62 Z" fill="${Y}"/>
  <path d="M38 50 L86 46 L98 52 L62 58 Z" fill="${K}"/>
  <path d="M26 54 L60 50 L56 60 L34 62 Z" fill="${Y}"/>
  <path d="M136 50 L176 56 L170 64 L140 60 Z" fill="${Y}"/>
  <path d="M120 30 L142 26" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  <path d="M132 38 L146 40 L146 52 L134 50 Z" fill="${K}"/>
  <path d="M86 84 L76 96 L60 96" stroke="${G}" stroke-width="4" fill="none"/>`,
 pit:()=>`${wheel(54,96,22)}${wheel(150,96,22)}
  <path d="M54 96 L96 84" stroke="${K}" stroke-width="7" stroke-linecap="round"/>
  <path d="M150 96 L128 48" stroke="${G}" stroke-width="7" stroke-linecap="round"/>
  <rect x="86" y="70" width="26" height="20" rx="3" fill="${K}"/>
  <path d="M66 66 L126 60 L134 70 L106 76 L76 74 Z" fill="${Y}"/>
  <path d="M46 62 L90 58 L100 64 L64 70 Z" fill="${K}"/>
  <path d="M38 66 L64 63 L60 72 L44 73 Z" fill="${Y}"/>
  <path d="M132 64 L166 70 L160 76 L134 72 Z" fill="${Y}"/>
  <path d="M118 44 L140 40" stroke="${K}" stroke-width="5" stroke-linecap="round"/>`,
 moped:()=>`${wheel(50,96,20)}${wheel(156,96,20)}
  <path d="M156 96 L138 46" stroke="${G}" stroke-width="6" stroke-linecap="round"/>
  <path d="M40 76 Q50 58 82 60 L110 72 L130 60 L146 58 L150 70 L136 84 L74 90 L44 88 Z" fill="${Y}"/>
  <path d="M52 56 L96 54 L100 62 L58 64 Z" fill="${K}"/>
  <rect x="74" y="78" width="30" height="14" rx="3" fill="${K}"/>
  <path d="M126 40 L150 36" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  <path d="M140 72 L176 76 L170 84 L142 82 Z" fill="${K}"/>`,
 scooter:()=>`${wheel(48,98,18)}${wheel(160,98,18)}
  <path d="M30 82 Q36 56 70 58 L96 60 L104 80 L136 80 L146 40 L158 40 L170 90 L60 96 L32 94 Z" fill="${Y}"/>
  <path d="M44 52 L96 50 L98 60 L46 62 Z" fill="${K}"/>
  <path d="M104 80 L136 80 L134 88 L106 88 Z" fill="${K}"/>
  <path d="M140 34 L166 30" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  <path d="M146 40 L156 24 L166 26 L158 42 Z" fill="${G}"/>`,
 atv:()=>`${wheel(48,90,26)}${wheel(156,90,26)}
  <path d="M20 68 L56 54 L130 52 L182 62 L184 74 L18 76 Z" fill="${Y}"/>
  <path d="M70 46 L120 44 L124 52 L72 54 Z" fill="${K}"/>
  <path d="M20 54 L48 50 M150 50 L182 54" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  <path d="M120 42 L132 26 M124 26 L146 24" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  <rect x="82" y="66" width="40" height="22" rx="3" fill="${K}"/>
  <path d="M24 76 L72 76 L64 84 L30 84 Z M132 76 L180 76 L176 84 L140 84 Z" fill="${K}"/>`,
 snow:()=>`<rect x="62" y="80" width="112" height="24" rx="12" fill="${K}"/>
  ${[78,100,122,144,160].map(x=>`<circle cx="${x}" cy="92" r="6" fill="${G}"/>`).join("")}
  <path d="M18 106 L96 106 Q110 106 110 98" stroke="${K}" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M40 106 L52 86" stroke="${K}" stroke-width="5"/>
  <path d="M28 88 L52 56 L104 48 L150 60 L176 80 L60 86 Z" fill="${Y}"/>
  <path d="M52 56 L66 30 L80 30 L76 52 Z" fill="${G}" opacity=".85"/>
  <path d="M96 50 L158 54 L162 64 L102 60 Z" fill="${K}"/>
  <path d="M72 34 L92 30" stroke="${K}" stroke-width="5" stroke-linecap="round"/>`,
 blower:()=>`<rect x="18" y="62" width="74" height="40" rx="4" fill="${Y}"/>
  <path d="M26 72 L84 72 M26 82 L84 82 M26 92 L84 92" stroke="${K}" stroke-width="4"/>
  <path d="M40 62 L40 30 L58 22 L58 62" fill="${Y}"/>
  <rect x="88" y="54" width="46" height="34" rx="4" fill="${K}"/>
  <rect x="96" y="44" width="28" height="12" rx="2" fill="${G}"/>
  ${wheel(122,98,16)}
  <path d="M130 56 L184 18 M176 14 L192 26" stroke="${K}" stroke-width="6" stroke-linecap="round"/>`,
 tow:()=>`<rect x="14" y="76" width="170" height="28" rx="14" fill="${K}"/>
  ${[30,58,86,114,142,168].map(x=>`<circle cx="${x}" cy="90" r="9" fill="${Y}"/>`).join("")}
  <rect x="58" y="44" width="78" height="32" rx="6" fill="${Y}"/>
  <rect x="68" y="52" width="26" height="14" rx="2" fill="${K}"/>
  <path d="M136 60 L190 40 M184 34 L196 46" stroke="${K}" stroke-width="6" stroke-linecap="round"/>
  <path d="M22 76 L22 54 L58 54" stroke="${K}" stroke-width="5" fill="none"/>`,
 trike:()=>`${wheel(62,94,20)}${wheel(36,98,20)}${wheel(162,98,20)}
  <path d="M36 98 L70 74 L128 74 L162 98" stroke="${K}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="20" y="52" width="44" height="22" rx="3" fill="${Y}"/>
  <path d="M24 60 L60 60 M24 66 L60 66" stroke="${K}" stroke-width="3"/>
  <path d="M74 58 L112 56 L114 64 L76 66 Z" fill="${K}"/>
  <path d="M94 66 L98 74" stroke="${K}" stroke-width="6"/>
  <path d="M128 74 L148 30" stroke="${G}" stroke-width="7" stroke-linecap="round"/>
  <path d="M136 28 L162 26" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  <path d="M146 60 L176 62 L170 70 L148 68 Z" fill="${Y}"/>`,
 kick:()=>`${wheel(42,100,16)}${wheel(166,100,16)}
  <rect x="36" y="84" width="112" height="12" rx="5" fill="${Y}"/>
  <rect x="58" y="96" width="62" height="7" rx="2" fill="${K}"/>
  <path d="M148 90 L166 100" stroke="${K}" stroke-width="7" stroke-linecap="round"/>
  <path d="M152 90 L140 20" stroke="${G}" stroke-width="8" stroke-linecap="round"/>
  <path d="M124 18 L158 16" stroke="${K}" stroke-width="6" stroke-linecap="round"/>
  <path d="M26 92 L40 84" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  <path d="M98 56 l-8 14 h7 l-4 12 l12 -16 h-7 l4 -10 z" fill="${Y}"/>`,
 escooter:()=>`${ART.scooter()}<path d="M84 62 l-8 14 h7 l-4 12 l12 -16 h-7 l4 -10 z" fill="${K}"/>`,
 };
function art(type,label){return `<svg viewBox="0 0 200 120" role="img" aria-label="${esc(label||"")}">${(ART[type]||ART.enduro)()}</svg>`}

const CATS=window.CATS||[];
const catById=Object.fromEntries(CATS.map(c=>[c.id,c]));
const STOCK={in:"В наличии",order:"Под заказ",out:"Нет в наличии"};
const PHOTO_RE=/^[0-9a-f]{32}\.(jpg|png|webp)$/;
function plural(n,a,b,c){const m=n%10,h=n%100;if(m===1&&h!==11)return a;if(m>=2&&m<=4&&(h<12||h>14))return b;return c}
function photoUrl(p){return "/uploads/"+p}
