'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, Bell, Settings, LogOut, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const ADMIN_NAV = [
  { href: '/admin/dashboard', label: 'Vue réseau', icon: LayoutDashboard },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      {/* Admin sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col h-screen sticky top-0 bg-[#0A0B14] border-r border-[rgba(107,174,229,0.12)]">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[rgba(107,174,229,0.1)]">
          <Image src="/logo.png" alt="NHBoost" width={100} height={32} className="object-contain" priority />
          <span className="px-2 py-0.5 rounded-full bg-[#EF4444]/20 text-[#EF4444] text-[9px] font-bold uppercase tracking-wider">Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative',
                  active ? 'bg-[rgba(106,174,229,0.12)] text-[#6AAEE5]' : 'text-[#8B95C4] hover:text-[#F0F2FF] hover:bg-[rgba(107,174,229,0.06)]'
                )}>
                <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', active ? 'text-[#6AAEE5]' : 'text-[#4A5180]')} strokeWidth={active ? 2 : 1.75} />
                <span>{label}</span>
              </Link>
            )
          })}

          <div className="pt-4 mt-4 border-t border-[rgba(107,174,229,0.08)]">
            <Link href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#8B95C4] hover:text-[#F0F2FF] hover:bg-[rgba(107,174,229,0.06)] transition-all">
              <Shield className="w-[18px] h-[18px] text-[#4A5180]" strokeWidth={1.75} />
              <span>Portail franchisé</span>
            </Link>
          </div>
        </nav>

        <div className="px-4 py-4 border-t border-[rgba(107,174,229,0.08)]">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#8B95C4] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.06)] transition-all w-full">
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.75} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
