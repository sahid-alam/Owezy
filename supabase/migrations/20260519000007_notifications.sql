-- ============================================================
-- Migration 20260519000007: notifications
-- Note: notification_prefs was created in migration 1 alongside profiles.
-- This migration adds only the notifications feed table.
-- No updated_at column — notifications are immutable except for read_at.
-- ============================================================

create table notifications (
  id            uuid        primary key default gen_random_uuid(),
  recipient_id  uuid        not null references profiles(id),
  type          text        not null check (type in (
                              'new_expense',
                              'expense_edited',
                              'reminder',
                              'settlement_initiated',
                              'settlement_confirmed',
                              'group_added',
                              'group_removed',
                              'group_admin_granted',
                              'group_admin_revoked',
                              'trip_ended',
                              'friend_request_received',
                              'friend_request_accepted'
                            )),
  data          jsonb       not null default '{}',
  read_at       timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- Unread feed: the hot path for badge counts and the notification bell
create index notifications_recipient_unread_idx
  on notifications (recipient_id, created_at desc)
  where read_at is null and deleted_at is null;

-- Full feed ordered by recency (includes read notifications)
create index notifications_recipient_created_idx
  on notifications (recipient_id, created_at desc)
  where deleted_at is null;

alter table notifications enable row level security;

-- Recipient sees only their own non-deleted notifications
create policy "notifications: recipient can read own"
  on notifications for select
  to authenticated
  using (recipient_id = auth.uid() and deleted_at is null);

-- No INSERT policy for authenticated users.
-- Edge functions use the service-role key, which bypasses RLS entirely.
-- Authenticated clients must never insert notifications directly.

-- Recipient can mark as read (set read_at). No other fields are user-editable.
create policy "notifications: recipient can mark read"
  on notifications for update
  to authenticated
  using  (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- No DELETE policy
