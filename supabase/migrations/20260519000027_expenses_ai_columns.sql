-- Migration 20260519000027: receipt_path column on expenses + extend create_expense RPC
-- Adds receipt_path text (nullable) to store storage path of uploaded receipt.
-- Extends create_expense with p_ai_parsed + p_receipt_path as trailing DEFAULT params
-- so all existing callers remain unaffected (they get false/null by default).

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_path text;

-- Full CREATE OR REPLACE — body identical to migration 15 except INSERT line adds
-- ai_parsed and receipt_path columns.
CREATE OR REPLACE FUNCTION create_expense(
  p_title        text,
  p_amount       numeric,
  p_paid_by      uuid,
  p_group_id     uuid    DEFAULT NULL,
  p_trip_id      uuid    DEFAULT NULL,
  p_category     text    DEFAULT NULL,
  p_date         date    DEFAULT CURRENT_DATE,
  p_notes        text    DEFAULT NULL,
  p_split_type   text    DEFAULT 'equal',
  p_splits       jsonb   DEFAULT NULL,
  p_ai_parsed    boolean DEFAULT false,
  p_receipt_path text    DEFAULT NULL
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

  INSERT INTO expenses (title, amount, paid_by, group_id, trip_id, category, date, notes, split_type, ai_parsed, receipt_path, created_by)
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
    p_ai_parsed,
    p_receipt_path,
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

GRANT EXECUTE ON FUNCTION create_expense(text,numeric,uuid,uuid,uuid,text,date,text,text,jsonb,boolean,text) TO authenticated;
