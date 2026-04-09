import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const alerts: { type: string; severity: string; title: string; message: string; franchiseName?: string }[] = []
    const now = Date.now()
    const _48h = 48 * 60 * 60 * 1000
    const _30d = 30 * 24 * 60 * 60 * 1000

    const { data: profiles } = await svc.from('profiles').select('id, company_name, role')
    const franchises = (profiles ?? []).filter(p => p.role === 'franchisee' || !p.role)

    // 1. Leads non traités > 48h
    const { data: leads } = await svc.from('leads').select('id, name, user_id, status, created_at')
    ;(leads ?? []).forEach(l => {
      if (l.status === 'new' && now - new Date(l.created_at).getTime() > _48h) {
        const f = franchises.find(p => p.id === l.user_id)
        alerts.push({ type: 'unprocessed_lead', severity: 'critical', title: `Lead non traité : ${l.name}`, message: `Chez ${f?.company_name ?? 'Franchise'} — depuis ${Math.round((now - new Date(l.created_at).getTime()) / 3600000)}h`, franchiseName: f?.company_name })
      }
    })

    // 2. Commandes en retard > 30j
    const { data: orders } = await svc.from('orders').select('id, ref, user_id, status, created_at')
    ;(orders ?? []).forEach(o => {
      if (o.status === 'in_progress' && now - new Date(o.created_at).getTime() > _30d) {
        const f = franchises.find(p => p.id === o.user_id)
        alerts.push({ type: 'late_order', severity: 'critical', title: `Commande en retard : ${o.ref}`, message: `Chez ${f?.company_name ?? 'Franchise'} — en cours depuis ${Math.round((now - new Date(o.created_at).getTime()) / 86400000)}j`, franchiseName: f?.company_name })
      }
    })

    // 3. Franchisés inactifs > 30j
    const recentUsers = new Set((orders ?? []).filter(o => now - new Date(o.created_at).getTime() < _30d).map(o => o.user_id))
    franchises.forEach(f => {
      if (!recentUsers.has(f.id)) {
        alerts.push({ type: 'inactive_franchise', severity: 'warning', title: `Franchisé inactif : ${f.company_name}`, message: 'Aucune commande depuis 30+ jours', franchiseName: f.company_name })
      }
    })

    // 4. Taux de conversion bas
    franchises.forEach(f => {
      const fLeads = (leads ?? []).filter(l => l.user_id === f.id)
      if (fLeads.length >= 5) {
        const converted = fLeads.filter(l => l.status === 'converted').length
        const rate = (converted / fLeads.length) * 100
        if (rate < 10) {
          alerts.push({ type: 'low_conversion', severity: 'warning', title: `Conversion basse : ${f.company_name}`, message: `Taux de ${Math.round(rate)}% (${converted}/${fLeads.length} leads)`, franchiseName: f.company_name })
        }
      }
    })

    // Sort: critical first, then warning, then info
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
    alerts.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2))

    return NextResponse.json({ alerts })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
