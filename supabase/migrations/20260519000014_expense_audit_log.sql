-- Migration 20260519000014: expense_audit_log + triggers
--
-- 1. Extends is_expense_participant to cover all five visibility cases:
--    payer, creator, split participant, group member, trip member.
--    This matches the expenses SELECT policy exactly, so the audit log
--    SELECT policy can reuse the same helper without a fallback subquery
--    (which would risk mutual RLS recursion with expenses).
--
-- 2. Creates expense_audit_log with a single SELECT policy using that helper.
--    No INSERT/UPDATE/DELETE policies — SECURITY DEFINER triggers bypass RLS.
--
-- 3. Trigger on expenses (AFTER INSERT OR UPDATE) writes 'created', 'edited',
--    or 'deleted' entries.
--
-- 4. Trigger on expense_splits (AFTER INSERT) writes 'split_added'. Suppressed
--    during initial creation by session-local GUC app.skip_split_audit.

-- ── 1. Extend is_expense_participant ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_expense_participant(eid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM expenses
    WHERE id = eid
      AND (
        paid_by = auth.uid()
        OR created_by = auth.uid()
        OR (group_id IS NOT NULL AND is_group_member(group_id))
        OR (trip_id  IS NOT NULL AND is_trip_member(trip_id))
        OR EXISTS (
          SELECT 1 FROM expense_splits
          WHERE expense_id = eid
            AND profile_id = auth.uid()
            AND deleted_at IS NULL
        )
      )
  );
$$;

-- ── 2. expense_audit_log table ────────────────────────────────────────────────

CREATE TABLE expense_audit_log (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  uuid      NOT NULL REFERENCES expenses(id),
  edited_by   uuid      NOT NULL REFERENCES profiles(id),
  action      text      NOT NULL CHECK (action IN ('created','edited','deleted','split_added')),
  changes     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expense_audit_log_expense_idx ON expense_audit_log (expense_id);

ALTER TABLE expense_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log: expense participants can read"
  ON expense_audit_log FOR SELECT
  TO authenticated
  USING (is_expense_participant(expense_id));

-- ── 3. Expense audit trigger ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_expense_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_changes jsonb;
BEGIN
  v_actor := COALESCE(auth.uid(), NEW.created_by);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO expense_audit_log (expense_id, edited_by, action, changes)
    VALUES (
      NEW.id,
      NEW.created_by,
      'created',
      jsonb_build_object('title', NEW.title, 'amount', NEW.amount)
    );

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO expense_audit_log (expense_id, edited_by, action, changes)
      VALUES (NEW.id, v_actor, 'deleted', NULL);
    ELSE
      v_changes := '{}'::jsonb;

      IF OLD.title   IS DISTINCT FROM NEW.title   THEN
        v_changes := v_changes || jsonb_build_object('title',    OLD.title,    'new_title',    NEW.title);
      END IF;
      IF OLD.amount  IS DISTINCT FROM NEW.amount  THEN
        v_changes := v_changes || jsonb_build_object('amount',   OLD.amount,   'new_amount',   NEW.amount);
      END IF;
      IF OLD.paid_by IS DISTINCT FROM NEW.paid_by THEN
        v_changes := v_changes || jsonb_build_object('paid_by',  OLD.paid_by,  'new_paid_by',  NEW.paid_by);
      END IF;
      IF OLD.category IS DISTINCT FROM NEW.category THEN
        v_changes := v_changes || jsonb_build_object('category', OLD.category, 'new_category', NEW.category);
      END IF;
      IF OLD.date    IS DISTINCT FROM NEW.date    THEN
        v_changes := v_changes || jsonb_build_object('date',     OLD.date,     'new_date',     NEW.date);
      END IF;
      IF OLD.notes   IS DISTINCT FROM NEW.notes   THEN
        v_changes := v_changes || jsonb_build_object('notes',    OLD.notes,    'new_notes',    NEW.notes);
      END IF;

      IF v_changes <> '{}'::jsonb THEN
        INSERT INTO expense_audit_log (expense_id, edited_by, action, changes)
        VALUES (NEW.id, v_actor, 'edited', v_changes);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_expense_changed
  AFTER INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION handle_expense_audit();

-- ── 4. Split audit trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_expense_split_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_setting('app.skip_split_audit', true) = 'true' THEN
    RETURN NEW;
  END IF;

  INSERT INTO expense_audit_log (expense_id, edited_by, action, changes)
  VALUES (
    NEW.expense_id,
    COALESCE(auth.uid(), (SELECT created_by FROM expenses WHERE id = NEW.expense_id)),
    'split_added',
    jsonb_build_object('profile_id', NEW.profile_id, 'amount', NEW.amount)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_expense_split_added
  AFTER INSERT ON expense_splits
  FOR EACH ROW EXECUTE FUNCTION handle_expense_split_audit();
