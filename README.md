# Oksy Academy Portal

All-in-one academy management system for **Oksy Academy LLP** — LMS + ERP +
finance in one app: timetable, live classes, assignments, online exams,
faculty reviews, student enrolment, fee collection, expenses, inter-account
transfers, bank reconciliation, reporting and role-based access. Live at
**finance.oksyacademy.in** (migrated to **pulse.oksyacademy.in**).

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
`supabase/schema.sql` in the SQL editor — it already contains the full
current schema, including the Academy Suite tables (Timetable, Assignments,
Exams, Reviews) and the audit log, so a new project never needs the
migration files at all.

On an **existing** project that predates `schema.sql`'s current state,
apply the `supabase/NN_*.sql` files **in numeric filename order** (`01`,
`02`, `03`, ...) — the number *is* the required run order (some of them
depend on tables an earlier one creates); they are hand-run patches, there
is no migration runner. Before applying any of them, run the check in
PROJECT_OVERVIEW.md §8 to see which ones, if any, your project still needs.

The `create-user` Edge Function (`supabase/functions/create-user/`) lets a
super-admin create logins. `.github/workflows/deploy-edge-functions.yml`
deploys it automatically on push (see that file for the one-time repo
secrets it needs); it still needs the `SERVICE_ROLE_KEY` secret set in
Supabase itself once, which the workflow deliberately doesn't do for you.

⚠ The production database is live. Propose schema changes as SQL; don't run
them automatically.

---

## Backups

`scripts/backup-db.sh`, run nightly by `.github/workflows/nightly-backup.yml`,
takes an independent `pg_dump` of the database so there's a restore path that
doesn't depend on Supabase's own backups (which are plan-limited and live
inside Supabase itself). See the script's header comment and
**[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)**'s "Backups" section for setup
(which GitHub secrets to add) and how to restore from a dump.

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
supabase/            schema.sql, NN_*.sql (hand-run patches), functions/create-user
scripts/             backup-db.sh (nightly off-platform DB backup)
```
