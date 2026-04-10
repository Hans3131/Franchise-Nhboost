'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { XCircle, Loader2, RotateCcw } from 'lucide-react'

function PaymentCancelContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRetry = async () => {
    if (!orderId) return
    setRetrying(true)
    setError(null)
    try {
      const res = await fetch('/api/payments/checkout-one-shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Erreur lors de la création de la session')
        setRetrying(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
      setRetrying(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-20 h-20 rounded-full bg-[rgba(245,158,11,0.15)] border-2 border-[#F59E0B] flex items-center justify-center mb-6"
      >
        <XCircle className="w-10 h-10 text-[#F59E0B]" />
      </motion.div>
      <h1 className="text-2xl font-bold text-[#2d2d60] mb-2">Paiement annulé</h1>
      <p className="text-sm text-[#6B7280] mb-6 max-w-sm">
        Votre commande a été enregistrée mais n&apos;est pas encore payée. Vous
        pouvez la régler à tout moment depuis votre espace.
      </p>

      {error && (
        <div className="mb-4 px-4 py-2 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-[12px] text-[#EF4444]">
          {error}
        </div>
      )}

      <div className="flex gap-3 flex-wrap justify-center">
        {orderId && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {retrying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Reprendre le paiement
          </button>
        )}
        <Link
          href="/commandes"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[#2d2d60] text-sm font-medium hover:bg-[#E2E8F2] transition-colors"
        >
          Mes commandes
        </Link>
      </div>
    </div>
  )
}

export default function PaymentCancelPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-lg mx-auto flex items-center justify-center min-h-[70vh]">
          <Loader2 className="w-8 h-8 text-[#6AAEE5] animate-spin" />
        </div>
      }
    >
      <PaymentCancelContent />
    </Suspense>
  )
}
