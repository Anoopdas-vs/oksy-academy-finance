-- ============================================================
-- Migration 19b: backfill missing expense category master rows (Step 12,
-- second pre-req for 19)
-- ============================================================
-- Found while validating migration 19 (add FK expenses.category ->
-- expense_categories.name): 25 distinct category values are in use on
-- real expense rows but were never added to public.expense_categories
-- (only the original 10 seeded defaults -- Rent, Salary, Commission,
-- Electricity, Internet, Marketing, Office Expense, Travel, Bank
-- Charge, Other -- existed there). expenses.category was evidently
-- free text before this master table/dropdown existed.
--
-- Confirmed with the product owner 2026-09-14: add all 25 as active
-- (archived = false) categories, spelled exactly as they already appear
-- on existing expense records (including "Website Develepement" and
-- "convocation Ceremony" -- left as-is rather than corrected, so this
-- migration is purely additive with zero risk of touching expense
-- rows; a spelling/capitalization cleanup can be done separately later
-- as its own reviewed change if desired).
--
-- This is additive only: no expense rows are changed, no categories are
-- removed.
--
-- Rollback:
--   delete from public.expense_categories where name in (
--     'License & Subscription','Affiliation Fee','Faculty Remuneration',
--     'Staff Welfare','Student Services','Sales & Performance Incentives',
--     'Fee Refund','Marketing & Promotion','convocation Ceremony',
--     'Website Develepement','Staff Salary','Office Maintenance',
--     'Utilities & Communication','Office Supplies','HR expenses',
--     'Newspaper & Publications','Travelling Allowance',
--     'Director Appreciation for Operations','IT Service & Maintenance',
--     'Student Healthcare expenses','GEC Commission','Asset Purchase',
--     'Bank Charges','Event & Hospitality','Faculty properties'
--   );
-- ------------------------------------------------------------

begin;

insert into public.expense_categories (name, archived)
values
  ('License & Subscription', false),
  ('Affiliation Fee', false),
  ('Faculty Remuneration', false),
  ('Staff Welfare', false),
  ('Student Services', false),
  ('Sales & Performance Incentives', false),
  ('Fee Refund', false),
  ('Marketing & Promotion', false),
  ('convocation Ceremony', false),
  ('Website Develepement', false),
  ('Staff Salary', false),
  ('Office Maintenance', false),
  ('Utilities & Communication', false),
  ('Office Supplies', false),
  ('HR expenses', false),
  ('Newspaper & Publications', false),
  ('Travelling Allowance', false),
  ('Director Appreciation for Operations', false),
  ('IT Service & Maintenance', false),
  ('Student Healthcare expenses', false),
  ('GEC Commission', false),
  ('Asset Purchase', false),
  ('Bank Charges', false),
  ('Event & Hospitality', false),
  ('Faculty properties', false)
on conflict (name) do nothing;

commit;
