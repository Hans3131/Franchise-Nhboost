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
  vat_number        text,
  website           text,
  instagram         text,
  facebook          text,
  tiktok            text,

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
  cost              numeric(10,2) default 0,
  sale_price        numeric(10,2) default 0,
  internal_cost     numeric(10,2) default 0,
  profit            numeric(10,2) default 0,
  monthly_price     numeric(10,2),
  commitment_months integer,
  contract_total    numeric(10,2),
  whatsapp_group    text,
  domain_name       text,
  specific_request  text,
  deliverables_url          text,
  service_type              text default 'standard'
                              check (service_type in ('website','campaign','standard')),
  internal_progress_status  text default 'pending'
                              check (internal_progress_status in (
                                'pending','in_progress','completed',
                                'preparation','v1_ready','v2_ready','domain_config','site_done',
                                'strategy','shooting','launching','live'
                              )),
  stripe_session_id text,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─── Tickets support ──────────────────────────────────────────
create table if not exists public.support_tickets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  order_id   uuid references public.orders(id) on delete set null,
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

-- Le franchisé peut modifier uniquement les infos client/brief (pas les champs internes)
create policy "Modifier sa commande"
  on public.orders for update using (auth.uid() = user_id)
  with check (
    -- Interdit de changer les champs réservés à l'admin
    -- (La vérification se fait côté application car RLS ne peut pas bloquer des colonnes)
    auth.uid() = user_id
  );

-- Policy admin (service_role) pour mettre à jour status, avancement, livrables
-- Note : le service_role bypass le RLS par défaut dans Supabase

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


-- ============================================================
-- DEVIS & FACTURES (Secrétaire IA)
-- ============================================================

-- ─── Devis ────────────────────────────────────────────────────
create table if not exists public.devis (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  ref             text unique,
  client_name     text not null,
  client_email    text,
  client_phone    text,
  company_name    text,
  company_email   text,
  vat_number      text,
  client_address  text,
  subtotal_ht     numeric(10,2) default 0,
  tva_rate        numeric(5,2) default 21.00,
  tva_amount      numeric(10,2) default 0,
  total_ttc       numeric(10,2) default 0,
  discount        numeric(10,2) default 0,
  status          text default 'draft'
                    check (status in ('draft','sent','accepted','rejected','expired','invoiced')),
  valid_until     date,
  notes           text,
  facture_id      uuid,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Devis items ──────────────────────────────────────────────
create table if not exists public.devis_items (
  id          uuid primary key default gen_random_uuid(),
  devis_id    uuid references public.devis(id) on delete cascade not null,
  service_id  text,
  description text not null,
  quantity    integer default 1,
  unit_price  numeric(10,2) not null,
  total       numeric(10,2) not null,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ─── Factures ─────────────────────────────────────────────────
create table if not exists public.factures (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  ref             text unique,
  devis_id        uuid references public.devis(id) on delete set null,
  client_name     text not null,
  client_email    text,
  client_phone    text,
  company_name    text,
  company_email   text,
  vat_number      text,
  client_address  text,
  subtotal_ht     numeric(10,2) default 0,
  tva_rate        numeric(5,2) default 21.00,
  tva_amount      numeric(10,2) default 0,
  total_ttc       numeric(10,2) default 0,
  discount        numeric(10,2) default 0,
  status          text default 'unpaid'
                    check (status in ('unpaid','paid','overdue','cancelled')),
  payment_method  text,
  paid_at         timestamptz,
  due_date        date,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- FK devis → facture
alter table public.devis
  add constraint devis_facture_fk foreign key (facture_id)
  references public.factures(id) on delete set null;

-- ─── Facture items ────────────────────────────────────────────
create table if not exists public.facture_items (
  id           uuid primary key default gen_random_uuid(),
  facture_id   uuid references public.factures(id) on delete cascade not null,
  service_id   text,
  description  text not null,
  quantity     integer default 1,
  unit_price   numeric(10,2) not null,
  total        numeric(10,2) not null,
  sort_order   integer default 0,
  created_at   timestamptz default now()
);

-- ─── Chat sessions ────────────────────────────────────────────
create table if not exists public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text default 'Nouvelle conversation',
  devis_id    uuid references public.devis(id) on delete set null,
  facture_id  uuid references public.factures(id) on delete set null,
  messages    jsonb default '[]'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── Auto-ref devis (DEV-YYYY-XXXX) ──────────────────────────
create or replace function public.set_devis_ref()
returns trigger language plpgsql as $$
begin
  if new.ref is null then
    new.ref := 'DEV-' || to_char(now(), 'YYYY') || '-'
      || lpad(
           ((select count(*) from public.devis where ref like 'DEV-' || to_char(now(),'YYYY') || '-%') + 1)::text,
           4, '0'
         );
  end if;
  return new;
end;
$$;

drop trigger if exists devis_ref_trigger on public.devis;
create trigger devis_ref_trigger
  before insert on public.devis
  for each row execute function public.set_devis_ref();

-- ─── Auto-ref factures (FAC-YYYY-XXXX) ───────────────────────
create or replace function public.set_facture_ref()
returns trigger language plpgsql as $$
begin
  if new.ref is null then
    new.ref := 'FAC-' || to_char(now(), 'YYYY') || '-'
      || lpad(
           ((select count(*) from public.factures where ref like 'FAC-' || to_char(now(),'YYYY') || '-%') + 1)::text,
           4, '0'
         );
  end if;
  return new;
end;
$$;

drop trigger if exists facture_ref_trigger on public.factures;
create trigger facture_ref_trigger
  before insert on public.factures
  for each row execute function public.set_facture_ref();

-- ─── updated_at triggers ──────────────────────────────────────
drop trigger if exists devis_updated_at       on public.devis;
drop trigger if exists factures_updated_at    on public.factures;
drop trigger if exists chat_sessions_updated_at on public.chat_sessions;

create trigger devis_updated_at
  before update on public.devis
  for each row execute function public.set_updated_at();

create trigger factures_updated_at
  before update on public.factures
  for each row execute function public.set_updated_at();

create trigger chat_sessions_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────
alter table public.devis          enable row level security;
alter table public.devis_items    enable row level security;
alter table public.factures       enable row level security;
alter table public.facture_items  enable row level security;
alter table public.chat_sessions  enable row level security;

-- Devis
create policy "Voir ses devis"    on public.devis for select using (auth.uid() = user_id);
create policy "Créer un devis"    on public.devis for insert with check (auth.uid() = user_id);
create policy "Modifier son devis" on public.devis for update using (auth.uid() = user_id);

-- Devis items (via parent)
create policy "Voir items devis"  on public.devis_items for select
  using (devis_id in (select id from public.devis where user_id = auth.uid()));
create policy "Créer items devis" on public.devis_items for insert
  with check (devis_id in (select id from public.devis where user_id = auth.uid()));

-- Factures
create policy "Voir ses factures"    on public.factures for select using (auth.uid() = user_id);
create policy "Créer une facture"    on public.factures for insert with check (auth.uid() = user_id);
create policy "Modifier sa facture"  on public.factures for update using (auth.uid() = user_id);

-- Facture items (via parent)
create policy "Voir items facture"  on public.facture_items for select
  using (facture_id in (select id from public.factures where user_id = auth.uid()));
create policy "Créer items facture" on public.facture_items for insert
  with check (facture_id in (select id from public.factures where user_id = auth.uid()));

-- Chat sessions
create policy "Voir ses sessions"    on public.chat_sessions for select using (auth.uid() = user_id);
create policy "Créer une session"    on public.chat_sessions for insert with check (auth.uid() = user_id);
create policy "Modifier sa session"  on public.chat_sessions for update using (auth.uid() = user_id);
create policy "Supprimer sa session" on public.chat_sessions for delete using (auth.uid() = user_id);

-- ─── Indexes ──────────────────────────────────────────────────
create index if not exists idx_devis_user_id on public.devis (user_id);
create index if not exists idx_devis_status on public.devis (status);
create index if not exists idx_factures_user_id on public.factures (user_id);
create index if not exists idx_factures_status on public.factures (status);
create index if not exists idx_chat_sessions_user_id on public.chat_sessions (user_id);


-- ============================================================
-- CRM — Gestion clients franchisé
-- ============================================================

-- ─── Clients ──────────────────────────────────────────────────
create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  company_name      text not null,
  contact_name      text,
  email             text,
  phone             text,
  whatsapp          text,
  website           text,
  instagram         text,
  facebook          text,
  tiktok            text,
  vat_number        text,
  sector            text,
  address           text,
  notes             text,
  commercial_status text default 'prospect'
                      check (commercial_status in ('prospect','qualified','active','inactive','lost')),
  upsell_potential  text default 'medium'
                      check (upsell_potential in ('low','medium','high')),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─── Notes / Activités client ─────────────────────────────────
create table if not exists public.client_notes (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  type          text default 'note'
                  check (type in ('note','call','email','meeting','followup','upsell')),
  content       text not null,
  followup_date date,
  completed     boolean default false,
  created_at    timestamptz default now()
);

-- ─── Lien client → commandes / devis / factures ───────────────
-- (colonnes ajoutées via ALTER dans la migration)

-- ─── updated_at trigger ───────────────────────────────────────
drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────
alter table public.clients       enable row level security;
alter table public.client_notes  enable row level security;

create policy "Voir ses clients"    on public.clients for select using (auth.uid() = user_id);
create policy "Creer un client"     on public.clients for insert with check (auth.uid() = user_id);
create policy "Modifier son client" on public.clients for update using (auth.uid() = user_id);
create policy "Supprimer son client" on public.clients for delete using (auth.uid() = user_id);

create policy "Voir notes client"   on public.client_notes for select
  using (client_id in (select id from public.clients where user_id = auth.uid()));
create policy "Creer note"          on public.client_notes for insert
  with check (client_id in (select id from public.clients where user_id = auth.uid()));
create policy "Modifier note"       on public.client_notes for update
  using (client_id in (select id from public.clients where user_id = auth.uid()));
create policy "Supprimer note"      on public.client_notes for delete
  using (client_id in (select id from public.clients where user_id = auth.uid()));

-- ─── Indexes ──────────────────────────────────────────────────
create index if not exists idx_clients_user_id on public.clients (user_id);
create index if not exists idx_clients_status on public.clients (commercial_status);
create index if not exists idx_client_notes_client_id on public.client_notes (client_id);
create index if not exists idx_orders_client_id on public.orders (client_id);


-- ============================================================
-- PIPELINE COMMERCIAL
-- ============================================================

-- ─── Historique pipeline ──────────────────────────────────────
create table if not exists public.pipeline_history (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  from_stage  text,
  to_stage    text not null,
  note        text,
  created_at  timestamptz default now()
);

alter table public.pipeline_history enable row level security;

create policy "Voir historique pipeline" on public.pipeline_history for select
  using (client_id in (select id from public.clients where user_id = auth.uid()));
create policy "Creer historique pipeline" on public.pipeline_history for insert
  with check (client_id in (select id from public.clients where user_id = auth.uid()));

create index if not exists idx_pipeline_history_client on public.pipeline_history (client_id);
create index if not exists idx_clients_pipeline_stage on public.clients (pipeline_stage);
