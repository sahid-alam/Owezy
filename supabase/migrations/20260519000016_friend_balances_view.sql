-- ============================================================
-- Migration 20260519000016: friend_balances view
-- ============================================================
-- Derived, never stored. Balance = expense obligations − confirmed settlements.
-- auth.uid() filter: each user only sees pairs involving themselves.
-- View is SECURITY INVOKER (default) — RLS on underlying tables applies automatically.

CREATE OR REPLACE VIEW friend_balances AS
WITH expense_debts AS (
  -- Convention: positive component means user_b owes user_a.
  SELECT
    LEAST(e.paid_by, es.profile_id)    AS user_a,
    GREATEST(e.paid_by, es.profile_id) AS user_b,
    CASE WHEN e.paid_by = LEAST(e.paid_by, es.profile_id)
         THEN  es.amount   -- payer is user_a → debtor is user_b → positive
         ELSE -es.amount   -- payer is user_b → debtor is user_a → negative
    END AS component
  FROM expenses e
  JOIN expense_splits es ON es.expense_id = e.id
  WHERE e.deleted_at   IS NULL
    AND es.deleted_at  IS NULL
    AND e.paid_by     != es.profile_id   -- exclude own split row
    AND es.profile_id IS NOT NULL        -- skip guest splits (profile_id NULL)
    AND (e.paid_by = auth.uid() OR es.profile_id = auth.uid())  -- my pairs only
),
settlement_offsets AS (
  -- Same convention: positive = user_b owes user_a.
  SELECT
    LEAST(s.payer_id, s.payee_id)    AS user_a,
    GREATEST(s.payer_id, s.payee_id) AS user_b,
    CASE WHEN s.payer_id = LEAST(s.payer_id, s.payee_id)
         THEN  s.amount   -- user_a paid user_b → a's debt cleared → reduces a_owes_b → positive
         ELSE -s.amount   -- user_b paid user_a → b's debt cleared → negative
    END AS component
  FROM settlements s
  WHERE s.status     = 'confirmed'
    AND s.deleted_at IS NULL
    AND s.payee_id   IS NOT NULL
    AND (s.payer_id = auth.uid() OR s.payee_id = auth.uid())
)
SELECT
  combined.user_a,
  combined.user_b,
  ABS(SUM(combined.component))                                               AS net_amount,
  CASE WHEN SUM(combined.component) > 0 THEN 'b_owes_a' ELSE 'a_owes_b' END AS direction
FROM (
  SELECT user_a, user_b, component FROM expense_debts
  UNION ALL
  SELECT user_a, user_b, component FROM settlement_offsets
) combined
GROUP BY combined.user_a, combined.user_b
HAVING SUM(combined.component) <> 0;

GRANT SELECT ON friend_balances TO authenticated;
