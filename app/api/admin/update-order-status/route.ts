import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

const VALID_PROGRESS = [
  'pending', 'in_progress', 'completed',
  'preparation', 'v1_ready', 'v2_ready', 'domain_config', 'site_done',
  'strategy', 'shooting', 'launching', 'live',
] as const

const VALID_STATUS = ['pending', 'in_progress', 'completed', 'cancelled'] as const

const bodySchema = z.object({
  orderId: z.string().uuid('ID commande invalide'),
  internalProgressStatus: z.enum(VALID_PROGRESS).optional(),
  status: z.enum(VALID_STATUS).optional(),
}).refine(
  d => d.internalProgressStatus || d.status,
  { message: 'Au moins un statut requis (internalProgressStatus ou status)' },
)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Validation Zod
    let body: z.infer<typeof bodySchema>
    try {
      const raw = await req.json()
      body = bodySchema.parse(raw)
    } catch (e) {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : 'JSON invalide'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const update: Record<string, unknown> = {}

    if (body.internalProgressStatus) {
      update.internal_progress_status = body.internalProgressStatus

      // Auto-sync main status
      if (['preparation', 'v1_ready', 'v2_ready', 'domain_config', 'strategy', 'shooting', 'launching'].includes(body.internalProgressStatus)) {
        update.status = 'in_progress'
      } else if (['site_done', 'live', 'completed'].includes(body.internalProgressStatus)) {
        update.status = 'completed'
      }
    }

    if (body.status) {
      update.status = body.status
    }

    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { error } = await svc.from('orders').update(update).eq('id', body.orderId)

    if (error) {
      console.error('[update-order-status] error:', error.message)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
