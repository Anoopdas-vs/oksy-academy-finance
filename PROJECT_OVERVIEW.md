# Oksy Academy Portal — Project Overview

All-in-one academy management system (LMS + ERP + finance) for Oksy Academy
LLP. Live at **finance.oksyacademy.in** (migrated to
**pulse.oksyacademy.in**).

> **For anyone (or any AI tool) picking this up:** read this file first.
> The database is **live on Supabase** and migrations are hand-run SQL in
> `supabase/` — never auto-apply schema changes, propose them. Never touch
> `.env` or commit any service-role key / OAuth secret.

---

## 1. Tech stack

| Layer | Tech | Version |
|---|---|---|
| UI | React | ^19.2 (no React Compiler) |
| Build | Vite | ^8.2 — needs **Node ≥ 20.19 / 22.12** |
| React plugin | @vitejs/plugin-react | ^6.1 |
| Lint | oxlint | ^1.79 (`npm run lint`) |
| Charts | recharts | ^3.10 |
| Excel I/O | xlsx (SheetJS) | ^0.18 |
| Backend SDK | @supabase/supabase-js | ^2.45 |
| Tests | `node --test` | `npm test` → `src/lib/*.test.js` (`fees.test.js`, `reconcile.test.js`) |
| Language | JavaScript + JSX | **no TypeScript** |
| Node | pinned | `engines.node >= 20.19` + `.nvmrc` |
| Routing | none — tab state in `src/App.jsx` (`activeTab`) |
| Styling | one hand-written `src/App.css` (~2700 lines), CSS variables |

**Backend** = Supabase (managed Postgres + Row-Level Security + Auth). One
server-side function (`supabase/functions/create-user`). No Node/API server,
no ORM.

Scripts: `npm run dev` · `npm run build` · `npm run preview` · `npm run lint` · `npm test`.

---

## 2. Directory map

```
src/
  App.jsx (~1470 loc)      all state, data handlers, totals math, nav, render
  App.css (~2700 loc)      entire stylesheet
  context/
    AuthContext.jsx         AuthProvider — Supabase auth + profile load + getAccess
    authContext.js          the React context object (split out for fast-refresh)
    useAuth.js              the useAuth() hook
  components/
    Login.jsx              email/pw + Google OAuth + password reset
    ForcePasswordChange.jsx shown instead of the app when must_change_password is true
    ui.jsx                  formatMoney, MetricCard, Input, Modal, StatusBadge…
    SearchPager.jsx         SearchBox + Pager
    PeriodFilter.jsx        All time / This FY / This month / Custom range
    ImportPreviewModal.jsx  bulk-import review dialog
    Receipt.jsx             printable fee receipt (browser print / Save PDF)
    StudentPicker.jsx       type-ahead student selector (by ID or name)
    StaffAccess.jsx         approve users, set role + financial access
  pages/
    Dashboard.jsx           "Academy Pulse" home
    TimetablePage.jsx       weekly class schedule
    LiveClassPage.jsx       join / launch live classes (Jitsi)
    AssignmentsPage.jsx     assignments + submissions + grading
    ExamsPage.jsx           online MCQ exams + results
    ReviewsPage.jsx         faculty / academic reviews
    EnrollmentPage.jsx      student master
    FeeCollectionPage.jsx   record / edit / delete fee payments
    ExpensesPage.jsx        record / edit / delete expenses
    BankingPage.jsx         Transfers + Bank Reconciliation (sub-tabs)
    ReportsPage.jsx         report registry + preview / Excel / print
    AdminPage.jsx           Batches / Categories / Users / Access (sub-tabs)
  lib/
    supabaseClient.js       createClient from VITE_ env
    data.js (~330 loc)      ALL finance DB reads/writes — the "API layer"
    academy.js              Academy Suite DB layer (timetable, live class,
                            assignments, exams, reviews, notifications)
    access.js               roles, labels, per-role area permissions
    fees.js                 canonical fee + account-balance math
    fees.test.js            node:test coverage for fees.js
    period.js               date-range resolution
    reconcile.js            auto-match statement lines ↔ transactions
    reconcile.test.js       node:test coverage for reconcile.js
    bankStatement.js        parse uploaded bank-statement Excel (dynamic xlsx)
    reports.js              report definitions + xlsx export (dynamic xlsx)
    templates.js            xlsx template download (dynamic xlsx)
    format.js               formatMoney and shared formatters
    validation.js           form validators + friendly error text
    usePagedList.js         client-side search + pagination hook
supabase/
  schema.sql               full DDL incl. Academy Suite + audit log — run ONCE
                           on a fresh project
  NN_*.sql (01-10)         security/audit hardening patches for an existing
                           pre-schema.sql project, run in NUMERIC order (the
                           number is the dependency order, not just a filename)
  migration-academy-suite*.sql
                           the real Academy Suite patches for an existing
                           project: batch/faculty scoping, RLS, server-side
                           exam scoring (v2), submission-file Storage bucket
                           (v2b) — apply these too if the project predates
                           schema.sql's current state
  functions/create-user/    Deno Edge Function (admin-only user creation)
scripts/
  backup-db.sh             nightly off-platform pg_dump (see §9 Backups)
.github/workflows/
  nightly-backup.yml       schedules backup-db.sh via GitHub Actions
  deploy-edge-functions.yml auto-deploys supabase/functions/create-user on push
```

---

## 3. Data model (Postgres, all RLS-enabled)

| Table | Purpose / key columns |
|---|---|
| **profiles** | one row per login. `role` ∈ super_admin/admin/staff/student/faculty/professional, `can_view_financials`, `is_approved`, `must_change_password` (true for create-user-provisioned logins until they set their own password). Auto-created by `handle_new_user` trigger. |
| **students** | `id` text PK (e.g. `DBHM001`), batch, name, course, `registration_fee`/`course_fee`/`exam_fee`/`other_fee`/`waiver`, `status` (Registered/Active/Completed/Dropped), enrollment_date. Setting status = Dropped auto-raises waiver to zero the balance. |
| **collections** | fee payments. `student_id`, date, `type`, `account` (HDFC/ICICI/Cash/Healthcare), amount, reference. `collections_basic` **view** masks `account` for non-financial users. |
| **expenses** | date, category, account (…/Healthcare), amount, reference, description. |
| **income** | ⚠ **legacy / unused** — feature removed, table + policies remain. |
| **transfers** | account→account movements (incl. Healthcare repayments). **Not** P&L. |
| **bank_statements** | one per uploaded statement (account, period, opening/closing balance). |
| **bank_statement_lines** | every statement line + reconciliation `status` (unmatched/matched/classified/ignored) and link (`match_kind`, `match_id`). |
| **batches** | course batch master; drives enrolment auto-fill. |
| **expense_categories** | editable category list used by the Expenses form. |
| **app_settings** | singleton JSON row; holds `roleAreas` (super-admin's per-role tab permissions). |
| **timetables** | weekly schedule master (day, time, subject, batch, faculty, room, link). |
| **assignments** / **assignment_submissions** | assignment master + per-student submissions, marks, feedback. |
| **exams** / **exam_questions** / **exam_results** | MCQ exam master, question bank (`options` jsonb + `correct_index`), per-student results. |
| **faculty_reviews** | student-submitted faculty ratings (rating / clarity / punctuality 1–5 + comment). |

Academy Suite tables (`timetables` … `faculty_reviews`) are defined in
`supabase/schema.sql` **and** `supabase/migration-academy-suite.sql`. RLS:
approved users read; `is_admin()` manages; students own their submissions /
results / reviews.

SQL helpers: `is_admin()` (admin + super_admin), `is_super_admin()`,
`is_approved_user()`, `can_view_financials()`.

---

## 4. Backend surface

No REST/GraphQL of its own.

- **Supabase client calls** — all in `src/lib/data.js` (~37 functions): CRUD +
  bulk inserts for every table; `createStaffUser()` invokes the edge function.
- **Edge Function** `POST /functions/v1/create-user` (Deno): verifies the
  caller is admin/super_admin, then uses the service-role key to create an
  auth user and set the profile's role/approval/financial access.
  Needs the `SERVICE_ROLE_KEY` secret.
- **Auth** — `signInWithPassword`, `signInWithOAuth({ google })`,
  `resetPasswordForEmail`, `signOut`, `onAuthStateChange`.

---

## 5. Features

| Module | Summary |
|---|---|
| **Auth** | Email+password, Google OAuth, forgot password. New users wait for a super-admin to approve. |
| **Academy Pulse (Dashboard)** | Student overview tiles (with month deltas), Financial overview (Revenue / Expense / Net P&L / Outstanding fees / Due to Healthcare), Cash & Bank position, Fee Collection Health donut, Monthly Income-vs-Expense bar chart, Batch Summary with %-collected bars, Recent Collections & Expenses. Global period filter (flows are period-scoped; balances are all-time). Trimmed / role-tailored view for faculty & student roles. |
| **Timetable** | Weekly class grid by day/batch; admins add/edit slots, everyone else reads. |
| **Live Class** | Launch / join scheduled live sessions (Jitsi links). |
| **Assignments** | Assignment list per batch; students submit a link + notes; admins/faculty grade with marks + feedback. |
| **Exams** | Timed MCQ engine — take exam, auto-score against `correct_index`, pass/fail vs `passing_score`, results history. |
| **Reviews** | Students rate faculty (overall / clarity / punctuality) with a comment; aggregated view. |
| **Enrollment** | Student master; add/edit modal; batch picker auto-fills course + fee; Excel template + bulk import with preview. |
| **Fee Collection** | Record payment (type-ahead student, shows outstanding) → prints a Receipt; payment history with edit/delete (admin); Excel template + bulk import. |
| **Expenses** | Record expense (category from editable list); edit/delete (admin); Excel template + bulk import. |
| **Banking** | *Transfers*: account-to-account incl. Healthcare repayments (manual + bulk). *Reconciliation*: upload bank-statement Excel → auto-match lines by date+amount → classify/unmatch unmatched lines (creates or links a record) → per-statement book-vs-statement balance panel. |
| **Reports** | 6 reports (P&L, Fee Collection, Expense Analysis, Student Receivables, Transfers, Inter-company). Each: filters + search + preview + Excel download + browser Print/Save-PDF. Non-admin roles: Fee Collection + Receivables only. |
| **Admin** | *Batches* & *Categories* CRUD (create for all approved; edit/delete admin). *Users* (super-admin): Create Login + approve/role table. *Access* (super-admin): per-role tab-visibility checkboxes. |

---

## 6. Environment / secrets

`.env` (see `.env.example`, gitignored):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Elsewhere (not in the repo):
- Vercel project → same two vars.
- Supabase Edge Function secret → `SERVICE_ROLE_KEY`.
- Google OAuth client ID + secret → configured in the Supabase Auth dashboard.

---

## 7. Deployment

- **Frontend** → Vercel, **connected to the GitHub repo** (`main` →
  auto-deploy; Vite auto-detected, no `vercel.json`). `VITE_SUPABASE_URL`
  and `VITE_SUPABASE_ANON_KEY` are set in Vercel for all environments.
- **Edge function** → auto-deployed by `.github/workflows/deploy-edge-functions.yml`
  on every push to `main` that touches `supabase/functions/**` (needs the
  `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` repo secrets — see that
  file's header comment; the one thing it still doesn't do for you is the
  one-time `supabase secrets set SERVICE_ROLE_KEY=...`). Can also be run by
  hand: `supabase functions deploy create-user --project-ref <ref>`.
- **DB** → fresh project: paste `supabase/schema.sql` into the Supabase SQL
  editor. Existing pre-schema.sql project: run each `supabase/NN_*.sql` file
  in numeric order (01 → 10), plus the `migration-academy-suite*.sql` files
  if the project predates the Academy Suite — see the verification query
  below for whether your project still needs any of them.

No Dockerfile, no `supabase/config.toml` / CLI migrations folder. CI is two
GitHub Actions workflows: `nightly-backup.yml` (§9) and
`deploy-edge-functions.yml` (above) — neither runs lint/test/build on pull
requests yet (see the roadmap's Phase 0).

---

## 8. Verifying production against this repo

Before applying any `NN_*.sql` file, or after pulling this PR, run this
read-only query in the Supabase SQL editor and compare against `schema.sql`:

```sql
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in ('public.collections'::regclass, 'public.expenses'::regclass)
  and contype = 'c';
```

If the printed CHECK definitions list only `('HDFC','ICICI','Cash')` without
`'Healthcare'`, migration `01_healthcare_account.sql` has not reached
production yet and needs to be run (along with whichever of `02`–`05` are
also missing — the same technique works for `public.transfers` /
`public.batches` / `public.app_settings` existing or not).

## 9. Backups

`scripts/backup-db.sh` runs nightly via `.github/workflows/nightly-backup.yml`
and takes an independent `pg_dump` of the database — see finding H3 in the
engineering review. This exists *in addition to* Supabase's own backups, not
instead of them: Supabase's backups are plan-gated (as of this writing —
check your project's Database > Backups page for what you're actually on)
and, crucially, live *inside* Supabase, so they don't help if the project
itself is ever deleted, the subscription lapses, or account access is lost.
An independent copy is the only thing that survives all of those.

**One-time setup** (see the workflow file's header comment for the full
list): add the `SUPABASE_DB_URL` repo secret (Project Settings > Database >
Connection string > URI in the Supabase dashboard — use the "Session
pooler" variant, since GitHub-hosted runners are IPv4-only and Supabase's
direct connection is IPv6-only without the paid IPv4 add-on). Optionally add
`BACKUP_S3_BUCKET` + AWS credentials for longer-lived off-GitHub retention;
without it, the dump is still kept as a 30-day GitHub Actions artifact, which
already satisfies "somewhere other than Supabase."

**Restoring from a dump:**
```bash
pg_restore --no-owner --no-privileges -d "$SUPABASE_DB_URL" path/to/dump.dump
```
Restore into a *new*, empty Supabase project to verify a dump before ever
pointing this at production.

**Run it yourself locally** (e.g. to take an ad-hoc backup before a risky
migration): `SUPABASE_DB_URL="postgresql://..." ./scripts/backup-db.sh`.

## 10. Known gaps / attention list

Items marked **(fixed in this PR)** were resolved by the engineering review
in this branch — kept here so the history of what was found and when isn't
lost.

Every SQL change in this PR (`schema.sql` and all of `01`–`10`) was actually
run against a real Postgres 16 instance in this session — not just read —
via two paths: (1) `schema.sql` on an empty database, and (2) `01`–`10` run
in order on top of a copy of `main`'s current `schema.sql` (the closest
available stand-in for the live production database). Both paths were
confirmed to land on the same final schema, and the RLS/column-privilege
behaviour in `06_close_collections_view_bypass.sql` was exercised directly —
inserting a collection and reading it back through `collections_basic` as
four different simulated users (the row's own creator, an unrelated
non-financial staff member, a financial-access admin, and an unapproved
user) — not just reasoned about. That process caught two real bugs that a
read-through alone had missed, both already fixed in the files now in this
branch:
- The original `collections_basic` view was `security_invoker = true`. A
  security_invoker view checks the *calling* role's own column privileges
  against the underlying table for every column the view body touches —
  including inside the `case when ... else null end` that masks `account`.
  Combined with this PR's fix of revoking `account` from `authenticated` on
  the base table, that made the view throw "permission denied" for *every*
  caller, not just the ones meant to be masked. Fixed by dropping
  `security_invoker`, adding `security_barrier`, and writing the
  approved-user row filter explicitly into the view body instead of relying
  on RLS propagating through view ownership.
- `05_super_admin.sql` tried to `create policy "profiles_super_admin_update_all"`
  without a matching `drop policy if exists` first, so re-running it against
  a database that already had that policy (which `main`'s current
  `schema.sql` does) failed outright. Fixed by adding the missing `drop
  policy if exists`, matching the defensive pattern already used everywhere
  else in that file.

**Infra**
- Migrations were hand-run ad-hoc SQL with an order that didn't match their
  filenames, and no version table. **(fixed:** renumbered to `NN_*.sql` in
  true dependency order; still no version table / CLI-managed migrations —
  consider adopting the Supabase CLI's migration runner if this project
  keeps growing.)
- No CI — lint / test / build are only run by hand before push. **Still
  open** — add a GitHub Actions workflow running `npm run lint && npm test
  && npm run build` on every push/PR (roadmap Phase 0).
- No backup of the database existed outside Supabase itself. **(fixed:**
  `scripts/backup-db.sh` + `.github/workflows/nightly-backup.yml` — see §9
  Backups above. Needs the `SUPABASE_DB_URL` secret added to the repo before
  it will actually run successfully.)
- The `create-user` Edge Function had to be deployed by hand, and the UI
  carried a permanent static note saying so under the "Create Login" button.
  **(fixed:** `.github/workflows/deploy-edge-functions.yml` deploys it
  automatically on every push to `supabase/functions/**`; the static note is
  gone, and `createStaffUser()` (`src/lib/data.js`) now distinguishes "the
  function ran and rejected the request" from "the request never reached a
  deployed function at all". Needs the `SUPABASE_ACCESS_TOKEN` /
  `SUPABASE_PROJECT_REF` repo secrets before it will actually run
  successfully — see that workflow file's header.)

**Code**
- `src/App.jsx` (~1470 loc) holds everything — state, handlers, `totals`
  math, nav, render. **Not fixed yet, deliberately deferred:** splitting it
  into per-domain hooks is real surgery on the app's central file and needs
  a working build/test loop to verify a restructure that size didn't break
  something — see roadmap Phase 1.
- `src/App.css` is one ~2700-line file — left as-is for the same reason.
- No TypeScript — left as-is; converting `src/lib` touches build config in a
  way that needs a working build to trust, same as above.
- No tests, no error boundary. **Fixed:** `src/lib/fees.js` and
  `reconcile.js` now have a unit-test suite using Node's built-in test
  runner (`npm test` → `node --test src/lib/*.test.js`, zero extra
  dependencies, 36 passing assertions); there's also a top-level error
  boundary (`src/components/ErrorBoundary.jsx`). Pages/components and the
  newer Academy Suite modules (Timetable/Assignments/Exams/Reviews) remain
  untested — see roadmap Phase 2.
- `xlsx` and `recharts` are the two heavy deps. `xlsx` is loaded via dynamic
  `import()` in `bankStatement.js`, `reports.js`, `templates.js` and
  `App.jsx` — keep it that way (no static `import ... "xlsx"`). The `xlsx`
  dependency itself was bumped past a known vulnerability (now pulled from
  the SheetJS CDN rather than the stale npm registry version — see
  `package.json`).
- Outstanding lint warnings: `only-export-components`, `set-state-in-effect`
  — left as-is; cosmetic, not correctness-affecting.

**Functional**
- `income` table was dead. **(fixed in this PR:** dropped — see
  `08_drop_income_table.sql`. If it held any rows in your project, export
  them before running that file; the file itself only checks and warns.)
- **Net P&L** = `Revenue − Expense − Due to Healthcare`. `Total Expense`
  already includes Healthcare-paid expenses, so this does subtract that
  amount a second time — **confirmed directly with the owner that this is
  intentional**, not a bug: Healthcare-paid expenses are deliberately
  counted against profit twice, as a conservative "not yet real profit
  until Healthcare is repaid" stance, using the exact all-time "Due to
  Healthcare" figure shown on its own tile (not a period-scoped version of
  it, which was tried and rejected as confusing since it didn't match that
  tile). Known consequence, accepted as-is: because `Due to Healthcare` is
  an all-time balance while Revenue/Expense are period-scoped, filtering to
  a single month still subtracts the *entire* outstanding balance, and the
  figure jumps the month that balance is finally repaid (a transfer, which
  is never itself a P&L flow).
- Roles `student` / `faculty` / `professional` now default (via
  `DEFAULT_ROLE_AREAS` in `access.js`) to the Academy Suite tabs
  (Pulse + Timetable / Live Class / Assignments / Exams / Reviews) with a
  role-tailored dashboard. They were briefly excluded from the Create Login
  form's role list by an earlier fix written before these screens existed —
  **corrected during this merge:** `ASSIGNABLE_ROLES` in `access.js` now
  includes all five roles again, matching what `DEFAULT_ROLE_AREAS` actually
  gives them. A user with **no** areas enabled still hits the lock screen —
  still open.
- `collections_basic` masked view was bypassable by querying
  `public.collections` directly. **(fixed:** the base table's `select` grant
  is now revoked for the `authenticated` role, and the view itself was
  rewritten (it had its own latent bug, found while verifying this fix — see
  the note at the top of this section) — see
  `06_close_collections_view_bypass.sql`.)
- Reconciliation auto-match is a date(±4d)+amount heuristic; the bank-statement
  parser is tuned to ICICI-style + a generic layout — new bank formats need
  parser work. Left as-is: no evidence yet that it's missing real matches in
  practice, and every unmatched line already gets human review.
- Period-filter split (flows scoped to the window, balances always all-time)
  is deliberate — don't "fix" it by accident. (Net P&L's *own* all-time leak
  was the bug — see above — not the period-filter design itself, which is
  correct.)
- Any `admin` (not just the Owner) could create a new `admin` login via the
  `create-user` function, and could read the full user roster via RLS.
  **(fixed in this PR:** `create-user` now requires `super_admin`; the
  `profiles` select policy for the full roster is now `is_super_admin()` —
  see `07_tighten_profiles_select.sql`.)
- Edits/deletes to fee collections, expenses and transfers left no audit
  trail. **(fixed in this PR:** `09_audit_log.sql` adds an `audit_log` table
  and triggers capturing the old/new row, who, and when.)
- A login created via "Create Login" kept its admin-set temp password
  indefinitely — nothing ever required the person to change it.
  **(fixed in this PR:** `must_change_password` flag, set by `create-user`
  and checked in `src/App.jsx`; `ForcePasswordChange.jsx` gates the rest of
  the app until it's cleared — see `10_force_password_change.sql`.)
- Every write (adding/editing/deleting a single fee collection, expense or
  transfer) reloads every table from scratch rather than updating local
  state directly — correct but wasteful, and it makes every save feel
  slower than it needs to. **Not fixed in this PR, deliberately deferred:**
  same reasoning as the `App.jsx` hook-split above — this means rewriting
  the mutation handlers in the app's highest-traffic file with no working
  build to catch a mistake (e.g. local state silently drifting from the DB
  after a save). Left for a follow-up with build verification available.
- Server-side pagination for list pages (Enrollment, Fee Collection,
  Expenses, Transfers) is deliberately **not** implemented — every page
  still fetches its full table and paginates client-side. At today's data
  volumes (hundreds to low thousands of rows) this is simpler and safer than
  the added complexity of range-based fetching combined with client-side
  search text. Revisit if any of these tables grows past roughly 5,000 rows;
  until then, forcing this change would add real risk (subtle search/paging
  bugs) for no current benefit.
