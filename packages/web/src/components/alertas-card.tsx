import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import Link from 'next/link'

interface Alerta {
  tipo: string
  nome_comercial: string
  detalhe: string
  severidade: string
}

export function AlertasCard({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Alertas</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <Info className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-green-700">Tudo certo!</p>
            <p className="text-xs text-muted-foreground mt-1">Nenhum alerta ativo</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          Alertas Ativos ({alertas.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-80 overflow-y-auto">
        {alertas.map((a, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 text-sm ${
              a.severidade === 'critico'
                ? 'bg-red-50 border border-red-200'
                : a.severidade === 'alto'
                ? 'bg-orange-50 border border-orange-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${
                a.severidade === 'critico' ? 'text-red-500' :
                a.severidade === 'alto' ? 'text-orange-500' : 'text-yellow-500'
              }`} />
              <div>
                <p className="font-semibold">{a.nome_comercial}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.detalhe}</p>
              </div>
            </div>
          </div>
        ))}
        <Link href="/estoque" className="block text-center text-xs text-primary hover:underline pt-2">
          Ver todos no estoque →
        </Link>
      </CardContent>
    </Card>
  )
}
