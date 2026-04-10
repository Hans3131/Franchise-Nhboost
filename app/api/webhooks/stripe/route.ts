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
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Helper : upsert d'une ligne dans public.subscriptions ───
async function upsertSubscriptionRow(
  svc: SupabaseClient,
  subscription: Stripe.Subscription,
  ctx: { userId: string | null; orderId: string | null },
): Promise<void> {
  const firstItem = subscription.items.data[0]
  const price = firstItem?.price
  const product = price?.product

  // Extract service name/slug from product metadata (fallback: product name)
  let serviceName: string | null = null
  let serviceSlug: string | null = null
  if (typeof product === 'object' && product !== null && 'name' in product) {
    serviceName = (product as Stripe.Product).name ?? null
    serviceSlug = (product as Stripe.Product).metadata?.service_slug ?? null
  }

  // Helper pour lire un champ optionnel sur le sub Stripe
  const sub = subscription as Stripe.Subscription & {
    current_period_start?: number
    current_period_end?: number
  }

  const row = {
    user_id: ctx.userId,
    order_id: ctx.orderId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripe_price_id: price?.id ?? null,
    service_slug: serviceSlug,
    service_name: serviceName,
    status: subscription.status,
    current_period_start: sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString()
      : null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
    currency: subscription.currency ?? 'eur',
    billing_interval: price?.recurring?.interval ?? null,
  }

  // user_id est NOT NULL : si absent on skip
  if (!row.user_id) {
    console.warn(
      `[upsertSubscriptionRow] user_id manquant pour sub ${subscription.id}, skip`,
    )
    return
  }

  const { error } = await svc
    .from('subscriptions')
    .upsert(row, { onConflict: 'stripe_subscription_id' })

  if (error) {
    console.error(`[upsertSubscriptionRow] error:`, error.message)
    throw error
  }
}

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

        // ─── Mode PAYMENT (one-shot) ──────────────────
        if (session.mode === 'payment') {
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
              billing_type: 'one_shot',
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

        // ─── Mode SUBSCRIPTION ───────────────────────
        if (session.mode === 'subscription') {
          const subscriptionId =
            typeof session.subscription === 'string' ? session.subscription : null
          const customerId =
            typeof session.customer === 'string' ? session.customer : null

          if (!subscriptionId || !customerId) {
            console.warn('[stripe webhook] subscription session sans subscription/customer id')
            break
          }

          // Récupère l'abonnement complet (status, trial, period, items)
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ['items.data.price.product'],
          })

          // Upsert dans la table subscriptions
          await upsertSubscriptionRow(svc, subscription, {
            userId: session.metadata?.user_id ?? null,
            orderId,
          })

          // Met à jour la commande
          const paymentStatus =
            subscription.status === 'trialing'
              ? 'trialing'
              : subscription.status === 'active'
                ? 'active'
                : subscription.status === 'past_due'
                  ? 'past_due'
                  : 'processing'

          await svc
            .from('orders')
            .update({
              payment_status: paymentStatus,
              stripe_session_id: session.id,
              stripe_subscription_id: subscriptionId,
              billing_type: 'subscription',
              trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
              currency: subscription.currency ?? 'eur',
              amount_paid:
                subscription.items.data[0]?.price?.unit_amount != null
                  ? subscription.items.data[0].price.unit_amount / 100
                  : null,
            })
            .eq('id', orderId)

          // Enregistre le customer_id sur le profile si pas déjà fait
          if (session.metadata?.user_id) {
            await svc
              .from('profiles')
              .update({ stripe_customer_id: customerId })
              .eq('id', session.metadata.user_id)
              .is('stripe_customer_id', null)
          }

          console.log(
            `[stripe webhook] ✓ subscription ${subscriptionId} créée (status=${subscription.status})`,
          )
          break
        }

        console.log(
          `[stripe webhook] checkout.session.completed mode=${session.mode} ignoré`,
        )
        break
      }

      // ─── Subscription lifecycle ─────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await upsertSubscriptionRow(svc, subscription, {
          userId: subscription.metadata?.user_id ?? null,
          orderId: subscription.metadata?.order_id ?? null,
        })

        // Sync le payment_status de la commande si on a l'order_id
        const orderId = subscription.metadata?.order_id
        if (orderId) {
          const paymentStatus =
            subscription.status === 'trialing'
              ? 'trialing'
              : subscription.status === 'active'
                ? 'active'
                : subscription.status === 'past_due'
                  ? 'past_due'
                  : subscription.status === 'canceled'
                    ? 'canceled'
                    : 'processing'

          await svc
            .from('orders')
            .update({
              payment_status: paymentStatus,
              stripe_subscription_id: subscription.id,
              trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
            })
            .eq('id', orderId)
        }
        console.log(
          `[stripe webhook] ✓ subscription ${subscription.id} synced (${subscription.status})`,
        )
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await svc
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        // Met à jour la commande liée
        const orderId = subscription.metadata?.order_id
        if (orderId) {
          await svc
            .from('orders')
            .update({ payment_status: 'canceled' })
            .eq('id', orderId)
        }
        console.log(`[stripe webhook] ✓ subscription ${subscription.id} → canceled`)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subId =
          typeof (invoice as unknown as { subscription?: unknown }).subscription === 'string'
            ? ((invoice as unknown as { subscription: string }).subscription)
            : null
        if (subId) {
          // Récupère la subscription pour sync les nouvelles dates
          const subscription = await stripe.subscriptions.retrieve(subId)
          await upsertSubscriptionRow(svc, subscription, {
            userId: subscription.metadata?.user_id ?? null,
            orderId: subscription.metadata?.order_id ?? null,
          })
          console.log(`[stripe webhook] ✓ invoice paid → sub ${subId} renewed`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId =
          typeof (invoice as unknown as { subscription?: unknown }).subscription === 'string'
            ? ((invoice as unknown as { subscription: string }).subscription)
            : null
        if (subId) {
          await svc
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', subId)

          // Trouve la commande liée
          const { data: subRow } = await svc
            .from('subscriptions')
            .select('order_id')
            .eq('stripe_subscription_id', subId)
            .maybeSingle()

          if (subRow?.order_id) {
            await svc
              .from('orders')
              .update({ payment_status: 'past_due' })
              .eq('id', subRow.order_id)
          }
          console.log(`[stripe webhook] ⚠ invoice failed → sub ${subId} past_due`)
        }
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
