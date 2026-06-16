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
  registro_mapa: string | null; formulacao: string | null
  classe_toxicologica: string | null; classe_ambiental: string | null
  modo_acao: string | null; grupo_quimico: string | null
  carencia_dias: number | null; reentrada_horas: number | null
  culturas_autorizadas: string | null; dose_min_ha: number | null
  dose_max_ha: number | null; epi_obrigatorio: string | null; restricoes: string | null
}

const CLASSE_COR: Record<string, string> = {
  herbicida: 'bg-yellow-100 text-yellow-800', fungicida: 'bg-purple-100 text-purple-800',
  inseticida: 'bg-orange-100 text-orange-800', adjuvante: 'bg-blue-100 text-blue-800',
  fertilizante: 'bg-green-100 text-green-800', fertilizante_foliar: 'bg-teal-100 text-teal-800',
  nematicida: 'bg-pink-100 text-pink-800', adubo_foliar: 'bg-lime-100 text-lime-800',
}

const FORMULACOES = ['SC','EC','WG','OD','SL','WP','CS','EW','FS','GR','ME','SE','SP','TB','UL','Outro']
const MODOS_ACAO  = ['Sistêmico','Contato','Translaminar','Mesostêmico','Fumigante','Ingestão','Outro']
const TOX_LABELS: Record<string, string> = {
  'I':'I — Extremamente Tóxico','II':'II — Altamente Tóxico',
  'III':'III — Moderadamente Tóxico','IV':'IV — Pouco Tóxico',
}
const AMB_LABELS: Record<string, string> = {
  'I':'I — Altamente Perigoso','II':'II — Muito Perigoso',
  'III':'III — Perigoso','IV':'IV — Pouco Perigoso',
}

const FORM_DEFAULT = {
  nome_comercial: '', principio_ativo: '', classe: 'herbicida' as ClasseDefensivo,
  unidade: 'L' as 'L'|'kg', estoque_minimo: 0, empresa: '',
  local_armazenamento: '' as LocalArmazenamento | '',
  fornecedor_padrao: '', observacoes: '',
  registro_mapa: '', formulacao: '', classe_toxicologica: '', classe_ambiental: '',
  modo_acao: '', grupo_quimico: '', carencia_dias: '', reentrada_horas: '',
  culturas_autorizadas: '', dose_min_ha: '', dose_max_ha: '',
  epi_obrigatorio: '', restricoes: '',
}

type AbaForm = 'identificacao' | 'classificacao' | 'uso' | 'estoque'

export function DefensivosClient({ defensivos: inicial, role }: { defensivos: Defensivo[]; role: string }) {
  const isAdmin  = role === 'admin' || role === 'viewer'
  const supabase = createClient()
  const router   = useRouter()

  const [defensivos, setDefensivos] = useState(inicial)
  const [busca, setBusca]           = useState('')
  const [filtroClasse, setFiltro]   = useState('todos')
  const [modal, setModal]           = useState<'novo' | 'editar' | null>(null)
  const [form, setForm]             = useState(FORM_DEFAULT)
  const [abaForm, setAbaForm]       = useState<AbaForm>('identificacao')
  const [editId, setEditId]         = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [erro, setErro]             = useState<string | null>(null)

  const classes = ['todos', ...Object.keys(CLASSE_LABELS)]
  const filtrados = defensivos.filter(d => {
    const mb = !busca || d.nome_comercial.toLowerCase().includes(busca.toLowerCase()) ||
      d.principio_ativo.toLowerCase().includes(busca.toLowerCase())
    const mc = filtroClasse === 'todos' || d.classe === filtroClasse
    return mb && mc
  })

  function abrirNovo() {
    setForm(FORM_DEFAULT); setEditId(null); setAbaForm('identificacao'); setModal('novo')
  }
  function abrirEditar(d: Defensivo) {
    setForm({
      nome_comercial: d.nome_comercial, principio_ativo: d.principio_ativo,
      classe: d.classe as ClasseDefensivo, unidade: d.unidade as 'L'|'kg',
      estoque_minimo: d.estoque_minimo, empresa: d.empresa ?? '',
      local_armazenamento: (d.local_armazenamento ?? '') as LocalArmazenamento | '',
      fornecedor_padrao: d.fornecedor_padrao ?? '', observacoes: d.observacoes ?? '',
      registro_mapa: d.registro_mapa ?? '', formulacao: d.formulacao ?? '',
      classe_toxicologica: d.classe_toxicologica ?? '', classe_ambiental: d.classe_ambiental ?? '',
      modo_acao: d.modo_acao ?? '', grupo_quimico: d.grupo_quimico ?? '',
      carencia_dias: d.carencia_dias != null ? String(d.carencia_dias) : '',
      reentrada_horas: d.reentrada_horas != null ? String(d.reentrada_horas) : '',
      culturas_autorizadas: d.culturas_autorizadas ?? '',
      dose_min_ha: d.dose_min_ha != null ? String(d.dose_min_ha) : '',
      dose_max_ha: d.dose_max_ha != null ? String(d.dose_max_ha) : '',
      epi_obrigatorio: d.epi_obrigatorio ?? '', restricoes: d.restricoes ?? '',
    })
    setEditId(d.id); setAbaForm('identificacao'); setModal('editar')
  }

  async function salvar() {
    setSaving(true)
    const payload = {
      nome_comercial: form.nome_comercial,
      principio_ativo: form.principio_ativo,
      classe: form.classe,
      unidade: form.unidade,
      estoque_minimo: form.estoque_minimo,
      empresa: form.empresa || null,
      local_armazenamento: form.local_armazenamento || null,
      fornecedor_padrao: form.fornecedor_padrao || null,
      observacoes: form.observacoes || null,
      registro_mapa: form.registro_mapa || null,
      formulacao: form.formulacao || null,
      classe_toxicologica: form.classe_toxicologica || null,
      classe_ambiental: form.classe_ambiental || null,
      modo_acao: form.modo_acao || null,
      grupo_quimico: form.grupo_quimico || null,
      carencia_dias: form.carencia_dias ? parseInt(form.carencia_dias as string) : null,
      reentrada_horas: form.reentrada_horas ? parseInt(form.reentrada_horas as string) : null,
      culturas_autorizadas: form.culturas_autorizadas || null,
      dose_min_ha: form.dose_min_ha ? parseFloat(form.dose_min_ha as string) : null,
      dose_max_ha: form.dose_max_ha ? parseFloat(form.dose_max_ha as string) : null,
      epi_obrigatorio: form.epi_obrigatorio || null,
      restricoes: form.restricoes || null,
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

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir o produto "${nome}"?`)) return
    setErro(null); setDeletingId(id)

    // Tenta excluir direto (funciona se não houver nada vinculado)
    const { error } = await supabase.from('defensivos').delete().eq('id', id)

    if (!error) {
      setDefensivos(prev => prev.filter(d => d.id !== id))
      setDeletingId(null)
      return
    }

    // FK: produto tem vínculos. Verifica se foi usado em aplicações.
    const { count: usosAplic } = await supabase
      .from('aplicacao_itens').select('id', { count: 'exact', head: true }).eq('defensivo_id', id)

    if (usosAplic && usosAplic > 0) {
      setErro(`"${nome}" já foi usado em aplicações, então não pode ser excluído (apagaria histórico). Para corrigir o nome, use o botão de editar (lápis).`)
      setDeletingId(null)
      return
    }

    // Sem uso em aplicações: oferece limpar as entradas de estoque vinculadas
    const ok = confirm(
      `"${nome}" tem entradas de estoque vinculadas. Excluir o produto E todas as entradas dele? (não afeta aplicações)`
    )
    if (!ok) { setDeletingId(null); return }

    await supabase.from('movimentacoes').delete().eq('defensivo_id', id)
    await supabase.from('lotes').delete().eq('defensivo_id', id)
    const { error: err2 } = await supabase.from('defensivos').delete().eq('id', id)

    if (err2) {
      setErro(`Não foi possível excluir "${nome}": ${err2.message}. Você pode corrigir o nome pelo botão de editar.`)
      setDeletingId(null)
      return
    }
    setDefensivos(prev => prev.filter(d => d.id !== id))
    setDeletingId(null)
  }

  const F = (key: keyof typeof FORM_DEFAULT, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const abas: { key: AbaForm; label: string }[] = [
    { key: 'identificacao', label: '1. Identificação' },
    { key: 'classificacao', label: '2. Classificação' },
    { key: 'uso',           label: '3. Uso / Bula' },
    { key: 'estoque',       label: '4. Estoque' },
  ]

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

      {erro && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 flex items-start justify-between gap-3">
          <span>{erro}</span>
          <button onClick={() => setErro(null)} className="text-red-400 hover:text-red-600 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                  <th className="text-center p-3 font-medium">Carência</th>
                  <th className="text-center p-3 font-medium">Reentrada</th>
                  <th className="text-center p-3 font-medium">Tox.</th>
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
                    <td className="p-3 text-center text-sm">
                      {d.carencia_dias != null
                        ? <span className="font-medium">{d.carencia_dias}d</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-center text-sm">
                      {d.reentrada_horas != null
                        ? <span className="font-medium">{d.reentrada_horas}h</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-center">
                      {d.classe_toxicologica
                        ? <span className={cn('px-1.5 py-0.5 rounded text-xs font-bold',
                            d.classe_toxicologica === 'I' ? 'bg-red-100 text-red-700' :
                            d.classe_toxicologica === 'II' ? 'bg-orange-100 text-orange-700' :
                            d.classe_toxicologica === 'III' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          )}>Cl.{d.classe_toxicologica}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    {isAdmin && (
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => abrirEditar(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm"
                            disabled={deletingId === d.id}
                            onClick={() => excluir(d.id, d.nome_comercial)}
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">{modal === 'novo' ? 'Novo Defensivo' : 'Editar Defensivo'}</h2>
              <button onClick={() => setModal(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>

            {/* Abas */}
            <div className="flex border-b overflow-x-auto">
              {abas.map(a => (
                <button
                  key={a.key}
                  onClick={() => setAbaForm(a.key)}
                  className={cn(
                    'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                    abaForm === a.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-3">

              {/* ABA 1 — Identificação */}
              {abaForm === 'identificacao' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome Comercial *</label>
                    <Input value={form.nome_comercial} onChange={e => F('nome_comercial', e.target.value)} placeholder="Ex: ENGEO PLENO S" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Ingrediente Ativo / Princípio Ativo *</label>
                    <Input value={form.principio_ativo} onChange={e => F('principio_ativo', e.target.value)} placeholder="Ex: TIAMETOXAM + LAMBDA-CIALOTRINA" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Fabricante / Empresa</label>
                      <Input value={form.empresa} onChange={e => F('empresa', e.target.value)} placeholder="Ex: SYNGENTA" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Registro MAPA</label>
                      <Input value={form.registro_mapa} onChange={e => F('registro_mapa', e.target.value)} placeholder="Ex: 00321010" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Grupo Químico</label>
                    <Input value={form.grupo_quimico} onChange={e => F('grupo_quimico', e.target.value)} placeholder="Ex: Neonicotinoide + Piretroide" />
                  </div>
                </div>
              )}

              {/* ABA 2 — Classificação */}
              {abaForm === 'classificacao' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
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
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Formulação</label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={form.formulacao} onChange={e => F('formulacao', e.target.value)}>
                        <option value="">Selecione...</option>
                        {FORMULACOES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Classe Toxicológica</label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={form.classe_toxicologica} onChange={e => F('classe_toxicologica', e.target.value)}>
                        <option value="">Selecione...</option>
                        {Object.entries(TOX_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Classe Ambiental</label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={form.classe_ambiental} onChange={e => F('classe_ambiental', e.target.value)}>
                        <option value="">Selecione...</option>
                        {Object.entries(AMB_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Modo de Ação</label>
                    <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={form.modo_acao} onChange={e => F('modo_acao', e.target.value)}>
                      <option value="">Selecione...</option>
                      {MODOS_ACAO.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* ABA 3 — Uso / Bula */}
              {abaForm === 'uso' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">⏳ Carência (dias)</label>
                      <Input type="number" min="0" value={form.carencia_dias}
                        onChange={e => F('carencia_dias', e.target.value)}
                        placeholder="Ex: 14" />
                      <p className="text-xs text-muted-foreground mt-1">Dias entre aplicação e colheita</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">🚫 Reentrada (horas)</label>
                      <Input type="number" min="0" value={form.reentrada_horas}
                        onChange={e => F('reentrada_horas', e.target.value)}
                        placeholder="Ex: 24" />
                      <p className="text-xs text-muted-foreground mt-1">Horas até reentrar no talhão</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Dose Mínima/ha</label>
                      <Input type="number" step="0.01" value={form.dose_min_ha}
                        onChange={e => F('dose_min_ha', e.target.value)} placeholder="Ex: 0.3" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Dose Máxima/ha</label>
                      <Input type="number" step="0.01" value={form.dose_max_ha}
                        onChange={e => F('dose_max_ha', e.target.value)} placeholder="Ex: 0.5" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Culturas Autorizadas</label>
                    <Input value={form.culturas_autorizadas}
                      onChange={e => F('culturas_autorizadas', e.target.value)}
                      placeholder="Ex: Cana-de-açúcar, Soja, Milho" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">EPI Obrigatório</label>
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-20 resize-none"
                      value={form.epi_obrigatorio}
                      onChange={e => F('epi_obrigatorio', e.target.value)}
                      placeholder="Ex: Macacão, luvas nitrílicas, óculos, máscara PFF2, botas impermeáveis"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Restrições</label>
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-16 resize-none"
                      value={form.restricoes}
                      onChange={e => F('restricoes', e.target.value)}
                      placeholder="Ex: Não aplicar com vento acima de 10 km/h, não misturar com..."
                    />
                  </div>
                </div>
              )}

              {/* ABA 4 — Estoque */}
              {abaForm === 'estoque' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
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
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Estoque Mínimo</label>
                      <Input type="number" step="0.1" value={form.estoque_minimo}
                        onChange={e => F('estoque_minimo', parseFloat(e.target.value) || 0)} />
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
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Fornecedor Padrão</label>
                      <Input value={form.fornecedor_padrao} onChange={e => F('fornecedor_padrao', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-16 resize-none"
                      value={form.observacoes}
                      onChange={e => F('observacoes', e.target.value)}
                      placeholder="Observações gerais sobre o produto..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Botões navegação + salvar */}
            <div className="flex items-center justify-between p-5 border-t gap-2">
              <div className="flex gap-2">
                {abaForm !== 'identificacao' && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const idx = abas.findIndex(a => a.key === abaForm)
                    setAbaForm(abas[idx - 1].key)
                  }}>← Anterior</Button>
                )}
                {abaForm !== 'estoque' && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const idx = abas.findIndex(a => a.key === abaForm)
                    setAbaForm(abas[idx + 1].key)
                  }}>Próximo →</Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
                <Button onClick={salvar} disabled={saving || !form.nome_comercial || !form.principio_ativo}>
                  {saving ? 'Salvando...' : <><Check className="h-4 w-4 mr-1" />Salvar</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
