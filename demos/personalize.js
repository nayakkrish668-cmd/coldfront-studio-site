/*
 * ColdFront Studio - demo personalization overlay.
 *
 * Drops a lead's business name (and optionally city) into a static demo
 * homepage at view time, via URL query params:
 *
 *   index.html?biz=Rivertown%20Plumbing&city=Austin
 *
 * No param -> the page renders exactly as the original example business
 * (Northwind, Fixwell, etc.), so every demo still works as a normal,
 * shareable page on its own.
 *
 * Each page declares what to replace in a small inline `window.CF_DEMO`
 * object before loading this script - see the per-trade index.html files.
 */
(function () {
  "use strict";

  function qp(key) {
    try {
      return new URLSearchParams(window.location.search).get(key);
    } catch (e) {
      return null;
    }
  }

  var biz = qp("biz");
  if (!biz) return;
  biz = biz.trim();
  if (!biz) return;

  var city = qp("city");
  var cfg = window.CF_DEMO;
  if (!cfg || !cfg.fullName) return;

  function slugDomain(name) {
    var slug = String(name)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24);
    return (slug || "yourbusiness") + ".com";
  }

  // Longest / most specific strings first so a full-name match always wins
  // over a bare short-name match inside it.
  var pairs = [];
  if (cfg.fullName) pairs.push([cfg.fullName, biz]);
  if (cfg.shortName && cfg.shortName !== cfg.fullName) {
    pairs.push([cfg.shortName, biz]);
  }
  if (cfg.emailDomain) {
    pairs.push([cfg.emailDomain, slugDomain(biz)]);
  }
  if (city && cfg.city) {
    pairs.push([cfg.city, city]);
  }

  function replaceInNode(node) {
    var value = node.nodeValue;
    var changed = false;
    for (var i = 0; i < pairs.length; i++) {
      var from = pairs[i][0];
      var to = pairs[i][1];
      if (value.indexOf(from) !== -1) {
        value = value.split(from).join(to);
        changed = true;
      }
    }
    if (changed) node.nodeValue = value;
  }

  function walkAndReplace(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(replaceInNode);
  }

  function replaceTitle() {
    if (!document.title) return;
    var t = document.title;
    pairs.forEach(function (p) {
      if (t.indexOf(p[0]) !== -1) t = t.split(p[0]).join(p[1]);
    });
    document.title = t;
  }

  function addBadge() {
    var badge = document.createElement("div");
    badge.textContent = "Personalized demo for " + biz;
    badge.setAttribute(
      "style",
      "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);" +
        "z-index:2147483647;background:#ff7a3d;color:#1a0f08;" +
        "font:600 12px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
        "padding:9px 16px;border-radius:999px;box-shadow:0 10px 26px rgba(0,0,0,.35);" +
        "pointer-events:none;letter-spacing:.02em;white-space:nowrap;" +
        "max-width:calc(100vw - 32px);overflow:hidden;text-overflow:ellipsis"
    );
    document.body.appendChild(badge);
  }

  function run() {
    replaceTitle();
    walkAndReplace(document.body);
    addBadge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
