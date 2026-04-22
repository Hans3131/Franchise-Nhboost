// ============================================================
// POST /api/admin/delete-order
// Supprime définitivement une commande (admin uniquement)
// ============================================================
// ⚠ DESTRUCTIF : supprime la commande + order_items (cascade DB) +
// order_messages + notifications liées (cascade).
//
// ⚠ Ne rembourse PAS le paiement Stripe si la commande est payée.
// L'admin doit rembourser séparément via le Stripe Dashboard si
// nécessaire (action volontaire et tracée).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  orderId: z.string().uuid('ID commande invalide'),
  confirm: z.literal(true, { message: 'Confirmation requise' }),
})

export async function POST(req: NextRequest) {
  try {
    // ─── 1. Auth + role check (admin uniquement) ──────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const myRole = profile?.role ?? 'franchisee'
    if (myRole !== 'admin' && myRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // ─── 2. Rate limit (anti-massacre) ─────────────────────
    const blocked = checkRateLimit('delete-order', user.id, 20, 60_000)
    if (blocked) return blocked

    // ─── 3. Validation body (Zod) ──────────────────────────
    let body: z.infer<typeof bodySchema>
    try {
      const raw = await req.json()
      body = bodySchema.parse(raw)
    } catch (e) {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : 'JSON invalide'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // ─── 4. Service role (bypass RLS, accès cross-user) ───
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // ─── 5. Récupérer la commande pour audit + check ──────
    const { data: order, error: orderErr } = await svc
      .from('orders')
      .select('id, ref, service, client_name, company_name, user_id, price, payment_status, stripe_session_id, stripe_payment_intent_id')
      .eq('id', body.orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    // ─── 6. Suppression cascade ────────────────────────────
    // CASCADE automatique via ON DELETE CASCADE sur :
    // - order_items
    // - order_messages
    // - notifications (si liées via link='/commandes')
    const { error: deleteErr } = await svc
      .from('orders')
      .delete()
      .eq('id', body.orderId)

    if (deleteErr) {
      console.error('[delete-order] delete error:', deleteErr.message)
      return NextResponse.json(
        { error: `Erreur suppression : ${deleteErr.message}` },
        { status: 500 },
      )
    }

    // ─── 7. Audit log (serveur) ────────────────────────────
    const label = `${order.ref ?? order.id.slice(0, 8)} · ${order.service ?? '—'} · ${order.company_name || order.client_name || '—'}`
    console.log(
      `[delete-order] ✓ Admin ${user.id} a supprimé commande ${label} ` +
      `(franchisé ${order.user_id}, price ${order.price}€, status ${order.payment_status})`,
    )

    // ─── 8. Warning si la commande était payée ────────────
    // L'admin doit être informé qu'il a détruit une commande avec
    // paiement Stripe associé — il doit rembourser manuellement
    const wasPaid =
      order.payment_status === 'paid' ||
      order.payment_status === 'active' ||
      order.payment_status === 'trialing'

    return NextResponse.json({
      ok: true,
      deleted: {
        id: order.id,
        ref: order.ref,
        label,
      },
      wasPaid,
      stripePaymentIntentId: order.stripe_payment_intent_id,
      warning: wasPaid
        ? 'Cette commande était payée. Pense à rembourser le client via Stripe Dashboard si nécessaire.'
        : undefined,
    })
  } catch (e) {
    console.error('[delete-order] unexpected error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
