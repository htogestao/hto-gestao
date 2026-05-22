'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Wheat, AlertTriangle } from 'lucide-react'

interface AlertaAplicacao {
  tipo: 'reentrada' | 'carencia'
  fazenda: string
  talhao: string
  liberadoEm: string
  horasRestantes?: number
  diasRestantes?: number
  defensivo: string
}

export function AlertasAplicacaoCard({ alertas }: { alertas: AlertaAplicacao[] }) {
  if (alertas.length === 0) return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-green-600" />
          Reentrada / Carência
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-green-600 font-medium">✅ Nenhuma restrição ativa</p>
        <p className="text-xs text-muted-foreground mt-1">Todos os talhões liberados</p>
      </CardContent>
    </Card>
  )

  const reentradas = alertas.filter(a => a.tipo === 'reentrada')
  const carencias  = alertas.filter(a => a.tipo === 'carencia')

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Reentrada / Carência ({alertas.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-64 overflow-y-auto">
        {reentradas.map((a, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md bg-red-50 border border-red-100 p-2.5">
            <Clock className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700">
                🚫 REENTRADA PROIBIDA — {a.horasRestantes}h restantes
              </p>
              <p className="text-xs text-red-600 truncate">
                {a.fazenda} · {a.talhao}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.defensivo} · liberado em {new Date(a.liberadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {carencias.map((a, i) => (
          <div key={i} className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-100 p-2.5">
            <Wheat className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-700">
                ⏳ CARÊNCIA — {a.diasRestantes} dia(s) restante(s)
              </p>
              <p className="text-xs text-amber-600 truncate">
                {a.fazenda} · {a.talhao}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.defensivo} · colheita liberada em {new Date(a.liberadoEm).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
