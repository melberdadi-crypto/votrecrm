-- Extend properties table to support international listings shown on the
-- public website (mohamedelberhdadi.ca — section "Immobilier International").
-- Applied live on 2026-09-30; recorded here so the migration history in this
-- repo matches the actual database schema.

alter table public.properties
  add column if not exists slug text unique,
  add column if not exists titre text,
  add column if not exists pays text,
  add column if not exists ville text,
  add column if not exists region text,
  add column if not exists drapeau text,
  add column if not exists code_postal text,
  add column if not exists devise text default 'CAD',
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists superficie_m2 numeric,
  add column if not exists caracteristiques text[] default '{}',
  add column if not exists photos text[] default '{}',
  add column if not exists international boolean not null default false,
  add column if not exists published boolean not null default false,
  add column if not exists demo boolean not null default false,
  -- Display status for international listings (À vendre / À louer / Nouveau /
  -- Vedette) — kept separate from the CRM-internal "status" enum (Disponible
  -- / Sous offre / Vendue / Retirée), which uses a different check constraint.
  add column if not exists statut text;

comment on column public.properties.international is 'True when this listing belongs to the public "Immobilier International" section of the website.';
comment on column public.properties.published is 'True when the listing should be publicly visible on the website (paired with international=true).';
comment on column public.properties.demo is 'True when this row is demonstration data, not a real listing.';
comment on column public.properties.statut is 'Display status for international listings — separate from the CRM-internal "status" enum.';

-- Public (anonymous) read access limited strictly to published international listings
drop policy if exists "Public can view published international properties" on public.properties;
create policy "Public can view published international properties"
  on public.properties
  for select
  to anon
  using (international = true and published = true);
