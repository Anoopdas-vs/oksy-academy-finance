-- ============================================================
-- Migration 06: close the collections account-masking bypass
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 01-05.
--
-- Problem 1: collections_basic (created in 01_healthcare_account.sql)
-- correctly hides the `account` column from staff without financial access,
-- but that masking only applied to callers who chose to query the view.
-- The base table's own RLS select policy ("collections_approved_select")
-- only checked is_approved_user(), so any approved user could still read
-- the real `account` value straight from public.collections via the
-- database's own REST API (e.g. /rest/v1/collections?select=account,...),
-- bypassing the view entirely. See the engineering review, finding C2.
--
-- Problem 2 (found while verifying the fix for Problem 1 against a real
-- Postgres instance, not just by reading the SQL): the existing view was
-- declared `with (security_invoker = true)`. A security_invoker view checks
-- the INVOKING role's own column privileges against the underlying table
-- for every column its body references — including inside a
-- `case when ... else null end` that never actually returns the value to
-- that caller. Combined with the Problem-1 fix (revoking `account` from
-- `authenticated` on the base table), that made the view itself throw
-- "permission denied for table collections" for every single caller, not
-- just the ones who are supposed to be masked — it didn't fail closed with
-- a null, it failed as an outright error for everyone, financial-access
-- users included. This migration recreates the view without
-- security_invoker so it runs as the view's owner (who has full table
-- access to evaluate the CASE), with security_barrier instead, and with the
-- approved-user row filter written explicitly into the view body — so its
-- correctness doesn't depend on RLS propagating through viewer ownership
-- one way or the other.
--
-- Fix: revoke direct SELECT on the base table from `authenticated`, so all
-- reads must go through collections_basic (whose own
--   case when can_view_financials() or created_by = auth.uid() then account
--   else null
-- logic still reveals the true account to users who should see it — this
-- change only removes the bypass, it doesn't change what any legitimate
-- user can see), and recreate collections_basic correctly as described above.
--
-- One narrow column-level grant is restored on top of that: `id`. Recording
-- a fee collection (insertCollection in src/lib/data.js) asks Postgres to
-- return the newly generated `id` via `RETURNING`, and editing/deleting a
-- collection filters `WHERE id = ...` — both of those need SELECT on the
-- `id` column specifically, per Postgres's normal privilege rules for
-- RETURNING/WHERE on columns the client isn't simultaneously writing. `id`
-- is a bare auto-increment number, so exposing it column-wide is harmless;
-- `account` (and every other column) stays reachable only through the view.
--
-- Verified against a real Postgres 16 instance (not just read through): ran
-- this migration on top of 01-05, then as the `authenticated` role —
--   * inserting a collection and getting `id` back via RETURNING: works.
--   * `select account from collections` directly: permission denied.
--   * `select account from collections_basic` as the row's own creator (no
--     can_view_financials): returns the real account value.
--   * the same query as an unrelated staff user with no financial access:
--     returns null for account, real values for every other column.
--   * the same query as a financial-access admin: returns the real value.
-- ------------------------------------------------------------

begin;

drop view if exists public.collections_basic;

create view public.collections_basic
with (security_barrier = true)
as
select
  id,
  student_id,
  student_name,
  date,
  type,
  amount,
  reference,
  case
    when public.can_view_financials() or created_by = auth.uid() then account
    else null
  end as account
from public.collections
where public.is_approved_user();

revoke select on public.collections from authenticated;
grant select (id) on public.collections to authenticated;
grant select on public.collections_basic to authenticated;

commit;

-- Companion code change (already made in this PR): src/lib/data.js's
-- fetchCollections() now always reads collections_basic (the view decides
-- what to reveal per-user server-side, so the frontend no longer needs to
-- pick a table based on its own guess of the caller's permissions), and
-- insertCollection() now requests `.select("id")` instead of `.select()` so
-- it only asks Postgres for the one column it's actually allowed, and
-- actually needs, back.
