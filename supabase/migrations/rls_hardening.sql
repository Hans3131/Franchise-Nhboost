-- ============================================================
-- Migration : Durcissement RLS — policies manquantes
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
-- Identifié lors de l'audit de sécurité.
-- Règle : AUCUNE table ne doit avoir RLS activé sans policies.
-- Chaque table doit explicitement définir qui peut SELECT,
-- INSERT, UPDATE, DELETE.
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. admin_alerts — CRITIQUE : 0 policies (admins bloqués)
-- ═══════════════════════════════════════════════════════════
-- Les admins doivent pouvoir lire et résoudre les alertes.
-- Les franchisés ne doivent rien voir.

drop policy if exists "Admin voir alertes" on public.admin_alerts;
drop policy if exists "Admin modifier alertes" on public.admin_alerts;
drop policy if exists "Admin creer alertes" on public.admin_alerts;

create policy "Admin voir alertes"
  on public.admin_alerts for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
    )
  );

create policy "Admin modifier alertes"
  on public.admin_alerts for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
    )
  );

create policy "Admin creer alertes"
  on public.admin_alerts for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
    )
  );


-- ═══════════════════════════════════════════════════════════
-- 2. order_messages — manque UPDATE (marquer comme lu)
-- ═══════════════════════════════════════════════════════════

drop policy if exists "Modifier message commande" on public.order_messages;

create policy "Modifier message commande"
  on public.order_messages for update
  using (
    order_id in (select id from public.orders where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════
-- 3. support_tickets — manque UPDATE
-- ═══════════════════════════════════════════════════════════

drop policy if exists "Modifier son ticket" on public.support_tickets;

create policy "Modifier son ticket"
  on public.support_tickets for update
  using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════
-- 4. devis_items — manque UPDATE et DELETE
-- ═══════════════════════════════════════════════════════════

drop policy if exists "Modifier items devis" on public.devis_items;
drop policy if exists "Supprimer items devis" on public.devis_items;

create policy "Modifier items devis"
  on public.devis_items for update
  using (
    devis_id in (select id from public.devis where user_id = auth.uid())
  );

create policy "Supprimer items devis"
  on public.devis_items for delete
  using (
    devis_id in (select id from public.devis where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════
-- 5. facture_items — manque UPDATE et DELETE
-- ═══════════════════════════════════════════════════════════

drop policy if exists "Modifier items facture" on public.facture_items;
drop policy if exists "Supprimer items facture" on public.facture_items;

create policy "Modifier items facture"
  on public.facture_items for update
  using (
    facture_id in (select id from public.factures where user_id = auth.uid())
  );

create policy "Supprimer items facture"
  on public.facture_items for delete
  using (
    facture_id in (select id from public.factures where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════
-- 6. order_items — manque DELETE
-- ═══════════════════════════════════════════════════════════

drop policy if exists "Supprimer items commande" on public.order_items;

create policy "Supprimer items commande"
  on public.order_items for delete
  using (
    order_id in (select id from public.orders where user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════
-- 7. leads — manque INSERT (création manuelle par franchisé)
-- ═══════════════════════════════════════════════════════════
-- Note : les leads inbound créés par l'API publique utilisent
-- le service_role, donc pas besoin de policy pour ça.
-- Mais un franchisé doit pouvoir créer un lead manuellement.

drop policy if exists "Creer ses leads" on public.leads;
drop policy if exists "Supprimer ses leads" on public.leads;

create policy "Creer ses leads"
  on public.leads for insert
  with check (auth.uid() = user_id);

create policy "Supprimer ses leads"
  on public.leads for delete
  using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════
-- 8. notifications — manque DELETE (nettoyer ses notifs)
-- ═══════════════════════════════════════════════════════════

drop policy if exists "Supprimer ses notifications" on public.notifications;

create policy "Supprimer ses notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════
-- 9. VÉRIFICATION FINALE
-- ═══════════════════════════════════════════════════════════
-- Après exécution, vérifie qu'aucune table n'a RLS activé
-- sans au moins une SELECT policy :
--
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
--   and rowsecurity = true
-- order by tablename;
--
-- Puis pour chaque table :
-- select * from pg_policies where tablename = 'NOM_TABLE';
