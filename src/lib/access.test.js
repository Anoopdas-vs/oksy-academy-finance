// Unit tests for getAccess() in access.js — the single function that turns
// a Supabase profile row into every permission/visibility decision the app
// makes (which tabs render, who can edit/delete money records, who can
// manage users). This is the client-side mirror of the RLS boundary the
// security audit (docs/audits/02-security-audit.md, C-1/H-1) examined, so
// regressions here are exactly the kind of thing that quietly reopens a
// privilege-escalation gap. RLS is the real enforcement boundary — these
// tests only cover what the UI decides to show, not what the database
// allows — see academy.rls.test.js for the live-database side.
//
// Run directly with: node --test src/lib
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getAccess, DEFAULT_ROLE_AREAS } from "./access.js";

const profile = (over = {}) => ({
  id: "U1",
  role: "staff",
  is_approved: true,
  can_view_financials: false,
  ...over,
});

describe("getAccess — approval gate", () => {
  test("an unapproved user gets no areas at all, regardless of role", () => {
    const access = getAccess(profile({ role: "admin", is_approved: false }));
    assert.deepEqual(access.areas, []);
    assert.equal(access.isAdmin, false);
    assert.equal(access.isSuperAdmin, false);
    assert.equal(access.canOpen("Admin"), false);
  });

  test("a missing profile behaves like an unapproved default (staff, no access)", () => {
    const access = getAccess(null);
    assert.equal(access.approved, false);
    assert.deepEqual(access.areas, []);
  });
});

describe("getAccess — role tiers", () => {
  test("super_admin gets every area, even ones not listed in its own default set", () => {
    const access = getAccess(profile({ role: "super_admin" }));
    assert.deepEqual(access.areas, [
      "Pulse", "Timetable", "Live Class", "Assignments", "Exams", "Reviews",
      "Enrollment", "Fee Collection", "Expenses", "Banking", "Reports", "Admin",
    ]);
    assert.equal(access.isSuperAdmin, true);
    assert.equal(access.isAdmin, true);
    assert.equal(access.manageUsers, true);
    assert.equal(access.manageAccess, true);
  });

  test("admin can edit/delete records but cannot manage users or access config", () => {
    const access = getAccess(profile({ role: "admin" }));
    assert.equal(access.isAdmin, true);
    assert.equal(access.isSuperAdmin, false);
    assert.equal(access.canEditRecords, true);
    assert.equal(access.canDelete, true);
    assert.equal(access.manageUsers, false);
    assert.equal(access.manageAccess, false);
  });

  test("staff (Executive) opens Fee Collection/Expenses/Banking-gated areas but cannot edit or delete records", () => {
    const access = getAccess(profile({ role: "staff" }));
    assert.equal(access.isStaff, true);
    assert.equal(access.isStaffOrAdmin, true);
    assert.equal(access.canEditRecords, false);
    assert.equal(access.canDelete, false);
    assert.equal(access.canOpen("Fee Collection"), true);
    // Banking additionally requires `financials`, which plain staff don't
    // have unless can_view_financials is set.
    assert.equal(access.banking, false);
  });

  test("staff with can_view_financials granted sees full reports, but Banking still needs the area too", () => {
    const access = getAccess(profile({ role: "staff", can_view_financials: true }));
    assert.equal(access.financials, true);
    assert.equal(access.fullDashboard, true);
    assert.equal(access.allReports, true);
    // "Banking" isn't in staff's DEFAULT_ROLE_AREAS — financials alone isn't
    // enough, the Owner must also grant the area explicitly (see next test).
    assert.equal(access.banking, false);
  });

  test("staff only gets Banking once both financials AND the Banking area are granted", () => {
    const access = getAccess(
      profile({ role: "staff", can_view_financials: true }),
      { roleAreas: { staff: ["Pulse", "Banking"] } }
    );
    assert.equal(access.banking, true);

    const noFinancials = getAccess(
      profile({ role: "staff", can_view_financials: false }),
      { roleAreas: { staff: ["Pulse", "Banking"] } }
    );
    assert.equal(noFinancials.banking, false);
  });

  test("student/faculty/professional never see finance areas by default, even if approved", () => {
    for (const role of ["student", "faculty", "professional"]) {
      const access = getAccess(profile({ role }));
      assert.equal(access.canOpen("Enrollment"), false);
      assert.equal(access.canOpen("Fee Collection"), false);
      assert.equal(access.canOpen("Expenses"), false);
      assert.equal(access.canOpen("Admin"), false);
      assert.equal(access.isStudent, role !== "faculty");
    }
  });

  test("an unrecognized role falls back to no default areas rather than throwing", () => {
    const access = getAccess(profile({ role: "made_up_role" }));
    assert.deepEqual(access.areas, []);
    assert.equal(access.isAdmin, false);
  });
});

describe("getAccess — Owner-configured roleAreas override the defaults", () => {
  test("a narrower admin-configured area list for staff is honored, not just the default", () => {
    const access = getAccess(
      profile({ role: "staff" }),
      { roleAreas: { staff: ["Pulse", "Reports"] } }
    );
    assert.deepEqual(access.areas, ["Pulse", "Reports"]);
    assert.equal(access.canOpen("Fee Collection"), false);
  });

  test("roleAreas cannot smuggle in an area outside the fixed ALL_AREAS list", () => {
    const access = getAccess(
      profile({ role: "staff" }),
      { roleAreas: { staff: ["Pulse", "Not-A-Real-Area"] } }
    );
    assert.deepEqual(access.areas, ["Pulse"]);
  });

  test("roleAreas never widens super_admin beyond ALL_AREAS (it already has everything)", () => {
    const access = getAccess(
      profile({ role: "super_admin" }),
      { roleAreas: { super_admin: ["Pulse"] } }
    );
    assert.equal(access.areas.length, 12);
  });

  test("an unapproved user stays locked out even if roleAreas grants their role access", () => {
    const access = getAccess(
      profile({ role: "staff", is_approved: false }),
      { roleAreas: { staff: ["Pulse", "Fee Collection"] } }
    );
    assert.deepEqual(access.areas, []);
  });
});

describe("getAccess — matches the shipped DEFAULT_ROLE_AREAS table", () => {
  test("each non-super_admin role's default areas exactly match access.js's own table", () => {
    for (const role of Object.keys(DEFAULT_ROLE_AREAS)) {
      const access = getAccess(profile({ role }));
      assert.deepEqual(access.areas, DEFAULT_ROLE_AREAS[role]);
    }
  });
});
