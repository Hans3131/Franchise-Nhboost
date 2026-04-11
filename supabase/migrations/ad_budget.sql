-- ============================================================
-- Migration : Budget ADS (campagnes publicitaires)
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
-- Architecture wallet :
--   ad_campaigns     : les campagnes (1 par client × plateforme)
--   ad_budget_credits: les recharges Stripe (chaque recharge = 1 ligne)
--   ad_spend_daily   : les dépenses jour par jour (saisie manuelle ou API)
--
-- Triggers :
--   - sync_campaign_totals : recalcule total_credited / total_spent
--   - consume_ad_budget    : alloue FIFO les dépenses sur les crédits
-- ============================================================

-- ─── 1. Table ad_campaigns ────────────────────────────────
create table if not exists public.ad_campaigns (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null,
  client_id         uuid references public.clients(id) on delete set null,
  name              text not null,
  platform          text default 'meta'
                      check (platform in ('meta','google','tiktok','linkedin','mixed','other')),
  status            text default 'active'
                      check (status in ('active','paused','completed','archived')),
  daily_spend_avg   numeric(10,2) default 0,  -- moyenne journalière de dépense
  total_credited    numeric(10,2) default 0,  -- sync via trigger
  total_spent       numeric(10,2) default 0,  -- sync via trigger
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_ad_campaigns_user_id on public.ad_campaigns (user_id);
create index if not exists idx_ad_campaigns_client_id on public.ad_campaigns (client_id) where client_id is not null;
create index if not exists idx_ad_campaigns_status on public.ad_campaigns (status);

-- ─── 2. Table ad_budget_credits (wallet) ──────────────────
create table if not exists public.ad_budget_credits (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users(id) on delete cascade not null,
  campaign_id               uuid references public.ad_campaigns(id) on delete cascade not null,
  amount                    numeric(10,2) not null check (amount > 0),
  amount_used               numeric(10,2) default 0 check (amount_used >= 0),
  currency                  text default 'eur',
  stripe_session_id         text unique,
  stripe_payment_intent_id  text,
  status                    text default 'pending'
                              check (status in ('pending','available','exhausted','refunded')),
  note                      text,
  paid_at                   timestamptz,
  created_at                timestamptz default now()
);

create index if not exists idx_ad_credits_user_id on public.ad_budget_credits (user_id);
create index if not exists idx_ad_credits_campaign_id on public.ad_budget_credits (campaign_id);
create index if not exists idx_ad_credits_status on public.ad_budget_credits (status);

-- ─── 3. Table ad_spend_daily ──────────────────────────────
create table if not exists public.ad_spend_daily (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references public.ad_campaigns(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  date          date not null default current_date,
  amount        numeric(10,2) not null check (amount >= 0),
  platform      text,
  note          text,
  created_at    timestamptz default now(),
  unique(campaign_id, date, platform)
);

create index if not exists idx_ad_spend_campaign_id on public.ad_spend_daily (campaign_id);
create index if not exists idx_ad_spend_date on public.ad_spend_daily (date desc);

-- ─── 4. Vue : solde par campagne + simulateur durée ───────
-- Calcule le solde restant et une estimation des jours restants
create or replace view public.ad_campaign_balances as
select
  c.id as campaign_id,
  c.user_id,
  c.client_id,
  c.name,
  c.platform,
  c.status,
  c.daily_spend_avg,
  coalesce(sum(bc.amount) filter (where bc.status = 'available'), 0) as total_credited,
  coalesce(sum(bc.amount_used) filter (where bc.status in ('available','exhausted')), 0) as total_used,
  coalesce(sum(bc.amount - bc.amount_used) filter (where bc.status = 'available'), 0) as balance,
  case
    when c.daily_spend_avg > 0 then
      floor(
        coalesce(sum(bc.amount - bc.amount_used) filter (where bc.status = 'available'), 0)
        / c.daily_spend_avg
      )::integer
    else null
  end as days_remaining,
  c.created_at,
  c.updated_at
from public.ad_campaigns c
left join public.ad_budget_credits bc on bc.campaign_id = c.id
group by c.id, c.user_id, c.client_id, c.name, c.platform, c.status, c.daily_spend_avg, c.created_at, c.updated_at;

alter view public.ad_campaign_balances set (security_invoker = true);

-- ─── 5. RLS ────────────────────────────────────────────────
alter table public.ad_campaigns enable row level security;
alter table public.ad_budget_credits enable row level security;
alter table public.ad_spend_daily enable row level security;

drop policy if exists "Voir ses campagnes" on public.ad_campaigns;
drop policy if exists "Creer ses campagnes" on public.ad_campaigns;
drop policy if exists "Modifier ses campagnes" on public.ad_campaigns;
drop policy if exists "Supprimer ses campagnes" on public.ad_campaigns;

create policy "Voir ses campagnes" on public.ad_campaigns
  for select using (auth.uid() = user_id);
create policy "Creer ses campagnes" on public.ad_campaigns
  for insert with check (auth.uid() = user_id);
create policy "Modifier ses campagnes" on public.ad_campaigns
  for update using (auth.uid() = user_id);
create policy "Supprimer ses campagnes" on public.ad_campaigns
  for delete using (auth.uid() = user_id);

drop policy if exists "Voir ses recharges" on public.ad_budget_credits;
create policy "Voir ses recharges" on public.ad_budget_credits
  for select using (auth.uid() = user_id);
-- INSERT/UPDATE réservés au service_role (webhook)

drop policy if exists "Voir ses depenses" on public.ad_spend_daily;
drop policy if exists "Creer une depense" on public.ad_spend_daily;
drop policy if exists "Modifier ses depenses" on public.ad_spend_daily;
drop policy if exists "Supprimer ses depenses" on public.ad_spend_daily;

create policy "Voir ses depenses" on public.ad_spend_daily
  for select using (auth.uid() = user_id);
create policy "Creer une depense" on public.ad_spend_daily
  for insert with check (auth.uid() = user_id);
create policy "Modifier ses depenses" on public.ad_spend_daily
  for update using (auth.uid() = user_id);
create policy "Supprimer ses depenses" on public.ad_spend_daily
  for delete using (auth.uid() = user_id);

-- ─── 6. updated_at trigger ────────────────────────────────
drop trigger if exists ad_campaigns_updated_at on public.ad_campaigns;
create trigger ad_campaigns_updated_at
  before update on public.ad_campaigns
  for each row execute function public.set_updated_at();

-- ─── 7. Sync total_credited / total_spent sur ad_campaigns ─
create or replace function public.sync_campaign_totals()
returns trigger language plpgsql security definer as $$
declare
  cid uuid;
begin
  if tg_op = 'DELETE' then cid := old.campaign_id;
  else cid := new.campaign_id; end if;

  update public.ad_campaigns
  set
    total_credited = (
      select coalesce(sum(amount), 0)
      from public.ad_budget_credits
      where campaign_id = cid and status in ('available','exhausted')
    ),
    total_spent = (
      select coalesce(sum(amount_used), 0)
      from public.ad_budget_credits
      where campaign_id = cid
    ),
    updated_at = now()
  where id = cid;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists ad_credits_sync_campaign on public.ad_budget_credits;
create trigger ad_credits_sync_campaign
  after insert or update or delete on public.ad_budget_credits
  for each row execute function public.sync_campaign_totals();

-- ─── 8. Allocation FIFO des dépenses sur les crédits ──────
-- Quand on insère une dépense, on la soustrait du plus ancien crédit
-- dispo (FIFO). Si un crédit est vidé, il passe à 'exhausted'.
create or replace function public.consume_ad_budget()
returns trigger language plpgsql security definer as $$
declare
  remaining numeric := new.amount;
  credit record;
  available numeric;
begin
  if tg_op != 'INSERT' or remaining <= 0 then return new; end if;

  for credit in
    select * from public.ad_budget_credits
    where campaign_id = new.campaign_id
      and status = 'available'
      and (amount - amount_used) > 0
    order by created_at asc
  loop
    exit when remaining <= 0;
    available := credit.amount - credit.amount_used;

    if available >= remaining then
      update public.ad_budget_credits
      set amount_used = amount_used + remaining
      where id = credit.id;
      remaining := 0;
    else
      update public.ad_budget_credits
      set amount_used = amount, status = 'exhausted'
      where id = credit.id;
      remaining := remaining - available;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists ad_spend_consume_budget on public.ad_spend_daily;
create trigger ad_spend_consume_budget
  after insert on public.ad_spend_daily
  for each row execute function public.consume_ad_budget();

-- ─── 9. Vérification ──────────────────────────────────────
-- select * from public.ad_campaign_balances limit 10;
-- select * from public.ad_budget_credits order by created_at desc limit 10;
-- select * from public.ad_spend_daily order by date desc limit 10;
