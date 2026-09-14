# Step 11 — Database Terminology Rename: Plan (not executed)

Date: 2026-09-14
Scope: **planning only**, per this step's explicit instructions. No SQL was
run, no migration was written to `supabase/`, and nothing changed in the
live Supabase database while producing this document. Read-only inspection
of the repo tree at commit `e1f88c8` (branch `main`) plus the recovered
Step 4 database audit (see §0).

---

## 0. Important preliminary finding: the referenced Step 4 audit was never committed

This step's instructions point to
`docs/claude-project/audits/04-database-schema-audit.md` as required input
(specifically its §10 finance-terminology inventory). **That file does not
exist anywhere in `main`, in any branch, or in any commit** —
`git log --all --diff-filter=A --name-only` finds no trace of it ever being
added to the repository.

It does exist, uncommitted, at
`docs/audits/03-database-audit.md` inside a stale local worktree —
`.claude/worktrees/database-schema-audit-5337be/` (branch
`claude/database-schema-audit-5337be`). That worktree's own working
directory (originally under `/Users/anoopdasvs/oksy-academy-finance/...`)
was orphaned when the project folder was renamed to `oksy-academy-pulse`
(Step 10); `git worktree list` marks it `prunable` and its `.git` link is
broken, but the working files themselves survived on disk. The document was
apparently produced but **never staged, committed, or merged** — a gap in
the Step 4 session, not something this session did.

I read the recovered document in full and cross-checked its findings
against the current `main` (§1 below) rather than trusting it blindly,
since it predates this session and its filesystem home was already broken
once. Every SQL file it analyzed is byte-identical on `main` today **except
`schema.sql`**, whose header comment has already been fixed by Step 9
(`-- Oksy Academy Finance —…` → `-- Oksy Academy Pulse —…`). So its
inventory is current, with that one line now stale in the audit's own text
(I've corrected it below).

**Recommendation on this gap:** after this plan is reviewed, commit the
recovered file to `docs/claude-project/audits/04-database-schema-audit.md`
(unedited, as the historical Step 4 record — see §17 precedent in
`08-rename-migration-plan.md` about not rewriting audit history) so it
stops being at risk of loss, and then remove the orphaned worktree. I have
not done either — both are changes to repo/Git state, out of scope for a
read-only planning step, and the worktree removal in particular should wait
until you've confirmed nothing else uncommitted is sitting in the other
eight `prunable` worktrees alongside it.

---

## 1. AUDIT — full inventory

Methodology: composed the live schema by applying, in dependency order,
`schema.sql` → `01_healthcare_account.sql` … `17_collections_staff_insert.sql`
→ `migration-academy-suite-v2.sql` → `migration-academy-suite-v2b.sql` (the
same order the recovered Step 4 audit used, re-verified directly against
`main` with `grep -rniE "financ|portal"` across `supabase/**/*.sql` and
`supabase/functions/`, and against `src/` for application-layer call
sites). 23 live tables, all RLS-enabled; one orphaned v1 table
(`public.timetables`) not part of this inventory since it carries no
finance/portal naming of its own.

### 1.1 Literal "financ…" database identifiers

| Object | Kind | Identifier | Status |
|---|---|---|---|
| `public.profiles` | column | `can_view_financials` | live |
| — | function | `public.can_view_financials()` | live |
| — | function | `public.log_financial_change()` | live |
| `public.transfers` | RLS policy | `transfers_financial_viewer_select` | live |
| `public.bank_statements` | RLS policy | `bank_statements_financial_viewer_select` | live |
| `public.bank_statement_lines` | RLS policy | `bank_statement_lines_financial_viewer_select` | live |
| `public.audit_log` | RLS policy | `audit_log_financial_viewer_select` | live |
| `public.expenses` | RLS policy | `expenses_financial_viewer_select` | **historical only** — dropped by migration 04 (`drop policy if exists`); only appears in comments/`drop` statements now |
| `public.income` | RLS policies | `income_financial_viewer_select`, `income_admin_insert`, `income_admin_update` | **gone** — table dropped by migration 08; names survive only in migration 08's own comment |
| `supabase/schema.sql` | file header comment | ~~`-- Oksy Academy Finance — Supabase schema, roles & permissions`~~ | **already fixed** — Step 9 changed this to `-- Oksy Academy Pulse — …` (confirmed: `diff` against the recovered audit's snapshot shows this as the only change to `schema.sql`) |

### 1.2 Finance-domain nouns (the finance module's own vocabulary, no literal "financ…" substring)

Tables `collections`, `expenses`, `expense_categories`, `transfers`,
`bank_statements`/`bank_statement_lines`, `audit_log` (+ every index,
policy, and trigger named after them: `collections_basic`,
`collections_student_id_idx`, `collections_audit`, `expenses_date_idx`,
`expenses_audit`, `transfers_date_idx`, `transfers_audit`,
`transfers_distinct_accounts`, `bank_statement_lines_statement_idx`,
`audit_log_table_row_idx`, and the full `*_admin_update` /
`*_admin_delete` / `*_approved_select` / `*_staff_insert` policy family on
each); plus columns `students.registration_fee` / `course_fee` /
`exam_fee` / `other_fee` / `waiver`, `batches.course_fee`, and the
`account` / `from_account` / `to_account` columns sharing the
`'HDFC'|'ICICI'|'Cash'|'Healthcare'` check-constraint vocabulary. Full
per-object list in the recovered audit's §10.2 — reproduced in condensed
form here since it's long and every entry resolves the same way in §2
below.

### 1.3 Business-specific hardcoded values (not naming, but flagged by the recovered audit as adjacent)

`'HDFC'`, `'ICICI'` (real bank names) and `'Healthcare'` (an actual
affiliated company's inter-company clearing account, per `schema.sql`'s own
comment) — hardcoded into six `check` constraints across
`collections`/`expenses`/`transfers`/`bank_statements`/`bank_statement_lines`.
Also the migration file name `01_healthcare_account.sql`.

### 1.4 "Portal" naming inside the database layer

One hit, re-checked directly against current `main`:
`schema.sql:432` — `-- Mirrors supabase/migration-academy-suite.sql so a
fresh project gets the full portal in one pass.` This is generic English
("a full portal" = "the complete feature set"), not a reference to the
retired `portal.oksyacademy.in` placeholder domain — it sits inside the
already-known-stale §11 v1 Academy Suite block that Step 4's audit flagged
as dead documentation drift (superseded by
`migration-academy-suite-v2*.sql`). No other "portal" string exists
anywhere under `supabase/`.

### 1.5 Application-code identifiers that mirror the DB naming (for blast-radius context only — not database objects)

`can_view_financials` is read/written directly (not through an ORM
abstraction layer) in `src/context/AuthContext.jsx`,
`src/lib/access.js`, `src/components/StaffAccess.jsx`,
`src/pages/AdminPage.jsx`, `src/lib/access.test.js`, and
`supabase/functions/create-user/index.ts` — 6 call sites, all using the
exact column name as a JS object key (Supabase's JS client returns rows
keyed by column name, so any DB rename directly breaks all of these).
`isFinanceRelevant` (`StaffAccess.jsx`), "finance helpers" (`fees.js`),
"finance side" (`academy.js` comment), and "finance views"
(`PeriodFilter.jsx`) were already assessed in Step 8 and are out of this
step's scope by that step's own finding (§2 below explains why the DB-side
name gets the same treatment).

---

## 2. CLASSIFY

| # | Item | Classification | Justification |
|---|---|---|---|
| 1 | `can_view_financials` (column + function), `log_financial_change()`, `*_financial_viewer_select` policies | **KEEP** | This is Finance-*module* naming, not product-identity naming — it names a permission ("can this user view financial data") and an audit action ("a financial record changed"), both scoped to the Finance module of a multi-module Academy platform. It's the exact DB-side analogue of `isFinanceRelevant` in `StaffAccess.jsx`, which Step 8 already classified KEEP for the identical reason. Renaming it would blur a real, permanent distinction (finance permissions vs. academic permissions) for no benefit, and would break 6 application call sites plus the RLS policies themselves for zero naming-consistency gain — "Finance" is a real, permanent area of a school-management product, not a leftover brand string. |
| 2 | `collections`, `expenses`, `expense_categories`, `transfers`, `bank_statements`/`bank_statement_lines`, `audit_log` (tables, and every index/policy/trigger named after them) | **KEEP** | None of these names contain "finance" or "portal" at all — they're already domain-neutral nouns describing what the table holds (a fee collection, an expense, a transfer between accounts, a bank statement line, an audit entry). This matches Step 8's own finding: "no `finance`-prefixed tables found; domain-specific names like `expenses`, `collections`, `students` already scope-neutral — no change needed." There is nothing here that identifies the product's old "it's a finance app" identity; these are just correctly-named finance-*domain* tables, same as `students`/`batches`/`exams` are correctly-named academic-domain tables. |
| 3 | `students.registration_fee`/`course_fee`/`exam_fee`/`other_fee`/`waiver`, `batches.course_fee`, `account`/`from_account`/`to_account` columns | **KEEP** | Same reasoning as #2 — these describe what the column holds (a fee amount, an account name), not the product's identity. A generic academy platform still has fees, still has bank accounts to reconcile against; nothing here says "this product is called Finance." |
| 4 | `'HDFC'`, `'ICICI'`, `'Healthcare'` hardcoded check-constraint values; `01_healthcare_account.sql` file name | **KEEP / not a naming item** | These are business data (real bank names, a real affiliated company's clearing-account name), not identifiers carrying product-identity naming. A rename pass has nothing to do here — this is a data/business-config question ("should the clearing account be configurable instead of hardcoded"), not a Step 11-scoped terminology rename. Flagged by the recovered audit for awareness, not as a rename candidate, and I agree with that call. |
| 5 | `expenses_financial_viewer_select`, `income_financial_viewer_select`, `income_admin_insert`, `income_admin_update` | **N/A — already gone** | Dropped by migrations 04 and 08 respectively. They exist only as literal strings inside historical `drop policy if exists` statements and code comments in already-shipped, already-applied migration files. Per `DATABASE_AND_ARCHITECTURE_RULES.md`'s Migration Philosophy and `08-rename-migration-plan.md`'s own precedent ("Git history should not be rewritten... this is routine historical record"), applied migration files are a historical record and should not be edited retroactively. Nothing to plan. |
| 6 | `schema.sql` header comment (`-- Oksy Academy Finance — …`) | **N/A — already done** | Fixed by Step 9 to `-- Oksy Academy Pulse — …`. Verified by diffing the current file against the recovered Step 4 audit's snapshot: this is the only line that changed. No further action. |
| 7 | `schema.sql:432` "full portal in one pass" comment | **KEEP (not a rename target)** | Generic English usage of "portal" (= "the complete application"), not a reference to the retired `portal.oksyacademy.in` product-identity placeholder. Sits inside the pre-existing, separately-flagged-as-stale §11 v1 Academy Suite documentation block (dead code per the recovered audit's §9 — `public.timetables` and its siblings are superseded by the v2 tables and unused by the app). Not in this step's scope; if that dead block is ever cleaned up (a separate, non-naming cleanup task), this comment goes with it. |
| 8 | Repo name `oksy-academy-finance`, domain `finance.oksyacademy.in` | **Out of this step's scope** | Already covered by Steps 9–10 (app/repo/domain identity rename), not a database object. Mentioned in the recovered audit for completeness only. |

**Net result: zero database objects are classified RENAME.** Every literal
"finance" identifier in the schema is legitimate Finance-*module* naming
(same category Step 8 already ruled KEEP for the equivalent in-app names),
every table/column name was already domain-neutral, the one identity-era
artifact (`schema.sql`'s header) was already fixed by Step 9, and the one
"portal" string in the SQL is unrelated prose inside an already-known-dead
documentation block.

---

## 3. PLAN

Because §2 classified nothing as RENAME, there is no forward migration to
design, no rollback SQL to write, and no cutover sequencing needed — the
things a migration plan would normally cover (additive-vs-hard-cutover,
schema/RLS/function/app-code ordering, rollback SQL, data-at-risk analysis,
pre/post testing) don't apply because there is no change.

The one genuinely open, adjacent item — dropping the orphaned
`public.timetables` v1 table — is **not a naming rename** (it has no
finance/portal identity in its name at all) and is explicitly out of this
step's scope. If you want it handled, it should be its own small, clearly-
scoped follow-up (e.g. a "Step 11c: drop orphaned v1 timetables table"),
since it's a schema-cleanup decision with its own risk profile (row-count
check before drop, confirm zero app code paths reference it — already
partially verified by the recovered audit's `grep -rn '\.from("' src/`
check) that shouldn't be bundled into a terminology-rename step for
approval clarity.

---

## 4. Recommendation

**Defer / close Step 11 as "no database rename required."** The database
layer already reflects a coherent, domain-neutral naming scheme — it was
never actually branded around "finance" as a product identity the way the
repo name, domain, `package.json` name, and UI title text were (which
Steps 9–10 already fixed). The only DB-level trace of the old identity
(`schema.sql`'s header comment) is already corrected.

Do not force a rename here to make Step 11 "complete work" — per Standard
§14 (do not over-clean) and §16 (naming/cosmetics rank below correctness,
reliability, and maintainability), renaming `can_view_financials` or
`collections`/`expenses`/`transfers` would break live RLS policies and
6+ application call sites for a change that doesn't remove any historical-
identity naming, because none of these names carry that identity in the
first place.

**Suggested next actions (not part of this plan's execution, for you to
decide on separately):**
1. Commit the recovered Step 4 audit to
   `docs/claude-project/audits/04-database-schema-audit.md` so it's no
   longer sitting only in an orphaned worktree.
2. Optionally spin off "drop orphaned `public.timetables`" as its own
   small, separately-approved cleanup step — schema hygiene, not a rename.
3. Optionally fix the two remaining "Academy Portal" UI strings found
   while cross-checking this audit (`src/components/Login.jsx:51`,
   `src/App.jsx:144,1295`) — these are leftover from before Step 9's
   portal→pulse pass and are user-facing text, not database objects, so
   they belong with the Steps 9–10 identity work, not here.

No SQL, migration file, or application code was changed to produce this
document.
