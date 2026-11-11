/* Логика магазина. Товары и настройки — в index.html. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const rub = n => n.toLocaleString("ru-RU") + " RUB";
const byId = id => PRODUCTS.find(p => p.id === id);
const hasPrice = p => typeof p.price === "number" && p.price > 0;
// скидка действует, пока не наступило CONFIG.saleUntil
const saleOn = () => !!CONFIG.saleUntil && Date.now() < Date.parse(CONFIG.saleUntil);
const onSale = p => hasPrice(p) && typeof p.sale === "number" && p.sale > 0 && p.sale < p.price && saleOn();
const priceOf = p => onSale(p) ? p.sale : p.price;
const priceText = p => !hasPrice(p) ? "Цена по запросу"
  : onSale(p) ? `<s class="price-old"><span class="vh">Старая цена </span>${rub(p.price)}</s> <span class="price-new"><span class="vh">цена со скидкой </span>${rub(p.sale)}</span>`
  : rub(p.price);
const isSoldOut = p => p.sizes.every(s => (p.soldOut || []).includes(s));
const colorsOf = p => p.colors || [];
const plural = (n, [one, few, many]) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dotHTML = c => `<i class="dot" style="background:${(typeof COLORS === "object" && COLORS[c]) || "#fff"}"></i>`;
/* ник из «@name», «name» или ссылки t.me/name */
/* статистика: track.js задаёт gaTrack; если его нет — ничего не делаем */
const track = (...a) => { try { if (typeof window.gaTrack === "function") window.gaTrack(...a); } catch {} };
const tgName = v => String(v || "").trim().replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");

/* ---------- рисунки-заглушки ---------- */
const DRAW = {
  "tee-regular": {
    front: {
      body: "M150 92Q200 124 250 92L302 110 358 178 318 214 292 188 296 412Q200 422 104 412L108 188 82 214 42 178 98 110Z",
      lines: ["M150 92Q200 104 250 92", "M140 96Q200 142 260 96", "M98 110Q103 150 108 188", "M302 110Q297 150 292 188", "M112 194Q124 206 130 232", "M288 194Q276 206 270 232"],
      dash: ["M106 398Q200 408 294 398", "M52 170 90 206", "M348 170 310 206"],
      shade: ["M150 92Q200 104 250 92Q200 124 150 92Z", "M292 190 278 222Q284 310 278 414L296 412Z", "M302 112 324 138 296 176Q298 140 302 112Z"]
    }
  },
  "tee-boxy": {
    front: {
      body: "M154 84Q200 112 246 84L320 104 380 208 330 238 302 190 306 396Q200 406 94 396L98 190 70 238 20 208 80 104Z",
      lines: ["M154 84Q200 96 246 84", "M144 88Q200 130 256 88", "M80 104Q92 150 98 190", "M320 104Q308 150 302 190", "M102 196Q116 210 122 238", "M298 196Q284 210 278 238"],
      dash: ["M96 382Q200 392 304 382", "M32 196 78 226", "M368 196 322 226"],
      shade: ["M154 84Q200 96 246 84Q200 112 154 84Z", "M302 192 288 226Q294 310 288 397L306 396Z", "M320 106 344 146 308 180Q310 140 320 106Z"]
    }
  },
  "jeans": {
    front: {
      body: "M128 56H272L276 84Q294 140 292 192L286 300 310 456 216 460 208 300 201 198 192 300 184 460 90 456 114 300 108 192Q106 140 124 84Z",
      lines: ["M124 84Q200 92 276 84", "M200 88V158Q200 180 201 198", "M150 86Q148 120 112 132", "M250 86Q252 120 288 132", "M148 56V84M252 56V84"],
      dash: ["M214 88V138Q214 158 202 170", "M97 444 182 448", "M303 444 218 448", "M138 88Q136 112 111 122", "M262 88Q264 112 289 122"],
      shade: ["M292 194 276 216 276 300 292 456 310 456 286 300Z", "M201 198 192 300 186 400 180 300 184 226Q194 216 201 198Z"]
    },
    back: {
      body: "M128 56H272L276 84Q294 140 292 192L286 300 310 456 216 460 208 300 201 198 192 300 184 460 90 456 114 300 108 192Q106 140 124 84Z",
      lines: ["M124 84Q200 92 276 84", "M116 116Q160 132 200 142Q240 132 284 116", "M200 84V142L201 198", "M132 148 186 142 188 196 162 212 136 200Z", "M268 148 214 142 212 196 238 212 264 200Z", "M148 56V84M252 56V84"],
      dash: ["M97 444 182 448", "M303 444 218 448", "M138 156 180 151", "M262 156 220 151"],
      shade: ["M292 194 276 216 276 300 292 456 310 456 286 300Z", "M201 198 192 300 186 400 180 300 184 226Q194 216 201 198Z", "M176 66H224V82H176Z"]
    }
  },
  "sweater": {
    front: {
      body: "M158 78Q200 100 242 78L302 96Q338 122 352 200L374 392 322 402 296 228 298 398Q200 408 102 398L104 228 78 402 26 392 48 200Q62 122 98 96Z",
      lines: ["M158 78Q200 88 242 78", "M148 84Q200 124 252 84", "M102 368Q200 378 298 368", "M98 96Q100 160 104 228", "M302 96Q300 160 296 228", "M30 360 80 370", "M370 360 320 370", "M124 250Q150 286 136 336", "M278 246Q250 290 266 346"],
      dash: [],
      shade: ["M158 78Q200 88 242 78Q200 100 158 78Z", "M104 230 130 250Q120 310 128 368L102 368Z", "M296 230 270 250Q280 310 272 368L298 368Z", "M70 180 50 350 78 362 96 240Q84 200 70 180Z", "M330 180 350 350 322 362 304 240Q316 200 330 180Z"],
      ribs: ["M102 372 298 372 298 398Q200 408 102 398Z"]
    },
    back: {
      body: "M158 78Q200 88 242 78L302 96Q338 122 352 200L374 392 322 402 296 228 298 398Q200 408 102 398L104 228 78 402 26 392 48 200Q62 122 98 96Z",
      lines: ["M158 78Q200 88 242 78", "M152 88Q200 104 248 88", "M102 368Q200 378 298 368", "M98 96Q100 160 104 228", "M302 96Q300 160 296 228", "M30 360 80 370", "M370 360 320 370", "M186 90H214V104H186Z"],
      dash: [],
      shade: ["M104 230 130 250Q120 310 128 368L102 368Z", "M296 230 270 250Q280 310 272 368L298 368Z", "M70 180 50 350 78 362 96 240Q84 200 70 180Z", "M330 180 350 350 322 362 304 240Q316 200 330 180Z"],
      ribs: ["M102 372 298 372 298 398Q200 408 102 398Z"]
    }
  }
};

function garment(icon, view, dark) {
  const set = DRAW[icon] || DRAW["tee-regular"];
  const d = set[view] || set.front;
  const ink = "#141412", fill = dark ? ink : "#fbfaf7", detail = dark ? "#eeedea" : ink;
  const hatch = dark ? "url(#hatchPaper)" : "url(#hatchInk)";
  const paths = (list, attrs) => (list || []).map(x => `<path d="${x}" ${attrs}/>`).join("");
  return `<svg class="garm" viewBox="0 0 400 500" aria-hidden="true"><g filter="url(#wob)" fill="none" stroke-linejoin="round" stroke-linecap="round">
    <path d="${d.body}" fill="${fill}" stroke="${ink}" stroke-width="5"/>
    ${paths(d.shade, `fill="${hatch}"`)}
    ${paths(d.ribs, `fill="${hatch}"`)}
    ${paths(d.lines, `stroke="${detail}" stroke-width="2"`)}
    ${paths(d.dash, `stroke="${detail}" stroke-width="1.2" stroke-dasharray="5 4"`)}
  </g></svg>`;
}

const isDark = color => /чёрн|черн/i.test(color || "");

/* что показывать у модели, пока нет фото */
function placeholders(p) {
  const colors = colorsOf(p);
  if (colors.length) return colors.map(c => ({ caption: c, svg: garment(p.icon, "front", isDark(c)), color: c }));
  return [
    { caption: "Спереди", svg: garment(p.icon, "front", false) },
    { caption: "Сзади", svg: garment(p.icon, "back", false) }
  ];
}

/* фото модели: первыми идут главные кадры каждого цвета */
function rowShots(p) {
  if (Array.isArray(p.preview) && p.preview.length) return p.preview.map(src => ({ src }));
  if (Array.isArray(p.photos)) return p.photos.map(src => ({ src }));
  const groups = Object.entries(p.photos || {});
  return [
    ...groups.filter(([, g]) => g[0]).map(([color, g]) => ({ src: g[0], color })),
    ...groups.flatMap(([color, g]) => g.slice(1).map(src => ({ src, color })))
  ];
}
const rowPhotos = p => rowShots(p).map(s => s.src);
const colorPhotos = (p, color) => Array.isArray(p.photos) ? p.photos : (p.photos?.[color] || rowPhotos(p));

/* ---------- статика ---------- */
const ribbonUnit = (saleOn() && CONFIG.saleRibbon ? [CONFIG.saleRibbon, ...RIBBON] : RIBBON).map(t => `<span>${esc(t)}</span><img src="assets/mascot-s.webp" alt="" width="26" height="30">`).join("");
$("#ribbon").innerHTML = ribbonUnit.repeat(16);
$("#year").textContent = new Date().getFullYear();

const countIn = t => PRODUCTS.filter(p => p.type === t).length;
const catKeys = Object.keys(CATEGORIES).filter(countIn);

$("#footCats").innerHTML = catKeys.map(k =>
  `<li><a href="#catalog" data-cat="${k}">${esc(CATEGORIES[k])}</a></li>`).join("");
$("#coverCats").innerHTML = catKeys.map(k =>
  `<a href="#catalog" data-cat="${k}">${esc(CATEGORIES[k])}<sup>${countIn(k)}</sup></a>`).join("");

const roman = n => ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n] || String(n + 1);
$("#toc").innerHTML = PRODUCTS.map((p, i) =>
  `<li><a href="#p-${esc(p.id)}" data-toc="${esc(p.id)}" data-cat="all"><i>${roman(i)}</i>${esc(p.name)}</a></li>`).join("");

/* ---------- избранное ---------- */
let favs = store.get("ga_fav", []).filter(byId);
const isFav = id => favs.includes(id);
function toggleFav(id) {
  if (!isFav(id)) track("fav", byId(id)?.name);
  favs = isFav(id) ? favs.filter(x => x !== id) : [...favs, id];
  store.set("ga_fav", favs);
  $$(`[data-fav="${CSS.escape(id)}"]`).forEach(b => b.setAttribute("aria-pressed", isFav(id)));
  renderMenu();
  if (filter === "fav") renderRows();
}

/* ---------- каталог ---------- */
let filter = "all";

const FAV_ICON = `<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>`;
const BAG_ICON = `<svg viewBox="0 0 24 24"><path d="M5 8h14l1 13H4z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`;

function shotHTML(p, s) {
  const label = `Открыть: ${p.name}${s.color ? `, ${s.color.toLowerCase()}` : ""}`;
  return `<button class="shot" type="button" data-open="${esc(p.id)}"${s.color ? ` data-open-color="${esc(s.color)}"` : ""}${s.src ? ` data-open-photo="${esc(s.src)}"` : ""} aria-label="${esc(label)}">
    ${s.src ? `<img src="${esc(s.src)}" alt="${esc(p.name)}" loading="lazy">` : s.svg}
    ${s.caption ? `<span class="shot-cap micro">${esc(s.caption)}</span>` : ""}
    ${s.stamp ? `<span class="rubber" style="filter:url(#rough)">Фото скоро</span>` : ""}
  </button>`;
}

function rowHTML(p) {
  const out = isSoldOut(p);
  const photoShots = rowShots(p);
  const shots = photoShots.length ? photoShots : placeholders(p);
  if (!photoShots.length) shots[shots.length - 1].stamp = true;
  const tag = out ? "Нет в наличии" : p.tag;
  const colors = colorsOf(p);
  return `<article class="row${out ? " out" : ""}" id="p-${esc(p.id)}">
    <div class="row-media">
      ${shots.map(s => shotHTML(p, s)).join("")}
      ${tag ? `<span class="row-tag micro">${esc(tag)}</span>` : ""}
    </div>
    <div class="row-info">
      <div class="row-text">
        <h2 class="row-name micro"><button type="button" data-open="${esc(p.id)}">${esc(p.name)}</button></h2>
        <p class="row-price">${priceText(p)}</p>
        ${colors.length ? `<p class="row-colors micro">${colors.map(c => `${dotHTML(c)}${esc(c)}`).join(" ")}</p>` : ""}
      </div>
      <div class="row-acts">
        <button class="ico fav" type="button" data-fav="${esc(p.id)}" aria-pressed="${isFav(p.id)}" aria-label="В избранное: ${esc(p.name)}">${FAV_ICON}</button>
        <button class="ico" type="button" data-open="${esc(p.id)}" aria-label="В корзину: ${esc(p.name)}">${BAG_ICON}</button>
      </div>
    </div>
  </article>`;
}

function visibleProducts() {
  if (filter === "all") return PRODUCTS;
  if (filter === "fav") return PRODUCTS.filter(p => isFav(p.id));
  return PRODUCTS.filter(p => p.type === filter);
}

function renderRows() {
  const list = visibleProducts();
  const label = filter === "fav" ? "Избранное" : CATEGORIES[filter];
  const bar = $("#filter");
  bar.hidden = filter === "all";
  bar.innerHTML = filter === "all" ? "" :
    `<span class="micro">${esc(label)} · ${list.length}</span><button class="linkbtn micro" type="button" data-cat="all">× Показать всё</button>`;
  $("#rows").innerHTML = list.length
    ? list.map(rowHTML).join("")
    : `<div class="none"><img src="assets/mascot-s.webp" alt="" width="84" height="97"><p>В избранном пока пусто</p><button class="btn ghost" type="button" data-cat="all">Весь каталог</button></div>`;
  watchRows();
}

function setFilter(cat) {
  filter = cat === "fav" || CATEGORIES[cat] ? cat : "all";
  if (filter !== "all") track("filter", filter === "fav" ? "Избранное" : CATEGORIES[filter]);
  renderRows();
}

/* подсветка в оглавлении */
const spy = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const id = e.target.id.replace(/^p-/, "");
    $$("[data-toc]").forEach(a => a.toggleAttribute("aria-current", a.dataset.toc === id));
  });
}, { rootMargin: "-45% 0px -50% 0px" }) : null;
function watchRows() {
  if (!spy) return;
  spy.disconnect();
  $$("#rows .row").forEach(r => spy.observe(r));
}

/* ---------- меню ---------- */
const menu = $("#menu"), searchDlg = $("#search");

function renderMenu() {
  const item = (k, label, n) =>
    `<a href="#catalog" data-cat="${k}"${filter === k ? ' aria-current="true"' : ""}>${esc(label)}<sup>${n}</sup></a>`;
  $("#menuCats").innerHTML = [
    item("all", "Все позиции", PRODUCTS.length),
    ...catKeys.map(k => item(k, CATEGORIES[k], countIn(k))),
    item("fav", "Избранное", favs.length)
  ].join("");
}
renderMenu();

function syncLock() {
  root.classList.toggle("lock", pd.open || menu.open || searchDlg.open || root.classList.contains("cart-open"));
}

function openSheet(d) { d.showModal(); syncLock(); }
function closeSheets() {
  [menu, searchDlg].forEach(d => { if (d.open) d.close(); });
  syncLock();
}
[menu, searchDlg].forEach(d => {
  d.addEventListener("close", syncLock);
  d.addEventListener("click", e => { if (e.target.closest("[data-close-sheet]")) { d.close(); syncLock(); } });
});

$("#openMenu").addEventListener("click", () => { renderMenu(); openSheet(menu); });
$("#openSearch").addEventListener("click", openSearch);
$("[data-switch-search]").addEventListener("click", () => { menu.close(); openSearch(); });

/* ---------- поиск ---------- */
const stem = w => w.slice(0, Math.max(3, w.length - 2));
const norm = s => s.toLowerCase().replace(/ё/g, "е");
const haystack = p => norm([p.name, CATEGORIES[p.type] || "", ...colorsOf(p), p.desc || ""].join(" "));

let searchTimer;
function runSearch(raw) {
  // в статистику — запрос, на котором человек остановился
  clearTimeout(searchTimer);
  const typed = String(raw).trim();
  if (typed.length >= 2) searchTimer = setTimeout(() => track("search", typed.slice(0, 60)), 1500);
  const words = norm(raw).trim().split(/\s+/).filter(Boolean);
  $("#popular").hidden = words.length > 0;
  if (!words.length) { $("#results").innerHTML = ""; return; }
  const found = PRODUCTS.filter(p => words.every(w => haystack(p).includes(stem(w))));
  $("#results").innerHTML = found.length
    ? found.map(p => {
        const photo = rowPhotos(p)[0];
        const first = placeholders(p)[0];
        return `<button class="res" type="button" data-open="${esc(p.id)}">
          <span class="res-pic">${photo ? `<img src="${esc(photo)}" alt="">` : first.svg}</span>
          <span><b class="micro">${esc(p.name)}</b><span class="res-price">${priceText(p)}</span></span>
        </button>`;
      }).join("")
    : `<p class="res-none">Ничего не нашлось</p>`;
}

function openSearch() {
  openSheet(searchDlg);
  $("#q").value = "";
  runSearch("");
  $("#q").focus();
}
$("#chips").innerHTML = POPULAR.map(t => `<button class="chip micro" type="button" data-q="${esc(t)}">${esc(t)}</button>`).join("");
$("#chips").addEventListener("click", e => {
  const c = e.target.closest("[data-q]");
  if (c) { $("#q").value = c.dataset.q; runSearch(c.dataset.q); $("#q").focus(); }
});
$("#q").addEventListener("input", e => runSearch(e.target.value));
$("#searchForm").addEventListener("submit", e => e.preventDefault());

/* ---------- блоки «как заказать», «размеры», «вопросы» ---------- */
function openInfo(id) {
  const d = document.getElementById(id);
  if (!d || d.tagName !== "DETAILS") return false;
  d.open = true;
  requestAnimationFrame(() => d.scrollIntoView({ block: "start" }));
  return true;
}
window.addEventListener("hashchange", () => openInfo(location.hash.slice(1)));
if (location.hash) openInfo(location.hash.slice(1));

/* ---------- таблица размеров ---------- */
const chartTypes = [...new Set(PRODUCTS.map(p => p.type))].filter(t => SIZE_CHARTS[t]);
let chartType = chartTypes[0];

function renderChart(type) {
  if (type && SIZE_CHARTS[type]) chartType = type;
  $("#chartTabs").hidden = chartTypes.length < 2;
  $("#chartTabs").innerHTML = chartTypes.map(t =>
    `<button class="tab micro" type="button" role="tab" data-chart-tab="${t}" aria-selected="${t === chartType}">${esc(SIZE_CHARTS[t].title)}</button>`).join("");
  const c = SIZE_CHARTS[chartType];
  if (!c) { $("#chart").innerHTML = ""; return; }
  $("#chart").innerHTML = c.rows.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Размер</th>${c.cols.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${c.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>
       </table></div>
       <p class="note">Допустимое отклонение замеров — 1–2 см.</p>`
    : `<p class="chart-empty">Замеры этой модели скоро появятся здесь.</p>`;
}
$("#chartTabs").addEventListener("click", e => {
  const t = e.target.closest("[data-chart-tab]");
  if (t) { renderChart(t.dataset.chartTab); $(`[data-chart-tab="${t.dataset.chartTab}"]`).focus(); }
});
renderChart();

/* ---------- окно товара ---------- */
const pd = $("#pd");
let cur = null, curSize = null, curColor = null;

function pdMediaHTML(p, color, start) {
  const ph = colorPhotos(p, color);
  if (ph.length) {
    // открываем на том фото, по которому кликнули в ряду
    const first = ph.includes(start) ? start : ph[0];
    return `<div class="pd-main"><img id="pdImg" src="${esc(first)}" alt="${esc(p.name)}"></div>
      ${ph.length > 1 ? `<div class="thumbs">${ph.map((src, i) => `<button class="thumb" type="button" data-photo="${esc(src)}" aria-label="Фото ${i + 1}" aria-current="${src === first}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}`;
  }
  const views = colorsOf(p).length
    ? [{ svg: garment(p.icon, "front", isDark(color)), caption: color }]
    : placeholders(p);
  return views.map(v => `<div class="pd-main pd-ph">${v.svg}<span class="shot-cap micro">${esc(v.caption)}</span></div>`).join("");
}

function openProduct(id, color, photo) {
  cur = byId(id);
  track("product", cur.name);
  const p = cur, out = isSoldOut(p), colors = colorsOf(p);
  const avail = p.sizes.filter(s => !(p.soldOut || []).includes(s));
  curSize = avail.length === 1 && p.sizes.length === 1 ? avail[0] : null;
  curColor = colors.includes(color) ? color : colors[0] || null;
  $("#pdBody").innerHTML = `<div class="pd-grid">
    <div class="pd-media" id="pdMedia">${pdMediaHTML(p, curColor, photo)}</div>
    <div class="pd-info">
      ${p.tag && !out ? `<p class="micro pd-tag">${esc(p.tag)}</p>` : ""}
      <h2 class="pd-name" id="pdTitle">${esc(p.name)}</h2>
      <p class="pd-price">${priceText(p)}</p>
      ${colors.length > 1 ? `<div class="pd-label"><span class="micro">Цвет</span></div>
      <div class="sizes" role="group" aria-label="Цвет">${colors.map(c =>
        `<button class="size color" type="button" data-color="${esc(c)}" aria-pressed="${c === curColor}">${dotHTML(c)}${esc(c)}</button>`).join("")}</div>`
        : colors.length ? `<div class="pd-label"><span class="micro">Цвет</span><span class="pd-color">${dotHTML(colors[0])}${esc(colors[0])}</span></div>` : ""}
      <div class="pd-label"><span class="micro">Размер</span>${SIZE_CHARTS[p.type] ? `<a href="#sizes" class="micro" data-close data-chart="${esc(p.type)}">Таблица размеров</a>` : ""}</div>
      <div class="sizes" role="group" aria-label="Размер">${p.sizes.map(s => {
        const off = (p.soldOut || []).includes(s);
        return `<button class="size" type="button" data-size="${esc(s)}" aria-pressed="${s === curSize}"${off ? ` disabled aria-label="${esc(s)} — нет в наличии"` : ""}>${esc(s)}</button>`;
      }).join("")}</div>
      <p class="pd-err" id="pdErr" hidden>Выберите размер</p>
      <button class="btn full pd-add" id="pdAdd" type="button"${out ? " disabled" : ""}>${out ? "Нет в наличии" : "В корзину"}</button>
      ${p.desc ? `<p class="pd-h micro">Описание</p><p class="pd-desc">${esc(p.desc)}</p>` : ""}
      ${p.specs && p.specs.length ? `<p class="pd-h micro">Характеристики</p><dl class="specs">${p.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
      <ul class="pd-facts">
        <li>Доставка Почтой России — 300 RUB</li>
        <li>Возврат в течение 7 дней — <a href="#returns" data-close data-info="returns">условия</a></li>
      </ul>
    </div>
  </div>`;
  pd.showModal();
  $(".pd-scroll").scrollTop = 0;
  syncLock();
}

function closeProduct() { if (pd.open) pd.close(); syncLock(); }
pd.addEventListener("close", syncLock);

pd.addEventListener("click", e => {
  if (e.target === pd) return closeProduct();
  const closer = e.target.closest("[data-close]");
  if (closer) {
    if (closer.dataset.chart) {
      e.preventDefault();
      renderChart(closer.dataset.chart);
      closeProduct();
      openInfo("sizes");
      return;
    }
    return closeProduct();
  }
  const s = e.target.closest("[data-size]");
  if (s && !s.disabled) {
    curSize = s.dataset.size;
    $$("[data-size]", pd).forEach(b => b.setAttribute("aria-pressed", b === s));
    $("#pdErr").hidden = true;
    return;
  }
  const c = e.target.closest("[data-color]");
  if (c) {
    curColor = c.dataset.color;
    $$("[data-color]", pd).forEach(b => b.setAttribute("aria-pressed", b === c));
    $("#pdMedia").innerHTML = pdMediaHTML(cur, curColor);
    return;
  }
  const t = e.target.closest("[data-photo]");
  if (t) {
    $("#pdImg").src = t.dataset.photo;
    $$("[data-photo]", pd).forEach(b => b.setAttribute("aria-current", b === t));
    return;
  }
  if (e.target.closest("#pdAdd")) {
    if (!curSize) { $("#pdErr").hidden = false; return; }
    addToCart(cur.id, curSize, curColor);
    closeProduct();
    toast(`Добавлено: ${cur.name}${curColor ? `, ${curColor.toLowerCase()}` : ""}, ${curSize}`);
  }
});

/* ---------- общие клики ---------- */
document.addEventListener("click", e => {
  const fav = e.target.closest("[data-fav]");
  if (fav) { toggleFav(fav.dataset.fav); return; }

  const info = e.target.closest("[data-info]");
  if (info) {
    e.preventDefault();
    closeSheets();
    openInfo(info.dataset.info);
    return;
  }

  const cat = e.target.closest("[data-cat]");
  if (cat) {
    setFilter(cat.dataset.cat);
    closeSheets();
    if (root.classList.contains("cart-open")) closeCart();
    // обычные якоря прокрутит браузер; кнопки «показать всё» — возвращаем к каталогу
    if (cat.tagName === "BUTTON") requestAnimationFrame(() => $("#catalog").scrollIntoView({ block: "start" }));
    return;
  }

  const open = e.target.closest("[data-open]");
  if (open && !pd.contains(open) && byId(open.dataset.open)) {
    closeSheets();
    openProduct(open.dataset.open, open.dataset.openColor, open.dataset.openPhoto);
  }
});

/* ---------- корзина ---------- */
const MAX_QTY = 10;
const DELIVERY = CONFIG.delivery || 0;
const lineOk = l => {
  const p = byId(l.id);
  return p && p.sizes.includes(l.size) && l.qty > 0 && (colorsOf(p).length ? colorsOf(p).includes(l.color) : !l.color);
};
let cart = store.get("ga_cart", []).filter(lineOk);
let step = "cart";
let lastOrder = null;
let doneTitle = "Заказ оформлен";

const count = () => cart.reduce((s, l) => s + l.qty, 0);
const unknownPrice = () => cart.some(l => !hasPrice(byId(l.id)));
const total = () => cart.reduce((s, l) => s + (hasPrice(byId(l.id)) ? priceOf(byId(l.id)) * l.qty : 0), 0);

function save() { store.set("ga_cart", cart); renderCart(); }

function addToCart(id, size, color) {
  track("cart", byId(id).name, priceOf(byId(id)) || 0);
  const l = cart.find(x => x.id === id && x.size === size && (x.color || null) === (color || null));
  if (l) l.qty = Math.min(MAX_QTY, l.qty + 1); else cart.push({ id, size, qty: 1, ...(color ? { color } : {}) });
  save();
  const n = $("#count");
  n.classList.add("bump");
  setTimeout(() => n.classList.remove("bump"), 200);
}

function lineHTML(l, i) {
  const p = byId(l.id), photo = colorPhotos(p, l.color)[0];
  const pic = photo
    ? `<img src="${esc(photo)}" alt="">`
    : garment(p.icon, "front", isDark(l.color));
  return `<div class="li">
    <div class="li-pic">${pic}</div>
    <div>
      <p class="li-name">${esc(p.name)}</p>
      <p class="li-meta">${l.color ? `${esc(l.color)} · ` : ""}Размер ${esc(l.size)}<br>${priceText(p)}</p>
      <div class="qty" role="group" aria-label="Количество">
        <button type="button" data-dec="${i}" aria-label="Уменьшить"${l.qty <= 1 ? " disabled" : ""}>−</button>
        <span>${l.qty}</span>
        <button type="button" data-inc="${i}" aria-label="Увеличить"${l.qty >= MAX_QTY ? " disabled" : ""}>+</button>
      </div>
    </div>
    <div class="li-side">
      <span class="li-sum">${hasPrice(p) ? rub(priceOf(p) * l.qty) : ""}</span>
      <button type="button" class="linkbtn" data-rm="${i}">Удалить</button>
    </div>
  </div>`;
}

function renderCart() {
  const unknown = unknownPrice(), n = count();
  $("#count").textContent = n;
  $("#count").hidden = n === 0;
  $("#openCart").setAttribute("aria-label", n ? `Корзина, товаров: ${n}` : "Корзина");
  $("#sum").textContent = $("#sum2").textContent = unknown ? "уточнит менеджер" : rub(total() + DELIVERY);
  $$("[data-hint]").forEach(h => h.textContent = unknown ? "Цену и доставку подтвердит менеджер"
    : DELIVERY ? `Товары ${rub(total())} + доставка по России ${rub(DELIVERY)}` : "Без учёта доставки");

  $("#items").innerHTML = cart.length
    ? cart.map(lineHTML).join("")
    : `<div class="none"><img src="assets/mascot-s.webp" alt="" width="84" height="97"><p>В корзине пока пусто</p><button class="btn ghost" type="button" data-go-catalog>Смотреть каталог</button></div>`;
  $("#cartFoot").hidden = !cart.length;

  $$("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== step);
  $("#drawerTitle").textContent = { cart: "Корзина", form: "Оформление", done: doneTitle }[step];
  $("#back").hidden = step !== "form";
}

$("#items").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-go-catalog")) { closeCart(); setFilter("all"); location.hash = "catalog"; return; }
  let refocus = null;
  if (b.dataset.inc != null) { const l = cart[+b.dataset.inc]; l.qty = Math.min(MAX_QTY, l.qty + 1); refocus = `[data-inc="${b.dataset.inc}"]`; }
  else if (b.dataset.dec != null) { const l = cart[+b.dataset.dec]; l.qty = Math.max(1, l.qty - 1); refocus = `[data-dec="${b.dataset.dec}"]`; }
  else if (b.dataset.rm != null) { cart.splice(+b.dataset.rm, 1); }
  else return;
  save();
  const next = refocus && $(refocus, $("#items"));
  if (next && !next.disabled) next.focus(); else $("#closeCart").focus();
});

let lastFocus = null;
function openCart() {
  lastFocus = document.activeElement;
  $("#toast").classList.remove("show");
  root.classList.add("cart-open");
  syncLock();
  setTimeout(() => $("#closeCart").focus(), 60);
}
function closeCart() {
  root.classList.remove("cart-open");
  syncLock();
  if (step === "done") { step = "cart"; renderCart(); }
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

$("#openCart").addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#shade").addEventListener("click", closeCart);
$("#toForm").addEventListener("click", () => { track("checkout", "", total()); step = "form"; renderCart(); $("#fName").focus(); });
$("#back").addEventListener("click", () => { step = "cart"; renderCart(); $("#toForm").focus(); });

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && root.classList.contains("cart-open") && !pd.open) closeCart();
});
$("#drawer").addEventListener("keydown", e => {
  if (e.key !== "Tab") return;
  const f = $$('a[href],button:not([disabled]),input,select,textarea', $("#drawer")).filter(el => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* ---------- оформление ---------- */
const form = $("#orderForm");
const draft = store.get("ga_form", {});
for (const [k, v] of Object.entries(draft)) {
  const el = form.elements[k];
  if (el && el.type !== "checkbox") el.value = v;
}
form.addEventListener("input", e => {
  e.target.closest(".f")?.classList.remove("bad");
  const { agree, ...rest } = Object.fromEntries(new FormData(form));
  store.set("ga_form", rest);
});
// вставили ссылку t.me/… или @ник — оставляем только ник
form.elements.tg.addEventListener("change", e => { e.target.value = tgName(e.target.value); });

const RULES = {
  name:  v => v.trim().split(/\s+/).length >= 2,
  phone: v => v.replace(/\D/g, "").length >= 7,
  tg:    v => /^[A-Za-z0-9_]{5,32}$/.test(tgName(v)),
  zip:   v => /^\d{6}$/.test(v.trim()),
  city:  v => v.trim().length >= 2,
  address: v => v.trim().length >= 5,
  agree: v => v === "on"
};

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (!cart.length) { step = "cart"; renderCart(); return; }
  const d = Object.fromEntries(new FormData(form));
  let firstBad = null;
  for (const [k, ok] of Object.entries(RULES)) {
    const el = form.elements[k];
    const bad = !ok(d[k] || "");
    el.closest(".f").classList.toggle("bad", bad);
    if (bad && !firstBad) firstBad = el;
  }
  if (firstBad) { firstBad.focus(); return; }

  const no = "GA-" + Date.now().toString(36).slice(-5).toUpperCase();
  const unknown = unknownPrice();
  const sum = total() + DELIVERY;
  const tg = tgName(d.tg);
  const fields = {
    "Номер заказа": no,
    "Состав": cart.map((l, i) => {
      const p = byId(l.id);
      return `${i + 1}) ${p.name}${l.color ? `, ${l.color.toLowerCase()}` : ""} — размер ${l.size} × ${l.qty}${hasPrice(p) ? ` = ${rub(priceOf(p) * l.qty)}${onSale(p) ? " (скидка)" : ""}` : " (цена по запросу)"}`;
    }).join("\n"),
    "Итого": unknown ? "уточнить" : `${rub(sum)} с доставкой`,
    "ФИО": d.name.trim(),
    "Telegram": `@${tg}`,
    "Написать покупателю": `https://t.me/${tg}`,
    "Телефон": `${d.code} ${d.phone.trim()}`,
    "Доставка": DELIVERY ? `Почта России, ${rub(DELIVERY)}` : "Почта России",
    "Адрес": `${d.zip.trim()}, ${d.city.trim()}, ${d.address.trim()}`,
    "Комментарий": d.comment.trim() || "—"
  };
  const text = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n");

  const items = cart.map(l => ({ id: l.id, size: l.size, qty: l.qty, color: l.color || "" }));

  const btn = $("#submitOrder");
  btn.disabled = true;
  btn.textContent = "Отправляем…";
  $("#sendErr").hidden = true;
  let res;
  try {
    res = await sendOrder(fields, d._honey, items);
  } catch (err) {
    console.warn("Заказ не отправлен:", err.message);
    $("#sendErr").hidden = false;
    btn.disabled = false;
    btn.textContent = "Подтвердить заказ";
    return;
  }

  track("order", no, unknown ? 0 : sum);
  lastOrder = { no, text, tg, sum: unknown ? null : sum };
  cart = [];
  store.set("ga_cart", cart);
  form.elements.agree.checked = false;

  // оплата подключена — сразу на страницу ЮKassa; вернётся на ?pay=номер
  if (res && res.pay) {
    store.set("ga_pending", lastOrder);
    btn.textContent = "Переходим к оплате…";
    location.assign(res.pay);
    return;
  }
  btn.disabled = false;
  btn.textContent = "Подтвердить заказ";
  step = "done";
  doneTitle = "Заказ оформлен";
  renderDone();
  renderCart();
  $("#closeCart").focus();
});

/* заказ уходит в Google Apps Script: строка в таблице, письмо на почты и платёж в ЮKassa */
async function sendOrder(fields, honey, items) {
  if (honey) return {}; // скрытое поле заполнил бот — молча «принимаем»
  return api({ order: fields, items });
}

async function api(body) {
  if (!CONFIG.orderEndpoint) throw new Error("не задан CONFIG.orderEndpoint");
  // не держим покупателя дольше 25 секунд
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  let res;
  try {
    // text/plain — «простой» запрос: Google принимает его без предварительной CORS-проверки
    res = await fetch(CONFIG.orderEndpoint, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok !== true) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function renderDone() {
  const o = lastOrder;
  $("#done").innerHTML = `
    <p class="micro" style="margin:24px 0 10px">Номер заказа</p>
    <p class="done-num">${esc(o.no)}</p>
    <p class="done-lead">Заказ принят. Писать менеджеру не нужно: он сам напишет вам в Telegram на <b>@${esc(o.tg)}</b>.</p>
    <ol class="done-steps">
      <li>
        <b>1. Дождитесь сообщения</b>
        <p>Менеджер подтвердит заказ и пришлёт ссылку на оплату${o.sum ? ` на ${rub(o.sum)}` : ""}.</p>
      </li>
      <li>
        <b>2. Оплатите заказ</b>
        <p>После оплаты отправим посылку Почтой России и пришлём трек-номер.</p>
      </li>
    </ol>
    <details><summary>Показать заказ</summary><pre>${esc(o.text)}</pre></details>`;
}

/* ---------- возврат с оплаты ЮKassa: gafarov.shop/?pay=GA-XXXXX ---------- */
function renderPay(state, no, payUrl) {
  const o = lastOrder || { no, tg: "", text: "" };
  doneTitle = state === "paid" ? "Заказ оплачен" : "Оплата заказа";
  const tg = o.tg ? ` в Telegram на <b>@${esc(o.tg)}</b>` : " в Telegram";
  const body = {
    check: `<p class="done-lead">Проверяем оплату…</p>`,
    paid: `<p class="done-lead">Оплата прошла, спасибо! Отправим посылку Почтой России и пришлём трек-номер${tg}.</p>`,
    pending: `<p class="done-lead">Оплата ещё не завершена. Если вы уже оплатили, статус обновится сам в течение 10 минут — писать менеджеру не нужно.</p>
      ${payUrl ? `<a class="btn full" href="${esc(payUrl)}">Перейти к оплате</a>` : ""}
      <button class="btn ghost full" type="button" data-pay-check style="margin-top:10px">Проверить ещё раз</button>`,
    failed: `<p class="done-lead">Оплата не прошла, деньги не списаны. Заказ сохранён — его можно оплатить ещё раз.</p>
      <button class="btn full" type="button" data-pay-again>Оплатить снова</button>`,
    cancelled: `<p class="done-lead">Этот заказ отменён. Если это ошибка, напишите менеджеру.</p>`,
    error: `<p class="done-lead">Не получилось проверить оплату. Проверьте интернет и попробуйте ещё раз.</p>
      <button class="btn ghost full" type="button" data-pay-check>Проверить ещё раз</button>`
  }[state];
  $("#done").innerHTML = `
    <p class="micro" style="margin:24px 0 10px">Номер заказа</p>
    <p class="done-num">${esc(o.no || no)}</p>
    ${body}
    ${o.text ? `<details><summary>Показать заказ</summary><pre>${esc(o.text)}</pre></details>` : ""}`;
  $("#drawerTitle").textContent = doneTitle;
}

async function checkPay(no, attempt = 0) {
  let st = null;
  try { st = await api({ action: "payStatus", order: no }); } catch {}
  if (!st) return renderPay("error", no);
  if (st.status === "succeeded") {
    store.set("ga_pending", null);
    return renderPay("paid", no);
  }
  // ЮKassa подтверждает платёж не мгновенно — несколько раз переспрашиваем
  if (st.status === "pending" && attempt < 4) return setTimeout(() => checkPay(no, attempt + 1), 3000);
  if (st.status === "pending") return renderPay("pending", no, st.pay);
  if (st.status === "cancelled_order") return renderPay("cancelled", no);
  if (st.status === "none") { doneTitle = "Заказ оформлен"; $("#drawerTitle").textContent = doneTitle; return renderDone(); }
  renderPay("failed", no);
}

$("#done").addEventListener("click", async e => {
  const b = e.target.closest("[data-pay-check], [data-pay-again]");
  const no = b && lastOrder && lastOrder.no;
  if (!no) return;
  if (b.hasAttribute("data-pay-check")) { renderPay("check", no); return checkPay(no, 4); }
  b.disabled = true;
  b.textContent = "Готовим оплату…";
  try {
    const r = await api({ action: "pay", order: no });
    if (r.pay) return location.assign(r.pay);
    if (r.status === "succeeded") return renderPay("paid", no);
    if (r.status === "cancelled_order") return renderPay("cancelled", no);
  } catch {}
  renderPay("error", no);
});

(function payReturn() {
  const no = new URLSearchParams(location.search).get("pay");
  if (!no || !/^GA-[A-Z0-9]{3,12}$/.test(no)) return;
  history.replaceState(null, "", location.pathname + location.hash);
  const saved = store.get("ga_pending", null);
  lastOrder = saved && saved.no === no ? saved : { no, tg: "", text: "", sum: null };
  step = "done";
  renderCart();
  renderPay("check", no);
  openCart();
  checkPay(no);
})();

/* ---------- уведомление ---------- */
let toastTimer;
function toast(msg) {
  $("#toastMsg").textContent = msg;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
$("#toastOpen").addEventListener("click", () => { $("#toast").classList.remove("show"); openCart(); });

/* ---------- маскот следит за курсором, моргает, поднимает бровь и пускает слюну ---------- */
(function gaze() {
  const box = $("#mascot"), eyes = $("#eyes");
  if (!box || !eyes || reducedMotion) return;
  const irises = $$(".iris", eyes);
  const RANGE = { x: 30, y: 13 };
  let tx = 0, ty = 0, x = 0, y = 0, onScreen = true, lastAim = 0, raf = 0, nextGlance = 0;

  /* слюна тянется из левого уголка рта, капля срывается и падает мимо подбородка */
  const SPIT = { x: 550, y: 922, restLen: 8, fullLen: 70, restR: 3, fullR: 9.5, grow: 5, hang: .8, gravity: 620, bottom: 1240 };
  const spit = $("#drool"), spitHi = $("#droolHi"), spitDrop = $("#droolDrop");
  let spitStart = performance.now() + 800;

  function spitShape(len, r) {
    const { x: sx, y: sy } = SPIT, ry = r * 1.1, tip = sy + len, cy = tip - ry;
    spit.setAttribute("d", `M${sx - 2} ${sy}C${sx - 2} ${sy + len * .5} ${sx - r} ${cy - r * .9} ${sx - r} ${cy}` +
      `A${r} ${ry} 0 0 0 ${sx + r} ${cy}C${sx + r} ${cy - r * .9} ${sx + 2} ${sy + len * .5} ${sx + 2} ${sy}Z`);
    spitHi.setAttribute("d", r > 4 ? `M${sx + r * .5} ${cy - r * .1}Q${sx + r * .55} ${cy + r * .6} ${sx + r * .05} ${cy + r * .85}` : "");
  }

  function spitFrame(now) {
    const t = (now - spitStart) / 1000, S = SPIT;
    if (t < 0) { spitShape(S.restLen, S.restR); spitDrop.setAttribute("visibility", "hidden"); return; }
    if (t < S.grow) {
      const k = t / S.grow, e = k * k * (3 - 2 * k);
      spitShape(S.restLen + (S.fullLen - S.restLen) * e, S.restR + (S.fullR - S.restR) * e);
      return;
    }
    if (t < S.grow + S.hang) {
      const k = (t - S.grow) / S.hang;
      spitShape(S.fullLen + Math.sin(k * Math.PI) * 7, S.fullR);
      return;
    }
    // капля оторвалась: нитка пружинит обратно, капля падает
    const k = t - S.grow - S.hang, fall = .5 * S.gravity * k * k;
    const dropY = S.y + S.fullLen + fall;
    spitShape(S.restLen + (S.fullLen - S.restLen) * Math.exp(-k * 7) * Math.cos(k * 14), S.restR + (S.fullR - S.restR) * Math.exp(-k * 9));
    if (dropY < S.bottom) {
      spitDrop.setAttribute("visibility", "visible");
      spitDrop.setAttribute("opacity", Math.min(1, (S.bottom - dropY) / 40).toFixed(2));
      spitDrop.setAttribute("transform", `translate(${S.x} ${dropY.toFixed(1)})`);
    } else {
      spitDrop.setAttribute("visibility", "hidden");
      spitStart = now + 2500 + Math.random() * 3500;
    }
  }

  function aim(cx, cy) {
    const r = box.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height * .5);
    const dist = Math.hypot(dx, dy) || 1, k = Math.min(1, dist / 340);
    tx = dx / dist * k * RANGE.x;
    ty = dy / dist * k * RANGE.y;
    lastAim = performance.now();
  }

  function tick(now) {
    raf = 0;
    if (!onScreen) return;
    // без движения курсора иногда переводит взгляд сам
    if (now - lastAim > 3500 && now > nextGlance) {
      const look = Math.random() < .4;
      tx = look ? 0 : (Math.random() * 2 - 1) * RANGE.x;
      ty = look ? 0 : (Math.random() * 2 - 1) * RANGE.y;
      nextGlance = now + 1600 + Math.random() * 3000;
    }
    x += (tx - x) * .14;
    y += (ty - y) * .14;
    irises.forEach(i => i.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`));
    spitFrame(now);
    raf = requestAnimationFrame(tick);
  }
  const start = () => { if (!raf && onScreen) raf = requestAnimationFrame(tick); };

  addEventListener("pointermove", e => aim(e.clientX, e.clientY), { passive: true });
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; start(); }).observe(box);
  start();

  (function blink() {
    setTimeout(() => {
      eyes.classList.add("blink");
      setTimeout(() => { eyes.classList.remove("blink"); blink(); }, 190);
    }, 2600 + Math.random() * 4600);
  })();

  const brow = $("#brow");
  let browTimer = 0;
  function raiseBrow() {
    if (browTimer) return;
    brow.classList.add("up");
    browTimer = setTimeout(() => { brow.classList.remove("up"); browTimer = 0; }, 1100);
  }
  (function browLoop(delay) {
    setTimeout(() => { if (onScreen) raiseBrow(); browLoop(4500 + Math.random() * 5000); }, delay);
  })(1500);
  $("#heroPlate").addEventListener("pointerenter", raiseBrow);
  $("#heroPlate").addEventListener("pointerdown", raiseBrow);
})();

/* поля по бокам не наезжают на подвал */
new IntersectionObserver(([e]) => root.classList.toggle("at-foot", e.isIntersecting)).observe($(".foot"));

/* ---------- старт ---------- */
renderRows();
renderCart();
