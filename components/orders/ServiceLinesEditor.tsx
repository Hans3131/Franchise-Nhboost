'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, ChevronDown, Check, Package, AlertTriangle,
  Target, Euro, ArrowDownRight, ArrowUpRight, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SERVICES } from '@/lib/services'

// Type minimal requis pour construire une ligne depuis un service catalogue
// (compatible avec les 2 types Service / ServiceCatalog du projet)
export interface ServicePickable {
  id: string
  name: string
  description: string
  internalCost: number
  salePrice: number
}

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────
export interface ServiceLine {
  id: string                      // uuid local (pour React key + manipulation)
  serviceSlug: string             // ex: 'site-onepage'
  serviceName: string
  unitRecommendedPrice: number    // figé au moment de la sélection
  unitCost: number                // figé au moment de la sélection
  quantity: number
  unitActualPrice: number         // éditable
}

export interface ServiceLinesEditorProps {
  lines: ServiceLine[]
  onChange: (lines: ServiceLine[]) => void
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
const fmt = (n: number) => '€' + Math.round(n).toLocaleString('fr-FR')

export function buildLineFromService(svc: ServicePickable): ServiceLine {
  return {
    id: crypto.randomUUID(),
    serviceSlug: svc.id,
    serviceName: svc.name,
    unitRecommendedPrice: svc.salePrice,
    unitCost: svc.internalCost,
    quantity: 1,
    unitActualPrice: svc.salePrice,
  }
}

// Calculs par ligne
export function computeLine(line: ServiceLine) {
  const qty = Math.max(1, line.quantity)
  const theoretical = line.unitRecommendedPrice * qty
  const real = line.unitActualPrice * qty
  const cost = line.unitCost * qty
  const profit = real - cost
  const variance = theoretical - real
  return { theoretical, real, cost, profit, variance, margin: real > 0 ? (profit / real) * 100 : 0 }
}

// Totaux sur toutes les lignes
export function computeTotals(lines: ServiceLine[]) {
  return lines.reduce(
    (acc, l) => {
      const c = computeLine(l)
      return {
        theoretical: acc.theoretical + c.theoretical,
        real: acc.real + c.real,
        cost: acc.cost + c.cost,
        profit: acc.profit + c.profit,
        variance: acc.variance + c.variance,
      }
    },
    { theoretical: 0, real: 0, cost: 0, profit: 0, variance: 0 }
  )
}

// Validation
export function validateLines(lines: ServiceLine[]): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (lines.length === 0) errors.push('Ajoutez au moins un service')
  lines.forEach((l, i) => {
    if (l.quantity < 1 || !Number.isFinite(l.quantity)) {
      errors.push(`Ligne ${i + 1} : quantité invalide`)
    }
    if (l.unitActualPrice < 0 || !Number.isFinite(l.unitActualPrice)) {
      errors.push(`Ligne ${i + 1} : prix réel invalide`)
    }
  })
  return { ok: errors.length === 0, errors }
}

// ───────────────────────────────────────────────────────────────
// Composant : sélecteur de service (dropdown)
// ───────────────────────────────────────────────────────────────
function ServicePicker({ onPick }: { onPick: (svc: ServicePickable) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[#6AAEE5]/30 bg-[rgba(106,174,229,0.04)] text-[13px] font-semibold text-[#6AAEE5] hover:border-[#6AAEE5] hover:bg-[rgba(106,174,229,0.08)] transition-all"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Ajouter un service
        </div>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute z-20 top-full left-0 right-0 mt-2 rounded-xl bg-white border border-[#E2E8F2] shadow-[0_8px_24px_rgba(45,45,96,0.12)] overflow-hidden max-h-[320px] overflow-y-auto"
          >
            {SERVICES.map(svc => (
              <button
                key={svc.id}
                type="button"
                onClick={() => {
                  onPick(svc)
                  setOpen(false)
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#F8FAFC] border-b border-[#F0F3F8] last:border-0 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#2d2d60] truncate">{svc.name}</p>
                  <p className="text-[11px] text-[#9CA3AF] truncate">{svc.description.slice(0, 60)}…</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-bold text-[#6AAEE5] font-mono">{fmt(svc.salePrice)}</p>
                  <p className="text-[10px] text-[#9CA3AF]">Marge {fmt(svc.salePrice - svc.internalCost)}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// Composant : une ligne de service éditable
// ───────────────────────────────────────────────────────────────
interface LineRowProps {
  line: ServiceLine
  index: number
  onUpdate: (patch: Partial<ServiceLine>) => void
  onRemove: () => void
}

function LineRow({ line, index, onUpdate, onRemove }: LineRowProps) {
  const calc = computeLine(line)
  const isSoldUnder = calc.variance > 0
  const isMatching = Math.abs(calc.variance) < 0.5

  const badgeColor = isMatching ? '#6AAEE5' : isSoldUnder ? '#EF4444' : '#22C55E'
  const badgeBg = isMatching
    ? 'rgba(106,174,229,0.1)'
    : isSoldUnder
      ? 'rgba(239,68,68,0.1)'
      : 'rgba(34,197,94,0.1)'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="rounded-2xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.06)] overflow-hidden"
    >
      {/* Header : nom service + index + delete */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#F0F3F8] bg-gradient-to-r from-[#F8FAFC] to-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6AAEE5] to-[#2B3580] flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold">
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#2d2d60] truncate">{line.serviceName}</p>
            <p className="text-[10px] text-[#9CA3AF] font-mono">{line.serviceSlug}</p>
          </div>
        </div>

        {/* Badge écart */}
        <motion.div
          key={`${isSoldUnder}-${isMatching}`}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {isMatching ? 'Prix conseil' : isSoldUnder ? `−${fmt(Math.abs(calc.variance))}` : `+${fmt(Math.abs(calc.variance))}`}
        </motion.div>

        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] transition-all flex-shrink-0"
          aria-label="Supprimer cette ligne"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Grid : 5 colonnes de saisie/affichage */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4">
        {/* Prix d'achat interne (readonly) */}
        <div className="rounded-xl bg-[rgba(239,68,68,0.04)] border border-[rgba(239,68,68,0.15)] px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#EF4444] mb-1">Prix d&apos;achat</p>
          <p className="text-[14px] font-bold text-[#2d2d60] font-mono tabular-nums">{fmt(line.unitCost)}</p>
          <p className="text-[9px] text-[#9CA3AF] mt-0.5">Interne</p>
        </div>

        {/* Prix conseillé (readonly) */}
        <div className="rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Prix conseillé</p>
          <p className="text-[14px] font-bold text-[#2d2d60] font-mono tabular-nums">{fmt(line.unitRecommendedPrice)}</p>
          <p className="text-[9px] text-[#9CA3AF] mt-0.5">Recommandation</p>
        </div>

        {/* Quantité (editable) */}
        <div className="rounded-xl bg-[rgba(139,92,246,0.05)] border border-[rgba(139,92,246,0.25)] px-3 py-2.5">
          <label className="text-[9px] font-semibold uppercase tracking-wider text-[#8B5CF6] mb-1 block">
            Quantité *
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={line.quantity}
            onChange={e => {
              const n = parseInt(e.target.value, 10)
              onUpdate({ quantity: Number.isFinite(n) && n >= 1 ? n : 1 })
            }}
            className="w-full bg-transparent outline-none text-[14px] font-bold text-[#2d2d60] font-mono tabular-nums"
          />
        </div>

        {/* Prix réel de vente (editable) */}
        <div className="rounded-xl bg-[rgba(106,174,229,0.06)] border border-[#6AAEE5]/30 px-3 py-2.5">
          <label className="text-[9px] font-semibold uppercase tracking-wider text-[#6AAEE5] mb-1 block">
            Prix réel *
          </label>
          <div className="flex items-center gap-1">
            <span className="text-[12px] font-bold text-[#2d2d60]">€</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={line.unitActualPrice}
              onChange={e => {
                const n = parseFloat(e.target.value)
                onUpdate({ unitActualPrice: Number.isFinite(n) && n >= 0 ? n : 0 })
              }}
              className="w-full bg-transparent outline-none text-[14px] font-bold text-[#2d2d60] font-mono tabular-nums"
            />
          </div>
        </div>

        {/* Bénéfice (calculé) */}
        <div
          className="rounded-xl border px-3 py-2.5"
          style={{
            background: calc.profit >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
            borderColor: calc.profit >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
          }}
        >
          <p
            className="text-[9px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: calc.profit >= 0 ? '#22C55E' : '#EF4444' }}
          >
            Bénéfice
          </p>
          <p
            className="text-[14px] font-bold font-mono tabular-nums"
            style={{ color: calc.profit >= 0 ? '#22C55E' : '#EF4444' }}
          >
            {fmt(calc.profit)}
          </p>
          <p className="text-[9px] text-[#9CA3AF] mt-0.5">Marge {calc.margin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Sous-totaux de la ligne */}
      <div className="grid grid-cols-3 gap-0 border-t border-[#F0F3F8]">
        <div className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px]">
          <Target className="w-3 h-3 text-[#9CA3AF]" />
          <span className="text-[#9CA3AF]">CA théo</span>
          <span className="font-bold text-[#2d2d60] font-mono tabular-nums">{fmt(calc.theoretical)}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] border-x border-[#F0F3F8] bg-[rgba(106,174,229,0.03)]">
          <Euro className="w-3 h-3 text-[#6AAEE5]" />
          <span className="text-[#6AAEE5]">CA réel</span>
          <span className="font-bold text-[#2d2d60] font-mono tabular-nums">{fmt(calc.real)}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] bg-[rgba(239,68,68,0.03)]">
          <ArrowDownRight className="w-3 h-3 text-[#EF4444]" />
          <span className="text-[#EF4444]">Coût</span>
          <span className="font-bold text-[#2d2d60] font-mono tabular-nums">{fmt(calc.cost)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ───────────────────────────────────────────────────────────────
// Composant principal : ServiceLinesEditor
// ───────────────────────────────────────────────────────────────
export function ServiceLinesEditor({ lines, onChange }: ServiceLinesEditorProps) {
  const totals = computeTotals(lines)
  const validation = validateLines(lines)

  const addLine = (svc: ServicePickable) => {
    onChange([...lines, buildLineFromService(svc)])
  }

  const updateLine = (id: string, patch: Partial<ServiceLine>) => {
    onChange(lines.map(l => (l.id === id ? { ...l, ...patch } : l)))
  }

  const removeLine = (id: string) => {
    onChange(lines.filter(l => l.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Empty state */}
      {lines.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl bg-[#F8FAFC] border-2 border-dashed border-[#E2E8F2] p-10 text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-[#E2E8F2] mx-auto mb-3 flex items-center justify-center">
            <Package className="w-5 h-5 text-[#9CA3AF]" />
          </div>
          <p className="text-[13px] font-semibold text-[#6B7280]">Aucun service ajouté</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1">
            Ajoutez au moins un service à cette commande
          </p>
        </motion.div>
      )}

      {/* Lignes existantes */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <LineRow
              key={line.id}
              line={line}
              index={i}
              onUpdate={patch => updateLine(line.id, patch)}
              onRemove={() => removeLine(line.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Sélecteur pour ajouter une ligne */}
      <ServicePicker onPick={addLine} />

      {/* Totaux globaux */}
      {lines.length > 0 && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl bg-gradient-to-br from-[#2d2d60] to-[#4a81a4] p-5 text-white shadow-[0_4px_16px_rgba(45,45,96,0.15)]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4" strokeWidth={2} />
              <h3 className="text-[11px] font-bold uppercase tracking-wider">Totaux de la commande</h3>
            </div>
            <span className="text-[11px] opacity-70">
              {lines.length} ligne{lines.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">CA théorique</p>
              <p className="text-[20px] font-bold font-mono tabular-nums">{fmt(totals.theoretical)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">CA réel</p>
              <p className="text-[20px] font-bold font-mono tabular-nums text-[#6AAEE5]">{fmt(totals.real)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Coût total</p>
              <p className="text-[20px] font-bold font-mono tabular-nums text-[#F59E0B]">{fmt(totals.cost)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Bénéfice réel</p>
              <p
                className="text-[20px] font-bold font-mono tabular-nums"
                style={{ color: totals.profit >= 0 ? '#22C55E' : '#EF4444' }}
              >
                {fmt(totals.profit)}
              </p>
            </div>
          </div>

          {/* Indicateur d'écart global */}
          {Math.abs(totals.variance) >= 0.5 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 pt-4 border-t border-white/20"
            >
              <div
                className="flex items-center gap-2 text-[12px] font-semibold"
                style={{ color: totals.variance > 0 ? '#FCA5A5' : '#86EFAC' }}
              >
                {totals.variance > 0 ? (
                  <ArrowDownRight className="w-4 h-4" />
                ) : (
                  <ArrowUpRight className="w-4 h-4" />
                )}
                Écart vs prix conseillés : {totals.variance > 0 ? '−' : '+'}
                {fmt(Math.abs(totals.variance))}
                <span className="opacity-60 font-normal">
                  ({totals.variance > 0 ? 'vendu sous le conseil' : 'vendu au-dessus'})
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Erreurs de validation */}
      <AnimatePresence>
        {!validation.ok && lines.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-xl bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.25)] px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-[#EF4444] mb-1">Corrections nécessaires</p>
                <ul className="text-[11px] text-[#EF4444] space-y-0.5">
                  {validation.errors.map(err => (
                    <li key={err}>• {err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicateur de validité */}
      {validation.ok && lines.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.2)] text-[11px] font-semibold text-[#22C55E]"
        >
          <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
          Toutes les lignes sont valides
        </motion.div>
      )}
    </div>
  )
}
