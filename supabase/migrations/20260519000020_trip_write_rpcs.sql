-- ============================================================
-- Migration 20260519000020: trip write RPCs + schema extensions
-- ============================================================

-- 1. Add daily_budget column (total budget already exists as 'budget')
ALTER TABLE trips ADD COLUMN IF NOT EXISTS daily_budget numeric(10,2);

-- 2. create_trip — SECURITY DEFINER bypass for INSERT+AFTER trigger+RLS issue
CREATE OR REPLACE FUNCTION create_trip(
  p_name         text,
  p_destination  text    DEFAULT NULL,
  p_start_date   date    DEFAULT CURRENT_DATE,
  p_end_date     date    DEFAULT CURRENT_DATE,
  p_budget       numeric DEFAULT NULL,
  p_daily_budget numeric DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_end_date < p_start_date THEN RAISE EXCEPTION 'INVALID_DATES'; END IF;

  INSERT INTO trips (name, destination, start_date, end_date, budget, daily_budget, created_by)
  VALUES (p_name, p_destination, p_start_date, p_end_date, p_budget, p_daily_budget, auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION create_trip(text, text, date, date, numeric, numeric) TO authenticated;

-- 3. add_trip_member — admin-gated, mirrors add_group_member pattern
CREATE OR REPLACE FUNCTION add_trip_member(
  p_trip_id    uuid,
  p_profile_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id AND profile_id = v_caller AND role = 'admin' AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  IF EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id AND profile_id = p_profile_id AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'ALREADY_MEMBER'; END IF;

  INSERT INTO trip_members (trip_id, profile_id, role)
  VALUES (p_trip_id, p_profile_id, 'member');

  UPDATE trips SET updated_at = now() WHERE id = p_trip_id;
END;
$$;
GRANT EXECUTE ON FUNCTION add_trip_member(uuid, uuid) TO authenticated;

-- 4. leave_trip — mirrors leave_group (last-admin guard)
CREATE OR REPLACE FUNCTION leave_trip(
  p_trip_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_role        text;
  v_admin_count int;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT role INTO v_role FROM trip_members
  WHERE trip_id = p_trip_id AND profile_id = v_caller AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_A_MEMBER'; END IF;

  IF v_role = 'admin' THEN
    SELECT count(*) INTO v_admin_count FROM trip_members
    WHERE trip_id = p_trip_id AND role = 'admin' AND deleted_at IS NULL;
    IF v_admin_count <= 1 THEN RAISE EXCEPTION 'LAST_ADMIN'; END IF;
  END IF;

  UPDATE trip_members
  SET deleted_at = now()
  WHERE trip_id = p_trip_id AND profile_id = v_caller AND deleted_at IS NULL;

  UPDATE trips SET updated_at = now() WHERE id = p_trip_id;
END;
$$;
GRANT EXECUTE ON FUNCTION leave_trip(uuid) TO authenticated;

-- 5. set_trip_member_role — promote or demote, admin-gated
CREATE OR REPLACE FUNCTION set_trip_member_role(
  p_trip_id    uuid,
  p_profile_id uuid,
  p_role       text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id AND profile_id = v_caller AND role = 'admin' AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'NOT_ADMIN'; END IF;

  IF p_profile_id = v_caller AND p_role = 'member' THEN
    IF (SELECT count(*) FROM trip_members WHERE trip_id = p_trip_id AND role = 'admin' AND deleted_at IS NULL) <= 1
    THEN RAISE EXCEPTION 'LAST_ADMIN'; END IF;
  END IF;

  UPDATE trip_members SET role = p_role
  WHERE trip_id = p_trip_id AND profile_id = p_profile_id AND deleted_at IS NULL;

  UPDATE trips SET updated_at = now() WHERE id = p_trip_id;
END;
$$;
GRANT EXECUTE ON FUNCTION set_trip_member_role(uuid, uuid, text) TO authenticated;
