-- ============================================================
-- Migration 12: is_staff_or_admin() helper (CRIT-1 fix, part 1 of 6)
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 01-11.
--
-- Problem (CRIT-1, engineering review): the insert/update policies on
-- expense_categories, batches, students, expenses and collections all use
-- is_approved_user() — which only checks is_approved, not role. Any
-- APPROVED user, including 'student', 'faculty' and 'professional' logins
-- (which now exist for the Academy Suite screens), can therefore call the
-- Supabase REST API directly and insert or edit fee collections, expenses,
-- student fee amounts, batches and expense categories — even though the
-- UI never shows them these screens (see DEFAULT_ROLE_AREAS in
-- src/lib/access.js). Financial records are forgeable by design today.
--
-- Fix: add a role-aware helper that mirrors the app's own
-- `isStaffOrAdmin` concept in src/lib/access.js (Executive tier and
-- above), then use it to gate INSERT on the financial/master tables in
-- migrations 13-17.
-- ------------------------------------------------------------

begin;

create or replace function public.is_staff_or_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce(
    (select is_approved and role in ('super_admin', 'admin', 'staff')
     from public.profiles where id = auth.uid()),
    false
  );
$$;

commit;
