// ============================================================
// POST /api/payments/checkout-one-shot
// Crée une session Stripe Checkout en mode `payment`
// pour les services ponctuels (sites, accompagnement, ads, etc.)
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, getSiteUrl } from '@/lib/stripe/client'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RequestBody {
  order_id: string
}

export async function POST(req: Request) {
  try {
    // ─── 1. Authentification utilisateur ───────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // ─── Rate limit : 5 checkouts par minute par user ─────
    const blocked = checkRateLimit('checkout-one-shot', user.id, 5, 60_000)
    if (blocked) return blocked

    // ─── 2. Validation du body ─────────────────────────────
    let body: RequestBody
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }
    if (!body.order_id || typeof body.order_id !== 'string') {
      return NextResponse.json({ error: 'order_id requis' }, { status: 400 })
    }

    // ─── 3. Lecture de la commande (RLS vérifie user_id) ───
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, user_id, ref, client_email, stripe_session_id, payment_status, company_name, client_name')
      .eq('id', body.order_id)
      .eq('user_id', user.id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'Commande déjà payée' }, { status: 400 })
    }

    // ─── 4. Lignes de commande = source de vérité du prix ─
    // On ne fait JAMAIS confiance à un montant envoyé par le client.
    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('service_name, quantity, unit_actual_price')
      .eq('order_id', order.id)
      .order('sort_order', { ascending: true })

    if (itemsErr || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Lignes de commande introuvables' },
        { status: 400 },
      )
    }

    // ─── 5. Construction des line_items (montants en centimes) ─
    const lineItems = items.map((item) => {
      const unitAmount = Math.round(Number(item.unit_actual_price) * 100)
      if (!Number.isFinite(unitAmount) || unitAmount < 50) {
        // Stripe refuse les montants < 0.50€
        throw new Error(`Montant invalide pour "${item.service_name}" : minimum 0.50€`)
      }
      return {
        quantity: Math.max(1, Number(item.quantity) || 1),
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.service_name,
            metadata: { order_id: order.id },
          },
          unit_amount: unitAmount,
        },
      }
    })

    // ─── 6. Création de la session Stripe Checkout ─────────
    const siteUrl = getSiteUrl()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: order.client_email || user.email || undefined,
      success_url: `${siteUrl}/paiement/success?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/paiement/cancel?order_id=${order.id}`,
      metadata: {
        order_id: order.id,
        order_ref: order.ref ?? '',
        user_id: user.id,
        billing_type: 'one_shot',
        client_label: (order.company_name ?? order.client_name ?? '').slice(0, 100),
      },
      payment_intent_data: {
        metadata: {
          order_id: order.id,
          order_ref: order.ref ?? '',
          user_id: user.id,
        },
      },
      locale: 'fr',
      allow_promotion_codes: true,
      // Le client ne peut pas modifier son email
      billing_address_collection: 'auto',
    })

    if (!session.url) {
      return NextResponse.json({ error: 'URL Stripe indisponible' }, { status: 500 })
    }

    // ─── 7. Persiste le session_id dans la commande ────────
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        stripe_session_id: session.id,
        payment_status: 'processing',
      })
      .eq('id', order.id)
      .eq('user_id', user.id)

    if (updateErr) {
      console.error('[checkout-one-shot] update error:', updateErr.message)
      // On continue : la session est créée, la réconciliation se fera via webhook
    }

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    console.error('[checkout-one-shot] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
