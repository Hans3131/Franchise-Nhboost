-- ============================================================
-- NHBoost — Schéma Supabase complet
-- Version : avril 2026
-- À exécuter dans l'éditeur SQL du dashboard Supabase
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────────
create extension if not exists "pgcrypto";


-- ============================================================
-- TABLES
-- ============================================================

-- ─── Profils franchisés ───────────────────────────────────────
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  company_name   text,
  franchise_code text unique,
  phone          text,
  address        text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ─── Commandes ────────────────────────────────────────────────
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  ref               text unique,

  -- Service
  service           text not null,

  -- Contact client
  client_name       text,
  client_email      text,
  client_phone      text,

  -- Entreprise
  company_name      text,
  company_email     text,
  sector            text,

  -- Projet
  brief             text,
  objectives        text,
  required_access   text,

  -- Finance
  price             numeric(10,2) default 0,
  status            text default 'pending'
                      check (status in ('pending','in_progress','completed','cancelled')),
  payment_status    text default 'unpaid'
                      check (payment_status in ('paid','unpaid','refunded')),
  stripe_session_id text,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─── Tickets support ──────────────────────────────────────────
create table if not exists public.support_tickets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  ref        text unique,
  subject    text not null,
  message    text not null,
  priority   text default 'medium'
               check (priority in ('low','medium','high')),
  status     text default 'open'
               check (status in ('open','in_progress','resolved')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── Notifications ────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  type       text not null
               check (type in ('order_placed','order_status','ticket_created','system')),
  title      text not null,
  message    text not null,
  link       text,
  read       boolean default false,
  created_at timestamptz default now()
);


-- ============================================================
-- FONCTIONS & TRIGGERS
-- ============================================================

-- ─── Auto-référence commandes (CMD-YYYY-XXXX) ─────────────────
create or replace function public.set_order_ref()
returns trigger language plpgsql as $$
begin
  if new.ref is null then
    new.ref := 'CMD-' || to_char(now(), 'YYYY') || '-'
      || lpad(
           ((select count(*) from public.orders where ref like 'CMD-' || to_char(now(),'YYYY') || '-%') + 1)::text,
           4, '0'
         );
  end if;
  return new;
end;
$$;

drop trigger if exists order_ref_trigger on public.orders;
create trigger order_ref_trigger
  before insert on public.orders
  for each row execute function public.set_order_ref();

-- ─── Auto-référence tickets (TKT-YYYY-XXXX) ──────────────────
create or replace function public.set_ticket_ref()
returns trigger language plpgsql as $$
begin
  if new.ref is null then
    new.ref := 'TKT-' || to_char(now(), 'YYYY') || '-'
      || lpad(
           ((select count(*) from public.support_tickets where ref like 'TKT-' || to_char(now(),'YYYY') || '-%') + 1)::text,
           4, '0'
         );
  end if;
  return new;
end;
$$;

drop trigger if exists ticket_ref_trigger on public.support_tickets;
create trigger ticket_ref_trigger
  before insert on public.support_tickets
  for each row execute function public.set_ticket_ref();

-- ─── updated_at automatique ───────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at        on public.profiles;
drop trigger if exists orders_updated_at          on public.orders;
drop trigger if exists support_tickets_updated_at on public.support_tickets;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- ─── Création automatique du profil à l'inscription ──────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, franchise_code)
  values (
    new.id,
    'FRA-' || upper(substring(new.id::text, 1, 6))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Notification auto à chaque nouvelle commande ─────────────
create or replace function public.notify_order_placed()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (user_id, type, title, message, link)
  values (
    new.user_id,
    'order_placed',
    'Commande ' || new.ref || ' envoyée',
    new.service || coalesce(' pour ' || new.company_name, '') || ' — €' || new.price::text,
    '/commandes'
  );
  return new;
end;
$$;

drop trigger if exists order_placed_notif on public.orders;
create trigger order_placed_notif
  after insert on public.orders
  for each row execute function public.notify_order_placed();

-- ─── Notification auto à chaque ticket support ────────────────
create or replace function public.notify_ticket_created()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (user_id, type, title, message, link)
  values (
    new.user_id,
    'ticket_created',
    'Ticket ' || new.ref || ' créé',
    new.subject,
    '/support'
  );
  return new;
end;
$$;

drop trigger if exists ticket_created_notif on public.support_tickets;
create trigger ticket_created_notif
  after insert on public.support_tickets
  for each row execute function public.notify_ticket_created();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles       enable row level security;
alter table public.orders         enable row level security;
alter table public.support_tickets enable row level security;
alter table public.notifications  enable row level security;

-- ─── Profiles ─────────────────────────────────────────────────
drop policy if exists "Voir son profil"     on public.profiles;
drop policy if exists "Modifier son profil" on public.profiles;
drop policy if exists "Créer son profil"    on public.profiles;

create policy "Voir son profil"
  on public.profiles for select using (auth.uid() = id);

create policy "Modifier son profil"
  on public.profiles for update using (auth.uid() = id);

create policy "Créer son profil"
  on public.profiles for insert with check (auth.uid() = id);

-- ─── Orders ───────────────────────────────────────────────────
drop policy if exists "Voir ses commandes"   on public.orders;
drop policy if exists "Créer une commande"   on public.orders;
drop policy if exists "Modifier sa commande" on public.orders;

create policy "Voir ses commandes"
  on public.orders for select using (auth.uid() = user_id);

create policy "Créer une commande"
  on public.orders for insert with check (auth.uid() = user_id);

create policy "Modifier sa commande"
  on public.orders for update using (auth.uid() = user_id);

-- ─── Support tickets ──────────────────────────────────────────
drop policy if exists "Voir ses tickets" on public.support_tickets;
drop policy if exists "Créer un ticket"  on public.support_tickets;

create policy "Voir ses tickets"
  on public.support_tickets for select using (auth.uid() = user_id);

create policy "Créer un ticket"
  on public.support_tickets for insert with check (auth.uid() = user_id);

-- ─── Notifications ────────────────────────────────────────────
drop policy if exists "Voir ses notifications"     on public.notifications;
drop policy if exists "Marquer notification lue"   on public.notifications;

create policy "Voir ses notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Marquer notification lue"
  on public.notifications for update using (auth.uid() = user_id);


-- ============================================================
-- INDEX (performance)
-- ============================================================

create index if not exists idx_orders_user_id
  on public.orders (user_id);

create index if not exists idx_orders_status
  on public.orders (status);

create index if not exists idx_orders_created_at
  on public.orders (created_at desc);

create index if not exists idx_tickets_user_id
  on public.support_tickets (user_id);

create index if not exists idx_notifications_user_id
  on public.notifications (user_id);

create index if not exists idx_notifications_read
  on public.notifications (user_id, read) where read = false;
