// ============================================================
// NHBoost — Types globaux
// ============================================================

export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type ServiceType = 'one-shot' | 'subscription'
export type TicketStatus = 'open' | 'in_progress' | 'resolved'

export interface FranchiseProfile {
  id: string
  user_id: string
  company_name: string
  franchise_code: string
  phone?: string
  address?: string
  created_at: string
}

export interface Service {
  id: string
  name: string
  description?: string
  price?: number
  type: ServiceType
  stripe_price_id?: string
  active: boolean
  created_at: string
}

export interface Order {
  id: string
  user_id: string
  service_id: string
  service?: Service
  status: OrderStatus
  client_name?: string
  client_email?: string
  client_phone?: string
  brief?: string
  file_urls?: string[]
  price?: number
  payment_status: PaymentStatus
  stripe_session_id?: string
  created_at: string
  updated_at: string
}

export interface SupportTicket {
  id: string
  user_id: string
  subject: string
  message: string
  status: TicketStatus
  created_at: string
}

export interface KPI {
  label: string
  value: string | number
  delta?: string
  positive?: boolean
}

// ─── Devis & Factures (Secrétaire IA) ─────────────────────────

export type DevisStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'invoiced'
export type FactureStatus = 'unpaid' | 'paid' | 'overdue' | 'cancelled'

export interface DevisItem {
  id: string
  devis_id: string
  service_id?: string
  description: string
  quantity: number
  unit_price: number
  total: number
  sort_order: number
}

export interface Devis {
  id: string
  user_id: string
  ref: string
  client_name: string
  client_email?: string
  client_phone?: string
  company_name?: string
  company_email?: string
  vat_number?: string
  client_address?: string
  subtotal_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  discount: number
  status: DevisStatus
  valid_until?: string
  notes?: string
  facture_id?: string
  items?: DevisItem[]
  created_at: string
  updated_at: string
}

export interface FactureItem {
  id: string
  facture_id: string
  service_id?: string
  description: string
  quantity: number
  unit_price: number
  total: number
  sort_order: number
}

export interface Facture {
  id: string
  user_id: string
  ref: string
  devis_id?: string
  client_name: string
  client_email?: string
  client_phone?: string
  company_name?: string
  company_email?: string
  vat_number?: string
  client_address?: string
  subtotal_ht: number
  tva_rate: number
  tva_amount: number
  total_ttc: number
  discount: number
  status: FactureStatus
  payment_method?: string
  paid_at?: string
  due_date?: string
  notes?: string
  items?: FactureItem[]
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  devis?: Devis
  facture?: Facture
}

export interface ChatSession {
  id: string
  user_id: string
  title: string
  devis_id?: string
  facture_id?: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

// ─── CRM ────────────────────────────────────────────────────

export type CommercialStatus = 'prospect' | 'qualified' | 'active' | 'inactive' | 'lost'
export type UpsellPotential = 'low' | 'medium' | 'high'
export type NoteType = 'note' | 'call' | 'email' | 'meeting' | 'followup' | 'upsell'

export type PipelineStage = 'lead_received' | 'contacted' | 'quote_sent' | 'negotiation' | 'won' | 'lost'

export interface Client {
  id: string
  user_id: string
  company_name: string
  contact_name?: string
  email?: string
  phone?: string
  whatsapp?: string
  website?: string
  instagram?: string
  facebook?: string
  tiktok?: string
  vat_number?: string
  sector?: string
  address?: string
  notes?: string
  commercial_status: CommercialStatus
  upsell_potential: UpsellPotential
  pipeline_stage: PipelineStage
  deal_value: number
  expected_close_date?: string
  loss_reason?: string
  created_at: string
  updated_at: string
}

export interface ClientNote {
  id: string
  client_id: string
  user_id: string
  type: NoteType
  content: string
  followup_date?: string
  completed: boolean
  created_at: string
}

export interface PipelineHistoryEntry {
  id: string
  client_id: string
  user_id: string
  from_stage?: string
  to_stage: string
  note?: string
  created_at: string
}

// ─── Leads entrants ──────────────────────────────────────────

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'

export interface Lead {
  id: string
  user_id: string
  source: string
  source_detail?: string
  name: string
  email?: string
  phone?: string
  company?: string
  message?: string
  status: LeadStatus
  client_id?: string
  fb_leadgen_id?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface FbPageConnection {
  id: string
  user_id: string
  page_id: string
  page_name?: string
  page_access_token: string
  is_active: boolean
  created_at: string
  updated_at: string
}
