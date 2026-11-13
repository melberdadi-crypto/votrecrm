-- Contenu ciblé par type de propriété (condo, maison, duplex, triplex, quadruplex, terrain)
--  - type_contenu « recherche » : vise les vendeurs (« On recherche un duplex : j'ai des acheteurs »)
--  - type_contenu « acheteurs » : vise les acheteurs (« Vous cherchez un duplex ? »)
alter table public.content_posts
  add column if not exists type_contenu text not null default 'conseil',
  add column if not exists cible jsonb;
alter table public.content_posts drop constraint if exists content_posts_type_contenu_check;
alter table public.content_posts
  add constraint content_posts_type_contenu_check check (type_contenu in ('conseil','recherche','acheteurs'));
comment on column public.content_posts.cible is 'Publications ciblées : {public, type_propriete, libelle, mot_cle, zone, budget, nb_acheteurs} (aucune donnée personnelle)';

alter table public.reel_scripts drop constraint if exists reel_scripts_type_check;
alter table public.reel_scripts
  add constraint reel_scripts_type_check check (type in ('conseil','nouveaute','recherche','acheteurs'));
alter table public.reel_scripts add column if not exists cible jsonb;

-- Suivi des leads : publication ou reel qui a amené le contact (lien ?campagne=<id> du site)
alter table public.contacts
  add column if not exists content_post_id uuid references public.content_posts(id) on delete set null,
  add column if not exists reel_script_id uuid references public.reel_scripts(id) on delete set null;
create index if not exists contacts_content_post_id_idx on public.contacts(content_post_id);
create index if not exists contacts_reel_script_id_idx on public.contacts(reel_script_id);
comment on column public.contacts.content_post_id is 'Publication qui a amené ce contact (campagne)';

-- Tâche planifiée (créée directement dans le projet, avec le secret du coffre) :
--   generate-content-ciblees-daily, '15 10 * * *', même appel que generate-content-daily avec body {"ciblees": true}
