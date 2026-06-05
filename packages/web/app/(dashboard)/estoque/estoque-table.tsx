'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatarData, formatarMoeda, formatarNumero, diasParaVencer, statusVencimentoBadge, cn } from '@/lib/utils'
import { Plus, Search, ChevronDown, ChevronRight, Package, AlertTriangle, Pencil, X, Check } from 'lucide-react'
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

export function EstoqueTable({ estoque: inicial, lotes: lotesIniciais, role }: {
  estoque: EstoqueRow[]; lotes: LoteRow[]; role: string
}) {
  const supabase  = createClient()
  const canEdit   = role === 'admin' || role === 'viewer'
  const isAdmin   = role === 'admin'

  const [estoque,        setEstoque]      = useState(inicial)
  const [lotes,          setLotes]        = useState(lotesIniciais)
  const [busca,          setBusca]        = useState('')
  const [filtroClasse,   setFiltroClasse] = useState('todos')
  const [expandidos,     setExpandidos]   = useState<Set<string>>(new Set())
  const [somenteAlertas, setSomenteAlertas] = useState(false)

  // Estado do modal de edição de lote
  const [editando,    setEditando]    = useState<LoteRow | null>(null)
  const [novaQtd,     setNovaQtd]    = useState('')
  const [novaObs,     setNovaObs]    = useState('')
  const [salvandoLote, setSalvandoLote] = useState(false)
  const [erroLote,    setErroLote]   = useState('')

  const classes = ['todos', ...Array.from(new Set(estoque.map(e => e.classe))).sort()]

  const filtrado = estoque.filter(e => {
    const matchBusca  = !busca || e.nome_comercial.toLowerCase().includes(busca.toLowerCase()) || e.principio_ativo.toLowerCase().includes(busca.toLowerCase())
    const matchClasse = filtroClasse === 'todos' || e.classe === filtroClasse
    const matchAlerta = !somenteAlertas || e.em_alerta || e.tem_vencido
    return matchBusca && matchClasse && matchAlerta
  })

  function toggleExpand(id: string) {
    setExpandidos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function lotesDoDefensivo(defId: string) {
    return lotes.filter(l => l.defensivo?.id === defId)
  }

  function abrirEdicao(l: LoteRow) {
    setEditando(l)
    setNovaQtd(String(l.quantidade_atual))
    setNovaObs(l.observacoes ?? '')
    setErroLote('')
  }

  async function salvarLote() {
    if (!editando) return
    const qtd = parseFloat(novaQtd)
    if (isNaN(qtd) || qtd < 0) { setErroLote('Quantidade inválida.'); return }
    setSalvandoLote(true)
    const { error } = await supabase
      .from('lotes')
      .update({ quantidade_atual: qtd, observacoes: novaObs || null })
      .eq('id', editando.id)
    if (error) { setErroLote(error.message); setSalvandoLote(false); return }

    // Atualiza lotes localmente
    setLotes(prev => prev.map(l => l.id === editando.id
      ? { ...l, quantidade_atual: qtd, observacoes: novaObs || null }
      : l
    ))
    // Recalcula totais localmente
    setEstoque(prev => prev.map(e => {
      if (e.defensivo_id !== editando.defensivo?.id) return e
      const lotesD = lotes.map(l => l.id === editando.id ? { ...l, quantidade_atual: qtd } : l)
        .filter(l => l.defensivo?.id === e.defensivo_id)
      const total = lotesD.reduce((s, l) => s + l.quantidade_atual, 0)
      return { ...e, quantidade_total: total, em_alerta: total <= e.estoque_minimo }
    }))
    setSalvandoLote(false)
    setEditando(null)
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
        {canEdit && (
          <Button asChild>
            <Link href="/compras">
              <Plus className="h-4 w-4 mr-1" />Nova Entrada
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
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filtroClasse} onChange={e => setFiltroClasse(e.target.value)}>
          {classes.map(c => (
            <option key={c} value={c}>{c === 'todos' ? 'Todas as classes' : c.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <Button variant={somenteAlertas ? 'default' : 'outline'} size="sm"
          onClick={() => setSomenteAlertas(!somenteAlertas)}>
          <AlertTriangle className="h-4 w-4 mr-1" />Alertas ({alertasCount})
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
                </tr>
              </thead>
              <tbody>
                {filtrado.map(e => {
                  const lotesD = lotesDoDefensivo(e.defensivo_id)
                  const aberto = expandidos.has(e.defensivo_id)
                  return (
                    <>
                      <tr key={e.defensivo_id}
                        className={cn('border-b hover:bg-muted/20 cursor-pointer transition-colors',
                          (e.em_alerta || e.tem_vencido) && 'bg-red-50/40')}
                        onClick={() => toggleExpand(e.defensivo_id)}
                      >
                        <td className="p-3 text-muted-foreground">
                          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
                        <td className="p-3 text-muted-foreground capitalize">{e.local_armazenamento?.replace(/_/g,'/') ?? '—'}</td>
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
                      </tr>

                      {/* Lotes expandidos */}
                      {aberto && lotesD.map(l => {
                        const dias = diasParaVencer(l.data_vencimento)
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
                            <td className="p-2 text-muted-foreground">{l.data_compra ? formatarData(l.data_compra) : '—'}</td>
                            <td className="p-2 text-muted-foreground">{l.fornecedor ?? '—'}</td>
                            <td />
                            <td className="p-2 text-right font-mono font-semibold">
                              {formatarNumero(l.quantidade_atual, 1)} {l.defensivo?.unidade}
                            </td>
                            <td className="p-2 text-right text-muted-foreground font-mono">
                              {formatarNumero(l.quantidade_comprada, 1)}
                            </td>
                            <td className="p-2 text-center">
                              {l.data_vencimento ? (
                                <span className={cn('px-2 py-0.5 rounded-full text-xs', statusVencimentoBadge(dias))}>
                                  {dias !== null && dias < 0 ? `Vencido ${Math.abs(dias)}d atrás`
                                    : dias !== null ? `Vence em ${dias}d`
                                    : formatarData(l.data_vencimento)}
                                </span>
                              ) : <span className="text-muted-foreground">Sem vencimento</span>}
                              {/* Botão editar lote */}
                              {canEdit && (
                                <button
                                  onClick={ev => { ev.stopPropagation(); abrirEdicao(l) }}
                                  className="ml-2 text-muted-foreground hover:text-primary inline-flex items-center"
                                  title="Corrigir quantidade"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}

                      {/* Linha para adicionar novo lote */}
                      {aberto && canEdit && (
                        <tr className="border-b bg-muted/5">
                          <td colSpan={8} className="p-2 pl-8">
                            <Link href="/compras"
                              className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Plus className="h-3 w-3" /> Adicionar entrada de estoque
                            </Link>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}

                {filtrado.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Nenhum defensivo encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal edição de lote */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">Corrigir Estoque</h2>
              <button onClick={() => setEditando(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>

            <div className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
              <p className="font-medium text-foreground">{editando.defensivo?.nome_comercial}</p>
              <p>NF {editando.numero_nf ?? 'S/NF'} · Compra: {formatarData(editando.data_compra)}</p>
            </div>

            {erroLote && <p className="text-xs text-red-600 bg-red-50 rounded p-2">{erroLote}</p>}

            <div>
              <label className="text-sm font-medium">
                Quantidade atual ({editando.defensivo?.unidade})
              </label>
              <Input
                type="number" step="0.01" min="0"
                className="mt-1"
                value={novaQtd}
                onChange={e => setNovaQtd(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valor anterior: {formatarNumero(editando.quantidade_atual, 2)} {editando.defensivo?.unidade}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Observação (opcional)</label>
              <Input
                className="mt-1"
                placeholder="Ex: Correção de inventário..."
                value={novaObs}
                onChange={e => setNovaObs(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button onClick={salvarLote} disabled={salvandoLote}>
                <Check className="h-4 w-4 mr-1" />
                {salvandoLote ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
