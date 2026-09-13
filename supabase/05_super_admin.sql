-- ============================================================
-- Migration 05: Super Admin role + configurable access areas
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, last (no other migration depends on
-- this one, but this one doesn't depend on 03/04 either — it only touches
-- profiles, collections and app_settings).
--
--   super_admin  → everything, incl. user management & access config
--   admin        → operational everything (add / edit / delete records,
--                  batches, categories) within the areas the super admin allows
--   staff        → can *enter* records only; no edit / delete
-- ------------------------------------------------------------

begin;

-- 1. allow the new role
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'admin', 'staff', 'student', 'faculty', 'professional'));

-- 2. is_admin() now covers super_admin too, so every existing admin-gated
--    policy keeps working for both.
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce(
    (select role in ('admin', 'super_admin') and is_approved
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce(
    (select role = 'super_admin' and is_approved
     from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 3. only the super admin manages user roles / approval / access
drop policy if exists "profiles_admin_update_all" on public.profiles;
drop policy if exists "profiles_super_admin_update_all" on public.profiles;
create policy "profiles_super_admin_update_all" on public.profiles
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- 4. fee collections become editable (delete policy already exists)
drop policy if exists "collections_admin_update" on public.collections;
create policy "collections_admin_update" on public.collections
  for update using (public.is_admin()) with check (public.is_admin());

-- 5. app settings — a single JSON row the super admin edits (which areas
--    each role may open, etc). Everyone approved can read it.
create table if not exists public.app_settings (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists "app_settings_approved_select" on public.app_settings;
create policy "app_settings_approved_select" on public.app_settings
  for select using (public.is_approved_user());
drop policy if exists "app_settings_super_admin_write" on public.app_settings;
create policy "app_settings_super_admin_write" on public.app_settings
  for update using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "app_settings_super_admin_insert" on public.app_settings;
create policy "app_settings_super_admin_insert" on public.app_settings
  for insert with check (public.is_super_admin());

-- 6. make the account owner the super admin (adjust the email if needed)
update public.profiles
   set role = 'super_admin', is_approved = true, can_view_financials = true
 where email = 'anoopdasvs@gmail.com';

commit;
