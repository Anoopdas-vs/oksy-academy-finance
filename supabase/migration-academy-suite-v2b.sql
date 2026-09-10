-- ============================================================================
-- Migration: Academy Suite v2b — submission file uploads
-- Adds a private Storage bucket for assignment submissions and a file_path
-- column. Run once, after migration-academy-suite-v2.sql.
-- ============================================================================

begin;

alter table public.assignment_submissions
  add column if not exists file_path text;

-- Private bucket. Files are read back via short-lived signed URLs from the app.
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- Path convention: submissions/<assignment_id>/<student_uid>/<filename>
-- A student may write only under their own uid folder.
drop policy if exists "submissions_student_write" on storage.objects;
create policy "submissions_student_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "submissions_student_update" on storage.objects;
create policy "submissions_student_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Read: the owning student, or a faculty/staff who can manage the assignment.
drop policy if exists "submissions_read" on storage.objects;
create policy "submissions_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_staff_or_admin()
      or exists (
        select 1 from public.assignments a
        where a.id::text = (storage.foldername(name))[1]
          and public.can_manage_assignment(a)
      )
    )
  );

commit;
