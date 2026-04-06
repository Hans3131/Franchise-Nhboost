'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Search, Palette, Share2, PenTool,
  Megaphone, Briefcase, BarChart2,
  X, Calendar, User, Mail, Euro,
  ChevronRight, Filter, CheckCircle2, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAll, type LocalOrder } from '@/lib/orderStore'
import { createClient } from '@/lib/supabase/client'

// ─── Mapping service → catégorie / couleur / icône ────────────
type Category = 'all' | 'web' | 'seo' | 'design' | 'social' | 'marketing' | 'autre'

const CAT_CONFIG: Record<Exclude<Category, 'all'>, {
  label: string; color: string; gradient: string; icon: React.ElementType
}> = {
  web:       { label: 'Web',       color: '#6AAEE5', gradient: 'from-[#6AAEE5]/20 to-[#2B3580]/20',  icon: Globe      },
  seo:       { label: 'SEO',       color: '#22C55E', gradient: 'from-[#22C55E]/20 to-[#166534]/20',  icon: Search     },
  design:    { label: 'Design',    color: '#8B5CF6', gradient: 'from-[#8B5CF6]/20 to-[#5B21B6]/20',  icon: Palette    },
  social:    { label: 'Social',    color: '#F59E0B', gradient: 'from-[#F59E0B]/20 to-[#92400E]/20',  icon: Share2     },
  marketing: { label: 'Marketing', color: '#F97316', gradient: 'from-[#F97316]/20 to-[#7C2D12]/20',  icon: Megaphone  },
  autre:     { label: 'Autre',     color: '#6366F1', gradient: 'from-[#6366F1]/20 to-[#3730A3]/20',  icon: Briefcase  },
}

function detectCategory(service: string): Exclude<Category, 'all'> {
  const s = service.toLowerCase()
  if (/site|web|vitrine|e-comm|ecomm|landing/.test(s)) return 'web'
  if (/seo|référenc|search|google my|position/.test(s))  return 'seo'
  if (/logo|design|identit|visuel|graph|charte|brand/.test(s)) return 'design'
  if (/social|réseau|instagram|facebook|linkedin|tiktok/.test(s)) return 'social'
  if (/ads|publicité|campagne|contenu|rédact|blog|email|newsletter/.test(s)) return 'marketing'
  return 'autre'
}

// ─── Types ────────────────────────────────────────────────────
interface Project {
  id:        string
  ref:       string
  service:   string
  client:    string
  email:     string
  phone?:    string
  brief?:    string
  price:     number
  category:  Exclude<Category, 'all'>
  date:      string
}

function mapOrder(o: LocalOrder): Project {
  return {
    id:       o.id,
    ref:      o.ref,
    service:  o.service,
    client:   o.client_name,
    email:    o.client_email,
    phone:    o.client_phone,
    brief:    o.brief,
    price:    o.price,
    category: detectCategory(o.service),
    date:     new Date(o.updated_at ?? o.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit', month: 'short', year: 'numeric' }),
  }
}

// ─── Sub-components ───────────────────────────────────────────
function ProjectCard({ project, index, onClick }: {
  project: Project; index: number; onClick: () => void
}) {
  const cfg  = CAT_CONFIG[project.category]
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.28, delay: index * 0.05 }}
      onClick={onClick}
      className="group relative rounded-2xl bg-[#161A34] border border-[rgba(107,174,229,0.12)] overflow-hidden cursor-pointer hover:border-[rgba(107,174,229,0.28)] transition-all duration-300 hover:-translate-y-0.5"
    >
      {/* Header gradient */}
      <div className={cn('h-28 bg-gradient-to-br relative', cfg.gradient)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}30` }}>
            <Icon className="w-7 h-7" style={{ color: cfg.color }} strokeWidth={1.5} />
          </div>
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-white text-xs font-medium">
              Voir détail <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg,transparent,${cfg.color}60,transparent)` }} />
        {/* Ref badge */}
        <span className="absolute top-2.5 right-2.5 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-black/30 text-white/50">
          {project.ref}
        </span>
        {/* Statut finalisé */}
        <span className="absolute top-2.5 left-2.5 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(34,197,94,0.2)] text-[#22C55E]">
          <CheckCircle2 className="w-2.5 h-2.5" /> Finalisé
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-[14px] font-semibold text-[#F0F2FF] group-hover:text-white transition-colors leading-tight line-clamp-1">
            {project.service}
          </h3>
          <span className="text-[12px] font-bold text-[#F0F2FF] font-mono whitespace-nowrap">
            €{project.price.toLocaleString('fr-FR')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          <User className="w-3 h-3 text-[#4A5180] flex-shrink-0" />
          <span className="text-[12px] text-[#8B95C4] truncate">{project.client}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${cfg.color}14`, color: cfg.color }}>
            {cfg.label}
          </span>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-[#4A5180]" />
            <span className="text-[11px] text-[#4A5180]">{project.date}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const cfg  = CAT_CONFIG[project.category]
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-lg rounded-2xl bg-[#161A34] border border-[rgba(107,174,229,0.2)] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn('h-36 bg-gradient-to-br relative', cfg.gradient)}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: `${cfg.color}25`, border: `1px solid ${cfg.color}40` }}>
              <Icon className="w-8 h-8" style={{ color: cfg.color }} strokeWidth={1.5} />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(90deg,transparent,${cfg.color}80,transparent)` }} />
          <button onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-black/30 hover:bg-black/50 flex items-center justify-center transition-colors">
            <X className="w-3.5 h-3.5 text-white/70" />
          </button>
          <span className="absolute top-3 left-3 text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 text-white/50">
            {project.ref}
          </span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-[#F0F2FF]">{project.service}</h2>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#4A5180]" />
                <span className="text-[13px] text-[#8B95C4]">{project.client}</span>
              </div>
              <span className="text-[#4A5180]">·</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#4A5180]" />
                <span className="text-[13px] text-[#8B95C4]">{project.date}</span>
              </div>
            </div>
          </div>

          {/* Infos client + prix */}
          <div className="grid grid-cols-2 gap-3">
            <div className="py-3 px-4 rounded-xl bg-[#1D2240] border border-[rgba(107,174,229,0.08)]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4A5180] mb-1">Catégorie</p>
              <span className="text-[13px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
            </div>
            <div className="py-3 px-4 rounded-xl bg-[#1D2240] border border-[rgba(107,174,229,0.08)] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4A5180] mb-1">Montant</p>
                <div className="flex items-center gap-1">
                  <Euro className="w-3.5 h-3.5 text-[#4A5180]" />
                  <span className="text-[15px] font-bold text-[#F0F2FF] font-mono">
                    {project.price.toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact client */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4A5180]">Contact client</p>
            <div className="flex items-center gap-2 text-[13px] text-[#8B95C4]">
              <Mail className="w-3.5 h-3.5 text-[#4A5180] flex-shrink-0" />
              {project.email}
            </div>
            {project.phone && (
              <div className="flex items-center gap-2 text-[13px] text-[#8B95C4]">
                <User className="w-3.5 h-3.5 text-[#4A5180] flex-shrink-0" />
                {project.phone}
              </div>
            )}
          </div>

          {/* Brief */}
          {project.brief && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4A5180] mb-2">Brief</p>
              <div className="bg-[#1D2240] border border-l-2 rounded-r-xl rounded-l-none px-4 py-3"
                style={{ borderColor: `${cfg.color}50`, borderLeftColor: cfg.color }}>
                <p className="text-[13px] text-[#8B95C4] leading-relaxed">{project.brief}</p>
              </div>
            </div>
          )}

          {/* Statut */}
          <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.2)]">
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
            <span className="text-[13px] font-medium text-[#22C55E]">Projet finalisé et livré</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function ProjetsPage() {
  const [projects, setProjects]             = useState<Project[]>([])
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [search, setSearch]                 = useState('')
  const [sortBy, setSortBy]                 = useState<'date' | 'price'>('date')
  const [selected, setSelected]             = useState<Project | null>(null)

  useEffect(() => {
    // Affichage immédiat localStorage
    setProjects(getAll().filter(o => o.status === 'completed').map(mapOrder))

    // Remplacement par Supabase
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setProjects(data.map(r => mapOrder(r as unknown as LocalOrder)))
          }
        })
    })
  }, [])

  const totalRevenue = useMemo(
    () => projects.reduce((s, p) => s + p.price, 0),
    [projects]
  )

  const categories = useMemo(() => {
    const counts: Partial<Record<Exclude<Category, 'all'>, number>> = {}
    projects.forEach(p => { counts[p.category] = (counts[p.category] ?? 0) + 1 })
    return [
      { value: 'all' as Category, label: 'Tous', count: projects.length },
      ...Object.entries(CAT_CONFIG)
        .filter(([key]) => (counts[key as Exclude<Category, 'all'>] ?? 0) > 0)
        .map(([key, cfg]) => ({
          value:  key as Category,
          label:  cfg.label,
          count:  counts[key as Exclude<Category, 'all'>] ?? 0,
        })),
    ]
  }, [projects])

  const filtered = useMemo(() => {
    return projects
      .filter(p => activeCategory === 'all' || p.category === activeCategory)
      .filter(p => {
        const q = search.toLowerCase()
        return !q || p.service.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        if (sortBy === 'price') return b.price - a.price
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })
  }, [projects, activeCategory, search, sortBy])

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4A5180] mb-1">Galerie</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Projets finalisés</h1>
          <p className="text-sm text-[#8B95C4] mt-1">
            <span className="text-[#6AAEE5] font-medium">{projects.length} projet{projects.length !== 1 ? 's' : ''}</span>
            {' '}livrés avec succès
          </p>
        </div>

        {/* Stats */}
        {projects.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4A5180]">CA Total</p>
              <p className="text-lg font-bold text-[#F0F2FF] font-mono">
                €{totalRevenue.toLocaleString('fr-FR')}
              </p>
            </div>
            <div className="w-px h-8 bg-[rgba(107,174,229,0.15)]" />
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4A5180]">Projets</p>
              <p className="text-lg font-bold text-[#F0F2FF]">{projects.length}</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Filtres */}
      {projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          {/* Onglets catégories */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#161A34] border border-[rgba(107,174,229,0.1)] overflow-x-auto flex-1">
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap',
                  activeCategory === cat.value ? 'text-[#F0F2FF]' : 'text-[#4A5180] hover:text-[#8B95C4]'
                )}
              >
                {activeCategory === cat.value && (
                  <motion.div
                    layoutId="proj-cat-active"
                    className="absolute inset-0 rounded-lg bg-[rgba(106,174,229,0.15)] border border-[rgba(106,174,229,0.25)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{cat.label}</span>
                <span className={cn(
                  'relative z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  activeCategory === cat.value
                    ? 'bg-[#6AAEE5]/20 text-[#6AAEE5]'
                    : 'bg-[rgba(107,174,229,0.08)] text-[#4A5180]'
                )}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Recherche + tri */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4A5180]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-44 pl-8 pr-3 py-2 rounded-xl bg-[#161A34] border border-[rgba(107,174,229,0.1)] text-[13px] text-[#F0F2FF] placeholder:text-[#4A5180] focus:outline-none focus:border-[rgba(106,174,229,0.35)] transition-colors"
              />
            </div>
            <div className="relative flex items-center">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4A5180] pointer-events-none" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'date' | 'price')}
                className="pl-8 pr-3 py-2 rounded-xl bg-[#161A34] border border-[rgba(107,174,229,0.1)] text-[13px] text-[#8B95C4] focus:outline-none focus:border-[rgba(106,174,229,0.35)] transition-colors appearance-none cursor-pointer"
              >
                <option value="date">Date</option>
                <option value="price">Prix</option>
              </select>
            </div>
          </div>
        </motion.div>
      )}

      {/* Contenu */}
      <AnimatePresence mode="wait">
        {projects.length === 0 ? (
          /* État vide — aucun projet finalisé */
          <motion.div
            key="empty-all"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-[rgba(107,174,229,0.06)] border border-[rgba(107,174,229,0.12)] flex items-center justify-center mb-5">
              <FileText className="w-7 h-7 text-[#4A5180]" />
            </div>
            <p className="text-[#F0F2FF] font-semibold text-lg">Aucun projet finalisé</p>
            <p className="text-[13px] text-[#4A5180] mt-2 max-w-xs">
              Les commandes passées au statut <span className="text-[#22C55E] font-medium">Finalisé</span> apparaîtront ici avec leur montant total.
            </p>
          </motion.div>
        ) : filtered.length === 0 ? (
          /* État vide — filtre */
          <motion.div
            key="empty-filter"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-[rgba(107,174,229,0.08)] border border-[rgba(107,174,229,0.12)] flex items-center justify-center mb-4">
              <Search className="w-5 h-5 text-[#4A5180]" />
            </div>
            <p className="text-[#8B95C4] font-medium">Aucun projet trouvé</p>
            <p className="text-[13px] text-[#4A5180] mt-1">Essayez d'autres filtres ou termes de recherche</p>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            <AnimatePresence>
              {filtered.map((project, i) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={i}
                  onClick={() => setSelected(project)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal détail */}
      <AnimatePresence>
        {selected && (
          <ProjectModal project={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>

    </div>
  )
}
