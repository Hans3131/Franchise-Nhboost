'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Filter, ChevronDown, Package, Clock, CheckCircle2,
  Loader2, AlertCircle, RefreshCw, Trash2, AlertTriangle, X,
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
  // État pour la modal de suppression (confirmation double)
  const [deleteTarget, setDeleteTarget] = useState<AdminOrder | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null)

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

  const handleDelete = async () => {
    if (!deleteTarget) return
    const expected = (deleteTarget.ref || '').trim().toUpperCase()
    const typed = deleteConfirmText.trim().toUpperCase()
    if (expected && typed !== expected) {
      setDeleteError(`Veuillez retaper exactement la référence : ${expected}`)
      return
    }
    setDeletingId(deleteTarget.id)
    setDeleteError(null)
    try {
      const res = await fetch('/api/admin/delete-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: deleteTarget.id, confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data.error ?? 'Erreur de suppression')
        setDeletingId(null)
        return
      }
      // Warning si la commande était payée (à rembourser manuellement)
      if (data.warning) {
        setDeleteWarning(data.warning)
        setTimeout(() => setDeleteWarning(null), 10_000)
      }
      // Retire la commande du tableau sans recharger tout
      setOrders(prev => prev.filter(o => o.id !== deleteTarget.id))
      setDeleteTarget(null)
      setDeleteConfirmText('')
      setDeletingId(null)
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur réseau')
      setDeletingId(null)
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

  // Group by franchise
  const groupedByFranchise = useMemo(() => {
    const map: Record<string, { name: string; code: string; orders: typeof filtered }> = {}
    filtered.forEach(o => {
      const key = o.franchise_name || 'Inconnu'
      if (!map[key]) map[key] = { name: key, code: o.franchise_code || '', orders: [] }
      map[key].orders.push(o)
    })
    return Object.values(map).sort((a, b) => b.orders.length - a.orders.length)
  }, [filtered])

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

      {/* Grouped by franchise */}
      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl border border-[#E2E8F2] shadow-sm p-12 text-center">
          <Package className="w-8 h-8 mx-auto mb-2 text-[#9CA3AF] opacity-40" />
          <p className="text-[#9CA3AF]">Aucune commande trouvee.</p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {groupedByFranchise.map((group, gIdx) => (
            <motion.div
              key={group.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + gIdx * 0.05 }}
              className="bg-white rounded-2xl border border-[#E2E8F2] shadow-sm overflow-hidden"
            >
              {/* Franchise header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F3F8] bg-[#F8FAFC]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#2d2d60]/10 flex items-center justify-center">
                    <Package className="w-4 h-4 text-[#2d2d60]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#2d2d60]">{group.name}</p>
                    {group.code && <p className="text-[10px] font-mono text-[#9CA3AF]">{group.code}</p>}
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#2d2d60]/10 text-[#2d2d60]">
                  {group.orders.length} commande{group.orders.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F2]">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Ref</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Service</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Client</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Statut</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Avancement</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Date</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.orders.map((order, i) => {
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

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setDeleteTarget(order)
                              setDeleteError(null)
                              setDeleteConfirmText('')
                            }}
                            disabled={deletingId === order.id || updatingId === order.id}
                            title="Supprimer cette commande"
                            className={cn(
                              'inline-flex items-center justify-center p-1.5 rounded-lg transition-all',
                              'bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20',
                              (deletingId === order.id || updatingId === order.id) && 'opacity-50 cursor-wait',
                            )}
                          >
                            {deletingId === order.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        </td>
                      </motion.tr>
                    )
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ═══════ Toast warning post-suppression ═══════ */}
      <AnimatePresence>
        {deleteWarning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-40 max-w-md"
          >
            <div className="bg-[#FEF3C7] border-l-4 border-[#F59E0B] rounded-xl p-4 shadow-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#92400E] mb-1">
                  Commande payée supprimée
                </p>
                <p className="text-[12px] text-[#92400E] leading-relaxed">
                  {deleteWarning}
                </p>
              </div>
              <button
                onClick={() => setDeleteWarning(null)}
                className="p-1 rounded text-[#92400E] hover:bg-[#FDE68A] transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ MODAL : Confirmation suppression commande ═══════ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!deletingId) {
                setDeleteTarget(null)
                setDeleteConfirmText('')
                setDeleteError(null)
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              {/* Header rouge */}
              <div className="bg-gradient-to-r from-[#EF4444] to-[#DC2626] p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-bold">Supprimer cette commande ?</h3>
                    <p className="text-[12px] text-white/80 mt-0.5">Action irréversible</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="bg-[#FEF3C7] border-l-4 border-[#F59E0B] rounded-r-lg px-4 py-3">
                  <p className="text-[13px] text-[#92400E] leading-relaxed">
                    <strong>Cette action est définitive.</strong> Seront supprimés :
                  </p>
                  <ul className="text-[12px] text-[#92400E] mt-2 space-y-0.5 list-disc list-inside">
                    <li>La commande et son référentiel financier</li>
                    <li>Toutes les lignes de service (order_items)</li>
                    <li>La conversation admin ↔ franchisé liée</li>
                    <li>Les notifications associées</li>
                  </ul>
                  <p className="text-[12px] text-[#92400E] mt-2 font-semibold">
                    ⚠ Le paiement Stripe (si existant) ne sera <u>pas</u> remboursé
                    automatiquement. À faire manuellement dans Stripe Dashboard.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[13px] text-[#374151]">
                    Commande à supprimer :
                  </p>
                  <div className="bg-[#F5F7FA] border border-[#E2E8F2] rounded-lg px-3 py-2.5 space-y-0.5">
                    <p className="text-[14px] font-bold text-[#2d2d60] font-mono">
                      {deleteTarget.ref}
                    </p>
                    <p className="text-[12px] text-[#6B7280] truncate">
                      {deleteTarget.service}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      Client : {deleteTarget.client_name} · Franchisé : {deleteTarget.franchise_name}
                    </p>
                    <p className="text-[11px] text-[#2d2d60] font-semibold">
                      Montant : €{(deleteTarget.price ?? 0).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Pour confirmer, retapez la référence
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => {
                      setDeleteConfirmText(e.target.value)
                      setDeleteError(null)
                    }}
                    placeholder={deleteTarget.ref}
                    disabled={!!deletingId}
                    autoComplete="off"
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F2] bg-white text-[14px] text-[#2d2d60] font-mono outline-none focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15 disabled:opacity-50 uppercase"
                  />
                </div>

                {deleteError && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/25">
                    <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#B91C1C] leading-relaxed">{deleteError}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F2]">
                <button
                  onClick={() => {
                    setDeleteTarget(null)
                    setDeleteConfirmText('')
                    setDeleteError(null)
                  }}
                  disabled={!!deletingId}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#2d2d60] hover:bg-[#E2E8F2] transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={
                    !!deletingId ||
                    deleteConfirmText.trim().toUpperCase() !==
                      (deleteTarget.ref || '').trim().toUpperCase()
                  }
                  className={cn(
                    'flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all',
                    'bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:brightness-110',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  {deletingId ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Suppression…</>
                  ) : (
                    <><Trash2 className="w-3.5 h-3.5" /> Supprimer définitivement</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
