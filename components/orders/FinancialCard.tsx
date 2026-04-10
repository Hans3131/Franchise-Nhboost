'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, Euro, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────
export interface FinancialCardProps {
  /** Prix conseillé unitaire (du catalogue) */
  recommendedPrice: number
  /** Prix réellement facturé unitaire */
  actualPrice: number
  /** Coût interne unitaire NHBoost */
  internalCost: number
  /** Quantité commandée (défaut 1) */
  quantity?: number
  /** Taille : compacte pour les listes, large pour les pages détails */
  size?: 'compact' | 'large'
  className?: string
}

// ───────────────────────────────────────────────────────────────
// Hook : animation de nombre fluide
// ───────────────────────────────────────────────────────────────
function useAnimatedNumber(target: number, duration = 500) {
  const [value, setValue] = useState(target)
  const prevRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to = target
    if (from === to) return

    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(from + (to - from) * eased)
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
      else {
        prevRef.current = to
        setValue(to)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration])

  return value
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '€' + Math.round(n).toLocaleString('fr-FR')

// ───────────────────────────────────────────────────────────────
// Composant Metric : une cellule de KPI financier
// ───────────────────────────────────────────────────────────────
interface MetricProps {
  label: string
  value: number
  icon: React.ElementType
  color: string
  accent?: 'neutral' | 'primary' | 'danger' | 'success'
  subtitle?: string
  size: 'compact' | 'large'
}

function Metric({ label, value, icon: Icon, color, accent = 'neutral', subtitle, size }: MetricProps) {
  const animated = useAnimatedNumber(value)
  const isLarge = size === 'large'

  const accentBg = {
    neutral: 'bg-white border-[#E2E8F2]',
    primary: 'bg-gradient-to-br from-[rgba(106,174,229,0.08)] to-[rgba(43,53,128,0.04)] border-[#6AAEE5]/25',
    success: 'bg-gradient-to-br from-[rgba(34,197,94,0.08)] to-[rgba(34,197,94,0.02)] border-[#22C55E]/25',
    danger:  'bg-gradient-to-br from-[rgba(239,68,68,0.08)] to-[rgba(239,68,68,0.02)] border-[#EF4444]/25',
  }[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'rounded-xl border relative overflow-hidden',
        accentBg,
        isLarge ? 'px-5 py-4' : 'px-4 py-3',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: `${color}14`,
            width: isLarge ? 32 : 26,
            height: isLarge ? 32 : 26,
          }}
        >
          <Icon
            className={isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5'}
            style={{ color }}
            strokeWidth={1.9}
          />
        </div>
        <p
          className={cn(
            'font-semibold uppercase tracking-wider text-[#9CA3AF]',
            isLarge ? 'text-[10px]' : 'text-[9px]',
          )}
        >
          {label}
        </p>
      </div>

      <p
        className={cn(
          'font-bold font-mono text-[#2d2d60] leading-none tabular-nums',
          isLarge ? 'text-[22px]' : 'text-[17px]',
        )}
      >
        {fmt(animated)}
      </p>

      {subtitle && (
        <p
          className={cn(
            'mt-1 text-[#9CA3AF] font-medium',
            isLarge ? 'text-[11px]' : 'text-[10px]',
          )}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}

// ───────────────────────────────────────────────────────────────
// Composant principal : FinancialCard
// ───────────────────────────────────────────────────────────────
export function FinancialCard({
  recommendedPrice,
  actualPrice,
  internalCost,
  quantity = 1,
  size = 'compact',
  className,
}: FinancialCardProps) {
  const qty = Math.max(1, quantity)
  const theoreticalRevenue = recommendedPrice * qty
  const realRevenue = actualPrice * qty
  const totalCost = internalCost * qty
  const realProfit = realRevenue - totalCost
  const variance = theoreticalRevenue - realRevenue

  // Calcul du pourcentage de marge
  const marginPct = realRevenue > 0 ? (realProfit / realRevenue) * 100 : 0

  // Écart en pourcentage
  const variancePct = theoreticalRevenue > 0 ? (variance / theoreticalRevenue) * 100 : 0

  // Badge : rouge si vendu sous le conseil (variance > 0), vert si au-dessus ou égal
  const isSoldUnder = variance > 0
  const isMatching = Math.abs(variance) < 0.5
  const badgeConfig = isMatching
    ? {
        color: '#6AAEE5',
        bg: 'rgba(106,174,229,0.1)',
        border: 'rgba(106,174,229,0.3)',
        icon: Target,
        label: 'Aligné',
        description: 'Commande au prix conseillé',
      }
    : isSoldUnder
      ? {
          color: '#EF4444',
          bg: 'rgba(239,68,68,0.1)',
          border: 'rgba(239,68,68,0.3)',
          icon: TrendingDown,
          label: `−${fmt(Math.abs(variance))}`,
          description: `Vendu ${variancePct.toFixed(1)}% sous le prix conseillé`,
        }
      : {
          color: '#22C55E',
          bg: 'rgba(34,197,94,0.1)',
          border: 'rgba(34,197,94,0.3)',
          icon: TrendingUp,
          label: `+${fmt(Math.abs(variance))}`,
          description: `Vendu ${Math.abs(variancePct).toFixed(1)}% au-dessus du conseillé`,
        }
  const BadgeIcon = badgeConfig.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl bg-white border border-[#E2E8F2] overflow-hidden',
        'shadow-[0_1px_3px_rgba(45,45,96,0.06)]',
        className,
      )}
    >
      {/* Header : titre + qty + badge écart */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#F0F3F8] bg-gradient-to-r from-[#F8FAFC] to-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6AAEE5] to-[#2B3580] flex items-center justify-center flex-shrink-0">
            <Wallet className="w-3.5 h-3.5 text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2d2d60]">
              Analyse financière
            </p>
            {qty > 1 && (
              <p className="text-[10px] text-[#9CA3AF]">
                Quantité : <span className="font-semibold text-[#6B7280]">{qty}</span>
              </p>
            )}
          </div>
        </div>

        {/* Badge écart */}
        <motion.div
          key={`${isSoldUnder}-${isMatching}`}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'backOut' }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border flex-shrink-0"
          style={{
            background: badgeConfig.bg,
            color: badgeConfig.color,
            borderColor: badgeConfig.border,
          }}
        >
          <BadgeIcon className="w-3 h-3" strokeWidth={2.5} />
          {badgeConfig.label}
        </motion.div>
      </div>

      {/* Grille 2×2 des métriques */}
      <div className={cn('grid grid-cols-2 gap-3 p-5', size === 'large' && 'sm:grid-cols-4')}>
        <Metric
          label="CA théorique"
          value={theoreticalRevenue}
          icon={Target}
          color="#8B95C4"
          accent="neutral"
          subtitle={qty > 1 ? `${fmt(recommendedPrice)} × ${qty}` : 'Prix conseillé'}
          size={size}
        />
        <Metric
          label="CA réel"
          value={realRevenue}
          icon={Euro}
          color="#6AAEE5"
          accent="primary"
          subtitle={qty > 1 ? `${fmt(actualPrice)} × ${qty}` : 'Prix facturé'}
          size={size}
        />
        <Metric
          label="Coût total"
          value={totalCost}
          icon={ArrowDownRight}
          color="#EF4444"
          accent="danger"
          subtitle={qty > 1 ? `${fmt(internalCost)} × ${qty}` : 'Coût interne'}
          size={size}
        />
        <Metric
          label="Bénéfice réel"
          value={realProfit}
          icon={realProfit >= 0 ? ArrowUpRight : ArrowDownRight}
          color={realProfit >= 0 ? '#22C55E' : '#EF4444'}
          accent={realProfit >= 0 ? 'success' : 'danger'}
          subtitle={`Marge ${marginPct.toFixed(1)}%`}
          size={size}
        />
      </div>

      {/* Footer : description de l'écart */}
      <AnimatePresence mode="wait">
        <motion.div
          key={badgeConfig.description}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="border-t border-[#F0F3F8]"
        >
          <div
            className="flex items-center gap-2 px-5 py-2.5 text-[11px] font-medium"
            style={{ background: badgeConfig.bg, color: badgeConfig.color }}
          >
            <BadgeIcon className="w-3 h-3" strokeWidth={2.5} />
            {badgeConfig.description}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
