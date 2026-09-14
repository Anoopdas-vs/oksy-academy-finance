-- ============================================================
-- Migration 19: add missing FK constraints (Step 12 cleanliness)
-- ============================================================
-- Background (Step 4 database schema audit, confirmed again in Step 12):
-- `students.batch` (free text) and `expenses.category` (free text) are
-- meant to reference `batches.name` and `expense_categories.name`
-- respectively (the UI forms already populate them from those tables'
-- dropdowns), but no FK constraint enforces this at the database level.
-- Today a direct API/SQL insert (or a bug in a future feature) could
-- write a students.batch or expenses.category value that doesn't match
-- any real batch/category, silently breaking joins/reports.
--
-- BEFORE RUNNING: check for existing orphaned values in the Supabase SQL
-- Editor -- the ALTER TABLE will fail (and should) if any exist:
--
--   select distinct batch from public.students
--     where batch is not null
--       and batch not in (select name from public.batches);
--
--   select distinct category from public.expenses
--     where category not in (select name from public.expense_categories);
--
-- If either query returns rows, STOP. Those are pre-existing data
-- inconsistencies (e.g. a renamed/deleted batch or category, or a typo)
-- that must be fixed or reviewed with the product owner (either correct
-- the row, or add the missing batch/category) before the constraint can
-- be added. Do not silently delete or rewrite historical financial/
-- student records to force this migration through.
--
-- Design notes:
-- - students.batch stays nullable (a student may not yet be assigned to
--   a batch), so the FK allows null.
-- - expenses.category is `not null` already, so no null-handling needed.
-- - `on update cascade` so renaming a batch/category (already supported
--   in the UI) keeps existing students/expenses pointing at the renamed
--   row, matching the pattern already used for
--   public.profiles.batch_name in migration-academy-suite-v2.sql.
-- - No `on delete` action is specified deliberately: batches and expense
--   categories have admin-only delete policies with no delete UI path
--   observed in the app for batches/categories still referenced by
--   students/expenses, so the default (restrict) is the safe choice --
--   it prevents deleting a batch/category that is still in use rather
--   than silently orphaning or cascading deletes into financial records.
--
-- Rollback:
--   alter table public.students drop constraint if exists students_batch_fkey;
--   alter table public.expenses drop constraint if exists expenses_category_fkey;
-- ------------------------------------------------------------

begin;

alter table public.students
  add constraint students_batch_fkey
  foreign key (batch) references public.batches (name)
  on update cascade;

alter table public.expenses
  add constraint expenses_category_fkey
  foreign key (category) references public.expense_categories (name)
  on update cascade;

commit;
