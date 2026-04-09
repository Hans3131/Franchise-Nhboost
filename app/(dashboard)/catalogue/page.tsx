'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  Target,
  Share2,
  Briefcase,
  Check,
  ChevronDown,
  Clock,
  Euro,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  ArrowRight,
} from 'lucide-react'
import { SERVICES, type ServiceCatalog } from '@/lib/services'
import { cn, formatPrice } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Icon mapping from string name to component                        */
/* ------------------------------------------------------------------ */
const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Globe,
  Target,
  Share2,
  Briefcase,
}

function ServiceIcon({
  iconName,
  iconColor,
  className,
}: {
  iconName: string
  iconColor: string
  className?: string
}) {
  const Icon = ICON_MAP[iconName] ?? Globe
  return <Icon style={{ color: iconColor }} className={cn('h-5 w-5', className)} />
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function CataloguePage() {
  const [selectedServiceId, setSelectedServiceId] = useState<string>(SERVICES[0].id)
  const [customPrices, setCustomPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(SERVICES.map((s) => [s.id, s.salePrice])),
  )
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null)

  const selectedService = SERVICES.find((s) => s.id === selectedServiceId) ?? SERVICES[0]
  const salePrice = customPrices[selectedService.id] ?? selectedService.salePrice

  /* Margin calculations */
  const margin = salePrice - selectedService.internalCost
  const marginRate = salePrice > 0 ? (margin / salePrice) * 100 : 0
  const isSubscription = selectedService.type === 'subscription'
  const commitmentMonths = selectedService.commitmentMonths ?? 1
  const contractTotal = salePrice * commitmentMonths
  const totalInternalCost = selectedService.internalCost * commitmentMonths
  const totalMargin = contractTotal - totalInternalCost
  const isNegativeMargin = salePrice < selectedService.internalCost

  function handlePriceChange(serviceId: string, value: string) {
    const num = parseFloat(value)
    setCustomPrices((prev) => ({ ...prev, [serviceId]: isNaN(num) ? 0 : num }))
  }

  return (
    <div className="min-h-screen space-y-8 p-6 md:p-10">
      {/* ------- Header ------- */}
      <div>
        <h1 className="text-3xl font-bold text-[#2d2d60]">Catalogue de services</h1>
        <p className="mt-1 text-sm text-[#2d2d60]/60">
          Explorez nos offres et calculez votre marge
        </p>
      </div>

      {/* ------- Simulateur de marge ------- */}
      <section className="rounded-2xl border border-[#E2E8F2] bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[#2d2d60]" />
          <h2 className="text-lg font-semibold text-[#2d2d60]">Simulateur de marge</h2>
        </div>

        {/* Service selector mini-cards */}
        <div className="mb-6 flex flex-wrap gap-3">
          {SERVICES.map((s) => {
            const active = s.id === selectedServiceId
            return (
              <button
                key={s.id}
                onClick={() => setSelectedServiceId(s.id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'border-[#2d2d60] bg-[#2d2d60] text-white shadow-md'
                    : 'border-[#E2E8F2] bg-[#F5F7FA] text-[#2d2d60] hover:border-[#2d2d60]/30',
                )}
              >
                <ServiceIcon iconName={s.iconName} iconColor={active ? '#fff' : s.iconColor} />
                <span className="hidden sm:inline">{s.name}</span>
              </button>
            )
          })}
        </div>

        {/* Calculator body */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedService.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="grid gap-6 md:grid-cols-2"
          >
            {/* Left: core pricing */}
            <div className="space-y-4">
              {/* Internal cost */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[#2d2d60]/50">
                  Prix interne NHBoost
                </label>
                <div className="flex items-center rounded-lg border border-[#E2E8F2] bg-[#F5F7FA] px-4 py-2.5 text-sm text-[#2d2d60]/60">
                  <Euro className="mr-2 h-4 w-4" />
                  {formatPrice(selectedService.internalCost)}
                </div>
              </div>

              {/* Sale price input */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[#2d2d60]/50">
                  Prix de vente
                </label>
                <div className="flex items-center rounded-lg border border-[#E2E8F2] bg-white px-4 py-2.5">
                  <Euro className="mr-2 h-4 w-4 text-[#2d2d60]/40" />
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={salePrice}
                    onChange={(e) => handlePriceChange(selectedService.id, e.target.value)}
                    className="w-full bg-transparent text-sm text-[#2d2d60] outline-none"
                  />
                </div>
              </div>

              {/* Gross margin */}
              <div className="flex items-center justify-between rounded-lg border border-[#E2E8F2] bg-[#F5F7FA] px-4 py-2.5">
                <span className="text-xs font-medium text-[#2d2d60]/50">Marge brute</span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isNegativeMargin ? 'text-red-500' : 'text-emerald-600',
                  )}
                >
                  {formatPrice(margin)}
                </span>
              </div>

              {/* Margin rate */}
              <div className="flex items-center justify-between rounded-lg border border-[#E2E8F2] bg-[#F5F7FA] px-4 py-2.5">
                <span className="text-xs font-medium text-[#2d2d60]/50">Taux de marge</span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isNegativeMargin ? 'text-red-500' : 'text-emerald-600',
                  )}
                >
                  {marginRate.toFixed(1)}&nbsp;%
                </span>
              </div>

              {/* Warning */}
              {isNegativeMargin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Attention : le prix de vente est inférieur au coût interne !
                </motion.div>
              )}
            </div>

            {/* Right: subscription extras or summary */}
            <div className="space-y-4">
              {isSubscription ? (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-[#E2E8F2] bg-[#F5F7FA] px-4 py-2.5">
                    <span className="text-xs font-medium text-[#2d2d60]/50">Prix mensuel</span>
                    <span className="text-sm font-semibold text-[#2d2d60]">
                      {formatPrice(salePrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[#E2E8F2] bg-[#F5F7FA] px-4 py-2.5">
                    <span className="text-xs font-medium text-[#2d2d60]/50">Engagement</span>
                    <span className="text-sm font-semibold text-[#2d2d60]">
                      {commitmentMonths} mois
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[#E2E8F2] bg-[#F5F7FA] px-4 py-2.5">
                    <span className="text-xs font-medium text-[#2d2d60]/50">Total contrat</span>
                    <span className="text-sm font-semibold text-[#2d2d60]">
                      {formatPrice(contractTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[#E2E8F2] bg-[#F5F7FA] px-4 py-2.5">
                    <span className="text-xs font-medium text-[#2d2d60]/50">
                      Marge totale sur engagement
                    </span>
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        totalMargin < 0 ? 'text-red-500' : 'text-emerald-600',
                      )}
                    >
                      {formatPrice(totalMargin)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-[#E2E8F2] bg-[#F5F7FA]/50 p-6 text-center">
                  <TrendingUp className="mb-2 h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-semibold text-[#2d2d60]">
                    Marge par vente : {formatPrice(margin)}
                  </p>
                  <p className="mt-1 text-xs text-[#2d2d60]/50">
                    Taux de marge : {marginRate.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* ------- Service cards grid ------- */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#2d2d60]">Nos services</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {SERVICES.map((service) => {
            const isExpanded = expandedServiceId === service.id
            return (
              <div key={service.id} className="flex flex-col">
                {/* Card */}
                <div className="rounded-2xl border border-[#E2E8F2] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${service.iconColor}18` }}
                      >
                        <ServiceIcon
                          iconName={service.iconName}
                          iconColor={service.iconColor}
                          className="h-5 w-5"
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#2d2d60]">{service.name}</h3>
                        <span
                          className={cn(
                            'mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
                            service.type === 'subscription'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-blue-50 text-blue-600',
                          )}
                        >
                          {service.type === 'subscription' ? 'Abonnement' : 'One-shot'}
                        </span>
                      </div>
                    </div>
                    <p className="text-right text-base font-bold text-[#2d2d60]">
                      {formatPrice(service.salePrice)}
                      {service.type === 'subscription' && (
                        <span className="block text-[10px] font-normal text-[#2d2d60]/50">
                          /mois
                        </span>
                      )}
                    </p>
                  </div>

                  <p className="mb-4 text-xs leading-relaxed text-[#2d2d60]/60">
                    {service.description}
                  </p>

                  <button
                    onClick={() =>
                      setExpandedServiceId(isExpanded ? null : service.id)
                    }
                    className="flex items-center gap-1.5 text-xs font-medium text-[#2d2d60] transition-colors hover:text-[#2d2d60]/70"
                  >
                    Voir d&eacute;tails
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        isExpanded && 'rotate-180',
                      )}
                    />
                  </button>
                </div>

                {/* Accordion detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <ServiceDetailFiche service={service} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Service detail fiche (accordion content)                          */
/* ------------------------------------------------------------------ */
function ServiceDetailFiche({ service }: { service: ServiceCatalog }) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  const margin = service.salePrice - service.internalCost
  const marginRate = service.salePrice > 0 ? (margin / service.salePrice) * 100 : 0

  return (
    <div className="mt-1 rounded-b-2xl border border-t-0 border-[#E2E8F2] bg-[#F5F7FA] p-5 space-y-5">
      {/* Long description */}
      <p className="text-xs leading-relaxed text-[#2d2d60]/70">{service.longDescription}</p>

      {/* Selling points */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-[#2d2d60]">Points forts</h4>
        <ul className="space-y-1.5">
          {service.sellingPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[#2d2d60]/70">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      {/* Deliverables */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-[#2d2d60]">Livrables</h4>
        <ul className="list-inside list-disc space-y-1 text-xs text-[#2d2d60]/70">
          {service.deliverables.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F2] bg-white px-4 py-2.5">
        <Clock className="h-4 w-4 text-[#2d2d60]/40" />
        <span className="text-xs text-[#2d2d60]/70">
          <span className="font-medium text-[#2d2d60]">Délai :</span> {service.timeline}
        </span>
      </div>

      {/* FAQ */}
      {service.faq.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-[#2d2d60]">Questions fréquentes</h4>
          <div className="space-y-1.5">
            {service.faq.map((item, i) => (
              <div
                key={i}
                className="rounded-lg border border-[#E2E8F2] bg-white"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-medium text-[#2d2d60]"
                >
                  {item.q}
                  <ChevronDown
                    className={cn(
                      'ml-2 h-3.5 w-3.5 shrink-0 text-[#2d2d60]/40 transition-transform',
                      openFaqIndex === i && 'rotate-180',
                    )}
                  />
                </button>
                <AnimatePresence>
                  {openFaqIndex === i && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="px-4 pb-3 text-xs text-[#2d2d60]/60">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing summary */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-[#E2E8F2] bg-white px-4 py-2 text-center">
          <p className="text-[10px] text-[#2d2d60]/50">Coût interne</p>
          <p className="text-sm font-semibold text-[#2d2d60]">
            {formatPrice(service.internalCost)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E2E8F2] bg-white px-4 py-2 text-center">
          <p className="text-[10px] text-[#2d2d60]/50">Prix de vente</p>
          <p className="text-sm font-semibold text-[#2d2d60]">
            {formatPrice(service.salePrice)}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-center">
          <p className="text-[10px] text-emerald-600/70">Marge ({marginRate.toFixed(0)}%)</p>
          <p className="text-sm font-semibold text-emerald-600">{formatPrice(margin)}</p>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/commander?service=${service.id}`}
        className="inline-flex items-center gap-2 rounded-xl bg-[#2d2d60] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2d2d60]/90"
      >
        <ShoppingCart className="h-4 w-4" />
        Commander ce service
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
