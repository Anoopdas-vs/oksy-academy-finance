# Oksy Academy Portal — Project Overview

All-in-one academy management system (LMS + ERP + finance) for Oksy Academy
LLP. Live at **finance.oksyacademy.in** (transitioning to
**portal.oksyacademy.in**).

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
    ui.jsx                  MetricCard, Input, Modal, StatusBadge…
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
    data.js (~330 loc)      ALL database reads/writes — the "API layer"
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
  schema.sql               full DDL incl. Academy Suite — run ONCE on a fresh project
  migration-*.sql (×6)      incremental patches, run IN ORDER after schema.sql
  functions/create-user/    Deno Edge Function (admin-only user creation)
```

---

## 3. Data model (Postgres, all RLS-enabled)

| Table | Purpose / key columns |
|---|---|
| **profiles** | one row per login. `role` ∈ super_admin/admin/staff/student/faculty/professional, `can_view_financials`, `is_approved`. Auto-created by `handle_new_user` trigger. |
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
- **Edge function** → deployed manually via the Supabase dashboard or
  `supabase functions deploy create-user`.
- **DB** → paste `supabase/schema.sql` then each `supabase/migration-*.sql`
  (in filename order) into the Supabase SQL editor.

No Dockerfile, no CI yet, no `supabase/config.toml` / CLI migrations folder.

---

## 8. Known gaps / attention list

**Infra**
- Migrations are hand-run ad-hoc SQL with no version table — the live DB has
  drifted through partial re-runs. Consider adopting Supabase CLI migrations.
- No CI — lint / test / build are run by hand (and by AI agents) before push.

**Code**
- `src/App.jsx` (~1470 loc) holds everything — state, handlers, `totals`
  math, nav, render. Split before large feature work.
- `src/App.css` is one ~2700-line file.
- No TypeScript and no error boundary — in a money app. Tests cover
  `fees.js` + `reconcile.js` only (`npm test`); pages/components untested.
- `xlsx` and `recharts` are the two heavy deps. `xlsx` is loaded via dynamic
  `import()` in `bankStatement.js`, `reports.js`, `templates.js` and
  `App.jsx` — keep it that way (no static `import ... "xlsx"`).

**Functional**
- `income` table is dead — remove or repurpose.
- **Net P&L** = `Revenue − Expense − Due to Healthcare`, but `Total Expense`
  already includes Healthcare-paid expenses, so those costs are subtracted
  twice. Confirm the intended definition.
- Roles `student` / `faculty` / `professional` default (via
  `DEFAULT_ROLE_AREAS` in `access.js`) to the Academy Suite tabs
  (Pulse + Timetable / Live Class / Assignments / Exams / Reviews) with a
  role-tailored dashboard; a user with **no** areas enabled still hits the
  lock screen.
- `collections_basic` masked view may be largely moot under the current role
  model.
- Reconciliation auto-match is a date(±4d)+amount heuristic; the bank-statement
  parser is tuned to ICICI-style + a generic layout — new bank formats need
  parser work.
- Period-filter split (flows scoped to the window, balances always all-time)
  is deliberate — don't "fix" it by accident.
