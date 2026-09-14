-- ============================================================
-- Migration 18: drop orphaned v1 timetables table (Step 12 cleanliness)
-- ============================================================
-- Background (Step 4 database schema audit, confirmed again in Step 12):
-- `public.timetables` was the original v1 timetable table. The app was
-- later rebuilt on `timetable_slots` (see migration-academy-suite-v2.sql,
-- which explicitly says "`timetables` table is left untouched; the app
-- now uses `timetable_slots`"). A repo-wide grep of src/ confirms zero
-- references to `timetables` anywhere in application code — only the
-- unused table/policy definitions remain in schema.sql and
-- migration-academy-suite.sql.
--
-- BEFORE RUNNING: verify there is genuinely no data worth keeping.
-- Run this check in the Supabase SQL Editor first:
--
--   select count(*) from public.timetables;
--
-- If the count is 0, proceed below. If it is NOT 0, STOP — export the
-- rows first (e.g. `copy (select * from public.timetables) to stdout
-- csv header` via psql, or download from the Table Editor) before
-- dropping, and re-confirm with the product owner that the data is
-- genuinely unused.
--
-- Rollback: table structure is captured in git history (see schema.sql
-- before this migration, and migration-academy-suite.sql). To recreate
-- an empty table, re-run the `create table public.timetables (...)` and
-- policy statements from migration-academy-suite.sql lines 7-104. Data
-- cannot be rolled back once dropped -- hence the row-count check above.
-- ------------------------------------------------------------

begin;

drop table if exists public.timetables cascade;

commit;
