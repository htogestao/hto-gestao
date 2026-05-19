'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatarNumero } from '@/lib/utils'
import { ArrowLeftRight, Search, RefreshCw } from 'lucide-react'

interface Movim {
  id: string; tipo: string; quantidade: number; data_hora: string; observacoes: string | null
  defensivo: { nome_comercial: string; unidade: string } | null
  lote: { numero_nf: string | null } | null
  usuario: { nome: string } | null
}

const TIPO_CONFIG: Record<string, { label: string; cor: string; sinal: string }> = {
  entrada:          { label: 'Entrada',         cor: 'bg-green-100 text-green-700',  sinal: '+' },
  saida_aplicacao:  { label: 'Saída Aplicação', cor: 'bg-red-100 text-red-700',     sinal: '−' },
  devolucao_sobra:  { label: 'Devolução Sobra', cor: 'bg-blue-100 text-blue-700',   sinal: '+' },
  ajuste:           { label: 'Ajuste',           cor: 'bg-yellow-100 text-yellow-700',sinal: '±' },
  descarte:         { label: 'Descarte',         cor: 'bg-gray-100 text-gray-700',   sinal: '−' },
}

export function MovimentacoesClient({ movimentacoes: inicial, dataIniPadrao }: {
  movimentacoes: Movim[]; dataIniPadrao: string
}) {
  const supabase   = createClient()
  const [dados, setDados]   = useState(inicial)
  const [busca, setBusca]   = useState('')
  const [tipo, setTipo]     = useState('todos')
  const [dataIni, setIni]   = useState(dataIniPadrao)
  const [dataFim, setFim]   = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoad]  = useState(false)

  const filtrados = dados.filter(m => {
    const mb = !busca || (m.defensivo?.nome_comercial ?? '').toLowerCase().includes(busca.toLowerCase())
    const mt = tipo === 'todos' || m.tipo === tipo
    return mb && mt
  })

  async function recarregar() {
    setLoad(true)
    const { data } = await supabase
      .from('movimentacoes')
      .select(`id, tipo, quantidade, data_hora, observacoes,
        defensivo:defensivos(nome_comercial, unidade),
        lote:lotes(numero_nf), usuario:profiles(nome)`)
      .gte('data_hora', dataIni).lte('data_hora', dataFim + 'T23:59:59')
      .order('data_hora', { ascending: false }).limit(500)
    setDados(data ?? [])
    setLoad(false)
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Movimentações</h1>
        <p className="text-sm text-muted-foreground">{dados.length} registros no período</p>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." className="pl-8" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dataIni} onChange={e => setIni(e.target.value)} className="w-36" />
          <span className="text-muted-foreground text-sm">até</span>
          <Input type="date" value={dataFim} onChange={e => setFim(e.target.value)} className="w-36" />
          <Button variant="outline" size="sm" onClick={recarregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium">Data/Hora</th>
                  <th className="text-left p-3 font-medium">Defensivo</th>
                  <th className="text-left p-3 font-medium">NF/Lote</th>
                  <th className="text-center p-3 font-medium">Tipo</th>
                  <th className="text-right p-3 font-medium">Quantidade</th>
                  <th className="text-left p-3 font-medium">Usuário</th>
                  <th className="text-left p-3 font-medium">Observações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(m => {
                  const cfg = TIPO_CONFIG[m.tipo] ?? { label: m.tipo, cor: 'bg-gray-100 text-gray-700', sinal: '' }
                  const isSaida = m.tipo === 'saida_aplicacao' || m.tipo === 'descarte'
                  return (
                    <tr key={m.id} className="border-b hover:bg-muted/10 transition-colors">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(m.data_hora).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3 font-medium">{m.defensivo?.nome_comercial ?? '—'}</td>
                      <td className="p-3 font-mono text-xs">{m.lote?.numero_nf ?? '—'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cor}`}>{cfg.label}</span>
                      </td>
                      <td className={`p-3 text-right font-mono font-semibold ${isSaida ? 'text-red-600' : 'text-green-600'}`}>
                        {cfg.sinal}{formatarNumero(m.quantidade, 1)} {m.defensivo?.unidade}
                      </td>
                      <td className="p-3 text-muted-foreground">{m.usuario?.nome ?? '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground">{m.observacoes ?? '—'}</td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <ArrowLeftRight className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    Nenhuma movimentação no período
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
