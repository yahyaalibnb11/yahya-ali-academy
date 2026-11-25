import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { AwsClient } from "npm:aws4fetch@1.0.20";
export const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device, x-upload-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
export const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
let hmacKey: CryptoKey | null = null;
async function key() {
  if (hmacKey) return hmacKey;
  const { data } = await admin.rpc("acad_svc_setting", { p_k: "hmac" });
  hmacKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(data)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hmacKey;
}
export async function sign(msg: string) {
  const s = await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns signed HLS playlists for one video. Checks: logged in, enrolled (or free preview), and this is the student's active device.

const FREE = new Set(["intro", "l-0-1", "l-0-2"]);
const RENDS = [{ name: "1080", bw: 2700000, res: "1920x1080" }, { name: "720", bw: 1450000, res: "1280x720" }, { name: "480", bw: 780000, res: "854x480" }];
const TTL = 4 * 3600;
const cache = new Map<string, { at: number; val: { text: string; src: "r2" | "sb" } }>();

// Videos live in Cloudflare R2 when it holds the lesson; otherwise in Supabase storage (acad-hls).
// R2 config (endpoint, bucket, key id, secret) is read from academy_private.settings like the other secrets.
let r2: AwsClient | null = null, R2_EP = "", R2_BUCKET = "", r2loaded = false;
async function loadR2() {
  if (r2loaded) return; r2loaded = true;
  const get = async (k: string) => String((await admin.rpc("acad_svc_setting", { p_k: k })).data || "");
  const [ep, b, id, sec] = await Promise.all(["r2_endpoint", "r2_bucket", "r2_key_id", "r2_secret"].map(get));
  if (ep && b && id && sec && ep !== "null") { R2_EP = ep; R2_BUCKET = b; r2 = new AwsClient({ accessKeyId: id, secretAccessKey: sec, service: "s3", region: "auto" }); }
}
const r2url = (k: string) => `${R2_EP.replace(/\/$/, "")}/${R2_BUCKET}/${k}`;
async function r2sign(k: string, ttl: number) {
  const u = new URL(r2url(k)); u.searchParams.set("X-Amz-Expires", String(ttl));
  return (await r2!.sign(u.toString(), { method: "GET", aws: { signQuery: true } })).url;
}

async function playlist(slug: string, rend: string): Promise<{ text: string; src: "r2" | "sb" } | null> {
  const k = `${slug}/${rend}`; const c = cache.get(k);
  if (c && Date.now() - c.at < 600_000) return c.val;
  let val: { text: string; src: "r2" | "sb" } | null = null;
  await loadR2();
  if (r2) {
    const r = await r2.fetch(r2url(`${k}/index.m3u8`)).catch(() => null);
    if (r?.ok) val = { text: await r.text(), src: "r2" };
  }
  if (!val) {
    const { data, error } = await admin.storage.from("acad-hls").download(`${k}/index.m3u8`);
    if (!error && data) val = { text: await data.text(), src: "sb" };
  }
  if (val) cache.set(k, { at: Date.now(), val });
  return val;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization") || "";
  const user = (await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } }).auth.getUser()).data.user;
  if (!user) return json({ error: "login" }, 401);
  const { slug, device } = await req.json().catch(() => ({}));
  if (!/^[a-z0-9-]{1,40}$/.test(slug || "") || !device) return json({ error: "bad request" }, 400);

  const { data: chk } = await admin.rpc("acad_svc_check", { p_user: user.id, p_device: device });
  const row = Array.isArray(chk) ? chk[0] : chk;
  if (!row?.device_ok) return json({ error: "device" }, 409);
  if (!row?.enrolled && !FREE.has(slug)) return json({ error: "locked" }, 403);
  admin.rpc("acad_svc_log", { p_user: user.id, p_slug: slug, p_device: device, p_ip: req.headers.get("x-forwarded-for") || "" }).then(() => {});

  const exp = Math.floor(Date.now() / 1000) + TTL;
  const sig = await sign(`${slug}|${user.id}|${device}|${exp}`);
  const keyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/acad-key?s=${slug}&u=${user.id}&d=${encodeURIComponent(device)}&e=${exp}&g=${sig}`;

  const variants = [];
  for (const r of RENDS) {
    const pl = await playlist(slug, r.name);
    if (!pl) continue;
    const text = pl.text;
    const segs = text.split("\n").filter((l) => l && !l.startsWith("#"));
    let map: Map<string, string>;
    if (pl.src === "r2") {
      map = new Map(await Promise.all(segs.map(async (s) => [s, await r2sign(`${slug}/${r.name}/${s}`, TTL)] as [string, string])));
    } else {
      const { data: signed } = await admin.storage.from("acad-hls").createSignedUrls(segs.map((s) => `${slug}/${r.name}/${s}`), TTL);
      map = new Map((signed || []).map((x, i) => [segs[i], x.signedUrl]));
    }
    const out = text.split("\n").map((l) => (l && !l.startsWith("#") ? map.get(l) || l : l.replace("KEYURI", keyUrl))).join("\n");
    variants.push({ ...r, playlist: out });
  }
  if (!variants.length) return json({ error: "not uploaded" }, 404);
  const { data: prof } = await admin.from("acad_profiles").select("full_name, phone, email").eq("id", user.id).maybeSingle();
  return json({ variants, mark: { email: prof?.email || user.email, phone: prof?.phone || "", id: user.id.slice(0, 8) } });
});
