import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  grossFee,
  feeAfterWaiver,
  effectiveFeeDue,
  outstanding,
  waiverForDrop,
  sumByAccount,
  accountBalance,
  studentFeeTotals,
} from "./fees.js";

describe("grossFee", () => {
  it("sums all fee components accurately", () => {
    const student = {
      registration_fee: 1000,
      course_fee: 15000,
      exam_fee: 500,
      other_fee: 250,
    };
    assert.equal(grossFee(student), 16750);
  });

  it("handles missing or string fee components", () => {
    const student = {
      course_fee: "20000",
    };
    assert.equal(grossFee(student), 20000);
  });

  it("returns 0 for empty student object", () => {
    assert.equal(grossFee({}), 0);
  });
});

describe("feeAfterWaiver", () => {
  it("subtracts waiver from gross fee", () => {
    const student = {
      course_fee: 25000,
      waiver: 5000,
    };
    assert.equal(feeAfterWaiver(student), 20000);
  });

  it("handles zero or undefined waiver", () => {
    const student = { course_fee: 10000 };
    assert.equal(feeAfterWaiver(student), 10000);
  });
});

describe("effectiveFeeDue and outstanding", () => {
  it("calculates active student fee due and outstanding", () => {
    const student = { course_fee: 30000, waiver: 5000, status: "Active" };
    assert.equal(effectiveFeeDue(student, 10000), 25000);
    assert.equal(outstanding(student, 10000), 15000);
  });

  it("zeros outstanding balance for Dropped students by treating uncollected as waived", () => {
    const droppedStudent = { course_fee: 30000, waiver: 5000, status: "Dropped" };
    // Paid only 10,000 so far
    assert.equal(effectiveFeeDue(droppedStudent, 10000), 10000);
    assert.equal(outstanding(droppedStudent, 10000), 0);
  });

  it("handles dropped student who paid nothing", () => {
    const droppedStudent = { course_fee: 20000, status: "Dropped" };
    assert.equal(effectiveFeeDue(droppedStudent, 0), 0);
    assert.equal(outstanding(droppedStudent, 0), 0);
  });

  it("never returns negative outstanding when student overpays", () => {
    const student = { course_fee: 10000, status: "Active" };
    assert.equal(outstanding(student, 15000), 0);
  });
});

describe("waiverForDrop", () => {
  it("calculates waiver to zero out balance upon drop", () => {
    const student = { course_fee: 40000, waiver: 5000 };
    const collected = 15000;
    // Gross = 40000, Gap = 40000 - 15000 = 25000. New waiver = max(5000, 25000) = 25000
    assert.equal(waiverForDrop(student, collected), 25000);
  });

  it("never lowers existing waiver", () => {
    const student = { course_fee: 40000, waiver: 30000 };
    const collected = 35000;
    // Gap = 40000 - 35000 = 5000. New waiver = max(30000, 5000) = 30000
    assert.equal(waiverForDrop(student, collected), 30000);
  });
});

describe("sumByAccount", () => {
  const rows = [
    { account: "HDFC Bank", amount: 5000 },
    { account: "Cash", amount: 1500 },
    { account: "HDFC Bank", amount: 3500 },
  ];

  it("sums rows for a specific account", () => {
    assert.equal(sumByAccount(rows, "HDFC Bank"), 8500);
    assert.equal(sumByAccount(rows, "Cash"), 1500);
  });

  it("sums all rows when account is '*'", () => {
    assert.equal(sumByAccount(rows, "*"), 10000);
  });
});

describe("accountBalance", () => {
  it("calculates independent running balance including transfers", () => {
    const data = {
      collections: [
        { account: "Federal Bank", amount: 50000 },
        { account: "Cash", amount: 10000 },
      ],
      expenses: [
        { account: "Federal Bank", amount: 12000 },
        { account: "Cash", amount: 3000 },
      ],
      transfers: [
        { from_account: "Cash", to_account: "Federal Bank", amount: 5000 },
      ],
    };

    // Federal Bank: 50000 (in) - 12000 (out) + 5000 (transferred in) = 43000
    assert.equal(accountBalance("Federal Bank", data), 43000);
    // Cash: 10000 (in) - 3000 (out) - 5000 (transferred out) = 2000
    assert.equal(accountBalance("Cash", data), 2000);
  });
});

describe("studentFeeTotals", () => {
  it("aggregates expected, collected, and outstanding across multiple students", () => {
    const students = [
      { id: "s1", course_fee: 20000, waiver: 2000, status: "Active" }, // due 18000
      { id: "s2", course_fee: 30000, waiver: 0, status: "Dropped" },   // dropped, paid 10000 -> due 10000
      { id: "s3", course_fee: 15000, waiver: 0, status: "Active" },    // due 15000, paid 15000 -> out 0
    ];
    const collections = [
      { student_id: "s1", amount: 8000 },
      { student_id: "s2", amount: 10000 },
      { student_id: "s3", amount: 15000 },
    ];

    const result = studentFeeTotals(students, collections);
    assert.equal(result.collected, 33000);
    assert.equal(result.expected, 18000 + 10000 + 15000); // 43000
    assert.equal(result.outstanding, 10000); // s1 has 18000 - 8000 = 10000; s2 has 0; s3 has 0
    assert.equal(result.byStudent["s1"].outstanding, 10000);
    assert.equal(result.byStudent["s2"].outstanding, 0);
    assert.equal(result.byStudent["s3"].outstanding, 0);
  });
});
