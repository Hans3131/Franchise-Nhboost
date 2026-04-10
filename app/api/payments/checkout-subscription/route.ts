// ============================================================
// POST /api/payments/checkout-subscription
// Crée une session Stripe Checkout en mode `subscription`
// pour les services récurrents (Offre Visibilité, etc.)
// ============================================================
// Règle métier : 14 jours d'essai offerts par défaut sur tous
// les abonnements. Peut être désactivé via body.trial_days = 0.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, getSiteUrl } from '@/lib/stripe/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_TRIAL_DAYS = 14

interface RequestBody {
  order_id: string
  /** Override du trial (défaut 14). Mettre 0 pour désactiver. */
  trial_days?: number
}

export async function POST(req: Request) {
  try {
    // ─── 1. Auth ──────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // ─── 2. Body ──────────────────────────────────────────
    let body: RequestBody
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }
    if (!body.order_id || typeof body.order_id !== 'string') {
      return NextResponse.json({ error: 'order_id requis' }, { status: 400 })
    }

    const trialDays =
      typeof body.trial_days === 'number' && body.trial_days >= 0 && body.trial_days <= 365
        ? body.trial_days
        : DEFAULT_TRIAL_DAYS

    // ─── 3. Order (RLS vérifie user_id) ──────────────────
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, user_id, ref, client_email, client_name, company_name, payment_status, stripe_subscription_id')
      .eq('id', body.order_id)
      .eq('user_id', user.id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    if (
      order.payment_status === 'paid' ||
      order.payment_status === 'trialing' ||
      order.payment_status === 'active'
    ) {
      return NextResponse.json({ error: 'Abonnement déjà actif' }, { status: 400 })
    }

    // ─── 4. Items (source de vérité pour les prix) ──────
    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('service_name, service_slug, quantity, unit_actual_price')
      .eq('order_id', order.id)
      .order('sort_order', { ascending: true })

    if (itemsErr || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Lignes de commande introuvables' },
        { status: 400 },
      )
    }

    // ─── 5. Filtre : ne garder que les lignes "subscription" ─
    const slugs = Array.from(
      new Set(items.map((i) => i.service_slug).filter(Boolean) as string[]),
    )

    const { data: catalogRows } = await supabase
      .from('services')
      .select('slug, service_type')
      .in('slug', slugs)

    const typeBySlug = new Map<string, string>(
      (catalogRows ?? []).map((r) => [r.slug as string, r.service_type as string]),
    )

    const subscriptionItems = items.filter((it) => {
      const slug = it.service_slug ?? ''
      return typeBySlug.get(slug) === 'subscription'
    })

    if (subscriptionItems.length === 0) {
      return NextResponse.json(
        {
          error:
            'Aucun service récurrent dans cette commande. Utilise /api/payments/checkout-one-shot',
        },
        { status: 400 },
      )
    }

    // Si des lignes one-shot sont présentes, on les signale mais on continue
    // avec uniquement les lignes d'abonnement (les one-shot seront à gérer
    // séparément via checkout-one-shot dans un round futur).
    if (subscriptionItems.length !== items.length) {
      console.warn(
        `[checkout-subscription] Order ${order.id} a des lignes mixtes. ` +
          `${items.length - subscriptionItems.length} lignes one-shot ignorées.`,
      )
    }

    // ─── 6. Get or create Stripe Customer ───────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, company_name, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle()

    let customerId = profile?.stripe_customer_id ?? null

    if (!customerId) {
      const customerName =
        profile?.company_name ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
        order.company_name ||
        order.client_name ||
        undefined

      const customer = await stripe.customers.create({
        email: order.client_email || user.email || undefined,
        name: customerName,
        metadata: {
          user_id: user.id,
          nh_first_order_id: order.id,
        },
      })
      customerId = customer.id

      const { error: profileUpdateErr } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      if (profileUpdateErr) {
        console.error(
          '[checkout-subscription] profile update error:',
          profileUpdateErr.message,
        )
        // On continue : le customer Stripe est créé, on le persistera au webhook
      }
    }

    // ─── 7. Construction des line_items récurrents ──────
    const lineItems = subscriptionItems.map((item) => {
      const unitAmount = Math.round(Number(item.unit_actual_price) * 100)
      if (!Number.isFinite(unitAmount) || unitAmount < 50) {
        throw new Error(
          `Montant invalide pour "${item.service_name}" : minimum 0.50€`,
        )
      }
      return {
        quantity: Math.max(1, Number(item.quantity) || 1),
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.service_name,
            metadata: { order_id: order.id, service_slug: item.service_slug ?? '' },
          },
          unit_amount: unitAmount,
          recurring: {
            interval: 'month' as const,
          },
        },
      }
    })

    // ─── 8. Création de la session Checkout ─────────────
    const siteUrl = getSiteUrl()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: lineItems,
      success_url: `${siteUrl}/paiement/success?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/paiement/cancel?order_id=${order.id}`,
      metadata: {
        order_id: order.id,
        order_ref: order.ref ?? '',
        user_id: user.id,
        billing_type: 'subscription',
        trial_days: String(trialDays),
      },
      subscription_data: {
        trial_period_days: trialDays > 0 ? trialDays : undefined,
        metadata: {
          order_id: order.id,
          order_ref: order.ref ?? '',
          user_id: user.id,
        },
        description: `Commande ${order.ref ?? order.id}`,
      },
      // Forcer la saisie CB même pendant le trial
      payment_method_collection: 'always',
      locale: 'fr',
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    })

    if (!session.url) {
      return NextResponse.json({ error: 'URL Stripe indisponible' }, { status: 500 })
    }

    // ─── 9. Persiste l'état initial de l'abo ─────────────
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        stripe_session_id: session.id,
        billing_type: 'subscription',
        trial_days: trialDays,
        payment_status: 'processing',
      })
      .eq('id', order.id)
      .eq('user_id', user.id)

    if (updateErr) {
      console.error('[checkout-subscription] update error:', updateErr.message)
    }

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    console.error('[checkout-subscription] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
