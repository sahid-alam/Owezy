-- ============================================================
-- Migration 20260519000009: remove email prefix from handle_new_user
-- Email users must set their display name explicitly in the onboarding wizard.
-- OAuth users (Google) still get full_name from raw_user_meta_data.
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url, phone)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    ),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.phone, new.raw_user_meta_data->>'phone')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
