'use client'
import { motion } from 'framer-motion'
import DevisCard from './DevisCard'
import FactureCard from './FactureCard'
import type { ChatMessage as ChatMessageType } from '@/types'

interface ChatMessageProps {
  message: ChatMessageType
  onDownloadDevisPdf: (id: string) => void
  onConvertDevis: (id: string) => void
  onDownloadFacturePdf: (id: string) => void
}

export default function ChatMessage({ message, onDownloadDevisPdf, onConvertDevis, onDownloadFacturePdf }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4A7DC4] to-[#2B3580] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[10px] font-bold">IA</span>
        </div>
      )}

      <div className={`max-w-[80%] space-y-3 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Text bubble */}
        <div className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'rounded-tr-sm bg-gradient-to-r from-[#6AAEE5] to-[#2B3580] text-white'
            : 'rounded-tl-sm bg-[#F5F7FA] border border-[rgba(107,174,229,0.12)] text-[#2d2d60]'
        }`}>
          {message.content}
        </div>

        {/* Devis card if attached */}
        {message.devis && (
          <DevisCard
            devis={message.devis}
            onDownloadPdf={onDownloadDevisPdf}
            onConvert={onConvertDevis}
          />
        )}

        {/* Facture card if attached */}
        {message.facture && (
          <FactureCard
            facture={message.facture}
            onDownloadPdf={onDownloadFacturePdf}
          />
        )}

        {/* Timestamp */}
        <span className={`text-[10px] text-[#9CA3AF] ${isUser ? 'text-right' : ''}`}>
          {new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  )
}
