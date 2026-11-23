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

// Hands out the AES-128 key for a video only to a valid, unexpired, signed request from the student's active device.
const deny = (s: number) => new Response("denied", { status: s, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const q = new URL(req.url).searchParams;
  const [s, u, d, e, g] = ["s", "u", "d", "e", "g"].map((k) => q.get(k) || "");
  if (!s || !u || !d || !e || !g || Number(e) < Date.now() / 1000) return deny(403);
  if ((await sign(`${s}|${u}|${d}|${e}`)) !== g) return deny(403);
  const { data: chk } = await admin.rpc("acad_svc_check", { p_user: u, p_device: d });
  const row = Array.isArray(chk) ? chk[0] : chk;
  if (!row?.device_ok || (!row?.enrolled && s !== "intro")) return deny(409);
  const { data: hex } = await admin.rpc("acad_svc_key", { p_slug: s });
  if (!hex) return deny(404);
  const bytes = new Uint8Array(String(hex).match(/../g)!.map((h) => parseInt(h, 16)));
  return new Response(bytes, { headers: { ...cors, "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
});
