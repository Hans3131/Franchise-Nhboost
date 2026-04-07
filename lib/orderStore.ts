// ============================================================
// orderStore — Supabase-first avec fallback localStorage
// ============================================================

import { createClient } from '@/lib/supabase/client'

export interface LocalOrder {
  id:              string
  ref:             string
  // Infos client
  client_name:     string
  client_email:    string
  client_phone?:   string
  // Infos entreprise
  company_name?:   string
  company_email?:  string
  sector?:         string
  vat_number?:     string
  website?:        string
  instagram?:      string
  facebook?:       string
  tiktok?:         string
  // Projet
  service:         string
  brief?:          string
  objectives?:     string
  required_access?: string
  // Finance
  price:           number
  status:          'pending' | 'in_progress' | 'completed' | 'cancelled'
  payment_status:  'unpaid' | 'paid' | 'refunded'
  // Dates
  created_at:      string
  updated_at:      string
}

const KEY = 'nhboost_orders'

// ─── localStorage helpers (privés) ───────────────────────────

function localGenRef(): string {
  const year    = new Date().getFullYear()
  const existing = localGetAll()
  const num     = String(existing.length + 1).padStart(4, '0')
  return `CMD-${year}-${num}`
}

function localGetAll(): LocalOrder[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function localInsert(order: Omit<LocalOrder, 'id' | 'ref' | 'created_at' | 'updated_at'>): LocalOrder {
  const now = new Date().toISOString()
  const newOrder: LocalOrder = {
    ...order,
    id:         crypto.randomUUID(),
    ref:        localGenRef(),
    created_at: now,
    updated_at: now,
  }
  const all = localGetAll()
  all.unshift(newOrder)
  localStorage.setItem(KEY, JSON.stringify(all))
  return newOrder
}

function localUpdate(id: string, patch: Partial<Omit<LocalOrder, 'id' | 'ref' | 'created_at'>>) {
  const all = localGetAll().map(o =>
    o.id === id ? { ...o, ...patch, updated_at: new Date().toISOString() } : o
  )
  localStorage.setItem(KEY, JSON.stringify(all))
}

// ─── Supabase row → LocalOrder ───────────────────────────────

function mapRow(r: Record<string, unknown>): LocalOrder {
  return {
    id:              String(r.id),
    ref:             String(r.ref ?? ''),
    client_name:     String(r.client_name ?? ''),
    client_email:    String(r.client_email ?? ''),
    client_phone:    r.client_phone   ? String(r.client_phone)   : undefined,
    company_name:    r.company_name   ? String(r.company_name)   : undefined,
    company_email:   r.company_email  ? String(r.company_email)  : undefined,
    sector:          r.sector         ? String(r.sector)         : undefined,
    vat_number:      r.vat_number     ? String(r.vat_number)     : undefined,
    website:         r.website        ? String(r.website)        : undefined,
    instagram:       r.instagram      ? String(r.instagram)      : undefined,
    facebook:        r.facebook       ? String(r.facebook)       : undefined,
    tiktok:          r.tiktok         ? String(r.tiktok)         : undefined,
    service:         String(r.service ?? ''),
    brief:           r.brief          ? String(r.brief)          : undefined,
    objectives:      r.objectives     ? String(r.objectives)     : undefined,
    required_access: r.required_access ? String(r.required_access) : undefined,
    price:           Number(r.price ?? 0),
    status:          (r.status as LocalOrder['status'])                 ?? 'pending',
    payment_status:  (r.payment_status as LocalOrder['payment_status']) ?? 'unpaid',
    created_at:      String(r.created_at ?? new Date().toISOString()),
    updated_at:      String(r.updated_at ?? r.created_at ?? new Date().toISOString()),
  }
}

// ─── API publique (async, Supabase-first) ────────────────────

export async function getAll(): Promise<LocalOrder[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!error && data) return data.map(r => mapRow(r as Record<string, unknown>))
    }
  } catch {}
  return localGetAll()
}

export async function insert(
  order: Omit<LocalOrder, 'id' | 'ref' | 'created_at' | 'updated_at'>
): Promise<LocalOrder> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id:         user.id,
          service:         order.service,
          client_name:     order.client_name,
          client_email:    order.client_email,
          client_phone:    order.client_phone    ?? null,
          company_name:    order.company_name    ?? null,
          company_email:   order.company_email   ?? null,
          sector:          order.sector          ?? null,
          vat_number:      order.vat_number      ?? null,
          website:         order.website         ?? null,
          instagram:       order.instagram       ?? null,
          facebook:        order.facebook        ?? null,
          tiktok:          order.tiktok          ?? null,
          brief:           order.brief           ?? null,
          objectives:      order.objectives      ?? null,
          required_access: order.required_access ?? null,
          price:           order.price,
          status:          order.status           ?? 'pending',
          payment_status:  order.payment_status   ?? 'unpaid',
        })
        .select()
        .single()
      if (!error && data) return mapRow(data as Record<string, unknown>)
    }
  } catch {}
  // Fallback localStorage
  return localInsert(order)
}

export async function update(
  id: string,
  patch: Partial<Omit<LocalOrder, 'id' | 'ref' | 'created_at'>>
): Promise<void> {
  // localStorage toujours mis a jour pour coherence immediate
  localUpdate(id, patch)
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('orders')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user.id)
    }
  } catch {}
}

export async function getStats() {
  const orders  = await getAll()
  const revenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.price, 0)
  const costs   = Math.round(revenue * 0.64)
  return {
    revenue,
    costs,
    profit: revenue - costs,
    active: orders.filter(o => ['pending', 'in_progress'].includes(o.status)).length,
    total:  orders.length,
    orders,
  }
}
