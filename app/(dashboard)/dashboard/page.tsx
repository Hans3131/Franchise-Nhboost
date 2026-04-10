'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { getAll, type LocalOrder } from '@/lib/orderStore'
import { createClient } from '@/lib/supabase/client'
import {
  Euro, ShoppingCart, TrendingUp, ArrowRight,
  ClipboardList, FolderOpen, HeadphonesIcon, BookOpen,
  Trophy, CheckCircle2, Target,
} from 'lucide-react'
import Link from 'next/link'
import KPICard from '@/components/dashboard/KPICard'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────
type Period = 'month' | 'year' | 'all'

interface OrderRow {
  ref: string; service: string; client_name: string
  price: number; cost: number
  sale_price: number; actual_sale_price: number; internal_cost: number; profit: number
  quantity: number
  status: string; created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────
const now = new Date()
const currentMonth = now.getMonth()
const currentYear  = now.getFullYear()

function filterByPeriod(orders: OrderRow[], period: Period): OrderRow[] {
  if (period === 'all') return orders
  return orders.filter(o => {
    const d = new Date(o.created_at)
    if (period === 'year')  return d.getFullYear() === currentYear
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })
}

function getMonthlyData(orders: OrderRow[]) {
  const months: { key: string; label: string; revenue: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1)
    const m = d.getMonth()
    const y = d.getFullYear()
    const label = d.toLocaleDateString('fr-FR', { month: 'short' })
    const revenue = orders
      .filter(o => o.status === 'completed')
      .filter(o => { const od = new Date(o.created_at); return od.getMonth() === m && od.getFullYear() === y })
      .reduce((s, o) => s + (o.actual_sale_price ?? o.sale_price) * (o.quantity ?? 1), 0)
    months.push({ key: `${y}-${m}`, label: label.charAt(0).toUpperCase() + label.slice(1), revenue })
  }
  // Current month
  const cd = new Date()
  const cRev = orders
    .filter(o => o.status === 'completed')
    .filter(o => { const od = new Date(o.created_at); return od.getMonth() === currentMonth && od.getFullYear() === currentYear })
    .reduce((s, o) => s + (o.actual_sale_price ?? o.sale_price ?? o.price) * (o.quantity ?? 1), 0)
  months.push({
    key: `${currentYear}-${currentMonth}-current`,
    label: cd.toLocaleDateString('fr-FR', { month: 'short' }).replace(/^./, c => c.toUpperCase()),
    revenue: cRev,
  })
  return months
}

const fmt = (n: number) => '€' + n.toLocaleString('fr-FR')

const STATUS_CONFIG = {
  pending:     { label: 'En attente', bg: '#FEF3C7',  text: '#92400E',  dot: '#F59E0B' },
  in_progress: { label: 'En cours',   bg: '#E8F1F8',  text: '#2d2d60',  dot: '#4a81a4' },
  completed:   { label: 'Terminé',    bg: '#DCFCE7',  text: '#166534',  dot: '#22C55E' },
  cancelled:   { label: 'Annulé',     bg: '#FEE2E2',  text: '#991B1B',  dot: '#EF4444' },
} as const

const QUICK_ACTIONS = [
  { label: 'Commandes',         href: '/commandes',  icon: ClipboardList, color: '#4a81a4' },
  { label: 'Projets finalisés', href: '/projets',    icon: FolderOpen,    color: '#8B5CF6' },
  { label: 'Support',           href: '/support',    icon: HeadphonesIcon, color: '#F59E0B' },
  { label: 'Ressources',        href: '/ressources', icon: BookOpen,      color: '#22C55E' },
]

// ─── Objectifs ────────────────────────────────────────────────
const OBJECTIVES = [
  {
    level: 1,
    label: 'Démarrage',
    color: '#6AAEE5',
    targets: [
      { label: 'Récurrent', target: 3000, unit: '€' },
      { label: 'Acquisitions', target: 3, unit: '' },
      { label: 'Sites vendus', target: 3, unit: '', value_target: 3000 },
    ],
  },
  {
    level: 2,
    label: 'Croissance',
    color: '#8B5CF6',
    targets: [
      { label: 'Récurrent', target: 5000, unit: '€' },
      { label: 'Acquisitions', target: 5, unit: '' },
      { label: 'Accompagnement', target: 1, unit: '', value_target: 5000 },
    ],
  },
  {
    level: 3,
    label: 'Performance',
    color: '#22C55E',
    targets: [
      { label: 'Récurrent', target: 10000, unit: '€' },
      { label: 'Acquisitions', target: 10, unit: '' },
      { label: 'Accompagnements', target: 2, unit: '', value_target: 10000 },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────
export default function DashboardPage() {
  const [orders, setOrders]       = useState<OrderRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [userName, setUserName]   = useState('')
  const [franchiseId, setFranchiseId] = useState('')
  const [period, setPeriod]       = useState<Period>('month')

  useEffect(() => {
    // Profile
    try {
      const saved = JSON.parse(localStorage.getItem('nhboost_profile') ?? '{}')
      if (saved.company_name) setUserName(saved.company_name)
    } catch {}

    // Orders — localStorage immédiat
    const localOrders = getAll()
    setOrders(localOrders.map(o => ({
      ref: o.ref, service: o.service, client_name: o.client_name,
      price: o.price, cost: o.cost ?? 0,
        sale_price: o.sale_price ?? o.price,
        actual_sale_price: o.actual_sale_price ?? o.sale_price ?? o.price,
        internal_cost: o.internal_cost ?? o.cost,
        profit: o.profit ?? (o.price - (o.cost > 0 ? o.cost : Math.round(o.price * 0.64))),
        quantity: o.quantity ?? 1,
        status: o.status, created_at: o.created_at,
    })))
    setLoading(false)

    // Supabase data
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      // Profile
      supabase.from('profiles').select('company_name, franchise_code').eq('id', user.id).single()
        .then(({ data: profile }) => {
          if (profile?.company_name) setUserName(profile.company_name)
          if (profile?.franchise_code) {
            const code = profile.franchise_code.replace(/^FRA-/, 'A-').slice(0, 7).toUpperCase()
            setFranchiseId(code)
          }
        })
      // Orders from Supabase
      supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        .then(({ data: rows, error }) => {
          if (!error && rows && rows.length > 0) {
            setOrders(rows.map(r => ({
              ref: r.ref ?? r.id, service: r.service, client_name: r.client_name ?? '',
              price: Number(r.price ?? 0), cost: Number(r.cost ?? 0),
              sale_price: Number(r.sale_price ?? r.price ?? 0),
              actual_sale_price: Number(r.actual_sale_price ?? r.sale_price ?? r.price ?? 0),
              internal_cost: Number(r.internal_cost ?? r.cost ?? 0),
              profit: Number(r.profit ?? 0),
              quantity: Number(r.quantity ?? 1),
              status: r.status ?? 'pending', created_at: r.created_at ?? new Date().toISOString(),
            })))
          }
        })
    })
  }, [])

  // ─── Computed KPIs ─────────────────────────────────────────
  const filtered  = useMemo(() => filterByPeriod(orders, period), [orders, period])
  const completed = useMemo(() => filtered.filter(o => o.status === 'completed'), [filtered])
  // CA théorique = somme des (prix conseillé × quantité)
  const theoreticalRevenue = useMemo(() => completed.reduce((s, o) => s + o.sale_price * (o.quantity ?? 1), 0), [completed])
  // CA réel = somme des (prix réellement facturé × quantité)
  const revenue   = useMemo(() => completed.reduce((s, o) => s + (o.actual_sale_price ?? o.sale_price) * (o.quantity ?? 1), 0), [completed])
  // Coûts internes NHBoost × quantité
  const costs     = useMemo(() => completed.reduce((s, o) => s + o.internal_cost * (o.quantity ?? 1), 0), [completed])
  // Bénéfice réel = CA réel - Coûts
  const profit    = revenue - costs
  // Écart théorique vs réel (positif = vendu sous le conseil)
  const variance  = theoreticalRevenue - revenue

  // ─── Chart data ────────────────────────────────────────────
  const chartData = useMemo(() => getMonthlyData(orders), [orders])
  const maxChart  = useMemo(() => Math.max(...chartData.map(d => d.revenue), 1), [chartData])

  // ─── Recent orders (always from all) ───────────────────────
  const recent = useMemo(() => orders.slice(0, 5).map(o => ({
    ...o,
    date: new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
    priceFormatted: fmt(o.price),
    statusKey: o.status as keyof typeof STATUS_CONFIG,
  })), [orders])

  // ─── Objectives progress ──────────────────────────────────
  const allCompleted = useMemo(() => orders.filter(o => o.status === 'completed'), [orders])
  const recurringRevenue = useMemo(() =>
    allCompleted.filter(o => /seo|social|ads|analytics/i.test(o.service)).reduce((s, o) => s + o.price, 0),
  [allCompleted])
  const acquisitionCount = useMemo(() =>
    allCompleted.filter(o => /site|web|landing/i.test(o.service) || /ads|seo|social/i.test(o.service)).length,
  [allCompleted])
  const siteRevenue = useMemo(() =>
    allCompleted.filter(o => /site|web|landing/i.test(o.service)).reduce((s, o) => s + o.price, 0),
  [allCompleted])
  const accompCount = useMemo(() =>
    allCompleted.filter(o => /accompagnement|business|consulting/i.test(o.service)).length,
  [allCompleted])

  function getObjProgress(obj: typeof OBJECTIVES[0]) {
    return obj.targets.map(t => {
      let current = 0
      if (t.label === 'Récurrent') current = recurringRevenue
      else if (t.label === 'Acquisitions') current = acquisitionCount
      else if (t.label.includes('Site')) current = siteRevenue
      else if (t.label.includes('Accompagnement')) current = accompCount
      return { ...t, current, pct: Math.min(100, Math.round((current / t.target) * 100)) }
    })
  }

  // ─── Period labels ─────────────────────────────────────────
  const PERIOD_OPTS: { key: Period; label: string }[] = [
    { key: 'month', label: 'Ce mois' },
    { key: 'year',  label: 'Cette année' },
    { key: 'all',   label: 'Total' },
  ]

  const dateLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    .replace(/^./, c => c.toUpperCase())

  const periodLabel = PERIOD_OPTS.find(p => p.key === period)!.label
  const KPI_DATA = [
    { label: "CA théorique",    value: loading ? '…' : fmt(theoreticalRevenue), delta: periodLabel, trend: 'up' as const,   icon: Target,       iconColor: '#8B5CF6' },
    { label: "CA réel",         value: loading ? '…' : fmt(revenue),            delta: periodLabel, trend: 'up' as const,   icon: Euro,         iconColor: '#6AAEE5' },
    { label: 'Coûts totaux',    value: loading ? '…' : fmt(costs),              delta: periodLabel, trend: 'down' as const, icon: ShoppingCart, iconColor: '#F59E0B' },
    { label: 'Bénéfice réel',   value: loading ? '…' : fmt(profit),             delta: periodLabel, trend: profit >= 0 ? 'up' as const : 'down' as const, icon: TrendingUp, iconColor: '#22C55E' },
    { label: 'Écart vs conseil', value: loading ? '…' : fmt(variance),           delta: variance > 0 ? 'Sous le conseil' : variance < 0 ? 'Au-dessus' : 'Conforme', trend: variance <= 0 ? 'up' as const : 'down' as const, icon: TrendingUp, iconColor: variance > 0 ? '#EF4444' : '#22C55E' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[#9CA3AF] mb-1">{dateLabel}</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Bienvenue, <span className="text-[#4a81a4] font-semibold">{userName || 'Franchisé'}</span>
            {franchiseId && <span className="text-[#9CA3AF] ml-2 text-xs font-mono">({franchiseId})</span>}
          </p>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2]">
          {PERIOD_OPTS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                period === p.key
                  ? 'bg-white text-[#2d2d60] shadow-sm border border-[#E2E8F2]'
                  : 'text-[#9CA3AF] hover:text-[#2d2d60]'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {KPI_DATA.map((kpi, i) => (
          <KPICard key={kpi.label} {...kpi} index={i} />
        ))}
      </div>

      {/* ── Chart + Quick Actions ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}
          className="lg:col-span-2 rounded-2xl border border-[#E2E8F2] bg-white p-6 shadow-[0_1px_3px_rgba(45,45,96,0.07)]"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">
                Chiffre d&apos;affaires mensuel
              </h2>
              <p className="text-2xl font-bold text-[#2d2d60] tracking-tight">{fmt(revenue)}</p>
            </div>
          </div>
          <div className="flex items-end gap-2 h-32">
            {chartData.map((bar, i) => {
              const isLast = i === chartData.length - 1
              const pct = maxChart > 0 ? (bar.revenue / maxChart) * 100 : 0
              return (
                <div key={bar.key} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex items-end justify-center" style={{ height: '110px' }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(pct, 4)}%` }}
                      transition={{ duration: 0.6, delay: 0.4 + i * 0.06 }}
                      className={cn(
                        'w-full rounded-t-md',
                        isLast
                          ? 'bg-gradient-to-t from-[#2d2d60] to-[#4a81a4]'
                          : 'bg-[#E8EDF4] hover:bg-[#D1DCE8] transition-colors'
                      )}
                    />
                  </div>
                  <span className={cn('text-[10px] font-medium', isLast ? 'text-[#4a81a4]' : 'text-[#9CA3AF]')}>
                    {bar.label}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.35 }}
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-4">
            Accès rapide
          </h2>
          <div className="space-y-2">
            {QUICK_ACTIONS.map(({ label, href, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E2E8F2] bg-white hover:border-[#4a81a4] hover:shadow-[0_2px_8px_rgba(74,129,164,0.1)] transition-all duration-200"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ background: `${color}18` }}>
                  <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.75} />
                </div>
                <span className="text-sm font-medium text-[#374151] group-hover:text-[#2d2d60] flex-1">{label}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-70 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" style={{ color }} />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Recent Orders ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Commandes récentes</h2>
          <Link href="/commandes" className="flex items-center gap-1 text-xs font-medium text-[#4a81a4] hover:text-[#2d2d60] transition-colors group">
            Tout voir <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        <div className="rounded-2xl border border-[#E2E8F2] overflow-hidden bg-white shadow-[0_1px_3px_rgba(45,45,96,0.06)]">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 py-2.5 border-b border-[#F0F3F8] bg-[#F8FAFC]">
            {['Service', 'Client', 'Prix', 'Statut'].map(h => (
              <span key={h} className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-[#F0F3F8]">
            {recent.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[#9CA3AF]">Aucune commande pour le moment</div>
            )}
            {recent.map((order, i) => {
              const s = STATUS_CONFIG[order.statusKey] ?? STATUS_CONFIG.pending
              return (
                <motion.div key={order.ref} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 + i * 0.05 }}
                  className="group px-4 py-3.5 hover:bg-[#F8FAFC] transition-colors">
                  <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center">
                    <div>
                      <p className="text-[13px] font-semibold text-[#2d2d60] group-hover:text-[#4a81a4] transition-colors truncate">{order.service}</p>
                      <p className="text-[11px] text-[#9CA3AF] font-mono mt-0.5">{order.ref}</p>
                    </div>
                    <p className="text-[13px] text-[#6B7280] truncate">{order.client_name}</p>
                    <p className="text-[13px] font-semibold text-[#2d2d60] font-mono whitespace-nowrap">{order.priceFormatted}</p>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ background: s.bg, color: s.text }}>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                      {s.label}
                    </span>
                  </div>
                  <div className="flex sm:hidden items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#2d2d60] truncate">{order.service}</p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">{order.client_name} · {order.priceFormatted}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium flex-shrink-0" style={{ background: s.bg, color: s.text }}>
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

      {/* ── Objectifs Business ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-[#F59E0B]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Objectifs de progression</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {OBJECTIVES.map(obj => {
            const progress = getObjProgress(obj)
            const overallPct = Math.round(progress.reduce((s, p) => s + p.pct, 0) / progress.length)
            const isComplete = overallPct >= 100

            return (
              <div
                key={obj.level}
                className={cn(
                  'relative rounded-2xl border bg-white p-5 overflow-hidden transition-all duration-300 shadow-[0_1px_3px_rgba(45,45,96,0.07)]',
                  isComplete ? 'border-[#22C55E] shadow-[0_0_16px_rgba(34,197,94,0.1)]' : 'border-[#E2E8F2] hover:border-[#4a81a4]'
                )}
              >
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${obj.color}, transparent)` }} />

                {/* Header */}
                <div className="flex items-center justify-between mb-4 mt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: obj.color }}>
                      {obj.level}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#2d2d60]">{obj.label}</p>
                    </div>
                  </div>
                  {isComplete && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.1)] text-[#22C55E]">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="text-[10px] font-bold">Atteint</span>
                    </div>
                  )}
                </div>

                {/* Overall progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Progression</span>
                    <span className="text-[12px] font-bold" style={{ color: obj.color }}>{overallPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F0F3F8] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${overallPct}%` }}
                      transition={{ duration: 0.8, delay: 0.6 }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${obj.color}, ${obj.color}CC)` }}
                    />
                  </div>
                </div>

                {/* Individual targets */}
                <div className="space-y-2.5">
                  {progress.map(t => (
                    <div key={t.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-[#6B7280]">{t.label}</span>
                        <span className="text-[11px] font-semibold text-[#2d2d60]">
                          {t.unit === '€' ? fmt(t.current) : t.current} / {t.unit === '€' ? fmt(t.target) : t.target}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#F0F3F8] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${t.pct}%`, background: obj.color, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Congrats message */}
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
                    className="mt-4 px-3 py-2 rounded-xl bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.15)] text-center"
                  >
                    <p className="text-[12px] font-semibold text-[#22C55E]">
                      Objectif atteint ! Continuez votre progression.
                    </p>
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

    </div>
  )
}
