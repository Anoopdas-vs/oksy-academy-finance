-- ============================================================
-- Migration 13: expense_categories insert+update require staff+ (CRIT-1, 2 of 6)
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 12.

begin;

drop policy if exists "expense_categories_approved_insert" on public.expense_categories;
create policy "expense_categories_staff_insert" on public.expense_categories
  for insert with check (public.is_staff_or_admin());

drop policy if exists "expense_categories_approved_update" on public.expense_categories;
create policy "expense_categories_staff_update" on public.expense_categories
  for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

commit;

-- Not touched: expense_categories_approved_select (read stays open to any
-- approved user), expense_categories_admin_delete (already admin-only).
