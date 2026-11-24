// Student signup without email confirmation: creates a confirmed account so the student can log in at once.
// Access to paid lessons still depends on an approved payment, so a confirmed email is not needed for security.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const hits = new Map<string, number[]>(); // simple per-IP limit: 5 signups / 10 min per instance

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 600_000);
  if (list.length >= 5) return json({ error: "too_many" }, 429);
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase(), password = String(b.password || "");
  const name = String(b.name || "").trim().slice(0, 80), phone = String(b.phone || "").replace(/[^\d+]/g, "").slice(0, 16);
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) || email.length > 120) return json({ error: "email" }, 400);
  if (password.length < 6 || password.length > 72) return json({ error: "password" }, 400);
  if (name.length < 2 || phone.replace(/\D/g, "").length < 10) return json({ error: "details" }, 400);
  list.push(now); hits.set(ip, list);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, phone, app: "academy" } });
  if (error) return json({ error: /already|registered|exists/i.test(error.message) ? "exists" : "failed" }, error.status === 422 ? 409 : 400);
  await admin.from("acad_profiles").upsert({ id: data.user.id, email, full_name: name, phone });
  return json({ ok: true });
});
