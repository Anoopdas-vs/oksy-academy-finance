-- ============================================================
-- Migration 14: batches insert+update require staff+ (CRIT-1, 3 of 6)
-- ============================================================
-- Run ONCE in the Supabase SQL Editor, after 12.

begin;

drop policy if exists "batches_approved_insert" on public.batches;
create policy "batches_staff_insert" on public.batches
  for insert with check (public.is_staff_or_admin());

drop policy if exists "batches_approved_update" on public.batches;
create policy "batches_staff_update" on public.batches
  for update using (public.is_staff_or_admin()) with check (public.is_staff_or_admin());

commit;

-- Not touched: batches_approved_select, batches_admin_delete (already admin-only).
