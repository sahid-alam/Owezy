-- Migration 20260519000013: fix groups UPDATE policy
--
-- Bug: the original policy compared group_members.group_id = group_members.id
-- (a self-reference within the subquery) instead of group_members.group_id = groups.id
-- (correlating back to the groups row being updated). The condition was never true,
-- so all UPDATE operations on groups silently matched 0 rows.

DROP POLICY IF EXISTS "groups: admins can update" ON groups;

CREATE POLICY "groups: admins can update"
  ON groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
        AND group_members.profile_id = auth.uid()
        AND group_members.role = 'admin'
        AND group_members.deleted_at IS NULL
    )
  );
