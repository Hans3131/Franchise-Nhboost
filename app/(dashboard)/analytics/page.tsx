'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { getAll as getOrders } from '@/lib/orderStore'
import { getAll as getLeads } from '@/lib/leadStore'
import { getAll as getClients } from '@/lib/clientStore'
import { cn } from '@/lib/utils'
import type { LocalOrder } from '@/lib/orderStore'
import type { Lead, Client } from '@/types'
import {
  Euro, TrendingUp, TrendingDown, BarChart3, Users,
  Target, ShoppingCart, Percent, ArrowUp, ArrowDown,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) => '\u20AC' + n.toLocaleString('fr-FR')

const MONTH_LABELS_FR = [
  'Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec',
]

interface LeaderboardEntry {
  franchise_id: string
  total_revenue: number
  rank: number
}

// ─── Component ────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [orders, setOrders] = useState<LocalOrder[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [monthlyTarget, setMonthlyTarget] = useState(5000)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardTotal, setLeaderboardTotal] = useState(0)
  const [currentRank, setCurrentRank] = useState(0)

  useEffect(() => {
    // Orders (sync)
    setOrders(getOrders())

    // Leads + Clients (async)
    Promise.all([getLeads(), getClients()])
      .then(([l, c]) => {
        setLeads(l)
        setClients(c)
      })
      .finally(() => setLoading(false))

    // Leaderboard
    fetch('/api/leaderboard')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.entries) {
          setLeaderboard(data.entries.slice(0, 10))
          setLeaderboardTotal(data.total ?? data.entries.length)
          setCurrentRank(data.current_rank ?? 0)
        }
      })
      .catch(() => {})
  }, [])

  // ─── KPIs ───────────────────────────────────────────────────
  const completed = useMemo(() => orders.filter(o => o.status === 'completed'), [orders])

  const caTotal = useMemo(
    () => completed.reduce((s, o) => s + (o.sale_price ?? o.price), 0),
    [completed],
  )

  const coutsTotal = useMemo(
    () => completed.reduce((s, o) => s + (o.internal_cost ?? o.cost), 0),
    [completed],
  )

  const beneficeNet = caTotal - coutsTotal

  const tauxConversion = useMemo(() => {
    if (leads.length === 0) return null
    const converted = leads.filter(l => l.status === 'converted').length
    return Math.round((converted / leads.length) * 100)
  }, [leads])

  const clientsActifs = useMemo(
    () => clients.filter(c => c.commercial_status === 'active').length,
    [clients],
  )

  const panierMoyen = completed.length > 0 ? Math.round(caTotal / completed.length) : 0

  const KPI_DATA = [
    { label: 'CA total', value: fmt(caTotal), icon: Euro, iconColor: '#6AAEE5' },
    { label: 'Couts totaux', value: fmt(coutsTotal), icon: ShoppingCart, iconColor: '#F59E0B' },
    { label: 'Benefice net', value: fmt(beneficeNet), icon: beneficeNet >= 0 ? TrendingUp : TrendingDown, iconColor: beneficeNet >= 0 ? '#22C55E' : '#EF4444' },
    { label: 'Taux de conversion', value: tauxConversion !== null ? `${tauxConversion}%` : '\u2014', icon: Percent, iconColor: '#8B5CF6' },
    { label: 'Clients actifs', value: String(clientsActifs), icon: Users, iconColor: '#14B8A6' },
    { label: 'Panier moyen', value: fmt(panierMoyen), icon: Target, iconColor: '#F97316' },
  ]

  // ─── 12-month chart ─────────────────────────────────────────
  const now = new Date()
  const chartData = useMemo(() => {
    const data: { key: string; label: string; revenue: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = d.getMonth()
      const y = d.getFullYear()
      const rev = completed
        .filter(o => {
          const od = new Date(o.created_at)
          return od.getMonth() === m && od.getFullYear() === y
        })
        .reduce((s, o) => s + (o.sale_price ?? o.price), 0)
      data.push({ key: `${y}-${m}`, label: MONTH_LABELS_FR[m], revenue: rev })
    }
    return data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed])

  const maxChart = useMemo(() => Math.max(...chartData.map(d => d.revenue), 1), [chartData])

  // ─── Objectives ─────────────────────────────────────────────
  const currentMonthRevenue = useMemo(() => {
    const m = now.getMonth()
    const y = now.getFullYear()
    return completed
      .filter(o => {
        const od = new Date(o.created_at)
        return od.getMonth() === m && od.getFullYear() === y
      })
      .reduce((s, o) => s + (o.sale_price ?? o.price), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed])

  const prevMonthRevenue = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const m = d.getMonth()
    const y = d.getFullYear()
    return completed
      .filter(o => {
        const od = new Date(o.created_at)
        return od.getMonth() === m && od.getFullYear() === y
      })
      .reduce((s, o) => s + (o.sale_price ?? o.price), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed])

  const quarterlyTarget = monthlyTarget * 3
  const quarterlyRevenue = useMemo(() => {
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    return completed
      .filter(o => new Date(o.created_at) >= qStart)
      .reduce((s, o) => s + (o.sale_price ?? o.price), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed])

  const monthlyPct = monthlyTarget > 0 ? Math.min(100, Math.round((currentMonthRevenue / monthlyTarget) * 100)) : 0
  const quarterlyPct = quarterlyTarget > 0 ? Math.min(100, Math.round((quarterlyRevenue / quarterlyTarget) * 100)) : 0

  const deltaPrev = prevMonthRevenue > 0
    ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
    : currentMonthRevenue > 0 ? 100 : 0

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">
          Analytics
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Performance detaillee de votre franchise
        </p>
      </motion.div>

      {/* ── KPI Cards 3x2 ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {KPI_DATA.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 + i * 0.06 }}
              className="rounded-2xl border border-[#E2E8F2] bg-white p-5 shadow-[0_1px_3px_rgba(45,45,96,0.07)] hover:shadow-[0_2px_8px_rgba(45,45,96,0.1)] transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-xl"
                  style={{ background: `${kpi.iconColor}15` }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: kpi.iconColor }} strokeWidth={1.75} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
                  {kpi.label}
                </span>
              </div>
              <p className="text-2xl font-bold text-[#2d2d60] tracking-tight">{loading ? '\u2026' : kpi.value}</p>
            </motion.div>
          )
        })}
      </div>

      {/* ── 12-month Revenue Chart ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="rounded-2xl border border-[#E2E8F2] bg-white p-6 shadow-[0_1px_3px_rgba(45,45,96,0.07)]"
      >
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-4 h-4 text-[#9CA3AF]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
            Chiffre d&apos;affaires &mdash; 12 derniers mois
          </h2>
        </div>
        <div className="flex items-end gap-2 h-44">
          {chartData.map((bar, i) => {
            const isLast = i === chartData.length - 1
            const pct = maxChart > 0 ? (bar.revenue / maxChart) * 100 : 0
            return (
              <div key={bar.key} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold text-[#2d2d60] tabular-nums">
                  {bar.revenue > 0 ? fmt(bar.revenue) : ''}
                </span>
                <div className="w-full flex items-end justify-center" style={{ height: '130px' }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, 3)}%` }}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.04 }}
                    className={cn(
                      'w-full rounded-t-md',
                      isLast
                        ? 'bg-gradient-to-t from-[#2d2d60] to-[#4a81a4]'
                        : 'bg-[#E8EDF4] hover:bg-[#D1DCE8] transition-colors',
                    )}
                  />
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    isLast ? 'text-[#4a81a4] font-bold' : 'text-[#9CA3AF]',
                  )}
                >
                  {bar.label}
                </span>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* ── Objectives ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="rounded-2xl border border-[#E2E8F2] bg-white p-6 shadow-[0_1px_3px_rgba(45,45,96,0.07)]"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-5">
          Objectifs mensuels &amp; trimestriels
        </h2>

        {/* Monthly target input */}
        <div className="flex items-center gap-3 mb-6">
          <label className="text-sm text-[#6B7280] font-medium">Objectif mensuel :</label>
          <div className="flex items-center gap-1 rounded-lg border border-[#E2E8F2] bg-[#F5F7FA] px-3 py-1.5">
            <span className="text-sm text-[#9CA3AF]">&euro;</span>
            <input
              type="number"
              value={monthlyTarget}
              onChange={e => setMonthlyTarget(Number(e.target.value) || 0)}
              className="w-24 bg-transparent text-sm font-semibold text-[#2d2d60] outline-none"
            />
          </div>
        </div>

        {/* Delta vs previous month */}
        <div className="flex items-center gap-2 mb-5">
          {deltaPrev >= 0 ? (
            <ArrowUp className="w-4 h-4 text-[#22C55E]" />
          ) : (
            <ArrowDown className="w-4 h-4 text-[#EF4444]" />
          )}
          <span
            className={cn(
              'text-sm font-semibold',
              deltaPrev >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]',
            )}
          >
            {deltaPrev >= 0 ? '+' : ''}{deltaPrev}% vs mois precedent
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Monthly */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#374151]">Ce mois</span>
              <span className="text-sm font-bold text-[#2d2d60]">
                {fmt(currentMonthRevenue)} / {fmt(monthlyTarget)}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#F0F3F8] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${monthlyPct}%` }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="h-full rounded-full bg-gradient-to-r from-[#2d2d60] to-[#4a81a4]"
              />
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-1">{monthlyPct}% atteint</p>
          </div>

          {/* Quarterly */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#374151]">Ce trimestre</span>
              <span className="text-sm font-bold text-[#2d2d60]">
                {fmt(quarterlyRevenue)} / {fmt(quarterlyTarget)}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#F0F3F8] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${quarterlyPct}%` }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]"
              />
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-1">{quarterlyPct}% atteint</p>
          </div>
        </div>
      </motion.div>

      {/* ── Leaderboard ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="rounded-2xl border border-[#E2E8F2] bg-white p-6 shadow-[0_1px_3px_rgba(45,45,96,0.07)]"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
            Classement des franchises
          </h2>
          {currentRank > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2d2d60] text-white text-[11px] font-semibold">
              Vous etes #{currentRank} sur {leaderboardTotal} franchises
            </span>
          )}
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-6">Aucune donnee de classement disponible</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const isCurrent = entry.rank === currentRank
              return (
                <motion.div
                  key={entry.franchise_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + i * 0.04 }}
                  className={cn(
                    'flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors',
                    isCurrent
                      ? 'bg-[#2d2d60]/5 border-[#2d2d60]/20'
                      : 'border-[#E2E8F2] hover:bg-[#F5F7FA]',
                  )}
                >
                  <span
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                      i === 0 ? 'bg-[#F59E0B] text-white'
                        : i === 1 ? 'bg-[#9CA3AF] text-white'
                        : i === 2 ? 'bg-[#CD7F32] text-white'
                        : 'bg-[#F0F3F8] text-[#6B7280]',
                    )}
                  >
                    {entry.rank}
                  </span>
                  <span
                    className={cn(
                      'flex-1 text-sm font-medium',
                      isCurrent ? 'text-[#2d2d60] font-bold' : 'text-[#374151]',
                    )}
                  >
                    Franchise #{entry.franchise_id}
                  </span>
                  <span className="text-sm font-bold text-[#2d2d60] tabular-nums">
                    {fmt(entry.total_revenue)}
                  </span>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}
