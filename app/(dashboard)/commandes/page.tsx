'use client'

import { useState, useMemo, useEffect } from 'react'
import { getAll, update as storeUpdate } from '@/lib/orderStore'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronDown, Eye, ExternalLink, FolderOpen,
  ArrowUpDown, Calendar, Euro,
  ShoppingCart, Clock, CheckCircle2, XCircle, Inbox,
  X, User, Mail, Phone, FileText, CreditCard,
  Building2, Target, Key, Briefcase, Pencil, Save, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import type { OrderStatus } from '@/types'

// ─── Types ────────────────────────────────────────────────────
type ServiceType = 'website' | 'campaign' | 'standard'
type InternalProgress = 'pending' | 'in_progress' | 'completed'
  | 'preparation' | 'v1_ready' | 'v2_ready' | 'domain_config' | 'site_done'
  | 'strategy' | 'shooting' | 'launching' | 'live'

interface Order {
  id:                      string
  ref:                     string
  service:                 string
  serviceType:             ServiceType
  internalProgress:        InternalProgress
  client:                  string
  clientEmail:             string
  clientPhone:             string
  companyName:             string
  companyEmail:            string
  sector:                  string
  brief:                   string
  objectives:              string
  requiredAccess:          string
  deliverablesUrl:         string
  date:                    string
  price:                   number
  status:                  OrderStatus
  paymentStatus:           'paid' | 'unpaid' | 'refunded'
}

function mapRow(row: Record<string, unknown>): Order {
  return {
    id:             String(row.id),
    ref:            String(row.ref ?? ('CMD-' + String(row.id).slice(0, 8).toUpperCase())),
    service:        String(row.service        ?? '—'),
    client:         String(row.client_name    ?? '—'),
    clientEmail:    String(row.client_email   ?? '—'),
    clientPhone:    String(row.client_phone   ?? ''),
    companyName:    String(row.company_name   ?? ''),
    companyEmail:   String(row.company_email  ?? ''),
    sector:         String(row.sector         ?? ''),
    brief:          String(row.brief          ?? ''),
    objectives:     String(row.objectives     ?? ''),
    requiredAccess:  String(row.required_access ?? ''),
    deliverablesUrl: String(row.deliverables_url ?? ''),
    serviceType:     (row.service_type as ServiceType) ?? 'standard',
    internalProgress: (row.internal_progress_status as InternalProgress) ?? 'pending',
    date:            String(row.created_at     ?? ''),
    price:          Number(row.price          ?? 0),
    status:         (row.status         as OrderStatus)           ?? 'pending',
    paymentStatus:  (row.payment_status as Order['paymentStatus']) ?? 'unpaid',
  }
}

// ─── Config ───────────────────────────────────────────────────
const STATUS_CONFIG: Record<OrderStatus, {
  label: string; bg: string; text: string; dot: string; icon: React.ElementType; pulse?: boolean
}> = {
  pending:     { label: 'En attente', bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B', dot: '#F59E0B', icon: Clock,        pulse: true },
  in_progress: { label: 'En cours',   bg: 'rgba(106,174,229,0.12)', text: '#6AAEE5', dot: '#6AAEE5', icon: ShoppingCart, pulse: true },
  completed:   { label: 'Terminé',    bg: 'rgba(34,197,94,0.12)',   text: '#22C55E', dot: '#22C55E', icon: CheckCircle2 },
  cancelled:   { label: 'Annulé',     bg: 'rgba(239,68,68,0.12)',   text: '#EF4444', dot: '#EF4444', icon: XCircle },
}

const PAYMENT_CONFIG = {
  paid:     { label: 'Payé',      color: '#22C55E', bg: 'rgba(34,197,94,0.1)'   },
  unpaid:   { label: 'Non payé',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
  refunded: { label: 'Remboursé', color: '#8B95C4', bg: 'rgba(139,149,196,0.1)' },
}

const FILTER_TABS: { key: OrderStatus | 'all'; label: string; icon: React.ElementType }[] = [
  { key: 'all',         label: 'Toutes',    icon: Inbox },
  { key: 'pending',     label: 'En attente', icon: Clock },
  { key: 'in_progress', label: 'En cours',   icon: ShoppingCart },
  { key: 'completed',   label: 'Terminées',  icon: CheckCircle2 },
  { key: 'cancelled',   label: 'Annulées',   icon: XCircle },
]

type SortField = 'date' | 'price' | 'ref'
type SortDir   = 'asc' | 'desc'

// Étapes du stepper — standard (logos, kits, etc.)
const PROGRESS_STEPS: { key: string; label: string }[] = [
  { key: 'pending',     label: 'En attente' },
  { key: 'in_progress', label: 'En cours'   },
  { key: 'completed',   label: 'Terminé'    },
]

// Étapes du stepper — sites web
const WEBSITE_STEPS = [
  { key: 'preparation', label: 'En préparation' },
  { key: 'v1',          label: '1ère version prête' },
  { key: 'v2',          label: '2ème version prête' },
  { key: 'domain',      label: 'Config. domaine' },
  { key: 'done',        label: 'Site finalisé' },
]

// Étapes du stepper — campagnes / acquisition / contenu
const CAMPAIGN_STEPS = [
  { key: 'strategy',  label: 'Préparation stratégie' },
  { key: 'shooting',  label: 'Tournage en préparation' },
  { key: 'launching', label: 'Lancement campagnes' },
  { key: 'live',      label: 'Campagne lancée' },
]

// Détecte le type de service
function isWebsiteService(service: string): boolean {
  return /site|web|one.?page|landing|vitrine|e-comm/i.test(service)
}

function isCampaignService(service: string): boolean {
  return /visibilit|acquisition|accompagnement|campagne|contenu|socia|ads|seo|réseaux|publicité/i.test(service)
}

// Déduit l'étape à partir du statut de la commande
function getWebsiteStepIndex(status: OrderStatus): number {
  if (status === 'pending')     return 0
  if (status === 'in_progress') return 1
  if (status === 'completed')   return 4
  return -1
}

function getCampaignStepIndex(status: OrderStatus): number {
  if (status === 'pending')     return 0
  if (status === 'in_progress') return 1
  if (status === 'completed')   return 3
  return -1
}

// Retourne les étapes et l'index actif pour un service donné
function getStepsForService(service: string, status: OrderStatus, svcType?: ServiceType, internalProg?: InternalProgress): { steps: { key: string; label: string }[]; index: number } {
  // 1. Détermine le type (priorité : champ DB > regex)
  const type = svcType && svcType !== 'standard' ? svcType
    : isWebsiteService(service) ? 'website'
    : isCampaignService(service) ? 'campaign'
    : 'standard'

  // 2. Détermine l'index (priorité : internal_progress_status > fallback depuis status)
  if (type === 'website') {
    const idx = internalProg ? WEBSITE_STEPS.findIndex(s => s.key === internalProg) : -1
    return { steps: WEBSITE_STEPS, index: idx >= 0 ? idx : getWebsiteStepIndex(status) }
  }
  if (type === 'campaign') {
    const idx = internalProg ? CAMPAIGN_STEPS.findIndex(s => s.key === internalProg) : -1
    return { steps: CAMPAIGN_STEPS, index: idx >= 0 ? idx : getCampaignStepIndex(status) }
  }
  return { steps: PROGRESS_STEPS, index: status === 'cancelled' ? -1 : PROGRESS_STEPS.findIndex(s => s.key === status) }
}

// ─── Modal détail commande ─────────────────────────────────────
type EditableFields = {
  client:         string
  clientEmail:    string
  clientPhone:    string
  companyName:    string
  companyEmail:   string
  sector:         string
  brief:          string
  objectives:     string
  requiredAccess: string
}

function OrderDetailModal({
  order,
  onClose,
  onSave,
}: {
  order: Order
  onClose: () => void
  onSave: (updated: Order) => void
}) {
  const s = STATUS_CONFIG[order.status]
  const p = PAYMENT_CONFIG[order.paymentStatus]
  const StatusIcon = s.icon

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [editData, setEditData]   = useState<EditableFields>({
    client:         order.client,
    clientEmail:    order.clientEmail,
    clientPhone:    order.clientPhone,
    companyName:    order.companyName,
    companyEmail:   order.companyEmail,
    sector:         order.sector,
    brief:          order.brief,
    objectives:     order.objectives,
    requiredAccess: order.requiredAccess,
  })

  const set = (key: keyof EditableFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditData(prev => ({ ...prev, [key]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      // localStorage
      storeUpdate(order.id, {
        client_name:     editData.client,
        client_email:    editData.clientEmail,
        client_phone:    editData.clientPhone,
        company_name:    editData.companyName,
        company_email:   editData.companyEmail,
        sector:          editData.sector,
        brief:           editData.brief,
        objectives:      editData.objectives,
        required_access: editData.requiredAccess,
      })

      // Supabase
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('orders').update({
          client_name:     editData.client,
          client_email:    editData.clientEmail,
          client_phone:    editData.clientPhone,
          company_name:    editData.companyName,
          company_email:   editData.companyEmail,
          sector:          editData.sector,
          brief:           editData.brief,
          objectives:      editData.objectives,
          required_access: editData.requiredAccess,
        }).eq('id', order.id).eq('user_id', user.id)
      }

      const updated: Order = { ...order, ...editData }
      onSave(updated)
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditData({
      client:         order.client,
      clientEmail:    order.clientEmail,
      clientPhone:    order.clientPhone,
      companyName:    order.companyName,
      companyEmail:   order.companyEmail,
      sector:         order.sector,
      brief:          order.brief,
      objectives:     order.objectives,
      requiredAccess: order.requiredAccess,
    })
    setIsEditing(false)
  }

  // Stepper selon le type de service
  const { steps: activeSteps, index: stepIndex } = getStepsForService(order.service, order.status, order.serviceType, order.internalProgress)

  // Styles partagés pour les champs éditables
  const inputCls = 'w-full bg-[#F5F7FA] border border-[#E2E8F2] rounded-lg px-3 py-1.5 text-[13px] text-[#2d2d60] font-semibold outline-none focus:border-[#6AAEE5] transition-colors placeholder:text-[#9CA3AF]'
  const textareaCls = `${inputCls} resize-none leading-relaxed`

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-lg rounded-2xl bg-white border border-[#E2E8F2] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F3F8] bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-300" style={{ background: s.bg }}>
              <StatusIcon className="w-4.5 h-4.5 transition-colors duration-300" style={{ color: s.text }} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11px] font-mono text-[#9CA3AF]">{order.ref}</p>
              <p className="text-[14px] font-bold text-[#2d2d60] leading-tight">{order.service}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && order.status !== 'cancelled' && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#6AAEE5] bg-[#6AAEE5]/8 hover:bg-[#6AAEE5]/15 border border-[#6AAEE5]/25 transition-all"
              >
                <Pencil className="w-3 h-3" />
                Modifier
              </button>
            )}
            <button
              onClick={isEditing ? cancelEdit : onClose}
              className="w-7 h-7 rounded-lg bg-[#F5F7FA] hover:bg-[#E2E8F2] flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">

          {/* ── Suivi de progression (lecture seule) ── */}
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F2] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-4">
              {isWebsiteService(order.service) ? 'Avancement site web' : isCampaignService(order.service) ? 'Avancement campagne' : 'Suivi du projet'}
            </p>

            {order.status !== 'cancelled' ? (
              <div className="flex items-center gap-0">
                {activeSteps.map((step, i) => {
                  const done    = i < stepIndex
                  const active  = i === stepIndex
                  const future  = i > stepIndex
                  return (
                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                          done   && 'bg-[#22C55E] border-[#22C55E]',
                          active && 'border-[#6AAEE5] bg-[#6AAEE5]/10',
                          future && 'border-[#E2E8F2] bg-[#F5F7FA]',
                        )}>
                          {done
                            ? <CheckCircle2 className="w-4 h-4 text-white" />
                            : active
                              ? <span className="w-2.5 h-2.5 rounded-full bg-[#6AAEE5] animate-pulse" />
                              : <span className="w-2 h-2 rounded-full bg-[#E2E8F2]" />
                          }
                        </div>
                        <span className={cn(
                          'text-[10px] font-semibold whitespace-nowrap',
                          done   && 'text-[#22C55E]',
                          active && 'text-[#6AAEE5]',
                          future && 'text-[#9CA3AF]',
                        )}>
                          {step.label}
                        </span>
                      </div>
                      {i < activeSteps.length - 1 && (
                        <div className="flex-1 h-[2px] mx-2 rounded-full transition-all duration-500"
                          style={{ background: done ? '#22C55E' : '#E2E8F2' }} />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)]">
                <XCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
                <span className="text-[13px] font-semibold text-[#EF4444]">Commande annulée</span>
              </div>
            )}
          </div>

          {/* Paiement */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border px-4 py-3" style={{ background: p.bg, borderColor: `${p.color}30` }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: `${p.color}90` }}>Paiement</p>
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" style={{ color: p.color }} />
                <span className="text-[13px] font-bold" style={{ color: p.color }}>{p.label}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F2]">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <Euro className="w-3.5 h-3.5 text-[#6AAEE5]" />
                <span className="text-[11px] font-medium">Montant</span>
              </div>
              <span className="text-[16px] font-bold text-[#2d2d60] font-mono">{formatPrice(order.price)}</span>
            </div>
          </div>

          {/* Contact client */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Contact client
            </p>
            <div className="space-y-2">
              {([
                { icon: User,  label: 'Nom client',  key: 'client'      as const, placeholder: 'Nom du client' },
                { icon: Mail,  label: 'Email client', key: 'clientEmail' as const, placeholder: 'email@exemple.com' },
                { icon: Phone, label: 'Téléphone',    key: 'clientPhone' as const, placeholder: '+33 6 00 00 00 00' },
              ] as const).map(({ icon: Icon, label, key, placeholder }) => (
                <div key={label} className="flex items-center gap-3 py-2.5 px-4 rounded-xl bg-[#F8FAFC] border border-[#F0F3F8]">
                  <Icon className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-[#9CA3AF] font-medium mb-0.5">{label}</p>
                    {isEditing
                      ? <input className={inputCls} value={editData[key]} onChange={set(key)} placeholder={placeholder} />
                      : <p className="text-[13px] text-[#2d2d60] font-semibold truncate">{editData[key] || '—'}</p>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Entreprise */}
          {(isEditing || order.companyName || order.companyEmail || order.sector) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Entreprise
              </p>
              <div className="space-y-2">
                {([
                  { icon: Building2, label: 'Nom entreprise',     key: 'companyName'  as const, placeholder: 'Nom de la société' },
                  { icon: Mail,      label: 'Email entreprise',   key: 'companyEmail' as const, placeholder: 'contact@société.com' },
                  { icon: Briefcase, label: "Secteur d'activité", key: 'sector'       as const, placeholder: 'ex: E-commerce, SaaS…' },
                ] as const).map(({ icon: Icon, label, key, placeholder }) => (
                  <div key={label} className="flex items-center gap-3 py-2.5 px-4 rounded-xl bg-[#F8FAFC] border border-[#F0F3F8]">
                    <Icon className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-[#9CA3AF] font-medium mb-0.5">{label}</p>
                      {isEditing
                        ? <input className={inputCls} value={editData[key]} onChange={set(key)} placeholder={placeholder} />
                        : <p className="text-[13px] text-[#2d2d60] font-semibold truncate">{editData[key] || '—'}</p>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brief */}
          {(isEditing || editData.brief) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Brief / Description
              </p>
              <div className="bg-[#F8FAFC] border-l-2 border-[#6AAEE5] rounded-r-xl px-4 py-3">
                {isEditing
                  ? <textarea className={textareaCls} rows={4} value={editData.brief} onChange={set('brief')} placeholder="Décrivez votre projet…" />
                  : <p className="text-[13px] text-[#6B7280] leading-relaxed whitespace-pre-wrap">{editData.brief}</p>
                }
              </div>
            </div>
          )}

          {/* Objectifs */}
          {(isEditing || editData.objectives) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Objectifs
              </p>
              <div className="bg-[#F8FAFC] border-l-2 border-[#22C55E] rounded-r-xl px-4 py-3">
                {isEditing
                  ? <textarea className={textareaCls} rows={3} value={editData.objectives} onChange={set('objectives')} placeholder="Vos objectifs principaux…" />
                  : <p className="text-[13px] text-[#6B7280] leading-relaxed whitespace-pre-wrap">{editData.objectives}</p>
                }
              </div>
            </div>
          )}

          {/* Accès nécessaires */}
          {(isEditing || editData.requiredAccess) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" /> Accès nécessaires
              </p>
              <div className="bg-[#F8FAFC] border-l-2 border-[#F59E0B] rounded-r-xl px-4 py-3">
                {isEditing
                  ? <textarea className={textareaCls} rows={3} value={editData.requiredAccess} onChange={set('requiredAccess')} placeholder="Accès CMS, analytics, réseaux…" />
                  : <p className="text-[13px] text-[#6B7280] leading-relaxed whitespace-pre-wrap">{editData.requiredAccess}</p>
                }
              </div>
            </div>
          )}

          {/* Livrables */}
          {order.deliverablesUrl ? (
            <a
              href={order.deliverablesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#22C55E]/5 to-[#22C55E]/10 border border-[#22C55E]/20 hover:border-[#22C55E]/40 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-[#22C55E]/10 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="w-4.5 h-4.5 text-[#22C55E]" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#2d2d60]">Accéder aux livrables</p>
                <p className="text-[11px] text-[#6B7280] truncate">Scripts, vidéos, pages, documents…</p>
              </div>
              <ExternalLink className="w-4 h-4 text-[#22C55E] opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </a>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2]">
              <div className="w-9 h-9 rounded-lg bg-[#E2E8F2] flex items-center justify-center flex-shrink-0">
                <FolderOpen className="w-4.5 h-4.5 text-[#9CA3AF]" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#9CA3AF]">Livrables en préparation</p>
                <p className="text-[11px] text-[#9CA3AF]">Le lien sera disponible une fois les documents prêts</p>
              </div>
            </div>
          )}

          {/* Méta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="py-2.5 px-4 rounded-xl bg-[#F8FAFC] border border-[#F0F3F8]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Référence</p>
              <p className="text-[12px] font-mono text-[#6B7280]">{order.ref}</p>
            </div>
            <div className="py-2.5 px-4 rounded-xl bg-[#F8FAFC] border border-[#F0F3F8]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Date</p>
              <p className="text-[12px] text-[#6B7280]">{formatDate(order.date)}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#F0F3F8] bg-[#F8FAFC]">
          {isEditing ? (
            <div className="flex gap-3">
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-[#6B7280] hover:text-[#2d2d60] border border-[#E2E8F2] hover:border-[#6B7280] transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)' }}
              >
                {saving
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enregistrement…</>
                  : <><Save className="w-3.5 h-3.5" /> Sauvegarder</>
                }
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-[#6B7280] hover:text-[#2d2d60] border border-[#E2E8F2] hover:border-[#6B7280] transition-all"
            >
              Fermer
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function CommandesPage() {
  const [orders, setOrders]           = useState<Order[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch]           = useState('')
  const [sortField, setSortField]     = useState<SortField>('date')
  const [sortDir, setSortDir]         = useState<SortDir>('desc')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)


  useEffect(() => {
    // Affichage immédiat depuis localStorage
    const local = getAll().map(o => mapRow(o as unknown as Record<string, unknown>))
    setOrders(local)
    setLoading(false)

    // Remplacement par les données Supabase
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setOrders(data.map(row => mapRow(row as Record<string, unknown>)))
          }
        })
    })
  }, [])

  const counts = useMemo(() => ({
    all:         orders.length,
    pending:     orders.filter(o => o.status === 'pending').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    completed:   orders.filter(o => o.status === 'completed').length,
    cancelled:   orders.filter(o => o.status === 'cancelled').length,
  }), [orders])

  const filtered = useMemo(() => {
    let list = orders
    if (activeFilter !== 'all') list = list.filter(o => o.status === activeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        o.ref.toLowerCase().includes(q) ||
        o.service.toLowerCase().includes(q) ||
        o.client.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      let val = 0
      if (sortField === 'date')  val = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (sortField === 'price') val = a.price - b.price
      if (sortField === 'ref')   val = a.ref.localeCompare(b.ref)
      return sortDir === 'asc' ? val : -val
    })
  }, [activeFilter, search, sortField, sortDir, orders])

  const totalFiltered = useMemo(() => filtered.reduce((s, o) => s + o.price, 0), [filtered])

  // 3 sections triees
  const pendingOrders    = useMemo(() => filtered.filter(o => o.status === 'pending'), [filtered])
  const inProgressOrders = useMemo(() => filtered.filter(o => o.status === 'in_progress'), [filtered])
  const completedOrders  = useMemo(() => filtered.filter(o => ['completed', 'cancelled'].includes(o.status)), [filtered])
  const [showCompleted, setShowCompleted] = useState(false)

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">Historique</p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Mes commandes</h1>
          <Link
            href="/commander"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)' }}
          >
            <ShoppingCart className="w-4 h-4" />
            Nouvelle commande
          </Link>
        </div>
      </motion.div>

      {/* KPI strip */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          { label: 'Total commandes', value: loading ? '…' : orders.length,        icon: Inbox,        color: '#6AAEE5' },
          { label: 'En cours',        value: loading ? '…' : counts.in_progress,   icon: ShoppingCart, color: '#6AAEE5' },
          { label: 'Terminées',       value: loading ? '…' : counts.completed,     icon: CheckCircle2, color: '#22C55E' },
          {
            label: "Chiffre d'aff.",
            value: loading ? '…' : formatPrice(orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.price, 0)),
            icon: Euro, color: '#22C55E',
          },
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

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_TABS.map(({ key, label, icon: Icon }) => {
            const active = activeFilter === key
            const count  = counts[key]
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 border',
                  active
                    ? 'bg-white border-[#6AAEE5] text-[#2d2d60] shadow-sm'
                    : 'bg-[#F5F7FA] border-[#E2E8F2] text-[#6B7280] hover:text-[#2d2d60]'
                )}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                {label}
                <span className={cn(
                  'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                  active ? 'bg-[#6AAEE5]/15 text-[#6AAEE5]' : 'bg-[#E2E8F2] text-[#9CA3AF]'
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px] flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] hover:border-[#6AAEE5]/40 transition-colors group">
            <Search className="w-3.5 h-3.5 text-[#9CA3AF] group-focus-within:text-[#6AAEE5] transition-colors flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par service, client, référence…"
              className="flex-1 bg-transparent text-[13px] text-[#2d2d60] placeholder:text-[#9CA3AF] outline-none min-w-0"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[#9CA3AF] hover:text-[#2d2d60] transition-colors">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => toggleSort('date')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all whitespace-nowrap',
              sortField === 'date'
                ? 'bg-white border-[#6AAEE5] text-[#6AAEE5]'
                : 'bg-[#F5F7FA] border-[#E2E8F2] text-[#6B7280] hover:text-[#2d2d60]'
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            Date {sortField === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => toggleSort('price')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all whitespace-nowrap',
              sortField === 'price'
                ? 'bg-white border-[#6AAEE5] text-[#6AAEE5]'
                : 'bg-[#F5F7FA] border-[#E2E8F2] text-[#6B7280] hover:text-[#2d2d60]'
            )}
          >
            <Euro className="w-3.5 h-3.5" />
            Prix {sortField === 'price' && (sortDir === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </motion.div>

      {/* Results info */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[12px] text-[#9CA3AF]">
            <span className="text-[#6B7280] font-medium">{filtered.length}</span> commande{filtered.length !== 1 ? 's' : ''}
            {activeFilter !== 'all' && ` · ${FILTER_TABS.find(f => f.key === activeFilter)?.label}`}
          </p>
          <p className="text-[12px] text-[#9CA3AF]">
            Total visible : <span className="text-[#6AAEE5] font-semibold">{formatPrice(totalFiltered)}</span>
          </p>
        </div>
      </motion.div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#F5F7FA] border border-[#E2E8F2] p-16 text-center">
          <Inbox className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-[#6B7280] font-medium">Aucune commande trouvée</p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">Essayez de modifier vos filtres</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Section: En attente ── */}
          {pendingOrders.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#F59E0B]">En attente</h2>
                <span className="text-[11px] font-semibold text-[#9CA3AF] ml-1">{pendingOrders.length}</span>
              </div>
              <div className="rounded-2xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.06)] overflow-hidden">
                <AnimatePresence initial={false}>
                  {pendingOrders.map((order, i) => {
                const s        = STATUS_CONFIG[order.status]
                const p        = PAYMENT_CONFIG[order.paymentStatus]
                const expanded = expandedId === order.id

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="border-b border-[#F0F3F8] last:border-0"
                  >
                    {/* Compact row — client name + phone + status badge + chevron */}
                    <div
                      className="flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : order.id)}
                    >
                      {/* Status dot */}
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                        {(() => { const Icon = s.icon; return <Icon className="w-4 h-4" style={{ color: s.text }} strokeWidth={1.75} /> })()}
                      </div>

                      {/* Client info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#2d2d60] truncate">{order.client}</p>
                        <p className="text-[12px] text-[#6B7280] mt-0.5">{order.clientPhone || order.clientEmail}</p>
                      </div>

                      {/* Status badge */}
                      <span
                        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex-shrink-0"
                        style={{ background: s.bg, color: s.text }}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full', s.pulse && 'animate-pulse')} style={{ background: s.dot }} />
                        {s.label}
                      </span>

                      {/* Chevron */}
                      <ChevronDown className={cn('w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform duration-300', expanded && 'rotate-180')} />
                    </div>

                    {/* Expanded detail panel — accordion */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 pt-4 bg-[#F8FAFC] border-t border-[#F0F3F8] space-y-4">

                            {/* Service + ref + date */}
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[15px] font-bold text-[#2d2d60]">{order.service}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[11px] font-mono text-[#9CA3AF]">{order.ref}</span>
                                  <span className="text-[#E2E8F2]">·</span>
                                  <span className="text-[11px] text-[#9CA3AF]">{formatDate(order.date)}</span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[18px] font-bold font-mono text-[#2d2d60]">{formatPrice(order.price)}</p>
                                <span className="text-[11px] font-medium" style={{ color: p.color }}>{p.label}</span>
                              </div>
                            </div>

                            {/* Progress stepper (site web ou campagne) */}
                            {(isWebsiteService(order.service) || isCampaignService(order.service)) && order.status !== 'cancelled' && (() => {
                              const { steps: svcSteps, index: svcIdx } = getStepsForService(order.service, order.status, order.serviceType, order.internalProgress)
                              const title = isWebsiteService(order.service) ? 'Avancement site web' : 'Avancement campagne'
                              return (
                                <div className="bg-white rounded-xl border border-[#E2E8F2] px-4 py-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3">{title}</p>
                                  <div className="flex items-center gap-0">
                                    {svcSteps.map((step, i) => {
                                      const done   = i < svcIdx
                                      const active = i === svcIdx
                                      const future = i > svcIdx
                                      return (
                                        <div key={step.key} className="flex items-center flex-1 last:flex-none">
                                          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                            <div className={cn(
                                              'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all',
                                              done   && 'bg-[#22C55E] border-[#22C55E]',
                                              active && 'border-[#6AAEE5] bg-[#6AAEE5]/10',
                                              future && 'border-[#E2E8F2] bg-[#F5F7FA]',
                                            )}>
                                              {done
                                                ? <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                                : active
                                                  ? <span className="w-2 h-2 rounded-full bg-[#6AAEE5] animate-pulse" />
                                                  : <span className="w-1.5 h-1.5 rounded-full bg-[#E2E8F2]" />
                                              }
                                            </div>
                                            <span className={cn(
                                              'text-[9px] sm:text-[10px] font-semibold text-center whitespace-nowrap',
                                              done   && 'text-[#22C55E]',
                                              active && 'text-[#6AAEE5]',
                                              future && 'text-[#9CA3AF]',
                                            )}>
                                              {step.label}
                                            </span>
                                          </div>
                                          {i < svcSteps.length - 1 && (
                                            <div className="flex-1 h-[2px] mx-1.5 rounded-full" style={{ background: done ? '#22C55E' : '#E2E8F2' }} />
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })()}

                            {/* Info grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-white rounded-xl border border-[#E2E8F2] px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Client</p>
                                <p className="text-[12px] font-semibold text-[#2d2d60]">{order.client}</p>
                              </div>
                              <div className="bg-white rounded-xl border border-[#E2E8F2] px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Email</p>
                                <p className="text-[12px] text-[#6B7280] truncate">{order.clientEmail}</p>
                              </div>
                              {order.clientPhone && (
                                <div className="bg-white rounded-xl border border-[#E2E8F2] px-3 py-2.5">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Téléphone</p>
                                  <p className="text-[12px] text-[#6B7280]">{order.clientPhone}</p>
                                </div>
                              )}
                              {order.companyName && (
                                <div className="bg-white rounded-xl border border-[#E2E8F2] px-3 py-2.5">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Entreprise</p>
                                  <p className="text-[12px] text-[#6B7280]">{order.companyName}</p>
                                </div>
                              )}
                            </div>

                            {/* Brief */}
                            {order.brief && (
                              <div className="bg-white rounded-xl border border-[#E2E8F2] px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1.5">Brief</p>
                                <p className="text-[12px] text-[#6B7280] leading-relaxed">{order.brief}</p>
                              </div>
                            )}

                            {/* Objectives */}
                            {order.objectives && (
                              <div className="bg-white rounded-xl border border-[#E2E8F2] px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1.5">Objectifs</p>
                                <p className="text-[12px] text-[#6B7280] leading-relaxed whitespace-pre-wrap">{order.objectives}</p>
                              </div>
                            )}

                            {/* Livrables / Ressources */}
                            {order.deliverablesUrl ? (
                              <a
                                href={order.deliverablesUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#22C55E]/5 to-[#22C55E]/10 border border-[#22C55E]/20 hover:border-[#22C55E]/40 transition-all group"
                              >
                                <div className="w-9 h-9 rounded-lg bg-[#22C55E]/10 flex items-center justify-center flex-shrink-0">
                                  <FolderOpen className="w-4.5 h-4.5 text-[#22C55E]" strokeWidth={1.75} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-[#2d2d60]">Accéder aux livrables</p>
                                  <p className="text-[11px] text-[#6B7280] truncate">Scripts, vidéos, pages, documents…</p>
                                </div>
                                <ExternalLink className="w-4 h-4 text-[#22C55E] opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                              </a>
                            ) : (
                              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2]">
                                <div className="w-9 h-9 rounded-lg bg-[#E2E8F2] flex items-center justify-center flex-shrink-0">
                                  <FolderOpen className="w-4.5 h-4.5 text-[#9CA3AF]" strokeWidth={1.75} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-medium text-[#9CA3AF]">Livrables en préparation</p>
                                  <p className="text-[11px] text-[#9CA3AF]">Le lien sera disponible une fois les documents prêts</p>
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={e => { e.stopPropagation(); setDetailOrder(order) }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)' }}
                              >
                                <Eye className="w-3.5 h-3.5" /> Voir tous les détails
                              </button>
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
            </motion.div>
          )}

          {/* ── Section: En cours ── */}

          {inProgressOrders.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#6AAEE5]" />
                <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#6AAEE5]">En cours</h2>
                <span className="text-[11px] font-semibold text-[#9CA3AF] ml-1">{inProgressOrders.length}</span>
              </div>
              <div className="rounded-2xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.06)] overflow-hidden">
                <AnimatePresence initial={false}>
                  {inProgressOrders.map((order, i) => {
                    const s        = STATUS_CONFIG[order.status]
                    const p        = PAYMENT_CONFIG[order.paymentStatus]
                    const expanded = expandedId === order.id
                    return (
                      <motion.div key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }} className="border-b border-[#F0F3F8] last:border-0">
                        <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                          onClick={() => setExpandedId(expanded ? null : order.id)}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                            {(() => { const Icon = s.icon; return <Icon className="w-4 h-4" style={{ color: s.text }} strokeWidth={1.75} /> })()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-[#2d2d60] truncate">{order.client}</p>
                            <p className="text-[12px] text-[#6B7280] mt-0.5">{order.clientPhone || order.clientEmail}</p>
                          </div>
                          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex-shrink-0" style={{ background: s.bg, color: s.text }}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', s.pulse && 'animate-pulse')} style={{ background: s.dot }} />{s.label}
                          </span>
                          <ChevronDown className={cn('w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform duration-300', expanded && 'rotate-180')} />
                        </div>
                        <AnimatePresence>
                          {expanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }} className="overflow-hidden">
                              <div className="px-5 pb-5 pt-4 bg-[#F8FAFC] border-t border-[#F0F3F8] space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-[15px] font-bold text-[#2d2d60]">{order.service}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[11px] font-mono text-[#9CA3AF]">{order.ref}</span>
                                      <span className="text-[#E2E8F2]">·</span>
                                      <span className="text-[11px] text-[#9CA3AF]">{formatDate(order.date)}</span>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-[18px] font-bold font-mono text-[#2d2d60]">{formatPrice(order.price)}</p>
                                    <span className="text-[11px] font-medium" style={{ color: p.color }}>{p.label}</span>
                                  </div>
                                </div>
                                <button onClick={e => { e.stopPropagation(); setDetailOrder(order) }}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:opacity-90"
                                  style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)' }}>
                                  <Eye className="w-3.5 h-3.5" /> Voir tous les détails
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── Section: Finalisées ── */}
          {completedOrders.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#22C55E]">Finalisées</h2>
                  <span className="text-[11px] font-semibold text-[#9CA3AF] ml-1">{completedOrders.length}</span>
                </div>
                <button
                  onClick={() => setShowCompleted(v => !v)}
                  className="text-[11px] font-medium text-[#6B7280] hover:text-[#2d2d60] transition-colors flex items-center gap-1"
                >
                  {showCompleted ? 'Masquer' : 'Afficher'}
                  <ChevronDown className={cn('w-3 h-3 transition-transform', showCompleted && 'rotate-180')} />
                </button>
              </div>
              <AnimatePresence>
                {showCompleted && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.06)] overflow-hidden">
                      <AnimatePresence initial={false}>
                        {completedOrders.map((order, i) => {
                          const s = STATUS_CONFIG[order.status]
                          const expanded = expandedId === order.id
                          return (
                            <motion.div key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.2, delay: i * 0.03 }} className="border-b border-[#F0F3F8] last:border-0">
                              <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                                onClick={() => setExpandedId(expanded ? null : order.id)}>
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                                  {(() => { const Icon = s.icon; return <Icon className="w-4 h-4" style={{ color: s.text }} strokeWidth={1.75} /> })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[14px] font-semibold text-[#2d2d60] truncate">{order.client}</p>
                                  <p className="text-[12px] text-[#6B7280] mt-0.5">{order.service} · {formatPrice(order.price)}</p>
                                </div>
                                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex-shrink-0" style={{ background: s.bg, color: s.text }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />{s.label}
                                </span>
                                <ChevronDown className={cn('w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform duration-300', expanded && 'rotate-180')} />
                              </div>
                              <AnimatePresence>
                                {expanded && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }} className="overflow-hidden">
                                    <div className="px-5 pb-5 pt-4 bg-[#F8FAFC] border-t border-[#F0F3F8] space-y-3">
                                      <div className="flex items-start justify-between gap-4">
                                        <div>
                                          <p className="text-[15px] font-bold text-[#2d2d60]">{order.service}</p>
                                          <span className="text-[11px] font-mono text-[#9CA3AF]">{order.ref} · {formatDate(order.date)}</span>
                                        </div>
                                        <p className="text-[18px] font-bold font-mono text-[#2d2d60]">{formatPrice(order.price)}</p>
                                      </div>
                                      {order.deliverablesUrl && (
                                        <a href={order.deliverablesUrl} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#22C55E]/5 to-[#22C55E]/10 border border-[#22C55E]/20 hover:border-[#22C55E]/40 transition-all group">
                                          <FolderOpen className="w-4 h-4 text-[#22C55E]" />
                                          <span className="text-[13px] font-semibold text-[#2d2d60] flex-1">Accéder aux livrables</span>
                                          <ExternalLink className="w-4 h-4 text-[#22C55E] opacity-60 group-hover:opacity-100" />
                                        </a>
                                      )}
                                      <button onClick={e => { e.stopPropagation(); setDetailOrder(order) }}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:opacity-90"
                                        style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)' }}>
                                        <Eye className="w-3.5 h-3.5" /> Voir tous les détails
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      )}

      {/* Modal détail complet */}
      <AnimatePresence>
        {detailOrder && (
          <OrderDetailModal
            order={detailOrder}
            onClose={() => setDetailOrder(null)}
            onSave={(updated) => {
              setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
              setDetailOrder(updated)
            }}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
