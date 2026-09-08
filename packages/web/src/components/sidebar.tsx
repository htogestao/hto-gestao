'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import {
  LayoutDashboard, MapPin, Layers, FlaskConical, Package,
  ShoppingCart, Tractor, ArrowLeftRight, FileText,
  Upload, Download, Users, LogOut, Leaf, ChevronRight, UserCircle, ClipboardList,
  Building2,
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
  { href: '/fazendas',         label: 'Fazendas',        icon: MapPin,         fieldHidden: true },
  { href: '/talhoes',          label: 'Talhões',         icon: Layers,         fieldHidden: true },
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
  organizacaoAtual: string
  organizacoes: { id: string; nome: string }[]
  onClose?: () => void
}

export function Sidebar({ role, userName, organizacaoAtual, organizacoes, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [trocando, setTrocando] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleTrocarOrganizacao(novaOrganizacaoId: string) {
    if (!novaOrganizacaoId || novaOrganizacaoId === organizacoes.find(o => o.nome === organizacaoAtual)?.id) return
    setTrocando(true)
    const { error } = await supabase.rpc('trocar_organizacao', { p_organizacao_id: novaOrganizacaoId })
    if (error) {
      alert('Não foi possível trocar de empresa: ' + error.message)
      setTrocando(false)
      return
    }
    window.location.href = '/dashboard'
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

        {organizacoes.length > 1 ? (
          <div className="mt-3">
            <label className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60 mb-1">
              <Building2 className="h-3 w-3" />
              Empresa
            </label>
            <select
              value={organizacoes.find(o => o.nome === organizacaoAtual)?.id ?? ''}
              onChange={e => handleTrocarOrganizacao(e.target.value)}
              disabled={trocando}
              className="w-full text-xs rounded-md px-2 py-1.5 bg-sidebar-muted text-sidebar-foreground border border-sidebar-muted"
            >
              {organizacoes.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
        ) : (
          organizacaoAtual && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-sidebar-foreground/60">
              <Building2 className="h-3 w-3" />
              {organizacaoAtual}
            </p>
          )
        )}
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
