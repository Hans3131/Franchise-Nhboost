-- ============================================================
-- Migration : Stripe Subscriptions
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
-- Prérequis : stripe_one_shot.sql doit déjà être exécuté
-- ============================================================

-- ─── 1. Stripe Customer ID sur profiles ────────────────────
-- Un franchisé = un Stripe Customer (réutilisé à chaque achat)
alter table public.profiles
  add column if not exists stripe_customer_id text unique;

create index if not exists idx_profiles_stripe_customer_id
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- ─── 2. Colonnes billing/subscription sur orders ───────────
alter table public.orders
  add column if not exists billing_type text default 'one_shot'
    check (billing_type in ('one_shot','subscription','mixed')),
  add column if not exists stripe_subscription_id text,
  add column if not exists trial_days integer default 0,
  add column if not exists trial_end timestamptz;

create index if not exists idx_orders_stripe_subscription_id
  on public.orders (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Étendre le check de payment_status pour les états d'abo
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in (
    'paid','unpaid','refunded','processing','failed',
    'trialing','active','past_due','canceled'
  ));

-- ─── 3. Table subscriptions (source de vérité) ─────────────
create table if not exists public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users(id) on delete cascade not null,
  order_id                  uuid references public.orders(id) on delete set null,
  stripe_subscription_id    text unique not null,
  stripe_customer_id        text not null,
  stripe_price_id           text,
  service_slug              text,
  service_name              text,
  status                    text not null
    check (status in (
      'trialing','active','past_due','canceled',
      'incomplete','unpaid','incomplete_expired','paused'
    )),
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  trial_start               timestamptz,
  trial_end                 timestamptz,
  cancel_at_period_end      boolean default false,
  canceled_at               timestamptz,
  amount                    numeric(10,2),
  currency                  text default 'eur',
  billing_interval          text,  -- 'month' / 'year'
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

create index if not exists idx_subscriptions_user_id
  on public.subscriptions (user_id);

create index if not exists idx_subscriptions_stripe_sub_id
  on public.subscriptions (stripe_subscription_id);

create index if not exists idx_subscriptions_status
  on public.subscriptions (status);

create index if not exists idx_subscriptions_order_id
  on public.subscriptions (order_id)
  where order_id is not null;

-- ─── 4. RLS ────────────────────────────────────────────────
alter table public.subscriptions enable row level security;

drop policy if exists "Voir ses abonnements" on public.subscriptions;
create policy "Voir ses abonnements"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Note : INSERT/UPDATE/DELETE réservés au service_role (webhook)
-- Pas de policy pour ces opérations = accès refusé aux utilisateurs

-- ─── 5. Trigger updated_at ─────────────────────────────────
drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─── 6. Vérification ───────────────────────────────────────
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'profiles'
--   and column_name = 'stripe_customer_id';
--
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'orders'
--   and column_name in ('billing_type','stripe_subscription_id','trial_days','trial_end');
--
-- select * from public.subscriptions limit 5;
