# Step 13 — Documentation Consolidation Plan

**Date**: 2026-09-14  
**Scope**: Read-only documentation inventory, classification, and consolidation plan across the entire repository. No existing files were modified, moved, merged, or deleted.  
**Target Output**: Plan for user review prior to execution in Step 13.

---

## 1. Documentation Inventory & Classification Table

The repository currently contains **21 documentation files** across the root directory, `Claude outputs/`, `docs/audits/`, and `docs/claude-project/` (including `docs/claude-project/audits/`).

| Doc | Classification | Reason |
|---|---|---|
| `README.md` | **UPDATE** | Update header from "Portal" to "Pulse", point domain strictly to `pulse.oksyacademy.in`, and refresh overview. |
| `AGENTS.md` | **UPDATE** | Update heading and branding from "Portal" to "Pulse", update live URL to `pulse.oksyacademy.in`, update GitHub repo link, and cross-reference `docs/claude-project/` rules. |
| `PROJECT_OVERVIEW.md` | **UPDATE** | Update heading from "Portal" to "Pulse", remove stale domain transition text, and soften PR-specific phrasing to evergreen documentation. |
| `SETUP.md` | **UPDATE** | Update branding to "Pulse", set domain to `pulse.oksyacademy.in`, fix outdated migration references (`migration-*.sql` → `NN_*.sql`), and update Supabase project name guidance. |
| `Claude outputs/07-dependency-tooling-audit.md` | **REMOVE** | Exact 100% bit-for-bit duplicate of `docs/claude-project/audits/07-dependency-tooling-audit.md`; redundant folder at repo root. |
| `Claude outputs/08-rename-migration-plan.md` | **REMOVE** | Exact 100% bit-for-bit duplicate of `docs/claude-project/audits/08-rename-migration-plan.md`; redundant folder at repo root. |
| `docs/audits/01-repo-audit.md` | **MERGE** | Move to `docs/claude-project/audits/01-repo-audit.md` to unify all step audits into a single canonical directory. |
| `docs/audits/02-security-audit.md` | **MERGE** | Move to `docs/claude-project/audits/02-security-audit.md` to unify historical security audit records under `docs/claude-project/audits/`. |
| `docs/audits/04-testing-foundation.md` | **MERGE** | Move to `docs/claude-project/audits/04a-testing-foundation.md` (renaming to avoid prefix collision with schema audit) in `docs/claude-project/audits/`. |
| `docs/claude-project/CLAUDE_PROJECT_CONTEXT.md` | **UPDATE** | Update application name to Oksy Academy Pulse, repo URL to `oksy-academy-pulse`, production URL to `pulse.oksyacademy.in`, and refresh project status from initial audit state to current progress. |
| `docs/claude-project/DATABASE_AND_ARCHITECTURE_RULES.md` | **KEEP** | Active, authoritative governing rulebook for database design, schema hygiene, RLS, query patterns, and architectural boundaries. |
| `docs/claude-project/DEVELOPMENT_AND_TESTING_RULES.md` | **KEEP** | Active, authoritative governing standard for development workflows, testing strategy, quality gates, and AI coding conventions. |
| `docs/claude-project/PRODUCT_VISION_AND_ROADMAP.md` | **KEEP** | Active directional document outlining long-term product vision, functional modules, and phased expansion. |
| `docs/claude-project/PROFESSIONALIZATION_END_STATE_STANDARD.md` | **KEEP** | Active north-star standard defining the acceptance criteria for repository hygiene, professional architecture, and quality across all 15 steps. |
| `docs/claude-project/SECURITY_REQUIREMENTS.md` | **KEEP** | Active governing specification for authentication, authorization, RLS enforcement, secrets management, and storage boundaries. |
| `docs/claude-project/audits/02b-branch-reconciliation.md` | **ARCHIVE** | Immutable historical milestone record of the 3-way branch reconciliation between main, release branch, and fix branch. |
| `docs/claude-project/audits/03b-crit1-h2-fix-plan.md` | **ARCHIVE** | Immutable historical milestone record of the C-1 financial forgeability and H-2 self-grading vulnerability analysis and fix plan. |
| `docs/claude-project/audits/04-database-schema-audit.md` | **ARCHIVE** | Immutable historical milestone record of the full Supabase schema, table structures, RLS policies, and initial finance-terminology catalog. |
| `docs/claude-project/audits/07-dependency-tooling-audit.md` | **ARCHIVE** | Immutable historical milestone record of the package dependencies, build tooling, and xlsx vulnerability resolution. |
| `docs/claude-project/audits/08-rename-migration-plan.md` | **ARCHIVE** | Immutable historical milestone record defining the product identity rename strategy from finance/portal to pulse. |
| `docs/claude-project/audits/11-database-terminology-rename-plan.md` | **ARCHIVE** | Immutable historical milestone record of the database terminology review and retention of domain-accurate table names. |

---

## 2. Stale Branding & Product Naming Audit ("Portal" / "Finance" vs "Pulse")

> **Note on Feature vs Branding Terminology**: Per project rules and Step 11 findings, domain-specific terminology such as `isFinanceRelevant`, "Finance module/views", `can_view_financials`, `collections`, `expenses`, etc. are legitimate feature-area identifiers and are **not** stale branding. Only product-identity branding references are flagged below.

### 2.1 Stale "Portal" Occurrences (Must be updated to "Pulse" or "Platform")
- **`README.md:1`**: Heading `# Oksy Academy Portal` → Should be `# Oksy Academy Pulse`.
- **`AGENTS.md:1`**: Heading `# Oksy Academy Portal — Antigravity Project Instructions` → Should be `# Oksy Academy Pulse — Antigravity Project Instructions`.
- **`AGENTS.md:3`**: Text `Welcome to the **Oksy Academy Portal** codebase.` → Should be `Welcome to the **Oksy Academy Pulse** codebase.`.
- **`PROJECT_OVERVIEW.md:1`**: Heading `# Oksy Academy Portal — Project Overview` → Should be `# Oksy Academy Pulse — Project Overview`.
- **`SETUP.md:1`**: Heading `# Oksy Academy Portal — Setup & Deployment (Zero Cost)` → Should be `# Oksy Academy Pulse — Setup & Deployment (Zero Cost)`.
- **`SETUP.md:3`**: Text `The portal has real logins...` → Should be `The platform has real logins...` (or `Pulse`).
- **`SETUP.md:45`**: Text `That single file now provisions the whole portal:` → Should be `...whole platform:`.

### 2.2 Stale "Finance" Product Identity Occurrences
- **`AGENTS.md:8`**: Repository link `Anoopdas-vs/oksy-academy-finance` → Should be `Anoopdas-vs/oksy-academy-pulse`.
- **`docs/claude-project/CLAUDE_PROJECT_CONTEXT.md:7`**: `Current application: Oksy Academy Finance` → Should be `Current application: Oksy Academy Pulse`.
- **`docs/claude-project/CLAUDE_PROJECT_CONTEXT.md:10`**: Repository `https://github.com/Anoopdas-vs/oksy-academy-finance` → Should be `https://github.com/Anoopdas-vs/oksy-academy-pulse`.
- **Historical Audit Documents**: Titles in `docs/audits/01-repo-audit.md`, `docs/audits/02-security-audit.md`, `docs/audits/04-testing-foundation.md`, and `docs/claude-project/audits/04-database-schema-audit.md` have `— oksy-academy-finance`. Since these are immutable point-in-time audit reports, their historical body text remains intact, but their titles can be cataloged as historical milestones.

---

## 3. Stale Domain References Audit (`finance` / `portal` vs `pulse.oksyacademy.in`)

Production cutover to `pulse.oksyacademy.in` was completed in earlier steps. Multiple living documents still carry legacy phrasing stating `finance.oksyacademy.in (migrated to pulse.oksyacademy.in)` or pointing directly to `finance.oksyacademy.in`.

| File | Line | Current Stale Text | Target Evergreen Text |
|---|---|---|---|
| `README.md` | 7 | `**finance.oksyacademy.in** (migrated to **pulse.oksyacademy.in**)` | `**pulse.oksyacademy.in**` |
| `AGENTS.md` | 7 | `- **Live Production URL**: `https://finance.oksyacademy.in/` (migrated to `https://pulse.oksyacademy.in/`)` | `- **Live Production URL**: `https://pulse.oksyacademy.in/`` |
| `PROJECT_OVERVIEW.md` | 4–5 | `Live at **finance.oksyacademy.in** (migrated to **pulse.oksyacademy.in**).` | `Live at **pulse.oksyacademy.in**.` |
| `SETUP.md` | 126 | `Domain: finance.oksyacademy.in (migrated to pulse.oksyacademy.in).` | `Domain: pulse.oksyacademy.in.` |
| `docs/claude-project/CLAUDE_PROJECT_CONTEXT.md` | 13 | `Production website: https://finance.oksyacademy.in/` | `Production website: https://pulse.oksyacademy.in/` |

---

## 4. Outdated Setup, Installation & Database Instructions

1. **`SETUP.md` Migration Instructions Discrepancy**:
   - Lines 53–56 state:  
     > *"Don't re-run schema.sql. Instead run the `supabase/migration-*.sql` files in filename order — they are the incremental patches (healthcare account → transfers/reconciliation → admin/reports → staff access → super admin → academy suite)."*
   - **Correction Needed**: In Step 5, migrations were formally audited and renumbered into `supabase/NN_*.sql` (`01_healthcare_account.sql` through `10_force_password_change.sql`), with Academy Suite patches named `migration-academy-suite-v2*.sql`. `SETUP.md` must be updated to reference `supabase/NN_*.sql` and `supabase/migration-academy-suite*.sql`, consistent with `README.md` and `PROJECT_OVERVIEW.md`.

2. **Supabase Project Name Guidance in `SETUP.md`**:
   - Line 19 suggests naming the Supabase project `oksy-academy`.
   - **Recommendation**: Align suggestion with current product branding: `oksy-academy-pulse`.

3. **`PROJECT_OVERVIEW.md` Pull-Request Phrasing**:
   - `PROJECT_OVERVIEW.md` §10 contains repeated phrasing like *(fixed in this PR)*, *in this branch*, and *after pulling this PR*.
   - **Correction Needed**: Transition these phrases to evergreen architectural notes (e.g., *(hardened in Step 3 / 5)* or *(enforced via migration 06)*) so the overview reads as a permanent technical manual rather than a temporary PR description.

4. **Integration of House Rules in `AGENTS.md`**:
   - `AGENTS.md` currently lists concise agent guidelines (4 bullet points). It should explicitly cross-reference the comprehensive rule documents in `docs/claude-project/` (`DATABASE_AND_ARCHITECTURE_RULES.md`, `DEVELOPMENT_AND_TESTING_RULES.md`, `SECURITY_REQUIREMENTS.md`) so that any AI tool or developer immediately adopts the repository's governing standards.

---

## 5. Content Duplication & Directory Structure Fragmentation

### 5.1 Redundant Root Directory: `Claude outputs/`
- The directory `/Users/anoopdasvs/oksy-academy-pulse/Claude outputs/` contains two files:
  - `07-dependency-tooling-audit.md`
  - `08-rename-migration-plan.md`
- **Finding**: Both files are 100% bit-for-bit identical to `docs/claude-project/audits/07-dependency-tooling-audit.md` and `docs/claude-project/audits/08-rename-migration-plan.md`.
- **Action**: Delete `Claude outputs/` entirely to eliminate repository clutter and remove non-standard root folders.

### 5.2 Split Audit Directories: `docs/audits/` vs `docs/claude-project/audits/`
- Currently, audits from early steps (`01-repo-audit.md`, `02-security-audit.md`, `04-testing-foundation.md`) reside in `docs/audits/` because `docs/claude-project/` did not exist when they were authored.
- Later audits (`02b`, `03b`, `04-database-schema-audit`, `07`, `08`, `11`, `13`) reside in `docs/claude-project/audits/`.
- Furthermore, there is a filename collision on number `04`:
  - `docs/audits/04-testing-foundation.md` (Step 4 Testing Foundation)
  - `docs/claude-project/audits/04-database-schema-audit.md` (Step 4 Database Schema Audit)
- **Consolidation Action**:
  - Move `docs/audits/01-repo-audit.md` → `docs/claude-project/audits/01-repo-audit.md`
  - Move `docs/audits/02-security-audit.md` → `docs/claude-project/audits/02-security-audit.md`
  - Move `docs/audits/04-testing-foundation.md` → `docs/claude-project/audits/04a-testing-foundation.md`
  - Remove empty directory `docs/audits/`.
  - All audit history will then live in a single unified directory: `docs/claude-project/audits/`.

### 5.3 Overlapping Scope Across Root Docs
- **Run locally / Dev environment**: Defined in `README.md` (§Run locally), `SETUP.md` (§0 & §2), and `PROJECT_OVERVIEW.md` (§1).
  - *Recommendation*: Keep `README.md` as the 30-second quickstart; keep `SETUP.md` as the step-by-step first-time zero-to-one guide; keep `PROJECT_OVERVIEW.md` as the deep technical architectural reference. Ensure their environment variable and dependency instructions are identical.
- **Database & Migrations**: Described in `README.md` (§Database), `SETUP.md` (§3), and `PROJECT_OVERVIEW.md` (§7 & §8).
  - *Recommendation*: Harmonize the migration instructions so all three consistently explain that `schema.sql` is for fresh deployments, while `NN_*.sql` is for existing database patch sequences.

---

## 6. Proposed Step 13 Execution Plan (Awaiting Review)

Once this audit plan is approved, Step 13 execution will proceed in 4 clean, atomic phases:

### Phase 1: Directory Cleanup & Audit Unification
1. Move `docs/audits/01-repo-audit.md` to `docs/claude-project/audits/01-repo-audit.md`.
2. Move `docs/audits/02-security-audit.md` to `docs/claude-project/audits/02-security-audit.md`.
3. Move `docs/audits/04-testing-foundation.md` to `docs/claude-project/audits/04a-testing-foundation.md`.
4. Remove `docs/audits/` directory.
5. Remove `Claude outputs/` directory (`07-dependency-tooling-audit.md`, `08-rename-migration-plan.md`).

### Phase 2: Root Documentation Updating
1. **`README.md`**: Update title to "Oksy Academy Pulse", update domain to `pulse.oksyacademy.in`.
2. **`AGENTS.md`**: Update title and branding to "Pulse", update live URL to `pulse.oksyacademy.in`, update repo link to `oksy-academy-pulse`, and add cross-reference links to `docs/claude-project/` standards.
3. **`PROJECT_OVERVIEW.md`**: Update title to "Pulse", update domain to `pulse.oksyacademy.in`, replace PR-specific phrasing with evergreen documentation.
4. **`SETUP.md`**: Update title and branding to "Pulse", update domain to `pulse.oksyacademy.in`, fix migration patch references from `migration-*.sql` to `NN_*.sql`.

### Phase 3: Project Context Updating
1. **`docs/claude-project/CLAUDE_PROJECT_CONTEXT.md`**: Update application name to "Oksy Academy Pulse", repository to `oksy-academy-pulse`, production URL to `pulse.oksyacademy.in`, and update project status to reflect completion of steps 1–12.

### Phase 4: Verification & Git Review
1. Verify all markdown internal relative links across the repo.
2. Confirm 0 occurrences of stale `finance.oksyacademy.in` or `portal.oksyacademy.in` in living docs.
3. Confirm 0 occurrences of "Oksy Academy Portal" in living doc headers.
4. Run `npm run lint` and `npm test` to guarantee documentation edits produced zero collateral code impact.
