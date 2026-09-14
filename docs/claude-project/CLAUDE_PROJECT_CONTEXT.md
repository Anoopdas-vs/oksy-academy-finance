# Oksy Academy — Project Context

## Application

Name: Oksy Academy

Current application: Oksy Academy Finance

Repository:
https://github.com/Anoopdas-vs/oksy-academy-finance

Production website:
https://finance.oksyacademy.in/

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

## Current Known Concerns

The following are concerns that require investigation:
- Authentication
- Authorization
- Supabase RLS
- Database structure
- Database relationships
- Database queries
- Security
- Environment variables
- Secrets
- Git configuration
- .gitignore
- Testing
- Error handling
- Performance
- Scalability
- Code organization
- UI/UX
- Deployment
- Monitoring
- Backup and recovery

These are investigation areas, NOT assumptions that everything is broken.

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
