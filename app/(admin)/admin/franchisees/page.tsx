'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserPlus, Search, Shield, ShieldAlert, ShieldCheck,
  Loader2, AlertCircle, X, Eye, EyeOff, Copy, Check,
  Trash2, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Types ──────────────────────────────────────────────────── */
interface Franchisee {
  id: string
  company_name: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  franchise_code: string
  account_status: string
  created_at: string
}

interface CreatedCredentials {
  email: string
  password: string
  franchise_code: string
  first_name: string
  last_name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof ShieldCheck }> = {
  active:    { label: 'Actif',     color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   icon: ShieldCheck },
  pending:   { label: 'En attente', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  icon: Shield },
  suspended: { label: 'Suspendu',   color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   icon: ShieldAlert },
}

export default function AdminFranchiseesPage() {
  const [franchisees, setFranchisees] = useState<Franchisee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  // État pour la modal de suppression (confirmation double)
  const [deleteTarget, setDeleteTarget] = useState<Franchisee | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null)
  const [copied, setCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Form state
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    sector: '',
    franchise_code: '',
    account_status: 'active',
  })

  const loadFranchisees = async () => {
    setLoading(true)
    setError(null)
    try {
      // Use the admin orders API pattern - fetch profiles via a dedicated endpoint
      // For now we fetch via the stats API which returns profile data
      const res = await fetch('/api/admin/franchisees')
      if (!res.ok) {
        // Fallback: try to get profile data from stats
        const statsRes = await fetch('/api/admin/stats')
        const statsData = await statsRes.json()
        if (!statsRes.ok) throw new Error(statsData.error ?? 'Erreur')
        // Stats doesn't return full franchisee list, so we use an empty array
        setFranchisees([])
        return
      }
      const data = await res.json()
      setFranchisees(data.franchisees ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFranchisees() }, [])

  const handleToggle = async (id: string, currentStatus: string) => {
    setTogglingId(id)
    const action = currentStatus === 'suspended' ? 'activate' : 'suspend'
    try {
      const res = await fetch('/api/admin/toggle-franchisee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ franchiseeId: id, action }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur')
      }
      setFranchisees(prev => prev.map(f =>
        f.id === id ? { ...f, account_status: action === 'activate' ? 'active' : 'suspended' } : f,
      ))
    } catch {
      loadFranchisees()
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const expected = (deleteTarget.email || '').trim().toLowerCase()
    const typed = deleteConfirmText.trim().toLowerCase()
    if (expected && typed !== expected) {
      setDeleteError(`Veuillez retaper exactement l'email : ${expected}`)
      return
    }
    setDeletingId(deleteTarget.id)
    setDeleteError(null)
    try {
      const res = await fetch('/api/admin/delete-franchisee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ franchiseeId: deleteTarget.id, confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data.error ?? 'Erreur de suppression')
        setDeletingId(null)
        return
      }
      // Retire la ligne du tableau sans recharger tout
      setFranchisees(prev => prev.filter(f => f.id !== deleteTarget.id))
      setDeleteTarget(null)
      setDeleteConfirmText('')
      setDeletingId(null)
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur réseau')
      setDeletingId(null)
    }
  }

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name || !form.email) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/create-franchisee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')

      // Le password est dans la réponse SI auto-généré côté backend,
      // sinon on utilise celui tapé par l'admin dans le formulaire
      const resolvedPassword =
        data.franchisee.generated_password ?? form.password ?? '[Mot de passe défini par vous]'

      setCredentials({
        email: data.franchisee.email,
        password: resolvedPassword,
        franchise_code: data.franchisee.franchise_code,
        first_name: data.franchisee.first_name,
        last_name: data.franchisee.last_name,
      })

      // Reload list
      loadFranchisees()

      // Reset form
      setForm({ first_name: '', last_name: '', email: '', password: '', phone: '', address: '', sector: '', franchise_code: '', account_status: 'active' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de creation')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = () => {
    if (!credentials) return
    const text = `Email: ${credentials.email}\nMot de passe: ${credentials.password}\nCode franchise: ${credentials.franchise_code}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return franchisees
    const q = search.toLowerCase()
    return franchisees.filter(f =>
      (f.company_name ?? '').toLowerCase().includes(q) ||
      (f.first_name ?? '').toLowerCase().includes(q) ||
      (f.last_name ?? '').toLowerCase().includes(q) ||
      (f.email ?? '').toLowerCase().includes(q) ||
      (f.franchise_code ?? '').toLowerCase().includes(q),
    )
  }, [franchisees, search])

  const counts = useMemo(() => ({
    active: franchisees.filter(f => f.account_status === 'active').length,
    pending: franchisees.filter(f => f.account_status === 'pending').length,
    suspended: franchisees.filter(f => f.account_status === 'suspended').length,
  }), [franchisees])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#9CA3AF]" />
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
            Gestion des franchises
          </h1>
          <button
            onClick={() => { setShowModal(true); setCredentials(null) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2d2d60] text-white text-sm font-medium hover:bg-[#3d3d70] transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Nouveau franchise
          </button>
        </div>
      </motion.div>

      {/* Stats cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          { label: 'Actifs', count: counts.active, color: '#22C55E', bg: 'rgba(34,197,94,0.08)', icon: ShieldCheck },
          { label: 'En attente', count: counts.pending, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: Shield },
          { label: 'Suspendus', count: counts.suspended, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: ShieldAlert },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.03 }}
            className="bg-white rounded-2xl border border-[#E2E8F2] p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{stat.label}</p>
                <p className="text-2xl font-bold text-[#2d2d60] mt-1">{stat.count}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: stat.bg }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Rechercher un franchise..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E2E8F2] bg-white text-sm text-[#2d2d60] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
          />
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0" />
          <p className="text-sm text-[#EF4444]">{error}</p>
        </motion.div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl border border-[#E2E8F2] shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F2] bg-[#F5F7FA]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Nom</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Email</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Telephone</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Code franchise</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.tr key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <td colSpan={6} className="px-4 py-12 text-center text-[#9CA3AF]">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      Aucun franchise trouve.
                    </td>
                  </motion.tr>
                ) : (
                  filtered.map((f, i) => {
                    const st = STATUS_CONFIG[f.account_status] ?? STATUS_CONFIG.pending
                    const StatusIcon = st.icon
                    return (
                      <motion.tr
                        key={f.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ delay: i * 0.015 }}
                        className="border-b border-[#F0F2F5] hover:bg-[#F9FAFB] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold text-[#2d2d60]">
                            {f.first_name} {f.last_name}
                          </div>
                          <div className="text-[10px] text-[#9CA3AF]">{f.company_name}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#374151]">{f.email}</td>
                        <td className="px-4 py-3 text-xs text-[#374151]">{f.phone ?? '---'}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[11px] text-[#6B7280]">{f.franchise_code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ color: st.color, background: st.bg }}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggle(f.id, f.account_status)}
                              disabled={togglingId === f.id || deletingId === f.id}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                                f.account_status === 'suspended'
                                  ? 'bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20'
                                  : 'bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20',
                                (togglingId === f.id || deletingId === f.id) && 'opacity-50 cursor-wait',
                              )}
                            >
                              {togglingId === f.id ? (
                                <Loader2 className="w-3 h-3 animate-spin inline" />
                              ) : f.account_status === 'suspended' ? 'Reactiver' : 'Suspendre'}
                            </button>
                            <button
                              onClick={() => { setDeleteTarget(f); setDeleteError(null); setDeleteConfirmText('') }}
                              disabled={togglingId === f.id || deletingId === f.id}
                              title="Supprimer définitivement"
                              className={cn(
                                'p-1.5 rounded-lg transition-all',
                                'bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20',
                                (togglingId === f.id || deletingId === f.id) && 'opacity-50 cursor-wait',
                              )}
                            >
                              {deletingId === f.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
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

      {/* Modal — Create franchisee / Show credentials */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => { setShowModal(false); setCredentials(null) }}
            />

            {/* Modal content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl border border-[#E2E8F2] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F2]">
                <h2 className="text-lg font-semibold text-[#2d2d60]">
                  {credentials ? 'Franchise cree avec succes' : 'Nouveau franchise'}
                </h2>
                <button
                  onClick={() => { setShowModal(false); setCredentials(null) }}
                  className="p-1 rounded-lg hover:bg-[#F5F7FA] transition-colors"
                >
                  <X className="w-5 h-5 text-[#9CA3AF]" />
                </button>
              </div>

              <div className="px-6 py-5">
                {credentials ? (
                  /* ─── Success: show credentials ─── */
                  <div className="space-y-4">
                    <div className="bg-[#22C55E]/5 border border-[#22C55E]/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
                        <p className="text-sm font-semibold text-[#22C55E]">
                          Compte cree pour {credentials.first_name} {credentials.last_name}
                        </p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[#E2E8F2]">
                          <span className="text-[#6B7280]">Email</span>
                          <span className="font-mono text-[#2d2d60] font-medium">{credentials.email}</span>
                        </div>
                        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[#E2E8F2]">
                          <span className="text-[#6B7280]">Mot de passe</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[#2d2d60] font-medium">
                              {showPassword ? credentials.password : '************'}
                            </span>
                            <button onClick={() => setShowPassword(!showPassword)} className="p-0.5">
                              {showPassword ? <EyeOff className="w-3.5 h-3.5 text-[#9CA3AF]" /> : <Eye className="w-3.5 h-3.5 text-[#9CA3AF]" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-[#E2E8F2]">
                          <span className="text-[#6B7280]">Code franchise</span>
                          <span className="font-mono text-[#2d2d60] font-medium">{credentials.franchise_code}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCopy}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2d2d60] text-white text-sm font-medium hover:bg-[#3d3d70] transition-all"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copie !' : 'Copier les identifiants'}
                    </button>
                  </div>
                ) : (
                  /* ─── Form: create franchisee ─── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Prenom *</label>
                        <input
                          type="text"
                          value={form.first_name}
                          onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
                          placeholder="Jean"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Nom *</label>
                        <input
                          type="text"
                          value={form.last_name}
                          onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
                          placeholder="Dupont"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Email *</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
                          placeholder="jean@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Mot de passe</label>
                        <input
                          type="text"
                          value={form.password}
                          onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
                          placeholder="Auto-généré si vide"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Telephone</label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
                          placeholder="+32 4XX XX XX XX"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Secteur</label>
                        <input
                          type="text"
                          value={form.sector}
                          onChange={e => setForm(p => ({ ...p, sector: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
                          placeholder="Marketing digital"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Adresse</label>
                      <input
                        type="text"
                        value={form.address}
                        onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
                        placeholder="Rue de la Loi 42, 1000 Bruxelles"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Code franchise</label>
                        <input
                          type="text"
                          value={form.franchise_code}
                          onChange={e => setForm(p => ({ ...p, franchise_code: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
                          placeholder="Auto-genere si vide"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Statut initial</label>
                        <select
                          value={form.account_status}
                          onChange={e => setForm(p => ({ ...p, account_status: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border border-[#E2E8F2] text-sm text-[#2d2d60] focus:outline-none focus:ring-2 focus:ring-[#2d2d60]/20 focus:border-[#2d2d60] transition-all"
                        >
                          <option value="active">Actif</option>
                          <option value="pending">En attente</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => { setShowModal(false); setCredentials(null) }}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-[#E2E8F2] text-sm font-medium text-[#6B7280] hover:bg-[#F5F7FA] transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={creating || !form.first_name || !form.last_name || !form.email}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2d2d60] text-white text-sm font-medium transition-all shadow-sm',
                          creating || !form.first_name || !form.last_name || !form.email
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-[#3d3d70]',
                        )}
                      >
                        {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                        Creer le compte
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ MODAL : Confirmation suppression franchisé ═══════ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { if (!deletingId) { setDeleteTarget(null); setDeleteConfirmText(''); setDeleteError(null) } }}
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
                    <h3 className="text-[17px] font-bold">Supprimer ce franchisé ?</h3>
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
                    <li>Le compte utilisateur et son profil</li>
                    <li>Toutes ses commandes + items</li>
                    <li>Ses clients CRM + notes + pipeline</li>
                    <li>Ses leads et campagnes pub</li>
                    <li>Ses abonnements Stripe actifs</li>
                    <li>Ses tickets support + notifications</li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[13px] text-[#374151]">
                    Franchisé à supprimer :
                  </p>
                  <div className="bg-[#F5F7FA] border border-[#E2E8F2] rounded-lg px-3 py-2.5">
                    <p className="text-[14px] font-bold text-[#2d2d60]">
                      {deleteTarget.company_name || `${deleteTarget.first_name} ${deleteTarget.last_name}`}
                    </p>
                    <p className="text-[12px] text-[#6B7280] font-mono">{deleteTarget.email}</p>
                    <p className="text-[11px] text-[#9CA3AF] font-mono mt-0.5">{deleteTarget.franchise_code}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Pour confirmer, retapez l&apos;email exact
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => { setDeleteConfirmText(e.target.value); setDeleteError(null) }}
                    placeholder={deleteTarget.email}
                    disabled={!!deletingId}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F2] bg-white text-[14px] text-[#2d2d60] font-mono outline-none focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15 disabled:opacity-50"
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
                  onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); setDeleteError(null) }}
                  disabled={!!deletingId}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#2d2d60] hover:bg-[#E2E8F2] transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={
                    !!deletingId ||
                    deleteConfirmText.trim().toLowerCase() !==
                      (deleteTarget.email || '').trim().toLowerCase()
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
