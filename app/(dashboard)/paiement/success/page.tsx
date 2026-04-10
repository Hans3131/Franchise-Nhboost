'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, ArrowRight, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')
  const [status, setStatus] = useState<'loading' | 'paid' | 'pending'>('loading')

  // Polling léger : vérifie si le webhook a mis la commande en "paid"
  useEffect(() => {
    if (!orderId) {
      setStatus('pending')
      return
    }
    const supabase = createClient()
    let attempts = 0
    const maxAttempts = 12 // 12 × 1.5s = 18 secondes max

    const check = async () => {
      attempts += 1
      const { data } = await supabase
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .maybeSingle()

      if (data?.payment_status === 'paid') {
        setStatus('paid')
        return true
      }
      return false
    }

    const interval = setInterval(async () => {
      const done = await check()
      if (done || attempts >= maxAttempts) {
        clearInterval(interval)
        if (attempts >= maxAttempts && status !== 'paid') setStatus('pending')
      }
    }, 1500)

    check() // check immédiat
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  return (
    <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      {status === 'loading' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Loader2 className="w-12 h-12 text-[#6AAEE5] animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#2d2d60] mb-2">Confirmation en cours…</h1>
          <p className="text-sm text-[#6B7280]">
            Nous vérifions votre paiement auprès de Stripe.
          </p>
        </motion.div>
      )}

      {status === 'paid' && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="w-20 h-20 rounded-full bg-[rgba(34,197,94,0.15)] border-2 border-[#22C55E] flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-[#22C55E]" />
          </div>
          <h1 className="text-2xl font-bold text-[#2d2d60] mb-2">Paiement confirmé !</h1>
          <p className="text-sm text-[#6B7280] mb-6">
            Votre commande a été enregistrée et est en cours de traitement.
          </p>
          <Link
            href="/commandes"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Voir mes commandes <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {status === 'pending' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="w-20 h-20 rounded-full bg-[rgba(245,158,11,0.15)] border-2 border-[#F59E0B] flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-[#F59E0B]" />
          </div>
          <h1 className="text-xl font-bold text-[#2d2d60] mb-2">Paiement en cours de validation</h1>
          <p className="text-sm text-[#6B7280] mb-6">
            Votre paiement a été reçu par Stripe. La confirmation peut prendre
            quelques minutes, vous recevrez une notification dès qu&apos;elle arrive.
          </p>
          <Link
            href="/commandes"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Voir mes commandes <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-lg mx-auto flex items-center justify-center min-h-[70vh]">
          <Loader2 className="w-8 h-8 text-[#6AAEE5] animate-spin" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  )
}
