'use client'
import { FileText, Download } from 'lucide-react'
import type { Facture } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  unpaid:    { label: 'Impayée',   color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  paid:      { label: 'Payée',     color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  overdue:   { label: 'En retard', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  cancelled: { label: 'Annulée',   color: '#8B95C4', bg: 'rgba(139,149,196,0.1)' },
}

interface FactureCardProps {
  facture: Facture
  onDownloadPdf: (id: string) => void
}

export default function FactureCard({ facture, onDownloadPdf }: FactureCardProps) {
  const s = STATUS_CONFIG[facture.status] ?? STATUS_CONFIG.unpaid

  return (
    <div className="rounded-xl border border-[rgba(107,174,229,0.2)] bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-[rgba(107,174,229,0.1)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#8B5CF6]" />
          <span className="text-[13px] font-bold text-[#2d2d60]">{facture.ref}</span>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
          {s.label}
        </span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        <p className="text-[13px] text-[#4a81a4]">{facture.client_name}{facture.company_name ? ` — ${facture.company_name}` : ''}</p>
        <p className="text-[11px] text-[#8B95C4]">{facture.items?.length ?? 0} ligne{(facture.items?.length ?? 0) > 1 ? 's' : ''}</p>
        <p className="text-[18px] font-bold text-[#2d2d60] font-mono">{'\u20AC'}{facture.total_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</p>
        {facture.due_date && (
          <p className="text-[11px] text-[#8B95C4]">
            {'\u00C9'}ch{'\u00E9'}ance : {new Date(facture.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
      <div className="px-4 py-3 border-t border-[rgba(107,174,229,0.1)]">
        <button
          onClick={() => onDownloadPdf(facture.id)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold text-[#6AAEE5] bg-[rgba(106,174,229,0.08)] hover:bg-[rgba(106,174,229,0.15)] transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> PDF
        </button>
      </div>
    </div>
  )
}
