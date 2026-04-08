'use client'
import { FileText, Download, ArrowRight } from 'lucide-react'
import type { Devis } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Brouillon', color: '#8B95C4', bg: 'rgba(139,149,196,0.1)' },
  sent:     { label: 'Envoyé',    color: '#6AAEE5', bg: 'rgba(106,174,229,0.1)' },
  accepted: { label: 'Accepté',   color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  rejected: { label: 'Refusé',    color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  expired:  { label: 'Expiré',    color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  invoiced: { label: 'Facturé',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
}

interface DevisCardProps {
  devis: Devis
  onDownloadPdf: (id: string) => void
  onConvert: (id: string) => void
}

export default function DevisCard({ devis, onDownloadPdf, onConvert }: DevisCardProps) {
  const s = STATUS_CONFIG[devis.status] ?? STATUS_CONFIG.draft

  return (
    <div className="rounded-xl border border-[rgba(107,174,229,0.2)] bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-[rgba(107,174,229,0.1)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#6AAEE5]" />
          <span className="text-[13px] font-bold text-[#2d2d60]">{devis.ref}</span>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
          {s.label}
        </span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        <p className="text-[13px] text-[#4a81a4]">{devis.client_name}{devis.company_name ? ` — ${devis.company_name}` : ''}</p>
        <p className="text-[11px] text-[#8B95C4]">{devis.items?.length ?? 0} ligne{(devis.items?.length ?? 0) > 1 ? 's' : ''}</p>
        <p className="text-[18px] font-bold text-[#2d2d60] font-mono">{'\u20AC'}{devis.total_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="px-4 py-3 border-t border-[rgba(107,174,229,0.1)] flex items-center gap-2">
        <button
          onClick={() => onDownloadPdf(devis.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold text-[#6AAEE5] bg-[rgba(106,174,229,0.08)] hover:bg-[rgba(106,174,229,0.15)] transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> PDF
        </button>
        {devis.status !== 'invoiced' && (
          <button
            onClick={() => onConvert(devis.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)' }}
          >
            Facturer <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
