-- ============================================================
-- Migration 17: collections insert requires staff+ (CRIT-1, 6 of 6)
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 12.
--
-- collections_admin_update / collections_admin_delete are already
-- admin-only (migration/schema.sql, unchanged) — this migration only
-- closes the insert gap.

begin;

drop policy if exists "collections_approved_insert" on public.collections;
create policy "collections_staff_insert" on public.collections
  for insert with check (public.is_staff_or_admin());

commit;
