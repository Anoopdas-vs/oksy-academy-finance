# Security Audit — oksy-academy-finance

Date: 2026-09-14
Scope: read-only security audit of authentication, session handling,
protected routes, Supabase RLS policies (every table), service-role key
usage, environment-variable exposure, and secrets in git history. **Nothing
in the repository was modified.** This audit was performed on branch
`claude/security-audit-findings-d9d51c`, which sits on top of `main` — i.e.
the same code currently live in production at `finance.oksyacademy.in`.

## 0. Note on task instructions

The task asked me to first read `docs/claude-project/SECURITY_REQUIREMENTS.md`.
**That file, and the whole `docs/claude-project/` directory, do not exist**
anywhere in this repository (checked the working tree, `main`, and every
other local/remote branch). This is the same gap
[01-repo-audit.md](01-repo-audit.md) flagged for the same directory. In its
absence I used the project's actual documentation
([`PROJECT_OVERVIEW.md`](../../PROJECT_OVERVIEW.md), `AGENTS.md`,
`supabase/schema.sql`'s own inline comments) as the frame of reference for
what access model the app *intends*, and audited the code/SQL against that
intent.

**Important context found during this audit, not mentioned in the task:** a
local, unmerged branch (`release/2026-09-13`, 9 commits ahead of `main`, not
pushed anywhere) and a pushed-but-unmerged `origin/fix/engineering-review-2026-09`
already contain a prior security review's fixes, addressing findings the
authors label C2, C3, C4, H1, H4, H5, M6. I independently re-derived several
of these same issues below (before reading that branch's diff) by reading
`supabase/schema.sql` directly, then cross-checked my conclusions against
that branch's fix commits and comments as a second opinion. Where a finding
below is already fixed on that branch, I say so explicitly — **none of those
fixes are on `main` or on this audit's branch today.** One finding below
(CRIT-1) is **not** addressed by that branch either and appears to be new.

---

## 1. Summary

The app's security model is "Supabase Auth session + Postgres RLS is the
real boundary; the React UI is just a convenience layer that hides tabs a
role isn't supposed to use." That's the right architecture for a
backend-less SPA. The problem found by this audit is that the RLS policies
on several financial tables don't actually match that intent: they gate on
**"is this user approved at all"** rather than **"does this user have the
role/financial-access this data requires."** Because the anon key and a
valid session JWT both sit client-side by design, anything RLS
doesn't stop, a technically-inclined student or faculty account (an
"approved" but non-privileged role) can do directly against the Supabase
REST endpoint, regardless of what the React UI shows them.

The most serious finding (CRIT-1) is that the fee/expense-recording tables
accept writes from **any approved user**, and the app's own outstanding-fee
math (`src/lib/fees.js`) trusts every row in `collections` equally — so a
student account can forge their own fee payments and directly zero their
outstanding balance. This was not caught by the prior (unmerged) engineering
review either.

---

## 2. Findings

### CRITICAL

#### C-1. Any approved user can forge financial records for themselves or anyone else (not covered by the unmerged fix branch)

`supabase/schema.sql`:
- `students_approved_insert` / `students_approved_update` (lines 113–117):
  `with check (public.is_approved_user())` — no role or ownership check at
  all.
- `collections_approved_insert` (line 148): same — `is_approved_user()`,
  and the row's `student_id` is fully client-supplied with no check that it
  matches the caller.
- `expenses_approved_insert` / `expenses_approved_update` (lines 201–205):
  same.
- `batches_approved_insert` / `batches_approved_update` and
  `expense_categories_approved_*` (lines 346–370): same.

**Risk:** `src/lib/fees.js:57-77` (`studentFeeTotals`) computes every
student's outstanding balance by summing **all** `collections` rows for
their `student_id`, with no regard to who created them or whether an admin
verified them. Because `collections_approved_insert` only requires the
caller to be *any approved user* — which includes the `student` and
`faculty` roles, not just `admin`/`staff` — a student's own browser session
can call
`supabase.from("collections").insert({ student_id: "<own or anyone's ID>", amount: 999999, account: "Cash", ... })`
directly (bypassing the React UI, which simply doesn't render that button
for their role) and either zero their own fee balance or fabricate a
payment on another student's record. The same gap lets any approved,
non-privileged account tamper with `students.waiver` / `students.status`
directly, edit the shared `batches.course_fee` used to auto-fill future
enrolments, or insert throwaway `expense_categories`/`batches` rows. This is
a direct path to financial fraud, not just an information leak, and — per
`src/lib/fees.js` — actually changes numbers the app trusts and reports on.

---

#### C-2. `collections_basic` masking view can be bypassed by querying the base table directly (fixed on `release/2026-09-13`, not on `main`)

`collections_approved_select` (schema.sql:145) grants `select` on the raw
`collections` table to *any* approved user via `is_approved_user()` — the
same broad predicate as the masking view `collections_basic` is supposed to
replace for non-financial users. Nothing revokes direct table access, so
any approved user (student, faculty, unprivileged staff) can call
`supabase.from("collections").select("account,...")` directly and read the
true bank/cash account for every fee payment ever recorded — the exact
column `collections_basic`'s `case when can_view_financials() ... else null`
logic exists to hide. `src/lib/data.js:51-59` (`fetchCollections`) only
picks the masked view *client-side*, which is not an enforcement boundary.

**Already fixed** on the unmerged `release/2026-09-13` branch
(`supabase/06_close_collections_view_bypass.sql`: revokes `select` on the
base table from `authenticated`, grants only the `id` column, rebuilds the
view with `security_barrier` + an explicit `where is_approved_user()`
clause). That fix is not present on `main` or this branch.

---

#### C-3. `create-user` Edge Function lets a plain `admin` mint new admin-level logins, bypassing the UI's Owner-only restriction (fixed on `release/2026-09-13`, not on `main`)

`supabase/functions/create-user/index.ts:46` authorizes the caller with
`!["admin", "super_admin"].includes(profile.role)` — i.e. any operational
`admin`, not just the `super_admin` ("Owner"). `ASSIGNABLE` on line 54
includes `"admin"` itself. The app's own access model
(`src/lib/access.js:111`, `manageUsers: isSuperAdmin`) hides "Create Login"
from plain admins in the UI — but the Edge Function is a public HTTPS
endpoint any authenticated admin's browser can call directly
(`supabase.functions.invoke("create-user", {...})`), with no UI gate at
all. One operational admin can therefore silently create a peer (or several
peer) admin accounts, entirely outside the Owner's visibility — a
privilege-escalation path for anyone who already holds the lesser `admin`
role.

**Already fixed** on `release/2026-09-13`: the check is tightened to
`profile.role !== "super_admin"` and `ASSIGNABLE` trimmed to
`["admin", "staff"]`. Not present on `main`/this branch.

---

### HIGH

#### H-1. Any `admin` (not just the Owner) can read the full user roster (fixed on `release/2026-09-13`, not on `main`)

`profiles_admin_select_all` (schema.sql:80) uses `public.is_admin()`, which
returns true for both `admin` and `super_admin`. The app's model reserves
the "Users" roster screen for the Owner only
(`access.js: manageUsers: isSuperAdmin`), but the database policy lets any
plain admin `select * from profiles` and read every user's email, role,
approval state, and `can_view_financials` flag — a PII/access-map exposure
beyond what the app intends that role to see.

**Already fixed** on `release/2026-09-13`
(`07_tighten_profiles_select.sql`: policy rewritten to `is_super_admin()`).

---

#### H-2. Students can set their own assignment marks/feedback while the row still reads "submitted"

`migration-academy-suite-v2.sql:261-264`:

```sql
create policy "sub_student_update" on public.assignment_submissions
  for update to authenticated
  using (student_id = auth.uid() and status = 'submitted')
  with check (student_id = auth.uid() and status = 'submitted');
```

Postgres RLS `USING`/`WITH CHECK` clauses constrain *which rows* a
statement may touch, not *which columns* a caller may change within an
allowed row. This policy only requires that the row stay owned by the
caller and stay `status = 'submitted'` — it says nothing about the `marks`
or `feedback` columns. A student can therefore run an UPDATE against their
own (still-`submitted`) row that sets `marks`/`feedback` to whatever they
like, as long as they don't also flip `status`. This wasn't part of either
prior review's numbered findings and is not fixed anywhere in the repo
today. (The parallel exam design gets this right — students have no UPDATE
policy on `exam_attempts` at all; grading only happens through the
`security definer` `score_exam_attempt()` function.)

---

#### H-3. `xlsx` (SheetJS) 0.18.5 has two unpatched high-severity advisories

`npm audit` (run read-only, no changes made) reports for the pinned
`"xlsx": "^0.18.5"`:
- Prototype Pollution — GHSA-4r6h-8v6p-xvw6
- ReDoS — GHSA-5pgg-2g8v-p4x9

— both marked "No fix available" on the npm registry version line. This
library parses admin/staff-uploaded bank-statement and bulk-import Excel
files (`src/lib/bankStatement.js`, `ImportPreviewModal.jsx`, `templates.js`)
— i.e., it runs against externally-sourced file content (a bank's
statement export, a spreadsheet someone hands the admin to bulk-import
students). A crafted `.xlsx` handed to an admin for import is a plausible
delivery path for either advisory. **Already identified and addressed**
(dependency swap) on `release/2026-09-13` as finding C5 — not on
`main`/this branch.

---

### MEDIUM

#### M-1. "Confidential" expenses are readable and writable by every approved user, including students

`supabase/schema.sql:177` labels the table "confidential — admin, or staff
explicitly granted access" in its own header comment, but
`expenses_approved_select`/`_insert`/`_update` (lines 198–205) all gate on
plain `is_approved_user()`. This is a deliberate, documented broadening
(`migration-staff-access.sql`, "Approved staff can now record & edit
expenses") — not a bug — but as written it also hands the same access to
`student`/`faculty`/`professional` roles, since "approved" doesn't
distinguish role at all. Category names like "Salary" and "Commission" (the
seeded `expense_categories`) plus every amount/reference/description are
visible to, and editable by, any signed-in student. Worth a deliberate
decision either way, since the in-code comment and the actual policy
disagree about who this data is for.

#### M-2. Wildcard CORS on the `create-user` Edge Function

`supabase/functions/create-user/index.ts:17-21` sets
`Access-Control-Allow-Origin: "*"`. Exploitability is limited today (the
function still requires a valid bearer JWT, and that JWT lives in the app's
own localStorage, not reachable by an arbitrary third-party origin's JS),
but it's unnecessary attack surface for an admin-privileged endpoint and
worth narrowing to the known app origins
(`finance.oksyacademy.in`, `portal.oksyacademy.in`) as defense in depth.

#### M-3. Self-service Google OAuth signup doesn't actually require an invitation

`Login.jsx`'s footnote states "Access is by invitation. An Oksy Academy
admin creates your login" — true for the email/password path (accounts are
created via the admin-only `create-user` function) — but the same screen
also offers **Continue with Google** (`signInWithOAuth`), and
`handle_new_user()` (schema.sql:62-71) auto-provisions a profile for *any*
first-time Google sign-in, defaulting to `is_approved = false`. So anyone
with a Google account can self-register and land on the "waiting for
approval" screen, contrary to the stated invitation-only model. The only
gate is a super-admin never approving them — which works, but is a silent
discrepancy between the documented model and what the code (and, unless
restricted in the Supabase Auth dashboard's OAuth settings — not visible
from this repo) actually allows. Worth confirming the Supabase project
restricts the OAuth client (e.g. to a hosted domain) if self-signup by
strangers shouldn't be possible even transiently.

---

### LOW

#### L-1. Migration files are hand-run, unordered, and not tracked by a migration table

Already flagged in [01-repo-audit.md](01-repo-audit.md) item 6: filename
alphabetical order doesn't match required run order (`-` sorts before `.`),
which the unmerged review branch also hit and fixed by renumbering to
`01_…10_…`. Not directly exploitable, but it's an operational risk that
compounds every RLS finding above: with no migration-state tracking, a
fresh or partially-replayed deploy could easily end up on an inconsistent
subset of these policies (e.g. the pre-v2 `exam_questions`/`exam_results`
design in `schema.sql` §11, which — unlike the `migration-academy-suite-v2.sql`
design the app's code (`src/lib/academy.js`) actually targets — lets any
approved user `select *` from `exam_questions` and read the answer key
directly, and lets a student write their own `exam_results.score` with no
ownership-independent scoring). Confirmed the *code* only ever calls the
safe v2 surface (`exam_questions_public`, `score_exam_attempt()` RPC), so
this is a deployment-consistency risk, not a currently-exploitable app path
— contingent on `migration-academy-suite-v2.sql` actually having been run
after `schema.sql` on the live project, which this repo can't confirm by
itself.

#### L-2. No secrets, credentials, or `.env` found anywhere in git history (clean)

Re-verified independently of [01-repo-audit.md](01-repo-audit.md) item 10:
searched full `git log --all -p` for `.env`-shaped filenames, JWT-shaped
strings (`eyJ...`), and common `key=`/`secret=`/`token=` patterns across
every branch — nothing found. `supabase/functions/create-user/index.ts`
correctly reads its service-role key from `Deno.env.get(...)`, never
embeds it. `.env` is gitignored and only `.env.example` (placeholder
values) is tracked. **This is a clean result, not a finding** — included
for completeness since the task asked specifically about this.

#### L-3. Password-reset / OAuth redirect uses `window.location.origin` at runtime

`AuthContext.jsx:101,108` passes `redirectTo: window.location.origin` to
both `signInWithOAuth` and `resetPasswordForEmail`. This is safe *only*
because Supabase Auth independently enforces an allow-list of valid
redirect URLs at the project level — the app can't itself cause an open
redirect as long as that allow-list is scoped to the real app origins in
the Supabase dashboard (not visible from this repo, so noted as an
operational check rather than a code defect).

---

## 3. What's already fixed elsewhere but not on `main`

For the user's awareness, since it changes what "fix this" means here: `git
log` shows a local branch `release/2026-09-13` (9 commits ahead of `main`,
never pushed) and a pushed-but-unmerged `origin/fix/engineering-review-2026-09`
(6 of those same commits) that already resolve C-2, C-3, H-1, and H-3
above, plus an audit-log trigger (H1 in their numbering, unrelated to this
report's H-1), the dead `income` table, migration ordering, and a
forced-password-change flow for admin-created logins. **None of that is on
`main` or on this audit's branch.** C-1 (broad write access to
students/collections/expenses/batches) and H-2 (assignment self-grading)
are not addressed by that branch either and appear to be new findings from
this pass.

## 4. What was verified clean

- No secrets/credentials in git history or the working tree (L-2).
- Every table has RLS enabled (`schema.sql` enables it on all 20+ tables;
  none were found with RLS off).
- The Edge Function is the only path that touches the service-role key,
  and does so only server-side via `Deno.env.get`.
- Client-side route/tab gating (`src/App.jsx:118-150`) correctly treats
  `loading`/no-session/no-profile/unapproved as blocking states before
  rendering `AppShell` — this is UX, not the real boundary, but it's
  implemented correctly and fails closed (shows a login/waiting screen, not
  a broken/partial UI) if the session or profile is missing.
- The exam engine's *current* design (`migration-academy-suite-v2.sql`) is
  properly hardened: no answer key ever reaches an authenticated,
  non-manager client (`exam_questions_public` view strips `correct_index`),
  and scoring happens only inside a `security definer` function students
  cannot bypass to self-score.
- `assignment_submissions`/`faculty_reviews`/`exam_attempts` all correctly
  bind row ownership to `auth.uid()` in their `WITH CHECK` clauses (no
  identity-spoofing path found), except for the column-level gap in H-2.

No files were modified as part of this audit.
