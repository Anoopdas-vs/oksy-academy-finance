# Testing Foundation — oksy-academy-finance

Date: 2026-09-14
Scope: set up/improve the minimum testing foundation needed to safely make
changes later. Foundation only, not full coverage — a handful of tests for
the highest-risk flows plus a small logging improvement to already-existing
error handling.

## 0. Note on task instructions

The task asked me to first read `docs/claude-project/DEVELOPMENT_AND_TESTING_RULES.md`.
**That file, and the whole `docs/claude-project/` directory as a source of
top-level convention docs, do not exist** — confirmed via `git log --all` and
a full local+remote branch scan; no file at that path was ever added on any
ref. This is the same gap [01-repo-audit.md](01-repo-audit.md) (§0) and
[02-security-audit.md](02-security-audit.md) (§0) already flagged for
sibling filenames (`CLAUDE_PROJECT_CONTEXT.md`, `SECURITY_REQUIREMENTS.md`).
A `docs/claude-project/audits/` directory does exist (created by
[`02b-branch-reconciliation.md`](../claude-project/audits/02b-branch-reconciliation.md)
and [`03b-crit1-h2-fix-plan.md`](../claude-project/audits/03b-crit1-h2-fix-plan.md)),
but no rules document lives there either.

In its absence I used, as the prior audits did:
- [`AGENTS.md`](../../AGENTS.md) — the closest thing to house rules: `npm
  test` / `npm run lint` (0 errors/warnings) / `npm run build` as the
  verification commands, lint-then-build as the "done" bar.
- [`PROJECT_OVERVIEW.md`](../../PROJECT_OVERVIEW.md) — architecture and known
  gaps, to judge what "highest-risk" means for this app.
- [`02-security-audit.md`](02-security-audit.md) and
  [`03b-crit1-h2-fix-plan.md`](../claude-project/audits/03b-crit1-h2-fix-plan.md)
  — the step-2 security findings this task pointed at (C-1 forgeable
  financial records, H-2 assignment self-grading), both since fixed on `main`
  (PRs #7, #8) — to identify which *client-side* logic is the counterpart
  of that server-side (RLS) enforcement and therefore worth unit-testing.

## 1. What already existed (not built by this task)

The repo already had a working foundation, contrary to what "set up a test
runner" might suggest in isolation:

- **Test runner**: `npm test` → `node --test 'src/lib/*.test.js'`. Node's
  built-in runner — zero extra dependencies, already wired into
  `package.json` and `AGENTS.md`'s documented verification commands.
- **Existing test files**:
  - `src/lib/fees.test.js` — fee/waiver/outstanding-balance math
    (`src/lib/fees.js`), the core financial calculation the whole app trusts.
  - `src/lib/reconcile.test.js` — bank-statement auto-matching and
    reconciliation math (`src/lib/reconcile.js`).
  - `src/lib/academy.h2guard.test.js` and `src/lib/academy.rls.test.js` —
    written for the H-2 (assignment self-grading) fix; the RLS one requires a
    live disposable Supabase project (env vars `TEST_SUPABASE_URL` etc.) and
    **skips cleanly** (not fail) when that connection isn't configured, which
    is the current state in this environment.
- **Basic error handling**: `src/components/ErrorBoundary.jsx` (a top-level
  React error boundary wrapping the app — catches render errors, shows a
  recoverable "Something went wrong" screen instead of a blank page, logs via
  `console.error`) and `src/lib/validation.js`'s `friendlyError()` (maps raw
  Postgres/Supabase/RLS error text to plain-language messages), used
  consistently across ~12 try/catch sites in `src/App.jsx` for every
  save/delete/import action.

So "basic error handling/logging" already existed — this task made one small
addition to it rather than building it from scratch (see §3).

## 2. What this task added: tests for the highest-risk flows not yet covered

Two new files, following the existing `describe`/`test` + `node:assert/strict`
style:

### `src/lib/access.test.js` — login/role-gating (`getAccess()` in `access.js`)

`getAccess()` is the client-side counterpart of the RLS boundary the security
audit examined: it turns a profile row into every permission decision the UI
makes (which tabs render, who can edit/delete money records, who can manage
users/access config). It was completely untested before this task, despite
being exactly the kind of logic where a silent regression reopens a
privilege-escalation gap (C-1/H-1 territory) from the client side. Covers:

- Unapproved users get zero areas regardless of role; a missing profile
  behaves the same way.
- Each role tier's actual permissions: `super_admin` (everything),
  `admin` (edit/delete records, not user management), `staff`
  (Executive — opens finance tabs but can't edit/delete), `student` /
  `faculty` / `professional` (never see finance areas by default).
- `financials` and `banking` are two independent gates (`can_view_financials`
  AND the `"Banking"` area must both be granted — confirmed this is
  intentional, not a bug, after an initial wrong test assumption caught it).
- Owner-configured `roleAreas` overrides: narrows correctly, can't smuggle in
  an area outside the fixed `ALL_AREAS` list, never widens `super_admin`
  (moot — it already has everything), and an unapproved user stays locked
  out even if `roleAreas` would otherwise grant their role access.
- Every role in the shipped `DEFAULT_ROLE_AREAS` table matches what
  `getAccess()` actually returns for that role (a canary against the table
  and the function drifting apart).

**Explicitly out of scope / not what this covers:** this only tests what the
*UI* decides to show. RLS is the real enforcement boundary — bypassing the
UI and calling Supabase directly is exactly the C-1 attack path, and that
requires a live database (`academy.rls.test.js`'s approach), not a unit test.

### `src/lib/validation.test.js` — fee/expense entry validation (`validation.js`)

The shared guardrail every fee-collection, expense, and bulk-import form runs
data through before it reaches Supabase, plus the error-message mapping staff
actually see when a write fails (including when RLS blocks it). Also
untested before this task. Covers:

- `isBlank` / `isValidDateStr` / `isPositiveNumber` / `isValidAccount` /
  `isValidStatus` edge cases (whitespace, zero, negative, unparsable dates,
  values outside the fixed account/status lists).
- `validateMoneyRow()` — the actual gate fee/expense rows pass through:
  well-formed row passes clean; missing date, non-positive amount, and
  unrecognized account are each flagged with a readable message; multiple
  problems on one row are all reported, not just the first.
- `friendlyError()` — every mapped case (RLS-denied write → permission
  message, duplicate student ID, generic duplicate key, invalid numeric
  amount, network failure) plus the fallback path and a guarantee it never
  throws or returns a blank/`"[object Object]"` message for a malformed
  input (`undefined`, `null`, `{}`, `""`).

### Result

```
npm test
...
ℹ tests 80
ℹ suites 24
ℹ pass 79
ℹ fail 0
ℹ cancelled 0
ℹ skipped 1   # academy.rls.test.js — needs a live staging Supabase project
ℹ todo 0
```

(45 → 80 tests; the 1 skip is pre-existing and expected in this environment.)

Two assertions in the first draft of these tests were themselves wrong (not
source bugs) and were corrected after the actual test run disagreed with the
assumption:
- `friendlyError`'s amount message says "amounts" (plural), not "amount".
- `staff` role's `DEFAULT_ROLE_AREAS` doesn't include `"Banking"` — granting
  `can_view_financials` alone isn't enough to open it; the Owner must also
  grant the `"Banking"` area. This is real, intentional behavior in
  `access.js`, confirmed by reading the source, not a bug to fix.

## 3. Logging: one small addition to existing error handling

`friendlyError()` (`src/lib/validation.js`) is the single function almost
every catch block in `src/App.jsx` already funnels through before showing an
error to the user — but until now, the *only* place in the whole app that
ever called `console.error` was `ErrorBoundary` (for uncaught render errors).
Every data-layer failure (a failed save, a blocked RLS write, a network
error) was swallowed into a friendly string with **no trace left in the
browser console** to help debug it later.

Added one `console.error("[friendlyError]", err)` call at the top of
`friendlyError()` — logs the original, unmodified error object before
translating it, without changing its return value or call signature. Because
nearly every error path already routes through this one function, this
gives console-level visibility across the app from a single, low-risk change
rather than touching all ~12 call sites individually. No new dependency, no
behavior change for users.

## 4. How to run this

```bash
npm test          # node --test 'src/lib/*.test.js' — runs in under a second, no setup needed
npm run lint       # oxlint — must stay at 0 errors (pre-existing warnings unrelated to this task remain, see 01-repo-audit.md §5.3)
npm run build      # vite build — sanity-checks the whole app still compiles
```

To also run the live-Supabase RLS suite (`academy.rls.test.js`), point it at
a **disposable/staging** Supabase project — never production — per the env
vars documented at the top of that file, then run:

```bash
node --test src/lib/academy.rls.test.js
```

### Adding the next test

New test files just need to match `src/lib/*.test.js` and use
`node:test` + `node:assert/strict` — no config, no extra install. Follow the
existing style: a `describe` block per exported function/behavior, plain
`test()` calls with a full-sentence name describing the specific case (not
just "works"), and prefer asserting on the *user-visible contract* (a
returned value, an error message a staff member will read) over
implementation details.

## 5. What was deliberately left out (foundation, not full coverage)

- **No UI/component tests.** `node --test` has no DOM; the pages/components
  are untested by design here (this matches `PROJECT_OVERVIEW.md`'s own
  "Known gaps" — "untested UI layer"). Adding one would mean introducing a
  DOM environment (jsdom) and a component-testing library — a real
  dependency/tooling decision, not a "foundation" addition, and out of scope
  for this task.
- **No CI.** Already documented as intentional
  (`PROJECT_OVERVIEW.md`, `01-repo-audit.md` §5.7) — lint/test/build are run
  by hand or by an agent before push. Not changed here.
- **`reports.js`, `academy.js`, `bankStatement.js`, `period.js`,
  `templates.js`** remain untested. All are real candidates for the *next*
  increment, but weren't flagged as the highest-risk flows for this pass
  (login/access-gating and fee/expense entry validation were named
  explicitly in the task).
- **App.jsx's ~12 try/catch sites** were not individually touched — the one
  centralized logging addition in §3 covers all of them without the larger
  change of restructuring `App.jsx` itself.
