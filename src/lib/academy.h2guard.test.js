// Static/structural regression guards for the H-2 fix (assignment
// self-grading column gap) that CAN run under plain `npm test` — no
// Supabase connection needed. src/lib/academy.js can't be imported directly
// under `node --test` (it reads `import.meta.env.VITE_SUPABASE_*` at module
// load, which only Vite provides), so these tests read the source text
// instead of importing the module. See src/lib/academy.rls.test.js for the
// behavioral tests that need a live Supabase project.
//
// These exist to catch a future "fix" that quietly reintroduces the H-2
// gap: someone reverting submitAssignment to a plain upsert against
// assignment_submissions, or extending resubmit_assignment() to also write
// a grading column.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const academySrc = readFileSync(path.join(dir, "academy.js"), "utf8");
const migrationSql = readFileSync(
  path.join(dir, "..", "..", "supabase", "11_assignment_resubmit_guard.sql"),
  "utf8"
);

describe("submitAssignment (src/lib/academy.js) no longer relies on a direct student UPDATE", () => {
  test("does not upsert assignment_submissions on assignment_id,student_id", () => {
    assert.ok(
      !/\.upsert\(\s*\{[^}]*\}\s*,\s*\{\s*onConflict:\s*["']assignment_id,student_id["']/s.test(academySrc),
      "submitAssignment must not use the old upsert-onConflict pattern, which " +
        "depended on a direct student UPDATE grant (sub_student_update) that H-2 removes"
    );
  });

  test("calls the resubmit_assignment RPC for the resubmission path", () => {
    assert.ok(
      /supabase\.rpc\(\s*["']resubmit_assignment["']/.test(academySrc),
      "submitAssignment's resubmission branch must call the resubmit_assignment RPC"
    );
  });

  test("first-submission path still inserts (governed by sub_student_insert, unchanged)", () => {
    assert.ok(
      /\.from\(\s*["']assignment_submissions["']\s*\)\s*\.insert\(/.test(academySrc),
      "the first-submission path must remain a direct insert"
    );
  });
});

describe("supabase/11_assignment_resubmit_guard.sql", () => {
  test("drops the sub_student_update policy", () => {
    assert.match(
      migrationSql,
      /drop policy if exists "sub_student_update" on public\.assignment_submissions/
    );
  });

  test("does not create, alter, or drop sub_student_insert, sub_grader_update, or sub_read", () => {
    for (const policy of ["sub_student_insert", "sub_grader_update", "sub_read"]) {
      assert.ok(
        !new RegExp(`(create|drop|alter)\\s+policy[^;]*"${policy}"`, "i").test(migrationSql),
        `migration must not create/drop/alter policy "${policy}" — its blast radius is ` +
          "sub_student_update plus the new resubmit_assignment function only"
      );
    }
  });

  test("resubmit_assignment() is security definer and grants execute to authenticated", () => {
    assert.match(migrationSql, /language plpgsql security definer set search_path = public/);
    assert.match(
      migrationSql,
      /grant execute on function public\.resubmit_assignment\([^)]*\) to authenticated/
    );
  });

  test("resubmit_assignment()'s body never references marks, feedback, graded_by, or graded_at", () => {
    const start = migrationSql.indexOf("create or replace function public.resubmit_assignment");
    const end = migrationSql.indexOf("grant execute on function public.resubmit_assignment");
    assert.ok(start !== -1 && end !== -1 && end > start, "could not locate the function body in the migration file");
    const body = migrationSql.slice(start, end);
    for (const column of ["marks", "feedback", "graded_by", "graded_at"]) {
      assert.ok(
        !new RegExp(`\\b${column}\\b`).test(body),
        `resubmit_assignment()'s body must never reference "${column}" — that's the whole point of H-2`
      );
    }
  });

  test("resubmit_assignment() re-checks student_id = auth.uid() and status = 'submitted'", () => {
    const start = migrationSql.indexOf("create or replace function public.resubmit_assignment");
    const end = migrationSql.indexOf("grant execute on function public.resubmit_assignment");
    const body = migrationSql.slice(start, end);
    assert.match(body, /student_id\s*=\s*auth\.uid\(\)/);
    assert.match(body, /status\s*=\s*'submitted'/);
    assert.match(body, /raise exception/);
  });
});
