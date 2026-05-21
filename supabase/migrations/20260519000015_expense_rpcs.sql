-- Migration 20260519000015: expense SECURITY DEFINER RPCs
--
-- All expense mutations go through these four RPCs. SECURITY DEFINER means
-- the function owner (postgres, rolbypassrls=true) bypasses RLS. This avoids
-- the INSERT…RETURNING + AFTER trigger + RLS bootstrap problem seen in groups.
-- Auth is still enforced explicitly via auth.uid() checks inside each function.
--
-- Functions:
--   create_expense       — INSERT expense + splits atomically; audit suppressed for
--                          initial splits (logged as 'created' by expense trigger).
--   update_expense       — PATCH expense fields + optionally replace all splits.
--   add_expense_participants — add new participants to an equal-split expense;
--                          existing participants' amounts are updated (no audit),
--                          new participants' splits emit 'split_added' audit entries.
--   soft_delete_expense  — sets deleted_at on the expense (creator only).

-- ── create_expense ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_expense(
  p_title      text,
  p_amount     numeric,
  p_paid_by    uuid,
  p_group_id   uuid    DEFAULT NULL,
  p_trip_id    uuid    DEFAULT NULL,
  p_category   text    DEFAULT NULL,
  p_date       date    DEFAULT CURRENT_DATE,
  p_notes      text    DEFAULT NULL,
  p_split_type text    DEFAULT 'equal',
  p_splits     jsonb   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
  v_sum        numeric;
  v_split      jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_split_type NOT IN ('equal', 'custom', 'item') THEN
    RAISE EXCEPTION 'INVALID_SPLIT_TYPE';
  END IF;

  IF p_category IS NOT NULL AND p_category NOT IN (
    'food','transport','accommodation','entertainment',
    'groceries','shopping','utilities','other'
  ) THEN
    RAISE EXCEPTION 'INVALID_CATEGORY';
  END IF;

  IF p_splits IS NULL OR jsonb_array_length(p_splits) = 0 THEN
    RAISE EXCEPTION 'SPLITS_REQUIRED';
  END IF;

  -- Validate split sum ≈ total (within ±0.01)
  SELECT SUM((s->>'amount')::numeric)
  INTO v_sum
  FROM jsonb_array_elements(p_splits) AS s;

  IF ABS(v_sum - p_amount) > 0.01 THEN
    RAISE EXCEPTION 'SPLIT_SUM_MISMATCH';
  END IF;

  -- Validate paid_by appears in splits
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_splits) AS s
    WHERE (s->>'profile_id')::uuid = p_paid_by
  ) THEN
    RAISE EXCEPTION 'PAYER_NOT_IN_SPLITS';
  END IF;

  -- Validate context membership
  IF p_group_id IS NOT NULL AND NOT is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'NOT_GROUP_MEMBER';
  END IF;
  IF p_trip_id IS NOT NULL AND NOT is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'NOT_TRIP_MEMBER';
  END IF;

  -- Suppress split audit for initial splits; expense trigger logs 'created'
  PERFORM set_config('app.skip_split_audit', 'true', true);

  INSERT INTO expenses (title, amount, paid_by, group_id, trip_id, category, date, notes, split_type, created_by)
  VALUES (
    trim(p_title),
    p_amount,
    p_paid_by,
    p_group_id,
    p_trip_id,
    p_category,
    COALESCE(p_date, CURRENT_DATE),
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    p_split_type,
    auth.uid()
  )
  RETURNING id INTO v_expense_id;

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    IF v_split->>'profile_id' IS NOT NULL THEN
      INSERT INTO expense_splits (expense_id, profile_id, amount)
      VALUES (v_expense_id, (v_split->>'profile_id')::uuid, (v_split->>'amount')::numeric);
    ELSIF v_split->>'guest_id' IS NOT NULL THEN
      INSERT INTO expense_splits (expense_id, guest_id, amount)
      VALUES (v_expense_id, (v_split->>'guest_id')::uuid, (v_split->>'amount')::numeric);
    END IF;
  END LOOP;

  PERFORM set_config('app.skip_split_audit', 'false', true);

  RETURN v_expense_id;
END;
$$;

-- ── update_expense ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_expense(
  p_expense_id uuid,
  p_patch      jsonb,
  p_new_splits jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_expense    expenses%ROWTYPE;
  v_sum        numeric;
  v_new_amount numeric;
  v_split      jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_expense
  FROM expenses
  WHERE id = p_expense_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXPENSE_NOT_FOUND';
  END IF;

  IF v_expense.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'NOT_CREATOR';
  END IF;

  -- If splits are being replaced, validate sum against final amount
  IF p_new_splits IS NOT NULL THEN
    v_new_amount := COALESCE((p_patch->>'amount')::numeric, v_expense.amount);

    SELECT SUM((s->>'amount')::numeric)
    INTO v_sum
    FROM jsonb_array_elements(p_new_splits) AS s;

    IF ABS(v_sum - v_new_amount) > 0.01 THEN
      RAISE EXCEPTION 'SPLIT_SUM_MISMATCH';
    END IF;
  END IF;

  UPDATE expenses SET
    title    = CASE WHEN p_patch ? 'title'    THEN trim(p_patch->>'title')                 ELSE title    END,
    amount   = CASE WHEN p_patch ? 'amount'   THEN (p_patch->>'amount')::numeric            ELSE amount   END,
    paid_by  = CASE WHEN p_patch ? 'paid_by'  THEN (p_patch->>'paid_by')::uuid              ELSE paid_by  END,
    category = CASE WHEN p_patch ? 'category' THEN p_patch->>'category'                     ELSE category END,
    date     = CASE WHEN p_patch ? 'date'     THEN (p_patch->>'date')::date                 ELSE date     END,
    notes    = CASE WHEN p_patch ? 'notes'    THEN NULLIF(trim(p_patch->>'notes'), '')       ELSE notes    END
  WHERE id = p_expense_id;

  IF p_new_splits IS NOT NULL THEN
    PERFORM set_config('app.skip_split_audit', 'true', true);

    UPDATE expense_splits
    SET deleted_at = now()
    WHERE expense_id = p_expense_id AND deleted_at IS NULL;

    FOR v_split IN SELECT * FROM jsonb_array_elements(p_new_splits)
    LOOP
      IF v_split->>'profile_id' IS NOT NULL THEN
        INSERT INTO expense_splits (expense_id, profile_id, amount)
        VALUES (p_expense_id, (v_split->>'profile_id')::uuid, (v_split->>'amount')::numeric);
      ELSIF v_split->>'guest_id' IS NOT NULL THEN
        INSERT INTO expense_splits (expense_id, guest_id, amount)
        VALUES (p_expense_id, (v_split->>'guest_id')::uuid, (v_split->>'amount')::numeric);
      END IF;
    END LOOP;

    PERFORM set_config('app.skip_split_audit', 'false', true);
  END IF;
END;
$$;

-- ── add_expense_participants ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION add_expense_participants(
  p_expense_id     uuid,
  p_new_profile_ids uuid[],
  p_new_splits     jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_expense      expenses%ROWTYPE;
  v_sum          numeric;
  v_existing_ids uuid[];
  v_split        jsonb;
  v_profile_id   uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_expense
  FROM expenses
  WHERE id = p_expense_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'EXPENSE_NOT_FOUND'; END IF;
  IF v_expense.created_by <> auth.uid() THEN RAISE EXCEPTION 'NOT_CREATOR'; END IF;
  IF v_expense.split_type <> 'equal' THEN RAISE EXCEPTION 'EQUAL_SPLIT_ONLY'; END IF;

  -- Validate new split total ≈ expense amount
  SELECT SUM((s->>'amount')::numeric)
  INTO v_sum
  FROM jsonb_array_elements(p_new_splits) AS s;

  IF ABS(v_sum - v_expense.amount) > 0.01 THEN
    RAISE EXCEPTION 'SPLIT_SUM_MISMATCH';
  END IF;

  -- Collect existing active participant IDs
  SELECT ARRAY_AGG(profile_id) INTO v_existing_ids
  FROM expense_splits
  WHERE expense_id = p_expense_id
    AND profile_id IS NOT NULL
    AND deleted_at IS NULL;

  v_existing_ids := COALESCE(v_existing_ids, ARRAY[]::uuid[]);

  -- Update existing participants' amounts (no audit)
  PERFORM set_config('app.skip_split_audit', 'true', true);

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_new_splits)
  LOOP
    v_profile_id := (v_split->>'profile_id')::uuid;
    IF v_profile_id IS NOT NULL AND v_profile_id = ANY(v_existing_ids) THEN
      UPDATE expense_splits
      SET amount = (v_split->>'amount')::numeric
      WHERE expense_id = p_expense_id
        AND profile_id = v_profile_id
        AND deleted_at IS NULL;
    END IF;
  END LOOP;

  PERFORM set_config('app.skip_split_audit', 'false', true);

  -- Insert new participants (split audit fires here)
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_new_splits)
  LOOP
    v_profile_id := (v_split->>'profile_id')::uuid;
    IF v_profile_id IS NOT NULL AND NOT (v_profile_id = ANY(v_existing_ids)) THEN
      INSERT INTO expense_splits (expense_id, profile_id, amount)
      VALUES (p_expense_id, v_profile_id, (v_split->>'amount')::numeric);
    END IF;
  END LOOP;
END;
$$;

-- ── soft_delete_expense ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION soft_delete_expense(p_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE expenses
  SET deleted_at = now()
  WHERE id = p_expense_id
    AND deleted_at IS NULL
    AND created_by = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXPENSE_NOT_FOUND_OR_NOT_CREATOR';
  END IF;
END;
$$;
