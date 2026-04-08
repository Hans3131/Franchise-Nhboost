// ============================================================
// devisStore — Supabase-first avec fallback localStorage
// ============================================================

import { createClient } from '@/lib/supabase/client'

export interface LocalDevisItem {
  id:          string
  devis_id:    string
  service_id?: string
  description: string
  quantity:    number
  unit_price:  number
  total:       number
  sort_order:  number
}

export interface LocalDevis {
  id:              string
  ref:             string
  client_name:     string
  client_email?:   string
  client_phone?:   string
  company_name?:   string
  company_email?:  string
  vat_number?:     string
  client_address?: string
  subtotal_ht:     number
  tva_rate:        number
  tva_amount:      number
  total_ttc:       number
  discount:        number
  status:          'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'invoiced'
  valid_until?:    string
  notes?:          string
  facture_id?:     string
  items:           LocalDevisItem[]
  created_at:      string
  updated_at:      string
}

const KEY = 'nhboost_devis'

// ─── localStorage helpers ────────────────────────────────────

function localGetAll(): LocalDevis[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function localGenRef(): string {
  const year = new Date().getFullYear()
  const num = String(localGetAll().length + 1).padStart(4, '0')
  return `DEV-${year}-${num}`
}

function localInsert(devis: Omit<LocalDevis, 'id' | 'ref' | 'created_at' | 'updated_at'>): LocalDevis {
  const now = new Date().toISOString()
  const newDevis: LocalDevis = {
    ...devis,
    id:         crypto.randomUUID(),
    ref:        localGenRef(),
    items:      devis.items.map(item => ({ ...item, id: crypto.randomUUID(), devis_id: '' })),
    created_at: now,
    updated_at: now,
  }
  newDevis.items = newDevis.items.map(item => ({ ...item, devis_id: newDevis.id }))
  const all = localGetAll()
  all.unshift(newDevis)
  localStorage.setItem(KEY, JSON.stringify(all))
  return newDevis
}

// ─── Supabase row → LocalDevis ───────────────────────────────

function mapRow(r: Record<string, unknown>, items: Record<string, unknown>[] = []): LocalDevis {
  return {
    id:              String(r.id),
    ref:             String(r.ref ?? ''),
    client_name:     String(r.client_name ?? ''),
    client_email:    r.client_email ? String(r.client_email) : undefined,
    client_phone:    r.client_phone ? String(r.client_phone) : undefined,
    company_name:    r.company_name ? String(r.company_name) : undefined,
    company_email:   r.company_email ? String(r.company_email) : undefined,
    vat_number:      r.vat_number ? String(r.vat_number) : undefined,
    client_address:  r.client_address ? String(r.client_address) : undefined,
    subtotal_ht:     Number(r.subtotal_ht ?? 0),
    tva_rate:        Number(r.tva_rate ?? 21),
    tva_amount:      Number(r.tva_amount ?? 0),
    total_ttc:       Number(r.total_ttc ?? 0),
    discount:        Number(r.discount ?? 0),
    status:          (r.status as LocalDevis['status']) ?? 'draft',
    valid_until:     r.valid_until ? String(r.valid_until) : undefined,
    notes:           r.notes ? String(r.notes) : undefined,
    facture_id:      r.facture_id ? String(r.facture_id) : undefined,
    items:           items.map(i => ({
      id:          String(i.id),
      devis_id:    String(i.devis_id),
      service_id:  i.service_id ? String(i.service_id) : undefined,
      description: String(i.description ?? ''),
      quantity:    Number(i.quantity ?? 1),
      unit_price:  Number(i.unit_price ?? 0),
      total:       Number(i.total ?? 0),
      sort_order:  Number(i.sort_order ?? 0),
    })),
    created_at: String(r.created_at ?? new Date().toISOString()),
    updated_at: String(r.updated_at ?? r.created_at ?? new Date().toISOString()),
  }
}

// ─── API publique (async, Supabase-first) ────────────────────

export async function getAll(): Promise<LocalDevis[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('devis')
        .select('*, devis_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!error && data) {
        return data.map(r => mapRow(r, r.devis_items ?? []))
      }
    }
  } catch {}
  return localGetAll()
}

export async function getById(id: string): Promise<LocalDevis | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('devis')
        .select('*, devis_items(*)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      if (!error && data) return mapRow(data, data.devis_items ?? [])
    }
  } catch {}
  return localGetAll().find(d => d.id === id) ?? null
}

export async function insert(
  devis: Omit<LocalDevis, 'id' | 'ref' | 'created_at' | 'updated_at'>
): Promise<LocalDevis> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { items, ...devisData } = devis
      const { data, error } = await supabase
        .from('devis')
        .insert({
          user_id:        user.id,
          client_name:    devisData.client_name,
          client_email:   devisData.client_email ?? null,
          client_phone:   devisData.client_phone ?? null,
          company_name:   devisData.company_name ?? null,
          company_email:  devisData.company_email ?? null,
          vat_number:     devisData.vat_number ?? null,
          client_address: devisData.client_address ?? null,
          subtotal_ht:    devisData.subtotal_ht,
          tva_rate:       devisData.tva_rate,
          tva_amount:     devisData.tva_amount,
          total_ttc:      devisData.total_ttc,
          discount:       devisData.discount,
          status:         devisData.status ?? 'draft',
          valid_until:    devisData.valid_until ?? null,
          notes:          devisData.notes ?? null,
        })
        .select()
        .single()
      if (!error && data) {
        // Insert items
        const itemsToInsert = items.map((item, i) => ({
          devis_id:    data.id,
          service_id:  item.service_id ?? null,
          description: item.description,
          quantity:    item.quantity,
          unit_price:  item.unit_price,
          total:       item.total,
          sort_order:  i,
        }))
        const { data: itemsData } = await supabase
          .from('devis_items')
          .insert(itemsToInsert)
          .select()
        return mapRow(data, itemsData ?? [])
      }
    }
  } catch {}
  return localInsert(devis)
}

export async function update(
  id: string,
  patch: Partial<Omit<LocalDevis, 'id' | 'ref' | 'created_at' | 'items'>>
): Promise<void> {
  // localStorage
  const all = localGetAll().map(d =>
    d.id === id ? { ...d, ...patch, updated_at: new Date().toISOString() } : d
  )
  localStorage.setItem(KEY, JSON.stringify(all))
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('devis').update(patch).eq('id', id).eq('user_id', user.id)
    }
  } catch {}
}
