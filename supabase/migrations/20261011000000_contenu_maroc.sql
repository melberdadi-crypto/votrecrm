-- Contenu pour le marché marocain (Casablanca, Marrakech, El Jadida, Mohammedia, Rabat, Tanger) :
-- chaque idée de publication et chaque script de Reel appartient à un marché ('quebec' ou 'maroc').
alter table public.content_posts
  add column if not exists marche text not null default 'quebec' check (marche in ('quebec', 'maroc'));
alter table public.reel_scripts
  add column if not exists marche text not null default 'quebec' check (marche in ('quebec', 'maroc'));

-- Signature des publications destinées au Maroc (avec le numéro marocain)
alter table public.content_settings
  add column if not exists signature_maroc text not null
  default 'Mohamed El Berhdadi · Immobilier au Maroc · WhatsApp / Tél. : +212 664 908 900';

create index if not exists content_posts_org_marche_date_idx on public.content_posts (organization_id, marche, post_date desc);
create index if not exists reel_scripts_org_marche_date_idx on public.reel_scripts (organization_id, marche, script_date desc);
