/*
 * ColdFront Studio - demo brand personalization (second layer).
 *
 * personalize.js and the inline COLDFRONT-PERSONALIZE scripts swap exact strings.
 * They miss logo wordmarks that are lowercase / ALL CAPS / built from separate
 * letters, and they leave template placeholders like [City] and (000) 000-0000.
 * This script finishes the job. It only runs when the URL carries ?biz=...
 *
 *   ?biz=Rivertown Plumbing  &city=Austin  &state=TX  &phone=(512) 555-0100
 *
 * Each page declares what the sample brand looks like in window.CF_BRAND:
 *   { full:"Evenair Heating & Cooling", short:"Evenair",
 *     domain:"northwindhvac.co", city:"Minneapolis", phones:["(612) 555-0100"] }
 *
 * Everything the visitor typed in the URL is only ever written as text, never as HTML.
 */
(function () {
  "use strict";
  var cfg = window.CF_BRAND;
  if (!cfg || !cfg.full) return;

  var P;
  try { P = new URLSearchParams(window.location.search); } catch (e) { return; }
  var biz = (P.get("biz") || "").trim().slice(0, 120);
  if (!biz) return; /* no name in the link: leave the page as the sample */
  var city = (P.get("city") || "").trim().slice(0, 60);
  var state = (P.get("state") || "").trim().slice(0, 30);
  var phoneRaw = (P.get("phone") || "").trim().slice(0, 30);
  var street = (P.get("street") || "").trim().slice(0, 80);
  var zip = (P.get("zip") || "").trim().slice(0, 12);

  function shortOf(name) {
    var w = name.replace(/[.,&]/g, " ").split(/\s+/).filter(Boolean);
    while (w.length > 1 && /^(the|a|an)$/i.test(w[0])) w.shift();
    var f = w[0] || name;
    if (f.length < 3 && w.length > 1) f = w[0] + " " + w[1];
    return f;
  }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function matchCase(orig, repl) {
    if (orig === orig.toUpperCase() && orig !== orig.toLowerCase()) return repl.toUpperCase();
    if (orig === orig.toLowerCase() && orig !== orig.toUpperCase()) return repl.toLowerCase();
    return repl;
  }
  function norm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function fmtPhone(p) {
    var d = p.replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    return d.length === 10 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : p;
  }
  function slugDomain(name) {
    var s = String(name).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").slice(0, 24);
    return (s || "yourbusiness") + ".com";
  }

  var bizShort = shortOf(biz);
  var phone = phoneRaw ? fmtPhone(phoneRaw) : "";
  var phoneDigits = phone.replace(/\D/g, "");
  if (phoneDigits.length === 10) phoneDigits = "1" + phoneDigits;

  /* ---- text rules, applied in order ---- */
  var nameRules = [];
  function addName(sample, repl) {
    if (!sample || sample.length < 3) return;
    /* the character before must not be a letter/digit; the one after must not be either */
    nameRules.push({ re: new RegExp("(^|[^A-Za-z0-9])(" + esc(sample) + ")(?![A-Za-z0-9])", "gi"), repl: repl });
  }
  addName(cfg.full, biz);
  if (cfg.short && cfg.short !== cfg.full) addName(cfg.short, bizShort);

  var phoneRules = [];
  (cfg.phones || []).forEach(function (p) {
    if (phone) phoneRules.push({ re: new RegExp(esc(p), "g"), repl: phone });
  });
  var zeroPhone = /\(000\)\s*000-0000|000-000-0000/g;

  function fixText(s) {
    if (!s) return s;
    var out = s, i, r;
    for (i = 0; i < nameRules.length; i++) {
      r = nameRules[i];
      out = out.replace(r.re, function (m, pre, name) { return pre + matchCase(name, r.repl); });
    }
    if (cfg.domain && out.toLowerCase().indexOf(cfg.domain.toLowerCase()) > -1) {
      out = out.replace(new RegExp(esc(cfg.domain), "gi"), slugDomain(biz));
    }
    if (cfg.city && city) {
      /* swap the whole place as a unit so the sample state/zip never stays next to the lead's city.
         An older script may already have replaced the sample city, so match either spelling. */
      var cityState = city + (state ? ", " + state : "");
      var addr = (street ? street + ", " : "") + city + (state ? " " + state : "") + (zip ? " " + zip : "");
      var G = "(^|[^A-Za-z0-9])", E = "(?![A-Za-z0-9])";
      var C = "(?:" + esc(cfg.city) + (city.toLowerCase() !== cfg.city.toLowerCase() ? "|" + esc(city) : "") + ")";
      if (cfg.street && cfg.state && cfg.zip) {
        out = out.replace(new RegExp(G + esc(cfg.street) + ",\\s*" + C + "\\s+" + esc(cfg.state) + "\\s+" + esc(cfg.zip) + E, "g"), function (m, pre) { return pre + addr; });
      }
      if (cfg.stateName) out = out.replace(new RegExp(G + C + ",\\s*" + esc(cfg.stateName) + E, "g"), function (m, pre) { return pre + cityState; });
      if (cfg.state) out = out.replace(new RegExp(G + C + ",\\s*" + esc(cfg.state) + E, "g"), function (m, pre) { return pre + cityState; });
      out = out.replace(new RegExp(G + esc(cfg.city) + E, "g"), function (m, pre) { return pre + city; });
    }
    /* [City] / [State] placeholders */
    if (out.indexOf("[City]") > -1 || out.indexOf("[State]") > -1) {
      if (city) {
        out = out.replace(/\[City\]/g, city);
        out = state ? out.replace(/\[State\]/g, state) : out.replace(/,\s*\[State\]/g, "").replace(/\[State\]/g, "");
      } else {
        out = out.replace(/\s+in\s+\[City\],\s*\[State\]/gi, "")
          .replace(/\[City\],\s*\[State\]/g, "your area")
          .replace(/\[City\]['’]s/g, "your area's")
          .replace(/\bin\s+\[City\]/g, "in your area")
          .replace(/\[City\]/g, "your area")
          .replace(/,?\s*\[State\]/g, "");
      }
    }
    /* phone numbers */
    for (i = 0; i < phoneRules.length; i++) out = out.replace(phoneRules[i].re, phoneRules[i].repl);
    if (zeroPhone.test(out)) { zeroPhone.lastIndex = 0; out = out.replace(zeroPhone, phone || "Call us"); }
    zeroPhone.lastIndex = 0;
    return out;
  }

  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|TITLE)$/;
  function walkText(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentElement && SKIP.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var n, nodes = [];
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (t) { var v = fixText(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; });
  }
  function fixAttrs() {
    var attrs = ["alt", "title", "aria-label", "placeholder"];
    document.querySelectorAll("[alt],[title],[aria-label],[placeholder]").forEach(function (el) {
      attrs.forEach(function (a) { var v = el.getAttribute(a); if (v) { var f = fixText(v); if (f !== v) el.setAttribute(a, f); } });
    });
    document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]').forEach(function (m) {
      var v = m.getAttribute("content"); if (v) { var f = fixText(v); if (f !== v) m.setAttribute("content", f); }
    });
    var t = fixText(document.title); if (t !== document.title) document.title = t;
  }
  /* wordmarks built from separate letters/spans: replace the deepest element whose letters spell the sample brand */
  function fixWordmarks() {
    var targets = [norm(cfg.full), norm(cfg.short || cfg.full)];
    document.querySelectorAll("body *").forEach(function (el) {
      if (SKIP.test(el.tagName) || !el.children.length) return;
      var raw = el.textContent || "";
      if (raw.length > 90) return;
      var k = norm(raw);
      if (!k || targets.indexOf(k) < 0) return;
      for (var i = 0; i < el.children.length; i++) { var c = el.children[i]; if (targets.indexOf(norm(c.textContent || "")) > -1 && c.children.length) return; }
      var trail = (raw.match(/[^A-Za-z0-9\s]+\s*$/) || [""])[0];
      var letters = raw.replace(/[^A-Za-z]/g, "");
      el.textContent = matchCase(letters, k === norm(cfg.full) ? biz : bizShort) + (trail || "");
    });
  }
  function fixLinks() {
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      var h = a.getAttribute("href"), d = h.replace(/\D/g, "");
      var isSample = /^1?0{10}$/.test(d) || (cfg.phones || []).some(function (p) { var pd = p.replace(/\D/g, ""); return d === pd || d === "1" + pd; });
      if (isSample) a.setAttribute("href", phoneDigits ? "tel:+" + phoneDigits : "#");
    });
    if (cfg.domain) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
        var h = a.getAttribute("href");
        if (h.toLowerCase().indexOf(cfg.domain.toLowerCase()) > -1) a.setAttribute("href", h.replace(new RegExp(esc(cfg.domain), "gi"), slugDomain(biz)));
      });
    }
  }

  function run() {
    try {
      if (document.body) { walkText(document.body); fixWordmarks(); fixLinks(); }
      fixAttrs();
    } catch (e) { /* never break the demo page */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
  window.addEventListener("load", function () {
    run();
    setTimeout(run, 400);
    setTimeout(run, 1600);
    /* pages that build text after load (split-letter animations, counters): keep watching briefly */
    if (window.MutationObserver && document.body) {
      var timer = null, mo = new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(run, 250); });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
      setTimeout(function () { mo.disconnect(); }, 8000);
    }
  });
})();
