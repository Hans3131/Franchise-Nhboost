-- ============================================================
-- Migration : Leads Facebook Ads via Webhook Meta
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
-- Prérequis : la table leads doit exister (schema.sql)
-- ============================================================

-- ─── 1. Colonne dedup Facebook sur leads ─────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fb_leadgen_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_leads_fb_leadgen_id
  ON public.leads (fb_leadgen_id)
  WHERE fb_leadgen_id IS NOT NULL;


-- ─── 2. Table mapping Page Facebook → franchisé ──────────
CREATE TABLE IF NOT EXISTS public.fb_page_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page_id           text NOT NULL,
  page_name         text,
  page_access_token text NOT NULL,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Un seul mapping par page_id (une Page = un franchisé)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fb_page_connections_page_id
  ON public.fb_page_connections (page_id);

CREATE INDEX IF NOT EXISTS idx_fb_page_connections_user_id
  ON public.fb_page_connections (user_id);

-- RLS
ALTER TABLE public.fb_page_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Voir ses connexions FB" ON public.fb_page_connections;
DROP POLICY IF EXISTS "Creer sa connexion FB" ON public.fb_page_connections;
DROP POLICY IF EXISTS "Modifier sa connexion FB" ON public.fb_page_connections;
DROP POLICY IF EXISTS "Supprimer sa connexion FB" ON public.fb_page_connections;

CREATE POLICY "Voir ses connexions FB"
  ON public.fb_page_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Creer sa connexion FB"
  ON public.fb_page_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Modifier sa connexion FB"
  ON public.fb_page_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Supprimer sa connexion FB"
  ON public.fb_page_connections FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at auto
DROP TRIGGER IF EXISTS fb_page_connections_updated_at ON public.fb_page_connections;
CREATE TRIGGER fb_page_connections_updated_at
  BEFORE UPDATE ON public.fb_page_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─── 3. Étendre le check type de notifications ──────────
-- Ajoute 'lead_received' pour les notifications de nouveaux leads
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('order_placed','order_status','ticket_created','lead_received','system'));


-- ─── 4. Trigger notification auto sur nouveau lead ──────
-- Même pattern que notify_order_placed et notify_ticket_created
CREATE OR REPLACE FUNCTION public.notify_lead_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    new.user_id,
    'lead_received',
    'Nouveau lead : ' || COALESCE(new.name, 'Sans nom'),
    COALESCE(new.source, '') || COALESCE(' — ' || new.email, '') || COALESCE(' — ' || new.phone, ''),
    '/mes-leads'
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS lead_received_notif ON public.leads;
CREATE TRIGGER lead_received_notif
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_lead_received();


-- ─── 5. Vérification ────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'leads' AND column_name = 'fb_leadgen_id';
--
-- SELECT * FROM public.fb_page_connections;
