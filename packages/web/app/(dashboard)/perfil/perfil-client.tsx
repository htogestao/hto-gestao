'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Mail, Shield, Calendar, KeyRound, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<string, string> = {
  admin:  'Analista / Supervisor',
  viewer: 'Patrão / Produtor',
  field:  'Líder de Campo',
}

const ROLE_COR: Record<string, string> = {
  admin:  'bg-green-100 text-green-700',
  viewer: 'bg-blue-100 text-blue-700',
  field:  'bg-orange-100 text-orange-700',
}

export function PerfilClient({ userId, email, nome, role, criadoEm }: {
  userId: string; email: string; nome: string; role: string; criadoEm: string
}) {
  const supabase = createClient()

  const [senhaAtual,    setSenhaAtual]    = useState('')
  const [novaSenha,     setNovaSenha]     = useState('')
  const [confirmar,     setConfirmar]     = useState('')
  const [salvando,      setSalvando]      = useState(false)
  const [msg,           setMsg]           = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  async function trocarSenha() {
    if (!novaSenha || !confirmar) { setMsg({ tipo: 'erro', texto: 'Preencha todos os campos.' }); return }
    if (novaSenha.length < 6)    { setMsg({ tipo: 'erro', texto: 'A senha deve ter pelo menos 6 caracteres.' }); return }
    if (novaSenha !== confirmar) { setMsg({ tipo: 'erro', texto: 'As senhas não coincidem.' }); return }

    setSalvando(true); setMsg(null)
    try {
      // Reautentica com senha atual
      const { error: errLogin } = await supabase.auth.signInWithPassword({ email, password: senhaAtual })
      if (errLogin) { setMsg({ tipo: 'erro', texto: 'Senha atual incorreta.' }); return }

      // Troca a senha
      const { error } = await supabase.auth.updateUser({ password: novaSenha })
      if (error) throw error

      setMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso!' })
      setSenhaAtual(''); setNovaSenha(''); setConfirmar('')
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message ?? 'Erro ao alterar senha.' })
    } finally {
      setSalvando(false)
    }
  }

  const dataEntrada = criadoEm
    ? new Date(criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Suas informações e configurações de acesso</p>
      </div>

      {/* Dados do usuário */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Informações da conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">{nome}</p>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COR[role] ?? 'bg-gray-100 text-gray-700')}>
                {ROLE_LABEL[role] ?? role}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">E-mail:</span>
              <span className="font-medium">{email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Permissão:</span>
              <span className="font-medium">{ROLE_LABEL[role] ?? role}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Membro desde:</span>
              <span className="font-medium">{dataEntrada}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trocar senha */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium">Senha atual</label>
            <Input
              type="password"
              className="mt-1"
              placeholder="Digite sua senha atual"
              value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Nova senha</label>
            <Input
              type="password"
              className="mt-1"
              placeholder="Mínimo 6 caracteres"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Confirmar nova senha</label>
            <Input
              type="password"
              className="mt-1"
              placeholder="Repita a nova senha"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
            />
          </div>

          {msg && (
            <div className={cn(
              'flex items-center gap-2 rounded-md p-3 text-sm',
              msg.tipo === 'ok'  ? 'bg-green-50 text-green-700 border border-green-200' :
                                   'bg-red-50 text-red-700 border border-red-200'
            )}>
              {msg.tipo === 'ok'
                ? <Check className="h-4 w-4 shrink-0" />
                : <AlertTriangle className="h-4 w-4 shrink-0" />}
              {msg.texto}
            </div>
          )}

          <Button
            className="w-full"
            onClick={trocarSenha}
            disabled={salvando || !senhaAtual || !novaSenha || !confirmar}
          >
            {salvando ? 'Salvando...' : 'Alterar Senha'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
