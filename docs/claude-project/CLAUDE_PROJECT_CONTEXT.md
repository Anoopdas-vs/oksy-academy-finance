# Oksy Academy — Project Context

## Application

Name: Oksy Academy

Current application: Oksy Academy Pulse

Repository:
https://github.com/Anoopdas-vs/oksy-academy-pulse

Production website:
https://pulse.oksyacademy.in/

## Background

This application was initially created with extensive AI assistance.

At the time of the initial development, the developer had very limited knowledge of professional software engineering practices, including application architecture, database architecture, authentication, authorization, Supabase RLS, testing, Git/GitHub workflows, production security, deployment, monitoring, error handling, and scalability.

Therefore, the current implementation must be treated as an application that requires a professional engineering audit.

However, this does NOT mean that everything in the existing implementation is bad.

Existing functionality should be evaluated objectively.

## Original Purpose

The application originally started as a financial console for an academy.

The initial objectives included:
- Tracking expenses
- Tracking fee collections
- Understanding financial health
- Maintaining financial records
- Providing financial dashboards and reports

## Current Direction

The application is now intended to evolve into a broader Academy Management Platform.

Potential modules include:
- Student management
- Student profiles
- Student fees
- Pending fees
- Course management
- Batch management
- Faculty management
- Faculty reviews
- Faculty performance
- Timetable management
- Online classes
- Online examinations
- Assignments
- Assignment submissions
- Academic progress
- Financial management
- Reports
- Notifications
- User management
- Roles and permissions
- Administration

The final scope may change.

Do not implement or architect every future feature immediately.

The current application should first be stabilized and professionally structured.

## Important Engineering Principle

The objective is NOT:

"Rewrite the beginner application."

The objective is:

"Understand the existing application, preserve what is already good, identify weaknesses, and systematically transform the system into a professional production-grade platform."

## Professionalization Status (Steps 1–12 Complete)

The application is being professionalized through a 15-step incremental plan. Steps 1 through 12 are complete:
- **Security & Authorization (Steps 1–3)**: Fixed forgeable financial records (CRIT-1) and assignment self-grading (H-2); tightened Supabase RLS policies and role verification (`is_super_admin()`, `can_view_financials()`); resolved view bypass vulnerabilities.
- **Testing & Tooling (Steps 4 & 7)**: Established native unit-test suite (`node:test`) covering financial math and bank reconciliation; resolved dependency drift and CVEs (`xlsx` / SheetJS); enforced `oxlint` quality gates.
- **Database Architecture (Steps 5 & 11)**: Ordered and hardened SQL migrations (`NN_*.sql`); implemented audit logging (`audit_log`) and forced password reset (`must_change_password`); reviewed and validated database terminology.
- **Product Identity Rename (Steps 8–10)**: Rebranded product from "finance"/"portal" to "Oksy Academy Pulse", renamed repository and package configurations, and completed live production cutover to `pulse.oksyacademy.in`.

Currently executing **Step 13: Documentation Consolidation**.

## Production Safety

The application may contain real or important academy data.

Therefore:
- Avoid unnecessary destructive changes.
- Protect existing data.
- Understand migrations before executing them.
- Avoid direct production manipulation unless explicitly required.
- Prefer reversible changes.
- Establish a safe development and deployment workflow.

## Long-Term Goal

Build an academy platform that can continue growing for years without becoming increasingly difficult to maintain.

The system should make it easier for both human developers and AI coding agents to understand:
- Where functionality belongs
- How data flows
- How permissions work
- How the database is structured
- How features should be tested
- How changes should be deployed
- How failures should be diagnosed
