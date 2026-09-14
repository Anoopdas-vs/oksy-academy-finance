# Step 8 — Rename Migration Plan (finance → pulse)

Date: 2026-09-14
Scope: **planning only**. Nothing in the repository, GitHub, Vercel, or
Supabase was changed while producing this document. Read-only grep/inspection
of the repo tree at commit `3b1c421` (branch `docs/add-claude-project-context`,
the most complete branch available locally — includes all six top-level
project docs plus the CRIT-1 security fixes; it does not yet include the two
still-open PRs, #9 testing foundation and #11 xlsx lockfile fix, but neither
touches naming surfaces so this doesn't affect the plan below).

## 0. Decision already made (context, not proposed here)

Per prior chat history: the product's new identity is **"pulse"**, not
"portal" — `portal.oksyacademy.in` was an earlier placeholder name used
before "pulse" was chosen. The domain cutover to `pulse.oksyacademy.in` is
**already complete** (Vercel domain added, Hostinger DNS CNAME verified,
Supabase Auth URL Configuration updated, login/signup/logout tested working).
The old `finance.oksyacademy.in` is still live in parallel, deliberately kept
a few more days before removal (Step 6 item, separately tracked).

**This means several places in the repo are currently referencing the wrong
old name — not "finance" (already mostly cleaned), but the intermediate
"portal" placeholder that was superseded by "pulse" before it was ever
committed here.** That is the single most important finding of this audit.

## Summary table

| # | Surface | Current value | Target | Blast radius | Risk | Notes |
|---|---|---|---|---|---|---|
| 1 | GitHub repo name | `oksy-academy-finance` | `oksy-academy-pulse` | Git remote URL, CI badge links, any bookmarked links, Vercel Git integration linkage | MEDIUM | GitHub auto-redirects the old URL after rename, and Vercel's Git integration follows the rename automatically — but every local clone's `origin` remote (yours, and this session's) needs `git remote set-url` afterward |
| 2 | Local project folder name | `oksy-academy-finance` | `oksy-academy-pulse` (already decided) | Nothing technical — pure local convenience; IDE workspace settings, shell aliases, any local scripts hardcoding the path | LOW | Simple folder rename, no Git impact |
| 3 | `package.json` → `"name"` | `oksy-academy-portal` | `oksy-academy-pulse` | None functional (private package, not published) | LOW | Currently already wrong (says "portal", a name that was superseded before "pulse" was chosen) — needs fixing regardless of when the broader rename happens |
| 4 | `package-lock.json` → `"name"` (2 occurrences) | `oksy-academy-finance` | `oksy-academy-pulse` | None functional | LOW | Out of sync with `package.json` itself (which already says "portal") — three different names exist right now across two adjacent files: finance/portal/nothing-yet-pulse. Regenerated automatically by `npm install` once `package.json` is fixed |
| 5 | `index.html` → `<title>` | `Oksy Academy Portal` | `Oksy Academy Pulse` (or final brand name — confirm before executing) | Browser tab title, bookmarks | LOW | Same "portal" drift as #3 |
| 6 | Domain references in docs (`SETUP.md`, `PROJECT_OVERVIEW.md`, `README.md`, `AGENTS.md`, `docs/claude-project/CLAUDE_PROJECT_CONTEXT.md`) | All say `finance.oksyacademy.in` "moving to/transitioning to `portal.oksyacademy.in`" | `pulse.oksyacademy.in` (cutover already done) | Documentation only — no functional impact | LOW | These are now factually wrong twice over: the domain is not "moving to portal", it already moved to pulse. Straightforward text fix, no migration needed since the actual cutover already happened outside the repo |
| 7 | `supabase/schema.sql` header comment | `-- Oksy Academy Finance — Supabase schema, roles & permissions` | `-- Oksy Academy — Supabase schema, roles & permissions` (or "Pulse") | Comment only, zero functional effect | LOW | Cosmetic |
| 8 | In-app "finance" identifiers (`StaffAccess.jsx` `isFinanceRelevant`, `fees.js` "finance helpers", `academy.js` "finance side" comment, `PeriodFilter.jsx` "finance views") | n/a | **Do not rename** | n/a | N/A | These refer to the Finance *module* inside the broader Academy platform (fee collection, expenses, financial dashboard) — a legitimate, permanent feature-area name, not a product-identity string. Renaming these would be over-cleaning per Standard §14 |
| 9 | Database table/column names | Table names audited in Step 4 (no `finance`-prefixed tables found; domain-specific names like `expenses`, `collections`, `students` already scope-neutral) | No change needed at the naming level found so far | — | — | Full terminology inventory already exists from Step 4's audit (§10, earmarked for Step 11) — catalog only, actual migration is Step 11's job, not this step's |
| 10 | CI/CD workflows (`.github/workflows/*.yml`) | No "finance" or domain references found | No change needed | — | — | Clean |
| 11 | Environment variables (`.env.example`, `VITE_*`) | No "finance" or domain references found | No change needed | — | — | Clean |
| 12 | Vercel project name/settings | Not stored in repo — needs checking directly in the Vercel dashboard | `oksy-academy-pulse` (if it still says finance/portal) | Deploy URLs, project dashboard | LOW–MEDIUM | Outside this repo's visibility; flagging as an external item to check, not something this audit can verify by reading code |

## What is genuinely clean already

- No hardcoded `finance.oksyacademy.in` (or any domain) in authentication, CORS, or app code — confirmed in the prior domain-rename readiness check: auth uses `window.location.origin` dynamically, so the domain cutover required zero code changes.
- No "finance" branding left in the UI itself (sidebar, header, page titles) — the in-app uses of "finance" are all scoped to the Finance *module*, which is correct and should stay.
- No CI/CD, env var, or database naming currently blocks the rename.

## Recommended sequence (feeds Steps 9–11)

**Step 9 (low-risk renames — safe to execute together, single PR):**
1. Fix `package.json` `"name"` → `oksy-academy-pulse`
2. Regenerate `package-lock.json` (`npm install`) so its name field follows automatically
3. Fix `index.html` `<title>`
4. Fix the 5 doc files' domain references (finance→pulse, drop "portal" entirely, correct "moving to" language to "migrated to" since cutover is done)
5. Fix `supabase/schema.sql` header comment

None of these touch deployment, auth, or external integrations — pure text/metadata changes, fully reversible with a single revert commit.

**Step 10 (local folder + GitHub repo rename):**
- Rename the local project folder to `oksy-academy-pulse` (do this *after* Step 9 is merged, so the rename PR is opened from a folder still named `oksy-academy-finance` and there's no mid-flight confusion)
- Rename the GitHub repository `oksy-academy-finance` → `oksy-academy-pulse` (GitHub keeps the old URL as a redirect automatically; still requires `git remote set-url origin` locally, and re-verifying Vercel's Git integration continues pointing at the right repo after the rename)

**Step 11 (database terminology — separate, higher-risk, needs its own migration + rollback plan):**
- Use Step 4's terminology inventory as the starting catalog
- Not touched by this plan — deliberately out of scope here per the original 15-step ordering

## What should NOT be renamed (Standard §14 — do not over-clean)

- `isFinanceRelevant`, "finance helpers", "finance views", and similar in-code references to the **Finance module** — these are accurate, permanent feature-area names within a multi-module academy platform, not leftover product-identity naming. Renaming them would blur a real distinction (Finance module vs. Students module vs. Academics module) for no benefit.
- Any historical Git commit messages, branch names, or closed-PR titles that mention "finance" — Git history should not be rewritten (Standard §5: "Do not rewrite Git history... without explicitly explaining the consequences and obtaining approval first" — not warranted here, this is routine historical record, not a secret or defect).
- `docs/audits/01-repo-audit.md` and `02-security-audit.md`, and any other audit report already committed — these are point-in-time historical records of what the repo looked like when audited; editing them to retroactively say "pulse" would misrepresent what was actually audited at the time. Leave as-is.

## Open item for you to confirm before Step 9 executes

Section 5 above (index.html title / doc "brand name") assumes the final
product-facing name is **"Pulse"** / **"Oksy Academy Pulse"**, matching the
domain `pulse.oksyacademy.in`. If a different display name was intended
(e.g. still "Oksy Academy" with "Pulse" only as the technical
domain/repo/package identifier, not the UI-visible brand), say so before
Step 9's doc/title edits go out — it changes the exact replacement text in
6 files.
