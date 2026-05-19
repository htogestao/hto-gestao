'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatarNumero, cn } from '@/lib/utils'
import { Plus, Search, MapPin, Layers, ChevronDown, ChevronRight, Upload, X, Pencil } from 'lucide-react'

interface Talhao {
  id: string; nome: string; area_ha: number | null; variedade: string | null
  status_colheita: string | null; numero_corte: number | null; cultura_atual: string | null
}

interface Fazenda {
  id: string; nome: string; municipio: string | null; uf: string | null
  area_total_ha: number | null; polo: string | null; fornecedor_principal: string | null
  vencimento_contrato: string | null; unidade_industrial: string | null
  codigo_externo: string | null; observacoes: string | null; created_at: string
  talhoes: Talhao[]
}

const STATUS_COR: Record<string, string> = {
  a_colher: 'bg-blue-100 text-blue-700',
  colhendo:  'bg-green-100 text-green-700',
  colhido:   'bg-gray-100 text-gray-600',
  reforma:   'bg-orange-100 text-orange-700',
  outro:     'bg-gray-100 text-gray-600',
}

const STATUS_LABEL: Record<string, string> = {
  a_colher: 'A Colher', colhendo: 'Colhendo',
  colhido: 'Colhido', reforma: 'Reforma', outro: 'Outro',
}

const EMPTY: Fazenda = {
  id: '', nome: '', municipio: null, uf: null, area_total_ha: null,
  polo: null, fornecedor_principal: null, vencimento_contrato: null,
  unidade_industrial: null, codigo_externo: null, observacoes: null,
  created_at: '', talhoes: [],
}

export function FazendasClient({ fazendas: inicial, role }: { fazendas: Fazenda[]; role: string }) {
  const isAdmin = role === 'admin'
  const supabase = createClient()
  const [fazendas, setFazendas] = useState(inicial)
  const [busca, setBusca] = useState('')
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<Fazenda | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Fazenda>(EMPTY)

  function abrirModal(f: Fazenda) { setForm({ ...f }); setModal(f) }
  function fecharModal() { setModal(null) }
  function set(k: keyof Fazenda, v: string) { setForm(p => ({ ...p, [k]: v || null })) }

  async function salvar() {
    setSaving(true)
    const { id, talhoes: _, created_at: __, ...dados } = form
    const { data, error } = await supabase.from('fazendas').update(dados).eq('id', id).select().single()
    if (!error && data) {
      setFazendas(prev => prev.map(f => f.id === id ? { ...f, ...data } : f))
      fecharModal()
    }
    setSaving(false)
  }

  const filtradas = fazendas.filter(f =>
    !busca || f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (f.municipio ?? '').toLowerCase().includes(busca.toLowerCase()) ||
    (f.fornecedor_principal ?? '').toLowerCase().includes(busca.toLowerCase())
  )

  function toggle(id: string) {
    setExpandidas(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }

  const totalArea = fazendas.reduce((acc, f) => {
    const area = f.talhoes.reduce((a, t) => a + (t.area_ha ?? 0), 0)
    return acc + area
  }, 0)

  return (
    <>
    {/* Modal Editar */}
    {modal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="text-lg font-semibold">Editar Fazenda</h2>
            <button onClick={fecharModal}><X className="h-5 w-5 text-gray-500" /></button>
          </div>
          <div className="p-5 space-y-3">
            {([
              ['nome','Nome *','text'],['municipio','Município','text'],['uf','UF','text'],
              ['polo','Polo','text'],['fornecedor_principal','Fornecedor Principal','text'],
              ['unidade_industrial','Unidade Industrial','text'],['codigo_externo','Código Externo','text'],
              ['observacoes','Observações','text'],
            ] as [keyof Fazenda, string, string][]).map(([k, label]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <Input value={(form[k] as string) ?? ''} onChange={e => set(k, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t">
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving || !form.nome}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </div>
    )}

    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fazendas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fazendas.length} fazendas · {fazendas.reduce((a,f) => a + f.talhoes.length, 0)} talhões ·{' '}
            {formatarNumero(totalArea, 1)} ha totais
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/importar?tipo=inventario">
                <Upload className="h-4 w-4" />
                Importar Inventário MV
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar fazenda..." className="pl-8" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div className="space-y-2">
        {filtradas.map(f => {
          const aberta  = expandidas.has(f.id)
          const areaTotal = f.talhoes.reduce((a, t) => a + (t.area_ha ?? 0), 0)
          const aColher   = f.talhoes.filter(t => t.status_colheita === 'a_colher').length

          return (
            <Card key={f.id} className="overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => toggle(f.id)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{f.nome}</p>
                    {f.polo && <Badge variant="info">{f.polo}</Badge>}
                    {f.unidade_industrial && <Badge variant="outline">{f.unidade_industrial}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[f.municipio, f.uf].filter(Boolean).join(' · ')}
                    {f.fornecedor_principal && ` · Fornecedor: ${f.fornecedor_principal}`}
                  </p>
                </div>

                <div className="flex items-center gap-6 text-sm text-right shrink-0">
                  <div>
                    <p className="font-semibold">{f.talhoes.length}</p>
                    <p className="text-xs text-muted-foreground">talhões</p>
                  </div>
                  <div>
                    <p className="font-semibold">{formatarNumero(areaTotal, 1)} ha</p>
                    <p className="text-xs text-muted-foreground">área total</p>
                  </div>
                  {aColher > 0 && (
                    <div>
                      <Badge variant="info">{aColher} a colher</Badge>
                    </div>
                  )}
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); abrirModal(f) }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                    </Button>
                  )}
                  {aberta
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Talhões expandidos */}
              {aberta && (
                <div className="border-t bg-muted/10">
                  <div className="p-3 pb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Talhões ({f.talhoes.length})
                    </p>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/talhoes?novo=1&fazenda=${f.id}`}>
                          <Plus className="h-3 w-3 mr-1" />Novo talhão
                        </Link>
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3 pt-1">
                    {f.talhoes.map(t => (
                      <div key={t.id} className="flex items-center gap-2 rounded-md border bg-card p-2.5 text-sm">
                        <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{t.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.area_ha ? `${formatarNumero(t.area_ha, 1)} ha` : '—'}
                            {t.variedade && ` · ${t.variedade}`}
                            {t.numero_corte && ` · ${t.numero_corte}º Corte`}
                          </p>
                        </div>
                        {t.status_colheita && (
                          <span className={cn('text-xs px-1.5 py-0.5 rounded-full shrink-0', STATUS_COR[t.status_colheita])}>
                            {STATUS_LABEL[t.status_colheita]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })}

        {filtradas.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Nenhuma fazenda encontrada</p>
            {isAdmin && (
              <Button className="mt-4" asChild>
                <Link href="/importar?tipo=inventario">Importar Inventário MV</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  )
}
