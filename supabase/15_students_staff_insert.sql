-- ============================================================
-- Migration 15: students insert+update require staff+ (CRIT-1, 4 of 6)
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 12.

begin;

drop policy if exists "students_approved_insert" on public.students;
create policy "students_staff_insert" on public.students
  for insert with check (public.is_staff_or_admin());

drop policy if exists "students_approved_update" on public.students;
create policy "students_staff_update" on public.students
  for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

commit;

-- Not touched: students_approved_select (read stays open to any approved
-- user). No delete policy exists (unchanged, by design).
