-- ============================================================
-- Migration 04: broaden staff access
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 03_admin_reports.sql — this
-- migration edits policies on public.batches and public.expense_categories,
-- both of which 03 is what creates.
--
-- Approved staff can now record & edit expenses, and create batches and
-- expense categories. Deleting still needs admin. Transfers / bank
-- reconciliation stay admin + financial-viewer only.
-- ------------------------------------------------------------

begin;

-- --- expenses: any approved user may see / add / edit ---------------
drop policy if exists "expenses_financial_viewer_select" on public.expenses;
drop policy if exists "expenses_admin_insert" on public.expenses;
drop policy if exists "expenses_admin_update" on public.expenses;

drop policy if exists "expenses_approved_select" on public.expenses;
create policy "expenses_approved_select" on public.expenses
  for select using (public.is_approved_user());
drop policy if exists "expenses_approved_insert" on public.expenses;
create policy "expenses_approved_insert" on public.expenses
  for insert with check (public.is_approved_user());
drop policy if exists "expenses_approved_update" on public.expenses;
create policy "expenses_approved_update" on public.expenses
  for update using (public.is_approved_user()) with check (public.is_approved_user());
-- delete stays admin-only (policy added in migration-admin-reports.sql)

-- --- batches: approved users may add / edit -----------------------
drop policy if exists "batches_admin_insert" on public.batches;
drop policy if exists "batches_admin_update" on public.batches;
drop policy if exists "batches_approved_insert" on public.batches;
create policy "batches_approved_insert" on public.batches
  for insert with check (public.is_approved_user());
drop policy if exists "batches_approved_update" on public.batches;
create policy "batches_approved_update" on public.batches
  for update using (public.is_approved_user()) with check (public.is_approved_user());

-- --- expense categories: approved users may add / rename --------
drop policy if exists "expense_categories_viewer_select" on public.expense_categories;
drop policy if exists "expense_categories_admin_insert" on public.expense_categories;
drop policy if exists "expense_categories_admin_update" on public.expense_categories;
drop policy if exists "expense_categories_approved_select" on public.expense_categories;
create policy "expense_categories_approved_select" on public.expense_categories
  for select using (public.is_approved_user());
drop policy if exists "expense_categories_approved_insert" on public.expense_categories;
create policy "expense_categories_approved_insert" on public.expense_categories
  for insert with check (public.is_approved_user());
drop policy if exists "expense_categories_approved_update" on public.expense_categories;
create policy "expense_categories_approved_update" on public.expense_categories
  for update using (public.is_approved_user()) with check (public.is_approved_user());

commit;
