-- Migration 20260519000012: create_group SECURITY DEFINER RPC
--
-- Root cause of the INSERT failure:
--   INSERT ... RETURNING evaluates the SELECT policy (is_group_member) before
--   the AFTER trigger (handle_new_group) fires. At evaluation time the creator
--   is not yet in group_members, so is_group_member returns false, PostgreSQL
--   raises 42501. INSERT without RETURNING works fine — this is a known
--   AFTER-trigger + RETURNING + RLS interaction in PostgreSQL.
--
-- Fix: route all group creation through a SECURITY DEFINER RPC. The function
--   owner (postgres, rolbypassrls=true) bypasses RLS on the INSERT entirely;
--   the trigger still fires and adds the creator as admin; we return just the
--   UUID so there is no RETURNING-over-SELECT-policy issue.
--
-- The original INSERT policy is also restored (the debug policy from diagnosis
--   is dropped).

-- ── Restore correct INSERT policy ────────────────────────────────────────────
DROP POLICY IF EXISTS "groups: debug any insert" ON groups;
DROP POLICY IF EXISTS "groups: any auth user can create" ON groups;

CREATE POLICY "groups: any auth user can create"
  ON groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ── create_group RPC ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_group(p_name text, p_description text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  INSERT INTO groups (name, description, created_by)
  VALUES (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_group_id;

  RETURN v_group_id;
END;
$$;
