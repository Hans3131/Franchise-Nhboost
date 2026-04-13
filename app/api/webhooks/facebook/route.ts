// ============================================================
// Webhook Meta — Leads Facebook Ads
// ============================================================
// GET  → vérification du webhook (challenge Meta)
// POST → réception des événements leadgen
//
// Configuration Meta App Dashboard :
//   1. Products → Webhooks → Subscribe "Page"
//   2. Callback URL : https://ton-domaine/api/webhooks/facebook
//   3. Verify Token : la valeur de META_VERIFY_TOKEN
//   4. Fields : leadgen
//   5. Souscrire ta Page au webhook
// ============================================================

import { type NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fetchLeadData, verifyMetaSignature } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── GET : Vérification du webhook (challenge) ──────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[fb webhook] META_VERIFY_TOKEN non configuré')
    return new Response('Server not configured', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[fb webhook] ✓ Verification challenge accepted')
    return new Response(challenge ?? '', { status: 200 })
  }

  console.warn('[fb webhook] Verification failed:', { mode, tokenMatch: token === verifyToken })
  return new Response('Forbidden', { status: 403 })
}

// ─── POST : Réception des événements leadgen ─────────────
export async function POST(req: Request) {
  // 1. Lire le raw body (nécessaire pour la vérification de signature)
  const rawBody = await req.text()

  // 2. Vérifier la signature X-Hub-Signature-256
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.error('[fb webhook] META_APP_SECRET non configuré')
    // On retourne 200 pour ne pas que Meta retry indéfiniment
    return new Response('OK', { status: 200 })
  }

  const signature = req.headers.get('x-hub-signature-256')
  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    console.error('[fb webhook] Signature invalide')
    return new Response('Invalid signature', { status: 403 })
  }

  // 3. Parser le body
  let body: {
    object?: string
    entry?: Array<{
      id: string // page_id
      time: number
      changes?: Array<{
        field: string
        value: {
          leadgen_id: string
          page_id: string
          form_id?: string
          ad_id?: string
          created_time?: number
        }
      }>
    }>
  }

  try {
    body = JSON.parse(rawBody)
  } catch {
    console.error('[fb webhook] JSON parse error')
    return new Response('OK', { status: 200 })
  }

  // Vérifier que c'est bien un event de type "page"
  if (body.object !== 'page') {
    console.log(`[fb webhook] Ignored object type: ${body.object}`)
    return new Response('OK', { status: 200 })
  }

  // 4. Supabase service client (bypass RLS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[fb webhook] Supabase non configuré')
    return new Response('OK', { status: 200 })
  }
  const svc = createServiceClient(supabaseUrl, serviceKey)

  // 5. Traiter chaque entrée
  for (const entry of body.entry ?? []) {
    const pageId = String(entry.id)

    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue

      const { leadgen_id, form_id, ad_id } = change.value
      if (!leadgen_id) continue

      try {
        await processLeadgenEvent(svc, {
          pageId,
          leadgenId: leadgen_id,
          formId: form_id,
          adId: ad_id,
        })
      } catch (err) {
        // Log l'erreur mais continue les autres events du batch
        console.error(`[fb webhook] Failed to process lead ${leadgen_id}:`, err)
      }
    }
  }

  // 6. Toujours retourner 200 (même si des erreurs internes)
  // Sinon Meta retry et on reçoit des doublons
  return new Response('OK', { status: 200 })
}

// ─── Traitement d'un event leadgen ───────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processLeadgenEvent(
  svc: any,
  event: {
    pageId: string
    leadgenId: string
    formId?: string
    adId?: string
  },
) {
  const { pageId, leadgenId, formId, adId } = event

  // a) Lookup page_id → franchisé
  const { data: conn, error: connErr } = await svc
    .from('fb_page_connections')
    .select('user_id, page_access_token, page_name')
    .eq('page_id', pageId)
    .eq('is_active', true)
    .single()

  if (connErr || !conn) {
    console.warn(`[fb webhook] Aucune connexion active pour page_id=${pageId}`)
    return
  }

  // b) Déduplication : ce lead existe déjà ?
  const { data: existing } = await svc
    .from('leads')
    .select('id')
    .eq('fb_leadgen_id', leadgenId)
    .maybeSingle()

  if (existing) {
    console.log(`[fb webhook] Lead ${leadgenId} déjà existant, skip`)
    return
  }

  // c) Récupérer le lead complet depuis Meta Graph API
  const { parsed, raw } = await fetchLeadData(leadgenId, conn.page_access_token)

  // d) Insérer dans la table leads
  // La notification est créée automatiquement par le trigger DB
  const { error: insertErr } = await svc.from('leads').insert({
    user_id: conn.user_id,
    source: 'facebook',
    source_detail: [
      conn.page_name && `page:${conn.page_name}`,
      formId && `form:${formId}`,
    ].filter(Boolean).join(' | ') || null,
    name: parsed.name?.slice(0, 200) ?? null,
    email: parsed.email?.slice(0, 200) ?? null,
    phone: parsed.phone?.slice(0, 50) ?? null,
    company: parsed.company?.slice(0, 200) ?? null,
    status: 'new',
    fb_leadgen_id: leadgenId,
    metadata: {
      leadgen_id: leadgenId,
      form_id: formId ?? raw.form_id ?? null,
      ad_id: adId ?? raw.ad_id ?? null,
      page_id: pageId,
      page_name: conn.page_name,
      created_time: raw.created_time,
      raw_field_data: parsed.rawFieldData,
    },
  })

  if (insertErr) {
    // 23505 = unique constraint violation (dedup concurrent)
    if (insertErr.code === '23505') {
      console.log(`[fb webhook] Lead ${leadgenId} duplicate concurrent, skip`)
      return
    }
    throw new Error(`Insert lead error: ${insertErr.message}`)
  }

  console.log(
    `[fb webhook] ✓ Lead ${leadgenId} → user ${conn.user_id} (${parsed.name ?? 'no name'})`,
  )
}
