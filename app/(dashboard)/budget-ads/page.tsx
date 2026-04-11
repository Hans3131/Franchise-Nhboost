'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Megaphone, Plus, Wallet, TrendingDown, Calendar, Loader2, X,
  AlertTriangle, CheckCircle2, RotateCcw, Building2, Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────
interface CampaignBalance {
  campaign_id: string
  user_id: string
  client_id: string | null
  name: string
  platform: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  daily_spend_avg: number
  total_credited: number
  total_used: number
  balance: number
  days_remaining: number | null
  created_at: string
}

interface ClientLite {
  id: string
  company_name: string
}

const PLATFORMS: { value: string; label: string; color: string }[] = [
  { value: 'meta', label: 'Meta Ads', color: '#1877F2' },
  { value: 'google', label: 'Google Ads', color: '#EA4335' },
  { value: 'tiktok', label: 'TikTok Ads', color: '#000000' },
  { value: 'linkedin', label: 'LinkedIn Ads', color: '#0A66C2' },
  { value: 'mixed', label: 'Multi-plateformes', color: '#8B5CF6' },
  { value: 'other', label: 'Autre', color: '#6B7280' },
]

const TOPUP_PRESETS = [50, 100, 250, 500, 1000]

const fmt = (n: number) =>
  '€' + Math.round(n).toLocaleString('fr-FR')

// ───────────────────────────────────────────────────────────────
// Page principale
// ───────────────────────────────────────────────────────────────
export default function BudgetAdsPage() {
  const searchParams = useSearchParams()
  const [campaigns, setCampaigns] = useState<CampaignBalance[]>([])
  const [clients, setClients] = useState<ClientLite[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [topupCampaign, setTopupCampaign] = useState<CampaignBalance | null>(null)
  const [spendCampaign, setSpendCampaign] = useState<CampaignBalance | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'cancel'; text: string } | null>(null)

  // Affiche un banner si retour de Stripe
  useEffect(() => {
    if (searchParams.get('recharged') === '1') {
      setBanner({ type: 'success', text: '✓ Recharge réussie. Le solde sera mis à jour dans quelques secondes.' })
      const t = setTimeout(() => setBanner(null), 6000)
      return () => clearTimeout(t)
    }
    if (searchParams.get('cancelled') === '1') {
      setBanner({ type: 'cancel', text: 'Recharge annulée.' })
      const t = setTimeout(() => setBanner(null), 4000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  // ─── Load campaigns + clients ──────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [campRes, clientsRes] = await Promise.all([
        fetch('/api/ads/campaigns').then((r) => r.json()),
        (async () => {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return { data: [] }
          return supabase
            .from('clients')
            .select('id, company_name')
            .eq('user_id', user.id)
            .order('company_name')
        })(),
      ])

      setCampaigns(campRes?.campaigns ?? [])
      setClients(((clientsRes as { data?: ClientLite[] }).data ?? []) as ClientLite[])
    } catch (e) {
      console.error('[budget-ads] load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Refresh toutes les 15s pour capter les recharges via webhook
    const interval = setInterval(load, 15_000)
    return () => clearInterval(interval)
  }, [load])

  // ─── KPIs globaux ──────────────────────────────────
  const totals = useMemo(() => {
    const active = campaigns.filter((c) => c.status === 'active')
    return {
      campaignCount: active.length,
      totalCredited: campaigns.reduce((s, c) => s + Number(c.total_credited ?? 0), 0),
      totalUsed: campaigns.reduce((s, c) => s + Number(c.total_used ?? 0), 0),
      totalBalance: campaigns.reduce((s, c) => s + Number(c.balance ?? 0), 0),
      avgDailySpend: active.reduce((s, c) => s + Number(c.daily_spend_avg ?? 0), 0),
    }
  }, [campaigns])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ─── Header ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1">
          Gestion publicitaire
        </p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-[#2d2d60] tracking-tight">
              Budget ADS
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              Suivez vos campagnes pub et rechargez votre budget en quelques clics
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle campagne
          </button>
        </div>
      </motion.div>

      {/* ─── Banner retour Stripe ───────────────────── */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border',
              banner.type === 'success'
                ? 'bg-[rgba(34,197,94,0.06)] border-[rgba(34,197,94,0.25)] text-[#22C55E]'
                : 'bg-[rgba(245,158,11,0.06)] border-[rgba(245,158,11,0.25)] text-[#F59E0B]',
            )}
          >
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <p className="text-[13px] font-medium">{banner.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── KPI strip ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        {[
          { label: 'Campagnes actives', value: String(totals.campaignCount), icon: Megaphone, color: '#8B5CF6' },
          { label: 'Total crédité', value: fmt(totals.totalCredited), icon: Wallet, color: '#6AAEE5' },
          { label: 'Total dépensé', value: fmt(totals.totalUsed), icon: TrendingDown, color: '#F59E0B' },
          { label: 'Solde restant', value: fmt(totals.totalBalance), icon: Wallet, color: '#22C55E' },
          { label: 'Spend / jour', value: fmt(totals.avgDailySpend), icon: Zap, color: '#EF4444' },
        ].map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="rounded-xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.07)] px-4 py-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${kpi.color}14` }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: kpi.color }}
                    strokeWidth={1.9}
                  />
                </div>
              </div>
              <p className="text-[18px] font-bold text-[#2d2d60] leading-none font-mono tabular-nums">
                {kpi.value}
              </p>
              <p className="text-[10px] text-[#9CA3AF] font-medium mt-1 uppercase tracking-wider">
                {kpi.label}
              </p>
            </div>
          )
        })}
      </motion.div>

      {/* ─── Liste des campagnes ────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#6AAEE5] animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl bg-[#F8FAFC] border-2 border-dashed border-[#E2E8F2] p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#E2E8F2] mx-auto mb-3 flex items-center justify-center">
            <Megaphone className="w-6 h-6 text-[#9CA3AF]" />
          </div>
          <p className="text-[14px] font-semibold text-[#6B7280] mb-1">
            Aucune campagne pour le moment
          </p>
          <p className="text-[12px] text-[#9CA3AF] mb-4">
            Créez votre première campagne pour commencer à recharger un budget pub
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> Créer une campagne
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.campaign_id}
              campaign={campaign}
              clients={clients}
              onTopup={() => setTopupCampaign(campaign)}
              onAddSpend={() => setSpendCampaign(campaign)}
              onRefresh={load}
            />
          ))}
        </div>
      )}

      {/* ─── Modals ─────────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateCampaignModal
            clients={clients}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false)
              load()
            }}
          />
        )}
        {topupCampaign && (
          <TopupModal
            campaign={topupCampaign}
            onClose={() => setTopupCampaign(null)}
          />
        )}
        {spendCampaign && (
          <AddSpendModal
            campaign={spendCampaign}
            onClose={() => setSpendCampaign(null)}
            onSaved={() => {
              setSpendCampaign(null)
              load()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// Composant : Carte campagne
// ───────────────────────────────────────────────────────────────
interface CampaignCardProps {
  campaign: CampaignBalance
  clients: ClientLite[]
  onTopup: () => void
  onAddSpend: () => void
  onRefresh: () => void
}

function CampaignCard({ campaign, clients, onTopup, onAddSpend, onRefresh }: CampaignCardProps) {
  const platform = PLATFORMS.find((p) => p.value === campaign.platform) ?? PLATFORMS[0]
  const client = clients.find((c) => c.id === campaign.client_id)
  const usagePct = campaign.total_credited > 0
    ? Math.min(100, (campaign.total_used / campaign.total_credited) * 100)
    : 0

  // Couleur d'alerte selon le solde restant
  const isLow = campaign.days_remaining !== null && campaign.days_remaining <= 3
  const isMedium = campaign.days_remaining !== null && campaign.days_remaining > 3 && campaign.days_remaining <= 7

  const alertColor = isLow ? '#EF4444' : isMedium ? '#F59E0B' : '#22C55E'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white border border-[#E2E8F2] shadow-[0_1px_3px_rgba(45,45,96,0.06)] overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F0F3F8] bg-gradient-to-r from-[#F8FAFC] to-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: platform.color }}
              />
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF]">
                {platform.label}
              </p>
              <span
                className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                style={{
                  background:
                    campaign.status === 'active' ? 'rgba(34,197,94,0.1)'
                    : campaign.status === 'paused' ? 'rgba(245,158,11,0.1)'
                    : 'rgba(156,163,175,0.1)',
                  color:
                    campaign.status === 'active' ? '#22C55E'
                    : campaign.status === 'paused' ? '#F59E0B'
                    : '#9CA3AF',
                }}
              >
                {campaign.status === 'active' ? 'Active'
                  : campaign.status === 'paused' ? 'En pause'
                  : campaign.status === 'completed' ? 'Terminée'
                  : 'Archivée'}
              </span>
            </div>
            <h3 className="text-[15px] font-bold text-[#2d2d60] truncate">
              {campaign.name}
            </h3>
            {client && (
              <div className="flex items-center gap-1 mt-1 text-[11px] text-[#6B7280]">
                <Building2 className="w-3 h-3" />
                {client.company_name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Solde central */}
      <div className="px-5 py-4">
        <div className="flex items-baseline gap-2 mb-3">
          <p
            className="text-[28px] font-bold font-mono tabular-nums leading-none"
            style={{ color: alertColor }}
          >
            {fmt(campaign.balance)}
          </p>
          <p className="text-[11px] text-[#9CA3AF]">de solde restant</p>
        </div>

        {/* Barre de progression */}
        <div className="w-full h-2 rounded-full bg-[#F0F3F8] overflow-hidden mb-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${usagePct}%` }}
            transition={{ duration: 0.6 }}
            className="h-full rounded-full"
            style={{
              background: usagePct > 80 ? '#EF4444' : usagePct > 50 ? '#F59E0B' : '#22C55E',
            }}
          />
        </div>

        {/* Détails */}
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <p className="text-[#9CA3AF] mb-0.5">Crédité</p>
            <p className="font-bold text-[#2d2d60] font-mono tabular-nums">
              {fmt(campaign.total_credited)}
            </p>
          </div>
          <div>
            <p className="text-[#9CA3AF] mb-0.5">Dépensé</p>
            <p className="font-bold text-[#EF4444] font-mono tabular-nums">
              {fmt(campaign.total_used)}
            </p>
          </div>
          <div>
            <p className="text-[#9CA3AF] mb-0.5">Spend / jour</p>
            <p className="font-bold text-[#2d2d60] font-mono tabular-nums">
              {fmt(campaign.daily_spend_avg)}
            </p>
          </div>
        </div>
      </div>

      {/* Simulateur durée restante */}
      {campaign.days_remaining !== null && campaign.daily_spend_avg > 0 && (
        <div
          className="px-5 py-3 border-t border-[#F0F3F8] flex items-center gap-2"
          style={{ background: `${alertColor}08` }}
        >
          <Calendar className="w-4 h-4" style={{ color: alertColor }} />
          <p className="text-[12px] font-medium" style={{ color: alertColor }}>
            {campaign.days_remaining > 0 ? (
              <>
                <strong>{campaign.days_remaining} jour{campaign.days_remaining > 1 ? 's' : ''}</strong>
                {' '}avant épuisement {isLow && '· Recharge urgente'}
              </>
            ) : (
              <>Budget épuisé · Rechargez maintenant</>
            )}
          </p>
        </div>
      )}

      {campaign.daily_spend_avg === 0 && (
        <div className="px-5 py-3 border-t border-[#F0F3F8] bg-[#F8FAFC]">
          <p className="text-[11px] text-[#9CA3AF]">
            ℹ Définissez le spend quotidien moyen pour activer le simulateur
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 border-t border-[#F0F3F8] flex gap-2">
        <button
          onClick={onTopup}
          disabled={campaign.status === 'archived'}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-white bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          Recharger
        </button>
        <button
          onClick={onAddSpend}
          disabled={campaign.status === 'archived'}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-[#2d2d60] bg-[#F5F7FA] border border-[#E2E8F2] hover:bg-[#E2E8F2] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <TrendingDown className="w-3.5 h-3.5" />
          Saisir dépense
        </button>
        <CampaignSettingsButton campaign={campaign} onUpdated={onRefresh} />
      </div>
    </motion.div>
  )
}

// ───────────────────────────────────────────────────────────────
// Bouton : édit rapide spend / pause / archive
// ───────────────────────────────────────────────────────────────
function CampaignSettingsButton({
  campaign,
  onUpdated,
}: {
  campaign: CampaignBalance
  onUpdated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dailySpend, setDailySpend] = useState(String(campaign.daily_spend_avg))

  const update = async (patch: Record<string, unknown>) => {
    setBusy(true)
    try {
      await fetch(`/api/ads/campaigns/${campaign.campaign_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      onUpdated()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-2 py-2 rounded-xl text-[#9CA3AF] hover:text-[#2d2d60] hover:bg-[#F5F7FA] transition-colors"
        aria-label="Paramètres"
      >
        ⋯
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
            >
              <h3 className="text-[16px] font-bold text-[#2d2d60] mb-4">
                {campaign.name}
              </h3>

              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF] mb-1">
                Spend quotidien moyen
              </label>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 flex items-center gap-1 px-3 py-2 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2]">
                  <span className="text-[14px] font-bold text-[#2d2d60]">€</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={dailySpend}
                    onChange={(e) => setDailySpend(e.target.value)}
                    className="w-full bg-transparent outline-none text-[14px] font-bold text-[#2d2d60] font-mono"
                  />
                </div>
                <button
                  onClick={() =>
                    update({ daily_spend_avg: Number(dailySpend) || 0 })
                  }
                  disabled={busy}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#2d2d60] hover:opacity-90 disabled:opacity-50"
                >
                  Sauver
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {campaign.status === 'active' ? (
                  <button
                    onClick={() => update({ status: 'paused' })}
                    disabled={busy}
                    className="px-3 py-2 rounded-xl text-[12px] font-semibold text-[#F59E0B] bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] hover:bg-[rgba(245,158,11,0.15)]"
                  >
                    Mettre en pause
                  </button>
                ) : (
                  <button
                    onClick={() => update({ status: 'active' })}
                    disabled={busy}
                    className="px-3 py-2 rounded-xl text-[12px] font-semibold text-[#22C55E] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] hover:bg-[rgba(34,197,94,0.15)]"
                  >
                    Réactiver
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm('Archiver cette campagne ?')) update({ status: 'archived' })
                  }}
                  disabled={busy}
                  className="px-3 py-2 rounded-xl text-[12px] font-semibold text-[#9CA3AF] bg-[#F5F7FA] border border-[#E2E8F2] hover:bg-[#E2E8F2]"
                >
                  Archiver
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ───────────────────────────────────────────────────────────────
// Modal : Création de campagne
// ───────────────────────────────────────────────────────────────
function CreateCampaignModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: ClientLite[]
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState<string>('')
  const [platform, setPlatform] = useState<string>('meta')
  const [dailySpend, setDailySpend] = useState('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (name.trim().length < 2) {
      setError('Nom requis (min. 2 caractères)')
      return
    }
    if (!clientId) {
      setError('Client requis')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/ads/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          client_id: clientId,
          platform,
          daily_spend_avg: Number(dailySpend) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur')
        setBusy(false)
        return
      }
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-[18px] font-bold text-[#2d2d60] mb-1">Nouvelle campagne</h3>
      <p className="text-[12px] text-[#6B7280] mb-5">
        Crée une campagne publicitaire liée à un client. Tu pourras ensuite la recharger via Stripe.
      </p>

      <div className="space-y-4">
        <Field label="Nom de la campagne *">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Black Friday 2025"
            className="w-full px-4 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] outline-none focus:border-[#6AAEE5]"
          />
        </Field>

        <Field label="Client *">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] outline-none focus:border-[#6AAEE5]"
          >
            <option value="">— Sélectionner un client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
          {clients.length === 0 && (
            <p className="text-[11px] text-[#F59E0B] mt-1">
              Aucun client disponible. Créez un client dans /crm avant de continuer.
            </p>
          )}
        </Field>

        <Field label="Plateforme">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] outline-none focus:border-[#6AAEE5]"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Spend quotidien estimé (optionnel)">
          <div className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2]">
            <span className="text-[14px] font-bold text-[#2d2d60]">€</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={dailySpend}
              onChange={(e) => setDailySpend(e.target.value)}
              className="w-full bg-transparent outline-none text-[14px] font-mono"
            />
            <span className="text-[11px] text-[#9CA3AF]">/jour</span>
          </div>
          <p className="text-[10px] text-[#9CA3AF] mt-1">
            Sert au simulateur de durée restante. Modifiable plus tard.
          </p>
        </Field>

        {error && (
          <div className="px-3 py-2 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-[11px] text-[#EF4444]">
            {error}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#2d2d60] bg-[#F5F7FA] border border-[#E2E8F2] hover:bg-[#E2E8F2]"
        >
          Annuler
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Créer la campagne
        </button>
      </div>
    </Modal>
  )
}

// ───────────────────────────────────────────────────────────────
// Modal : Recharge Stripe
// ───────────────────────────────────────────────────────────────
function TopupModal({
  campaign,
  onClose,
}: {
  campaign: CampaignBalance
  onClose: () => void
}) {
  const [amount, setAmount] = useState<number>(100)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const days = campaign.daily_spend_avg > 0 ? Math.floor(amount / campaign.daily_spend_avg) : null

  const submit = async () => {
    setError(null)
    if (amount < 10 || amount > 10000) {
      setError('Montant entre 10€ et 10 000€')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/payments/checkout-ads-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaign.campaign_id, amount }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Erreur Stripe')
        setBusy(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-[18px] font-bold text-[#2d2d60] mb-1">Recharger le budget</h3>
      <p className="text-[12px] text-[#6B7280] mb-5">
        Campagne <strong>{campaign.name}</strong> · Solde actuel{' '}
        <strong>{fmt(campaign.balance)}</strong>
      </p>

      {/* Presets */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {TOPUP_PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(preset)}
            className={cn(
              'px-2 py-2 rounded-xl text-[12px] font-semibold border transition-all',
              amount === preset
                ? 'bg-[#6AAEE5] text-white border-[#6AAEE5]'
                : 'bg-[#F5F7FA] text-[#2d2d60] border-[#E2E8F2] hover:border-[#6AAEE5]/50',
            )}
          >
            {preset}€
          </button>
        ))}
      </div>

      <Field label="Montant personnalisé">
        <div className="flex items-center gap-1 px-4 py-3 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2]">
          <span className="text-[18px] font-bold text-[#2d2d60]">€</span>
          <input
            type="number"
            min={10}
            max={10000}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="w-full bg-transparent outline-none text-[20px] font-bold text-[#2d2d60] font-mono"
          />
        </div>
      </Field>

      {/* Simulateur */}
      {days !== null && days > 0 && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.25)]">
          <p className="text-[11px] text-[#22C55E]">
            ≈ <strong>{days} jours</strong> de campagne supplémentaires
            <span className="text-[#9CA3AF] ml-1">
              (sur la base de {fmt(campaign.daily_spend_avg)}/jour)
            </span>
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 px-3 py-2 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-[11px] text-[#EF4444]">
          {error}
        </div>
      )}

      <div className="flex gap-2 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#2d2d60] bg-[#F5F7FA] border border-[#E2E8F2] hover:bg-[#E2E8F2]"
        >
          Annuler
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-[#2d2d60] to-[#4A7DC4] hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Payer {fmt(amount)} via Stripe
        </button>
      </div>
    </Modal>
  )
}

// ───────────────────────────────────────────────────────────────
// Modal : Saisie dépense
// ───────────────────────────────────────────────────────────────
function AddSpendModal({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: CampaignBalance
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState<number>(0)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (amount <= 0) {
      setError('Montant requis')
      return
    }
    if (amount > campaign.balance) {
      setError(`Solde insuffisant (${fmt(campaign.balance)} disponible)`)
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/ads/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.campaign_id,
          amount,
          date,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur')
        setBusy(false)
        return
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-[18px] font-bold text-[#2d2d60] mb-1">Saisir une dépense</h3>
      <p className="text-[12px] text-[#6B7280] mb-5">
        Campagne <strong>{campaign.name}</strong>
      </p>

      <Field label="Montant *">
        <div className="flex items-center gap-1 px-4 py-3 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2]">
          <span className="text-[18px] font-bold text-[#2d2d60]">€</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="w-full bg-transparent outline-none text-[20px] font-bold text-[#2d2d60] font-mono"
          />
        </div>
      </Field>

      <div className="mt-4">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#E2E8F2] text-[14px] outline-none focus:border-[#6AAEE5]"
          />
        </Field>
      </div>

      {error && (
        <div className="mt-3 px-3 py-2 rounded-xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] text-[11px] text-[#EF4444]">
          {error}
        </div>
      )}

      <div className="flex gap-2 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#2d2d60] bg-[#F5F7FA] border border-[#E2E8F2] hover:bg-[#E2E8F2]"
        >
          Annuler
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-[#2d2d60] hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </Modal>
  )
}

// ───────────────────────────────────────────────────────────────
// Helpers UI
// ───────────────────────────────────────────────────────────────
function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl relative max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-[#9CA3AF] hover:text-[#2d2d60] hover:bg-[#F5F7FA]"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </motion.div>
    </motion.div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
