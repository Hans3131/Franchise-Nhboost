'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
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

// ─── Floating label input ─────────────────────────────────────
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
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#4A5180]">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon className={cn('w-4 h-4 transition-colors', error ? 'text-[#EF4444]' : 'text-[#4A5180]')} />
        </div>
        <input
          type={type}
          className={cn(
            'w-full pl-10 pr-10 py-3 rounded-xl bg-[#1D2240] text-[14px] text-[#F0F2FF] placeholder:text-[#4A5180]',
            'border transition-all duration-200 focus:outline-none',
            error
              ? 'border-[rgba(239,68,68,0.4)] focus:border-[rgba(239,68,68,0.7)]'
              : 'border-[rgba(107,174,229,0.15)] focus:border-[rgba(106,174,229,0.4)] focus:bg-[#1D2240]'
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

  // Login form
  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // Reset form
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
    // Always show success (security: don't reveal if email exists)
    setView('reset-sent')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#2B3580]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-[#6AAEE5]/8 rounded-full blur-[100px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(106,174,229,1) 1px, transparent 1px), linear-gradient(90deg, rgba(106,174,229,1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center mb-8 relative z-10"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6AAEE5] to-[#2B3580] flex items-center justify-center mb-3 shadow-lg shadow-[#6AAEE5]/20">
          <span className="text-white font-bold text-lg tracking-tight">NH</span>
        </div>
        <span className="text-[#F0F2FF] font-bold text-xl tracking-tight">NHBoost</span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#4A5180] mt-0.5">Portail Franchisé</span>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="rounded-2xl bg-[#161A34] border border-[rgba(107,174,229,0.15)] p-7 shadow-2xl shadow-black/40">

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
                <h1 className="text-xl font-bold text-[#F0F2FF] mb-1">Connexion</h1>
                <p className="text-[13px] text-[#8B95C4] mb-6">Accédez à votre espace franchisé.</p>

                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <Field
                    label="Email"
                    icon={Mail}
                    type="email"
                    placeholder="vous@nhboost.com"
                    error={loginForm.formState.errors.email?.message}
                    {...loginForm.register('email')}
                  />

                  <Field
                    label="Mot de passe"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    error={loginForm.formState.errors.password?.message}
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="text-[#4A5180] hover:text-[#8B95C4] transition-colors"
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
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0" />
                        <p className="text-[12px] text-[#EF4444]">{loginError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Forgot password */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm.setValue('email', loginForm.getValues('email'))
                        setView('reset')
                      }}
                      className="text-[12px] text-[#6AAEE5] hover:text-[#F0F2FF] transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loginForm.formState.isSubmitting}
                    className={cn(
                      'w-full py-3 rounded-xl font-semibold text-[14px] transition-all duration-200',
                      'bg-gradient-to-r from-[#6AAEE5] to-[#4A7DC4] text-white',
                      'hover:shadow-lg hover:shadow-[#6AAEE5]/20 hover:brightness-110',
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
                  className="flex items-center gap-1.5 text-[12px] text-[#4A5180] hover:text-[#8B95C4] transition-colors mb-5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Retour à la connexion
                </button>

                <h2 className="text-xl font-bold text-[#F0F2FF] mb-1">Mot de passe oublié</h2>
                <p className="text-[13px] text-[#8B95C4] mb-6">
                  Entrez votre email. Nous vous enverrons un lien de réinitialisation.
                </p>

                <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
                  <Field
                    label="Email"
                    icon={Mail}
                    type="email"
                    placeholder="vous@nhboost.com"
                    error={resetForm.formState.errors.email?.message}
                    {...resetForm.register('email')}
                  />

                  <button
                    type="submit"
                    disabled={resetForm.formState.isSubmitting}
                    className={cn(
                      'w-full py-3 rounded-xl font-semibold text-[14px] transition-all duration-200',
                      'bg-gradient-to-r from-[#6AAEE5] to-[#4A7DC4] text-white',
                      'hover:shadow-lg hover:shadow-[#6AAEE5]/20 hover:brightness-110',
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
                  className="w-14 h-14 rounded-2xl bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 className="w-7 h-7 text-[#22C55E]" />
                </motion.div>

                <h2 className="text-lg font-bold text-[#F0F2FF] mb-2">Email envoyé !</h2>
                <p className="text-[13px] text-[#8B95C4] mb-1">
                  Vérifiez votre boîte mail.
                </p>
                <p className="text-[12px] text-[#4A5180] mb-6">
                  Le lien expire dans <span className="text-[#8B95C4]">15 minutes</span>.
                </p>

                <button
                  onClick={() => {
                    setView('login')
                    resetForm.reset()
                  }}
                  className="text-[13px] font-medium text-[#6AAEE5] hover:text-[#F0F2FF] transition-colors"
                >
                  Retour à la connexion
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-[#4A5180] mt-5">
          © 2026 NHBoost · Tous droits réservés ·{' '}
          <Link href="#" className="hover:text-[#8B95C4] transition-colors">Mentions légales</Link>
        </p>
      </motion.div>

    </div>
  )
}
