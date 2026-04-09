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

    // Fetch all franchisee profiles
    const { data: profiles, error: profilesErr } = await svc
      .from('profiles')
      .select('id, company_name, first_name, last_name, phone, franchise_code, account_status, role, created_at')
      .order('created_at', { ascending: false })

    if (profilesErr) {
      return NextResponse.json({ error: profilesErr.message }, { status: 500 })
    }

    // Include all users (franchisees + admins shown with role)
    const franchisees = (profiles ?? [])

    // Fetch auth users to get emails
    const { data: authData } = await svc.auth.admin.listUsers({ perPage: 1000 })
    const emailMap = new Map(
      (authData?.users ?? []).map(u => [u.id, u.email ?? '']),
    )

    const enriched = franchisees.map(p => ({
      id: p.id,
      company_name: p.company_name ?? '',
      first_name: p.first_name ?? '',
      last_name: p.last_name ?? '',
      email: emailMap.get(p.id) ?? '',
      phone: p.phone ?? null,
      franchise_code: p.franchise_code ?? '',
      account_status: p.account_status ?? 'active',
      role: p.role ?? 'franchisee',
      created_at: p.created_at,
    }))

    return NextResponse.json({ franchisees: enriched })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
