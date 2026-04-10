'use client'

import { useState, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Briefcase, FileText,
  Upload, CreditCard, CheckCircle2, ChevronRight,
  ChevronLeft, Globe, Share2, X, Check, Zap, Loader2,
  Building2, Mail, Phone, Target, Key, Hash, AtSign, Users, Play,
  MessageSquare, Euro,
} from 'lucide-react'
import { insert as storeInsert } from '@/lib/orderStore'
import { insert as notifInsert } from '@/lib/notificationStore'
import { cn, formatPrice } from '@/lib/utils'
import {
  ServiceLinesEditor,
  buildLineFromService,
  computeTotals,
  validateLines,
  type ServiceLine,
} from '@/components/orders/ServiceLinesEditor'

// ─── Types ────────────────────────────────────────────────────
type PaymentMode = 'one-shot' | 'subscription'

interface Service {
  id: string; name: string; description: string
  internalCost: number       // coût interne NHBoost
  salePrice: number          // prix de vente franchisé
  type: PaymentMode
  monthlyPrice?: number      // prix mensuel si abonnement
  commitmentMonths?: number  // durée engagement minimum
  icon: React.ElementType; iconColor: string; popular?: boolean
  engagement?: string
}

interface FormData {
  // Infos client
  clientName:     string
  clientEmail:    string
  clientPhone:    string
  whatsappGroup:  string
  // Infos entreprise
  companyName:    string
  companyEmail:   string
  sector:         string
  // Présence en ligne
  vatNumber:      string
  website:        string
  instagram:      string
  facebook:       string
  tiktok:         string
  // Service
  serviceId:      string
  // Projet
  brief:          string
  objectives:     string
  specificRequest: string
  requiredAccess: string
  domainName:     string
  conversionType: string
  horizon:        string
  // Fichiers & paiement
  files:          File[]
  paymentMode:    PaymentMode
}

// ─── Constants ────────────────────────────────────────────────
const SERVICES: Service[] = [
  { id: 'site-onepage', name: 'Site One Page', description: 'Page unique optimisée, design professionnel responsive, formulaire de contact, mise en ligne, SEO Friendly', internalCost: 300, salePrice: 970, type: 'one-shot', icon: Globe, iconColor: '#6AAEE5' },
  { id: 'site-complet', name: 'Site Complet', description: 'Site multipages, design personnalisé, optimisation SEO de base, intégration WhatsApp/formulaire, responsive mobile', internalCost: 800, salePrice: 1470, type: 'one-shot', icon: Globe, iconColor: '#4A7DC4', popular: true },
  { id: 'visibilite', name: 'Offre Visibilité', description: 'Création de contenus, gestion de visibilité digitale, vidéos réseaux sociaux, optimisation présence locale', internalCost: 390, salePrice: 870, type: 'subscription', monthlyPrice: 870, commitmentMonths: 6, icon: Share2, iconColor: '#F59E0B', engagement: '6 mois' },
  { id: 'acquisition', name: "Système d'Acquisition Simple", description: 'Tunnel simple, page de conversion, système de collecte de leads, structuration de l\'offre', internalCost: 490, salePrice: 970, type: 'subscription', monthlyPrice: 970, commitmentMonths: 3, icon: Target, iconColor: '#22C55E', engagement: '3 mois' },
  { id: 'accompagnement', name: 'Accompagnement Business Premium', description: 'Positionnement stratégique, structuration offre, création contenu, système acquisition, optimisation commerciale', internalCost: 2500, salePrice: 4970, type: 'one-shot', icon: Briefcase, iconColor: '#8B5CF6' },
]

const STEPS = [
  { id: 1, label: 'Client',   icon: User },
  { id: 2, label: 'Service',  icon: Briefcase },
  { id: 3, label: 'Brief',    icon: FileText },
  { id: 4, label: 'Fichiers', icon: Upload },
  { id: 5, label: 'Paiement', icon: CreditCard },
  { id: 6, label: 'Résumé',   icon: CheckCircle2 },
]

const SECTORS = [
  'Restauration / Hôtellerie', 'Commerce / Retail', 'Santé / Bien-être',
  'Immobilier', 'Artisanat / BTP', 'Services aux entreprises',
  'Éducation / Formation', 'Sport / Loisirs', 'Mode / Beauté',
  'Technologie / Digital', 'Association / ONG', 'Autre',
]

// ─── Schemas ──────────────────────────────────────────────────
const step1Schema = z.object({
  clientName:   z.string().min(2, 'Nom client requis (min. 2 caractères)'),
  clientEmail:  z.string().email('Email client invalide'),
  clientPhone:  z.string().optional().or(z.literal('')),
  whatsappGroup: z.string().optional().or(z.literal('')),
  companyName:  z.string().min(2, 'Nom entreprise requis (min. 2 caractères)'),
  companyEmail: z.string().email('Email entreprise invalide').optional().or(z.literal('')),
  sector:       z.string().optional(),
  // Présence en ligne — tous facultatifs
  vatNumber:    z.string().optional().or(z.literal('')),
  website:      z.string().url('URL invalide (ex: https://mon-site.com)').optional().or(z.literal('')),
  instagram:    z.string().optional().or(z.literal('')),
  facebook:     z.string().optional().or(z.literal('')),
  tiktok:       z.string().optional().or(z.literal('')),
})

const step3Schema = z.object({
  brief:          z.string().min(20, 'Description requise (min. 20 caractères)'),
  objectives:     z.string().optional(),
  specificRequest: z.string().optional(),
  requiredAccess: z.string().optional(),
  domainName:     z.string().optional().or(z.literal('')),
})

// ─── Sub-components ───────────────────────────────────────────
function StepIndicator({ step, current }: { step: typeof STEPS[0]; current: number }) {
  const done   = step.id < current
  const active = step.id === current
  const Icon   = step.icon
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn(
        'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 flex-shrink-0',
        done   ? 'bg-[#2d2d60]/15 border-[#2d2d60]' :
        active ? 'bg-white border-white shadow-[0_2px_8px_rgba(45,45,96,0.25)]' :
                 'bg-white/40 border-[#2d2d60]/30'
      )}>
        {done
          ? <Check className="w-3.5 h-3.5 text-[#2d2d60]" strokeWidth={2.5} />
          : <Icon className={cn('w-3.5 h-3.5', active ? 'text-[#2d2d60]' : 'text-[#2d2d60]/50')} strokeWidth={1.75} />}
      </div>
      <span className={cn(
        'text-sm font-medium hidden md:block transition-colors',
        done ? 'text-[#2d2d60] font-semibold' : active ? 'text-[#2d2d60] font-semibold' : 'text-[#2d2d60]/50'
      )}>
        {step.label}
      </span>
    </div>
  )
}

function FieldWrapper({ label, error, required, children, info }: { label: string; error?: string; required?: boolean; children: React.ReactNode; info?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-semibold text-[#4a81a4] uppercase tracking-widest">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {info && <p className="text-[11px] text-[#6B7280]">{info}</p>}
      {children}
      {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
    </div>
  )
}

const inputBase = cn(
  'w-full bg-[#F5F7FA] border border-[#E2E8F2] rounded-xl px-4 py-3',
  'text-[14px] text-[#2d2d60] placeholder:text-[#9CA3AF]',
  'outline-none transition-all duration-200',
  'focus:border-[#6AAEE5] focus:ring-2 focus:ring-[#6AAEE5]/20 focus:bg-white',
  'hover:border-[#6AAEE5]/50 hover:bg-white'
)
const inputErr = 'border-red-500/50 focus:border-red-500'
const inputCls = (err?: boolean) => cn(inputBase, err && inputErr)

function InputWithIcon({ icon: Icon, iconColor = '#4a81a4', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType; iconColor?: string }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: iconColor }} />
      <input {...props} className={cn(props.className, 'pl-10')} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function CommanderPage() {
  const [current,    setCurrent]    = useState(1)
  const [data,       setData]       = useState<Partial<FormData>>({})
  const [dragOver,   setDragOver]   = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newOrderRef, setNewOrderRef] = useState('')
  // Multi-lignes : chaque ligne = un service à facturer
  const [lines, setLines] = useState<ServiceLine[]>([])
  const linesValidation = validateLines(lines)
  const linesTotals = computeTotals(lines)

  // Service "principal" : celui de la 1ère ligne (utile pour les champs conditionnels)
  const primaryLine = lines[0]
  const selectedService = primaryLine
    ? SERVICES.find(s => s.id === primaryLine.serviceSlug)
    : SERVICES.find(s => s.id === data.serviceId)

  // Helper : ajoute un service comme nouvelle ligne
  const addServiceAsLine = useCallback((svcId: string) => {
    const svc = SERVICES.find(s => s.id === svcId)
    if (!svc) return
    setLines(prev => [...prev, buildLineFromService(svc)])
    // Maintient serviceId pour les champs conditionnels (sites web, campaigns)
    setData(d => ({ ...d, serviceId: d.serviceId || svcId }))
  }, [])

  const form1 = useForm({ resolver: zodResolver(step1Schema), mode: 'onBlur' })
  const form3 = useForm({ resolver: zodResolver(step3Schema), mode: 'onBlur' })

  const go = useCallback((dir: 1 | -1) => {
    setCurrent(p => Math.max(1, Math.min(6, p + dir)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleStep1 = form1.handleSubmit((vals) => {
    setData(d => ({ ...d, ...vals }))
    go(1)
  })

  const handleStep3 = form3.handleSubmit((vals) => {
    setData(d => ({ ...d, ...vals }))
    go(1)
  })

  // ── Convertir un File en base64 ───────────────────────────
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleSubmitOrder = async () => {
    // Garde-fou : validation des lignes
    if (!linesValidation.ok || lines.length === 0) {
      console.warn('Submit bloqué — lignes invalides', linesValidation.errors)
      return
    }

    setSubmitting(true)
    await new Promise(r => setTimeout(r, 400))

    // ID Supabase de la commande créée (hoisté pour la redirection Stripe)
    let supabaseOrderId: string | null = null

    // Totaux agrégés depuis les lignes
    const totalReal = linesTotals.real
    const totalCost = linesTotals.cost
    const totalTheoretical = linesTotals.theoretical
    const totalProfit = linesTotals.profit

    // La 1ère ligne sert de "service principal" pour les champs mono-valeur de `orders`
    const first = lines[0]
    const firstSvc = SERVICES.find(s => s.id === first.serviceSlug)
    const serviceSummary = lines.length === 1
      ? first.serviceName
      : `${first.serviceName} (+${lines.length - 1} autre${lines.length > 2 ? 's' : ''})`

    const order = storeInsert({
      service:         serviceSummary,
      service_slug:    first.serviceSlug,
      quantity:        first.quantity,
      client_name:     data.clientName    ?? '',
      client_email:    data.clientEmail   ?? '',
      client_phone:    data.clientPhone,
      company_name:    data.companyName,
      company_email:   data.companyEmail,
      sector:          data.sector,
      vat_number:      data.vatNumber  || undefined,
      website:         data.website    || undefined,
      instagram:       data.instagram  || undefined,
      facebook:        data.facebook   || undefined,
      tiktok:          data.tiktok     || undefined,
      brief:           data.brief,
      objectives:      data.objectives,
      required_access: data.requiredAccess,
      price:              totalReal,
      cost:               totalCost,
      sale_price:         first.unitRecommendedPrice,
      actual_sale_price:  first.unitActualPrice,
      internal_cost:      first.unitCost,
      profit:             totalProfit,
      monthly_price:      firstSvc?.monthlyPrice ?? undefined,
      commitment_months:  firstSvc?.commitmentMonths ?? undefined,
      contract_total:     firstSvc?.commitmentMonths
        ? totalTheoretical * firstSvc.commitmentMonths
        : undefined,
      status:             'pending',
      payment_status:     'unpaid',
      whatsapp_group:  data.whatsappGroup || undefined,
      domain_name:     data.domainName || undefined,
      specific_request: data.specificRequest || undefined,
    })

    // ── Récupérer le nom du franchisé ──────────────────────
    let franchiseeName = 'Franchisé'
    try {
      const saved = JSON.parse(localStorage.getItem('nhboost_profile') ?? '{}')
      if (saved.company_name) franchiseeName = saved.company_name
    } catch {}
    if (franchiseeName === 'Franchisé') {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const { data: { user } } = await createClient().auth.getUser()
        if (user?.email) franchiseeName = user.email.split('@')[0]
      } catch {}
    }

    // ── Convertir les fichiers en base64 ──────────────────
    const filesPayload = await Promise.all(
      (data.files ?? []).map(async (file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        data: await fileToBase64(file),
      }))
    )

    // ── Envoi email + PDF brief technique ─────────────────
    try {
      await fetch('/api/send-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref:            order.ref,
          service:        order.service,
          price:          order.price,
          clientName:     order.client_name,
          clientEmail:    order.client_email,
          clientPhone:    order.client_phone  ?? '',
          companyName:    order.company_name  ?? '',
          companyEmail:   order.company_email ?? '',
          sector:         order.sector        ?? '',
          vatNumber:      order.vat_number    ?? '',
          website:        order.website       ?? '',
          instagram:      order.instagram     ?? '',
          facebook:       order.facebook      ?? '',
          tiktok:         order.tiktok        ?? '',
          brief:          order.brief         ?? '',
          objectives:     order.objectives    ?? '',
          requiredAccess: order.required_access ?? '',
          whatsappGroup:  data.whatsappGroup  ?? '',
          domainName:     data.domainName     ?? '',
          specificRequest: data.specificRequest ?? '',
          franchiseeName,
          files:          filesPayload,
        }),
      })
    } catch (e) {
      console.warn('send-order email failed:', e)
    }

    // ── Sauvegarde Supabase ────────────────────────────────
    // ⚠ Les triggers SQL (migration orders_auto_totals.sql) recalculent
    // automatiquement price/cost/profit/etc. sur la ligne orders quand
    // les order_items sont insérés. Les valeurs envoyées ici sont donc
    // un fallback au cas où les triggers ne seraient pas installés.
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Résoudre tous les service_id depuis les slugs (une seule requête)
        // Note : le trigger BEFORE INSERT sur order_items résout aussi
        // automatiquement service_id depuis service_slug → redondant mais sans impact.
        const slugs = Array.from(new Set(lines.map(l => l.serviceSlug)))
        const { data: catalogRows } = await supabase
          .from('services')
          .select('id, slug')
          .in('slug', slugs)
        const slugToId = new Map<string, string>((catalogRows ?? []).map(r => [r.slug as string, r.id as string]))
        const primaryServiceId = slugToId.get(first.serviceSlug) ?? null

        // 1) Insérer l'en-tête orders (les totaux seront éventuellement écrasés par le trigger)
        const { data: createdOrder, error: sbError } = await supabase
          .from('orders')
          .insert({
            user_id:            user.id,
            service:            order.service,
            service_id:         primaryServiceId,
            quantity:           first.quantity,
            client_name:        order.client_name,
            client_email:       order.client_email,
            client_phone:       order.client_phone    ?? null,
            company_name:       order.company_name    ?? null,
            company_email:      order.company_email   ?? null,
            sector:             order.sector          ?? null,
            vat_number:         order.vat_number      ?? null,
            website:            order.website         ?? null,
            instagram:          order.instagram       ?? null,
            facebook:           order.facebook        ?? null,
            tiktok:             order.tiktok          ?? null,
            brief:              order.brief           ?? null,
            objectives:         order.objectives      ?? null,
            required_access:    order.required_access ?? null,
            price:              totalReal,
            cost:               totalCost,
            sale_price:         first.unitRecommendedPrice,
            actual_sale_price:  first.unitActualPrice,
            internal_cost:      first.unitCost,
            profit:             totalProfit,
            monthly_price:      order.monthly_price   ?? null,
            commitment_months:  order.commitment_months ?? null,
            contract_total:     order.contract_total  ?? null,
            status:             'pending',
            payment_status:     'unpaid',
            whatsapp_group:     data.whatsappGroup    ?? null,
            domain_name:        data.domainName       ?? null,
            specific_request:   data.specificRequest  ?? null,
            public_token:       order.public_token    ?? crypto.randomUUID(),
            public_tracking_enabled: true,
          })
          .select('id')
          .single()

        if (sbError || !createdOrder) {
          console.error('Supabase order insert error:', sbError?.message)
        } else {
          // Hoist l'id pour la redirection Stripe en fin de fonction
          supabaseOrderId = createdOrder.id as string
          // 2) Insérer toutes les lignes de service en une seule requête
          const itemsPayload = lines.map((line, idx) => ({
            order_id:               createdOrder.id as string,
            service_id:             slugToId.get(line.serviceSlug) ?? null,
            service_name:           line.serviceName,
            service_slug:           line.serviceSlug,
            quantity:               line.quantity,
            unit_recommended_price: line.unitRecommendedPrice,
            unit_actual_price:      line.unitActualPrice,
            unit_cost:              line.unitCost,
            sort_order:             idx,
          }))
          const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload)
          if (itemsError) console.error('Supabase order_items insert error:', itemsError.message)
        }
      }
    } catch (e) {
      console.error('Supabase order insert failed:', e)
    }

    // ── Notification locale ────────────────────────────────
    notifInsert({
      type:    'order_placed',
      title:   `Commande ${order.ref} envoyée`,
      message: `${order.service} pour ${order.company_name || order.client_name} — €${order.price.toLocaleString('fr-FR')}`,
      link:    '/commandes',
    })

    // ── Redirection Stripe Checkout (paiement unique) ──────
    // Si la commande est bien persistée en DB, on crée une session Stripe
    // et on redirige le franchisé. Le webhook mettra payment_status à 'paid'
    // après confirmation du paiement.
    if (supabaseOrderId) {
      try {
        const checkoutRes = await fetch('/api/payments/checkout-one-shot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: supabaseOrderId }),
        })
        const checkoutData = await checkoutRes.json()
        if (checkoutRes.ok && checkoutData.url) {
          // Redirection vers Stripe — la page success/cancel prend le relais
          window.location.href = checkoutData.url
          return
        } else {
          console.warn('[Stripe] checkout failed:', checkoutData.error)
          // On tombe dans le fallback ci-dessous (écran de confirmation sans paiement)
        }
      } catch (e) {
        console.error('[Stripe] checkout exception:', e)
      }
    }

    // Fallback : écran de confirmation classique (pas de redirection Stripe)
    setSubmitting(false)
    setNewOrderRef(order.ref)
    setSubmitted(true)
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    setData(d => ({ ...d, files: [...(d.files ?? []), ...Array.from(e.dataTransfer.files)] }))
  }, [])

  const removeFile = useCallback((i: number) => {
    setData(d => ({ ...d, files: d.files?.filter((_, idx) => idx !== i) }))
  }, [])

  // ── Confirmation ──────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-20 h-20 rounded-full bg-[rgba(34,197,94,0.15)] border-2 border-[#22C55E] flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="w-10 h-10 text-[#22C55E]" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-2xl font-bold text-[#2d2d60] mb-2">Commande enregistrée !</h2>
          {newOrderRef && <p className="text-[13px] font-mono text-[#6AAEE5] mb-1">{newOrderRef}</p>}
          <p className="text-[#6B7280] mb-2">Votre commande est en attente de traitement.</p>
          <p className="text-[12px] text-[#9CA3AF] mb-6">Le paiement sera configuré prochainement via Stripe.</p>
          <div className="flex gap-3 justify-center">
            <a href="/commandes"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              Voir mes commandes
            </a>
            <button
              onClick={() => { setSubmitted(false); setCurrent(1); setData({}); setNewOrderRef('') }}
              className="px-6 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[#2d2d60] text-sm font-medium hover:bg-[#E2E8F2] transition-colors">
              Nouvelle commande
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-1">Nouvelle commande</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Commander un service</h1>
        <p className="text-sm text-[#6B7280] mt-1">Complétez les étapes ci-dessous pour soumettre votre commande.</p>
      </div>

      {/* Stepper */}
      <div className="rounded-2xl border border-[#b8c4e8] p-4" style={{ background: 'linear-gradient(135deg, #8292d8 0%, #aab7e6 50%, #cdd3f0 100%)' }}>
        <div className="flex items-center justify-between overflow-x-auto gap-1 pb-1 md:pb-0">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
              <StepIndicator step={step} current={current} />
              {i < STEPS.length - 1 && (
                <div className={cn('h-px w-6 md:w-10 transition-all duration-500 flex-shrink-0',
                  step.id < current ? 'bg-[#2d2d60]/30' : 'bg-[#2d2d60]/15')} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-[#E2E8F2] overflow-hidden bg-white">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="p-6 md:p-8"
          >

            {/* ── STEP 1: Infos client & entreprise ── */}
            {current === 1 && (
              <div className="space-y-6">
                <StepHeader icon={User} color="#6AAEE5" title="Informations client & entreprise"
                  subtitle="Renseignez les coordonnées du client et de son entreprise." />

                {/* Bloc client */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#2d2d60] mb-3 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Contact client
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldWrapper label="Nom client" required error={form1.formState.errors.clientName?.message}>
                      <InputWithIcon
                        icon={User}
                        {...form1.register('clientName')}
                        className={inputCls(!!form1.formState.errors.clientName)}
                        placeholder="Jean Dupont"
                      />
                    </FieldWrapper>
                    <FieldWrapper label="Email client" required error={form1.formState.errors.clientEmail?.message}>
                      <InputWithIcon
                        icon={Mail}
                        type="email"
                        {...form1.register('clientEmail')}
                        className={inputCls(!!form1.formState.errors.clientEmail)}
                        placeholder="jean@exemple.com"
                      />
                    </FieldWrapper>
                    <FieldWrapper label="Téléphone client" error={form1.formState.errors.clientPhone?.message}>
                      <InputWithIcon
                        icon={Phone}
                        type="tel"
                        {...form1.register('clientPhone')}
                        className={inputCls()}
                        placeholder="+33 6 00 00 00 00"
                      />
                    </FieldWrapper>
                    <FieldWrapper label="Nom du groupe WhatsApp" error={form1.formState.errors.whatsappGroup?.message}>
                      <InputWithIcon
                        icon={MessageSquare}
                        {...form1.register('whatsappGroup')}
                        className={inputCls()}
                        placeholder="Nom du groupe WhatsApp"
                      />
                    </FieldWrapper>
                  </div>
                </div>

                {/* Séparateur */}
                <div className="h-px bg-[#E2E8F2]" />

                {/* Bloc entreprise */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#2d2d60] mb-3 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" /> Entreprise
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldWrapper label="Nom entreprise" required error={form1.formState.errors.companyName?.message}>
                      <InputWithIcon
                        icon={Building2}
                        {...form1.register('companyName')}
                        className={inputCls(!!form1.formState.errors.companyName)}
                        placeholder="Ma Société SAS"
                      />
                    </FieldWrapper>
                    <FieldWrapper label="Email entreprise" error={form1.formState.errors.companyEmail?.message}>
                      <InputWithIcon
                        icon={Mail}
                        type="email"
                        {...form1.register('companyEmail')}
                        className={inputCls(!!form1.formState.errors.companyEmail)}
                        placeholder="contact@masociete.fr"
                      />
                    </FieldWrapper>
                    <FieldWrapper label="Secteur d'activité" error={form1.formState.errors.sector?.message}>
                      <div className="relative">
                        <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a81a4] pointer-events-none" />
                        <select
                          {...form1.register('sector')}
                          className={cn(inputCls(), 'pl-10 appearance-none cursor-pointer')}
                        >
                          <option value="">— Sélectionnez un secteur —</option>
                          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </FieldWrapper>
                  </div>
                </div>

                <div className="h-px bg-[#E2E8F2]" />

                {/* Bloc présence en ligne */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#2d2d60] mb-3 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" /> Présence en ligne
                    <span className="ml-1 text-[10px] font-medium text-[#6B7280] normal-case tracking-normal">(facultatif mais recommandé)</span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Numéro TVA */}
                    <FieldWrapper label="Numéro TVA" error={form1.formState.errors.vatNumber?.message}>
                      <InputWithIcon
                        icon={Hash}
                        {...form1.register('vatNumber')}
                        className={inputCls(!!form1.formState.errors.vatNumber)}
                        placeholder="FR 00 000 000 000"
                      />
                    </FieldWrapper>

                    {/* Site web */}
                    <FieldWrapper label="Site web" error={form1.formState.errors.website?.message}>
                      <InputWithIcon
                        icon={Globe}
                        type="url"
                        {...form1.register('website')}
                        className={inputCls(!!form1.formState.errors.website)}
                        placeholder="https://mon-site.com"
                      />
                    </FieldWrapper>
                  </div>

                  {/* Réseaux sociaux */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">

                    {/* Instagram */}
                    <FieldWrapper label="Instagram" error={form1.formState.errors.instagram?.message}>
                      <InputWithIcon
                        icon={AtSign}
                        {...form1.register('instagram')}
                        className={inputCls()}
                        placeholder="@mon_compte"
                      />
                    </FieldWrapper>

                    {/* Facebook */}
                    <FieldWrapper label="Facebook" error={form1.formState.errors.facebook?.message}>
                      <InputWithIcon
                        icon={Users}
                        {...form1.register('facebook')}
                        className={inputCls()}
                        placeholder="facebook.com/ma-page"
                      />
                    </FieldWrapper>

                    {/* TikTok */}
                    <FieldWrapper label="TikTok" error={form1.formState.errors.tiktok?.message}>
                      <InputWithIcon
                        icon={Play}
                        {...form1.register('tiktok')}
                        className={inputCls()}
                        placeholder="@mon_tiktok"
                      />
                    </FieldWrapper>
                  </div>
                </div>

                <NavButtons onNext={handleStep1} disablePrev />
              </div>
            )}

            {/* ── STEP 2: Services (multi-lignes) ── */}
            {current === 2 && (
              <div className="space-y-6">
                <StepHeader icon={Briefcase} color="#4A7DC4" title="Services commandés"
                  subtitle="Sélectionnez un ou plusieurs services. Vous pouvez saisir la quantité et le prix réel facturé pour chaque ligne." />

                {/* Catalogue visuel — un clic ajoute le service comme ligne */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
                    Catalogue · Cliquez pour ajouter
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SERVICES.map((svc) => {
                      const Icon = svc.icon
                      const count = lines.filter(l => l.serviceSlug === svc.id).length
                      const added = count > 0
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => addServiceAsLine(svc.id)}
                          className={cn(
                            'relative text-left rounded-xl border-l-4 border p-4 transition-all duration-200 group',
                            added
                              ? 'bg-[#EFF6FF] border-l-[#6AAEE5] border-[#6AAEE5]/40'
                              : 'bg-white border-l-transparent border-[#E2E8F2] hover:border-[#6AAEE5]/25 hover:bg-[#FAFBFD]'
                          )}
                          style={{ borderLeftColor: svc.iconColor }}
                        >
                          {svc.popular && !added && (
                            <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#6AAEE5]/10 text-[#6AAEE5] border border-[#6AAEE5]/30">
                              Populaire
                            </span>
                          )}
                          {added && (
                            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6AAEE5] text-white text-[10px] font-bold">
                              <Check className="w-3 h-3" strokeWidth={3} />
                              {count > 1 ? `×${count}` : 'Ajouté'}
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0 mt-0.5"
                              style={{ background: `${svc.iconColor}18` }}>
                              <Icon className="w-5 h-5" style={{ color: svc.iconColor }} strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className={cn('text-[13px] font-semibold', added ? 'text-[#2d2d60]' : 'text-[#6B7280] group-hover:text-[#2d2d60]')}>
                                  {svc.name}
                                </p>
                                <p className="text-[14px] font-bold" style={{ color: svc.iconColor }}>
                                  {formatPrice(svc.salePrice)}{svc.type === 'subscription' ? '/mois' : ''}
                                </p>
                              </div>
                              <p className="text-[11px] text-[#6B7280] leading-relaxed">{svc.description}</p>
                              {svc.engagement && (
                                <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
                                  Engagement {svc.engagement}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Éditeur de lignes : quantité + prix réel par service */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">
                    Lignes de commande · Ajustez quantité et prix réel
                  </p>
                  <ServiceLinesEditor lines={lines} onChange={setLines} />
                </div>

                <NavButtons
                  onNext={() => {
                    if (linesValidation.ok && lines.length > 0) {
                      // Sync serviceId avec la 1ère ligne pour compat avec les champs conditionnels
                      setData(d => ({ ...d, serviceId: lines[0].serviceSlug }))
                      go(1)
                    }
                  }}
                  onPrev={() => go(-1)}
                  nextDisabled={!linesValidation.ok || lines.length === 0}
                  nextLabel={
                    lines.length === 0
                      ? 'Ajoutez au moins un service'
                      : `Continuer — ${formatPrice(linesTotals.real)}`
                  }
                />
              </div>
            )}

            {/* ── STEP 3: Brief + objectifs + accès ── */}
            {current === 3 && (
              <div className="space-y-6">
                <StepHeader icon={FileText} color="#8B5CF6" title="Brief du projet"
                  subtitle="Décrivez le projet, les objectifs et les accès nécessaires." />

                <FieldWrapper label="Description du projet" required error={form3.formState.errors.brief?.message}
                  info="Plus votre brief est détaillé, meilleur sera le résultat">
                  <textarea
                    {...form3.register('brief')}
                    rows={5}
                    className={cn(inputBase, 'resize-none leading-relaxed', form3.formState.errors.brief && inputErr)}
                    placeholder="Décrivez le projet du client : son activité, sa cible, ses attentes, les résultats espérés..."
                  />
                  <p className="text-[11px] text-[#9CA3AF] text-right mt-1">
                    {form3.watch('brief')?.length ?? 0} / 20 min
                  </p>
                </FieldWrapper>

                {/* ── Objectifs : chips sélectionnables + texte libre ── */}
                <FieldWrapper label="Objectif du client" error={form3.formState.errors.objectives?.message}
                  info="Sélectionnez les objectifs puis précisez les détails ci-dessous">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Générer des leads qualifiés',
                        'Augmenter le chiffre d\'affaires',
                        'Obtenir plus de clients',
                        'Augmenter la visibilité',
                        'Trafic vers site web',
                        'Promouvoir une offre',
                        'Remplir un agenda (RDV)',
                        'Ventes directes',
                        'Notoriété locale',
                        'Clientèle ciblée',
                        'Nouvelle entreprise / ouverture',
                        'Relancer l\'activité',
                        'Messages WhatsApp / appels',
                        'Abonnés réseaux sociaux',
                        'Tester un nouveau marché',
                      ].map(obj => {
                        const current = form3.watch('objectives') ?? ''
                        const isSelected = current.includes(obj)
                        return (
                          <button key={obj} type="button"
                            onClick={() => {
                              const cur = form3.getValues('objectives') ?? ''
                              if (cur.includes(obj)) {
                                form3.setValue('objectives', cur.replace(obj, '').replace(/\n{2,}/g, '\n').trim())
                              } else {
                                form3.setValue('objectives', cur ? `${cur}\n${obj}` : obj)
                              }
                            }}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all',
                              isSelected
                                ? 'bg-[#6AAEE5]/10 border-[#6AAEE5]/40 text-[#2d2d60]'
                                : 'bg-white border-[#E2E8F2] text-[#6B7280] hover:border-[#6AAEE5]/30 hover:text-[#2d2d60]'
                            )}
                          >
                            {isSelected && <span className="mr-1">✓</span>}{obj}
                          </button>
                        )
                      })}
                    </div>

                    {/* Conversion + Horizon */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4a81a4] mb-2">Type de conversion attendu</p>
                        <div className="flex flex-wrap gap-1.5">
                          {['Formulaire', 'Appel', 'WhatsApp', 'Achat direct', 'Prise de RDV', 'Visite magasin', 'Trafic site web'].map(conv => {
                            const cur = data.conversionType ?? ''
                            const sel = cur.includes(conv)
                            return (
                              <button key={conv} type="button"
                                onClick={() => setData(d => ({
                                  ...d,
                                  conversionType: sel
                                    ? (d.conversionType ?? '').replace(conv, '').replace(/, {2,}/g, ', ').replace(/^, |, $/g, '').trim()
                                    : (d.conversionType ? `${d.conversionType}, ${conv}` : conv)
                                }))}
                                className={cn(
                                  'px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all',
                                  sel ? 'bg-[#22C55E]/10 border-[#22C55E]/40 text-[#166534]'
                                      : 'bg-white border-[#E2E8F2] text-[#6B7280] hover:border-[#22C55E]/30'
                                )}
                              >
                                {sel && <span className="mr-0.5">✓</span>}{conv}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4a81a4] mb-2">Horizon</p>
                        <div className="flex gap-2">
                          {['Court terme', 'Moyen terme', 'Long terme'].map(h => (
                            <button key={h} type="button"
                              onClick={() => setData(d => ({ ...d, horizon: h }))}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all flex-1 text-center',
                                data.horizon === h
                                  ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/40 text-[#5B21B6]'
                                  : 'bg-white border-[#E2E8F2] text-[#6B7280] hover:border-[#8B5CF6]/30'
                              )}
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Texte libre */}
                    <textarea
                      {...form3.register('objectives')}
                      rows={3}
                      className={cn(inputBase, 'resize-none leading-relaxed')}
                      placeholder="Précisez ici les détails : résultat attendu, objectifs secondaires..."
                    />
                  </div>
                </FieldWrapper>

                {/* ── Demandes spécifiques : cards catégories + texte libre ── */}
                <FieldWrapper label="Demandes spécifiques du client" error={form3.formState.errors.specificRequest?.message}
                  info="Sélectionnez les catégories concernées puis précisez les détails">
                  <div className="space-y-3">
                    {/* Category cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { id: 'video', label: 'Tournage / Vidéo', color: '#EF4444', items: ['Profil homme/femme', 'Âge spécifique', 'Style pro/naturel/dynamique', 'Lieu de tournage', 'Délai urgent', 'Montrer équipe/locaux/produits'] },
                        { id: 'web', label: 'Site web / Landing', color: '#6AAEE5', items: ['Structure spécifique', 'Offre à mettre en avant', 'Charte graphique', 'Exemples de sites', 'Sections obligatoires'] },
                        { id: 'com', label: 'Style de communication', color: '#F59E0B', items: ['Ton pro/décontracté/dynamique', 'Orientation premium/corporate', 'Langue FR/NL/EN', 'Vocabulaire spécifique'] },
                        { id: 'campaign', label: 'Objectifs campagne', color: '#8B5CF6', items: ['Offre précise à promouvoir', 'Clientèle ciblée', 'Branding ou conversion'] },
                      ].map(cat => {
                        const isOpen = (data as Record<string, unknown>)[`spec_${cat.id}`] === true
                        return (
                          <div key={cat.id}
                            className={cn(
                              'rounded-xl border overflow-hidden transition-all',
                              isOpen ? 'border-l-4 bg-white shadow-sm' : 'border-[#E2E8F2] bg-white hover:shadow-sm'
                            )}
                            style={isOpen ? { borderLeftColor: cat.color } : undefined}
                          >
                            <button type="button"
                              onClick={() => setData(d => ({ ...d, [`spec_${cat.id}`]: !isOpen }))}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left"
                            >
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                              <span className="text-[13px] font-semibold text-[#2d2d60] flex-1">{cat.label}</span>
                              <ChevronRight className={cn('w-3.5 h-3.5 text-[#9CA3AF] transition-transform', isOpen && 'rotate-90')} />
                            </button>
                            {isOpen && (
                              <div className="px-4 pb-3 space-y-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {cat.items.map(item => {
                                    const curSpec = form3.getValues('specificRequest') ?? ''
                                    const sel = curSpec.includes(item)
                                    return (
                                      <button key={item} type="button"
                                        onClick={() => {
                                          const cur = form3.getValues('specificRequest') ?? ''
                                          if (cur.includes(item)) {
                                            form3.setValue('specificRequest', cur.replace(item, '').replace(/\n{2,}/g, '\n').trim())
                                          } else {
                                            form3.setValue('specificRequest', cur ? `${cur}\n${item}` : item)
                                          }
                                        }}
                                        className={cn(
                                          'px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all',
                                          sel ? 'bg-[rgba(106,174,229,0.1)] border-[#6AAEE5]/40 text-[#2d2d60]'
                                              : 'bg-[#F5F7FA] border-[#E2E8F2] text-[#6B7280] hover:border-[#6AAEE5]/30'
                                        )}
                                      >
                                        {sel ? '✓ ' : ''}{item}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Contraintes */}
                    <div className="p-3 rounded-xl bg-[#FEF3C7]/50 border border-[#F59E0B]/20">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#92400E] mb-1.5">Contraintes importantes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {['Éléments à éviter', 'Mentions légales obligatoires', 'Infos à intégrer', 'Demandes particulières'].map(c => {
                          const curSpec = form3.getValues('specificRequest') ?? ''
                          const sel = curSpec.includes(c)
                          return (
                            <button key={c} type="button"
                              onClick={() => {
                                const cur = form3.getValues('specificRequest') ?? ''
                                form3.setValue('specificRequest', cur.includes(c) ? cur.replace(c, '').trim() : (cur ? `${cur}\n${c}` : c))
                              }}
                              className={cn(
                                'px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all',
                                sel ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#92400E]'
                                    : 'bg-white border-[#E2E8F2] text-[#6B7280] hover:border-[#F59E0B]/30'
                              )}
                            >
                              {sel ? '✓ ' : ''}{c}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Texte libre */}
                    <textarea
                      {...form3.register('specificRequest')}
                      rows={4}
                      className={cn(inputBase, 'resize-none leading-relaxed')}
                      placeholder="Précisez ici tous les détails supplémentaires : préférences visuelles, contraintes, demandes particulières du client..."
                    />
                  </div>
                </FieldWrapper>

                <FieldWrapper label="Accès nécessaires" error={form3.formState.errors.requiredAccess?.message}>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-[#4a81a4] pointer-events-none" />
                    <textarea
                      {...form3.register('requiredAccess')}
                      rows={6}
                      className={cn(inputBase, 'resize-none leading-relaxed pl-10')}
                      placeholder={`ID Instagram : .....
Mot de passe Instagram : .....
ID page publicitaire Meta (Facebook) : .....
Mot de passe Meta (Facebook) : .....
Accès Google Analytics : .....
Accès hébergement / CMS : .....`}
                    />
                  </div>
                </FieldWrapper>

                {/* Domain name — conditional on site services */}
                {(data.serviceId === 'site-onepage' || data.serviceId === 'site-complet') && (
                  <FieldWrapper label="Nom de domaine souhaité" error={form3.formState.errors.domainName?.message}>
                    <InputWithIcon
                      icon={Globe}
                      {...form3.register('domainName')}
                      className={inputCls()}
                      placeholder="ex: mon-entreprise.com"
                    />
                    <p className="text-[11px] text-[#F59E0B] mt-1">
                      Vérifiez la disponibilité sur GoDaddy.com ou OVH.com avant de commander
                    </p>
                  </FieldWrapper>
                )}

                <NavButtons onNext={handleStep3} onPrev={() => go(-1)} />
              </div>
            )}

            {/* ── STEP 4: Fichiers ── */}
            {current === 4 && (
              <div className="space-y-6">
                <StepHeader icon={Upload} color="#F59E0B" title="Fichiers & documents"
                  subtitle="Téléchargez les fichiers nécessaires au projet" />
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  className={cn(
                    'border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer',
                    dragOver ? 'border-[#6AAEE5] bg-[#EFF6FF]'
                             : 'border-[#E2E8F2] hover:border-[#6AAEE5]/40 hover:bg-[#FAFBFD]'
                  )}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input id="file-input" type="file" multiple className="hidden"
                    onChange={e => setData(d => ({ ...d, files: [...(d.files ?? []), ...Array.from(e.target.files ?? [])] }))} />
                  <Upload className={cn('w-8 h-8 mx-auto mb-3 transition-colors', dragOver ? 'text-[#6AAEE5]' : 'text-[#9CA3AF]')} />
                  <p className="text-sm font-medium text-[#2d2d60]">{dragOver ? 'Relâchez pour déposer' : 'Glissez-déposez vos fichiers ici'}</p>
                  <p className="text-[11px] text-[#6B7280] mt-1">ou <span className="text-[#6AAEE5] underline">parcourir</span> pour télécharger</p>
                </div>

                <div className="space-y-2">
                  <p className="text-[12px] text-[#6B7280] leading-relaxed">
                    Un logo en bonne qualité nous aidera pour les montages et les couleurs.<br />
                    Formats acceptés : PNG, JPG, PDF, Word, PowerPoint
                  </p>
                  <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
                    Vous pouvez télécharger : une présentation commerciale du client, une présentation de ses offres, un brief existant, des exemples de design appréciés...
                  </p>
                </div>

                {(data.files?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    {data.files!.map((file, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F2]">
                        <div className="w-7 h-7 rounded-lg bg-[#6AAEE5]/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-[#6AAEE5]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#2d2d60] truncate">{file.name}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button onClick={() => removeFile(i)} className="p-1 rounded-lg text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <NavButtons onNext={() => go(1)} onPrev={() => go(-1)} nextLabel="Continuer" />
              </div>
            )}

            {/* ── STEP 5: Paiement ── */}
            {current === 5 && (
              <div className="space-y-6">
                <StepHeader icon={CreditCard} color="#22C55E" title="Mode de paiement"
                  subtitle="Choisissez comment régler cette commande. Les prix ont déjà été définis ligne par ligne." />

                {/* Rappel : total de la commande */}
                <div className="rounded-2xl bg-gradient-to-br from-[#F8FAFC] to-white border border-[#E2E8F2] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-3">
                    Montant à régler · {lines.length} ligne{lines.length > 1 ? 's' : ''}
                  </p>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[28px] font-bold text-[#2d2d60] font-mono tabular-nums leading-none">
                        {formatPrice(linesTotals.real)}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] mt-1">
                        Bénéfice réel : <span className="font-semibold text-[#22C55E]">{formatPrice(linesTotals.profit)}</span>
                      </p>
                    </div>
                    {Math.abs(linesTotals.variance) >= 0.5 && (
                      <div
                        className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold"
                        style={{
                          background: linesTotals.variance > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                          color: linesTotals.variance > 0 ? '#EF4444' : '#22C55E',
                        }}
                      >
                        {linesTotals.variance > 0 ? '−' : '+'}{formatPrice(Math.abs(linesTotals.variance))} vs conseil
                      </div>
                    )}
                  </div>
                </div>

                {/* Modes de paiement */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PaymentCard mode="one-shot" selected={data.paymentMode === 'one-shot'}
                    onSelect={() => setData(d => ({ ...d, paymentMode: 'one-shot' }))}
                    icon={Zap} title="Paiement unique"
                    description="Réglez la totalité en une fois. Accès immédiat dès confirmation."
                    price={formatPrice(linesTotals.real)} badge="Ponctuel" badgeColor="#6AAEE5" />
                  <PaymentCard mode="subscription" selected={data.paymentMode === 'subscription'}
                    onSelect={() => setData(d => ({ ...d, paymentMode: 'subscription' }))}
                    icon={CreditCard} title="Abonnement mensuel"
                    description="Étalez le paiement mois par mois. Résiliable à tout moment."
                    price={`${formatPrice(Math.ceil(linesTotals.real / 3))}/mois`}
                    badge="Récurrent" badgeColor="#22C55E" />
                </div>

                <NavButtons
                  onNext={() => { if (data.paymentMode) go(1) }}
                  onPrev={() => go(-1)}
                  nextDisabled={!data.paymentMode}
                  nextLabel="Voir le récapitulatif"
                />
              </div>
            )}

            {/* ── STEP 6: Récapitulatif ── */}
            {current === 6 && (
              <div className="space-y-6">
                <StepHeader icon={CheckCircle2} color="#22C55E" title="Récapitulatif"
                  subtitle="Vérifiez votre commande avant de la confirmer." />

                <div className="space-y-1">
                  {/* Client */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] pb-1 mb-1">Contact client</p>
                  <SummaryRow label="Nom client"   value={data.clientName  ?? '—'} />
                  <SummaryRow label="Email client" value={data.clientEmail ?? '—'} />
                  {data.clientPhone && <SummaryRow label="Téléphone" value={data.clientPhone} />}
                  {data.whatsappGroup && <SummaryRow label="Groupe WhatsApp" value={data.whatsappGroup} />}

                  <div className="h-px bg-[#E2E8F2] my-2" />

                  {/* Entreprise */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] pb-1 mb-1">Entreprise</p>
                  <SummaryRow label="Nom entreprise"   value={data.companyName  ?? '—'} />
                  {data.companyEmail && <SummaryRow label="Email entreprise" value={data.companyEmail} />}
                  {data.sector      && <SummaryRow label="Secteur"           value={data.sector} />}
                  {data.vatNumber   && <SummaryRow label="N° TVA"            value={data.vatNumber} />}

                  {/* Présence en ligne */}
                  {(data.website || data.instagram || data.facebook || data.tiktok) && (
                    <>
                      <div className="h-px bg-[#E2E8F2] my-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] pb-1 mb-1">Présence en ligne</p>
                      {data.website   && <SummaryRow label="Site web"   value={data.website} />}
                      {data.instagram && <SummaryRow label="Instagram"  value={data.instagram} />}
                      {data.facebook  && <SummaryRow label="Facebook"   value={data.facebook} />}
                      {data.tiktok    && <SummaryRow label="TikTok"     value={data.tiktok} />}
                    </>
                  )}

                  <div className="h-px bg-[#E2E8F2] my-2" />

                  {/* Services : détail par ligne */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] pb-1 mb-1">
                    Services · {lines.length} ligne{lines.length > 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2 mb-2">
                    {lines.map((line, i) => {
                      const lineTotal = line.unitActualPrice * line.quantity
                      const lineGap = (line.unitRecommendedPrice - line.unitActualPrice) * line.quantity
                      return (
                        <div key={line.id} className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F2] px-3 py-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[12px] font-semibold text-[#2d2d60] truncate">
                              {i + 1}. {line.serviceName}
                            </p>
                            <p className="text-[13px] font-bold text-[#2d2d60] font-mono tabular-nums">
                              {formatPrice(lineTotal)}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[#9CA3AF]">
                            <span>
                              {formatPrice(line.unitActualPrice)} × {line.quantity}
                              {Math.abs(lineGap) >= 0.5 && (
                                <span
                                  className="ml-2 font-semibold"
                                  style={{ color: lineGap > 0 ? '#EF4444' : '#22C55E' }}
                                >
                                  ({lineGap > 0 ? '−' : '+'}{formatPrice(Math.abs(lineGap))})
                                </span>
                              )}
                            </span>
                            <span className="text-[#9CA3AF]">
                              coût {formatPrice(line.unitCost * line.quantity)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <SummaryRow label="Paiement" value={data.paymentMode === 'subscription' ? 'Abonnement mensuel' : 'Paiement unique'} />
                  <SummaryRow label="CA théorique total" value={formatPrice(linesTotals.theoretical)} />
                  <SummaryRow label="Coût total" value={formatPrice(linesTotals.cost)} />
                  <SummaryRow label="Bénéfice réel" value={formatPrice(linesTotals.profit)} />
                  <SummaryRow label="Total facturé" value={formatPrice(linesTotals.real)} highlight />

                  {/* Brief */}
                  {data.brief && (
                    <>
                      <div className="h-px bg-[#E2E8F2] my-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280] pb-1">Projet</p>
                      <div className="py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Description</span>
                        <p className="text-[13px] text-[#2d2d60] mt-1 leading-relaxed line-clamp-3">{data.brief}</p>
                      </div>
                    </>
                  )}
                  {data.objectives && (
                    <div className="py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Objectifs</span>
                      <p className="text-[13px] text-[#2d2d60] mt-1 leading-relaxed line-clamp-2">{data.objectives}</p>
                    </div>
                  )}
                  {data.specificRequest && (
                    <div className="py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Demande spécifique</span>
                      <p className="text-[13px] text-[#2d2d60] mt-1 leading-relaxed line-clamp-2">{data.specificRequest}</p>
                    </div>
                  )}
                  {data.requiredAccess && (
                    <div className="py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Accès nécessaires</span>
                      <p className="text-[13px] text-[#2d2d60] mt-1 leading-relaxed line-clamp-2">{data.requiredAccess}</p>
                    </div>
                  )}
                  {data.domainName && (
                    <div className="py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]">Nom de domaine</span>
                      <p className="text-[13px] text-[#2d2d60] mt-1 leading-relaxed">{data.domainName}</p>
                    </div>
                  )}
                  {(data.files?.length ?? 0) > 0 && (
                    <SummaryRow label="Fichiers" value={`${data.files!.length} fichier${data.files!.length > 1 ? 's' : ''} joint${data.files!.length > 1 ? 's' : ''}`} />
                  )}
                </div>

                {/* CTA */}
                <div className="pt-2">
                  <button
                    onClick={handleSubmitOrder}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-semibold text-white text-[15px] transition-all duration-200 hover:opacity-90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #2d2d60 0%, #4A7DC4 50%, #6AAEE5 100%)', boxShadow: '0 0 32px rgba(106,174,229,0.3)' }}
                  >
                    {submitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                      : <><CheckCircle2 className="w-4 h-4" /> Confirmer la commande <ChevronRight className="w-4 h-4" /></>
                    }
                  </button>
                  <p className="text-center text-[11px] text-[#9CA3AF] mt-2.5">Le paiement Stripe sera activé prochainement</p>
                </div>

                <NavButtons onPrev={() => go(-1)} hideNext />
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────
function StepHeader({ icon: Icon, color, title, subtitle }: { icon: React.ElementType; color: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4 pb-2 border-b border-[#E2E8F2]">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 bg-[#F5F7FA] border border-[#E2E8F2]">
        <Icon className="w-5 h-5 text-[#2d2d60]" strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-[#2d2d60]">{title}</h2>
        <p className="text-sm text-[#6B7280]">{subtitle}</p>
      </div>
    </div>
  )
}

function NavButtons({ onNext, onPrev, nextDisabled, nextLabel = 'Continuer', disablePrev = false, hideNext = false }: {
  onNext?: () => void; onPrev?: () => void; nextDisabled?: boolean
  nextLabel?: string; disablePrev?: boolean; hideNext?: boolean
}) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F2]">
      <button onClick={onPrev} disabled={disablePrev}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] hover:text-[#2d2d60] hover:bg-[#F5F7FA] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
        <ChevronLeft className="w-4 h-4" /> Retour
      </button>
      {!hideNext && (
        <button onClick={onNext} disabled={nextDisabled}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: nextDisabled ? '#9CA3AF' : 'linear-gradient(135deg, #2d2d60 0%, #4A7DC4 100%)' }}>
          {nextLabel} <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

function PaymentCard({ selected, onSelect, icon: Icon, title, description, price, badge, badgeColor }: {
  mode: PaymentMode; selected: boolean; onSelect: () => void
  icon: React.ElementType; title: string; description: string; price: string; badge: string; badgeColor: string
}) {
  return (
    <button onClick={onSelect}
      className={cn('relative text-left rounded-xl border p-5 transition-all duration-200 w-full',
        selected ? 'bg-[#EFF6FF] border-[#6AAEE5]/40'
                 : 'bg-white border-[#E2E8F2] hover:border-[#6AAEE5]/30 hover:bg-[#FAFBFD]')}>
      {selected && (
        <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-[#6AAEE5] flex items-center justify-center">
          <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
        </div>
      )}
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}30` }}>
        {badge}
      </span>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: badgeColor }} strokeWidth={1.75} />
        <p className="text-[14px] font-bold text-[#2d2d60]">{title}</p>
      </div>
      <p className="text-[12px] text-[#6B7280] leading-relaxed mb-3">{description}</p>
      <p className="text-[20px] font-bold" style={{ color: badgeColor }}>{price}</p>
    </button>
  )
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-widest text-[#6B7280]">{label}</span>
      <span className={cn('text-[14px] font-semibold text-right max-w-[60%] truncate', highlight ? 'text-[#6AAEE5]' : 'text-[#2d2d60]')}>
        {value}
      </span>
    </div>
  )
}
