# Step 7 — Dependency & Tooling Audit

Date: 2026-09-14
Scope: **read-only audit only**. Nothing in the repository was modified.
`npm ls`, `npm test`, `npm run lint`, and `npm run build` were run to observe
real behavior; the resulting `dist/` build artifact was left in place (it is
gitignored) and no `node_modules` state was changed.

Note: this report was produced during the Step 7 Claude Code session on
2026-09-14 but was never committed at the time (it only existed in that
session's local worktree). Committed here on 2026-09-14 as part of closing
that loose end before Step 8. The critical finding below (xlsx lockfile
drift, CVE-2023-30533) was already fixed and merged separately as PR #11.

## 0. Note on source docs

The task pointed at `docs/claude-project/` for the six project-rule docs.
On the audit branch, `docs/claude-project/` only contained `audits/` (this
file's siblings) — the six top-level rule docs were not present on that
branch at the time. They have since been prepared for commit via PR #10.

---

## Summary

The dependency/tooling surface here is small and mostly clean — five
production deps, five dev deps, one lockfile, one lint tool, no test
framework beyond Node's built-in runner, two CI workflows, one shell script.
Verified `npm test` (44 pass / 1 skipped), `npm run lint` (0 errors, 7
pre-existing React warnings unrelated to dependencies), and `npm run build`
(succeeds, produces the expected vendor chunks) all work as documented.

**One finding needed attention sooner than "later cleanup step" framing
would suggest**, even though this step is read-only: the lockfile had drifted
from `package.json` for `xlsx` and the app was actually building against the
CVE-vulnerable version the project already tried to fix (see §3). This has
since been fixed and merged as PR #11. Everything else below is genuinely
low-stakes: nothing orphaned, no conflicting lockfiles, no duplicate lint/
format configs, no unused env vars, no leftover analytics/error-tracking
stubs.

| # | Area | Verdict |
|---|---|---|
| 1 | Production dependencies | KEEP all 5 — all imported and used |
| 2 | devDependencies | KEEP all 5 — all wired into the actual pipeline |
| 3 | Lockfile health | ~~INVESTIGATE (urgent)~~ FIXED — `xlsx` entry was stale/vulnerable, resolved via PR #11 |
| 4 | package.json scripts | KEEP all 5 — each used, documented, and verified working |
| 5 | Build tooling (Vite) | KEEP — plugin and manual chunking both load-bearing |
| 6 | Testing tooling | KEEP — intentionally minimal, matches native-runner approach |
| 7 | Lint/format tooling | KEEP oxlint/config; INVESTIGATE 6 leftover `eslint-disable` comments |
| 8 | External service integrations | KEEP Supabase/xlsx/recharts — all wired; nothing else present to flag |
| 9 | CI/CD tooling | KEEP both workflows — reference tools/paths that exist |
| 10 | AI/Claude-related config | KEEP `AGENTS.md` (intentional, linked from README); `.claude/` is untracked, ignored |
| 11 | scripts/ directory | KEEP `backup-db.sh` — referenced by CI, functional |
| 12 | Env variables | KEEP as-is — `.env.example`, code, and docs all agree exactly |

---

## 1. Production dependencies (`package.json` → `dependencies`)

| Package | Declared | Installed | Used in | Verdict |
|---|---|---|---|---|
| `react` | `^19.2.8` | 19.2.8 | 29 files (every component/page) | **KEEP** |
| `react-dom` | `^19.2.8` | 19.2.8 | `src/main.jsx` (`createRoot`), `src/pages/BankingPage.jsx` (`createPortal`) | **KEEP** |
| `recharts` | `^3.10.1` | 3.10.1 | `src/pages/Dashboard.jsx` only | **KEEP** — single call site is expected (it's the dashboard's chart library); `vite.config.js` already isolates it into `vendor-charts` |
| `xlsx` | CDN tarball `xlsx-0.20.3` (SheetJS, not npm registry) | 0.20.3 as of PR #11 (was 0.18.5 at audit time — see §3) | 9 files: `App.jsx`, `bankStatement.js`, `reports.js`, `templates.js`, `EnrollmentPage.jsx`, `ExpensesPage.jsx`, `FeeCollectionPage.jsx`, `AssignmentsPage.jsx`, `ReportsPage.jsx`, `BankingPage.jsx` | **KEEP** — heavily used for Excel import/export across the app |
| `@supabase/supabase-js` | `^2.45.4` | 2.115.0 | `src/lib/supabaseClient.js`, `src/lib/academy.rls.test.js` | **KEEP** |

No orphaned production dependencies. Every package is imported somewhere real, not just referenced in config or left over from a removed feature.

---

## 2. devDependencies

| Package | Declared | Installed | Where it's actually used | Verdict |
|---|---|---|---|---|
| `@types/react` | `^19.2.18` | 19.2.18 | No `tsconfig.json`/`jsconfig.json` exists — the project is plain JS/JSX by design. Picked up implicitly by editor TS language servers for autocomplete on `.jsx` files even with no explicit config. | **KEEP** — zero build/runtime cost, real editor-DX value |
| `@types/react-dom` | `^19.2.4` | 19.2.7 | Same as above | **KEEP** |
| `@vitejs/plugin-react` | `^6.1.0` | 6.1.1 | `vite.config.js` (`plugins: [react()]`) | **KEEP** — required for JSX/Fast Refresh |
| `oxlint` | `^1.79.0` | 1.81.0 | `npm run lint` script; config at `.oxlintrc.json` | **KEEP** — verified working (0 errors) |
| `vite` | `^8.2.2` | 8.2.2 | `dev`, `build`, `preview` scripts | **KEEP** — verified working (build succeeds, correct chunking) |

No orphaned devDependencies, no leftover tooling from earlier experimentation.

---

## 3. Lockfile health — fixed via PR #11

**Single lockfile in use**: only `package-lock.json` (npm, `lockfileVersion: 3`) is tracked. No `yarn.lock` or `pnpm-lock.yaml` anywhere. **KEEP.**

**At audit time, the lockfile was stale for `xlsx` — a real security regression, not just hygiene:**

`package.json` correctly declared the SheetJS CDN tarball `xlsx-0.20.3` (the CVE-2023-30533 patched build), but `package-lock.json` still resolved `xlsx` to the vulnerable `0.18.5` from the npm registry, and `node_modules/xlsx` on disk confirmed 0.18.5 was what was actually installed and built into the production bundle. `npm ls` reported this explicitly as an invalid resolution.

**Net effect at the time: the CVE fix that had already been committed to `package.json` never actually took effect**, because `npm install` was never re-run to regenerate the lockfile afterward. This was fixed by PR #11 (`rm node_modules package-lock.json && npm install`), verified via `npm ls`, `npm run build`, and `npm test`, and merged into main on 2026-09-14.

---

## 4. `package.json` scripts

| Script | Command | Verified | Verdict |
|---|---|---|---|
| `dev` | `vite` | Referenced by `.claude/launch.json`, README, SETUP.md | **KEEP** |
| `build` | `vite build` | Ran successfully — 674 modules, correct vendor chunking, no errors | **KEEP** |
| `lint` | `oxlint` | Ran successfully — 0 errors, 7 pre-existing warnings (React effect/purity, unrelated to dependencies) | **KEEP** |
| `test` | `node --test 'src/lib/*.test.js'` | Ran successfully — 44 passed, 1 skipped, 0 failed, across 4 test files | **KEEP** |
| `preview` | `vite preview` | Documented in README as the local prod-preview step | **KEEP** |

All five scripts are current, documented, and show no signs of leftover experimentation.

---

## 5. Build tooling (Vite)

`vite.config.js` is minimal and everything in it is load-bearing:
- `@vitejs/plugin-react` — required for JSX transform + Fast Refresh.
- `manualChunks` splits `xlsx`, `recharts`+`d3`, `@supabase`, and `react`/`react-dom` into separate vendor chunks — verified against the actual `npm run build` output.

**Verdict: KEEP as-is.**

One unrelated build-time observation (noted for awareness only, not a dependency/tooling item): the build logs an `INEFFECTIVE_DYNAMIC_IMPORT` warning because `src/lib/academy.js` is dynamically imported by `Dashboard.jsx` but also statically imported by several other files, so the dynamic import doesn't actually achieve code-splitting there. This is a source-code organization question for a future code-cleanliness pass, not this one.

---

## 6. Testing tooling

The project uses **Node's built-in test runner** — zero additional test dependencies (no Vitest, Jest, Mocha, Chai, or Testing Library). This is a deliberate minimal choice consistent with "use the minimum appropriate tooling for a professional system" (Professionalization Standard §7).

Test files present and all passing at audit time:
- `src/lib/fees.test.js`
- `src/lib/reconcile.test.js`
- `src/lib/academy.rls.test.js`
- `src/lib/academy.h2guard.test.js`

(Since the audit, PR #9 has added `src/lib/access.test.js` and `src/lib/validation.test.js`, bringing the suite to 80 tests.)

**Verdict: KEEP.** No coverage tooling exists (no `c8`/`nyc`) — worth considering in a future testing-strategy step, but an addition question, not a cleanup one.

---

## 7. Lint/format tooling

- **oxlint** is the only lint tool: `.oxlintrc.json` enables the `react` and `oxc` plugins with two explicit rule overrides. No ESLint config, no Prettier config, no `.editorconfig` exist anywhere — no duplicate or conflicting lint/format tooling. **KEEP.**

- **Minor finding (INVESTIGATE, low priority):** 6 `// eslint-disable-next-line` comments remain in source (`no-console` in `ErrorBoundary.jsx` and `supabaseClient.js`; `react-hooks/exhaustive-deps` ×3 in `App.jsx` and ×1 in `usePagedList.js`). These are ESLint-rule-name comments from before the project switched to oxlint — worth a human look to confirm whether they're inert or silently suppressing a real oxlint warning, and either delete or replace with oxlint's actual disable syntax. Cosmetic/low-risk, not urgent (priority 11 of 12 per the standard).

---

## 8. External service integrations

- **Supabase** — fully wired: `src/lib/supabaseClient.js` reads `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; a Deno Edge Function (`supabase/functions/create-user`) handles the one privileged server-side operation. **KEEP.**
- **xlsx (SheetJS)** — wired for Excel import/export across 9 files. **KEEP.**
- **recharts** — wired for the dashboard's charts. **KEEP.**
- **Analytics / error tracking / email SDKs** — none found (searched for Sentry, PostHog, Mixpanel, Segment, Amplitude, Resend, SendGrid, Nodemailer, LogRocket, Datadog, Bugsnag, Honeybadger, Rollbar). Nothing to flag as a leftover stub.

---

## 9. CI/CD tooling

Two GitHub Actions workflows, both reference tools/paths that currently exist:

- **`deploy-edge-functions.yml`** — deploys `supabase/functions/create-user` on push to `main` when that path changes, or manually via `workflow_dispatch`. **KEEP.** (Note: its first real run, triggered by the PR #6 merge, failed because the two required repo secrets — `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` — were never added under Settings → Secrets and variables → Actions, per the workflow file's own setup comment. This is a one-time setup gap, tracked separately, not a tooling defect.)
- **`nightly-backup.yml`** — runs `scripts/backup-db.sh` on a nightly cron. **KEEP.**

**Observation (a gap, not excess):** there is no CI workflow that runs `npm run lint`, `npm test`, or `npm run build` on pull requests — currently done by hand. Worth a follow-up step if you want it enforced automatically. No dependabot/renovate config exists either.

---

## 10. AI/Claude-related config in the repo

- **`.claude/launch.json`** — git-ignored, confirmed not tracked. Never ships in the repo. No action needed.
- **`AGENTS.md`** — explicitly linked from `README.md`, content matches the current codebase exactly. **KEEP.** Minor cosmetic note: header names one specific historical tool rather than being tool-agnostic — low priority, fine to revisit during a documentation-consistency pass.
- **`docs/claude-project/`** — the audit-planning docs here are exactly the "intentional planning docs" category that should stay. **KEEP.**

No stray prompt files, no `CLAUDE.md` anywhere in the repo, no other AI-session scratch artifacts found.

---

## 11. `scripts/` directory

Only one script: **`scripts/backup-db.sh`** — referenced and actually invoked by `nightly-backup.yml`, internally consistent, documented in its own header, `PROJECT_OVERVIEW.md`, and `README.md`.

**Verdict: KEEP.** No other scripts exist.

---

## 12. Environment variables

Cross-checked `.env.example`, every `import.meta.env.VITE_*` read, and every `Deno.env.get(...)` read against `README.md`, `SETUP.md`, and `PROJECT_OVERVIEW.md` — every variable declared, read, and documented consistently, with the one genuinely sensitive value (`SERVICE_ROLE_KEY`) correctly kept server-side only, out of both `.env.example` and the client bundle.

**No unused or undocumented environment variables in either direction.**

---

## What needs a decision (status as of commit)

1. ~~Fix the `xlsx` lockfile drift (§3)~~ — **done**, merged as PR #11.
2. Add the two missing GitHub Actions secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`) so `deploy-edge-functions.yml` can actually deploy — **still open**, requires a human with Supabase dashboard access; tracked as a Step 3 follow-up.
3. Everything else in this report is **KEEP** or a low-priority **INVESTIGATE** (the 6 stale `eslint-disable` comments, the missing CI quality-gate) — none of it is urgent per the standard's "Do Not Over-Clean" (§14) and "Never Sacrifice Functionality for Appearance" (§16) principles.

No dependency, script, config file, or tool in this repository was found to be a genuine orphan.
