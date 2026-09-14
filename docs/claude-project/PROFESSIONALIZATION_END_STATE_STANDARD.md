# Oksy Academy — Professionalization End-State Standard

This document captures a core, standing objective for the entire restructuring project. It applies across every phase of work — audit, refactor, security hardening, testing, cleanup, and architecture — and should be treated as a persistent reference alongside `PRODUCT_VISION_AND_ROADMAP.md`, `SECURITY_REQUIREMENTS.md`, `DATABASE_AND_ARCHITECTURE_RULES.md`, and `DEVELOPMENT_AND_TESTING_RULES.md`.

## 1. The End-State Vision

After all auditing, restructuring, refactoring, security hardening, testing, and cleanup work is complete, the application must not feel like "an unprofessional beginner application that was later cleaned up." It must feel like it was professionally planned, architected, designed, secured, organized, and developed correctly from the very beginning. The history of how the application was originally created (AI-assisted, iterative, beginner-led) should not be visible in the final engineering structure.

This coherence must hold across everything: product identity, domain, project name, repository structure, folder and file names, code organization and quality, naming conventions, database architecture and naming, authentication, authorization, RLS, security, environment configuration, integrations, tools, dependencies, documentation, Git/GitHub, CI/CD, testing, error handling, logging, monitoring, UI, UX, design system, deployment, and production configuration.

Every part of the system should have a clear reason for existing. The final repository should not contain visible traces of experimentation, unnecessary AI-generated code, temporary solutions, obsolete documentation, duplicate implementations, abandoned approaches, or unused tooling.

**However:** never delete something simply because it looks unnecessary. First determine what it does, whether it is referenced, and whether it is required. Only remove it with sufficient evidence that it is obsolete, duplicated, unnecessary, unsafe, or inappropriate.

## 2. Product Identity

The application began as a finance tool but is evolving into a broader Academy Management Platform. Names such as `finance.oksyacademy.in`, `oksy-academy-finance`, and other finance-specific folder names/terminology should be reviewed against whether they still represent the product's future scope.

A broader identity such as `pulse.oksyacademy.in` may better represent the future product than `finance.oksyacademy.in` — but this must be treated as an architectural/product-naming decision, not a blind rename. Evaluate domain naming, application name, repository name, local project folder name, package name, internal identifiers, database terminology, user-facing terminology, and branding as one coherent set.

If a rename is technically and strategically appropriate, propose the safest migration path. Do not break deployment, Git history, integrations, authentication, or environment configuration merely for cosmetic naming. Goal: a coherent product identity from top to bottom.

## 3. Project Folder and File Structure

The current project folder name, `oksy-academy-finance`, reflects the application's original purpose rather than its future scope. Evaluate broader professional alternatives (e.g. `oksy-academy`, `oksy-academy-platform`, or another name determined to be more appropriate), chosen based on product scope, repository conventions, future scalability, professional naming, and technical implications — never just because a name "sounds good."

Audit the entire repository for unnecessary, temporary, duplicate, or obsolete files; generated artifacts; unused documentation; abandoned experiments; old configuration; unused scripts, assets, or components; and dead code. The final repository should be clean and intentional.

## 4. Code Cleanliness

Audit for dead code, duplicate code, unused imports/variables/functions/components, duplicate components/queries/business logic, unnecessary wrappers, excessive abstraction, over-engineering, temporary workarounds, commented-out code, obsolete comments, redundant configuration, and AI-generated code that adds complexity without value.

Do not optimize for fewer lines. The objective is **clearer + safer + simpler + maintainable**, not "fewest lines possible." A longer implementation is acceptable if it improves correctness, readability, security, or maintainability.

## 5. Git and Repository Hygiene

The Git repository should look like a professionally maintained software project. Audit and clean `.gitignore`, tracked/untracked files, generated files, build artifacts, environment files, secrets, commit structure, branch structure, migration files, documentation, configuration, and repository metadata. Identify anything that should not be committed, including artifacts accumulated from AI-assisted development sessions.

Do not rewrite Git history or perform destructive Git operations without explicitly explaining the consequences and obtaining approval first.

## 6. Documentation

Avoid a repository full of unnecessary documentation. Documentation should exist because it provides useful information. Audit all existing documentation and classify each item as **KEEP / UPDATE / MERGE / ARCHIVE / REMOVE**.

Important documentation should explain architecture, database, security, development rules, deployment, testing, important architectural decisions, and AI coding instructions. Avoid documentation that merely repeats the code, and avoid creating documentation just to appear professional. Professional means useful documentation, not lots of documentation.

## 7. Tools, Connections, and Dependencies

The project may have accumulated excess tools, integrations, connections, libraries, scripts, or configuration from experimentation during AI-assisted development. Audit npm dependencies (including dev dependencies), external services, API integrations, Claude/AI-related configuration, MCP/tool connections, scripts, build tools, testing tools, monitoring/analytics, third-party libraries, browser/client integrations, Supabase integrations, and deployment integrations.

For each, determine: why does it exist, is it actually used, is it necessary, is there duplication, does it create security risk, does it increase maintenance burden or bundle size, is it outdated, can it be removed, and is there a simpler professional alternative? Do not keep tools simply because they were previously connected, and do not add tools simply because they are available. Use the minimum appropriate tooling for a professional system.

## 8. Authentication and Connections

Authentication, authorization, and external connections should look intentionally designed from the beginning. Audit authentication architecture, session management, authorization, role management, RLS, database access, storage, API connections, environment variables, service keys, client-side configuration, and external integrations.

Remove obsolete or unnecessary connections, fix weak architecture, and avoid multiple competing approaches to the same problem. The final system should have clear, understandable security boundaries.

## 9. Database

The database should feel intentionally designed rather than gradually accumulated. Review table names, column names, relationships, primary/foreign keys, constraints, indexes, functions, triggers, RPCs, views, migrations, and RLS policies.

Remove or consolidate unnecessary structures where safe. Do not destroy useful existing data, and do not perform destructive migrations without a safe migration and rollback strategy. The final database should be understandable to a senior developer who has never seen the historical development conversations.

## 10. UI / UX

The final UI should not look like "several AI-generated pages that were later redesigned." It should feel like a professional product designed around a coherent design system and user experience from the beginning.

Review information architecture, navigation, sidebar, dashboard, page hierarchy, forms, tables, filters, search, modals, drawers, buttons, alerts, notifications, loading/error/empty states, responsive design, mobile experience, accessibility, typography, spacing, visual hierarchy, component consistency, and the design system as a whole.

Do not redesign every screen for visual novelty. Preserve good existing UX. Improve only where there is a meaningful UX, accessibility, consistency, or product reason.

## 11. Naming Consistency

Perform a project-wide naming audit across product, repository, folders, files, components, functions, variables, database tables/columns, routes, APIs, modules, user-facing terminology, and documentation. Avoid leaving historical naming (e.g. "finance") in places where it no longer represents the broader Academy platform — but do not rename things blindly. Where a rename has technical consequences, identify them first.

## 12. Remove the "AI-Generated" Feel

The final project should not look like a collection of code generated independently across many separate AI conversations. Watch for repeated patterns, inconsistent naming, different coding styles, multiple approaches to the same problem, unnecessary abstractions, oversized components, repeated utility functions, and inconsistent error handling, loading states, database access, validation, and UI patterns.

Where appropriate, consolidate these into clear project-wide conventions. The goal is not to hide that AI was used — it is to ensure AI-assisted development produced a coherent, professional engineering system.

## 13. Professional Development Workflow

The final project should make future development safer. A future developer or AI coding agent should be able to understand, without relying on historical chat conversations: where new code belongs, how database changes are made, how authentication/authorization/RLS work, how testing works, how features are developed, how Git is used, how deployments happen, and how production problems are diagnosed. The project should have clear written conventions.

## 14. Do Not Over-Clean

This is not an instruction to "delete everything old." The required approach for anything considered for removal is:

**INSPECT → UNDERSTAND → CLASSIFY → JUSTIFY → CHANGE**

Before removing anything, answer: What is it? Is it referenced? Is it required? What happens if it is removed? Is it duplicated? Is it obsolete? Is removal safe? Only then remove it.

## 15. The Final Test

When restructuring is complete, looking at the website, UI/UX, project folder, repository, file structure, code, database, authentication, RLS, Git, documentation, tools, dependencies, connections, and deployment should produce the feeling: "This was professionally designed from the beginning" — never "This was a beginner project that was later cleaned up."

## 16. Never Sacrifice Functionality for Appearance

Professionalization does not mean cosmetic perfection. Priority hierarchy (highest first):

1. Security
2. Data integrity
3. Correctness
4. Reliability
5. Maintainability
6. Testability
7. Scalability
8. Performance
9. Observability
10. UX/UI
11. Naming and repository cleanliness
12. Cosmetic refinement

If a cosmetic change conflicts with security, correctness, or reliability, do not make the cosmetic change.

## 17. Required Approach

Work systematically and in controlled phases, maintaining a working application throughout:

**AUDIT → CLASSIFY → PLAN → GET APPROVAL (for major/destructive changes) → IMPLEMENT → TEST → VERIFY → CLEAN UP → DOCUMENT → FINAL AUDIT**

Do not make hundreds of unrelated changes at once.

## 18. Final Objective

The objective is not simply to "refactor the code." It is to transform Oksy Academy into a system that appears and behaves as though an experienced professional engineering and product team designed it correctly from the beginning — across product, code, database, security, UI/UX, files, folders, Git, tools, connections, documentation, testing, and deployment.

Everything should feel intentional. Nothing should exist merely because it was accidentally created during earlier AI-assisted development. Nothing important should be changed merely for appearance. Every significant part should have a clear reason for existing.
