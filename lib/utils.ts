import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { OrderStatus, PaymentStatus, TicketStatus } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount?: number | null): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "À l'instant"
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Il y a ${hours}h`
  return formatDate(dateString)
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; dot: string }> = {
  pending:     { label: 'En attente', color: 'text-amber-400',   dot: 'bg-amber-400' },
  in_progress: { label: 'En cours',   color: 'text-[#6AAEE5]',  dot: 'bg-[#6AAEE5]' },
  completed:   { label: 'Terminé',    color: 'text-emerald-400', dot: 'bg-emerald-400' },
  cancelled:   { label: 'Annulé',     color: 'text-red-400',    dot: 'bg-red-400' },
}

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
  unpaid:   { label: 'Non payé',   color: 'text-amber-400' },
  paid:     { label: 'Payé',       color: 'text-emerald-400' },
  refunded: { label: 'Remboursé',  color: 'text-[#8B95C4]' },
}

export const TICKET_STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  open:        { label: 'Ouvert',   color: 'text-[#6AAEE5]' },
  in_progress: { label: 'En cours', color: 'text-amber-400' },
  resolved:    { label: 'Résolu',   color: 'text-emerald-400' },
}
