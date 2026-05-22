'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Save, Search, TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react'
import { formatarNumero, cn } from '@/lib/utils'

interface EstoqueRow {
  defensivo_id: string
  nome_comercial: string
  unidade: string
  classe: string
  quantidade_total: number
}

export function NovoInventarioClient({ userId, estoque }: {
  userId: string
  estoque: EstoqueRow[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const hoje = new Date().toISOString().split('T')[0]

  const [data, setData]       = useState(hoje)
  const [obs,  setObs]        = useState('')
  const [busca, setBusca]     = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]       = useState<string | null>(null)

  // Contagens: defensivo_id → quantidade contada (string para o input)
  const [contagens, setContagens] = useState<Record<string, string>>(() =>
    Object.fromEntries(estoque.map(e => [e.defensivo_id, String(e.quantidade_total)]))
  )

  function setContagem(id: string, val: string) {
    setContagens(prev => ({ ...prev, [id]: val }))
  }

  const filtrados = useMemo(() =>
    estoque.filter(e =>
      e.nome_comercial.toLowerCase().includes(busca.toLowerCase()) ||
      e.classe.toLowerCase().includes(busca.toLowerCase())
    ), [estoque, busca])

  const resumo = useMemo(() => {
    let faltas = 0, sobras = 0, ok = 0
    estoque.forEach(e => {
      const contado = parseFloat(contagens[e.defensivo_id] ?? '0') || 0
      const diff = contado - e.quantidade_total
      if (diff < 0) faltas++
      else if (diff > 0) sobras++
      else ok++
    })
    return { faltas, sobras, ok }
  }, [contagens, estoque])

  async function salvar() {
    if (!data) { setErro('Informe a data do inventário.'); return }
    setSalvando(true); setErro(null)

    try {
      // Cria o inventário
      const { data: inv, error: errInv } = await supabase
        .from('inventario_fisico')
        .insert({ data, observacoes: obs || null, usuario_id: userId })
        .select('id')
        .single()

      if (errInv || !inv) throw errInv ?? new Error('Erro ao criar inventário')

      // Insere os itens
      const itens = estoque.map(e => ({
        inventario_id:      inv.id,
        defensivo_id:       e.defensivo_id,
        quantidade_sistema: e.quantidade_total,
        quantidade_contada: parseFloat(contagens[e.defensivo_id] ?? '0') || 0,
      }))

      const { error: errItens } = await supabase.from('inventario_itens').insert(itens)
      if (errItens) throw errItens

      router.push('/inventario')
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao salvar inventário.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto pb-10">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Novo Inventário Físico</h1>
          <p className="text-sm text-muted-foreground">Digite a quantidade real de cada produto</p>
        </div>
      </div>

      {/* Data e observações */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Data do inventário</label>
            <Input type="date" className="mt-1" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Observações (opcional)</label>
            <Input className="mt-1" placeholder="Ex: Balanço de maio/2025" value={obs} onChange={e => setObs(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center border-red-200 bg-red-50/30">
          <CardContent className="p-3">
            <p className="text-xl font-bold text-red-600">{resumo.faltas}</p>
            <p className="text-xs text-red-500">Com falta</p>
          </CardContent>
        </Card>
        <Card className="text-center border-green-200 bg-green-50/30">
          <CardContent className="p-3">
            <p className="text-xl font-bold text-green-600">{resumo.ok}</p>
            <p className="text-xs text-green-500">Conferindo</p>
          </CardContent>
        </Card>
        <Card className="text-center border-blue-200 bg-blue-50/30">
          <CardContent className="p-3">
            <p className="text-xl font-bold text-blue-600">{resumo.sobras}</p>
            <p className="text-xs text-blue-500">Com sobra</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar produto..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Tabela de produtos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{filtrados.length} produto(s)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b bg-muted/30">
                  <th className="text-left py-2 px-4">Produto</th>
                  <th className="text-right py-2 px-3">Sistema</th>
                  <th className="text-right py-2 px-3 w-36">Contagem física</th>
                  <th className="text-right py-2 px-4">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(e => {
                  const contado = parseFloat(contagens[e.defensivo_id] ?? '0') || 0
                  const diff = contado - e.quantidade_total
                  return (
                    <tr key={e.defensivo_id} className={cn(
                      'border-b last:border-0 transition-colors',
                      diff < 0 && 'bg-red-50/40',
                      diff > 0 && 'bg-blue-50/40',
                    )}>
                      <td className="py-3 px-4">
                        <p className="font-medium">{e.nome_comercial}</p>
                        <p className="text-xs text-muted-foreground capitalize">{e.classe}</p>
                      </td>
                      <td className="text-right py-3 px-3 text-muted-foreground whitespace-nowrap">
                        {formatarNumero(e.quantidade_total, 2)} {e.unidade}
                      </td>
                      <td className="text-right py-3 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-24 text-right h-8 text-sm"
                            value={contagens[e.defensivo_id] ?? ''}
                            onChange={ev => setContagem(e.defensivo_id, ev.target.value)}
                          />
                          <span className="text-xs text-muted-foreground w-8 shrink-0">{e.unidade}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-medium whitespace-nowrap">
                        {diff === 0 ? (
                          <span className="text-green-600 flex items-center justify-end gap-1">
                            <Minus className="h-3 w-3" /> OK
                          </span>
                        ) : diff < 0 ? (
                          <span className="text-red-600 flex items-center justify-end gap-1">
                            <TrendingDown className="h-3 w-3" />
                            {formatarNumero(diff, 2)}
                          </span>
                        ) : (
                          <span className="text-blue-600 flex items-center justify-end gap-1">
                            <TrendingUp className="h-3 w-3" />
                            +{formatarNumero(diff, 2)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {erro && (
        <div className="flex items-center gap-2 rounded-md p-3 text-sm bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      )}

      <Button className="w-full" onClick={salvar} disabled={salvando || estoque.length === 0}>
        <Save className="h-4 w-4 mr-2" />
        {salvando ? 'Salvando...' : 'Salvar Inventário'}
      </Button>
    </div>
  )
}
