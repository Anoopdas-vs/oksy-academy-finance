# Oksy Academy Portal

All-in-one academy management system for **Oksy Academy LLP** — LMS + ERP +
finance in one app: timetable, live classes, assignments, online exams,
faculty reviews, student enrolment, fee collection, expenses, inter-account
transfers, bank reconciliation, reporting and role-based access. Live at
**finance.oksyacademy.in** (moving to **portal.oksyacademy.in**).

React 19 + Vite 8 · Supabase (Postgres + Auth + RLS) · deployed on Vercel.

> New here? Read **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** for the full
> architecture, data model, feature list and known gaps, and
> **[AGENTS.md](AGENTS.md)** for AI-agent working rules.
> Detailed first-time setup is in **[SETUP.md](SETUP.md)**.

---

## Run locally

Requires **Node ≥ 20.19** (Vite 8) — see `.nvmrc`.

```bash
npm install
cp .env.example .env          # then fill in the two Supabase values
npm run dev                    # http://localhost:5173
```

`.env`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Scripts: `npm run dev` · `npm run build` · `npm run preview` ·
`npm run lint` (oxlint) · `npm test` (`node --test` on `src/lib/*.test.js`).

---

## Database

The schema lives in `supabase/`. On a **fresh** Supabase project, run
`supabase/schema.sql` in the SQL editor — it now includes the Academy Suite
tables. On an **existing** project, apply the `supabase/migration-*.sql`
files **in filename order** — they are hand-run patches, there is no
migration runner.

The `create-user` Edge Function (`supabase/functions/create-user/`) lets a
super-admin create logins; it needs the `SERVICE_ROLE_KEY` secret set in
Supabase.

⚠ The production database is live. Propose schema changes as SQL; don't run
them automatically.

---

## Deploy

Frontend is on Vercel, connected to the GitHub repo — **push to `main` for
auto-deploy**. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in
the Vercel project settings for all environments.

---

## Layout

```
src/
  App.jsx            root: state, data handlers, tab navigation
  pages/             Dashboard, Timetable, LiveClass, Assignments, Exams,
                     Reviews, Enrollment, FeeCollection, Expenses, Banking,
                     Reports, Admin
  components/        Login, Receipt, StudentPicker, StaffAccess, PeriodFilter,
                     SearchPager, ImportPreviewModal, shared UI
  lib/               data.js (all DB calls), fees.js, reports.js, reconcile.js,
                     bankStatement.js, access.js, period.js, format.js,
                     templates.js, validation.js, usePagedList.js
                     + fees.test.js, reconcile.test.js
  context/           AuthContext.jsx (provider) + authContext.js + useAuth.js
supabase/            schema.sql, migration-*.sql (×6), functions/create-user
```
