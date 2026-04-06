// ============================================================
// notificationStore — localStorage notifications
// ============================================================

export type NotifType = 'order_placed' | 'order_status' | 'ticket_created' | 'system'

export interface LocalNotification {
  id:         string
  type:       NotifType
  title:      string
  message:    string
  link?:      string
  read:       boolean
  created_at: string
}

const KEY = 'nhboost_notifications'
const MAX = 50   // on garde max 50 notifications

// ─── CRUD ─────────────────────────────────────────────────────

export function getAll(): LocalNotification[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function save(notifs: LocalNotification[]) {
  localStorage.setItem(KEY, JSON.stringify(notifs.slice(0, MAX)))
}

export function insert(notif: Omit<LocalNotification, 'id' | 'read' | 'created_at'>): LocalNotification {
  const newNotif: LocalNotification = {
    ...notif,
    id:         crypto.randomUUID(),
    read:       false,
    created_at: new Date().toISOString(),
  }
  const all = getAll()
  all.unshift(newNotif)
  save(all)
  return newNotif
}

export function markRead(id: string) {
  const all = getAll().map(n => n.id === id ? { ...n, read: true } : n)
  save(all)
}

export function markAllRead() {
  const all = getAll().map(n => ({ ...n, read: true }))
  save(all)
}

export function getUnreadCount(): number {
  return getAll().filter(n => !n.read).length
}

export function clear() {
  save([])
}

// ─── Seed — notifications de bienvenue au premier lancement ──
export function seedIfEmpty() {
  if (typeof window === 'undefined') return
  const all = getAll()
  if (all.length > 0) return
  const seeds: Omit<LocalNotification, 'id' | 'read'>[] = [
    {
      type:       'system',
      title:      'Bienvenue sur NHBoost 👋',
      message:    'Votre portail franchisé est prêt. Passez votre première commande dès maintenant.',
      link:       '/commander',
      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      type:       'system',
      title:      'Profil à compléter',
      message:    'Ajoutez le nom de votre entreprise et votre téléphone dans les paramètres.',
      link:       '/parametres',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
  ]
  localStorage.setItem(
    KEY,
    JSON.stringify(seeds.map(s => ({ ...s, id: crypto.randomUUID(), read: false }))),
  )
}
