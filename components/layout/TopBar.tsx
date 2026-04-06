'use client'

import { Bell, Menu, Search, Settings, X, CheckCheck, ShoppingBag, Ticket, Info, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  getAll as notifGetAll,
  markRead,
  markAllRead,
  getUnreadCount,
  seedIfEmpty,
  type LocalNotification,
} from '@/lib/notificationStore'

interface TopBarProps {
  onMenuOpen: () => void
  title?: string
}

// ─── Icône par type ──────────────────────────────────────────
function NotifIcon({ type }: { type: LocalNotification['type'] }) {
  if (type === 'order_placed' || type === 'order_status')
    return (
      <div className="w-8 h-8 rounded-full bg-[rgba(106,174,229,0.15)] flex items-center justify-center flex-shrink-0">
        <ShoppingBag className="w-3.5 h-3.5 text-[#6AAEE5]" />
      </div>
    )
  if (type === 'ticket_created')
    return (
      <div className="w-8 h-8 rounded-full bg-[rgba(245,158,11,0.15)] flex items-center justify-center flex-shrink-0">
        <Ticket className="w-3.5 h-3.5 text-[#F59E0B]" />
      </div>
    )
  return (
    <div className="w-8 h-8 rounded-full bg-[rgba(139,92,246,0.15)] flex items-center justify-center flex-shrink-0">
      <Info className="w-3.5 h-3.5 text-[#8B5CF6]" />
    </div>
  )
}

// ─── Formatage de la date ────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return "À l'instant"
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Hier'
  return `Il y a ${d}j`
}

// ─── Panneau notifications ───────────────────────────────────
function NotifPanel({
  notifications,
  onMarkRead,
  onMarkAll,
  onClose,
}: {
  notifications: LocalNotification[]
  onMarkRead: (id: string, link?: string) => void
  onMarkAll: () => void
  onClose: () => void
}) {
  const unread = notifications.filter(n => !n.read).length

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="absolute right-0 top-full mt-2 w-[360px] max-h-[520px] flex flex-col rounded-2xl border border-[rgba(107,174,229,0.15)] bg-[#11132B] shadow-[0_24px_60px_rgba(0,0,0,0.6)] overflow-hidden z-50"
      style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(107,174,229,0.12)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[rgba(107,174,229,0.08)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#F0F2FF]">Notifications</span>
          {unread > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#6AAEE5] text-[10px] font-bold text-[#0A0B14]">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <button
              onClick={onMarkAll}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#8B95C4] hover:text-[#6AAEE5] hover:bg-[rgba(106,174,229,0.08)] transition-all"
            >
              <CheckCheck className="w-3 h-3" />
              Tout lire
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-lg text-[#4A5180] hover:text-[#8B95C4] hover:bg-[rgba(107,174,229,0.08)] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="overflow-y-auto flex-1 divide-y divide-[rgba(107,174,229,0.05)]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(107,174,229,0.06)] flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#4A5180]" />
            </div>
            <p className="text-[13px] text-[#4A5180]">Aucune notification</p>
          </div>
        ) : (
          notifications.map(notif => (
            <button
              key={notif.id}
              onClick={() => onMarkRead(notif.id, notif.link)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors group',
                notif.read
                  ? 'hover:bg-[rgba(107,174,229,0.04)]'
                  : 'bg-[rgba(106,174,229,0.04)] hover:bg-[rgba(106,174,229,0.08)]',
              )}
            >
              {/* Point non lu */}
              <div className="flex-shrink-0 mt-1">
                {!notif.read && (
                  <span className="block w-1.5 h-1.5 rounded-full bg-[#6AAEE5] mt-[3px] mr-[-4px]" />
                )}
              </div>

              <NotifIcon type={notif.type} />

              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-[12px] font-semibold leading-snug truncate',
                  notif.read ? 'text-[#8B95C4]' : 'text-[#F0F2FF]',
                )}>
                  {notif.title}
                </p>
                <p className="text-[11px] text-[#4A5180] leading-relaxed mt-0.5 line-clamp-2">
                  {notif.message}
                </p>
                <p className="text-[10px] text-[#4A5180] mt-1 opacity-70">
                  {timeAgo(notif.created_at)}
                </p>
              </div>

              {notif.link && (
                <ChevronRight className="w-3.5 h-3.5 text-[#4A5180] flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="flex-shrink-0 border-t border-[rgba(107,174,229,0.08)] px-4 py-2.5">
          <p className="text-[10px] text-[#4A5180] text-center">
            {notifications.length} notification{notifications.length > 1 ? 's' : ''} au total
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── TopBar ──────────────────────────────────────────────────
export default function TopBar({ onMenuOpen, title }: TopBarProps) {
  const router = useRouter()
  const [profile, setProfile] = useState<{ name: string; initials: string }>({ name: 'Franchisé', initials: 'F1' })
  const [notifOpen, setNotifOpen]     = useState(false)
  const [notifications, setNotifications] = useState<LocalNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const bellRef = useRef<HTMLDivElement>(null)

  // ── Charger le profil ──────────────────────────────────────
  useEffect(() => {
    // Priorité : localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('nhboost_profile') ?? '{}')
      if (saved.company_name) {
        const name = saved.company_name
        const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
        setProfile({ name, initials })
        return
      }
    } catch {}
    // Fallback Supabase
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('company_name, franchise_code').eq('id', user.id).single().then(({ data }) => {
        const name = data?.company_name || data?.franchise_code || user.email?.split('@')[0] || 'Franchisé'
        const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
        setProfile({ name, initials })
      })
    })
  }, [])

  // ── Charger notifications ──────────────────────────────────
  const refreshNotifs = useCallback(async () => {
    // Affichage immédiat localStorage
    seedIfEmpty()
    const local = notifGetAll()
    setNotifications(local)
    setUnreadCount(local.filter(n => !n.read).length)

    // Fusion avec Supabase
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (!error && data && data.length > 0) {
        const mapped: LocalNotification[] = data.map(n => ({
          id:         n.id,
          type:       n.type as LocalNotification['type'],
          title:      n.title,
          message:    n.message,
          link:       n.link ?? undefined,
          read:       n.read,
          created_at: n.created_at,
        }))
        setNotifications(mapped)
        setUnreadCount(mapped.filter(n => !n.read).length)
      }
    } catch {}
  }, [])

  useEffect(() => {
    refreshNotifs()
    const interval = setInterval(refreshNotifs, 15_000)
    return () => clearInterval(interval)
  }, [refreshNotifs])

  // ── Fermer en cliquant dehors ──────────────────────────────
  useEffect(() => {
    if (!notifOpen) return
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  // ── Marquer comme lu + navigation ─────────────────────────
  const handleMarkRead = (id: string, link?: string) => {
    markRead(id)
    refreshNotifs()
    // Sync Supabase (best-effort)
    createClient().from('notifications').update({ read: true }).eq('id', id).then(() => {})
    if (link) {
      setNotifOpen(false)
      router.push(link)
    }
  }

  const handleMarkAll = () => {
    markAllRead()
    refreshNotifs()
    // Sync Supabase (best-effort)
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) {
        createClient().from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false).then(() => {})
      }
    })
  }

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 md:px-6 bg-[#0A0B14]/80 backdrop-blur-md border-b border-[rgba(107,174,229,0.1)]">
      {/* Hamburger */}
      <button
        onClick={onMenuOpen}
        className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-[#8B95C4] hover:text-[#F0F2FF] hover:bg-[rgba(107,174,229,0.08)] transition-colors flex-shrink-0"
        aria-label="Ouvrir le menu"
      >
        <Menu className="w-[18px] h-[18px]" />
      </button>

      {/* Titre page — mobile */}
      {title && (
        <span className="lg:hidden text-sm font-semibold text-[#F0F2FF] truncate">
          {title}
        </span>
      )}

      {/* Barre de recherche */}
      <div className="hidden md:flex flex-1 max-w-sm items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(107,174,229,0.06)] border border-[rgba(107,174,229,0.1)] hover:border-[rgba(107,174,229,0.25)] transition-colors group">
        <Search className="w-3.5 h-3.5 text-[#4A5180] group-hover:text-[#8B95C4] transition-colors flex-shrink-0" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="flex-1 bg-transparent text-sm text-[#F0F2FF] placeholder:text-[#4A5180] outline-none min-w-0"
        />
        <kbd className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-[#4A5180] bg-[rgba(107,174,229,0.08)] px-1.5 py-0.5 rounded">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Search — mobile */}
        <button className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-[#8B95C4] hover:text-[#F0F2FF] hover:bg-[rgba(107,174,229,0.08)] transition-colors">
          <Search className="w-[17px] h-[17px]" />
        </button>

        {/* ── Notifications ── */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setNotifOpen(v => !v)}
            className={cn(
              'relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
              notifOpen
                ? 'text-[#F0F2FF] bg-[rgba(107,174,229,0.12)]'
                : 'text-[#8B95C4] hover:text-[#F0F2FF] hover:bg-[rgba(107,174,229,0.08)]',
            )}
            aria-label="Notifications"
          >
            <Bell className="w-[17px] h-[17px]" />
            {/* Badge non-lu */}
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#6AAEE5] text-[9px] font-bold text-[#0A0B14] ring-1 ring-[#0A0B14]"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <NotifPanel
                notifications={notifications}
                onMarkRead={handleMarkRead}
                onMarkAll={handleMarkAll}
                onClose={() => setNotifOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Paramètres */}
        <Link
          href="/parametres"
          className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-[#8B95C4] hover:text-[#F0F2FF] hover:bg-[rgba(107,174,229,0.08)] transition-colors"
        >
          <Settings className="w-[17px] h-[17px]" />
        </Link>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-[rgba(107,174,229,0.15)] mx-1" />

        {/* Avatar */}
        <Link href="/parametres" className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-[rgba(107,174,229,0.06)] transition-colors group">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4A7DC4] to-[#2B3580] flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-semibold text-white">{profile.initials}</span>
          </div>
          <div className="hidden md:flex flex-col leading-none">
            <span className="text-[12px] font-semibold text-[#F0F2FF] group-hover:text-white transition-colors">{profile.name}</span>
          </div>
        </Link>
      </div>
    </header>
  )
}
