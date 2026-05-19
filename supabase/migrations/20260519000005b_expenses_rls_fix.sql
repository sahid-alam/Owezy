-- ============================================================
-- Migration 20260519000005b: fix infinite RLS recursion in expenses
--
-- Root cause: expenses SELECT policy contained a direct subquery into
-- expense_splits, and expense_splits SELECT policy subqueries back into
-- expenses — mutual recursion that Postgres detects and rejects.
--
-- Fix: replace the direct expense_splits subquery in the expenses policy
-- with a SECURITY DEFINER helper (is_expense_participant), which bypasses
-- expense_splits RLS and breaks the cycle. Same pattern as is_group_member
-- and is_trip_member.
-- ============================================================

-- Helper must come after expense_splits table (migration 5) exists.
create or replace function is_expense_participant(eid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from expense_splits
    where expense_id = eid
      and profile_id = auth.uid()
      and deleted_at is null
  );
$$;

-- Drop and recreate the broken policy
drop policy "expenses: participants can read" on expenses;

create policy "expenses: participants can read"
  on expenses for select
  to authenticated
  using (
    paid_by = auth.uid()
    or created_by = auth.uid()
    or is_expense_participant(id)
    or (group_id is not null and is_group_member(group_id))
    or (trip_id is not null and is_trip_member(trip_id))
  );
