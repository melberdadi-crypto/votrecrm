alter table public.contacts add column if not exists consent_email boolean not null default false;
alter table public.contacts add column if not exists consent_sms boolean not null default false;
alter table public.contacts add column if not exists unsubscribed_at timestamptz;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 2 and 180),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo','in_progress','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz not null,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  title text not null check (char_length(title) between 2 and 180),
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text not null default '',
  notes text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_valid_range check (end_at > start_at)
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 180),
  channel text not null check (channel in ('email','sms')),
  trigger_type text not null check (trigger_type in ('manual','inactivity','stage_change','appointment_reminder')),
  delay_minutes integer not null default 0 check (delay_minutes between 0 and 525600),
  template text not null check (char_length(template) between 2 and 2000),
  active boolean not null default false,
  ai_enabled boolean not null default false,
  consent_required boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  channel text not null check (channel in ('email','sms')),
  provider text not null,
  status text not null check (status in ('queued','sent','delivered','failed','blocked','unsubscribed')),
  body text not null default '',
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'trial' check (plan in ('trial','solo','agency','pro_ai')),
  status text not null default 'inactive',
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','yearly')),
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_organization_due_idx on public.tasks (organization_id, due_at);
create index if not exists appointments_organization_start_idx on public.appointments (organization_id, start_at);
create index if not exists automation_rules_organization_active_idx on public.automation_rules (organization_id, active);
create index if not exists message_logs_organization_created_idx on public.message_logs (organization_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_organization_id uuid;
declare requested_name text;
declare requested_agency text;
begin
  requested_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'Utilisateur'), '@', 1));
  requested_agency := coalesce(nullif(trim(new.raw_user_meta_data ->> 'agency_name'), ''), 'Agence ' || requested_name);
  insert into public.organizations (name) values (requested_agency) returning id into new_organization_id;
  insert into public.profiles (id, organization_id, full_name, role) values (new.id, new_organization_id, requested_name, 'owner');
  return new;
end; $$;

alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.automation_rules enable row level security;
alter table public.message_logs enable row level security;
alter table public.subscriptions enable row level security;

do $$ declare t text; begin
  foreach t in array array['tasks','appointments','automation_rules'] loop
    execute format('drop policy if exists "members select %1$s" on public.%1$I', t);
    execute format('create policy "members select %1$s" on public.%1$I for select to authenticated using (organization_id = public.current_organization_id())', t);
    execute format('drop policy if exists "members insert %1$s" on public.%1$I', t);
    execute format('create policy "members insert %1$s" on public.%1$I for insert to authenticated with check (organization_id = public.current_organization_id() and created_by = auth.uid())', t);
    execute format('drop policy if exists "members update %1$s" on public.%1$I', t);
    execute format('create policy "members update %1$s" on public.%1$I for update to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id())', t);
    execute format('drop policy if exists "members delete %1$s" on public.%1$I', t);
    execute format('create policy "members delete %1$s" on public.%1$I for delete to authenticated using (organization_id = public.current_organization_id())', t);
  end loop;
end $$;

drop policy if exists "members view message logs" on public.message_logs;
create policy "members view message logs" on public.message_logs for select to authenticated using (organization_id = public.current_organization_id());
drop policy if exists "members view subscription" on public.subscriptions;
create policy "members view subscription" on public.subscriptions for select to authenticated using (organization_id = public.current_organization_id());

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();
drop trigger if exists automation_rules_set_updated_at on public.automation_rules;
create trigger automation_rules_set_updated_at before update on public.automation_rules for each row execute function public.set_updated_at();
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
