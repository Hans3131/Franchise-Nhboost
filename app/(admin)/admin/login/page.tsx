'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, Shield, AlertCircle, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function AdminLoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [accessDenied, setAccessDenied] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('denied') === '1'
    }
    return false
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginForm) => {
    setError('')
    setAccessDenied(false)
    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (authError) {
      setError('Email ou mot de passe incorrect.')
      return
    }

    // Check role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Erreur d\'authentification.')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'franchisee'

    if (role !== 'admin' && role !== 'super_admin') {
      await supabase.auth.signOut()
      setAccessDenied(true)
      return
    }

    router.push('/admin/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0A0B14] flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-[#EF4444]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-[#6AAEE5]/5 rounded-full blur-[120px]" />
      </div>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{ backgroundImage: 'linear-gradient(#6AAEE5 1px, transparent 1px), linear-gradient(90deg, #6AAEE5 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      {/* Logo + Admin badge */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex flex-col items-center mb-6 relative z-10">
        <Image src="/logo.png" alt="NHBoost" width={160} height={48} className="w-36 h-auto" priority />
        <div className="flex items-center gap-2 mt-3">
          <Shield className="w-4 h-4 text-[#EF4444]" />
          <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-[#EF4444]">Administration</span>
        </div>
      </motion.div>

      {/* Card */}
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }} className="relative z-10 w-full max-w-sm">
        <div className="rounded-2xl bg-[#161A34] border border-[rgba(239,68,68,0.15)] p-6 shadow-2xl shadow-black/40">

          <h1 className="text-xl font-bold text-[#F0F2FF] mb-1">Connexion Admin</h1>
          <p className="text-[13px] text-[#8B95C4] mb-5">Accès réservé à l&apos;équipe NHBoost.</p>

          {/* Access denied message */}
          <AnimatePresence>
            {accessDenied && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] mb-4">
                <Shield className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-[#EF4444]">Accès refusé</p>
                  <p className="text-[12px] text-[#EF4444]/70 mt-0.5">
                    Ce compte n&apos;a pas les permissions administrateur. Contactez votre responsable si vous pensez que c&apos;est une erreur.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-[#4A5180]">Email</label>
              <div className="relative">
                <Mail className={cn('absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4', errors.email ? 'text-[#EF4444]' : 'text-[#4A5180]')} />
                <input type="email" {...register('email')} placeholder="admin@nhboost.com" autoComplete="email"
                  className={cn(
                    'w-full pl-10 pr-4 py-3 rounded-xl bg-[#1D2240] text-[16px] text-[#F0F2FF] placeholder:text-[#4A5180] border outline-none transition-all focus:ring-2 focus:ring-[rgba(239,68,68,0.15)]',
                    errors.email ? 'border-[rgba(239,68,68,0.4)]' : 'border-[rgba(107,174,229,0.15)] focus:border-[rgba(239,68,68,0.4)]'
                  )} />
              </div>
              {errors.email && <p className="text-[11px] text-[#EF4444]">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-[#4A5180]">Mot de passe</label>
              <div className="relative">
                <Lock className={cn('absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4', errors.password ? 'text-[#EF4444]' : 'text-[#4A5180]')} />
                <input type={showPassword ? 'text' : 'password'} {...register('password')} placeholder="••••••••" autoComplete="current-password"
                  className={cn(
                    'w-full pl-10 pr-10 py-3 rounded-xl bg-[#1D2240] text-[16px] text-[#F0F2FF] placeholder:text-[#4A5180] border outline-none transition-all focus:ring-2 focus:ring-[rgba(239,68,68,0.15)]',
                    errors.password ? 'border-[rgba(239,68,68,0.4)]' : 'border-[rgba(107,174,229,0.15)] focus:border-[rgba(239,68,68,0.4)]'
                  )} />
                <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4A5180] hover:text-[#8B95C4]">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-[#EF4444]">{errors.password.message}</p>}
            </div>

            {/* Auth error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)]">
                  <AlertCircle className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0" />
                  <p className="text-[12px] text-[#EF4444]">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button type="submit" disabled={isSubmitting}
              className="w-full py-3 rounded-xl font-semibold text-[14px] text-white transition-all duration-300 bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:shadow-lg hover:shadow-[rgba(239,68,68,0.25)] active:scale-[0.98] disabled:opacity-60">
              {isSubmitting
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Connexion…</span>
                : <span className="flex items-center justify-center gap-2"><Shield className="w-4 h-4" /> Se connecter</span>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[#4A5180] mt-5">
          © 2026 NHBoost · Espace Administration
        </p>
      </motion.div>
    </div>
  )
}
