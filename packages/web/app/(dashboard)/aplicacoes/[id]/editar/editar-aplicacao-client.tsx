'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, ArrowLeft, AlertTriangle, MapPin } from 'lucide-react'

interface Fazenda   { id: string; nome: string }
interface Talhao    { id: string; nome: string; fazenda_id: string; area_ha: number | null }
interface Defensivo { id: string; nome_comercial: string; unidade: string }
interface Lote      { id: string; numero_nf: string | null; defensivo_id: string; quantidade_atual: number }
interface Cultura   { id: string; nome: string }
interface Operador  { id: string; nome: string }
interface Frota     { id: string; identificador: string; categoria: string }

// Lista fixa de operações (mesma da tela Nova) — evolui para cadastro próprio (Fase 2).
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

interface Item {
  id?: string
  defensivo_id: string
  lote_id: string
  quantidade_usada: string
  quantidade_sobrou: string
  dose_por_hectare: string
  calda_total_l: string
}

interface Aplicacao {
  id: string; data: string; status: string
  area_aplicada_ha: number | null; praga_alvo: string | null
  condicoes_climaticas: string | null; observacoes: string | null
  fazenda_id: string; talhao_id: string; cultura_id: string
  operador: string | null; operador_id: string | null
  equipamento: string | null; frota: string | null; frota_id: string | null
  operacao: string | null; horimetro_inicial: number | null
  tipo_aplicacao: string | null; temperatura: number | null; umidade: number | null
  velocidade_vento: number | null; hora_inicio: string | null; hora_fim: string | null
  talhoes_vinculados?: { talhao_id: string }[]
  itens: {
    id: string; defensivo_id: string; lote_id: string | null
    quantidade_usada: number; quantidade_sobrou: number
    dose_por_hectare: number | null; calda_total_l: number | null
  }[]
}

export function EditarAplicacaoClient({ aplicacao, fazendas, talhoes, defensivos, lotes, culturas, operadores, frotas }: {
  aplicacao: Aplicacao
  fazendas: Fazenda[]; talhoes: Talhao[]; defensivos: Defensivo[]; lotes: Lote[]; culturas: Cultura[]
  operadores: Operador[]; frotas: Frota[]
}) {
  const supabase = createClient()
  const router   = useRouter()

  const [culturaId, setCulturaId] = useState(aplicacao.cultura_id ?? '')
  const [fazendaId, setFazendaId] = useState(aplicacao.fazenda_id)
  // Talhões vinculados (multi). Se não houver vínculos, usa o talhão único antigo.
  const [talhoesSel, setTalhoesSel] = useState<string[]>(
    aplicacao.talhoes_vinculados && aplicacao.talhoes_vinculados.length > 0
      ? aplicacao.talhoes_vinculados.map(t => t.talhao_id)
      : aplicacao.talhao_id ? [aplicacao.talhao_id] : []
  )
  const [data,      setData]      = useState(aplicacao.data)
  const [area,      setArea]      = useState(String(aplicacao.area_aplicada_ha ?? ''))
  const [praga,     setPraga]     = useState(aplicacao.praga_alvo ?? '')
  const [clima,     setClima]     = useState(aplicacao.condicoes_climaticas ?? '')
  const [obs,       setObs]       = useState(aplicacao.observacoes ?? '')
  const [status,    setStatus]    = useState<'em_andamento' | 'encerrada'>(aplicacao.status as any)

  const [operadorId,      setOperadorId]      = useState(aplicacao.operador_id ?? '')
  const [frotaId,         setFrotaId]         = useState(aplicacao.frota_id ?? '')
  const [operacao,        setOperacao]        = useState(aplicacao.operacao ?? '')
  const [horimetroInicial, setHorimetroInicial] = useState(aplicacao.horimetro_inicial != null ? String(aplicacao.horimetro_inicial) : '')
  const [tipoAplicacao,   setTipoAplicacao]   = useState(aplicacao.tipo_aplicacao ?? '')
  const [temperatura,     setTemperatura]     = useState(aplicacao.temperatura != null ? String(aplicacao.temperatura) : '')
  const [umidade,         setUmidade]         = useState(aplicacao.umidade != null ? String(aplicacao.umidade) : '')
  const [velocidadeVento, setVelocidadeVento] = useState(aplicacao.velocidade_vento != null ? String(aplicacao.velocidade_vento) : '')
  const [horaInicio,      setHoraInicio]      = useState(aplicacao.hora_inicio ?? '')
  const [horaFim,         setHoraFim]         = useState(aplicacao.hora_fim ?? '')
  const [itens,     setItens]     = useState<Item[]>(
    aplicacao.itens.length > 0
      ? aplicacao.itens.map(it => ({
          id: it.id,
          defensivo_id:    it.defensivo_id,
          lote_id:         it.lote_id ?? '',
          quantidade_usada:  String(it.quantidade_usada),
          quantidade_sobrou: String(it.quantidade_sobrou),
          dose_por_hectare:  String(it.dose_por_hectare ?? ''),
          calda_total_l:     String(it.calda_total_l ?? ''),
        }))
      : [{ defensivo_id: '', lote_id: '', quantidade_usada: '', quantidade_sobrou: '0', dose_por_hectare: '', calda_total_l: '' }]
  )
  const [salvando,  setSalvando]  = useState(false)
  const [deletando, setDeletando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [erro,      setErro]      = useState('')

  const talhoesFazenda = talhoes.filter(t => t.fazenda_id === fazendaId)

  // Equipamento é derivado da frota selecionada (read-only). Sem frota → vazio.
  const frotaSel    = frotas.find(f => f.id === frotaId)
  const equipamento = frotaSel ? (EQUIPAMENTO_POR_CATEGORIA[frotaSel.categoria] ?? '') : ''

  function toggleTalhao(id: string) {
    setTalhoesSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleTodos() {
    setTalhoesSel(talhoesSel.length === talhoesFazenda.length ? [] : talhoesFazenda.map(t => t.id))
  }

  function atualizarItem(i: number, campo: keyof Item, valor: string) {
    setItens(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it))
  }

  function lotesDoDefensivo(defId: string) {
    return lotes.filter(l => l.defensivo_id === defId)
  }

  // Só produtos com saldo (ou já usados nesta aplicação) aparecem no seletor (interface)
  const defensivosComSaldo = defensivos.filter(d =>
    lotes.some(l => l.defensivo_id === d.id && l.quantidade_atual > 0) ||
    itens.some(it => it.defensivo_id === d.id)
  )

  async function deletar() {
    setDeletando(true)
    try {
      await supabase.from('aplicacao_itens').delete().eq('aplicacao_id', aplicacao.id)
      await supabase.from('aplicacoes').delete().eq('id', aplicacao.id)
      router.push('/aplicacoes')
      router.refresh()
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao deletar.')
      setDeletando(false)
    }
  }

  async function salvar() {
    if (!fazendaId || talhoesSel.length === 0 || !data) { setErro('Preencha fazenda, ao menos um talhão e data.'); return }
    if (itens.some(it => !it.defensivo_id || !it.quantidade_usada)) {
      setErro('Preencha defensivo e quantidade usada em todos os itens.'); return
    }
    setErro(''); setSalvando(true)
    // Texto denormalizado (nome/identificador) mantém Lista/Detalhe/exports funcionando
    const operadorSel = operadores.find(o => o.id === operadorId)
    try {
      // Atualiza a aplicação
      const { error: errAplic } = await supabase
        .from('aplicacoes')
        .update({
          fazenda_id: fazendaId, talhao_id: talhoesSel[0],
          cultura_id: culturaId || undefined,
          data, status,
          area_aplicada_ha: area ? parseFloat(area) : null,
          praga_alvo: praga || null,
          condicoes_climaticas: clima || null,
          observacoes: obs || null,
          operador_id:       operadorId || null,
          operador:          operadorSel?.nome || null,
          equipamento:       equipamento || null,
          frota_id:          frotaId || null,
          frota:             frotaSel?.identificador || null,
          operacao:          operacao || null,
          horimetro_inicial: horimetroInicial ? parseFloat(horimetroInicial) : null,
          tipo_aplicacao:    tipoAplicacao || null,
          temperatura:       temperatura ? parseFloat(temperatura) : null,
          umidade:           umidade ? parseFloat(umidade) : null,
          velocidade_vento:  velocidadeVento ? parseFloat(velocidadeVento) : null,
          hora_inicio:       horaInicio || null,
          hora_fim:          horaFim || null,
        })
        .eq('id', aplicacao.id)

      if (errAplic) throw errAplic

      // Sincroniza os talhões vinculados
      await supabase.from('aplicacao_talhoes').delete().eq('aplicacao_id', aplicacao.id)
      const vinculos = talhoesSel.map(tid => ({
        aplicacao_id: aplicacao.id,
        talhao_id:    tid,
        area_ha:      talhoesFazenda.find(t => t.id === tid)?.area_ha ?? null,
      }))
      const { error: errVinc } = await supabase.from('aplicacao_talhoes').insert(vinculos)
      if (errVinc) throw errVinc

      // Remove todos os itens antigos e re-insere
      const { error: errDel } = await supabase
        .from('aplicacao_itens')
        .delete()
        .eq('aplicacao_id', aplicacao.id)

      if (errDel) throw errDel

      const itensSalvar = itens.map(it => ({
        aplicacao_id: aplicacao.id,
        defensivo_id: it.defensivo_id,
        lote_id: it.lote_id || null,
        quantidade_usada: parseFloat(it.quantidade_usada),
        quantidade_sobrou: parseFloat(it.quantidade_sobrou) || 0,
        dose_por_hectare: it.dose_por_hectare ? parseFloat(it.dose_por_hectare) : null,
        calda_total_l: it.calda_total_l ? parseFloat(it.calda_total_l) : null,
      }))

      const { error: errItens } = await supabase.from('aplicacao_itens').insert(itensSalvar)
      if (errItens) throw errItens

      router.push('/aplicacoes')
      router.refresh()
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Editar Aplicação</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-red-500 border-red-200 hover:bg-red-50"
          onClick={() => setConfirmar(true)}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Deletar
        </Button>
      </div>

      {/* Modal de confirmação */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <p className="font-semibold">Deletar esta aplicação?</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Essa ação não pode ser desfeita. Todos os defensivos registrados nessa aplicação serão removidos.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmar(false)}>Cancelar</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={deletar}
                disabled={deletando}
              >
                {deletando ? 'Deletando...' : 'Sim, deletar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {erro && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{erro}</div>}

      {/* Dados gerais */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Dados da Aplicação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {culturas.length > 0 && (
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
          )}

          <div>
            <label className="text-sm font-medium">Fazenda *</label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={fazendaId} onChange={e => { setFazendaId(e.target.value); setTalhoesSel([]) }}
            >
              <option value="">Selecione...</option>
              {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">
                Talhões * <span className="font-normal text-muted-foreground">(todos os aplicados)</span>
              </label>
              {talhoesFazenda.length > 0 && (
                <button type="button" onClick={toggleTodos} className="text-xs text-primary hover:underline">
                  {talhoesSel.length === talhoesFazenda.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              )}
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
              <p className="mt-1 text-xs text-muted-foreground">{talhoesSel.length} talhão(ões) selecionado(s)</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Data *</label>
              <Input type="date" className="mt-1" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Área aplicada (ha)</label>
              <Input type="number" step="0.1" placeholder="0.0" className="mt-1" value={area} onChange={e => setArea(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status} onChange={e => setStatus(e.target.value as any)}
              >
                <option value="encerrada">Encerrada</option>
                <option value="em_andamento">Em Andamento</option>
              </select>
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
              </select>
            </div>
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

          <div>
            <label className="text-sm font-medium">Praga / Alvo</label>
            <Input className="mt-1" placeholder="Ex: Cigarrinha, Broca..." value={praga} onChange={e => setPraga(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Temp. (°C)</label>
              <Input type="number" step="0.1" placeholder="Ex: 28"
                className="mt-1" value={temperatura} onChange={e => setTemperatura(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Umidade (%)</label>
              <Input type="number" step="1" min="0" max="100" placeholder="Ex: 65"
                className="mt-1" value={umidade} onChange={e => setUmidade(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Vento (km/h)</label>
              <Input type="number" step="0.1" min="0" placeholder="Ex: 8"
                className="mt-1" value={velocidadeVento} onChange={e => setVelocidadeVento(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Obs. Climáticas</label>
            <Input className="mt-1" placeholder="Anotações sobre o clima..." value={clima} onChange={e => setClima(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium">Observações</label>
            <Input className="mt-1" placeholder="Observações adicionais..." value={obs} onChange={e => setObs(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Itens / Defensivos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Defensivos Utilizados</CardTitle>
            <Button size="sm" variant="outline"
              onClick={() => setItens(prev => [...prev, { defensivo_id: '', lote_id: '', quantidade_usada: '', quantidade_sobrou: '0', dose_por_hectare: '', calda_total_l: '' }])}>
              <Plus className="h-4 w-4 mr-1" />Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {itens.map((it, i) => (
            <div key={i} className="space-y-2 border rounded-md p-3 relative">
              {itens.length > 1 && (
                <button
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
                  onChange={e => atualizarItem(i, 'defensivo_id', e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {defensivosComSaldo.map(d => <option key={d.id} value={d.id}>{d.nome_comercial} ({d.unidade})</option>)}
                </select>
              </div>

              {it.defensivo_id && lotesDoDefensivo(it.defensivo_id).length > 0 && (
                <div>
                  <label className="text-xs font-medium">Lote / NF</label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={it.lote_id}
                    onChange={e => atualizarItem(i, 'lote_id', e.target.value)}
                  >
                    <option value="">Sem lote</option>
                    {lotesDoDefensivo(it.defensivo_id).map(l => (
                      <option key={l.id} value={l.id}>
                        {l.numero_nf ?? 'S/NF'} — saldo: {l.quantidade_atual}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Dose/ha</label>
                  <Input type="number" step="0.001" placeholder="0.000" className="mt-1"
                    value={it.dose_por_hectare} onChange={e => atualizarItem(i, 'dose_por_hectare', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium">Qtd Retirada *</label>
                  <Input type="number" step="0.01" placeholder="0.00" className="mt-1"
                    value={it.quantidade_usada} onChange={e => atualizarItem(i, 'quantidade_usada', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium">Qtd Sobrou</label>
                  <Input type="number" step="0.01" placeholder="0.00" className="mt-1"
                    value={it.quantidade_sobrou} onChange={e => atualizarItem(i, 'quantidade_sobrou', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium">Calda total (L)</label>
                  <Input type="number" step="1" placeholder="0" className="mt-1"
                    value={it.calda_total_l} onChange={e => atualizarItem(i, 'calda_total_l', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={salvar} disabled={salvando}>
        {salvando ? 'Salvando...' : 'Salvar Alterações'}
      </Button>
    </div>
  )
}
