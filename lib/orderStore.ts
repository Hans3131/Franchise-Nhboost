// ============================================================
// orderStore — stockage local avec fallback Supabase
// Fonctionne immédiatement sans configuration DB
// ============================================================

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
  service_id?:     string       // UUID du service catalogue (table services)
  service_slug?:   string       // slug stable (ex: 'site-onepage')
  quantity?:       number       // quantité commandée (défaut: 1)
  brief?:          string
  objectives?:     string
  required_access?: string
  whatsapp_group?:  string
  domain_name?:     string
  specific_request?: string
  // Suivi
  public_token?:      string
  // Finance
  price:              number   // = actual_sale_price (prix réellement facturé)
  cost:               number   // = internal_cost (coût interne NHBoost)
  sale_price?:        number   // Prix conseillé (théorique, depuis catalogue)
  actual_sale_price?: number   // Prix réellement facturé par le franchisé
  internal_cost?:     number
  profit?:            number   // actual_sale_price - internal_cost
  monthly_price?:     number
  commitment_months?: number
  contract_total?:    number
  status:          'pending' | 'in_progress' | 'completed' | 'cancelled'
  payment_status:  'unpaid' | 'paid' | 'refunded'
  // Dates
  created_at:      string
  updated_at:      string
}

const KEY = 'nhboost_orders'

function genRef(): string {
  const year    = new Date().getFullYear()
  const existing = getAll()
  const num     = String(existing.length + 1).padStart(4, '0')
  return `CMD-${year}-${num}`
}

export function getAll(): LocalOrder[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function insert(order: Omit<LocalOrder, 'id' | 'ref' | 'created_at' | 'updated_at'>): LocalOrder {
  const now = new Date().toISOString()
  const newOrder: LocalOrder = {
    ...order,
    id:           crypto.randomUUID(),
    ref:          genRef(),
    public_token: crypto.randomUUID(),
    created_at:   now,
    updated_at:   now,
  }
  const all = getAll()
  all.unshift(newOrder)
  localStorage.setItem(KEY, JSON.stringify(all))
  return newOrder
}

export function update(id: string, patch: Partial<Omit<LocalOrder, 'id' | 'ref' | 'created_at'>>) {
  const all = getAll().map(o =>
    o.id === id ? { ...o, ...patch, updated_at: new Date().toISOString() } : o
  )
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function getStats() {
  const orders  = getAll()
  const completed = orders.filter(o => o.status === 'completed')
  const revenue = completed.reduce((s, o) => s + o.price, 0)
  // Coûts réels si renseignés, sinon fallback 64% du prix
  const costs   = completed.reduce((s, o) => s + (o.cost > 0 ? o.cost : Math.round(o.price * 0.64)), 0)
  return {
    revenue,
    costs,
    profit: revenue - costs,
    active: orders.filter(o => ['pending', 'in_progress'].includes(o.status)).length,
    total:  orders.length,
    orders,
  }
}
