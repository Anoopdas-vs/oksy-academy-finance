import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatMoney } from "../lib/format.js";
import { effectiveFeeDue, outstanding } from "../lib/fees.js";

/* ------------------------------- helpers ------------------------------- */

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const inMonth = (dateStr, d) => String(dateStr || "").slice(0, 7) === monthKey(d);
const sumAmt = (rows) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);
const inRange = (dateStr, r) => {
  if (!r) return true;
  const d = String(dateStr || "").slice(0, 10);
  return (!r.start || d >= r.start) && (!r.end || d <= r.end);
};

function pctChange(now, prev) {
  if (!prev) return now ? { text: "new activity", dir: "up" } : null;
  const p = ((now - prev) / Math.abs(prev)) * 100;
  const dir = p > 0.5 ? "up" : p < -0.5 ? "down" : "flat";
  return { text: `${p >= 0 ? "+" : ""}${p.toFixed(1)}% vs previous period`, dir };
}

// The window of equal length immediately before the selected one; or last
// calendar month when no period is selected.
function prevWindow(range) {
  const now = new Date();
  if (!range || !range.start || !range.end) {
    const m = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { start: `${monthKey(m)}-01`, end: `${monthKey(m)}-31` };
  }
  const s = new Date(range.start);
  const e = new Date(range.end);
  const len = e - s;
  const pe = new Date(s.getTime() - 86400000);
  const ps = new Date(pe.getTime() - len);
  return { start: ps.toISOString().slice(0, 10), end: pe.toISOString().slice(0, 10) };
}

const mv = (n) => (n > 0 ? { text: `+${n} this month`, dir: "up" } : { text: "no change", dir: "flat" });
const flipExpenseTone = (d) =>
  d ? { ...d, tone: d.dir === "up" ? "down" : d.dir === "down" ? "up" : "flat" } : d;

const shortK = (n) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${Math.round(n / 1e3)}K`;
  return `${n}`;
};

const STUDENT_TILES = [
  { key: "totalStudents", label: "Total Students", icon: "👥", accent: "blue" },
  { key: "registered", label: "Registered", icon: "📝", accent: "violet" },
  { key: "active", label: "Active", icon: "🎓", accent: "green" },
  { key: "completed", label: "Completed", icon: "🏆", accent: "amber" },
  { key: "dropped", label: "Dropped", icon: "🚪", accent: "red" },
];

/* -------------------------------- view -------------------------------- */

export default function Dashboard(props) {
  const currentRole = props.role || props.profile?.role || "staff";

  if (currentRole === "faculty") {
    return <FacultyDashboard profile={props.profile} onNavigate={props.onNavigate} />;
  }

  if (currentRole === "student") {
    return <StudentDashboard profile={props.profile} onNavigate={props.onNavigate} />;
  }

  if (currentRole === "professional") {
    return <ProfessionalDashboard profile={props.profile} onNavigate={props.onNavigate} />;
  }

  return <ExecutiveDashboard {...props} />;
}

function ExecutiveDashboard({
  totals,
  allStudents = [],
  allCollections = [],
  allExpenses = [],
  periodCollections = [],
  periodExpenses = [],
  range = null,
  periodLabel = "All time",
  fullDashboard = true,
  onNavigate = () => {},
}) {
  const go = (tab) => () => onNavigate(tab);

  const monthly = useMemo(
    () => buildMonthlySeries(periodCollections, periodExpenses),
    [periodCollections, periodExpenses]
  );
  const batchRows = useMemo(
    () => buildBatchSummary(allStudents, allCollections),
    [allStudents, allCollections]
  );
  const batchTotals = useMemo(() => sumBatch(batchRows), [batchRows]);

  const recentCollections = useMemo(
    () => [...periodCollections].sort(byDateDesc).slice(0, 7),
    [periodCollections]
  );
  const recentExpenses = useMemo(
    () => [...periodExpenses].sort(byDateDesc).slice(0, 7),
    [periodExpenses]
  );

  // Student movement this month (from the full roster).
  const studentDeltas = useMemo(() => {
    const now = new Date();
    const lastMonthEnd = `${monthKey(new Date(now.getFullYear(), now.getMonth(), 0))}-31`;
    const totalPrev = allStudents.filter((s) => String(s.enrollment_date || "") <= lastMonthEnd).length;
    const thisMonth = (status) =>
      allStudents.filter((s) => (!status || s.status === status) && inMonth(s.enrollment_date, now)).length;
    return {
      totalStudents: pctChange(allStudents.length, totalPrev),
      registered: mv(thisMonth("Registered")),
      active: mv(thisMonth("Active")),
      completed: mv(thisMonth("Completed")),
      dropped: mv(thisMonth("Dropped")),
    };
  }, [allStudents]);

  // Financial "vs previous period".
  const finDeltas = useMemo(() => {
    const pw = prevWindow(range);
    return {
      revenue: pctChange(totals.totalRevenue, sumAmt(allCollections.filter((c) => inRange(c.date, pw)))),
      expense: pctChange(totals.totalExpense, sumAmt(allExpenses.filter((e) => inRange(e.date, pw)))),
    };
  }, [range, totals.totalRevenue, totals.totalExpense, allCollections, allExpenses]);

  // Fee-collection health — always the all-time position so it reconciles with
  // the Batch Summary total and the Outstanding Student Fees card.
  const expectedFees = totals.expectedFees || 0;
  const collectedFees = totals.collectedFees || 0;
  const outstandingFees = totals.studentReceivable || 0;
  const collectedPct = expectedFees > 0 ? (collectedFees / expectedFees) * 100 : 0;
  const onTrack = collectedPct >= 60;

  return (
    <section className="page dash">
      {/* B. STUDENT OVERVIEW */}
      <SectionCard
        icon="🎓"
        title="Student Overview"
        subtitle="Total student information across all batches"
        pill="All time"
        action={{ label: "View All Students", onClick: go("Enrollment") }}
      >
        <div className="tile-grid five">
          {STUDENT_TILES.map((t) => (
            <StatTile
              key={t.key}
              label={t.label}
              value={totals[t.key]}
              icon={t.icon}
              accent={t.accent}
              delta={studentDeltas[t.key]}
            />
          ))}
        </div>
      </SectionCard>

      {fullDashboard && (
        <>
          {/* C. FINANCIAL OVERVIEW */}
          <SectionCard
            icon="📊"
            title="Financial Overview"
            subtitle="Income, expenses and profitability"
            pill={periodLabel}
          >
            <div className="tile-grid five">
              <StatTile label="Total Revenue" value={formatMoney(totals.totalRevenue)} icon="🪙" accent="green" delta={finDeltas.revenue} />
              <StatTile label="Total Expense" value={formatMoney(totals.totalExpense)} icon="💳" accent="red" delta={flipExpenseTone(finDeltas.expense)} />
              <StatTile
                label="Net P&L"
                value={formatMoney(totals.netProfit)}
                icon="📈"
                accent={totals.netProfit >= 0 ? "green" : "red"}
                valueTone={totals.netProfit >= 0 ? "pos" : "neg"}
                caption="Revenue − Expense − Due to Healthcare"
              />
              <StatTile label="Outstanding Student Fees" value={formatMoney(totals.studentReceivable)} icon="📄" accent="blue" caption="Amount still to be collected" />
              <StatTile
                label="Due to Healthcare"
                value={formatMoney(totals.healthcareLiability)}
                icon="🏛️"
                accent="violet"
                caption="Expenses paid by Healthcare on behalf of Academy"
                onClick={go("Banking")}
              />
            </div>
          </SectionCard>

          <div className="dash-row two-40-60">
            {/* D. CASH & BANK POSITION */}
            <SectionCard icon="🏦" title="Cash & Bank Position" subtitle="Current balance in all accounts" pill="All time">
              <div className="tile-grid two">
                <StatTile
                  label="Cash Balance"
                  value={formatMoney(totals.cashBalance)}
                  icon={totals.cashBalance < 0 ? "⚠️" : "💵"}
                  accent={totals.cashBalance < 0 ? "red" : "green"}
                  valueTone={totals.cashBalance < 0 ? "neg" : "pos"}
                  caption={totals.cashBalance < 0 ? "Requires reconciliation" : "Cash in hand"}
                />
                <StatTile label="HDFC Bank" value={formatMoney(totals.hdfcBalance)} icon="🏦" accent="green" valueTone={totals.hdfcBalance < 0 ? "neg" : "pos"} caption="Book balance" />
                <StatTile label="ICICI Bank" value={formatMoney(totals.iciciBalance)} icon="🏦" accent="green" valueTone={totals.iciciBalance < 0 ? "neg" : "pos"} caption="Book balance" />
                <StatTile label="Total Balance" value={formatMoney(totals.totalBalance)} plain valueTone={totals.totalBalance < 0 ? "neg" : "pos"} caption="Cash + HDFC + ICICI" />
              </div>
            </SectionCard>

            {/* E. FEE COLLECTION HEALTH */}
            <SectionCard icon="🎯" title="Fee Collection Health" subtitle="Expected vs collected student fees" pill="All time">
              <div className="health">
                <div className="health-donut">
                  <ResponsiveContainer width="100%" height={168}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Collected", value: Math.max(0, collectedFees) },
                          { name: "Outstanding", value: Math.max(0, outstandingFees) },
                        ]}
                        dataKey="value"
                        innerRadius={54}
                        outerRadius={78}
                        startAngle={90}
                        endAngle={-270}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        <Cell fill="var(--accent-blue)" />
                        <Cell fill="var(--track)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="health-donut-label">
                    <strong>{collectedPct.toFixed(1)}%</strong>
                    <span>Collected</span>
                  </div>
                </div>
                <ul className="health-figs">
                  <li><b className="pos">{formatMoney(collectedFees)}</b><span>Collected so far</span></li>
                  <li><b>{formatMoney(expectedFees)}</b><span>Expected total fees</span></li>
                  <li><b className="neg">{formatMoney(outstandingFees)}</b><span>Outstanding</span></li>
                </ul>
                <div className={`health-status ${onTrack ? "ok" : "warn"}`}>
                  <strong>{onTrack ? "Collection is on track" : "Collections need attention"}</strong>
                  <span>{collectedPct.toFixed(1)}% of expected fees have been collected.</span>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="dash-row two-45-55">
            {/* F1. MONTHLY INCOME VS EXPENSE */}
            <SectionCard icon="📊" title="Monthly Income vs Expense" subtitle="Monthly trend of income and expenses" pill={periodLabel}>
              <div className="legend-custom">
                <span><i className="dot" style={{ background: "var(--positive)" }} />Income</span>
                <span><i className="dot" style={{ background: "var(--danger)" }} />Expense</span>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={monthly} barGap={4} barCategoryGap="26%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={10} interval={0} />
                  <YAxis tickLine={false} axisLine={false} fontSize={10} tickFormatter={shortK} width={44} />
                  <Tooltip
                    formatter={(v, n) => [formatMoney(v), n]}
                    labelFormatter={(l, p) => {
                      const pl = p && p[0] && p[0].payload && p[0].payload.pnl;
                      return pl === undefined ? l : `${l} · Net P&L ${formatMoney(pl)}`;
                    }}
                  />
                  <Bar dataKey="revenue" name="Income" fill="var(--positive)" radius={[3, 3, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="expense" name="Expense" fill="var(--danger)" radius={[3, 3, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            {/* F2. BATCH SUMMARY */}
            <SectionCard
              icon="👥"
              title="Batch Summary"
              subtitle="Fee performance of each batch"
              pill="All time"
              action={{ label: "View All Batches", onClick: go("Admin") }}
            >
              <div className="table-scroll">
                <table className="tight">
                  <thead>
                    <tr>
                      <th>Batch</th><th>Students</th><th>Active</th><th>Completed</th><th>Dropped</th>
                      <th className="ra">Expected Fees</th><th className="ra">Collected</th><th className="ra">Outstanding</th><th>% Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchRows.length === 0 && <tr><td colSpan={9} className="table-empty">No students enrolled yet.</td></tr>}
                    {batchRows.map((b) => (
                      <tr key={b.batch}>
                        <td><strong>{b.batch}</strong></td>
                        <td>{b.students}</td>
                        <td>{b.active}</td>
                        <td>{b.completed}</td>
                        <td>{b.dropped}</td>
                        <td className="ra">{formatMoney(b.expected)}</td>
                        <td className="ra">{formatMoney(b.collected)}</td>
                        <td className="ra">{formatMoney(b.outstanding)}</td>
                        <td><ProgressPct value={b.collected} total={b.expected} /></td>
                      </tr>
                    ))}
                  </tbody>
                  {batchRows.length > 0 && (
                    <tfoot>
                      <tr>
                        <td><strong>Total</strong></td>
                        <td><strong>{batchTotals.students}</strong></td>
                        <td>{batchTotals.active}</td>
                        <td>{batchTotals.completed}</td>
                        <td>{batchTotals.dropped}</td>
                        <td className="ra"><strong>{formatMoney(batchTotals.expected)}</strong></td>
                        <td className="ra"><strong>{formatMoney(batchTotals.collected)}</strong></td>
                        <td className="ra"><strong>{formatMoney(batchTotals.outstanding)}</strong></td>
                        <td><ProgressPct value={batchTotals.collected} total={batchTotals.expected} /></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </SectionCard>
          </div>
        </>
      )}

      {/* G. RECENT ACTIVITY */}
      <div className="dash-row two-50-50">
        <SectionCard
          icon="₹"
          accent="green"
          title="Recent Fee Collections"
          subtitle="Latest student payments"
          action={{ label: "View All", onClick: go("Fee Collection") }}
        >
          <table className="tight">
            <thead><tr><th>Date</th><th>Student</th><th>Batch</th><th className="ra">Amount</th><th>Mode</th></tr></thead>
            <tbody>
              {recentCollections.length === 0 && <tr><td colSpan={5} className="table-empty">No payments in this period.</td></tr>}
              {recentCollections.map((c) => (
                <tr key={c.id}>
                  <td>{c.date}</td>
                  <td><strong>{c.student_name}</strong></td>
                  <td>{studentBatch(allStudents, c.student_id)}</td>
                  <td className="ra pos">{formatMoney(c.amount)}</td>
                  <td><AccountTag account={c.account} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard
          icon="🧾"
          accent="violet"
          title="Recent Expenses"
          subtitle="Latest academy expenses"
          action={{ label: "View All", onClick: go("Expenses") }}
        >
          <table className="tight">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="ra">Amount</th><th>Paid By</th></tr></thead>
            <tbody>
              {recentExpenses.length === 0 && <tr><td colSpan={5} className="table-empty">No expenses in this period.</td></tr>}
              {recentExpenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td><strong>{e.category}</strong></td>
                  <td className="desc-cell">{e.description}</td>
                  <td className="ra neg">{formatMoney(e.amount)}</td>
                  <td><AccountTag account={e.account} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </section>
  );
}

/* --------------------------- small components --------------------------- */

function SectionCard({ icon, accent, title, subtitle, action, pill, children }) {
  return (
    <div className="section-card">
      <div className="section-card-head">
        <div className="sch-title">
          <span className={accent ? `sch-icon ic-${accent}` : "sch-icon"}>{icon}</span>
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        {pill && <span className="sch-pill">{pill}</span>}
        {action && (
          <button className="sch-action" onClick={action.onClick}>
            {action.label} <span aria-hidden>→</span>
          </button>
        )}
      </div>
      <div className="section-card-body">{children}</div>
    </div>
  );
}

function StatTile({ label, value, icon, accent, delta, caption, plain, valueTone, onClick }) {
  const Cmp = onClick ? "button" : "div";
  return (
    <Cmp
      className={`stat-tile ${plain ? "plain" : `accent-${accent}`}${onClick ? " clickable" : ""}`}
      onClick={onClick}
    >
      <div className="stat-tile-top">
        <span className="stat-label">{label}</span>
        {icon && <span className={`stat-icon ${plain ? "" : `ic-${accent}`}`}>{icon}</span>}
      </div>
      <div className={valueTone ? `stat-value ${valueTone}` : "stat-value"}>{value}</div>
      {delta && (
        <div className={`stat-delta ${delta.tone || delta.dir}`}>
          <span className="arr">{delta.dir === "up" ? "↑" : delta.dir === "down" ? "↓" : "—"}</span>
          {delta.text}
        </div>
      )}
      {!delta && caption && <div className="stat-caption">{caption}</div>}
    </Cmp>
  );
}

function ProgressPct({ value, total }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const p = Math.max(0, Math.min(100, pct));
  const tone = p >= 60 ? "ok" : p >= 25 ? "mid" : "low";
  return (
    <div className="progress-pct">
      <div className={`bar ${tone}`}><i style={{ width: `${p}%` }} /></div>
      <span>{p >= 99.95 ? "100" : p.toFixed(1)}%</span>
    </div>
  );
}

function AccountTag({ account }) {
  if (!account) return <span className="mini-tag">—</span>;
  return <span className={account === "Healthcare" ? "mini-tag purple" : "mini-tag"}>{account}</span>;
}

/* ------------------------------- data ------------------------------- */

const byDateDesc = (a, b) => (String(a.date) < String(b.date) ? 1 : String(a.date) > String(b.date) ? -1 : (b.id || 0) - (a.id || 0));

function studentBatch(students, id) {
  const s = students.find((x) => x.id === id);
  return (s && s.batch) || "—";
}

function buildBatchSummary(students, collections) {
  const collectedByStudent = collections.reduce((m, c) => {
    m[c.student_id] = (m[c.student_id] || 0) + Number(c.amount || 0);
    return m;
  }, {});

  const byBatch = new Map();
  students.forEach((s) => {
    const key = (s.batch && String(s.batch).trim()) || "Unassigned";
    if (!byBatch.has(key)) {
      byBatch.set(key, { batch: key, students: 0, active: 0, completed: 0, dropped: 0, expected: 0, collected: 0, outstanding: 0 });
    }
    const b = byBatch.get(key);
    const paid = collectedByStudent[s.id] || 0;
    b.students += 1;
    if (s.status === "Active") b.active += 1;
    if (s.status === "Completed") b.completed += 1;
    if (s.status === "Dropped") b.dropped += 1;
    b.expected += effectiveFeeDue(s, paid);
    b.collected += paid;
    b.outstanding += outstanding(s, paid);
  });

  return Array.from(byBatch.values()).sort((a, b) => a.batch.localeCompare(b.batch));
}

function sumBatch(rows) {
  return rows.reduce(
    (t, b) => ({
      students: t.students + b.students,
      active: t.active + b.active,
      completed: t.completed + b.completed,
      dropped: t.dropped + b.dropped,
      expected: t.expected + b.expected,
      collected: t.collected + b.collected,
      outstanding: t.outstanding + b.outstanding,
    }),
    { students: 0, active: 0, completed: 0, dropped: 0, expected: 0, collected: 0, outstanding: 0 }
  );
}

function buildMonthlySeries(collections, expenses) {
  const buckets = new Map();
  const add = (dateStr, field, amount) => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short" });
    if (!buckets.has(key)) buckets.set(key, { key, month: label, revenue: 0, expense: 0 });
    buckets.get(key)[field] += Number(amount || 0);
  };
  collections.forEach((c) => add(c.date, "revenue", c.amount));
  expenses.forEach((e) => add(e.date, "expense", e.amount));

  const rows = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-9);
  const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  return rows.map((r) => ({
    ...r,
    month: r.key === nowKey ? `${r.month} (MTD)` : r.month,
    pnl: r.revenue - r.expense,
  }));
}

/* --------------------- Faculty Academic Workspace --------------------- */

function FacultyDashboard({ profile, onNavigate }) {
  const go = (tab) => () => onNavigate(tab);
  const facultyName = profile?.full_name || "Faculty Member";

  const todayClasses = [
    {
      id: "cls_1",
      time: "09:30 AM - 11:00 AM",
      subject: "Full-Stack Web Development",
      batch: "FSW-2026-A",
      room: "Virtual Room 101",
    },
    {
      id: "cls_2",
      time: "02:00 PM - 03:30 PM",
      subject: "Database Systems & Supabase",
      batch: "FSW-2026-A",
      room: "Virtual Room 102",
    },
  ];

  const syllabusProgress = [
    {
      course: "Full-Stack Web Development",
      progress: 80,
      currentTopic: "Vite Bundle Splitting & State Architecture",
      nextTopic: "Capstones & Full-Stack Deployment",
      completedModules: 8,
      totalModules: 10,
    },
    {
      course: "Database Architecture & SQL",
      progress: 65,
      currentTopic: "Row Level Security (RLS) & Triggers",
      nextTopic: "Advanced Indexing & Views",
      completedModules: 6,
      totalModules: 10,
    },
    {
      course: "Financial Accounting & Business Controls",
      progress: 85,
      currentTopic: "Inter-company Settlement & Bank Reconciliation",
      nextTopic: "Financial Reporting Compliance",
      completedModules: 9,
      totalModules: 11,
    },
  ];

  const pendingSubmissions = [
    {
      id: "sub_1",
      student: "Rahul Menon",
      project: "React Full-Stack Financial Dashboard",
      batch: "FSW-2026-A",
      date: "2026-09-08",
    },
    {
      id: "sub_2",
      student: "Sneha George",
      project: "React Full-Stack Financial Dashboard",
      batch: "FSW-2026-A",
      date: "2026-09-09",
    },
    {
      id: "sub_3",
      student: "Devika S.",
      project: "E-Commerce Database Schema Design",
      batch: "FSW-2026-A",
      date: "2026-09-09",
    },
  ];

  const facultyReviews = [
    {
      student: "Devika S.",
      rating: 5,
      comment: "The practical coding sessions and live debugging exercises made complex React concepts very clear.",
      date: "2026-09-07",
    },
    {
      student: "Rahul Menon",
      rating: 4.8,
      comment: "Great hands-on coverage of database schemas, RLS policies, and real-time triggers.",
      date: "2026-09-05",
    },
  ];

  return (
    <div className="dashboard-content">
      <div
        className="table-card"
        style={{
          padding: "1.5rem",
          marginBottom: "1.5rem",
          background: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
          color: "#ffffff",
          borderRadius: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div
              style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.18)",
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                fontWeight: "600",
                marginBottom: "0.5rem",
              }}
            >
              👨‍🏫 Faculty Academic Workspace
            </div>
            <h2 style={{ margin: "0 0 0.25rem 0", fontSize: "1.6rem", color: "#ffffff" }}>
              Welcome, {facultyName}
            </h2>
            <p style={{ margin: 0, opacity: 0.85, fontSize: "0.95rem" }}>
              Here is your teaching schedule, syllabus progress, and student project submissions for today.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              className="button"
              style={{ background: "#ffffff", color: "#4338ca", fontWeight: "600" }}
              onClick={go("Live Class")}
            >
              🎥 Start Live Classroom
            </button>
            <button
              className="button"
              style={{ background: "rgba(255,255,255,0.2)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.4)" }}
              onClick={go("Assignments")}
            >
              📋 Review Submissions
            </button>
          </div>
        </div>
      </div>

      <div className="dash-row four">
        <StatTile label="Today's Classes" value={todayClasses.length} icon="📅" accent="blue" caption="Live interactive lectures" />
        <StatTile label="Active Batches" value="2" icon="👥" accent="violet" caption="FSW-2026-A, BCOM-2026" />
        <StatTile label="Submissions to Grade" value={pendingSubmissions.length} icon="📝" accent="amber" valueTone="warn" caption="Projects awaiting review" />
        <StatTile label="Faculty Rating" value="4.9 ★" icon="⭐" accent="green" valueTone="pos" caption="Based on verified student reviews" />
      </div>

      <div className="dash-row two-50-50" style={{ marginTop: "1rem" }}>
        <SectionCard
          icon="📅"
          accent="blue"
          title="Today's Teaching Schedule"
          subtitle="Lecture timings, batches and 1-click room launcher"
          action={{ label: "View Full Timetable", onClick: go("Timetable") }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {todayClasses.map((cls) => (
              <div
                key={cls.id}
                style={{
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "10px",
                  padding: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--surface, #ffffff)",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.15rem 0.5rem",
                        background: "var(--accent-light, #eff6ff)",
                        color: "var(--accent, #2563eb)",
                        borderRadius: "4px",
                        fontWeight: "600",
                      }}
                    >
                      {cls.time}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                      {cls.batch} · {cls.room}
                    </span>
                  </div>
                  <strong style={{ fontSize: "1rem" }}>{cls.subject}</strong>
                </div>
                <button
                  className="button primary small"
                  onClick={go("Live Class")}
                >
                  🎥 Launch Room
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon="📋"
          accent="amber"
          title="Student Submissions to Grade"
          subtitle="Recent practical deliverables submitted by students"
          action={{ label: "View All Projects", onClick: go("Assignments") }}
        >
          <table className="tight">
            <thead>
              <tr><th>Student</th><th>Project Brief</th><th>Submitted</th><th></th></tr>
            </thead>
            <tbody>
              {pendingSubmissions.map((sub) => (
                <tr key={sub.id}>
                  <td><strong>{sub.student}</strong><br /><small style={{ color: "var(--text-muted)" }}>{sub.batch}</small></td>
                  <td>{sub.project}</td>
                  <td>{sub.date}</td>
                  <td className="ra">
                    <button className="button secondary small" onClick={go("Assignments")}>
                      ✍ Grade
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>

      <div className="dash-row two-50-50" style={{ marginTop: "1rem" }}>
        <SectionCard
          icon="📚"
          accent="green"
          title="Course Details & Syllabus Progress"
          subtitle="Curriculum completion tracker across assigned subjects"
          action={{ label: "Manage Batches", onClick: go("Admin") }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {syllabusProgress.map((syl, i) => (
              <div key={i} style={{ borderBottom: i < syllabusProgress.length - 1 ? "1px solid var(--border, #e2e8f0)" : "none", paddingBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.3rem" }}>
                  <strong>{syl.course}</strong>
                  <span style={{ fontSize: "0.85rem", fontWeight: "600", color: syl.progress >= 80 ? "#10b981" : "#2563eb" }}>
                    {syl.progress}% ({syl.completedModules}/{syl.totalModules} modules)
                  </span>
                </div>
                <div style={{ height: "6px", background: "var(--border, #e2e8f0)", borderRadius: "3px", overflow: "hidden", marginBottom: "0.4rem" }}>
                  <div style={{ height: "100%", width: `${syl.progress}%`, background: syl.progress >= 80 ? "#10b981" : "var(--accent, #2563eb)", borderRadius: "3px" }} />
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                  Current: <em>{syl.currentTopic}</em> · Next: <em>{syl.nextTopic}</em>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon="⭐"
          title="Recent Student Feedback"
          subtitle="360° student course ratings and suggestions"
          action={{ label: "All Reviews", onClick: go("Reviews") }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {facultyReviews.map((rev, i) => (
              <div key={i} style={{ padding: "0.75rem", background: "var(--accent-light, #f8fafc)", borderRadius: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <strong>{rev.student}</strong>
                  <span style={{ color: "#d97706", fontWeight: "600" }}>{"★".repeat(Math.round(rev.rating))} {rev.rating}</span>
                </div>
                <p style={{ margin: "0.25rem 0", fontSize: "0.85rem", color: "var(--text-muted, #475569)" }}>
                  "{rev.comment}"
                </p>
                <small style={{ fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)" }}>{rev.date}</small>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ---------------------- Student Learning Portal ---------------------- */

function StudentDashboard({ profile, onNavigate }) {
  const go = (tab) => () => onNavigate(tab);
  const studentName = profile?.full_name || "Student";

  const todayClasses = [
    {
      id: "cls_1",
      time: "09:30 AM - 11:00 AM",
      subject: "Full-Stack Web Development",
      faculty: "Prof. Arvind Kumar",
      room: "Virtual Room 101",
    },
    {
      id: "cls_2",
      time: "02:00 PM - 03:30 PM",
      subject: "Database Systems & Supabase",
      faculty: "Dr. Meera Nair",
      room: "Virtual Room 102",
    },
  ];

  const studentCourses = [
    {
      title: "Full-Stack Web Development (FSW)",
      progress: 78,
      completedModules: 7,
      totalModules: 9,
      currentTopic: "Vite Bundle Splitting & Code Optimization",
    },
    {
      title: "Relational Database Design & Supabase",
      progress: 65,
      completedModules: 5,
      totalModules: 8,
      currentTopic: "Row Level Security Policies & Auth Integration",
    },
  ];

  const myAssignments = [
    {
      title: "React Full-Stack Financial Dashboard",
      due: "2026-09-22",
      status: "Graded",
      marks: "92 / 100",
      feedback: "Excellent architecture and clean code separation!",
    },
    {
      title: "E-Commerce Database Schema Design",
      due: "2026-09-18",
      status: "Pending",
      marks: "—",
      feedback: "Submit normalization schema and foreign key constraints.",
    },
  ];

  const myExams = [
    {
      title: "Full-Stack Web & React Fundamentals",
      score: "75%",
      passed: true,
      status: "Completed",
    },
    {
      title: "Financial Accounting & Ratio Analysis",
      score: "Available",
      passed: null,
      status: "Available to Take",
    },
  ];

  return (
    <div className="dashboard-content">
      <div
        className="table-card"
        style={{
          padding: "1.5rem",
          marginBottom: "1.5rem",
          background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
          color: "#ffffff",
          borderRadius: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div
              style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.2)",
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                fontWeight: "600",
                marginBottom: "0.5rem",
              }}
            >
              🎓 Student Learning Portal
            </div>
            <h2 style={{ margin: "0 0 0.25rem 0", fontSize: "1.6rem", color: "#ffffff" }}>
              Welcome, {studentName}
            </h2>
            <p style={{ margin: 0, opacity: 0.9, fontSize: "0.95rem" }}>
              Enrolled Batch: <strong>FSW-2026-A</strong> · Track your classes, practical coursework, and quiz evaluations.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              className="button"
              style={{ background: "#ffffff", color: "#065f46", fontWeight: "600" }}
              onClick={go("Live Class")}
            >
              🎥 Join Today's Live Class
            </button>
            <button
              className="button"
              style={{ background: "rgba(255,255,255,0.2)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.4)" }}
              onClick={go("Exams")}
            >
              📝 Take Exam
            </button>
          </div>
        </div>
      </div>

      <div className="dash-row four">
        <StatTile label="Today's Classes" value={todayClasses.length} icon="🎥" accent="blue" caption="Live WebRTC lectures scheduled" />
        <StatTile label="Active Assignments" value="1 Pending" icon="📋" accent="amber" valueTone="warn" caption="Due in 3 days" />
        <StatTile label="Quiz Average" value="75%" icon="🏆" accent="green" valueTone="pos" caption="Passed Fundamentals assessment" />
        <StatTile label="Curriculum Progress" value="78%" icon="📈" accent="violet" caption="7 of 9 modules completed" />
      </div>

      <div className="dash-row two-50-50" style={{ marginTop: "1rem" }}>
        <SectionCard
          icon="📅"
          accent="blue"
          title="Today's Class Timetable"
          subtitle="Join live lectures with your instructor"
          action={{ label: "Full Schedule", onClick: go("Timetable") }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {todayClasses.map((cls) => (
              <div
                key={cls.id}
                style={{
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "10px",
                  padding: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--surface, #ffffff)",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.15rem 0.5rem",
                        background: "var(--accent-light, #eff6ff)",
                        color: "var(--accent, #2563eb)",
                        borderRadius: "4px",
                        fontWeight: "600",
                      }}
                    >
                      {cls.time}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                      {cls.room}
                    </span>
                  </div>
                  <strong style={{ fontSize: "1rem" }}>{cls.subject}</strong>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)", marginTop: "0.2rem" }}>
                    👨‍🏫 {cls.faculty}
                  </div>
                </div>
                <button
                  className="button primary small"
                  onClick={go("Live Class")}
                >
                  🎥 Join Class
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon="📋"
          accent="amber"
          title="My Projects & Coursework"
          subtitle="Deliverables, submission status, and faculty marks"
          action={{ label: "View All", onClick: go("Assignments") }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {myAssignments.map((asg, idx) => (
              <div key={idx} style={{ padding: "0.85rem", border: "1px solid var(--border, #e2e8f0)", borderRadius: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                  <strong>{asg.title}</strong>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "4px",
                      fontWeight: "600",
                      background: asg.status === "Graded" ? "#d1fae5" : "#fef3c7",
                      color: asg.status === "Graded" ? "#065f46" : "#92400e",
                    }}
                  >
                    {asg.status === "Graded" ? `Graded: ${asg.marks}` : `Due: ${asg.due}`}
                  </span>
                </div>
                <p style={{ margin: "0.25rem 0", fontSize: "0.85rem", color: "var(--text-muted, #64748b)" }}>
                  {asg.feedback}
                </p>
                {asg.status !== "Graded" && (
                  <button className="button primary small" style={{ marginTop: "0.4rem" }} onClick={go("Assignments")}>
                    📤 Submit Deliverable
                  </button>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="dash-row two-50-50" style={{ marginTop: "1rem" }}>
        <SectionCard
          icon="📚"
          accent="violet"
          title="My Enrolled Courses & Syllabus"
          subtitle="Curriculum progress and ongoing learning milestones"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {studentCourses.map((c, idx) => (
              <div key={idx} style={{ borderBottom: idx < studentCourses.length - 1 ? "1px solid var(--border, #e2e8f0)" : "none", paddingBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                  <strong>{c.title}</strong>
                  <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#2563eb" }}>
                    {c.progress}% ({c.completedModules}/{c.totalModules} modules)
                  </span>
                </div>
                <div style={{ height: "6px", background: "var(--border, #e2e8f0)", borderRadius: "3px", overflow: "hidden", marginBottom: "0.4rem" }}>
                  <div style={{ height: "100%", width: `${c.progress}%`, background: "var(--accent, #2563eb)", borderRadius: "3px" }} />
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)" }}>
                  Current Lesson: <em>{c.currentTopic}</em>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          icon="📝"
          title="Examinations & Quizzes"
          subtitle="Test your comprehension and view assessment scores"
          action={{ label: "All Quizzes", onClick: go("Exams") }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {myExams.map((ex, idx) => (
              <div key={idx} style={{ padding: "0.85rem", background: "var(--accent-light, #f8fafc)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{ex.title}</strong>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)", marginTop: "0.2rem" }}>
                    Status: {ex.status}
                  </div>
                </div>
                {ex.passed !== null ? (
                  <span style={{ fontWeight: "700", color: "#10b981", fontSize: "0.95rem" }}>
                    {ex.score} (Passed)
                  </span>
                ) : (
                  <button className="button primary small" onClick={go("Exams")}>
                    Start Exam
                  </button>
                )}
              </div>
            ))}
            <div style={{ marginTop: "0.5rem", padding: "0.75rem", border: "1px dashed var(--border, #cbd5e1)", borderRadius: "8px", textAlign: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)" }}>
                Have feedback for your instructor?
              </span>{" "}
              <button className="button secondary small" style={{ marginLeft: "0.5rem" }} onClick={go("Reviews")}>
                ⭐ Submit Faculty Review
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ------------------- Professional Learning Portal ------------------- */

function ProfessionalDashboard({ profile, onNavigate }) {
  const go = (tab) => () => onNavigate(tab);
  const name = profile?.full_name || "Professional";

  return (
    <div className="dashboard-content">
      <div
        className="table-card"
        style={{
          padding: "1.5rem",
          marginBottom: "1.5rem",
          background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
          color: "#ffffff",
          borderRadius: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div
              style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.2)",
                padding: "0.25rem 0.75rem",
                borderRadius: "9999px",
                fontSize: "0.8rem",
                fontWeight: "600",
                marginBottom: "0.5rem",
              }}
            >
              💼 Professional & Corporate Learning Pulse
            </div>
            <h2 style={{ margin: "0 0 0.25rem 0", fontSize: "1.6rem", color: "#ffffff" }}>
              Welcome, {name}
            </h2>
            <p style={{ margin: 0, opacity: 0.85, fontSize: "0.95rem" }}>
              Track executive workshops, industry project assessments, and scheduled mentoring sessions.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button
              className="button"
              style={{ background: "#ffffff", color: "#1e293b", fontWeight: "600" }}
              onClick={go("Live Class")}
            >
              🎥 Join Mentoring Room
            </button>
            <button
              className="button"
              style={{ background: "rgba(255,255,255,0.2)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.4)" }}
              onClick={go("Assignments")}
            >
              📋 Project Submissions
            </button>
          </div>
        </div>
      </div>

      <div className="dash-row four">
        <StatTile label="Mentoring Sessions" value="2" icon="🎥" accent="blue" caption="Upcoming this week" />
        <StatTile label="Industry Projects" value="1 Active" icon="📋" accent="violet" caption="Double-Entry Balancing" />
        <StatTile label="Certification Status" value="In Progress" icon="🏆" accent="amber" caption="85% criteria fulfilled" />
        <StatTile label="Peer Feedback" value="5.0 ★" icon="⭐" accent="green" valueTone="pos" caption="Industry mentor ratings" />
      </div>

      <div className="dash-row two-50-50" style={{ marginTop: "1rem" }}>
        <SectionCard
          icon="📅"
          accent="blue"
          title="Scheduled Executive Sessions"
          subtitle="Virtual mentorship & workshop sessions"
          action={{ label: "Timetable", onClick: go("Timetable") }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ padding: "0.85rem", border: "1px solid var(--border, #e2e8f0)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem", background: "var(--accent-light, #eff6ff)", color: "var(--accent, #2563eb)", borderRadius: "4px", fontWeight: "600" }}>
                  Wednesday · 02:00 PM - 03:30 PM
                </span>
                <div style={{ fontWeight: "600", marginTop: "0.3rem" }}>Financial Accounting & Business Controls</div>
                <small style={{ color: "var(--text-muted, #64748b)" }}>Led by CMA Suresh Pillai</small>
              </div>
              <button className="button primary small" onClick={go("Live Class")}>
                🎥 Join
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon="📋"
          accent="amber"
          title="Applied Case Studies & Projects"
          subtitle="Practical capstone submissions"
          action={{ label: "Assignments", onClick: go("Assignments") }}
        >
          <div style={{ padding: "0.85rem", border: "1px solid var(--border, #e2e8f0)", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
              <strong>Double-Entry Ledger Balancing Case Study</strong>
              <span style={{ fontSize: "0.8rem", color: "#d97706", fontWeight: "600" }}>Due: 2026-09-15</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #64748b)", margin: "0.25rem 0" }}>
              Reconcile bank statements against cash ledger entries and detail all reconciling items.
            </p>
            <button className="button primary small" style={{ marginTop: "0.4rem" }} onClick={go("Assignments")}>
              📤 Submit Solution
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
