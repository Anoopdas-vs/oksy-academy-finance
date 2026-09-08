-- ============================================================
-- Oksy Academy Finance — Supabase schema, roles & permissions
-- ============================================================
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste this whole file -> Run).

-- ------------------------------------------------------------
-- 1. PROFILES  (one row per login, created automatically on signup)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('super_admin', 'admin', 'staff', 'student', 'faculty', 'professional')),
  can_view_financials boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce(
    (select role in ('admin', 'super_admin') and is_approved
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce(
    (select role = 'super_admin' and is_approved
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_approved_user()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce((select is_approved from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.can_view_financials()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce(
    (select is_approved and (role = 'admin' or can_view_financials)
     from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_admin_select_all" on public.profiles
  for select using (public.is_admin());

create policy "profiles_super_admin_update_all" on public.profiles
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ------------------------------------------------------------
-- 2. STUDENTS  (student master — visible to every approved login)
-- ------------------------------------------------------------
create table public.students (
  id text primary key,
  batch text,
  name text not null,
  course text,
  registration_fee numeric not null default 0,
  course_fee numeric not null default 0,
  exam_fee numeric not null default 0,
  other_fee numeric not null default 0,
  waiver numeric not null default 0,
  status text not null default 'Registered'
    check (status in ('Registered', 'Active', 'Completed', 'Dropped')),
  enrollment_date date,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.students enable row level security;

create policy "students_approved_select" on public.students
  for select using (public.is_approved_user());

create policy "students_approved_insert" on public.students
  for insert with check (public.is_approved_user());

create policy "students_approved_update" on public.students
  for update using (public.is_approved_user()) with check (public.is_approved_user());

-- No delete policy on purpose — financial/student records are corrected, not deleted.

-- ------------------------------------------------------------
-- 3. COLLECTIONS  (student fee payments)
-- ------------------------------------------------------------
-- "Healthcare" is an inter-company clearing account: fees a student pays
-- through Healthcare land here instead of an Academy bank/cash account.
-- The running balance of the Healthcare account is the net amount owed
-- between Academy and Healthcare.
create table public.collections (
  id bigint generated always as identity primary key,
  student_id text not null references public.students (id),
  student_name text,
  date date not null,
  type text not null,
  account text not null check (account in ('HDFC', 'ICICI', 'Cash', 'Healthcare')),
  amount numeric not null check (amount > 0),
  reference text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.collections enable row level security;
create index collections_student_id_idx on public.collections (student_id);
create index collections_date_idx on public.collections (date);

create policy "collections_approved_select" on public.collections
  for select using (public.is_approved_user());

create policy "collections_approved_insert" on public.collections
  for insert with check (public.is_approved_user());

create policy "collections_admin_update" on public.collections
  for update using (public.is_admin()) with check (public.is_admin());

create policy "collections_admin_delete" on public.collections
  for delete using (public.is_admin());

create view public.collections_basic
with (security_invoker = true)
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
from public.collections;

grant select on public.collections_basic to authenticated;

-- ------------------------------------------------------------
-- 4. EXPENSES  (confidential — admin, or staff explicitly granted access)
-- ------------------------------------------------------------
create table public.expenses (
  id bigint generated always as identity primary key,
  date date not null,
  category text not null,
  -- 'Healthcare' = Academy expense settled by Healthcare (inter-company).
  account text not null check (account in ('HDFC', 'ICICI', 'Cash', 'Healthcare')),
  amount numeric not null check (amount > 0),
  reference text,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_at timestamptz,
  updated_by uuid references public.profiles (id)
);

alter table public.expenses enable row level security;
create index expenses_date_idx on public.expenses (date);

-- Any approved user may see, add and edit expenses; only admins delete.
create policy "expenses_approved_select" on public.expenses
  for select using (public.is_approved_user());

create policy "expenses_approved_insert" on public.expenses
  for insert with check (public.is_approved_user());

create policy "expenses_approved_update" on public.expenses
  for update using (public.is_approved_user()) with check (public.is_approved_user());

create policy "expenses_admin_delete" on public.expenses
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 5. INCOME  (other Academy income — confidential, admin only)
-- ------------------------------------------------------------
create table public.income (
  id bigint generated always as identity primary key,
  date date not null,
  category text not null,
  -- 'Healthcare' = income collected on Academy's behalf by Healthcare (inter-company).
  account text not null check (account in ('HDFC', 'ICICI', 'Cash', 'Healthcare')),
  amount numeric not null check (amount > 0),
  reference text,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.income enable row level security;
create index income_date_idx on public.income (date);

create policy "income_financial_viewer_select" on public.income
  for select using (public.can_view_financials());

create policy "income_admin_insert" on public.income
  for insert with check (public.is_admin());

create policy "income_admin_update" on public.income
  for update using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 6. TRANSFERS  (money moved between accounts — not income or expense)
-- ------------------------------------------------------------
-- A transfer moves money between Cash / HDFC / ICICI (and "Healthcare" for
-- repaying Healthcare what it spent on the Academy). It changes account
-- balances only; Net P&L is unaffected.
create table public.transfers (
  id bigint generated always as identity primary key,
  date date not null,
  from_account text not null check (from_account in ('HDFC', 'ICICI', 'Cash', 'Healthcare')),
  to_account   text not null check (to_account   in ('HDFC', 'ICICI', 'Cash', 'Healthcare')),
  amount numeric not null check (amount > 0),
  purpose text,
  reference text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  constraint transfers_distinct_accounts check (from_account <> to_account)
);

alter table public.transfers enable row level security;
create index transfers_date_idx on public.transfers (date);

create policy "transfers_financial_viewer_select" on public.transfers
  for select using (public.can_view_financials());
create policy "transfers_admin_insert" on public.transfers
  for insert with check (public.is_admin());
create policy "transfers_admin_update" on public.transfers
  for update using (public.is_admin()) with check (public.is_admin());
create policy "transfers_admin_delete" on public.transfers
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 7. BANK RECONCILIATION  (uploaded statements + their lines)
-- ------------------------------------------------------------
create table public.bank_statements (
  id bigint generated always as identity primary key,
  account text not null check (account in ('HDFC', 'ICICI', 'Cash')),
  period_start date,
  period_end date,
  opening_balance numeric,
  closing_balance numeric,
  file_name text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.bank_statements enable row level security;
create policy "bank_statements_financial_viewer_select" on public.bank_statements
  for select using (public.can_view_financials());
create policy "bank_statements_admin_insert" on public.bank_statements
  for insert with check (public.is_admin());
create policy "bank_statements_admin_update" on public.bank_statements
  for update using (public.is_admin()) with check (public.is_admin());
create policy "bank_statements_admin_delete" on public.bank_statements
  for delete using (public.is_admin());

create table public.bank_statement_lines (
  id bigint generated always as identity primary key,
  statement_id bigint not null references public.bank_statements (id) on delete cascade,
  account text not null check (account in ('HDFC', 'ICICI', 'Cash')),
  seq int,
  txn_date date not null,
  description text,
  reference text,
  withdrawal numeric not null default 0,
  deposit numeric not null default 0,
  running_balance numeric,
  -- reconciliation state
  status text not null default 'unmatched'
    check (status in ('unmatched', 'matched', 'classified', 'ignored')),
  match_kind text check (match_kind in ('collection', 'expense', 'transfer')),
  match_id bigint,
  matched_at timestamptz,
  matched_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.bank_statement_lines enable row level security;
create index bank_statement_lines_statement_idx on public.bank_statement_lines (statement_id);
create policy "bank_statement_lines_financial_viewer_select" on public.bank_statement_lines
  for select using (public.can_view_financials());
create policy "bank_statement_lines_admin_insert" on public.bank_statement_lines
  for insert with check (public.is_admin());
create policy "bank_statement_lines_admin_update" on public.bank_statement_lines
  for update using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 8. BATCHES  (course batch master — drives enrolment defaults)
-- ------------------------------------------------------------
create table public.batches (
  id bigint generated always as identity primary key,
  name text not null unique,
  course_name text,
  course_fee numeric not null default 0,
  start_date date,
  end_date date,
  duration text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.batches enable row level security;
create policy "batches_approved_select" on public.batches
  for select using (public.is_approved_user());
create policy "batches_approved_insert" on public.batches
  for insert with check (public.is_approved_user());
create policy "batches_approved_update" on public.batches
  for update using (public.is_approved_user()) with check (public.is_approved_user());
create policy "batches_admin_delete" on public.batches
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 9. EXPENSE CATEGORIES  (editable list used by the Expenses form)
-- ------------------------------------------------------------
create table public.expense_categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

alter table public.expense_categories enable row level security;
create policy "expense_categories_approved_select" on public.expense_categories
  for select using (public.is_approved_user());
create policy "expense_categories_approved_insert" on public.expense_categories
  for insert with check (public.is_approved_user());
create policy "expense_categories_approved_update" on public.expense_categories
  for update using (public.is_approved_user()) with check (public.is_approved_user());
create policy "expense_categories_admin_delete" on public.expense_categories
  for delete using (public.is_admin());

insert into public.expense_categories (name)
values ('Rent'), ('Salary'), ('Commission'), ('Electricity'), ('Internet'),
       ('Marketing'), ('Office Expense'), ('Travel'), ('Bank Charge'), ('Other')
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- 10. APP SETTINGS  (single JSON row the super admin edits)
-- ------------------------------------------------------------
create table public.app_settings (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id, data) values (1, '{}'::jsonb);

alter table public.app_settings enable row level security;
create policy "app_settings_approved_select" on public.app_settings
  for select using (public.is_approved_user());
create policy "app_settings_super_admin_write" on public.app_settings
  for update using (public.is_super_admin()) with check (public.is_super_admin());
create policy "app_settings_super_admin_insert" on public.app_settings
  for insert with check (public.is_super_admin());

-- ------------------------------------------------------------
-- 11. MAKE YOURSELF THE SUPER ADMIN
-- ------------------------------------------------------------
-- 1. Sign up once from the app's login screen with your own email/password.
-- 2. Then run this (replace the email):
--
-- update public.profiles
--    set role = 'super_admin', is_approved = true, can_view_financials = true
--  where email = 'you@example.com';
