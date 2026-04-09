'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox, UserPlus, Phone, Mail, Building2, MessageSquare,
  ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle,
  ArrowRight, Globe, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getAll, updateStatus, convertToClient } from '@/lib/leadStore'
import { cn } from '@/lib/utils'
import type { Lead, LeadStatus } from '@/types'

// ─── Config ──────────────────────────────────────────────────
const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  new:       { label: 'Nouveau',   color: '#6AAEE5', bg: 'rgba(106,174,229,0.1)', icon: Inbox },
  contacted: { label: 'Contacté',  color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)',  icon: Phone },
  qualified: { label: 'Qualifié',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  icon: CheckCircle2 },
  converted: { label: 'Converti',  color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   icon: UserPlus },
  lost:      { label: 'Perdu',     color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   icon: XCircle },
}

const FILTER_TABS: { key: LeadStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'new', label: 'Nouveaux' },
  { key: 'contacted', label: 'Contactés' },
  { key: 'qualified', label: 'Qualifiés' },
  { key: 'converted', label: 'Convertis' },
  { key: 'lost', label: 'Perdus' },
]

// ─── Component ────────────────────────────────────────────────
export default function MesLeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [converting, setConverting] = useState<string | null>(null)

  const loadLeads = useCallback(async () => {
    const all = await getAll()
    setLeads(all)
    setLoading(false)
  }, [])

  useEffect(() => { loadLeads() }, [loadLeads])

  const counts = useMemo(() => ({
    all: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    qualified: leads.filter(l => l.status === 'qualified').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost: leads.filter(l => l.status === 'lost').length,
  }), [leads])

  const filtered = useMemo(() => {
    let list = leads
    if (filter !== 'all') list = list.filter(l => l.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q) ||
        (l.company ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [leads, filter, search])

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    await updateStatus(id, status)
  }

  const handleConvert = async (leadId: string) => {
    setConverting(leadId)
    const clientId = await convertToClient(leadId)
    setConverting(null)
    if (clientId) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'converted' as LeadStatus, client_id: clientId } : l))
      router.push(`/crm/${clientId}`)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">Acquisition</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Mes leads</h1>
        <p className="text-sm text-[#6B7280] mt-1">Leads reçus depuis vos formulaires et campagnes.</p>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Nouveaux', value: counts.new, color: '#6AAEE5', icon: Inbox },
          { label: 'Contactés', value: counts.contacted, color: '#8B5CF6', icon: Phone },
          { label: 'Qualifiés', value: counts.qualified, color: '#F59E0B', icon: CheckCircle2 },
          { label: 'Convertis', value: counts.converted, color: '#22C55E', icon: UserPlus },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <div key={i} className="rounded-xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.07)] px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.color}14` }}>
                <Icon className="w-4 h-4" style={{ color: kpi.color }} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[18px] font-bold text-[#2d2d60] leading-none">{kpi.value}</p>
                <p className="text-[10px] text-[#9CA3AF] font-medium mt-0.5 uppercase tracking-wider">{kpi.label}</p>
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* Filters + Search */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex-shrink-0',
                filter === tab.key
                  ? 'bg-white border-[#6AAEE5] text-[#2d2d60] shadow-sm'
                  : 'bg-[#F5F7FA] border-[#E2E8F2] text-[#6B7280] hover:text-[#2d2d60]'
              )}>
              {tab.label}
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                filter === tab.key ? 'bg-[#6AAEE5]/10 text-[#6AAEE5]' : 'bg-[#E2E8F2] text-[#9CA3AF]')}>
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Inbox className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un lead..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] text-[#2d2d60] placeholder:text-[#9CA3AF] outline-none focus:border-[#6AAEE5]" />
        </div>
      </motion.div>

      {/* Leads list */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-[#F5F7FA] border border-[#E2E8F2] p-16 text-center">
            <Inbox className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-[#6B7280] font-medium">{loading ? 'Chargement...' : 'Aucun lead'}</p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">Les leads arriveront automatiquement depuis vos formulaires.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.06)] overflow-hidden">
            <AnimatePresence initial={false}>
              {filtered.map((lead, i) => {
                const s = STATUS_CONFIG[lead.status]
                const expanded = expandedId === lead.id
                const StatusIcon = s.icon

                return (
                  <motion.div key={lead.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.02 }} className="border-b border-[#F0F3F8] last:border-0">

                    {/* Compact row */}
                    <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : lead.id)}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                        <StatusIcon className="w-4 h-4" style={{ color: s.color }} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#2d2d60] truncate">{lead.name}</p>
                        <p className="text-[12px] text-[#6B7280] mt-0.5">{lead.phone || lead.email || lead.company || '—'}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                        {lead.source && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#9CA3AF] border border-[#E2E8F2]">
                            {lead.source}
                          </span>
                        )}
                        <span className="text-[11px] text-[#9CA3AF]">
                          {new Date(lead.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium flex-shrink-0"
                        style={{ background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                      <ChevronDown className={cn('w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform duration-300', expanded && 'rotate-180')} />
                    </div>

                    {/* Expanded */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }} className="overflow-hidden">
                          <div className="px-5 pb-5 pt-3 bg-[#F8FAFC] border-t border-[#F0F3F8] space-y-4">

                            {/* Info grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {lead.email && (
                                <div className="bg-white rounded-xl border border-[#E2E8F2] px-3 py-2.5">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Email</p>
                                  <p className="text-[12px] text-[#6B7280] truncate">{lead.email}</p>
                                </div>
                              )}
                              {lead.phone && (
                                <div className="bg-white rounded-xl border border-[#E2E8F2] px-3 py-2.5">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Téléphone</p>
                                  <p className="text-[12px] text-[#6B7280]">{lead.phone}</p>
                                </div>
                              )}
                              {lead.company && (
                                <div className="bg-white rounded-xl border border-[#E2E8F2] px-3 py-2.5">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Entreprise</p>
                                  <p className="text-[12px] text-[#6B7280]">{lead.company}</p>
                                </div>
                              )}
                              <div className="bg-white rounded-xl border border-[#E2E8F2] px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Source</p>
                                <p className="text-[12px] text-[#6B7280]">{lead.source}{lead.source_detail ? ` — ${lead.source_detail}` : ''}</p>
                              </div>
                            </div>

                            {/* Message */}
                            {lead.message && (
                              <div className="bg-white rounded-xl border border-[#E2E8F2] px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1.5">Message</p>
                                <p className="text-[12px] text-[#6B7280] leading-relaxed">{lead.message}</p>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Status change */}
                              <select
                                value={lead.status}
                                onChange={e => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                                className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F2] text-[12px] font-semibold text-[#2d2d60] outline-none cursor-pointer"
                              >
                                <option value="new">Nouveau</option>
                                <option value="contacted">Contacté</option>
                                <option value="qualified">Qualifié</option>
                                <option value="lost">Perdu</option>
                              </select>

                              {/* Convert to client */}
                              {lead.status !== 'converted' && !lead.client_id && (
                                <button
                                  onClick={() => handleConvert(lead.id)}
                                  disabled={converting === lead.id}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                  style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                                >
                                  {converting === lead.id
                                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Conversion...</>
                                    : <><UserPlus className="w-3.5 h-3.5" /> Convertir en client</>
                                  }
                                </button>
                              )}

                              {/* Link to CRM if converted */}
                              {lead.client_id && (
                                <Link href={`/crm/${lead.client_id}`}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:opacity-90"
                                  style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)' }}>
                                  <ArrowRight className="w-3.5 h-3.5" /> Voir fiche client
                                </Link>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* API info */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="rounded-2xl bg-[#F5F7FA] border border-[#E2E8F2] p-5">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-[#6AAEE5] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-[#2d2d60]">Recevoir des leads automatiquement</p>
            <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">
              Ajoutez votre <span className="font-mono text-[#6AAEE5]">franchise_key</span> dans vos formulaires pour recevoir les leads directement ici.
              Contactez le support pour configurer vos formulaires.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
