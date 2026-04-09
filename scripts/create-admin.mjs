#!/usr/bin/env node
// ============================================================
// Script : Créer un compte admin NHBoost
// Usage  : node scripts/create-admin.mjs <email> <password> [role]
// Roles  : admin (default), super_admin
// ============================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://mhbloryvsxzawuuwdhbo.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquante.')
  console.error('   Export-la : export SUPABASE_SERVICE_ROLE_KEY="eyJ..."')
  process.exit(1)
}

const [,, email, password, role = 'admin'] = process.argv

if (!email || !password) {
  console.error('Usage : node scripts/create-admin.mjs <email> <password> [admin|super_admin]')
  process.exit(1)
}

if (!['admin', 'super_admin'].includes(role)) {
  console.error('❌ Role invalide. Utilisez "admin" ou "super_admin".')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  console.log(`\n🔐 Création du compte ${role}...`)
  console.log(`   Email : ${email}`)
  console.log(`   Role  : ${role}\n`)

  // 1. Create auth user
  const { data: userData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    console.error(`❌ Erreur Auth : ${authError.message}`)
    process.exit(1)
  }

  const userId = userData.user.id
  console.log(`✅ Utilisateur Auth créé : ${userId}`)

  // 2. Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      company_name: 'Admin NHBoost',
      franchise_code: `ADM-${userId.slice(0, 6).toUpperCase()}`,
      franchise_key: `FK-${userId.slice(0, 8).toUpperCase()}`,
      role,
    })

  if (profileError) {
    console.error(`❌ Erreur Profil : ${profileError.message}`)
    // Rollback
    await supabase.auth.admin.deleteUser(userId)
    console.error('   → Utilisateur Auth supprimé (rollback)')
    process.exit(1)
  }

  console.log(`✅ Profil créé avec role "${role}"`)
  console.log(`\n🎉 Compte admin prêt !`)
  console.log(`   → Connectez-vous sur /admin/login avec :`)
  console.log(`   Email    : ${email}`)
  console.log(`   Password : ${password}\n`)
}

main()
