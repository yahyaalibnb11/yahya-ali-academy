/* Landing interactions: curriculum explorer, profit calculator, counters, scroll motion. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const fmt = (n) => "Rs " + Math.round(n).toLocaleString("en-US");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = window.COURSE;

  /* nav + mobile CTA */
  const nav = $("#nav"), mcta = $(".m-cta");
  const onScroll = () => { nav.classList.toggle("solid", scrollY > 20); mcta && mcta.classList.toggle("show", scrollY > 700); };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* cursor glow */
  const glow = $(".cursor-glow");
  if (glow) addEventListener("pointermove", (e) => { glow.style.left = e.clientX + "px"; glow.style.top = e.clientY + "px"; }, { passive: true });

  /* curriculum explorer */
  const rail = $("#curRail"), panel = $("#curPanel");
  const lock = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  const play = '<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
  function showModule(i, focus) {
    const m = C.modules[i];
    rail.querySelectorAll(".cur-tab").forEach((b, j) => { b.setAttribute("aria-selected", j === i); b.tabIndex = j === i ? 0 : -1; });
    if (focus) rail.children[i].focus();
    panel.innerHTML = `
      <div class="cp-top"><span class="chip ember">Module ${m.n}</span><span class="chip">${m.lessons.length} lessons</span><span class="chip cool">${m.tag}</span></div>
      <h3 class="cp-title">${m.title}</h3>
      <p class="cp-blurb">${m.blurb}</p>
      <ul class="cp-gains">${m.gains.map((g) => `<li>${g}</li>`).join("")}</ul>
      <ul class="cp-lessons">${m.lessons.map(([id, t, d, v]) => {
        const free = v && C.videos[v] && C.videos[v].free;
        return `<li><span class="ln">${id}</span><div><div class="lt">${t}</div><div class="ld">${d}</div></div><span class="lock ${free ? "free" : ""}" title="${free ? "Free preview" : "Enroll karke unlock"}">${free ? play : lock}</span></li>`;
      }).join("")}</ul>`;
    if (window.gsap && !reduce) gsap.from(panel.children, { y: 14, opacity: 0, duration: 0.45, stagger: 0.05, ease: "power2.out" });
  }
  C.modules.forEach((m, i) => {
    const b = document.createElement("button");
    b.className = "cur-tab"; b.type = "button"; b.setAttribute("role", "tab"); b.id = "mod-" + m.n;
    b.innerHTML = `<span class="n">M${String(m.n).padStart(2, "0")}</span><span class="t">${m.title}</span><span class="c">${m.lessons.length}</span>`;
    b.addEventListener("click", () => showModule(i));
    b.addEventListener("keydown", (e) => {
      const k = e.key; if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(k)) return;
      e.preventDefault(); const d = k === "ArrowDown" || k === "ArrowRight" ? 1 : -1;
      showModule((i + d + C.modules.length) % C.modules.length, true);
    });
    rail.append(b);
  });
  showModule(1);

  /* calculator (Lesson 1.2 style) */
  const ids = ["cAdr", "cNights", "cRent", "cRun"], el = Object.fromEntries(ids.map((k) => [k, $("#" + k)]));
  const out = { cAdr: $("#oAdr"), cNights: $("#oNights"), cRent: $("#oRent"), cRun: $("#oRun") };
  const cal = $("#calCal"); for (let i = 0; i < 31; i++) cal.append(document.createElement("i"));
  const UNITS = { 1: [8000, 20, 60000, 25000], 2: [12000, 20, 90000, 35000], 3: [16000, 18, 130000, 45000], h: [25000, 16, 200000, 70000] };
  const prev = {};
  const showVal = (k) => { const v = +el[k].value; if (document.activeElement !== out[k]) out[k].value = k === "cNights" ? v : fmt(v); };
  function tween(node, to, f) {
    const from = prev[node.id] ?? to; prev[node.id] = to;
    if (reduce || !window.gsap) { node.textContent = f(to); return; }
    const o = { v: from }; gsap.to(o, { v: to, duration: 0.5, ease: "power2.out", onUpdate: () => (node.textContent = f(o.v)) });
  }
  function calc() {
    ids.forEach((k) => { const i = el[k]; i.style.setProperty("--p", ((i.value - i.min) / (i.max - i.min)) * 100 + "%"); showVal(k); });
    const adr = +el.cAdr.value, n = +el.cNights.value, rent = +el.cRent.value, run = +el.cRun.value;
    const rev = adr * n, fee = rev * 0.03, cost = rent + run, profit = rev - fee - cost;
    const be = adr > 0 ? Math.ceil(cost / (adr * 0.97)) : 99;
    tween($("#rRev"), rev, fmt); tween($("#rFee"), fee, (v) => "− " + fmt(v)); tween($("#rCost"), cost, (v) => "− " + fmt(v));
    tween($("#rProfit"), profit, (v) => (v < 0 ? "− " : "") + fmt(Math.abs(v)));
    $("#rProfit").classList.toggle("neg", profit < 0);
    $("#rBe").textContent = be > 31 ? "31+ raatein (loss)" : be + " raatein";
    [...cal.children].forEach((c, i) => c.classList.toggle("on", i < n));
    document.querySelectorAll(".calc-quick button").forEach((b) => b.classList.toggle("on", +b.dataset.n === n));
  }
  const setUnit = (u) => {
    const v = UNITS[u]; ids.forEach((k, i) => (el[k].value = v[i]));
    document.querySelectorAll(".calc-units button").forEach((b) => b.classList.toggle("on", b.dataset.u === u)); calc();
  };
  ids.forEach((k) => {
    el[k].addEventListener("input", calc);
    const o = out[k];
    o.addEventListener("focus", () => { o.value = el[k].value; o.select(); });
    o.addEventListener("input", () => {
      const raw = +o.value.replace(/[^0-9]/g, ""); if (!o.value.trim()) return;
      const v = Math.min(+el[k].max, Math.max(+el[k].min, raw)); el[k].value = v;
      const i = el[k]; i.style.setProperty("--p", ((i.value - i.min) / (i.max - i.min)) * 100 + "%");
      calc();
    });
    o.addEventListener("blur", () => { calc(); });
    o.addEventListener("keydown", (e) => { if (e.key === "Enter") o.blur(); });
  });
  document.querySelectorAll(".calc-quick button").forEach((b) => b.addEventListener("click", () => { el.cNights.value = b.dataset.n; calc(); }));
  document.querySelectorAll(".calc-units button").forEach((b) => b.addEventListener("click", () => setUnit(b.dataset.u)));
  setUnit("1");

  /* watermark demo in platform mock */
  const wm = $("#ppWm");
  if (wm && !reduce) setInterval(() => { wm.style.left = 6 + Math.random() * 50 + "%"; wm.style.top = 8 + Math.random() * 60 + "%"; }, 2600);

  /* HUD occupancy ticker */
  const occ = $("#hudOcc");
  if (occ && !reduce) setInterval(() => { const v = 62 + Math.round(Math.random() * 26); occ.textContent = v + "%"; occ.parentElement.querySelector("i").style.width = v + "%"; }, 2800);

  if (!window.gsap || reduce) return;
  gsap.registerPlugin(ScrollTrigger);

  /* hero intro */
  gsap.from(".hero-title .line > *, .hero-title .line", { yPercent: 105, duration: 1.1, ease: "expo.out", stagger: 0.09, delay: 0.1 });
  gsap.from(".hero-badge, .hero-sub, .hero-actions, .hero-stats", { y: 24, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.1, delay: 0.45 });
  gsap.from(".hud-card", { scale: 0.85, opacity: 0, duration: 0.9, ease: "back.out(1.6)", stagger: 0.15, delay: 0.8 });

  /* counters */
  document.querySelectorAll("[data-count]").forEach((n) => {
    const to = +n.dataset.count, suf = n.dataset.suffix || "", o = { v: 0 };
    gsap.to(o, { v: to, duration: 1.8, ease: "power2.out", delay: 0.7, onUpdate: () => (n.textContent = Math.round(o.v).toLocaleString("en-US") + suf) });
  });

  /* reveals */
  ScrollTrigger.batch(".reveal", { start: "top 88%", once: true, onEnter: (els) => gsap.from(els, { y: 40, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.1 }) });
  document.querySelectorAll(".sec-head").forEach((h) => gsap.from(h.children, { scrollTrigger: { trigger: h, start: "top 85%", once: true }, y: 30, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 }));
  gsap.to(".price-glow", { scrollTrigger: { trigger: ".pricing", start: "top bottom", end: "bottom top", scrub: true }, x: 300 });
})();
