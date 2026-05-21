-- ============================================================
-- Migration 20260519000017: settlement RPCs
-- ============================================================

-- ── initiate_settlement ────────────────────────────────────────
CREATE OR REPLACE FUNCTION initiate_settlement(
  p_payee_id uuid,
  p_amount   numeric,
  p_note     text    DEFAULT NULL,
  p_group_id uuid    DEFAULT NULL,
  p_trip_id  uuid    DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_id     uuid;
BEGIN
  IF v_caller IS NULL      THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_payee_id = v_caller THEN RAISE EXCEPTION 'SELF_SETTLE';       END IF;
  IF p_amount <= 0         THEN RAISE EXCEPTION 'INVALID_AMOUNT';    END IF;

  INSERT INTO settlements (payer_id, payee_id, amount, note, group_id, trip_id, status)
  VALUES (v_caller, p_payee_id, p_amount, p_note, p_group_id, p_trip_id, 'initiated')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION initiate_settlement(uuid, numeric, text, uuid, uuid) TO authenticated;


-- ── mark_settlement_paid ───────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_settlement_paid(
  p_settlement_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_rec    settlements%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_rec FROM settlements WHERE id = p_settlement_id AND deleted_at IS NULL;
  IF NOT FOUND                   THEN RAISE EXCEPTION 'NOT_FOUND';    END IF;
  IF v_rec.payer_id <> v_caller  THEN RAISE EXCEPTION 'NOT_PAYER';    END IF;
  IF v_rec.status <> 'initiated' THEN RAISE EXCEPTION 'WRONG_STATUS'; END IF;

  UPDATE settlements SET status = 'paid', paid_at = now() WHERE id = p_settlement_id;
END;
$$;
GRANT EXECUTE ON FUNCTION mark_settlement_paid(uuid) TO authenticated;


-- ── confirm_settlement ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_settlement(
  p_settlement_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_rec    settlements%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_rec FROM settlements WHERE id = p_settlement_id AND deleted_at IS NULL;
  IF NOT FOUND                  THEN RAISE EXCEPTION 'NOT_FOUND';    END IF;
  IF v_rec.payee_id <> v_caller THEN RAISE EXCEPTION 'NOT_PAYEE';    END IF;
  IF v_rec.status <> 'paid'     THEN RAISE EXCEPTION 'WRONG_STATUS'; END IF;

  UPDATE settlements SET status = 'confirmed', confirmed_at = now() WHERE id = p_settlement_id;
END;
$$;
GRANT EXECUTE ON FUNCTION confirm_settlement(uuid) TO authenticated;


-- ── dispute_settlement ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION dispute_settlement(
  p_settlement_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_rec    settlements%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_rec FROM settlements WHERE id = p_settlement_id AND deleted_at IS NULL;
  IF NOT FOUND                  THEN RAISE EXCEPTION 'NOT_FOUND';    END IF;
  IF v_rec.payee_id <> v_caller THEN RAISE EXCEPTION 'NOT_PAYEE';    END IF;
  IF v_rec.status <> 'paid'     THEN RAISE EXCEPTION 'WRONG_STATUS'; END IF;

  UPDATE settlements SET status = 'initiated', paid_at = NULL WHERE id = p_settlement_id;
END;
$$;
GRANT EXECUTE ON FUNCTION dispute_settlement(uuid) TO authenticated;
