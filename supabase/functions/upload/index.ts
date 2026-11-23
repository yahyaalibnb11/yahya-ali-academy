// Admin upload tool for HLS files, video keys and toolkit files. Protected by the upload secret stored in private.settings.
import { admin, cors, json } from "../_shared/util.ts";
let secret: string | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!secret) secret = String((await admin.rpc("svc_setting", { p_k: "upload_secret" })).data || "");
  if (!secret || req.headers.get("x-upload-secret") !== secret) return json({ error: "denied" }, 403);
  const q = new URL(req.url).searchParams;
  const bucket = q.get("bucket") || "hls", path = q.get("path") || "";
  if (q.get("key")) {
    const { error } = await admin.rpc("svc_set_key", { p_slug: q.get("key"), p_hex: (await req.text()).trim() });
    return json({ ok: !error, error });
  }
  if (!["hls", "toolkit"].includes(bucket) || !/^[A-Za-z0-9._\/-]+$/.test(path) || path.includes("..")) return json({ error: "bad path" }, 400);
  const type = path.endsWith(".ts") ? "video/mp2t" : path.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : req.headers.get("content-type") || "application/octet-stream";
  const { error } = await admin.storage.from(bucket).upload(path, new Uint8Array(await req.arrayBuffer()), { contentType: type, upsert: true, cacheControl: "31536000" });
  return json({ ok: !error, error: error?.message });
});
