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
  X,
  ChevronRight,
  Settings,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/commander',  label: 'Commander',        icon: ShoppingCart },
  { href: '/secretaire', label: 'Secrétaire IA',    icon: Bot },
  { href: '/commandes',  label: 'Mes commandes',    icon: ClipboardList },
  { href: '/projets',    label: 'Projets',          icon: FolderOpen },
  { href: '/support',    label: 'Support',          icon: HeadphonesIcon },
  { href: '/ressources', label: 'Ressources',       icon: BookOpen },
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

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative',
                active
                  ? 'bg-[rgba(106,174,229,0.12)] text-[#6AAEE5]'
                  : 'text-[#8B95C4] hover:text-[#F0F2FF] hover:bg-[rgba(107,174,229,0.06)]'
              )}
            >
              {/* Active indicator — uses key to force remount on route change */}
              {active && (
                <motion.div
                  key={`indicator-${href}`}
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#6AAEE5]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                className={cn(
                  'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                  active ? 'text-[#6AAEE5]' : 'text-[#4A5180] group-hover:text-[#8B95C4]'
                )}
                strokeWidth={active ? 2 : 1.75}
              />
              <span>{label}</span>
              {active && (
                <ChevronRight className="w-3.5 h-3.5 ml-auto text-[#6AAEE5] opacity-60" />
              )}
            </Link>
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
