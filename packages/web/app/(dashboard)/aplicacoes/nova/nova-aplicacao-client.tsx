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

export function NovaAplicacaoClient({ fazendas, talhoes, defensivos, lotes, culturas, userId }: {
  fazendas: Fazenda[]; talhoes: Talhao[]; defensivos: Defensivo[]
  lotes: Lote[]; culturas: Cultura[]; userId: string; userName: string
}) {
  const supabase = createClient()
  const router   = useRouter()

  const canaPadrao = culturas.find(c => c.nome === 'Cana')?.id ?? ''
  const [culturaId,  setCulturaId]  = useState(canaPadrao)
  const [fazendaId,  setFazendaId]  = useState('')
  const [talhoesSel, setTalhoesSel] = useState<string[]>([])
  const [data,       setData]       = useState(new Date().toISOString().split('T')[0])
  const [praga,      setPraga]      = useState('')
  const [clima,      setClima]      = useState('')
  const [obs,        setObs]        = useState('')
  const [vazao,      setVazao]      = useState('')
  const [status,     setStatus]     = useState<'em_andamento' | 'encerrada'>('encerrada')
  const [itens,      setItens]      = useState<Item[]>([{ ...ITEM_VAZIO }])
  const [salvando,   setSalvando]   = useState(false)
  const [erro,       setErro]       = useState('')

  const talhoesFazenda = talhoes.filter(t => t.fazenda_id === fazendaId)

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

    try {
      // ── 1. Cria UMA aplicação com área total ─────────────────────────
      const { data: aplic, error: errAplic } = await supabase
        .from('aplicacoes')
        .insert({
          fazenda_id:           fazendaId,
          talhao_id:            talhoesSel[0],
          cultura_id:           culturaId || canaPadrao,
          data,
          status,
          area_aplicada_ha:     areaTotal || null,
          praga_alvo:           praga || null,
          condicoes_climaticas: clima || null,
          observacoes:          obs || null,
          responsavel_id:       userId,
          vazao_l_ha:           vazao ? parseFloat(vazao) : null,
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

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Nova Aplicação</h1>
      </div>

      {erro && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{erro}</div>
      )}

      {/* ── CARD 1: Cultura + Fazenda + Talhões ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1. Cultura, Fazenda e Talhões</CardTitle>
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

      {/* ── CARD 2: Dados da Aplicação ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">2. Dados da Aplicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Data *</label>
              <Input type="date" className="mt-1" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-blue-500" />
                Vazão da calda (L/ha)
              </label>
              <Input
                type="number" step="1" min="0"
                placeholder="Ex: 100, 150, 300"
                className="mt-1"
                value={vazao} onChange={e => setVazao(e.target.value)}
              />
            </div>
          </div>

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
            <label className="text-sm font-medium">Praga / Alvo</label>
            <Input className="mt-1" placeholder="Ex: Cigarrinha, Broca, Ferrugem..."
              value={praga} onChange={e => setPraga(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium">Condições Climáticas</label>
            <Input className="mt-1" placeholder="Ex: Céu limpo, vento fraco, umidade 70%..."
              value={clima} onChange={e => setClima(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium">Observações</label>
            <Input className="mt-1" placeholder="Observações adicionais..."
              value={obs} onChange={e => setObs(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ── CARD 3: Defensivos ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">3. Defensivos Utilizados</CardTitle>
              {areaTotal > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Quantidade total = dose/ha × {formatarNumero(areaTotal, 2)} ha
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setItens(prev => [...prev, { ...ITEM_VAZIO }])}>
              <Plus className="h-4 w-4 mr-1" />Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {itens.map((it, i) => {
            const def     = defensivos.find(d => d.id === it.defensivo_id)
            const doseNum = parseFloat(it.dose_por_hectare) || 0
            const qtdTot  = doseNum * areaTotal

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
                    {defensivos.map(d => (
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
                      <option value="">— Sem lote (não desconta estoque)</option>
                      {lotesDoDefensivo(it.defensivo_id).map(l => (
                        <option key={l.id} value={l.id}>
                          NF {l.numero_nf ?? 'S/NF'} — saldo: {l.quantidade_atual} {def?.unidade}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">
                      Dose/ha ({def?.unidade ?? 'L'}/ha)
                    </label>
                    <Input type="number" step="0.001" placeholder="0.000" className="mt-1"
                      value={it.dose_por_hectare}
                      onChange={e => {
                        atualizarItem(i, 'dose_por_hectare', e.target.value)
                        // Limpa qtd manual ao alterar dose para recalcular
                        if (it.qtd_retirada === '') atualizarItem(i, 'qtd_retirada', '')
                      }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">
                      Qtd retirada ({def?.unidade ?? 'L'}) *
                    </label>
                    <Input
                      type="number" step="0.01" className="mt-1"
                      placeholder={doseNum > 0 && areaTotal > 0
                        ? `≈ ${formatarNumero(doseNum * areaTotal, 2)}`
                        : '0.00'}
                      value={it.qtd_retirada}
                      onChange={e => atualizarItem(i, 'qtd_retirada', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Sobrou ({def?.unidade ?? 'L'})</label>
                    <Input type="number" step="0.01" placeholder="0.00" className="mt-1"
                      value={it.quantidade_sobrou}
                      onChange={e => atualizarItem(i, 'quantidade_sobrou', e.target.value)} />
                  </div>
                </div>

                {/* Preview total */}
                {qtdTot > 0 && talhoesSel.length > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded px-3 py-2 text-xs text-blue-800 space-y-1">
                    <div className="font-semibold">
                      Total: {formatarNumero(qtdTot, 2)} {def?.unidade}
                      {talhoesSel.length > 1 && ` · ${talhoesSel.length} talhões · ${formatarNumero(areaTotal, 2)} ha`}
                    </div>
                    {vazao && areaTotal > 0 && (
                      <div className="text-blue-600">
                        Calda total: {formatarNumero(parseFloat(vazao) * areaTotal, 0)} L
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={salvar} disabled={salvando}>
        {salvando ? 'Salvando...' : 'Salvar Aplicação'}
      </Button>
    </div>
  )
}
