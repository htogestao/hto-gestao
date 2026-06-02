'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatarData, formatarNumero, cn } from '@/lib/utils'
import { Search, Tractor, ChevronDown, ChevronRight, Plus, Pencil } from 'lucide-react'
import Link from 'next/link'

interface AplicacaoItem {
  id: string; quantidade_usada: number; quantidade_sobrou: number
  dose_por_hectare: number | null; calda_total_l: number | null
  defensivo: { id: string; nome_comercial: string; unidade: string } | null
  lote: { id: string; numero_nf: string | null; data_vencimento: string | null } | null
}

interface TalhaoInfo { id: string; nome: string; area_ha: number | null }

interface Aplicacao {
  id: string; data: string; status: string; area_aplicada_ha: number | null
  praga_alvo: string | null; condicoes_climaticas: string | null
  observacoes: string | null; vazao_l_ha: number | null
  fazenda: { id: string; nome: string } | null
  talhao: TalhaoInfo | null
  talhoes_vinculados: { talhao: TalhaoInfo | null }[]
  responsavel: { id: string; nome: string } | null
  itens: AplicacaoItem[]
}

export function AplicacoesClient({ aplicacoes, role }: { aplicacoes: Aplicacao[]; role: string }) {
  const [busca, setBusca]         = useState('')
  const [filtroStatus, setFiltro] = useState('todos')
  const [expandidas, setExp]      = useState<Set<string>>(new Set())

  function getTalhoes(a: Aplicacao): TalhaoInfo[] {
    if (a.talhoes_vinculados?.length > 0)
      return a.talhoes_vinculados.map(v => v.talhao).filter(Boolean) as TalhaoInfo[]
    return a.talhao ? [a.talhao] : []
  }

  const filtradas = aplicacoes.filter(a => {
    const tals = getTalhoes(a)
    const matchBusca = !busca ||
      (a.fazenda?.nome ?? '').toLowerCase().includes(busca.toLowerCase()) ||
      tals.some(t => t.nome.toLowerCase().includes(busca.toLowerCase())) ||
      (a.praga_alvo ?? '').toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || a.status === filtroStatus
    return matchBusca && matchStatus
  })

  const emAndamento = aplicacoes.filter(a => a.status === 'em_andamento').length

  function toggle(id: string) {
    setExp(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Aplicações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {aplicacoes.length} registros ·
            {emAndamento > 0 && <span className="text-blue-600 font-medium"> {emAndamento} em andamento</span>}
          </p>
        </div>
        <Link href="/aplicacoes/nova">
          <Button><Plus className="h-4 w-4 mr-2" />Nova Aplicação</Button>
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar fazenda, talhão, praga..." className="pl-8" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['todos','em_andamento','encerrada'].map(s => (
            <Button
              key={s}
              variant={filtroStatus === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltro(s)}
            >
              {s === 'todos' ? 'Todas' : s === 'em_andamento' ? 'Em Andamento' : 'Encerradas'}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtradas.map(a => {
          const aberta  = expandidas.has(a.id)
          const tals    = getTalhoes(a)
          const talLabel = tals.length === 0 ? '—'
            : tals.length === 1 ? tals[0].nome
            : `${tals.length} talhões`

          return (
            <Card key={a.id} className={cn(
              'overflow-hidden',
              a.status === 'em_andamento' && 'border-blue-200 bg-blue-50/30'
            )}>
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => toggle(a.id)}
              >
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
                  a.status === 'em_andamento' ? 'bg-blue-100' : 'bg-green-100'
                )}>
                  <Tractor className={cn('h-5 w-5', a.status === 'em_andamento' ? 'text-blue-600' : 'text-green-600')} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{a.fazenda?.nome ?? '—'}</p>
                    <span className="text-muted-foreground">·</span>
                    <p className="text-sm">{talLabel}</p>
                    {a.status === 'em_andamento'
                      ? <Badge variant="info">Em Andamento</Badge>
                      : <Badge variant="success">Encerrada</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatarData(a.data)}
                    {a.area_aplicada_ha && ` · ${formatarNumero(a.area_aplicada_ha, 1)} ha`}
                    {a.vazao_l_ha && ` · ${a.vazao_l_ha} L/ha`}
                    {a.praga_alvo && ` · ${a.praga_alvo}`}
                    {a.responsavel && ` · ${a.responsavel.nome}`}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right text-sm">
                    <p className="font-medium">{a.itens.length} defensivo(s)</p>
                    <p className="text-xs text-muted-foreground">
                      {formatarNumero(a.itens.reduce((s,i) => s + i.quantidade_usada, 0), 1)} unid. total
                    </p>
                  </div>
                  <Link href={`/aplicacoes/${a.id}/editar`} onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="shrink-0">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  {aberta ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {aberta && (
                <div className="border-t bg-muted/10 p-4 space-y-3">
                  {/* Talhões detalhados (multi-talhão) */}
                  {tals.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tals.map(t => (
                        <span key={t.id} className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                          {t.nome}{t.area_ha ? ` · ${t.area_ha} ha` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.condicoes_climaticas && (
                    <p className="text-sm text-muted-foreground">🌡️ {a.condicoes_climaticas}</p>
                  )}
                  {a.observacoes && (
                    <p className="text-sm text-muted-foreground">📝 {a.observacoes}</p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs font-medium text-muted-foreground">
                          <th className="text-left pb-2">Defensivo</th>
                          <th className="text-left pb-2">NF/Lote</th>
                          <th className="text-right pb-2">Dose/ha</th>
                          <th className="text-right pb-2">Qtd Usada</th>
                          <th className="text-right pb-2">Sobrou</th>
                          <th className="text-right pb-2">Calda (L)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.itens.map(it => (
                          <tr key={it.id} className="border-b last:border-0">
                            <td className="py-1.5 font-medium">{it.defensivo?.nome_comercial ?? '—'}</td>
                            <td className="py-1.5 text-muted-foreground">{it.lote?.numero_nf ?? 'S/NF'}</td>
                            <td className="py-1.5 text-right font-mono">
                              {it.dose_por_hectare ? `${formatarNumero(it.dose_por_hectare, 3)} ${it.defensivo?.unidade}/ha` : '—'}
                            </td>
                            <td className="py-1.5 text-right font-mono">
                              {formatarNumero(it.quantidade_usada, 1)} {it.defensivo?.unidade}
                            </td>
                            <td className="py-1.5 text-right font-mono">
                              {formatarNumero(it.quantidade_sobrou, 1)} {it.defensivo?.unidade}
                            </td>
                            <td className="py-1.5 text-right font-mono">
                              {it.calda_total_l ? formatarNumero(it.calda_total_l, 0) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )
        })}

        {filtradas.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Tractor className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhuma aplicação encontrada</p>
          </div>
        )}
      </div>
    </div>
  )
}
