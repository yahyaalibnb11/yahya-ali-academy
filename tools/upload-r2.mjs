// Upload an encoded lesson's HLS files to Cloudflare R2 and store its AES key in the database.
// Usage: R2_ENDPOINT=https://<acct>.r2.cloudflarestorage.com R2_BUCKET=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... UPLOAD_SECRET=...
//        node tools/upload-r2.mjs <hls-dir-of-slug> <slug> <key-file> [renditions=720,480]
// Needs: npm i aws4fetch (in tools/ or globally). Playlists are uploaded last so a half-uploaded lesson is never served.
import fs from "node:fs"; import path from "node:path";
import { AwsClient } from "aws4fetch";
const [dir, slug, keyFile, rends = "720,480"] = process.argv.slice(2);
const { R2_ENDPOINT: EP, R2_BUCKET: B, R2_ACCESS_KEY_ID: AK, R2_SECRET_ACCESS_KEY: SK, UPLOAD_SECRET: S } = process.env;
const FN = process.env.FN_BASE || "https://dwfelduzybgtqbyuvlse.supabase.co/functions/v1/acad-upload";
if (!dir || !slug || !keyFile || !EP || !B || !AK || !SK || !S) { console.error("missing args/env, see header"); process.exit(1); }
const aws = new AwsClient({ accessKeyId: AK, secretAccessKey: SK, service: "s3", region: "auto" });
const url = (k) => `${EP.replace(/\/$/, "")}/${B}/${k}`;
async function retry(fn) { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i === 4) throw e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); } } }
async function put(k, body, type) {
  await retry(async () => {
    const r = await aws.fetch(url(k), { method: "PUT", body, headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" } });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  });
}
await retry(async () => {
  const r = await fetch(`${FN}?key=${slug}`, { method: "POST", headers: { "x-upload-secret": S, "content-type": "text/plain" }, body: fs.readFileSync(keyFile).toString("hex") });
  const j = await r.json(); if (!j.ok) throw new Error(JSON.stringify(j));
});
for (const r of rends.split(",")) {
  const d = path.join(dir, r), files = fs.readdirSync(d).filter((f) => f.endsWith(".ts")).sort();
  let n = 0; const queue = [...files];
  await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) { const f = queue.shift(); await put(`${slug}/${r}/${f}`, fs.readFileSync(path.join(d, f)), "video/mp2t"); n++; } }));
  await put(`${slug}/${r}/index.m3u8`, fs.readFileSync(path.join(d, "index.m3u8")), "application/vnd.apple.mpegurl");
  console.log("done", slug, r, files.length, "segments");
}
