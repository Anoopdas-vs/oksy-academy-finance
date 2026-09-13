-- ============================================================
-- Migration 08: drop the orphaned income table
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 01-07.
--
-- public.income was for an "other Academy income" feature that was removed
-- from the frontend — nothing in src/lib/data.js, any page, any report, or
-- bank reconciliation's match_kind ('collection' | 'expense' | 'transfer',
-- never 'income') reads or writes it any more. See the engineering review,
-- finding H5.
--
-- IMPORTANT — run the check below FIRST. If it returns any rows, export
-- them (e.g. Table Editor -> income -> Export as CSV) before running the
-- `drop table` below, since this migration does not back anything up.
--
--   select * from public.income;
--
-- ------------------------------------------------------------

begin;

drop table if exists public.income;
-- income's own policies (income_financial_viewer_select, income_admin_insert,
-- income_admin_update) and its date index are dropped automatically with it.

commit;
