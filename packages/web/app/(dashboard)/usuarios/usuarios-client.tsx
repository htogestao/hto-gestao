'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatarData } from '@/lib/utils'
import { Users, UserCheck, UserX, Search, Shield, Eye, Tractor } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Usuario {
  id: string; nome: string; telefone: string | null
  role: string; ativo: boolean; created_at: string
}

const ROLE_CONFIG = {
  admin:  { label: 'Analista / Supervisor', icon: Shield, variant: 'default' as const,  cor: 'text-green-700 bg-green-100' },
  viewer: { label: 'Patrão / Produtor',     icon: Eye,    variant: 'info' as const,     cor: 'text-blue-700 bg-blue-100' },
  field:  { label: 'Operador de Campo',      icon: Tractor,variant: 'outline' as const,  cor: 'text-orange-700 bg-orange-100' },
}

export function UsuariosClient({ usuarios, currentUserId }: { usuarios: Usuario[]; currentUserId: string }) {
  const supabase = createClient()
  const router   = useRouter()
  const [busca, setBusca]     = useState('')
  const [saving, setSaving]   = useState<string | null>(null)

  const filtrados = usuarios.filter(u =>
    !busca || u.nome.toLowerCase().includes(busca.toLowerCase())
  )

  async function toggleAtivo(u: Usuario) {
    if (u.id === currentUserId) return
    setSaving(u.id)
    await supabase.from('profiles').update({ ativo: !u.ativo }).eq('id', u.id)
    setSaving(null)
    router.refresh()
  }

  async function alterarRole(id: string, role: string) {
    if (id === currentUserId) return
    setSaving(id)
    await supabase.from('profiles').update({ role }).eq('id', id)
    setSaving(null)
    router.refresh()
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {usuarios.length} usuários · {usuarios.filter(u => u.ativo).length} ativos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const count = usuarios.filter(u => u.role === role && u.ativo).length
          return (
            <Card key={role}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cfg.cor.split(' ')[1]}`}>
                  <cfg.icon className={`h-5 w-5 ${cfg.cor.split(' ')[0]}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar usuário..." className="pl-8" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium">Usuário</th>
                <th className="text-left p-3 font-medium">Perfil</th>
                <th className="text-left p-3 font-medium">Telefone</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Desde</th>
                <th className="text-center p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(u => {
                const cfg = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG]
                const isSelf = u.id === currentUserId
                return (
                  <tr key={u.id} className="border-b hover:bg-muted/10 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{u.nome}</p>
                          {isSelf && <p className="text-xs text-muted-foreground">(você)</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      {isSelf ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg?.cor}`}>{cfg?.label}</span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={e => alterarRole(u.id, e.target.value)}
                          disabled={saving === u.id}
                          className="text-xs border rounded-full px-2 py-1 bg-background"
                        >
                          {Object.entries(ROLE_CONFIG).map(([r, c]) => (
                            <option key={r} value={r}>{c.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{u.telefone ?? '—'}</td>
                    <td className="p-3 text-center">
                      {u.ativo
                        ? <Badge variant="success">Ativo</Badge>
                        : <Badge variant="danger">Inativo</Badge>}
                    </td>
                    <td className="p-3 text-muted-foreground">{formatarData(u.created_at)}</td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost" size="sm"
                        disabled={isSelf || saving === u.id}
                        onClick={() => toggleAtivo(u)}
                      >
                        {u.ativo
                          ? <><UserX className="h-3.5 w-3.5 mr-1" />Desativar</>
                          : <><UserCheck className="h-3.5 w-3.5 mr-1" />Ativar</>}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
        <p className="font-medium mb-1">💡 Para criar novos usuários:</p>
        <p>Acesse o Supabase Dashboard → Authentication → Users → Invite user. Defina o e-mail e após o primeiro login ajuste o perfil aqui.</p>
      </div>
    </div>
  )
}
