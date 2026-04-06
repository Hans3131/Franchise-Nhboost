'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Lock, Building2, Phone, MapPin,
  CheckCircle2, AlertCircle, Loader2, LogOut, Shield,
  ChevronRight, Eye, EyeOff,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

// ─── Schemas ──────────────────────────────────────────────────
const profileSchema = z.object({
  company_name: z.string().min(2, 'Requis (min. 2 caractères)'),
  phone:        z.string().optional(),
  address:      z.string().optional(),
})

const passwordSchema = z.object({
  newPassword:     z.string().min(8, 'Minimum 8 caractères'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

type ProfileForm  = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

// ─── localStorage profile store ───────────────────────────────
const PROFILE_KEY = 'nhboost_profile'

function loadProfile(): ProfileForm {
  if (typeof window === 'undefined') return { company_name: '', phone: '', address: '' }
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}')
  } catch { return { company_name: '', phone: '', address: '' } }
}

function saveProfile(data: ProfileForm) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data))
}

// ─── Sub-components ───────────────────────────────────────────
function SectionCard({ title, icon: Icon, color = '#6AAEE5', children }: {
  title: string; icon: React.ElementType; color?: string; children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#161A34] border border-[rgba(107,174,229,0.12)] overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[rgba(107,174,229,0.08)]">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}14` }}>
          <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.75} />
        </div>
        <h2 className="text-[13px] font-semibold text-[#F0F2FF]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#4A5180]">{label}</label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-[12px] text-[#EF4444]"
          >
            <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const inputCls = (hasError?: boolean) => cn(
  'w-full px-4 py-2.5 rounded-xl bg-[#1D2240] border text-[14px] text-[#F0F2FF]',
  'placeholder:text-[#4A5180] outline-none transition-all duration-200 focus:border-[rgba(106,174,229,0.4)]',
  hasError ? 'border-[rgba(239,68,68,0.4)]' : 'border-[rgba(107,174,229,0.15)]'
)

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
      className={cn(
        'flex items-center gap-2 px-4 py-3 rounded-xl border text-[13px] font-medium',
        type === 'success'
          ? 'bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.2)] text-[#22C55E]'
          : 'bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.2)] text-[#EF4444]'
      )}
    >
      {type === 'success'
        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />
      }
      {message}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────
export default function ParametresPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [profileToast,  setProfileToast]  = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [passwordToast, setPasswordToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loggingOut,  setLoggingOut]  = useState(false)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { company_name: '', phone: '', address: '' },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  // Charge email depuis Supabase + profil (Supabase prioritaire sur localStorage)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? '')

      // Essayer d'abord Supabase
      supabase.from('profiles').select('company_name, phone, address').eq('id', user.id).single()
        .then(({ data: profile, error }) => {
          if (!error && profile && (profile.company_name || profile.phone || profile.address)) {
            const merged = {
              company_name: profile.company_name ?? '',
              phone:        profile.phone        ?? '',
              address:      profile.address      ?? '',
            }
            profileForm.reset(merged)
            // Synchroniser localStorage
            localStorage.setItem('nhboost_profile', JSON.stringify(merged))
          } else {
            // Fallback localStorage
            const saved = loadProfile()
            if (saved.company_name) profileForm.reset(saved)
          }
        })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toast = (setter: typeof setProfileToast, msg: string, type: 'success' | 'error') => {
    setter({ msg, type })
    setTimeout(() => setter(null), 4000)
  }

  // Sauvegarde profil dans localStorage (+ tentative Supabase best-effort)
  const onSaveProfile = async (data: ProfileForm) => {
    saveProfile(data)
    // Tentative Supabase (ignorée si table absente)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').upsert({ id: user.id, ...data }, { onConflict: 'id' })
      }
    } catch (_) { /* table absente, pas grave */ }
    toast(setProfileToast, 'Profil mis à jour avec succès.', 'success')
  }

  // Changement de mot de passe via session active (pas besoin de re-vérifier)
  const onChangePassword = async (data: PasswordForm) => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.newPassword })
    if (error) {
      toast(setPasswordToast, error.message.includes('session')
        ? 'Session expirée, reconnectez-vous.'
        : 'Erreur : ' + error.message, 'error')
    } else {
      toast(setPasswordToast, 'Mot de passe modifié avec succès.', 'success')
      passwordForm.reset()
    }
  }

  const onLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const savedProfile = loadProfile()
  const displayName  = profileForm.watch('company_name') || savedProfile.company_name || 'Votre entreprise'
  const initials     = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'F1'

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#4A5180] mb-1">Compte</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">Paramètres</h1>
        <p className="text-sm text-[#8B95C4] mt-1">Gérez votre profil et vos préférences.</p>
      </motion.div>

      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#6AAEE5]/10 to-[#2B3580]/10 border border-[rgba(106,174,229,0.2)]"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4A7DC4] to-[#2B3580] flex items-center justify-center flex-shrink-0 text-white font-bold text-lg">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#F0F2FF] truncate">{displayName}</p>
          <p className="text-[13px] text-[#8B95C4] truncate">{email}</p>
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[rgba(106,174,229,0.12)] text-[#6AAEE5] text-[11px] font-medium">
            <Shield className="w-3 h-3" /> Franchisé actif
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-[#4A5180] flex-shrink-0" />
      </motion.div>

      {/* Profile form */}
      <SectionCard title="Informations entreprise" icon={Building2}>
        <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
          <Field label="Nom de l'entreprise *" error={profileForm.formState.errors.company_name?.message}>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5180] pointer-events-none" />
              <input
                {...profileForm.register('company_name')}
                placeholder="Ma Société SAS"
                className={cn(inputCls(!!profileForm.formState.errors.company_name), 'pl-10')}
              />
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Téléphone">
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5180] pointer-events-none" />
                <input
                  {...profileForm.register('phone')}
                  placeholder="+33 6 00 00 00 00"
                  className={cn(inputCls(), 'pl-10')}
                />
              </div>
            </Field>

            <Field label="Email (lecture seule)">
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5180] pointer-events-none" />
                <input value={email} readOnly className={cn(inputCls(), 'pl-10 opacity-50 cursor-not-allowed')} />
              </div>
            </Field>
          </div>

          <Field label="Adresse">
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-[#4A5180] pointer-events-none" />
              <textarea
                {...profileForm.register('address')}
                rows={2}
                placeholder="12 rue de la Paix, 75001 Paris"
                className={cn(inputCls(), 'pl-10 resize-none')}
              />
            </div>
          </Field>

          <AnimatePresence>{profileToast && <Toast message={profileToast.msg} type={profileToast.type} />}</AnimatePresence>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileForm.formState.isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 bg-gradient-to-r from-[#6AAEE5] to-[#4A7DC4] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {profileForm.formState.isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde…</>
                : 'Sauvegarder'
              }
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Password form */}
      <SectionCard title="Changer le mot de passe" icon={Lock} color="#8B5CF6">
        <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nouveau mot de passe" error={passwordForm.formState.errors.newPassword?.message}>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5180] pointer-events-none" />
                <input
                  {...passwordForm.register('newPassword')}
                  type={showNew ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={cn(inputCls(!!passwordForm.formState.errors.newPassword), 'pl-10 pr-10')}
                />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4A5180] hover:text-[#8B95C4] transition-colors" tabIndex={-1}>
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <Field label="Confirmer" error={passwordForm.formState.errors.confirmPassword?.message}>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5180] pointer-events-none" />
                <input
                  {...passwordForm.register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={cn(inputCls(!!passwordForm.formState.errors.confirmPassword), 'pl-10 pr-10')}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4A5180] hover:text-[#8B95C4] transition-colors" tabIndex={-1}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
          </div>

          <AnimatePresence>{passwordToast && <Toast message={passwordToast.msg} type={passwordToast.type} />}</AnimatePresence>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordForm.formState.isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {passwordForm.formState.isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Modification…</>
                : 'Changer le mot de passe'
              }
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="rounded-2xl bg-[#161A34] border border-[rgba(239,68,68,0.15)] p-6"
      >
        <h2 className="text-[13px] font-semibold text-[#F0F2FF] mb-1">Zone de danger</h2>
        <p className="text-[12px] text-[#4A5180] mb-4">Ces actions sont irréversibles.</p>
        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] text-[#EF4444] hover:bg-[rgba(239,68,68,0.14)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loggingOut
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Déconnexion…</>
            : <><LogOut className="w-4 h-4" /> Se déconnecter</>
          }
        </button>
      </motion.div>

    </div>
  )
}
