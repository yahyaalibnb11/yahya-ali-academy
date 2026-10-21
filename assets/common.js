/* Shared helpers for every page. */
const A = window.ACADEMY;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pkr = (n) => "Rs " + Number(n).toLocaleString("en-PK");
const svg = (id) => `<svg><use href="#${id}"/></svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const waLink = (msg) => `https://wa.me/${A.whatsapp}?text=${encodeURIComponent(msg)}`;
const pad2 = (n) => String(n).padStart(2, "0");

const nameOk = (v) => v.length >= 2;
const phoneOk = (v) => /^\+?[\d\s-]{10,18}$/.test(v) && v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 15;
const emailOk = (v) => !v || /^\S+@\S+\.\S+$/.test(v);
const emailReq = (v) => /^\S+@\S+\.\S+$/.test(v);
function validate(fields) {
  let ok = true;
  for (const [el, test] of fields) {
    const good = test(el.value.trim());
    el.closest(".field").classList.toggle("bad", !good);
    if (!good) ok = false;
  }
  return ok;
}

const METHOD_NAME = { bank: "Bank transfer", jazzcash: "JazzCash", easypaisa: "Easypaisa", intl: "International transfer" };
function acctHtml(method) {
  const rows = Object.entries(A.payments[method] || {}).filter(([, v]) => String(v).trim());
  return rows.length
    ? `<dl>${rows.map(([k, v]) => `<div><div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div><button type="button" class="copy" data-copy="${esc(v)}">Copy</button></div>`).join("")}</dl>`
    : `Message me on WhatsApp and I'll send the ${METHOD_NAME[method]} account details within minutes.`;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; } catch { getSelection().selectAllChildren(b.previousElementSibling); }
  setTimeout(() => (b.textContent = "Copy"), 1500);
});

/* Where the visitor came from (ads, Instagram bio…) */
function source() {
  const p = new URLSearchParams(location.search);
  const tags = ["utm_source", "utm_medium", "utm_campaign", "utm_content"].map((k) => p.get(k)).filter(Boolean);
  if (p.get("fbclid")) tags.push("facebook ad");
  if (p.get("ttclid")) tags.push("tiktok ad");
  return tags.join(" / ") || (document.referrer ? "referrer: " + document.referrer : "direct (Instagram bio / link)");
}
const makeRef = (pre) => pre + "-" + Date.now().toString(36).slice(-5).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();

/* Email to the inbox via FormSubmit (the very first message asks you to click "Activate" once). */
async function sendMail(subject, data) {
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${A.inboxEmail}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ _subject: subject, _template: "table", _captcha: "false", ...data, "Came from": source() }),
    });
    const j = await res.json().catch(() => ({}));
    return res.ok && String(j.success) !== "false";
  } catch { return false; }
}
/* Also keep a copy in the database (Admin → Messages). */
async function saveInquiry(row) {
  try {
    const res = await fetch(`${A.supabaseUrl}/rest/v1/inquiries`, {
      method: "POST",
      headers: { apikey: A.supabaseKey, Authorization: `Bearer ${A.supabaseKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    return res.ok;
  } catch { return false; }
}
function track(ev, params) { try { window.fbq && window.fbq("track", ev, params); } catch {} }

$$("[data-wa]").forEach((e) => (e.href = waLink(e.dataset.wa)));
$$("[data-wa-display]").forEach((e) => (e.textContent = A.whatsappDisplay));
$$("[data-yr]").forEach((e) => (e.textContent = new Date().getFullYear()));
