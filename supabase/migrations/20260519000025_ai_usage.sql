-- Migration 20260519000025: ai_usage table for rate limiting AI features
-- Tracks per-user AI request counts server-side; client shows count as a UX hint only.
-- Rate limit check happens in Edge Functions via get_my_ai_usage_count RPC.

CREATE TABLE ai_usage (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type text        NOT NULL CHECK (request_type IN ('ocr','split','quick_add','retry')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_usage_profile_created ON ai_usage (profile_id, created_at DESC);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_select_own" ON ai_usage FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "ai_usage_insert_own" ON ai_usage FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Server-side count — called from Edge Functions with anon key + caller's JWT.
-- SECURITY DEFINER bypasses ai_usage RLS so it also works under service-role context.
CREATE OR REPLACE FUNCTION get_my_ai_usage_count(p_hours int DEFAULT 24)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*) FROM ai_usage
  WHERE profile_id = auth.uid()
    AND created_at >= now() - (p_hours || ' hours')::interval;
$$;
GRANT EXECUTE ON FUNCTION get_my_ai_usage_count(int) TO authenticated;
