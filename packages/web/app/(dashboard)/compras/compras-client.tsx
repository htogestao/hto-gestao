'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatarData, formatarMoeda, formatarNumero, diasParaVencer, statusVencimentoBadge, cn } from '@/lib/utils'
import { Plus, Search, X, Check, ShoppingCart } from 'lucide-react'

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
  quantidade: '', preco_unitario: '', data_fabricacao: '', data_vencimento: '',
  lote_fabricante: '', observacoes: '',
}

export function ComprasClient({ lotes: inicial, defensivos, role }: {
  lotes: Lote[]; defensivos: DefSimple[]; role: string
}) {
  const isAdmin  = role === 'admin'
  const supabase = createClient()

  const [lotes, setLotes]   = useState(inicial)
  const [busca, setBusca]   = useState('')
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(FORM_DEFAULT)
  const [saving, setSaving] = useState(false)

  const filtrados = lotes.filter(l =>
    !busca ||
    (l.defensivo?.nome_comercial ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (l.numero_nf ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (l.fornecedor ?? '').toLowerCase().includes(busca.toLowerCase())
  )

  const F = (k: keyof typeof FORM_DEFAULT, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function salvar() {
    if (!form.defensivo_id || !form.quantidade) return
    setSaving(true)
    const qtd   = parseFloat(form.quantidade)
    const preco = form.preco_unitario ? parseFloat(form.preco_unitario) : null

    const { data } = await supabase.from('lotes').insert({
      defensivo_id:       form.defensivo_id,
      numero_nf:          form.numero_nf || null,
      fornecedor:         form.fornecedor || null,
      data_compra:        form.data_compra || null,
      quantidade_comprada: qtd,
      quantidade_atual:   qtd,
      preco_unitario:     preco,
      valor_total:        preco ? qtd * preco : null,
      data_fabricacao:    form.data_fabricacao || null,
      data_vencimento:    form.data_vencimento || null,
      lote_fabricante:    form.lote_fabricante || null,
      observacoes:        form.observacoes || null,
    }).select(`
      id, numero_nf, fornecedor, data_compra, quantidade_comprada, quantidade_atual,
      preco_unitario, valor_total, data_fabricacao, data_vencimento, lote_fabricante, observacoes, created_at,
      defensivo:defensivos(id, nome_comercial, unidade, empresa)
    `).single()

    if (data) {
      // Registra movimentação de entrada
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
        {isAdmin && (
          <Button onClick={() => setModal(true)}>
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
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">
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
              <h2 className="font-bold text-lg">Nova Entrada de Estoque</h2>
              <button onClick={() => setModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Defensivo *</label>
                <Select value={form.defensivo_id} onValueChange={v => F('defensivo_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                  <SelectContent>
                    {defensivos.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.nome_comercial} ({d.unidade})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantidade *</label>
                  <Input type="number" step="0.1" value={form.quantidade}
                    onChange={e => F('quantidade', e.target.value)} placeholder="0" />
                </div>
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
              <Button variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={saving || !form.defensivo_id || !form.quantidade}>
                {saving ? 'Salvando...' : <><Check className="h-4 w-4 mr-1" />Registrar Entrada</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
