// ============================================================
// POST /api/webhooks/stripe
// Reçoit les events Stripe et met à jour Supabase
// ============================================================
// Configuration Stripe Dashboard :
//   1. Developers → Webhooks → Add endpoint
//   2. URL : https://<ton-domaine>/api/webhooks/stripe
//   3. Events à écouter : checkout.session.completed,
//      checkout.session.expired, payment_intent.payment_failed,
//      charge.refunded
//   4. Copier le "Signing secret" → STRIPE_WEBHOOK_SECRET
// ============================================================

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // ─── 1. Vérification de la signature ───────────────────
  const signature = (await headers()).get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET absent — webhook désactivé')
    return NextResponse.json({ error: 'Webhook non configuré' }, { status: 500 })
  }

  // IMPORTANT : lire le RAW body avant tout parsing JSON
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'invalid signature'
    console.error('[stripe webhook] signature failure:', msg)
    return NextResponse.json({ error: `Signature failed: ${msg}` }, { status: 400 })
  }

  // ─── 2. Service role pour bypass RLS ───────────────────
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[stripe webhook] SUPABASE_SERVICE_ROLE_KEY absent')
    return NextResponse.json({ error: 'Config Supabase manquante' }, { status: 500 })
  }
  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  // ─── 3. Idempotence : ne jamais traiter 2× le même event ─
  const { error: dupErr } = await svc.from('stripe_events').insert({
    id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  })

  if (dupErr) {
    // 23505 = unique_violation → déjà traité, on répond OK
    if (dupErr.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('[stripe webhook] stripe_events insert error:', dupErr.message)
    // On continue : traiter l'event est prioritaire sur le log
  }

  // ─── 4. Dispatch par event type ────────────────────────
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orderId = session.metadata?.order_id

        if (!orderId) {
          console.warn('[stripe webhook] checkout.session.completed sans order_id')
          break
        }

        // On ne gère que le mode payment pour l'instant
        if (session.mode !== 'payment') {
          console.log(
            `[stripe webhook] session ${session.id} mode=${session.mode}, skip (round suivant)`,
          )
          break
        }

        const paymentIntentId =
          typeof session.payment_intent === 'string' ? session.payment_intent : null

        const { error } = await svc
          .from('orders')
          .update({
            payment_status: 'paid',
            stripe_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            paid_at: new Date().toISOString(),
            amount_paid: session.amount_total != null ? session.amount_total / 100 : null,
            currency: session.currency ?? 'eur',
          })
          .eq('id', orderId)

        if (error) {
          console.error(
            `[stripe webhook] update order ${orderId} error:`,
            error.message,
          )
          throw error
        }
        console.log(`[stripe webhook] ✓ order ${orderId} → paid`)
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        const orderId = session.metadata?.order_id
        if (orderId) {
          await svc
            .from('orders')
            .update({ payment_status: 'unpaid' })
            .eq('id', orderId)
            .eq('stripe_session_id', session.id)
          console.log(`[stripe webhook] session expired → order ${orderId} unpaid`)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const orderId = pi.metadata?.order_id
        if (orderId) {
          await svc
            .from('orders')
            .update({ payment_status: 'failed' })
            .eq('id', orderId)
          console.log(`[stripe webhook] payment failed → order ${orderId}`)
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const piId =
          typeof charge.payment_intent === 'string' ? charge.payment_intent : null
        if (piId) {
          await svc
            .from('orders')
            .update({ payment_status: 'refunded' })
            .eq('stripe_payment_intent_id', piId)
          console.log(`[stripe webhook] refund for PI ${piId}`)
        }
        break
      }

      default:
        console.log(`[stripe webhook] event ignoré: ${event.type}`)
        break
    }

    return NextResponse.json({ received: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'handler error'
    console.error('[stripe webhook] handler error:', msg)
    await svc.from('stripe_events').update({ error: msg }).eq('id', event.id)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
