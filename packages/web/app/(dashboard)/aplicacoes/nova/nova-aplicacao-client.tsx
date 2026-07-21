'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, ArrowLeft, MapPin, Droplets } from 'lucide-react'
import { formatarNumero } from '@/lib/utils'

interface Fazenda   { id: string; nome: string }
interface Talhao    { id: string; nome: string; fazenda_id: string; area_ha: number | null }
interface Defensivo { id: string; nome_comercial: string; unidade: string }
interface Lote      { id: string; numero_nf: string | null; defensivo_id: string; quantidade_atual: number }
interface Cultura   { id: string; nome: string }
interface Operador  { id: string; nome: string }
interface Frota     { id: string; identificador: string; categoria: string }

interface Item {
  defensivo_id:      string
  lote_id:           string
  dose_por_hectare:  string
  qtd_retirada:      string   // sobrescreve o cálculo automático se preenchido
  quantidade_sobrou: string
}

const ITEM_VAZIO: Item = {
  defensivo_id: '', lote_id: '',
  dose_por_hectare: '', qtd_retirada: '', quantidade_sobrou: '0',
}

// Lista de operações (objetivo). Lista fixa nesta fase — evolui para cadastro próprio (Fase 2).
const OPERACOES = [
  'Fungicida', 'Inseticida', 'Catação química', 'Plantio mecanizado',
  'Dessecação', 'Maturador/barra reguladora de crescimento',
]

// Ordem e rótulos dos grupos de frota (categoria no banco → rótulo na tela)
const CATEGORIA_FROTA: { key: string; label: string }[] = [
  { key: 'pulverizador',      label: 'Pulverizadores' },
  { key: 'trator_implemento', label: 'Trator + implemento' },
  { key: 'cultivador',        label: 'Cultivador' },
]

// Equipamento é derivado da categoria da frota (read-only na tela)
const EQUIPAMENTO_POR_CATEGORIA: Record<string, string> = {
  pulverizador:      'Pulverizador',
  trator_implemento: 'Trator + implemento',
  cultivador:        'Cultivador',
}

export function NovaAplicacaoClient({ fazendas, talhoes, defensivos, lotes, culturas, operadores, frotas, userId }: {
  fazendas: Fazenda[]; talhoes: Talhao[]; defensivos: Defensivo[]
  lotes: Lote[]; culturas: Cultura[]; operadores: Operador[]; frotas: Frota[]
  userId: string; userName: string
}) {
  const supabase = createClient()
  const router   = useRouter()

  const canaPadrao = culturas.find(c => c.nome === 'Cana')?.id ?? ''
  const [culturaId,  setCulturaId]  = useState(canaPadrao)
  const [fazendaId,  setFazendaId]  = useState('')
  const [talhoesSel, setTalhoesSel] = useState<string[]>([])
  const [data,       setData]       = useState(new Date().toISOString().split('T')[0])
  const [operacao,      setOperacao]      = useState('')
  const [vazao,      setVazao]      = useState('')
  const [status,     setStatus]     = useState<'em_andamento' | 'encerrada'>('encerrada')
  const [tipoAplicacao, setTipoAplicacao] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim,    setHoraFim]    = useState('')
  const [horimetroInicial, setHorimetroInicial] = useState('')
  const [horimetroFinal,   setHorimetroFinal]   = useState('')
  const [operadorId,  setOperadorId]  = useState('')
  const [frotaId,     setFrotaId]     = useState('')
  const [itens,      setItens]      = useState<Item[]>([{ ...ITEM_VAZIO }])
  const [salvando,   setSalvando]   = useState(false)
  const [erro,       setErro]       = useState('')

  const talhoesFazenda = talhoes.filter(t => t.fazenda_id === fazendaId)

  // Equipamento é derivado da frota selecionada (read-only). Sem frota → vazio.
  const frotaSel    = frotas.find(f => f.id === frotaId)
  const equipamento = frotaSel ? (EQUIPAMENTO_POR_CATEGORIA[frotaSel.categoria] ?? '') : ''

  // Só produtos com saldo disponível aparecem no seletor de aplicação (interface)
  const defensivosComSaldo = useMemo(
    () => defensivos.filter(d => lotes.some(l => l.defensivo_id === d.id && l.quantidade_atual > 0)),
    [defensivos, lotes]
  )

  const talhoesInfo = useMemo(
    () => talhoesSel.map(id => talhoesFazenda.find(t => t.id === id)).filter(Boolean) as Talhao[],
    [talhoesSel, talhoesFazenda]
  )

  const areaTotal = useMemo(
    () => talhoesInfo.reduce((s, t) => s + (t.area_ha ?? 0), 0),
    [talhoesInfo]
  )

  function toggleTalhao(id: string) {
    setTalhoesSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleTodos() {
    setTalhoesSel(
      talhoesSel.length === talhoesFazenda.length ? [] : talhoesFazenda.map(t => t.id)
    )
  }

  function atualizarItem(i: number, campo: keyof Item, valor: string) {
    setItens(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it))
  }

  function lotesDoDefensivo(defId: string) {
    return lotes.filter(l => l.defensivo_id === defId)
  }

  async function salvar() {
    if (!fazendaId || talhoesSel.length === 0 || !data) {
      setErro('Selecione a fazenda, pelo menos um talhão e a data.'); return
    }
    if (itens.some(it => !it.defensivo_id || !it.dose_por_hectare)) {
      setErro('Preencha defensivo e dose/ha em todos os itens.'); return
    }
    setErro(''); setSalvando(true)

    const operacaoFinal = operacao || null
    // Texto denormalizado (nome/identificador) mantém Lista/Detalhe/exports funcionando
    const operadorSel = operadores.find(o => o.id === operadorId)

    try {
      // ── 1. Cria UMA aplicação com área total ─────────────────────────
      const { data: aplic, error: errAplic } = await supabase
        .from('aplicacoes')
        .insert({
          fazenda_id:       fazendaId,
          talhao_id:        talhoesSel[0],
          cultura_id:       culturaId || canaPadrao,
          data,
          status,
          operacao:         operacaoFinal,
          area_aplicada_ha: areaTotal || null,
          responsavel_id:   userId,
          vazao_l_ha:       vazao ? parseFloat(vazao) : null,
          tipo_aplicacao:   tipoAplicacao || null,
          hora_inicio:      horaInicio || null,
          hora_fim:         horaFim || null,
          horimetro_inicial: horimetroInicial ? parseFloat(horimetroInicial) : null,
          horimetro_final:   horimetroFinal ? parseFloat(horimetroFinal) : null,
          operador_id:      operadorId || null,
          operador:         operadorSel?.nome || null,
          equipamento:      equipamento || null,
          frota_id:         frotaId || null,
          frota:            frotaSel?.identificador || null,
        })
        .select('id').single()

      if (errAplic) throw errAplic

      // ── 2. Vincula TODOS os talhões selecionados ──────────────────────
      const vinculos = talhoesSel.map(talhaoId => ({
        aplicacao_id: aplic!.id,
        talhao_id:    talhaoId,
        area_ha:      talhoesFazenda.find(t => t.id === talhaoId)?.area_ha ?? null,
      }))

      const { error: errVinc } = await supabase.from('aplicacao_talhoes').insert(vinculos)
      if (errVinc) throw errVinc

      // ── 3. Salva itens — usa qtd_retirada manual ou calcula dose × área ─
      const itensSalvar = itens.map(it => {
        const doseNum = parseFloat(it.dose_por_hectare) || 0
        const qtdAuto = doseNum * (areaTotal || 1)
        const qtdFinal = it.qtd_retirada ? parseFloat(it.qtd_retirada) : qtdAuto
        return {
          aplicacao_id:     aplic!.id,
          defensivo_id:     it.defensivo_id,
          lote_id:          it.lote_id || null,
          dose_por_hectare: doseNum || null,
          quantidade_usada: qtdFinal,
          quantidade_sobrou: parseFloat(it.quantidade_sobrou) || 0,
          calda_total_l:    vazao && areaTotal ? parseFloat(vazao) * areaTotal : null,
        }
      })

      const { error: errItens } = await supabase.from('aplicacao_itens').insert(itensSalvar)
      if (errItens) throw errItens

      router.push('/aplicacoes')
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-10">

      {/* ── Cabeçalho ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Nova Aplicação</h1>
      </div>

      {erro && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{erro}</div>
      )}

      {/* ── 1 · ONDE APLIQUEI? ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1 · Aplicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium">Cultura *</label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={culturaId}
              onChange={e => setCulturaId(e.target.value)}
            >
              {culturas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Fazenda *</label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={fazendaId}
              onChange={e => { setFazendaId(e.target.value); setTalhoesSel([]) }}
            >
              <option value="">Selecione a fazenda...</option>
              {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>

          {fazendaId && talhoesFazenda.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  Talhões *
                  <span className="font-normal text-muted-foreground ml-1">(pode selecionar vários)</span>
                </label>
                <button type="button" onClick={toggleTodos} className="text-xs text-primary hover:underline">
                  {talhoesSel.length === talhoesFazenda.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>

              <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                {talhoesFazenda.map(t => (
                  <label
                    key={t.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                      talhoesSel.includes(t.id) ? 'bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={talhoesSel.includes(t.id)}
                      onChange={() => toggleTalhao(t.id)}
                      className="h-4 w-4 rounded"
                    />
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 text-sm">{t.nome}</span>
                    {t.area_ha != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">{t.area_ha} ha</span>
                    )}
                  </label>
                ))}
              </div>

              {talhoesSel.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                    {talhoesSel.length} talhão(ões)
                  </span>
                  {areaTotal > 0 && (
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {formatarNumero(areaTotal, 2)} ha total
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {fazendaId && talhoesFazenda.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum talhão cadastrado nesta fazenda.</p>
          )}
        </CardContent>
      </Card>

      {/* ── 2 · DADOS DA APLICAÇÃO ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">2 · Dados da aplicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Data *</label>
              <Input type="date" className="mt-1" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Operação</label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={operacao} onChange={e => setOperacao(e.target.value)}
              >
                <option value="">Selecione...</option>
                {OPERACOES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-blue-500" />
                Vazão da calda (L/ha)
              </label>
              <Input type="number" step="1" min="0" placeholder="Ex: 100, 150, 300" className="mt-1"
                value={vazao} onChange={e => setVazao(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status} onChange={e => setStatus(e.target.value as any)}
              >
                <option value="encerrada">Encerrada</option>
                <option value="em_andamento">Em andamento</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Tipo de Aplicação</label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={tipoAplicacao} onChange={e => setTipoAplicacao(e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="barra_total">Barra Total</option>
              <option value="pingente">Pingente</option>
              <option value="canetinha">Canetinha</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Hora Início</label>
              <Input type="time" className="mt-1"
                value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Hora Fim</label>
              <Input type="time" className="mt-1"
                value={horaFim} onChange={e => setHoraFim(e.target.value)} />
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ── 3 · DEFENSIVOS ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">3 · Defensivos</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setItens(prev => [...prev, { ...ITEM_VAZIO }])}>
              <Plus className="h-4 w-4 mr-1" />Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {itens.map((it, i) => {
            const def      = defensivos.find(d => d.id === it.defensivo_id)
            const un       = def?.unidade ?? 'L'
            const doseNum  = parseFloat(it.dose_por_hectare) || 0
            const esperado = doseNum * areaTotal
            const loteSel  = lotes.find(l => l.id === it.lote_id)

            return (
              <div key={i} className="space-y-2 border rounded-md p-3 relative">
                {itens.length > 1 && (
                  <button type="button"
                    onClick={() => setItens(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                <div>
                  <label className="text-xs font-medium">Defensivo *</label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={it.defensivo_id}
                    onChange={e => {
                      const defId = e.target.value
                      const primLote = lotesDoDefensivo(defId)[0]
                      setItens(prev => prev.map((it2, idx) => idx === i
                        ? { ...it2, defensivo_id: defId, lote_id: primLote?.id ?? '' }
                        : it2
                      ))
                    }}
                  >
                    <option value="">Selecione...</option>
                    {defensivosComSaldo.map(d => (
                      <option key={d.id} value={d.id}>{d.nome_comercial} ({d.unidade})</option>
                    ))}
                  </select>
                </div>

                {it.defensivo_id && lotesDoDefensivo(it.defensivo_id).length > 0 && (
                  <div>
                    <label className="text-xs font-medium">
                      Lote / NF <span className="text-green-600 font-normal">(estoque será descontado)</span>
                    </label>
                    <select
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={it.lote_id}
                      onChange={e => atualizarItem(i, 'lote_id', e.target.value)}
                    >
                      {lotesDoDefensivo(it.defensivo_id).map(l => (
                        <option key={l.id} value={l.id}>
                          NF {l.numero_nf ?? 'S/NF'} — saldo: {l.quantidade_atual} {def?.unidade}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Linha automática: saldo · área · esperado (evita erro de retirada) */}
                {it.defensivo_id && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {loteSel && <span>Saldo: <strong className="text-foreground">{formatarNumero(loteSel.quantidade_atual, 2)} {un}</strong></span>}
                    {areaTotal > 0 && <span>Área: <strong className="text-foreground">{formatarNumero(areaTotal, 2)} ha</strong></span>}
                    {esperado > 0 && <span>Esperado: <strong className="text-blue-700">{formatarNumero(esperado, 2)} {un}</strong></span>}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium">Dose/ha ({un}/ha) *</label>
                    <Input type="number" step="0.001" placeholder="0.000" className="mt-1"
                      value={it.dose_por_hectare}
                      onChange={e => atualizarItem(i, 'dose_por_hectare', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Qtd retirada ({un}) *</label>
                    <Input
                      type="number" step="0.01" className="mt-1"
                      placeholder={esperado > 0 ? `≈ ${formatarNumero(esperado, 2)}` : '0.00'}
                      value={it.qtd_retirada}
                      onChange={e => atualizarItem(i, 'qtd_retirada', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Sobrou ({un})</label>
                    <Input type="number" step="0.01" placeholder="0.00" className="mt-1"
                      value={it.quantidade_sobrou}
                      onChange={e => atualizarItem(i, 'quantidade_sobrou', e.target.value)} />
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── 4 · DADOS OPERACIONAIS ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">4 · Dados operacionais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Operador</label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={operadorId} onChange={e => setOperadorId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {operadores.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Equipamento</label>
              <Input className="mt-1 bg-muted text-muted-foreground cursor-not-allowed" readOnly
                tabIndex={-1} placeholder="Definido pela frota"
                value={equipamento} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Frota</label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={frotaId} onChange={e => setFrotaId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {CATEGORIA_FROTA.map(cat => {
                  const doGrupo = frotas.filter(f => f.categoria === cat.key)
                  if (doGrupo.length === 0) return null
                  return (
                    <optgroup key={cat.key} label={cat.label}>
                      {doGrupo.map(f => <option key={f.id} value={f.id}>{f.identificador}</option>)}
                    </optgroup>
                  )
                })}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Horímetro inicial</label>
              <Input type="number" step="0.1" min="0" placeholder="Ex: 1234.5" className="mt-1"
                value={horimetroInicial} onChange={e => setHorimetroInicial(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Horímetro final</label>
              <Input type="number" step="0.1" min="0" placeholder="Ex: 1240.0" className="mt-1"
                value={horimetroFinal} onChange={e => setHorimetroFinal(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={salvar} disabled={salvando}>
        {salvando ? 'Salvando...' : 'Salvar Aplicação'}
      </Button>
    </div>
  )
}
