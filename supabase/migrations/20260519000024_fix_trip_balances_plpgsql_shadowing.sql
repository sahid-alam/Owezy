-- Fix: RETURNS TABLE column names user_a/user_b shadow CTE aliases inside PL/pgSQL.
-- Rename CTE aliases to ua/ub to eliminate the ambiguity.
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
