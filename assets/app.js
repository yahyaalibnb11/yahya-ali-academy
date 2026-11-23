/* Shared client: Supabase, device id, helpers. Used by portal.html and admin.html. */
const A = window.ACADEMY;
const DEVICE = (() => {
  const k = "ya_device_v2";
  try {
    let v = localStorage.getItem(k);
    if (!v) { v = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); localStorage.setItem(k, v); }
    return v;
  } catch { return "nostore-" + Math.random().toString(36).slice(2); }
})();
const sb = supabase.createClient(A.supabaseUrl, A.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "ya-academy-auth" },
});
function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  return `${br} on ${os}`;
}
function toast(msg, ms = 2800) {
  const t = document.createElement("div");
  t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.append(t); setTimeout(() => t.remove(), ms);
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rs = (n) => "Rs " + Number(n).toLocaleString("en-US");
const fmtDate = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });
async function fn(name, body) {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${A.supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: A.supabaseKey, Authorization: `Bearer ${session?.access_token || A.supabaseKey}` },
    body: JSON.stringify(body || {}),
  });
  let data = null; try { data = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, data };
}
