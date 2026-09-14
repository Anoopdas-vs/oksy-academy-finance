-- ============================================================
-- Migration 11: assignment resubmission goes through a security-definer
-- RPC instead of a direct student UPDATE, closing the H-2 self-grading gap
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 01-10 AND after
-- migration-academy-suite-v2.sql (this migration alters
-- public.assignment_submissions, which migration-academy-suite-v2.sql
-- creates — it cannot run on a project that hasn't applied that file yet).
--
-- Problem (H-2, docs/audits/02-security-audit.md): "sub_student_update"
-- only constrained *which row* a student's UPDATE could touch
-- (own row, still status = 'submitted') — Postgres RLS has no column-level
-- predicate, so within an allowed row a student could set marks/feedback/
-- graded_by/graded_at to anything, as long as status stayed 'submitted'.
--
-- Fix (Option A, docs/claude-project/audits/03b-crit1-h2-fix-plan.md §2.4):
-- remove the student UPDATE policy entirely — matching how exam_attempts
-- has no student-facing update policy at all — and move the one legitimate
-- use of that policy (a student editing their own not-yet-graded
-- submission before resubmitting) into a security-definer RPC that
-- re-checks ownership/status itself and only ever writes
-- link/notes/file_path/is_late/submitted_at. This follows the
-- score_exam_attempt() precedent (migration-academy-suite-v2.sql:405-439)
-- exactly: the function is the sole path for its write, and it never
-- references the grading columns anywhere in its body, so there's no
-- code path by which a student-invoked call can set them.
--
-- Blast radius: this migration touches exactly one existing policy
-- (dropped) and adds exactly one new function. sub_student_insert,
-- sub_grader_update, sub_read, and every other policy/function are
-- untouched.
-- ------------------------------------------------------------

begin;

drop policy if exists "sub_student_update" on public.assignment_submissions;

create or replace function public.resubmit_assignment(
  p_assignment_id uuid,
  p_link text,
  p_notes text,
  p_file_path text,
  p_is_late boolean
)
returns public.assignment_submissions
language plpgsql security definer set search_path = public as $$
declare
  r public.assignment_submissions;
begin
  update public.assignment_submissions
     set link = p_link,
         notes = p_notes,
         file_path = p_file_path,
         is_late = p_is_late,
         submitted_at = now()
   where assignment_id = p_assignment_id
     and student_id = auth.uid()
     and status = 'submitted'          -- can't touch a graded/returned row
  returning * into r;

  if r is null then
    raise exception 'no editable submission found (already graded, or none exists)';
  end if;

  return r;
end;
$$;

grant execute on function public.resubmit_assignment(uuid, text, text, text, boolean) to authenticated;

commit;

-- Note: "sub_student_insert" (the first-submission path) is untouched — a
-- student's first submission for an assignment still goes through that
-- policy via a direct INSERT. Only the resubmission (UPDATE) path moves to
-- this RPC. "sub_grader_update" (faculty/admin/monitor setting marks,
-- feedback, status, graded_by, graded_at) is also untouched.
--
-- Rollback: `drop function public.resubmit_assignment(uuid, text, text,
-- text, boolean);` then re-run the original
-- `create policy "sub_student_update" on public.assignment_submissions
--   for update to authenticated
--   using (student_id = auth.uid() and status = 'submitted')
--   with check (student_id = auth.uid() and status = 'submitted');`
-- restores the exact pre-fix state. No data migration involved.
