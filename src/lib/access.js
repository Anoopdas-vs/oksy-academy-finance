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
// student/faculty/professional now have real screens (the Academy Suite:
// Timetable, Live Class, Assignments, Exams, Reviews — see DEFAULT_ROLE_AREAS
// below), so they're assignable like any other role.
export const ASSIGNABLE_ROLES = ["admin", "staff", "student", "faculty", "professional"];

// Roles whose area access the Owner configures in Admin → Access.
export const CONFIGURABLE_ROLES = ["admin", "staff", "student", "faculty", "professional"];

export const roleLabel = (role) => ROLE_LABEL[role] || role || "—";

export const ALL_AREAS = [
  "Pulse",
  "Timetable",
  "Live Class",
  "Assignments",
  "Exams",
  "Reviews",
  "Enrollment",
  "Fee Collection",
  "Expenses",
  "Banking",
  "Reports",
  "Admin",
];

// Sensible defaults for all roles across the Academy Suite.
export const DEFAULT_ROLE_AREAS = {
  admin: [
    "Pulse",
    "Timetable",
    "Live Class",
    "Assignments",
    "Exams",
    "Reviews",
    "Enrollment",
    "Fee Collection",
    "Expenses",
    "Banking",
    "Reports",
    "Admin",
  ],
  faculty: ["Pulse", "Timetable", "Live Class", "Assignments", "Exams", "Reviews"],
  student: ["Pulse", "Timetable", "Live Class", "Assignments", "Exams", "Reviews"],
  staff: [
    "Pulse",
    "Timetable",
    "Live Class",
    "Assignments",
    "Exams",
    "Reviews",
    "Enrollment",
    "Fee Collection",
    "Expenses",
    "Reports",
    "Admin",
  ],
  professional: ["Pulse", "Timetable", "Live Class", "Assignments", "Exams", "Reviews"],
};

export const ACADEMY_SUITE_AREAS = [
  "Timetable",
  "Live Class",
  "Assignments",
  "Exams",
  "Reviews",
];

export function resolveRoleAreas(settingsRoleAreas = {}) {
  if (!settingsRoleAreas || typeof settingsRoleAreas !== "object") {
    return { ...DEFAULT_ROLE_AREAS };
  }
  const isModern = Number(settingsRoleAreas._v) >= 2;
  const result = { ...DEFAULT_ROLE_AREAS };

  for (const [role, configured] of Object.entries(settingsRoleAreas)) {
    if (role === "_v" || !Array.isArray(configured)) continue;

    if (isModern) {
      result[role] = [...configured];
    } else {
      // Legacy config without _v: 2. If it contains none of the Academy Suite areas,
      // backfill any Academy Suite areas that exist in DEFAULT_ROLE_AREAS for this role.
      const hasAnyAcademyArea = configured.some((a) => ACADEMY_SUITE_AREAS.includes(a));
      if (!hasAnyAcademyArea && DEFAULT_ROLE_AREAS[role]) {
        const defaultsToAdd = DEFAULT_ROLE_AREAS[role].filter((a) =>
          ACADEMY_SUITE_AREAS.includes(a)
        );
        result[role] = Array.from(new Set([...configured, ...defaultsToAdd]));
      } else {
        result[role] = [...configured];
      }
    }
  }
  return result;
}

// Reports a non-admin role may open (Admin/Owner open all).
export const STAFF_REPORT_IDS = ["fee-collection", "receivables"];

export function getAccess(profile, settings = {}) {
  const approved = !!profile?.is_approved;
  const role = profile?.role || "staff";
  const isSuperAdmin = approved && role === "super_admin";
  const isAdmin = approved && (isSuperAdmin || role === "admin");

  const financials = approved && (isAdmin || !!profile?.can_view_financials);

  const roleAreas = resolveRoleAreas(settings.roleAreas);
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
    isStaff: approved && role === "staff",
    // Academic tiers.
    isStaffOrAdmin: approved && (isAdmin || role === "staff"), // Executive+ — academic monitors/schedulers
    isFaculty: approved && role === "faculty",
    isStudent: approved && (role === "student" || role === "professional"),
    batchName: profile?.batch_name || null,
    userId: profile?.id || null,
    fullName: profile?.full_name || profile?.email || "",
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
