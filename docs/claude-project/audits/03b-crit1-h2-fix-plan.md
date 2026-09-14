# Fix Plan — C-1/"CRIT-1" (forgeable financial records) and H-2 (assignment self-grading)

Date: 2026-09-14
Status: **PLAN ONLY.** No SQL, trigger, function, or application code was
written or changed by this task. Every code block below is either (a) a
quote of code that already exists, or (b) an illustrative sketch explicitly
requested by the task brief for review — none of it was executed or saved
as a migration file. This document is scoped input for a follow-up
implementation task (Step 3c), gated on the open product questions in §1.4
and §3.2 being answered by a human first.

---

## 0. Notes on sources (read this first)

**a. `docs/audits/02-security-audit.md` is not committed anywhere.** As
[`02b-branch-reconciliation.md`](02b-branch-reconciliation.md) (§0.c)
already documented, it exists only as an untracked file in the working tree
of the `claude/security-audit-findings-d9d51c` worktree
(`/Users/anoopdasvs/oksy-academy-finance/.claude/worktrees/security-audit-findings-d9d51c/docs/audits/02-security-audit.md`).
That worktree still exists on disk, so I read it directly from there. Its
C-1 ("CRIT-1" in this task's wording) and H-2 findings are the ones this
plan addresses; I independently re-verified both against the live
`supabase/schema.sql` and `supabase/migration-academy-suite-v2.sql` rather
than trusting the audit text alone (see §1 and §2 below).

**b. `docs/claude-project/CLAUDE_PROJECT_CONTEXT.md`, `SECURITY_REQUIREMENTS.md`,
and `DEVELOPMENT_AND_TESTING_RULES.md` do not exist** — not on `main`, not on
any branch, not uncommitted in any worktree (`git ls-tree -r --name-only main`
and `git log --all --diff-filter=A` both confirm no file at these paths was
ever added on any ref; same gap `02b` already flagged for a related set of
filenames). In their place I used, as `02b` did:
- [`PROJECT_OVERVIEW.md`](../../../PROJECT_OVERVIEW.md) for the role model,
  feature/permission matrix (§5), and data model (§3).
- [`AGENTS.md`](../../../AGENTS.md) for the closest thing to a migration
  philosophy: "Database Changes: Always add SQL DDL scripts to `supabase/`
  before updating UI layers" and "never auto-apply schema changes, propose
  them" (`PROJECT_OVERVIEW.md:9`).
- `src/lib/access.js`, the actual UI components, and `supabase/schema.sql` /
  `supabase/migration-academy-suite-v2.sql` as the ground truth for intended
  access, per the task's own instruction to derive intent from code, not
  invent it.

**c. `fix/security-integration-2026-09-14` merged into `main` while this
task was running.** The task asked me to check whether it had merged yet
and read `schema.sql` from whichever ref is actually live. At the start of
this task it was unmerged (`main` at `a9bd421`); partway through, `main`
advanced to `26fed53` ("Merge pull request #6 from
Anoopdas-vs/fix/security-integration-2026-09-14"), one commit after
`9d598f2` ("fix: restore student/faculty/professional to create-user
ASSIGNABLE list" — the exact regression fix `02b`§5 recommended before that
merge). **All schema/code reads below are against `main`'s current tip
(`26fed53`)**, fetched via `git show main:<path>` rather than relying on
this worktree's own (now one-commit-stale) checkout, so nothing here is
based on the superseded `fix/security-integration-2026-09-14` branch in
isolation. Re-running `git diff main..26fed53 -- supabase/schema.sql`
confirms the C-1 policies and the H-2 policy are **byte-identical** before
and after that merge — the merge fixed C-2/C-3/H-1/H-3 (per `02b`§3) and the
`ASSIGNABLE_ROLES` regression, but never touched C-1 or H-2, exactly as
`02b`§6 predicted. This plan is current as of that merged state.

---

## 1. C-1 / "CRIT-1" — broad insert/update on students, collections, expenses, batches, expense_categories

All five tables currently gate `insert`/most `update` policies on
`public.is_approved_user()` alone (`supabase/schema.sql`), which checks only
`profiles.is_approved`, never `role`. Any approved login — including
`student`, `faculty`, `professional` — can call the Supabase REST endpoint
directly (bypassing the React UI and its tab/button gating entirely) and
write to these tables.

For each table: who the *code* says should legitimately write to it, the
predicate that would enforce that, whether an ownership column already
exists, and any genuine open product question.

### 1.1 `students`

**a. Intended access (from code):**
- `EnrollmentPage.jsx` renders unconditionally whenever `activeTab ===
  "Enrollment"` (`src/App.jsx:1360-1383` render block) and has **no**
  `canEdit`/`canDelete`/role prop at all — confirmed by grep, no match for
  any of those identifiers in `src/pages/EnrollmentPage.jsx`. Both the "Add"
  and "Edit" paths (`onSave={saveStudent}`, line 1379) call the same
  handler, which itself has no role check (`src/App.jsx:517-561` —
  `insertNewStudent`/`upsertStudent` at lines 550/552).
- The "Enrollment" area is in `DEFAULT_ROLE_AREAS` for `admin`
  (`src/lib/access.js:48`) and `staff` (`src/lib/access.js:64`) only — **not**
  `student`, `faculty`, or `professional` (`src/lib/access.js:55-56,70`).
- Conclusion: the UI's intended writers are **admin + staff** ("Executive"),
  with no ownership distinction — any staff/admin may edit any student's
  row. This matches the cross-student logic in the handler itself (e.g.
  `waiverForDrop` at `src/App.jsx:538-545` computes off *other* students'
  `collections`, which only makes sense for a role managing the whole
  roster, not a row owner).

**b. Predicate:** `public.is_staff_or_admin()` for both insert and update.
This function already exists — defined in
`supabase/migration-academy-suite-v2.sql:34-38` for exactly this "Executive
(staff) + Admin + Owner" tier — no new function needed.

**c. Ownership column:** `created_by` and `updated_by` already exist
(`supabase/schema.sql:122,124`) and are already populated by
`insertNewStudent`/`upsertStudent` (`src/lib/data.js:14-35`). No migration
needed to add columns; not needed for this predicate anyway since it isn't
ownership-based.

**d. Open question:** none for the base insert/update predicate — the code
evidence is unambiguous. But flagging a related, **out-of-scope-for-this-fix**
gap: `students.waiver` and `students.status` (which directly zero out a
student's receivable — `src/App.jsx:540-545`) are bundled into the same row
and the same policy as routine roster fields (name, course, batch), with no
column-level separation. Today any staff member who can edit enrollment can
also null out a balance via `waiver`, same as `collections`/`expenses`
editing is admin-gated but `students` editing is not. Whether that's
intentional (staff commonly process drops) or should be split into a
narrower, admin-only path for `waiver`/`status` specifically is a genuine
product question — **not answered here**, and would need an H-2-style
column-restricting mechanism if the answer is "split it," not a simple RLS
predicate change.

### 1.2 `collections`

**a. Intended access (from code):**
- **Insert:** `addCollection` (`src/App.jsx:563-634`, calling
  `insertCollection` at line 588) runs unconditionally whenever
  `activeTab === "Fee Collection"` — no role check in the handler. That tab
  is in `DEFAULT_ROLE_AREAS` for `admin` (`src/lib/access.js:49`) and
  `staff` (`src/lib/access.js:65`) only.
- **Update/delete:** `FeeCollectionPage` receives `canEdit={access.canEditRecords}`
  and `canDelete={access.canDelete}` (`src/App.jsx:1397-1398`), both defined
  as `isAdmin` in `src/lib/access.js:113-114` ("edit / delete fee
  collections, expenses"). **This already matches the current RLS**:
  `collections_admin_update`/`collections_admin_delete`
  (`supabase/schema.sql:176-180`) are already `is_admin()`-gated. **No C-1
  gap on collections update/delete** — only `collections_approved_insert`
  (`supabase/schema.sql:173-174`, still `is_approved_user()`) is the hole.

**b. Predicate:** `public.is_staff_or_admin()` for insert, to match the Fee
Collection tab's default area gating — **but see 1.2.d, this is the
highest-stakes call in the whole plan and should not be taken as settled
without explicit confirmation.**

**c. Ownership column:** `created_by` already exists
(`supabase/schema.sql:157`) and is populated by `insertCollection`
(`src/lib/data.js:61-69`). The masking view `collections_basic` already
uses `created_by = auth.uid()` as an ownership check
(`supabase/schema.sql:212`) — precedent that this column is trustworthy for
policy use if a narrower predicate is ever wanted.

**d. Open question — needs a human decision, explicitly not inferred here:**
Should **staff** (non-admin) be allowed to insert fee collections at all, or
should insert be **admin-only**, matching how update/delete already are?
`DEFAULT_ROLE_AREAS` says staff should (they have "Fee Collection" by
default), and PROJECT_OVERVIEW.md:156 ("Record payment... payment history
with edit/delete (admin)") reads as "recording is broader than editing" by
omission — but this is the single highest-value forgery target in the whole
audit (this literally creates money owed to the Academy), so getting the
answer to "staff-insert intended, yes or no" from a person before writing
the migration is worth the pause. Separately: **no workflow anywhere in the
codebase supports a student submitting their own payment for admin
approval** — no "pending"/"unapproved" status column on `collections`, no
approval-queue UI, `collections_approved_select`/`_basic` view has no
concept of unapproved rows. So the specific question the task background
raises ("should a student ever submit their own fee payment for approval")
has a clear **no** from the code as it stands today — but that's a
statement about current code, not a product decision either way about
whether such a feature should be *built*. Recommend explicit sign-off on
"insert = staff-or-admin, no student self-pay path" before implementing.

### 1.3 `expenses`

**a. Intended access (from code) — and a real intent conflict:**
- **Insert:** `addExpense` (`src/App.jsx:636-663`, `insertExpense` at line
  652) is unconditional within the "Expenses" tab, default-visible to
  `admin` (`src/lib/access.js:50`) and `staff` (`src/lib/access.js:66`) only.
- **Update/delete:** `ExpensesPage` receives `canEdit={access.canEditRecords}`,
  `canDelete={access.canDelete}` (`src/App.jsx:1415-1416`) — both `isAdmin`
  (`src/lib/access.js:113-114`), and PROJECT_OVERVIEW.md:157 says "edit/delete
  (admin)" explicitly.
- **But `supabase/schema.sql:248`'s own comment says the opposite:** *"Any
  approved user may see, add and edit expenses; only admins delete"* —
  matching the current (too-broad) `expenses_approved_update` policy
  (`supabase/schema.sql:255-256`), which is `is_approved_user()`, not
  `is_admin()`. **The SQL comment and the actual UI/PROJECT_OVERVIEW.md
  intent directly disagree** — the same shape of discrepancy `02b`§5 found
  between the `create-user` Edge Function comment and `access.js`'s
  `ASSIGNABLE_ROLES`. I'm not resolving this by picking one; see 1.3.d.

**b. Predicate:** insert → `public.is_staff_or_admin()`. Update → `public.is_admin()`
**if** the UI/PROJECT_OVERVIEW.md intent is the one to keep (this would also
be a genuine tightening beyond just closing the role gap — it removes
"approved but not staff/admin" from update entirely, matching what the UI
already enforces).

**c. Ownership column:** `created_by`/`updated_by` already exist
(`supabase/schema.sql:240,242`), populated by `insertExpense`/`updateExpense`
(`src/lib/data.js:82-104`).

**d. Open question — needs a human decision:** which of the two
already-documented-but-conflicting intents is correct — the `schema.sql:248`
comment ("any approved user may edit"), or the UI + PROJECT_OVERVIEW.md
("admin only edit")? Given the UI has enforced admin-only edit since it was
written (no `canEdit` other than `isAdmin` ever existed in the render path),
my inclination is that the SQL comment is the stale one — but "my
inclination" is exactly the kind of guess the task says not to make. Flag
for explicit confirmation before the migration is written, since it changes
who can edit existing expense rows, not just close a gap.

### 1.4 `batches`

**a. Intended access (from code):**
- **Insert:** `Batches` component's "Add Batch" form
  (`src/pages/AdminPage.jsx:176-204`) is ungated — reachable by anyone who
  can open the "Admin" tab (default `admin`/`staff` only,
  `src/lib/access.js:53,68`). Matches PROJECT_OVERVIEW.md:160: *"Batches &
  Categories CRUD (create for all approved; edit/delete admin)"* —
  literally documented as intentionally open beyond staff/admin, gated only
  by tab visibility.
- **Update/delete:** "Edit"/"Delete" buttons are both gated by
  `canDelete` (`src/pages/AdminPage.jsx:223-238`), which is
  `access.canDelete` = `isAdmin` (`src/App.jsx:1467`,
  `src/lib/access.js:114`). **Mismatch:** `batches_approved_update`
  (`supabase/schema.sql:377-378`) is still `is_approved_user()`, not
  `is_admin()` — any approved user can directly PATCH a batch via REST even
  though the UI never shows them an Edit control.

**b. Predicate:** update → `public.is_admin()` (clear win, matches both the
UI and PROJECT_OVERVIEW.md, no open question). Insert → see 1.4.d.

**c. Ownership column:** `created_by` exists (`supabase/schema.sql:369`);
no `updated_by` column on `batches`, but not needed since the recommended
predicate (`is_admin()`) isn't ownership-based.

**d. Open question:** PROJECT_OVERVIEW.md explicitly documents batch
creation as "for all approved," which is broader than `is_staff_or_admin()`
— but that's presumably describing the *reachable* behavior today (gated
only by whether the Owner has given a role the "Admin" tab), not necessarily
an endorsement that literally any approved login should be able to insert a
batch via direct REST call regardless of tab config. Two defensible options:
(i) keep insert as `is_approved_user()`, matching the doc literally, and
accept that defense-in-depth against a REST-level attacker is weaker here;
or (ii) tighten insert to `is_staff_or_admin()` too, on the theory that
"create for all approved" was describing "no *extra* restriction beyond
reaching the tab" rather than a deliberate choice to trust every role.
Recommend confirming intent rather than guessing — this table has lower
blast radius than `collections`/`expenses` (a forged batch doesn't move
money by itself, though it does seed `course_fee` defaults used at
enrollment), so it's a lower-priority open question than 1.2.d.

### 1.5 `expense_categories`

**a. Intended access (from code):**
- **Insert:** "Add Category" (`src/pages/AdminPage.jsx:262-286`) is
  ungated, same shape as batches — matches PROJECT_OVERVIEW.md:160's "create
  for all approved."
- **Update:** `renameExpenseCategory` (`src/lib/data.js:208-214`) — the
  function `expense_categories_approved_update` exists to authorize — **has
  no caller anywhere in the UI.** Grepped `src/pages/AdminPage.jsx`'s
  `Categories` component in full: only "Add" (insert), "Merge"
  (`mergeCategory`, gated `canDelete`), and "Delete" (gated `canDelete`) are
  exposed; there is no "Rename" button. So `expense_categories_approved_update`
  is dead UI surface — it exists purely as an unused, currently-too-broad
  attack surface reachable only via a direct REST call.
- **Delete:** gated `canDelete` = `isAdmin` in the UI
  (`src/pages/AdminPage.jsx:304-320`); RLS already matches
  (`expense_categories_admin_delete`, `is_admin()`,
  `supabase/schema.sql:400-401`).

**b. Predicate:** insert → same open question as 1.4.d (batches), same
reasoning, recommend resolving both the same way for consistency. Update →
`public.is_admin()` is a safe, high-confidence tightening with **zero**
functional risk, since nothing in the app currently calls
`renameExpenseCategory` — this one doesn't need to wait on a product
decision.

**c. Ownership column:** `created_by` exists (`supabase/schema.sql:390`).

**d. Open question:** only the insert-predicate question shared with 1.4.d.

### 1.6 Summary table

| Table | Current insert | Current update | Recommended insert | Recommended update | Needs human decision? |
|---|---|---|---|---|---|
| `students` | `is_approved_user()` | `is_approved_user()` | `is_staff_or_admin()` | `is_staff_or_admin()` | No (base predicate); yes for the separate waiver/status column-split question (§1.1.d, out of scope for this fix) |
| `collections` | `is_approved_user()` | already `is_admin()` (fine) | `is_staff_or_admin()` — **pending confirmation** | no change | **Yes — highest priority (§1.2.d)** |
| `expenses` | `is_approved_user()` | `is_approved_user()` | `is_staff_or_admin()` | `is_admin()` — **pending confirmation** | **Yes (§1.3.d)** |
| `batches` | `is_approved_user()` | `is_approved_user()` | pending (§1.4.d) | `is_admin()` | Yes, lower priority |
| `expense_categories` | `is_approved_user()` | `is_approved_user()` (unused) | pending (§1.5.d, same as batches) | `is_admin()` | Yes for insert only, no functional risk on update |

All five tables already have `created_by`; no column-adding migration is
needed for any of the predicates above — they only require `create or
replace policy` / `drop policy` + `create policy` statements swapping the
predicate function. (Not written here — Step 3c's job.)

**Rollout-order note carried forward to §4:** because `is_staff_or_admin()`
is defined in `migration-academy-suite-v2.sql:34-38`, not in `schema.sql`
itself, any fix migration for these five tables must be written to run
*after* `migration-academy-suite-v2.sql` (as an additional
`supabase/migration-*.sql` file, per `AGENTS.md:27`'s "Database Changes:
Always add SQL DDL scripts to `supabase/`" convention) — it cannot simply
edit the policy definitions in place inside `schema.sql`, because a fresh
install runs `schema.sql` before `migration-academy-suite-v2.sql` exists,
and `is_staff_or_admin()` wouldn't be defined yet at that point in the
script. Worth a mention in the eventual PR description, not a blocker.

---

## 2. H-2 — assignment self-grading column gap

### 2.1 The gap, re-verified

`sub_student_update` (`supabase/migration-academy-suite-v2.sql:261-264`):

```sql
create policy "sub_student_update" on public.assignment_submissions
  for update to authenticated
  using (student_id = auth.uid() and status = 'submitted')
  with check (student_id = auth.uid() and status = 'submitted');
```

Both `using` and `with check` only constrain *which row* (own row, still
`submitted`) — Postgres RLS has no column-level predicate, so once a row
passes that check, the student's `UPDATE` may set **any** column, including
`marks`, `feedback`, `graded_by`, `graded_at` — while leaving `status`
untouched (since `with check` still requires `status = 'submitted'`, so they
can't fake `graded` themselves, but they can plant marks/feedback on a
still-`submitted` row that a grader will read later, or that the frontend
might display optimistically).

### 2.2 Every current writer of `assignment_submissions` (§ per task's 2b)

Grepped `src/` in full for `assignment_submissions` and its data-layer
functions (`src/lib/academy.js` — the only file with `.from("assignment_submissions")`
calls):

| Function | File:line | Caller | Columns written | Relies on policy |
|---|---|---|---|---|
| `fetchSubmissions` | `src/lib/academy.js:116-121` | `AssignmentsPage.jsx` | (read only) | `sub_read` |
| `submitAssignment` | `src/lib/academy.js:123-142` | `AssignmentsPage.jsx:144` | `assignment_id, student_id, link, notes, file_path, is_late, submitted_at, status:'submitted'` — via `.upsert(..., {onConflict:"assignment_id,student_id"})`, so it needs **both** `sub_student_insert` (new row) **and** `sub_student_update` (re-submission / conflict-update branch) | `sub_student_insert`, `sub_student_update` |
| `gradeSubmission` | `src/lib/academy.js:163-177` | `AssignmentsPage.jsx:153` | `marks, feedback, status:'graded', graded_by, graded_at` | `sub_grader_update` |

No other code path writes to this table. Two things this confirms:
- `submitAssignment`'s **legitimate** use of the update policy (the upsert's
  conflict branch, i.e. a student editing their own not-yet-graded
  submission before resubmitting) never touches `marks`/`feedback`/
  `graded_by`/`graded_at` — so a column restriction costs it nothing.
- There is **no "resubmitted" status** in the current schema — `status`'s
  check constraint is `in ('submitted','graded','returned')`
  (`migration-academy-suite-v2.sql:214`). The task background's example
  ("submitted -> resubmitted") describes the *shape* of a transition, not a
  literal status value that exists today; the real transition a student
  needs is "edit my own still-`submitted` row" (which the current
  `sub_student_update` row-predicate already correctly scopes), not a status
  change at all. I'm flagging this so Step 3c doesn't go looking for a
  `resubmitted` enum value that isn't there — if the product wants a real
  "resubmitted" state, that's a separate, larger change (new enum value,
  design for what re-opens grading) outside this task's scope.

### 2.3 Precedent: `score_exam_attempt()`

`supabase/migration-academy-suite-v2.sql:405-439`, called from
`src/lib/academy.js:257` (`supabase.rpc("score_exam_attempt", ...)`). Shape:
a `security definer` function that (a) re-checks ownership itself
(`if a.student_id <> auth.uid() then raise exception`), (b) computes
trusted values entirely server-side from `exam_questions.correct_index`
(never taking a score as a parameter), and (c) is the **only** way those
columns get written — `exam_attempts` has **no** student-facing `update`
policy at all (only `attempt_read` and `attempt_student_insert` exist for
students; grep confirms no `attempt_student_update`). Students literally
cannot `UPDATE` `exam_attempts` directly, by any column, under any
condition — the RPC is the sole write path for the scored columns.

### 2.4 Proposed mechanism (sketch — not a migration to run)

Two options, following that precedent to different degrees:

**Option A — RPC replaces `sub_student_update` entirely (closest to the
`score_exam_attempt()` precedent).** Give students **zero** direct `UPDATE`
grant on `assignment_submissions` (drop `sub_student_update`, matching how
`exam_attempts` has no student update policy at all), and move the
resubmission branch of `submitAssignment` into a `security definer` RPC:

```sql
-- ILLUSTRATIVE SKETCH ONLY — not proposed for execution by this task.
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
     set link = p_link, notes = p_notes, file_path = p_file_path,
         is_late = p_is_late, submitted_at = now()
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
```

The function body never references `marks`, `feedback`, `graded_by`, or
`graded_at`, so there is no code path by which a student-invoked call can
set them — structurally, not just by policy. `sub_student_insert` (the
*first*-submission path) can stay a direct policy exactly as `exam_attempts`
keeps `attempt_student_insert` as a direct policy and only wraps the
*scoring* transition in an RPC — `submitAssignment` in `academy.js` would
branch: first submission → direct `.insert()` (still policy-gated by
`sub_student_insert`), later edits → `.rpc("resubmit_assignment", ...)`. Or,
simpler for the frontend, always call the RPC and have it `INSERT ... ON
CONFLICT DO UPDATE` itself (one code path instead of two) — a Step 3c
implementation detail either way.

**Option B — keep the row-level policy, add a column-guarding trigger.**
Leave `sub_student_update` as-is (or fold with 1.1-style tightening if
useful), and add a `before update` trigger on `assignment_submissions` that
raises if a non-grader's statement changes `marks`, `feedback`, `graded_by`,
`graded_at`, or `status`:

```sql
-- ILLUSTRATIVE SKETCH ONLY — not proposed for execution by this task.
create or replace function public.guard_submission_grading_columns()
returns trigger language plpgsql as $$
begin
  if (new.marks is distinct from old.marks
      or new.feedback is distinct from old.feedback
      or new.graded_by is distinct from old.graded_by
      or new.graded_at is distinct from old.graded_at
      or new.status is distinct from old.status)
     and not exists (
       select 1 from public.assignments a
       where a.id = new.assignment_id and public.can_manage_assignment(a)
     )
  then
    raise exception 'only a grader may change grading fields';
  end if;
  return new;
end;
$$;
create trigger assignment_submissions_guard_grading
  before update on public.assignment_submissions
  for each row execute function public.guard_submission_grading_columns();
```

This needs zero frontend changes (the existing `.upsert()` call in
`submitAssignment` never touches those columns, so it's unaffected), and
`sub_grader_update`'s own row-predicate still gates *which* rows a grader
may touch — the trigger only adds the column check for the non-grader path.
Weaker alignment with "follow the `score_exam_attempt()` precedent" as
literally asked, and it leaves a raw `UPDATE` grant on the table for
students (relying on the trigger firing correctly under every future code
path), rather than removing the grant structurally the way `exam_attempts`
does.

**Recommendation:** Option A, per the task's explicit instruction to follow
the `score_exam_attempt()` pattern — it's the same shape already proven to
work in this schema, and it removes the column-guard requirement instead of
adding one (nothing to keep in sync if new grading columns are added later,
whereas Option B's trigger would need updating every time). Option B is
included as a lower-migration-effort fallback if Step 3c or a reviewer
prefers not to touch `academy.js`'s call sites.

---

## 3. Existing test coverage and what's needed

### 3.1 Existing coverage

`npm test` runs Node's built-in test runner
(`PROJECT_OVERVIEW.md:25` / `AGENTS.md:20`) against exactly two files:
`src/lib/fees.test.js` and `src/lib/reconcile.test.js`. Both are **pure
client-side unit tests** of computation functions (`grossFee`,
`effectiveFeeDue`, `outstanding`, `waiverForDrop`, `accountBalance`,
`studentFeeTotals` in `fees.test.js`; `accountLedger`, `bookBalanceAsOf`,
`autoMatch`, `reconciliationSummary` in `reconcile.test.js`) — confirmed by
listing every `describe`/`it` block in both files. **There is no test of
any kind for RLS policies, Supabase Edge Functions, or database-level
access control** — no `e2e` directory, no `*rls*` file, no CI workflow (`grep`/`find`
across the repo for any of these returns nothing), no local Supabase test
harness or `supabase/config.toml`. Confirmed directly relevant to this
task: `studentFeeTotals` (`src/lib/fees.js:57-76`) sums every `collections`
row for a student unconditionally — no filter on who inserted it, no
"unapproved" concept — exactly the "fees.js trusts every collections row
equally" trust model the task background describes, and there is currently
zero automated check that a forged row would be caught or flagged anywhere
downstream.

### 3.2 New tests needed (checklist, not written)

**For C-1 (per table, ×5 — students/collections/expenses/batches/expense_categories):**
- [ ] Policy-level (needs a DB-level test harness — none exists today, see
  below): as each disallowed role (student, faculty, professional, and for
  the update-only tables also plain staff where update is now admin-only),
  attempt direct `insert`/`update` via the Supabase client with that role's
  JWT and assert `permission denied` / 0 rows affected.
  - [ ] Positive case: confirm the intended role (staff-or-admin, or
    admin-only per the resolved open questions in §1) still succeeds.
  - [ ] Regression case for `collections`/`expenses`: confirm `admin` can
    still update/delete (already covered by current policy, must not
    regress).
- [ ] Application-level: since none of the write functions in
  `src/lib/data.js` do their own role check, add unit tests asserting the
  functions still shape payloads correctly (they will — role enforcement
  moves entirely to the DB) — lower priority, mainly to catch someone later
  "fixing" a perceived bug by adding a client-side check that masks a
  server-side denial with a misleading error.
- [ ] Manual/documented verification step (per `PROJECT_OVERVIEW.md`'s "the
  database is live on Supabase... never auto-apply schema changes, propose
  them," line 8-10): a runbook entry showing the exact `curl`/Supabase-JS
  snippet a reviewer can run against a staging project pre- and post-fix to
  observe the 403 flip, since there's no CI to encode this in yet.

**For H-2:**
- [ ] Student calling the new RPC (`resubmit_assignment` if Option A) on
  their own `submitted` row: succeeds, only the intended columns change.
- [ ] Student calling the new RPC on someone else's row: fails / 0 rows.
- [ ] Student calling the new RPC on their own already-`graded` row: fails
  with the "already graded" exception, confirming grades can't be
  clobbered by a "resubmission."
- [ ] Student attempting a **raw** `PATCH .../assignment_submissions?id=eq....`
  with `{marks: 100}` directly via REST (bypassing `academy.js` entirely) on
  their own `submitted` row: must now fail (this is the actual exploit path
  the finding describes — a test must hit the table directly, not just call
  `submitAssignment`/`resubmit_assignment`, or it won't catch a regression).
- [ ] `gradeSubmission` (grader path, `sub_grader_update`) unaffected:
  faculty/admin/monitor can still set `marks`/`feedback`/`status`/`graded_by`/
  `graded_at` on a row they can manage.
- [ ] Regression: `submitAssignment`'s first-submission (`insert`) path
  still works end-to-end through `AssignmentsPage.jsx`.

**Infrastructure gap to flag, not solve here:** none of the above can be
automated with the current `node --test` setup, which has no Supabase
connection at all. Step 3c (or a separate infra task) needs to decide
between (a) a local Supabase instance (`supabase start`) spun up in CI/dev
for policy tests, (b) a scripted-but-manual verification runbook against a
disposable staging project (closest to what `02b`§3 did by hand for C-2),
or (c) deferring automated DB-policy testing indefinitely and relying on
manual pre-deploy verification. This is a real gap worth a human decision,
not something to default into silently.

---

## 4. Proposed rollout order

Per `AGENTS.md:27-29` ("Database Changes: Always add SQL DDL scripts to
`supabase/` before updating UI layers... Verification First... Production
Sync: commit + push to `origin main` over SSH") and `PROJECT_OVERVIEW.md:8-10`
("never auto-apply schema changes, propose them"), and the fact that this
is a **live production** database (`finance.oksyacademy.in`) with hand-run
migrations and no rollback tooling beyond manual `DROP POLICY`/`CREATE
POLICY` (`PROJECT_OVERVIEW.md:193-195`, "no version table — the live DB has
drifted through partial re-runs"):

**Step 0 — resolve the open questions first (§1.2.d, §1.3.d, §1.4.d/§1.5.d
shared question).** These aren't implementation details; a wrong guess
here either breaks a real workflow (staff can no longer record payments) or
ships a fix that's narrower than intended. Do not start writing SQL before
these are answered.

**Step 1 — H-2 first, not C-1.** Smaller blast radius (one table, one
already-clear predicate design, no open product questions), and it's fully
decidable from code alone per §2 — no reason to wait on anything. Also
lower risk: assignment grading integrity affects academic records, not live
money movement, so a mistake here is more recoverable than a mistake in the
`collections` policy.
- Test against a disposable Supabase project (or a branch/fork of the
  production schema, never production directly) using the §3.2 H-2
  checklist.
- Rollback: a single `drop function`/`drop trigger` + re-`create policy
  "sub_student_update"` with the original predicate restores exactly the
  pre-fix state — trivial and fully reversible, no data migration involved
  (no columns added, no data reshaped).

**Step 2 — C-1, table by table, lowest-risk first:**
1. `expense_categories` update (§1.5) — zero functional risk (dead UI
   surface), do this one immediately, no open question blocking it.
2. `batches` update (§1.4.b) — matches UI/docs unambiguously, no open
   question blocking the *update* half (only insert is undecided).
3. `students` (§1.1) — single predicate change
   (`is_approved_user()` → `is_staff_or_admin()`), both insert and update,
   no open question.
4. `expenses` — **after** §1.3.d is resolved.
5. `collections` — **after** §1.2.d is resolved; do this **last**, since
   it's the highest-value target and benefits most from every other
   table's fix already having been tested and stable first, establishing
   confidence in the rollout process before touching the most sensitive
   table.
6. `batches`/`expense_categories` insert — after the shared §1.4.d/§1.5.d
   question is resolved (lowest priority of all six changes; can trail the
   others).

**Per-table test-before-production:** for each policy change, run the
corresponding §3.2 checklist item against a non-production copy first
(staging Supabase project or a scratch project seeded from an anonymized
export — never test permission changes against the live project directly,
per `PROJECT_OVERVIEW.md:8-10`'s "never auto-apply schema changes"
instruction extended to mean "never experiment against production" too).

**Rollback plan (uniform across all C-1 changes):** every change in this
plan is a `drop policy` + `create policy` pair with **no `alter table`, no
column addition, no data migration** (§1.6 confirms all needed columns
already exist) — so every single change is a one-statement-pair, fully
reversible, non-destructive operation. This satisfies the "reversible,
data-preserving, tested" migration philosophy implied by `AGENTS.md`'s
"Verification First" step and `PROJECT_OVERVIEW.md`'s "propose, don't
auto-apply" guidance (the closest available substitute for the
`DATABASE_AND_ARCHITECTURE_RULES.md` this task asked me to cite, which does
not exist in this repository — see §0.b). No table needs to be taken
offline, no existing row needs to change, and each table's fix can be
deployed and, if needed, reverted independently of the others.

---

## 5. Explicitly out of scope for this task

Per the task's own instruction: no SQL migration, trigger, function, or
application code change was written for execution. Everything above is
input for a human to (a) answer the open questions in §1.2.d, §1.3.d, and
§1.4.d/§1.5.d, and (b) hand to a Step 3c implementation task once answered.
