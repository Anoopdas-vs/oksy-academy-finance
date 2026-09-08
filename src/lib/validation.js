// Shared validation + friendly-error helpers used across every form and
// bulk-import screen in the app.

// Maps the raw error text Postgres/Supabase sends back into plain
// language a non-technical staff member can understand.
export function friendlyError(err) {
  const msg = (err && err.message) || String(err || "");

  if (/invalid input syntax for type date/i.test(msg)) {
    return "One of the dates isn't valid. Please check the Date field/column and try again.";
  }
  if (/invalid input syntax for type numeric/i.test(msg)) {
    return "One of the amounts isn't a valid number. Please check the Amount field/column.";
  }
  if (/duplicate key value/i.test(msg) && /students/i.test(msg)) {
    return "That Student ID already exists.";
  }
  if (/duplicate key value/i.test(msg)) {
    return "That record already exists.";
  }
  if (/violates row-level security policy/i.test(msg)) {
    return "You don't have permission to do that. Ask an admin if this seems wrong.";
  }
  if (/violates check constraint/i.test(msg) && /amount/i.test(msg)) {
    return "Amount must be greater than zero.";
  }
  if (/violates check constraint/i.test(msg) && /account/i.test(msg)) {
    return "Account must be one of: HDFC, ICICI, Cash, Healthcare.";
  }
  if (/violates check constraint/i.test(msg) && /status/i.test(msg)) {
    return "Status must be one of: Registered, Active, Completed, Dropped.";
  }
  if (/violates foreign key constraint/i.test(msg) && /student/i.test(msg)) {
    return "That Student ID doesn't exist in Enrollment.";
  }
  if (/failed to fetch|networkerror|network error/i.test(msg)) {
    return "Couldn't reach the server. Check your internet connection and try again.";
  }
  if (!msg || msg === "[object Object]") {
    return "Something went wrong. Please try again.";
  }
  return msg;
}

export function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

export function isValidDateStr(v) {
  if (isBlank(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

export function isPositiveNumber(v) {
  if (isBlank(v)) return false;
  const n = Number(v);
  return !Number.isNaN(n) && n > 0;
}

// "Healthcare" is an inter-company clearing account, valid on money rows
// (fee collections / expenses / income) alongside the real bank & cash accounts.
export const VALID_ACCOUNTS = ["HDFC", "ICICI", "Cash", "Healthcare"];
export function isValidAccount(v) {
  return VALID_ACCOUNTS.includes(v);
}

export const VALID_STATUSES = ["Registered", "Active", "Completed", "Dropped"];
export function isValidStatus(v) {
  return VALID_STATUSES.includes(v);
}

// Validates a single money-transaction-style row (expense/income/fee
// collection) before it is sent to the database. Returns an array of
// human-readable problems; an empty array means the row is valid.
export function validateMoneyRow({ date, amount, account }) {
  const problems = [];
  if (!isValidDateStr(date)) problems.push("Missing or invalid date");
  if (!isPositiveNumber(amount)) problems.push("Amount must be a positive number");
  if (account && !isValidAccount(account)) {
    problems.push(`Unknown account "${account}" (use HDFC, ICICI, Cash or Healthcare)`);
  }
  return problems;
}
