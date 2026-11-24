/* Student portal: auth, lessons, enrollment, toolkit. */
(() => {
  const $ = (s) => document.querySelector(s);
  const C = window.COURSE;
  const ALL = C.modules.flatMap((m) => m.lessons.map(([id, t, d, v]) => ({ id, t, d, v, m })));
  const S = { user: null, profile: null, enrolled: false, admin: false, progress: {}, pay: null, cur: null, loadedSlug: null, pollT: null };

  const show = (id) => {
    $("#auth").hidden = id !== "auth"; $("#app").hidden = id !== "app";
    const boot = $("#boot"); if (boot) { boot.style.opacity = 0; setTimeout(() => boot.remove(), 400); }
  };

  /* ---------- AUTH ---------- */
  function tab(which) {
    $("#tabLogin").setAttribute("aria-selected", which === "login"); $("#tabSignup").setAttribute("aria-selected", which === "signup");
    $("#fLogin").hidden = which !== "login"; $("#fSignup").hidden = which !== "signup"; authMsg("");
  }
  function authMsg(t, kind = "") { const m = $("#authMsg"); m.hidden = !t; m.className = "note " + kind; m.textContent = t; }
  $("#tabLogin").onclick = () => tab("login"); $("#tabSignup").onclick = () => tab("signup");
  const busy = (form, on) => form.querySelectorAll("button[type=submit]").forEach((b) => { b.disabled = on; b.dataset.t ??= b.textContent; b.textContent = on ? "Ruk jayein…" : b.dataset.t; });

  $("#fLogin").onsubmit = async (e) => {
    e.preventDefault(); busy(e.target, true);
    const { error } = await sb.auth.signInWithPassword({ email: $("#liEmail").value.trim(), password: $("#liPass").value });
    busy(e.target, false);
    if (error) return authMsg(/confirm/i.test(error.message) ? "Pehle apni email confirm karein (inbox ya spam check karein)." : "Email ya password ghalat hai.", "err");
    await afterLogin(true);
  };
  $("#fSignup").onsubmit = async (e) => {
    e.preventDefault(); busy(e.target, true);
    const name = $("#suName").value.trim(), phone = $("#suPhone").value.trim();
    const email = $("#suEmail").value.trim(), password = $("#suPass").value;
    const r = await fn("acad-signup", { name, phone, email, password });
    if (!r.ok) {
      busy(e.target, false);
      const er = r.data?.error;
      if (er === "exists") { tab("login"); $("#liEmail").value = email; return authMsg("Is email ka account pehle se bana hua hai. Apne password se login karein, ya \"Password bhool gaye?\" dabayein.", "err"); }
      return authMsg(er === "email" ? "Email sahi likhein." : er === "password" ? "Password kam az kam 6 characters ka ho." : er === "details" ? "Poora naam aur sahi WhatsApp number likhein." : er === "too_many" ? "Bohat zyada koshishein. 10 minute baad try karein." : "Account nahi bana. Internet check kar ke dobara try karein.", "err");
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    busy(e.target, false);
    if (error) { tab("login"); $("#liEmail").value = email; return authMsg("Account ban gaya. Ab login karein.", "ok"); }
    await afterLogin(true);
  };
  $("#forgot").onclick = async () => {
    const email = $("#liEmail").value.trim();
    if (!email) return authMsg("Pehle upar apni email likhein, phir dobara dabayein.", "err");
    await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    authMsg("Password reset link aap ki email pe bhej diya hai.", "ok");
  };

  async function afterLogin(fresh) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return show("auth");
    S.user = user;
    const md = user.user_metadata || {};
    await sb.rpc("acad_ensure_profile", { p_name: md.full_name || "", p_phone: md.phone || "" });
    if (fresh) await sb.rpc("acad_claim_device", { p_device: DEVICE, p_label: deviceLabel() });
    await loadState();
    show("app"); renderAll(); route();
  }
  async function loadState() {
    const uid = S.user.id;
    const [p, e, pr, pay] = await Promise.all([
      sb.from("acad_profiles").select("*").eq("id", uid).maybeSingle(),
      sb.from("acad_enrollments").select("status").eq("user_id", uid).maybeSingle(),
      sb.from("acad_progress").select("lesson, position, done").eq("user_id", uid),
      sb.from("acad_payments").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1),
    ]);
    S.profile = p.data || {}; S.admin = !!S.profile.is_admin;
    S.enrolled = e.data?.status === "active" || S.admin;
    S.progress = Object.fromEntries((pr.data || []).map((r) => [r.lesson, r]));
    S.pay = (pay.data || [])[0] || null;
  }

  /* ---------- APP ---------- */
  const status = (l) => (!l.v ? "soon" : S.enrolled || C.videos[l.v]?.free ? "avail" : "lock");
  function renderAll() {
    const name = S.profile.full_name || S.user.email.split("@")[0];
    $("#avatar").textContent = name.trim()[0]?.toUpperCase() || "S";
    $("#umName").textContent = name; $("#umEmail").textContent = S.user.email;
    $("#umAdmin").hidden = !S.admin;
    $("#topEnroll").hidden = S.enrolled; $("#upsell").hidden = S.enrolled;
    const chip = $("#accessChip"); chip.textContent = S.enrolled ? "Full access" : "Free preview"; chip.className = "chip " + (S.enrolled ? "ok" : "ember");
    renderSide(); renderProgress(); renderEnroll(); renderToolkit();
  }
  function renderProgress() {
    const done = ALL.filter((l) => S.progress[l.id]?.done).length, pct = Math.round((done / ALL.length) * 100);
    $("#progPct").textContent = pct + "%"; $("#progTxt").textContent = `${done} / ${ALL.length} lessons`;
    $("#progRing").setAttribute("stroke-dashoffset", 94.2 * (1 - done / ALL.length));
  }
  function renderSide() {
    const avail = ALL.filter((l) => l.v).length;
    $("#sideCount").textContent = `${avail} / ${ALL.length} live`;
    $("#sideList").innerHTML = C.modules.map((m) => {
      const open = S.cur ? S.cur.m === m : m.n <= 1;
      return `<div class="sm" data-open="${open}"><button type="button" aria-expanded="${open}"><span class="sm-t"><small>Module ${m.n}</small>${esc(m.title)}</span><span class="sm-c">${m.lessons.filter((l) => S.progress[l[0]]?.done).length}/${m.lessons.length}</span></button><ul>${m.lessons.map(([id, t, d, v]) => {
        const l = { id, v }, st = status(l), done = S.progress[id]?.done;
        const ic = done ? "✓" : st === "lock" ? "🔒" : st === "soon" ? "…" : "▶";
        return `<li><button type="button" class="sl ${st} ${done ? "done" : ""} ${S.cur?.id === id ? "cur" : ""}" data-l="${id}"><span class="sl-i">${ic}</span><span>${esc(t)}${st === "soon" ? ' <span class="sl-n">· jald</span>' : ""}</span><span class="sl-n">${id}</span></button></li>`;
      }).join("")}</ul></div>`;
    }).join("");
    $("#sideList").querySelectorAll(".sm > button").forEach((b) => (b.onclick = () => { const s = b.parentElement; const o = s.dataset.open !== "true"; s.dataset.open = o; b.setAttribute("aria-expanded", o); }));
    $("#sideList").querySelectorAll(".sl").forEach((b) => (b.onclick = () => { location.hash = "l-" + b.dataset.l.replace(".", "-"); closeSide(); }));
  }

  function openLesson(id) {
    const l = ALL.find((x) => x.id === id) || ALL[0];
    S.cur = l;
    $("#lessonView").hidden = false;
    $("#crumbs").innerHTML = `Module ${l.m.n} · ${esc(l.m.title)} · <b>Lesson ${l.id}</b>`;
    $("#lTitle").textContent = l.t; $("#lDesc").textContent = l.d;
    const hw = C.homework?.[l.id]; $("#hwBox").hidden = !hw; $("#hwText").textContent = hw || "";
    const vid = l.v && C.videos[l.v];
    $("#lCovers").innerHTML = vid && vid.covers.length > 1 ? `<span class="chip cool">Is video mein lessons ${vid.covers.join(", ")}</span>` : "";
    $("#doneBtn").classList.toggle("on", !!S.progress[l.id]?.done);
    $("#doneBtn").textContent = S.progress[l.id]?.done ? "✓ Mukammal" : "Mukammal mark karein";
    const st = status(l);
    if (st === "avail") {
      if (S.loadedSlug !== l.v) {
        S.loadedSlug = l.v;
        Player.load($("#stage"), l.v, { start: S.progress["v:" + l.v]?.position || 0, onTime: saveTime(l.v) });
      }
    } else {
      Player.destroy(); S.loadedSlug = null;
      $("#stage").innerHTML = st === "lock"
        ? `<div class="stage-empty"><div><span class="ic">🔒</span><h2>Ye lesson enrolled students ke liye hai</h2><p>Rs 5,000 mein poora course unlock karein. Payment confirm hote hi saare lessons khul jaate hain.</p><a class="btn btn-primary btn-sm" href="#enroll">Unlock course</a></div></div>`
        : `<div class="stage-empty"><div><span class="ic">◷</span><h2>Ye lesson jald aa raha hai</h2><p>Recording aur editing chal rahi hai. Upload hote hi yahin nazar aayega; aap ka access khud shamil hoga.</p></div></div>`;
    }
    renderSide();
    const i = ALL.indexOf(l);
    $("#prevBtn").disabled = i === 0; $("#nextBtn").disabled = i === ALL.length - 1;
    $("#prevBtn").onclick = () => (location.hash = "l-" + ALL[i - 1].id.replace(".", "-"));
    $("#nextBtn").onclick = () => (location.hash = "l-" + ALL[i + 1].id.replace(".", "-"));
  }
  $("#doneBtn").onclick = async () => { const l = S.cur; if (!l) return; await setDone([l.id], !S.progress[l.id]?.done); openLesson(l.id); };

  async function setDone(ids, done) {
    const rows = ids.map((id) => ({ user_id: S.user.id, lesson: id, done, updated_at: new Date().toISOString() }));
    ids.forEach((id) => (S.progress[id] = { ...(S.progress[id] || {}), done }));
    await sb.from("acad_progress").upsert(rows); renderProgress();
  }
  function saveTime(slug) {
    let last = 0, marked = false;
    return (t, d) => {
      if (Date.now() - last > 15000) { last = Date.now(); S.progress["v:" + slug] = { position: t }; sb.from("acad_progress").upsert({ user_id: S.user.id, lesson: "v:" + slug, position: t, updated_at: new Date().toISOString() }).then(() => {}); }
      if (!marked && d && t / d > 0.92) { marked = true; const c = C.videos[slug].covers.filter((id) => !S.progress[id]?.done); if (c.length) setDone(c, true).then(renderSide); }
    };
  }

  /* ---------- ENROLL ---------- */
  function renderEnroll() {
    const box = $("#enrollR");
    clearInterval(S.pollT);
    if (S.enrolled) { box.innerHTML = `<div class="status ok"><b>✓ Aap enrolled hain</b><p class="muted">Poora course aap ke account mein unlock hai. Naye lessons upload hote hi yahan aa jayenge.</p></div>`; return; }
    if (S.pay?.status === "pending") {
      box.innerHTML = `<div class="status pending"><b>Payment verify ho rahi hai</b><p class="muted">Aap ki payment (${esc(S.pay.method)}, ref ${esc(S.pay.txn_ref || "-")}) ${fmtDate(S.pay.created_at)} ko mili. Confirm hote hi ye page khud unlock ho jayega; refresh ki zaroorat nahi.</p></div>`;
      S.pollT = setInterval(async () => { await loadState(); if (S.enrolled) { toast("Course unlock ho gaya! Mubarak ho."); renderAll(); S.loadedSlug = null; route(); } }, 15000);
      return;
    }
    const methods = Object.entries(A.payments);
    const label = { jazzcash: "JazzCash", easypaisa: "Easypaisa", bank: "Bank transfer" };
    box.innerHTML = `
      ${S.pay?.status === "rejected" ? `<div class="note err">Pichli payment confirm nahi ho saki${S.pay.note ? ": " + esc(S.pay.note) : ""}. Dobara details bhejein.</div>` : ""}
      ${A.gateway ? `<button class="btn btn-primary" id="payOnline" type="button">Online pay karein (${esc(A.gateway.name)})</button><p class="fine" style="text-align:center">ya manual payment:</p>` : ""}
      <form class="stack" id="fPay">
        <div class="methods" role="radiogroup" aria-label="Payment method">${methods.map(([k], i) => `<label><input type="radio" name="m" value="${k}" ${i ? "" : "checked"}>${label[k] || k}</label>`).join("")}</div>
        <div class="acct" id="acct"></div>
        <div class="field"><label for="pRef">Transaction ID / reference</label><input class="input" id="pRef" required placeholder="Payment ke baad SMS/receipt wala ID"></div>
        <label class="file" for="pFile"><input type="file" id="pFile" accept="image/*" required><b>Payment screenshot upload karein</b><span id="pFileName">JPG ya PNG, 6MB tak</span></label>
        <button class="btn btn-primary" type="submit">Payment submit karein · ${rs(C.price)}</button>
        <p class="fine">Payment confirm hote hi course automatic unlock ho jata hai.</p>
      </form>`;
    const acct = () => {
      const k = box.querySelector("input[name=m]:checked").value, rows = Object.entries(A.payments[k]).filter(([, v]) => v);
      $("#acct").innerHTML = rows.length ? `<dl style="margin:0;display:grid;gap:8px">${rows.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd class="mono">${esc(b)}</dd></div>`).join("")}<div><dt>Amount</dt><dd class="mono">${rs(C.price)}</dd></div></dl>` : `<span class="muted">Account details jald yahan shamil hongi.</span>`;
    };
    box.querySelectorAll("input[name=m]").forEach((r) => (r.onchange = acct)); acct();
    $("#pFile").onchange = (e) => ($("#pFileName").textContent = e.target.files[0]?.name || "JPG ya PNG, 6MB tak");
    $("#fPay").onsubmit = async (e) => {
      e.preventDefault(); busy(e.target, true);
      const f = $("#pFile").files[0];
      if (f.size > 6 * 1024 * 1024) { busy(e.target, false); return toast("Screenshot 6MB se chhota hona chahiye."); }
      const path = `${S.user.id}/${Date.now()}.${(f.name.split(".").pop() || "jpg").toLowerCase()}`;
      const up = await sb.storage.from("acad-proofs").upload(path, f, { contentType: f.type });
      if (up.error) { busy(e.target, false); return toast("Upload nahi hua, dobara try karein."); }
      const { error } = await sb.from("acad_payments").insert({ user_id: S.user.id, method: box.querySelector("input[name=m]:checked").value, amount: C.price, txn_ref: $("#pRef").value.trim(), proof_path: path });
      busy(e.target, false);
      if (error) return toast("Submit nahi hua, dobara try karein.");
      await loadState(); renderEnroll(); toast("Payment mil gayi. Confirm hote hi course unlock ho jayega.");
    };
    if (A.gateway) $("#payOnline").onclick = async () => { const r = await fn(A.gateway.checkoutFn, {}); if (r.ok && r.data?.url) location.href = r.data.url; else toast("Online payment abhi available nahi."); };
  }

  /* ---------- TOOLKIT ---------- */
  function renderToolkit() {
    $("#tkList").innerHTML = C.toolkit.map(([f, t, k]) => `<div class="tk-item"><span class="tk-ic">${k === "Excel" ? "XLSX" : "PDF"}</span><div><b>${esc(t)}</b><span>${k}</span></div>${S.enrolled ? `<button class="btn btn-ghost btn-sm" data-f="${esc(f)}" type="button">Download</button>` : `<span class="chip">🔒</span>`}</div>`).join("");
    $("#tkList").querySelectorAll("[data-f]").forEach((b) => (b.onclick = async () => {
      const { data, error } = await sb.storage.from("acad-toolkit").createSignedUrl(b.dataset.f, 120, { download: true });
      if (error || !data) return toast("File abhi available nahi."); location.href = data.signedUrl;
    }));
  }

  /* ---------- ROUTER ---------- */
  function route() {
    const h = location.hash.slice(1);
    $("#enroll").hidden = !(h === "enroll" || !S.enrolled);
    $("#toolkit").hidden = !(h === "toolkit" || S.enrolled);
    let id = null;
    if (h.startsWith("l-")) id = h.slice(2).replace("-", ".");
    if (!id) id = S.cur?.id || (S.enrolled ? (ALL.find((l) => l.v && !S.progress[l.id]?.done) || ALL[0]).id : "0.1");
    openLesson(id);
    if (h === "enroll" || h === "toolkit") setTimeout(() => $("#" + h).scrollIntoView({ behavior: "smooth" }), 50);
    else if (h.startsWith("l-")) scrollTo({ top: 0, behavior: "smooth" });
  }
  addEventListener("hashchange", () => S.user && route());

  /* ---------- UI bits ---------- */
  const closeSide = () => { $("#side").classList.remove("open"); $("#scrim").hidden = true; };
  $("#menuBtn").onclick = () => { $("#side").classList.add("open"); $("#scrim").hidden = false; };
  $("#scrim").onclick = closeSide;
  $("#userBtn").onclick = (e) => { e.stopPropagation(); const m = $("#userMenu"); m.hidden = !m.hidden; $("#userBtn").setAttribute("aria-expanded", !m.hidden); };
  document.addEventListener("click", () => ($("#userMenu").hidden = true));
  $("#logout").onclick = async () => { Player.destroy(); await sb.auth.signOut(); location.hash = ""; location.reload(); };

  /* ---------- BOOT ---------- */
  (async () => {
    const want = location.hash.slice(1);
    const { data: { session } } = await sb.auth.getSession();
    if (session) return afterLogin(false);
    show("auth"); tab(want === "enroll" ? "signup" : "login");
    if (want === "preview" || want === "enroll") authMsg(want === "preview" ? "Free preview ke liye 30 second mein account banayein." : "Enroll karne ke liye pehle account banayein.", "");
  })();
  sb.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") { const p = window.prompt ? null : null; toast("Naya password set karne ke liye neeche form istemal karein."); } });
})();
