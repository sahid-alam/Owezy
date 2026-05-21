-- ============================================================
-- Migration 20260519000019: notifications Realtime
-- ============================================================
-- REPLICA IDENTITY FULL is required so the filter column (recipient_id)
-- is available in the WAL record, allowing Supabase Realtime to enforce
-- the row-level filter `recipient_id=eq.{userId}` in postgres_changes
-- subscriptions. Without it the badge only updates on the /notifications
-- page (where useNotifications mounts), not globally.

ALTER TABLE notifications REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
