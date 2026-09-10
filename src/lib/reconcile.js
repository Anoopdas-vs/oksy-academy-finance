// Bank reconciliation helpers: book-balance math and auto-matching uploaded
// statement lines against the app's own transactions.

import { formatMoney } from "./format.js";

const amt = (v) => Number(v || 0);
const onOrBefore = (dateStr, cutoff) => !cutoff || String(dateStr).slice(0, 10) <= cutoff;

// Signed movement each transaction applies to `account`'s balance.
export function accountLedger(account, { collections = [], expenses = [], transfers = [] }) {
  const entries = [];
  collections.forEach((c) => {
    if (c.account === account) entries.push({ kind: "collection", id: c.id, date: c.date, delta: amt(c.amount) });
  });
  expenses.forEach((e) => {
    if (e.account === account) entries.push({ kind: "expense", id: e.id, date: e.date, delta: -amt(e.amount) });
  });
  transfers.forEach((t) => {
    if (t.to_account === account) entries.push({ kind: "transfer", id: t.id, date: t.date, delta: amt(t.amount) });
    if (t.from_account === account) entries.push({ kind: "transfer", id: t.id, date: t.date, delta: -amt(t.amount) });
  });
  return entries;
}

export function bookBalanceAsOf(account, cutoff, data) {
  return accountLedger(account, data)
    .filter((e) => onOrBefore(e.date, cutoff))
    .reduce((sum, e) => sum + e.delta, 0);
}

// Greedy auto-match. Returns an array parallel to `lines`, each element:
//   { status: 'matched'|'unmatched', match_kind?, match_id? }
// A line matches an app entry of the same direction, equal amount (to the
// rupee), and a date within `dayWindow` days; each app entry is used once.
export function autoMatch(lines, account, data, dayWindow = 4) {
  const ledger = accountLedger(account, data);
  const used = new Set();
  const key = (e) => `${e.kind}:${e.id}`;
  const dayMs = 86400000;

  return lines.map((ln) => {
    const wantDeposit = amt(ln.deposit) > 0;
    const target = wantDeposit ? amt(ln.deposit) : amt(ln.withdrawal);
    const lnTime = new Date(ln.date).getTime();

    const hit = ledger.find((e) => {
      if (used.has(key(e))) return false;
      const isDeposit = e.delta > 0;
      if (isDeposit !== wantDeposit) return false;
      if (Math.round(Math.abs(e.delta)) !== Math.round(target)) return false;
      const dd = Math.abs(new Date(e.date).getTime() - lnTime) / dayMs;
      return dd <= dayWindow;
    });

    if (hit) {
      used.add(key(hit));
      return { status: "matched", match_kind: hit.kind, match_id: hit.id };
    }
    return { status: "unmatched" };
  });
}

// Human label for a match kind. "collection" reads as "fee collection".
export const MATCH_KIND_LABEL = {
  collection: "fee collection",
  expense: "expense",
  transfer: "transfer",
};

export function matchKindLabel(kind) {
  return MATCH_KIND_LABEL[kind] || kind || "record";
}

// Resolve a matched/classified statement line to the underlying app record
// and return the fields to show when the user hovers its status tag — so an
// auto-match can be visually confirmed (or spotted as wrong and unmatched).
//   -> { title, rows: [{ k, v }] }  |  null
export function matchedRecordDetail(line, data = {}, students = []) {
  const kind = line?.match_kind;
  const id = line?.match_id;
  if (!kind || id == null) return null;

  const notFound = (title) => ({
    title,
    rows: [{ k: "Record", v: "not found — it may have been deleted" }],
  });

  if (kind === "collection") {
    const c = (data.collections || []).find((r) => String(r.id) === String(id));
    if (!c) return notFound("Fee collection");
    const stu = (students || []).find((s) => s.id === c.student_id);
    return {
      title: "Fee collection",
      rows: [
        { k: "Date", v: c.date },
        { k: "Student ID", v: c.student_id },
        { k: "Student", v: c.student_name || stu?.name || "—" },
        { k: "Batch", v: stu?.batch || "—" },
        { k: "Type", v: c.type || "—" },
        { k: "Amount", v: formatMoney(c.amount) },
      ],
    };
  }

  if (kind === "expense") {
    const e = (data.expenses || []).find((r) => String(r.id) === String(id));
    if (!e) return notFound("Expense");
    return {
      title: "Expense",
      rows: [
        { k: "Date", v: e.date },
        { k: "Category", v: e.category || "—" },
        { k: "Description", v: e.description || "—" },
        { k: "Account", v: e.account || "—" },
        { k: "Amount", v: formatMoney(e.amount) },
      ],
    };
  }

  if (kind === "transfer") {
    const t = (data.transfers || []).find((r) => String(r.id) === String(id));
    if (!t) return notFound("Transfer");
    return {
      title: "Transfer",
      rows: [
        { k: "Date", v: t.date },
        { k: "From → To", v: `${t.from_account} → ${t.to_account}` },
        { k: "Purpose", v: t.purpose || "—" },
        { k: "Reference", v: t.reference || "—" },
        { k: "Amount", v: formatMoney(t.amount) },
      ],
    };
  }

  return null;
}

export function reconciliationSummary(statement, lines, data) {
  const book = bookBalanceAsOf(statement.account, statement.period_end, data);
  const statementClosing = Number(statement.closing_balance || 0);
  const open = lines.filter((l) => l.status === "unmatched").length;
  const ignored = lines.filter((l) => l.status === "ignored").length;
  return {
    bookBalance: book,
    statementClosing,
    difference: statementClosing - book,
    openCount: open,
    ignoredCount: ignored,
    reconciled: open === 0 && Math.round(statementClosing - book) === 0,
  };
}
