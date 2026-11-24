/* Classic landing: content from COURSE, calculator, curriculum accordion, small motion. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const svg = (id) => `<svg><use href="#${id}"/></svg>`;
  const fmt = (n) => "Rs " + Math.round(n).toLocaleString("en-US");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = window.COURSE;

  /* Unit photos (public bucket) */
  const PHOTO_BASE = "https://dwfelduzybgtqbyuvlse.supabase.co/storage/v1/object/public/property-photos/";
  const PHOTOS = ["BC204/1791907704731-x49g2c.jpg", "RHD5/1791925813991-ne9ltm.jpg", "BC203/1791923805413-ghgrfw.jpg", "BC209/1792326350747-hro2xn.jpg", "RHD5/1791925809326-97cjx8.jpg", "BC201/1792326717864-o9zw9y.jpg", "BC204/1791906206949-ce1oil.jpg", "RHD5/1791925791100-djl882.jpg"];
  let galErr = 0;
  window.galFail = (img) => { img.closest("figure").remove(); if (++galErr >= 6) $("#units").hidden = true; };
  const LAYOUT = ["big", "", "tall", "", "", "", "", ""];
  $("#gal").innerHTML = PHOTOS.map((p, i) => `<figure class="${LAYOUT[i]}"><img src="${PHOTO_BASE + p}" alt="Hamari chalayi hui ek unit" loading="lazy" onerror="galFail(this)"></figure>`).join("");
  $$("[data-photo]").forEach((img) => (img.src = PHOTO_BASE + PHOTOS[+img.dataset.photo]));

  /* Lists */
  const LISTS = {
    includes: ["9 modules, 46 recorded lessons", "Apna private members area, mobile aur laptop", "Budget, landlord deal, listing, pricing, operations", "4-file toolkit: calculator, checklist, agreement", "Lifetime access aur naye lessons free"],
    price: ["9 modules, 46 recorded lessons", "HD streaming, mobile aur laptop dono pe", "Har lesson ka homework aur progress tracking", "4-file toolkit: calculator, checklist, agreement, WhatsApp texts", "Naye lessons aur updates free", "Course ke end pe live mentorship ka raasta"],
  };
  $$("[data-list]").forEach((ul) => {
    ul.innerHTML = LISTS[ul.dataset.list].map((t) => `<li><span class="chk${ul.hasAttribute("data-solid") ? " solid" : ""}">${svg("i-check")}</span>${esc(t)}</li>`).join("");
  });
  $("#bonuses").innerHTML = C.toolkit.map(([, t]) => `<div>${svg("i-check")}${esc(t)}</div>`).join("");

  /* Marquee */
  const TOPICS = ["Furnished budget", "Landlord negotiation", "Agreement · 13 points", "Hotel Eye", "Listing photography", "Dynamic pricing", "Booking.com", "Cleaning SOP", "5-star reviews", "AI prompts", "30 din action plan"];
  $("#track").innerHTML = [...TOPICS, ...TOPICS].map((t) => `<span>${esc(t)}<i>✦</i></span>`).join("");

  /* Curriculum accordion */
  const mods = $("#mods");
  mods.innerHTML = C.modules.map((m, i) => {
    const freeCount = m.lessons.filter(([, , , v]) => v && C.videos[v] && C.videos[v].free).length;
    return `<li class="${i === 0 ? "open" : ""}">
      <button class="mod-h" type="button" aria-expanded="${i === 0}"><span class="mod-n">M${String(m.n).padStart(2, "0")}<small>MODULE</small></span>
      <span class="mod-t"><b>${esc(m.title)}${freeCount ? '<span class="ai-tag">FREE</span>' : ""}</b><small>${m.lessons.length} lessons · ${esc(m.tag)}</small></span>
      <span class="mod-x">${svg("i-plus")}</span></button>
      <div class="mod-b"><div><div class="mod-in"><p>${esc(m.blurb)}</p>
        <ul class="gains">${m.gains.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>
        <ul class="lessons">${m.lessons.map(([id, t, d, v]) => {
          const free = v && C.videos[v] && C.videos[v].free;
          return `<li><span class="lid">${esc(id)}</span><span><span class="lt">${esc(t)}</span><span class="ld">${esc(d)}</span></span><em class="${free ? "free" : ""}">${free ? "Free" : ""}</em></li>`;
        }).join("")}</ul></div></div></div></li>`;
  }).join("");
  mods.addEventListener("click", (e) => {
    const b = e.target.closest(".mod-h"); if (!b) return;
    const li = b.parentElement, open = !li.classList.contains("open");
    li.classList.toggle("open", open); b.setAttribute("aria-expanded", open);
  });

  /* FAQ */
  const FAQS = [
    ["Kya apni property hona zaroori hai?", "Nahi. Arbitrage ka matlab hi ye hai: landlord ki ijazat se apartment kiraye pe lein, set karein, aur short stays pe chalayein. Course mein poora tareeqa hai."],
    ["Course kis zabaan mein hai?", "Roman Urdu / Urdu mein, aasaan alfaaz mein. Screen pe numbers aur notes saath chalte hain."],
    ["Payment ke baad access kab milta hai?", "Account banayein, JazzCash, Easypaisa ya bank se Rs 5,000 bhejein aur screenshot upload karein. Payment confirm hote hi saare lessons aur toolkit aap ke account mein khul jaate hain."],
    ["Kya main course download kar sakta hoon?", "Nahi. Course sirf website pe stream hota hai, aap ke apne account se. Har video pe aap ka watermark hota hai aur ek waqt mein ek device pe chalta hai."],
    ["Mobile pe chalega?", "Haan. Phone, tablet aur laptop, sab pe. Full screen bhi kar sakte hain."],
    ["Co-hosting bhi sikhaya gaya hai?", "Module 8 mein co-hosting ka concept aur Ember Rentals jaisa model samjhaya gaya hai. Deep co-hosting (owners, deals, scaling) live mentorship ka hissa hai."],
    ["Kya income ki guarantee hai?", "Nahi. Ye business hai; result aap ki mehnat, area aur faislon pe depend karta hai. Course aap ko sahi system aur galtiyon se bachne ka tareeqa deta hai."],
  ];
  $("#faqs").innerHTML = FAQS.map(([q, a], i) => `<details${i === 0 ? " open" : ""}><summary>${esc(q)}${svg("i-down")}</summary><p>${esc(a)}</p></details>`).join("");

  /* Calculator */
  const ids = ["cAdr", "cNights", "cRent", "cRun"], el = Object.fromEntries(ids.map((k) => [k, $("#" + k)]));
  const out = { cAdr: $("#oAdr"), cNights: $("#oNights"), cRent: $("#oRent"), cRun: $("#oRun") };
  const cal = $("#calCal"); for (let i = 0; i < 31; i++) cal.append(document.createElement("i"));
  const UNITS = { 1: [8000, 20, 60000, 25000], 2: [12000, 20, 90000, 35000], 3: [16000, 18, 130000, 45000], h: [25000, 16, 200000, 70000] };
  const fill = (i) => i.style.setProperty("--p", ((i.value - i.min) / (i.max - i.min)) * 100 + "%");
  function calc() {
    ids.forEach((k) => { fill(el[k]); if (document.activeElement !== out[k]) out[k].value = k === "cNights" ? el[k].value : fmt(+el[k].value); });
    const adr = +el.cAdr.value, n = +el.cNights.value, rent = +el.cRent.value, run = +el.cRun.value;
    const rev = adr * n, fee = rev * 0.03, cost = rent + run, profit = rev - fee - cost;
    const be = Math.ceil(cost / (adr * 0.97));
    $("#rRev").textContent = fmt(rev); $("#rFee").textContent = "− " + fmt(fee); $("#rCost").textContent = "− " + fmt(cost);
    const p = $("#rProfit"); p.textContent = (profit < 0 ? "− " : "") + fmt(Math.abs(profit)); p.classList.toggle("neg", profit < 0); p.classList.toggle("grad", profit >= 0);
    $("#rBe").textContent = be > 31 ? "31+ raatein (loss)" : be + " raatein";
    [...cal.children].forEach((c, i) => c.classList.toggle("on", i < n));
    $$(".calc-quick button").forEach((b) => b.classList.toggle("on", +b.dataset.n === n));
  }
  const setUnit = (u) => { UNITS[u].forEach((v, i) => (el[ids[i]].value = v)); $$(".calc-units button").forEach((b) => b.classList.toggle("on", b.dataset.u === u)); calc(); };
  ids.forEach((k) => {
    const o = out[k];
    el[k].addEventListener("input", calc);
    o.addEventListener("focus", () => { o.value = el[k].value; setTimeout(() => o.select(), 0); });
    o.addEventListener("input", () => { if (!o.value.trim()) return; el[k].value = Math.min(+el[k].max, Math.max(+el[k].min, +o.value.replace(/[^0-9]/g, ""))); calc(); });
    o.addEventListener("blur", calc);
    o.addEventListener("keydown", (e) => { if (e.key === "Enter") o.blur(); });
  });
  $$(".calc-quick button").forEach((b) => b.addEventListener("click", () => { el.cNights.value = b.dataset.n; calc(); }));
  $$(".calc-units button").forEach((b) => b.addEventListener("click", () => setUnit(b.dataset.u)));
  setUnit("1");

  /* Header + floating bar */
  const onScroll = () => { $("#top").classList.toggle("scrolled", scrollY > 24); $("#mbar").classList.toggle("show", scrollY > innerHeight * 0.8); };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* Count-up stats + scroll reveal */
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return; const t = e.target; io.unobserve(t);
      if (t.dataset.count) {
        const end = +t.dataset.count, suf = t.dataset.suffix || "", t0 = performance.now();
        const step = (now) => { const k = Math.min(1, (now - t0) / 1400), v = Math.round(end * (1 - Math.pow(1 - k, 3))); t.textContent = v.toLocaleString("en-US") + suf; if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      } else t.classList.add("in");
    }), { threshold: 0.15 });
    $$("[data-count]").forEach((n) => io.observe(n));
    $$(".trk, .step, .calc, .mods, .inst .photo, .toolkit, .flow4 article, .protect div, .plan, .final, .gal figure").forEach((n) => { n.classList.add("rv"); io.observe(n); });
  }
})();
