# Step 14 — UI/UX Consistency Audit (Oksy Academy Pulse)

**Date**: 2026-09-15  
**Scope**: Read-only UI/UX architectural and consistency audit across all application modules. No application source code was modified.  
**Target File**: `docs/claude-project/audits/14-ui-ux-consistency-audit.md`  
**Repository**: `oksy-academy-pulse`  
**Production Target**: `https://pulse.oksyacademy.in`  

---

## 1. Executive Summary

Oksy Academy Pulse has undergone major foundational improvements across Steps 1–13 (security hardening, RLS enforcement, test suites, dependency upgrades, product rebrand from finance to Pulse, database constraint cleanup, and documentation consolidation). 

Step 14 focuses on a comprehensive **UI/UX Consistency Pass**. As defined in the project standard (`PROFESSIONALIZATION_END_STATE_STANDARD.md` §10 and §16), the objective is **not** an arbitrary visual redesign or cosmetic overhaul. Rather, the goal is to evaluate whether the application feels like a unified, coherent, and accessible platform, to identify genuine usability bugs, accessibility failures, and interface discrepancies that arose from merging two historically separate sub-systems (the original Finance/ERP suite and the newer Academy Suite), and to investigate pre-existing technical debt deferred from earlier steps.

### Key Highlights
- **1 Critical Mobile Usability & Security Defect**: On viewports $\le 900\text{px}$ (tablets and smartphones), the Sign Out button is hidden (`display: none;`), leaving mobile users unable to log out of their session.
- **2 Root-Cause Authorizations Identified**: Traced the deferred Step 3 issues to their precise lines:
  1. `Expenses` table is permanently empty for Executive/staff because `needExpenses = access.financials` in `App.jsx:344` instead of checking `access.canOpen("Expenses")`.
  2. Academy Suite nav tabs (Timetable, Live Class, Assignments, Exams, Reviews) disappear for Executive/staff whenever database-persisted `app_settings.roleAreas` from legacy installations overwrite defaults without backfilling newly added areas.
- **7 Pre-Existing Oxlint Warnings Resolved to Root Causes**: Evaluated cascading `setState` warnings in `useEffect` and an impure `Date.now()` warning in `ExamsPage.jsx:129`. Confirmed they cause redundant re-render passes on component mount rather than runtime data corruption, and documented straightforward memoization/initialization remedies.
- **Inconsistent Sub-system Patterns**: Documented sharp UX divides between Finance pages (which use single-level headings, search pagers, `.form-error-banner`, and inline card forms) versus Academy Suite pages (which use duplicate `h2` page headers, non-paginated lists, `.auth-message.error` banners, and raw UUID displays).

---

## 2. Severity Classification Matrix

| Severity | Count | Summary of Scope |
|---|:---:|---|
| **MUST-FIX** | 5 | Blocker usability defects, missing data visibility, mobile logout trap, a11y label dissociation, and raw UUID exposure. |
| **SHOULD-FIX** | 8 | Topbar header duplication, leaking date filters, ad-hoc loading/empty states, inconsistent error banners, and redundant re-renders on mount. |
| **NICE-TO-HAVE** | 5 | Microscopic 9px font bump, focus-visible outlines, browser alert/confirm modernization, and icon design coherence. |

### Summary Table of Findings

| ID | Category | Severity / Status | Item | Primary Affected Locations |
|---|---|:---:|---|---|
| **UX-01** | Mobile / Usability | **RESOLVED (Pass 1)** | Sign Out button completely hidden on screens $\le 900\text{px}$ | `App.css:1360, 1988`, `App.jsx` |
| **UX-02** | Data Visibility / Logic | **RESOLVED (Pass 1)** | Expenses table completely empty for Staff / Executive role | `App.jsx:344` |
| **UX-03** | Navigation / Auth | **RESOLVED (Pass 1)** | Staff role missing Academy Suite tabs when `roleAreas` persisted | `lib/access.js:87–93`, `AdminPage.jsx` |
| **UX-04** | Information Display | **RESOLVED (Pass 1)** | Assignment submissions table renders raw truncated UUIDs (`s.student_id.slice(0, 8)`) instead of student names | `AssignmentsPage.jsx:342`, `lib/academy.js:117` |
| **UX-05** | Accessibility (a11y) | **RESOLVED (Pass 1)** | Form inputs in `Input` component lack `id` / `htmlFor` label association | `components/ui.jsx:47–62` |
| **UX-06** | Page Hierarchy | **DEFERRED (Pass 2)** | Hardcoded subtitle `"Oksy Academy financial management"` displays under every page topbar | `App.jsx:1309` |
| **UX-07** | Navigation / Context | **RESOLVED (Pass 1)** | Topbar `PeriodFilter` is visible on academic pages where it has no function | `App.jsx:1319` |
| **UX-08** | Page Hierarchy | **DEFERRED (Pass 2)** | Duplicate headers (`h1` topbar + `h2` page-header) on Academy Suite screens | `App.jsx:1308`, `TimetablePage.jsx:178`, `AssignmentsPage.jsx:167` |
| **UX-09** | Tables / UX | **DEFERRED (Pass 2)** | Enrollment and Fee Collection tables lack empty states when filters return 0 rows | `EnrollmentPage.jsx:82`, `FeeCollectionPage.jsx:176` |
| **UX-10** | State Handling | **DEFERRED (Pass 2)** | Ad-hoc, fragmented loading states (some pages show nothing, some table rows, some cards) | `ExamsPage.jsx`, `ReviewsPage.jsx`, `App.jsx:1324` |
| **UX-11** | Forms / Styling | **DEFERRED (Pass 2)** | Two conflicting error banner classes (`.form-error-banner` vs `.auth-message.error`) | `components/ui.jsx`, `App.css:161, 1530` |
| **UX-12** | Performance / Lint | **DEFERRED (Pass 2)** | Redundant synchronous `setLoading(true)` on mount causes double-renders | `LiveClassPage.jsx:23`, `TimetablePage.jsx:51`, `AssignmentsPage.jsx:57` |
| **UX-13** | Modals / A11y | **DEFERRED (Pass 2)** | `Modal` lacks `Escape` key dismiss, backdrop click dismiss, and ARIA dialog roles | `components/ui.jsx:64–76` |
| **UX-14** | Typography | **DEFERRED (Pass 2)** | Sub-readable 9px uppercase table headers and metadata captions | `App.css:774, 800, 2438` |
| **UX-15** | Accessibility (a11y) | **DEFERRED (Pass 2)** | Low contrast ratio on `--muted` text on white ($3.83:1$, fails WCAG AA $4.5:1$) | `App.css:26` |
| **UX-16** | Interaction / Feedback | **DEFERRED (Pass 2)** | Blocking native browser `alert()` and `confirm()` dialogs across all workflows | `App.jsx:1233`, `ExpensesPage.jsx:149`, `StaffAccess.jsx:52` |
| **UX-17** | Iconography | **DEFERRED (Pass 2)** | Mixed glyph systems (geometric text characters vs colorful OS emoji) in sidebar | `App.jsx:103–115` |
| **UX-18** | Mobile Layout | **DEFERRED (Pass 2)** | Fixed 72px sidebar on smartphones instead of an off-canvas drawer | `App.css:1335, 1981` |

---

## 3. Module & Navigation Architecture Consistency Pass

### 3.1 Topbar Subheading Mismatch (`App.jsx:1309`)
- **Finding**: The topbar header structure in `App.jsx` is:
  ```jsx
  <h1>{TAB_TITLES[activeTab] || activeTab}</h1>
  <p>Oksy Academy financial management</p>
  ```
- **Issue**: Regardless of whether the user navigates to "Class Timetable & Schedule", "Online Classroom", "Projects & Assignments", "Examinations & Quizzes", or "Admin", the subtitle remains hardcoded as `"Oksy Academy financial management"`.
- **UX Impact**: Disorients faculty and students using academic modules; perpetuates legacy single-purpose finance branding.
- **Classification**: **SHOULD-FIX**

### 3.2 Leaking Date Filter (`PeriodFilter` in `App.jsx:1313`)
- **Finding**: In `src/App.jsx:1313`, `<PeriodFilter period={period} onChange={setPeriod} />` is placed permanently in `.topbar-right`.
- **Issue**: The period filter affects:
  - Dashboard money flows & recent collections/expenses
  - Enrollment (not affected; roster is always all-time)
  - Fee Collection (filtered list)
  - Expenses (filtered list)
  - Banking (filtered list)
  - Reports (period-scoped reports)
  It has **zero effect** on:
  - Timetable (uses day-of-week tabs)
  - Live Class (shows today's sessions)
  - Assignments (coursework list)
  - Exams (tests & quizzes)
  - Reviews (all-time faculty feedback)
  - Admin (batches, categories, users, access)
- **UX Impact**: Users navigating academic tabs see an active date range picker that changes state without updating anything on screen.
- **Classification**: **SHOULD-FIX**

### 3.3 Duplicate Page Hierarchy (H1 vs H2)
- **Finding**:
  - Finance pages (`EnrollmentPage`, `FeeCollectionPage`, `ExpensesPage`, `BankingPage`, `ReportsPage`, `AdminPage`) do not include a page header; they rely entirely on the topbar's `<h1>`.
  - Academy Suite pages (`TimetablePage.jsx:178`, `AssignmentsPage.jsx:167`, `ExamsPage.jsx:274`, `ReviewsPage.jsx:104`, and `StaffAccess.jsx:88`) include a dedicated:
    ```jsx
    <div className="page-header">
      <h2>Title</h2>
      <p>Subtitle</p>
    </div>
    ```
- **UX Impact**: Navigating to "Assignments" displays:
  - Topbar: `<h1>Projects & Assignments</h1>` / `<p>Oksy Academy financial management</p>`
  - Body (20px below): `<h2>Assignments</h2>` / `<p>Create, publish and grade coursework.</p>`
  This dual-header structure creates visual friction and wastes vertical viewport space.
- **Classification**: **SHOULD-FIX**

### 3.4 Iconography Discrepancy in Sidebar (`App.jsx:103–115`)
- **Finding**: `NAV_BASE` combines two fundamentally different visual languages:
  - Unicode text glyphs: `"◎"` (Pulse), `"♙"` (Enrollment), `"₹"` (Fee Collection), `"−"` (Expenses), `"⇄"` (Banking), `"▤"` (Reports), `"☺"` (Admin)
  - Multi-colored emoji: `"📅"` (Timetable), `"🎥"` (Live Class), `"📋"` (Assignments), `"📝"` (Exams), `"⭐"` (Reviews)
- **UX Impact**: On desktop browsers (especially Windows and Linux), text glyphs render as thin wireframe symbols while emoji render as full-color 3D illustrations, creating uneven baseline alignment and visual fragmentation.
- **Classification**: **NICE-TO-HAVE**

---

## 4. Forms, Inputs & Validation Audit

### 4.1 Label and Input Dissociation (`components/ui.jsx:47–62`)
- **Finding**: The shared `Input` component renders:
  ```jsx
  export function Input({ label, value, onChange, type = "text", placeholder, error, ...rest }) {
    return (
      <div className="field">
        <label>{label}</label>
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "field-invalid" : ""}
          {...rest}
        />
        {error && <div className="field-error">{error}</div>}
      </div>
    );
  }
  ```
- **Issue**: Neither an `id` is generated for `<input>`, nor an `htmlFor` attribute added to `<label>`.
- **Accessibility Impact**: Violates WCAG 2.1 Success Criterion 1.3.1 (Info and Relationships) and 4.1.2 (Name, Role, Value). Clicking on the field label does not move focus into the text box, and screen readers cannot announce the associated label on focus.
- **Classification**: **MUST-FIX**

### 4.2 Missing Visual Required-Field Indicators
- **Finding**: When `required` is passed in `...rest` to `Input`, HTML5 form submission enforcement activates, but the `<label>` provides no visible indication (e.g. an asterisk `*` or "(required)").
- **UX Impact**: In forms like New Batch (`AdminPage`), New Expense (`ExpensesPage`), or Student Enrollment (`EnrollmentPage`), users only discover which fields are mandatory when form submission fails with a browser tooltip.
- **Classification**: **SHOULD-FIX**

### 4.3 Inconsistent Error Banner Classes
- **Finding**:
  - Finance modules (`FeeCollectionPage.jsx:78`, `ExpensesPage.jsx:61`, `BankingPage.jsx:126`, `AdminPage.jsx:181`) render form errors using `<div className="form-error-banner">{error}</div>`.
  - Academic modules (`TimetablePage.jsx:201`, `AssignmentsPage.jsx:182`, `ExamsPage.jsx:297`, `ReviewsPage.jsx:110`) and `StaffAccess.jsx:98` render errors using `<div className="auth-message error">{error}</div>`.
- **Styling Divergence**:
  - `.form-error-banner`: `border-radius: 8px; font-size: 11px; font-weight: 600; padding: 9px 12px;`
  - `.auth-message.error`: `border-radius: 7px; font-size: 11px; line-height: 1.5; padding: 10px 12px; margin-bottom: 14px;`
- **Classification**: **SHOULD-FIX**

### 4.4 Form Action Button Alignment & Labels
- **Finding**:
  - Dialog forms (`Modal` in `EnrollmentPage`, `AssignmentsPage`, `ExamsPage`, `ExpensesPage`) place secondary Cancel on the left and primary Submit on the right inside `.form-actions`.
  - Inline card forms (`ExpensesPage`, `FeeCollectionPage`, `BankingPage Transfers`) use a full-width `.button.primary.full` with no secondary cancel button.
  - Save button labels vary across modules for the exact same semantic action: `"Save Student"` vs `"Record Collection"` vs `"Record Expense"` vs `"Add Batch"` / `"Update Batch"` vs `"Submit"` vs `"Save questions"`.
- **Classification**: **NICE-TO-HAVE**

---

## 5. Tables, Filtering, Search & Pagination Audit

### 5.1 Empty State Omission on Search Results (`EnrollmentPage.jsx`, `FeeCollectionPage.jsx`)
- **Finding**:
  - In `src/pages/EnrollmentPage.jsx:82–98`, the table maps directly over `paged.pageRows`:
    ```jsx
    <tbody>
      {paged.pageRows.map((s) => ( ... ))}
    </tbody>
    ```
  - In `src/pages/FeeCollectionPage.jsx:175–230`, the table behaves identically without an empty guard.
- **Issue**: If a user enters a search query that matches 0 students or payments (or if the database has no records in that period), the table renders an empty space beneath the header.
- **Comparison**: `ExpensesPage.jsx:125` and `BankingPage.jsx:193` correctly render:
  ```jsx
  {paged.pageRows.length === 0 && (
    <tr><td colSpan={colCount} className="table-empty">No expenses in this period.</td></tr>
  )}
  ```
- **Classification**: **SHOULD-FIX**

### 5.2 Raw Truncated UUID in Assignment Submissions Table (`AssignmentsPage.jsx:342`)
- **Finding**: In `src/pages/AssignmentsPage.jsx:342`, the submissions review modal renders:
  ```jsx
  <td>{s.student_id.slice(0, 8)}…</td>
  ```
- **Root Cause**: `fetchSubmissions` in `src/lib/academy.js:117` executes:
  ```js
  supabase.from("assignment_submissions").select("*")
  ```
  It omits the foreign-key join on `student:profiles(full_name, email)`. Contrast this with `fetchExamAttempts` (`lib/academy.js:279`), which correctly requests `select("*, student:profiles(full_name,email)")`.
- **UX Impact**: When faculty or executives inspect assignment submissions for grading, they are presented with a list of anonymized UUID prefixes (e.g. `e4b109c2…`). Graders cannot determine which student submitted which assignment.
- **Classification**: **MUST-FIX**

### 5.3 Toolbar Placement Divergence
- **Finding**:
  - In `EnrollmentPage.jsx:43`, the toolbar containing `SearchBox`, `Pager`, and action buttons sits *above* `.table-card` as a standalone element.
  - In `ExpensesPage.jsx:103`, `FeeCollectionPage.jsx:153`, and `BankingPage.jsx:175`, the toolbar is located *inside* `.table-card` directly beneath `.card-heading`.
- **UX Impact**: Inconsistent layout structure across adjacent navigation tabs.
- **Classification**: **SHOULD-FIX**

### 5.4 Complete Absence of Search and Pagination in Academy Modules
- **Finding**: `TimetablePage`, `LiveClassPage`, `AssignmentsPage`, `ExamsPage`, and `ReviewsPage` do not use `SearchBox`, `Pager`, or `usePagedList`.
- **Issue**: While enrollment, expenses, and collections are protected by 20-items-per-page pagination and search filtering, academic modules render all records directly in the DOM. As assignments and exams accumulate throughout the academic year, performance degrades and finding items requires excessive vertical scrolling.
- **Classification**: **SHOULD-FIX**

---

## 6. Modals, Drawers & Confirmation Patterns Audit

### 6.1 Modal Component Accessibility & Keyboard Behavior (`components/ui.jsx:64–76`)
- **Finding**: The global `Modal` component is defined as:
  ```jsx
  export function Modal({ title, children, onClose }) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="modal-header">
            <h3>{title}</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          {children}
        </div>
      </div>
    );
  }
  ```
- **Deficiencies**:
  1. **Keyboard Accessibility**: Pressing `Escape` does not close the modal.
  2. **Backdrop Click**: Clicking on `.modal-overlay` outside the card does not invoke `onClose`.
  3. **Focus Management**: There is no focus trap; tabbing cycles through interactive elements underneath the overlay.
  4. **ARIA Roles**: Lacks `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
  5. **Close Button Accessibility**: `<button className="modal-close">×</button>` has no `aria-label="Close"`.
- **Classification**: **SHOULD-FIX**

### 6.2 Discrepancy in Edit Workflows
- **Finding**:
  - Editing a Student, Expense, or Bank Transfer launches a clean popup `Modal`.
  - Editing a Batch on `AdminPage` does not use a modal; instead, it rewrites the static left-hand card on `AdminPage` into "Edit Batch" mode and adds a "Cancel" button.
- **UX Impact**: Minor mental model inconsistency between modules.
- **Classification**: **NICE-TO-HAVE**

### 6.3 Browser-Native Blocking `window.confirm()` Dialogs
- **Finding**: 12 destructive actions across the application rely on `window.confirm(...)`:
  - `ExpensesPage.jsx:149`: Delete expense
  - `FeeCollectionPage.jsx:221`: Delete fee collection
  - `BankingPage.jsx:210`: Delete transfer
  - `BankingPage.jsx:385`: Delete statement
  - `BankingPage.jsx:447`: Unmatch line
  - `AdminPage.jsx:230`: Delete batch
  - `AdminPage.jsx:315`: Delete category
  - `AssignmentsPage.jsx:118`: Delete assignment
  - `ExamsPage.jsx:111`: Delete exam
  - `TimetablePage.jsx:132`: Cancel class slot
  - `TimetablePage.jsx:143`: Delete class slot
- **UX Impact**: Native browser dialogs block JavaScript execution on the main thread, cannot be branded, lack accessibility customization, and have inconsistent button labels ("OK" / "Cancel") across operating systems.
- **Classification**: **NICE-TO-HAVE**

---

## 7. Loading, Error & Empty States Audit

### 7.1 Misstyled Global Data Loading Indicator (`App.jsx:1324`)
- **Finding**: Line 1324 in `src/App.jsx`:
  ```jsx
  {dataLoading && <div className="auth-message page-error">Loading data...</div>}
  ```
- **Issue**: `.auth-message.page-error` combines `.auth-message` with `.page-error` (margin only). Because neither `.error` nor `.notice` is present, it inherits no background color or text color from `App.css`, appearing as an unstyled text box.
- **Classification**: **SHOULD-FIX**

### 7.2 Fragmented Loading State Implementations
- **Finding**:
  - `TimetablePage.jsx:247`: Table row `<tr><td colSpan={7}>Loading…</td></tr>`
  - `LiveClassPage.jsx:93`: Table row `<tr><td colSpan={5}>Loading…</td></tr>`
  - `StaffAccess.jsx:131`: Table row `<tr><td colSpan={7}>Loading user accounts...</td></tr>`
  - `AssignmentsPage.jsx:199`: Standalone card `<div className="table-card" style={{ padding: "2rem" }}>Loading…</div>`
  - `ExamsPage.jsx`: **No loading indicator at all**
  - `ReviewsPage.jsx`: **No loading indicator at all**
  - Finance pages (`EnrollmentPage`, `FeeCollectionPage`, `ExpensesPage`, `BankingPage`): **No local loading indicator** (rely on the misstyled top-level banner).
- **UX Impact**: Inconsistent visual feedback; users experience abrupt layout shifts and empty flashes when navigating to Exams or Reviews.
- **Classification**: **SHOULD-FIX**

### 7.3 Fragmented Empty State Implementations
- **Finding**:
  - Table-based pages use `<td className="table-empty">`.
  - Non-table pages use `<div className="table-card table-empty">` or `<div className="empty-state">`.
  - Suite-pending pages use `<div className="empty-state"><div className="empty-icon">...</div><h3>...</h3><p>...</p></div>`.
  - `EnrollmentPage` and `FeeCollectionPage` render no empty state at all on empty results.
- **Classification**: **SHOULD-FIX**

---

## 8. Responsive & Mobile Usability Audit

### 8.1 Critical Mobile Defect: Sign Out Button Hidden (`App.css:1360, 1988`)
- **Finding**: In `src/App.css`:
  ```css
  @media (max-width: 900px) {
    .security-box,
    .user-mini > div:not(.avatar),
    .sign-out {
      display: none;
    }
  }
  ```
  And under `.nav-collapsed`:
  ```css
  .nav-collapsed .sign-out {
    display: none;
  }
  ```
- **Issue**: The `.sign-out` button in the sidebar footer is the **only** sign-out trigger in the entire authenticated application (`App.jsx:1289`). There is no sign-out option in the topbar or mobile menu.
- **Severity**: **MUST-FIX**. Any user accessing the application on an iPad portrait ($768\text{px}$) or mobile phone ($375\text{px} - 430\text{px}$) is completely locked into their session and cannot sign out.

### 8.2 Ineffective Mobile Navigation Drawer
- **Finding**: On mobile devices ($\le 650\text{px}$), the sidebar does not collapse off-canvas. Instead, it shrinks to a fixed $72\text{px}$ (or $66\text{px}$ when collapsed) column on the left:
  ```css
  .main-content {
    margin-left: 72px;
    width: calc(100% - 72px);
  }
  ```
- **UX Impact**: On a $375\text{px}$ mobile screen, $72\text{px}$ consumes nearly 20% of the entire display, leaving approximately $300\text{px}$ for complex 8-column data tables, modals, and two-column form cards. The topbar hamburger button (`☰`) only collapses/expands labels within the $72\text{px}$ column rather than toggling an overlay drawer.
- **Classification**: **NICE-TO-HAVE** (Standard is to preserve existing working layout, but documented for responsive awareness).

### 8.3 Mobile Topbar Overflow
- **Finding**: In `App.jsx:1315–1320`, `.top-user` renders both the circular avatar and the user's full email address:
  ```jsx
  <div className="top-user">
    <span className="top-user-avatar">...</span>
    {profile.full_name || profile.email}
  </div>
  ```
- **Issue**: On screens $< 500\text{px}$, a long email address combined with `PeriodFilter` and `NotificationBell` crowds the topbar, pushing controls into horizontal overflow.
- **Classification**: **SHOULD-FIX**

---

## 9. Accessibility (WCAG 2.1 AA) Audit

### 9.1 Low Color Contrast for Muted Text (`App.css:26`)
- **Finding**: Design token `--muted: #7b8394;` is rendered against white (`#ffffff`) and pale background (`#fbfafc`).
- **Contrast Measurement**:
  $$\text{Contrast Ratio}(\#7b8394, \#ffffff) \approx 3.83 : 1$$
- **WCAG Compliance**: Fails WCAG 2.1 Success Criterion 1.4.3 (Contrast Minimum), which requires at least $4.5 : 1$ for normal body text.
- **Where Used**: Table headers (`th`), secondary captions (`.table-sub`), field descriptions, and status cards. Combined with small font sizes ($9\text{px} - 11\text{px}$), this text is difficult for users with moderate visual impairments to read.
- **Remedy**: Darkening `--muted` slightly to `#64748b` (Slate 500, ratio $4.6 : 1$) or `#525b6e` achieves full WCAG AA compliance while maintaining the intended visual hierarchy.
- **Classification**: **NICE-TO-HAVE**

### 9.2 Missing Accessible Names on Icon-Only Controls
- **Finding**:
  1. `SearchBox.jsx:5`: Search input has a `placeholder` but no `aria-label="Search"`.
  2. `NotificationBell.jsx:58`: Bell toggle button has an `aria-label`, which is good practice.
  3. `App.jsx:1266`: Sidebar navigation buttons rely on `title={item.key}`. When collapsed on mobile, `.nav-label` has `font-size: 0; display: none;`. An explicit `aria-label={item.key}` ensures robust screen-reader support.
  4. `ui.jsx:70`: Modal close button `<button className="modal-close">×</button>` has no `aria-label="Close"`.
- **Classification**: **SHOULD-FIX**

### 9.3 Focus Rings & Keyboard Navigation
- **Finding**: `outline: none;` is set on `.search:focus`, `.field input:focus`, and `.picker > input:focus`. While custom box-shadow focus rings are applied to inputs, buttons (`.button.primary`, `.button.secondary`, `.nav-item`, `.subtab`) lack explicit `:focus-visible` styles, making keyboard tab-navigation difficult to track visually.
- **Classification**: **NICE-TO-HAVE**

---

## 10. Typography, Spacing & Visual Hierarchy Audit

### 10.1 Sub-Readable 9px Font Size in Tables & Captions
- **Finding**:
  - `App.css:774`: `th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }`
  - `App.css:800`: `.table-sub { font-size: 9px; }`
  - `App.css:2438`: `.section-card table.tight th { font-size: 9px; }`
- **Issue**: A 9px font size is below standard web design norms (typically $11\text{px} - 12\text{px}$ for micro-copy and $12\text{px} - 13\text{px}$ for table headers). On high-DPI laptop displays and mobile phones, 9px uppercase text requires visual straining.
- **Classification**: **NICE-TO-HAVE**

### 10.2 Inline Style Leakage in Modern Suite Pages
- **Finding**: While Finance pages use well-structured classes in `App.css`, Academy Suite pages frequently fall back to inline styles:
  - `StaffAccess.jsx:86, 92, 184, 191`: Inline flex, padding, and hex color values (`#fef3c7`, `#92400e`).
  - `AssignmentsPage.jsx:198, 208, 211, 212`: Inline flex containers and padding (`style={{ padding: "1.25rem" }}`).
  - `NotificationBell.jsx:61–83`: Entire dropdown card and badge styled via large inline objects.
- **UX Impact**: Makes cohesive visual maintenance difficult and prevents responsive stylesheet overrides.
- **Classification**: **NICE-TO-HAVE**

---

## 11. Technical Deep-Dive: Pre-Existing Lint Warnings (Step 12 Candidates)

During Step 12 (code cleanliness), 7 oxlint warnings were preserved as candidates for evaluation in Step 14. Below is the technical investigation of whether each represents a real UX defect or harmless noise.

### 11.1 Date.now() Impurity Warning in `ExamsPage.jsx:129:50`
- **Warning**: `react(purity): Cannot call impure function during render. help: Date.now is an impure function.`
- **Inspection of Code (`ExamsPage.jsx:116–130`)**:
  ```javascript
  const startTest = async (ex) => {
    setErr("");
    const { rows: qs } = await fetchExamQuestionsForStudent(ex.id);
    if (!qs.length) { alert("This exam has no questions yet."); return; }
    const { row, error } = await startExamAttempt(ex.id, access.userId);
    if (error) { setErr(error.message); return; }

    const { rows: saved } = await fetchExamAnswers(row.id);
    const restored = {};
    saved.forEach((a) => { if (a.chosen_index != null) restored[a.question_id] = a.chosen_index; });

    const elapsed = row.started_at ? Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000) : 0;
    const remaining = ex.duration_minutes * 60 - elapsed;
    ...
  };
  ```
- **Investigation**:
  - `startTest` is an event handler triggered **only** when a student clicks the "Start Exam" or "Resume" button.
  - It is **not** called during component rendering.
  - Oxlint's static AST heuristic flagged it because `startTest` is declared as an unmemoized arrow function directly in the body of `ExamsPage` without `useCallback`.
- **UX Impact Assessment**: **No UX defect**. The elapsed time computation is mathematically correct and only executes on user action. Wrapping `startTest` in `useCallback` or extracting the calculation resolves the linter warning cleanly without risk.
- **Classification**: **Cosmetically Harmless / Tooling Heuristic**.

### 11.2 React `set-state-in-effect` Warnings (6 occurrences)
- **Warning**: `react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders.`
- **Affected Locations**:
  1. `src/pages/LiveClassPage.jsx:31:21`
  2. `src/pages/TimetablePage.jsx:60:5`
  3. `src/pages/AssignmentsPage.jsx:67:21`
  4. `src/pages/ExamsPage.jsx:56:21`
  5. `src/pages/ReviewsPage.jsx:30:21`
  6. `src/components/NotificationBell.jsx:23:5`
- **Inspection of Code**:
  Taking `LiveClassPage.jsx` as the representative pattern:
  ```javascript
  const [loading, setLoading] = useState(true); // initialized to true
  ...
  const load = useCallback(async () => {
    setLoading(true); // <--- Calling setState synchronously before await
    const [tt, ls] = await Promise.all([...]);
    ...
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  ```
- **Investigation**:
  - In `LiveClassPage`, `TimetablePage`, and `AssignmentsPage`, state is already initialized to `loading = true` via `useState(true)`.
  - When `useEffect` runs on mount, it immediately calls `load()`.
  - The first line inside `load()` is `setLoading(true)`.
  - React detects a synchronous `setState` call inside an effect prior to the first asynchronous `await`. This triggers a redundant re-render pass on initial mount before network data arrives.
  - In `NotificationBell`, `ExamsPage`, and `ReviewsPage`, the effect calls an async fetch function that only updates state *after* the network promise settles, but oxlint's static checker flags any function containing `setState` invoked from `useEffect`.
- **UX Impact Assessment**:
  - **No data bug or infinite loop**: All dependencies are stable.
  - **Minor rendering overhead**: Causes an unnecessary micro-render cycle on component mount.
  - **Remedy**: Removing the redundant `setLoading(true)` on initial mount (retaining it only for user-initiated reloads) eliminates the cascading render cycle.
- **Classification**: **SHOULD-FIX** (Performance hygiene / console cleanliness).

---

## 12. Technical Deep-Dive: Deferred Staff / Executive Role Issues

During Step 3 security reviews, two UI discrepancies regarding the `staff` ("Executive") role were noted and deferred to Step 14.

### 12.1 Root Cause 1: Missing Expenses Table Visibility
- **The Issue**: A user logged in with the `staff` role who navigates to "Expenses" sees an empty table ("No expenses in this period"), even when valid expense records exist.
- **Code Trace**:
  In `src/App.jsx:340–355`:
  ```javascript
  const loadData = async () => {
    setDataLoading(true);
    try {
      const needCollections = access.financials || access.canOpen("Fee Collection");
      const needExpenses = access.financials; // <--- BUG HERE

      const [studentRows, collectionRows, batchRows, expenseRows, categoryRows, settings] =
        await Promise.all([
          fetchStudents(),
          needCollections ? fetchCollections().catch(() => []) : Promise.resolve([]),
          fetchBatches().catch(() => []),
          needExpenses ? fetchExpenses().catch(() => []) : Promise.resolve([]),
          needExpenses ? fetchExpenseCategories().catch(() => []) : Promise.resolve([]),
          fetchAppSettings().catch(() => ({})),
        ]);
      ...
  ```
- **Why this happens**:
  - Notice line 343: `needCollections` is `access.financials || access.canOpen("Fee Collection")`. Staff members who can open Fee Collection have their collections fetched.
  - Notice line 344: `needExpenses` is **only** `access.financials`.
  - Per `src/lib/access.js:85`:
    `const financials = approved && (isAdmin || !!profile?.can_view_financials);`
  - For `staff`, `financials` is `false` unless `can_view_financials` is explicitly checked on their profile in the database.
  - However, in `DEFAULT_ROLE_AREAS.staff` (`access.js:69`), `"Expenses"` is an authorized area. The staff user sees the "Expenses" tab in the sidebar, can open it, and can even submit new expenses (enforced by RLS `is_staff_or_admin()`). But because `needExpenses` is false, `fetchExpenses()` is never executed on load!
- **Severity**: **MUST-FIX**.
- **Fix**: Update line 344 of `src/App.jsx`:
  ```javascript
  const needExpenses = access.financials || access.canOpen("Expenses");
  ```

### 12.2 Root Cause 2: Missing Academy Suite Nav Items for Staff / Executive
- **The Issue**: On production (`pulse.oksyacademy.in`), staff accounts do not see "Timetable", "Live Class", "Assignments", "Exams", or "Reviews" in the sidebar navigation.
- **Code Trace**:
  In `src/lib/access.js:87–93`:
  ```javascript
  const roleAreas = { ...DEFAULT_ROLE_AREAS, ...(settings.roleAreas || {}) };
  let areas;
  if (isSuperAdmin) areas = ALL_AREAS;
  else if (!approved) areas = [];
  else areas = roleAreas[role] || DEFAULT_ROLE_AREAS[role] || [];
  areas = ALL_AREAS.filter((a) => areas.includes(a));
  ```
  In `src/App.jsx:1242–1244`:
  ```javascript
  const nav = [...NAV_BASE, { key: "Admin", icon: "☺" }].filter(
    (item) => (!item.financial || access.financials) && access.canOpen(item.key)
  );
  ```
- **Why this happens**:
  - In production Supabase, `public.app_settings.data` contains a saved JSON document created during the initial setup before Academy Suite was introduced.
  - In that saved JSON, `roleAreas.staff` was stored as:
    `["Pulse", "Enrollment", "Fee Collection", "Expenses", "Reports", "Admin"]`
  - Because `settings.roleAreas.staff` exists, `roleAreas[role]` in `access.js:91` evaluates to that persisted array, **completely superseding** `DEFAULT_ROLE_AREAS.staff`.
  - The newly added Academy Suite areas (`Timetable`, `Live Class`, `Assignments`, `Exams`, `Reviews`) are absent from the persisted array. Consequently, `access.canOpen("Live Class")` returns `false`, and the filter in `App.jsx:1243` strips them from the sidebar.
  - Yet the security and authorization architecture explicitly establishes staff oversight:
    `isStaffOrAdmin: approved && (isAdmin || role === "staff") // Executive+ — academic monitors/schedulers`
- **Severity**: **MUST-FIX**.
- **Fix**:
  1. Frontend resilience in `access.js`: Ensure that if `settings.roleAreas[role]` exists, newly introduced default academic areas are not omitted unless explicitly turned off.
  2. Data sync: Ensure the Super Admin ("Owner") view in Admin → Access reflects and saves the complete set of areas.

---

## 13. Implementation Recommendations & Phasing Strategy

To ensure zero functional regressions, implementation should follow a two-tier plan once this report is reviewed:

### Phase 1: High-Priority Fixes (Must-Fix & Core Usability)
1. **Restore Mobile Sign Out**: Move or duplicate the Sign Out action to ensure visibility across all viewports ($\le 900\text{px}$).
2. **Resolve Staff Data Gaps**:
   - Fix `needExpenses = access.financials || access.canOpen("Expenses")` in `App.jsx:344`.
   - Update `getAccess` in `access.js` to prevent stale database `roleAreas` from stripping default academic suite tabs from the Executive role.
3. **Resolve Assignment Submissions Student Identity**:
   - Update `fetchSubmissions` in `lib/academy.js` to select `*, student:profiles(full_name, email)`.
   - Display `s.student?.full_name || s.student?.email || s.student_id` in `AssignmentsPage.jsx:342`.
4. **Form Label Association**:
   - Add automatic `id` generation and `htmlFor` attributes to `Input` in `components/ui.jsx`.

### Phase 2: Consistency & Polish (Should-Fix)
1. **Dynamic Topbar Titles & Subtitles**:
   - Replace hardcoded `"Oksy Academy financial management"` in `App.jsx:1309` with dynamic context-aware module descriptions or remove the redundant subtitle.
   - Conditionally hide `PeriodFilter` on academic tabs where date filtering is inactive.
2. **Harmonize Page Headers**:
   - Eliminate the duplicate `h2` page headers on Academy Suite pages, letting the topbar serve as the unified header.
3. **Standardize Table Empty & Loading States**:
   - Add empty state table rows to `EnrollmentPage` and `FeeCollectionPage`.
   - Normalize loading spinners/skeletons across all modules.
4. **Modal Enhancements**:
   - Add `Escape` key and backdrop click listeners to `Modal` in `components/ui.jsx`.
5. **Clean Oxlint Warnings**:
   - Remove redundant synchronous `setLoading(true)` on mount and memoize `startTest` in `ExamsPage`.

---

## 14. Conclusion & Audit Status

The initial read-only audit identified 18 items across mobile usability, data visibility, authorization resilience, information display, forms/accessibility, and page layout. Following user review and approval of Phase 1 must-fixes plus PeriodFilter scoping, Pass 1 has been executed and verified.

---

## 15. Implementation Changelog — Pass 1 (Step 14)

**Branch**: `fix/step14-ui-ux-pass1`

The approved Phase 1 set of 6 items has been implemented with individual, reviewable commits:

1. **UX-01**: `fix(ux-01): make sign-out accessible on mobile and collapsed navigation`
   - Preserved `.sign-out` in collapsed sidebar navigation as a 44x36px icon button (`⎋`) with accessible attributes (`title="Sign Out"`, `aria-label="Sign Out"`).
   - Added a duplicate `.top-sign-out` button in `.topbar-right` for immediate visibility across compact screen sizes.
   - Removed `display: none` on `.sign-out` under `max-width: 900px`.
   - Hid `.top-user-name` at $\le 650\text{px}$ to prevent topbar overflow while preserving the avatar and sign-out controls.

2. **UX-02**: `fix(ux-02): allow staff to view expenses when granted access to Expenses tab`
   - Updated `src/App.jsx:344` so `needExpenses = access.financials || access.canOpen("Expenses")`.
   - Staff/Executive users with explicit access to the Expenses tab now load and view expense records rather than seeing an empty table.

3. **UX-03**: `fix(ux-03): preserve default academic suite areas when merging roleAreas`
   - Added `resolveRoleAreas()` in `src/lib/access.js` that distinguishes legacy saved configurations from explicit modern configs (`_v: 2`).
   - For legacy configs lacking Academy Suite areas, backfills default academic suite areas (`Timetable`, `Live Class`, `Assignments`, `Exams`, `Reviews`) for staff and other roles.
   - Updated `AdminPage.jsx` (`AccessConfig`) to initialize via `resolveRoleAreas` and persist `{ _v: 2, ...payload }`.
   - Added unit test suite in `src/lib/access.test.js` validating legacy backfill, modern explicit overrides, and fallback defaults.

4. **UX-04**: `fix(ux-04): join student profile on assignment submissions and display student name`
   - Updated `fetchSubmissions` in `src/lib/academy.js` to select `*, student:profiles(full_name,email)`.
   - Updated `src/pages/AssignmentsPage.jsx` submissions table to display `s.student?.full_name || s.student?.email || s.student_id.slice(0, 8)…`.
   - Added student name context to the Grade submission modal title when available.

5. **UX-05**: `fix(ux-05): associate input labels with inputs via htmlFor and generated id`
   - Updated `Input` component in `src/components/ui.jsx` using React `useId()` and a sanitized label slug generator.
   - Explicit `id` prop is preserved when supplied; otherwise generates unique ID per input instance.
   - Wires `<label htmlFor={inputId}>{label}</label>` and `<input id={inputId} ... />`.

6. **UX-07**: `fix(ux-07): scope topbar PeriodFilter to financial and reporting views`
   - Defined `PERIOD_FILTER_TABS` (`Pulse`, `Enrollment`, `Fee Collection`, `Expenses`, `Banking`, `Reports`) in `src/App.jsx`.
   - Conditionally rendered `PeriodFilter` only when `activeTab` belongs to `PERIOD_FILTER_TABS`.
   - Topbar no longer displays inactive date range filters on academic tabs (`Timetable`, `Live Class`, `Assignments`, `Exams`, `Reviews`) or `Admin`.

### Deferred Backlog (Pass 2+)
All remaining items from this audit (`UX-06`, `UX-08` through `UX-18`) are deferred to subsequent passes:
- `UX-06`: Topbar subtitle dynamic context
- `UX-08`: Elimination of duplicate H1/H2 page headers in Academy Suite
- `UX-09`: Empty states for search/filter in Enrollment and Fee Collection
- `UX-10`: Normalization of loading spinners/skeletons across all views
- `UX-11`: Consolidation of error banner CSS classes
- `UX-12`: Elimination of redundant `setLoading(true)` on mount (oxlint warnings)
- `UX-13`: Modal keyboard dismiss (`Escape`), backdrop click dismiss, and ARIA attributes
- `UX-14`: 9px uppercase typography bump
- `UX-15`: Contrast ratio adjustment on `--muted` text
- `UX-16`: Custom confirmation dialogs replacing native browser `confirm()`
- `UX-17`: Sidebar icon coherence (Unicode glyphs vs emoji)
- `UX-18`: Comprehensive mobile drawer overhaul

