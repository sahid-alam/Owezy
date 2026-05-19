-- ============================================================
-- Migration 20260519000001: profiles, guest_profiles, notification_prefs
-- Tables:    profiles, guest_profiles, notification_prefs
-- Functions: set_updated_at(), handle_new_user(), handle_new_profile()
-- ============================================================

-- ── Utility: set_updated_at ───────────────────────────────────
-- Reused by every table that has an updated_at column.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ──────────────────────────────────────────────────
create table profiles (
  id                uuid        primary key references auth.users(id) on delete cascade,
  name              text        not null default '',
  phone             text,
  upi_id            text,
  avatar_url        text,
  preferred_upi_app text        check (preferred_upi_app in ('gpay', 'phonepe', 'paytm')),
  deactivated_at    timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Partial unique: one active profile per phone number.
-- Allows NULL phones (skipped at signup) and preserves soft-deleted rows.
create unique index profiles_phone_unique
  on profiles (phone)
  where phone is not null and deleted_at is null;

create index profiles_upi_id_idx
  on profiles (upi_id)
  where upi_id is not null;

create trigger set_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;

-- Any signed-in user can read any profile.
-- Needed for: friend search by name/phone, split member display, settlement UPI lookup.
create policy "profiles: auth users can read all"
  on profiles for select
  to authenticated
  using (true);

-- Fallback for edge cases where trigger hasn't fired yet (e.g. trigger error recovery).
create policy "profiles: user inserts own row"
  on profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles: user updates own row"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No DELETE policy → hard deletes blocked for all authenticated users.
-- Account deletion uses soft delete (deleted_at) + field anonymisation.
-- Cascade from auth.users is the only hard-delete path (admin action only).

-- ── guest_profiles ────────────────────────────────────────────
-- Represents invited non-users. Identified by phone.
-- Claimed on signup via claim_guest_profile() RPC (added in a later migration
-- once expense_splits and settlements exist).
create table guest_profiles (
  id          uuid        primary key default gen_random_uuid(),
  phone       text        not null,
  invited_by  uuid        not null references profiles(id),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- Partial unique: one active guest invite per phone number.
create unique index guest_profiles_phone_unique
  on guest_profiles (phone)
  where deleted_at is null;

create index guest_profiles_invited_by_idx
  on guest_profiles (invited_by);

alter table guest_profiles enable row level security;

-- Auth users can see active guest profiles — needed to display
-- "Rahul (Guest)" in split views.
create policy "guest_profiles: auth users can read active"
  on guest_profiles for select
  to authenticated
  using (deleted_at is null);

-- Only the inviter can create a guest invite.
create policy "guest_profiles: inviter can create"
  on guest_profiles for insert
  to authenticated
  with check (invited_by = auth.uid());

-- Inviter can soft-delete (set deleted_at) — e.g. wrong number entered.
-- claim_guest_profile() RPC also sets deleted_at; it runs SECURITY DEFINER
-- so bypasses RLS entirely.
create policy "guest_profiles: inviter can soft-delete"
  on guest_profiles for update
  to authenticated
  using (invited_by = auth.uid())
  with check (invited_by = auth.uid());

-- ── notification_prefs ────────────────────────────────────────
create table notification_prefs (
  id                   uuid        primary key default gen_random_uuid(),
  profile_id           uuid        not null unique references profiles(id) on delete cascade,
  new_expense          boolean     not null default true,
  expense_edited       boolean     not null default true,
  reminder             boolean     not null default true,
  settlement_initiated boolean     not null default true,
  settlement_confirmed boolean     not null default true,
  group_membership     boolean     not null default true,
  group_admin          boolean     not null default true,
  trip_ended           boolean     not null default true,
  friend_request       boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger set_notification_prefs_updated_at
  before update on notification_prefs
  for each row execute function set_updated_at();

alter table notification_prefs enable row level security;

create policy "notification_prefs: own row only (select)"
  on notification_prefs for select
  to authenticated
  using (profile_id = auth.uid());

-- Also created by handle_new_profile trigger (SECURITY DEFINER, bypasses RLS).
create policy "notification_prefs: own row only (insert)"
  on notification_prefs for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "notification_prefs: own row only (update)"
  on notification_prefs for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ── handle_new_user ───────────────────────────────────────────
-- Fires after every new auth.users insert (Google OAuth, email/password, phone).
-- Creates the profiles row from whatever metadata is available.
-- ON CONFLICT DO NOTHING guards against duplicate triggers or account linking.
-- Guest claim (migrating expense_splits.guest_id → profile_id) is done separately
-- via claim_guest_profile() RPC, added once expense_splits + settlements exist.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url, phone)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      ''
    ),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.phone, new.raw_user_meta_data->>'phone')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── handle_new_profile ────────────────────────────────────────
-- Fires after every profiles insert.
-- Auto-creates the notification_prefs singleton with all toggles defaulting to true.
create or replace function handle_new_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notification_prefs (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

create trigger on_profile_created
  after insert on profiles
  for each row execute function handle_new_profile();
