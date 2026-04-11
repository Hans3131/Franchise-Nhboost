// ============================================================
// POST /api/payments/checkout-ads-topup
// Crée une session Stripe Checkout en mode `payment` pour une
// recharge de budget publicitaire sur une campagne existante.
// ============================================================
// Règles :
//   - Montant libre entre 10€ et 10000€
//   - Paiement unique (pas de trial)
//   - Le webhook crée la ligne ad_budget_credits après paiement
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, getSiteUrl } from '@/lib/stripe/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RequestBody {
  campaign_id: string
  /** Montant en euros (10 min, 10000 max) */
  amount: number
}

const MIN_AMOUNT = 10
const MAX_AMOUNT = 10000

export async function POST(req: Request) {
  try {
    // ─── 1. Auth ──────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // ─── 2. Body + validations ────────────────────────────
    let body: RequestBody
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }

    if (!body.campaign_id || typeof body.campaign_id !== 'string') {
      return NextResponse.json({ error: 'campaign_id requis' }, { status: 400 })
    }

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      return NextResponse.json(
        { error: `Montant requis entre ${MIN_AMOUNT}€ et ${MAX_AMOUNT}€` },
        { status: 400 },
      )
    }

    // ─── 3. Vérifier que la campagne appartient au user ───
    const { data: campaign, error: campaignErr } = await supabase
      .from('ad_campaigns')
      .select('id, name, client_id, platform')
      .eq('id', body.campaign_id)
      .eq('user_id', user.id)
      .single()

    if (campaignErr || !campaign) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    // ─── 4. Création de la session Stripe ─────────────────
    const siteUrl = getSiteUrl()
    const amountCents = Math.round(amount * 100)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Budget ADS — ${campaign.name}`,
              description: `Recharge budget publicitaire (${campaign.platform})`,
              metadata: {
                campaign_id: campaign.id,
                platform: campaign.platform ?? 'meta',
              },
            },
            unit_amount: amountCents,
          },
        },
      ],
      customer_email: user.email ?? undefined,
      success_url: `${siteUrl}/budget-ads?recharged=1&campaign=${campaign.id}`,
      cancel_url: `${siteUrl}/budget-ads?cancelled=1&campaign=${campaign.id}`,
      metadata: {
        billing_type: 'ads_topup',
        user_id: user.id,
        campaign_id: campaign.id,
        amount_eur: amount.toString(),
      },
      payment_intent_data: {
        metadata: {
          billing_type: 'ads_topup',
          user_id: user.id,
          campaign_id: campaign.id,
        },
      },
      locale: 'fr',
    })

    if (!session.url) {
      return NextResponse.json({ error: 'URL Stripe indisponible' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    console.error('[checkout-ads-topup] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
