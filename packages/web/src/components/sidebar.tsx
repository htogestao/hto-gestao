'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, MapPin, Layers, FlaskConical, Package,
  ShoppingCart, Tractor, ArrowLeftRight, FileText,
  Upload, Download, Users, LogOut, Leaf, ChevronRight, UserCircle, ClipboardList,
} from 'lucide-react'
import type { UserRole } from '@agro/shared'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  adminOnly?: boolean
  fieldHidden?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',        label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/fazendas',         label: 'Fazendas',        icon: MapPin },
  { href: '/talhoes',          label: 'Talhões',         icon: Layers },
  { href: '/defensivos',       label: 'Defensivos',      icon: FlaskConical,   fieldHidden: true },
  { href: '/estoque',          label: 'Estoque & Lotes', icon: Package },
  { href: '/compras',          label: 'Compras (NFs)',   icon: ShoppingCart,   fieldHidden: true },
  { href: '/aplicacoes',       label: 'Aplicações',      icon: Tractor },
  { href: '/movimentacoes',    label: 'Movimentações',   icon: ArrowLeftRight },
  { href: '/relatorios',       label: 'Relatórios',      icon: FileText,       fieldHidden: true },
  { href: '/importar',         label: 'Importar Excel',  icon: Upload,         adminOnly: true },
  { href: '/exportar',         label: 'Exportar Excel',  icon: Download,       fieldHidden: true },
  { href: '/inventario',       label: 'Inventário Físico', icon: ClipboardList, fieldHidden: true },
  { href: '/usuarios',         label: 'Usuários',        icon: Users,          adminOnly: true },
  { href: '/perfil',           label: 'Meu Perfil',      icon: UserCircle },
]

interface SidebarProps {
  role: UserRole
  userName: string
  onClose?: () => void
}

export function Sidebar({ role, userName, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly && role !== 'admin') return false
    if (item.fieldHidden && role === 'field') return false
    return true
  })

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground" suppressHydrationWarning>
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-muted">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">HtoGestão</span>
      </div>

      {/* Usuário */}
      <div className="px-5 py-3 border-b border-sidebar-muted">
        <p className="text-xs text-sidebar-foreground/60">Logado como</p>
        <p className="text-sm font-medium truncate">{userName}</p>
        <span className={cn(
          'mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium',
          role === 'admin'  && 'bg-primary/30 text-primary-foreground',
          role === 'viewer' && 'bg-blue-900/40 text-blue-200',
          role === 'field'  && 'bg-orange-900/40 text-orange-200',
        )}>
          {role === 'admin' ? 'Analista / Supervisor' : role === 'field' ? 'Líder de Campo' : 'Patrão / Produtor'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {visibleItems.map((item) => {
          const Icon    = item.icon
          const active  = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-0.5',
                active
                  ? 'bg-primary text-white'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-muted hover:text-sidebar-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="h-3 w-3" />}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-sidebar-muted p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
