-- ============================================================
-- Migration 20260519000004: trips, trip_members
-- Order: trips → trip_members → is_trip_member → RLS → trigger
-- (language sql helper must come after the table it references)
-- ============================================================

-- ── trips ─────────────────────────────────────────────────────
create table trips (
  id           uuid         primary key default gen_random_uuid(),
  name         text         not null,
  destination  text,
  start_date   date         not null,
  end_date     date         not null,
  budget       numeric(10,2),
  created_by   uuid         not null references profiles(id),
  archived_at  timestamptz,
  deleted_at   timestamptz,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),

  constraint trips_dates_valid check (end_date >= start_date)
);

create index trips_created_by_idx on trips (created_by);

create trigger set_trips_updated_at
  before update on trips
  for each row execute function set_updated_at();

-- ── trip_members ──────────────────────────────────────────────
create table trip_members (
  id          uuid        primary key default gen_random_uuid(),
  trip_id     uuid        not null references trips(id),
  profile_id  uuid        not null references profiles(id),
  role        text        not null default 'member'
              check (role in ('admin', 'member')),
  joined_at   timestamptz not null default now(),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index trip_members_active_unique
  on trip_members (trip_id, profile_id)
  where deleted_at is null;

create index trip_members_profile_idx on trip_members (profile_id);
create index trip_members_trip_role_idx on trip_members (trip_id, role);

create trigger set_trip_members_updated_at
  before update on trip_members
  for each row execute function set_updated_at();

-- ── Helper: is_trip_member ────────────────────────────────────
-- language sql: body validated at creation time, so trip_members must exist first.
create or replace function is_trip_member(tid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from trip_members
    where trip_id = tid
      and profile_id = auth.uid()
      and deleted_at is null
  );
$$;

-- ── RLS: trips ────────────────────────────────────────────────
alter table trips enable row level security;

create policy "trips: members can read"
  on trips for select
  to authenticated
  using (is_trip_member(id));

create policy "trips: any auth user can create"
  on trips for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "trips: admins can update"
  on trips for update
  to authenticated
  using (
    exists (
      select 1 from trip_members
      where trip_id = id
        and profile_id = auth.uid()
        and role = 'admin'
        and deleted_at is null
    )
  );

-- No DELETE policy

-- ── RLS: trip_members ─────────────────────────────────────────
alter table trip_members enable row level security;

create policy "trip_members: members can read"
  on trip_members for select
  to authenticated
  using (is_trip_member(trip_id));

-- IMPORTANT: same SECURITY DEFINER bootstrap pattern as group_members.
-- handle_new_trip() inserts the creator as admin, bypassing RLS.
-- All subsequent member additions must go through a SECURITY DEFINER RPC.
-- Clients must never INSERT into trip_members directly with RLS active.
create policy "trip_members: admins can insert"
  on trip_members for insert
  to authenticated
  with check (
    exists (
      select 1 from trip_members tm
      where tm.trip_id = trip_members.trip_id
        and tm.profile_id = auth.uid()
        and tm.role = 'admin'
        and tm.deleted_at is null
    )
  );

create policy "trip_members: admins can update"
  on trip_members for update
  to authenticated
  using (
    exists (
      select 1 from trip_members tm
      where tm.trip_id = trip_members.trip_id
        and tm.profile_id = auth.uid()
        and tm.role = 'admin'
        and tm.deleted_at is null
    )
  );

-- No DELETE policy

-- ── Trigger: auto-add creator as admin ───────────────────────
-- SECURITY DEFINER bypasses the admin-requires-existing-admin bootstrap problem.
create or replace function handle_new_trip()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, profile_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger on_trip_created
  after insert on trips
  for each row execute function handle_new_trip();
