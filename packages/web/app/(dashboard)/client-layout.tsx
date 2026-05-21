'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import type { UserRole } from '@agro/shared'

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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Sidebar desktop — sempre visível em telas grandes */}
      <div className="hidden md:flex">
        <Sidebar role={role} userName={userName} />
      </div>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar mobile — desliza da esquerda */}
      <div className={`
        fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar role={role} userName={userName} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto">
        {/* Header mobile com botão hambúrguer */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded-md text-foreground hover:bg-muted"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-bold text-base">HtoGestão</span>
        </div>

        {children}
      </main>
    </div>
  )
}
