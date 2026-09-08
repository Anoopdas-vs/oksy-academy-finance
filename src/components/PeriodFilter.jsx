import React from "react";
import { PERIOD_PRESETS, periodLabel } from "../lib/period.js";

// Global date-range / financial-year selector shown in the top bar.
// `period` is { preset, start, end }; `onChange` receives the next period.
export default function PeriodFilter({ period, onChange }) {
  const set = (patch) => onChange({ ...period, ...patch });

  return (
    <div className="period-filter">
      <select
        className="period-select"
        value={period.preset}
        onChange={(e) => set({ preset: e.target.value })}
        title="Period shown across the finance views"
      >
        {PERIOD_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      {period.preset === "custom" ? (
        <span className="period-range">
          <input
            type="date"
            value={period.start || ""}
            max={period.end || undefined}
            onChange={(e) => set({ start: e.target.value })}
          />
          <span className="period-dash">–</span>
          <input
            type="date"
            value={period.end || ""}
            min={period.start || undefined}
            onChange={(e) => set({ end: e.target.value })}
          />
        </span>
      ) : (
        <span className="period-current">{periodLabel(period)}</span>
      )}
    </div>
  );
}
