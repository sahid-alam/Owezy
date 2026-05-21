-- Fix avg_settle_secs: was a cartesian join expenses×settlements.
-- Correct: time from settlement initiation to confirmation, scoped to trip.
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
