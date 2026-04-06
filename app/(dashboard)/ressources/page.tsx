'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Search,
  FileText,
  Image,
  Video,
  Package,
  BookOpen,
  Presentation,
  Eye,
  Star,
  Clock,
  ChevronRight,
  FolderOpen,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────
type ResourceCategory = 'all' | 'kits' | 'guides' | 'templates' | 'videos' | 'brand'
type FileType = 'pdf' | 'zip' | 'mp4' | 'pptx' | 'ai' | 'png'

interface Resource {
  id: string
  title: string
  description: string
  category: ResourceCategory
  fileType: FileType
  size: string
  date: string
  downloads: number
  featured?: boolean
  locked?: boolean
  icon: React.ElementType
  color: string
}

// ─── Mock data ────────────────────────────────────────────────
const RESOURCES: Resource[] = [
  {
    id: 'RES-001',
    title: 'Kit de communication NHBoost',
    description: 'Logos, couleurs, typographies et templates prêts à l\'emploi pour tous vos supports.',
    category: 'brand',
    fileType: 'zip',
    size: '48 Mo',
    date: '01 avr. 2026',
    downloads: 142,
    featured: true,
    icon: Package,
    color: '#6AAEE5',
  },
  {
    id: 'RES-002',
    title: 'Guide vendeur — Service SEO',
    description: 'Argumentaire complet, FAQ clients et grille tarifaire pour vendre les offres SEO.',
    category: 'guides',
    fileType: 'pdf',
    size: '3,2 Mo',
    date: '28 mar. 2026',
    downloads: 89,
    featured: true,
    icon: BookOpen,
    color: '#22C55E',
  },
  {
    id: 'RES-003',
    title: 'Templates réseaux sociaux',
    description: '50 templates Canva personnalisables pour Instagram, Facebook et LinkedIn.',
    category: 'templates',
    fileType: 'zip',
    size: '12 Mo',
    date: '20 mar. 2026',
    downloads: 215,
    icon: Image,
    color: '#8B5CF6',
  },
  {
    id: 'RES-004',
    title: 'Présentation franchisé — Pitch client',
    description: 'Slide deck professionnel pour présenter NHBoost et ses services à vos prospects.',
    category: 'kits',
    fileType: 'pptx',
    size: '8,5 Mo',
    date: '15 mar. 2026',
    downloads: 67,
    icon: Presentation,
    color: '#F59E0B',
  },
  {
    id: 'RES-005',
    title: 'Formation — Vendre le web',
    description: 'Module vidéo de 45 min sur les techniques de vente pour les services digitaux.',
    category: 'videos',
    fileType: 'mp4',
    size: '680 Mo',
    date: '10 mar. 2026',
    downloads: 54,
    locked: true,
    icon: Video,
    color: '#EC4899',
  },
  {
    id: 'RES-006',
    title: 'Contrat client — Modèle type',
    description: 'Modèle de contrat de prestation validé par le service juridique NHBoost.',
    category: 'templates',
    fileType: 'pdf',
    size: '1,1 Mo',
    date: '5 mar. 2026',
    downloads: 178,
    icon: FileText,
    color: '#14B8A6',
  },
  {
    id: 'RES-007',
    title: 'Charte graphique complète',
    description: 'Guide d\'usage du logo, couleurs Pantone, espacements et règles typographiques.',
    category: 'brand',
    fileType: 'pdf',
    size: '5,8 Mo',
    date: '1 mar. 2026',
    downloads: 93,
    icon: Image,
    color: '#F97316',
  },
  {
    id: 'RES-008',
    title: 'Guide onboarding franchisé',
    description: 'Guide complet de démarrage : outils, process, contacts et premières étapes.',
    category: 'guides',
    fileType: 'pdf',
    size: '2,4 Mo',
    date: '15 fév. 2026',
    downloads: 203,
    featured: true,
    icon: BookOpen,
    color: '#6366F1',
  },
  {
    id: 'RES-009',
    title: 'Formation — Google Ads pour franchisés',
    description: 'Tutoriel vidéo 30 min sur la création et gestion de campagnes Google Ads.',
    category: 'videos',
    fileType: 'mp4',
    size: '420 Mo',
    date: '10 fév. 2026',
    downloads: 41,
    locked: true,
    icon: Video,
    color: '#EC4899',
  },
  {
    id: 'RES-010',
    title: 'Pack Flyers & Brochures',
    description: 'Templates InDesign et Illustrator pour vos supports print locaux.',
    category: 'kits',
    fileType: 'zip',
    size: '95 Mo',
    date: '1 fév. 2026',
    downloads: 72,
    icon: Package,
    color: '#4A7DC4',
  },
]

const CATEGORIES: { value: ResourceCategory; label: string; icon: React.ElementType; count: number }[] = [
  { value: 'all',       label: 'Tout',        icon: FolderOpen,    count: RESOURCES.length },
  { value: 'brand',     label: 'Identité',    icon: Image,         count: RESOURCES.filter(r => r.category === 'brand').length },
  { value: 'kits',      label: 'Kits',        icon: Package,       count: RESOURCES.filter(r => r.category === 'kits').length },
  { value: 'guides',    label: 'Guides',      icon: BookOpen,      count: RESOURCES.filter(r => r.category === 'guides').length },
  { value: 'templates', label: 'Templates',   icon: FileText,      count: RESOURCES.filter(r => r.category === 'templates').length },
  { value: 'videos',    label: 'Vidéos',      icon: Video,         count: RESOURCES.filter(r => r.category === 'videos').length },
]

const FILE_TYPE_CONFIG: Record<FileType, { label: string; color: string; bg: string }> = {
  pdf:  { label: 'PDF',  color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  zip:  { label: 'ZIP',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  mp4:  { label: 'MP4',  color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  pptx: { label: 'PPTX', color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
  ai:   { label: 'AI',   color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
  png:  { label: 'PNG',  color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
}

// ─── Sub-components ───────────────────────────────────────────

function ResourceCard({ resource, index }: { resource: Resource; index: number }) {
  const Icon = resource.icon
  const fileConf = FILE_TYPE_CONFIG[resource.fileType]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        'group relative rounded-2xl bg-[#161A34] border overflow-hidden transition-all duration-300',
        resource.locked
          ? 'border-[rgba(107,174,229,0.08)] opacity-70'
          : 'border-[rgba(107,174,229,0.12)] hover:border-[rgba(107,174,229,0.28)] hover:-translate-y-0.5'
      )}
    >
      {/* Featured badge */}
      {resource.featured && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/25">
          <Star className="w-2.5 h-2.5 fill-[#F59E0B] text-[#F59E0B]" />
          <span className="text-[9px] font-bold uppercase tracking-wide text-[#F59E0B]">Recommandé</span>
        </div>
      )}

      {/* Locked badge */}
      {resource.locked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-[#0A0B14]/60 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-[#161A34] border border-[rgba(107,174,229,0.15)] flex items-center justify-center">
              <Lock className="w-4 h-4 text-[#4A5180]" />
            </div>
            <p className="text-[11px] text-[#4A5180] font-medium">Accès restreint</p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${resource.color}14`, border: `1px solid ${resource.color}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: resource.color }} strokeWidth={1.5} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-semibold text-[#F0F2FF] group-hover:text-white transition-colors leading-tight truncate">
              {resource.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: fileConf.bg, color: fileConf.color }}
              >
                {fileConf.label}
              </span>
              <span className="text-[11px] text-[#4A5180]">{resource.size}</span>
            </div>
          </div>
        </div>

        <p className="text-[12px] text-[#8B95C4] leading-relaxed mb-4 line-clamp-2">
          {resource.description}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between text-[11px] text-[#4A5180] mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{resource.date}</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            <span>{resource.downloads} téléch.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            disabled={resource.locked}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-200',
              resource.locked
                ? 'bg-[#1D2240] text-[#4A5180] cursor-not-allowed'
                : 'bg-gradient-to-r from-[#6AAEE5]/20 to-[#2B3580]/20 border border-[rgba(106,174,229,0.25)] text-[#6AAEE5] hover:border-[rgba(106,174,229,0.45)] hover:from-[#6AAEE5]/25'
            )}
          >
            <Download className="w-3.5 h-3.5" />
            Télécharger
          </button>
          {resource.fileType !== 'zip' && resource.fileType !== 'mp4' && !resource.locked && (
            <button className="w-9 h-9 rounded-xl bg-[#1D2240] border border-[rgba(107,174,229,0.1)] hover:border-[rgba(107,174,229,0.22)] flex items-center justify-center transition-colors group/eye">
              <Eye className="w-3.5 h-3.5 text-[#4A5180] group-hover/eye:text-[#8B95C4] transition-colors" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px opacity-40"
        style={{ background: `linear-gradient(90deg, transparent, ${resource.color}, transparent)` }}
      />
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function RessourcesPage() {
  const [activeCategory, setActiveCategory] = useState<ResourceCategory>('all')
  const [search, setSearch] = useState('')

  const filtered = RESOURCES
    .filter(r => activeCategory === 'all' || r.category === activeCategory)
    .filter(r => {
      const q = search.toLowerCase()
      return !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    })

  const featured = RESOURCES.filter(r => r.featured)
  const totalDownloads = RESOURCES.reduce((sum, r) => sum + r.downloads, 0)

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4A5180] mb-1">
            Médiathèque
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">
            Ressources
          </h1>
          <p className="text-sm text-[#8B95C4] mt-1">
            Tous vos outils et supports en un seul endroit
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4A5180]">Fichiers</p>
            <p className="text-lg font-bold text-[#F0F2FF]">{RESOURCES.length}</p>
          </div>
          <div className="w-px h-8 bg-[rgba(107,174,229,0.15)]" />
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4A5180]">Téléchargements</p>
            <p className="text-lg font-bold text-[#F0F2FF]">{totalDownloads.toLocaleString('fr-FR')}</p>
          </div>
        </div>
      </motion.div>

      {/* Featured */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[#4A5180] mb-3">
          Recommandés
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {featured.map((resource, i) => {
            const Icon = resource.icon
            const fileConf = FILE_TYPE_CONFIG[resource.fileType]
            return (
              <motion.div
                key={resource.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.07 }}
                className="group flex items-center gap-3 p-3.5 rounded-xl bg-[#161A34] border border-[rgba(107,174,229,0.15)] hover:border-[rgba(107,174,229,0.3)] transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${resource.color}14` }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: resource.color }} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#F0F2FF] truncate group-hover:text-white transition-colors">
                    {resource.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: fileConf.bg, color: fileConf.color }}
                    >
                      {fileConf.label}
                    </span>
                    <span className="text-[11px] text-[#4A5180]">{resource.size}</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#4A5180] group-hover:text-[#6AAEE5] transition-colors flex-shrink-0" />
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        {/* Category tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#161A34] border border-[rgba(107,174,229,0.1)] overflow-x-auto flex-1">
          {CATEGORIES.map(cat => {
            const CatIcon = cat.icon
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap',
                  activeCategory === cat.value
                    ? 'text-[#F0F2FF]'
                    : 'text-[#4A5180] hover:text-[#8B95C4]'
                )}
              >
                {activeCategory === cat.value && (
                  <motion.div
                    layoutId="res-cat-active"
                    className="absolute inset-0 rounded-lg bg-[rgba(106,174,229,0.15)] border border-[rgba(106,174,229,0.25)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <CatIcon className="relative z-10 w-3.5 h-3.5" />
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
            )
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4A5180]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une ressource…"
            className="w-full sm:w-56 pl-8 pr-3 py-2 rounded-xl bg-[#161A34] border border-[rgba(107,174,229,0.1)] text-[13px] text-[#F0F2FF] placeholder:text-[#4A5180] focus:outline-none focus:border-[rgba(106,174,229,0.35)] transition-colors"
          />
        </div>
      </motion.div>

      {/* Grid */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-[rgba(107,174,229,0.08)] border border-[rgba(107,174,229,0.12)] flex items-center justify-center mb-4">
              <Search className="w-5 h-5 text-[#4A5180]" />
            </div>
            <p className="text-[#8B95C4] font-medium">Aucune ressource trouvée</p>
            <p className="text-[13px] text-[#4A5180] mt-1">Essayez d'autres filtres</p>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            <AnimatePresence>
              {filtered.map((resource, i) => (
                <ResourceCard key={resource.id} resource={resource} index={i} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
