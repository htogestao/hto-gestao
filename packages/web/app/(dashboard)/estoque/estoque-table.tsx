'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatarData, formatarMoeda, formatarNumero, diasParaVencer, statusVencimentoBadge, cn } from '@/lib/utils'
import { Plus, Search, ChevronDown, ChevronRight, Package, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface EstoqueRow {
  defensivo_id: string; nome_comercial: string; principio_ativo: string
  classe: string; unidade: string; empresa: string | null
  local_armazenamento: string | null; estoque_minimo: number
  quantidade_total: number; em_alerta: boolean; tem_vencido: boolean
}

interface LoteRow {
  id: string; numero_nf: string | null; fornecedor: string | null
  data_compra: string | null; quantidade_comprada: number; quantidade_atual: number
  preco_unitario: number | null; valor_total: number | null
  data_vencimento: string | null; lote_fabricante: string | null; observacoes: string | null
  defensivo: { id: string; nome_comercial: string; unidade: string } | null
}

const CLASSE_CORES: Record<string, string> = {
  herbicida: 'bg-yellow-100 text-yellow-800',
  fungicida: 'bg-purple-100 text-purple-800',
  inseticida: 'bg-orange-100 text-orange-800',
  adjuvante: 'bg-blue-100 text-blue-800',
  fertilizante: 'bg-green-100 text-green-800',
  fertilizante_foliar: 'bg-teal-100 text-teal-800',
  nematicida: 'bg-pink-100 text-pink-800',
}

export function EstoqueTable({ estoque, lotes, role }: {
  estoque: EstoqueRow[]; lotes: LoteRow[]; role: string
}) {
  const isAdmin = role === 'admin'
  const [busca, setBusca] = useState('')
  const [filtroClasse, setFiltroClasse] = useState('todos')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [somenteAlertas, setSomenteAlertas] = useState(false)

  const classes = ['todos', ...Array.from(new Set(estoque.map(e => e.classe))).sort()]

  const filtrado = estoque.filter(e => {
    const matchBusca = !busca ||
      e.nome_comercial.toLowerCase().includes(busca.toLowerCase()) ||
      e.principio_ativo.toLowerCase().includes(busca.toLowerCase())
    const matchClasse = filtroClasse === 'todos' || e.classe === filtroClasse
    const matchAlerta = !somenteAlertas || e.em_alerta || e.tem_vencido
    return matchBusca && matchClasse && matchAlerta
  })

  function toggleExpand(id: string) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function lotesDoDefensivo(defId: string) {
    return lotes.filter(l => l.defensivo?.id === defId)
  }

  const alertasCount = estoque.filter(e => e.em_alerta || e.tem_vencido).length

  return (
    <div className="p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estoque & Lotes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {estoque.length} defensivos · {lotes.length} lotes
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/compras">
              <Plus className="h-4 w-4" />
              Nova Entrada
            </Link>
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar defensivo..." className="pl-8" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filtroClasse}
          onChange={e => setFiltroClasse(e.target.value)}
        >
          {classes.map(c => (
            <option key={c} value={c}>{c === 'todos' ? 'Todas as classes' : c.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <Button
          variant={somenteAlertas ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSomenteAlertas(!somenteAlertas)}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Alertas ({alertasCount})
        </Button>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-8 p-3" />
                  <th className="text-left p-3 font-medium">Defensivo</th>
                  <th className="text-left p-3 font-medium">Classe</th>
                  <th className="text-left p-3 font-medium">Empresa</th>
                  <th className="text-left p-3 font-medium">Local</th>
                  <th className="text-right p-3 font-medium">Qtd Total</th>
                  <th className="text-right p-3 font-medium">Mínimo</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  {isAdmin && <th className="text-center p-3 font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtrado.map(e => {
                  const lotesD  = lotesDoDefensivo(e.defensivo_id)
                  const aberto  = expandidos.has(e.defensivo_id)
                  return (
                    <>
                      <tr
                        key={e.defensivo_id}
                        className={cn(
                          'border-b hover:bg-muted/20 cursor-pointer transition-colors',
                          (e.em_alerta || e.tem_vencido) && 'bg-red-50/40'
                        )}
                        onClick={() => toggleExpand(e.defensivo_id)}
                      >
                        <td className="p-3 text-muted-foreground">
                          {aberto
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="p-3">
                          <p className="font-medium">{e.nome_comercial}</p>
                          <p className="text-xs text-muted-foreground">{e.principio_ativo}</p>
                        </td>
                        <td className="p-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                            CLASSE_CORES[e.classe] ?? 'bg-gray-100 text-gray-700')}>
                            {e.classe.replace(/_/g,' ')}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{e.empresa ?? '—'}</td>
                        <td className="p-3 text-muted-foreground capitalize">
                          {e.local_armazenamento?.replace(/_/g,'/') ?? '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">
                          {formatarNumero(e.quantidade_total, 1)} {e.unidade}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {formatarNumero(e.estoque_minimo, 1)} {e.unidade}
                        </td>
                        <td className="p-3 text-center">
                          {e.tem_vencido
                            ? <Badge variant="danger">VENCIDO</Badge>
                            : e.em_alerta
                            ? <Badge variant="warning">Estoque Baixo</Badge>
                            : <Badge variant="success">OK</Badge>}
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-center" onClick={ev => ev.stopPropagation()}>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/defensivos`}>Editar</Link>
                            </Button>
                          </td>
                        )}
                      </tr>

                      {/* Lotes expandidos */}
                      {aberto && lotesD.map(l => {
                        const dias  = diasParaVencer(l.data_vencimento)
                        return (
                          <tr key={l.id} className="border-b bg-muted/10 text-xs">
                            <td className="p-2 pl-8" colSpan={2}>
                              <div className="flex items-center gap-2">
                                <Package className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium">NF {l.numero_nf ?? 'S/NF'}</span>
                                {l.lote_fabricante && <span className="text-muted-foreground">· Lote: {l.lote_fabricante}</span>}
                              </div>
                              {l.fornecedor && <p className="text-muted-foreground mt-0.5 pl-5">{l.fornecedor}</p>}
                              {l.observacoes && <p className="text-muted-foreground mt-0.5 pl-5 italic">{l.observacoes}</p>}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {l.data_compra ? formatarData(l.data_compra) : '—'}
                            </td>
                            <td className="p-2 text-muted-foreground">{l.fornecedor ?? '—'}</td>
                            <td />
                            <td className="p-2 text-right font-mono">
                              {formatarNumero(l.quantidade_atual, 1)} {l.defensivo?.unidade}
                            </td>
                            <td className="p-2 text-right text-muted-foreground font-mono">
                              {formatarNumero(l.quantidade_comprada, 1)}
                            </td>
                            <td className="p-2 text-center">
                              {l.data_vencimento ? (
                                <span className={cn('px-2 py-0.5 rounded-full text-xs', statusVencimentoBadge(dias))}>
                                  {dias !== null && dias < 0
                                    ? `Vencido ${Math.abs(dias)}d atrás`
                                    : dias !== null
                                    ? `Vence em ${dias}d`
                                    : formatarData(l.data_vencimento)}
                                </span>
                              ) : <span className="text-muted-foreground">Sem vencimento</span>}
                            </td>
                            {isAdmin && (
                              <td className="p-2 text-center">
                                <span className="font-semibold text-primary">{formatarMoeda(l.valor_total)}</span>
                                <div className="text-muted-foreground">{formatarMoeda(l.preco_unitario)}/{l.defensivo?.unidade}</div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </>
                  )
                })}

                {filtrado.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      Nenhum defensivo encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
