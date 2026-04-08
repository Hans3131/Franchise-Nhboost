// ============================================================
// factureStore — Supabase-first avec fallback localStorage
// ============================================================

import { createClient } from '@/lib/supabase/client'

export interface LocalFactureItem {
  id:          string
  facture_id:  string
  service_id?: string
  description: string
  quantity:    number
  unit_price:  number
  total:       number
  sort_order:  number
}

export interface LocalFacture {
  id:              string
  ref:             string
  devis_id?:       string
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
  status:          'unpaid' | 'paid' | 'overdue' | 'cancelled'
  payment_method?: string
  paid_at?:        string
  due_date?:       string
  notes?:          string
  items:           LocalFactureItem[]
  created_at:      string
  updated_at:      string
}

const KEY = 'nhboost_factures'

// ─── localStorage helpers ────────────────────────────────────

function localGetAll(): LocalFacture[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function localGenRef(): string {
  const year = new Date().getFullYear()
  const num = String(localGetAll().length + 1).padStart(4, '0')
  return `FAC-${year}-${num}`
}

function localInsert(facture: Omit<LocalFacture, 'id' | 'ref' | 'created_at' | 'updated_at'>): LocalFacture {
  const now = new Date().toISOString()
  const newFacture: LocalFacture = {
    ...facture,
    id:         crypto.randomUUID(),
    ref:        localGenRef(),
    items:      facture.items.map(item => ({ ...item, id: crypto.randomUUID(), facture_id: '' })),
    created_at: now,
    updated_at: now,
  }
  newFacture.items = newFacture.items.map(item => ({ ...item, facture_id: newFacture.id }))
  const all = localGetAll()
  all.unshift(newFacture)
  localStorage.setItem(KEY, JSON.stringify(all))
  return newFacture
}

// ─── Supabase row → LocalFacture ─────────────────────────────

function mapRow(r: Record<string, unknown>, items: Record<string, unknown>[] = []): LocalFacture {
  return {
    id:              String(r.id),
    ref:             String(r.ref ?? ''),
    devis_id:        r.devis_id ? String(r.devis_id) : undefined,
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
    status:          (r.status as LocalFacture['status']) ?? 'unpaid',
    payment_method:  r.payment_method ? String(r.payment_method) : undefined,
    paid_at:         r.paid_at ? String(r.paid_at) : undefined,
    due_date:        r.due_date ? String(r.due_date) : undefined,
    notes:           r.notes ? String(r.notes) : undefined,
    items:           items.map(i => ({
      id:          String(i.id),
      facture_id:  String(i.facture_id),
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

export async function getAll(): Promise<LocalFacture[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('factures')
        .select('*, facture_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!error && data) {
        return data.map(r => mapRow(r, r.facture_items ?? []))
      }
    }
  } catch {}
  return localGetAll()
}

export async function getById(id: string): Promise<LocalFacture | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('factures')
        .select('*, facture_items(*)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      if (!error && data) return mapRow(data, data.facture_items ?? [])
    }
  } catch {}
  return localGetAll().find(f => f.id === id) ?? null
}

export async function insert(
  facture: Omit<LocalFacture, 'id' | 'ref' | 'created_at' | 'updated_at'>
): Promise<LocalFacture> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { items, ...factureData } = facture
      const { data, error } = await supabase
        .from('factures')
        .insert({
          user_id:        user.id,
          devis_id:       factureData.devis_id ?? null,
          client_name:    factureData.client_name,
          client_email:   factureData.client_email ?? null,
          client_phone:   factureData.client_phone ?? null,
          company_name:   factureData.company_name ?? null,
          company_email:  factureData.company_email ?? null,
          vat_number:     factureData.vat_number ?? null,
          client_address: factureData.client_address ?? null,
          subtotal_ht:    factureData.subtotal_ht,
          tva_rate:       factureData.tva_rate,
          tva_amount:     factureData.tva_amount,
          total_ttc:      factureData.total_ttc,
          discount:       factureData.discount,
          status:         factureData.status ?? 'unpaid',
          payment_method: factureData.payment_method ?? null,
          due_date:       factureData.due_date ?? null,
          notes:          factureData.notes ?? null,
        })
        .select()
        .single()
      if (!error && data) {
        const itemsToInsert = items.map((item, i) => ({
          facture_id:  data.id,
          service_id:  item.service_id ?? null,
          description: item.description,
          quantity:    item.quantity,
          unit_price:  item.unit_price,
          total:       item.total,
          sort_order:  i,
        }))
        const { data: itemsData } = await supabase
          .from('facture_items')
          .insert(itemsToInsert)
          .select()
        return mapRow(data, itemsData ?? [])
      }
    }
  } catch {}
  return localInsert(facture)
}

export async function update(
  id: string,
  patch: Partial<Omit<LocalFacture, 'id' | 'ref' | 'created_at' | 'items'>>
): Promise<void> {
  const all = localGetAll().map(f =>
    f.id === id ? { ...f, ...patch, updated_at: new Date().toISOString() } : f
  )
  localStorage.setItem(KEY, JSON.stringify(all))
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('factures').update(patch).eq('id', id).eq('user_id', user.id)
    }
  } catch {}
}
