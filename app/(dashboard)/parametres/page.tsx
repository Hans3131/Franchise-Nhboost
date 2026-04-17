'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Lock, Building2, Phone, MapPin, AtSign,
  CheckCircle2, AlertCircle, Loader2, LogOut, Shield,
  Eye, EyeOff, ArrowRight,
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

// ═══════════════════════════════════════════════════════════════
// Sub-components — Style aligné sur /commander
// ═══════════════════════════════════════════════════════════════

function StepHeader({
  icon: Icon,
  color,
  title,
  subtitle,
}: {
  icon: React.ElementType
  color: string
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}14` }}
      >
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold text-[#2d2d60] leading-tight">{title}</h2>
        <p className="text-[12px] text-[#6B7280] mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-2xl bg-white border border-[#E2E8F2] p-6 md:p-7 shadow-[0_1px_3px_rgba(45,45,96,0.06)]"
    >
      {children}
    </motion.div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#4a81a4]">
      {children}
      {required && <span className="text-[#EF4444] ml-0.5">*</span>}
    </label>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel required={required}>{label}</FieldLabel>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-[11px] text-[#EF4444] mt-1"
          >
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const inputBase = cn(
  'w-full bg-[#F5F7FA] border border-[#E2E8F2] rounded-xl px-4 py-3',
  'text-[14px] text-[#2d2d60] placeholder:text-[#9CA3AF]',
  'outline-none transition-all duration-200',
  'focus:border-[#6AAEE5] focus:ring-2 focus:ring-[#6AAEE5]/20 focus:bg-white',
  'hover:border-[#6AAEE5]/50 hover:bg-white',
)
const inputErr = 'border-[#EF4444]/50 focus:border-[#EF4444] focus:ring-[#EF4444]/15'
const inputCls = (err?: boolean) => cn(inputBase, err && inputErr)

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className={cn(
        'flex items-center gap-2 px-4 py-3 rounded-xl border text-[13px] font-medium',
        type === 'success'
          ? 'bg-[rgba(34,197,94,0.08)] border-[rgba(34,197,94,0.25)] text-[#166534]'
          : 'bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.25)] text-[#B91C1C]',
      )}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      {message}
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════
export default function ParametresPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [franchiseCode, setFranchiseCode] = useState('')
  const [profileToast, setProfileToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [passwordToast, setPasswordToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { company_name: '', phone: '', address: '' },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  // Charge email + profil (Supabase prioritaire sur localStorage)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? '')

      supabase
        .from('profiles')
        .select('company_name, phone, address, franchise_code')
        .eq('id', user.id)
        .single()
        .then(({ data: profile, error }) => {
          if (!error && profile) {
            if (profile.franchise_code) setFranchiseCode(profile.franchise_code)
            if (profile.company_name || profile.phone || profile.address) {
              const merged = {
                company_name: profile.company_name ?? '',
                phone:        profile.phone        ?? '',
                address:      profile.address      ?? '',
              }
              profileForm.reset(merged)
              localStorage.setItem('nhboost_profile', JSON.stringify(merged))
              return
            }
          }
          const saved = loadProfile()
          if (saved.company_name) profileForm.reset(saved)
        })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toast = (
    setter: typeof setProfileToast,
    msg: string,
    type: 'success' | 'error',
  ) => {
    setter({ msg, type })
    setTimeout(() => setter(null), 4000)
  }

  const onSaveProfile = async (data: ProfileForm) => {
    saveProfile(data)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').upsert({ id: user.id, ...data }, { onConflict: 'id' })
      }
    } catch (_) { /* best-effort */ }
    toast(setProfileToast, 'Profil mis à jour avec succès.', 'success')
  }

  const onChangePassword = async (data: PasswordForm) => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.newPassword })
    if (error) {
      toast(
        setPasswordToast,
        error.message.includes('session')
          ? 'Session expirée, reconnectez-vous.'
          : 'Erreur : ' + error.message,
        'error',
      )
    } else {
      toast(setPasswordToast, 'Mot de passe modifié avec succès.', 'success')
      passwordForm.reset()
    }
  }

  const onLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // Nettoyage PII du localStorage
    try {
      localStorage.removeItem('nhboost_orders')
      localStorage.removeItem('nhboost_clients')
      localStorage.removeItem('nhboost_client_notes')
      localStorage.removeItem('nhboost_notifications')
      localStorage.removeItem('nhboost_tickets')
      localStorage.removeItem('nhboost_profile')
    } catch { /* SSR-safe */ }
    router.push('/login')
  }

  const watchedName = profileForm.watch('company_name')
  const displayName = watchedName || 'Votre entreprise'
  const initials =
    displayName
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'F1'

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ─── Header ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">
          Compte
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">
          Paramètres
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Gérez votre profil, votre sécurité et votre session.
        </p>
      </motion.div>

      {/* ─── Identity card ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="relative rounded-2xl border border-[#E2E8F2] overflow-hidden bg-white shadow-[0_1px_3px_rgba(45,45,96,0.07)]"
      >
        {/* Bande gradient top */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background:
              'linear-gradient(90deg, #2d2d60 0%, #4A7DC4 50%, #6AAEE5 100%)',
          }}
        />

        <div className="p-6 md:p-7 flex items-center gap-5 flex-wrap">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xl shadow-[0_4px_12px_rgba(45,45,96,0.2)]"
            style={{
              background: 'linear-gradient(135deg, #2d2d60 0%, #4A7DC4 100%)',
            }}
          >
            {initials}
          </div>

          {/* Info principale */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-0.5">
              Franchisé
            </p>
            <p className="text-[18px] font-bold text-[#2d2d60] truncate">
              {displayName}
            </p>
            <p className="text-[13px] text-[#6B7280] flex items-center gap-1.5 mt-0.5 truncate">
              <AtSign className="w-3 h-3 flex-shrink-0" />
              {email || '—'}
            </p>
          </div>

          {/* Badge code franchise */}
          {franchiseCode && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#6AAEE5]/10 border border-[#6AAEE5]/25">
              <Shield className="w-3.5 h-3.5 text-[#6AAEE5]" />
              <span className="text-[11px] font-semibold text-[#2d2d60] font-mono tracking-wider">
                {franchiseCode}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* ─── Profil entreprise ─────────────────────────────── */}
      <SectionCard>
        <div className="space-y-5">
          <StepHeader
            icon={Building2}
            color="#6AAEE5"
            title="Informations entreprise"
            subtitle="Ces informations apparaissent sur vos devis et factures."
          />

          <div className="h-px bg-[#E2E8F2]" />

          <form
            onSubmit={profileForm.handleSubmit(onSaveProfile)}
            className="space-y-4"
          >
            <Field
              label="Nom de l'entreprise"
              required
              error={profileForm.formState.errors.company_name?.message}
            >
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a81a4] pointer-events-none" />
                <input
                  {...profileForm.register('company_name')}
                  placeholder="Ma Société SAS"
                  className={cn(
                    inputCls(!!profileForm.formState.errors.company_name),
                    'pl-10',
                  )}
                />
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Téléphone">
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a81a4] pointer-events-none" />
                  <input
                    {...profileForm.register('phone')}
                    placeholder="+33 6 00 00 00 00"
                    className={cn(inputCls(), 'pl-10')}
                  />
                </div>
              </Field>

              <Field label="Email">
                <div className="relative">
                  <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a81a4] pointer-events-none" />
                  <input
                    value={email}
                    readOnly
                    className={cn(
                      inputCls(),
                      'pl-10 bg-[#F5F7FA] cursor-not-allowed text-[#6B7280]',
                    )}
                  />
                </div>
                <p className="text-[10px] text-[#9CA3AF] mt-1">
                  Non modifiable — contactez le support pour changer.
                </p>
              </Field>
            </div>

            <Field label="Adresse">
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-[#4a81a4] pointer-events-none" />
                <textarea
                  {...profileForm.register('address')}
                  rows={2}
                  placeholder="12 rue de la Paix, 75001 Paris"
                  className={cn(inputCls(), 'pl-10 resize-none')}
                />
              </div>
            </Field>

            <AnimatePresence>
              {profileToast && (
                <Toast message={profileToast.msg} type={profileToast.type} />
              )}
            </AnimatePresence>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={profileForm.formState.isSubmitting}
                className={cn(
                  'group flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white',
                  'bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4]',
                  'transition-all duration-200 hover:opacity-90 active:scale-[0.98]',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              >
                {profileForm.formState.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sauvegarde…
                  </>
                ) : (
                  <>
                    Enregistrer
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </SectionCard>

      {/* ─── Mot de passe ──────────────────────────────────── */}
      <SectionCard>
        <div className="space-y-5">
          <StepHeader
            icon={Lock}
            color="#8B5CF6"
            title="Sécurité du compte"
            subtitle="Choisissez un mot de passe robuste — minimum 8 caractères."
          />

          <div className="h-px bg-[#E2E8F2]" />

          <form
            onSubmit={passwordForm.handleSubmit(onChangePassword)}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Nouveau mot de passe"
                required
                error={passwordForm.formState.errors.newPassword?.message}
              >
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a81a4] pointer-events-none" />
                  <input
                    {...passwordForm.register('newPassword')}
                    type={showNew ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={cn(
                      inputCls(!!passwordForm.formState.errors.newPassword),
                      'pl-10 pr-11',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4a81a4] hover:text-[#2d2d60] transition-colors"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              <Field
                label="Confirmation"
                required
                error={passwordForm.formState.errors.confirmPassword?.message}
              >
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a81a4] pointer-events-none" />
                  <input
                    {...passwordForm.register('confirmPassword')}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={cn(
                      inputCls(!!passwordForm.formState.errors.confirmPassword),
                      'pl-10 pr-11',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4a81a4] hover:text-[#2d2d60] transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
            </div>

            <AnimatePresence>
              {passwordToast && (
                <Toast message={passwordToast.msg} type={passwordToast.type} />
              )}
            </AnimatePresence>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={passwordForm.formState.isSubmitting}
                className={cn(
                  'group flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white',
                  'bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]',
                  'transition-all duration-200 hover:opacity-90 active:scale-[0.98]',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              >
                {passwordForm.formState.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Modification…
                  </>
                ) : (
                  <>
                    Changer le mot de passe
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </SectionCard>

      {/* ─── Session (danger zone) ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="rounded-2xl border border-[#EF4444]/20 bg-white p-6 md:p-7 shadow-[0_1px_3px_rgba(45,45,96,0.06)]"
      >
        <div className="space-y-5">
          <StepHeader
            icon={LogOut}
            color="#EF4444"
            title="Fin de session"
            subtitle="La déconnexion efface vos données de cache locales."
          />

          <div className="h-px bg-[#E2E8F2]" />

          {!confirmLogout ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-md">
                Vous serez redirigé vers la page de connexion. Vous pourrez vous reconnecter à tout moment avec vos identifiants.
              </p>
              <button
                onClick={() => setConfirmLogout(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold',
                  'bg-[#EF4444]/8 border border-[#EF4444]/25 text-[#B91C1C]',
                  'transition-all duration-200 hover:bg-[#EF4444]/15',
                )}
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 flex-wrap p-4 rounded-xl bg-[#EF4444]/5 border border-[#EF4444]/20"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
                <p className="text-[13px] text-[#B91C1C] font-medium">
                  Êtes-vous sûr de vouloir vous déconnecter ?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmLogout(false)}
                  disabled={loggingOut}
                  className="px-4 py-2 rounded-xl text-[12px] font-medium text-[#6B7280] hover:text-[#2d2d60] hover:bg-[#F5F7FA] transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={onLogout}
                  disabled={loggingOut}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white',
                    'bg-gradient-to-r from-[#EF4444] to-[#DC2626]',
                    'transition-all duration-200 hover:opacity-90',
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                  )}
                >
                  {loggingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Déconnexion…
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      Oui, me déconnecter
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

    </div>
  )
}
