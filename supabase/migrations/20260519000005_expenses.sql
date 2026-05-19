-- ============================================================
-- Migration 20260519000005: expenses, expense_splits
-- RLS on expenses references expense_splits and vice versa,
-- so both tables must exist before either set of policies is applied.
-- Order: expenses table → expense_splits table → RLS on both.
-- ============================================================

-- ── expenses ──────────────────────────────────────────────────
create table expenses (
  id          uuid          primary key default gen_random_uuid(),
  title       text          not null,
  amount      numeric(10,2) not null check (amount > 0),
  paid_by     uuid          not null references profiles(id),
  group_id    uuid          references groups(id),
  trip_id     uuid          references trips(id),
  category    text          check (category in (
                              'food','transport','accommodation',
                              'entertainment','groceries','shopping',
                              'utilities','other'
                            )),
  date        date          not null default current_date,
  notes       text,
  split_type  text          not null default 'equal'
              check (split_type in ('equal', 'custom', 'item')),
  ai_parsed   boolean       not null default false,
  created_by  uuid          not null references profiles(id),
  deleted_at  timestamptz,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index expenses_group_id_idx    on expenses (group_id)   where group_id is not null;
create index expenses_trip_id_idx     on expenses (trip_id)    where trip_id  is not null;
create index expenses_paid_by_idx     on expenses (paid_by);
create index expenses_created_by_idx  on expenses (created_by);
create index expenses_date_idx        on expenses (date);

create trigger set_expenses_updated_at
  before update on expenses
  for each row execute function set_updated_at();

-- ── expense_splits ────────────────────────────────────────────
create table expense_splits (
  id          uuid          primary key default gen_random_uuid(),
  expense_id  uuid          not null references expenses(id),
  profile_id  uuid          references profiles(id),
  guest_id    uuid          references guest_profiles(id),
  amount      numeric(10,2) not null check (amount >= 0),
  notes       text,
  deleted_at  timestamptz,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),

  -- Exactly one of profile_id or guest_id must be set (never both, never neither)
  constraint expense_splits_one_party check (
    (profile_id is not null)::int + (guest_id is not null)::int = 1
  )
);

-- One active split per real profile per expense
create unique index expense_splits_profile_unique
  on expense_splits (expense_id, profile_id)
  where profile_id is not null and deleted_at is null;

-- One active split per guest per expense
create unique index expense_splits_guest_unique
  on expense_splits (expense_id, guest_id)
  where guest_id is not null and deleted_at is null;

create index expense_splits_expense_id_idx on expense_splits (expense_id);
create index expense_splits_profile_id_idx on expense_splits (profile_id) where profile_id is not null;
create index expense_splits_guest_id_idx   on expense_splits (guest_id)   where guest_id  is not null;

create trigger set_expense_splits_updated_at
  before update on expense_splits
  for each row execute function set_updated_at();

-- ── RLS: expenses ─────────────────────────────────────────────
alter table expenses enable row level security;

-- Visible to: payer, creator, any split participant, any member of the group/trip
create policy "expenses: participants can read"
  on expenses for select
  to authenticated
  using (
    paid_by = auth.uid()
    or created_by = auth.uid()
    or auth.uid() in (
      select profile_id from expense_splits
      where expense_id = id
        and profile_id is not null
        and deleted_at is null
    )
    or (group_id is not null and is_group_member(group_id))
    or (trip_id is not null and is_trip_member(trip_id))
  );

-- Creator must be the authenticated user; must be a member of any group/trip context
create policy "expenses: members can create"
  on expenses for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (group_id is null or is_group_member(group_id))
    and (trip_id is null or is_trip_member(trip_id))
  );

-- Only the creator can edit title/amount/paid_by/category/date/notes.
-- "Add more people to split" goes through expense_splits INSERT, never expenses UPDATE.
create policy "expenses: creator can update"
  on expenses for update
  to authenticated
  using  (created_by = auth.uid())
  with check (created_by = auth.uid());

-- No DELETE policy

-- ── RLS: expense_splits ───────────────────────────────────────
alter table expense_splits enable row level security;

-- Visible to: own split row, or any user who can see the parent expense
create policy "expense_splits: participants can read"
  on expense_splits for select
  to authenticated
  using (
    profile_id = auth.uid()
    or expense_id in (
      select id from expenses
      where paid_by = auth.uid()
        or created_by = auth.uid()
        or (group_id is not null and is_group_member(group_id))
        or (trip_id is not null and is_trip_member(trip_id))
    )
  );

-- Who can insert a split, and for whom:
--   Outer check: caller must be a member of the expense's context.
--   Inner check: only the expense creator may assign splits to arbitrary users.
--     Any other member may only add their own row (profile_id = auth.uid()) or a guest row.
-- This closes the "group member saddles others with fake debt" hole at the DB level.
create policy "expense_splits: members can create"
  on expense_splits for insert
  to authenticated
  with check (
    expense_id in (
      select id from expenses
      where created_by = auth.uid()
        or (group_id is not null and is_group_member(group_id))
        or (trip_id is not null and is_trip_member(trip_id))
    )
    and (
      -- expense creator can add splits for anyone
      exists (
        select 1 from expenses
        where id = expense_id and created_by = auth.uid()
      )
      -- non-creator members can only add their own split or a guest split
      or profile_id = auth.uid()
      or guest_id is not null
    )
  );

-- Only a user can update their own split row.
-- Closes the "reduce others' amounts" hole at DB level.
create policy "expense_splits: own split only (update)"
  on expense_splits for update
  to authenticated
  using  (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- No DELETE policy
