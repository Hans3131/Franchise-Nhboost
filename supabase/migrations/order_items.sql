-- ============================================================
-- Migration : order_items (lignes de service par commande)
-- À exécuter dans l'éditeur SQL du dashboard Supabase
-- ============================================================

-- ─── 1. Table order_items ────────────────────────────────────
create table if not exists public.order_items (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid references public.orders(id) on delete cascade not null,
  service_id              uuid references public.services(id) on delete set null,
  service_name            text not null,
  service_slug            text,
  quantity                integer not null default 1 check (quantity > 0),
  unit_recommended_price  numeric(10,2) not null default 0,
  unit_actual_price       numeric(10,2) not null default 0,
  unit_cost               numeric(10,2) not null default 0,
  sort_order              integer default 0,
  created_at              timestamptz default now()
);

create index if not exists idx_order_items_order_id on public.order_items (order_id);
create index if not exists idx_order_items_service_id on public.order_items (service_id);

-- ─── 2. RLS (via parent order) ───────────────────────────────
alter table public.order_items enable row level security;

drop policy if exists "Voir items commande" on public.order_items;
drop policy if exists "Creer items commande" on public.order_items;
drop policy if exists "Modifier items commande" on public.order_items;

create policy "Voir items commande"
  on public.order_items for select
  using (order_id in (select id from public.orders where user_id = auth.uid()));

create policy "Creer items commande"
  on public.order_items for insert
  with check (order_id in (select id from public.orders where user_id = auth.uid()));

create policy "Modifier items commande"
  on public.order_items for update
  using (order_id in (select id from public.orders where user_id = auth.uid()));

-- ─── 3. Backfill : 1 item par commande existante ─────────────
insert into public.order_items (
  order_id, service_id, service_name, quantity,
  unit_recommended_price, unit_actual_price, unit_cost
)
select
  o.id,
  o.service_id,
  o.service,
  coalesce(o.quantity, 1),
  coalesce(o.sale_price, 0),
  coalesce(o.actual_sale_price, o.sale_price, 0),
  coalesce(o.internal_cost, 0)
from public.orders o
where not exists (select 1 from public.order_items where order_id = o.id)
  and o.service is not null;

-- ─── 4. Vue order_financials mise à jour ─────────────────────
-- Remplace l'ancienne view pour agréger depuis order_items
drop view if exists public.order_financials cascade;

create or replace view public.order_financials as
select
  o.id,
  o.user_id,
  o.ref,
  o.service,
  o.status,
  o.created_at,
  coalesce(sum(oi.unit_recommended_price * oi.quantity), 0) as theoretical_revenue,
  coalesce(sum(oi.unit_actual_price * oi.quantity), 0) as real_revenue,
  coalesce(sum(oi.unit_cost * oi.quantity), 0) as total_cost,
  coalesce(sum((oi.unit_actual_price - oi.unit_cost) * oi.quantity), 0) as real_profit,
  coalesce(sum((oi.unit_recommended_price - oi.unit_actual_price) * oi.quantity), 0) as variance,
  coalesce(sum(oi.quantity), 0) as total_quantity,
  count(oi.id) as item_count
from public.orders o
left join public.order_items oi on oi.order_id = o.id
group by o.id, o.user_id, o.ref, o.service, o.status, o.created_at;

alter view public.order_financials set (security_invoker = true);

-- ─── 5. Fonction helper mise à jour ──────────────────────────
create or replace function public.franchise_financials(p_user_id uuid)
returns table (
  total_orders         bigint,
  theoretical_revenue  numeric,
  real_revenue         numeric,
  total_cost           numeric,
  real_profit          numeric,
  variance             numeric
)
language sql
stable
security invoker
as $$
  select
    count(*)::bigint,
    coalesce(sum(theoretical_revenue), 0),
    coalesce(sum(real_revenue), 0),
    coalesce(sum(total_cost), 0),
    coalesce(sum(real_profit), 0),
    coalesce(sum(variance), 0)
  from public.order_financials
  where user_id = p_user_id
    and status = 'completed';
$$;

-- ─── 6. Vérification ─────────────────────────────────────────
-- select o.ref, oi.service_name, oi.quantity, oi.unit_actual_price
-- from public.orders o
-- join public.order_items oi on oi.order_id = o.id
-- order by o.created_at desc
-- limit 20;
--
-- select * from public.order_financials order by created_at desc limit 10;
