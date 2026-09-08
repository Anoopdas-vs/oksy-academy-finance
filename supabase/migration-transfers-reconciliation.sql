-- ============================================================
-- Migration: Transfers + Bank Reconciliation
-- ============================================================
-- Run ONCE in the Supabase SQL Editor (after migration-healthcare-account.sql).
--
-- Adds:
--   * transfers            — money moved between accounts (not income/expense)
--   * bank_statements      — one row per uploaded statement
--   * bank_statement_lines — every line of an uploaded statement + match state
-- ------------------------------------------------------------

begin;

create table if not exists public.transfers (
  id bigint generated always as identity primary key,
  date date not null,
  from_account text not null check (from_account in ('HDFC', 'ICICI', 'Cash', 'Healthcare')),
  to_account   text not null check (to_account   in ('HDFC', 'ICICI', 'Cash', 'Healthcare')),
  amount numeric not null check (amount > 0),
  purpose text,
  reference text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  constraint transfers_distinct_accounts check (from_account <> to_account)
);

alter table public.transfers enable row level security;
create index if not exists transfers_date_idx on public.transfers (date);

drop policy if exists "transfers_financial_viewer_select" on public.transfers;
create policy "transfers_financial_viewer_select" on public.transfers
  for select using (public.can_view_financials());
drop policy if exists "transfers_admin_insert" on public.transfers;
create policy "transfers_admin_insert" on public.transfers
  for insert with check (public.is_admin());
drop policy if exists "transfers_admin_update" on public.transfers;
create policy "transfers_admin_update" on public.transfers
  for update using (public.is_admin()) with check (public.is_admin());

create table if not exists public.bank_statements (
  id bigint generated always as identity primary key,
  account text not null check (account in ('HDFC', 'ICICI', 'Cash')),
  period_start date,
  period_end date,
  opening_balance numeric,
  closing_balance numeric,
  file_name text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.bank_statements enable row level security;
drop policy if exists "bank_statements_financial_viewer_select" on public.bank_statements;
create policy "bank_statements_financial_viewer_select" on public.bank_statements
  for select using (public.can_view_financials());
drop policy if exists "bank_statements_admin_insert" on public.bank_statements;
create policy "bank_statements_admin_insert" on public.bank_statements
  for insert with check (public.is_admin());
drop policy if exists "bank_statements_admin_update" on public.bank_statements;
create policy "bank_statements_admin_update" on public.bank_statements
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "bank_statements_admin_delete" on public.bank_statements;
create policy "bank_statements_admin_delete" on public.bank_statements
  for delete using (public.is_admin());

create table if not exists public.bank_statement_lines (
  id bigint generated always as identity primary key,
  statement_id bigint not null references public.bank_statements (id) on delete cascade,
  account text not null check (account in ('HDFC', 'ICICI', 'Cash')),
  seq int,
  txn_date date not null,
  description text,
  reference text,
  withdrawal numeric not null default 0,
  deposit numeric not null default 0,
  running_balance numeric,
  status text not null default 'unmatched'
    check (status in ('unmatched', 'matched', 'classified', 'ignored')),
  match_kind text check (match_kind in ('collection', 'expense', 'transfer')),
  match_id bigint,
  matched_at timestamptz,
  matched_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.bank_statement_lines enable row level security;
create index if not exists bank_statement_lines_statement_idx
  on public.bank_statement_lines (statement_id);

drop policy if exists "bank_statement_lines_financial_viewer_select" on public.bank_statement_lines;
create policy "bank_statement_lines_financial_viewer_select" on public.bank_statement_lines
  for select using (public.can_view_financials());
drop policy if exists "bank_statement_lines_admin_insert" on public.bank_statement_lines;
create policy "bank_statement_lines_admin_insert" on public.bank_statement_lines
  for insert with check (public.is_admin());
drop policy if exists "bank_statement_lines_admin_update" on public.bank_statement_lines;
create policy "bank_statement_lines_admin_update" on public.bank_statement_lines
  for update using (public.is_admin()) with check (public.is_admin());

commit;
