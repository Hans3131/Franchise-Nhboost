-- ============================================================
-- Migration : Catalogue de services + calculs financiers
-- À exécuter dans l'éditeur SQL du dashboard Supabase
-- ============================================================

-- ─── 1. Table services (catalogue) ────────────────────────────
create table if not exists public.services (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,        -- id stable pour le frontend (ex: 'site-onepage')
  name              text not null,               -- Nom du service
  description       text,
  internal_cost     numeric(10,2) not null,      -- Prix d'achat interne
  recommended_price numeric(10,2) not null,      -- Prix conseillé de vente
  service_type      text not null default 'one-shot'
                      check (service_type in ('one-shot','subscription')),
  monthly_price     numeric(10,2),               -- Si récurrent
  commitment_months integer,                     -- Si récurrent
  active            boolean default true,
  sort_order        integer default 0,
  metadata          jsonb default '{}'::jsonb,   -- Icônes, couleurs, etc.
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_services_slug on public.services (slug);
create index if not exists idx_services_active on public.services (active) where active = true;

-- updated_at auto
drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- RLS : lecture ouverte à tous les utilisateurs authentifiés, écriture admin only
alter table public.services enable row level security;

drop policy if exists "Voir les services" on public.services;
drop policy if exists "Admin modifie services" on public.services;

create policy "Voir les services"
  on public.services for select
  using (auth.uid() is not null);

create policy "Admin modifie services"
  on public.services for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin','super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin','super_admin')
    )
  );


-- ─── 2. Ajout des colonnes manquantes sur orders ──────────────
alter table public.orders
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists quantity   integer default 1 not null check (quantity > 0);

create index if not exists idx_orders_service_id on public.orders (service_id);


-- ─── 3. Seed : insertion du catalogue actuel ──────────────────
-- Utiliser ON CONFLICT pour idempotence (on peut réexécuter sans duplicate)
insert into public.services (slug, name, description, internal_cost, recommended_price, service_type, monthly_price, commitment_months, sort_order, metadata)
values
  ('site-onepage',    'Site One Page',                  'Page unique optimisée, design professionnel responsive, formulaire de contact, mise en ligne, SEO Friendly', 300,  970,  'one-shot',     null, null, 1, '{"iconName":"Globe","iconColor":"#6AAEE5"}'),
  ('site-complet',    'Site Complet',                   'Site multipages, design personnalisé, optimisation SEO de base, intégration WhatsApp/formulaire, responsive mobile', 800,  1470, 'one-shot',     null, null, 2, '{"iconName":"Globe","iconColor":"#4A7DC4","popular":true}'),
  ('visibilite',      'Offre Visibilité',               'Création de contenus, gestion de visibilité digitale, vidéos réseaux sociaux, optimisation présence locale', 390,  870,  'subscription', 870,  6,    3, '{"iconName":"Share2","iconColor":"#F59E0B","engagement":"6 mois"}'),
  ('acquisition',     'Système d''Acquisition Simple',  'Tunnel simple, page de conversion, système de collecte de leads, structuration de l''offre', 490,  970,  'subscription', 970,  3,    4, '{"iconName":"Target","iconColor":"#22C55E","engagement":"3 mois"}'),
  ('accompagnement',  'Accompagnement Business Premium','Positionnement stratégique, structuration offre, création contenu, système acquisition, optimisation commerciale', 2500, 4970, 'one-shot',     null, null, 5, '{"iconName":"Briefcase","iconColor":"#8B5CF6"}')
on conflict (slug) do update set
  name              = excluded.name,
  description       = excluded.description,
  internal_cost     = excluded.internal_cost,
  recommended_price = excluded.recommended_price,
  service_type      = excluded.service_type,
  monthly_price     = excluded.monthly_price,
  commitment_months = excluded.commitment_months,
  sort_order        = excluded.sort_order,
  metadata          = excluded.metadata,
  updated_at        = now();


-- ─── 4. Lien rétroactif orders → services (par nom) ──────────
-- Relie les commandes existantes au bon service_id via le nom
update public.orders o
set service_id = s.id
from public.services s
where o.service_id is null
  and o.service = s.name;


-- ─── 5. Vue des calculs financiers par commande ──────────────
-- Cette vue calcule automatiquement les 5 KPIs par commande
create or replace view public.order_financials as
select
  o.id,
  o.user_id,
  o.ref,
  o.service,
  o.service_id,
  o.quantity,
  o.status,
  o.created_at,

  -- Prix unitaires (fallback sur le catalogue si service_id renseigné)
  coalesce(o.sale_price,        s.recommended_price, 0) as unit_recommended_price,
  coalesce(o.actual_sale_price, o.sale_price, s.recommended_price, 0) as unit_actual_price,
  coalesce(o.internal_cost,     s.internal_cost, 0) as unit_cost,

  -- Calculs × quantité
  coalesce(o.sale_price,        s.recommended_price, 0) * o.quantity as theoretical_revenue,
  coalesce(o.actual_sale_price, o.sale_price, s.recommended_price, 0) * o.quantity as real_revenue,
  coalesce(o.internal_cost,     s.internal_cost, 0) * o.quantity as total_cost,

  -- Bénéfice réel = CA réel - Coût total
  (coalesce(o.actual_sale_price, o.sale_price, s.recommended_price, 0) - coalesce(o.internal_cost, s.internal_cost, 0)) * o.quantity as real_profit,

  -- Écart théorique - réel (positif = vendu sous le conseil)
  (coalesce(o.sale_price, s.recommended_price, 0) - coalesce(o.actual_sale_price, o.sale_price, s.recommended_price, 0)) * o.quantity as variance
from public.orders o
left join public.services s on s.id = o.service_id;

-- Sécurité : la vue hérite du RLS de orders (barrier)
alter view public.order_financials set (security_invoker = true);


-- ─── 6. Fonction helper : stats agrégées pour un franchisé ───
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


-- ─── 7. Vérification ─────────────────────────────────────────
-- Tu peux exécuter ces requêtes après la migration pour vérifier :
-- select * from public.services order by sort_order;
-- select * from public.order_financials limit 10;
-- select * from public.franchise_financials('<ton user_id>');
