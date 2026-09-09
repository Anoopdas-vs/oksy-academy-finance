# Oksy Academy Finance — Project Overview

Financial-consolidation app for Oksy Academy LLP. Live at **finance.oksyacademy.in**.

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
| Language | JavaScript + JSX | **no TypeScript**, **no tests** |
| Routing | none — tab state in `src/App.jsx` (`activeTab`) |
| Styling | one hand-written `src/App.css` (~2700 lines), CSS variables |

**Backend** = Supabase (managed Postgres + Row-Level Security + Auth). One
server-side function (`supabase/functions/create-user`). No Node/API server,
no ORM.

Scripts: `npm run dev` · `npm run build` · `npm run preview` · `npm run lint`.

---

## 2. Directory map

```
src/
  App.jsx (~1400 loc)      all state, data handlers, totals math, nav, render
  App.css (~2700 loc)      entire stylesheet
  context/AuthContext.jsx  Supabase auth + profile load + getAccess
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
    EnrollmentPage.jsx      student master
    FeeCollectionPage.jsx   record / edit / delete fee payments
    ExpensesPage.jsx        record / edit / delete expenses
    BankingPage.jsx         Transfers + Bank Reconciliation (sub-tabs)
    ReportsPage.jsx         report registry + preview / Excel / print
    AdminPage.jsx           Batches / Categories / Users / Access (sub-tabs)
  lib/
    supabaseClient.js       createClient from VITE_ env
    data.js (~330 loc)      ALL database reads/writes — the "API layer"
    access.js               roles, labels, per-role area permissions
    fees.js                 canonical fee + account-balance math
    period.js               date-range resolution
    reconcile.js            auto-match statement lines ↔ transactions
    bankStatement.js        parse uploaded bank-statement Excel
    reports.js              report definitions + xlsx export
    validation.js           form validators + friendly error text
    templates.js            xlsx template download
    usePagedList.js         client-side search + pagination hook
supabase/
  schema.sql               full DDL — run ONCE on a fresh project
  NN_*.sql                 incremental patches for an existing pre-schema.sql
                           project, run in NUMERIC order (the number is the
                           dependency order, not just a filename)
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
| **Academy Pulse (Dashboard)** | Student overview tiles (with month deltas), Financial overview (Revenue / Expense / Net P&L / Outstanding fees / Due to Healthcare), Cash & Bank position, Fee Collection Health donut, Monthly Income-vs-Expense bar chart, Batch Summary with %-collected bars, Recent Collections & Expenses. Global period filter (flows are period-scoped; balances are all-time). Trimmed view for non-financial roles. |
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

- **Frontend** → Vercel (project already linked via `.vercel/`, Vite
  auto-detected, no `vercel.json`). Currently manual `vercel --prod`.
  Recommended: connect the GitHub repo in the Vercel dashboard for
  auto-deploy on push.
- **Edge function** → auto-deployed by `.github/workflows/deploy-edge-functions.yml`
  on every push to `main` that touches `supabase/functions/**` (needs the
  `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` repo secrets — see that
  file's header comment; the one thing it still doesn't do for you is the
  one-time `supabase secrets set SERVICE_ROLE_KEY=...`). Can also be run by
  hand: `supabase functions deploy create-user --project-ref <ref>`.
- **DB** → fresh project: paste `supabase/schema.sql` into the Supabase SQL
  editor. Existing pre-schema.sql project: run each `supabase/NN_*.sql` file
  in numeric order (01 → 10) — see the verification query below for whether
  your project still needs any of them.

No Dockerfile, no `supabase/config.toml` / CLI migrations folder. CI is two
GitHub Actions workflows: `nightly-backup.yml` (§9) and
`deploy-edge-functions.yml` (above).

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
  filenames, and no version table. **(fixed in this PR:** renumbered to
  `NN_*.sql` in true dependency order; still no version table / CLI-managed
  migrations — consider adopting the Supabase CLI's migration runner if this
  project keeps growing.)
- Node version wasn't pinned though Vite 8 needs 20.19+. **(fixed — already
  on `main`, not part of this PR:** `package.json` `engines.node` and
  `.nvmrc` both pin `>=20.19`/`20.19`.)
- No backup of the database existed outside Supabase itself. **(fixed in
  this PR:** `scripts/backup-db.sh` + `.github/workflows/nightly-backup.yml`
  — see §9 Backups above. Needs the `SUPABASE_DB_URL` secret added to the
  repo before it will actually run successfully.)
- The `create-user` Edge Function had to be deployed by hand, and the UI
  carried a permanent static note saying so under the "Create Login" button
  — easy to forget, and confusing to read as a standing error even when the
  function *was* deployed and working. **(fixed in this PR:**
  `.github/workflows/deploy-edge-functions.yml` deploys it automatically on
  every push to `supabase/functions/**`; the static note is gone, and
  `createStaffUser()` (`src/lib/data.js`) now distinguishes "the function
  ran and rejected the request" — real message shown as-is — from "the
  request never reached a deployed function at all", surfacing the
  deploy-related guidance only in the case it's actually relevant. Needs the
  `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` repo secrets before it
  will actually run successfully — see that workflow file's header.)

**Code**
- `src/App.jsx` (~1400 loc) holds everything — state, handlers, `totals`
  math, nav, render. **Not fixed in this PR, deliberately deferred:**
  splitting it into per-domain hooks is real surgery on the app's central
  file, and `npm install` was not functional in the sandbox session this PR
  was written in (see the PR description) — no `npm run build`/manual
  smoke-test loop was available to confirm a restructure that size didn't
  break something. Landing it unverified was judged too risky for a live
  financial app; left for a follow-up with build verification available.
- `src/App.css` is one ~2700-line file — left as-is; a pure CSS reorg with no
  functional benefit, lower value than the items actually fixed here.
- No TypeScript — **not fixed in this PR, deliberately deferred** for the
  same build-verification reason as the `App.jsx` split above: converting
  `src/lib` touches build config in a way that needs a working build to
  trust.
- No tests, no error boundary. **Both fixed in this PR:** `src/lib/fees.js`
  and `reconcile.js` now have a unit-test suite using Node's built-in test
  runner (`npm test` → `node --test src/lib/*.test.js`) — deliberately
  zero-dependency so it runs without `npm install`, and it was actually run
  in-session (36 passing assertions), not just written; there's also a
  top-level error boundary (`src/components/ErrorBoundary.jsx`, also needing
  no build tooling to add). Converting `src/lib` itself to TypeScript
  remains future work, per above.
- Outstanding lint warnings: `only-export-components`, `set-state-in-effect`
  — left as-is; cosmetic, not correctness-affecting.

**Functional**
- `income` table was dead. **(fixed in this PR:** dropped — see
  `08_drop_income_table.sql`. If it held any rows in your project, export
  them before running that file; the file itself only checks and warns.)
- **Net P&L** = `Revenue − Expense − Due to Healthcare`, but `Total Expense`
  already included Healthcare-paid expenses, so those costs were subtracted
  twice — and the Healthcare term used an all-time balance inside a
  period-scoped subtraction. **(fixed in this PR:** Net P&L is now
  `Revenue − Expense`; "Due to Healthcare" stays its own balance-sheet tile.)
- Roles `student` / `faculty` / `professional` exist but have no permissions,
  no dedicated screens, and default to a "no sections enabled" lock screen.
  **(fixed in this PR:** removed from the assignable-role list in the Create
  Login form until they have real screens; the database role enum is left
  untouched so nothing breaks if they were ever assigned.)
- `collections_basic` masked view was bypassable by querying
  `public.collections` directly. **(fixed in this PR:** the base table's
  `select` grant is now revoked for the `authenticated` role, and the view
  itself was rewritten (it had its own latent bug, found while verifying
  this fix — see the note at the top of this section) — see
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
