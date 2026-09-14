-- ============================================================
-- Migration 16: expenses insert requires staff+, edit admin-only (CRIT-1, 5 of 6)
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 12.
--
-- Per the agreed access model: Owner/Admin/Staff can record expenses;
-- only Owner/Admin may edit or delete them once recorded.

begin;

drop policy if exists "expenses_approved_insert" on public.expenses;
create policy "expenses_staff_insert" on public.expenses
  for insert with check (public.is_staff_or_admin());

drop policy if exists "expenses_approved_update" on public.expenses;
create policy "expenses_admin_update" on public.expenses
  for update using (public.is_admin()) with check (public.is_admin());

commit;

-- Not touched: expenses_approved_select, expenses_admin_delete (already
-- admin-only).
