'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Tractor, Bug, Leaf, Sprout, ChevronDown, ChevronRight, Calendar } from 'lucide-react'
import { formatarData, formatarNumero, cn } from '@/lib/utils'

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

export function HistoricoTalhaoClient({ talhao, aplicacoes }: { talhao: Talhao; aplicacoes: Aplicacao[] }) {
  const router = useRouter()
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const [filtro, setFiltro] = useState<Filtro>('todos')

  function toggle(id: string) {
    setExpandidas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const filtradas = aplicacoes.filter(a => {
    if (filtro === 'todos') return true
    return a.itens.some(it => {
      const classe = it.defensivo?.classe ?? ''
      if (filtro === 'praga')   return ['inseticida','acaricida','nematicida'].includes(classe)
      if (filtro === 'doenca')  return classe === 'fungicida'
      if (filtro === 'daninha') return classe === 'herbicida'
      return false
    })
  })

  // Estatísticas
  const totalAplicacoes = aplicacoes.length
  const pragas   = new Set(aplicacoes.flatMap(a => a.itens.filter(i => ['inseticida','acaricida','nematicida'].includes(i.defensivo?.classe ?? '')).map(i => i.defensivo?.nome_comercial))).size
  const doencas  = new Set(aplicacoes.flatMap(a => a.itens.filter(i => i.defensivo?.classe === 'fungicida').map(i => i.defensivo?.nome_comercial))).size
  const daninhas = new Set(aplicacoes.flatMap(a => a.itens.filter(i => i.defensivo?.classe === 'herbicida').map(i => i.defensivo?.nome_comercial))).size

  // Agrupar por ano/mês
  const porAno = filtradas.reduce((acc, a) => {
    const ano = a.data.substring(0, 4)
    if (!acc[ano]) acc[ano] = []
    acc[ano].push(a)
    return acc
  }, {} as Record<string, Aplicacao[]>)

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
                // Pega a classe predominante para cor do card
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
    </div>
  )
}
