// Unit tests for validation.js — the shared guardrails every fee-collection,
// expense, and bulk-import form runs data through before it reaches
// Supabase, plus the friendlyError() mapping that turns raw Postgres/RLS
// errors (including "violates row-level security policy" — the signature of
// a blocked forged-record attempt, see docs/audits/02-security-audit.md
// C-1) into a message a non-technical staff member can act on.
//
// Run directly with: node --test src/lib
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  friendlyError,
  isBlank,
  isValidDateStr,
  isPositiveNumber,
  isValidAccount,
  isValidStatus,
  validateMoneyRow,
  VALID_ACCOUNTS,
  VALID_STATUSES,
} from "./validation.js";

describe("isBlank", () => {
  test("treats undefined, null, and whitespace-only strings as blank", () => {
    assert.equal(isBlank(undefined), true);
    assert.equal(isBlank(null), true);
    assert.equal(isBlank("   "), true);
    assert.equal(isBlank(""), true);
  });

  test("treats 0 and non-empty strings as not blank", () => {
    assert.equal(isBlank(0), false);
    assert.equal(isBlank("0"), false);
    assert.equal(isBlank("x"), false);
  });
});

describe("isValidDateStr / isPositiveNumber", () => {
  test("rejects blank or unparsable dates", () => {
    assert.equal(isValidDateStr(""), false);
    assert.equal(isValidDateStr("not-a-date"), false);
  });

  test("accepts a well-formed date string", () => {
    assert.equal(isValidDateStr("2026-09-14"), true);
  });

  test("rejects zero, negative, blank, and non-numeric amounts", () => {
    assert.equal(isPositiveNumber(0), false);
    assert.equal(isPositiveNumber(-5), false);
    assert.equal(isPositiveNumber(""), false);
    assert.equal(isPositiveNumber("abc"), false);
  });

  test("accepts a positive numeric string or number", () => {
    assert.equal(isPositiveNumber("100"), true);
    assert.equal(isPositiveNumber(0.5), true);
  });
});

describe("isValidAccount / isValidStatus", () => {
  test("only the four documented accounts are valid", () => {
    for (const a of VALID_ACCOUNTS) assert.equal(isValidAccount(a), true);
    assert.equal(isValidAccount("Random Bank"), false);
    assert.equal(isValidAccount(""), false);
  });

  test("only the four documented statuses are valid", () => {
    for (const s of VALID_STATUSES) assert.equal(isValidStatus(s), true);
    assert.equal(isValidStatus("Graduated"), false);
  });
});

describe("validateMoneyRow — the gate every fee/expense row passes through before Supabase", () => {
  test("a well-formed row has no problems", () => {
    assert.deepEqual(
      validateMoneyRow({ date: "2026-09-14", amount: 5000, account: "HDFC" }),
      []
    );
  });

  test("flags a missing date", () => {
    const problems = validateMoneyRow({ date: "", amount: 100, account: "Cash" });
    assert.ok(problems.some((p) => /date/i.test(p)));
  });

  test("flags a zero or negative amount", () => {
    for (const amount of [0, -100]) {
      const problems = validateMoneyRow({ date: "2026-09-14", amount, account: "Cash" });
      assert.ok(problems.some((p) => /amount/i.test(p)));
    }
  });

  test("flags an unrecognized account", () => {
    const problems = validateMoneyRow({ date: "2026-09-14", amount: 100, account: "Swiss Bank" });
    assert.ok(problems.some((p) => /account/i.test(p)));
  });

  test("an absent account is allowed (account is optional on this row shape)", () => {
    const problems = validateMoneyRow({ date: "2026-09-14", amount: 100 });
    assert.deepEqual(problems, []);
  });

  test("a row bad in every way reports every problem, not just the first", () => {
    const problems = validateMoneyRow({ date: "", amount: -1, account: "Nope" });
    assert.equal(problems.length, 3);
  });
});

describe("friendlyError — translating raw Postgres/RLS errors for non-technical staff", () => {
  test("maps a blocked-by-RLS write to a permission message, not the raw Postgres text", () => {
    const msg = friendlyError({ message: "new row violates row-level security policy for table" });
    assert.match(msg, /don't have permission/i);
  });

  test("maps a duplicate student id to a specific message", () => {
    const msg = friendlyError({ message: 'duplicate key value violates unique constraint "students_pkey"' });
    assert.match(msg, /Student ID already exists/i);
  });

  test("maps a generic duplicate key to a generic 'already exists' message", () => {
    const msg = friendlyError({ message: "duplicate key value violates unique constraint on collections" });
    assert.match(msg, /already exists/i);
  });

  test("maps an invalid numeric amount", () => {
    const msg = friendlyError({ message: 'invalid input syntax for type numeric: "abc"' });
    assert.match(msg, /amounts isn't a valid number/i);
  });

  test("maps a network failure to an actionable message", () => {
    const msg = friendlyError({ message: "TypeError: Failed to fetch" });
    assert.match(msg, /Couldn't reach the server/i);
  });

  test("falls back to the raw message when nothing else matches", () => {
    assert.equal(friendlyError({ message: "some other unexpected error" }), "some other unexpected error");
  });

  test("never throws and never returns a blank/[object Object] message for an empty or malformed error", () => {
    for (const err of [undefined, null, {}, ""]) {
      const msg = friendlyError(err);
      assert.equal(typeof msg, "string");
      assert.ok(msg.length > 0);
      assert.notEqual(msg, "[object Object]");
    }
  });
});
