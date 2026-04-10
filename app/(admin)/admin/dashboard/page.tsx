'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Euro, ShoppingCart, TrendingUp, Users, Inbox, Target,
  AlertTriangle, AlertCircle, Info, CheckCircle2, Trophy,
  Clock, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const fmt = (n: number) => '€' + n.toLocaleString('fr-FR')

const SEVERITY_CONFIG = {
  critical: { label: 'Critique', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: AlertTriangle },
  warning:  { label: 'Attention', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: AlertCircle },
  info:     { label: 'Info', color: '#6AAEE5', bg: 'rgba(106,174,229,0.08)', icon: Info },
}

interface Stats {
  kpis: { theoreticalRevenue: number; totalRevenue: number; totalCosts: number; totalMargin: number; revenueVariance: number; ordersInProgress: number; activeFranchises: number; unprocessedLeads: number; conversionRate: number }
  topFranchises: { name: string; ca: number; orders: number; margin: number }[]
  inactiveFranchises: { id: string; name: string; lastActivity: string }[]
  monthlyRevenue: { month: string; revenue: number }[]
}

interface Alert {
  type: string; severity: string; title: string; message: string; franchiseName?: string
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats').then(r => r.json()),
      fetch('/api/admin/alerts').then(r => r.json()),
    ]).then(([s, a]) => {
      setStats(s.kpis ? s : null)
      setAlerts(a.alerts ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const maxChart = useMemo(() => {
    if (!stats) return 1
    return Math.max(...stats.monthlyRevenue.map(m => m.revenue), 1)
  }, [stats])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#9CA3AF]">Chargement du dashboard admin...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <XCircle className="w-12 h-12 text-[#EF4444] mb-4" />
        <h2 className="text-xl font-bold text-[#2d2d60] mb-2">Accès refusé</h2>
        <p className="text-[#6B7280]">Vous n&apos;avez pas les permissions admin.</p>
      </div>
    )
  }

  const { kpis } = stats

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">Administration</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Vue réseau</h1>
        <p className="text-sm text-[#6B7280] mt-1">Performance globale du réseau NHBoost en temps réel.</p>
      </motion.div>

      {/* KPIs financiers (théorique vs réel) */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          { label: 'CA théorique', value: fmt(kpis.theoreticalRevenue), icon: Target, color: '#9CA3AF' },
          { label: 'CA réel', value: fmt(kpis.totalRevenue), icon: Euro, color: '#6AAEE5' },
          { label: 'Coûts totaux', value: fmt(kpis.totalCosts), icon: TrendingUp, color: '#F59E0B' },
          { label: 'Marge réelle', value: fmt(kpis.totalMargin), icon: TrendingUp, color: '#22C55E' },
          {
            label: kpis.revenueVariance >= 0 ? 'Écart (sous conseil)' : 'Écart (sur conseil)',
            value: (kpis.revenueVariance >= 0 ? '−' : '+') + fmt(Math.abs(kpis.revenueVariance)),
            icon: AlertCircle,
            color: kpis.revenueVariance > 0 ? '#EF4444' : '#22C55E',
          },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} className="rounded-xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.07)] px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}14` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: kpi.color }} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-[18px] font-bold text-[#2d2d60] leading-none">{kpi.value}</p>
              <p className="text-[10px] text-[#9CA3AF] font-medium mt-1 uppercase tracking-wider">{kpi.label}</p>
            </div>
          )
        })}
      </motion.div>

      {/* KPIs opérationnels */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Commandes en cours', value: String(kpis.ordersInProgress), icon: ShoppingCart, color: '#F59E0B' },
          { label: 'Franchisés actifs', value: String(kpis.activeFranchises), icon: Users, color: '#8B5CF6' },
          { label: 'Leads non traités', value: String(kpis.unprocessedLeads), icon: Inbox, color: kpis.unprocessedLeads > 0 ? '#EF4444' : '#9CA3AF' },
          { label: 'Taux conversion', value: `${kpis.conversionRate}%`, icon: Target, color: '#14B8A6' },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} className="rounded-xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.07)] px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}14` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: kpi.color }} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-[18px] font-bold text-[#2d2d60] leading-none">{kpi.value}</p>
              <p className="text-[10px] text-[#9CA3AF] font-medium mt-1 uppercase tracking-wider">{kpi.label}</p>
            </div>
          )
        })}
      </motion.div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#EF4444] mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> Alertes ({alerts.length})
          </h2>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {alerts.map((alert, i) => {
              const cfg = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info
              const AlertIcon = cfg.icon
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-white" style={{ borderColor: `${cfg.color}30` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                    <AlertIcon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#2d2d60]">{alert.title}</p>
                    <p className="text-[12px] text-[#6B7280] mt-0.5">{alert.message}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: cfg.color, background: cfg.bg }}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Top franchises + Inactive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top 5 */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.06)] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#F0F3F8]">
            <Trophy className="w-4 h-4 text-[#F59E0B]" />
            <h2 className="text-[13px] font-bold text-[#2d2d60]">Top franchisés</h2>
          </div>
          <div className="divide-y divide-[#F0F3F8]">
            {stats.topFranchises.length === 0 && (
              <div className="px-5 py-8 text-center text-[13px] text-[#9CA3AF]">Aucune donnée</div>
            )}
            {stats.topFranchises.map((f, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <span className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                  i === 0 ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                  i === 1 ? 'bg-[#9CA3AF]/10 text-[#6B7280]' :
                  i === 2 ? 'bg-[#CD7F32]/10 text-[#CD7F32]' :
                  'bg-[#F5F7FA] text-[#9CA3AF]'
                )}>
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#2d2d60] truncate">{f.name}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{f.orders} commandes</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[14px] font-bold text-[#2d2d60] font-mono">{fmt(f.ca)}</p>
                  <p className="text-[10px] text-[#22C55E] font-medium">+{fmt(f.margin)} marge</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Inactive */}
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.06)] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#F0F3F8]">
            <Clock className="w-4 h-4 text-[#EF4444]" />
            <h2 className="text-[13px] font-bold text-[#2d2d60]">Franchisés inactifs</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EF4444]/10 text-[#EF4444]">
              {stats.inactiveFranchises.length}
            </span>
          </div>
          <div className="divide-y divide-[#F0F3F8] max-h-[300px] overflow-y-auto">
            {stats.inactiveFranchises.length === 0 && (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-[#22C55E] mx-auto mb-2" />
                <p className="text-[13px] text-[#22C55E] font-medium">Tous les franchisés sont actifs</p>
              </div>
            )}
            {stats.inactiveFranchises.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#2d2d60]">{f.name}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{f.lastActivity}</p>
                </div>
                <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-[#EF4444]/10 text-[#EF4444]">Inactif</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Monthly chart */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl bg-white border border-[#E2E8F2] p-6 shadow-[0_1px_3px_rgba(45,45,96,0.06)]">
        <div className="mb-6">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">CA réseau — 12 mois</h2>
          <p className="text-2xl font-bold text-[#2d2d60]">{fmt(kpis.totalRevenue)}</p>
        </div>
        <div className="flex items-end gap-2 h-32">
          {stats.monthlyRevenue.map((bar, i) => {
            const isLast = i === stats.monthlyRevenue.length - 1
            const pct = maxChart > 0 ? (bar.revenue / maxChart) * 100 : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex items-end justify-center" style={{ height: '110px' }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, 4)}%` }}
                    transition={{ duration: 0.6, delay: 0.3 + i * 0.04 }}
                    className={cn('w-full rounded-t-md', isLast ? 'bg-gradient-to-t from-[#2d2d60] to-[#4a81a4]' : 'bg-[#E8EDF4]')}
                  />
                </div>
                <span className={cn('text-[9px] font-medium', isLast ? 'text-[#4a81a4]' : 'text-[#9CA3AF]')}>
                  {bar.month}
                </span>
              </div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
