create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'owner' check (role in ('owner', 'admin', 'broker')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 160),
  email text not null default '',
  phone text,
  project text not null default 'Achat' check (project in ('Achat', 'Vente', 'Estimation')),
  status text not null default 'Nouveau',
  initials text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  contact_name text not null,
  property_name text not null default '',
  property_location text not null default '',
  stage text not null default 'Nouveaux prospects' check (stage in ('Nouveaux prospects', 'Visite planifiée', 'Offre déposée', 'Signature')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  initials text not null default '',
  tone text not null default 'sand',
  last_activity text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_organization_id_idx on public.profiles (organization_id);
create index if not exists contacts_organization_created_idx on public.contacts (organization_id, created_at desc);
create index if not exists contacts_organization_status_idx on public.contacts (organization_id, status);
create index if not exists transactions_organization_stage_idx on public.transactions (organization_id, stage);
create index if not exists transactions_contact_id_idx on public.transactions (contact_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at before update on public.contacts for each row execute function public.set_updated_at();
drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.set_updated_at();

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_organization_id() from public;
grant execute on function public.current_organization_id() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
  requested_name text;
begin
  requested_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'Mon agence'), '@', 1));

  insert into public.organizations (name)
  values ('Agence ' || requested_name)
  returning id into new_organization_id;

  insert into public.profiles (id, organization_id, full_name, role)
  values (new.id, new_organization_id, requested_name, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "organization members can view organization" on public.organizations;
create policy "organization members can view organization"
on public.organizations for select to authenticated
using (id = public.current_organization_id());

drop policy if exists "members can view organization profiles" on public.profiles;
create policy "members can view organization profiles"
on public.profiles for select to authenticated
using (organization_id = public.current_organization_id());

drop policy if exists "members can update their own profile" on public.profiles;
create policy "members can update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and organization_id = public.current_organization_id());

drop policy if exists "members can view contacts" on public.contacts;
create policy "members can view contacts"
on public.contacts for select to authenticated
using (organization_id = public.current_organization_id());

drop policy if exists "members can create contacts" on public.contacts;
create policy "members can create contacts"
on public.contacts for insert to authenticated
with check (organization_id = public.current_organization_id() and created_by = auth.uid());

drop policy if exists "members can update contacts" on public.contacts;
create policy "members can update contacts"
on public.contacts for update to authenticated
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members can delete contacts" on public.contacts;
create policy "members can delete contacts"
on public.contacts for delete to authenticated
using (organization_id = public.current_organization_id());

drop policy if exists "members can view transactions" on public.transactions;
create policy "members can view transactions"
on public.transactions for select to authenticated
using (organization_id = public.current_organization_id());

drop policy if exists "members can create transactions" on public.transactions;
create policy "members can create transactions"
on public.transactions for insert to authenticated
with check (organization_id = public.current_organization_id() and created_by = auth.uid());

drop policy if exists "members can update transactions" on public.transactions;
create policy "members can update transactions"
on public.transactions for update to authenticated
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members can delete transactions" on public.transactions;
create policy "members can delete transactions"
on public.transactions for delete to authenticated
using (organization_id = public.current_organization_id());
