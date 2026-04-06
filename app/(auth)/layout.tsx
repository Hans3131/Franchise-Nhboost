import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NHBoost — Connexion',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0B14]">
      {children}
    </div>
  )
}
