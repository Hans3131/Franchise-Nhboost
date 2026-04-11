// ============================================================
// /api/ads/spend
//   POST → enregistre une dépense quotidienne sur une campagne
//          (consomme FIFO le budget via trigger SQL)
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SpendBody {
  campaign_id: string
  amount: number
  date?: string  // ISO date (défaut : aujourd'hui)
  platform?: string
  note?: string
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    let body: SpendBody
    try {
      body = (await req.json()) as SpendBody
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }

    // ─── Validations ────────────────────────────────────
    if (!body.campaign_id) {
      return NextResponse.json({ error: 'campaign_id requis' }, { status: 400 })
    }

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }

    // Date : aujourd'hui par défaut
    const date = body.date ?? new Date().toISOString().split('T')[0]

    // ─── Vérifier que la campagne appartient au user ────
    const { data: campaign } = await supabase
      .from('ad_campaigns')
      .select('id, platform')
      .eq('id', body.campaign_id)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    // ─── Insert / upsert ────────────────────────────────
    // La contrainte unique (campaign_id, date, platform) permet un upsert
    const { data, error } = await supabase
      .from('ad_spend_daily')
      .insert({
        user_id: user.id,
        campaign_id: body.campaign_id,
        date,
        amount,
        platform: body.platform ?? campaign.platform ?? null,
        note: body.note?.slice(0, 300) ?? null,
      })
      .select()
      .single()

    if (error) {
      // Si duplicate (même date+platform), on update à la place
      if (error.code === '23505') {
        const { data: updated, error: updErr } = await supabase
          .from('ad_spend_daily')
          .update({ amount, note: body.note?.slice(0, 300) ?? null })
          .eq('campaign_id', body.campaign_id)
          .eq('date', date)
          .eq('user_id', user.id)
          .select()
          .single()
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
        return NextResponse.json({ spend: updated, updated: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ spend: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
