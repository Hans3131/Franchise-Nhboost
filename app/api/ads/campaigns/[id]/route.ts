// ============================================================
// /api/ads/campaigns/[id]
//   PATCH → met à jour daily_spend_avg / status / name
//   DELETE → archive la campagne (soft delete via status='archived')
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PatchBody {
  name?: string
  daily_spend_avg?: number
  status?: 'active' | 'paused' | 'completed' | 'archived'
  notes?: string
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    let body: PatchBody
    try {
      body = (await req.json()) as PatchBody
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}
    if (body.name !== undefined) {
      if (body.name.trim().length < 2 || body.name.length > 120) {
        return NextResponse.json({ error: 'Nom invalide' }, { status: 400 })
      }
      patch.name = body.name.trim()
    }
    if (body.daily_spend_avg !== undefined) {
      const n = Number(body.daily_spend_avg)
      if (!Number.isFinite(n) || n < 0 || n > 100000) {
        return NextResponse.json({ error: 'daily_spend_avg invalide' }, { status: 400 })
      }
      patch.daily_spend_avg = n
    }
    if (body.status !== undefined) {
      if (!['active', 'paused', 'completed', 'archived'].includes(body.status)) {
        return NextResponse.json({ error: 'status invalide' }, { status: 400 })
      }
      patch.status = body.status
    }
    if (body.notes !== undefined) {
      patch.notes = body.notes?.slice(0, 500) ?? null
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ad_campaigns')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ campaign: data })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // Soft delete via status='archived' (préserve l'historique wallet)
    const { error } = await supabase
      .from('ad_campaigns')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
