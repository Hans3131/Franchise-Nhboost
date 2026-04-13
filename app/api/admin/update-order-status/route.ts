import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const VALID_PROGRESS = [
  'pending', 'in_progress', 'completed',
  'preparation', 'v1_ready', 'v2_ready', 'domain_config', 'site_done',
  'strategy', 'shooting', 'launching', 'live',
]

const VALID_STATUS = ['pending', 'in_progress', 'completed', 'cancelled']

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { orderId, internalProgressStatus, status } = await req.json()
    if (!orderId) return NextResponse.json({ error: 'orderId requis' }, { status: 400 })

    const update: Record<string, unknown> = {}

    if (internalProgressStatus) {
      if (!VALID_PROGRESS.includes(internalProgressStatus)) {
        return NextResponse.json({ error: 'Statut de progression invalide' }, { status: 400 })
      }
      update.internal_progress_status = internalProgressStatus

      // Auto-sync main status
      if (['preparation', 'v1_ready', 'v2_ready', 'domain_config', 'strategy', 'shooting', 'launching'].includes(internalProgressStatus)) {
        update.status = 'in_progress'
      } else if (['site_done', 'live', 'completed'].includes(internalProgressStatus)) {
        update.status = 'completed'
      }
    }

    if (status && VALID_STATUS.includes(status)) {
      update.status = status
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })
    }

    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await svc.from('orders').update(update).eq('id', orderId)

    if (error) {
      console.error('[update-order-status] error:', error.message)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
