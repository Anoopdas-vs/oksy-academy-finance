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
  migration-*.sql (×5)      incremental patches, run IN ORDER after schema.sql
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
- **Edge function** → deployed manually via the Supabase dashboard or
  `supabase functions deploy create-user`.
- **DB** → paste `supabase/schema.sql` then each `supabase/migration-*.sql`
  (in filename order) into the Supabase SQL editor.

No Dockerfile, no CI, no `supabase/config.toml` / CLI migrations folder.

---

## 8. Known gaps / attention list

**Infra**
- Migrations are hand-run ad-hoc SQL with no version table — the live DB has
  drifted through partial re-runs. Consider adopting Supabase CLI migrations.
- Node version not pinned (`engines` / `.nvmrc` missing) though Vite 8 needs 20.19+.

**Code**
- `src/App.jsx` (~1400 loc) holds everything — state, handlers, `totals`
  math, nav, render. Split before large feature work.
- `src/App.css` is one ~2700-line file.
- No TypeScript, no tests, no error boundary — in a money app.
- Outstanding lint warnings: `only-export-components`, `set-state-in-effect`.

**Functional**
- `income` table is dead — remove or repurpose.
- **Net P&L** = `Revenue − Expense − Due to Healthcare`, but `Total Expense`
  already includes Healthcare-paid expenses, so those costs are subtracted
  twice. Confirm the intended definition.
- Roles `student` / `faculty` / `professional` exist but have no permissions,
  no dedicated screens, and default to a "no sections enabled" lock screen.
- `collections_basic` masked view may be largely moot under the current role
  model.
- Reconciliation auto-match is a date(±4d)+amount heuristic; the bank-statement
  parser is tuned to ICICI-style + a generic layout — new bank formats need
  parser work.
- Period-filter split (flows scoped to the window, balances always all-time)
  is deliberate — don't "fix" it by accident.
