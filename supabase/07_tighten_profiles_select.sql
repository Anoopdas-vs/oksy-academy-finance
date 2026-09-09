-- ============================================================
-- Migration 07: profiles roster is Owner-only, matching the app's model
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 01-06.
--
-- Problem: "profiles_admin_select_all" let any `admin` (not just
-- `super_admin`) read every user's name, email, role, approval state and
-- financial-access flag, via is_admin() (which covers both roles). The
-- app's own model reserves seeing/managing the user roster for the Owner
-- (super_admin) — the Staff Access / Users screen is hidden from plain
-- admins in the UI (src/lib/access.js: manageUsers: isSuperAdmin) — so the
-- database should enforce the same line. See the engineering review,
-- finding H4.
-- ------------------------------------------------------------

begin;

drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_super_admin_select_all" on public.profiles
  for select using (public.is_super_admin());

commit;

-- Note: "profiles_self_select" (id = auth.uid()) is untouched, so every
-- user can still read their own profile row — that's what AuthContext.jsx
-- relies on after sign-in and is unrelated to this fix.
