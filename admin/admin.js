/* gafarov.shop/admin — статистика посещений.
   Логин и пароль проверяет Google Apps Script магазина; здесь их нет. */
(() => {
  "use strict";
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbwNuM3b9tL99h73fy8hb0etZRNH6AhBj3lG-P958JzlX-swRg_BG2fD04OcXcnOUxZn/exec";
  const TOKEN_KEY = "ga_admin_token";
  const PERIODS = [["24h", "24 часа"], ["3d", "3 дня"], ["7d", "7 дней"], ["30d", "30 дней"], ["all", "Всё время"]];
  const VS = { "24h": "к прошлым 24 часам", "3d": "к прошлым 3 дням", "7d": "к прошлым 7 дням", "30d": "к прошлым 30 дням" };
  const EVENT_LABEL = {
    view: "Открыл страницу", leave: "Ушёл со страницы", product: "Смотрел товар", cart: "Положил в корзину",
    checkout: "Начал оформление", order: "Оформил заказ", search: "Искал", fav: "В избранное", filter: "Открыл раздел"
  };
  const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const WEEKDAYS_LONG = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
  const COLOR = { views: "#2e2be3", visitors: "#eb6834", grid: "#e1e0d9", axis: "#c3c2b7", surface: "#fbfaf7" };

  const $ = s => document.querySelector(s);
  const store = s => ({
    get: k => { try { return s.getItem(k); } catch { return null; } },
    set: (k, v) => { try { s.setItem(k, v); } catch {} },
    del: k => { try { s.removeItem(k); } catch {} }
  });
  const ss = store(window.sessionStorage), ls = store(window.localStorage);
  const nf = new Intl.NumberFormat("ru-RU");
  const msk = (t, opts) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", ...opts }).format(new Date(t));

  let stats = null;
  let period = PERIODS.some(p => p[0] === ss.get("ga_admin_period")) ? ss.get("ga_admin_period") : "7d";

  /* ---------- мелочи ---------- */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function sv(tag, attrs) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  const num = n => nf.format(Math.round(n || 0));
  const compact = n => n >= 10000 ? nf.format(Math.round(n / 100) / 10) + " тыс." : num(n);
  const rub = n => num(n) + " ₽";
  const pct = n => nf.format(Math.round((n || 0) * 10) / 10) + "%";
  function dur(s) {
    s = Math.round(s || 0);
    if (s < 60) return s + " с";
    const m = Math.floor(s / 60), r = s % 60;
    if (m < 60) return m + " мин" + (r ? " " + r + " с" : "");
    return Math.floor(m / 60) + " ч " + (m % 60) + " мин";
  }
  function ago(t) {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return "только что";
    if (s < 3600) return Math.floor(s / 60) + " мин назад";
    if (s < 86400) return Math.floor(s / 3600) + " ч назад";
    return msk(t, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  const plural = (n, [one, few, many]) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };

  /* ---------- связь со скриптом ---------- */
  async function call(body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 40000);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body)
      });
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function showLogin(msg) {
    $("#dash").hidden = true;
    $("#loginView").hidden = false;
    $("#loginErr").hidden = !msg;
    $("#loginErr").textContent = msg || "";
    setTimeout(() => $("#login").focus(), 0);
  }

  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const login = $("#login").value, password = $("#password").value;
    const err = m => { $("#loginErr").textContent = m; $("#loginErr").hidden = false; };
    if (!login || !password) return err("Введите логин и пароль");
    const btn = $("#loginBtn");
    btn.disabled = true;
    btn.textContent = "Проверяем…";
    $("#loginErr").hidden = true;
    try {
      const r = await call({ action: "login", login, password });
      if (r.ok) {
        ss.set(TOKEN_KEY, r.token);
        // свои визиты по умолчанию не считаем — один раз, дальше решает переключатель
        if (!ls.get("ga_admin_seen")) { ls.set("ga_admin_seen", "1"); ls.set("ga_notrack", "1"); }
        $("#password").value = "";
        showDash(r.stats);
      } else {
        err(r.error === "locked" ? "Слишком много неверных попыток. Попробуйте через 15 минут." : "Неверный логин или пароль");
      }
    } catch {
      err("Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Войти";
    }
  });

  async function refresh() {
    const token = ss.get(TOKEN_KEY);
    if (!token) return showLogin();
    document.body.classList.add("loading");
    try {
      const r = await call({ action: "stats", token });
      if (r.ok) showDash(r.stats);
      else if (r.error === "auth") { ss.del(TOKEN_KEY); showLogin("Сессия закончилась, войдите снова"); }
    } catch {
      $("#updated").textContent = "не удалось обновить";
    } finally {
      document.body.classList.remove("loading");
    }
  }

  $("#refreshBtn").addEventListener("click", refresh);
  $("#logoutBtn").addEventListener("click", () => {
    const token = ss.get(TOKEN_KEY);
    ss.del(TOKEN_KEY);
    stats = null;
    if (token) call({ action: "logout", token }).catch(() => {});
    showLogin();
  });
  $("#notrack").addEventListener("change", e => {
    if (e.target.checked) ls.set("ga_notrack", "1"); else ls.del("ga_notrack");
  });
  // пока вкладка открыта — обновляем раз в 2 минуты
  setInterval(() => { if (stats && document.visibilityState === "visible") refresh(); }, 120000);

  /* ---------- экран статистики ---------- */
  function showDash(data) {
    stats = data;
    $("#loginView").hidden = true;
    $("#dash").hidden = false;
    $("#notrack").checked = !!ls.get("ga_notrack");
    $("#updated").textContent = "обновлено " + msk(data.generated, { hour: "2-digit", minute: "2-digit" });
    render();
  }

  function renderPeriods() {
    const box = $("#periods");
    box.replaceChildren(...PERIODS.map(([k, label]) => {
      const b = el("button", "a-tab", label);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(k === period));
      b.addEventListener("click", () => { period = k; ss.set("ga_admin_period", k); render(); });
      return b;
    }));
  }

  function render() {
    if (!stats) return;
    const p = stats.periods[period];
    renderPeriods();
    const live = $("#live");
    live.replaceChildren(el("i"), document.createTextNode("Сейчас на сайте: "), el("b", null, num(stats.live)));
    renderHero(p);
    renderTiles(p);
    renderTimeline(p.timeline);
    renderFacts(p);
    renderFunnel(p.funnel);
    renderProducts(p.products);
    renderList($("#sources"), p.sources);
    renderList($("#pages"), p.pages);
    renderColumns($("#hours"), p.hours, p.hours.map((_, i) => String(i)), (v, i) => `${i}:00–${i + 1}:00`, i => i % 3 === 0);
    renderColumns($("#weekdays"), p.weekdays, WEEKDAYS, (v, i) => WEEKDAYS_LONG[i], () => true);
    renderList($("#devices"), p.devices);
    renderList($("#browsers"), p.browsers);
    renderList($("#systems"), p.systems);
    renderList($("#searches"), p.searches, "Пока никто ничего не искал");
    renderList($("#sections"), p.sections, "Разделы ещё не открывали");
    renderList($("#zones"), p.zones.map(z => ({ ...z, k: zoneName(z.k) })));
    renderFeed(stats.recent);
    $("#footInfo").textContent = stats.since
      ? `Статистика ведётся с ${msk(stats.since, { day: "numeric", month: "long", year: "numeric" })} · всего событий: ${num(stats.total)}`
      : "Пока нет ни одного посещения";
  }

  // сравнение с прошлым таким же периодом; lowerIsBetter — для отказов
  function delta(cur, prev, lowerIsBetter) {
    if (period === "all" || prev == null) return null;
    if (!prev && !cur) return { text: "без изменений", cls: "" };
    if (!prev) return { text: "▲ было 0 " + VS[period], cls: lowerIsBetter ? "down" : "up" };
    const d = (cur - prev) / prev * 100;
    if (Math.abs(d) < 0.5) return { text: "без изменений " + VS[period], cls: "" };
    const up = d > 0, good = lowerIsBetter ? !up : up;
    return { text: `${up ? "▲" : "▼"} ${nf.format(Math.round(Math.abs(d)))}% ${VS[period]}`, cls: good ? "up" : "down" };
  }

  function renderHero(p) {
    const box = $("#hero");
    const left = el("div");
    left.append(el("p", "a-hero-label", "Уникальные посетители"), el("p", "a-hero-value", compact(p.visitors)));
    const d = delta(p.visitors, p.prev && p.prev.visitors);
    if (d) left.append(el("p", "a-delta " + d.cls, d.text));
    const side = el("div", "a-hero-side");
    side.append(el("span", null, `новых — ${num(p.newVisitors)}`), el("span", null, `вернулись — ${num(p.returning)}`));
    box.replaceChildren(left, side);
  }

  function renderTiles(p) {
    const pr = p.prev || {};
    const tiles = [
      ["Просмотры страниц", compact(p.views), delta(p.views, pr.views)],
      ["Визиты", compact(p.sessions), delta(p.sessions, pr.sessions)],
      ["Среднее время на сайте", dur(p.avgDuration), delta(p.avgDuration, pr.avgDuration)],
      ["Отказы", pct(p.bounceRate), delta(p.bounceRate, pr.bounceRate, true)],
      ["Страниц за визит", nf.format(p.pagesPerSession), delta(p.pagesPerSession, pr.pagesPerSession)],
      ["Заказы", num(p.orders), delta(p.orders, pr.orders), p.paid == null ? null : `оплачено — ${num(p.paid)}`],
      ["Выручка", rub(p.revenue), delta(p.revenue, pr.revenue), p.waiting ? `ждут оплаты — ${rub(p.waitingSum)}` : null],
      ["Средний чек", (p.paid == null ? p.orders : p.paid) ? rub(p.avgOrder) : "—", (p.paid == null ? p.orders : p.paid) ? delta(p.avgOrder, pr.avgOrder) : null],
      ["Конверсия в заказ", pct(p.conversion), delta(p.conversion, pr.conversion)],
      ["Глубина прокрутки", pct(p.avgScroll), null]
    ];
    $("#tiles").replaceChildren(...tiles.map(([label, value, d, note]) => {
      const t = el("div", "a-tile");
      t.append(el("p", "a-tile-label", label), el("p", "a-tile-value", value));
      if (note) t.append(el("p", "a-tile-note", note));
      if (d) t.append(el("p", "a-delta " + d.cls, d.text));
      return t;
    }));
  }

  /* ---------- подсказка ---------- */
  const tip = $("#tip");
  function showTip(x, y, title, rows) {
    const t = el("p", "a-tip-title", title);
    tip.replaceChildren(t, ...rows.map(([label, value, color]) => {
      const r = el("div", "a-tip-row");
      if (color) { const k = el("i"); k.style.background = color; r.append(k); }
      r.append(el("b", null, value), document.createTextNode(" " + label));
      return r;
    }));
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + "px";
    tip.style.top = Math.max(8, Math.min(innerHeight - h - 8, y - h - 12)) + "px";
  }
  const hideTip = () => { tip.hidden = true; };
  addEventListener("scroll", hideTip, { passive: true });

  function niceMax(v) {
    if (v <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  const barPath = (x, y, w, h) => {
    const r = Math.min(4, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };

  /* ---------- посещаемость: столбики просмотров и линия посетителей ---------- */
  function timeLabel(t, step) {
    if (step < 864e5) {
      const hm = msk(t, { hour: "2-digit", minute: "2-digit" });
      return step === 36e5 ? hm : msk(t, { day: "2-digit", month: "2-digit" }) + " " + hm;
    }
    if (step === 864e5) return msk(t, { day: "2-digit", month: "2-digit" });
    return "неделя с " + msk(t, { day: "2-digit", month: "2-digit" });
  }

  function renderTimeline(tl) {
    const box = $("#timeline");
    const legend = $("#tlLegend");
    const k1 = el("span"); k1.append(el("i", "a-key-bar"), document.createTextNode("Просмотры"));
    const k2 = el("span"); k2.append(el("i", "a-key-line"), document.createTextNode("Посетители"));
    legend.replaceChildren(k1, k2);

    const pts = tl.points, n = pts.length;
    const W = Math.max(280, box.clientWidth || 600), H = 220, padL = 34, padR = 12, padT = 10, axisH = 26;
    const plotW = W - padL - padR, plotH = H - padT - axisH;
    const max = niceMax(Math.max(1, ...pts.map(p => Math.max(p.views, p.visitors))));
    const y = v => padT + plotH - v / max * plotH;
    const band = plotW / n, bw = Math.max(2, Math.min(24, band - 2));
    const cx = i => padL + band * i + band / 2;
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": "Посещаемость по времени" });

    for (let i = 0; i <= 4; i++) {
      const v = max / 4 * i, yy = y(v);
      svg.append(sv("line", { x1: padL, x2: W - padR, y1: yy, y2: yy, stroke: i ? COLOR.grid : COLOR.axis, "stroke-width": 1 }));
      const t = sv("text", { x: padL - 6, y: yy + 4, "text-anchor": "end" });
      t.textContent = compact(v);
      svg.append(t);
    }
    pts.forEach((p, i) => {
      if (p.views) svg.append(sv("path", { d: barPath(cx(i) - bw / 2, y(p.views), bw, plotH + padT - y(p.views)), fill: COLOR.views }));
    });
    const line = pts.map((p, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${y(p.visitors).toFixed(1)}`).join("");
    svg.append(sv("path", { d: line, fill: "none", stroke: COLOR.visitors, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    const last = pts[n - 1];
    svg.append(sv("circle", { cx: cx(n - 1), cy: y(last.visitors), r: 4, fill: COLOR.visitors, stroke: COLOR.surface, "stroke-width": 2 }));

    // подписи по оси времени — не чаще чем помещаются
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 78))));
    pts.forEach((p, i) => {
      if ((n - 1 - i) % every) return;
      const t = sv("text", { x: cx(i), y: H - 8, "text-anchor": i === n - 1 ? "end" : "middle" });
      t.textContent = timeLabel(p.t, tl.step).replace(/^неделя с /, "");
      svg.append(t);
    });

    // наведение: вертикальная линия и подсказка по ближайшей точке
    const cross = sv("line", { y1: padT, y2: padT + plotH, stroke: COLOR.axis, "stroke-width": 1, visibility: "hidden" });
    svg.append(cross);
    pts.forEach((p, i) => {
      const hit = sv("rect", { x: padL + band * i, y: padT, width: band, height: plotH, class: "hit", tabindex: 0 });
      const rows = [["просмотров", num(p.views), COLOR.views], ["посетителей", num(p.visitors), COLOR.visitors], ["заказов", num(p.orders)]];
      hit.setAttribute("aria-label", `${timeLabel(p.t, tl.step)}: ${rows.map(r => r[1] + " " + r[0]).join(", ")}`);
      const on = (x, yy) => { cross.setAttribute("x1", cx(i)); cross.setAttribute("x2", cx(i)); cross.setAttribute("visibility", "visible"); showTip(x, yy, timeLabel(p.t, tl.step), rows); };
      hit.addEventListener("pointermove", e => on(e.clientX, e.clientY));
      hit.addEventListener("focus", () => { const r = hit.getBoundingClientRect(); on(r.left + r.width / 2, r.top + 20); });
      const off = () => { cross.setAttribute("visibility", "hidden"); hideTip(); };
      hit.addEventListener("pointerleave", off);
      hit.addEventListener("blur", off);
      svg.append(hit);
    });
    box.replaceChildren(svg);

    // та же информация таблицей
    const table = el("table", "a-table");
    const head = el("tr");
    ["Время", "Просмотры", "Посетители", "Заказы"].forEach((h, i) => { const th = el("th", i ? "num" : null, h); head.append(th); });
    table.append(head);
    pts.slice().reverse().forEach(p => {
      const tr = el("tr");
      tr.append(el("td", null, timeLabel(p.t, tl.step)), el("td", "num", num(p.views)), el("td", "num", num(p.visitors)), el("td", "num", num(p.orders)));
      table.append(tr);
    });
    const wrap = el("div", "a-scroll");
    wrap.append(table);
    $("#timelineTable").replaceChildren(wrap);
  }

  /* ---------- столбики по часам и дням ---------- */
  function renderColumns(box, values, labels, tipTitle, showLabel) {
    const n = values.length;
    const W = Math.max(260, box.clientWidth || 400), H = 130, padT = 6, axisH = 20;
    const plotH = H - padT - axisH, band = W / n, bw = Math.max(2, Math.min(24, band - 2));
    const max = Math.max(1, ...values);
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img" });
    svg.append(sv("line", { x1: 0, x2: W, y1: padT + plotH, y2: padT + plotH, stroke: COLOR.axis, "stroke-width": 1 }));
    const peak = values.indexOf(Math.max(...values));
    values.forEach((v, i) => {
      const h = v / max * plotH, x = band * i + (band - bw) / 2;
      if (v) svg.append(sv("path", { d: barPath(x, padT + plotH - h, bw, h), fill: COLOR.views }));
      if (showLabel(i)) {
        const t = sv("text", { x: band * i + band / 2, y: H - 5, "text-anchor": "middle" });
        t.textContent = labels[i];
        svg.append(t);
      }
      const hit = sv("rect", { x: band * i, y: 0, width: band, height: padT + plotH, class: "hit", tabindex: 0 });
      hit.setAttribute("aria-label", `${tipTitle(v, i)}: ${num(v)} просмотров`);
      const on = (x0, y0) => showTip(x0, y0, tipTitle(v, i), [["просмотров", num(v), COLOR.views]]);
      hit.addEventListener("pointermove", e => on(e.clientX, e.clientY));
      hit.addEventListener("focus", () => { const r = hit.getBoundingClientRect(); on(r.left + r.width / 2, r.top + 20); });
      hit.addEventListener("pointerleave", hideTip);
      hit.addEventListener("blur", hideTip);
      svg.append(hit);
    });
    // подписываем только самый большой столбик
    if (values[peak]) {
      const t = sv("text", { x: band * peak + band / 2, y: padT + plotH - values[peak] / max * plotH - 4, "text-anchor": "middle", class: "end-label" });
      t.textContent = num(values[peak]);
      svg.append(t);
    }
    box.replaceChildren(svg);
  }

  /* ---------- списки с полосками ---------- */
  function renderList(box, list, emptyText) {
    if (!list || !list.length) { box.replaceChildren(el("p", "a-empty", emptyText || "Пока нет данных")); return; }
    const total = list.reduce((s, x) => s + x.n, 0) || 1;
    const max = Math.max(...list.map(x => x.n)) || 1;
    const rows = el("div", "a-rows");
    list.forEach(x => {
      const r = el("div", "a-row" + (x.other ? " other" : ""));
      const top = el("div", "a-row-top");
      const numEl = el("span", "a-row-num", num(x.n));
      numEl.append(el("small", null, pct(x.n / total * 100)));
      top.append(el("span", "a-row-name", x.k), numEl);
      const track = el("div", "a-track"), fill = el("div", "a-fill");
      fill.style.width = (x.n / max * 100) + "%";
      track.append(fill);
      r.append(top, track);
      rows.append(r);
    });
    box.replaceChildren(rows);
  }

  function renderFunnel(steps) {
    const box = $("#funnel");
    const first = steps[0] ? steps[0].n : 0;
    if (!first) { box.replaceChildren(el("p", "a-empty", "Пока нет данных")); return; }
    const wrap = el("div", "a-funnel");
    steps.forEach((s, i) => {
      const st = el("div", "a-step");
      const top = el("div", "a-step-top");
      top.append(el("span", null, s.k), el("b", null, num(s.n)));
      const track = el("div", "a-track"), fill = el("div", "a-fill");
      fill.style.width = (s.n / first * 100) + "%";
      track.append(fill);
      st.append(top, track);
      if (i) {
        const prev = steps[i - 1].n;
        st.append(el("p", "a-step-conv", `${pct(s.n / first * 100)} от зашедших · ${prev ? pct(s.n / prev * 100) : "—"} от прошлого шага`));
      }
      wrap.append(st);
    });
    box.replaceChildren(wrap);
  }

  function renderProducts(list) {
    const table = $("#products");
    const head = el("tr");
    [["Товар"], ["Просмотры", "num"], ["В корзину", "num"], ["Избранное", "num"], ["Из просмотра в корзину", "num"]]
      .forEach(([h, c]) => head.append(el("th", c || null, h)));
    if (!list.length) {
      const tr = el("tr"), td = el("td", "muted", "Товары ещё не открывали");
      td.colSpan = 5;
      tr.append(td);
      table.replaceChildren(head, tr);
      return;
    }
    table.replaceChildren(head, ...list.map(p => {
      const tr = el("tr");
      tr.append(el("td", null, p.k), el("td", "num", num(p.views)), el("td", "num", num(p.carts)), el("td", "num", num(p.favs)),
        el("td", "num", p.views ? pct(p.carts / p.views * 100) : "—"));
      return tr;
    }));
  }

  function renderFacts(p) {
    const facts = [];
    const hourPeak = p.hours.indexOf(Math.max(...p.hours));
    if (p.views) facts.push(["Самый активный час", `${hourPeak}:00–${hourPeak + 1}:00`]);
    const dayPeak = p.weekdays.indexOf(Math.max(...p.weekdays));
    if (p.views && period !== "24h") facts.push(["Самый активный день", WEEKDAYS_LONG[dayPeak]]);
    if (p.products[0]) facts.push(["Чаще всего смотрят", p.products[0].k]);
    const carted = p.products.slice().sort((a, b) => b.carts - a.carts)[0];
    if (carted && carted.carts) facts.push(["Чаще всего кладут в корзину", carted.k]);
    const src = p.sources.find(s => !s.other);
    if (src) facts.push(["Главный источник", src.k]);
    const dev = p.devices[0];
    if (dev && p.visitors) facts.push([`${dev.k}`, `${pct(dev.n / p.visitors * 100)} посетителей`]);
    if (p.visitors) facts.push(["Вернулись повторно", `${pct(p.returning / p.visitors * 100)} посетителей`]);
    const box = $("#facts");
    if (!facts.length) { box.replaceChildren(el("li", null, "Пока нет данных")); return; }
    box.replaceChildren(...facts.map(([k, v]) => { const li = el("li"); li.append(el("span", null, k), el("b", null, v)); return li; }));
  }

  function renderFeed(list) {
    const table = $("#feed");
    const head = el("tr");
    ["Когда", "Действие", "Подробности", "Устройство", "Источник"].forEach(h => head.append(el("th", null, h)));
    if (!list.length) {
      const tr = el("tr"), td = el("td", "muted", "Пока пусто");
      td.colSpan = 5;
      tr.append(td);
      table.replaceChildren(head, tr);
      return;
    }
    table.replaceChildren(head, ...list.map(x => {
      const tr = el("tr");
      const detail = x.e === "view" ? pageName(x.p) : x.e === "leave" ? (x.o ? `прокрутил ${x.o}%` : "") : (x.o || "");
      tr.append(el("td", null, ago(x.t)), el("td", null, EVENT_LABEL[x.e] || x.e), el("td", null, detail), el("td", "muted", x.d || "—"), el("td", "muted", x.src || "—"));
      return tr;
    }));
  }

  function pageName(p) {
    if (!p || p === "/" || p === "/index.html") return "Главная";
    if (/privacy/.test(p)) return "Политика конфиденциальности";
    if (/terms/.test(p)) return "Условия пользования";
    return p;
  }
  function zoneName(z) {
    if (!z || z === "Не определено") return "Не определено";
    const city = z.split("/").pop().replace(/_/g, " ");
    const ru = { Moscow: "Москва", Samara: "Самара", Yekaterinburg: "Екатеринбург", Novosibirsk: "Новосибирск", Omsk: "Омск",
      Krasnoyarsk: "Красноярск", Irkutsk: "Иркутск", Vladivostok: "Владивосток", Kaliningrad: "Калининград", Minsk: "Минск",
      Kiev: "Киев", Kyiv: "Киев", Almaty: "Алматы", Tashkent: "Ташкент", Yerevan: "Ереван", Tbilisi: "Тбилиси", Volgograd: "Волгоград",
      Saratov: "Саратов", Ulyanovsk: "Ульяновск", Astrakhan: "Астрахань", Kirov: "Киров", Barnaul: "Барнаул", Tomsk: "Томск",
      Novokuznetsk: "Новокузнецк", Chita: "Чита", Yakutsk: "Якутск", Magadan: "Магадан", Kamchatka: "Камчатка", Sakhalin: "Сахалин",
      Berlin: "Берлин", London: "Лондон", Oslo: "Осло", Istanbul: "Стамбул", Dubai: "Дубай", Bishkek: "Бишкек", Baku: "Баку" };
    return ru[city] || city;
  }

  // графики подстраиваются под ширину
  let resizeTimer;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });

  /* ---------- старт ---------- */
  if (ss.get(TOKEN_KEY)) {
    $("#dash").hidden = false;
    $("#updated").textContent = "загружаем…";
    refresh();
  } else {
    showLogin();
  }
})();
