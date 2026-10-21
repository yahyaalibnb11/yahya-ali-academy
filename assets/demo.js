/* PREVIEW ONLY: a pretend backend so the student area and admin can be clicked through without a server. Not used on the live site. */
(() => {
  const K = "ya_demo_v1";
  const load = () => { try { return JSON.parse(sessionStorage.getItem(K)) || null; } catch { return null; } };
  const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const db = load() || {
    session: null,
    enrollments: [
      { id: "d1", user_id: "s1", email: "sara.khan@example.com", full_name: "Sara Khan", phone: "0301 2345678", city: "Lahore", country: "Pakistan", plan: "course", amount: 7000, pay_method: "jazzcash", payment_ref: "48213977", screenshot_path: "demo", status: "pending", created_at: ago(1) },
      { id: "d2", user_id: "s2", email: "usman.t@example.com", full_name: "Usman Tariq", phone: "+971 50 123 4567", city: "Dubai", country: "UAE", plan: "mentorship", amount: 100000, pay_method: "intl", payment_ref: null, screenshot_path: "demo", status: "approved", created_at: ago(26) },
    ],
    class_videos: [{ day: 1, video_url: "demo:1", resources: "Break-even sheet and checklist links appear here." }, { day: 2, video_url: "demo:2" }, { day: 3, video_url: "demo:3" }],
    class_progress: [],
    inquiries: [
      { id: "q1", kind: "consultation", name: "Ahmed Raza", phone: "03001234567", email: "", message: "I have a 2-bed flat in Bahria Town. Airbnb or long rent?", details: { slot: "Saturday 25 October at 3:00 PM", city: "Rawalpindi" }, created_at: ago(2) },
      { id: "q2", kind: "mentorship", name: "Hina Malik", phone: "+44 7700 900123", email: "hina@example.com", message: "Want to start co-hosting in Manchester.", details: { country: "UK", start: "Next week" }, created_at: ago(5) },
      { id: "q3", kind: "question", name: "Bilal", phone: "03211234567", message: "Is the course in Urdu?", details: {}, created_at: ago(9) },
    ],
    devices: {},
  };
  const save = () => { try { sessionStorage.setItem(K, JSON.stringify(db)); } catch {} };
  const isAdminPage = /admin/.test(location.pathname);
  if (isAdminPage && !db.session) db.session = { user: { id: "admin", email: A.inboxEmail, user_metadata: {} } };
  const tbl = (t) => (t === "active_devices" ? [] : t === "classes" ? [] : db[t] || (db[t] = []));
  const ok = (data) => Promise.resolve({ data, error: null });

  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = "select"; this.one = false; }
    select() { return this; } order() { return this; } limit() { return this; }
    eq(k, v) { this.f.push([k, v]); return this; }
    maybeSingle() { this.one = true; return this; } single() { this.one = true; return this; }
    insert(row) { this.op = "insert"; this.row = row; return this; }
    update(p) { this.op = "update"; this.row = p; return this; }
    upsert(row) { this.op = "upsert"; this.row = row; return this; }
    delete() { this.op = "delete"; return this; }
    run() {
      const uid = db.session?.user?.id;
      if (this.t === "active_devices") return { data: this.one ? { device_id: DEVICE } : [{ device_id: DEVICE }], error: null };
      let rows = tbl(this.t);
      const match = (r) => this.f.every(([k, v]) => r[k] === v);
      if (this.op === "insert") { const r = { id: "n" + Date.now(), user_id: uid, status: "pending", created_at: new Date().toISOString(), ...this.row }; rows.unshift(r); save(); return { data: r, error: null }; }
      if (this.op === "update") { rows.filter(match).forEach((r) => Object.assign(r, this.row)); save(); return { data: null, error: null }; }
      if (this.op === "upsert") { const r = { ...this.row }; const key = this.t === "class_progress" ? (x) => x.day === r.day : (x) => x.day === r.day; const i = rows.findIndex(key); i >= 0 ? (rows[i] = { ...rows[i], ...r }) : rows.push(r); save(); return { data: null, error: null }; }
      if (this.op === "delete") { db[this.t] = rows.filter((r) => !match(r)); save(); return { data: null, error: null }; }
      if (this.t === "enrollments" && !isAdminPage) rows = rows.filter((r) => r.user_id === uid);
      if (this.t === "class_videos" && !isAdminPage && !tbl("enrollments").some((r) => r.user_id === uid && r.status === "approved")) rows = [];
      rows = rows.filter(match);
      return { data: this.one ? rows[0] || null : rows, error: null };
    }
    then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
  }
  const shot = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#fff"/><rect width="300" height="70" fill="#d6001c"/><text x="150" y="45" font-family="Arial" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">JazzCash</text><text x="150" y="140" font-family="Arial" font-size="18" fill="#333" text-anchor="middle">Transaction successful</text><text x="150" y="200" font-family="Arial" font-size="36" font-weight="700" fill="#111" text-anchor="middle">Rs 7,000</text><text x="150" y="260" font-family="Arial" font-size="14" fill="#666" text-anchor="middle">TID 48213977</text><text x="150" y="290" font-family="Arial" font-size="14" fill="#666" text-anchor="middle">Sample screenshot</text></svg>`);
  window.supabase = {
    createClient: () => ({
      auth: {
        getSession: () => ok({ session: db.session }),
        signUp: ({ email, options }) => { db.session = { user: { id: "me", email, user_metadata: options?.data || {} } }; save(); return ok({ session: db.session, user: db.session.user }); },
        signInWithPassword: ({ email }) => { db.session = { user: { id: isAdminPage ? "admin" : "me", email, user_metadata: { full_name: "" } } }; save(); return ok({ session: db.session }); },
        signOut: () => { db.session = null; save(); return ok(null); },
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: (t) => new Q(t),
      rpc: (fn) => ok(fn === "is_admin" ? true : null),
      storage: { from: () => ({
        upload: () => ok({ path: "demo" }),
        createSignedUrl: () => ok({ signedUrl: shot }),
        createSignedUrls: (paths) => ok(paths.map((p) => ({ path: p, signedUrl: shot }))),
      }) },
    }),
  };
  window.DEMO = true;
  window.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);z-index:500;display:flex;gap:.6rem;align-items:center;padding:.55rem .6rem .55rem 1rem;border-radius:999px;background:#fff4e8;color:#17110d;font:600 .85rem/1.2 Inter,system-ui,sans-serif;box-shadow:0 20px 50px -15px rgba(0,0,0,.7);max-width:calc(100% - 2rem)";
    bar.innerHTML = `<span>Preview with sample data</span>` + (isAdminPage ? `<a href="portal.html" style="padding:.45rem .8rem;border-radius:999px;background:#17110d;color:#fff;text-decoration:none">Student view</a>` : `<button id="demo-approve" style="border:0;padding:.45rem .8rem;border-radius:999px;background:#22c55e;color:#fff;font-weight:700;cursor:pointer">Approve me</button><a href="admin.html" style="padding:.45rem .8rem;border-radius:999px;background:#17110d;color:#fff;text-decoration:none">Admin view</a>`);
    document.body.append(bar);
    bar.querySelector("#demo-approve")?.addEventListener("click", () => {
      if (!db.session) { db.session = { user: { id: "me", email: "you@example.com", user_metadata: { full_name: "Your Name" } } }; }
      const mine = db.enrollments.find((r) => r.user_id === "me");
      if (mine) mine.status = "approved";
      else db.enrollments.unshift({ id: "me1", user_id: "me", email: db.session.user.email, full_name: db.session.user.user_metadata.full_name || "Your Name", phone: "0300 1234567", city: "Islamabad", country: "Pakistan", plan: "course", amount: 7000, pay_method: "easypaisa", payment_ref: null, screenshot_path: "demo", status: "approved", created_at: new Date().toISOString() });
      save(); location.reload();
    });
  });
})();
