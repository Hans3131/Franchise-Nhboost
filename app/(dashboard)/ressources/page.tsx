'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, FolderOpen, ChevronDown, ChevronRight,
  Image, Video, FileText, BookOpen, Presentation,
  Phone, Globe, Target, Briefcase, Star,
  Award, TrendingUp, Users, Play,
  MessageSquare, ShoppingCart, Rocket,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────
interface SubCategory {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  count: number // 0 = espace vide pour le moment
}

interface Section {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  subcategories: SubCategory[]
}

// ─── Sections & données ──────────────────────────────────────
const SECTIONS: Section[] = [
  {
    id: 'portfolio',
    title: 'Portfolio de réalisations',
    description: 'Découvrez nos meilleures réalisations pour inspirer vos clients et montrer notre savoir-faire.',
    icon: Award,
    color: '#6AAEE5',
    subcategories: [
      { id: 'portfolio-sites', title: 'Sites web réalisés', description: 'Captures et liens de nos créations web', icon: Globe, color: '#6AAEE5', count: 0 },
      { id: 'portfolio-campagnes', title: 'Campagnes marketing', description: 'Résultats et visuels de nos campagnes', icon: TrendingUp, color: '#22C55E', count: 0 },
      { id: 'portfolio-logos', title: 'Identités visuelles', description: 'Logos et chartes graphiques créés', icon: Image, color: '#8B5CF6', count: 0 },
      { id: 'portfolio-videos', title: 'Vidéos produites', description: 'Montages et contenus vidéo réalisés', icon: Video, color: '#EC4899', count: 0 },
    ],
  },
  {
    id: 'scripts',
    title: 'Scripts de closing',
    description: 'Scripts de vente éprouvés pour conclure efficacement avec vos prospects.',
    icon: MessageSquare,
    color: '#22C55E',
    subcategories: [
      { id: 'scripts-accompagnement', title: 'Closing accompagnement business', description: 'Script pour vendre l\'accompagnement premium à 2500€', icon: Briefcase, color: '#8B5CF6', count: 0 },
      { id: 'scripts-acquisition', title: 'Closing acquisition', description: 'Script pour vendre le système d\'acquisition à 490€', icon: Target, color: '#22C55E', count: 0 },
      { id: 'scripts-site', title: 'Closing site web', description: 'Script pour vendre les offres site One Page et Complet', icon: Globe, color: '#6AAEE5', count: 0 },
    ],
  },
  {
    id: 'formations',
    title: 'Formations & tutoriels',
    description: 'Modules de formation pour monter en compétences et mieux servir vos clients.',
    icon: BookOpen,
    color: '#8B5CF6',
    subcategories: [
      { id: 'formations-vente', title: 'Techniques de vente', description: 'Formations pour améliorer votre closing', icon: ShoppingCart, color: '#F59E0B', count: 0 },
      { id: 'formations-produit', title: 'Connaissance produit', description: 'Maîtrisez chaque offre NHBoost en détail', icon: BookOpen, color: '#6AAEE5', count: 0 },
      { id: 'formations-client', title: 'Relation client', description: 'Gérer les objections et fidéliser', icon: Users, color: '#22C55E', count: 0 },
      { id: 'formations-digital', title: 'Marketing digital', description: 'Bases du SEO, ads, réseaux sociaux', icon: Rocket, color: '#EC4899', count: 0 },
    ],
  },
  {
    id: 'outils',
    title: 'Outils & templates',
    description: 'Templates, kits et outils prêts à l\'emploi pour gagner du temps.',
    icon: Presentation,
    color: '#F59E0B',
    subcategories: [
      { id: 'outils-pitch', title: 'Présentations client', description: 'Slides et decks pour vos rendez-vous', icon: Presentation, color: '#F59E0B', count: 0 },
      { id: 'outils-social', title: 'Templates réseaux sociaux', description: 'Visuels Canva personnalisables', icon: Image, color: '#8B5CF6', count: 0 },
      { id: 'outils-docs', title: 'Documents types', description: 'Contrats, devis, briefs pré-remplis', icon: FileText, color: '#14B8A6', count: 0 },
      { id: 'outils-brand', title: 'Kit identité NHBoost', description: 'Logos, couleurs, typographies', icon: Star, color: '#6AAEE5', count: 0 },
    ],
  },
  {
    id: 'guides',
    title: 'Guides pratiques',
    description: 'Guides pas à pas pour chaque situation que vous rencontrez sur le terrain.',
    icon: FileText,
    color: '#14B8A6',
    subcategories: [
      { id: 'guides-demarrage', title: 'Guide de démarrage franchisé', description: 'Tout pour bien commencer avec NHBoost', icon: Rocket, color: '#22C55E', count: 0 },
      { id: 'guides-vendeur', title: 'Argumentaires de vente', description: 'FAQ clients et réponses aux objections', icon: MessageSquare, color: '#F59E0B', count: 0 },
      { id: 'guides-tarifs', title: 'Grilles tarifaires', description: 'Tous les tarifs franchisé à jour', icon: ShoppingCart, color: '#6AAEE5', count: 0 },
      { id: 'guides-process', title: 'Process internes', description: 'Processus de commande, livrables, suivi', icon: FileText, color: '#8B5CF6', count: 0 },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────
export default function RessourcesPage() {
  const [search, setSearch] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['portfolio', 'scripts']))
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filtrage par recherche
  const filteredSections = search.trim()
    ? SECTIONS.map(s => ({
        ...s,
        subcategories: s.subcategories.filter(sub =>
          sub.title.toLowerCase().includes(search.toLowerCase()) ||
          sub.description.toLowerCase().includes(search.toLowerCase()) ||
          s.title.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(s => s.subcategories.length > 0)
    : SECTIONS

  const totalResources = SECTIONS.reduce((s, sec) => s + sec.subcategories.reduce((s2, sub) => s2 + sub.count, 0), 0)
  const totalCategories = SECTIONS.reduce((s, sec) => s + sec.subcategories.length, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">Médiathèque</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Ressources</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Tous vos outils, scripts, formations et supports — organisés par catégorie.
        </p>
      </motion.div>

      {/* Stats + Search */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2]">
            <FolderOpen className="w-3.5 h-3.5 text-[#6AAEE5]" />
            <span className="text-[12px] font-semibold text-[#2d2d60]">{SECTIONS.length} sections</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F5F7FA] border border-[#E2E8F2]">
            <FileText className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span className="text-[12px] font-semibold text-[#2d2d60]">{totalCategories} catégories</span>
          </div>
        </div>
        <div className="flex-1 relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une ressource..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] text-[#2d2d60] placeholder:text-[#9CA3AF] outline-none focus:border-[#6AAEE5] transition-colors"
          />
        </div>
      </motion.div>

      {/* Quick nav pills */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      >
        {SECTIONS.map(sec => {
          const Icon = sec.icon
          return (
            <button
              key={sec.id}
              onClick={() => {
                setExpandedSections(prev => new Set([...prev, sec.id]))
                document.getElementById(`section-${sec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E2E8F2] bg-white text-[12px] font-semibold text-[#6B7280] hover:text-[#2d2d60] hover:border-[#6AAEE5]/30 hover:shadow-sm transition-all whitespace-nowrap flex-shrink-0"
            >
              <Icon className="w-3.5 h-3.5" style={{ color: sec.color }} strokeWidth={1.75} />
              {sec.title}
            </button>
          )
        })}
      </motion.div>

      {/* Sections */}
      <div className="space-y-4">
        {filteredSections.map((section, sIdx) => {
          const expanded = expandedSections.has(section.id)
          const SectionIcon = section.icon
          const totalCount = section.subcategories.reduce((s, sub) => s + sub.count, 0)

          return (
            <motion.div
              key={section.id}
              id={`section-${section.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + sIdx * 0.05 }}
              className="rounded-2xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.06)] overflow-hidden"
            >
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-[#F8FAFC] transition-colors"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${section.color}12` }}
                >
                  <SectionIcon className="w-5 h-5" style={{ color: section.color }} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[16px] font-bold text-[#2d2d60]">{section.title}</h2>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F5F7FA] text-[#9CA3AF]">
                      {section.subcategories.length}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#6B7280] mt-0.5">{section.description}</p>
                </div>
                <ChevronDown
                  className={cn('w-5 h-5 text-[#9CA3AF] flex-shrink-0 transition-transform duration-300', expanded && 'rotate-180')}
                />
              </button>

              {/* Subcategories */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {section.subcategories.map(sub => {
                          const SubIcon = sub.icon
                          return (
                            <div
                              key={sub.id}
                              className="group relative rounded-xl border border-[#E2E8F2] bg-[#F8FAFC] hover:bg-white hover:border-[#6AAEE5]/30 hover:shadow-sm p-4 transition-all cursor-pointer"
                            >
                              {/* Colored left accent */}
                              <div
                                className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
                                style={{ background: sub.color }}
                              />

                              <div className="flex items-start gap-3 pl-2">
                                <div
                                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                  style={{ background: `${sub.color}12` }}
                                >
                                  <SubIcon className="w-4 h-4" style={{ color: sub.color }} strokeWidth={1.75} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-[13px] font-semibold text-[#2d2d60] group-hover:text-[#4a81a4] transition-colors">
                                    {sub.title}
                                  </h3>
                                  <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">{sub.description}</p>

                                  {sub.count > 0 ? (
                                    <div className="flex items-center gap-1.5 mt-2">
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: sub.color }}>
                                        {sub.count} ressource{sub.count > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 mt-2">
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F0F3F8] text-[#9CA3AF] border border-[#E2E8F2]">
                                        Bientôt disponible
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <ChevronRight className="w-4 h-4 text-[#E2E8F2] group-hover:text-[#9CA3AF] flex-shrink-0 mt-1 transition-colors" />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Footer info */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="text-center py-6"
      >
        <p className="text-[13px] text-[#9CA3AF]">
          Les ressources sont mises à jour régulièrement par l'équipe NHBoost.
        </p>
        <p className="text-[12px] text-[#9CA3AF] mt-1">
          Une suggestion ? Contactez-nous via le <a href="/support" className="text-[#6AAEE5] hover:underline">support</a>.
        </p>
      </motion.div>
    </div>
  )
}
