// ============================================================
// /api/ads/campaigns
//   GET  → liste les campagnes du user (avec solde via view)
//   POST → crée une nouvelle campagne
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_PLATFORMS = ['meta', 'google', 'tiktok', 'linkedin', 'mixed', 'other'] as const
type Platform = (typeof VALID_PLATFORMS)[number]

interface CreateBody {
  name: string
  client_id?: string | null
  platform?: Platform
  daily_spend_avg?: number
  notes?: string
}

// ─── GET : liste des campagnes avec solde ────────────────
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data, error } = await supabase
      .from('ad_campaign_balances')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[ads/campaigns GET] error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaigns: data ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── POST : crée une nouvelle campagne ───────────────────
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    let body: CreateBody
    try {
      body = (await req.json()) as CreateBody
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }

    // ─── Validations ────────────────────────────────────
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Nom de campagne requis (min. 2 caractères)' },
        { status: 400 },
      )
    }
    if (body.name.length > 120) {
      return NextResponse.json({ error: 'Nom trop long (max 120)' }, { status: 400 })
    }

    const platform: Platform =
      body.platform && VALID_PLATFORMS.includes(body.platform) ? body.platform : 'meta'

    const dailySpend = Number(body.daily_spend_avg)
    const safeDaily =
      Number.isFinite(dailySpend) && dailySpend >= 0 && dailySpend <= 100000 ? dailySpend : 0

    // Vérifier que le client existe et appartient au user (si renseigné)
    if (body.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('id', body.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!client) {
        return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
      }
    }

    // ─── Insertion ──────────────────────────────────────
    const { data, error } = await supabase
      .from('ad_campaigns')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        client_id: body.client_id ?? null,
        platform,
        daily_spend_avg: safeDaily,
        notes: body.notes?.slice(0, 500) ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[ads/campaigns POST] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ campaign: data }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
