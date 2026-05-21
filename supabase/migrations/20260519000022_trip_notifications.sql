-- ============================================================
-- Migration 20260519000022: trip member notification trigger
-- ============================================================
-- Reuses existing notification types (group_added/removed/admin_granted/revoked)
-- with data.context='trip' to avoid new notification_prefs columns.
-- notification-copy.js checks data.context to render trip vs group copy.

CREATE OR REPLACE FUNCTION notify_on_trip_member_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor   uuid;
  v_trip    trips%ROWTYPE;
  v_actor_p profiles%ROWTYPE;
  v_data    jsonb;
BEGIN
  v_actor := COALESCE(auth.uid(), NEW.profile_id);
  SELECT * INTO v_trip FROM trips WHERE id = NEW.trip_id;
  SELECT * INTO v_actor_p FROM profiles WHERE id = v_actor;

  v_data := jsonb_build_object(
    'context',    'trip',
    'group_id',   NEW.trip_id,
    'group_name', v_trip.name,
    'actor_id',   v_actor,
    'actor_name', v_actor_p.name
  );

  IF TG_OP = 'INSERT' THEN
    -- Skip bootstrap: handle_new_trip adds creator; at that point auth.uid() = creator
    IF NEW.profile_id IS DISTINCT FROM v_actor THEN
      PERFORM insert_notification(NEW.profile_id, 'group_added', v_data);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS NULL AND OLD.role IS DISTINCT FROM NEW.role THEN
      IF NEW.role = 'admin' THEN
        PERFORM insert_notification(NEW.profile_id, 'group_admin_granted', v_data);
      ELSE
        PERFORM insert_notification(NEW.profile_id, 'group_admin_revoked', v_data);
      END IF;
    END IF;

    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
       AND NEW.profile_id IS DISTINCT FROM v_actor THEN
      PERFORM insert_notification(NEW.profile_id, 'group_removed', v_data);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_trip_member_notify
  AFTER INSERT OR UPDATE ON trip_members
  FOR EACH ROW EXECUTE FUNCTION notify_on_trip_member_change();
