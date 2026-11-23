-- Yahya Ali Academy (lives inside the ember-os project, everything prefixed acad_ / academy_private): recorded course platform (auth, paid access, protected HLS video, one active device)
create schema if not exists academy_private;

create table if not exists public.acad_profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text, phone text, email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.acad_enrollments (
  user_id uuid primary key references auth.users on delete cascade,
  status text not null default 'active' check (status in ('active','revoked')),
  source text not null default 'manual',      -- manual | safepay | jazzcash | easypaisa | free
  amount integer, granted_at timestamptz not null default now()
);

create table if not exists public.acad_payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  method text not null,                       -- bank | jazzcash | easypaisa | gateway
  amount integer not null,
  txn_ref text, proof_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  created_at timestamptz not null default now(), reviewed_at timestamptz
);

create table if not exists public.acad_progress (
  user_id uuid references auth.users on delete cascade,
  lesson text not null, position real default 0, done boolean default false,
  updated_at timestamptz default now(),
  primary key (user_id, lesson)
);

-- one active device per student: latest login wins
create table if not exists academy_private.active_device (
  user_id uuid primary key, device text not null, label text, updated_at timestamptz default now()
);
create table if not exists academy_private.video_keys (slug text primary key, key bytea not null);
create table if not exists academy_private.settings (k text primary key, v text not null);
create table if not exists academy_private.access_log (
  id bigint generated always as identity primary key,
  user_id uuid, slug text, device text, ip text, at timestamptz default now()
);

alter table public.acad_profiles enable row level security;
alter table public.acad_enrollments enable row level security;
alter table public.acad_payments enable row level security;
alter table public.acad_progress enable row level security;
revoke all on schema academy_private from anon, authenticated;

create or replace function public.acad_is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from public.acad_profiles where id = auth.uid()), false) $$;

create policy "own profile read" on public.acad_profiles for select using (id = auth.uid() or public.acad_is_admin());
create policy "own enrollment" on public.acad_enrollments for select using (user_id = auth.uid() or public.acad_is_admin());
create policy "admin enrollments" on public.acad_enrollments for all using (public.acad_is_admin()) with check (public.acad_is_admin());
create policy "own payments read" on public.acad_payments for select using (user_id = auth.uid() or public.acad_is_admin());
create policy "own payments insert" on public.acad_payments for insert with check (user_id = auth.uid() and status = 'pending');
create policy "admin payments" on public.acad_payments for update using (public.acad_is_admin());
create policy "own progress" on public.acad_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- profile row is created by the portal on first login (no trigger on auth.users, so other apps in this project are untouched)
create or replace function public.acad_ensure_profile(p_name text, p_phone text) returns void language sql security definer set search_path = public as $$
  insert into public.acad_profiles (id, email, full_name, phone)
  select auth.uid(), (select email from auth.users where id = auth.uid()), nullif(p_name, ''), nullif(p_phone, '')
  where auth.uid() is not null
  on conflict (id) do update set full_name = coalesce(excluded.full_name, acad_profiles.full_name), phone = coalesce(excluded.phone, acad_profiles.phone);
$$;
revoke execute on function public.acad_ensure_profile from public, anon;

-- device claim: called right after login; returns nothing. Older devices lose video access.
create or replace function public.acad_claim_device(p_device text, p_label text) returns void language sql security definer set search_path = public, academy_private as $$
  insert into academy_private.active_device (user_id, device, label, updated_at) values (auth.uid(), p_device, p_label, now())
  on conflict (user_id) do update set device = excluded.device, label = excluded.label, updated_at = now();
$$;
create or replace function public.acad_my_device() returns text language sql stable security definer set search_path = public, academy_private as
$$ select device from academy_private.active_device where user_id = auth.uid() $$;

-- admin actions
create or replace function public.acad_approve_payment(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
declare r public.acad_payments;
begin
  if not public.acad_is_admin() then raise exception 'admin only'; end if;
  update public.acad_payments set status = 'approved', reviewed_at = now() where id = p_id returning * into r;
  insert into public.acad_enrollments (user_id, status, source, amount) values (r.user_id, 'active', r.method, r.amount)
  on conflict (user_id) do update set status = 'active', source = excluded.source, amount = excluded.amount, granted_at = now();
end $$;
create or replace function public.acad_reject_payment(p_id bigint, p_note text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.acad_is_admin() then raise exception 'admin only'; end if;
  update public.acad_payments set status = 'rejected', note = p_note, reviewed_at = now() where id = p_id;
end $$;
create or replace function public.acad_set_access(p_user uuid, p_active boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.acad_is_admin() then raise exception 'admin only'; end if;
  insert into public.acad_enrollments (user_id, status, source) values (p_user, case when p_active then 'active' else 'revoked' end, 'manual')
  on conflict (user_id) do update set status = excluded.status;
end $$;
create or replace function public.acad_reset_device(p_user uuid) returns void language plpgsql security definer set search_path = public, academy_private as $$
begin
  if not public.acad_is_admin() then raise exception 'admin only'; end if;
  delete from academy_private.active_device where user_id = p_user;
end $$;
create or replace function public.acad_admin_students() returns table (id uuid, email text, full_name text, phone text, created_at timestamptz, status text, device text, last_seen timestamptz)
language sql stable security definer set search_path = public, academy_private as $$
  select p.id, p.email, p.full_name, p.phone, p.created_at, e.status, d.label, d.updated_at
  from public.acad_profiles p left join public.acad_enrollments e on e.user_id = p.id left join academy_private.active_device d on d.user_id = p.id
  where public.acad_is_admin() order by p.created_at desc
$$;

revoke execute on function public.acad_approve_payment, public.acad_reject_payment, public.acad_set_access, public.acad_reset_device, public.acad_admin_students from public, anon;
revoke execute on function public.acad_claim_device, public.acad_my_device from public, anon;

-- storage: private buckets (videos are served only through the "play" edge function with short signed URLs)
insert into storage.buckets (id, name, public) values ('acad-hls', 'acad-hls', false), ('acad-proofs', 'acad-proofs', false), ('acad-toolkit', 'acad-toolkit', false)
on conflict (id) do nothing;
create policy "acad upload own proof" on storage.objects for insert to authenticated
  with check (bucket_id = 'acad-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "acad read proofs" on storage.objects for select to authenticated
  using (bucket_id = 'acad-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.acad_is_admin()));
create policy "acad enrolled read toolkit" on storage.objects for select to authenticated
  using (bucket_id = 'acad-toolkit' and exists (select 1 from public.acad_enrollments e where e.user_id = auth.uid() and e.status = 'active'));

-- service-only helpers used by edge functions (never callable from the browser)
create or replace function public.acad_svc_check(p_user uuid, p_device text) returns table (enrolled boolean, device_ok boolean)
language plpgsql security definer set search_path = public, academy_private as $$
declare cur text;
begin
  select device into cur from academy_private.active_device where user_id = p_user;
  if cur is null then
    insert into academy_private.active_device (user_id, device, label) values (p_user, p_device, 'auto') on conflict do nothing;
    cur := p_device;
  end if;
  return query select exists (select 1 from public.acad_enrollments e where e.user_id = p_user and e.status = 'active'), cur = p_device;
end $$;
create or replace function public.acad_svc_log(p_user uuid, p_slug text, p_device text, p_ip text) returns void language sql security definer set search_path = academy_private as
$$ insert into academy_private.access_log (user_id, slug, device, ip) values (p_user, p_slug, p_device, p_ip) $$;
create or replace function public.acad_svc_key(p_slug text) returns text language sql stable security definer set search_path = academy_private as
$$ select encode(key, 'hex') from academy_private.video_keys where slug = p_slug $$;
create or replace function public.acad_svc_set_key(p_slug text, p_hex text) returns void language sql security definer set search_path = academy_private as
$$ insert into academy_private.video_keys (slug, key) values (p_slug, decode(p_hex, 'hex')) on conflict (slug) do update set key = excluded.key $$;
create or replace function public.acad_svc_setting(p_k text) returns text language sql stable security definer set search_path = academy_private as
$$ select v from academy_private.settings where k = p_k $$;
create or replace function public.acad_svc_grant(p_user uuid, p_source text, p_amount int) returns void language sql security definer set search_path = public as $$
  insert into public.acad_enrollments (user_id, status, source, amount) values (p_user, 'active', p_source, p_amount)
  on conflict (user_id) do update set status = 'active', source = excluded.source, amount = excluded.amount, granted_at = now();
$$;
revoke execute on function public.acad_svc_check, public.acad_svc_log, public.acad_svc_key, public.acad_svc_set_key, public.acad_svc_setting, public.acad_svc_grant from public, anon, authenticated;
grant execute on function public.acad_svc_check, public.acad_svc_log, public.acad_svc_key, public.acad_svc_set_key, public.acad_svc_setting, public.acad_svc_grant to service_role;

-- secrets for signing key URLs and for the upload tool (random, generated in the database)
insert into academy_private.settings (k, v) values ('hmac', encode(extensions.gen_random_bytes(32), 'hex')), ('upload_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (k) do nothing;
update storage.buckets set file_size_limit = 6291456, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic'] where id = 'acad-proofs';
grant execute on function public.acad_ensure_profile, public.acad_claim_device, public.acad_my_device, public.acad_approve_payment, public.acad_reject_payment, public.acad_set_access, public.acad_reset_device, public.acad_admin_students to authenticated;
