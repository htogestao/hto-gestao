'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Layers, Pencil, Trash2, X } from 'lucide-react'
import type { Talhao } from '@agro/shared'

interface Fazenda { id: string; nome: string; municipio: string | null; uf: string | null; usina: string | null }

const STATUS_CONFIG: Record<string, { label: string; variant: string }> = {
  a_colher:  { label: 'A colher',  variant: 'bg-green-100 text-green-800' },
  colhendo:  { label: 'Colhendo',  variant: 'bg-yellow-100 text-yellow-800' },
  colhido:   { label: 'Colhido',   variant: 'bg-gray-100 text-gray-700' },
  reforma:   { label: 'Reforma',   variant: 'bg-purple-100 text-purple-800' },
  outro:     { label: 'Outro',     variant: 'bg-slate-100 text-slate-700' },
}

interface Props {
  talhoes: Talhao[]
  fazendas: Fazenda[]
  isAdmin: boolean
}

const FORM_DEFAULT: Partial<Talhao> = {
  nome: '', cultura_atual: '', area_ha: undefined, variedade: '',
  numero_corte: undefined, status_colheita: undefined, sistema_colheita: undefined,
  data_plantio: '', tch_estimado: undefined,
}

export default function TalhoesClient({ talhoes: initialTalhoes, fazendas, isAdmin }: Props) {
  const supabase = createClient()
  const [talhoes, setTalhoes]   = useState(initialTalhoes)
  const [busca, setBusca]       = useState('')
  const [fazFiltro, setFazFiltro] = useState('todos')
  const [stFiltro, setStFiltro]   = useState('todos')
  const [modal, setModal]       = useState<'criar' | 'editar' | null>(null)
  const [selecionado, setSelecionado] = useState<Talhao | null>(null)
  const [form, setForm]         = useState<Partial<Talhao>>({ ...FORM_DEFAULT })
  const [fazSel, setFazSel]     = useState(fazendas[0]?.id ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')

  const fazendaMap = useMemo(() => {
    const m: Record<string, Fazenda> = {}
    fazendas.forEach(f => { m[f.id] = f })
    return m
  }, [fazendas])

  const filtrados = useMemo(() => {
    return talhoes.filter(t => {
      const faz = fazendaMap[t.fazenda_id ?? '']
      const q = busca.toLowerCase()
      const matchBusca = !busca ||
        t.nome.toLowerCase().includes(q) ||
        (faz?.nome ?? '').toLowerCase().includes(q) ||
        (t.cultura_atual ?? '').toLowerCase().includes(q) ||
        (t.variedade ?? '').toLowerCase().includes(q)
      const matchFaz = fazFiltro === 'todos' || t.fazenda_id === fazFiltro
      const matchSt  = stFiltro === 'todos'  || t.status_colheita === stFiltro
      return matchBusca && matchFaz && matchSt
    })
  }, [talhoes, busca, fazFiltro, stFiltro, fazendaMap])

  function abrirCriar() {
    setForm({ ...FORM_DEFAULT })
    setFazSel(fazendas[0]?.id ?? '')
    setErro('')
    setModal('criar')
  }

  function abrirEditar(t: Talhao) {
    setSelecionado(t)
    setForm({ ...t })
    setFazSel(t.fazenda_id ?? '')
    setErro('')
    setModal('editar')
  }

  async function salvar() {
    if (!form.nome?.trim()) { setErro('Nome é obrigatório'); return }
    if (!fazSel) { setErro('Selecione a fazenda'); return }
    setSalvando(true); setErro('')

    const payload = {
      fazenda_id:       fazSel,
      nome:             form.nome,
      cultura_atual:    form.cultura_atual || null,
      area_ha:          form.area_ha ? Number(form.area_ha) : null,
      variedade:        form.variedade || null,
      numero_corte:     form.numero_corte ? Number(form.numero_corte) : null,
      status_colheita:  form.status_colheita || null,
      sistema_colheita: form.sistema_colheita || null,
      data_plantio:     form.data_plantio || null,
      tch_estimado:     form.tch_estimado ? Number(form.tch_estimado) : null,
    }

    if (modal === 'criar') {
      const { data, error } = await supabase.from('talhoes').insert(payload).select().single()
      if (error) { setErro(error.message); setSalvando(false); return }
      setTalhoes(prev => [...prev, data as Talhao].sort((a, b) => a.nome.localeCompare(b.nome)))
    } else if (selecionado) {
      const { data, error } = await supabase.from('talhoes').update(payload).eq('id', selecionado.id).select().single()
      if (error) { setErro(error.message); setSalvando(false); return }
      setTalhoes(prev => prev.map(t => t.id === selecionado.id ? data as Talhao : t))
    }

    setSalvando(false)
    setModal(null)
  }

  async function excluir(t: Talhao) {
    if (!confirm(`Excluir talhão "${t.nome}"?`)) return
    const { error } = await supabase.from('talhoes').delete().eq('id', t.id)
    if (error) { alert(error.message); return }
    setTalhoes(prev => prev.filter(x => x.id !== t.id))
  }

  function setF(key: keyof Talhao, val: string) {
    setForm(prev => ({ ...prev, [key]: val || undefined }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Talhões</h1>
          <p className="text-sm text-gray-500 mt-1">{filtrados.length} de {talhoes.length} talhão(s)</p>
        </div>
        {isAdmin && (
          <Button onClick={abrirCriar} className="gap-2 bg-green-700 hover:bg-green-800">
            <Plus className="h-4 w-4" /> Novo talhão
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Select value={fazFiltro} onValueChange={setFazFiltro}>
          <SelectTrigger><SelectValue placeholder="Todas as fazendas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as fazendas</SelectItem>
            {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stFiltro} onValueChange={setStFiltro}>
          <SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-800 text-white">
                  {['Talhão', 'Fazenda', 'Cultura / Variedade', 'Área (ha)', 'Status', 'Corte', 'TCH est.', ...(isAdmin ? [''] : [])].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t, i) => {
                  const faz = fazendaMap[t.fazenda_id ?? '']
                  const sc  = t.status_colheita ? STATUS_CONFIG[t.status_colheita] : null
                  return (
                    <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-medium text-gray-900">{t.nome}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {faz?.nome ?? '—'}
                        {faz?.usina && <span className="ml-1 text-xs text-gray-400">P{faz.usina}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {t.cultura_atual ?? '—'}
                        {t.variedade && <span className="ml-1 text-xs text-gray-500">{t.variedade}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{t.area_ha?.toFixed(1) ?? '—'}</td>
                      <td className="px-4 py-3">
                        {sc
                          ? <Badge className={sc.variant}>{sc.label}</Badge>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-700">{t.numero_corte ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{t.tch_estimado?.toFixed(0) ?? '—'}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => abrirEditar(t)} className="h-7 w-7 p-0 text-green-700 hover:text-green-900">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => excluir(t)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="text-center py-16 text-gray-400">
                      <Layers className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      Nenhum talhão encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {modal === 'criar' ? 'Novo Talhão' : `Editar: ${selecionado?.nome}`}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setModal(null)} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Fazenda *</label>
                <Select value={fazSel} onValueChange={setFazSel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a fazenda..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nome do talhão *</label>
                <Input value={form.nome ?? ''} onChange={e => setF('nome', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Área (ha)</label>
                <Input type="number" step="0.01" value={form.area_ha ?? ''} onChange={e => setF('area_ha', e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cultura atual</label>
                <Input value={form.cultura_atual ?? ''} onChange={e => setF('cultura_atual', e.target.value)} placeholder="Ex: Cana-de-açúcar" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Variedade</label>
                <Input value={form.variedade ?? ''} onChange={e => setF('variedade', e.target.value)} placeholder="Ex: RB867515" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Número de corte</label>
                <Input type="number" min="1" value={form.numero_corte ?? ''} onChange={e => setF('numero_corte', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">TCH estimado</label>
                <Input type="number" step="0.1" value={form.tch_estimado ?? ''} onChange={e => setF('tch_estimado', e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Status colheita</label>
                <Select value={form.status_colheita ?? 'none'} onValueChange={v => setF('status_colheita', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="— Sem status —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem status —</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Sistema de colheita</label>
                <Select value={form.sistema_colheita ?? 'none'} onValueChange={v => setF('sistema_colheita', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="— Sem info —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem info —</SelectItem>
                    <SelectItem value="mecanizada">Mecanizada</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="semimecanizada">Semimecanizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Data de plantio</label>
                <Input type="date" value={form.data_plantio ?? ''} onChange={e => setF('data_plantio', e.target.value)} />
              </div>

              {erro && (
                <div className="sm:col-span-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">{erro}</div>
              )}
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
              <Button className="flex-1 bg-green-700 hover:bg-green-800" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
