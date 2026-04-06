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
  const trendColor = trend === 'up' ? '#22C55E' : trend === 'down' ? '#EF4444' : '#8B95C4'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      className="relative group rounded-2xl bg-[#161A34] border border-[rgba(107,174,229,0.12)] p-5 overflow-hidden hover:border-[rgba(107,174,229,0.25)] transition-all duration-300"
    >
      {/* Glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(ellipse at top left, ${iconColor}08 0%, transparent 70%)` }}
      />

      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#4A5180]">
          {label}
        </span>
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: `${iconColor}14` }}
        >
          <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.75} />
        </div>
      </div>

      {/* Value */}
      <div className="text-[28px] font-bold text-[#F0F2FF] leading-none tracking-tight mb-3">
        {value}
      </div>

      {/* Delta */}
      {delta && (
        <div className="flex items-center gap-1.5">
          <TrendIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: trendColor }} />
          <span className="text-[12px] font-medium" style={{ color: trendColor }}>
            {delta}
          </span>
          <span className="text-[11px] text-[#4A5180]">vs mois dernier</span>
        </div>
      )}

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px opacity-40"
        style={{ background: `linear-gradient(90deg, transparent, ${iconColor}, transparent)` }}
      />
    </motion.div>
  )
}
