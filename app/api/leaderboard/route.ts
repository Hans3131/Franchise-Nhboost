import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Use service role for cross-user aggregation
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all users' total CA
    const { data: orders } = await serviceSupabase
      .from('orders')
      .select('user_id, sale_price, status')
      .eq('status', 'completed')

    if (!orders) return NextResponse.json({ ranking: [], myPosition: 0, total: 0 })

    // Aggregate by user
    const userTotals: Record<string, number> = {}
    orders.forEach(o => {
      userTotals[o.user_id] = (userTotals[o.user_id] ?? 0) + Number(o.sale_price ?? 0)
    })

    // Sort descending
    const sorted = Object.entries(userTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([userId, total], idx) => ({
        position: idx + 1,
        total,
        isMe: userId === user.id,
      }))

    const myPosition = sorted.findIndex(s => s.isMe) + 1

    return NextResponse.json({
      ranking: sorted.slice(0, 10).map(s => ({
        position: s.position,
        total: s.total,
        isMe: s.isMe,
      })),
      myPosition,
      total: sorted.length,
    })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
