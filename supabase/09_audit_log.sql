-- ============================================================
-- Migration 09: audit trail for financial-record edits & deletes
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 01-08.
--
-- Problem: editing or deleting a fee collection, expense, or transfer left
-- no trace of the previous value, who changed it, or when — collections
-- didn't even have updated_at/updated_by columns. See the engineering
-- review, finding H1.
--
-- Fix: a generic audit_log table plus one trigger function, attached to
-- UPDATE and DELETE on collections/expenses/transfers. It stores the whole
-- old row and the whole new row (NULL on delete) as jsonb, so nothing about
-- what changed is lost, without needing a bespoke history table per table.
-- ------------------------------------------------------------

begin;

alter table public.collections add column if not exists updated_at timestamptz;
alter table public.collections add column if not exists updated_by uuid references public.profiles (id);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id bigint not null,
  action text not null check (action in ('update', 'delete')),
  old_row jsonb,
  new_row jsonb,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;
create index if not exists audit_log_table_row_idx on public.audit_log (table_name, row_id);

-- Same audience as the records it's auditing: anyone who can see the
-- financial detail behind a collection/expense/transfer can see its history.
-- Nobody can insert/update/delete audit_log directly — only the trigger
-- (running as the table owner, security definer) writes to it.
create policy "audit_log_financial_viewer_select" on public.audit_log
  for select using (public.can_view_financials());

create or replace function public.log_financial_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    insert into public.audit_log (table_name, row_id, action, old_row, new_row, changed_by)
    values (tg_table_name, new.id, 'update', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_log (table_name, row_id, action, old_row, new_row, changed_by)
    values (tg_table_name, old.id, 'delete', to_jsonb(old), null, auth.uid());
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists collections_audit on public.collections;
create trigger collections_audit
  after update or delete on public.collections
  for each row execute function public.log_financial_change();

drop trigger if exists expenses_audit on public.expenses;
create trigger expenses_audit
  after update or delete on public.expenses
  for each row execute function public.log_financial_change();

drop trigger if exists transfers_audit on public.transfers;
create trigger transfers_audit
  after update or delete on public.transfers
  for each row execute function public.log_financial_change();

commit;

-- Nothing in the frontend needs to change for the audit trail itself to
-- start working (the triggers fire regardless of how the row was changed).
-- This PR does not add a history viewer screen for audit_log — that's a
-- reasonable follow-up, not required for the trail to exist and be queryable
-- directly in Supabase in the meantime.
