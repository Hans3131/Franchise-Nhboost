// ============================================================
// notificationStore — Supabase-first avec fallback localStorage
// ============================================================

import { createClient } from '@/lib/supabase/client'

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
const MAX = 50

// ─── localStorage helpers (privés) ───────────────────────────

function localGetAll(): LocalNotification[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function localSave(notifs: LocalNotification[]) {
  localStorage.setItem(KEY, JSON.stringify(notifs.slice(0, MAX)))
}

function localInsert(notif: Omit<LocalNotification, 'id' | 'read' | 'created_at'>): LocalNotification {
  const newNotif: LocalNotification = {
    ...notif,
    id:         crypto.randomUUID(),
    read:       false,
    created_at: new Date().toISOString(),
  }
  const all = localGetAll()
  all.unshift(newNotif)
  localSave(all)
  return newNotif
}

function localMarkRead(id: string) {
  const all = localGetAll().map(n => n.id === id ? { ...n, read: true } : n)
  localSave(all)
}

function localMarkAllRead() {
  const all = localGetAll().map(n => ({ ...n, read: true }))
  localSave(all)
}

// ─── Supabase row → LocalNotification ────────────────────────

function mapRow(r: Record<string, unknown>): LocalNotification {
  return {
    id:         String(r.id),
    type:       (r.type as NotifType) ?? 'system',
    title:      String(r.title ?? ''),
    message:    String(r.message ?? ''),
    link:       r.link ? String(r.link) : undefined,
    read:       Boolean(r.read),
    created_at: String(r.created_at ?? new Date().toISOString()),
  }
}

// ─── API publique (async, Supabase-first) ────────────────────

export async function getAll(): Promise<LocalNotification[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(MAX)
      if (!error && data) return data.map(r => mapRow(r as Record<string, unknown>))
    }
  } catch {}
  return localGetAll()
}

export async function insert(
  notif: Omit<LocalNotification, 'id' | 'read' | 'created_at'>
): Promise<LocalNotification> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type:    notif.type,
          title:   notif.title,
          message: notif.message,
          link:    notif.link ?? null,
        })
        .select()
        .single()
      if (!error && data) return mapRow(data as Record<string, unknown>)
    }
  } catch {}
  return localInsert(notif)
}

export async function markRead(id: string): Promise<void> {
  localMarkRead(id)
  try {
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  } catch {}
}

export async function markAllRead(): Promise<void> {
  localMarkAllRead()
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
    }
  } catch {}
}

export async function getUnreadCount(): Promise<number> {
  const all = await getAll()
  return all.filter(n => !n.read).length
}

export function clear() {
  localSave([])
}

export async function seedIfEmpty(): Promise<void> {
  if (typeof window === 'undefined') return
  const all = await getAll()
  if (all.length > 0) return
  // Seed localStorage uniquement (pas besoin de polluer Supabase)
  const seeds: Omit<LocalNotification, 'id' | 'read'>[] = [
    {
      type:       'system',
      title:      'Bienvenue sur NHBoost \u{1F44B}',
      message:    'Votre portail franchis\u00e9 est pr\u00eat. Passez votre premi\u00e8re commande d\u00e8s maintenant.',
      link:       '/commander',
      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      type:       'system',
      title:      'Profil \u00e0 compl\u00e9ter',
      message:    'Ajoutez le nom de votre entreprise et votre t\u00e9l\u00e9phone dans les param\u00e8tres.',
      link:       '/parametres',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
  ]
  localStorage.setItem(
    KEY,
    JSON.stringify(seeds.map(s => ({ ...s, id: crypto.randomUUID(), read: false }))),
  )
}
