# Branch Reconciliation Audit — main / release/2026-09-13 / origin/fix/engineering-review-2026-09

Date: 2026-09-14
Scope: read-only reconciliation of three refs. **No branch, file, or commit
was created, merged, rebased, cherry-picked, deleted, or pushed.** Only
`git log`, `git show`, `git diff`, `git merge-base`, `git ls-tree`, and
`git rev-list` were run. The only write this task performed is this report
file (and the new `docs/claude-project/audits/` directory it lives in).

---

## 0. Notes on task instructions (read this first)

**a. `docs/claude-project/` does not exist and never has.** The task asked
me to first read `docs/claude-project/CLAUDE_PROJECT_CONTEXT.md`,
`SECURITY_REQUIREMENTS.md`, and `DEVELOPMENT_AND_TESTING_RULES.md`. None of
these exist anywhere in this repository — not on the working tree, not on
`main`, not on any of the nine local/remote branches. This is the exact same
gap [`01-repo-audit.md`](../../audits/01-repo-audit.md) and
[`02-security-audit.md`](../../audits/02-security-audit.md) already flagged
for a slightly different (but equally nonexistent) set of filenames under
the same nonexistent directory. `git log --all --diff-filter=A` confirms
these paths were never added in any commit on any ref — the earlier hits
that looked like matches were commit-message text (those two audits *quoting*
the requested-but-missing paths), not real files. I used
[`PROJECT_OVERVIEW.md`](../../../../PROJECT_OVERVIEW.md), `AGENTS.md`, and
the two existing audits at `docs/audits/` as the actual frame of reference,
consistent with what those two prior audits already did.

**b. This report is being written to `docs/claude-project/audits/…`, a
brand-new directory, while the two documents it reconciles
(`01-repo-audit.md`, `02-security-audit.md`) live at `docs/audits/…`.** I
followed the task's explicit path instruction literally rather than
"correcting" it to match the existing convention, since creating exactly one
new directory and one new file was explicitly authorized — but flagging this
so a human can decide whether this report should eventually move to
`docs/audits/02b-branch-reconciliation.md` for consistency.

**c. The "prior read-only security audit" the task describes is
`docs/audits/02-security-audit.md`.** It is **not committed anywhere** — it
is an untracked file sitting in the working tree of the
`claude/security-audit-findings-d9d51c` worktree (branch tip is `e97f004`,
identical to `main`; `git status` there shows the file as untracked). If
that worktree is ever cleaned up without committing it first, this evidence
disappears. I read it directly off disk since `Read` isn't restricted to
git-tracked content. The task's finding codes (CRIT-1, C-2, C-3, H-1, H-2,
H-3) match that document's own "C-1" (the task calls it "CRIT-1"), C-2, C-3,
H-1, H-2, H-3 exactly — confirmed this is the right source.

**d. Two independent, differently-numbered review passes exist, and their
labels collide.** `docs/audits/02-security-audit.md` uses **hyphenated**
labels (C-1, C-2, C-3, H-1, H-2, H-3, M-1…M-3, L-1…L-3) and is the one the
task references. The commit messages and SQL comments on the two branches
under review reference a **separate, un-hyphenated** "engineering review"
(C1–C5, H1–H5, M1–M9) whose own source document I could not find committed
or uncommitted anywhere in this repo or its worktrees — only its conclusions
survive, as inline comments on the fix commits themselves. **These two
numbering schemes do not line up 1:1 and some labels collide with different
meanings** — e.g. the engineering review's own "H1" is the audit-log-trigger
gap (nothing to do with `docs/audits/02-security-audit.md`'s H-1, which is
the `profiles` roster over-exposure). Section 1 below gives the correct
cross-reference. Everything in this report's tables is classified against
**`docs/audits/02-security-audit.md`'s labels** (the ones the task named),
since that is the document I could actually read and independently verify
against the code.

---

## 1. Branch relationship

```
main (e97f004, live in production)
  |
  ...
  a787071  <-- merge-base(main, release/2026-09-13)
  |    \
  |     \  (fix/engineering-review-2026-09 branched here too — same base)
  |      \
  |    f1de945  Fix database security issues and harden RLS (C2,C3,C4,H1,H4,H5,M6)*
  |    3b693ad  Fix Net P&L double-count, resilience, credit-balance UX (C1,H2,M1,M5,M9,M6-fe)*
  |    8595774  Upgrade vulnerable xlsx dependency, add unit tests (C5,M4)*
  |    d861eb9  Add off-platform nightly DB backup, update docs (H3)*
  |    24909ec  Remove permanent Edge-Function note, auto-deploy it instead   <- origin/fix tip (5 commits)
  |      |
  |    2fe2971  Merge fix/engineering-review-2026-09 into main line, reconciled w/ Academy Suite
  |    58d49a9  Fix wrong useAuth import path in ForcePasswordChange.jsx
  |    769810a  Keep Net P&L Healthcare double-subtraction, scope to period
  |    580c3ec  Revert to subtracting the exact all-time Due to Healthcare figure  <- release/2026-09-13 tip (9 commits total)
  |
  3bff47d, bd978be, a787071(merge)... -> 936a2c5 (docs: 01-repo-audit.md) -> e97f004 (main tip)

* = un-hyphenated "engineering review" labels (see §0.d) — NOT docs/audits/02-security-audit.md's labels.
```

**Key fact, verified with `git merge-base --is-ancestor`:
`origin/fix/engineering-review-2026-09` IS an ancestor of `release/2026-09-13`.**
These are **not two independent forks that diverged from `main`**. They
diverged from the *same* point (`a787071`), but `release/2026-09-13`
literally contains all 5 of `origin/fix`'s commits (merged in via `2fe2971`,
"reconciled with Academy Suite"), then adds 3 more commits on top:

- `58d49a9` — fixes an import-path bug that `3b693ad` itself introduced
  (`ForcePasswordChange.jsx` importing `useAuth` from the wrong path). This
  is a self-inflicted-then-self-fixed bug within the branch, not a conflict
  with `origin/fix`.
- `769810a` then `580c3ec` — one commit changes how Net P&L scopes the
  "Due to Healthcare" subtraction, and the very next commit **reverts it
  back** to the original (all-time) behavior. Net effect of these two
  combined: **no behavioral change from what `origin/fix` already had.**

`main` itself has moved on independently since the fork point: it merged
PR #3 (`bd978be`, timetable/exam access + batch notify), PR #4
(`936a2c5`, `docs/audits/01-repo-audit.md`) — **2 commits main has that
neither security branch has** (`936a2c5`, `e97f004`). `git diff --name-only`
confirms **zero file overlap** between what main added on its own
(`docs/audits/01-repo-audit.md` only) and what either security branch
touched. A merge of `release/2026-09-13` into `main` today would be
conflict-free.

**Conclusion for the task's Step 5 ("do the two branches conflict"): no —
they cannot conflict, because one is a strict ancestor of the other.**
There is nothing to reconcile between them; reconciling is only "main vs.
release/2026-09-13."

---

## 2. Commit table

| Commit | Branch(es) | What it does | `02-security-audit.md` finding | Verified correct? | Recommendation |
|---|---|---|---|---|---|
| `f1de945` | both | Renames `migration-{healthcare,transfers,admin-reports,staff-access,super-admin}.sql` → `01`–`05` numeric prefixes; adds `06_close_collections_view_bypass.sql`, `07_tighten_profiles_select.sql`, `08_drop_income_table.sql`, `09_audit_log.sql`, `10_force_password_change.sql`; tightens `create-user` Edge Function | **C-2** (fixed), **C-3** (fixed), **H-1** (fixed), plus dead `income` table + audit-log trigger + forced-password-change (task's other named items) | **Yes** for C-2/C-3/H-1 — read the actual SQL, not just the message (see §3) | **KEEP** |
| `3b693ad` | both | Net P&L double-count UX, `ErrorBoundary`, `ForcePasswordChange.jsx` (UI half of the C-3 fix), `changePassword` in `AuthContext.jsx`, `creditBalance()` in `fees.js`, access.js comment update | Not a `docs/audits/02-security-audit.md` finding (Net P&L/credit-balance are pre-existing product bugs the engineering review separately tracked, not RLS/security). The `ForcePasswordChange.jsx` piece is the frontend half of C-3's forced-password-change requirement. | Partial — the password-change UI is correct and wired end-to-end (verified, §3); introduces the `ASSIGNABLE_ROLES` regression, see §5 | **NEEDS MODIFICATION** (see §5 before merge) |
| `8595774` | both | Swaps `xlsx` `^0.18.5` → SheetJS CDN tarball `0.20.3`; adds `fees.test.js`, `reconcile.test.js` | **H-3** (fixed) | **Yes** — 0.20.3 is past both CVEs' patched line; this is the standard SheetJS-recommended remediation path since the npm registry line stops at 0.18.5 | **KEEP** |
| `d861eb9` | both | Adds `.github/workflows/nightly-backup.yml` + `scripts/backup-db.sh`, docs | Unrelated to any `docs/audits/02-security-audit.md` finding — operational/DR hardening from the separate "engineering review" | Not evaluated for correctness (ops script, not a security-policy fix) — **needs its own review** (does the backup script actually work, is the destination trustworthy, is a service-role key needed in a GitHub secret) | **NEEDS DECISION** (unrelated-to-security work, see §4) |
| `24909ec` | both | Adds `.github/workflows/deploy-edge-functions.yml`; removes a manual "needs deploy" doc note; touches `AdminPage.jsx` and `data.js` | Unrelated to any named finding — deployment automation | Not evaluated in depth | **NEEDS DECISION** (see §4) |
| `2fe2971` | release only | Merge commit: `fix/engineering-review-2026-09` into a line "reconciled with Academy Suite" | N/A (merge) | The reconciliation **missed** the `ASSIGNABLE_ROLES` mismatch (§5) | **NEEDS MODIFICATION** (fix before taking this merge as-is) |
| `58d49a9` | release only | Fixes an import-path bug in `ForcePasswordChange.jsx` that `3b693ad` introduced | N/A — internal bugfix for this same branch's own prior commit | Correct fix, trivial | **KEEP** |
| `769810a` | release only | Scopes Net P&L's Healthcare subtraction to the selected period | Unrelated to security | Superseded by the very next commit | **DISCARD** (moot — reverted) |
| `580c3ec` | release only | Reverts `769810a`; restores all-time subtraction, with a comment explaining it was a deliberate, owner-confirmed design choice | Unrelated to security | N/A — net effect is "no change from `origin/fix`'s state" | **KEEP** (as the current end-state; `769810a` is dead weight in history but harmless) |

---

## 3. Independent verification of the four fixed findings

I read the actual SQL/TS diffs (`git diff main..release/2026-09-13 -- <file>`
and `git show f1de945:<file>`) rather than trusting the commit messages.

- **C-2 (`collections` view-bypass).** `06_close_collections_view_bypass.sql`
  revokes `select` on the base `collections` table from `authenticated`
  entirely, grants back only the `id` column (needed for `RETURNING`/`WHERE
  id=`), and rebuilds `collections_basic` as a plain (not
  `security_invoker`) view with `security_barrier` and an explicit
  `where public.is_approved_user()` clause. This closes the exact bypass
  described (`select account from collections` directly) without changing
  what any legitimate role can already see through the view. The migration's
  own comment documents empirical verification against a real Postgres 16
  instance (insert+`RETURNING id` works; direct `select account` denied;
  view still reveals `account` correctly to `can_view_financials()`/owner).
  **Confirmed correct.**

- **C-3 (`create-user` admin escalation).** The Edge Function's gate changed
  from `!["admin","super_admin"].includes(profile.role)` to
  `profile.role !== "super_admin"` — this closes the escalation path (a
  plain `admin` invoking the function directly can no longer pass the
  check at all, let alone mint a peer `admin`). **Confirmed correct.**

- **H-1 (`profiles` roster over-exposure).** `07_tighten_profiles_select.sql`
  drops `profiles_admin_select_all` (`using (is_admin())`, true for both
  `admin` and `super_admin`) and replaces it with
  `profiles_super_admin_select_all` (`using (is_super_admin())`).
  `profiles_self_select` is untouched, so every user can still read their
  own row (what `AuthContext.jsx` depends on). **Confirmed correct** — this
  now matches the app's own model (`manageUsers: isSuperAdmin`).

- **H-3 (`xlsx` unpatched CVEs).** `package.json`'s `xlsx` dependency moved
  from the npm-registry `^0.18.5` line (where both GHSA-4r6h-8v6p-xvw6 and
  GHSA-5pgg-2g8v-p4x9 are marked "no fix available") to SheetJS's own CDN
  tarball `xlsx-0.20.3.tgz` — the vendor's documented workaround for
  consumers who need a patched build without waiting on an npm-registry
  release. **Confirmed as the standard remediation for this specific
  package's stalled-npm-release situation**, not just a version bump. (Note:
  I did not run `npm install`/`npm audit` against this changed dependency
  spec, per the read-only constraint — this is a documentation-level
  verification of the fix approach, not a live audit re-run.)

All four hold up under independent review — none is only a partial or
cosmetic fix.

---

## 4. Commits unrelated to any named security finding

These need their own (non-security) review before being pulled into `main`,
per the task's Step 2:

1. **`3b693ad`'s Net P&L / credit-balance UX changes** (`fees.js:creditBalance`,
   `App.jsx` Net P&L comment/formula, `ReportsPage.jsx`, `Dashboard.jsx`) —
   financial-reporting logic and display changes, not an access-control fix.
   Needs a finance-correctness review, not a security one.
2. **`769810a` + `580c3ec`** — an in-branch experiment (scope the Healthcare
   subtraction to the period) that was tried and then explicitly reverted
   one commit later with a comment saying the reversion was confirmed with
   the owner. Net effect on `release/2026-09-13`'s tip is zero change from
   what `origin/fix` already had — but the fact that this back-and-forth
   happened inside a branch labeled "engineering review" is a signal the
   branch wasn't purely mechanical security patching; some product decisions
   got made in-line. Worth knowing before treating every commit on this
   branch as "just a security fix."
3. **`d861eb9`** — adds a nightly DB backup GitHub Action + shell script.
   Legitimate operational hardening, but a CI/CD and secrets-handling change
   (does the backup script need a Supabase service-role key as a GitHub
   secret? is the backup destination itself access-controlled?) that
   deserves its own review, separate from the RLS/policy fixes.
4. **`24909ec`** — adds an Edge Function auto-deploy GitHub Action and
   removes a manual "you still need to deploy this by hand" doc note. Also
   CI/CD, not a policy fix — worth checking the workflow's own permissions
   (what token/secret does it use to deploy) before adoption, given this
   audit's remit is security.
5. **`58d49a9`** — one-line import-path bugfix for code `3b693ad` itself
   introduced. Trivial, but flagged because it's evidence this branch
   wasn't fully exercised/tested before commits landed (see §5's note on
   testing rigor).

---

## 5. Regression found: `create-user` Edge Function silently downgrades student/faculty/professional logins to `staff`

Not in `docs/audits/02-security-audit.md`, found by cross-checking the
fix against `src/lib/access.js` and `AdminPage.jsx` per the task's Step 4.

- `supabase/functions/create-user/index.ts` (part of the C-3 fix in
  `f1de945`) trims its internal `ASSIGNABLE` list from
  `["admin","staff","student","faculty","professional"]` to
  `["admin","staff"]`, with a comment claiming "student/faculty/professional
  have no permissions or screens today."
- That comment was true when `f1de945` was authored (2026-09-09T06:07 UTC)
  — **but Academy Suite v2, which gives `student`/`faculty` real screens
  (Timetable, Assignments, Exams, Reviews), had already merged into `main`
  the next day** (`0741e2b`, 2026-09-10T09:49 IST) and was live on `main`
  three days before `2fe2971` merged the fix branch in "reconciled with
  Academy Suite" (2026-09-13T10:47 UTC).
- `src/lib/access.js`'s `ASSIGNABLE_ROLES` (used by `AdminPage.jsx`'s
  "Create Login" role `<select>`) is **unchanged** on `release/2026-09-13` —
  still `["admin","staff","student","faculty","professional"]` — and even
  gained a comment in this same branch (`3b693ad`) explicitly acknowledging
  "student/faculty/professional now have real screens... so they're
  assignable like any other role." **The two commits directly contradict
  each other, and the `2fe2971` reconciliation merge did not catch it.**
- **Concrete failure scenario:** an Owner uses the still-unrestricted
  "Create Login" dropdown to create a `student` or `faculty` login (a real,
  supported workflow post-Academy-Suite-v2). The Edge Function receives
  `role: "student"`, `ASSIGNABLE.includes("student")` is `false`, and
  `const role = ASSIGNABLE.includes(body.role) ? body.role : "staff"`
  silently creates the account as `staff` instead — a role with materially
  different area-access defaults (`DEFAULT_ROLE_AREAS` in `access.js`). The
  UI shows no error; the Owner has no way to know the requested role wasn't
  honored short of checking the roster afterward.
- **Recommendation:** before merging, restore `student`/`faculty`/
  `professional` to the Edge Function's `ASSIGNABLE` list (or, if the intent
  really is "logins created this way should only ever be admin/staff",
  remove those three options from `AdminPage.jsx`'s dropdown instead — but
  that would be a product-scope decision requiring a human, not something to
  infer from either branch's own comments, since the two comments disagree).

No other regression was found: `expenses_approved_*` (M-1) is byte-identical
between `main` and `release/2026-09-13` — the fix branch didn't touch it —
so the "confidential but broadly readable" state M-1 describes is
unchanged (correctly left as a product decision, not silently altered).

---

## 6. Confirmed still unfixed on both branches

Independently re-verified against the actual policy text (not taking either
the task's or `02-security-audit.md`'s word for it):

- **C-1 / "CRIT-1" — broad insert/update access on `students`, `collections`,
  `expenses`, `batches`, `expense_categories`.** `git diff main..release/2026-09-13
  -- supabase/schema.sql` shows **no changes whatsoever** to
  `students_approved_insert`/`_update` (main:113/116), `collections_approved_insert`
  (main:148), `expenses_approved_insert`/`_update` (main:201/204),
  `batches_approved_insert`/`_update` (main:346/348), or
  `expense_categories_approved_*` (main:365-370) — same policy names, same
  `with check (public.is_approved_user())` predicate, on both `main` and
  `release/2026-09-13`. `origin/fix/engineering-review-2026-09`'s tip
  (`24909ec`) is an ancestor of the same tree state, so it's unfixed there
  too, by definition. **Confirmed unfixed on both branches.**
- **H-2 — assignment self-grading column gap.** `sub_student_update` in
  `migration-academy-suite-v2.sql` (line 261 on both `main` and
  `release/2026-09-13` — byte-identical, confirmed via `git diff`) still
  reads `using (student_id = auth.uid() and status = 'submitted') with check
  (same)` — no column-level restriction on `marks`/`feedback`. **Confirmed
  unfixed on both branches.**

These two match the original security audit's own conclusion (§3 of
`docs/audits/02-security-audit.md`) exactly — this reconciliation does not
supersede it, only corroborates it independently.

---

## 7. Proposed integration order (plan only — nothing executed)

Given `origin/fix/engineering-review-2026-09` is a strict subset of
`release/2026-09-13`, and `release/2026-09-13`'s only "extra" commits net out
to either a self-fix (`58d49a9`) or a no-op revert pair (`769810a`/`580c3ec`),
the practical integration unit is **`release/2026-09-13` as a whole**, not
its commits piecemeal — cherry-picking around `769810a` would require
re-deriving the revert anyway.

1. **Fix the `ASSIGNABLE_ROLES` regression first (§5)**, on top of
   `release/2026-09-13` (or as a pre-merge patch), before this branch goes
   anywhere near `main` — this is a functional bug affecting a real
   Academy-Suite workflow, not a hypothetical.
2. **Decide on the two unrelated-CI commits** (`d861eb9` nightly backup,
   `24909ec` Edge Function auto-deploy) — either accept them as part of the
   same merge (they don't conflict with anything) or split them into a
   separate PR reviewed on their own operational/secrets-handling merits.
   Not a blocker for the security fixes themselves.
3. **Merge `release/2026-09-13` (with the §5 fix applied) into `main`.**
   Verified conflict-free against `main`'s current tip (zero file overlap
   with `main`'s own two unique commits). This brings in C-2, C-3, H-1, H-3
   fully verified, plus the audit-log trigger, dead-`income`-table removal,
   forced-password-change flow, and migration renumbering (see caveat
   below), and the Net-P&L/credit-balance UX changes (§4 item 1) as a
   bundled but unrelated-to-security passenger — call this out in the PR
   description so a reviewer isn't surprised by non-security diffs.
   - **Caveat on migration renumbering:** `f1de945` only renumbered the 5
     pre-existing standalone `migration-*.sql` files to `01`–`05`. The three
     Academy Suite migrations (`migration-academy-suite.sql`, `-v2.sql`,
     `-v2b.sql`, merged into `main` separately and un-touched by either
     security branch) keep their original, alphabetically-ambiguous names.
     The "run in numeric/filename order" guidance this fix set out to
     clarify is therefore only partially satisfied post-merge — worth a
     follow-up to extend the numbering scheme to all migrations, not a
     blocker.
4. **On top of that merged state, add new fixes for C-1/"CRIT-1" and H-2**
   — neither branch addresses these, so they need original work, not
   integration:
   - C-1: change `students_approved_insert/_update`,
     `collections_approved_insert`, `expenses_approved_insert/_update`,
     `batches_approved_insert/_update`, and `expense_categories_approved_*`
     from `is_approved_user()` to a role/ownership-aware predicate (e.g.
     `is_admin()` or `is_admin() or created_by = auth.uid()` depending on
     product intent for who may legitimately record a payment/expense) —
     this needs a human decision on intended access model per table, not a
     mechanical tightening, since `src/lib/fees.js`'s trust model depends on
     knowing who's allowed to write these rows.
   - H-2: add a column-restricting mechanism for `assignment_submissions`
     (RLS can't do column-level checks — needs either a trigger that
     rejects `marks`/`feedback` changes when the row wasn't already
     transitioning via the grader path, or a `security definer` grading
     function mirroring the exam engine's `score_exam_attempt()` pattern,
     which this same schema already demonstrates works).

No commit, merge, or file change was made to implement any of the above —
this section is a plan for a human (or a future, explicitly-scoped task) to
execute.
