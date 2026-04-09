'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Plus, X, Euro,
  TrendingUp, Users, Target, Trophy, AlertCircle,
  Building2, Mail, Phone, Calendar, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { getAll, insert } from '@/lib/clientStore'
import { moveStage } from '@/lib/pipelineStore'
import { cn } from '@/lib/utils'
import type { Client, PipelineStage } from '@/types'

// ─── Pipeline config ─────────────────────────────────────────
const STAGES: { key: PipelineStage; label: string; color: string; bg: string }[] = [
  { key: 'lead_received', label: 'Lead reçu',        color: '#6AAEE5', bg: 'rgba(106,174,229,0.08)' },
  { key: 'contacted',     label: 'Contact établi',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
  { key: 'quote_sent',    label: 'Devis envoyé',     color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  { key: 'negotiation',   label: 'Négociation',      color: '#EC4899', bg: 'rgba(236,72,153,0.08)' },
  { key: 'won',           label: 'Gagné',            color: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
  { key: 'lost',          label: 'Perdu',            color: '#EF4444', bg: 'rgba(239,68,68,0.06)' },
]

const STAGE_ORDER = STAGES.map(s => s.key)

const fmt = (n: number) => '€' + n.toLocaleString('fr-FR')

// ─── Component ────────────────────────────────────────────────
export default function PipelinePage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newClient, setNewClient] = useState({ company_name: '', contact_name: '', email: '', phone: '', deal_value: '' })
  const [saving, setSaving] = useState(false)

  const loadClients = useCallback(async () => {
    const all = await getAll()
    setClients(all)
    setLoading(false)
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  // ─── Grouped by stage ──────────────────────────────────────
  const grouped = useMemo(() => {
    const map: Record<PipelineStage, Client[]> = {
      lead_received: [], contacted: [], quote_sent: [], negotiation: [], won: [], lost: [],
    }
    clients.forEach(c => {
      const stage = c.pipeline_stage ?? 'lead_received'
      if (map[stage]) map[stage].push(c)
    })
    return map
  }, [clients])

  // ─── Stats ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = clients.filter(c => c.pipeline_stage !== 'lost' && c.pipeline_stage !== 'won')
    const won = clients.filter(c => c.pipeline_stage === 'won')
    const total = clients.length
    const pipelineValue = active.reduce((s, c) => s + (c.deal_value ?? 0), 0)
    const wonValue = won.reduce((s, c) => s + (c.deal_value ?? 0), 0)
    const conversionRate = total > 0 ? Math.round((won.length / total) * 100) : 0
    return { pipelineValue, wonValue, activeDeals: active.length, conversionRate }
  }, [clients])

  // ─── Move stage ────────────────────────────────────────────
  const handleMove = useCallback(async (client: Client, direction: 1 | -1) => {
    const currentIdx = STAGE_ORDER.indexOf(client.pipeline_stage ?? 'lead_received')
    const newIdx = currentIdx + direction
    if (newIdx < 0 || newIdx >= STAGE_ORDER.length) return
    const newStage = STAGE_ORDER[newIdx]

    // Optimistic update
    setClients(prev => prev.map(c =>
      c.id === client.id ? { ...c, pipeline_stage: newStage } : c
    ))

    await moveStage(client.id, client.pipeline_stage, newStage)
  }, [])

  // ─── Create prospect ──────────────────────────────────────
  const handleCreate = async () => {
    if (!newClient.company_name.trim()) return
    setSaving(true)
    await insert({
      company_name: newClient.company_name,
      contact_name: newClient.contact_name || undefined,
      email: newClient.email || undefined,
      phone: newClient.phone || undefined,
      commercial_status: 'prospect',
      upsell_potential: 'medium',
      pipeline_stage: 'lead_received',
      deal_value: Number(newClient.deal_value) || 0,
    })
    setNewClient({ company_name: '', contact_name: '', email: '', phone: '', deal_value: '' })
    setShowModal(false)
    setSaving(false)
    loadClients()
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">Commercial</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Pipeline</h1>
          <p className="text-sm text-[#6B7280] mt-1">Suivez vos prospects dans le tunnel de vente.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)' }}
        >
          <Plus className="w-4 h-4" /> Nouveau prospect
        </button>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          { label: 'Pipeline total', value: fmt(stats.pipelineValue), icon: Euro, color: '#6AAEE5' },
          { label: 'Deals en cours', value: String(stats.activeDeals), icon: Target, color: '#8B5CF6' },
          { label: 'Gagné', value: fmt(stats.wonValue), icon: Trophy, color: '#22C55E' },
          { label: 'Conversion', value: `${stats.conversionRate}%`, icon: TrendingUp, color: '#F59E0B' },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} className="rounded-xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.07)] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.color}14` }}>
                <Icon className="w-4 h-4" style={{ color: kpi.color }} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[16px] font-bold text-[#2d2d60] leading-none">{kpi.value}</p>
                <p className="text-[10px] text-[#9CA3AF] font-medium mt-0.5 uppercase tracking-wider">{kpi.label}</p>
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* Kanban board */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
      >
        {STAGES.map((stage, sIdx) => {
          const stageClients = grouped[stage.key] ?? []
          const stageValue = stageClients.reduce((s, c) => s + (c.deal_value ?? 0), 0)
          const isLost = stage.key === 'lost'

          return (
            <div
              key={stage.key}
              className={cn(
                'flex-shrink-0 w-[260px] sm:w-[280px] flex flex-col rounded-2xl border bg-white shadow-[0_1px_3px_rgba(45,45,96,0.06)]',
                isLost ? 'border-[#E2E8F2] opacity-70' : 'border-[#E2E8F2]'
              )}
              style={{ minHeight: 400 }}
            >
              {/* Column header */}
              <div className="px-4 py-3 border-b border-[#F0F3F8]" style={{ background: stage.bg }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
                    <span className="text-[13px] font-bold text-[#2d2d60]">{stage.label}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/80 text-[#6B7280]">
                    {stageClients.length}
                  </span>
                </div>
                {stageValue > 0 && (
                  <p className="text-[11px] font-semibold" style={{ color: stage.color }}>{fmt(stageValue)}</p>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 500 }}>
                <AnimatePresence>
                  {stageClients.map(client => {
                    const currentIdx = STAGE_ORDER.indexOf(client.pipeline_stage ?? 'lead_received')
                    const canGoBack = currentIdx > 0
                    const canGoForward = currentIdx < STAGE_ORDER.length - 1

                    return (
                      <motion.div
                        key={client.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="rounded-xl border border-[#E2E8F2] bg-white hover:shadow-md transition-shadow p-3 group"
                      >
                        {/* Client info */}
                        <Link href={`/crm/${client.id}`} className="block">
                          <p className="text-[13px] font-bold text-[#2d2d60] truncate group-hover:text-[#6AAEE5] transition-colors">
                            {client.company_name}
                          </p>
                          {client.contact_name && (
                            <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">{client.contact_name}</p>
                          )}
                        </Link>

                        {/* Deal value */}
                        {(client.deal_value ?? 0) > 0 && (
                          <p className="text-[14px] font-bold text-[#2d2d60] font-mono mt-2">{fmt(client.deal_value)}</p>
                        )}

                        {/* Date + email */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {client.email && (
                            <span className="text-[10px] text-[#9CA3AF] truncate max-w-[140px]">{client.email}</span>
                          )}
                          {client.expected_close_date && (
                            <span className="text-[10px] text-[#9CA3AF] flex items-center gap-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              {new Date(client.expected_close_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </div>

                        {/* Move buttons */}
                        <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-[#F0F3F8]">
                          <button
                            onClick={() => handleMove(client, -1)}
                            disabled={!canGoBack}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold border border-[#E2E8F2] text-[#6B7280] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronLeft className="w-3 h-3" /> Reculer
                          </button>
                          <button
                            onClick={() => handleMove(client, 1)}
                            disabled={!canGoForward}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            style={{ background: canGoForward ? stage.color : '#E2E8F2' }}
                          >
                            Avancer <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>

                {stageClients.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-8 h-8 rounded-lg bg-[#F5F7FA] flex items-center justify-center mb-2">
                      <Users className="w-4 h-4 text-[#9CA3AF]" />
                    </div>
                    <p className="text-[11px] text-[#9CA3AF]">Aucun prospect</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* New prospect modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-md bg-white rounded-2xl border border-[#E2E8F2] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F3F8]">
                <h2 className="text-[16px] font-bold text-[#2d2d60]">Nouveau prospect</h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-[#F5F7FA]">
                  <X className="w-4 h-4 text-[#9CA3AF]" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1 block">Entreprise *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input
                      value={newClient.company_name}
                      onChange={e => setNewClient(p => ({ ...p, company_name: e.target.value }))}
                      placeholder="Nom de l'entreprise"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] text-[#2d2d60] placeholder:text-[#9CA3AF] outline-none focus:border-[#6AAEE5]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1 block">Contact</label>
                    <input
                      value={newClient.contact_name}
                      onChange={e => setNewClient(p => ({ ...p, contact_name: e.target.value }))}
                      placeholder="Nom du contact"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] text-[#2d2d60] placeholder:text-[#9CA3AF] outline-none focus:border-[#6AAEE5]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1 block">Valeur deal</label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                      <input
                        type="number"
                        value={newClient.deal_value}
                        onChange={e => setNewClient(p => ({ ...p, deal_value: e.target.value }))}
                        placeholder="0"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] text-[#2d2d60] placeholder:text-[#9CA3AF] outline-none focus:border-[#6AAEE5]"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1 block">Email</label>
                    <input
                      type="email"
                      value={newClient.email}
                      onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))}
                      placeholder="email@exemple.com"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] text-[#2d2d60] placeholder:text-[#9CA3AF] outline-none focus:border-[#6AAEE5]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1 block">Telephone</label>
                    <input
                      type="tel"
                      value={newClient.phone}
                      onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+33 6 00 00 00 00"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] text-[#2d2d60] placeholder:text-[#9CA3AF] outline-none focus:border-[#6AAEE5]"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={saving || !newClient.company_name.trim()}
                  className="w-full py-3 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)' }}
                >
                  {saving ? 'Création...' : 'Ajouter au pipeline'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
