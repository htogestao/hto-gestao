'use client'
import dynamic from 'next/dynamic'
import type { UserRole } from '@agro/shared'

// Sidebar carregado somente no cliente — evita erro de hydration do Google Translate
const Sidebar = dynamic(
  () => import('@/components/sidebar').then(m => ({ default: m.Sidebar })),
  {
    ssr: false,
    loading: () => <div className="w-60 h-screen shrink-0 bg-sidebar" />,
  }
)

export function ClientLayout({
  children,
  role,
  userName,
}: {
  children: React.ReactNode
  role: UserRole
  userName: string
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={role} userName={userName} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
