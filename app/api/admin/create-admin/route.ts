import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check — must be logged in
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // 2. Must be super_admin to create admins
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Seul un super_admin peut créer des comptes admin' }, { status: 403 })
    }

    // 3. Parse body
    const { email, password, role, company_name } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Mot de passe minimum 6 caractères' }, { status: 400 })
    }
    const adminRole = role === 'super_admin' ? 'super_admin' : 'admin'

    // 4. Service role client
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 5. Create user in Supabase Auth
    const { data: newUser, error: authError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !newUser?.user) {
      console.error('[create-admin] auth error:', authError?.message)
      return NextResponse.json({ error: 'Erreur création du compte' }, { status: 500 })
    }

    // 6. Create profile with role
    const { error: profileError } = await svc
      .from('profiles')
      .insert({
        id: newUser.user.id,
        company_name: company_name ?? 'Admin NHBoost',
        franchise_code: `ADM-${newUser.user.id.slice(0, 6).toUpperCase()}`,
        franchise_key: `FK-${newUser.user.id.slice(0, 8).toUpperCase()}`,
        role: adminRole,
      })

    if (profileError) {
      // Rollback: delete the auth user
      await svc.auth.admin.deleteUser(newUser.user.id)
      console.error('[create-admin] profile error:', profileError.message)
      return NextResponse.json({ error: 'Erreur création du profil' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      admin: {
        id: newUser.user.id,
        email: newUser.user.email,
        role: adminRole,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
