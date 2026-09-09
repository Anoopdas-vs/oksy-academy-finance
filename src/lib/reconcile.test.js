// Unit tests for the bank-reconciliation helpers in reconcile.js — see
// finding M4 in the engineering review. Node's built-in test runner
// (node:test); `npm test` needs no extra dependency.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { accountLedger, bookBalanceAsOf, autoMatch, reconciliationSummary } from "./reconcile.js";

describe("accountLedger", () => {
  test("collections are positive, expenses negative, transfers signed by direction", () => {
    const data = {
      collections: [
        { id: 1, account: "HDFC", date: "2026-01-05", amount: 1000 },
        { id: 2, account: "Cash", date: "2026-01-05", amount: 999 }, // different account, excluded
      ],
      expenses: [{ id: 1, account: "HDFC", date: "2026-01-06", amount: 300 }],
      transfers: [
        { id: 1, from_account: "HDFC", to_account: "Cash", date: "2026-01-07", amount: 100 },
        { id: 2, from_account: "Cash", to_account: "HDFC", date: "2026-01-08", amount: 50 },
      ],
    };
    const entries = accountLedger("HDFC", data);
    // collection(+1000), expense(-300), transfer out to Cash(-100), transfer
    // in from Cash(+50) — both legs of a transfer produce an entry on their
    // respective account, so the Cash->HDFC transfer shows up here too.
    assert.equal(entries.length, 4);
    assert.deepEqual(entries.map((e) => e.delta), [1000, -300, -100, 50]);
  });
});

describe("bookBalanceAsOf", () => {
  const data = {
    collections: [
      { id: 1, account: "HDFC", date: "2026-01-05", amount: 1000 },
      { id: 2, account: "HDFC", date: "2026-02-01", amount: 500 }, // after cutoff
    ],
    expenses: [],
    transfers: [],
  };

  test("only includes entries on or before the cutoff date", () => {
    assert.equal(bookBalanceAsOf("HDFC", "2026-01-31", data), 1000);
  });

  test("a null/undefined cutoff includes everything (all-time)", () => {
    assert.equal(bookBalanceAsOf("HDFC", null, data), 1500);
  });
});

describe("autoMatch", () => {
  const data = {
    collections: [{ id: 1, account: "HDFC", date: "2026-01-05", amount: 1000 }],
    expenses: [{ id: 1, account: "HDFC", date: "2026-01-20", amount: 300 }],
    transfers: [],
  };

  test("matches a deposit line to a collection of the same amount within the day window", () => {
    const lines = [{ date: "2026-01-06", deposit: 1000, withdrawal: 0 }];
    const [result] = autoMatch(lines, "HDFC", data, 4);
    assert.equal(result.status, "matched");
    assert.equal(result.match_kind, "collection");
    assert.equal(result.match_id, 1);
  });

  test("matches a withdrawal line to an expense", () => {
    const lines = [{ date: "2026-01-21", deposit: 0, withdrawal: 300 }];
    const [result] = autoMatch(lines, "HDFC", data, 4);
    assert.equal(result.status, "matched");
    assert.equal(result.match_kind, "expense");
  });

  test("does not match when the date is outside the day window", () => {
    const lines = [{ date: "2026-01-15", deposit: 1000, withdrawal: 0 }]; // 10 days from the collection
    const [result] = autoMatch(lines, "HDFC", data, 4);
    assert.equal(result.status, "unmatched");
  });

  test("does not match a deposit line against an expense (wrong direction) even with equal amount/date", () => {
    const lines = [{ date: "2026-01-20", deposit: 300, withdrawal: 0 }];
    const [result] = autoMatch(lines, "HDFC", data, 4);
    assert.equal(result.status, "unmatched");
  });

  test("each app entry is consumed at most once — a second identical line doesn't double-match", () => {
    const lines = [
      { date: "2026-01-06", deposit: 1000, withdrawal: 0 },
      { date: "2026-01-06", deposit: 1000, withdrawal: 0 },
    ];
    const [first, second] = autoMatch(lines, "HDFC", data, 4);
    assert.equal(first.status, "matched");
    assert.equal(second.status, "unmatched");
  });
});

describe("reconciliationSummary", () => {
  test("reconciled is true only when nothing is open and the statement matches the book to the rupee", () => {
    const data = {
      collections: [{ id: 1, account: "HDFC", date: "2026-01-05", amount: 1000 }],
      expenses: [],
      transfers: [],
    };
    const statement = { account: "HDFC", period_end: "2026-01-31", closing_balance: 1000 };
    const lines = [{ status: "matched" }];
    const result = reconciliationSummary(statement, lines, data);
    assert.equal(result.bookBalance, 1000);
    assert.equal(result.difference, 0);
    assert.equal(result.openCount, 0);
    assert.equal(result.reconciled, true);
  });

  test("is not reconciled while any line is still unmatched, even if the totals happen to agree", () => {
    const data = {
      collections: [{ id: 1, account: "HDFC", date: "2026-01-05", amount: 1000 }],
      expenses: [],
      transfers: [],
    };
    const statement = { account: "HDFC", period_end: "2026-01-31", closing_balance: 1000 };
    const lines = [{ status: "unmatched" }];
    const result = reconciliationSummary(statement, lines, data);
    assert.equal(result.openCount, 1);
    assert.equal(result.reconciled, false);
  });

  test("is not reconciled when the statement closing balance disagrees with the book balance", () => {
    const data = {
      collections: [{ id: 1, account: "HDFC", date: "2026-01-05", amount: 1000 }],
      expenses: [],
      transfers: [],
    };
    const statement = { account: "HDFC", period_end: "2026-01-31", closing_balance: 1200 };
    const lines = [{ status: "matched" }];
    const result = reconciliationSummary(statement, lines, data);
    assert.equal(result.difference, 200);
    assert.equal(result.reconciled, false);
  });
});
