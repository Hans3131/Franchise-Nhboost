'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getAll as ticketGetAll, insert as ticketInsert } from '@/lib/ticketStore'
import { getAll as orderGetAll } from '@/lib/orderStore'
import { insert as notifInsert } from '@/lib/notificationStore'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HeadphonesIcon, MessageSquare, Mail, ChevronDown,
  CheckCircle2, Send, Clock, AlertCircle,
  ExternalLink, Phone, ChevronRight, HelpCircle, Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Schema ───────────────────────────────────────────────────
const ticketSchema = z.object({
  orderId:  z.string().min(1, 'Veuillez sélectionner le projet concerné'),
  subject:  z.string().min(5, 'Sujet requis (min. 5 caractères)'),
  message:  z.string().min(20, 'Message requis (min. 20 caractères)'),
  priority: z.enum(['low', 'medium', 'high']),
})
type TicketForm = z.infer<typeof ticketSchema>

// ─── Types ────────────────────────────────────────────────────
interface OrderOption { id: string; label: string }

// ─── Data ─────────────────────────────────────────────────────
const FAQ = [
  {
    q: "Comment passer une commande ?",
    a: "Rendez-vous dans la section « Commander » depuis le menu de gauche. Suivez les 6 étapes : informations client, service, brief, fichiers, paiement et validation. Vous recevrez une confirmation par email.",
  },
  {
    q: "Quels sont les délais de livraison ?",
    a: "Les délais varient selon le service : création de site web (4–6 semaines), logo (1–2 semaines), contenu rédactionnel (5–7 jours ouvrés). Chaque commande inclut une estimation précise.",
  },
  {
    q: "Comment suivre l'avancement de ma commande ?",
    a: "Dans « Mes commandes », chaque ligne affiche le statut en temps réel : En attente → En cours → Terminé. Vous êtes également notifié par email à chaque changement d'étape.",
  },
  {
    q: "Puis-je modifier une commande après validation ?",
    a: "Les modifications sont possibles tant que le statut est « En attente ». Une fois la commande passée « En cours », contactez notre support via ce formulaire ou WhatsApp pour toute demande de modification.",
  },
  {
    q: "Comment fonctionne le paiement ?",
    a: "Le paiement est sécurisé via Stripe. Vous pouvez choisir entre un paiement unique ou un abonnement mensuel. Toutes les transactions sont chiffrées SSL et conformes PCI DSS.",
  },
  {
    q: "Que se passe-t-il si je ne suis pas satisfait ?",
    a: "NHBoost garantit 2 révisions gratuites sur chaque livrable. Au-delà, un devis complémentaire sera établi. En cas de litige, notre équipe support intervient sous 24h ouvrées.",
  },
  {
    q: "Comment accéder aux ressources et templates ?",
    a: "La section « Ressources » centralise tous vos fichiers : kits de communication, guides pratiques, templates. Les fichiers sont organisés par catégorie et téléchargeables en un clic.",
  },
]

type TicketRow = { id: string; subject: string; status: 'open' | 'in_progress' | 'resolved'; date: string; priority: 'low' | 'medium' | 'high' }

const TICKET_STATUS = {
  open:        { label: 'Ouvert',   bg: 'rgba(106,174,229,0.12)', text: '#6AAEE5',  dot: '#6AAEE5' },
  in_progress: { label: 'En cours', bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B',  dot: '#F59E0B' },
  resolved:    { label: 'Résolu',   bg: 'rgba(34,197,94,0.12)',   text: '#22C55E',  dot: '#22C55E' },
}

const PRIORITY_CONFIG = {
  low:    { label: 'Faible',   color: '#8B95C4' },
  medium: { label: 'Moyen',   color: '#F59E0B' },
  high:   { label: 'Urgent',  color: '#EF4444' },
}

const SUPPORT_EMAIL    = process.env.NEXT_PUBLIC_SUPPORT_EMAIL    ?? 'support@nhboost.com'
const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '+33600000000'

// ─── Component ────────────────────────────────────────────────
export default function SupportPage() {
  const [openFaq, setOpenFaq]       = useState<number | null>(null)
  const [submitted, setSubmitted]   = useState(false)
  const [tickets, setTickets]       = useState<TicketRow[]>([])
  const [orders, setOrders]         = useState<OrderOption[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    // ── Tickets : affichage immédiat localStorage ──────────────
    const mapTicket = (r: { ref?: string; id?: string; subject: string; status: string; priority: string; created_at: string }) => ({
      id:       r.ref ?? String(r.id),
      subject:  r.subject,
      status:   r.status as TicketRow['status'],
      priority: r.priority as TicketRow['priority'],
      date:     new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
    })
    setTickets(ticketGetAll().slice(0, 10).map(mapTicket))

    // ── Commandes : affichage immédiat localStorage ────────────
    const mapOrder = (o: Record<string, unknown>): OrderOption => {
      const company = String(o.company_name ?? o.companyName ?? '')
      const client  = String(o.client_name  ?? o.client      ?? '')
      const service = String(o.service ?? '')
      const name    = company || client || 'Client'
      return { id: String(o.id), label: `${name} — ${service}` }
    }
    const localOrders = orderGetAll().map(o => mapOrder(o as unknown as Record<string, unknown>))
    setOrders(localOrders)
    setOrdersLoading(false)

    // ── Supabase ───────────────────────────────────────────────
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      // Tickets
      supabase.from('support_tickets').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(10)
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setTickets(data.map(r => mapTicket({
              ref: r.ref, id: r.id, subject: r.subject,
              status: r.status, priority: r.priority, created_at: r.created_at,
            })))
          }
        })

      // Commandes
      supabase.from('orders')
        .select('id, service, company_name, client_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) {
            setOrders(data.map(o => mapOrder(o as Record<string, unknown>)))
          }
          setOrdersLoading(false)
        })
    })
  }, [])

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { priority: 'medium', orderId: '' },
  })

  const onSubmit = handleSubmit(async (data) => {
    // 1. Sauvegarde localStorage
    const newTicket = ticketInsert({
      subject:  data.subject,
      message:  data.message,
      priority: data.priority,
      status:   'open',
    })

    // 2. Notification locale
    notifInsert({
      type:    'ticket_created',
      title:   `Ticket ${newTicket.ref} créé`,
      message: data.subject,
      link:    '/support',
    })

    // 3. Sauvegarde Supabase + envoi email
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('support_tickets').insert({
          user_id:  user.id,
          order_id: data.orderId || null,
          subject:  data.subject,
          message:  data.message,
          priority: data.priority,
          status:   'open',
        })
      }
      await fetch('/api/send-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref:         newTicket.ref,
          subject:     data.subject,
          message:     data.message,
          priority:    data.priority,
          orderId:     data.orderId,
          orderLabel:  orders.find(o => o.id === data.orderId)?.label ?? '',
          senderEmail: user?.email ?? '',
        }),
      })
    } catch (_) { /* best-effort */ }

    // 4. Refresh liste depuis localStorage
    const stored = ticketGetAll().slice(0, 10)
    setTickets(stored.map(r => ({
      id:       r.ref,
      subject:  r.subject,
      status:   r.status,
      priority: r.priority,
      date:     new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
    })))

    setSubmitted(true)
    reset()
    setTimeout(() => setSubmitted(false), 5000)
  })

  const inputCls = (hasError?: boolean) => cn(
    'w-full bg-[#1D2240] border rounded-xl px-4 py-3 text-[14px] text-[#F0F2FF]',
    'placeholder:text-[#4A5180] outline-none transition-all duration-200',
    'focus:ring-2 focus:ring-[rgba(106,174,229,0.15)] hover:border-[rgba(107,174,229,0.25)]',
    hasError
      ? 'border-red-500/50 focus:border-red-500'
      : 'border-[rgba(107,174,229,0.15)] focus:border-[#6AAEE5]'
  )

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#4A5180] mb-1">Aide & Contact</p>
        <h1 className="text-2xl md:text-3xl font-bold text-[#F0F2FF] tracking-tight">Support</h1>
        <p className="text-sm text-[#8B95C4] mt-1">Notre équipe vous répond sous 24h ouvrées.</p>
      </motion.div>

      {/* Contact cards */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {/* WhatsApp */}
        <a
          href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 p-5 rounded-2xl border border-[rgba(107,174,229,0.12)] bg-[#161A34] hover:border-[rgba(37,211,102,0.4)] hover:bg-[rgba(37,211,102,0.05)] transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-xl bg-[rgba(37,211,102,0.12)] flex items-center justify-center flex-shrink-0 group-hover:bg-[rgba(37,211,102,0.2)] transition-colors">
            <Phone className="w-5 h-5 text-[#25D366]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#F0F2FF]">WhatsApp</p>
            <p className="text-[11px] text-[#4A5180] mt-0.5">Réponse rapide</p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-[#4A5180] group-hover:text-[#25D366] ml-auto flex-shrink-0 transition-colors" />
        </a>

        {/* Email */}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="group flex items-center gap-4 p-5 rounded-2xl border border-[rgba(107,174,229,0.12)] bg-[#161A34] hover:border-[rgba(106,174,229,0.35)] hover:bg-[rgba(106,174,229,0.05)] transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-xl bg-[rgba(106,174,229,0.1)] flex items-center justify-center flex-shrink-0 group-hover:bg-[rgba(106,174,229,0.18)] transition-colors">
            <Mail className="w-5 h-5 text-[#6AAEE5]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#F0F2FF]">Email</p>
            <p className="text-[11px] text-[#4A5180] mt-0.5 truncate">{SUPPORT_EMAIL}</p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-[#4A5180] group-hover:text-[#6AAEE5] ml-auto flex-shrink-0 transition-colors" />
        </a>

        {/* Temps de réponse */}
        <div className="flex items-center gap-4 p-5 rounded-2xl border border-[rgba(107,174,229,0.12)] bg-[#161A34]">
          <div className="w-10 h-10 rounded-xl bg-[rgba(139,92,246,0.1)] flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-[#8B5CF6]" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#F0F2FF]">Délai de réponse</p>
            <p className="text-[11px] text-[#4A5180] mt-0.5">Sous 24h ouvrées</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left: New ticket + existing tickets ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* New ticket form */}
          <motion.div
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className="rounded-2xl bg-[#161A34] border border-[rgba(107,174,229,0.12)] overflow-hidden"
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[rgba(107,174,229,0.08)] bg-[#1D2240]/30">
              <div className="w-8 h-8 rounded-lg bg-[rgba(106,174,229,0.12)] flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[#6AAEE5]" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-[#F0F2FF]">Créer un ticket</h2>
                <p className="text-[11px] text-[#4A5180]">Décrivez votre problème en détail</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="p-6 space-y-4">

              {/* Projet concerné */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#8B95C4] flex items-center gap-1.5">
                  <Briefcase className="w-3 h-3" />
                  Projet concerné *
                </label>

                {ordersLoading ? (
                  // Skeleton
                  <div className="w-full h-11 rounded-xl bg-[#1D2240] border border-[rgba(107,174,229,0.15)] animate-pulse" />
                ) : orders.length === 0 ? (
                  // Empty state
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1D2240] border border-[rgba(107,174,229,0.15)]">
                    <Briefcase className="w-4 h-4 text-[#4A5180] flex-shrink-0" />
                    <p className="text-[13px] text-[#4A5180]">Aucun projet disponible pour créer un ticket</p>
                  </div>
                ) : (
                  // Select
                  <div className="relative">
                    <select
                      {...register('orderId')}
                      className={cn(
                        inputCls(!!errors.orderId),
                        'appearance-none pr-10 cursor-pointer',
                        // Couleur du placeholder quand valeur vide
                        !watch('orderId') && 'text-[#4A5180]',
                      )}
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="" disabled>Sélectionner le projet concerné</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id} className="text-[#F0F2FF] bg-[#1D2240]">
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5180] pointer-events-none" />
                  </div>
                )}

                {errors.orderId && (
                  <p className="text-[11px] text-red-400">{errors.orderId.message}</p>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#8B95C4]">Sujet *</label>
                <input
                  {...register('subject')}
                  className={inputCls(!!errors.subject)}
                  placeholder="Ex : Problème avec ma commande CMD-2026-0042"
                />
                {errors.subject && <p className="text-[11px] text-red-400">{errors.subject.message}</p>}
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#8B95C4]">Priorité</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map(p => {
                    const cfg = PRIORITY_CONFIG[p]
                    const selected = watch('priority') === p
                    return (
                      <label key={p} className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[12px] font-semibold cursor-pointer transition-all',
                        selected
                          ? 'border-current bg-current/10'
                          : 'border-[rgba(107,174,229,0.12)] text-[#4A5180] bg-[#1D2240] hover:text-[#8B95C4]'
                      )} style={{ color: selected ? cfg.color : undefined }}>
                        <input type="radio" {...register('priority')} value={p} className="sr-only" />
                        {cfg.label}
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#8B95C4]">Message *</label>
                <textarea
                  {...register('message')}
                  rows={5}
                  className={cn(inputCls(!!errors.message), 'resize-none leading-relaxed')}
                  placeholder="Décrivez votre problème, question ou demande en détail..."
                />
                <div className="flex items-center justify-between">
                  {errors.message
                    ? <p className="text-[11px] text-red-400">{errors.message.message}</p>
                    : <span />}
                  <p className="text-[11px] text-[#4A5180] text-right">{watch('message')?.length ?? 0} caractères</p>
                </div>
              </div>

              {/* Submit */}
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)]"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                    <p className="text-[13px] font-medium text-[#22C55E]">Ticket envoyé ! Nous vous répondons sous 24h.</p>
                  </motion.div>
                ) : (
                  <motion.button
                    key="btn"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold text-white transition-all duration-200 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)', boxShadow: '0 0 24px rgba(106,174,229,0.2)' }}
                  >
                    {isSubmitting
                      ? <span className="flex gap-1">{[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}</span>
                      : <><Send className="w-4 h-4" /> Envoyer le ticket</>
                    }
                  </motion.button>
                )}
              </AnimatePresence>
            </form>
          </motion.div>

          {/* Existing tickets */}
          <motion.div
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl bg-[#161A34] border border-[rgba(107,174,229,0.12)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(107,174,229,0.08)]">
              <h2 className="text-[13px] font-bold text-[#F0F2FF]">Mes tickets</h2>
              <span className="text-[11px] text-[#4A5180]">{tickets.length} ticket{tickets.length > 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-[rgba(107,174,229,0.06)]">
              {tickets.map(ticket => {
                const s = TICKET_STATUS[ticket.status]
                const p = PRIORITY_CONFIG[ticket.priority]
                return (
                  <div key={ticket.id} className="flex items-center gap-3 px-6 py-4 hover:bg-[rgba(107,174,229,0.03)] transition-colors group cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-[#F0F2FF] truncate group-hover:text-white transition-colors">
                          {ticket.subject}
                        </p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ color: p.color, background: `${p.color}15`, border: `1px solid ${p.color}30` }}>
                          {p.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#4A5180] mt-1 font-mono">{ticket.id} · {ticket.date}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium flex-shrink-0"
                      style={{ background: s.bg, color: s.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                      {s.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#4A5180] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>

        {/* ── Right: FAQ ── */}
        <motion.div
          initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <div className="rounded-2xl bg-[#161A34] border border-[rgba(107,174,229,0.12)] overflow-hidden sticky top-20">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[rgba(107,174,229,0.08)]">
              <div className="w-8 h-8 rounded-lg bg-[rgba(139,92,246,0.12)] flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-[#8B5CF6]" strokeWidth={1.75} />
              </div>
              <h2 className="text-[14px] font-bold text-[#F0F2FF]">Questions fréquentes</h2>
            </div>

            <div className="divide-y divide-[rgba(107,174,229,0.06)] max-h-[600px] overflow-y-auto">
              {FAQ.map((item, i) => (
                <div key={i}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-[rgba(107,174,229,0.03)] transition-colors group"
                  >
                    <span className="flex-1 text-[13px] font-semibold text-[#8B95C4] group-hover:text-[#F0F2FF] transition-colors leading-snug">
                      {item.q}
                    </span>
                    <ChevronDown className={cn(
                      'w-4 h-4 text-[#4A5180] flex-shrink-0 mt-0.5 transition-transform duration-200',
                      openFaq === i && 'rotate-180 text-[#6AAEE5]'
                    )} />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-4 text-[13px] text-[#8B95C4] leading-relaxed border-t border-[rgba(107,174,229,0.06)] pt-3">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Still stuck */}
            <div className="px-5 py-4 border-t border-[rgba(107,174,229,0.08)] bg-[#1D2240]/30">
              <div className="flex items-center gap-2 text-[12px] text-[#4A5180]">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-[#6AAEE5]" />
                Pas de réponse ? Utilisez le formulaire ou WhatsApp.
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
