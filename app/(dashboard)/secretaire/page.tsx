'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bot, RotateCcw } from 'lucide-react'
import ChatMessage from '@/components/secretaire/ChatMessage'
import ChatInput from '@/components/secretaire/ChatInput'
import TypingIndicator from '@/components/secretaire/TypingIndicator'
import { insert as insertDevis } from '@/lib/devisStore'
import type { ChatMessage as ChatMessageType, Devis, Facture } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────
function makeId() {
  return crypto.randomUUID()
}

function nowISO() {
  return new Date().toISOString()
}

const WELCOME_MESSAGE: ChatMessageType = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Bonjour ! Je suis votre Secr\u00e9taire IA. Je peux vous aider \u00e0 cr\u00e9er des devis, g\u00e9rer vos factures et r\u00e9pondre \u00e0 vos questions administratives.\n\nQue puis-je faire pour vous ?',
  timestamp: nowISO(),
}

const ACTION_REGEX = /```action\n([\s\S]*?)```/g

// ─── PDF download helper ─────────────────────────────────────
async function downloadPdf(url: string, body: object, filename: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Component ───────────────────────────────────────────────
export default function SecretairePage() {
  const [messages, setMessages] = useState<ChatMessageType[]>([WELCOME_MESSAGE])
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, isStreaming])

  // ─── Parse action blocks from assistant message ──────────
  const parseActions = useCallback(async (content: string): Promise<{ devis?: Devis; facture?: Facture }> => {
    const result: { devis?: Devis; facture?: Facture } = {}
    let match: RegExpExecArray | null

    while ((match = ACTION_REGEX.exec(content)) !== null) {
      try {
        const action = JSON.parse(match[1])

        if (action.type === 'create_devis' && action.data) {
          const d = action.data
          const items = (d.items ?? []).map((item: { service_id?: string; description: string; quantity: number; unit_price: number }, i: number) => ({
            id: crypto.randomUUID(),
            devis_id: '',
            service_id: item.service_id,
            description: item.description,
            quantity: item.quantity ?? 1,
            unit_price: item.unit_price,
            total: (item.quantity ?? 1) * item.unit_price,
            sort_order: i,
          }))
          const subtotal = items.reduce((s: number, it: { total: number }) => s + it.total, 0)
          const discount = Number(d.discount ?? 0)
          const tvaRate = Number(d.tva_rate ?? 21)
          const tvaAmount = Math.round((subtotal - discount) * tvaRate) / 100
          const totalTtc = subtotal - discount + tvaAmount
          const validUntil = new Date()
          validUntil.setDate(validUntil.getDate() + 30)

          const saved = await insertDevis({
            client_name:    d.client_name ?? '',
            client_email:   d.client_email,
            client_phone:   d.client_phone,
            company_name:   d.company_name,
            company_email:  d.company_email,
            vat_number:     d.vat_number,
            client_address: d.client_address,
            subtotal_ht:    subtotal,
            tva_rate:       tvaRate,
            tva_amount:     tvaAmount,
            total_ttc:      totalTtc,
            discount,
            status:         'draft',
            valid_until:    validUntil.toISOString().split('T')[0],
            notes:          d.notes,
            items,
          })
          result.devis = { ...saved, items: saved.items as Devis['items'] } as unknown as Devis
        }

        if (action.type === 'convert_devis' && action.devis_id) {
          try {
            const res = await fetch('/api/devis/convert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ devis_id: action.devis_id }),
            })
            if (res.ok) {
              const data = await res.json()
              result.facture = data.facture as Facture
            }
          } catch {
            /* best-effort */
          }
        }

        if (action.type === 'show_devis' && action.data) {
          result.devis = action.data as Devis
        }

        if (action.type === 'show_facture' && action.data) {
          result.facture = action.data as Facture
        }
      } catch {
        /* malformed JSON — skip */
      }
    }

    // Reset regex lastIndex for next usage
    ACTION_REGEX.lastIndex = 0

    return result
  }, [])

  // ─── Send message ────────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    const userMsg: ChatMessageType = {
      id: makeId(),
      role: 'user',
      content: text,
      timestamp: nowISO(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!res.ok) throw new Error('Chat API error')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      const assistantId = makeId()

      // Create initial assistant message
      const assistantMsg: ChatMessageType = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: nowISO(),
      }
      setMessages(prev => [...prev, assistantMsg])

      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                if (parsed.error) {
                  fullContent = `Erreur : ${parsed.error}`
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantId ? { ...m, content: fullContent } : m
                    )
                  )
                } else if (parsed.text) {
                  fullContent += parsed.text
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantId ? { ...m, content: fullContent } : m
                    )
                  )
                }
              } catch {
                /* malformed SSE line — skip */
              }
            }
          }
        }
      }

      // Parse action blocks after streaming is complete
      const actionResult = await parseActions(fullContent)

      // Strip action blocks from displayed content
      const cleanContent = fullContent.replace(ACTION_REGEX, '').trim()
      ACTION_REGEX.lastIndex = 0

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: cleanContent || fullContent, devis: actionResult.devis, facture: actionResult.facture }
            : m
        )
      )
    } catch {
      const errorMsg: ChatMessageType = {
        id: makeId(),
        role: 'assistant',
        content: 'D\u00e9sol\u00e9, une erreur est survenue. Veuillez r\u00e9essayer.',
        timestamp: nowISO(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsStreaming(false)
    }
  }, [messages, parseActions])

  // ─── Action handlers ─────────────────────────────────────
  const handleDownloadDevisPdf = useCallback((id: string) => {
    downloadPdf('/api/devis/generate-pdf', { devisId: id }, `devis-${id}.pdf`)
  }, [])

  const handleConvertDevis = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/devis/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devisId: id }),
      })
      if (!res.ok) throw new Error('Convert error')
      const data = await res.json()
      const facture = data.facture as Facture

      const convertMsg: ChatMessageType = {
        id: makeId(),
        role: 'assistant',
        content: `Le devis a \u00e9t\u00e9 converti en facture ${facture.ref} avec succ\u00e8s.`,
        timestamp: nowISO(),
        facture,
      }
      setMessages(prev => [...prev, convertMsg])
    } catch {
      const errorMsg: ChatMessageType = {
        id: makeId(),
        role: 'assistant',
        content: 'Erreur lors de la conversion du devis en facture.',
        timestamp: nowISO(),
      }
      setMessages(prev => [...prev, errorMsg])
    }
  }, [])

  const handleDownloadFacturePdf = useCallback((id: string) => {
    downloadPdf('/api/facture/generate-pdf', { factureId: id }, `facture-${id}.pdf`)
  }, [])

  const handleNewConversation = useCallback(() => {
    setMessages([{ ...WELCOME_MESSAGE, id: makeId(), timestamp: nowISO() }])
  }, [])

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center justify-between px-6 py-4 border-b border-[rgba(107,174,229,0.1)] bg-white flex-shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4A7DC4] to-[#2B3580] flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-[#2d2d60]">Secr{'\u00e9'}taire IA</h1>
            <p className="text-[11px] text-[#8B95C4]">Assistant devis & facturation</p>
          </div>
        </div>
        <button
          onClick={handleNewConversation}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-[#4a81a4] border border-[rgba(107,174,229,0.2)] hover:bg-[rgba(106,174,229,0.08)] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Nouvelle conversation
        </button>
      </motion.div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
      >
        {messages.map(msg => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onDownloadDevisPdf={handleDownloadDevisPdf}
            onConvertDevis={handleConvertDevis}
            onDownloadFacturePdf={handleDownloadFacturePdf}
          />
        ))}
        {isStreaming && <TypingIndicator />}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  )
}
