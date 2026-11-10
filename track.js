/* Статистика посещений gafarov.shop — свой счётчик, без сторонних сервисов.
   События уходят в Google Apps Script магазина и пишутся на скрытый лист таблицы.
   Не храним IP, а от адреса страницы-источника — только домен. */
(function () {
  var ENDPOINT = "https://script.google.com/macros/s/AKfycbwNuM3b9tL99h73fy8hb0etZRNH6AhBj3lG-P958JzlX-swRg_BG2fD04OcXcnOUxZn/exec";
  var SESSION_GAP = 30 * 60e3; // 30 минут без действий — новый визит
  var noop = function () {};
  var nav = navigator, ua = nav.userAgent || "";

  // боты, предпросмотры ссылок и автоматические браузеры не считаем
  if (nav.webdriver || /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed/i.test(ua)) { window.gaTrack = noop; return; }

  var store = function (s) {
    return {
      get: function (k) { try { return s.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { s.setItem(k, v); } catch (e) {} }
    };
  };
  var ls = store(window.localStorage);
  // «не считать мои визиты» — переключатель в /admin
  if (ls.get("ga_notrack")) { window.gaTrack = noop; return; }

  var rid = function () {
    var a = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  };
  var vid = ls.get("ga_vid");
  if (!vid) { vid = rid(); ls.set("ga_vid", vid); }

  var sess = null;
  try { sess = JSON.parse(ls.get("ga_sess") || "null"); } catch (e) {}
  if (!sess || !sess.id || Date.now() - sess.last > SESSION_GAP) sess = { id: rid(), last: Date.now() };
  var touch = function () { sess.last = Date.now(); ls.set("ga_sess", JSON.stringify(sess)); };

  var device = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? "Планшет"
    : /Mobi|iPhone|iPod|Android/i.test(ua) ? "Телефон" : "Компьютер";
  var browser = /Telegram/i.test(ua) ? "Telegram"
    : /Instagram/i.test(ua) ? "Instagram"
    : /BytedanceWebview|musical_ly|TikTok/i.test(ua) ? "TikTok"
    : /VKClient|vkontakte/i.test(ua) ? "ВКонтакте"
    : /YaBrowser|YaSearchBrowser/i.test(ua) ? "Яндекс Браузер"
    : /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /CriOS|Chrome/.test(ua) ? "Chrome"
    : /Safari/.test(ua) ? "Safari" : "Другой";
  var os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Другая";
  var tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  var q = new URLSearchParams(location.search);
  var utm = ["utm_source", "utm_medium", "utm_campaign"].map(function (k) { return q.get(k) || ""; }).join("|");
  if (utm === "||") utm = "";

  var base = { v: vid, s: sess.id, p: location.pathname, d: device, b: browser, os: os, w: screen.width || 0, l: (nav.language || "").slice(0, 5), tz: tz };

  function send(type, obj, num, extra) {
    touch();
    var e = { t: type, o: obj == null ? "" : String(obj).slice(0, 120), n: Number(num) || 0 };
    for (var k in base) e[k] = base[k];
    if (extra) for (var x in extra) e[x] = extra[x];
    var body = JSON.stringify({ action: "track", e: e });
    try { if (nav.sendBeacon && nav.sendBeacon(ENDPOINT, body)) return; } catch (err) {}
    try { fetch(ENDPOINT, { method: "POST", body: body, keepalive: true, mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" } }); } catch (err) {}
  }
  window.gaTrack = send;

  send("view", "", 0, { r: document.referrer || "", u: utm });

  // сколько времени страницу реально смотрели и как далеко прокрутили
  var since = document.visibilityState === "visible" ? Date.now() : 0, shown = 0, depth = 0;
  var measure = function () {
    var h = document.documentElement.scrollHeight - innerHeight;
    var p = h > 0 ? Math.round(scrollY / h * 100) : 100;
    if (p > depth) depth = Math.min(100, p);
  };
  addEventListener("scroll", measure, { passive: true });
  measure();
  var flush = function () {
    if (since) { shown += (Date.now() - since) / 1000; since = 0; }
    if (shown < 1) return;
    send("leave", depth, Math.round(Math.min(shown, 4 * 3600)));
    shown = 0;
  };
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush(); else since = Date.now();
  });
  addEventListener("pagehide", flush);
})();
