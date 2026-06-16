'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatarData, formatarMoeda, formatarNumero, diasParaVencer, statusVencimentoBadge, cn } from '@/lib/utils'
import { CLASSE_LABELS } from '@agro/shared'
import { Plus, Search, X, Check, ShoppingCart, PackagePlus, Pencil } from 'lucide-react'

interface Lote {
  id: string; numero_nf: string | null; fornecedor: string | null
  data_compra: string | null; quantidade_comprada: number; quantidade_atual: number
  preco_unitario: number | null; valor_total: number | null
  data_fabricacao: string | null; data_vencimento: string | null
  lote_fabricante: string | null; observacoes: string | null; created_at: string
  defensivo: { id: string; nome_comercial: string; unidade: string; empresa: string | null } | null
}

interface DefSimple { id: string; nome_comercial: string; unidade: string }

const FORM_DEFAULT = {
  defensivo_id: '', numero_nf: '', fornecedor: '', data_compra: new Date().toISOString().split('T')[0],
  quantidade: '', saldo: '', preco_unitario: '', data_fabricacao: '', data_vencimento: '',
  lote_fabricante: '', observacoes: '',
}

const NOVO_PROD_DEFAULT = {
  nome_comercial: '', principio_ativo: '', classe: 'herbicida', unidade: 'L', empresa: '',
}

export function ComprasClient({ lotes: inicial, defensivos: defsIniciais, role }: {
  lotes: Lote[]; defensivos: DefSimple[]; role: string
}) {
  const canEdit  = role === 'admin' || role === 'viewer'
  const isAdmin  = role === 'admin'
  const supabase = createClient()

  const [lotes, setLotes]   = useState(inicial)
  const [defensivos, setDefensivos] = useState(defsIniciais)
  const [busca, setBusca]   = useState('')
  const [modal, setModal]   = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm]     = useState(FORM_DEFAULT)
  const [saving, setSaving] = useState(false)
  const [erro,  setErro]    = useState('')

  // Cadastro inline de produto novo
  const [novoProd,    setNovoProd]   = useState(false)
  const [npForm,      setNpForm]     = useState(NOVO_PROD_DEFAULT)
  const [criandoProd, setCriandoProd] = useState(false)
  const NP = (k: keyof typeof NOVO_PROD_DEFAULT, v: string) => setNpForm(p => ({ ...p, [k]: v }))

  async function criarDefensivo() {
    if (!npForm.nome_comercial.trim() || !npForm.principio_ativo.trim()) {
      setErro('Preencha nome e princípio ativo do novo produto.'); return
    }
    setErro(''); setCriandoProd(true)
    const { data, error } = await supabase.from('defensivos').insert({
      nome_comercial:  npForm.nome_comercial.trim(),
      principio_ativo: npForm.principio_ativo.trim(),
      classe:          npForm.classe,
      unidade:         npForm.unidade,
      empresa:         npForm.empresa.trim() || null,
      estoque_minimo:  0,
    }).select('id, nome_comercial, unidade').single()

    if (error) {
      setErro('Erro ao cadastrar produto: ' + error.message)
      setCriandoProd(false); return
    }
    // Adiciona à lista, seleciona e fecha o mini-form
    setDefensivos(prev => [...prev, data as DefSimple].sort((a,b) => a.nome_comercial.localeCompare(b.nome_comercial)))
    setForm(p => ({ ...p, defensivo_id: data!.id }))
    setNpForm(NOVO_PROD_DEFAULT)
    setNovoProd(false)
    setCriandoProd(false)
  }

  const filtrados = lotes.filter(l =>
    !busca ||
    (l.defensivo?.nome_comercial ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (l.numero_nf ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (l.fornecedor ?? '').toLowerCase().includes(busca.toLowerCase())
  )

  const F = (k: keyof typeof FORM_DEFAULT, v: string) => setForm(p => ({ ...p, [k]: v }))

  function abrirNova() {
    setEditId(null); setErro(''); setNovoProd(false); setNpForm(NOVO_PROD_DEFAULT)
    setForm(FORM_DEFAULT); setModal(true)
  }

  function abrirEditar(l: Lote) {
    setEditId(l.id); setErro(''); setNovoProd(false)
    setForm({
      defensivo_id:    l.defensivo?.id ?? '',
      numero_nf:       l.numero_nf ?? '',
      fornecedor:      l.fornecedor ?? '',
      data_compra:     l.data_compra ?? '',
      quantidade:      String(l.quantidade_comprada ?? ''),
      saldo:           String(l.quantidade_atual ?? ''),
      preco_unitario:  l.preco_unitario != null ? String(l.preco_unitario) : '',
      data_fabricacao: l.data_fabricacao ?? '',
      data_vencimento: l.data_vencimento ?? '',
      lote_fabricante: l.lote_fabricante ?? '',
      observacoes:     l.observacoes ?? '',
    })
    setModal(true)
  }

  const SELECT_LOTE = `
    id, numero_nf, fornecedor, data_compra, quantidade_comprada, quantidade_atual,
    preco_unitario, valor_total, data_fabricacao, data_vencimento, lote_fabricante, observacoes, created_at,
    defensivo:defensivos(id, nome_comercial, unidade, empresa)
  `

  async function salvar() {
    if (!form.defensivo_id || !form.quantidade) return
    setErro(''); setSaving(true)
    const qtd   = parseFloat(form.quantidade)
    const preco = form.preco_unitario ? parseFloat(form.preco_unitario) : null

    if (editId) {
      // EDIÇÃO de lote existente
      const saldo = form.saldo !== '' ? parseFloat(form.saldo) : qtd
      const { data, error } = await supabase.from('lotes').update({
        defensivo_id:        form.defensivo_id,
        numero_nf:           form.numero_nf || null,
        fornecedor:          form.fornecedor || null,
        data_compra:         form.data_compra || null,
        quantidade_comprada: qtd,
        quantidade_atual:    saldo,
        preco_unitario:      preco,
        valor_total:         preco ? qtd * preco : null,
        data_fabricacao:     form.data_fabricacao || null,
        data_vencimento:     form.data_vencimento || null,
        lote_fabricante:     form.lote_fabricante || null,
        observacoes:         form.observacoes || null,
      }).eq('id', editId).select(SELECT_LOTE).single()

      if (error) { setErro('Erro ao salvar alterações: ' + error.message); setSaving(false); return }
      if (data) setLotes(prev => prev.map(l => l.id === editId ? (data as Lote) : l))
      setSaving(false); setModal(false); setEditId(null); setForm(FORM_DEFAULT)
      return
    }

    // NOVA entrada
    const { data, error } = await supabase.from('lotes').insert({
      defensivo_id:        form.defensivo_id,
      numero_nf:           form.numero_nf || null,
      fornecedor:          form.fornecedor || null,
      data_compra:         form.data_compra || null,
      quantidade_comprada: qtd,
      quantidade_atual:    qtd,
      preco_unitario:      preco,
      valor_total:         preco ? qtd * preco : null,
      data_fabricacao:     form.data_fabricacao || null,
      data_vencimento:     form.data_vencimento || null,
      lote_fabricante:     form.lote_fabricante || null,
      observacoes:         form.observacoes || null,
    }).select(SELECT_LOTE).single()

    if (error) {
      setErro('Erro ao registrar entrada: ' + error.message)
      setSaving(false); return
    }
    if (data) {
      await supabase.from('movimentacoes').insert({
        defensivo_id: form.defensivo_id, lote_id: data.id,
        tipo: 'entrada', quantidade: qtd, observacoes: `Entrada NF ${form.numero_nf || 'S/NF'}`,
      })
      setLotes(prev => [data as Lote, ...prev])
    }
    setSaving(false); setModal(false); setForm(FORM_DEFAULT)
  }

  const totalValor = lotes.reduce((acc, l) => acc + (l.valor_total ?? 0), 0)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compras & Entradas</h1>
          <p className="text-sm text-muted-foreground">
            {lotes.length} lotes · Total investido: {formatarMoeda(totalValor)}
          </p>
        </div>
        {canEdit && (
          <Button onClick={abrirNova}>
            <Plus className="h-4 w-4 mr-1" />Nova Entrada
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar produto, NF, fornecedor..." className="pl-8"
          value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium">Produto</th>
                  <th className="text-left p-3 font-medium">NF</th>
                  <th className="text-left p-3 font-medium">Fornecedor</th>
                  <th className="text-right p-3 font-medium">Qtd</th>
                  <th className="text-right p-3 font-medium">Saldo</th>
                  <th className="text-right p-3 font-medium">Preço Unit.</th>
                  <th className="text-right p-3 font-medium">Valor Total</th>
                  <th className="text-center p-3 font-medium">Vencimento</th>
                  <th className="text-left p-3 font-medium">Data Compra</th>
                  {canEdit && <th className="text-center p-3 font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(l => {
                  const dias = diasParaVencer(l.data_vencimento)
                  return (
                    <tr key={l.id} className="border-b hover:bg-muted/10 transition-colors">
                      <td className="p-3">
                        <p className="font-medium">{l.defensivo?.nome_comercial ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{l.defensivo?.empresa ?? ''}</p>
                      </td>
                      <td className="p-3 font-mono text-sm">{l.numero_nf ?? <span className="text-muted-foreground">S/NF</span>}</td>
                      <td className="p-3 text-muted-foreground">{l.fornecedor ?? '—'}</td>
                      <td className="p-3 text-right font-mono">
                        {formatarNumero(l.quantidade_comprada, 1)} {l.defensivo?.unidade}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className={l.quantidade_atual <= 0 ? 'text-muted-foreground line-through' : ''}>
                          {formatarNumero(l.quantidade_atual, 1)} {l.defensivo?.unidade}
                        </span>
                      </td>
                      <td className="p-3 text-right">{formatarMoeda(l.preco_unitario)}</td>
                      <td className="p-3 text-right font-semibold">{formatarMoeda(l.valor_total)}</td>
                      <td className="p-3 text-center">
                        {l.data_vencimento ? (
                          <span className={cn('text-xs px-2 py-0.5 rounded-full', statusVencimentoBadge(dias))}>
                            {dias !== null && dias < 0 ? `Vencido` : formatarData(l.data_vencimento)}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="p-3 text-muted-foreground">{formatarData(l.data_compra)}</td>
                      {canEdit && (
                        <td className="p-3 text-center">
                          <Button variant="ghost" size="sm" onClick={() => abrirEditar(l)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={canEdit ? 10 : 9} className="p-8 text-center text-muted-foreground">
                    <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    Nenhuma compra encontrada
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Nova Entrada */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">{editId ? 'Editar Entrada' : 'Nova Entrada de Estoque'}</h2>
              <button onClick={() => { setModal(false); setEditId(null) }}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              {erro && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{erro}</div>}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground block">Defensivo *</label>
                  {!editId && (
                    <button
                      type="button"
                      onClick={() => { setNovoProd(v => !v); setErro('') }}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <PackagePlus className="h-3.5 w-3.5" />
                      {novoProd ? 'Cancelar novo produto' : 'Cadastrar produto novo'}
                    </button>
                  )}
                </div>

                {!novoProd ? (
                  <Select value={form.defensivo_id} onValueChange={v => F('defensivo_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                    <SelectContent>
                      {defensivos.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.nome_comercial} ({d.unidade})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <p className="text-xs font-medium text-primary">Cadastrar novo defensivo</p>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Nome comercial *</label>
                      <Input value={npForm.nome_comercial} onChange={e => NP('nome_comercial', e.target.value)} placeholder="Ex: ROUNDUP WG" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Princípio ativo *</label>
                      <Input value={npForm.principio_ativo} onChange={e => NP('principio_ativo', e.target.value)} placeholder="Ex: GLIFOSATO" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Classe *</label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={npForm.classe} onChange={e => NP('classe', e.target.value)}
                        >
                          {Object.entries(CLASSE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Unidade *</label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={npForm.unidade} onChange={e => NP('unidade', e.target.value)}
                        >
                          <option value="L">Litros (L)</option>
                          <option value="kg">Quilos (kg)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Fabricante / Empresa</label>
                      <Input value={npForm.empresa} onChange={e => NP('empresa', e.target.value)} placeholder="Ex: SYNGENTA" />
                    </div>
                    <Button size="sm" className="w-full" onClick={criarDefensivo} disabled={criandoProd}>
                      {criandoProd ? 'Cadastrando...' : <><Check className="h-4 w-4 mr-1" />Cadastrar e selecionar</>}
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Número da NF</label>
                  <Input value={form.numero_nf} onChange={e => F('numero_nf', e.target.value)} placeholder="Ex: 004521" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Fornecedor</label>
                  <Input value={form.fornecedor} onChange={e => F('fornecedor', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {editId ? 'Qtd Comprada *' : 'Quantidade *'}
                  </label>
                  <Input type="number" step="0.1" value={form.quantidade}
                    onChange={e => F('quantidade', e.target.value)} placeholder="0" />
                </div>
                {editId && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Saldo atual</label>
                    <Input type="number" step="0.1" value={form.saldo}
                      onChange={e => F('saldo', e.target.value)} placeholder="0" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Preço Unitário (R$)</label>
                  <Input type="number" step="0.01" value={form.preco_unitario}
                    onChange={e => F('preco_unitario', e.target.value)} placeholder="0,00" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data da Compra</label>
                  <Input type="date" value={form.data_compra} onChange={e => F('data_compra', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Lote do Fabricante</label>
                  <Input value={form.lote_fabricante} onChange={e => F('lote_fabricante', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de Fabricação</label>
                  <Input type="date" value={form.data_fabricacao} onChange={e => F('data_fabricacao', e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de Vencimento</label>
                  <Input type="date" value={form.data_vencimento} onChange={e => F('data_vencimento', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
                <Input value={form.observacoes} onChange={e => F('observacoes', e.target.value)} />
              </div>
              {form.quantidade && form.preco_unitario && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                  <span className="font-medium">Valor total: </span>
                  <span className="text-primary font-bold">
                    {formatarMoeda(parseFloat(form.quantidade) * parseFloat(form.preco_unitario))}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end p-5 border-t">
              <Button variant="outline" onClick={() => { setModal(false); setEditId(null) }}>Cancelar</Button>
              <Button onClick={salvar} disabled={saving || !form.defensivo_id || !form.quantidade}>
                {saving ? 'Salvando...' : <><Check className="h-4 w-4 mr-1" />{editId ? 'Salvar Alterações' : 'Registrar Entrada'}</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
