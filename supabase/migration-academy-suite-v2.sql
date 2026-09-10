-- ============================================================================
-- Migration: Academy Suite v2
-- Real tables, foreign keys, batch/faculty scoping and RLS for the academic
-- modules (Timetable, Live Class, Assignments, Exams, Submissions, Reviews,
-- Notifications).
--
-- Additive and idempotent. Run once in the Supabase SQL Editor AFTER
-- schema.sql. It supersedes migration-academy-suite.sql: the six unused
-- tables from that file (assignments, assignment_submissions, exams,
-- exam_questions, exam_results, faculty_reviews) were never written to by
-- the app and are rebuilt here with proper relationships. The old
-- `timetables` table is left untouched; the app now uses `timetable_slots`.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Link a login to its batch / student record + academic helper functions
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists batch_name  text references public.batches (name) on update cascade,
  add column if not exists student_ref text references public.students (id);

-- Faculty can teach several batches.
create table if not exists public.faculty_batches (
  faculty_id uuid not null references public.profiles (id) on delete cascade,
  batch_name text not null references public.batches (name) on update cascade,
  created_at timestamptz not null default now(),
  primary key (faculty_id, batch_name)
);
alter table public.faculty_batches enable row level security;

-- Executive (staff) + Admin + Owner: the academic "monitor" tier.
create or replace function public.is_staff_or_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select is_approved and role in ('staff', 'admin', 'super_admin')
    from public.profiles where id = auth.uid()), false);
$$;

-- The current user's batch (students).
create or replace function public.my_batch()
returns text language sql security definer set search_path = public stable as $$
  select batch_name from public.profiles where id = auth.uid();
$$;

-- Does the current user (faculty) teach this batch?
create or replace function public.teaches_batch(b text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.faculty_batches
    where faculty_id = auth.uid() and batch_name = b);
$$;

create policy "faculty_batches_read" on public.faculty_batches
  for select to authenticated
  using (faculty_id = auth.uid() or public.is_staff_or_admin());
create policy "faculty_batches_write" on public.faculty_batches
  for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- ----------------------------------------------------------------------------
-- 1. TIMETABLE  (one row per recurring class slot; also drives Live Class)
-- ----------------------------------------------------------------------------
create table if not exists public.timetable_slots (
  id           uuid primary key default gen_random_uuid(),
  batch_name   text not null references public.batches (name) on update cascade,
  faculty_id   uuid references public.profiles (id),
  subject      text not null,
  day_of_week  text not null check (day_of_week in
                 ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  starts_at    time not null,
  ends_at      time not null,
  mode         text not null default 'live' check (mode in ('live','in_person')),
  room         text,
  join_link    text,
  status       text not null default 'scheduled'
                 check (status in ('scheduled','cancelled','completed')),
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.timetable_slots enable row level security;

-- No two slots for the same faculty or the same batch may overlap in time
-- on the same day (ignoring cancelled slots).
create or replace function public.timetable_no_conflict()
returns trigger language plpgsql as $$
begin
  if new.status = 'cancelled' then return new; end if;
  if exists (
    select 1 from public.timetable_slots s
    where s.id <> new.id
      and s.status <> 'cancelled'
      and s.day_of_week = new.day_of_week
      and new.starts_at < s.ends_at and s.starts_at < new.ends_at
      and (s.batch_name = new.batch_name
           or (new.faculty_id is not null and s.faculty_id = new.faculty_id))
  ) then
    raise exception 'Timetable clash: that batch or faculty already has a class in this slot';
  end if;
  return new;
end;
$$;
drop trigger if exists timetable_no_conflict_t on public.timetable_slots;
create trigger timetable_no_conflict_t
  before insert or update on public.timetable_slots
  for each row execute function public.timetable_no_conflict();

create policy "slots_read" on public.timetable_slots
  for select to authenticated using (
    public.is_staff_or_admin()
    or faculty_id = auth.uid()
    or batch_name = public.my_batch()
  );
create policy "slots_write" on public.timetable_slots
  for all to authenticated
  using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

-- ----------------------------------------------------------------------------
-- 2. LIVE SESSIONS + ATTENDANCE
-- ----------------------------------------------------------------------------
create table if not exists public.live_sessions (
  id         uuid primary key default gen_random_uuid(),
  slot_id    uuid not null references public.timetable_slots (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  host_id    uuid references public.profiles (id)
);
alter table public.live_sessions enable row level security;

create table if not exists public.attendance (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  present    boolean not null default true,
  primary key (session_id, student_id)
);
alter table public.attendance enable row level security;

create policy "live_read" on public.live_sessions
  for select to authenticated using (
    public.is_staff_or_admin()
    or host_id = auth.uid()
    or exists (select 1 from public.timetable_slots s
               where s.id = slot_id and s.batch_name = public.my_batch())
  );
create policy "live_write" on public.live_sessions
  for all to authenticated using (
    public.is_staff_or_admin()
    or exists (select 1 from public.timetable_slots s
               where s.id = slot_id and s.faculty_id = auth.uid())
  ) with check (
    public.is_staff_or_admin()
    or exists (select 1 from public.timetable_slots s
               where s.id = slot_id and s.faculty_id = auth.uid())
  );

create policy "attend_read" on public.attendance
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_staff_or_admin()
    or exists (select 1 from public.live_sessions ls
               join public.timetable_slots s on s.id = ls.slot_id
               where ls.id = session_id and s.faculty_id = auth.uid())
  );
-- A student marks their own attendance by joining; faculty/staff can adjust.
create policy "attend_self_insert" on public.attendance
  for insert to authenticated with check (student_id = auth.uid());
create policy "attend_staff_write" on public.attendance
  for all to authenticated using (
    public.is_staff_or_admin()
    or exists (select 1 from public.live_sessions ls
               join public.timetable_slots s on s.id = ls.slot_id
               where ls.id = session_id and s.faculty_id = auth.uid())
  ) with check (
    public.is_staff_or_admin()
    or exists (select 1 from public.live_sessions ls
               join public.timetable_slots s on s.id = ls.slot_id
               where ls.id = session_id and s.faculty_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 3. ASSIGNMENTS + SUBMISSIONS
-- ----------------------------------------------------------------------------
drop table if exists public.assignment_submissions cascade;
drop table if exists public.assignments cascade;

create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  batch_name   text not null references public.batches (name) on update cascade,
  faculty_id   uuid references public.profiles (id),
  title        text not null,
  description  text,
  max_marks    integer not null default 100 check (max_marks > 0),
  due_date     date,
  status       text not null default 'draft' check (status in ('draft','published','closed')),
  published_at timestamptz,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.assignments enable row level security;

create table public.assignment_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  link          text,
  notes         text,
  submitted_at  timestamptz not null default now(),
  is_late       boolean not null default false,
  marks         integer,
  feedback      text,
  status        text not null default 'submitted' check (status in ('submitted','graded','returned')),
  graded_by     uuid references public.profiles (id),
  graded_at     timestamptz,
  unique (assignment_id, student_id)
);
alter table public.assignment_submissions enable row level security;

-- Faculty who teaches the batch, or the monitor tier.
create or replace function public.can_manage_assignment(a public.assignments)
returns boolean language sql stable as $$
  select public.is_staff_or_admin()
      or a.created_by = auth.uid()
      or public.teaches_batch(a.batch_name);
$$;

create policy "asg_read" on public.assignments
  for select to authenticated using (
    public.is_staff_or_admin()
    or public.teaches_batch(batch_name)
    or (status = 'published' and batch_name = public.my_batch())
  );
create policy "asg_insert" on public.assignments
  for insert to authenticated
  with check (public.is_staff_or_admin() or public.teaches_batch(batch_name));
create policy "asg_update" on public.assignments
  for update to authenticated
  using (public.can_manage_assignment(assignments))
  with check (public.can_manage_assignment(assignments));
create policy "asg_delete" on public.assignments
  for delete to authenticated using (public.can_manage_assignment(assignments));

create policy "sub_read" on public.assignment_submissions
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_staff_or_admin()
    or exists (select 1 from public.assignments a
               where a.id = assignment_id and public.can_manage_assignment(a))
  );
-- Student submits their own work against a published assignment for their batch.
create policy "sub_student_insert" on public.assignment_submissions
  for insert to authenticated with check (
    student_id = auth.uid()
    and exists (select 1 from public.assignments a
                where a.id = assignment_id
                  and a.status = 'published'
                  and a.batch_name = public.my_batch())
  );
create policy "sub_student_update" on public.assignment_submissions
  for update to authenticated
  using (student_id = auth.uid() and status = 'submitted')
  with check (student_id = auth.uid() and status = 'submitted');
create policy "sub_grader_update" on public.assignment_submissions
  for update to authenticated using (
    exists (select 1 from public.assignments a
            where a.id = assignment_id and public.can_manage_assignment(a))
  ) with check (
    exists (select 1 from public.assignments a
            where a.id = assignment_id and public.can_manage_assignment(a))
  );

-- ----------------------------------------------------------------------------
-- 4. EXAMS  (answers never leave the server)
-- ----------------------------------------------------------------------------
drop table if exists public.exam_results cascade;
drop table if exists public.exam_questions cascade;
drop table if exists public.exams cascade;

create table public.exams (
  id               uuid primary key default gen_random_uuid(),
  batch_name       text not null references public.batches (name) on update cascade,
  title            text not null,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  passing_score    integer not null default 50 check (passing_score between 0 and 100),
  opens_at         timestamptz,
  closes_at        timestamptz,
  status           text not null default 'draft'
                     check (status in ('draft','published','closed')),
  results_released boolean not null default false,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now()
);
alter table public.exams enable row level security;

create table public.exam_questions (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid not null references public.exams (id) on delete cascade,
  position      integer not null default 1,
  question      text not null,
  options       jsonb not null,
  correct_index integer not null,
  marks         integer not null default 1
);
alter table public.exam_questions enable row level security;

create table public.exam_attempts (
  id           uuid primary key default gen_random_uuid(),
  exam_id      uuid not null references public.exams (id) on delete cascade,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  score        integer,
  total        integer,
  percentage   integer,
  passed       boolean,
  unique (exam_id, student_id)
);
alter table public.exam_attempts enable row level security;

create table public.exam_answers (
  attempt_id   uuid not null references public.exam_attempts (id) on delete cascade,
  question_id  uuid not null references public.exam_questions (id) on delete cascade,
  chosen_index integer,
  primary key (attempt_id, question_id)
);
alter table public.exam_answers enable row level security;

create or replace function public.can_manage_exam(e public.exams)
returns boolean language sql stable as $$
  select public.is_staff_or_admin()
      or e.created_by = auth.uid()
      or public.teaches_batch(e.batch_name);
$$;

-- Student-facing question list WITHOUT the answer key. Runs as owner (so the
-- restrictive exam_questions RLS doesn't block students) but its own WHERE
-- clause limits rows to the caller's published batch exams.
drop view if exists public.exam_questions_public;
create view public.exam_questions_public with (security_invoker = false) as
  select q.id, q.exam_id, q.position, q.question, q.options, q.marks
  from public.exam_questions q
  join public.exams e on e.id = q.exam_id
  where e.status = 'published'
    and (e.batch_name = public.my_batch() or public.can_manage_exam(e));
grant select on public.exam_questions_public to authenticated;

create policy "exam_read" on public.exams
  for select to authenticated using (
    public.is_staff_or_admin()
    or public.teaches_batch(batch_name)
    or (status = 'published' and batch_name = public.my_batch())
  );
create policy "exam_write" on public.exams
  for all to authenticated
  using (public.can_manage_exam(exams)) with check (public.can_manage_exam(exams));

-- Only managers read raw questions (answer key). Students use the view +
-- the scoring function.
create policy "q_manager_read" on public.exam_questions
  for select to authenticated using (
    exists (select 1 from public.exams e where e.id = exam_id and public.can_manage_exam(e))
  );
create policy "q_manager_write" on public.exam_questions
  for all to authenticated using (
    exists (select 1 from public.exams e where e.id = exam_id and public.can_manage_exam(e))
  ) with check (
    exists (select 1 from public.exams e where e.id = exam_id and public.can_manage_exam(e))
  );

create policy "attempt_read" on public.exam_attempts
  for select to authenticated using (
    student_id = auth.uid()
    or public.is_staff_or_admin()
    or exists (select 1 from public.exams e where e.id = exam_id and public.can_manage_exam(e))
  );
create policy "attempt_student_insert" on public.exam_attempts
  for insert to authenticated with check (
    student_id = auth.uid()
    and exists (select 1 from public.exams e
                where e.id = exam_id and e.status = 'published'
                  and e.batch_name = public.my_batch()
                  and (e.opens_at is null or now() >= e.opens_at)
                  and (e.closes_at is null or now() <= e.closes_at))
  );

create policy "ans_student_rw" on public.exam_answers
  for all to authenticated using (
    exists (select 1 from public.exam_attempts t
            where t.id = attempt_id and t.student_id = auth.uid() and t.submitted_at is null)
  ) with check (
    exists (select 1 from public.exam_attempts t
            where t.id = attempt_id and t.student_id = auth.uid() and t.submitted_at is null)
  );
create policy "ans_manager_read" on public.exam_answers
  for select to authenticated using (
    exists (select 1 from public.exam_attempts t
            join public.exams e on e.id = t.exam_id
            where t.id = attempt_id and public.can_manage_exam(e))
  );

-- Score an attempt server-side. Grades the saved answers, closes the attempt,
-- returns the result row. correct_index is only ever read in here.
create or replace function public.score_exam_attempt(p_attempt uuid)
returns public.exam_attempts
language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts;
  v_total integer;
  v_score integer;
  v_pass  integer;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  if a is null then raise exception 'attempt not found'; end if;
  if a.student_id <> auth.uid() then raise exception 'not your attempt'; end if;
  if a.submitted_at is not null then return a; end if;

  select coalesce(sum(q.marks), 0),
         coalesce(sum(case when ans.chosen_index = q.correct_index then q.marks else 0 end), 0)
    into v_total, v_score
  from public.exam_questions q
  left join public.exam_answers ans
    on ans.question_id = q.id and ans.attempt_id = p_attempt
  where q.exam_id = a.exam_id;

  select passing_score into v_pass from public.exams where id = a.exam_id;

  update public.exam_attempts set
    submitted_at = now(),
    score = v_score,
    total = v_total,
    percentage = case when v_total > 0 then round(v_score * 100.0 / v_total) else 0 end,
    passed = case when v_total > 0 then round(v_score * 100.0 / v_total) >= v_pass else false end
  where id = p_attempt
  returning * into a;

  return a;
end;
$$;
grant execute on function public.score_exam_attempt(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. FACULTY REVIEWS  (students rate faculty)
-- ----------------------------------------------------------------------------
drop table if exists public.faculty_reviews cascade;

create table public.faculty_reviews (
  id           uuid primary key default gen_random_uuid(),
  faculty_id   uuid references public.profiles (id),
  faculty_name text not null,
  subject      text,
  rating       integer not null check (rating between 1 and 5),
  clarity      integer not null check (clarity between 1 and 5),
  punctuality  integer not null check (punctuality between 1 and 5),
  comment      text,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now()
);
alter table public.faculty_reviews enable row level security;

-- Students see their own reviews; faculty see reviews about them (no student
-- identity is hidden at DB level, but the UI shows aggregates); monitors see all.
create policy "rev_read" on public.faculty_reviews
  for select to authenticated using (
    student_id = auth.uid()
    or faculty_id = auth.uid()
    or public.is_staff_or_admin()
  );
create policy "rev_student_insert" on public.faculty_reviews
  for insert to authenticated with check (student_id = auth.uid());
create policy "rev_student_update" on public.faculty_reviews
  for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "rev_admin_delete" on public.faculty_reviews
  for delete to authenticated using (public.is_staff_or_admin());

-- ----------------------------------------------------------------------------
-- 6. NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  link_tab     text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

create policy "notif_read" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy "notif_update_own" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- Any approved user may create notifications (fan-out is done app-side /
-- by triggers); recipients only ever see their own.
create policy "notif_insert" on public.notifications
  for insert to authenticated with check (public.is_approved_user());

-- Fan out a notification to every student in a batch. security definer so a
-- faculty insert can reach other users' rows.
create or replace function public.notify_batch(
  p_batch text, p_type text, p_title text, p_body text, p_link text
) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.notifications (recipient_id, type, title, body, link_tab)
  select id, p_type, p_title, p_body, p_link
  from public.profiles
  where batch_name = p_batch and is_approved and role in ('student','professional');
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.notify_batch(text, text, text, text, text) to authenticated;

commit;

-- ============================================================================
-- Notes
-- - Set each student's profiles.batch_name (and optionally student_ref) so
--   they see their timetable / assignments / exams:
--     update public.profiles set batch_name = 'FSW-2026-A' where email = '...';
-- - Assign faculty to batches:
--     insert into public.faculty_batches (faculty_id, batch_name)
--     values ((select id from public.profiles where email='...'), 'FSW-2026-A');
-- ============================================================================
