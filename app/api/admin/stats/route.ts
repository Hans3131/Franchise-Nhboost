import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Check admin role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Service role for cross-user queries
    const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // All orders
    const { data: orders } = await svc.from('orders').select('user_id, sale_price, actual_sale_price, internal_cost, profit, status, created_at')
    const { data: leads } = await svc.from('leads').select('user_id, status, created_at')
    const { data: profiles } = await svc.from('profiles').select('id, company_name, role, created_at')
    const { data: clients } = await svc.from('clients').select('user_id, commercial_status')

    const allOrders = orders ?? []
    const allLeads = leads ?? []
    const allProfiles = (profiles ?? []).filter(p => p.role === 'franchisee' || !p.role)
    const allClients = clients ?? []

    const completed = allOrders.filter(o => o.status === 'completed')
    const inProgress = allOrders.filter(o => o.status === 'in_progress')

    // KPIs
    const theoreticalRevenue = completed.reduce((s, o) => s + Number(o.sale_price ?? 0), 0)
    const totalRevenue = completed.reduce((s, o) => s + Number(o.actual_sale_price ?? o.sale_price ?? 0), 0)
    const totalCosts = completed.reduce((s, o) => s + Number(o.internal_cost ?? 0), 0)
    const totalMargin = totalRevenue - totalCosts
    const revenueVariance = theoreticalRevenue - totalRevenue
    const ordersInProgress = inProgress.length
    const activeFranchises = allProfiles.length
    const unprocessedLeads = allLeads.filter(l => {
      if (l.status !== 'new') return false
      const age = Date.now() - new Date(l.created_at).getTime()
      return age > 48 * 60 * 60 * 1000
    }).length
    const totalLeads = allLeads.length
    const convertedLeads = allLeads.filter(l => l.status === 'converted').length
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0

    // Top franchises by CA
    const franchiseCA: Record<string, { name: string; ca: number; orders: number; margin: number }> = {}
    completed.forEach(o => {
      if (!franchiseCA[o.user_id]) {
        const p = allProfiles.find(pr => pr.id === o.user_id)
        franchiseCA[o.user_id] = { name: p?.company_name ?? 'Franchise', ca: 0, orders: 0, margin: 0 }
      }
      franchiseCA[o.user_id].ca += Number(o.actual_sale_price ?? o.sale_price ?? 0)
      franchiseCA[o.user_id].orders += 1
      franchiseCA[o.user_id].margin += Number(o.actual_sale_price ?? o.sale_price ?? 0) - Number(o.internal_cost ?? 0)
    })
    const topFranchises = Object.values(franchiseCA).sort((a, b) => b.ca - a.ca).slice(0, 5)

    // Inactive franchises (no order in 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const recentOrderUsers = new Set(allOrders.filter(o => o.created_at > thirtyDaysAgo).map(o => o.user_id))
    const inactiveFranchises = allProfiles
      .filter(p => !recentOrderUsers.has(p.id))
      .map(p => ({ id: p.id, name: p.company_name ?? 'Franchise', lastActivity: '30+ jours' }))

    // Monthly revenue (12 months)
    const now = new Date()
    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const m = d.getMonth()
      const y = d.getFullYear()
      const rev = completed
        .filter(o => { const od = new Date(o.created_at); return od.getMonth() === m && od.getFullYear() === y })
        .reduce((s, o) => s + Number(o.actual_sale_price ?? o.sale_price ?? 0), 0)
      return { month: d.toLocaleDateString('fr-FR', { month: 'short' }), revenue: rev }
    })

    return NextResponse.json({
      kpis: { theoreticalRevenue, totalRevenue, totalCosts, totalMargin, revenueVariance, ordersInProgress, activeFranchises, unprocessedLeads, conversionRate },
      topFranchises,
      inactiveFranchises,
      monthlyRevenue,
    })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
