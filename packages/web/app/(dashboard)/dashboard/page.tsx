import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertasCard } from '@/components/alertas-card'
import { GraficoEstoque } from '@/components/grafico-estoque'
import { formatarNumero, formatarMoeda } from '@/lib/utils'
import { Package, Tractor, AlertTriangle, DollarSign, MapPin, Layers } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: profile } = await supabase.from('profiles').select('role,nome')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()

  const isAdmin = profile?.role === 'admin'

  // Buscar dados em paralelo
  const [
    { data: estoque },
    { data: alertas },
    { data: aplicacoesMes },
    { data: fazendas },
    { data: talhoes },
  ] = await Promise.all([
    supabase.rpc('estoque_atual'),
    supabase.rpc('alertas_ativos'),
    supabase.from('aplicacoes')
      .select('id, status, data, fazenda:fazendas(nome)')
      .gte('data', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
    supabase.from('fazendas').select('id', { count: 'exact', head: true }),
    supabase.from('talhoes').select('id', { count: 'exact', head: true }),
  ])

  const totalProdutos  = estoque?.length ?? 0
  const emAlerta       = estoque?.filter(e => e.em_alerta).length ?? 0
  const temVencido     = estoque?.filter(e => e.tem_vencido).length ?? 0
  const alertasCount   = alertas?.length ?? 0
  const apEmAndamento  = aplicacoesMes?.filter(a => a.status === 'em_andamento').length ?? 0
  const apEncerradas   = aplicacoesMes?.filter(a => a.status === 'encerrada').length ?? 0

  // Valor total em estoque (só admin/viewer)
  const { data: lotes } = await supabase
    .from('lotes').select('quantidade_atual, preco_unitario')
  const valorEstoque = lotes?.reduce((acc, l) =>
    acc + (l.quantidade_atual * (l.preco_unitario ?? 0)), 0) ?? 0

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral da operação — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Defensivos em Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalProdutos}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {emAlerta > 0 && <span className="text-orange-600">{emAlerta} abaixo do mínimo</span>}
              {emAlerta === 0 && <span className="text-green-600">Todos em nível adequado</span>}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              Valor em Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatarMoeda(valorEstoque)}</p>
            <p className="text-xs text-muted-foreground mt-1">Custo médio ponderado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tractor className="h-4 w-4 text-amber-600" />
              Aplicações no Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{aplicacoesMes?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {apEmAndamento > 0 && <span className="text-blue-600">{apEmAndamento} em andamento · </span>}
              <span className="text-green-600">{apEncerradas} encerradas</span>
            </p>
          </CardContent>
        </Card>

        <Card className={alertasCount > 0 ? 'border-red-200 bg-red-50/50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium flex items-center gap-2 ${alertasCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              <AlertTriangle className="h-4 w-4" />
              Alertas Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${alertasCount > 0 ? 'text-red-600' : ''}`}>{alertasCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {temVencido > 0 && <span className="text-red-600 font-medium">{temVencido} lote(s) VENCIDO(s)</span>}
              {temVencido === 0 && alertasCount === 0 && <span className="text-green-600">Nenhum alerta</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Segunda linha de cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              Fazendas Cadastradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fazendas?.count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-teal-600" />
              Talhões Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{talhoes?.count ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas + Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GraficoEstoque estoque={estoque ?? []} />
        </div>
        <div>
          <AlertasCard alertas={alertas ?? []} />
        </div>
      </div>
    </div>
  )
}
