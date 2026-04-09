'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2, Clock, Globe, Target, Briefcase, Share2,
  ExternalLink, FolderOpen, AlertCircle,
} from 'lucide-react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'

// ─── Stepper configs ─────────────────────────────────────────
const STANDARD_STEPS = [
  { key: 'pending', label: 'En attente' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'completed', label: 'Terminé' },
]
const WEBSITE_STEPS = [
  { key: 'preparation', label: 'En préparation' },
  { key: 'v1_ready', label: '1ère version prête' },
  { key: 'v2_ready', label: '2ème version prête' },
  { key: 'domain_config', label: 'Config. domaine' },
  { key: 'site_done', label: 'Site finalisé' },
]
const CAMPAIGN_STEPS = [
  { key: 'strategy', label: 'Préparation stratégie' },
  { key: 'shooting', label: 'Tournage en préparation' },
  { key: 'launching', label: 'Lancement campagnes' },
  { key: 'live', label: 'Campagne lancée' },
]

function getSteps(serviceType: string, progress: string) {
  let steps = STANDARD_STEPS
  if (serviceType === 'website') steps = WEBSITE_STEPS
  else if (serviceType === 'campaign') steps = CAMPAIGN_STEPS

  let idx = steps.findIndex(s => s.key === progress)
  if (idx < 0) {
    if (progress === 'pending') idx = 0
    else if (progress === 'in_progress') idx = 1
    else if (progress === 'completed') idx = steps.length - 1
    else idx = 0
  }
  return { steps, idx }
}

// ─── Page ────────────────────────────────────────────────────
export default function SuiviPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/tracking/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="animate-pulse text-[#9CA3AF]">Chargement...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-[#EF4444] mb-4" />
        <h1 className="text-xl font-bold text-[#2d2d60] mb-2">Lien invalide</h1>
        <p className="text-[#6B7280]">Ce lien de suivi n&apos;existe pas ou a expiré.</p>
      </div>
    )
  }

  const { steps, idx } = getSteps(data.serviceType ?? 'standard', data.progress ?? 'pending')
  const isCompleted = data.status === 'completed'

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F2] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="NHBoost" width={100} height={32} className="h-7 w-auto" />
          </div>
          <span className="text-[12px] text-[#9CA3AF]">Suivi de projet</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Project info */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">{data.ref}</p>
          <h1 className="text-2xl font-bold text-[#2d2d60]">{data.service}</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Projet géré par <span className="font-semibold text-[#4a81a4]">{data.franchiseName}</span>
          </p>
          <p className="text-[12px] text-[#9CA3AF] mt-1">
            Créé le {new Date(data.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </motion.div>

        {/* Status */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white border border-[#E2E8F2] p-6 shadow-[0_1px_3px_rgba(45,45,96,0.06)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-5">Avancement du projet</p>

          <div className="flex items-center gap-0">
            {steps.map((step, i) => {
              const done = i < idx || isCompleted
              const active = i === idx && !isCompleted
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all',
                      done ? 'bg-[#22C55E] border-[#22C55E]'
                        : active ? 'border-[#6AAEE5] bg-[#6AAEE5]/10'
                        : 'border-[#E2E8F2] bg-[#F5F7FA]'
                    )}>
                      {done
                        ? <CheckCircle2 className="w-4 h-4 text-white" />
                        : active
                          ? <span className="w-2.5 h-2.5 rounded-full bg-[#6AAEE5] animate-pulse" />
                          : <span className="w-2 h-2 rounded-full bg-[#E2E8F2]" />
                      }
                    </div>
                    <span className={cn(
                      'text-[10px] sm:text-[11px] font-semibold text-center whitespace-nowrap',
                      done ? 'text-[#22C55E]' : active ? 'text-[#6AAEE5]' : 'text-[#9CA3AF]'
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex-1 h-[2px] mx-2 rounded-full" style={{ background: done ? '#22C55E' : '#E2E8F2' }} />
                  )}
                </div>
              )
            })}
          </div>

          {isCompleted && (
            <div className="mt-6 px-4 py-3 rounded-xl bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.2)] text-center">
              <p className="text-[13px] font-semibold text-[#22C55E]">✓ Projet terminé et livré</p>
            </div>
          )}
        </motion.div>

        {/* Livrables */}
        {data.deliverablesUrl && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <a
              href={data.deliverablesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-white border border-[#22C55E]/20 hover:border-[#22C55E]/40 shadow-[0_1px_3px_rgba(45,45,96,0.06)] transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-[#22C55E]/10 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-[#2d2d60]">Accéder aux livrables</p>
                <p className="text-[12px] text-[#6B7280]">Documents, fichiers et ressources du projet</p>
              </div>
              <ExternalLink className="w-5 h-5 text-[#22C55E] opacity-50 group-hover:opacity-100 transition-opacity" />
            </a>
          </motion.div>
        )}

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-[12px] text-[#9CA3AF]">
            Propulsé par <span className="font-semibold text-[#4a81a4]">NHBoost</span>
          </p>
        </div>
      </div>
    </div>
  )
}
