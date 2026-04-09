import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    // Check admin role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    // Service role for cross-user queries
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Fetch all orders
    const { data: orders, error: ordersErr } = await svc
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (ordersErr) {
      return NextResponse.json({ error: ordersErr.message }, { status: 500 })
    }

    // Fetch all profiles for franchise name mapping
    const { data: profiles } = await svc
      .from('profiles')
      .select('id, company_name, first_name, last_name, franchise_code')

    const profileMap = new Map(
      (profiles ?? []).map(p => [
        p.id,
        {
          franchise_name: p.company_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Franchise',
          franchise_code: p.franchise_code,
        },
      ]),
    )

    // Enrich orders with franchise info
    const enriched = (orders ?? []).map(o => ({
      ...o,
      franchise_name: profileMap.get(o.user_id)?.franchise_name ?? 'Franchise inconnue',
      franchise_code: profileMap.get(o.user_id)?.franchise_code ?? '',
    }))

    return NextResponse.json({ orders: enriched })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
