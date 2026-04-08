import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NHBoost — Connexion',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-white">
      {children}
    </div>
  )
}
