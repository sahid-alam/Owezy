-- ============================================================
-- Migration 20260519000021: trip query RPCs
-- ============================================================

-- 1. get_trip_balances — trip-scoped pair balances (mirrors friend_balances math)
-- SECURITY DEFINER so it works from service-role context (no auth.uid() required).
-- When called by an authenticated user, membership is checked.
CREATE OR REPLACE FUNCTION get_trip_balances(p_trip_id uuid)
RETURNS TABLE(user_a uuid, user_b uuid, net_amount numeric, direction text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'NOT_TRIP_MEMBER';
  END IF;

  RETURN QUERY
  WITH expense_debts AS (
    SELECT
      LEAST(e.paid_by, es.profile_id)    AS ua,
      GREATEST(e.paid_by, es.profile_id) AS ub,
      CASE WHEN e.paid_by = LEAST(e.paid_by, es.profile_id)
           THEN  es.amount
           ELSE -es.amount END AS component
    FROM expenses e
    JOIN expense_splits es ON es.expense_id = e.id
    WHERE e.trip_id      = p_trip_id
      AND e.deleted_at   IS NULL
      AND es.deleted_at  IS NULL
      AND e.paid_by      != es.profile_id
      AND es.profile_id  IS NOT NULL
  ),
  settlement_offsets AS (
    SELECT
      LEAST(s.payer_id, s.payee_id)    AS ua,
      GREATEST(s.payer_id, s.payee_id) AS ub,
      CASE WHEN s.payer_id = LEAST(s.payer_id, s.payee_id)
           THEN  s.amount
           ELSE -s.amount END AS component
    FROM settlements s
    WHERE s.trip_id    = p_trip_id
      AND s.status     = 'confirmed'
      AND s.deleted_at IS NULL
      AND s.payee_id   IS NOT NULL
  )
  SELECT
    combined.ua                                                                           AS user_a,
    combined.ub                                                                           AS user_b,
    ABS(SUM(combined.component))::numeric                                                 AS net_amount,
    CASE WHEN SUM(combined.component) > 0 THEN 'b_owes_a'::text ELSE 'a_owes_b'::text END AS direction
  FROM (
    SELECT ua, ub, component FROM expense_debts
    UNION ALL
    SELECT ua, ub, component FROM settlement_offsets
  ) combined
  GROUP BY combined.ua, combined.ub
  HAVING ABS(SUM(combined.component)) >= 0.01;
END;
$$;
GRANT EXECUTE ON FUNCTION get_trip_balances(uuid) TO authenticated;


-- 2. get_trip_summary — totals + top categories + trip data for recap card
CREATE OR REPLACE FUNCTION get_trip_summary(p_trip_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trip         trips%ROWTYPE;
  v_total        numeric;
  v_member_count int;
  v_top_cats     jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'NOT_TRIP_MEMBER';
  END IF;

  SELECT * INTO v_trip FROM trips WHERE id = p_trip_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM expenses WHERE trip_id = p_trip_id AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_member_count
  FROM trip_members WHERE trip_id = p_trip_id AND deleted_at IS NULL;

  SELECT jsonb_agg(row ORDER BY row_amount DESC) INTO v_top_cats FROM (
    SELECT
      jsonb_build_object(
        'category', COALESCE(category, 'other'),
        'amount',   SUM(amount),
        'pct',      ROUND(100.0 * SUM(amount) / NULLIF(v_total, 0), 1)
      ) AS row,
      SUM(amount) AS row_amount
    FROM expenses
    WHERE trip_id = p_trip_id AND deleted_at IS NULL
    GROUP BY COALESCE(category, 'other')
    ORDER BY row_amount DESC
    LIMIT 3
  ) cats;

  RETURN jsonb_build_object(
    'total_spent',    v_total,
    'member_count',   v_member_count,
    'days',           GREATEST(1, v_trip.end_date - v_trip.start_date + 1),
    'top_categories', COALESCE(v_top_cats, '[]'::jsonb),
    'trip', jsonb_build_object(
      'id',           v_trip.id,
      'name',         v_trip.name,
      'destination',  v_trip.destination,
      'start_date',   v_trip.start_date,
      'end_date',     v_trip.end_date,
      'budget',       v_trip.budget,
      'daily_budget', v_trip.daily_budget
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_trip_summary(uuid) TO authenticated;


-- 3. get_trip_personal_insights — raw per-member stats; badges computed client-side
CREATE OR REPLACE FUNCTION get_trip_personal_insights(p_trip_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_trip_member(p_trip_id) THEN
    RAISE EXCEPTION 'NOT_TRIP_MEMBER';
  END IF;

  SELECT jsonb_agg(member_stats) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'profile_id',           tm.profile_id,
      'name',                 p.name,
      'avatar_url',           p.avatar_url,
      'expenses_paid_count',  COUNT(DISTINCT e_paid.id),
      'total_paid',           COALESCE(SUM(DISTINCT e_paid.amount) FILTER (WHERE e_paid.id IS NOT NULL), 0),
      'own_share',            COALESCE((
        SELECT SUM(es2.amount) FROM expense_splits es2
        JOIN expenses e2 ON e2.id = es2.expense_id
        WHERE e2.trip_id = p_trip_id AND e2.deleted_at IS NULL
          AND es2.deleted_at IS NULL AND es2.profile_id = tm.profile_id
      ), 0),
      'top_category', (
        SELECT COALESCE(e3.category, 'other')
        FROM expenses e3 WHERE e3.trip_id = p_trip_id AND e3.deleted_at IS NULL
          AND e3.paid_by = tm.profile_id
        GROUP BY COALESCE(e3.category, 'other')
        ORDER BY COUNT(*) DESC LIMIT 1
      ),
      'avg_settle_secs', (
        SELECT AVG(EXTRACT(EPOCH FROM (s.confirmed_at - s.created_at)))
        FROM settlements s
        WHERE s.trip_id      = p_trip_id
          AND s.payer_id     = tm.profile_id
          AND s.status       = 'confirmed'
          AND s.confirmed_at IS NOT NULL
          AND s.deleted_at   IS NULL
      )
    ) AS member_stats
    FROM trip_members tm
    JOIN profiles p ON p.id = tm.profile_id
    LEFT JOIN expenses e_paid ON e_paid.trip_id = p_trip_id
      AND e_paid.paid_by = tm.profile_id AND e_paid.deleted_at IS NULL
    WHERE tm.trip_id = p_trip_id AND tm.deleted_at IS NULL
    GROUP BY tm.profile_id, p.name, p.avatar_url
    ORDER BY p.name
  ) stats;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION get_trip_personal_insights(uuid) TO authenticated;
