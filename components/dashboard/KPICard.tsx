'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  delta?: string
  trend?: 'up' | 'down' | 'neutral'
  icon: LucideIcon
  iconColor?: string
  index?: number
}

export default function KPICard({
  label,
  value,
  delta,
  trend = 'neutral',
  icon: Icon,
  iconColor = '#6AAEE5',
  index = 0,
}: KPICardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? '#22C55E' : trend === 'down' ? '#EF4444' : '#9CA3AF'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      className="relative group rounded-2xl bg-white border border-[#E2E8F2] p-5 overflow-hidden hover:shadow-[0_4px_16px_rgba(45,45,96,0.1)] transition-all duration-300 shadow-[0_1px_3px_rgba(45,45,96,0.07)]"
    >
      {/* Subtle top accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl opacity-70"
        style={{ background: `linear-gradient(90deg, ${iconColor}, transparent)` }}
      />

      {/* Top row */}
      <div className="flex items-start justify-between mb-4 mt-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
          {label}
        </span>
        <div
          className="flex items-center justify-center w-8 h-8 rounded-xl"
          style={{ background: `${iconColor}18` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.75} />
        </div>
      </div>

      {/* Value */}
      <div className="text-[26px] font-bold text-[#2d2d60] leading-none tracking-tight mb-3">
        {value}
      </div>

      {/* Delta */}
      {delta && (
        <div className="flex items-center gap-1.5">
          <TrendIcon className="w-3 h-3 flex-shrink-0" style={{ color: trendColor }} />
          <span className="text-[11px] font-medium" style={{ color: trendColor }}>
            {delta}
          </span>
          <span className="text-[11px] text-[#9CA3AF]">vs mois dernier</span>
        </div>
      )}
    </motion.div>
  )
}
