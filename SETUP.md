# Oksy Academy Finance Console — Setup & Deployment (Zero Cost)

This app now has real logins (admin/staff), role-based permissions, and a
shared cloud database, built on **Supabase's free tier**. No fields on
Supabase or Vercel require a card for the free tier used here.

## 0. Install the new dependency

I already added `@supabase/supabase-js` to `package.json`, but couldn't run
`npm install` from here (the sandboxed tool I used to edit your project has
no internet access to the npm registry). In your own VS Code terminal:

```
npm install
```

## 1. Create a free Supabase project

1. Go to https://supabase.com and sign up (GitHub login is fastest).
2. Click **New Project**. Pick any org, name it `oksy-academy`, set a
   database password (save it somewhere safe), choose the region closest to
   Kerala (Mumbai / `ap-south-1`), and create it. Takes ~2 minutes to spin up.
3. In the project, go to **Project Settings → API**. You'll need two values:
   - **Project URL**
   - **anon public** key

## 2. Connect the app to Supabase

In the project folder, copy `.env.example` to `.env`:

```
cp .env.example .env
```

Open `.env` and paste in the two values from step 1:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

`.env` is already in `.gitignore`, so it never gets committed or pushed.

## 3. Create the database tables & permissions

1. In Supabase, open **SQL Editor → New query**.
2. Paste the entire contents of `supabase/schema.sql` (in this project) and
   click **Run**.

This creates the `profiles`, `students`, `collections` and `expenses`
tables, and sets up the row-level security rules that:
- let any approved login (admin or staff) manage students and record fee
  collections,
- restrict expenses, and the account/Healthcare details behind fee
  collections, to admins and staff an admin has specifically granted
  **financial access** to.

(Optional but recommended) In **Authentication → Providers → Email**, you
can turn off "Confirm email" so new staff accounts don't need to click an
email link before an admin can approve them — simpler for an internal tool.

## 4. Run the app and create the first admin

```
npm run dev
```

Open the app, go to the **Staff Sign Up** tab, and create your own account
(use the email you'll use as the academy's finance admin). You'll see a
"waiting for approval" screen — that's expected, since every new account
starts as unapproved staff.

Go back to Supabase's **SQL Editor** and run (with your email):

```sql
update public.profiles
   set role = 'admin', is_approved = true, can_view_financials = true
 where email = 'you@example.com';
```

Sign out and back in — you're now an admin, and you'll see a **Staff
Access** tab in the sidebar. From there you can approve every other staff
account as they sign up, and toggle each staff member's role and
**financial access** (bank balances, Healthcare inter-company figures,
expenses, dashboard and reports) on or off.

## 5. What staff see vs. admins

- **Everyone approved** (admin or staff): Student Enrollment and Fee
  Collection (student payment history and outstanding balances).
- **Admins, and staff granted financial access**: Dashboard, Expenses,
  Transfers, Bank Reconciliation, Reports — plus, on the Fee Collection
  table, which bank account or Healthcare received each payment.
- **Only admins**: the Staff Access page, and adding/importing expenses.

This is enforced in the database (not just hidden in the app), so a
restricted staff login genuinely cannot pull that data even by inspecting
network requests.

## 6. Deploy for free so staff & management can open a link

This gives everyone a real `https://...` URL instead of `localhost`.

1. Create a free account at https://vercel.com (GitHub login is easiest).
2. In your project folder:
   ```
   npm install -g vercel
   vercel login
   vercel
   ```
   Follow the prompts (link to a new project, accept the defaults — Vercel
   auto-detects Vite).
3. In the Vercel dashboard for the new project, go to **Settings →
   Environment Variables** and add the same two variables from your `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Deploy the production build:
   ```
   vercel --prod
   ```
   Vercel gives you a URL like `oksy-academy-finance.vercel.app` — share
   that with staff and management. Every time you want to publish changes,
   re-run `vercel --prod` (or connect the project to a GitHub repo in the
   Vercel dashboard for automatic deploys on every push).

## 7. Staying on the free tier

- **Supabase free tier**: generous for an academy this size (500MB
  database, unlimited API requests within fair use). One thing to know: a
  free project pauses itself after **7 days with no activity**. If that
  happens, log into supabase.com and click "Restore project" (takes under a
  minute) — no data is lost.
- **Vercel free (Hobby) tier**: plenty of bandwidth for an internal tool
  used by staff and management; no card required.

## 8. Adding more admins or staff later

Anyone can create an account from the **Staff Sign Up** tab; you approve
them (and optionally grant financial access) from the **Staff Access** page
as an admin. You never need to touch Supabase directly for day-to-day
account management.
