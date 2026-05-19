'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { CLASSE_LABELS, LOCAL_LABELS } from '@agro/shared'
import type { ClasseDefensivo, LocalArmazenamento } from '@agro/shared'
import { Plus, Search, FlaskConical, Pencil, Trash2, X, Check } from 'lucide-react'

interface Defensivo {
  id: string; nome_comercial: string; principio_ativo: string; classe: string
  unidade: string; estoque_minimo: number; empresa: string | null
  local_armazenamento: string | null; fornecedor_padrao: string | null; observacoes: string | null
}

const CLASSE_COR: Record<string, string> = {
  herbicida: 'bg-yellow-100 text-yellow-800', fungicida: 'bg-purple-100 text-purple-800',
  inseticida: 'bg-orange-100 text-orange-800', adjuvante: 'bg-blue-100 text-blue-800',
  fertilizante: 'bg-green-100 text-green-800', fertilizante_foliar: 'bg-teal-100 text-teal-800',
  nematicida: 'bg-pink-100 text-pink-800', adubo_foliar: 'bg-lime-100 text-lime-800',
}

const FORM_DEFAULT = {
  nome_comercial: '', principio_ativo: '', classe: 'herbicida' as ClasseDefensivo,
  unidade: 'L' as 'L'|'kg', estoque_minimo: 0, empresa: '',
  local_armazenamento: '' as LocalArmazenamento | '',
  fornecedor_padrao: '', observacoes: '',
}

export function DefensivosClient({ defensivos: inicial, role }: { defensivos: Defensivo[]; role: string }) {
  const isAdmin  = role === 'admin'
  const supabase = createClient()
  const router   = useRouter()

  const [defensivos, setDefensivos] = useState(inicial)
  const [busca, setBusca]           = useState('')
  const [filtroClasse, setFiltro]   = useState('todos')
  const [modal, setModal]           = useState<'novo' | 'editar' | null>(null)
  const [form, setForm]             = useState(FORM_DEFAULT)
  const [editId, setEditId]         = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const classes = ['todos', ...Object.keys(CLASSE_LABELS)]
  const filtrados = defensivos.filter(d => {
    const mb = !busca || d.nome_comercial.toLowerCase().includes(busca.toLowerCase()) ||
      d.principio_ativo.toLowerCase().includes(busca.toLowerCase())
    const mc = filtroClasse === 'todos' || d.classe === filtroClasse
    return mb && mc
  })

  function abrirNovo() { setForm(FORM_DEFAULT); setEditId(null); setModal('novo') }
  function abrirEditar(d: Defensivo) {
    setForm({
      nome_comercial: d.nome_comercial, principio_ativo: d.principio_ativo,
      classe: d.classe as ClasseDefensivo, unidade: d.unidade as 'L'|'kg',
      estoque_minimo: d.estoque_minimo, empresa: d.empresa ?? '',
      local_armazenamento: (d.local_armazenamento ?? '') as LocalArmazenamento | '',
      fornecedor_padrao: d.fornecedor_padrao ?? '', observacoes: d.observacoes ?? '',
    })
    setEditId(d.id); setModal('editar')
  }

  async function salvar() {
    setSaving(true)
    const payload = {
      ...form,
      empresa: form.empresa || null,
      local_armazenamento: form.local_armazenamento || null,
      fornecedor_padrao: form.fornecedor_padrao || null,
      observacoes: form.observacoes || null,
    }
    if (modal === 'novo') {
      const { data } = await supabase.from('defensivos').insert(payload).select().single()
      if (data) setDefensivos(prev => [...prev, data].sort((a,b) => a.nome_comercial.localeCompare(b.nome_comercial)))
    } else {
      await supabase.from('defensivos').update(payload).eq('id', editId!)
      setDefensivos(prev => prev.map(d => d.id === editId ? { ...d, ...payload } : d))
    }
    setSaving(false); setModal(null)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este defensivo? Lotes e movimentações vinculados serão preservados.')) return
    setDeletingId(id)
    await supabase.from('defensivos').delete().eq('id', id)
    setDefensivos(prev => prev.filter(d => d.id !== id))
    setDeletingId(null)
  }

  const F = (key: keyof typeof FORM_DEFAULT, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Defensivos</h1>
          <p className="text-sm text-muted-foreground">{defensivos.length} produtos cadastrados</p>
        </div>
        {isAdmin && (
          <Button onClick={abrirNovo}><Plus className="h-4 w-4 mr-1" />Novo Defensivo</Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto ou princípio ativo..." className="pl-8"
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filtroClasse} onChange={e => setFiltro(e.target.value)}>
          {classes.map(c => (
            <option key={c} value={c}>{c === 'todos' ? 'Todas as classes' : CLASSE_LABELS[c as ClasseDefensivo] ?? c}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium">Produto</th>
                  <th className="text-left p-3 font-medium">Princípio Ativo</th>
                  <th className="text-left p-3 font-medium">Classe</th>
                  <th className="text-left p-3 font-medium">Empresa</th>
                  <th className="text-left p-3 font-medium">Local</th>
                  <th className="text-center p-3 font-medium">Unid.</th>
                  <th className="text-right p-3 font-medium">Estoque Mín.</th>
                  {isAdmin && <th className="text-center p-3 font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(d => (
                  <tr key={d.id} className="border-b hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-medium">{d.nome_comercial}</td>
                    <td className="p-3 text-muted-foreground text-xs max-w-48 truncate">{d.principio_ativo}</td>
                    <td className="p-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                        CLASSE_COR[d.classe] ?? 'bg-gray-100 text-gray-700')}>
                        {CLASSE_LABELS[d.classe as ClasseDefensivo] ?? d.classe}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{d.empresa ?? '—'}</td>
                    <td className="p-3 text-muted-foreground capitalize text-xs">
                      {d.local_armazenamento ? LOCAL_LABELS[d.local_armazenamento as LocalArmazenamento] : '—'}
                    </td>
                    <td className="p-3 text-center font-mono">{d.unidade}</td>
                    <td className="p-3 text-right font-mono">{d.estoque_minimo} {d.unidade}</td>
                    {isAdmin && (
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => abrirEditar(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm"
                            disabled={deletingId === d.id}
                            onClick={() => excluir(d.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <FlaskConical className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    Nenhum defensivo encontrado
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal novo/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">{modal === 'novo' ? 'Novo Defensivo' : 'Editar Defensivo'}</h2>
              <button onClick={() => setModal(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome Comercial *</label>
                  <Input value={form.nome_comercial} onChange={e => F('nome_comercial', e.target.value)} placeholder="Ex: APROACH POWER" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Princípio Ativo *</label>
                  <Input value={form.principio_ativo} onChange={e => F('principio_ativo', e.target.value)} placeholder="Ex: PICOXISTROBINA, CIPROCONAZOLE" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Classe *</label>
                  <Select value={form.classe} onValueChange={v => F('classe', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CLASSE_LABELS).map(([k,v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Unidade *</label>
                  <Select value={form.unidade} onValueChange={v => F('unidade', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Litros (L)</SelectItem>
                      <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Empresa / Fabricante</label>
                  <Input value={form.empresa} onChange={e => F('empresa', e.target.value)} placeholder="Ex: SYNGENTA" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Local de Armazenamento</label>
                  <Select value={form.local_armazenamento || ''} onValueChange={v => F('local_armazenamento', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {Object.entries(LOCAL_LABELS).map(([k,v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Estoque Mínimo</label>
                  <Input type="number" step="0.1" value={form.estoque_minimo}
                    onChange={e => F('estoque_minimo', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Fornecedor Padrão</label>
                  <Input value={form.fornecedor_padrao} onChange={e => F('fornecedor_padrao', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
                  <Input value={form.observacoes} onChange={e => F('observacoes', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end p-5 border-t">
              <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
              <Button onClick={salvar} disabled={saving || !form.nome_comercial || !form.principio_ativo}>
                {saving ? 'Salvando...' : <><Check className="h-4 w-4 mr-1" />Salvar</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
