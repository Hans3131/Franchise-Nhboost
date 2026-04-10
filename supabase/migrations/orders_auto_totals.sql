-- ============================================================
-- Migration : Triggers auto-sync orders ↔ order_items ↔ services
-- ============================================================
-- Ce script automatise le calcul des totaux financiers des commandes :
--
--  1. BEFORE INSERT sur order_items → enrichit les lignes depuis services
--     (copie automatique de unit_cost, unit_recommended_price, service_id si manquants)
--
--  2. AFTER INSERT/UPDATE/DELETE sur order_items → recalcule les totaux
--     dans la table orders (price, cost, profit, quantity, etc.)
--
--  3. Backfill : recalcule toutes les commandes existantes
--
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================

-- ─── 1. Fonction d'enrichissement BEFORE INSERT ──────────────
-- Copie automatiquement les prix depuis la table services si :
--   - service_slug est fourni mais service_id est NULL
--   - unit_cost / unit_recommended_price sont à 0 ou NULL
create or replace function public.order_items_enrich()
returns trigger language plpgsql as $$
declare
  svc_row public.services%rowtype;
begin
  -- Résoudre service_id depuis service_slug
  if new.service_id is null and new.service_slug is not null then
    select * into svc_row from public.services where slug = new.service_slug limit 1;
    if found then
      new.service_id := svc_row.id;
      if coalesce(new.service_name, '') = '' then
        new.service_name := svc_row.name;
      end if;
      if new.unit_cost is null or new.unit_cost = 0 then
        new.unit_cost := svc_row.internal_cost;
      end if;
      if new.unit_recommended_price is null or new.unit_recommended_price = 0 then
        new.unit_recommended_price := svc_row.recommended_price;
      end if;
      if new.unit_actual_price is null or new.unit_actual_price = 0 then
        new.unit_actual_price := svc_row.recommended_price;
      end if;
    end if;
  end if;

  -- Cas inverse : service_id fourni mais pas slug / name / prix
  if new.service_id is not null then
    select * into svc_row from public.services where id = new.service_id limit 1;
    if found then
      if coalesce(new.service_slug, '') = '' then
        new.service_slug := svc_row.slug;
      end if;
      if coalesce(new.service_name, '') = '' then
        new.service_name := svc_row.name;
      end if;
      if new.unit_cost is null or new.unit_cost = 0 then
        new.unit_cost := svc_row.internal_cost;
      end if;
      if new.unit_recommended_price is null or new.unit_recommended_price = 0 then
        new.unit_recommended_price := svc_row.recommended_price;
      end if;
      if new.unit_actual_price is null or new.unit_actual_price = 0 then
        new.unit_actual_price := svc_row.recommended_price;
      end if;
    end if;
  end if;

  -- Sécurité : quantity >= 1
  if new.quantity is null or new.quantity < 1 then
    new.quantity := 1;
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_enrich_trigger on public.order_items;
create trigger order_items_enrich_trigger
  before insert or update on public.order_items
  for each row execute function public.order_items_enrich();


-- ─── 2. Fonction de recalcul des totaux d'une commande ───────
create or replace function public.recompute_order_totals(p_order_id uuid)
returns void language plpgsql security definer as $$
declare
  v_theoretical numeric := 0;
  v_real        numeric := 0;
  v_cost        numeric := 0;
  v_profit      numeric := 0;
  v_first_row   public.order_items%rowtype;
  v_item_count  integer := 0;
  v_svc_label   text;
begin
  -- Agrégats sur toutes les lignes
  select
    coalesce(sum(unit_recommended_price * quantity), 0),
    coalesce(sum(unit_actual_price * quantity), 0),
    coalesce(sum(unit_cost * quantity), 0),
    coalesce(sum((unit_actual_price - unit_cost) * quantity), 0),
    count(*)
  into v_theoretical, v_real, v_cost, v_profit, v_item_count
  from public.order_items
  where order_id = p_order_id;

  -- Récupère la 1ère ligne (sort_order asc, created_at asc) pour les champs mono-valeur de orders
  select * into v_first_row
  from public.order_items
  where order_id = p_order_id
  order by sort_order asc, created_at asc
  limit 1;

  -- Construit le label service : "Service A" ou "Service A (+N autres)"
  if v_item_count = 0 then
    v_svc_label := null;
  elsif v_item_count = 1 then
    v_svc_label := v_first_row.service_name;
  else
    v_svc_label := v_first_row.service_name || ' (+' || (v_item_count - 1)::text
                   || ' autre' || case when v_item_count > 2 then 's' else '' end || ')';
  end if;

  -- Met à jour la ligne orders avec les totaux recalculés
  update public.orders
  set
    -- Totaux agrégés
    price             = v_real,
    cost              = v_cost,
    profit            = v_profit,
    -- Champs legacy mono-service (basés sur la 1ère ligne)
    service           = coalesce(v_svc_label, service),
    service_id        = v_first_row.service_id,
    quantity          = coalesce(v_first_row.quantity, 1),
    sale_price        = coalesce(v_first_row.unit_recommended_price, 0),
    actual_sale_price = coalesce(v_first_row.unit_actual_price, 0),
    internal_cost     = coalesce(v_first_row.unit_cost, 0),
    updated_at        = now()
  where id = p_order_id;
end;
$$;


-- ─── 3. Trigger AFTER INSERT/UPDATE/DELETE sur order_items ───
create or replace function public.order_items_sync_totals()
returns trigger language plpgsql security definer as $$
declare
  v_order_id uuid;
begin
  -- Pour un DELETE, NEW est NULL → utiliser OLD
  if tg_op = 'DELETE' then
    v_order_id := old.order_id;
  else
    v_order_id := new.order_id;
  end if;

  perform public.recompute_order_totals(v_order_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_sync_totals_trigger on public.order_items;
create trigger order_items_sync_totals_trigger
  after insert or update or delete on public.order_items
  for each row execute function public.order_items_sync_totals();


-- ─── 4. Backfill : recalcul de toutes les commandes ──────────
-- À exécuter une seule fois après la création des triggers
do $$
declare
  r record;
begin
  for r in (select id from public.orders)
  loop
    perform public.recompute_order_totals(r.id);
  end loop;
end $$;


-- ─── 5. Vérification ─────────────────────────────────────────
-- Compare les totaux d'orders vs order_financials
-- (les 2 doivent matcher)
--
-- select
--   o.ref,
--   o.price        as orders_price,
--   of.real_revenue as view_real,
--   o.cost         as orders_cost,
--   of.total_cost  as view_cost,
--   o.profit       as orders_profit,
--   of.real_profit as view_profit
-- from public.orders o
-- left join public.order_financials of on of.id = o.id
-- order by o.created_at desc
-- limit 10;
