-- ============================================================
-- Migration 19a: backfill missing batch master rows (Step 12, pre-req for 19)
-- ============================================================
-- Found while validating migration 19 (add FK students.batch ->
-- batches.name): 86 students reference 5 batch names that don't cleanly
-- match public.batches:
--
--   students.batch  | count | batches.name match
--   ----------------|-------|--------------------
--   BATCH 1         |   24  | 'Batch 1' exists but with different case
--   BATCH 2         |   25  | missing entirely
--   BATCH 3         |   14  | missing entirely
--   BATCH 4         |   10  | missing entirely
--   ONLINE B1       |   13  | missing entirely
--
-- Only BATCH 5 and BATCH 6 existed cleanly in both places. Confirmed with
-- the product owner 2026-09-14: BATCH 1-4 and ONLINE B1 are old/completed
-- batches (BATCH 5/6 are the current ones) - so they belong in the
-- batches master table, marked archived.
--
-- This is additive only: no student rows are changed, no batches are
-- removed. The 'Batch 1' -> 'BATCH 1' rename relies on the existing
-- `on update cascade` on public.profiles.batch_name (see
-- migration-academy-suite-v2.sql) so any profile already linked to
-- 'Batch 1' follows the rename automatically.
--
-- Rollback:
--   delete from public.batches where name in ('BATCH 2','BATCH 3','BATCH 4','ONLINE B1');
--   update public.batches set name = 'Batch 1' where name = 'BATCH 1';
-- ------------------------------------------------------------

begin;

update public.batches set name = 'BATCH 1' where name = 'Batch 1';

insert into public.batches (name, archived)
values
  ('BATCH 2', true),
  ('BATCH 3', true),
  ('BATCH 4', true),
  ('ONLINE B1', true)
on conflict (name) do nothing;

commit;
