// Bank reconciliation helpers: book-balance math and auto-matching uploaded
// statement lines against the app's own transactions.

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
