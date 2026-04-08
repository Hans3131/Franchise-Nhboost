'use client'
import { motion } from 'framer-motion'

export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4A7DC4] to-[#2B3580] flex items-center justify-center flex-shrink-0">
        <span className="text-white text-[10px] font-bold">IA</span>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#1D2240] border border-[rgba(107,174,229,0.12)]">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-[#6AAEE5]"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
