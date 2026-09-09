# Oksy Academy Portal — Antigravity Project Instructions

Welcome to the **Oksy Academy Portal** codebase.

## 1. System Overview
- **Application**: All-in-One Academy Management System (LMS + ERP + Finance)
- **Live Production URL**: `https://finance.oksyacademy.in/` (transitioning to `https://portal.oksyacademy.in/`)
- **Hosting**: Vercel (connected to GitHub `Anoopdas-vs/oksy-academy-finance` on `main`)
- **Database**: Supabase (PostgreSQL + RLS + Auth)

## 2. Core Modules
- **Timetable (`src/pages/TimetablePage.jsx`)**: Class scheduling, batch slots, 1-click room launcher.
- **Live Classroom (`src/pages/LiveClassPage.jsx`)**: Embedded 100% free WebRTC Jitsi Meet rooms.
- **Assignments (`src/pages/AssignmentsPage.jsx`)**: Project briefs, student submissions, faculty grading.
- **Examinations (`src/pages/ExamsPage.jsx`)**: Timed MCQ quiz engine with auto-grading.
- **Reviews (`src/pages/ReviewsPage.jsx`)**: 360° faculty ratings and student feedback.
- **Financials**: Student enrollment, fee collection, expenses, banking reconciliation, and reports.

## 3. Development & Verification Commands
- `npm test`: Runs Node.js native test runner (`node:test`) on `src/lib/*.test.js` (financial calculations and bank reconciliation).
- `npm run lint`: Runs `oxlint`. Must pass with 0 errors and 0 warnings.
- `npm run build`: Production build via Vite. Bundle chunking configured in `vite.config.js`.

## 4. Agent Guidelines (90% Autonomy)
- **Zero Heavy Sync Imports**: Never import heavy libraries like `xlsx` or `recharts` synchronously in `App.jsx`. Keep entry bundle under 200 kB.
- **Maintain Modular Architecture**: Feature logic and modals belong in dedicated page/feature files.
- **Database Changes**: Always add SQL DDL scripts to `supabase/` before updating UI layers.
- **Verification First**: Always run `npm run lint` and `npm run build` after editing files before declaring done.
- **Production Sync**: When user requests deployment, commit changes with descriptive message and push to `origin main` over SSH.
