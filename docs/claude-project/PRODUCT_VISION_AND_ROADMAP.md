# Oksy Academy — Product Vision & Roadmap

## Vision

The long-term vision is to evolve Oksy Academy from a financial console into a comprehensive Academy Management Platform.

The platform should bring major academy operational functions into one system.

## Current Foundation

The application began primarily as a financial console.

Current/initial areas include:
- Expenses
- Fee collections
- Financial tracking
- Financial health
- Reports/dashboard

## Potential Future Modules

### Finance
- Income
- Expenses
- Fee collection
- Pending fees
- Financial reports
- Financial dashboard

### Students
- Student profiles
- Enrollment
- Courses
- Batches
- Fee status
- Academic progress
- Attendance
- Assignments
- Examinations

### Faculty
- Faculty profiles
- Classes
- Timetable
- Performance
- Reviews
- Academic responsibilities

### Academics
- Courses
- Batches
- Timetable
- Online classes
- Assignments
- Assignment submissions
- Online exams
- Results
- Progress tracking

### Communication
- Notifications
- Announcements
- Student communication
- Faculty communication

### Administration
- Users
- Roles
- Permissions
- Academy settings
- System configuration

## Roadmap Philosophy

Do not build every future module immediately.

First establish a reliable foundation.

Recommended broad sequence:

### Phase 0 — Foundation
- Security audit
- Authentication
- Authorization
- RLS
- Database integrity
- Secrets/environment security
- Git workflow
- Testing foundation
- Error handling
- Monitoring
- Backup/recovery

### Phase 1 — Stabilize Finance

Ensure the existing financial functionality is reliable and well tested.

### Phase 2 — Students

Build student-related functionality on the stable foundation.

### Phase 3 — Courses & Faculty

Introduce academic and faculty structures.

### Phase 4 — Academic Operations

Introduce:
- Timetables
- Classes
- Assignments
- Exams
- Progress

### Phase 5 — Communication & Administration

Introduce:
- Notifications
- Announcements
- Advanced user management
- Permissions
- Academy administration

## Important

This roadmap is directional.

Do not assume the exact module structure before auditing the existing application and understanding real business requirements.

Architecture should support future expansion without prematurely implementing features that are not yet required.

## Product Principle

Every new feature should strengthen the platform rather than create another isolated feature.

The system should remain:
- Secure
- Consistent
- Maintainable
- Performant
- Testable
- Scalable
- Easy to understand
