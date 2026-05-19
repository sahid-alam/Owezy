-- ============================================================
-- Migration 20260519000006: settlements, claim_guest_profile RPC
-- ============================================================

-- ── settlements ───────────────────────────────────────────────
create table settlements (
  id             uuid          primary key default gen_random_uuid(),
  amount         numeric(10,2) not null check (amount > 0),
  payer_id       uuid          not null references profiles(id),
  payee_id       uuid          references profiles(id),
  guest_payee_id uuid          references guest_profiles(id),
  group_id       uuid          references groups(id),
  trip_id        uuid          references trips(id),
  status         text          not null default 'initiated'
                 check (status in ('initiated', 'paid', 'confirmed')),
  note           text,
  paid_at        timestamptz,
  confirmed_at   timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now(),

  -- Payer is always a real user (must be authenticated to initiate).
  -- Payee is either a real profile or a guest — never both, never neither.
  constraint settlements_payee_one_party check (
    (payee_id is not null)::int + (guest_payee_id is not null)::int = 1
  ),
  constraint settlements_no_self_settle check (
    payee_id is null or payer_id <> payee_id
  )
);

create index settlements_payer_status_idx
  on settlements (payer_id, status);

create index settlements_payee_status_idx
  on settlements (payee_id, status)
  where payee_id is not null;

-- Separate index for guest payee lookups (used by claim_guest_profile)
create index settlements_guest_payee_idx
  on settlements (guest_payee_id)
  where guest_payee_id is not null;

create index settlements_group_id_idx
  on settlements (group_id)
  where group_id is not null;

create index settlements_trip_id_idx
  on settlements (trip_id)
  where trip_id is not null;

create trigger set_settlements_updated_at
  before update on settlements
  for each row execute function set_updated_at();

alter table settlements enable row level security;

-- Payer or real payee can see their settlement
create policy "settlements: payer or payee can read"
  on settlements for select
  to authenticated
  using (payer_id = auth.uid() or payee_id = auth.uid());

-- Only the payer initiates; payer_id must match caller
create policy "settlements: payer can create"
  on settlements for insert
  to authenticated
  with check (payer_id = auth.uid());

-- Payer marks as paid; payee confirms received
create policy "settlements: payer or payee can update"
  on settlements for update
  to authenticated
  using  (payer_id = auth.uid() or payee_id = auth.uid())
  with check (payer_id = auth.uid() or payee_id = auth.uid());

-- No DELETE policy

-- ── claim_guest_profile RPC ───────────────────────────────────
-- Called by the app after signup + phone verification.
-- Atomically migrates all expense_splits and settlements from the matching
-- guest_profile to the caller's real profile, then soft-deletes the guest.
--
-- Security properties:
--   - Phone comes from profiles.phone (DB-authoritative), not a caller parameter.
--     A caller cannot spoof another user's phone to steal their splits.
--   - FOR UPDATE locks the guest row so concurrent claims on the same phone
--     serialize cleanly rather than racing.
--   - SECURITY DEFINER bypasses RLS on all three tables for the migration writes.
create or replace function claim_guest_profile()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_guest_id     uuid;
  v_caller_id    uuid  := auth.uid();
  v_caller_phone text;
begin
  if v_caller_id is null then
    raise exception 'not authenticated';
  end if;

  -- Look up the caller's phone from their profile — caller cannot supply this.
  select phone into v_caller_phone
  from profiles
  where id = v_caller_id;

  if v_caller_phone is null then
    return; -- no phone on profile yet, nothing to claim
  end if;

  -- Lock the guest row for the duration of this transaction so concurrent
  -- calls with the same phone serialize rather than both reading the same id.
  select id into v_guest_id
  from guest_profiles
  where phone = v_caller_phone
    and deleted_at is null
  for update
  limit 1;

  if v_guest_id is null then
    return; -- no matching guest, nothing to do
  end if;

  -- Migrate expense_splits: guest_id → profile_id
  update expense_splits
  set
    profile_id = v_caller_id,
    guest_id   = null
  where guest_id   = v_guest_id
    and deleted_at is null;

  -- Migrate settlements: guest_payee_id → payee_id
  update settlements
  set
    payee_id       = v_caller_id,
    guest_payee_id = null
  where guest_payee_id = v_guest_id
    and deleted_at     is null;

  -- Soft-delete the now-claimed guest profile
  update guest_profiles
  set deleted_at = now()
  where id = v_guest_id;
end;
$$;

-- Allow authenticated users to call this function.
-- The security is enforced inside (phone pulled from profiles, not a parameter).
grant execute on function claim_guest_profile() to authenticated;
