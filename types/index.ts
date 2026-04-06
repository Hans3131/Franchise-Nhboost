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
