-- ============================================================
-- Migration 10: force a password change on first login for
-- admin-created accounts
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 01-09.
--
-- Problem: the `create-user` Edge Function lets a super-admin set an
-- arbitrary temporary password for a new login (email + password, handed to
-- the person out-of-band). Nothing ever required that person to change it —
-- so the temp password, which the super-admin and anyone who saw it in
-- transit now knows, could remain the account's real password indefinitely.
-- See the engineering review, finding M6.
--
-- Fix: a `must_change_password` flag on the profile, set true whenever
-- create-user provisions a login, checked by the frontend on every login to
-- gate access behind a forced password-change screen until it's cleared.
--
-- Why a SECURITY DEFINER function instead of a "users can update their own
-- profile" RLS policy: row policies can't restrict which *columns* a user
-- may change (see migration 06's comment for the same reasoning applied to
-- collections) — a blanket self-update policy would let any user grant
-- themselves admin/can_view_financials by just writing to their own row.
-- A narrow function that can only ever flip this one column to false is
-- safe to expose to every authenticated user.
-- ------------------------------------------------------------

begin;

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

create or replace function public.clear_my_must_change_password()
returns void
language sql security definer set search_path = public
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

grant execute on function public.clear_my_must_change_password() to authenticated;

commit;

-- Frontend: src/components/ForcePasswordChange.jsx renders whenever
-- profile.must_change_password is true (checked in src/App.jsx, right
-- alongside the existing "waiting for approval" gate), calls
-- supabase.auth.updateUser({ password }) followed by this function via
-- supabase.rpc("clear_my_must_change_password"), then refreshes the profile.
-- supabase/functions/create-user/index.ts sets must_change_password: true on
-- every login it provisions. Existing logins created before this migration
-- default to false (not retroactively forced) since there's no way to
-- distinguish "never changed the temp password" from "chose their own" for
-- accounts that already exist — a super-admin can flip it for a specific
-- user directly in the Supabase table editor if needed.
