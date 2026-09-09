# Oksy Academy Portal — Setup & Deployment (Zero Cost)

The portal has real logins, role-based permissions and a shared cloud
database on **Supabase's free tier**. Nothing here needs a card.

Stack: React 19 + Vite 8 (Node ≥ 20.19) · Supabase (Postgres + Auth + RLS) ·
Vercel.

## 0. Install dependencies

```bash
nvm use            # picks up .nvmrc (Node 20.19)
npm install
```

## 1. Create a free Supabase project

1. Go to https://supabase.com and sign up (GitHub login is fastest).
2. Click **New Project**. Name it `oksy-academy`, set a database password
   (save it), pick the region closest to Kerala (Mumbai / `ap-south-1`).
3. **Project Settings → API** — copy two values:
   - **Project URL**
   - **anon public** key

## 2. Connect the app to Supabase

```bash
cp .env.example .env
```

Paste the two values into `.env`:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

`.env` is gitignored — it never gets committed.

## 3. Create the database

1. Supabase → **SQL Editor → New query**.
2. Paste the entire contents of `supabase/schema.sql` and **Run**.

That single file now provisions the whole portal: `profiles`, `students`,
`collections` / `collections_basic`, `expenses`, `transfers`, `batches`,
`expense_categories`, `bank_statements` / `bank_statement_lines`,
`app_settings`, and the Academy Suite tables (`timetables`, `assignments`,
`assignment_submissions`, `exams`, `exam_questions`, `exam_results`,
`faculty_reviews`) — plus every RLS policy and the `is_admin()` /
`is_super_admin()` / `is_approved_user()` / `can_view_financials()` helpers.

> Already have an older database? Don't re-run `schema.sql`. Instead run the
> `supabase/migration-*.sql` files **in filename order** — they are the
> incremental patches (healthcare account → transfers/reconciliation →
> admin/reports → staff access → super admin → academy suite).

(Optional) **Authentication → Providers → Email** — turn off "Confirm email"
so new accounts don't need to click a link before approval.

(Optional) **Authentication → Providers → Google** — add your Google OAuth
client ID + secret to enable "Continue with Google" on the login screen.

## 4. Create the first Owner (super admin)

```bash
npm run dev
```

Open the app and sign in once (email/password or Google) to create your
`profiles` row. You'll land on a "waiting for approval" screen — expected.

Back in Supabase **SQL Editor**, run with your email:

```sql
update public.profiles
   set role = 'super_admin', is_approved = true, can_view_financials = true
 where email = 'you@example.com';
```

Sign out and back in. You're now the **Owner**: you get the **Admin** area
(Batches / Categories / Users / Access). From **Users** you create every
other login (name, email, temp password, role) via the `create-user` Edge
Function; from **Access** you set which tabs each role can see.

### Edge Function (user creation)

`supabase/functions/create-user/` must be deployed and needs the
`SERVICE_ROLE_KEY` secret:

```bash
supabase functions deploy create-user
supabase secrets set SERVICE_ROLE_KEY=<your service_role key>
```

(or deploy it from the Supabase dashboard's Edge Functions screen).

## 5. Roles at a glance

| Role (label) | Sees |
|---|---|
| `super_admin` (**Owner**) | everything, incl. Users & Access |
| `admin` (**Admin**) | everything except Owner-only Access config |
| `staff` (**Executive**) | Academy Suite + Enrollment / Fee Collection / Expenses / Reports / Admin (enter-only; edit & delete are admin-only). Financial figures gated by the per-user **financial access** toggle. |
| `faculty` / `student` / `professional` | Pulse + Timetable / Live Class / Assignments / Exams / Reviews, role-tailored dashboard |

Per-role tab visibility is configurable by the Owner (**Admin → Access**)
and stored in `app_settings.data.roleAreas`. All of this is enforced by RLS
in the database, not just hidden in the UI.

## 6. Deploy on Vercel (free)

The project is already connected to the GitHub repo — **push to `main` and
Vercel auto-deploys**. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are
set in **Vercel → Settings → Environment Variables** for all environments.

First-time / re-linking:

```bash
npm install -g vercel
vercel login
vercel link
```

Then add the two env vars in the dashboard and push. Domain:
`finance.oksyacademy.in` (moving to `portal.oksyacademy.in`).

## 7. Staying on the free tier

- **Supabase free**: 500 MB DB, fair-use API. A free project pauses after
  **7 days idle** — log in and "Restore project" (< 1 min, no data lost).
- **Vercel Hobby**: ample for an internal tool; no card. Bursts of rapid
  pushes can be rate-limited briefly — production stays on the last good
  build until the next deploy clears.

## 8. Day-to-day account management

The Owner (or an Admin) adds and approves users from **Admin → Users** and
sets financial access there. You never touch Supabase for routine account
changes.
