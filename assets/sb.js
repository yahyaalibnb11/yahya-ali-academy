/* Supabase client for the members area and admin. Each browser gets a device id; only the latest device that logged in can load videos. */
const DEVICE = (() => {
  const k = "ya_device";
  try {
    let v = localStorage.getItem(k);
    if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); localStorage.setItem(k, v); }
    return v;
  } catch { return "nostore-" + Math.random().toString(36).slice(2); }
})();
const sb = supabase.createClient(A.supabaseUrl, A.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { headers: { "x-device": DEVICE } },
});
function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  return `${br} on ${os}`;
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}
const fmtDate = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });

/* Turn a pasted video link into an embeddable player. */
function videoEmbed(url) {
  if (!url) return null;
  if (url.startsWith("demo:")) return { type: "demo" };
  let u; try { u = new URL(url.trim()); } catch { return null; }
  const h = u.hostname.replace(/^www\.|^m\./, "");
  let id;
  if (h === "youtu.be") id = u.pathname.slice(1);
  else if (h.endsWith("youtube.com") || h.endsWith("youtube-nocookie.com")) id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
  if (id) return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&fs=0&iv_load_policy=3&playsinline=1&disablekb=1` };
  if (h === "vimeo.com" || h === "player.vimeo.com") {
    const parts = u.pathname.split("/").filter(Boolean).filter((p) => p !== "video");
    const vid = parts[0], hash = u.searchParams.get("h") || parts[1];
    return { type: "iframe", src: `https://player.vimeo.com/video/${vid}?${hash ? "h=" + hash + "&" : ""}title=0&byline=0&portrait=0&dnt=1` };
  }
  if (h === "drive.google.com") {
    const m = u.pathname.match(/\/d\/([^/]+)/); const did = m ? m[1] : u.searchParams.get("id");
    if (did) return { type: "iframe", src: `https://drive.google.com/file/d/${did}/preview` };
  }
  if (h.endsWith("mediadelivery.net") || h.endsWith("b-cdn.net") && u.pathname.includes("/embed/")) return { type: "iframe", src: url };
  if (/\.(mp4|webm|m3u8|mov)(\?|$)/i.test(u.pathname)) return { type: "video", src: url };
  return { type: "iframe", src: url };
}
