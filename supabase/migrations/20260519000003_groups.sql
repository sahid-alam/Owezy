-- ============================================================
-- Migration 20260519000003: groups, group_members
-- NOTE: is_group_member() references group_members, so both tables
-- must be created before any function or policy that uses it.
-- Order: groups table → group_members table → helper function → RLS → triggers.
-- ============================================================

-- ── groups (table only, RLS applied after group_members exists) ──
create table groups (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  description  text,
  created_by   uuid        not null references profiles(id),
  archived_at  timestamptz,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index groups_created_by_idx on groups (created_by);

create trigger set_groups_updated_at
  before update on groups
  for each row execute function set_updated_at();

-- ── group_members (table only, RLS applied after helper exists) ──
create table group_members (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        not null references groups(id),
  profile_id  uuid        not null references profiles(id),
  role        text        not null default 'member'
              check (role in ('admin', 'member')),
  joined_at   timestamptz not null default now(),
  left_at     timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index group_members_active_unique
  on group_members (group_id, profile_id)
  where deleted_at is null;

create index group_members_profile_idx on group_members (profile_id);
create index group_members_group_role_idx on group_members (group_id, role);

create trigger set_group_members_updated_at
  before update on group_members
  for each row execute function set_updated_at();

-- ── Helper: is_group_member ───────────────────────────────────
-- language sql: body validated at creation time, so group_members must exist first.
-- SECURITY DEFINER so RLS on group_members doesn't block the check itself.
create or replace function is_group_member(gid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid
      and profile_id = auth.uid()
      and deleted_at is null
  );
$$;

-- ── RLS: groups ───────────────────────────────────────────────
alter table groups enable row level security;

create policy "groups: members can read"
  on groups for select
  to authenticated
  using (is_group_member(id));

create policy "groups: any auth user can create"
  on groups for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "groups: admins can update"
  on groups for update
  to authenticated
  using (
    exists (
      select 1 from group_members
      where group_id = id
        and profile_id = auth.uid()
        and role = 'admin'
        and deleted_at is null
    )
  );

-- No DELETE policy

-- ── RLS: group_members ────────────────────────────────────────
alter table group_members enable row level security;

create policy "group_members: members can read"
  on group_members for select
  to authenticated
  using (is_group_member(group_id));

-- IMPORTANT: this policy requires the caller to already be an admin of the group.
-- The initial creator row is inserted by handle_new_group() (SECURITY DEFINER),
-- which bypasses RLS — so the bootstrap case works correctly.
-- All subsequent member additions MUST go through a SECURITY DEFINER RPC
-- (add_group_member, to be added when invites are in scope).
-- Clients must never INSERT into group_members directly with RLS active.
create policy "group_members: admins can insert"
  on group_members for insert
  to authenticated
  with check (
    exists (
      select 1 from group_members gm
      where gm.group_id = group_members.group_id
        and gm.profile_id = auth.uid()
        and gm.role = 'admin'
        and gm.deleted_at is null
    )
  );

-- group_members.group_id explicitly qualifies the row being updated.
create policy "group_members: admins can update"
  on group_members for update
  to authenticated
  using (
    exists (
      select 1 from group_members gm
      where gm.group_id = group_members.group_id
        and gm.profile_id = auth.uid()
        and gm.role = 'admin'
        and gm.deleted_at is null
    )
  );

-- No DELETE policy

-- ── Trigger: auto-add creator as admin ───────────────────────
-- Runs SECURITY DEFINER so it can insert into group_members despite the
-- policy requiring an existing admin (none exist at group creation time).
create or replace function handle_new_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.group_members (group_id, profile_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger on_group_created
  after insert on groups
  for each row execute function handle_new_group();
