# Repository Audit — oksy-academy-finance

Date: 2026-09-14
Scope: read-only audit. Nothing in the repository was modified. `npm run lint`,
`npm test`, and `npm run build` were executed to observe their output only;
the resulting `dist/` build artifact was deleted afterward and was gitignored
in any case.

## 0. Note on task instructions

The task asked me to first read every file in `docs/claude-project/`,
especially `PROJECT_OVERVIEW.md` (sic — actually named `PROJECT_OVERVIEW.md`
at repo root) and `CLAUDE_PROJECT_CONTEXT.md`. **`docs/claude-project/` does
not exist anywhere in this repository** — not on the current branch, not on
`main`, and not on any other local or remote branch (checked via
`git log --all -- docs/claude-project/` and a full branch scan). There is no
`docs/` directory at all prior to this audit creating one. `CLAUDE_PROJECT_CONTEXT.md`
does not exist under any name in the repo.

What the repo actually has at the root, which appears to be the intended
equivalent, is:
- [`PROJECT_OVERVIEW.md`](../../PROJECT_OVERVIEW.md) — architecture, data model, features, known gaps
- [`AGENTS.md`](../../AGENTS.md) — AI-agent working rules ("Antigravity Project Instructions")
- [`README.md`](../../README.md) — quick start
- [`SETUP.md`](../../SETUP.md) — full first-time setup/deploy walkthrough

I read all four before doing anything else and used them as the audit's
starting frame of reference. **Flagging this path mismatch rather than
guessing** — if a `docs/claude-project/` convention is expected going forward
(e.g. for a multi-doc series this audit is meant to join), it needs to be
created; it isn't a pre-existing part of this repo.

---

## 1. Overview

**Oksy Academy Portal** — an all-in-one LMS + ERP + finance web app for a
single organization (Oksy Academy LLP). Single-page React app, no backend
server of its own; all persistence and auth go through Supabase (Postgres +
Row-Level Security + Auth). Deployed on Vercel, auto-deploying from `main`.
Live at `finance.oksyacademy.in` (mid-transition to `portal.oksyacademy.in`).

- **Frontend**: React 19 + Vite 8, plain JS/JSX (no TypeScript), no router
  (tab state lives in `src/App.jsx`), one hand-written global stylesheet.
- **Backend**: Supabase only — Postgres with RLS, Supabase Auth
  (email/password + Google OAuth), one Deno Edge Function for admin-privileged
  user creation.
- **Domain**: two halves bolted into one app — an "Academy Suite" (timetable,
  live classes, assignments, exams, faculty reviews) and a finance/ERP suite
  (enrollment, fee collection, expenses, bank transfers/reconciliation,
  reports, admin/roles).
- **Repo size**: small-to-medium. ~11,600 lines across `src/`, one 1,491-line
  root component (`App.jsx`) and one 2,742-line stylesheet (`App.css`)
  dominate; everything else is under ~750 lines per file.
- **CI**: none. Lint/test/build are run by hand (or by AI agents) before
  push, per the project's own documentation.

---

## 2. File / folder inventory

```
.
├── .claude/launch.json          dev-server launch config (npm run dev, port 5173)
├── .env.example                 two VITE_SUPABASE_* placeholders
├── .gitignore
├── .nvmrc                       "20.19"
├── .oxlintrc.json                oxlint config (react + oxc plugins)
├── AGENTS.md                    AI-agent instructions ("Antigravity")
├── PROJECT_OVERVIEW.md          architecture / data model / features / known gaps
├── README.md                    quick start
├── SETUP.md                     full setup + deploy walkthrough
├── index.html                   Vite entry HTML
├── package.json / package-lock.json
├── vite.config.js               manual chunk splitting (xlsx/recharts/supabase/react)
├── public/
│   ├── favicon.svg
│   └── oksy-logo.jpeg
├── src/
│   ├── App.jsx (1,491 loc)      root: state, data handlers, totals math, nav, render
│   ├── App.css (2,742 loc)      the entire stylesheet
│   ├── main.jsx                 ReactDOM entry
│   ├── components/              Login, ui (MetricCard/Input/Modal/…), SearchPager,
│   │                            PeriodFilter, ImportPreviewModal, Receipt,
│   │                            StudentPicker, StaffAccess, NotificationBell,
│   │                            ErrorBoundary
│   ├── context/                 AuthContext.jsx (provider), authContext.js (context
│   │                            object, split out for fast-refresh), useAuth.js (hook)
│   ├── lib/                     supabaseClient, data.js (finance DB layer, ~330 loc),
│   │                            academy.js (Academy Suite DB layer, 417 loc), access.js
│   │                            (roles/permissions), fees.js (+ fees.test.js), period.js,
│   │                            reconcile.js (+ reconcile.test.js), bankStatement.js,
│   │                            reports.js, templates.js, format.js, validation.js,
│   │                            usePagedList.js
│   └── pages/                   Dashboard, TimetablePage, LiveClassPage,
│                                 AssignmentsPage, ExamsPage, ReviewsPage,
│                                 EnrollmentPage, FeeCollectionPage, ExpensesPage,
│                                 BankingPage, ReportsPage, AdminPage
└── supabase/
    ├── schema.sql (531 loc)     full DDL for a fresh project, incl. Academy Suite
    ├── migration-*.sql (×8)     hand-run incremental patches, no migration runner,
    │                            no supabase/config.toml or CLI migrations folder
    └── functions/create-user/index.ts (99 loc)  Deno Edge Function, admin-only
```

No dead top-level directories, no `dist/`, `.vercel/`, or stray build output
committed. `node_modules` and `.claude/` are both gitignored and present only
locally (see §6 for a note on `.claude/`).

---

## 3. Dependencies (with purpose)

### Runtime (`dependencies`)

| Package | Version | Purpose |
|---|---|---|
| `react` / `react-dom` | ^19.2.8 | UI framework |
| `@supabase/supabase-js` | ^2.45.4 | Postgres/Auth/Storage client — the only backend SDK |
| `recharts` | ^3.10.1 | Dashboard charts (bar/donut) — one of two "heavy" deps called out in project docs |
| `xlsx` (SheetJS) | ^0.18.5 | Excel import/export (bank statements, templates, report downloads) — the other heavy dep; deliberately loaded via dynamic `import()` only (never statically), per `AGENTS.md` and `PROJECT_OVERVIEW.md` |

### Dev (`devDependencies`)

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^8.2.2 | Build tool / dev server |
| `@vitejs/plugin-react` | ^6.1.0 | React fast-refresh + JSX transform for Vite |
| `oxlint` | ^1.79.0 | Linter (`npm run lint`) |
| `@types/react`, `@types/react-dom` | ^19.2.x | Editor type hints only — project has no TypeScript compilation step |

No test framework dependency — `npm test` uses Node's built-in `node --test`
runner directly against `src/lib/*.test.js`, so there's zero test-runner
dependency footprint. No router, no state-management library, no CSS
framework/preprocessor, no ORM — consistent with what the docs describe.

`engines.node >= 20.19` is enforced in `package.json` and mirrored in
`.nvmrc` (`20.19`). The sandbox this audit ran in has Node v26 installed,
which still satisfies the `>=20.19` constraint; lint, test, and build all
completed successfully under it.

**Naming inconsistency (flag only):** `package.json`'s `"name"` field is
`oksy-academy-portal`, but `package-lock.json`'s top-level `"name"` (and the
one embedded in `node_modules/.package-lock.json`) is still
`oksy-academy-finance` — matching the actual GitHub repo name
(`Anoopdas-vs/oksy-academy-finance`) and this working directory. This is
consistent with the git history: commit `86cca8c` "rebrand to Academy
Portal" changed `package.json`'s name but the lockfile was never regenerated
to match. Cosmetic — `npm` doesn't care — but worth reconciling if anyone
notices it, since it's the kind of small drift that erodes confidence when
skimming for bigger problems.

---

## 4. Documentation inventory

| File | Role | My read |
|---|---|---|
| [`README.md`](../../README.md) | Quick start: run locally, DB setup pointer, deploy pointer, layout summary | Accurate against the actual file tree; up to date |
| [`PROJECT_OVERVIEW.md`](../../PROJECT_OVERVIEW.md) | The real onboarding doc — tech stack table, full directory map, data model table, backend surface, feature list, deployment, and an explicit "Known gaps / attention list" | Unusually thorough and honest for a project this size — it names its own tech debt (dead `income` table, Net P&L double-count bug, untested pages, `App.jsx`/`App.css` size). Cross-checked several claims below; all held up. |
| [`AGENTS.md`](../../AGENTS.md) | Written for "Antigravity" (an AI coding agent), not this tool — module map + 5 hard rules (no sync `xlsx`/`recharts` imports, lint must be 0/0, run lint+build before declaring done, SQL-first for DB changes, push to `origin main` over SSH for deploys) | Still applicable to any agent working here, not just Antigravity specifically. See §5 — one of its claims ("lint must pass with 0 errors and 0 warnings") doesn't currently hold. |
| [`SETUP.md`](../../SETUP.md) | Step-by-step first-time setup: Supabase project creation, schema load, first super-admin bootstrap SQL, Edge Function deploy, Vercel deploy, free-tier limits, day-to-day admin | Detailed and concrete (includes exact SQL to bootstrap the first owner). No inaccuracies spotted. |
| `.env.example` | Two-line template for the two required `VITE_SUPABASE_*` vars | Matches what `src/lib/supabaseClient.js` actually reads |

No `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`, or `SECURITY.md`. No
`docs/` directory existed before this audit created
`docs/audits/01-repo-audit.md`. No inline code comments of significant
volume — the four root markdown files are effectively the entire
documentation surface, and they're consistent with each other and with the
code as it stands on this branch.

---

## 5. Anything unclear, suspicious, or worth flagging

None of the below were changed — flagging only, per the task.

1. **`docs/claude-project/` doesn't exist.** Covered in §0. The audit
   proceeded using the root-level docs instead.

2. **A branch with unmerged security/correctness fixes exists locally and is
   not on `origin`.** The primary worktree (`/Users/anoopdasvs/oksy-academy-finance`,
   separate from this audit worktree) has `release/2026-09-13` checked out,
   which sits **9 commits ahead of `main`**, including:
   - `f1de945` "Fix database security issues and harden RLS (C2, C3, C4, H1, H4, H5, M6)"
   - `3b693ad` "Fix Net P&L double-count, add resilience and credit-balance UX (C1, H2, M1, M5, M9, M6 frontend)"
   - `8595774` "Upgrade vulnerable xlsx dependency, add a unit-test suite (C5, M4)"
   - `d861eb9` "Add off-platform nightly DB backup, update docs (H3)"
   - `24909ec` "Remove permanent 'needs Edge Function deployed' note, auto-deploy it instead"
   - plus 4 more, ending at `580c3ec` "Revert to subtracting the exact all-time Due to Healthcare figure"

   Six of these commits also exist on `origin/fix/engineering-review-2026-09`
   (pushed), but that branch is *also* not merged into `main`, and it's
   missing the 3 additional commits that only exist locally on
   `release/2026-09-13` (which itself has no remote tracking branch — it has
   never been pushed anywhere). In other words: `main` — the branch Vercel
   auto-deploys from — is currently missing a round of fixes that explicitly
   labels itself as addressing **Critical/High/Medium severity** items
   (the `C`/`H`/`M` prefixes read like a security-review numbering scheme),
   including the exact "Net P&L double-count" and "xlsx dependency" issues
   that `PROJECT_OVERVIEW.md`'s own "Known gaps" section (§8 there) still
   lists as open. This is very likely just this task's own working state
   (mid-review, not yet merged) rather than something abandoned, but it's
   worth surfacing explicitly since production is live and these read like
   fixes someone intended to ship.

3. **AGENTS.md's lint invariant doesn't currently hold.** It states lint
   "must pass with 0 errors and 0 warnings." Running `npm run lint` today
   produces 0 errors but **6 warnings**, all `react/set-state-in-effect` (in
   `TimetablePage.jsx`, `NotificationBell.jsx`, `ReviewsPage.jsx`,
   `ExamsPage.jsx`, `LiveClassPage.jsx`, `AssignmentsPage.jsx`) plus one
   `react/purity` warning in `ExamsPage.jsx` (impure `Date.now()` call during
   render). Not breaking anything today, but it means the stated bar isn't
   actually enforced/met right now — either the rule needs updating or these
   six spots need addressing.

4. **Vite build reports an "ineffective dynamic import."** `npm run build`
   succeeds but warns:
   > `src/lib/academy.js` is dynamically imported by `src/pages/Dashboard.jsx`
   > but also statically imported by `NotificationBell.jsx`, `StaffAccess.jsx`,
   > `AssignmentsPage.jsx`, `Dashboard.jsx`, `ExamsPage.jsx`, … — dynamic
   > import will not move module into another chunk.

   This directly touches the concern `AGENTS.md` calls out under "Zero Heavy
   Sync Imports" (though that rule is written about `xlsx`/`recharts`
   specifically, not `academy.js`) — the dynamic import of `academy.js` in
   `Dashboard.jsx` is currently a no-op for code-splitting purposes because
   five other files import it statically, so it all ends up in the same
   chunk regardless. Not a bug, just dead-weight indirection worth knowing
   about if bundle size work resumes.

5. **`income` table: confirmed dead, matches the docs' own admission.**
   `supabase/schema.sql` defines a full `income` table with RLS policies
   (§5, lines 211–237), and `migration-healthcare-account.sql` even patches
   it. But there is **no reference to it anywhere in `src/`** — no
   `data.js` function reads or writes it. `PROJECT_OVERVIEW.md` already
   flags this itself ("`income` table is dead — remove or repurpose"), and
   this audit independently confirms that assessment by grepping the whole
   `src/` tree.

6. **Migration filename order is not the same as intended run order for the
   Academy Suite pair.** README/PROJECT_OVERVIEW/SETUP all instruct
   "apply the migration-*.sql files in filename order." Plain alphabetical
   sort of `supabase/*.sql` puts `migration-academy-suite-v2.sql` and
   `migration-academy-suite-v2b.sql` **before** `migration-academy-suite.sql`
   (`-` sorts before `.` in ASCII), which looks backwards for a "v2
   supersedes v1" pair. In practice this is likely harmless — the v2
   migration's own header comment says it just needs to run "AFTER
   schema.sql" and is described as additive/idempotent, superseding the six
   unused tables from the older file rather than depending on it having run
   first. Still, "filename order" as a literal instruction is ambiguous here
   and could mislead someone applying migrations for the first time by
   eye. Consider a numeric prefix (`01-`, `02-`, …) if this pattern grows.

7. **No CI, by design (already documented).** `PROJECT_OVERVIEW.md` states
   this outright ("No CI — lint / test / build are run by hand"). Confirmed:
   no `.github/workflows/`, no other CI config file anywhere in the repo.
   Not a discrepancy, just confirming the doc is accurate.

8. **`.claude/` is gitignored and currently contains only `launch.json`.**
   (`{"configurations": [{"name": "dev", "runtimeExecutable": "npm",
   "runtimeArgs": ["run", "dev"], "port": 5173}]}` — a dev-server launcher
   for this tool.) Nothing unusual, just noting it exists locally and isn't
   (and shouldn't be) version-controlled.

9. **One entry in the shared git stash stack**, unrelated to this branch:
   `stash@{0}: On release/2026-09-13: epitaxy: pre-switch from
   release/2026-09-13`. Left untouched per the shared-stash-stack caution
   for this environment — flagging only so it's not mistaken for something
   this audit produced.

10. **No secrets, credentials, or `.env` committed anywhere in the repo**
    (checked `git ls-files` for `.env`/`.pem`/`.key`/credential-like
    filenames, and grepped source for hardcoded API keys / service-role
    keys / passwords). The Edge Function correctly reads its service-role
    key from `Deno.env.get(...)` rather than embedding it. `.env.example`
    only contains placeholder values. This is a clean bill of health on the
    most common "oops, committed a secret" failure mode.

---

## 6. Summary

The codebase is small, coherent, and unusually well-documented for its size
— `PROJECT_OVERVIEW.md` in particular already tracks most of its own known
tech debt accurately (dead `income` table, Net P&L double-count, oversized
`App.jsx`/`App.css`, untested UI layer, no CI). This audit's own findings
mostly corroborate rather than contradict that document. The two things most
worth a human decision, not a docs fix:

- Whether the unmerged `release/2026-09-13` / `fix/engineering-review-2026-09`
  security and correctness fixes (item 2) are current in-progress work or
  something that should be merged to `main` soon, since `main` is what
  auto-deploys to production.
- Whether the `docs/claude-project/` convention referenced in this task's
  instructions is something that should be created going forward, since it
  doesn't exist yet in this repo.

No files were modified, deleted, or added other than this report.
