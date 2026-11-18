/* gafarov.shop/admin — вкладки «Товары» и «Промокоды».
   Сохраняет всё Google Apps Script магазина: товары и фото — в репозиторий сайта на GitHub
   (файл products.js и папка assets/items/u/), промокоды — на лист «Промокоды» в таблице заказов. */
(() => {
  "use strict";
  const A = window.gaAdmin;
  if (!A) return;
  const $ = s => document.querySelector(s);
  const nf = new Intl.NumberFormat("ru-RU");
  const rub = n => nf.format(Math.round(n || 0)) + " ₽";
  const clone = o => JSON.parse(JSON.stringify(o));
  const plural = (n, [one, few, many]) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };
  const ICONS = { tee: "tee-boxy", jeans: "jeans", hoodie: "sweater" };
  const PROPS = ["value", "checked", "disabled", "hidden", "selected", "multiple"];

  // элемент: h("button", { class, text, onclick, "aria-label": … }, ...дети)
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (PROPS.includes(k)) e[k] = v;
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
  }
  const field = (label, input, hint, cls) => h("div", { class: "f" + (cls ? " " + cls : "") },
    h("label", { for: input.id, text: label }), input, hint ? h("span", { class: "hint", text: hint }) : null);
  const splitList = s => String(s).split(",").map(x => x.trim()).filter((x, i, a) => x && a.indexOf(x) === i);

  // «Шапки зимние» → «shapki-zimnie»: для кодов новых товаров и разделов
  const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
  const slugify = s => String(s || "").toLowerCase().split("").map(c => TR[c] != null ? TR[c] : c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 34).replace(/-+$/, "");

  function errText(r) {
    if (!r) return "Нет ответа от сервера. Проверьте интернет и попробуйте ещё раз.";
    if (r.error === "github") return "GitHub не подключён: откройте таблицу «Заказы ГАФАРОВ» → меню «ГАФАРОВ» → «Подключить GitHub».";
    if (r.error === "invalid") return r.message || "Проверьте поля.";
    if (r.error === "busy") return "Слишком много запросов подряд. Подождите минуту и попробуйте снова.";
    if (r.error === "conflict") return "Товары уже поменяли в другом окне. Нажмите «Обновить» вверху: загрузится свежий список, а ваши неопубликованные правки пропадут.";
    if (r.error === "bad order") return "Скрипт заказов старой версии. Вставьте новый google-orders.gs в Apps Script и сделайте новое развёртывание.";
    if (r.error === "auth") return "Сессия закончилась. Войдите снова и повторите.";
    return "Ошибка: " + (r.error || "неизвестная");
  }

  async function send(body) {
    let r = null;
    try { r = await A.call({ ...body, token: A.token() }); } catch {}
    if (r && r.error === "auth") A.authFail();
    return r;
  }

  /* ---------- панель «Опубликовать» внизу ---------- */
  const P = { loaded: false, loading: false, busy: false, cat: null, base: "", uploads: [], local: {}, open: new Set(), jobs: {}, msg: "", seq: 0, watch: 0 };
  const Q = { loaded: false, loading: false, busy: false, list: null, base: "", msg: "" };
  const snapP = c => JSON.stringify({ p: c.products, c: c.colors, k: c.categories });
  const snapQ = l => JSON.stringify(l.map(x => [String(x.code).trim(), String(x.discount).trim(), String(x.limit == null ? "" : x.limit).trim(), !!x.on]));
  const dirtyP = () => !!(P.loaded && P.cat && snapP(P.cat) !== P.base);
  const dirtyQ = () => !!(Q.loaded && Q.list && snapQ(Q.list) !== Q.base);
  const uploading = () => Object.values(P.jobs).some(list => list.some(j => !j.err));

  function bar() {
    const v = A.view(), st = v === "products" ? P : v === "promos" ? Q : null;
    const dirty = v === "products" ? dirtyP() : v === "promos" ? dirtyQ() : false;
    $("#saveBar").hidden = !st || !(dirty || st.msg);
    $("#saveMsg").textContent = st ? st.msg || (dirty ? "Есть неопубликованные изменения" : "") : "";
    $("#saveBtn").textContent = v === "promos" ? "Сохранить" : "Опубликовать";
    $("#saveBtn").hidden = $("#discardBtn").hidden = !dirty;
    $("#saveBtn").disabled = $("#discardBtn").disabled = !!(st && st.busy);
  }
  const touch = () => { P.msg = ""; bar(); };
  const touchQ = () => { Q.msg = ""; bar(); };

  $("#saveBtn").addEventListener("click", () => A.view() === "promos" ? savePromos() : publish());
  $("#discardBtn").addEventListener("click", () => {
    if (A.view() === "promos") {
      if (!confirm("Отменить несохранённые изменения в промокодах?")) return;
      Q.list = JSON.parse(Q.raw);
      Q.msg = "";
      drawPromos();
      return;
    }
    if (!confirm("Отменить все неопубликованные изменения в товарах?")) return;
    const b = JSON.parse(P.base);
    Object.assign(P.cat, { products: b.p, colors: b.c, categories: b.k });
    P.jobs = {};
    P.msg = "";
    drawProducts();
  });
  addEventListener("beforeunload", e => {
    if (dirtyP() || dirtyQ() || uploading()) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ================= товары ================= */
  const src = path => P.local[path] || "../" + path;
  // фото в ряду на главной: отмеченные звёздочкой, иначе первые два
  const mainPhotos = p => p.preview && p.preview.length ? p.preview : p.photos.slice(0, 2);
  const isNew = id => /^tmp-\d+$/.test(id);
  const sel = s => "#" + CSS.escape(s);
  const metaText = p => [
    p.price ? rub(p.price) : "без цены",
    P.cat.categories[p.type] || "без раздела",
    p.photos.length ? `${p.photos.length} фото` : "нет фото",
    p.hidden ? "скрыт с сайта" : null,
    isNew(p.id) ? "новый" : null
  ].filter(Boolean).join(" · ");

  async function loadProducts() {
    P.loading = true;
    $("#pErr").hidden = true;
    $("#pList").replaceChildren(h("p", { class: "a-empty", text: "Загружаем товары…" }));
    const r = await send({ action: "catalogGet" });
    P.loading = false;
    if (!r || !r.ok) {
      $("#pErr").textContent = errText(r);
      $("#pErr").hidden = false;
      $("#pList").replaceChildren();
      return;
    }
    P.cat = { sha: r.sha, products: r.products || [], colors: r.colors || {}, categories: r.categories || {} };
    P.cat.products.forEach(p => {
      ["sizes", "soldOut", "colors", "photos", "preview", "specs"].forEach(k => { if (!Array.isArray(p[k])) p[k] = []; });
      ["name", "desc", "tag"].forEach(k => { if (typeof p[k] !== "string") p[k] = ""; });
    });
    P.base = snapP(P.cat);
    P.loaded = true;
    P.uploads = [];
    P.jobs = {};
    P.msg = "";
    if (A.view() === "products") drawProducts();
  }

  function drawProducts(focus) {
    if (!P.cat) return;
    const list = P.cat.products, box = $("#pList");
    box.replaceChildren(...(list.length ? list.map((p, i) => card(p, i, list.length))
      : [h("p", { class: "a-empty", text: "Товаров пока нет. Нажмите «Добавить товар»." })]));
    if (focus) { const el = box.querySelector(focus); if (el && !el.disabled) el.focus(); }
    bar();
  }

  function card(p, i, n) {
    const open = P.open.has(p.id);
    const name = h("b", { class: "p-name", text: p.name || "Без названия" });
    const meta = h("span", { class: "p-meta", text: metaText(p) });
    const thumb = p.photos[0] ? h("img", { class: "p-thumb", src: src(p.photos[0]), alt: "" }) : h("span", { class: "p-thumb p-noimg", text: "нет фото" });
    const head = h("div", { class: "p-head" },
      h("span", { class: "p-pos", text: String(i + 1), "aria-hidden": "true" }),
      thumb,
      h("div", { class: "p-sum" }, name, meta),
      h("div", { class: "p-acts" },
        h("button", { class: "p-ico", type: "button", title: "Выше", "aria-label": `Выше: ${p.name || "товар " + (i + 1)}`, disabled: i === 0, "data-up": p.id, onclick: () => move(i, -1) }, "↑"),
        h("button", { class: "p-ico", type: "button", title: "Ниже", "aria-label": `Ниже: ${p.name || "товар " + (i + 1)}`, disabled: i === n - 1, "data-down": p.id, onclick: () => move(i, 1) }, "↓"),
        h("button", { class: "a-link micro p-toggle", type: "button", "aria-expanded": String(open), "data-edit": p.id, onclick: () => toggle(p.id) }, open ? "Свернуть" : "Изменить")));
    const c = h("article", { class: "p-card" + (p.hidden ? " is-hidden" : "") + (open ? " is-open" : ""), "data-id": p.id }, head);
    if (open) c.append(editor(p, { name, meta }));
    return c;
  }

  function move(i, d) {
    const list = P.cat.products, j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    P.msg = "";
    drawProducts(`[data-${d < 0 ? "up" : "down"}="${CSS.escape(list[j].id)}"]`);
  }

  function toggle(id) {
    if (P.open.has(id)) P.open.delete(id); else P.open.add(id);
    drawProducts(`[data-edit="${CSS.escape(id)}"]`);
  }

  function newCategory() {
    const name = (prompt("Название нового раздела, например «Шапки»") || "").trim().slice(0, 30);
    if (!name) return null;
    const cats = P.cat.categories;
    const base = slugify(name) || "cat";
    let key = base, n = 2;
    while (cats[key]) key = base + "-" + n++;
    cats[key] = name;
    return key;
  }

  function editor(p, refs) {
    const id = k => "e-" + p.id + "-" + k;
    const upd = () => { refs.name.textContent = p.name || "Без названия"; refs.meta.textContent = metaText(p); touch(); };

    const name = h("input", { id: id("name"), value: p.name, maxlength: "120", autocomplete: "off", oninput: e => { p.name = e.target.value; upd(); } });
    const price = h("input", { id: id("price"), value: p.price == null ? "" : String(p.price), inputmode: "numeric", autocomplete: "off", placeholder: "2990",
      oninput: e => { const v = e.target.value.replace(/\D/g, "").slice(0, 7); e.target.value = v; p.price = v ? Number(v) : null; upd(); } });

    const cats = P.cat.categories;
    const type = h("select", { id: id("type"), onchange: e => {
      const key = e.target.value === "__new" ? newCategory() : e.target.value;
      if (key) { p.type = key; p.icon = ICONS[key] || "tee-regular"; }
      drawProducts(sel(id("type")));
    } },
      ...(cats[p.type] ? [] : [h("option", { value: "", text: "Выберите раздел", selected: true })]),
      ...Object.keys(cats).map(k => h("option", { value: k, text: cats[k], selected: k === p.type })),
      h("option", { value: "__new", text: "＋ Новый раздел…" }));

    // цвет: название и оттенок кружка на сайте
    const swatches = h("div", { class: "p-swatches" });
    const drawSwatches = () => swatches.replaceChildren(...p.colors.map(c => h("label", { class: "p-swatch" },
      h("input", { type: "color", value: P.cat.colors[c] || "#ffffff", "aria-label": `Оттенок кружка: ${c}`, oninput: e => { P.cat.colors[c] = e.target.value; touch(); } }), c)));
    drawSwatches();
    const colors = h("input", { id: id("colors"), value: p.colors.join(", "), placeholder: "Чёрный", autocomplete: "off",
      oninput: e => { p.colors = splitList(e.target.value).slice(0, 6); drawSwatches(); upd(); } });

    // размеры и «нет в наличии»
    const chips = h("div", { class: "p-chips", role: "group", "aria-label": "Нет в наличии" });
    const drawChips = () => chips.replaceChildren(...p.sizes.map(s => h("button", { type: "button", class: "p-chip", "aria-pressed": String(p.soldOut.includes(s)),
      onclick: e => {
        p.soldOut = p.soldOut.includes(s) ? p.soldOut.filter(x => x !== s) : [...p.soldOut, s];
        e.currentTarget.setAttribute("aria-pressed", String(p.soldOut.includes(s)));
        touch();
      } }, s)));
    drawChips();
    const sizes = h("input", { id: id("sizes"), value: p.sizes.join(", "), placeholder: "S, M, L, XL", autocomplete: "off",
      oninput: e => { p.sizes = splitList(e.target.value).slice(0, 20); p.soldOut = p.soldOut.filter(s => p.sizes.includes(s)); drawChips(); upd(); } });

    const tags = ["", "Новинка", "Мало"];
    if (p.tag && !tags.includes(p.tag)) tags.push(p.tag);
    const tag = h("select", { id: id("tag"), onchange: e => { p.tag = e.target.value; touch(); } },
      ...tags.map(t => h("option", { value: t, text: t || "Без плашки", selected: t === p.tag })));

    const desc = h("textarea", { id: id("desc"), rows: "3", maxlength: "3000", oninput: e => { p.desc = e.target.value; touch(); } });
    desc.value = p.desc;
    const specs = h("textarea", { id: id("specs"), rows: "3", placeholder: "Состав: 100% хлопок\nПлотность: 240 г/м²", oninput: e => {
      p.specs = e.target.value.split("\n").map(l => { const k = l.indexOf(":"); return k > 0 ? [l.slice(0, k).trim(), l.slice(k + 1).trim()] : null; })
        .filter(s => s && s[0] && s[1]);
      touch();
    } });
    specs.value = p.specs.map(([k, v]) => `${k}: ${v}`).join("\n");

    const hidden = h("label", { class: "a-check" },
      h("input", { type: "checkbox", checked: !!p.hidden, onchange: e => { if (e.target.checked) p.hidden = true; else delete p.hidden; upd(); drawProducts(sel(id("hidden"))); }, id: id("hidden") }),
      "Скрыть с сайта");
    const del = h("button", { class: "a-link micro p-del", type: "button", onclick: () => {
      if (!confirm(`Удалить товар «${p.name || "без названия"}»? До «Опубликовать» это можно отменить.`)) return;
      P.cat.products.splice(P.cat.products.indexOf(p), 1);
      P.open.delete(p.id);
      P.msg = "";
      drawProducts();
    } }, "Удалить товар");

    const colorField = field("Цвет", colors, "Несколько цветов — через запятую. Квадратик — оттенок кружка на сайте");
    colorField.append(swatches);
    return h("div", { class: "p-edit" },
      h("div", { class: "p-form" },
        field("Название", name, null, "wide"),
        field("Цена, ₽", price),
        field("Раздел", type),
        colorField,
        field("Плашка на фото", tag),
        field("Размеры", sizes, "Через запятую. Нажмите на размер ниже, если его нет в наличии — на сайте он будет зачёркнут", "wide"),
        h("div", { class: "wide" }, chips)),
      h("p", { class: "p-sub", text: "Фото" }),
      h("p", { class: "p-note", text: "Первое фото — главное в карточке. Звёздочкой отмечены 2 фото для ряда на главной. Стрелки меняют порядок." }),
      photoGrid(p),
      h("div", { class: "p-form" },
        field("Описание", desc, null, "wide"),
        field("Характеристики", specs, "По одной на строку: «Название: значение»", "wide")),
      h("div", { class: "p-foot" }, hidden, del));
  }

  /* ---------- фото ---------- */
  function photoGrid(p) {
    const box = h("div", { class: "ph-grid" });
    const main = mainPhotos(p);
    const btn = (label, title, act, k, disabled, pressed, fn) => h("button", { type: "button", title, "aria-label": title, disabled,
      "aria-pressed": pressed == null ? null : String(pressed), "data-ph": `${p.id}:${k}:${act}`, onclick: fn }, label);
    p.photos.forEach((path, k) => {
      const on = main.includes(path);
      box.append(h("div", { class: "ph" + (on ? " on-main" : "") },
        h("img", { src: src(path), alt: `Фото ${k + 1}`, loading: "lazy" }),
        h("span", { class: "ph-n", text: String(k + 1) }),
        on ? h("span", { class: "ph-badge", text: "на главной" }) : null,
        h("div", { class: "ph-acts" },
          btn("←", "Левее", "left", k, k === 0, null, () => movePhoto(p, k, -1)),
          btn("★", on ? "Убрать из ряда на главной" : "Показывать в ряду на главной", "star", k, false, on, () => star(p, path, k)),
          btn("→", "Правее", "right", k, k === p.photos.length - 1, null, () => movePhoto(p, k, 1)),
          btn("✕", "Удалить фото", "del", k, false, null, () => delPhoto(p, k)))));
    });
    (P.jobs[p.id] || []).forEach(j => box.append(h("div", { class: "ph ph-job" + (j.err ? " err" : "") },
      h("span", { text: j.err ? `${j.label}: ${j.err}` : `Загружаем ${j.label}…` }),
      j.err ? h("button", { type: "button", class: "a-link micro", onclick: () => { P.jobs[p.id] = P.jobs[p.id].filter(x => x !== j); drawProducts(); } }, "Скрыть") : null)));
    const input = h("input", { type: "file", accept: "image/*", multiple: true, class: "vh", id: `e-${p.id}-file`,
      onchange: e => { const files = [...e.target.files]; e.target.value = ""; addPhotos(p, files); } });
    box.append(h("label", { class: "ph ph-add" }, input, h("span", { text: "＋ Добавить фото" })));
    return box;
  }

  function movePhoto(p, k, d) {
    const j = k + d;
    if (j < 0 || j >= p.photos.length) return;
    [p.photos[k], p.photos[j]] = [p.photos[j], p.photos[k]];
    if (p.preview.length) p.preview = p.photos.filter(x => p.preview.includes(x));
    P.msg = "";
    drawProducts(`[data-ph="${CSS.escape(p.id)}:${j}:${d < 0 ? "left" : "right"}"]`);
  }

  function star(p, path, k) {
    let main = mainPhotos(p).slice();
    if (main.includes(path)) {
      if (main.length === 1) { P.msg = "В ряду на главной должно остаться хотя бы одно фото"; bar(); return; }
      main = main.filter(x => x !== path);
    } else {
      if (main.length >= 2) { P.msg = "На главной уже 2 фото — сначала снимите звёздочку с одного из них"; bar(); return; }
      main.push(path);
    }
    p.preview = p.photos.filter(x => main.includes(x));
    P.msg = "";
    drawProducts(`[data-ph="${CSS.escape(p.id)}:${k}:star"]`);
  }

  function delPhoto(p, k) {
    const path = p.photos[k];
    p.photos.splice(k, 1);
    p.preview = p.preview.filter(x => x !== path);
    P.msg = "";
    const next = Math.min(k, p.photos.length - 1);
    drawProducts(next >= 0 ? `[data-ph="${CSS.escape(p.id)}:${next}:del"]` : sel(`e-${p.id}-file`));
  }

  // по одному: уменьшаем в браузере, отправляем скрипту, он кладёт файл в GitHub
  async function addPhotos(p, files) {
    const jobs = P.jobs[p.id] || (P.jobs[p.id] = []);
    const todo = files.filter(f => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name))
      .map(f => ({ file: f, label: f.name.length > 28 ? f.name.slice(0, 25) + "…" : f.name, err: "" }));
    if (!todo.length) { P.msg = "Это не фото — выберите файлы JPG, PNG или WebP"; bar(); return; }
    jobs.push(...todo);
    drawProducts();
    for (const j of todo) {
      try {
        const blob = await shrink(j.file);
        if (blob.size > 1400000) throw new Error("слишком большое даже после сжатия");
        const r = await send({ action: "photoUpload", data: await base64(blob), name: p.name || "photo" });
        if (!r || !r.ok) throw new Error(r && r.error === "invalid" ? r.message : errText(r));
        P.local[r.path] = URL.createObjectURL(blob);
        P.uploads.push({ path: r.path, sha: r.sha });
        p.photos.push(r.path);
        if (p.preview.length === 1 && p.photos.length === 2) p.preview.push(r.path);
        jobs.splice(jobs.indexOf(j), 1);
      } catch (e) {
        j.err = e.message || "не загрузилось";
      }
      P.msg = "";
      drawProducts();
    }
  }

  // не больше 1080×1350, WebP (Safari, который не умеет WebP, получит JPEG), белый фон под прозрачностью
  async function shrink(file) {
    let img;
    try {
      img = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      img = await new Promise((ok, fail) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => fail(new Error("не открывается — сохраните его как JPG и попробуйте снова"));
        i.src = URL.createObjectURL(file);
      });
    }
    const w = img.width, hh = img.height;
    if (!w || !hh) throw new Error("пустое изображение");
    const k = Math.min(1, 1080 / w, 1350 / hh);
    const cv = document.createElement("canvas");
    cv.width = Math.round(w * k);
    cv.height = Math.round(hh * k);
    const g = cv.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, 0, 0, cv.width, cv.height);
    let blob = await new Promise(r => cv.toBlob(r, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp") blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.86));
    if (!blob) throw new Error("не получилось сжать");
    return blob;
  }

  const base64 = blob => new Promise((ok, fail) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(",")[1] || "");
    fr.onerror = () => fail(new Error("не читается"));
    fr.readAsDataURL(blob);
  });

  $("#addProduct").addEventListener("click", () => {
    if (!P.loaded) return;
    const type = Object.keys(P.cat.categories)[0] || "";
    const p = { id: "tmp-" + (++P.seq), type, icon: ICONS[type] || "tee-regular", name: "", price: null, sizes: ["S", "M", "L", "XL"], soldOut: [],
      tag: "Новинка", colors: [], photos: [], preview: [], desc: "", specs: [] };
    P.cat.products.unshift(p);
    P.open.add(p.id);
    P.msg = "";
    drawProducts(sel(`e-${p.id}-name`));
  });

  function problem(p) {
    if (!p.name.trim()) return "нет названия";
    if (!(p.price >= 1)) return "укажите цену";
    if (!P.cat.categories[p.type]) return "выберите раздел";
    if (!p.sizes.length) return "укажите хотя бы один размер";
    return "";
  }

  async function publish() {
    if (!P.loaded || P.busy) return;
    if (uploading()) { P.msg = "Подождите, ещё загружаются фото"; bar(); return; }
    const list = P.cat.products;
    for (let i = 0; i < list.length; i++) {
      const p = list[i], msg = problem(p);
      if (!msg) continue;
      P.open.add(p.id);
      drawProducts();
      P.msg = `Товар ${i + 1}${p.name.trim() ? ` «${p.name.trim()}»` : ""}: ${msg}`;
      bar();
      const el = document.querySelector(`[data-id="${CSS.escape(p.id)}"]`);
      if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    // новым товарам — код из названия; фото для главной — если не выбраны, первые два
    const taken = new Set(list.filter(p => !isNew(p.id)).map(p => p.id)), ids = {};
    const products = list.map(p => {
      const out = clone(p);
      out.name = out.name.trim();
      if (isNew(p.id)) {
        const base = slugify(p.name) || "item";
        let id = base, n = 2;
        while (taken.has(id)) id = base + "-" + n++;
        taken.add(id);
        ids[p.id] = out.id = id;
      }
      if (!out.preview.length) out.preview = out.photos.slice(0, 2);
      return out;
    });
    P.busy = true;
    P.msg = "Публикуем…";
    bar();
    const r = await send({ action: "catalogSave", sha: P.cat.sha, products, colors: P.cat.colors, categories: P.cat.categories, uploads: P.uploads });
    P.busy = false;
    if (!r || !r.ok) {
      P.msg = r && r.error === "auth" ? "Сессия закончилась. Войдите снова и нажмите «Опубликовать» ещё раз." : errText(r);
      bar();
      return;
    }
    Object.keys(ids).forEach(t => { if (P.open.delete(t)) P.open.add(ids[t]); });
    P.cat.products = products;
    P.cat.sha = r.sha;
    P.base = snapP(P.cat);
    P.uploads = [];
    P.msg = "Опубликовано. На сайте появится через 1–2 минуты";
    drawProducts();
    watchDeploy(r.v);
  }

  // GitHub Pages выкладывает сайт около минуты — ждём, пока index.html сошлётся на новый products.js
  async function watchDeploy(v) {
    if (!v) return;
    const me = ++P.watch, until = Date.now() + 5 * 60e3;
    while (Date.now() < until && me === P.watch) {
      await new Promise(r => setTimeout(r, 8000));
      try {
        const t = await (await fetch("../index.html?t=" + Date.now(), { cache: "no-store" })).text();
        if (t.includes("products.js?v=" + v)) {
          if (me === P.watch && !dirtyP() && P.msg.startsWith("Опубликовано")) { P.msg = "Готово: изменения уже на сайте"; bar(); }
          return;
        }
      } catch {}
    }
  }

  /* ================= промокоды ================= */
  async function loadPromos() {
    Q.loading = true;
    $("#qErr").hidden = true;
    $("#qList").replaceChildren(h("p", { class: "a-empty", text: "Загружаем промокоды…" }));
    const r = await send({ action: "promoList" });
    Q.loading = false;
    if (!r || !r.ok) {
      $("#qErr").textContent = errText(r);
      $("#qErr").hidden = false;
      $("#qList").replaceChildren();
      return;
    }
    setPromos(r.promos || []);
    Q.msg = "";
    if (A.view() === "promos") drawPromos();
  }

  function setPromos(list) {
    Q.list = list.map(x => ({ ...x, limit: x.limit === "" || x.limit == null ? "" : String(x.limit), discount: String(x.discount == null ? "" : x.discount) }));
    Q.base = snapQ(Q.list);
    Q.raw = JSON.stringify(Q.list);
    Q.loaded = true;
  }

  function drawPromos(focus) {
    if (!Q.list) return;
    const box = $("#qList");
    box.replaceChildren(...(Q.list.length ? Q.list.map(promoRow) : [h("p", { class: "a-empty", text: "Промокодов пока нет." })]));
    if (focus) { const el = box.querySelector(focus); if (el) el.focus(); }
    bar();
  }

  function promoRow(x, i) {
    const id = k => `q${i}-${k}`;
    const used = x.paid == null ? "новый" : `${x.paid}${x.limit ? " из " + x.limit : ""}`;
    return h("div", { class: "q-row" + (x.valid === false ? " bad" : "") },
      field("Код", h("input", { id: id("code"), value: x.code, maxlength: "40", autocomplete: "off", autocapitalize: "off", spellcheck: "false", oninput: e => { x.code = e.target.value; touchQ(); } })),
      field("Скидка", h("input", { id: id("disc"), value: x.discount, maxlength: "10", autocomplete: "off", placeholder: "500 или 10%", oninput: e => { x.discount = e.target.value; touchQ(); } })),
      field("Лимит активаций", h("input", { id: id("limit"), value: x.limit, inputmode: "numeric", autocomplete: "off", placeholder: "без лимита",
        oninput: e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 7); x.limit = e.target.value; touchQ(); } })),
      h("div", { class: "q-used" },
        h("span", { class: "q-used-label", text: "Оплачено заказов" }),
        h("b", { text: used }),
        x.held ? h("small", { text: `ещё ${x.held} ${plural(x.held, ["заказ ждёт", "заказа ждут", "заказов ждут"])} оплаты` }) : null),
      h("label", { class: "a-check q-on" }, h("input", { type: "checkbox", checked: !!x.on, onchange: e => { x.on = e.target.checked; touchQ(); } }), "Включён"),
      h("button", { class: "a-link micro q-del", type: "button", onclick: () => {
        if (x.paid && !confirm(`Удалить промокод ${x.code}? Им уже оплатили ${x.paid} ${plural(x.paid, ["заказ", "заказа", "заказов"])}.`)) return;
        Q.list.splice(i, 1);
        touchQ();
        drawPromos();
      } }, "Удалить"),
      x.valid === false ? h("p", { class: "q-bad", text: "В таблице в этой строке ошибка: проверьте скидку и лимит. Пока её не исправят, промокод не работает." }) : null);
  }

  $("#addPromo").addEventListener("click", () => {
    if (!Q.loaded) return;
    Q.list.push({ code: "", discount: "", limit: "", on: true, paid: null, held: 0 });
    touchQ();
    drawPromos(`#q${Q.list.length - 1}-code`);
  });

  async function savePromos() {
    if (!Q.loaded || Q.busy) return;
    const seen = new Set();
    for (let i = 0; i < Q.list.length; i++) {
      const x = Q.list[i], code = String(x.code).trim(), n = `Промокод ${i + 1}${code ? ` (${code})` : ""}`;
      const fail = (msg, k) => { Q.msg = `${n}: ${msg}`; bar(); const el = $(`#q${i}-${k}`); if (el) el.focus(); };
      if (!/^[A-Za-z0-9_-]{3,40}$/.test(code)) return fail("код — от 3 до 40 символов: латиница, цифры, _ и -", "code");
      if (seen.has(code.toLowerCase())) return fail("такой код уже есть", "code");
      seen.add(code.toLowerCase());
      const d = String(x.discount).replace(/\s/g, "");
      if (!/^\d+%?$/.test(d) || !(parseInt(d, 10) >= 1) || (d.endsWith("%") && parseInt(d, 10) > 95)) return fail("скидка — рубли (500) или проценты (10%), не больше 95%", "disc");
    }
    Q.busy = true;
    Q.msg = "Сохраняем…";
    bar();
    const r = await send({ action: "promoSave", promos: Q.list.map(x => ({
      code: String(x.code).trim(), discount: String(x.discount).replace(/\s/g, ""), limit: String(x.limit).trim() === "" ? "" : Number(x.limit), on: !!x.on })) });
    Q.busy = false;
    if (!r || !r.ok) {
      Q.msg = r && r.error === "auth" ? "Сессия закончилась. Войдите снова и нажмите «Сохранить» ещё раз." : errText(r);
      bar();
      return;
    }
    setPromos(r.promos || []);
    Q.msg = "Сохранено — промокоды уже работают на сайте";
    drawPromos();
  }

  /* ---------- для admin.js ---------- */
  window.gaShop = {
    show(v) {
      if (v === "products") { if (P.loaded) drawProducts(); else if (!P.loading) loadProducts(); }
      if (v === "promos") { if (Q.loaded) drawPromos(); else if (!Q.loading) loadPromos(); }
      bar();
    },
    reload(v) {
      if (v === "products") {
        if ((dirtyP() || uploading()) && !confirm("Загрузить товары заново? Неопубликованные изменения пропадут.")) return;
        P.loaded = false;
        loadProducts();
      }
      if (v === "promos") {
        if (dirtyQ() && !confirm("Загрузить промокоды заново? Несохранённые изменения пропадут.")) return;
        Q.loaded = false;
        loadPromos();
      }
      bar();
    },
    dirty: () => dirtyP() || dirtyQ() || uploading(),
    reset() {
      Object.assign(P, { loaded: false, cat: null, base: "", uploads: [], jobs: {}, msg: "" });
      P.open.clear();
      Object.assign(Q, { loaded: false, list: null, base: "", msg: "" });
      $("#saveBar").hidden = true;
    }
  };
})();
