-- ============================================================
-- Migration : Stripe Checkout one-shot payments
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- ─── 1. Colonnes finance Stripe sur orders ──────────────────
alter table public.orders
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists amount_paid numeric(10,2),
  add column if not exists currency text default 'eur';

create index if not exists idx_orders_stripe_session_id
  on public.orders (stripe_session_id)
  where stripe_session_id is not null;

create index if not exists idx_orders_stripe_pi
  on public.orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- ─── 2. Étendre le check de payment_status ─────────────────
-- On ajoute 'processing' (après redirection) et 'failed' (échec)
alter table public.orders
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('paid','unpaid','refunded','processing','failed'));

-- ─── 3. Table d'idempotence des events webhook ─────────────
-- Critique : évite qu'un event Stripe rejoué crée 2× le même effet
-- (Stripe peut envoyer le même webhook jusqu'à 3 fois en cas de timeout)
create table if not exists public.stripe_events (
  id            text primary key,          -- = event.id de Stripe
  type          text not null,
  processed_at  timestamptz default now(),
  payload       jsonb,
  error         text
);

create index if not exists idx_stripe_events_type on public.stripe_events (type);

-- RLS : seul le service_role (webhook) y accède
-- Pas de policy = aucun accès pour les users normaux
alter table public.stripe_events enable row level security;


-- ─── 4. Vérification ────────────────────────────────────────
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'orders'
--   and column_name in ('stripe_session_id','stripe_payment_intent_id','paid_at','amount_paid','currency','payment_status');
--
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name = 'stripe_events';
