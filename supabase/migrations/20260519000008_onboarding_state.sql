-- ============================================================
-- Migration 20260519000008: onboarding_state + avatars bucket
-- Adds skip-tracking flags to profiles; creates avatars storage bucket.
-- No RLS changes on profiles — existing UPDATE policy covers new columns.
-- ============================================================

alter table profiles
  add column onboarding_phone_skipped boolean not null default false,
  add column onboarding_upi_skipped   boolean not null default false;

-- Public bucket — avatar_url stored on profile is a direct public URL
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Authenticated users can read any avatar
create policy "avatars: authenticated read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

-- Users can only upload into their own folder: {userId}/{filename}
-- Path must NOT include the bucket name — bucket_id check handles that.
-- foldername(name)[1] = first path segment = userId
create policy "avatars: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: update own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
