// ============================================================
// POST /api/admin/delete-franchisee
// Supprime définitivement un franchisé (auth + profil + cascades)
// ============================================================
// ⚠ DESTRUCTIF : supprime l'utilisateur auth, son profil, ses
// commandes, ses clients, ses leads, ses abonnements, etc.
// (cascades DB via on delete cascade).
//
// Sécurité :
// - Admin role check (admin ou super_admin)
// - L'admin ne peut pas se supprimer lui-même
// - Un admin "simple" ne peut pas supprimer un super_admin
// - Un admin ne peut pas supprimer un autre admin (sauf super_admin)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  franchiseeId: z.string().uuid('ID franchisé invalide'),
  confirm: z.literal(true, { message: 'Confirmation requise' }),
})

export async function POST(req: NextRequest) {
  try {
    // ─── 1. Auth + role check ─────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const myRole = myProfile?.role ?? 'franchisee'
    if (myRole !== 'admin' && myRole !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // ─── 2. Rate limit (anti-massacre) ────────────────────
    const blocked = checkRateLimit('delete-franchisee', user.id, 5, 60_000)
    if (blocked) return blocked

    // ─── 3. Validation body (Zod) ─────────────────────────
    let body: z.infer<typeof bodySchema>
    try {
      const raw = await req.json()
      body = bodySchema.parse(raw)
    } catch (e) {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : 'JSON invalide'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // ─── 4. Protection : ne peut pas se supprimer soi-même ─
    if (body.franchiseeId === user.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte.' },
        { status: 400 },
      )
    }

    // ─── 5. Récupérer le profil cible pour vérifs ─────────
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: target, error: targetErr } = await svc
      .from('profiles')
      .select('id, role, company_name, first_name, last_name')
      .eq('id', body.franchiseeId)
      .single()

    if (targetErr || !target) {
      return NextResponse.json({ error: 'Franchisé introuvable' }, { status: 404 })
    }

    // ─── 6. Règles : qui peut supprimer qui ? ─────────────
    // Un admin normal ne peut supprimer qu'un franchisé.
    // Seul un super_admin peut supprimer un admin.
    // Personne ne peut supprimer un super_admin via cette route.
    if (target.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Impossible de supprimer un super_admin.' },
        { status: 403 },
      )
    }
    if (target.role === 'admin' && myRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Seul un super_admin peut supprimer un autre admin.' },
        { status: 403 },
      )
    }

    // ─── 7. Suppression cascade ────────────────────────────
    // auth.admin.deleteUser déclenche ON DELETE CASCADE sur :
    // profiles, orders, order_items, clients, client_notes,
    // leads, subscriptions, ad_campaigns, ad_budget_credits,
    // notifications, support_tickets, devis, factures, etc.
    const { error: deleteErr } = await svc.auth.admin.deleteUser(body.franchiseeId)

    if (deleteErr) {
      console.error('[delete-franchisee] auth.admin.deleteUser error:', deleteErr.message)
      return NextResponse.json(
        { error: `Erreur suppression : ${deleteErr.message}` },
        { status: 500 },
      )
    }

    const targetLabel =
      target.company_name ||
      [target.first_name, target.last_name].filter(Boolean).join(' ') ||
      body.franchiseeId.slice(0, 8)

    console.log(
      `[delete-franchisee] ✓ Admin ${user.id} a supprimé ${body.franchiseeId} (${targetLabel})`,
    )

    return NextResponse.json({
      ok: true,
      deleted: {
        id: body.franchiseeId,
        label: targetLabel,
      },
    })
  } catch (e) {
    console.error('[delete-franchisee] unexpected error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
