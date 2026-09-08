-- ============================================================
-- Migration: Admin tab (batches, expense categories) + expense/transfer
--            edit & delete
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after the earlier migrations.
-- ------------------------------------------------------------

begin;

-- --- Batches --------------------------------------------------------
create table if not exists public.batches (
  id bigint generated always as identity primary key,
  name text not null unique,
  course_name text,
  course_fee numeric not null default 0,
  start_date date,
  end_date date,
  duration text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.batches enable row level security;

drop policy if exists "batches_approved_select" on public.batches;
create policy "batches_approved_select" on public.batches
  for select using (public.is_approved_user());
drop policy if exists "batches_admin_insert" on public.batches;
create policy "batches_admin_insert" on public.batches
  for insert with check (public.is_admin());
drop policy if exists "batches_admin_update" on public.batches;
create policy "batches_admin_update" on public.batches
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "batches_admin_delete" on public.batches;
create policy "batches_admin_delete" on public.batches
  for delete using (public.is_admin());

-- --- Expense categories -------------------------------------------
create table if not exists public.expense_categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.expense_categories enable row level security;

drop policy if exists "expense_categories_viewer_select" on public.expense_categories;
create policy "expense_categories_viewer_select" on public.expense_categories
  for select using (public.can_view_financials());
drop policy if exists "expense_categories_admin_insert" on public.expense_categories;
create policy "expense_categories_admin_insert" on public.expense_categories
  for insert with check (public.is_admin());
drop policy if exists "expense_categories_admin_update" on public.expense_categories;
create policy "expense_categories_admin_update" on public.expense_categories
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "expense_categories_admin_delete" on public.expense_categories;
create policy "expense_categories_admin_delete" on public.expense_categories
  for delete using (public.is_admin());

-- seed the categories the app shipped with
insert into public.expense_categories (name)
values ('Rent'), ('Salary'), ('Commission'), ('Electricity'), ('Internet'),
       ('Marketing'), ('Office Expense'), ('Travel'), ('Bank Charge'), ('Other')
on conflict (name) do nothing;

-- --- Expense edit / delete --------------------------------------
alter table public.expenses add column if not exists updated_at timestamptz;
alter table public.expenses add column if not exists updated_by uuid references public.profiles (id);

drop policy if exists "expenses_admin_delete" on public.expenses;
create policy "expenses_admin_delete" on public.expenses
  for delete using (public.is_admin());

-- --- Transfer edit / delete -----------------------------------
drop policy if exists "transfers_admin_delete" on public.transfers;
create policy "transfers_admin_delete" on public.transfers
  for delete using (public.is_admin());

-- --- Collection delete (admin only; used by reconciliation "unmatch") ---
drop policy if exists "collections_admin_delete" on public.collections;
create policy "collections_admin_delete" on public.collections
  for delete using (public.is_admin());

commit;
