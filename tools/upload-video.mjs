// Upload an encoded lesson (tools/encode-lesson.sh output) to the course storage.
// Usage: UPLOAD_SECRET=... node tools/upload-video.mjs <hls-dir-of-slug> <slug> <key-file> [renditions=720,480]
import fs from "node:fs"; import path from "node:path";
const [dir, slug, keyFile, rends = "720,480"] = process.argv.slice(2);
const BASE = process.env.FN_BASE || "https://dwfelduzybgtqbyuvlse.supabase.co/functions/v1/acad-upload";
const S = process.env.UPLOAD_SECRET;
if (!dir || !slug || !keyFile || !S) { console.error("usage: UPLOAD_SECRET=... node upload-video.mjs <dir> <slug> <keyfile> [720,480]"); process.exit(1); }
async function put(q, body, type = "application/octet-stream") {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${BASE}?${q}`, { method: "POST", headers: { "x-upload-secret": S, "content-type": type }, body });
      const j = await r.json(); if (j.ok) return; throw new Error(JSON.stringify(j));
    } catch (e) { if (i === 4) throw e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
}
await put(`key=${slug}`, fs.readFileSync(keyFile).toString("hex"), "text/plain");
for (const r of rends.split(",")) {
  const d = path.join(dir, r), files = fs.readdirSync(d).filter((f) => f.endsWith(".ts")).sort();
  let n = 0; const queue = [...files];
  await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) { const f = queue.shift(); await put(`path=${slug}/${r}/${f}`, fs.readFileSync(path.join(d, f))); if (++n % 20 === 0) console.log(slug, r, n, "/", files.length); } }));
  await put(`path=${slug}/${r}/index.m3u8`, fs.readFileSync(path.join(d, "index.m3u8")), "application/vnd.apple.mpegurl"); // playlist last
  console.log("done", slug, r, files.length, "segments");
}
