# Database Schema Audit — oksy-academy-finance

Date: 2026-09-14
Scope: read-only, full-schema audit of the Supabase/Postgres database —
every table, column, relationship, key, constraint, index, function, RPC,
trigger, view, storage bucket, and the migration files that produced them.
**Nothing in the repository or the database was modified.** Performed on
branch `claude/database-schema-audit-5337be`, off `main`, against the SQL
in `supabase/` as of this commit.

A second, separate deliverable of this audit is §10: every table/column/
function/policy name containing "finance" or other finance-specific
terminology, as candidates for a future rename to a generic academy/
"pulse" naming scheme.

---

## 0. Note on task instructions

The task asked me to first read
`docs/claude-project/DATABASE_AND_ARCHITECTURE_RULES.md`. **That file does
not exist** anywhere in this repository (checked the working tree and
`docs/claude-project/`, which currently contains only `audits/`). This is
the same gap the two prior audits flagged for a different file in the same
directory (`docs/claude-project/SECURITY_REQUIREMENTS.md`, noted in
[02-security-audit.md](02-security-audit.md)) — `docs/claude-project/`
appears to be a placeholder directory whose named rules files have not
actually been written yet. In its absence I used the project's own
documentation (`PROJECT_OVERVIEW.md`, `README.md`, `SETUP.md`) and the SQL
files' own extensive inline comments as the frame of reference.

---

## 1. How the schema is assembled (there is no migration runner)

There is no Supabase CLI `migrations/` folder and no version-tracking
table — `supabase/` is a set of hand-run SQL files, applied directly in the
Supabase SQL Editor. Reconstructing "what the live database actually looks
like today" means composing them in dependency order:

1. **`schema.sql`** — a from-scratch baseline someone would paste into a
   brand-new project. It is *not* a live export of the current database;
   see §9 for exactly how it has drifted from the real, currently-applied
   schema.
2. **`01_healthcare_account.sql` → `17_collections_staff_insert.sql`** — 17
   numbered patches, meant to be run in numeric order against a project
   that predates `schema.sql`. The numbering is dependency order, not just
   a filename convention (multiple files say this explicitly — e.g. 02
   must run before 03 because 03 adds a policy to a table 02 creates).
3. **`migration-academy-suite-v2.sql`**, then **`migration-academy-suite-v2b.sql`**
   — the Academy Suite's real, currently-used tables. v2's own header says
   it *supersedes* `migration-academy-suite.sql` (no version suffix — call
   it v1): v2 drops and rebuilds six of v1's seven tables with proper
   foreign keys and batch/faculty scoping. v1 is dead: `grep -rn
   "\.from(" src/` (see §9) confirms the frontend only ever queries the v2
   table names (`timetable_slots`, `exam_attempts`, `exam_answers`, …), never
   the v1 ones (`exams.id text`, `exam_results`, …).
4. **`functions/create-user/index.ts`** — a Deno Edge Function (not SQL,
   but part of the backend surface: it's the only path that creates a
   Supabase Auth user and sets a profile's role/approval/financial-access
   in one step).

The rest of this document describes the schema that results from applying
all of the above, in that order — i.e. what a correctly-provisioned
production project actually has today, not any single file in isolation.

---

## 2. Entity inventory (one line per object)

| Table | Domain | RLS | Rows via |
|---|---|---|---|
| `profiles` | identity | ✅ | direct + `handle_new_user()` trigger |
| `students` | academy master | ✅ | direct |
| `collections` | finance | ✅ (+ base-table SELECT revoked) | direct insert; reads via `collections_basic` view |
| `expenses` | finance | ✅ | direct |
| `transfers` | finance | ✅ | direct |
| `bank_statements` | finance | ✅ | direct |
| `bank_statement_lines` | finance | ✅ | direct |
| `batches` | academy master | ✅ | direct |
| `expense_categories` | finance master | ✅ | direct |
| `app_settings` | system config | ✅ | direct (singleton, `id = 1`) |
| `audit_log` | system | ✅ | trigger-only (`log_financial_change()`) |
| `faculty_batches` | academy suite v2 | ✅ | direct |
| `timetable_slots` | academy suite v2 | ✅ | direct |
| `live_sessions` | academy suite v2 | ✅ | direct |
| `attendance` | academy suite v2 | ✅ | direct |
| `assignments` | academy suite v2 | ✅ | direct |
| `assignment_submissions` | academy suite v2 | ✅ | direct insert; edits via `resubmit_assignment()` RPC or grader UPDATE |
| `exams` | academy suite v2 | ✅ | direct |
| `exam_questions` | academy suite v2 | ✅ | direct (managers only); students use `exam_questions_public` view |
| `exam_attempts` | academy suite v2 | ✅ | direct insert; scored via `score_exam_attempt()` RPC |
| `exam_answers` | academy suite v2 | ✅ | direct |
| `faculty_reviews` | academy suite v2 | ✅ | direct |
| `notifications` | academy suite v2 | ✅ | direct + `notify_batch()` RPC |
| `timetables` | **orphaned (v1)** | ✅ | dead — see §9 |
| `income` | **dropped** | — | removed by migration 08, listed here for completeness |

23 live tables, 1 dropped table still documented in history, 1 orphaned
table still physically present but unused by any app code.

---

## 3. Table detail

### 3.1 Identity & access

#### `public.profiles`
One row per login (auto-created by the `on_auth_user_created` trigger).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `references auth.users(id) on delete cascade` |
| `email` | text | |
| `full_name` | text | |
| `role` | text | `not null default 'staff'`, `check (role in ('super_admin','admin','staff','student','faculty','professional'))` |
| `can_view_financials` | boolean | `not null default false` |
| `is_approved` | boolean | `not null default false` |
| `must_change_password` | boolean | `not null default false` (migration 10) |
| `created_at` | timestamptz | `not null default now()` |
| `batch_name` | text | FK → `batches(name)` `on update cascade` (added by academy-suite-v2) |
| `student_ref` | text | FK → `students(id)` (added by academy-suite-v2) |

RLS: `profiles_self_select` (`id = auth.uid()`), `profiles_super_admin_select_all`
(migration 07 tightened this from admin-readable to super-admin-only),
`profiles_super_admin_update_all`. No student/staff self-update policy
exists on purpose (see migration 10's comment: a blanket self-update
policy would let a user grant themself `admin`/`can_view_financials`) — the
only self-service write is the narrow `clear_my_must_change_password()`
RPC.

No delete policy — profiles are never deleted from the app (auth user
deletion via `on delete cascade` is the only path, and that requires the
service-role key, i.e. only the `create-user` function's admin client or
manual Supabase-dashboard action).

---

### 3.2 Finance

#### `public.students`
Student/enrolment master, `id text` PK (human-assigned codes like
`DBHM001`, not a UUID). Columns: `batch`, `name` (`not null`), `course`,
`registration_fee`/`course_fee`/`exam_fee`/`other_fee`/`waiver` (all
`numeric not null default 0`), `status` (`check in ('Registered','Active',
'Completed','Dropped')`, default `'Registered'`), `enrollment_date`,
`created_at`/`created_by`/`updated_at`/`updated_by` (the last two FK →
`profiles(id)`).

RLS: select is open to any approved user; insert/update require
`is_staff_or_admin()` (tightened by migration 15 from
`is_approved_user()` — see CRIT-1 in §3.6). **No delete policy at all** —
by design, per the schema's own comment: "financial/student records are
corrected, not deleted."

Note: `students.batch` (free text) is separate from `profiles.batch_name`
and `batches.name` — nothing enforces `students.batch` actually matches a
row in `public.batches`; there's no FK from `students.batch` to
`batches.name` (unlike `profiles.batch_name`, `assignments.batch_name`,
etc., which are all FK'd). This is a real, if minor, structural gap — a
typo'd batch on a student silently doesn't match anything.

#### `public.collections`
Fee payments. `id bigint identity` PK, `student_id text not null
references students(id)`, `student_name text` (denormalized snapshot,
not FK-enforced against `students.name`), `date date not null`, `type
text not null`, `account text not null check (account in ('HDFC','ICICI',
'Cash','Healthcare'))`, `amount numeric not null check (amount > 0)`,
`reference text`, `created_at`/`created_by`/`updated_at`/`updated_by`.
Indexes: `collections_student_id_idx (student_id)`,
`collections_date_idx (date)`.

RLS is unusual and deliberately layered — this is the most heavily
commented object in the whole schema (migration 06):
- `collections_approved_select` (`is_approved_user()`) still exists on the
  base table as a defense-in-depth floor, but **direct SELECT on the base
  table is revoked from `authenticated`** except for the bare `id` column
  (`grant select (id) on public.collections to authenticated`). All real
  reads must go through the `collections_basic` view.
- `collections_staff_insert` (migration 17, replacing the original
  `is_approved_user()`-gated policy) requires `is_staff_or_admin()`.
- `collections_admin_update` / `collections_admin_delete`: admin-only.

`public.collections_basic` (view, `security_barrier = true`, deliberately
**not** `security_invoker` — see the extended rationale in migration 06):
masks the `account` column to `null` unless
`can_view_financials() or created_by = auth.uid()`. Its own `where
public.is_approved_user()` re-implements the base table's row filter
explicitly rather than relying on RLS propagating through view ownership.
`grant select on collections_basic to authenticated`.

#### `public.expenses`
`id bigint identity` PK, `date`, `category text not null` (free text, not
FK'd to `expense_categories` — see §9 note), `account` (same 4-value
check as collections), `amount numeric not null check (amount > 0)`,
`reference`, `description`, audit columns. Index: `expenses_date_idx
(date)`.

RLS (final state after migration 16): `expenses_approved_select` (any
approved user), `expenses_staff_insert` (`is_staff_or_admin()`),
`expenses_admin_update` (tightened from staff-editable to admin-only by
migration 16 — "Owner/Admin/Staff can record expenses; only Owner/Admin
may edit or delete them once recorded"), `expenses_admin_delete`.

#### `public.transfers`
Account-to-account money movement (not P&L). `id bigint identity` PK,
`date`, `from_account`/`to_account` (both `check in ('HDFC','ICICI',
'Cash','Healthcare')`), `amount numeric not null check (amount > 0)`,
`purpose`, `reference`, `note`, `created_at`/`created_by`. Constraint:
`transfers_distinct_accounts check (from_account <> to_account)`. Index:
`transfers_date_idx (date)`.

RLS: select needs `can_view_financials()` (narrower than the "approved"
tables — transfers were financial-viewer-gated from the start and never
broadened to staff-insert the way collections/expenses were); insert/
update/delete are all `is_admin()`.

#### `public.bank_statements` / `public.bank_statement_lines`
Bank reconciliation. `bank_statements`: `id bigint identity` PK, `account
text not null check in ('HDFC','ICICI','Cash')` (note: **no 'Healthcare'
option here** — consistent, since Healthcare isn't a real bank), period
dates, opening/closing balance, `file_name`, audit columns.

`bank_statement_lines`: `id bigint identity` PK, `statement_id bigint not
null references bank_statements(id) on delete cascade`, `account` (same
3-value check), `seq int`, `txn_date date not null`, `description`,
`reference`, `withdrawal`/`deposit numeric not null default 0`,
`running_balance`, `status text not null default 'unmatched' check in
('unmatched','matched','classified','ignored')`, `match_kind text check in
('collection','expense','transfer')`, `match_id bigint` (**not a real FK**
— it's a polymorphic reference resolved in application code based on
`match_kind`, so the database cannot enforce it points at a real row),
`matched_at`/`matched_by`, `created_at`/`created_by`. Index:
`bank_statement_lines_statement_idx (statement_id)`.

RLS on both: select needs `can_view_financials()`; insert/update need
`is_admin()`. `bank_statement_lines` has **no delete policy** — lines are
only removed via the parent statement's `on delete cascade`.

#### `public.batches`
Course batch master. `id bigint identity` PK, `name text not null
unique`, `course_name`, `course_fee numeric not null default 0`,
`start_date`/`end_date`, `duration`, `notes`, `archived boolean not null
default false`, `created_at`/`created_by`.

RLS (final, after migration 14): select open to approved users; insert/
update need `is_staff_or_admin()`; delete needs `is_admin()`.

Referenced by (real FKs, `on update cascade` where a rename should
propagate): `profiles.batch_name`, `assignments.batch_name`,
`exams.batch_name`, `timetable_slots.batch_name`, `faculty_batches.batch_name`.

#### `public.expense_categories`
`id bigint identity` PK, `name text not null unique`, `archived boolean
not null default false`, `created_at`/`created_by`. Seeded with 10 default
rows (Rent, Salary, Commission, Electricity, Internet, Marketing, Office
Expense, Travel, Bank Charge, Other) via `on conflict (name) do nothing`.

RLS (final, after migration 13): select open to approved users; insert/
update need `is_staff_or_admin()`; delete needs `is_admin()`.

Not FK-referenced by `expenses.category` — see §9.

#### `public.app_settings`
Singleton config row. `id int primary key default 1`, `data jsonb not
null default '{}'`, `updated_at`/`updated_by`, `constraint
app_settings_singleton check (id = 1)`. Holds `roleAreas` — per-role tab
visibility, edited from the Admin → Access screen.

RLS: select open to approved users; insert/update need
`is_super_admin()`.

---

### 3.3 Academy Suite (v2 — the live implementation)

#### `public.faculty_batches`
Junction table: which faculty teach which batch. Composite PK
`(faculty_id, batch_name)`, both FK'd (`faculty_id → profiles(id) on
delete cascade`, `batch_name → batches(name) on update cascade`).

RLS: `faculty_batches_read` (own rows, or `is_staff_or_admin()`);
`faculty_batches_write` (`for all`, `is_staff_or_admin()` only).

#### `public.timetable_slots`
Recurring class slots (supersedes the v1 `timetables` table — see §9).
`id uuid` PK (`gen_random_uuid()`), `batch_name` FK, `faculty_id` FK →
`profiles(id)`, `subject text not null`, `day_of_week text not null check
in (Monday..Sunday)`, `starts_at`/`ends_at time not null` with `check
(ends_at > starts_at)`, `mode text not null default 'live' check in
('live','in_person')`, `room`, `join_link`, `status text not null default
'scheduled' check in ('scheduled','cancelled','completed')`, audit
columns.

**Trigger**: `timetable_no_conflict_t` (before insert/update) calls
`public.timetable_no_conflict()`, which raises an exception if the new
row's day+time window overlaps an existing non-cancelled slot for the
*same batch or same faculty*. This is real conflict-prevention logic
enforced at the database layer, not just in the UI.

RLS: `slots_read` (staff/admin, the teaching faculty, or a student in that
batch via `my_batch()`); `slots_write` (`for all`, staff/admin only).

#### `public.live_sessions` / `public.attendance`
`live_sessions`: `id uuid` PK, `slot_id uuid not null references
timetable_slots(id) on delete cascade`, `started_at`/`ended_at`,
`host_id → profiles(id)`.

`attendance`: composite PK `(session_id, student_id)`, both FK'd (`session_id
→ live_sessions(id) on delete cascade`, `student_id → profiles(id) on
delete cascade`), `joined_at`, `present boolean not null default true`.

RLS: `live_read`/`live_write` scope to staff/admin, the session host, or
(read-only) students whose batch matches the slot. `attendance`: students
read their own row or staff/admin/teaching-faculty read all;
`attend_self_insert` lets a student write only their own attendance row
(self check-in); `attend_staff_write` (`for all`) covers staff/admin/
teaching-faculty corrections.

#### `public.assignments` / `public.assignment_submissions`
`assignments`: `id uuid` PK, `batch_name` FK, `faculty_id → profiles(id)`,
`title not null`, `description`, `max_marks integer not null default 100
check (max_marks > 0)`, `due_date`, `status text not null default 'draft'
check in ('draft','published','closed')`, `published_at`, audit columns.

`assignment_submissions`: `id uuid` PK, `assignment_id uuid not null
references assignments(id) on delete cascade`, `student_id uuid not null
references profiles(id) on delete cascade`, `link`, `notes`,
`submitted_at not null default now()`, `is_late boolean not null default
false`, `marks`, `feedback`, `status text not null default 'submitted'
check in ('submitted','graded','returned')`, `graded_by`/`graded_at`,
`file_path` (added by v2b, for the Storage-backed upload flow), `unique
(assignment_id, student_id)` — one submission per student per assignment.

RLS: `asg_read` (staff/admin, the teaching faculty, or a student whose
batch matches once `status = 'published'`); `asg_insert`/`asg_update`/
`asg_delete` gated by `can_manage_assignment()` (staff/admin, the
assignment's `created_by`, or a faculty who `teaches_batch()`).

`sub_read` (own submission, staff/admin, or whoever manages the parent
assignment); `sub_student_insert` (a student's own first submission,
guarded by the parent assignment being `published` and matching
`my_batch()`); `sub_grader_update` (whoever manages the assignment sets
marks/feedback/status).

**`sub_student_update` does not exist** — migration 11 deliberately
removed it (the H-2 finding: a student-writable UPDATE policy can't
express a column-level restriction in RLS, so a student could set their
own `marks`/`graded_by` inside their own allowed row). In its place,
resubmission goes through `public.resubmit_assignment()` — see §4.

#### `public.exams` / `public.exam_questions` / `public.exam_attempts` / `public.exam_answers`
`exams`: `id uuid` PK, `batch_name` FK, `title not null`,
`duration_minutes integer not null default 30 check (> 0)`,
`passing_score integer not null default 50 check (between 0 and 100)`,
`opens_at`/`closes_at`, `status text not null default 'draft' check in
('draft','published','closed')`, `results_released boolean not null
default false`, `created_by`, `created_at`.

`exam_questions`: `id uuid` PK, `exam_id uuid not null references
exams(id) on delete cascade`, `position integer not null default 1`,
`question not null`, `options jsonb not null`, `correct_index integer not
null`, `marks integer not null default 1`.

`exam_attempts`: `id uuid` PK, `exam_id` FK cascade, `student_id uuid not
null references profiles(id) on delete cascade`, `started_at`,
`submitted_at`, `score`/`total`/`percentage`/`passed`, `unique (exam_id,
student_id)` — one attempt per student per exam.

`exam_answers`: composite PK `(attempt_id, question_id)`, both FK'd
cascade, `chosen_index integer`.

Answer-key protection is the interesting part of this group:
- `exam_questions` RLS (`q_manager_read`/`q_manager_write`) only lets
  whoever manages the parent exam read the raw table — including
  `correct_index`.
- Students instead read `public.exam_questions_public`, a view
  (`security_invoker = false`, i.e. runs as owner) that selects every
  column **except** `correct_index`, filtered to `status = 'published'`
  exams in the caller's own batch (or exams they manage). This is a
  column-masking view, same technique as `collections_basic` but simpler
  (whole-column omission rather than a per-row `case`).
- `exam_answers` (`ans_student_rw`) only lets a student read/write their
  own answers while `exam_attempts.submitted_at is null` — once an
  attempt is submitted, the student can no longer touch their own
  answers.
- Grading is entirely server-side: `public.score_exam_attempt()` (SECURITY
  DEFINER) is the only thing that ever compares `chosen_index` to
  `correct_index` — the answer key itself never has to be sent to the
  browser for scoring to happen. See §4.

RLS: `exam_read` (staff/admin, teaching faculty, or published+own-batch);
`exam_write` (`for all`, `can_manage_exam()`); `attempt_read` (own,
staff/admin, or exam managers); `attempt_student_insert` (own attempt,
only while the exam is published, in the student's batch, and within the
`opens_at`/`closes_at` window — enforced in the policy's `with check`, not
just app code); **no student-facing update policy on `exam_attempts`** —
submission/scoring goes through `score_exam_attempt()` only, mirroring the
same pattern migration 11 later applied to assignments.

#### `public.faculty_reviews`
`id uuid` PK, `faculty_id → profiles(id)`, `faculty_name text not null`
(denormalized, not FK-enforced to match `faculty_id`'s actual name),
`subject`, `rating`/`clarity`/`punctuality integer not null check (between
1 and 5)`, `comment`, `student_id uuid not null references profiles(id)
on delete cascade`, `created_at`.

RLS: `rev_read` (the reviewing student, the reviewed faculty, or staff/
admin — the schema comment notes student identity is *not* hidden from
the reviewed faculty at the DB level, only aggregated in the UI);
`rev_student_insert`/`rev_student_update` (own row only); `rev_admin_delete`
(`is_staff_or_admin()`, despite the name).

#### `public.notifications`
`id uuid` PK, `recipient_id uuid not null references profiles(id) on
delete cascade`, `type not null`, `title not null`, `body`, `link_tab`,
`read_at`, `created_at`. Index: `notifications_recipient_idx
(recipient_id, created_at desc)`.

RLS: `notif_read`/`notif_update_own` (own rows only — e.g. marking read);
`notif_insert` (any approved user can create a notification for *anyone*,
per its `with check (is_approved_user())` — there's no check that the
inserting user has any relationship to the `recipient_id` they're writing.
The comment justifies this as "fan-out is done app-side / by triggers;
recipients only ever see their own [via the read policy]" — true for
confidentiality, but it does mean any approved user can spam an arbitrary
`recipient_id` with fabricated notification content. Worth knowing, not
scored here since §2 of the task is structural, not a new security
finding — flagging for awareness only).

---

### 3.4 System

#### `public.audit_log`
`id bigint identity` PK, `table_name text not null`, `row_id bigint not
null`, `action text not null check in ('update','delete')`, `old_row
jsonb`, `new_row jsonb` (`null` on delete), `changed_by → profiles(id)`,
`changed_at`. Index: `audit_log_table_row_idx (table_name, row_id)`.

RLS: select only, gated by `can_view_financials()`. No insert/update/
delete policy for any role — the only writer is `log_financial_change()`,
a SECURITY DEFINER trigger function, so ordinary RLS never has to permit
a direct write to this table at all.

Triggers wired to it: `collections_audit`, `expenses_audit`,
`transfers_audit` — all `after update or delete`, all calling the same
`log_financial_change()`. Nothing else is audited (the Academy Suite
tables have no audit trail).

---

## 4. Functions / RPCs

| Function | Security | Purpose |
|---|---|---|
| `is_admin()` | DEFINER, `stable` | `role in ('admin','super_admin') and is_approved` |
| `is_super_admin()` | DEFINER, `stable` | `role = 'super_admin' and is_approved` |
| `is_approved_user()` | DEFINER, `stable` | `is_approved` |
| `can_view_financials()` | DEFINER, `stable` | `is_approved and (role = 'admin' or can_view_financials)` |
| `is_staff_or_admin()` | DEFINER, `stable` | `is_approved and role in ('staff','admin','super_admin')`. **Defined twice** — identically — in migration 12 and again in `migration-academy-suite-v2.sql` (§9 note: harmless since `create or replace`, but a real duplicate) |
| `handle_new_user()` | DEFINER, trigger | inserts the `profiles` row on `auth.users` insert |
| `clear_my_must_change_password()` | DEFINER | the *only* self-service write to `profiles`; flips exactly one boolean for the caller's own row |
| `log_financial_change()` | DEFINER, trigger | writes `audit_log` rows on collections/expenses/transfers update or delete |
| `resubmit_assignment(p_assignment_id, p_link, p_notes, p_file_path, p_is_late)` | DEFINER | the sole path for a student to edit their own not-yet-graded submission; body never references `marks`/`feedback`/`status`/`graded_by`/`graded_at` |
| `score_exam_attempt(p_attempt)` | DEFINER | grades an attempt against `exam_questions.correct_index`, server-side only; verifies `auth.uid() = student_id` inside the function body (belt-and-suspenders on top of RLS, since this is DEFINER and would otherwise bypass RLS) |
| `notify_batch(p_batch, p_type, p_title, p_body, p_link)` | DEFINER | fans a notification out to every approved student/professional in a batch — needs DEFINER since it writes rows for other users |
| `my_batch()` | DEFINER, `stable` | returns the caller's `profiles.batch_name` |
| `teaches_batch(b)` | DEFINER, `stable` | `exists (... faculty_batches ...)` |
| `timetable_no_conflict()` | (plain, not DEFINER) trigger | the slot-overlap guard described in §3.3 |
| `can_manage_assignment(a)` | (plain, not DEFINER) `stable` | staff/admin, creator, or teaching faculty |
| `can_manage_exam(e)` | (plain, not DEFINER) `stable` | same shape, for exams |

All the `is_*`/`can_view_financials` boolean helpers set `search_path =
public` explicitly — the standard defense against search-path-hijacking
in SECURITY DEFINER functions. `resubmit_assignment`, `score_exam_attempt`,
`log_financial_change`, `handle_new_user`, and `notify_batch` do too.
`clear_my_must_change_password` also sets it. `timetable_no_conflict`,
`can_manage_assignment`, `can_manage_exam` are plain (invoker-rights)
functions, so `search_path` pinning is less critical for them but they
also don't do anything privilege-sensitive.

Grants: `execute` is explicitly granted to `authenticated` for
`clear_my_must_change_password`, `resubmit_assignment`,
`score_exam_attempt`, and `notify_batch` — the four functions meant to be
called directly from the client via `supabase.rpc(...)` (confirmed
against actual call sites in `src/lib/academy.js` and
`src/context/AuthContext.jsx`). The `is_*`/`can_view_financials`/`my_batch`/
`teaches_batch` helpers are only ever called *from inside* policy/view
definitions, not directly by the client, so no explicit grant is needed
for that.

---

## 5. Triggers

| Trigger | Table | Timing | Function |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | after insert | `handle_new_user()` |
| `collections_audit` | `public.collections` | after update or delete | `log_financial_change()` |
| `expenses_audit` | `public.expenses` | after update or delete | `log_financial_change()` |
| `transfers_audit` | `public.transfers` | after update or delete | `log_financial_change()` |
| `timetable_no_conflict_t` | `public.timetable_slots` | before insert or update | `timetable_no_conflict()` |

Five triggers total, three of which share one function
(`log_financial_change`, table-agnostic via `tg_table_name`/`new.id`/
`old.id`). No triggers exist on any other table — in particular, none of
the other Academy Suite tables (`assignments`, `exams`, `attendance`, …)
have any audit trail, and none of the finance master tables (`students`,
`batches`, `expense_categories`) do either (only the three transactional
money tables are audited).

---

## 6. Views

| View | Options | Purpose |
|---|---|---|
| `public.collections_basic` | `security_barrier = true` (explicitly not `security_invoker`) | masks `collections.account` per-row via `case when can_view_financials() or created_by = auth.uid() then account else null end`; the *only* granted read path onto collections data |
| `public.exam_questions_public` | `security_invoker = false` | omits `correct_index` entirely (column-level masking, not row-level); filtered to published exams in the caller's batch or exams they manage |

Both views exist specifically to let RLS-restricted base tables stay
locked down while still serving a masked read to less-privileged callers
— the same pattern, applied twice, for two different kinds of secret
(a *value* in one row's column vs. an *entire column* across all rows).

---

## 7. Storage

One bucket, created by `migration-academy-suite-v2b.sql`:

- **`submissions`** (private, `public: false`) — assignment-submission file
  uploads, path convention `submissions/<assignment_id>/<student_uid>/<filename>`.
  Policies on `storage.objects` scoped to `bucket_id = 'submissions'`:
  - `submissions_student_write` / `submissions_student_update`: a student
    may write/update only under their own uid's folder segment
    (`(storage.foldername(name))[2] = auth.uid()::text`).
  - `submissions_read`: the owning student, `is_staff_or_admin()`, or
    whoever `can_manage_assignment()` the parent assignment (matched via
    `(storage.foldername(name))[1]` against `assignments.id::text`).

  No delete policy on `storage.objects` for this bucket — submitted files
  can't be removed via RLS by anyone (only via the Supabase dashboard /
  service role). Files are served back via short-lived signed URLs
  generated app-side, per the migration's own comment.

No other buckets are referenced anywhere in `supabase/`.

---

## 8. Migration file index (dependency order)

| # | File | One-line summary |
|---|---|---|
| — | `schema.sql` | fresh-project baseline (see §9 for what it's missing) |
| 01 | `01_healthcare_account.sql` | adds `'Healthcare'` as a 4th `account` value on collections/expenses/income; drops legacy `paid_to`/`paid_by`/`received_via` columns |
| 02 | `02_transfers_reconciliation.sql` | creates `transfers`, `bank_statements`, `bank_statement_lines` |
| 03 | `03_admin_reports.sql` | creates `batches`, `expense_categories`; adds expense/transfer/collection delete policies |
| 04 | `04_staff_access.sql` | broadens expenses/batches/expense_categories insert+edit from admin-only to any approved user |
| 05 | `05_super_admin.sql` | adds `super_admin` role, `app_settings`, makes user-roster management super-admin-only, sets the account owner |
| 06 | `06_close_collections_view_bypass.sql` | closes the C2 finding: revokes base-table SELECT on `collections`, fixes the view's `security_invoker` mistake |
| 07 | `07_tighten_profiles_select.sql` | H4: profile roster read narrowed from any admin to super-admin only |
| 08 | `08_drop_income_table.sql` | H5: drops the unused `income` table |
| 09 | `09_audit_log.sql` | H1: adds `audit_log` + the three `*_audit` triggers |
| 10 | `10_force_password_change.sql` | M6: `must_change_password` flag + `clear_my_must_change_password()` |
| 11 | `11_assignment_resubmit_guard.sql` | H-2: removes `sub_student_update`, adds `resubmit_assignment()` RPC |
| 12 | `12_staff_or_admin_function.sql` | CRIT-1 (1/6): adds `is_staff_or_admin()` |
| 13 | `13_expense_categories_staff_insert.sql` | CRIT-1 (2/6) |
| 14 | `14_batches_staff_insert.sql` | CRIT-1 (3/6) |
| 15 | `15_students_staff_insert.sql` | CRIT-1 (4/6) |
| 16 | `16_expenses_staff_record_admin_edit.sql` | CRIT-1 (5/6) — also demotes expense *edit* from staff to admin-only |
| 17 | `17_collections_staff_insert.sql` | CRIT-1 (6/6) |
| — | `migration-academy-suite.sql` | **v1, superseded** — see §9 |
| — | `migration-academy-suite-v2.sql` | the live Academy Suite: batch/faculty scoping, timetable conflict trigger, server-side exam scoring, notifications |
| — | `migration-academy-suite-v2b.sql` | `submissions` storage bucket + `file_path` column |

Findings referenced by number/letter (C2, H1, H2, H4, H5, M6, CRIT-1) are
from [02-security-audit.md](02-security-audit.md) and the earlier
unmerged engineering review it describes — each numbered migration's own
header comment cites the finding it closes, which is how this table's
"one-line summary" column was derived; I did not re-verify each fix's
correctness here since that was already the subject of the prior security
audit and of `docs/claude-project/audits/03b-crit1-h2-fix-plan.md`.

---

## 9. Schema documentation drift

Two of the project's own reference documents describe an *earlier* state
of the database than what `supabase/` actually contains once every file is
applied in order. Concretely:

1. **`schema.sql`'s "Academy Suite" section (§11 in that file) is the v1
   schema, not what the app uses.** It creates `timetables`, `assignments`
   (`id text`), `assignment_submissions`, `exams` (`id text`),
   `exam_questions`, `exam_results`, `faculty_reviews` with simple
   `is_approved_user()`/`is_admin()` policies and no batch/faculty
   scoping, no conflict checking, and no server-side exam scoring. A
   `grep -rn '\.from("' src/` confirms the running app never queries
   `exam_results` or the v1 `assignments`/`exams` shape at all — it
   queries `timetable_slots`, `exam_attempts`, `exam_answers`,
   `faculty_batches`, `live_sessions`, `attendance`, `notifications`, none
   of which exist in `schema.sql`. **A fresh project provisioned purely
   from `schema.sql` today would be missing the entire real Academy
   Suite** and would additionally need every one of `01`–`17` (none of
   which `schema.sql` folds in either — e.g. `schema.sql`'s `collections`
   RLS still uses the pre-CRIT-1 `is_approved_user()` insert policy) plus
   both `migration-academy-suite-v2*.sql` files. `README.md` already says
   as much in its own words ("apply the NN_\*.sql files … there is no
   migration runner") but `schema.sql`'s *header comment* ("Run this once
   … it already contains everything") and `PROJECT_OVERVIEW.md`'s package
   description ("schema.sql — full DDL incl. Academy Suite + audit log —
   run ONCE on a fresh project") both overstate what pasting that one file
   actually gets you.

2. **`PROJECT_OVERVIEW.md`'s data-model table (§3) lists `income` as a
   live table** ("⚠ legacy / unused — feature removed, table + policies
   remain") — migration 08 already dropped it. The same table also
   doesn't mention `is_staff_or_admin()`, `faculty_batches`,
   `timetable_slots`, `live_sessions`, `attendance`, `exam_attempts`,
   `exam_answers`, or `notifications` at all, and says Academy Suite
   tables are "defined in `schema.sql` **and**
   `migration-academy-suite.sql`" — both of which, per point 1, describe
   the dead v1 shape.

3. **`public.timetables` (v1) is a genuinely orphaned live table**, not
   just a documentation issue. Unlike `assignments`/`exams`/`exam_questions`/
   `exam_results`/`faculty_reviews` — which v2 explicitly `drop table …
   cascade`s and rebuilds — `migration-academy-suite-v2.sql`'s own comment
   says "the old `timetables` table is left untouched; the app now uses
   `timetable_slots`." So on any project that has run both v1 and v2,
   `public.timetables` sits there, RLS-enabled, with live policies
   ("Approved users can view timetable" / "Admins can manage timetable"),
   accepting no traffic from the app and holding whatever stale rows v1
   seeded. It's dead weight, not a security hole (it's still
   RLS-protected), but it's schema clutter worth a follow-up cleanup
   migration (`drop table if exists public.timetables`) rather than a
   rename target.

4. Two structural gaps, not documentation drift but worth noting here
   since they surfaced while reading every table's columns:
   - `expenses.category` is free `text`, not FK'd to
     `expense_categories.name` — the app-level dropdown enforces the
     pairing, but the database doesn't (a direct REST insert could set
     any category string).
   - `students.batch` is free `text`, not FK'd to `batches.name` — same
     shape of gap, and inconsistent with `profiles.batch_name` /
     `assignments.batch_name` / `exams.batch_name` /
     `timetable_slots.batch_name`, which *are* all real foreign keys to
     `batches(name)`.
   - `bank_statement_lines.match_id` is inherently polymorphic
     (`match_kind` says whether it points at `collections`, `expenses`,
     or `transfers`) and so cannot be a real FK — this one is a design
     constraint of the reconciliation feature, not an oversight, but it
     does mean the database can't stop a line from being "matched" to a
     since-deleted collection/expense/transfer row.
   - `is_staff_or_admin()` is defined identically in both
     `12_staff_or_admin_function.sql` and
     `migration-academy-suite-v2.sql` — harmless (`create or replace`
     makes the second one a no-op if 12 already ran) but redundant; worth
     collapsing to one canonical definition location next time either
     file is touched.

None of the above required or received any code change — this is a
read-only inventory, flagged for whoever next touches `schema.sql`,
`PROJECT_OVERVIEW.md`, or plans the `timetables` cleanup.

---

## 10. Finance-terminology inventory (rename candidates)

Everything below is a literal identifier in the live schema (table,
column, function, policy, or trigger name) that names or alludes to
"finance" specifically, or that a generic academy/"pulse" naming pass
would need to touch. Grouped by how directly finance-flavored the name
is. This is an inventory only — **nothing was renamed.**

### 10.1 Literal "financ…" identifiers

| Object | Kind | Identifier |
|---|---|---|
| `public.profiles` | column | `can_view_financials` |
| function | function | `public.can_view_financials()` |
| function | function | `public.log_financial_change()` |
| `public.transfers` | RLS policy | `transfers_financial_viewer_select` |
| `public.bank_statements` | RLS policy | `bank_statements_financial_viewer_select` |
| `public.bank_statement_lines` | RLS policy | `bank_statement_lines_financial_viewer_select` |
| `public.audit_log` | RLS policy | `audit_log_financial_viewer_select` |
| `public.expenses` | RLS policy (dropped by migration 04, historical only) | `expenses_financial_viewer_select` |
| `public.income` (dropped) | RLS policies (gone with the table) | `income_financial_viewer_select`, `income_admin_insert`, `income_admin_update` |
| `schema.sql` | file header comment | `-- Oksy Academy Finance — Supabase schema, roles & permissions` |

### 10.2 Finance-domain nouns (no literal "financ…" substring, but the whole naming scheme is finance-specific)

These are the table/column names that *are* the finance module, and would
be the bulk of any rename to something generic:

| Object | Kind |
|---|---|
| `public.collections` | table (+ `collections_basic` view, `collections_student_id_idx`, `collections_date_idx`, every `collections_*` policy, `collections_audit` trigger) |
| `public.expenses` | table (+ `expenses_date_idx`, every `expenses_*` policy, `expenses_audit` trigger) |
| `public.expense_categories` | table (+ every `expense_categories_*` policy) |
| `public.transfers` | table (+ `transfers_date_idx`, every `transfers_*` policy, `transfers_audit` trigger, `transfers_distinct_accounts` constraint) |
| `public.bank_statements` / `public.bank_statement_lines` | tables (+ indexes, every `bank_statement*_*` policy) |
| `public.audit_log` | table (+ `audit_log_table_row_idx`, its select policy) — generically named already, but exists specifically to audit the finance tables |
| `students.registration_fee` / `course_fee` / `exam_fee` / `other_fee` / `waiver` | columns |
| `batches.course_fee` | column |
| `collections.account` / `expenses.account` / `transfers.from_account` / `transfers.to_account` / `bank_statements.account` / `bank_statement_lines.account` | columns, all sharing the `'HDFC'|'ICICI'|'Cash'|'Healthcare'` (or 3-value, for the bank tables) check-constraint vocabulary |
| `collections_admin_update`, `collections_admin_delete`, `collections_approved_select`, `collections_staff_insert` | policies |
| `expenses_admin_delete`, `expenses_approved_select`, `expenses_staff_insert`, `expenses_admin_update` | policies |
| `expense_categories_staff_insert`, `expense_categories_staff_update`, `expense_categories_admin_delete`, `expense_categories_approved_select` | policies |
| `transfers_admin_insert`, `transfers_admin_update`, `transfers_admin_delete` | policies |
| `bank_statements_admin_insert/update/delete`, `bank_statement_lines_admin_insert/update` | policies |

### 10.3 Business-specific (not generic finance vocabulary, but hardcoded and India/this-business-specific)

Not literally "finance" terminology, but flagged since a rename pass would
likely want to touch these too — they're the account *values*, not column
names, hardcoded into `check` constraints across six tables:

- `'HDFC'`, `'ICICI'` — specific real-world bank names, hardcoded into
  `collections.account`, `expenses.account`, `transfers.from_account`/
  `to_account`, `bank_statements.account`, `bank_statement_lines.account`.
- `'Healthcare'` — the related-party clearing-account name (an actual
  affiliated company, per `schema.sql`'s own comment: "an inter-company
  clearing account… between Academy and Healthcare"). This one is a
  business/entity name, not a generic term, so a generic academy/"pulse"
  rename would need a product decision (keep it configurable? keep the
  literal name? abstract it to a generic "related party" concept?) rather
  than a mechanical find-and-replace.
- File name `01_healthcare_account.sql` and its own header ("Migration
  01: 'Healthcare' becomes a payment account") — names the migration
  after this same business-specific term.

### 10.4 Outside the database proper (for completeness, not part of §10.1/10.2's scope)

Not database objects, but the same "finance" naming shows up at the
repo/product level and would need to move in lockstep with any schema
rename: the repo name `oksy-academy-finance` itself, `schema.sql`'s file
header (10.1), and (per `02-security-audit.md`) the production domain
`finance.oksyacademy.in`. Flagging only — out of scope for a database
audit to act on.

---

## 11. Summary

The schema is small (23 live tables), consistently RLS-enabled (every
single table, including the one orphaned v1 table, has `enable row level
security`), and — as of migration 17 — has closed every privilege gap the
prior security audits found (CRIT-1, C2, C3, H1, H2, H4, H5, M6 are all
represented by a specific, narrowly-scoped migration file with its own
rationale and, in several cases, an empirical verification note). The
main structural issues found by *this* audit are documentation staleness
(§9) rather than database defects: `schema.sql` and `PROJECT_OVERVIEW.md`
both describe an earlier Academy Suite than the one actually running, and
one v1 table (`public.timetables`) survives unused. The finance-naming
footprint for a future generic rename (§10) is concentrated in a
predictable, well-bounded set: five tables that *are* the finance module
(`collections`, `expenses`, `expense_categories`, `transfers`,
`bank_statements`/`bank_statement_lines`), one boolean column and its
matching function/policy family (`can_view_financials`), one audit
function/trigger name (`log_financial_change`), and the hardcoded
`'HDFC'/'ICICI'/'Healthcare'` account vocabulary shared across six check
constraints.
