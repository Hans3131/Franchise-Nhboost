'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getStats } from '@/lib/orderStore'
import {
  Euro,
  ShoppingCart,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
  ClipboardList,
  HeadphonesIcon,
  BookOpen,
  FolderOpen,
} from 'lucide-react'
import Link from 'next/link'
import KPICard from '@/components/dashboard/KPICard'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────
interface KpiState {
  revenue: number
  costs: number
  profit: number
  active: number
  recentOrders: {
    id: string; ref: string; service: string; client: string
    date: string; price: string; status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  }[]
}

const QUICK_ACTIONS = [
  { label: 'Nouvelle commande',  href: '/commander',  icon: Plus,            color: '#2d2d60', primary: true },
  { label: 'Mes commandes',      href: '/commandes',  icon: ClipboardList,   color: '#4a81a4' },
  { label: 'Mes projets',        href: '/projets',    icon: FolderOpen,      color: '#8B5CF6' },
  { label: 'Support',            href: '/support',    icon: HeadphonesIcon,  color: '#F59E0B' },
  { label: 'Ressources',         href: '/ressources', icon: BookOpen,        color: '#22C55E' },
]

const STATUS_CONFIG = {
  pending:     { label: 'En attente', bg: '#FEF3C7',  text: '#92400E',  dot: '#F59E0B' },
  in_progress: { label: 'En cours',   bg: '#E8F1F8',  text: '#2d2d60',  dot: '#4a81a4' },
  completed:   { label: 'Terminé',    bg: '#DCFCE7',  text: '#166534',  dot: '#22C55E' },
  cancelled:   { label: 'Annulé',     bg: '#FEE2E2',  text: '#991B1B',  dot: '#EF4444' },
} as const

const EMPTY_KPI: KpiState = { revenue: 0, costs: 0, profit: 0, active: 0, recentOrders: [] }

// ─── Component ────────────────────────────────────────────────
export default function DashboardPage() {
  const [kpi, setKpi]           = useState<KpiState>(EMPTY_KPI)
  const [loading, setLoading]   = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const buildKpi = (orders: { ref: string; service: string; client_name: string; price: number; status: string; created_at: string }[]) => {
      const revenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.price, 0)
      const costs   = Math.round(revenue * 0.64)
      const active  = orders.filter(o => ['pending', 'in_progress'].includes(o.status)).length
      const recent  = orders.slice(0, 4).map(o => ({
        id: o.ref, ref: o.ref, service: o.service, client: o.client_name,
        date: new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
        price: '€' + o.price.toLocaleString('fr-FR'), status: o.status as KpiState['recentOrders'][0]['status'],
      }))
      return { revenue, costs, profit: revenue - costs, active, recentOrders: recent }
    }

    // ── Nom du franchisé (localStorage + Supabase) ────────
    try {
      const saved = JSON.parse(localStorage.getItem('nhboost_profile') ?? '{}')
      if (saved.company_name) setUserName(saved.company_name)
    } catch {}

    // ── Données via store Supabase-first ──────────────────
    getStats().then(stats => {
      setKpi(buildKpi(stats.orders))
      setLoading(false)
    })
  }, [])

  const fmt = (n: number) => '€' + n.toLocaleString('fr-FR')

  const KPI_DATA = [
    { label: "Chiffre d'affaires", value: loading ? '…' : fmt(kpi.revenue), delta: 'ce mois', trend: 'up'      as const, icon: Euro,         iconColor: '#6AAEE5' },
    { label: 'Coûts commandes',    value: loading ? '…' : fmt(kpi.costs),   delta: 'ce mois', trend: 'down'    as const, icon: ShoppingCart, iconColor: '#F59E0B' },
    { label: 'Bénéfices nets',     value: loading ? '…' : fmt(kpi.profit),  delta: 'ce mois', trend: 'up'      as const, icon: TrendingUp,   iconColor: '#22C55E' },
    { label: 'Commandes actives',  value: loading ? '…' : String(kpi.active), delta: 'actives', trend: 'neutral' as const, icon: Clock,       iconColor: '#8B5CF6' },
  ]

  const RECENT_ORDERS = kpi.recentOrders

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <p className="text-xs font-medium uppercase tracking-widest text-[#9CA3AF] mb-1">
          Avril 2026
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Bienvenue,{' '}
          <span className="text-[#4a81a4] font-semibold">
            {userName || 'Franchisé'}
          </span>{' '}
          — voici l'aperçu de votre activité.
        </p>
      </motion.div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {KPI_DATA.map((kpi, i) => (
          <KPICard key={kpi.label} {...kpi} index={i} />
        ))}
      </div>

      {/* Quick Actions + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="lg:col-span-1"
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-4">
            Actions rapides
          </h2>
          <div className="space-y-2">
            {QUICK_ACTIONS.map(({ label, href, icon: Icon, color, primary }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200',
                  primary
                    ? 'bg-[#2d2d60] border-[#2d2d60] hover:bg-[#4a81a4] hover:border-[#4a81a4] shadow-[0_2px_8px_rgba(45,45,96,0.2)]'
                    : 'bg-white border-[#E2E8F2] hover:border-[#4a81a4] hover:shadow-[0_2px_8px_rgba(74,129,164,0.1)]'
                )}
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                  style={{ background: primary ? 'rgba(255,255,255,0.15)' : `${color}18` }}
                >
                  <Icon className="w-4 h-4" style={{ color: primary ? '#FFFFFF' : color }} strokeWidth={1.75} />
                </div>
                <span className={cn(
                  'text-sm font-medium flex-1',
                  primary ? 'text-white' : 'text-[#374151] group-hover:text-[#2d2d60]'
                )}>
                  {label}
                </span>
                <ArrowRight
                  className="w-3.5 h-3.5 opacity-0 group-hover:opacity-70 -translate-x-1 group-hover:translate-x-0 transition-all duration-200"
                  style={{ color: primary ? '#FFFFFF' : color }}
                />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
              Commandes récentes
            </h2>
            <Link
              href="/commandes"
              className="flex items-center gap-1 text-xs font-medium text-[#4a81a4] hover:text-[#2d2d60] transition-colors group"
            >
              Tout voir
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="rounded-2xl border border-[#E2E8F2] overflow-hidden bg-white shadow-[0_1px_3px_rgba(45,45,96,0.06)]">
            {/* Table header — desktop */}
            <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 py-2.5 border-b border-[#F0F3F8] bg-[#F8FAFC]">
              {['Service', 'Client', 'Prix', 'Statut'].map(h => (
                <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#F0F3F8]">
              {RECENT_ORDERS.map((order, i) => {
                const s = STATUS_CONFIG[order.status]
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45 + i * 0.05 }}
                    className="group px-4 py-3.5 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center">
                      <div>
                        <p className="text-[13px] font-semibold text-[#2d2d60] group-hover:text-[#4a81a4] transition-colors truncate">
                          {order.service}
                        </p>
                        <p className="text-[11px] text-[#9CA3AF] font-mono mt-0.5">{order.id}</p>
                      </div>
                      <p className="text-[13px] text-[#6B7280] truncate">{order.client}</p>
                      <p className="text-[13px] font-semibold text-[#2d2d60] font-mono whitespace-nowrap">{order.price}</p>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
                        style={{ background: s.bg, color: s.text }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{
                            background: s.dot,
                            animation: ['in_progress', 'pending'].includes(order.status)
                              ? 'pulse-dot 1.5s ease-in-out infinite'
                              : undefined,
                          }}
                        />
                        {s.label}
                      </span>
                    </div>

                    {/* Mobile row */}
                    <div className="flex sm:hidden items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#2d2d60] truncate">{order.service}</p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">{order.client} · {order.price}</p>
                      </div>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium flex-shrink-0"
                        style={{ background: s.bg, color: s.text }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                        {s.label}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Monthly revenue bar chart — simple CSS */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.55 }}
        className="rounded-2xl border border-[#E2E8F2] bg-white p-6 shadow-[0_1px_3px_rgba(45,45,96,0.07)]"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">
              Chiffre d'affaires mensuel
            </h2>
            <p className="text-2xl font-bold text-[#2d2d60] tracking-tight">€24 800</p>
          </div>
          <div className="flex gap-2">
            {['3M', '6M', '1A'].map((p, i) => (
              <button
                key={p}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                  i === 1
                    ? 'bg-[#E8F1F8] text-[#4a81a4] border border-[#C5D9EC]'
                    : 'text-[#9CA3AF] hover:text-[#2d2d60] hover:bg-[#F5F7FA]'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Bars */}
        <div className="flex items-end gap-2 h-28">
          {[
            { month: 'Oct', value: 62 },
            { month: 'Nov', value: 74 },
            { month: 'Déc', value: 55 },
            { month: 'Jan', value: 80 },
            { month: 'Fév', value: 68 },
            { month: 'Mar', value: 90 },
            { month: 'Avr', value: 100, current: true },
          ].map(({ month, value, current }) => (
            <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                <div
                  className={cn(
                    'w-full rounded-t-md transition-all duration-700',
                    current
                      ? 'bg-gradient-to-t from-[#2d2d60] to-[#4a81a4]'
                      : 'bg-[#E8EDF4] hover:bg-[#D1DCE8]'
                  )}
                  style={{ height: `${value}%` }}
                />
              </div>
              <span className={cn(
                'text-[10px] font-medium',
                current ? 'text-[#4a81a4]' : 'text-[#9CA3AF]'
              )}>
                {month}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

    </div>
  )
}
