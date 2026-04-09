'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Filter, ChevronDown, Package, Clock, CheckCircle2,
  Loader2, AlertCircle, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Progress status labels ────────────────────────────────── */
const PROGRESS_OPTIONS = [
  { value: 'pending',       label: 'En attente' },
  { value: 'in_progress',   label: 'En cours' },
  { value: 'completed',     label: 'Termine' },
  { value: 'preparation',   label: 'Site en preparation' },
  { value: 'v1_ready',      label: '1ere version prete' },
  { value: 'v2_ready',      label: '2eme version prete' },
  { value: 'domain_config', label: 'Config. domaine' },
  { value: 'site_done',     label: 'Site finalise' },
  { value: 'strategy',      label: 'Preparation strategie' },
  { value: 'shooting',      label: 'Tournage en preparation' },
  { value: 'launching',     label: 'Lancement campagnes' },
  { value: 'live',          label: 'Campagne lancee' },
] as const

const PROGRESS_MAP = Object.fromEntries(PROGRESS_OPTIONS.map(o => [o.value, o.label]))

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'En attente',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  in_progress: { label: 'En cours',    color: '#6AAEE5', bg: 'rgba(106,174,229,0.1)' },
  completed:   { label: 'Termine',     color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  cancelled:   { label: 'Annule',      color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
}

type FilterTab = 'all' | 'pending' | 'in_progress' | 'completed'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',         label: 'Toutes' },
  { key: 'pending',     label: 'En attente' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'completed',   label: 'Terminees' },
]

interface AdminOrder {
  id: string
  ref: string
  service: string
  client_name: string
  client_email: string
  status: string
  internal_progress_status: string | null
  franchise_name: string
  franchise_code: string
  price: number
  created_at: string
}

export default function AdminCommandesPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/orders')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      setOrders(data.orders ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrders() }, [])

  const handleProgressChange = async (orderId: string, newProgress: string) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch('/api/admin/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, internalProgressStatus: newProgress }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur')
      }
      // Optimistic update
      setOrders(prev => prev.map(o => {
        if (o.id !== orderId) return o
        const autoStatus =
          ['preparation', 'v1_ready', 'v2_ready', 'domain_config', 'strategy', 'shooting', 'launching'].includes(newProgress)
            ? 'in_progress'
            : ['site_done', 'live', 'completed'].includes(newProgress)
              ? 'completed'
              : o.status
        return { ...o, internal_progress_status: newProgress, status: autoStatus }
      }))
    } catch {
      // Reload on error
      loadOrders()
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = useMemo(() => {
    let list = orders
    if (filter !== 'all') {
      list = list.filter(o => o.status === filter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        (o.ref ?? '').toLowerCase().includes(q) ||
        (o.service ?? '').toLowerCase().includes(q) ||
        (o.client_name ?? '').toLowerCase().includes(q) ||
        (o.franchise_name ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [orders, filter, search])

  const counts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
  }), [orders])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#9CA3AF]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-12 h-12 text-[#EF4444] mb-4" />
        <h2 className="text-xl font-bold text-[#2d2d60] mb-2">Erreur</h2>
        <p className="text-[#6B7280] mb-4">{error}</p>
        <button onClick={loadOrders} className="px-4 py-2 rounded-xl bg-[#2d2d60] text-white text-sm font-medium hover:bg-[#3d3d70] transition-colors">
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">Administration</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">
            Gestion des commandes
          </h1>
          <button
            onClick={loadOrders}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[#6B7280] hover:text-[#2d2d60] hover:bg-[#E2E8F2] transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
        <p className="text-sm text-[#6B7280] mt-1">
          {orders.length} commande{orders.length !== 1 ? 's' : ''} au total sur le reseau.
        </p>
      </motion.div>

      {/* Filter tabs + search */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-[#E2E8F2] shadow-sm">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filter === tab.key
                  ? 'bg-[#2d2d60] text-white shadow-sm'
                  : 'text-[#6B7280] hover:text-[#2d2d60] hover:bg-[#F5F7FA]',
              )}
            >
              {tab.label}
              <span className="ml-1.5 text-[10px] opacity-70">{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Rechercher ref, service, client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E2E8F2] bg-white text-sm text-[#2d2d60] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
          />
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-[#E2E8F2] shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F2] bg-[#F5F7FA]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Ref</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Service</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Client</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Franchise</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Avancement</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Date</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.tr
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={7} className="px-4 py-12 text-center text-[#9CA3AF]">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      Aucune commande trouvee.
                    </td>
                  </motion.tr>
                ) : (
                  filtered.map((order, i) => {
                    const st = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
                    const progress = order.internal_progress_status ?? order.status
                    return (
                      <motion.tr
                        key={order.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ delay: i * 0.015 }}
                        className="border-b border-[#F0F2F5] hover:bg-[#F9FAFB] transition-colors"
                      >
                        {/* Ref */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-[#2d2d60]">
                            {order.ref ?? '---'}
                          </span>
                        </td>

                        {/* Service */}
                        <td className="px-4 py-3">
                          <span className="text-[#374151] font-medium text-xs">{order.service}</span>
                        </td>

                        {/* Client */}
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium text-[#374151]">{order.client_name ?? '---'}</div>
                          <div className="text-[10px] text-[#9CA3AF]">{order.client_email ?? ''}</div>
                        </td>

                        {/* Franchise */}
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium text-[#374151]">{order.franchise_name}</div>
                          <div className="text-[10px] text-[#9CA3AF]">{order.franchise_code}</div>
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ color: st.color, background: st.bg }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                            {st.label}
                          </span>
                        </td>

                        {/* Progress dropdown */}
                        <td className="px-4 py-3">
                          <div className="relative">
                            <select
                              value={progress}
                              onChange={e => handleProgressChange(order.id, e.target.value)}
                              disabled={updatingId === order.id}
                              className={cn(
                                'appearance-none w-full pl-2.5 pr-7 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-all',
                                'bg-white border-[#E2E8F2] text-[#374151]',
                                'hover:border-[#2d2d60] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60]',
                                updatingId === order.id && 'opacity-50 cursor-wait',
                              )}
                            >
                              {PROGRESS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9CA3AF] pointer-events-none" />
                            {updatingId === order.id && (
                              <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-[#2d2d60]" />
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-[11px] text-[#9CA3AF]">
                          {new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                      </motion.tr>
                    )
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
