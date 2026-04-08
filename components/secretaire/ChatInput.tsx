'use client'
import { useState, useRef, useEffect } from 'react'
import { SendHorizonal } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [value])

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const QUICK_ACTIONS = [
    'Nouveau devis',
    'Mes devis récents',
    'Convertir en facture',
  ]

  return (
    <div className="border-t border-[rgba(107,174,229,0.1)] bg-white p-4 space-y-3">
      {/* Quick action chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action}
            onClick={() => { if (!disabled) onSend(action) }}
            disabled={disabled}
            className="px-3 py-1.5 rounded-full text-[11px] font-medium border border-[rgba(107,174,229,0.2)] text-[#4a81a4] hover:bg-[rgba(106,174,229,0.08)] transition-colors disabled:opacity-40"
          >
            {action}
          </button>
        ))}
      </div>
      {/* Input area */}
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Écrivez votre message..."
          rows={1}
          className="flex-1 resize-none px-4 py-3 rounded-xl bg-[#F5F7FA] border border-[rgba(107,174,229,0.15)] text-[14px] text-[#2d2d60] placeholder:text-[#9CA3AF] outline-none focus:border-[#6AAEE5] transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #6AAEE5, #2B3580)' }}
        >
          <SendHorizonal className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
