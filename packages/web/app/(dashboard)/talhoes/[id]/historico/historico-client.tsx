'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Tractor, Bug, Leaf, Sprout, ChevronDown, ChevronRight, Calendar, BarChart2, List } from 'lucide-react'
import { formatarData, formatarNumero, cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface DefensivoItem {
  nome_comercial: string; classe: string; unidade: string
  carencia_dias: number | null; reentrada_horas: number | null
}

interface Item {
  quantidade_usada: number; dose_por_hectare: number | null; quantidade_sobrou: number
  defensivo: DefensivoItem | null
}

interface Aplicacao {
  id: string; data: string; status: string; area_aplicada_ha: number | null
  praga_alvo: string | null; condicoes_climaticas: string | null; observacoes: string | null
  responsavel: { nome: string } | null
  itens: Item[]
}

interface Talhao {
  id: string; nome: string; area_ha: number | null; cultura_atual: string | null
  variedade: string | null; numero_corte: number | null; status_colheita: string | null
  fazenda: { nome: string } | null
}

const CLASSE_ICONE: Record<string, { icon: any; cor: string; label: string }> = {
  inseticida:  { icon: Bug,    cor: 'text-orange-600 bg-orange-50 border-orange-200', label: 'Praga' },
  acaricida:   { icon: Bug,    cor: 'text-orange-600 bg-orange-50 border-orange-200', label: 'Praga' },
  nematicida:  { icon: Bug,    cor: 'text-orange-600 bg-orange-50 border-orange-200', label: 'Praga' },
  fungicida:   { icon: Leaf,   cor: 'text-purple-600 bg-purple-50 border-purple-200', label: 'Doença' },
  herbicida:   { icon: Sprout, cor: 'text-yellow-600 bg-yellow-50 border-yellow-200', label: 'Daninha' },
  adjuvante:   { icon: Tractor,cor: 'text-blue-600 bg-blue-50 border-blue-200',       label: 'Adjuvante' },
  fertilizante:{ icon: Leaf,   cor: 'text-green-600 bg-green-50 border-green-200',    label: 'Nutrição' },
}

const DEFAULT_ICONE = { icon: Tractor, cor: 'text-gray-600 bg-gray-50 border-gray-200', label: 'Aplicação' }

type Filtro = 'todos' | 'praga' | 'doenca' | 'daninha'
type Aba = 'lista' | 'grafico'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function isPraga(classe: string)   { return ['inseticida','acaricida','nematicida'].includes(classe) }
function isDoenca(classe: string)  { return classe === 'fungicida' }
function isDaninha(classe: string) { return classe === 'herbicida' }

export function HistoricoTalhaoClient({ talhao, aplicacoes }: { talhao: Talhao; aplicacoes: Aplicacao[] }) {
  const router = useRouter()
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const [filtro, setFiltro]         = useState<Filtro>('todos')
  const [aba, setAba]               = useState<Aba>('lista')

  function toggle(id: string) {
    setExpandidas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const filtradas = aplicacoes.filter(a => {
    if (filtro === 'todos') return true
    return a.itens.some(it => {
      const classe = it.defensivo?.classe ?? ''
      if (filtro === 'praga')   return isPraga(classe)
      if (filtro === 'doenca')  return isDoenca(classe)
      if (filtro === 'daninha') return isDaninha(classe)
      return false
    })
  })

  // Estatísticas
  const totalAplicacoes = aplicacoes.length
  const pragas   = new Set(aplicacoes.flatMap(a => a.itens.filter(i => isPraga(i.defensivo?.classe ?? '')).map(i => i.defensivo?.nome_comercial))).size
  const doencas  = new Set(aplicacoes.flatMap(a => a.itens.filter(i => isDoenca(i.defensivo?.classe ?? '')).map(i => i.defensivo?.nome_comercial))).size
  const daninhas = new Set(aplicacoes.flatMap(a => a.itens.filter(i => isDaninha(i.defensivo?.classe ?? '')).map(i => i.defensivo?.nome_comercial))).size

  // Agrupar por ano/mês para lista
  const porAno = filtradas.reduce((acc, a) => {
    const ano = a.data.substring(0, 4)
    if (!acc[ano]) acc[ano] = []
    acc[ano].push(a)
    return acc
  }, {} as Record<string, Aplicacao[]>)

  // Dados para o gráfico: por mês/ano
  const dadosGrafico = useMemo(() => {
    const mapa: Record<string, { mes: string; pragas: number; doencas: number; daninhas: number; outros: number }> = {}

    aplicacoes.forEach(a => {
      const ano = a.data.substring(0, 4)
      const mesIdx = parseInt(a.data.substring(5, 7)) - 1
      const chave = `${ano}-${String(mesIdx + 1).padStart(2, '0')}`
      if (!mapa[chave]) mapa[chave] = { mes: `${MESES[mesIdx]}/${ano.substring(2)}`, pragas: 0, doencas: 0, daninhas: 0, outros: 0 }

      a.itens.forEach(it => {
        const c = it.defensivo?.classe ?? ''
        if (isPraga(c))        mapa[chave].pragas++
        else if (isDoenca(c))  mapa[chave].doencas++
        else if (isDaninha(c)) mapa[chave].daninhas++
        else                   mapa[chave].outros++
      })
    })

    return Object.keys(mapa).sort().map(k => mapa[k])
  }, [aplicacoes])

  // Top pragas alvo
  const topPragas = useMemo(() => {
    const contagem: Record<string, number> = {}
    aplicacoes.forEach(a => {
      if (a.praga_alvo) contagem[a.praga_alvo] = (contagem[a.praga_alvo] ?? 0) + 1
    })
    return Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [aplicacoes])

  // Top produtos usados
  const topProdutos = useMemo(() => {
    const contagem: Record<string, { n: number; classe: string }> = {}
    aplicacoes.forEach(a => {
      a.itens.forEach(it => {
        const nome = it.defensivo?.nome_comercial ?? ''
        if (!nome) return
        if (!contagem[nome]) contagem[nome] = { n: 0, classe: it.defensivo?.classe ?? '' }
        contagem[nome].n++
      })
    })
    return Object.entries(contagem).sort((a, b) => b[1].n - a[1].n).slice(0, 6)
  }, [aplicacoes])

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto pb-10">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{talhao.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {talhao.fazenda?.nome} · {talhao.area_ha ? `${talhao.area_ha} ha` : '—'}
            {talhao.cultura_atual && ` · ${talhao.cultura_atual}`}
            {talhao.variedade && ` · ${talhao.variedade}`}
            {talhao.numero_corte && ` · ${talhao.numero_corte}º Corte`}
          </p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="text-center">
          <CardContent className="p-3">
            <p className="text-2xl font-bold">{totalAplicacoes}</p>
            <p className="text-xs text-muted-foreground">Aplicações</p>
          </CardContent>
        </Card>
        <Card className="text-center border-orange-200 bg-orange-50/30">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-orange-700">{pragas}</p>
            <p className="text-xs text-orange-600">🐛 Inseticidas</p>
          </CardContent>
        </Card>
        <Card className="text-center border-purple-200 bg-purple-50/30">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-purple-700">{doencas}</p>
            <p className="text-xs text-purple-600">🍃 Fungicidas</p>
          </CardContent>
        </Card>
        <Card className="text-center border-yellow-200 bg-yellow-50/30">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-yellow-700">{daninhas}</p>
            <p className="text-xs text-yellow-600">🌿 Herbicidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Abas Lista / Gráfico */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={aba === 'lista' ? 'default' : 'outline'}
          onClick={() => setAba('lista')}
        >
          <List className="h-4 w-4 mr-1" /> Lista
        </Button>
        <Button
          size="sm"
          variant={aba === 'grafico' ? 'default' : 'outline'}
          onClick={() => setAba('grafico')}
        >
          <BarChart2 className="h-4 w-4 mr-1" /> Gráfico
        </Button>
      </div>

      {/* ===== ABA GRÁFICO ===== */}
      {aba === 'grafico' && (
        <div className="space-y-4">
          {dadosGrafico.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Nenhuma aplicação para exibir no gráfico</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Aplicações por mês e tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dadosGrafico} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(val: any, name: string) => [val, name]}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="pragas"   name="🐛 Pragas"   fill="#f97316" radius={[3,3,0,0]} stackId="a" />
                    <Bar dataKey="doencas"  name="🍃 Doenças"  fill="#a855f7" radius={[3,3,0,0]} stackId="a" />
                    <Bar dataKey="daninhas" name="🌿 Daninhas" fill="#eab308" radius={[3,3,0,0]} stackId="a" />
                    <Bar dataKey="outros"   name="⚙️ Outros"   fill="#6b7280" radius={[3,3,0,0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top pragas alvo */}
          {topPragas.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">🎯 Pragas/alvos mais frequentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topPragas.map(([praga, count]) => (
                  <div key={praga} className="flex items-center gap-3">
                    <span className="text-sm flex-1 truncate">{praga}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-orange-400"
                        style={{ width: `${Math.max(20, (count / topPragas[0][1]) * 120)}px` }}
                      />
                      <span className="text-xs text-muted-foreground w-14 text-right">
                        {count}x aplicação
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Top produtos */}
          {topProdutos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">💊 Produtos mais utilizados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topProdutos.map(([nome, { n, classe }]) => {
                  const config = CLASSE_ICONE[classe] ?? DEFAULT_ICONE
                  return (
                    <div key={nome} className="flex items-center gap-3">
                      <div className={cn('h-6 w-6 rounded flex items-center justify-center shrink-0', config.cor.split(' ').slice(1).join(' '))}>
                        <config.icon className="h-3 w-3" />
                      </div>
                      <span className="text-sm flex-1 truncate">{nome}</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full bg-primary/50"
                          style={{ width: `${Math.max(20, (n / topProdutos[0][1].n) * 100)}px` }}
                        />
                        <span className="text-xs text-muted-foreground w-10 text-right">{n}x</span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== ABA LISTA ===== */}
      {aba === 'lista' && (
        <>
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'todos',   label: 'Todas' },
              { key: 'praga',   label: '🐛 Pragas' },
              { key: 'doenca',  label: '🍃 Doenças' },
              { key: 'daninha', label: '🌿 Daninhas' },
            ] as { key: Filtro; label: string }[]).map(f => (
              <Button
                key={f.key}
                size="sm"
                variant={filtro === f.key ? 'default' : 'outline'}
                onClick={() => setFiltro(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Timeline por ano */}
          {filtradas.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Tractor className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Nenhuma aplicação registrada para este talhão</p>
              </CardContent>
            </Card>
          ) : (
            Object.keys(porAno).sort((a, b) => b.localeCompare(a)).map(ano => (
              <div key={ano}>
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-muted-foreground">{ano}</h2>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{porAno[ano].length} aplicação(ões)</span>
                </div>

                <div className="space-y-2">
                  {porAno[ano].map(a => {
                    const aberta = expandidas.has(a.id)
                    const classePred = a.itens[0]?.defensivo?.classe ?? ''
                    const config = CLASSE_ICONE[classePred] ?? DEFAULT_ICONE
                    const Icon = config.icon

                    return (
                      <Card key={a.id} className={cn('overflow-hidden border', config.cor.split(' ').find(c => c.startsWith('border')))}>
                        <div
                          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/10"
                          onClick={() => toggle(a.id)}
                        >
                          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border', config.cor)}>
                            <Icon className="h-4 w-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{formatarData(a.data)}</p>
                              {a.praga_alvo && (
                                <Badge variant="outline" className="text-xs">{a.praga_alvo}</Badge>
                              )}
                              {a.status === 'em_andamento' && (
                                <Badge variant="info" className="text-xs">Em andamento</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {a.itens.map(i => i.defensivo?.nome_comercial).filter(Boolean).join(', ')}
                              {a.area_aplicada_ha && ` · ${formatarNumero(a.area_aplicada_ha, 1)} ha`}
                              {a.responsavel && ` · ${a.responsavel.nome}`}
                            </p>
                          </div>

                          <div className="text-xs text-muted-foreground shrink-0">
                            {a.itens.length} defensivo(s)
                            {aberta ? <ChevronDown className="h-4 w-4 ml-1 inline" /> : <ChevronRight className="h-4 w-4 ml-1 inline" />}
                          </div>
                        </div>

                        {aberta && (
                          <div className="border-t bg-muted/5 p-4 space-y-3">
                            {a.condicoes_climaticas && (
                              <p className="text-sm text-muted-foreground">🌡️ {a.condicoes_climaticas}</p>
                            )}
                            {a.observacoes && (
                              <p className="text-sm text-muted-foreground">📝 {a.observacoes}</p>
                            )}
                            <div className="space-y-2">
                              {a.itens.map((it, i) => {
                                const c = CLASSE_ICONE[it.defensivo?.classe ?? ''] ?? DEFAULT_ICONE
                                return (
                                  <div key={i} className={cn('rounded-md border p-3 flex items-center gap-3', c.cor)}>
                                    <c.icon className="h-4 w-4 shrink-0" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{it.defensivo?.nome_comercial}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {c.label}
                                        {it.dose_por_hectare && ` · Dose: ${formatarNumero(it.dose_por_hectare, 3)} ${it.defensivo?.unidade}/ha`}
                                        {` · Usado: ${formatarNumero(it.quantidade_usada, 1)} ${it.defensivo?.unidade}`}
                                        {it.quantidade_sobrou > 0 && ` · Sobrou: ${formatarNumero(it.quantidade_sobrou, 1)}`}
                                      </p>
                                      {(it.defensivo?.carencia_dias || it.defensivo?.reentrada_horas) && (
                                        <p className="text-xs mt-1">
                                          {it.defensivo?.carencia_dias && <span className="text-amber-600">⏳ Carência: {it.defensivo.carencia_dias}d </span>}
                                          {it.defensivo?.reentrada_horas && <span className="text-red-600">🚫 Reentrada: {it.defensivo.reentrada_horas}h</span>}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}
