-- ============================================================
-- Migration 20260519000018: notification triggers
-- ============================================================
--
-- 1. friendships.reminder_count_in_cycle — tracks how many
--    passive reminders have fired for a debt pair in the current
--    cycle. Resets to 0 when debt is fully settled (< ₹1).
--
-- 2. insert_notification — checked gateway for all notification
--    writes. Reads notification_prefs, skips if type disabled.
--    SECURITY DEFINER; NOT granted to authenticated users.
--
-- 3. get_reminder_candidates — service-role helper for the
--    daily-reminders Edge Function. Queries underlying tables
--    directly (no auth.uid() filter) to see all pairs.
--
-- 4. notify_on_expense_audit — fires on expense_audit_log INSERT.
--    DEFERRABLE INITIALLY DEFERRED so it runs at transaction end
--    after all splits exist. Handles 'created', 'edited',
--    'split_added' separately per FIX 2.
--
-- 5. notify_on_settlement_change — settlement_initiated /
--    settlement_confirmed on status transitions.
--
-- 6. reset_reminder_cycle_on_settle — resets
--    reminder_count_in_cycle when debt clears (< ₹1).
--
-- 7. notify_on_group_member_change — group_added / removed /
--    admin role changes.
--
-- 8. notify_on_friendship_change — friend_request_received /
--    friend_request_accepted. Blocked-requester guard on INSERT.
-- ============================================================


-- ── 1. friendships.reminder_count_in_cycle ───────────────────

ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS reminder_count_in_cycle smallint NOT NULL DEFAULT 0;


-- ── 2. insert_notification ───────────────────────────────────

CREATE OR REPLACE FUNCTION insert_notification(
  p_recipient_id  uuid,
  p_type          text,
  p_data          jsonb DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pref_col text;
  v_allowed  boolean;
BEGIN
  v_pref_col := CASE p_type
    WHEN 'new_expense'             THEN 'new_expense'
    WHEN 'expense_edited'          THEN 'expense_edited'
    WHEN 'reminder'                THEN 'reminder'
    WHEN 'settlement_initiated'    THEN 'settlement_initiated'
    WHEN 'settlement_confirmed'    THEN 'settlement_confirmed'
    WHEN 'group_added'             THEN 'group_membership'
    WHEN 'group_removed'           THEN 'group_membership'
    WHEN 'group_admin_granted'     THEN 'group_admin'
    WHEN 'group_admin_revoked'     THEN 'group_admin'
    WHEN 'trip_ended'              THEN 'trip_ended'
    WHEN 'friend_request_received' THEN 'friend_request'
    WHEN 'friend_request_accepted' THEN 'friend_request'
    ELSE NULL
  END;
  IF v_pref_col IS NULL THEN RETURN; END IF;

  -- Missing prefs row treated as all-enabled
  EXECUTE format(
    'SELECT COALESCE((SELECT %I FROM notification_prefs WHERE profile_id = $1), true)',
    v_pref_col
  ) INTO v_allowed USING p_recipient_id;

  IF NOT v_allowed THEN RETURN; END IF;

  INSERT INTO notifications (recipient_id, type, data)
  VALUES (p_recipient_id, p_type, p_data);
END;
$$;
-- Intentionally no GRANT to authenticated. SECURITY DEFINER triggers
-- (run as owner) and the service-role Edge Function call this directly.


-- ── 3. get_reminder_candidates ───────────────────────────────
-- Used exclusively by the daily-reminders Edge Function (service role).
-- Queries raw tables — no auth.uid() filter, so all pairs are visible.

CREATE OR REPLACE FUNCTION get_reminder_candidates()
RETURNS TABLE (
  friendship_id           uuid,
  debtor_id               uuid,
  creditor_id             uuid,
  creditor_name           text,
  net_amount              numeric,
  oldest_expense_at       timestamptz,
  oldest_expense_title    text,
  last_reminded_at        timestamptz,
  reminder_count_in_cycle smallint
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH expense_debts AS (
    SELECT
      LEAST(e.paid_by, es.profile_id)    AS user_a,
      GREATEST(e.paid_by, es.profile_id) AS user_b,
      CASE
        WHEN e.paid_by = LEAST(e.paid_by, es.profile_id)
        THEN  es.amount
        ELSE -es.amount
      END AS component,
      e.title,
      e.created_at
    FROM expenses e
    JOIN expense_splits es ON es.expense_id = e.id
    WHERE e.deleted_at  IS NULL
      AND es.deleted_at IS NULL
      AND e.paid_by     != es.profile_id
      AND es.profile_id IS NOT NULL
  ),
  settlement_offsets AS (
    SELECT
      LEAST(s.payer_id, s.payee_id)    AS user_a,
      GREATEST(s.payer_id, s.payee_id) AS user_b,
      CASE
        WHEN s.payer_id = LEAST(s.payer_id, s.payee_id)
        THEN  s.amount
        ELSE -s.amount
      END AS component,
      NULL::text        AS title,
      NULL::timestamptz AS created_at
    FROM settlements s
    WHERE s.status     = 'confirmed'
      AND s.deleted_at IS NULL
      AND s.payee_id   IS NOT NULL
  ),
  combined AS (
    SELECT
      user_a,
      user_b,
      SUM(component)  AS net,
      MIN(created_at) FILTER (WHERE created_at IS NOT NULL) AS oldest_at,
      (array_agg(title ORDER BY created_at ASC)
         FILTER (WHERE title IS NOT NULL))[1]               AS oldest_title
    FROM (
      SELECT user_a, user_b, component, title, created_at FROM expense_debts
      UNION ALL
      SELECT user_a, user_b, component, title, created_at FROM settlement_offsets
    ) t
    GROUP BY user_a, user_b
    HAVING ABS(SUM(component)) >= 1.00
  )
  SELECT
    f.id                                                           AS friendship_id,
    CASE WHEN c.net > 0 THEN c.user_b ELSE c.user_a END           AS debtor_id,
    CASE WHEN c.net > 0 THEN c.user_a ELSE c.user_b END           AS creditor_id,
    p.name                                                         AS creditor_name,
    ABS(c.net)                                                     AS net_amount,
    c.oldest_at                                                    AS oldest_expense_at,
    c.oldest_title                                                 AS oldest_expense_title,
    f.last_reminded_at,
    f.reminder_count_in_cycle
  FROM combined c
  JOIN friendships f ON (
      (f.requester_id = c.user_a AND f.addressee_id = c.user_b)
   OR (f.requester_id = c.user_b AND f.addressee_id = c.user_a)
  ) AND f.status = 'accepted' AND f.deleted_at IS NULL
  JOIN profiles p ON p.id = (CASE WHEN c.net > 0 THEN c.user_a ELSE c.user_b END);
$$;
-- No GRANT — service role only


-- ── 4. notify_on_expense_audit ───────────────────────────────
-- DEFERRABLE INITIALLY DEFERRED: fires at transaction end so
-- expense_splits are fully inserted before we fan out.
--
-- 'created'     → new_expense to all split participants except editor
-- 'edited'      → expense_edited to participants created BEFORE this
--                 audit entry (pre-edit participants only)
-- 'split_added' → new_expense to the single newly-added profile
-- 'deleted'     → no notification in MVP

CREATE OR REPLACE FUNCTION notify_on_expense_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r            RECORD;
  v_expense    expenses%ROWTYPE;
  v_actor      profiles%ROWTYPE;
  v_newly_added uuid;
  v_data       jsonb;
  v_type       text;
BEGIN
  IF NEW.action NOT IN ('created', 'edited', 'split_added') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_expense FROM expenses WHERE id = NEW.expense_id;
  SELECT * INTO v_actor   FROM profiles WHERE id = NEW.edited_by;

  v_data := jsonb_build_object(
    'expense_id', NEW.expense_id,
    'title',      v_expense.title,
    'amount',     v_expense.amount,
    'actor_id',   NEW.edited_by,
    'actor_name', v_actor.name
  );

  -- split_added: notify only the one newly added profile
  IF NEW.action = 'split_added' THEN
    v_newly_added := (NEW.changes->>'profile_id')::uuid;
    IF v_newly_added IS NOT NULL AND v_newly_added IS DISTINCT FROM NEW.edited_by THEN
      PERFORM insert_notification(v_newly_added, 'new_expense', v_data);
    END IF;
    RETURN NEW;
  END IF;

  -- created / edited fan-out
  v_type := CASE NEW.action WHEN 'created' THEN 'new_expense' ELSE 'expense_edited' END;

  FOR r IN
    SELECT DISTINCT es.profile_id
    FROM   expense_splits es
    WHERE  es.expense_id   = NEW.expense_id
      AND  es.profile_id  IS NOT NULL
      AND  es.profile_id  IS DISTINCT FROM NEW.edited_by
      AND  es.deleted_at  IS NULL
      -- For 'edited': only notify pre-edit participants (their split was
      -- created in an earlier transaction, before this audit log row).
      -- For 'created': include all (no date restriction needed).
      AND  (NEW.action = 'created' OR es.created_at < NEW.created_at)
  LOOP
    PERFORM insert_notification(r.profile_id, v_type, v_data);
  END LOOP;

  RETURN NEW;
END;
$$;

-- DEFERRABLE INITIALLY DEFERRED fires after the full transaction completes,
-- so expense_splits are present when the fan-out query runs.
CREATE CONSTRAINT TRIGGER on_expense_audit_notify
  AFTER INSERT ON expense_audit_log
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION notify_on_expense_audit();


-- ── 5. notify_on_settlement_change ───────────────────────────
-- 'initiated' → 'paid'      : settlement_initiated to payee
-- 'paid'      → 'confirmed' : settlement_confirmed to payer
-- Dispute (back to 'initiated'): no notification in MVP

CREATE OR REPLACE FUNCTION notify_on_settlement_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payer profiles%ROWTYPE;
  v_payee profiles%ROWTYPE;
  v_data  jsonb;
BEGIN
  SELECT * INTO v_payer FROM profiles WHERE id = NEW.payer_id;
  IF NEW.payee_id IS NOT NULL THEN
    SELECT * INTO v_payee FROM profiles WHERE id = NEW.payee_id;
  END IF;

  IF OLD.status = 'initiated' AND NEW.status = 'paid'
     AND NEW.payee_id IS NOT NULL THEN
    v_data := jsonb_build_object(
      'settlement_id', NEW.id,
      'amount',        NEW.amount,
      'payer_id',      NEW.payer_id,
      'payer_name',    v_payer.name,
      'note',          NEW.note
    );
    PERFORM insert_notification(NEW.payee_id, 'settlement_initiated', v_data);
  END IF;

  IF OLD.status = 'paid' AND NEW.status = 'confirmed' THEN
    v_data := jsonb_build_object(
      'settlement_id', NEW.id,
      'amount',        NEW.amount,
      'payee_id',      NEW.payee_id,
      'payee_name',    v_payee.name
    );
    PERFORM insert_notification(NEW.payer_id, 'settlement_confirmed', v_data);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_settlement_notify
  AFTER UPDATE ON settlements
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_settlement_change();


-- ── 6. reset_reminder_cycle_on_settle ────────────────────────
-- When a settlement is confirmed, recompute the pair's net balance.
-- If it drops below ₹1 (effectively settled), reset the reminder
-- cycle so the next debt starts fresh at day-3.

CREATE OR REPLACE FUNCTION reset_reminder_cycle_on_settle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_remaining numeric;
BEGIN
  -- Post-confirmation balance for this pair (the new row is already 'confirmed')
  SELECT COALESCE(ABS(SUM(combined.component)), 0) INTO v_remaining
  FROM (
    SELECT
      CASE
        WHEN e.paid_by = LEAST(e.paid_by, es.profile_id)
        THEN  es.amount
        ELSE -es.amount
      END AS component
    FROM expenses e
    JOIN expense_splits es ON es.expense_id = e.id
    WHERE e.deleted_at  IS NULL
      AND es.deleted_at IS NULL
      AND e.paid_by     != es.profile_id
      AND es.profile_id IS NOT NULL
      AND LEAST(e.paid_by, es.profile_id)    = LEAST(NEW.payer_id, NEW.payee_id)
      AND GREATEST(e.paid_by, es.profile_id) = GREATEST(NEW.payer_id, NEW.payee_id)

    UNION ALL

    SELECT
      CASE
        WHEN s.payer_id = LEAST(s.payer_id, s.payee_id)
        THEN  s.amount
        ELSE -s.amount
      END AS component
    FROM settlements s
    WHERE s.status     = 'confirmed'
      AND s.deleted_at IS NULL
      AND s.payee_id   IS NOT NULL
      AND LEAST(s.payer_id, s.payee_id)    = LEAST(NEW.payer_id, NEW.payee_id)
      AND GREATEST(s.payer_id, s.payee_id) = GREATEST(NEW.payer_id, NEW.payee_id)
  ) combined;

  IF v_remaining < 1.00 THEN
    UPDATE friendships
    SET reminder_count_in_cycle = 0,
        last_reminded_at        = NULL
    WHERE LEAST(requester_id, addressee_id)    = LEAST(NEW.payer_id, NEW.payee_id)
      AND GREATEST(requester_id, addressee_id) = GREATEST(NEW.payer_id, NEW.payee_id)
      AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_settlement_confirmed_cycle_reset
  AFTER UPDATE ON settlements
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'confirmed'
        AND NEW.payee_id IS NOT NULL)
  EXECUTE FUNCTION reset_reminder_cycle_on_settle();


-- ── 7. notify_on_group_member_change ─────────────────────────
-- INSERT → group_added  (skip if actor = new member: bootstrap / self-add)
-- UPDATE → role change  → group_admin_granted / group_admin_revoked
-- UPDATE → deleted_at   → group_removed (only for admin-forced removal)

CREATE OR REPLACE FUNCTION notify_on_group_member_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group groups%ROWTYPE;
  v_actor profiles%ROWTYPE;
  v_data  jsonb;
BEGIN
  SELECT * INTO v_group FROM groups   WHERE id = NEW.group_id;
  SELECT * INTO v_actor FROM profiles WHERE id = auth.uid();

  v_data := jsonb_build_object(
    'group_id',   NEW.group_id,
    'group_name', v_group.name,
    'actor_id',   auth.uid(),
    'actor_name', COALESCE(v_actor.name, '')
  );

  IF TG_OP = 'INSERT' THEN
    -- Skip bootstrap: creator auto-added by handle_new_group (actor = new member)
    IF auth.uid() IS NOT NULL AND NEW.profile_id IS DISTINCT FROM auth.uid() THEN
      PERFORM insert_notification(NEW.profile_id, 'group_added', v_data);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Role change (not on a soft-delete row)
    IF OLD.role IS DISTINCT FROM NEW.role AND NEW.deleted_at IS NULL THEN
      PERFORM insert_notification(
        NEW.profile_id,
        CASE WHEN NEW.role = 'admin' THEN 'group_admin_granted'
             ELSE 'group_admin_revoked' END,
        v_data
      );
    END IF;

    -- Admin-forced removal (self-leave has auth.uid() = NEW.profile_id)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
       AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.profile_id) THEN
      PERFORM insert_notification(NEW.profile_id, 'group_removed', v_data);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_group_member_notify
  AFTER INSERT OR UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION notify_on_group_member_change();


-- ── 8. notify_on_friendship_change ───────────────────────────
-- INSERT → friend_request_received to addressee
--   Guard: skip if addressee has ever blocked the requester
-- UPDATE pending→accepted → friend_request_accepted to requester

CREATE OR REPLACE FUNCTION notify_on_friendship_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_requester profiles%ROWTYPE;
  v_addressee profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_requester FROM profiles WHERE id = NEW.requester_id;
  SELECT * INTO v_addressee FROM profiles WHERE id = NEW.addressee_id;

  IF TG_OP = 'INSERT' THEN
    -- Don't notify if addressee has previously blocked this requester
    IF NOT EXISTS (
      SELECT 1 FROM friendships
      WHERE  requester_id = NEW.addressee_id
        AND  addressee_id = NEW.requester_id
        AND  status = 'blocked'
    ) THEN
      PERFORM insert_notification(
        NEW.addressee_id,
        'friend_request_received',
        jsonb_build_object(
          'requester_id',   NEW.requester_id,
          'requester_name', v_requester.name
        )
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      PERFORM insert_notification(
        NEW.requester_id,
        'friend_request_accepted',
        jsonb_build_object(
          'accepter_id',   NEW.addressee_id,
          'accepter_name', v_addressee.name
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_friendship_notify
  AFTER INSERT OR UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION notify_on_friendship_change();
