import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device, x-upload-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
let hmacKey: CryptoKey | null = null;
async function key() {
  if (hmacKey) return hmacKey;
  const { data } = await admin.rpc("acad_svc_setting", { p_k: "hmac" });
  hmacKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(data)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hmacKey;
}
async function sign(msg: string) {
  const s = await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Admin upload tool for HLS files, video keys and toolkit files. Protected by the upload secret stored in academy_private.settings.
let secret: string | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!secret) secret = String((await admin.rpc("acad_svc_setting", { p_k: "upload_secret" })).data || "");
  if (!secret || secret === "null" || req.headers.get("x-upload-secret") !== secret) { secret = null; return json({ error: "denied" }, 403); }
  const q = new URL(req.url).searchParams;
  const bucket = q.get("bucket") || "acad-hls", path = q.get("path") || "";
  if (q.get("key")) {
    const { error } = await admin.rpc("acad_svc_set_key", { p_slug: q.get("key"), p_hex: (await req.text()).trim() });
    return json({ ok: !error, error });
  }
  if (!["acad-hls", "acad-toolkit"].includes(bucket) || !/^[A-Za-z0-9._\/-]+$/.test(path) || path.includes("..")) return json({ error: "bad path" }, 400);
  const type = path.endsWith(".ts") ? "video/mp2t" : path.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : req.headers.get("content-type") || "application/octet-stream";
  const { error } = await admin.storage.from(bucket).upload(path, new Uint8Array(await req.arrayBuffer()), { contentType: type, upsert: true, cacheControl: "31536000" });
  return json({ ok: !error, error: error?.message });
});
