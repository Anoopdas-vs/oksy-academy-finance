import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accountLedger,
  bookBalanceAsOf,
  autoMatch,
  reconciliationSummary,
  matchKindLabel,
  matchedRecordDetail,
} from "./reconcile.js";

describe("accountLedger", () => {
  it("builds signed movements for an account", () => {
    const data = {
      collections: [{ id: "c1", account: "HDFC", amount: 1000, date: "2026-03-01" }],
      expenses: [{ id: "e1", account: "HDFC", amount: 400, date: "2026-03-02" }],
      transfers: [
        { id: "t1", from_account: "Cash", to_account: "HDFC", amount: 500, date: "2026-03-03" },
        { id: "t2", from_account: "HDFC", to_account: "Cash", amount: 200, date: "2026-03-04" },
      ],
    };

    const ledger = accountLedger("HDFC", data);
    assert.equal(ledger.length, 4);
    assert.deepEqual(ledger.map(e => e.delta), [1000, -400, 500, -200]);
  });
});

describe("bookBalanceAsOf", () => {
  it("computes cumulative balance up to cutoff date", () => {
    const data = {
      collections: [
        { id: "c1", account: "HDFC", amount: 1000, date: "2026-03-01" },
        { id: "c2", account: "HDFC", amount: 2000, date: "2026-03-10" },
      ],
      expenses: [{ id: "e1", account: "HDFC", amount: 500, date: "2026-03-05" }],
      transfers: [],
    };

    // Cutoff on 2026-03-07 includes c1 and e1, excludes c2
    assert.equal(bookBalanceAsOf("HDFC", "2026-03-07", data), 500);
    // Cutoff on 2026-03-15 includes all
    assert.equal(bookBalanceAsOf("HDFC", "2026-03-15", data), 2500);
  });
});

describe("autoMatch", () => {
  it("matches statement lines against app ledger within date tolerance and equal amount", () => {
    const data = {
      collections: [{ id: "c1", account: "HDFC", amount: 5000, date: "2026-03-05" }],
      expenses: [{ id: "e1", account: "HDFC", amount: 1200, date: "2026-03-06" }],
      transfers: [],
    };

    const lines = [
      { id: "l1", date: "2026-03-06", deposit: 5000, withdrawal: 0 },
      { id: "l2", date: "2026-03-07", deposit: 0, withdrawal: 1200 },
      { id: "l3", date: "2026-03-08", deposit: 9999, withdrawal: 0 },
    ];

    const matches = autoMatch(lines, "HDFC", data, 2);
    assert.equal(matches[0].status, "matched");
    assert.equal(matches[0].match_id, "c1");
    assert.equal(matches[1].status, "matched");
    assert.equal(matches[1].match_id, "e1");
    assert.equal(matches[2].status, "unmatched");
  });
});

describe("matchKindLabel", () => {
  it("reads 'collection' as 'fee collection' and passes others through", () => {
    assert.equal(matchKindLabel("collection"), "fee collection");
    assert.equal(matchKindLabel("expense"), "expense");
    assert.equal(matchKindLabel("transfer"), "transfer");
    assert.equal(matchKindLabel(undefined), "record");
  });
});

describe("matchedRecordDetail", () => {
  const data = {
    collections: [
      { id: "c1", student_id: "DBHM001", student_name: "Asha K", type: "Course Fee", account: "ICICI", amount: 15000, date: "2026-04-02" },
    ],
    expenses: [
      { id: 7, category: "Rent", description: "April rent", account: "HDFC", amount: 30000, date: "2026-04-01" },
    ],
    transfers: [
      { id: "t1", from_account: "Cash", to_account: "ICICI", purpose: "Cash deposit", reference: "DEP-9", amount: 5000, date: "2026-04-03" },
    ],
  };
  const students = [{ id: "DBHM001", name: "Asha K", batch: "DBHM-2026" }];

  it("returns fee-collection fields incl. student id, name, batch and amount", () => {
    const d = matchedRecordDetail({ match_kind: "collection", match_id: "c1" }, data, students);
    assert.equal(d.title, "Fee collection");
    const map = Object.fromEntries(d.rows.map((r) => [r.k, r.v]));
    assert.equal(map["Student ID"], "DBHM001");
    assert.equal(map["Student"], "Asha K");
    assert.equal(map["Batch"], "DBHM-2026");
    assert.equal(map["Date"], "2026-04-02");
    assert.match(map["Amount"], /15,000/);
  });

  it("returns expense fields (category, description, account, amount); id can be numeric", () => {
    const d = matchedRecordDetail({ match_kind: "expense", match_id: 7 }, data);
    assert.equal(d.title, "Expense");
    const map = Object.fromEntries(d.rows.map((r) => [r.k, r.v]));
    assert.equal(map["Category"], "Rent");
    assert.equal(map["Description"], "April rent");
    assert.equal(map["Account"], "HDFC");
    assert.match(map["Amount"], /30,000/);
  });

  it("returns transfer fields with a From → To summary", () => {
    const d = matchedRecordDetail({ match_kind: "transfer", match_id: "t1" }, data);
    assert.equal(d.title, "Transfer");
    const map = Object.fromEntries(d.rows.map((r) => [r.k, r.v]));
    assert.equal(map["From → To"], "Cash → ICICI");
    assert.equal(map["Purpose"], "Cash deposit");
  });

  it("flags a deleted / missing record instead of throwing", () => {
    const d = matchedRecordDetail({ match_kind: "collection", match_id: "gone" }, data, students);
    assert.equal(d.title, "Fee collection");
    assert.match(d.rows[0].v, /not found/);
  });

  it("returns null when the line has no match", () => {
    assert.equal(matchedRecordDetail({ status: "unmatched" }, data), null);
    assert.equal(matchedRecordDetail({ match_kind: "collection" }, data), null);
  });
});

describe("reconciliationSummary", () => {
  it("computes difference and reconciliation status", () => {
    const data = {
      collections: [{ id: "c1", account: "HDFC", amount: 10000, date: "2026-03-01" }],
      expenses: [],
      transfers: [],
    };
    const statement = { account: "HDFC", period_end: "2026-03-31", closing_balance: 10000 };
    const lines = [{ id: "l1", status: "matched" }];

    const summary = reconciliationSummary(statement, lines, data);
    assert.equal(summary.bookBalance, 10000);
    assert.equal(summary.statementClosing, 10000);
    assert.equal(summary.difference, 0);
    assert.equal(summary.openCount, 0);
    assert.equal(summary.reconciled, true);
  });
});
