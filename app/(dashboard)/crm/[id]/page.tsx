'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getById, update, getNotes, addNote, updateNote, getClientOrders } from '@/lib/clientStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Pencil, Save, Loader2, Plus,
  Phone, Mail, Globe, Building2, MapPin, Hash,
  MessageSquare, PhoneCall, MailIcon, CalendarDays, Target, Users,
  ShoppingCart, FileText, StickyNote, CheckCircle2, Clock, X,
} from 'lucide-react'
import Link from 'next/link'
import { cn, formatDate, formatPrice } from '@/lib/utils'
import type { Client, ClientNote, CommercialStatus, UpsellPotential, NoteType } from '@/types'

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

const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; icon: React.ElementType; color: string }> = {
  note:     { label: 'Note',     icon: StickyNote,   color: '#6B7280' },
  call:     { label: 'Appel',    icon: PhoneCall,     color: '#6AAEE5' },
  email:    { label: 'Email',    icon: MailIcon,      color: '#8B5CF6' },
  meeting:  { label: 'Reunion',  icon: Users,         color: '#F59E0B' },
  followup: { label: 'Relance',  icon: CalendarDays,  color: '#EF4444' },
  upsell:   { label: 'Upsell',   icon: Target,        color: '#22C55E' },
}

const NOTE_TYPES: NoteType[] = ['note', 'call', 'email', 'meeting', 'followup', 'upsell']

// ─── Inline Edit Field ──────────────────────────────────────

function EditableField({
  label,
  value,
  icon: Icon,
  fieldKey,
  onSave,
}: {
  label: string
  value: string
  icon: React.ElementType
  fieldKey: string
  onSave: (key: string, val: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(fieldKey, draft)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F2] p-3 group">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-[#9CA3AF]" />
        <span className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">{label}</span>
        {!editing && (
          <button
            onClick={() => { setDraft(value); setEditing(true) }}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[#F5F7FA]"
          >
            <Pencil className="w-3 h-3 text-[#9CA3AF]" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
            className="flex-1 px-2 py-1 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          />
          <button onClick={handleSave} disabled={saving} className="p-1.5 rounded-lg bg-[#2d2d60] text-white hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-[#F5F7FA] text-[#9CA3AF]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p className="text-sm text-[#2d2d60] font-medium truncate">{value || '---'}</p>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export default function ClientDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [orders, setOrders] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  // Note form
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteType, setNoteType] = useState<NoteType>('note')
  const [noteContent, setNoteContent] = useState('')
  const [noteFollowup, setNoteFollowup] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [c, n, o] = await Promise.all([
      getById(id),
      getNotes(id),
      getClientOrders(id),
    ])
    setClient(c)
    setNotes(n)
    setOrders(o)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const handleFieldSave = async (key: string, value: string) => {
    await update(id, { [key]: value || undefined })
    setClient(prev => prev ? { ...prev, [key]: value || undefined, updated_at: new Date().toISOString() } : prev)
  }

  const handleStatusChange = async (status: CommercialStatus) => {
    await update(id, { commercial_status: status })
    setClient(prev => prev ? { ...prev, commercial_status: status } : prev)
  }

  const handleUpsellChange = async (upsell: UpsellPotential) => {
    await update(id, { upsell_potential: upsell })
    setClient(prev => prev ? { ...prev, upsell_potential: upsell } : prev)
  }

  const handleAddNote = async () => {
    if (!noteContent.trim()) return
    setSavingNote(true)
    await addNote(id, {
      type: noteType,
      content: noteContent,
      followup_date: noteFollowup || undefined,
      completed: false,
    })
    setNoteContent('')
    setNoteFollowup('')
    setNoteType('note')
    setShowNoteForm(false)
    setSavingNote(false)
    const n = await getNotes(id)
    setNotes(n)
  }

  const handleToggleFollowup = async (noteId: string, done: boolean) => {
    await updateNote(noteId, { completed: done })
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, completed: done } : n))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#6AAEE5] animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center gap-4">
        <p className="text-[#6B7280]">Client introuvable</p>
        <Link href="/crm" className="text-sm text-[#6AAEE5] hover:underline">Retour aux clients</Link>
      </div>
    )
  }

  const status = STATUS_CONFIG[client.commercial_status] ?? STATUS_CONFIG.prospect

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-4 md:p-6 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
      >
        <div className="flex items-center gap-4">
          <Link href="/crm" className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-[#E2E8F2] transition-all">
            <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#2d2d60]">{client.company_name}</h1>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{ color: status.color, backgroundColor: status.bg }}
              >
                {status.label}
              </span>
            </div>
            {client.contact_name && (
              <p className="text-sm text-[#6B7280] mt-0.5">{client.contact_name}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left: Info cards (2/3) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EditableField label="Entreprise" value={client.company_name} icon={Building2} fieldKey="company_name" onSave={handleFieldSave} />
            <EditableField label="Contact" value={client.contact_name ?? ''} icon={Users} fieldKey="contact_name" onSave={handleFieldSave} />
            <EditableField label="Email" value={client.email ?? ''} icon={Mail} fieldKey="email" onSave={handleFieldSave} />
            <EditableField label="Telephone" value={client.phone ?? ''} icon={Phone} fieldKey="phone" onSave={handleFieldSave} />
            <EditableField label="WhatsApp" value={client.whatsapp ?? ''} icon={Phone} fieldKey="whatsapp" onSave={handleFieldSave} />
            <EditableField label="Site web" value={client.website ?? ''} icon={Globe} fieldKey="website" onSave={handleFieldSave} />
            <EditableField label="Instagram" value={client.instagram ?? ''} icon={Globe} fieldKey="instagram" onSave={handleFieldSave} />
            <EditableField label="Facebook" value={client.facebook ?? ''} icon={Globe} fieldKey="facebook" onSave={handleFieldSave} />
            <EditableField label="TikTok" value={client.tiktok ?? ''} icon={Globe} fieldKey="tiktok" onSave={handleFieldSave} />
            <EditableField label="N TVA" value={client.vat_number ?? ''} icon={Hash} fieldKey="vat_number" onSave={handleFieldSave} />
            <EditableField label="Secteur" value={client.sector ?? ''} icon={Building2} fieldKey="sector" onSave={handleFieldSave} />
            <EditableField label="Adresse" value={client.address ?? ''} icon={MapPin} fieldKey="address" onSave={handleFieldSave} />
          </div>

          {/* Status + Upsell selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-[#E2E8F2] p-3">
              <label className="block text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-2">Statut commercial</label>
              <select
                value={client.commercial_status}
                onChange={e => handleStatusChange(e.target.value as CommercialStatus)}
                className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="bg-white rounded-xl border border-[#E2E8F2] p-3">
              <label className="block text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider mb-2">Potentiel upsell</label>
              <select
                value={client.upsell_potential ?? ''}
                onChange={e => handleUpsellChange(e.target.value as UpsellPotential)}
                className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
              >
                <option value="">Non defini</option>
                {Object.entries(UPSELL_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Right: Actions + Notes (1/3) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Actions rapides */}
          <div className="bg-white rounded-xl border border-[#E2E8F2] p-4">
            <h3 className="text-sm font-semibold text-[#2d2d60] mb-3">Actions rapides</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/commander"
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#F5F7FA] hover:bg-[#E2E8F2] transition-colors text-center"
              >
                <ShoppingCart className="w-4 h-4 text-[#6AAEE5]" />
                <span className="text-[10px] font-medium text-[#2d2d60]">Nouvelle commande</span>
              </Link>
              <Link
                href="/secretaire"
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#F5F7FA] hover:bg-[#E2E8F2] transition-colors text-center"
              >
                <FileText className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-[10px] font-medium text-[#2d2d60]">Nouveau devis</span>
              </Link>
              <button
                onClick={() => setShowNoteForm(true)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#F5F7FA] hover:bg-[#E2E8F2] transition-colors text-center"
              >
                <MessageSquare className="w-4 h-4 text-[#F59E0B]" />
                <span className="text-[10px] font-medium text-[#2d2d60]">Ajouter une note</span>
              </button>
              <button
                onClick={() => { setNoteType('followup'); setShowNoteForm(true) }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#F5F7FA] hover:bg-[#E2E8F2] transition-colors text-center"
              >
                <CalendarDays className="w-4 h-4 text-[#EF4444]" />
                <span className="text-[10px] font-medium text-[#2d2d60]">Planifier relance</span>
              </button>
            </div>
          </div>

          {/* Add Note Form */}
          <AnimatePresence>
            {showNoteForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white rounded-xl border border-[#E2E8F2] p-4 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#2d2d60]">Nouvelle note</h3>
                  <button onClick={() => setShowNoteForm(false)} className="p-1 rounded hover:bg-[#F5F7FA]">
                    <X className="w-4 h-4 text-[#9CA3AF]" />
                  </button>
                </div>
                {/* Type chips */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {NOTE_TYPES.map(t => {
                    const cfg = NOTE_TYPE_CONFIG[t]
                    return (
                      <button
                        key={t}
                        onClick={() => setNoteType(t)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border',
                          noteType === t
                            ? 'border-current'
                            : 'border-[#E2E8F2] bg-[#F5F7FA]'
                        )}
                        style={noteType === t ? { color: cfg.color, backgroundColor: `${cfg.color}15` } : { color: '#6B7280' }}
                      >
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder="Contenu de la note..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5] resize-none mb-3"
                />
                <div className="mb-3">
                  <label className="block text-[10px] font-medium text-[#9CA3AF] mb-1">Date de suivi (optionnel)</label>
                  <input
                    type="date"
                    value={noteFollowup}
                    onChange={e => setNoteFollowup(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2] text-sm text-[#2d2d60] focus:outline-none focus:ring-2 focus:ring-[#6AAEE5]/30 focus:border-[#6AAEE5]"
                  />
                </div>
                <button
                  onClick={handleAddNote}
                  disabled={!noteContent.trim() || savingNote}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingNote && <Loader2 className="w-4 h-4 animate-spin" />}
                  Ajouter
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Notes list */}
          <div className="bg-white rounded-xl border border-[#E2E8F2] p-4">
            <h3 className="text-sm font-semibold text-[#2d2d60] mb-3">Notes &amp; Relances</h3>
            {notes.length === 0 ? (
              <p className="text-xs text-[#9CA3AF] text-center py-4">Aucune note</p>
            ) : (
              <div className="space-y-3">
                {notes.map(note => {
                  const cfg = NOTE_TYPE_CONFIG[note.type] ?? NOTE_TYPE_CONFIG.note
                  const NoteIcon = cfg.icon
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="border border-[#E2E8F2] rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <NoteIcon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                        <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                        <span className="text-[10px] text-[#9CA3AF] ml-auto">{formatDate(note.created_at)}</span>
                      </div>
                      <p className="text-xs text-[#2d2d60] leading-relaxed">{note.content}</p>
                      {note.followup_date && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#E2E8F2]">
                          <Clock className="w-3 h-3 text-[#F59E0B]" />
                          <span className="text-[10px] text-[#6B7280]">Suivi: {formatDate(note.followup_date)}</span>
                          <button
                            onClick={() => handleToggleFollowup(note.id, !note.completed)}
                            className={cn(
                              'ml-auto flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors',
                              note.completed
                                ? 'text-[#22C55E] bg-[rgba(34,197,94,0.1)]'
                                : 'text-[#9CA3AF] bg-[#F5F7FA] hover:bg-[#E2E8F2]'
                            )}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {note.completed ? 'Termine' : 'A faire'}
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Orders Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-xl border border-[#E2E8F2] p-4 md:p-6"
      >
        <h3 className="text-sm font-semibold text-[#2d2d60] mb-4">Commandes</h3>
        {orders.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="w-8 h-8 text-[#E2E8F2] mx-auto mb-2" />
            <p className="text-xs text-[#9CA3AF]">Aucune commande pour ce client</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F2]">
                  <th className="text-left py-2 px-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Ref</th>
                  <th className="text-left py-2 px-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Service</th>
                  <th className="text-left py-2 px-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Prix</th>
                  <th className="text-left py-2 px-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Statut</th>
                  <th className="text-left py-2 px-3 text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => (
                  <tr key={String(order.id ?? i)} className="border-b border-[#E2E8F2] last:border-0">
                    <td className="py-2.5 px-3 text-xs font-medium text-[#2d2d60]">{String(order.ref ?? '---')}</td>
                    <td className="py-2.5 px-3 text-xs text-[#6B7280]">{String(order.service ?? '---')}</td>
                    <td className="py-2.5 px-3 text-xs text-[#2d2d60] font-medium">{formatPrice(Number(order.price ?? 0))}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#6B7280]">
                        {String(order.status ?? '---')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-[#9CA3AF]">
                      {order.created_at ? formatDate(String(order.created_at)) : '---'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  )
}
