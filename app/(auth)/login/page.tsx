'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Schemas ──────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
})

const resetSchema = z.object({
  email: z.string().email('Email invalide'),
})

type LoginForm = z.infer<typeof loginSchema>
type ResetForm = z.infer<typeof resetSchema>

type View = 'login' | 'reset' | 'reset-sent'

// ─── Floating orbs (animated background) ─────────────────────
function FloatingOrbs() {
  const orbs = [
    { size: 340, x: '15%',  y: '20%',  color: '#6AAEE5', opacity: 0.08, duration: 20, delay: 0 },
    { size: 260, x: '75%',  y: '60%',  color: '#2B3580', opacity: 0.06, duration: 25, delay: 2 },
    { size: 200, x: '60%',  y: '10%',  color: '#6AAEE5', opacity: 0.05, duration: 22, delay: 4 },
    { size: 180, x: '25%',  y: '75%',  color: '#4a81a4', opacity: 0.07, duration: 18, delay: 1 },
  ]

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            opacity: orb.opacity,
            filter: `blur(${orb.size * 0.35}px)`,
          }}
          animate={{
            x: [0, 30, -20, 15, 0],
            y: [0, -25, 15, -10, 0],
            scale: [1, 1.1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: orb.delay,
          }}
        />
      ))}
    </div>
  )
}

// ─── Input field ──────────────────────────────────────────────
function Field({
  label,
  icon: Icon,
  error,
  type = 'text',
  rightSlot,
  ...props
}: {
  label: string
  icon: React.ElementType
  error?: string
  type?: string
  rightSlot?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#4a81a4]">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon className={cn('w-4 h-4 transition-colors', error ? 'text-[#EF4444]' : 'text-[#9CA3AF]')} />
        </div>
        <input
          type={type}
          className={cn(
            'w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-xl bg-[#F5F7FA] text-[16px] text-[#2d2d60] placeholder:text-[#9CA3AF]',
            'border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[rgba(106,174,229,0.2)]',
            error
              ? 'border-[rgba(239,68,68,0.4)] focus:border-[#EF4444]'
              : 'border-[#E2E8F2] focus:border-[#6AAEE5] focus:bg-white'
          )}
          {...props}
        />
        {rightSlot && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {rightSlot}
          </div>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-1.5 text-[12px] text-[#EF4444]"
          >
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [remember, setRemember] = useState(false)

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  })

  const onLogin = async (data: LoginForm) => {
    setLoginError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setLoginError('Email ou mot de passe incorrect.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  const onReset = async (data: ResetForm) => {
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/login`,
    })
    setView('reset-sent')
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col items-center justify-center px-4 py-2 sm:p-4 relative">

      {/* Animated background orbs */}
      <FloatingOrbs />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#6AAEE5 1px, transparent 1px), linear-gradient(90deg, #6AAEE5 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center mb-4 sm:mb-6 relative z-10"
      >
        <Image
          src="/logo.png"
          alt="NHBoost"
          width={200}
          height={60}
          className="w-32 sm:w-44 h-auto"
          priority
        />
        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4a81a4] mt-1.5">
          Portail Franchisé
        </span>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="rounded-2xl bg-white border border-[#E2E8F2] px-5 py-4 sm:p-7 shadow-xl shadow-[rgba(106,174,229,0.08)]">

          <AnimatePresence mode="wait">

            {/* ── Login view ── */}
            {view === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-lg sm:text-xl font-bold text-[#2d2d60] mb-0.5">Connexion</h1>
                <p className="text-[12px] sm:text-[13px] text-[#6B7280] mb-4">Accédez à votre espace franchisé.</p>

                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-3 sm:space-y-4">
                  <Field
                    label="Email"
                    icon={Mail}
                    type="email"
                    placeholder="vous@nhboost.com"
                    autoComplete="email"
                    error={loginForm.formState.errors.email?.message}
                    {...loginForm.register('email')}
                  />

                  <Field
                    label="Mot de passe"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    error={loginForm.formState.errors.password?.message}
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="text-[#9CA3AF] hover:text-[#4a81a4] transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />
                        }
                      </button>
                    }
                    {...loginForm.register('password')}
                  />

                  {/* Global error */}
                  <AnimatePresence>
                    {loginError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0" />
                        <p className="text-[12px] text-[#EF4444]">{loginError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Remember + Forgot */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={e => setRemember(e.target.checked)}
                        className="w-4 h-4 rounded border-[#E2E8F2] text-[#6AAEE5] focus:ring-[#6AAEE5] focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-[13px] text-[#4a81a4] group-hover:text-[#2d2d60] transition-colors">
                        Se souvenir de moi
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        resetForm.setValue('email', loginForm.getValues('email'))
                        setView('reset')
                      }}
                      className="text-[13px] font-medium text-[#6AAEE5] hover:text-[#2d2d60] transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loginForm.formState.isSubmitting}
                    className={cn(
                      'w-full py-3 rounded-xl font-semibold text-[14px] transition-all duration-300',
                      'bg-gradient-to-r from-[#2d2d60] to-[#6AAEE5] text-white',
                      'hover:shadow-lg hover:shadow-[rgba(106,174,229,0.25)] hover:brightness-110',
                      'active:scale-[0.98]',
                      'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:hover:shadow-none'
                    )}
                  >
                    {loginForm.formState.isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connexion…
                      </span>
                    ) : (
                      'Se connecter'
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Reset password view ── */}
            {view === 'reset' && (
              <motion.div
                key="reset"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => setView('login')}
                  className="flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#2d2d60] transition-colors mb-5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Retour à la connexion
                </button>

                <h2 className="text-xl font-bold text-[#2d2d60] mb-1">Mot de passe oublié</h2>
                <p className="text-[13px] text-[#6B7280] mb-5">
                  Entrez votre email. Nous vous enverrons un lien de réinitialisation.
                </p>

                <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
                  <Field
                    label="Email"
                    icon={Mail}
                    type="email"
                    placeholder="vous@nhboost.com"
                    autoComplete="email"
                    error={resetForm.formState.errors.email?.message}
                    {...resetForm.register('email')}
                  />

                  <button
                    type="submit"
                    disabled={resetForm.formState.isSubmitting}
                    className={cn(
                      'w-full py-3 rounded-xl font-semibold text-[14px] transition-all duration-300',
                      'bg-gradient-to-r from-[#2d2d60] to-[#6AAEE5] text-white',
                      'hover:shadow-lg hover:shadow-[rgba(106,174,229,0.25)] hover:brightness-110',
                      'active:scale-[0.98]',
                      'disabled:opacity-60 disabled:cursor-not-allowed'
                    )}
                  >
                    {resetForm.formState.isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Envoi…
                      </span>
                    ) : (
                      'Envoyer le lien'
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Reset sent confirmation ── */}
            {view === 'reset-sent' && (
              <motion.div
                key="reset-sent"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-14 h-14 rounded-2xl bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 className="w-7 h-7 text-[#22C55E]" />
                </motion.div>

                <h2 className="text-lg font-bold text-[#2d2d60] mb-2">Email envoyé !</h2>
                <p className="text-[13px] text-[#6B7280] mb-1">
                  Vérifiez votre boîte mail.
                </p>
                <p className="text-[12px] text-[#9CA3AF] mb-6">
                  Le lien expire dans <span className="text-[#4a81a4] font-medium">15 minutes</span>.
                </p>

                <button
                  onClick={() => {
                    setView('login')
                    resetForm.reset()
                  }}
                  className="text-[13px] font-medium text-[#6AAEE5] hover:text-[#2d2d60] transition-colors"
                >
                  Retour à la connexion
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-[#9CA3AF] mt-3 sm:mt-5">
          © 2026 NHBoost · Tous droits réservés ·{' '}
          <Link href="#" className="hover:text-[#4a81a4] transition-colors">Mentions légales</Link>
        </p>
      </motion.div>

    </div>
  )
}
