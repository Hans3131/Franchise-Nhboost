'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Briefcase, FileText,
  Upload, CreditCard, CheckCircle2, ChevronRight,
  ChevronLeft, Globe, Search, BarChart2, Palette,
  Share2, PenTool, Megaphone, X, Check, Zap, Loader2,
  Building2, Mail, Phone, Target, Key, Hash, AtSign, Users, Play,
} from 'lucide-react'
import { insert as storeInsert } from '@/lib/orderStore'
import { insert as notifInsert } from '@/lib/notificationStore'
import { cn, formatPrice } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────
type PaymentMode = 'one-shot' | 'subscription'

interface Service {
  id: string; name: string; description: string
  price: number; type: PaymentMode
  icon: React.ElementType; iconColor: string; popular?: boolean
}

interface FormData {
  // Infos client
  clientName:     string
  clientEmail:    string
  clientPhone:    string
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
  requiredAccess: string
  // Fichiers & paiement
  files:          File[]
  paymentMode:    PaymentMode
}

// ─── Constants ────────────────────────────────────────────────
const SERVICES: Service[] = [
  { id: 'site-web',  name: 'Création site web',   description: 'Site vitrine ou e-commerce professionnel sur mesure',  price: 2400, type: 'one-shot',     icon: Globe,     iconColor: '#6AAEE5', popular: true },
  { id: 'seo',       name: 'Campagne SEO',          description: 'Référencement naturel, audit et optimisation continue', price: 890,  type: 'subscription', icon: Search,    iconColor: '#22C55E' },
  { id: 'logo',      name: 'Refonte logo',          description: 'Identité visuelle complète, charte graphique incluse', price: 450,  type: 'one-shot',     icon: Palette,   iconColor: '#8B5CF6' },
  { id: 'social',    name: 'Pack réseaux sociaux',  description: 'Gestion et création de contenu pour vos réseaux',      price: 320,  type: 'subscription', icon: Share2,    iconColor: '#F59E0B' },
  { id: 'contenu',   name: 'Rédaction de contenu',  description: 'Articles, fiches produits, copywriting optimisé SEO', price: 200,  type: 'one-shot',     icon: PenTool,   iconColor: '#EC4899' },
  { id: 'ads',       name: 'Publicité Google Ads',  description: 'Campagnes Google Ads ciblées avec suivi des résultats',price: 500,  type: 'subscription', icon: Megaphone, iconColor: '#EF4444' },
  { id: 'analytics', name: 'Rapport Analytics',     description: 'Tableau de bord et rapports mensuels de performance',  price: 150,  type: 'subscription', icon: BarChart2,  iconColor: '#14B8A6' },
  { id: 'identite',  name: 'Kit communication',     description: 'Flyers, affiches, supports print et digital',          price: 350,  type: 'one-shot',     icon: Briefcase, iconColor: '#F97316' },
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
  requiredAccess: z.string().optional(),
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
        done   ? 'bg-white/90 border-white' :
        active ? 'bg-white border-white shadow-[0_2px_8px_rgba(45,45,96,0.2)]' :
                 'bg-white/25 border-white/50'
      )}>
        {done
          ? <Check className="w-3.5 h-3.5 text-[#2d2d60]" strokeWidth={2.5} />
          : <Icon className={cn('w-3.5 h-3.5', active ? 'text-[#2d2d60]' : 'text-white/70')} strokeWidth={1.75} />}
      </div>
      <span className={cn(
        'text-sm font-medium hidden md:block transition-colors',
        done ? 'text-white font-semibold' : active ? 'text-white font-semibold' : 'text-white/60'
      )}>
        {step.label}
      </span>
    </div>
  )
}

function FieldWrapper({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-semibold text-white/80 uppercase tracking-widest">
        {label}{required && <span className="text-red-200 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-200 mt-1">{error}</p>}
    </div>
  )
}

const inputBase = cn(
  'w-full bg-white/90 border border-white/60 rounded-xl px-4 py-3',
  'text-[14px] text-[#2d2d60] placeholder:text-[#8292d8]',
  'outline-none transition-all duration-200',
  'focus:border-white focus:ring-2 focus:ring-white/40 focus:bg-white',
  'hover:border-white/80 hover:bg-white/95'
)
const inputErr = 'border-red-500/50 focus:border-red-500'
const inputCls = (err?: boolean) => cn(inputBase, err && inputErr)

function InputWithIcon({ icon: Icon, iconColor = '#4A5180', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType; iconColor?: string }) {
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

  const selectedService = SERVICES.find(s => s.id === data.serviceId)

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
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 400))
    const order = storeInsert({
      service:         selectedService?.name ?? '',
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
      price:           selectedService?.price ?? 0,
      status:          'pending',
      payment_status:  'unpaid',
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
          franchiseeName,
          files:          filesPayload,
        }),
      })
    } catch (e) {
      console.warn('send-order email failed:', e)
    }

    // ── Sauvegarde Supabase ────────────────────────────────
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('orders').insert({
          user_id:         user.id,
          service:         order.service,
          client_name:     order.client_name,
          client_email:    order.client_email,
          client_phone:    order.client_phone    ?? null,
          company_name:    order.company_name    ?? null,
          company_email:   order.company_email   ?? null,
          sector:          order.sector          ?? null,
          vat_number:      order.vat_number      ?? null,
          website:         order.website         ?? null,
          instagram:       order.instagram       ?? null,
          facebook:        order.facebook        ?? null,
          tiktok:          order.tiktok          ?? null,
          brief:           order.brief           ?? null,
          objectives:      order.objectives      ?? null,
          required_access: order.required_access ?? null,
          price:           order.price,
          status:          'pending',
          payment_status:  'unpaid',
        })
      }
    } catch (e) {
      console.warn('Supabase order insert failed:', e)
    }

    // ── Notification locale ────────────────────────────────
    notifInsert({
      type:    'order_placed',
      title:   `Commande ${order.ref} envoyée`,
      message: `${order.service} pour ${order.company_name || order.client_name} — €${order.price.toLocaleString('fr-FR')}`,
      link:    '/commandes',
    })

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
          <h2 className="text-2xl font-bold text-[#F0F2FF] mb-2">Commande enregistrée !</h2>
          {newOrderRef && <p className="text-[13px] font-mono text-[#6AAEE5] mb-1">{newOrderRef}</p>}
          <p className="text-[#8B95C4] mb-2">Votre commande est en attente de traitement.</p>
          <p className="text-[12px] text-[#4A5180] mb-6">Le paiement sera configuré prochainement via Stripe.</p>
          <div className="flex gap-3 justify-center">
            <a href="/commandes"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6AAEE5] to-[#4A7DC4] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              Voir mes commandes
            </a>
            <button
              onClick={() => { setSubmitted(false); setCurrent(1); setData({}); setNewOrderRef('') }}
              className="px-6 py-2.5 rounded-xl bg-[rgba(106,174,229,0.12)] border border-[rgba(106,174,229,0.3)] text-[#6AAEE5] text-sm font-medium hover:bg-[rgba(106,174,229,0.2)] transition-colors">
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
        <p className="text-xs font-semibold uppercase tracking-widest text-[#4A5180] mb-1">Nouvelle commande</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Commander un service</h1>
        <p className="text-sm text-[#8B95C4] mt-1">Complétez les étapes ci-dessous pour soumettre votre commande.</p>
      </div>

      {/* Stepper */}
      <div className="rounded-2xl border border-[#b8c4e8] p-4" style={{ background: 'linear-gradient(135deg, #8292d8 0%, #aab7e6 50%, #cdd3f0 100%)' }}>
        <div className="flex items-center justify-between overflow-x-auto gap-1 pb-1 md:pb-0">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
              <StepIndicator step={step} current={current} />
              {i < STEPS.length - 1 && (
                <div className={cn('h-px w-6 md:w-10 transition-all duration-500 flex-shrink-0',
                  step.id < current ? 'bg-white/80' : 'bg-white/25')} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-[#b8c4e8] overflow-hidden" style={{ background: 'linear-gradient(160deg, #cdd3f0 0%, #aab7e6 45%, #8292d8 100%)' }}>
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
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/75 mb-3 flex items-center gap-2">
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
                  </div>
                </div>

                {/* Séparateur */}
                <div className="h-px bg-[rgba(107,174,229,0.08)]" />

                {/* Bloc entreprise */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/75 mb-3 flex items-center gap-2">
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
                        <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5180] pointer-events-none" />
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

                <div className="h-px bg-[rgba(107,174,229,0.08)]" />

                {/* Bloc présence en ligne */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/75 mb-3 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" /> Présence en ligne
                    <span className="ml-1 text-[10px] font-medium text-white/50 normal-case tracking-normal">(facultatif)</span>
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

            {/* ── STEP 2: Service ── */}
            {current === 2 && (
              <div className="space-y-6">
                <StepHeader icon={Briefcase} color="#4A7DC4" title="Sélection du service"
                  subtitle="Choisissez le service à commander pour ce client." />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SERVICES.map((svc) => {
                    const Icon   = svc.icon
                    const active = data.serviceId === svc.id
                    return (
                      <button key={svc.id} onClick={() => setData(d => ({ ...d, serviceId: svc.id }))}
                        className={cn(
                          'relative text-left rounded-xl border p-4 transition-all duration-200 group',
                          active ? 'bg-[rgba(106,174,229,0.1)] border-[rgba(106,174,229,0.4)]'
                                 : 'bg-[#1D2240] border-[rgba(107,174,229,0.1)] hover:border-[rgba(107,174,229,0.25)] hover:bg-[#222848]'
                        )}
                      >
                        {svc.popular && !active && (
                          <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[rgba(106,174,229,0.15)] text-[#6AAEE5] border border-[rgba(106,174,229,0.3)]">
                            Populaire
                          </span>
                        )}
                        {active && (
                          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#6AAEE5] flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 mt-0.5"
                            style={{ background: `${svc.iconColor}18` }}>
                            <Icon className="w-4 h-4" style={{ color: svc.iconColor }} strokeWidth={1.75} />
                          </div>
                          <div className="min-w-0">
                            <p className={cn('text-[13px] font-semibold mb-0.5', active ? 'text-[#F0F2FF]' : 'text-[#8B95C4] group-hover:text-[#F0F2FF]')}>
                              {svc.name}
                            </p>
                            <p className="text-[11px] text-[#4A5180] leading-relaxed">{svc.description}</p>
                            <p className="text-[12px] font-semibold mt-2" style={{ color: svc.iconColor }}>
                              {formatPrice(svc.price)}{svc.type === 'subscription' ? '/mois' : ''}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <NavButtons
                  onNext={() => { if (data.serviceId) go(1) }}
                  onPrev={() => go(-1)}
                  nextDisabled={!data.serviceId}
                  nextLabel={data.serviceId ? `Choisir — ${selectedService?.name}` : 'Sélectionnez un service'}
                />
              </div>
            )}

            {/* ── STEP 3: Brief + objectifs + accès ── */}
            {current === 3 && (
              <div className="space-y-6">
                <StepHeader icon={FileText} color="#8B5CF6" title="Brief du projet"
                  subtitle="Décrivez le projet, les objectifs et les accès nécessaires." />

                <FieldWrapper label="Description du projet" required error={form3.formState.errors.brief?.message}>
                  <textarea
                    {...form3.register('brief')}
                    rows={5}
                    className={cn(inputBase, 'resize-none leading-relaxed', form3.formState.errors.brief && inputErr)}
                    placeholder={`Décrivez le projet en détail :
— Contexte et besoins
— Style souhaité, références visuelles
— Contraintes techniques ou délais`}
                  />
                  <p className="text-[11px] text-[#4A5180] text-right mt-1">
                    {form3.watch('brief')?.length ?? 0} / 20 min
                  </p>
                </FieldWrapper>

                <FieldWrapper label="Objectifs" error={form3.formState.errors.objectives?.message}>
                  <div className="relative">
                    <Target className="absolute left-3.5 top-3.5 w-4 h-4 text-[#4A5180] pointer-events-none" />
                    <textarea
                      {...form3.register('objectives')}
                      rows={3}
                      className={cn(inputBase, 'resize-none leading-relaxed pl-10')}
                      placeholder={`Ex : Augmenter les demandes de devis de 30%
Améliorer la visibilité sur Google
Moderniser l'image de marque`}
                    />
                  </div>
                </FieldWrapper>

                <FieldWrapper label="Accès nécessaires" error={form3.formState.errors.requiredAccess?.message}>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-[#4A5180] pointer-events-none" />
                    <textarea
                      {...form3.register('requiredAccess')}
                      rows={3}
                      className={cn(inputBase, 'resize-none leading-relaxed pl-10')}
                      placeholder={`Ex : Accès Google Analytics
Identifiants CMS (WordPress, Shopify…)
Accès hébergeur / FTP
Compte Google Search Console`}
                    />
                  </div>
                </FieldWrapper>

                <NavButtons onNext={handleStep3} onPrev={() => go(-1)} />
              </div>
            )}

            {/* ── STEP 4: Fichiers ── */}
            {current === 4 && (
              <div className="space-y-6">
                <StepHeader icon={Upload} color="#F59E0B" title="Fichiers & assets"
                  subtitle="Uploadez les fichiers nécessaires (logo, images, documents…)" />
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  className={cn(
                    'border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer',
                    dragOver ? 'border-[#6AAEE5] bg-[rgba(106,174,229,0.08)]'
                             : 'border-[rgba(107,174,229,0.2)] hover:border-[rgba(107,174,229,0.4)] hover:bg-[rgba(107,174,229,0.03)]'
                  )}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <input id="file-input" type="file" multiple className="hidden"
                    onChange={e => setData(d => ({ ...d, files: [...(d.files ?? []), ...Array.from(e.target.files ?? [])] }))} />
                  <Upload className={cn('w-8 h-8 mx-auto mb-3 transition-colors', dragOver ? 'text-[#6AAEE5]' : 'text-[#4A5180]')} />
                  <p className="text-sm font-medium text-[#8B95C4]">{dragOver ? 'Relâchez pour déposer' : 'Glissez-déposez vos fichiers ici'}</p>
                  <p className="text-[11px] text-[#4A5180] mt-1">ou <span className="text-[#6AAEE5] underline">parcourir</span> — PNG, JPG, PDF, AI, ZIP</p>
                </div>
                {(data.files?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    {data.files!.map((file, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#1D2240] border border-[rgba(107,174,229,0.1)]">
                        <div className="w-7 h-7 rounded-lg bg-[rgba(106,174,229,0.1)] flex items-center justify-center flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-[#6AAEE5]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#F0F2FF] truncate">{file.name}</p>
                          <p className="text-[11px] text-[#4A5180]">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button onClick={() => removeFile(i)} className="p-1 rounded-lg text-[#4A5180] hover:text-red-400 hover:bg-red-500/10 transition-colors">
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
                  subtitle="Choisissez comment régler cette commande." />
                {selectedService && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PaymentCard mode="one-shot" selected={data.paymentMode === 'one-shot'}
                      onSelect={() => setData(d => ({ ...d, paymentMode: 'one-shot' }))}
                      icon={Zap} title="Paiement unique"
                      description="Réglez la totalité en une fois. Accès immédiat dès confirmation."
                      price={formatPrice(selectedService.price)} badge="Ponctuel" badgeColor="#6AAEE5" />
                    <PaymentCard mode="subscription" selected={data.paymentMode === 'subscription'}
                      onSelect={() => setData(d => ({ ...d, paymentMode: 'subscription' }))}
                      icon={CreditCard} title="Abonnement mensuel"
                      description="Étalez le paiement mois par mois. Résiliable à tout moment."
                      price={`${formatPrice(Math.ceil(selectedService.price / 3))}/mois`}
                      badge="Récurrent" badgeColor="#22C55E" />
                  </div>
                )}
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A5180] pb-1 mb-1">Contact client</p>
                  <SummaryRow label="Nom client"   value={data.clientName  ?? '—'} />
                  <SummaryRow label="Email client" value={data.clientEmail ?? '—'} />
                  {data.clientPhone && <SummaryRow label="Téléphone" value={data.clientPhone} />}

                  <div className="h-px bg-[rgba(107,174,229,0.08)] my-2" />

                  {/* Entreprise */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A5180] pb-1 mb-1">Entreprise</p>
                  <SummaryRow label="Nom entreprise"   value={data.companyName  ?? '—'} />
                  {data.companyEmail && <SummaryRow label="Email entreprise" value={data.companyEmail} />}
                  {data.sector      && <SummaryRow label="Secteur"           value={data.sector} />}
                  {data.vatNumber   && <SummaryRow label="N° TVA"            value={data.vatNumber} />}

                  {/* Présence en ligne */}
                  {(data.website || data.instagram || data.facebook || data.tiktok) && (
                    <>
                      <div className="h-px bg-[rgba(107,174,229,0.08)] my-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A5180] pb-1 mb-1">Présence en ligne</p>
                      {data.website   && <SummaryRow label="Site web"   value={data.website} />}
                      {data.instagram && <SummaryRow label="Instagram"  value={data.instagram} />}
                      {data.facebook  && <SummaryRow label="Facebook"   value={data.facebook} />}
                      {data.tiktok    && <SummaryRow label="TikTok"     value={data.tiktok} />}
                    </>
                  )}

                  <div className="h-px bg-[rgba(107,174,229,0.08)] my-2" />

                  {/* Service */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A5180] pb-1 mb-1">Service</p>
                  <SummaryRow label="Service"  value={selectedService?.name ?? '—'} />
                  <SummaryRow label="Paiement" value={data.paymentMode === 'subscription' ? 'Abonnement mensuel' : 'Paiement unique'} />
                  <SummaryRow label="Montant"
                    value={data.paymentMode === 'subscription'
                      ? `${formatPrice(Math.ceil((selectedService?.price ?? 0) / 3))}/mois`
                      : formatPrice(selectedService?.price)}
                    highlight />

                  {/* Brief */}
                  {data.brief && (
                    <>
                      <div className="h-px bg-[rgba(107,174,229,0.08)] my-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A5180] pb-1">Projet</p>
                      <div className="py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#4A5180]">Description</span>
                        <p className="text-[13px] text-[#8B95C4] mt-1 leading-relaxed line-clamp-3">{data.brief}</p>
                      </div>
                    </>
                  )}
                  {data.objectives && (
                    <div className="py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#4A5180]">Objectifs</span>
                      <p className="text-[13px] text-[#8B95C4] mt-1 leading-relaxed line-clamp-2">{data.objectives}</p>
                    </div>
                  )}
                  {data.requiredAccess && (
                    <div className="py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#4A5180]">Accès nécessaires</span>
                      <p className="text-[13px] text-[#8B95C4] mt-1 leading-relaxed line-clamp-2">{data.requiredAccess}</p>
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
                    style={{ background: 'linear-gradient(135deg, #6AAEE5 0%, #4A7DC4 50%, #2B3580 100%)', boxShadow: '0 0 32px rgba(106,174,229,0.3)' }}
                  >
                    {submitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</>
                      : <><CheckCircle2 className="w-4 h-4" /> Confirmer la commande <ChevronRight className="w-4 h-4" /></>
                    }
                  </button>
                  <p className="text-center text-[11px] text-[#4A5180] mt-2.5">Le paiement Stripe sera activé prochainement</p>
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
    <div className="flex items-start gap-4 pb-2 border-b border-white/20">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 bg-white/25">
        <Icon className="w-5 h-5 text-white" strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-white/70">{subtitle}</p>
      </div>
    </div>
  )
}

function NavButtons({ onNext, onPrev, nextDisabled, nextLabel = 'Continuer', disablePrev = false, hideNext = false }: {
  onNext?: () => void; onPrev?: () => void; nextDisabled?: boolean
  nextLabel?: string; disablePrev?: boolean; hideNext?: boolean
}) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-white/20">
      <button onClick={onPrev} disabled={disablePrev}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
        <ChevronLeft className="w-4 h-4" /> Retour
      </button>
      {!hideNext && (
        <button onClick={onNext} disabled={nextDisabled}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: nextDisabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.95)', color: nextDisabled ? 'rgba(255,255,255,0.5)' : '#2d2d60' }}>
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
        selected ? 'bg-[rgba(106,174,229,0.1)] border-[rgba(106,174,229,0.4)]'
                 : 'bg-[#1D2240] border-[rgba(107,174,229,0.12)] hover:border-[rgba(107,174,229,0.3)]')}>
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
        <p className="text-[14px] font-bold text-[#F0F2FF]">{title}</p>
      </div>
      <p className="text-[12px] text-[#4A5180] leading-relaxed mb-3">{description}</p>
      <p className="text-[20px] font-bold" style={{ color: badgeColor }}>{price}</p>
    </button>
  )
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-widest text-[#4A5180]">{label}</span>
      <span className={cn('text-[14px] font-semibold text-right max-w-[60%] truncate', highlight ? 'text-[#6AAEE5]' : 'text-[#F0F2FF]')}>
        {value}
      </span>
    </div>
  )
}
