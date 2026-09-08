// Period / financial-year helpers for the global top-bar date filter.
// Indian financial year runs 1 April -> 31 March.

const iso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// The financial year that contains `date`. Returns { startYear, endYear }
// where the FY is 1 Apr startYear -> 31 Mar endYear.
export function financialYearOf(date = new Date()) {
  const y = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? y : y - 1; // month 3 = April
  return { startYear, endYear: startYear + 1 };
}

export function fyLabel({ startYear, endYear }) {
  return `FY ${startYear}–${String(endYear).slice(-2)}`;
}

export const PERIOD_PRESETS = [
  { value: "all", label: "All time" },
  { value: "fy_current", label: "This FY" },
  { value: "fy_previous", label: "Last FY" },
  { value: "month_current", label: "This month" },
  { value: "custom", label: "Custom range" },
];

// Resolve a period selection into { start, end } ISO date strings (inclusive),
// or null for "all time" (no filtering).
export function resolvePeriod(period, now = new Date()) {
  if (!period || period.preset === "all") return null;

  if (period.preset === "custom") {
    const start = period.start || null;
    const end = period.end || null;
    if (!start && !end) return null;
    return { start, end };
  }

  if (period.preset === "month_current") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: iso(start), end: iso(end) };
  }

  if (period.preset === "fy_current" || period.preset === "fy_previous") {
    let { startYear } = financialYearOf(now);
    if (period.preset === "fy_previous") startYear -= 1;
    return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` };
  }

  return null;
}

// Is an ISO date string within a resolved { start, end } range (either bound
// may be null = open-ended)? A blank/invalid date is treated as out of range.
export function inRange(dateStr, range) {
  if (!range) return true;
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  if (range.start && d < range.start) return false;
  if (range.end && d > range.end) return false;
  return true;
}

// Short human label for the currently active period, for headings.
export function periodLabel(period, now = new Date()) {
  if (!period || period.preset === "all") return "All time";
  if (period.preset === "fy_current") return fyLabel(financialYearOf(now));
  if (period.preset === "fy_previous") {
    const fy = financialYearOf(now);
    return fyLabel({ startYear: fy.startYear - 1, endYear: fy.endYear - 1 });
  }
  if (period.preset === "month_current") {
    return now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  const range = resolvePeriod(period, now);
  if (!range) return "All time";
  return `${range.start || "…"} to ${range.end || "…"}`;
}
