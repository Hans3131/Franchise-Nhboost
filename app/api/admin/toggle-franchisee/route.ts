import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'

const bodySchema = z.object({
  franchiseeId: z.string().uuid('ID franchisé invalide'),
  action: z.enum(['activate', 'suspend']),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const blocked = checkRateLimit('toggle-franchisee', user.id, 10, 60_000)
    if (blocked) return blocked

    // Validation Zod
    let body: z.infer<typeof bodySchema>
    try {
      const raw = await req.json()
      body = bodySchema.parse(raw)
    } catch (e) {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : 'JSON invalide'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const newStatus = body.action === 'activate' ? 'active' : 'suspended'

    const { error } = await svc
      .from('profiles')
      .update({ account_status: newStatus })
      .eq('id', body.franchiseeId)

    if (error) {
      console.error('[toggle-franchisee] error:', error.message)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    if (body.action === 'suspend') {
      await svc.auth.admin.updateUserById(body.franchiseeId, { ban_duration: '876000h' })
    } else {
      await svc.auth.admin.updateUserById(body.franchiseeId, { ban_duration: 'none' })
    }

    return NextResponse.json({ ok: true, status: newStatus })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
