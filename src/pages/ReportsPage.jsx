import React, { useMemo, useState } from "react";
import { formatMoney } from "../lib/format.js";
import { SearchBox } from "../components/SearchPager.jsx";
import { REPORTS, exportReportToXlsx } from "../lib/reports.js";
import { STAFF_REPORT_IDS } from "../lib/access.js";

export default function ReportsPage({ data, range, periodLabel = "All time", allReports = true }) {
  const [openId, setOpenId] = useState(null);
  const list = allReports ? REPORTS : REPORTS.filter((r) => STAFF_REPORT_IDS.includes(r.id));
  const report = list.find((r) => r.id === openId) || null;

  if (!report) {
    return (
      <section className="page">
        <p className="page-lead">Preview any report, filter it, then download Excel or print / save as PDF · {periodLabel}</p>
        <div className="report-grid">
          {list.map((r) => (
            <button key={r.id} className="report-card as-button" onClick={() => setOpenId(r.id)}>
              <div className="report-icon">▤</div>
              <div>
                <h3>{r.name}</h3>
                <p>{r.description}</p>
              </div>
              <span className="edit-button">Open</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <ReportView
      report={report}
      data={data}
      range={range}
      periodLabel={periodLabel}
      onBack={() => setOpenId(null)}
    />
  );
}

function ReportView({ report, data, range, periodLabel, onBack }) {
  const filterDefs = useMemo(
    () =>
      (report.filters || []).map((f) => ({
        ...f,
        options: f.optionsFrom ? f.optionsFrom(data) : f.options,
      })),
    [report, data]
  );
  const [filters, setFilters] = useState(
    Object.fromEntries(filterDefs.map((f) => [f.key, f.options[0]]))
  );
  const [query, setQuery] = useState("");

  const result = useMemo(
    () => report.build(data, filters, range),
    [report, data, filters, range]
  );

  const rows = useMemo(() => {
    if (!query.trim()) return result.rows;
    const q = query.toLowerCase();
    return result.rows.filter((r) =>
      result.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))
    );
  }, [result, query]);

  const fileName = `${report.name.replace(/[^\w]+/g, "_")}_${periodLabel.replace(/[^\w]+/g, "_")}.xlsx`;

  return (
    <section className="page">
      <div className="page-actions no-print">
        <button className="button ghost small" onClick={onBack}>← All reports</button>
        <strong className="report-title">{report.name}</strong>
        <span className="page-lead-inline">{report.description} · {periodLabel}</span>
        <span className="spacer" />
        {report.downloadable && (
          <button
            className="button secondary"
            onClick={() => exportReportToXlsx(fileName, result.columns, rows)}
          >
            Download Excel
          </button>
        )}
        <button className="button primary" onClick={() => window.print()}>Print / Save PDF</button>
      </div>

      <div className="report-controls no-print">
        {filterDefs.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <select
                value={filters[f.key] ?? f.options[0]}
                onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
              >
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        <div className="report-search">
          <SearchBox value={query} onChange={setQuery} placeholder="Search this report..." />
        </div>
      </div>

      <div className="table-card print-area">
        <div className="report-print-head">
          <h3>OKSY ACADEMY LLP — {report.name}</h3>
          <p>Period: {periodLabel} · Generated {new Date().toLocaleDateString("en-IN")}</p>
          {result.summary && <p className="report-summary">{result.summary}</p>}
        </div>
        <table>
          <thead>
            <tr>{result.columns.map((c) => <th key={c.key} className={c.money ? "ra" : ""}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={result.columns.length} className="table-empty">Nothing to show for this selection.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                {result.columns.map((c) => (
                  <td key={c.key} className={c.money ? "ra" : ""}>
                    {r[c.key] === null || r[c.key] === undefined
                      ? ""
                      : c.money
                      ? formatMoney(r[c.key])
                      : String(r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
