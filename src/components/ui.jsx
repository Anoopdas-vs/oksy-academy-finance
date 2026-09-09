import React from "react";

// Colour of the figure:
//   tone="pos" | "neg"  → force green / red
//   tone="auto"         → green when `amount` >= 0, red when < 0
//   positive (legacy)   → green
export function MetricCard({ label, value, icon, accent, positive, tone, amount, highlighted, locked }) {
  let colour = "";
  if (tone === "pos" || positive) colour = "positive";
  else if (tone === "neg") colour = "negative";
  else if (tone === "auto" && typeof amount === "number") {
    colour = amount < 0 ? "negative" : "positive";
  }

  return (
    <div className={highlighted ? "metric-card highlighted" : "metric-card"}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        {icon && (
          <span className={accent ? `metric-icon accent-${accent}` : "metric-icon"}>{icon}</span>
        )}
      </div>
      <div className={`metric-value ${colour}`.trim()}>
        {locked ? <LockedValue /> : value}
      </div>
    </div>
  );
}

export function LockedValue() {
  return <span className="locked-value" title="Restricted — ask an admin for access">••••••</span>;
}

export function StatusBadge({ status }) {
  const cls =
    status === "Active"
      ? "active"
      : status === "Completed"
      ? "completed"
      : status === "Dropped"
      ? "dropped"
      : "registered";

  return <span className={`status-badge ${cls}`}>{status}</span>;
}

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

export function ReportCard({ title, text }) {
  return (
    <div className="report-card">
      <div className="report-icon">▤</div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <button className="edit-button">View</button>
    </div>
  );
}
