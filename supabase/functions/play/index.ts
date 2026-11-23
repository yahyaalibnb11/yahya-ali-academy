// Returns signed HLS playlists for one video. Checks: logged in, enrolled (or free preview), and this is the student's active device.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { admin, cors, json, sign } from "../_shared/util.ts";

const FREE = new Set(["intro"]);
const RENDS = [{ name: "1080", bw: 2700000, res: "1920x1080" }, { name: "720", bw: 1450000, res: "1280x720" }, { name: "480", bw: 780000, res: "854x480" }];
const TTL = 4 * 3600;
const cache = new Map<string, { at: number; text: string }>();

async function playlist(slug: string, rend: string) {
  const k = `${slug}/${rend}`; const c = cache.get(k);
  if (c && Date.now() - c.at < 600_000) return c.text;
  const { data, error } = await admin.storage.from("hls").download(`${k}/index.m3u8`);
  if (error || !data) return null;
  const text = await data.text(); cache.set(k, { at: Date.now(), text }); return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization") || "";
  const user = (await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } }).auth.getUser()).data.user;
  if (!user) return json({ error: "login" }, 401);
  const { slug, device } = await req.json().catch(() => ({}));
  if (!/^[a-z0-9-]{1,40}$/.test(slug || "") || !device) return json({ error: "bad request" }, 400);

  const { data: chk } = await admin.rpc("svc_check", { p_user: user.id, p_device: device });
  const row = Array.isArray(chk) ? chk[0] : chk;
  if (!row?.device_ok) return json({ error: "device" }, 409);
  if (!row?.enrolled && !FREE.has(slug)) return json({ error: "locked" }, 403);
  admin.rpc("svc_log", { p_user: user.id, p_slug: slug, p_device: device, p_ip: req.headers.get("x-forwarded-for") || "" }).then(() => {});

  const exp = Math.floor(Date.now() / 1000) + TTL;
  const sig = await sign(`${slug}|${user.id}|${device}|${exp}`);
  const keyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/key?s=${slug}&u=${user.id}&d=${encodeURIComponent(device)}&e=${exp}&g=${sig}`;

  const variants = [];
  for (const r of RENDS) {
    const text = await playlist(slug, r.name);
    if (!text) continue;
    const segs = text.split("\n").filter((l) => l && !l.startsWith("#"));
    const { data: signed } = await admin.storage.from("hls").createSignedUrls(segs.map((s) => `${slug}/${r.name}/${s}`), TTL);
    const map = new Map((signed || []).map((x, i) => [segs[i], x.signedUrl]));
    const out = text.split("\n").map((l) => (l && !l.startsWith("#") ? map.get(l) || l : l.replace("KEYURI", keyUrl))).join("\n");
    variants.push({ ...r, playlist: out });
  }
  if (!variants.length) return json({ error: "not uploaded" }, 404);
  const { data: prof } = await admin.from("profiles").select("full_name, phone, email").eq("id", user.id).maybeSingle();
  return json({ variants, mark: { email: prof?.email || user.email, phone: prof?.phone || "", id: user.id.slice(0, 8) } });
});
