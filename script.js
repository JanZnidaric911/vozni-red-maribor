(function () {
  "use strict";

  var doc = document.documentElement;
  doc.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Year */
  var year = document.getElementById("leto");
  if (year) year.textContent = String(new Date().getFullYear());

  /* Glassy header on scroll */
  var header = document.querySelector(".site-header");
  function onScrollHeader() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }

  /* Subtle parallax for hero decoration */
  var layers = reduceMotion ? [] : Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  var ticking = false;
  function applyParallax() {
    var y = window.scrollY;
    if (y < window.innerHeight * 1.5) {
      layers.forEach(function (el) {
        var f = parseFloat(el.getAttribute("data-parallax")) || 0;
        el.style.transform = "translate3d(0," + (y * f).toFixed(1) + "px,0)";
      });
    }
    ticking = false;
  }
  function onScroll() {
    onScrollHeader();
    if (layers.length && !ticking) {
      ticking = true;
      window.requestAnimationFrame(applyParallax);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Reveal on scroll (staggered inside groups) */
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  [".features", ".steps", ".hero-copy"].forEach(function (sel) {
    var group = document.querySelector(sel);
    if (!group) return;
    Array.prototype.forEach.call(group.querySelectorAll(".reveal"), function (el, i) {
      el.style.setProperty("--d", (i * 0.07).toFixed(2) + "s");
    });
  });
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* Copy page link */
  var url = window.location.href.split("#")[0];
  var urlEl = document.getElementById("page-url");
  var btn = document.getElementById("copy-btn");
  var status = document.getElementById("copy-status");
  if (urlEl) {
    urlEl.textContent = url.replace(/^https?:\/\//, "");
    urlEl.title = url;
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  var resetTimer;
  function done(ok) {
    var label = btn.querySelector(".copy-label");
    if (ok) {
      label.textContent = "Kopirano!";
      status.textContent = "Povezava je kopirana. Prilepi jo v sporočilo in jo odpri na telefonu.";
    } else {
      status.textContent = "Kopiranje ni uspelo. Povezavo prepiši iz naslovne vrstice brskalnika.";
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(function () { label.textContent = "Kopiraj povezavo"; }, 2400);
  }

  if (btn && status) {
    btn.addEventListener("click", function () {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(fallbackCopy(url)); });
      } else {
        done(fallbackCopy(url));
      }
    });
  }
})();
