'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAll as getOrders, type LocalOrder } from '@/lib/orderStore'
import { cn } from '@/lib/utils'
// next/link available for future module detail pages
import {
  Target, BookOpen, Globe, Users, Settings, Award, Lock, Check,
  ChevronDown, Clock, BarChart3, GraduationCap,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────
type Difficulty = 'beginner' | 'intermediate' | 'advanced'
type ModuleStatus = 'not_started' | 'in_progress' | 'completed'

interface Module {
  id: string
  title: string
  description: string
  duration: string
  difficulty: Difficulty
}

interface Category {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>
  color: string
  modules: Module[]
}

// ─── Data ─────────────────────────────────────────────────────
const CATEGORIES: Category[] = [
  {
    id: 'vente', title: 'Techniques de vente', icon: Target, color: '#22C55E',
    modules: [
      { id: 'm1', title: 'Les bases du closing', description: 'Apprenez a conclure une vente efficacement', duration: '15 min', difficulty: 'beginner' },
      { id: 'm2', title: 'Gerer les objections', description: 'Repondre aux hesitations des prospects', duration: '20 min', difficulty: 'intermediate' },
      { id: 'm3', title: 'Script de vente Site Web', description: 'Script complet pour vendre un site One Page ou Complet', duration: '10 min', difficulty: 'beginner' },
      { id: 'm4', title: 'Script de vente Visibilite', description: "Argumentaire pour l'offre Visibilite 870\u20AC/mois", duration: '10 min', difficulty: 'beginner' },
    ],
  },
  {
    id: 'produit', title: 'Connaissance produit', icon: BookOpen, color: '#6AAEE5',
    modules: [
      { id: 'm5', title: 'Site One Page en detail', description: "Tout savoir sur l'offre Site One Page 970\u20AC", duration: '10 min', difficulty: 'beginner' },
      { id: 'm6', title: 'Site Complet en detail', description: "Maitrisez l'offre Site Complet 1470\u20AC", duration: '15 min', difficulty: 'beginner' },
      { id: 'm7', title: 'Offre Visibilite en detail', description: "Comprendre l'offre 870\u20AC/mois et ses livrables", duration: '15 min', difficulty: 'intermediate' },
      { id: 'm8', title: 'Accompagnement Premium', description: 'Le programme 4970\u20AC de A a Z', duration: '20 min', difficulty: 'advanced' },
    ],
  },
  {
    id: 'digital', title: 'Marketing digital', icon: Globe, color: '#8B5CF6',
    modules: [
      { id: 'm9', title: 'Introduction au SEO', description: 'Les bases du referencement naturel', duration: '20 min', difficulty: 'beginner' },
      { id: 'm10', title: 'Facebook Ads pour debutants', description: 'Creer sa premiere campagne publicitaire', duration: '25 min', difficulty: 'intermediate' },
      { id: 'm11', title: 'Google Ads essentials', description: 'Les fondamentaux de la publicite Google', duration: '25 min', difficulty: 'intermediate' },
    ],
  },
  {
    id: 'client', title: 'Relation client', icon: Users, color: '#F59E0B',
    modules: [
      { id: 'm12', title: 'Suivi client efficace', description: 'Comment suivre et fideliser vos clients', duration: '15 min', difficulty: 'beginner' },
      { id: 'm13', title: "Techniques d'upsell", description: 'Vendre des services complementaires', duration: '15 min', difficulty: 'intermediate' },
      { id: 'm14', title: 'Gerer un client mecontent', description: 'Transformer une plainte en opportunite', duration: '10 min', difficulty: 'advanced' },
    ],
  },
  {
    id: 'outils', title: 'Outils NHBoost', icon: Settings, color: '#14B8A6',
    modules: [
      { id: 'm15', title: 'Utiliser le CRM', description: 'Gerer vos clients dans le portail', duration: '10 min', difficulty: 'beginner' },
      { id: 'm16', title: 'Maitriser le Pipeline', description: 'Suivre vos prospects etape par etape', duration: '10 min', difficulty: 'beginner' },
      { id: 'm17', title: 'Passer une commande', description: 'Le processus de commande de A a Z', duration: '10 min', difficulty: 'beginner' },
      { id: 'm18', title: 'Utiliser le Secretaire IA', description: 'Generer devis et factures automatiquement', duration: '15 min', difficulty: 'intermediate' },
    ],
  },
]

const TOTAL_MODULES = CATEGORIES.reduce((s, c) => s + c.modules.length, 0)

const DIFFICULTY_LABELS: Record<Difficulty, { label: string; bg: string; text: string }> = {
  beginner:     { label: 'Debutant',      bg: '#DCFCE7', text: '#166534' },
  intermediate: { label: 'Intermediaire', bg: '#FEF3C7', text: '#92400E' },
  advanced:     { label: 'Avance',        bg: '#FEE2E2', text: '#991B1B' },
}

interface Badge {
  id: string
  label: string
  description: string
  icon: 'award'
  color: string
  check: (completedCount: number, orders: LocalOrder[], leaderboardRank: number) => boolean
}

const BADGES: Badge[] = [
  { id: 'b1', label: 'Premier pas', description: '1 module termine', icon: 'award', color: '#22C55E', check: (c) => c >= 1 },
  { id: 'b2', label: 'Apprenti vendeur', description: '5 modules termines', icon: 'award', color: '#6AAEE5', check: (c) => c >= 5 },
  { id: 'b3', label: 'Expert NHBoost', description: 'Tous les modules termines', icon: 'award', color: '#8B5CF6', check: (c) => c >= TOTAL_MODULES },
  { id: 'b4', label: 'Premiere vente', description: '1 commande terminee', icon: 'award', color: '#F59E0B', check: (_, o) => o.filter(x => x.status === 'completed').length >= 1 },
  { id: 'b5', label: 'Top performer', description: '10 000\u20AC de CA', icon: 'award', color: '#EF4444', check: (_, o) => o.filter(x => x.status === 'completed').reduce((s, x) => s + (x.sale_price ?? x.price), 0) >= 10000 },
  { id: 'b6', label: 'Leader', description: 'Top 3 du classement', icon: 'award', color: '#2d2d60', check: (_, __, r) => r > 0 && r <= 3 },
]

// ─── Component ────────────────────────────────────────────────
export default function AcademiePage() {
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set())
  const [inProgressModules, setInProgressModules] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['vente']))
  const [orders, setOrders] = useState<LocalOrder[]>([])
  const [leaderboardRank, setLeaderboardRank] = useState(0)

  useEffect(() => {
    setOrders(getOrders())
    fetch('/api/leaderboard')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.current_rank) setLeaderboardRank(data.current_rank) })
      .catch(() => {})
  }, [])

  const completedCount = completedModules.size
  const progressPct = TOTAL_MODULES > 0 ? Math.round((completedCount / TOTAL_MODULES) * 100) : 0

  function getModuleStatus(id: string): ModuleStatus {
    if (completedModules.has(id)) return 'completed'
    if (inProgressModules.has(id)) return 'in_progress'
    return 'not_started'
  }

  function handleModuleAction(id: string) {
    const status = getModuleStatus(id)
    if (status === 'not_started') {
      setInProgressModules(prev => new Set(prev).add(id))
    } else if (status === 'in_progress') {
      setInProgressModules(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setCompletedModules(prev => new Set(prev).add(id))
    }
  }

  function toggleCategory(id: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <GraduationCap className="w-6 h-6 text-[#2d2d60]" />
          <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">
            Academie NHBoost
          </h1>
        </div>
        <p className="text-sm text-[#6B7280] mt-1">
          Developpez vos competences commerciales et techniques
        </p>
      </motion.div>

      {/* ── Global Progress ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl border border-[#E2E8F2] bg-white p-6 shadow-[0_1px_3px_rgba(45,45,96,0.07)]"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#9CA3AF]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
              Progression globale
            </span>
          </div>
          <span className="text-sm font-bold text-[#2d2d60]">
            {completedCount}/{TOTAL_MODULES} modules
          </span>
        </div>
        <div className="w-full h-4 rounded-full bg-[#F0F3F8] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="h-full rounded-full bg-gradient-to-r from-[#2d2d60] to-[#4a81a4]"
          />
        </div>
        <p className="text-[12px] text-[#9CA3AF] mt-2">{progressPct}% termine</p>
      </motion.div>

      {/* ── Categories / Modules ───────────────────────────── */}
      <div className="space-y-4">
        {CATEGORIES.map((cat, catIdx) => {
          const CatIcon = cat.icon
          const isExpanded = expandedCategories.has(cat.id)
          const catCompleted = cat.modules.filter(m => completedModules.has(m.id)).length

          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 + catIdx * 0.06 }}
              className="rounded-2xl border border-[#E2E8F2] bg-white shadow-[0_1px_3px_rgba(45,45,96,0.07)] overflow-hidden"
            >
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F5F7FA] transition-colors text-left"
              >
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
                  style={{ background: `${cat.color}15` }}
                >
                  <CatIcon className="w-4.5 h-4.5" style={{ color: cat.color }} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#2d2d60]">{cat.title}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{catCompleted}/{cat.modules.length} termines</p>
                </div>
                {/* Mini progress */}
                <div className="w-20 h-1.5 rounded-full bg-[#F0F3F8] overflow-hidden flex-shrink-0">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${cat.modules.length > 0 ? (catCompleted / cat.modules.length) * 100 : 0}%`,
                      background: cat.color,
                    }}
                  />
                </div>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-[#9CA3AF] transition-transform duration-200 flex-shrink-0',
                    isExpanded && 'rotate-180',
                  )}
                />
              </button>

              {/* Modules */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 space-y-3">
                      {cat.modules.map((mod, modIdx) => {
                        const status = getModuleStatus(mod.id)
                        const diff = DIFFICULTY_LABELS[mod.difficulty]
                        return (
                          <motion.div
                            key={mod.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: modIdx * 0.04 }}
                            className={cn(
                              'flex items-start gap-4 p-4 rounded-xl border transition-colors',
                              status === 'completed'
                                ? 'bg-[#F0FDF4] border-[#BBF7D0]'
                                : 'bg-[#F5F7FA] border-[#E2E8F2] hover:border-[#D1DCE8]',
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className={cn(
                                  'text-[13px] font-semibold',
                                  status === 'completed' ? 'text-[#166534]' : 'text-[#2d2d60]',
                                )}>
                                  {mod.title}
                                </p>
                                <span
                                  className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                  style={{ background: diff.bg, color: diff.text }}
                                >
                                  {diff.label}
                                </span>
                              </div>
                              <p className="text-[12px] text-[#6B7280] mb-2">{mod.description}</p>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#9CA3AF]" />
                                <span className="text-[11px] text-[#9CA3AF]">{mod.duration}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleModuleAction(mod.id)}
                              disabled={status === 'completed'}
                              className={cn(
                                'flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                                status === 'not_started' && 'bg-[#2d2d60] text-white hover:bg-[#1d1d40]',
                                status === 'in_progress' && 'bg-[#F59E0B] text-white hover:bg-[#D97706]',
                                status === 'completed' && 'bg-[#22C55E] text-white cursor-default',
                              )}
                            >
                              {status === 'not_started' && 'Commencer'}
                              {status === 'in_progress' && 'Terminer'}
                              {status === 'completed' && (
                                <span className="flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Termine
                                </span>
                              )}
                            </button>
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* ── Badges ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-[#F59E0B]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
            Badges
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {BADGES.map((badge, i) => {
            const unlocked = badge.check(completedCount, orders, leaderboardRank)
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55 + i * 0.06 }}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all',
                  unlocked
                    ? 'bg-white border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.07)]'
                    : 'bg-[#F5F7FA] border-[#E2E8F2] opacity-60',
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    unlocked ? '' : 'bg-[#E2E8F2]',
                  )}
                  style={unlocked ? { background: `${badge.color}15` } : undefined}
                >
                  {unlocked ? (
                    <Award className="w-5 h-5" style={{ color: badge.color }} />
                  ) : (
                    <Lock className="w-4 h-4 text-[#9CA3AF]" />
                  )}
                </div>
                <p className={cn('text-[12px] font-bold', unlocked ? 'text-[#2d2d60]' : 'text-[#9CA3AF]')}>
                  {badge.label}
                </p>
                <p className="text-[10px] text-[#9CA3AF]">{badge.description}</p>
                {unlocked && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#22C55E] flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
