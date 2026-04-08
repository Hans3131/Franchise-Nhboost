'use client'

import { useState, useEffect, useMemo } from 'react'
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
  MessageCircle, Calendar, BookOpen, Bot, Search,
  ShoppingCart, CreditCard, FolderOpen, Settings,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

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
const SUPPORT_EMAIL    = process.env.NEXT_PUBLIC_SUPPORT_EMAIL    ?? 'support@nhboost.com'
const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '+33600000000'

const CONTACT_LINKS = [
  { label: 'WhatsApp — Réponse rapide', subtitle: 'Discutez avec notre équipe en direct', href: `https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, '')}`, color: '#25D366', icon: MessageCircle, external: true },
  { label: 'Email Support', subtitle: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}`, color: '#6AAEE5', icon: Mail, external: true },
  { label: 'Prendre un rendez-vous', subtitle: 'Planifiez un appel avec un expert', href: '#', color: '#8B5CF6', icon: Calendar, external: false },
  { label: 'Centre de ressources', subtitle: 'Guides, templates et tutoriels', href: '/ressources', color: '#F59E0B', icon: BookOpen, external: false },
  { label: 'Secrétaire IA', subtitle: 'Assistant intelligent 24/7', href: '/secretaire', color: '#2d2d60', icon: Bot, external: false },
]

const FAQ_CATEGORIES = [
  {
    category: 'Commandes & Services',
    icon: ShoppingCart,
    color: '#6AAEE5',
    items: [
      { q: "Comment passer une commande ?", a: "Rendez-vous dans « Commander » depuis le menu. Suivez les 6 étapes : informations client, service, brief, fichiers, paiement et validation. Vous recevrez une confirmation par email." },
      { q: "Quels services proposez-vous ?", a: "Nous proposons 5 services : Site One Page (300€), Site Complet (800€), Offre Visibilité (390€/mois), Système d'Acquisition (490€), et Accompagnement Business Premium (2500€)." },
      { q: "Quels sont les délais de livraison ?", a: "Site One Page : 1-2 semaines. Site Complet : 3-4 semaines. Offre Visibilité : mise en place sous 1 semaine, résultats progressifs. Système d'Acquisition : 2-3 semaines. Accompagnement Premium : programme sur mesure." },
      { q: "Puis-je modifier une commande après validation ?", a: "Les modifications sont possibles tant que le statut est « En attente ». Une fois « En cours », contactez notre support via WhatsApp ou ce formulaire." },
      { q: "Comment suivre l'avancement de ma commande ?", a: "Dans « Mes commandes », chaque commande affiche un stepper d'avancement en temps réel adapté au type de service (site web ou campagne). Vous êtes notifié à chaque changement d'étape." },
      { q: "Que comprend le service Site Complet ?", a: "Design personnalisé multipages, optimisation SEO de base, intégration WhatsApp et formulaire de contact, responsive mobile, et mise en ligne complète." },
      { q: "Que comprend l'Offre Visibilité ?", a: "Création de contenus, gestion de votre visibilité digitale, vidéos adaptées aux réseaux sociaux, et optimisation de votre présence locale. Engagement minimum de 6 mois." },
    ],
  },
  {
    category: 'Paiement & Facturation',
    icon: CreditCard,
    color: '#22C55E',
    items: [
      { q: "Comment fonctionne le paiement ?", a: "Le paiement est sécurisé via Stripe. Vous pouvez choisir entre un paiement unique ou un abonnement mensuel selon le service. Toutes les transactions sont chiffrées SSL." },
      { q: "Puis-je payer en plusieurs fois ?", a: "Oui, certains services proposent un paiement échelonné en 3 fois sans frais. Contactez-nous pour en discuter." },
      { q: "Comment obtenir une facture ?", a: "Utilisez le Secrétaire IA dans le menu pour générer automatiquement vos devis et factures PDF. Vous pouvez aussi nous contacter directement." },
      { q: "Quels moyens de paiement acceptez-vous ?", a: "Carte bancaire (Visa, Mastercard, Amex), virement bancaire, et prélèvement SEPA pour les abonnements." },
      { q: "Comment résilier un abonnement ?", a: "Vous pouvez résilier à tout moment en contactant notre support. La résiliation prend effet à la fin de la période en cours." },
    ],
  },
  {
    category: 'Livrables & Résultats',
    icon: FolderOpen,
    color: '#8B5CF6',
    items: [
      { q: "Où trouver mes livrables ?", a: "Dans « Mes commandes », ouvrez le ticket concerné. Si vos livrables sont prêts, un bouton vert « Accéder aux livrables » vous redirige vers votre dossier partagé (Drive, vidéos, documents)." },
      { q: "Combien de révisions sont incluses ?", a: "Chaque livrable inclut 2 révisions gratuites. Au-delà, un devis complémentaire sera établi selon les modifications demandées." },
      { q: "Comment donner mon feedback sur un livrable ?", a: "Ouvrez le ticket de la commande concernée et utilisez le formulaire ci-dessous pour envoyer vos retours détaillés. Soyez le plus précis possible." },
      { q: "Quand vais-je voir les premiers résultats ?", a: "Pour les campagnes : premières données sous 7-14 jours. Pour le SEO : résultats visibles en 2-3 mois. Pour les sites : en ligne dès la livraison." },
      { q: "Les livrables m'appartiennent-ils ?", a: "Oui, une fois le paiement complet effectué, tous les livrables (visuels, code source, contenus) vous appartiennent intégralement." },
    ],
  },
  {
    category: 'Compte & Portail',
    icon: Settings,
    color: '#F59E0B',
    items: [
      { q: "Comment modifier mes informations ?", a: "Rendez-vous dans « Paramètres » depuis le menu. Vous pouvez y modifier le nom de votre entreprise, téléphone, adresse et mot de passe." },
      { q: "J'ai oublié mon mot de passe", a: "Sur la page de connexion, cliquez sur « Mot de passe oublié ? ». Un lien de réinitialisation sera envoyé à votre email. Le lien expire après 15 minutes." },
      { q: "Comment accéder aux ressources et templates ?", a: "La section « Ressources » centralise tous vos fichiers : kits de communication, guides pratiques, templates Canva. Organisés par catégorie et téléchargeables." },
      { q: "Le portail est-il accessible sur mobile ?", a: "Oui, le portail est entièrement responsive. Vous pouvez commander, suivre vos commandes et contacter le support depuis votre smartphone." },
      { q: "Que faire si je rencontre un bug ?", a: "Décrivez le problème via le formulaire de ticket ci-dessous avec une capture d'écran si possible. Notre équipe technique interviendra rapidement." },
    ],
  },
]

type TicketRow = { id: string; subject: string; status: 'open' | 'in_progress' | 'resolved'; date: string; priority: 'low' | 'medium' | 'high' }

const TICKET_STATUS = {
  open:        { label: 'Ouvert',   bg: 'rgba(106,174,229,0.12)', text: '#6AAEE5',  dot: '#6AAEE5' },
  in_progress: { label: 'En cours', bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B',  dot: '#F59E0B' },
  resolved:    { label: 'Résolu',   bg: 'rgba(34,197,94,0.12)',   text: '#22C55E',  dot: '#22C55E' },
}

const PRIORITY_CONFIG = {
  low:    { label: 'Faible',   color: '#6B7280' },
  medium: { label: 'Moyen',   color: '#F59E0B' },
  high:   { label: 'Urgent',  color: '#EF4444' },
}

// ─── Component ────────────────────────────────────────────────
export default function SupportPage() {
  const [openFaq, setOpenFaq]             = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState(0)
  const [faqSearch, setFaqSearch]           = useState('')
  const [submitted, setSubmitted]           = useState(false)
  const [tickets, setTickets]               = useState<TicketRow[]>([])
  const [orders, setOrders]                 = useState<OrderOption[]>([])
  const [ordersLoading, setOrdersLoading]   = useState(true)

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
    let user: { email?: string | null } | null = null
    try {
      const supabase = createClient()
      const { data: { user: u } } = await supabase.auth.getUser()
      user = u
      if (u) {
        await supabase.from('support_tickets').insert({
          user_id:  u.id,
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

  // FAQ filtering
  const filteredFaqItems = useMemo(() => {
    const query = faqSearch.toLowerCase().trim()
    if (!query) return FAQ_CATEGORIES[activeCategory].items
    // Search across all categories
    const all: { q: string; a: string }[] = []
    FAQ_CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        if (item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query)) {
          all.push(item)
        }
      })
    })
    return all
  }, [faqSearch, activeCategory])

  const inputCls = (hasError?: boolean) => cn(
    'w-full bg-[#F5F7FA] border rounded-xl px-4 py-3 text-[14px] text-[#2d2d60]',
    'placeholder:text-[#9CA3AF] outline-none transition-all duration-200',
    'focus:ring-2 focus:ring-[rgba(106,174,229,0.15)] hover:border-[rgba(106,174,229,0.35)]',
    hasError
      ? 'border-red-500/50 focus:border-red-500'
      : 'border-[#E2E8F2] focus:border-[#6AAEE5]'
  )

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">Aide & Contact</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Support</h1>
        <p className="text-sm text-[#6B7280] mt-1">Notre équipe vous répond sous 24h ouvrées.</p>
      </motion.div>

      {/* ── Contact Links (Linktree style) ── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        {CONTACT_LINKS.map((link, i) => {
          const Icon = link.icon
          const inner = (
            <div className="group flex items-center gap-4 w-full p-4 rounded-2xl bg-white border border-[#E2E8F2] hover:shadow-md hover:scale-[1.01] transition-all duration-200"
              style={{ borderLeftWidth: 4, borderLeftColor: link.color }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${link.color}15` }}
              >
                <Icon className="w-5 h-5" style={{ color: link.color }} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#2d2d60]">{link.label}</p>
                <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">{link.subtitle}</p>
              </div>
              {link.external
                ? <ExternalLink className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280] flex-shrink-0 transition-colors" />
                : <ArrowRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#6B7280] flex-shrink-0 transition-colors" />
              }
            </div>
          )

          if (link.external) {
            return (
              <a key={i} href={link.href} target="_blank" rel="noopener noreferrer">
                {inner}
              </a>
            )
          }
          return (
            <Link key={i} href={link.href}>
              {inner}
            </Link>
          )
        })}
      </motion.div>

      {/* ── FAQ Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-2xl bg-white border border-[#E2E8F2] overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E2E8F2]">
          <div className="w-8 h-8 rounded-lg bg-[rgba(139,92,246,0.12)] flex items-center justify-center">
            <HelpCircle className="w-4 h-4 text-[#8B5CF6]" strokeWidth={1.75} />
          </div>
          <h2 className="text-[14px] font-bold text-[#2d2d60]">Questions fréquentes</h2>
        </div>

        {/* Search bar */}
        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={faqSearch}
              onChange={e => { setFaqSearch(e.target.value); setOpenFaq(null) }}
              placeholder="Rechercher dans la FAQ..."
              className="w-full bg-[#F5F7FA] border border-[#E2E8F2] rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-[#2d2d60] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[rgba(106,174,229,0.15)] focus:border-[#6AAEE5] transition-all"
            />
          </div>
        </div>

        {/* Category tabs */}
        {!faqSearch && (
          <div className="px-6 pt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {FAQ_CATEGORIES.map((cat, i) => {
              const CatIcon = cat.icon
              const isActive = activeCategory === i
              return (
                <button
                  key={cat.category}
                  onClick={() => { setActiveCategory(i); setOpenFaq(null) }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all duration-200 border',
                    isActive
                      ? 'text-white border-transparent'
                      : 'text-[#6B7280] border-[#E2E8F2] bg-[#F8FAFC] hover:bg-[#F5F7FA]'
                  )}
                  style={isActive ? { background: cat.color, borderColor: cat.color } : undefined}
                >
                  <CatIcon className="w-3.5 h-3.5" />
                  {cat.category}
                </button>
              )
            })}
          </div>
        )}

        {/* FAQ items */}
        <div className="divide-y divide-[#E2E8F2] mt-3">
          {filteredFaqItems.length === 0 && (
            <div className="px-6 py-8 text-center">
              <p className="text-[13px] text-[#9CA3AF]">Aucun résultat pour cette recherche.</p>
            </div>
          )}
          {filteredFaqItems.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-start gap-3 px-6 py-4 text-left hover:bg-[#F8FAFC] transition-colors group"
              >
                <span className="flex-1 text-[13px] font-semibold text-[#6B7280] group-hover:text-[#2d2d60] transition-colors leading-snug">
                  {item.q}
                </span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-[#9CA3AF] flex-shrink-0 mt-0.5 transition-transform duration-200',
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
                    <p className="px-6 pb-4 text-[13px] text-[#6B7280] leading-relaxed border-t border-[#E2E8F2] pt-3">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Still stuck */}
        <div className="px-6 py-4 border-t border-[#E2E8F2] bg-[#F8FAFC]">
          <div className="flex items-center gap-2 text-[12px] text-[#9CA3AF]">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-[#6AAEE5]" />
            Pas de réponse ? Utilisez le formulaire ou WhatsApp.
          </div>
        </div>
      </motion.div>

      {/* ── New ticket form ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl bg-white border border-[#E2E8F2] overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E2E8F2] bg-[#F8FAFC]">
          <div className="w-8 h-8 rounded-lg bg-[rgba(106,174,229,0.12)] flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-[#6AAEE5]" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-[#2d2d60]">Créer un ticket</h2>
            <p className="text-[11px] text-[#9CA3AF]">Décrivez votre problème en détail</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">

          {/* Projet concerné */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] flex items-center gap-1.5">
              <Briefcase className="w-3 h-3" />
              Projet concerné *
            </label>

            {ordersLoading ? (
              <div className="w-full h-11 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] animate-pulse" />
            ) : orders.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2]">
                <Briefcase className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                <p className="text-[13px] text-[#9CA3AF]">Aucun projet disponible pour créer un ticket</p>
              </div>
            ) : (
              <div className="relative">
                <select
                  {...register('orderId')}
                  className={cn(
                    inputCls(!!errors.orderId),
                    'appearance-none pr-10 cursor-pointer',
                    !watch('orderId') && 'text-[#9CA3AF]',
                  )}
                >
                  <option value="" disabled>Sélectionner le projet concerné</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id} className="text-[#2d2d60] bg-white">
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
              </div>
            )}

            {errors.orderId && (
              <p className="text-[11px] text-red-400">{errors.orderId.message}</p>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">Sujet *</label>
            <input
              {...register('subject')}
              className={inputCls(!!errors.subject)}
              placeholder="Ex : Problème avec ma commande CMD-2026-0042"
            />
            {errors.subject && <p className="text-[11px] text-red-400">{errors.subject.message}</p>}
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">Priorité</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map(p => {
                const cfg = PRIORITY_CONFIG[p]
                const selected = watch('priority') === p
                return (
                  <label key={p} className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[12px] font-semibold cursor-pointer transition-all',
                    selected
                      ? 'border-current bg-current/10'
                      : 'border-[#E2E8F2] text-[#9CA3AF] bg-[#F8FAFC] hover:bg-[#F5F7FA] hover:text-[#6B7280]'
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
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">Message *</label>
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
              <p className="text-[11px] text-[#9CA3AF] text-right">{watch('message')?.length ?? 0} caractères</p>
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

      {/* ── Existing tickets ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="rounded-2xl bg-white border border-[#E2E8F2] overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F2]">
          <h2 className="text-[13px] font-bold text-[#2d2d60]">Mes tickets</h2>
          <span className="text-[11px] text-[#9CA3AF]">{tickets.length} ticket{tickets.length > 1 ? 's' : ''}</span>
        </div>
        <div className="divide-y divide-[#E2E8F2]">
          {tickets.length === 0 && (
            <div className="px-6 py-8 text-center">
              <p className="text-[13px] text-[#9CA3AF]">Aucun ticket pour le moment.</p>
            </div>
          )}
          {tickets.map(ticket => {
            const s = TICKET_STATUS[ticket.status]
            const p = PRIORITY_CONFIG[ticket.priority]
            return (
              <div key={ticket.id} className="flex items-center gap-3 px-6 py-4 hover:bg-[#F8FAFC] transition-colors group cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-[#2d2d60] truncate group-hover:text-[#1a1a4a] transition-colors">
                      {ticket.subject}
                    </p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ color: p.color, background: `${p.color}15`, border: `1px solid ${p.color}30` }}>
                      {p.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-1 font-mono">{ticket.id} · {ticket.date}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium flex-shrink-0"
                  style={{ background: s.bg, color: s.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </span>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
