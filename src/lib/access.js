// Single source of truth for roles, their display names, and what each can
// see/do. The super admin ("Owner") configures per-role "areas" (which tabs a
// role opens) in Admin → Access; stored in app_settings.data.roleAreas.

export const ROLES = ["super_admin", "admin", "staff", "student", "faculty", "professional"];

export const ROLE_LABEL = {
  super_admin: "Owner",
  admin: "Admin",
  staff: "Executive",
  student: "Student",
  faculty: "Faculty",
  professional: "Professionals",
};

// Roles that can be assigned from the app (Owner is set in the database only).
// student/faculty/professional are deliberately left out: they have no
// permissions and no dedicated screens today (DEFAULT_ROLE_AREAS gives them
// nothing, and there's no UI built for what they'd see), so offering them
// here would just let someone create a login that can never do anything.
// The database role check constraint still allows them — if your project
// already has an account in one of these roles from before, it keeps
// working exactly as it does today; this only affects new logins created
// from this form. Add them back here once real screens exist.
export const ASSIGNABLE_ROLES = ["admin", "staff"];

// Roles whose area access the Owner configures in Admin → Access.
export const CONFIGURABLE_ROLES = ["admin", "staff", "student", "faculty", "professional"];

export const roleLabel = (role) => ROLE_LABEL[role] || role || "—";

export const ALL_AREAS = [
  "Pulse",
  "Enrollment",
  "Fee Collection",
  "Expenses",
  "Banking",
  "Reports",
  "Admin",
];

// Sensible defaults when nothing has been configured yet. The three new roles
// start with no access — the Owner grants areas later in Admin → Access.
export const DEFAULT_ROLE_AREAS = {
  admin: ["Pulse", "Enrollment", "Fee Collection", "Expenses", "Banking", "Reports", "Admin"],
  staff: ["Pulse", "Enrollment", "Fee Collection", "Expenses", "Reports", "Admin"],
  student: [],
  faculty: [],
  professional: [],
};

// Reports a non-admin role may open (Admin/Owner open all).
export const STAFF_REPORT_IDS = ["fee-collection", "receivables"];

export function getAccess(profile, settings = {}) {
  const approved = !!profile?.is_approved;
  const role = profile?.role || "staff";
  const isSuperAdmin = approved && role === "super_admin";
  const isAdmin = approved && (isSuperAdmin || role === "admin");

  const financials = approved && (isAdmin || !!profile?.can_view_financials);

  const roleAreas = { ...DEFAULT_ROLE_AREAS, ...(settings.roleAreas || {}) };
  let areas;
  if (isSuperAdmin) areas = ALL_AREAS;
  else if (!approved) areas = [];
  else areas = roleAreas[role] || DEFAULT_ROLE_AREAS[role] || [];
  areas = ALL_AREAS.filter((a) => areas.includes(a));

  return {
    approved,
    role,
    roleLabel: roleLabel(role),
    isSuperAdmin,
    isAdmin,
    isStaff: approved && !isAdmin,
    financials,
    areas,
    canOpen: (area) => areas.includes(area),
    banking: financials && areas.includes("Banking"),
    fullDashboard: financials,
    allReports: financials,
    manageUsers: isSuperAdmin,       // only the Owner touches roles / approval
    manageAccess: isSuperAdmin,      // only the Owner edits area config
    canEditRecords: isAdmin,         // edit / delete fee collections, expenses…
    canDelete: isAdmin,
  };
}
