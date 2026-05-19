-- ============================================================
-- Migration 20260519000002: friendships
-- ============================================================

create table friendships (
  id                     uuid        primary key default gen_random_uuid(),
  requester_id           uuid        not null references profiles(id),
  addressee_id           uuid        not null references profiles(id),
  status                 text        not null default 'pending'
                         check (status in ('pending', 'accepted', 'blocked')),
  reminder_interval_days smallint,
  last_reminded_at       timestamptz,
  deleted_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint friendships_no_self_friend check (requester_id <> addressee_id)
);

-- Bidirectional uniqueness: least/greatest canonicalises the pair so A→B and B→A
-- map to the same index entry. Scoped to active rows only.
create unique index friendships_pair_unique
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where deleted_at is null;

create index friendships_addressee_status_idx
  on friendships (addressee_id, status);

create index friendships_requester_status_idx
  on friendships (requester_id, status);

create trigger set_friendships_updated_at
  before update on friendships
  for each row execute function set_updated_at();

alter table friendships enable row level security;

-- Either party can see the friendship
create policy "friendships: participants can read"
  on friendships for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Only the requester can send a friend request
create policy "friendships: requester can create"
  on friendships for insert
  to authenticated
  with check (requester_id = auth.uid());

-- Either party can update: addressee accepts/blocks, requester cancels (sets deleted_at)
create policy "friendships: participants can update"
  on friendships for update
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());

-- No DELETE policy → hard deletes blocked
