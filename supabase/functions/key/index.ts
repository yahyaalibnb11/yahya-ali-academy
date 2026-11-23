// Hands out the AES-128 key for a video only to a valid, unexpired, signed request from the student's active device.
import { admin, cors, sign } from "../_shared/util.ts";
const deny = (s: number) => new Response("denied", { status: s, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const q = new URL(req.url).searchParams;
  const [s, u, d, e, g] = ["s", "u", "d", "e", "g"].map((k) => q.get(k) || "");
  if (!s || !u || !d || !e || !g || Number(e) < Date.now() / 1000) return deny(403);
  if ((await sign(`${s}|${u}|${d}|${e}`)) !== g) return deny(403);
  const { data: chk } = await admin.rpc("svc_check", { p_user: u, p_device: d });
  const row = Array.isArray(chk) ? chk[0] : chk;
  if (!row?.device_ok || (!row?.enrolled && s !== "intro")) return deny(409);
  const { data: hex } = await admin.rpc("svc_key", { p_slug: s });
  if (!hex) return deny(404);
  const bytes = new Uint8Array(String(hex).match(/../g)!.map((h) => parseInt(h, 16)));
  return new Response(bytes, { headers: { ...cors, "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
});
