'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, ClipboardList, ChevronDown, ChevronRight, TrendingDown, TrendingUp, Minus, Calendar, User } from 'lucide-react'
import { formatarData, formatarNumero, cn } from '@/lib/utils'

interface Item {
  id: string
  quantidade_sistema: number
  quantidade_contada: number
  diferenca: number
  defensivo: { id: string; nome_comercial: string; unidade: string; classe: string } | null
}

interface Inventario {
  id: string
  data: string
  observacoes: string | null
  created_at: string
  usuario: { nome: string } | null
  itens: Item[]
}

export function InventarioClient({ inventarios }: { inventarios: Inventario[] }) {
  const [expandido, setExpandido] = useState<string | null>(null)

  function toggle(id: string) {
    setExpandido(prev => prev === id ? null : id)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventário Físico</h1>
          <p className="text-sm text-muted-foreground mt-1">Balanço mensal de estoque — contagem real vs sistema</p>
        </div>
        <Button asChild>
          <Link href="/inventario/novo">
            <Plus className="h-4 w-4 mr-2" />
            Novo Inventário
          </Link>
        </Button>
      </div>

      {inventarios.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhum inventário registrado</p>
            <p className="text-sm mt-1">Clique em "Novo Inventário" para fazer o primeiro balanço</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {inventarios.map(inv => {
            const aberto = expandido === inv.id
            const comDiferenca = inv.itens.filter(i => i.diferenca !== 0)
            const faltas   = inv.itens.filter(i => i.diferenca < 0).length
            const sobras   = inv.itens.filter(i => i.diferenca > 0).length
            const ok       = inv.itens.filter(i => i.diferenca === 0).length

            return (
              <Card key={inv.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/10"
                  onClick={() => toggle(inv.id)}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{formatarData(inv.data)}</p>
                      {faltas > 0 && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                          <TrendingDown className="h-3 w-3 mr-1" />{faltas} falta(s)
                        </Badge>
                      )}
                      {sobras > 0 && (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                          <TrendingUp className="h-3 w-3 mr-1" />{sobras} sobra(s)
                        </Badge>
                      )}
                      {ok > 0 && comDiferenca.length === 0 && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                          ✅ Tudo conferindo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {inv.usuario && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />{inv.usuario.nome}
                        </span>
                      )}
                      <span>{inv.itens.length} produto(s) conferido(s)</span>
                    </div>
                  </div>

                  {aberto
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>

                {aberto && (
                  <div className="border-t bg-muted/5 p-4 space-y-3">
                    {inv.observacoes && (
                      <p className="text-sm text-muted-foreground">📝 {inv.observacoes}</p>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b">
                            <th className="text-left py-2 pr-4">Produto</th>
                            <th className="text-right py-2 px-3">Sistema</th>
                            <th className="text-right py-2 px-3">Contado</th>
                            <th className="text-right py-2 pl-3">Diferença</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inv.itens.map(item => (
                            <tr key={item.id} className={cn(
                              'border-b last:border-0',
                              item.diferenca < 0 && 'bg-red-50/50',
                              item.diferenca > 0 && 'bg-blue-50/50',
                            )}>
                              <td className="py-2 pr-4">
                                <p className="font-medium">{item.defensivo?.nome_comercial}</p>
                                <p className="text-xs text-muted-foreground">{item.defensivo?.classe}</p>
                              </td>
                              <td className="text-right py-2 px-3 text-muted-foreground">
                                {formatarNumero(item.quantidade_sistema, 2)} {item.defensivo?.unidade}
                              </td>
                              <td className="text-right py-2 px-3">
                                {formatarNumero(item.quantidade_contada, 2)} {item.defensivo?.unidade}
                              </td>
                              <td className="text-right py-2 pl-3">
                                {item.diferenca === 0 ? (
                                  <span className="text-green-600 flex items-center justify-end gap-1">
                                    <Minus className="h-3 w-3" /> OK
                                  </span>
                                ) : item.diferenca < 0 ? (
                                  <span className="text-red-600 font-medium flex items-center justify-end gap-1">
                                    <TrendingDown className="h-3 w-3" />
                                    {formatarNumero(item.diferenca, 2)}
                                  </span>
                                ) : (
                                  <span className="text-blue-600 font-medium flex items-center justify-end gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    +{formatarNumero(item.diferenca, 2)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
