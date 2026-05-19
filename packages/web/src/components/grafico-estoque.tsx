'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface EstoqueItem {
  nome_comercial: string
  quantidade_total: number
  unidade: string
  em_alerta: boolean
  tem_vencido: boolean
}

export function GraficoEstoque({ estoque }: { estoque: EstoqueItem[] }) {
  // Top 10 por quantidade
  const dados = [...estoque]
    .sort((a, b) => b.quantidade_total - a.quantidade_total)
    .slice(0, 12)
    .map(e => ({
      nome: e.nome_comercial.length > 15 ? e.nome_comercial.substring(0, 15) + '…' : e.nome_comercial,
      quantidade: Number(e.quantidade_total.toFixed(1)),
      unidade: e.unidade,
      alerta: e.em_alerta,
      vencido: e.tem_vencido,
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estoque Atual — Top Produtos</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dados} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="nome"
              tick={{ fontSize: 11 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number, _name: string, props: { payload?: { unidade?: string } }) => [
                `${value} ${props.payload?.unidade ?? ''}`,
                'Estoque'
              ]}
            />
            <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
              {dados.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.vencido ? '#ef4444' : entry.alerta ? '#f97316' : '#22c55e'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground justify-end">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block"/>OK</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block"/>Estoque Baixo</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"/>Lote Vencido</span>
        </div>
      </CardContent>
    </Card>
  )
}
