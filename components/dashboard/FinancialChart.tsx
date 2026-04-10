'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { TrendingUp, Target, Euro, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────
export interface FinancialChartPoint {
  key: string
  label: string
  theoretical: number
  real: number
  cost: number
  profit: number
}

export interface FinancialChartProps {
  data: FinancialChartPoint[]
  loading?: boolean
  className?: string
}

type ChartMode = 'comparison' | 'profit' | 'cumulative'

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return '€' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '€' + (n / 1_000).toFixed(1) + 'k'
  return '€' + n.toFixed(0)
}

const fmtFull = (n: number) =>
  '€' + Math.round(n).toLocaleString('fr-FR')

// ───────────────────────────────────────────────────────────────
// Custom tooltip
// ───────────────────────────────────────────────────────────────
interface TooltipPayload {
  dataKey?: string | number
  value?: number | string
  name?: string
  color?: string
}
interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string | number
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const getVal = (key: string): number => {
    const found = payload.find(p => p.dataKey === key)
    return Number(found?.value ?? 0)
  }
  const theo = getVal('theoretical')
  const real = getVal('real')
  const cost = getVal('cost')
  const profit = getVal('profit')
  const variance = theo - real

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl bg-white border border-[#E2E8F2] shadow-[0_8px_24px_rgba(45,45,96,0.12)] px-4 py-3 min-w-[180px]"
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-[#8B95C4]">
            <span className="w-2 h-2 rounded-full bg-[#8B95C4]" />
            CA théorique
          </span>
          <span className="font-bold font-mono tabular-nums text-[#2d2d60]">{fmtFull(theo)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-[#6AAEE5]">
            <span className="w-2 h-2 rounded-full bg-[#6AAEE5]" />
            CA réel
          </span>
          <span className="font-bold font-mono tabular-nums text-[#2d2d60]">{fmtFull(real)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-[#EF4444]">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            Coût
          </span>
          <span className="font-bold font-mono tabular-nums text-[#2d2d60]">{fmtFull(cost)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px] pt-1.5 border-t border-[#F0F3F8]">
          <span className="flex items-center gap-1.5 text-[#22C55E] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            Bénéfice
          </span>
          <span className="font-bold font-mono tabular-nums text-[#22C55E]">{fmtFull(profit)}</span>
        </div>
        {Math.abs(variance) >= 1 && (
          <div className="pt-1 text-[10px]" style={{ color: variance > 0 ? '#EF4444' : '#22C55E' }}>
            Écart : {variance > 0 ? '−' : '+'}{fmtFull(Math.abs(variance))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ───────────────────────────────────────────────────────────────
// Composant principal
// ───────────────────────────────────────────────────────────────
export function FinancialChart({ data, loading, className }: FinancialChartProps) {
  const [mode, setMode] = useState<ChartMode>('comparison')

  // Totaux de la période affichée
  const totals = useMemo(() => {
    return data.reduce(
      (acc, p) => ({
        theoretical: acc.theoretical + p.theoretical,
        real: acc.real + p.real,
        cost: acc.cost + p.cost,
        profit: acc.profit + p.profit,
      }),
      { theoretical: 0, real: 0, cost: 0, profit: 0 }
    )
  }, [data])

  // Données cumulatives
  const cumulativeData = useMemo(() => {
    let cumTheo = 0
    let cumReal = 0
    let cumProfit = 0
    return data.map(p => {
      cumTheo += p.theoretical
      cumReal += p.real
      cumProfit += p.profit
      return {
        ...p,
        theoretical: cumTheo,
        real: cumReal,
        profit: cumProfit,
      }
    })
  }, [data])

  const activeData = mode === 'cumulative' ? cumulativeData : data
  const hasData = data.some(p => p.theoretical > 0 || p.real > 0)

  const tabs: { key: ChartMode; label: string; icon: React.ElementType }[] = [
    { key: 'comparison', label: 'Comparaison', icon: Target },
    { key: 'profit', label: 'Bénéfice', icon: TrendingUp },
    { key: 'cumulative', label: 'Cumulé', icon: ArrowDownRight },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'rounded-2xl border border-[#E2E8F2] bg-white shadow-[0_1px_3px_rgba(45,45,96,0.07)] overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 border-b border-[#F0F3F8] bg-gradient-to-r from-[#F8FAFC] to-white flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
            Performance financière
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-[26px] font-bold text-[#2d2d60] font-mono tabular-nums leading-none">
              {fmtFull(totals.real)}
            </p>
            <p className="text-[12px] text-[#9CA3AF]">
              sur <span className="font-semibold text-[#6B7280]">{fmtFull(totals.theoretical)}</span> théoriques
            </p>
            {totals.theoretical > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background:
                    totals.theoretical > totals.real
                      ? 'rgba(239,68,68,0.1)'
                      : 'rgba(34,197,94,0.1)',
                  color: totals.theoretical > totals.real ? '#EF4444' : '#22C55E',
                }}
              >
                {((totals.real / totals.theoretical) * 100).toFixed(1)}% du conseil
              </span>
            )}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] flex-shrink-0">
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = mode === key
            return (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                  active
                    ? 'bg-white text-[#2d2d60] shadow-sm border border-[#E2E8F2]'
                    : 'text-[#9CA3AF] hover:text-[#2d2d60]',
                )}
              >
                <Icon className="w-3 h-3" strokeWidth={2} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="p-5">
        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#E2E8F2] border-t-[#6AAEE5] animate-spin" />
          </div>
        ) : !hasData ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F7FA] flex items-center justify-center mb-3">
              <Euro className="w-6 h-6 text-[#9CA3AF]" />
            </div>
            <p className="text-[13px] font-semibold text-[#6B7280]">Pas encore de données</p>
            <p className="text-[11px] text-[#9CA3AF] mt-1">
              Les commandes finalisées apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="w-full" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activeData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-real" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6AAEE5" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6AAEE5" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="grad-theoretical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B95C4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8B95C4" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="grad-profit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#F0F3F8" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }}
                  dy={6}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  tickFormatter={fmtShort}
                  width={50}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(106,174,229,0.05)' }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: 10, fontSize: 11, fontWeight: 500 }}
                />

                {mode === 'comparison' && (
                  <>
                    <Bar
                      dataKey="theoretical"
                      name="CA théorique"
                      fill="url(#grad-theoretical)"
                      stroke="#8B95C4"
                      strokeWidth={1.5}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                      animationDuration={800}
                    />
                    <Bar
                      dataKey="real"
                      name="CA réel"
                      fill="url(#grad-real)"
                      stroke="#6AAEE5"
                      strokeWidth={1.5}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                      animationDuration={800}
                      animationBegin={100}
                    />
                  </>
                )}

                {mode === 'profit' && (
                  <>
                    <Bar
                      dataKey="cost"
                      name="Coût"
                      fill="#EF4444"
                      fillOpacity={0.25}
                      stroke="#EF4444"
                      strokeWidth={1.5}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                      animationDuration={800}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Bénéfice"
                      stroke="#22C55E"
                      strokeWidth={3}
                      dot={{ fill: '#22C55E', r: 4 }}
                      activeDot={{ r: 6 }}
                      animationDuration={1000}
                    />
                  </>
                )}

                {mode === 'cumulative' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="theoretical"
                      name="CA théo (cumulé)"
                      fill="url(#grad-theoretical)"
                      stroke="#8B95C4"
                      strokeWidth={2}
                      animationDuration={1000}
                    />
                    <Area
                      type="monotone"
                      dataKey="real"
                      name="CA réel (cumulé)"
                      fill="url(#grad-real)"
                      stroke="#6AAEE5"
                      strokeWidth={2}
                      animationDuration={1000}
                      animationBegin={200}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Bénéfice cumulé"
                      stroke="#22C55E"
                      strokeWidth={2.5}
                      dot={{ fill: '#22C55E', r: 3 }}
                      animationDuration={1000}
                      animationBegin={400}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Légende des totaux */}
        {hasData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-4 border-t border-[#F0F3F8]">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-[#9CA3AF] mb-0.5">CA théorique</p>
              <p className="text-[13px] font-bold text-[#8B95C4] font-mono tabular-nums">{fmtFull(totals.theoretical)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-[#9CA3AF] mb-0.5">CA réel</p>
              <p className="text-[13px] font-bold text-[#6AAEE5] font-mono tabular-nums">{fmtFull(totals.real)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-[#9CA3AF] mb-0.5">Coût total</p>
              <p className="text-[13px] font-bold text-[#EF4444] font-mono tabular-nums">{fmtFull(totals.cost)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-[#9CA3AF] mb-0.5">Bénéfice</p>
              <p className="text-[13px] font-bold text-[#22C55E] font-mono tabular-nums">{fmtFull(totals.profit)}</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
