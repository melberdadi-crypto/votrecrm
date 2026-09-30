-- Storage bucket for property photo/video uploads from the CRM's property
-- form, plus a video_url column to store the generated promotional video.
-- Applied live on 2026-09-30; recorded here so this repo's migration
-- history matches the actual database.

alter table public.properties add column if not exists video_url text;
comment on column public.properties.video_url is 'Public URL of an AI-style generated promotional video (Ken Burns photo slideshow), stored in the property-media bucket.';

insert into storage.buckets (id, name, public)
values ('property-media', 'property-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read property media" on storage.objects;
create policy "Public read property media" on storage.objects
  for select to public
  using (bucket_id = 'property-media');

drop policy if exists "Authenticated upload property media" on storage.objects;
create policy "Authenticated upload property media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-media');

drop policy if exists "Authenticated update own property media" on storage.objects;
create policy "Authenticated update own property media" on storage.objects
  for update to authenticated
  using (bucket_id = 'property-media');

drop policy if exists "Authenticated delete own property media" on storage.objects;
create policy "Authenticated delete own property media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-media');
