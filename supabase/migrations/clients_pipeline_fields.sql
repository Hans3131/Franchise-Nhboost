-- ============================================================
-- Migration : Ajout des colonnes pipeline sur la table clients
-- ============================================================
-- Ajoute les colonnes manquantes qui sont utilisées par le code app
-- mais absentes du schema.sql initial. Sans cette migration, l'ajout
-- d'un nouveau client ou prospect échoue silencieusement côté CRM
-- et Pipeline.
--
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- ─── 1. Colonnes pipeline sur clients ────────────────────────
alter table public.clients
  add column if not exists pipeline_stage text default 'lead_received'
    check (pipeline_stage in ('lead_received','contacted','quote_sent','negotiation','won','lost')),
  add column if not exists deal_value numeric(10,2) default 0,
  add column if not exists expected_close_date date,
  add column if not exists loss_reason text;

-- ─── 2. Lien client → commandes (FK) ─────────────────────────
alter table public.orders
  add column if not exists client_id uuid references public.clients(id) on delete set null;

alter table public.devis
  add column if not exists client_id uuid references public.clients(id) on delete set null;

alter table public.factures
  add column if not exists client_id uuid references public.clients(id) on delete set null;

-- ─── 3. Indexes ──────────────────────────────────────────────
create index if not exists idx_clients_pipeline_stage on public.clients (pipeline_stage);
create index if not exists idx_clients_deal_value on public.clients (deal_value) where deal_value > 0;
create index if not exists idx_orders_client_id on public.orders (client_id);
create index if not exists idx_devis_client_id on public.devis (client_id);
create index if not exists idx_factures_client_id on public.factures (client_id);

-- ─── 4. Backfill : rows existantes ───────────────────────────
update public.clients
set pipeline_stage = case
  when commercial_status = 'prospect'  then 'lead_received'
  when commercial_status = 'qualified' then 'contacted'
  when commercial_status = 'active'    then 'won'
  when commercial_status = 'lost'      then 'lost'
  else 'lead_received'
end
where pipeline_stage is null;

update public.clients
set deal_value = 0
where deal_value is null;

-- ─── 5. Vérification ─────────────────────────────────────────
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'clients'
--   and column_name in ('pipeline_stage','deal_value','expected_close_date','loss_reason');
