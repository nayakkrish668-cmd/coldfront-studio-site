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
  /* no name in the link (e.g. someone browsing the main site): keep the sample brand, but still clear the
     template's bracketed stand-ins so nobody sees "[4.9]" or "[Lic. #]" */
  var sampleOnly = !biz;
  var city = (P.get("city") || "").trim().slice(0, 60);
  var state = (P.get("state") || "").trim().slice(0, 30);
  var phoneRaw = (P.get("phone") || "").trim().slice(0, 30);
  var street = (P.get("street") || "").trim().slice(0, 80);
  var zip = (P.get("zip") || "").trim().slice(0, 12);
  /* the business's own public Google rating, from the Places API. Shown only when it is real and well supported. */
  var ratingNum = parseFloat(P.get("rating") || "");
  var reviewsNum = parseInt(P.get("reviews") || "", 10) || 0;
  var ratingText = (isFinite(ratingNum) && ratingNum >= 4 && ratingNum <= 5 && reviewsNum >= 10) ? ratingNum.toFixed(1) : "";

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
  if (!sampleOnly) {
    addName(cfg.full, biz);
    if (cfg.short && cfg.short !== cfg.full) addName(cfg.short, bizShort);
  }

  var phoneRules = [];
  (sampleOnly ? [] : (cfg.phones || [])).forEach(function (p) {
    if (phone) {
      phoneRules.push({ re: new RegExp(esc(p), "g"), repl: phone });
    } else {
      /* no public number for this lead: never leave the sample number on the page */
      phoneRules.push({ re: new RegExp("Call\\s+" + esc(p), "g"), repl: "Call us" });
      phoneRules.push({ re: new RegExp(esc(p), "g"), repl: "Call us" });
    }
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

  /* Templates carry bracketed stand-ins like [4.9], [Lic. #], [30 min], [City 1]. For a real lead we only
     ever show what we actually know: their city, their public Google rating, their phone. Everything else
     in brackets is a claim we cannot back up, so the item (or the FAQ entry it sits in) is removed. */
  /* [City] and [State] (older templates) are rewritten by fixText below, and "[ 1 / 3 ]" is slider UI.
     None of those are stand-ins to remove. */
  var KEEP = /^\[(City|State|City \d+|\s*\d+\s*\/\s*\d+\s*)\]$/;
  var TOKEN = /\[[^\]]{1,60}\]/g;
  function standIns(s) { return (String(s).match(TOKEN) || []).filter(function (m) { return !KEEP.test(m); }); }
  var BRACKET = { test: function (s) { return standIns(s).length > 0; } };
  /* a footer line like " - License: [License No.]" is removed on its own so the copyright text stays */
  var LICENSE_LINE = /\s*[-–—|·]\s*(?:License|Lic\.?)(?:\s*(?:#|No\.?|number))?\s*:?\s*\[[^\]]{1,60}\]/gi;
  /* a stand-in inside one of these removes the whole unit: FAQ entry, list item, testimonial card or slide */
  var UNIT = "details, .acc__item, li, .vcard, .slider_cms_item, blockquote, figure";
  /* inside a paragraph only the sentence that holds the stand-in is removed */
  function dropSentences(v) {
    var toks = [];
    var masked = v.replace(TOKEN, function (m) { toks.push(m); return "\u0001" + (toks.length - 1) + "\u0002"; });
    var parts = masked.match(/[^.!?]+[.!?]*\s*|[.!?]+\s*/g) || [masked];
    var kept = parts.filter(function (p) {
      var bad = false;
      p.replace(/\u0001(\d+)\u0002/g, function (_, i) { if (!KEEP.test(toks[+i])) bad = true; return ""; });
      return !bad;
    });
    return kept.join("").replace(/\u0001(\d+)\u0002/g, function (_, i) { return toks[+i]; });
  }
  var cityLabel = city ? city + (state ? ", " + state : "") : "";
  function dropEl(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
  /* the templates' sample address (hello@example.com) is not the lead's email: remove the item that shows it */
  var SAMPLE_EMAIL = /[A-Za-z0-9._%+-]+@example\.(?:com|org|net)/i;
  function fixSampleEmail() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentElement && !SKIP.test(n.parentElement.tagName) && SAMPLE_EMAIL.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (t) {
      var el = t.parentElement;
      if (!el) return;
      var unit = el.closest("li") || el.closest("a");
      if (unit) dropEl(unit); else t.nodeValue = t.nodeValue.replace(SAMPLE_EMAIL, "").replace(/\s{2,}/g, " ");
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      if (SAMPLE_EMAIL.test(a.getAttribute("href") || "")) { if (!(a.textContent || "").trim()) dropEl(a); else a.removeAttribute("href"); }
    });
  }

  function fixPlaceholders() {
    if (!document.body) return;
    fixSampleEmail();
    /* service-area chips: [City 1] ... [City 6] */
    var chipLists = [];
    document.querySelectorAll("li").forEach(function (li) {
      if (/^\[City \d+\]$/.test((li.textContent || "").trim()) && chipLists.indexOf(li.parentNode) < 0) chipLists.push(li.parentNode);
    });
    chipLists.forEach(function (ul) {
      var items = [].slice.call(ul.children).filter(function (li) { return /^\[City \d+\]$/.test((li.textContent || "").trim()); });
      items.forEach(function (li, i) { if (i === 0 && cityLabel) li.textContent = cityLabel; else dropEl(li); });
      if (!ul.children.length) dropEl(ul.closest("#areas") || ul);
    });
    /* every other bracketed stand-in */
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentElement && !SKIP.test(n.parentElement.tagName) && BRACKET.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    var touched = [];
    nodes.forEach(function (t) {
      var v = t.nodeValue, el = t.parentElement;
      if (!el) return;
      v = v.replace(LICENSE_LINE, "");
      if (ratingText) v = v.replace("[4.9]", ratingText);
      if (!BRACKET.test(v)) { if (v !== t.nodeValue) t.nodeValue = v; return; }
      var unit = el.closest(UNIT), sec = el.closest("section");
      if (sec) touched.push(sec);
      if (unit) { dropEl(unit); return; }
      if (el.closest("p") || !el.closest("span")) {
        var nv = dropSentences(v);
        t.nodeValue = nv;
        if (!nv.trim()) { var host = el.closest("p") || el; if (!host.textContent.trim()) dropEl(host); }
        return;
      }
      dropEl(el.closest("span"));
    });
    /* a section that is left with little more than its heading is removed */
    touched.forEach(function (sec) {
      if (sec.parentNode && (sec.innerText || sec.textContent || "").replace(/\s+/g, " ").trim().length < 90) dropEl(sec);
    });
    /* tidy containers that ended up empty */
    document.querySelectorAll(".hc-proof").forEach(function (e) { if (!e.children.length) dropEl(e); });
    document.querySelectorAll(".trust-strip").forEach(function (e) { if (!e.querySelector("li")) dropEl(e); });
  }

  function run() {
    try {
      if (sampleOnly) { if (document.body) fixPlaceholders(); return; }
      if (document.body) { fixPlaceholders(); walkText(document.body); fixWordmarks(); fixLinks(); }
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
