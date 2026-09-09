-- ============================================================
-- Migration 01: "Healthcare" becomes a payment account
-- ============================================================
-- Run this ONCE in the Supabase SQL Editor on your existing project
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
--
-- Order: run the supabase/NN_*.sql files in NUMERIC order (01, 02, 03, ...).
-- This one has no dependency on the others and goes first. On a brand-new
-- project, skip all of these and run schema.sql instead — it already
-- contains everything these migrations add.
--
-- What it does:
--   * Preserves any historical rows that used the old paid_to / paid_by /
--     received_via columns to mark a Healthcare transaction, by copying
--     them into account = 'Healthcare' first (safe no-op if those columns
--     don't exist or nothing matches).
--   * Lets `account` be 'Healthcare' on collections, expenses and income.
--   * Drops the old party columns (paid_to / paid_by / received_via) and
--     rebuilds the masked `collections_basic` view without paid_to.
-- ------------------------------------------------------------

begin;

-- preserve any existing Healthcare-party rows before the columns go away
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='collections' and column_name='paid_to') then
    update public.collections set account = 'Healthcare' where paid_to = 'Healthcare' and account is distinct from 'Healthcare';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='expenses' and column_name='paid_by') then
    update public.expenses set account = 'Healthcare' where paid_by = 'Healthcare' and account is distinct from 'Healthcare';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='income' and column_name='received_via') then
    update public.income set account = 'Healthcare' where received_via = 'Healthcare' and account is distinct from 'Healthcare';
  end if;
end $$;

-- Drop the dependent view first, so the columns underneath it can be removed.
-- It is recreated (without paid_to) at the end.
drop view if exists public.collections_basic;

-- --- collections -------------------------------------------------------
alter table public.collections drop constraint if exists collections_account_check;
alter table public.collections
  add constraint collections_account_check
  check (account in ('HDFC', 'ICICI', 'Cash', 'Healthcare'));
alter table public.collections drop column if exists paid_to;

-- --- expenses ---------------------------------------------------------
alter table public.expenses drop constraint if exists expenses_account_check;
alter table public.expenses
  add constraint expenses_account_check
  check (account in ('HDFC', 'ICICI', 'Cash', 'Healthcare'));
alter table public.expenses drop column if exists paid_by;

-- --- income ----------------------------------------------------------
alter table public.income drop constraint if exists income_account_check;
alter table public.income
  add constraint income_account_check
  check (account in ('HDFC', 'ICICI', 'Cash', 'Healthcare'));
alter table public.income drop column if exists received_via;

-- --- rebuild the masked collections view (without paid_to) ----------
-- NOT security_invoker — see migration 06's comment for why that option
-- doesn't work for a column-masking view once the base table's columns are
-- locked down (which migration 06, run right after this one, does).
create view public.collections_basic
with (security_barrier = true)
as
select
  id,
  student_id,
  student_name,
  date,
  type,
  amount,
  reference,
  case
    when public.can_view_financials() or created_by = auth.uid() then account
    else null
  end as account
from public.collections
where public.is_approved_user();

grant select on public.collections_basic to authenticated;

commit;
