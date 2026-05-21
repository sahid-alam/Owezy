-- Two SECURITY DEFINER RPCs for group member management.
-- add_group_member: admin-gated INSERT (bypasses the bootstrap deadlock described in migration 3).
-- leave_group: allows any active member to leave; enforces last-admin rule at DB layer.

create or replace function add_group_member(p_group_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_already_member boolean;
begin
  select exists(
    select 1 from group_members
    where group_id = p_group_id
      and profile_id = auth.uid()
      and role = 'admin'
      and deleted_at is null
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'NOT_ADMIN';
  end if;

  select exists(
    select 1 from group_members
    where group_id = p_group_id
      and profile_id = p_profile_id
      and deleted_at is null
  ) into v_already_member;

  if v_already_member then
    raise exception 'ALREADY_MEMBER';
  end if;

  insert into group_members (group_id, profile_id, role)
  values (p_group_id, p_profile_id, 'member');

  update groups set updated_at = now() where id = p_group_id;
end;
$$;

create or replace function leave_group(p_group_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_role text;
  v_other_admin_count integer;
begin
  select role into v_caller_role
  from group_members
  where group_id = p_group_id
    and profile_id = auth.uid()
    and deleted_at is null;

  if v_caller_role is null then
    raise exception 'NOT_A_MEMBER';
  end if;

  if v_caller_role = 'admin' then
    select count(*) into v_other_admin_count
    from group_members
    where group_id = p_group_id
      and role = 'admin'
      and profile_id != auth.uid()
      and deleted_at is null;

    if v_other_admin_count = 0 then
      raise exception 'LAST_ADMIN';
    end if;
  end if;

  update group_members
  set left_at = now(), deleted_at = now()
  where group_id = p_group_id
    and profile_id = auth.uid()
    and deleted_at is null;

  update groups set updated_at = now() where id = p_group_id;
end;
$$;
