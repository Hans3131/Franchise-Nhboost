'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  FolderOpen,
  HeadphonesIcon,
  BookOpen,
  Bot,
  Users,
  Kanban,
  Inbox,
  ShoppingBag,
  BarChart3,
  GraduationCap,
  Megaphone,
  X,
  ChevronRight,
  ChevronDown,
  Settings,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Navigation hiérarchisée en 3 sections ─────────────────────
// Chaque section a sa propre couleur d'accent
type NavItem = { href: string; label: string; icon: React.ElementType }
type NavSection = {
  key: string
  label: string
  color: string       // Couleur principale (icônes actives, barre, label section)
  bgColor: string     // Rgba pour fond hover/active
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    key: 'operations',
    label: 'Opérations',
    color: '#6AAEE5',                    // Bleu NHBoost — cœur de métier
    bgColor: 'rgba(106,174,229,0.12)',
    items: [
      { href: '/dashboard',  label: 'Tableau de bord', icon: LayoutDashboard },
      { href: '/commander',  label: 'Commander',       icon: ShoppingCart },
      { href: '/commandes',  label: 'Mes commandes',   icon: ClipboardList },
      { href: '/crm',        label: 'Mes clients',     icon: Users },
      { href: '/budget-ads', label: 'Budget ADS',      icon: Megaphone },
      { href: '/secretaire', label: 'Secrétaire IA',   icon: Bot },
    ],
  },
  {
    key: 'commercial',
    label: 'Commercial',
    color: '#F59E0B',                    // Orange — conversion & funnel
    bgColor: 'rgba(245,158,11,0.12)',
    items: [
      { href: '/pipeline',  label: 'Pipeline',  icon: Kanban },
      { href: '/mes-leads', label: 'Mes leads', icon: Inbox },
    ],
  },
  {
    key: 'resources',
    label: 'Ressources & outils',
    color: '#8B5CF6',                    // Violet — contenu, formation, support
    bgColor: 'rgba(139,92,246,0.12)',
    items: [
      { href: '/projets',    label: 'Projets',    icon: FolderOpen },
      { href: '/analytics',  label: 'Analytics',  icon: BarChart3 },
      { href: '/academie',   label: 'Académie',   icon: GraduationCap },
      { href: '/catalogue',  label: 'Catalogue',  icon: ShoppingBag },
      { href: '/support',    label: 'Support',    icon: HeadphonesIcon },
      { href: '/ressources', label: 'Ressources', icon: BookOpen },
    ],
  },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [profile, setProfile] = useState<{ name: string; email: string; initials: string }>({
    name: 'Franchisé #001', email: 'franchise@nhboost.com', initials: 'F1',
  })

  // ─── État d'ouverture des sections (accordion) ─────────────
  // Par défaut toutes fermées. Ouverture automatique de la section
  // contenant la page active pour que l'utilisateur voie sa position.
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    // Initialisation côté serveur/client : ouvre la section de la page active
    const activeSection = NAV_SECTIONS.find(s =>
      s.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/')),
    )
    return new Set(activeSection ? [activeSection.key] : [])
  })

  // Si on navigue vers une page dans une section fermée → l'ouvrir auto
  useEffect(() => {
    const activeSection = NAV_SECTIONS.find(s =>
      s.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/')),
    )
    if (activeSection && !openSections.has(activeSection.key)) {
      setOpenSections(prev => new Set(prev).add(activeSection.key))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('company_name, franchise_code').eq('id', user.id).single().then(({ data }) => {
        const name = data?.company_name || data?.franchise_code || user.email?.split('@')[0] || 'Franchisé'
        const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
        setProfile({ name, email: user.email ?? '', initials })
      })
    })
  }, [])

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[rgba(107,174,229,0.1)]">
        <Image
          src="/logo.png"
          alt="NHBoost"
          width={120}
          height={40}
          className="object-contain"
          priority
        />
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="ml-auto lg:hidden p-1.5 rounded-md text-[#4A5180] hover:text-[#F0F2FF] hover:bg-[rgba(107,174,229,0.08)] transition-colors"
          aria-label="Fermer le menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav — accordion par section avec couleur par catégorie */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV_SECTIONS.map((section, sectionIdx) => {
          const isOpen = openSections.has(section.key)
          // Y a-t-il un item actif dans cette section ?
          const hasActive = section.items.some(
            item => pathname === item.href || pathname.startsWith(item.href + '/'),
          )
          return (
            <div
              key={section.key}
              className={cn(sectionIdx > 0 && 'mt-3')}
            >
              {/* Section header (clickable toggle) */}
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                  'hover:bg-[rgba(107,174,229,0.04)]',
                )}
                aria-expanded={isOpen}
                aria-controls={`section-${section.key}`}
              >
                <span
                  className="w-1 h-3 rounded-full flex-shrink-0"
                  style={{ background: section.color }}
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-widest flex-1 text-left"
                  style={{ color: section.color }}
                >
                  {section.label}
                </span>
                {/* Badge si une page est active dans une section fermée */}
                {!isOpen && hasActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                    style={{ background: section.color }}
                    aria-label="Page active dans cette section"
                  />
                )}
                <motion.div
                  animate={{ rotate: isOpen ? 0 : -90 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <ChevronDown
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: section.color, opacity: 0.7 }}
                    strokeWidth={2}
                  />
                </motion.div>
              </button>

              {/* Items (accordion body) */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key={`section-${section.key}`}
                    id={`section-${section.key}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 pt-1 pb-1">
                      {section.items.map(({ href, label, icon: Icon }) => {
                        const active = pathname === href || pathname.startsWith(href + '/')
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={onClose}
                            className={cn(
                              'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative',
                              !active && 'text-[#8B95C4] hover:text-[#F0F2FF]',
                            )}
                            style={
                              active
                                ? { background: section.bgColor, color: section.color }
                                : undefined
                            }
                            onMouseEnter={(e) => {
                              if (!active) {
                                e.currentTarget.style.background = section.bgColor.replace('0.12', '0.06')
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!active) {
                                e.currentTarget.style.background = ''
                              }
                            }}
                          >
                            {/* Active indicator bar */}
                            {active && (
                              <motion.div
                                key={`indicator-${href}`}
                                layoutId="sidebar-active"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                                style={{ background: section.color }}
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                              />
                            )}
                            <Icon
                              className="w-[18px] h-[18px] flex-shrink-0 transition-colors"
                              style={{
                                color: active ? section.color : '#4A5180',
                              }}
                              strokeWidth={active ? 2 : 1.75}
                            />
                            <span>{label}</span>
                            {active && (
                              <ChevronRight
                                className="w-3.5 h-3.5 ml-auto opacity-60"
                                style={{ color: section.color }}
                              />
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[rgba(107,174,229,0.08)]">
        <Link
          href="/parametres"
          onClick={onClose}
          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[rgba(107,174,229,0.06)] transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4A7DC4] to-[#2B3580] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-white">{profile.initials}</span>
          </div>
          <div className="flex flex-col leading-none min-w-0 flex-1">
            <span className="text-[13px] font-semibold text-[#F0F2FF] truncate">{profile.name}</span>
            <span className="text-[11px] text-[#4A5180] mt-0.5 truncate">{profile.email}</span>
          </div>
          <Settings className="w-3.5 h-3.5 text-[#4A5180] group-hover:text-[#8B95C4] transition-colors flex-shrink-0" />
        </Link>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col h-screen sticky top-0 bg-[#0A0B14] border-r border-[rgba(107,174,229,0.12)]">
        {content}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              key="sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-[#0A0B14] border-r border-[rgba(107,174,229,0.15)] lg:hidden shadow-2xl"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
