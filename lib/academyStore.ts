// ============================================================
// academyStore — Modules de formation + progression
// ============================================================

import { createClient } from '@/lib/supabase/client'

export interface AcademyModule {
  id: string
  title: string
  description: string
  category: string
  duration: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  sort_order: number
  content: string
  video_url?: string
}

export interface ModuleProgress {
  id: string
  user_id: string
  module_id: string
  status: 'not_started' | 'in_progress' | 'completed'
  completed_at?: string
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  color: string
  condition_type: string
  condition_value: number
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  unlocked_at: string
  badge?: Badge
}

export async function getModules(): Promise<AcademyModule[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('academy_modules')
      .select('*')
      .order('category').order('sort_order')
    if (!error && data) return data as AcademyModule[]
  } catch {}
  return []
}

export async function getProgress(): Promise<ModuleProgress[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('user_module_progress')
        .select('*')
        .eq('user_id', user.id)
      if (!error && data) return data as ModuleProgress[]
    }
  } catch {}
  return []
}

export async function updateModuleStatus(moduleId: string, status: 'in_progress' | 'completed'): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: existing } = await supabase
      .from('user_module_progress')
      .select('id')
      .eq('user_id', user.id)
      .eq('module_id', moduleId)
      .single()

    if (existing) {
      await supabase.from('user_module_progress').update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      }).eq('id', existing.id)
    } else {
      await supabase.from('user_module_progress').insert({
        user_id: user.id,
        module_id: moduleId,
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
    }
  } catch {}
}

export async function getBadges(): Promise<Badge[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from('badges').select('*')
    if (!error && data) return data as Badge[]
  } catch {}
  return []
}

export async function getUserBadges(): Promise<UserBadge[]> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data, error } = await supabase
        .from('user_badges')
        .select('*, badge:badges(*)')
        .eq('user_id', user.id)
      if (!error && data) return data as UserBadge[]
    }
  } catch {}
  return []
}
