'use client'

import { useState, useMemo, useEffect } from 'react'
import { getAll, insert } from '@/lib/clientStore'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronDown, ChevronUp, Plus, Users, UserCheck, UserPlus,
  Bell, Phone, Mail, Globe, Building2, X, Loader2, Eye,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Client, CommercialStatus, UpsellPotential } from '@/types'

// ─── Config ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<CommercialStatus, { label: string; color: string; bg: string }> = {
  prospect:  { label: 'Prospect',  color: '#6AAEE5', bg: 'rgba(106,174,229,0.1)' },
  qualified: { label: 'Qualifie',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  active:    { label: 'Actif',     color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  inactive:  { label: 'Inactif',   color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
  lost:      { label: 'Perdu',     color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
}

const UPSELL_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Faible', color: '#9CA3AF' },
  medium: { label: 'Moyen',  color: '#F59E0B' },
  high:   { label: 'Fort',   color: '#22C55E' },
}

const FILTER_TABS: { key: CommercialStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'Tous' },
  { key: 'prospect',  label: 'Prospect' },
  { key: 'qualified', label: 'Qualifie' },
  { key: 'active',    label: 'Actif' },
  { key: 'inactive',  label: 'Inactif' },
  { key: 'lost',      label: 'Perdu' },
]

const SECTORS = [
  'Restauration', 'Commerce', 'Immobilier', 'Sante', 'Beaute',
  'Sport & Fitness', 'Automobile', 'Education', 'Tech / IT',
  'BTP', 'Juridique', 'Finance', 'Marketing', 'Autre',
]

// ─── Component ───────────────────────────────────────────────

export default function CRMPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CommercialStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    website: '',
    instagram: '',
    facebook: '',
    tiktok: '',
    vat_number: '',
    sector: '',
    address: '',
    commercial_status: 'prospect' as CommercialStatus,
    upsell_potential: '' as UpsellPotential | '',
  })

  const load = async () => {
    setLoading(true)
    const data = await getAll()
    setClients(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let list = clients
    if (filter !== 'all') list = list.filter(c => c.commercial_status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.company_name ?? '').toLowerCase().includes(q) ||
        (c.contact_name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q)
      )
    }
    return list
  }, [clients, filter, search])

  // Stats
  const totalClients = clients.length
  const prospects = clients.filter(c => c.commercial_status === 'prospect').length
  const actifs = clients.filter(c => c.commercial_status === 'active').length

  const handleSubmit = async () => {
    if (!form.company_name.trim()) return
    setSaving(true)
    await insert({
      company_name: form.company_name,
      contact_name: form.contact_name || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      whatsapp: form.whatsapp || undefined,
      website: form.website || undefined,
      instagram: form.instagram || undefined,
      facebook: form.facebook || undefined,
      tiktok: form.tiktok || undefined,
      vat_number: form.vat_number || undefined,
      sector: form.sector || undefined,
      address: form.address || undefined,
      commercial_status: form.commercial_status,
      upsell_potential: (form.upsell_potential as UpsellPotential) || undefined,
    })
    setForm({
      company_name: '', contact_name: '', email: '', phone: '',
      whatsapp: '', website: '', instagram: '', facebook: '', tiktok: '',
      vat_number: '', sector: '', address: '',
      commercial_status: 'prospect', upsell_potential: '',
    })
    setShowModal(false)
    setSaving(false)
    load()
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2d2d60]">Mes clients</h1>
          <p className="text-sm text-[#6B7280] mt-1">Gerez votre portefeuille client</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau client
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total clients', value: totalClients, icon: Users, color: '#2d2d60' },
          { label: 'Prospects', value: prospects, icon: UserPlus, color: '#6AAEE5' },
          { label: 'Clients actifs', value: actifs, icon: UserCheck, color: '#22C55E' },
          { label: 'Relances a faire', value: 0, icon: Bell, color: '#F59E0B' },
        ].map((kpi) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-[#E2E8F2] p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${kpi.color}12` }}
              >
                <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-xs text-[#6B7280] font-medium">{kpi.label}</p>
                <p className="text-xl font-bold text-[#2d2d60]">{kpi.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filter === tab.key
                  ? 'bg-[#2d2d60] text-white'
                  : 'bg-white text-[#6B7280] border border-[#E2E8F2] hover:border-[#2d2d60] hover:text-[#2d2d60]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
          />
        </div>
      </div>

      {/* Client List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#6AAEE5] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-[#E2E8F2] mx-auto mb-3" />
          <p className="text-[#6B7280] text-sm">Aucun client trouve</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((client) => {
              const status = STATUS_CONFIG[client.commercial_status] ?? STATUS_CONFIG.prospect
              const isOpen = expanded === client.id
              return (
                <motion.div
                  key={client.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-white rounded-xl border border-[#E2E8F2] overflow-hidden"
                >
                  {/* Compact row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : client.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F7FA]/50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2d2d60] to-[#4A7DC4] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-white">
                        {(client.company_name ?? '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#2d2d60] truncate">{client.company_name}</p>
                      {client.contact_name && (
                        <p className="text-xs text-[#6B7280] truncate">{client.contact_name}</p>
                      )}
                    </div>
                    {client.phone && (
                      <span className="hidden sm:flex items-center gap-1 text-xs text-[#6B7280]">
                        <Phone className="w-3 h-3" /> {client.phone}
                      </span>
                    )}
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ color: status.color, backgroundColor: status.bg }}
                    >
                      {status.label}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                    </motion.div>
                  </button>

                  {/* Expanded */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1 border-t border-[#E2E8F2] space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {client.email && (
                              <div className="flex items-center gap-2 text-[#6B7280]">
                                <Mail className="w-3.5 h-3.5" /> {client.email}
                              </div>
                            )}
                            {client.whatsapp && (
                              <div className="flex items-center gap-2 text-[#6B7280]">
                                <Phone className="w-3.5 h-3.5" /> WhatsApp: {client.whatsapp}
                              </div>
                            )}
                            {client.sector && (
                              <div className="flex items-center gap-2 text-[#6B7280]">
                                <Building2 className="w-3.5 h-3.5" /> {client.sector}
                              </div>
                            )}
                            {client.website && (
                              <div className="flex items-center gap-2 text-[#6B7280]">
                                <Globe className="w-3.5 h-3.5" /> {client.website}
                              </div>
                            )}
                          </div>
                          {client.upsell_potential && UPSELL_CONFIG[client.upsell_potential] && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#6B7280]">Potentiel upsell:</span>
                              <span
                                className="text-xs font-medium"
                                style={{ color: UPSELL_CONFIG[client.upsell_potential].color }}
                              >
                                {UPSELL_CONFIG[client.upsell_potential].label}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-end">
                            <Link
                              href={`/crm/${client.id}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#6AAEE5] bg-[rgba(106,174,229,0.08)] hover:bg-[rgba(106,174,229,0.15)] transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> Voir la fiche
                            </Link>
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

      {/* New Client Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl md:w-full md:max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-[#E2E8F2]">
                <h2 className="text-lg font-bold text-[#2d2d60]">Nouveau client</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* Required */}
                <div>
                  <label className="block text-xs font-medium text-[#2d2d60] mb-1">Nom de l&apos;entreprise *</label>
                  <input
                    value={form.company_name}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                    placeholder="Ex: Restaurant Le Gourmet"
                  />
                </div>
                {/* Contact */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">Nom du contact</label>
                    <input
                      value={form.contact_name}
                      onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                      placeholder="Jean Dupont"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">Email</label>
                    <input
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      type="email"
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                      placeholder="email@exemple.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">Telephone</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                      placeholder="+32 ..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">WhatsApp</label>
                    <input
                      value={form.whatsapp}
                      onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                      placeholder="+32 ..."
                    />
                  </div>
                </div>
                {/* Social / Web */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">Site web</label>
                    <input
                      value={form.website}
                      onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">Instagram</label>
                    <input
                      value={form.instagram}
                      onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                      placeholder="@compte"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">Facebook</label>
                    <input
                      value={form.facebook}
                      onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                      placeholder="Page Facebook"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">TikTok</label>
                    <input
                      value={form.tiktok}
                      onChange={e => setForm(f => ({ ...f, tiktok: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                      placeholder="@compte"
                    />
                  </div>
                </div>
                {/* Business info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">N TVA</label>
                    <input
                      value={form.vat_number}
                      onChange={e => setForm(f => ({ ...f, vat_number: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                      placeholder="BE0123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">Secteur</label>
                    <select
                      value={form.sector}
                      onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                    >
                      <option value="">Choisir...</option>
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#2d2d60] mb-1">Adresse</label>
                  <input
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                    placeholder="Rue, Ville, Code postal"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">Statut commercial</label>
                    <select
                      value={form.commercial_status}
                      onChange={e => setForm(f => ({ ...f, commercial_status: e.target.value as CommercialStatus }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                    >
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#2d2d60] mb-1">Potentiel upsell</label>
                    <select
                      value={form.upsell_potential}
                      onChange={e => setForm(f => ({ ...f, upsell_potential: e.target.value as UpsellPotential | '' }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                    >
                      <option value="">Non defini</option>
                      {Object.entries(UPSELL_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-5 border-t border-[#E2E8F2]">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F7FA] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.company_name.trim() || saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-semibold bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Creer le client
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
