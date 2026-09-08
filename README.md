# Oksy Academy Finance Console

Internal financial-consolidation app for **Oksy Academy LLP** — student
enrolment, fee collection, expenses, inter-account transfers, bank
reconciliation, reporting and role-based access. Live at
**finance.oksyacademy.in**.

React 19 + Vite · Supabase (Postgres + Auth + RLS) · deployed on Vercel.

> New here? Read **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** for the full
> architecture, data model, feature list and known gaps.
> Detailed first-time setup is in **[SETUP.md](SETUP.md)**.

---

## Run locally

Requires **Node ≥ 20.19** (Vite 8).

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

Other scripts: `npm run build` · `npm run preview` · `npm run lint`.

---

## Database

The schema lives in `supabase/`. On a **fresh** Supabase project, run
`supabase/schema.sql` in the SQL editor. On an **existing** project, apply
the `supabase/migration-*.sql` files **in filename order** — they are
hand-run patches, there is no migration runner.

The `create-user` Edge Function (`supabase/functions/create-user/`) lets a
super-admin create logins; it needs the `SERVICE_ROLE_KEY` secret set in
Supabase.

⚠ The production database is live. Propose schema changes as SQL; don't run
them automatically.

---

## Deploy

Frontend is on Vercel (project already linked). Push to the connected GitHub
repo for auto-deploy, or `vercel --prod` manually. Set `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY` in the Vercel project settings.

---

## Layout

```
src/
  App.jsx            root: state, data handlers, tab navigation
  pages/             Dashboard, Enrollment, FeeCollection, Expenses, Banking, Reports, Admin
  components/        Login, Receipt, StudentPicker, StaffAccess, shared UI
  lib/               data.js (all DB calls), fees.js, reports.js, reconcile.js, access.js, …
  context/           AuthContext
supabase/            schema.sql, migration-*.sql, functions/create-user
```
