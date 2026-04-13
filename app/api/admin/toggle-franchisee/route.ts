import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { franchiseeId, action } = await req.json()
    if (!franchiseeId || !['activate', 'suspend'].includes(action)) {
      return NextResponse.json({ error: 'franchiseeId et action (activate/suspend) requis' }, { status: 400 })
    }

    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const newStatus = action === 'activate' ? 'active' : 'suspended'

    // Update profile status
    const { error } = await svc
      .from('profiles')
      .update({ account_status: newStatus })
      .eq('id', franchiseeId)

    if (error) {
      console.error('[toggle-franchisee] error:', error.message)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    // If suspending, also ban the auth user
    if (action === 'suspend') {
      await svc.auth.admin.updateUserById(franchiseeId, { ban_duration: '876000h' }) // ~100 years
    } else {
      await svc.auth.admin.updateUserById(franchiseeId, { ban_duration: 'none' })
    }

    return NextResponse.json({ ok: true, status: newStatus })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
