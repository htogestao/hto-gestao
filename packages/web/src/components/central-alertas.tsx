'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CalendarClock, Clock, Wheat, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

interface Vencimento { nome_comercial: string; detalhe: string; severidade: string }
interface AreaAlerta {
  fazenda: string; talhao: string; defensivo: string; liberadoEm: string
  horasRestantes?: number; diasRestantes?: number
}

/**
 * Central de Alertas — consolida, num único card de decisão:
 *  • produtos próximos ao vencimento (RPC alertas_ativos)
 *  • áreas em período de reentrada
 *  • áreas em período de carência
 * Componente de apresentação apenas: não altera dados nem regras.
 */
export function CentralAlertas({ vencimentos, reentradas, carencias }: {
  vencimentos: Vencimento[]; reentradas: AreaAlerta[]; carencias: AreaAlerta[]
}) {
  const total = vencimentos.length + reentradas.length + carencias.length

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            Central de Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <ShieldCheck className="h-6 w-6 text-green-600" />
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
          Central de Alertas ({total})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[30rem] overflow-y-auto">

        {/* Próximos ao vencimento */}
        {vencimentos.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
              <CalendarClock className="h-3.5 w-3.5" />
              Próximos ao vencimento ({vencimentos.length})
            </h3>
            <div className="space-y-2">
              {vencimentos.map((a, i) => (
                <div key={i} className={`rounded-lg p-2.5 text-sm ${
                  a.severidade === 'critico'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <p className="font-semibold">{a.nome_comercial}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.detalhe}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reentrada */}
        {reentradas.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
              <Clock className="h-3.5 w-3.5" />
              Reentrada ({reentradas.length})
            </h3>
            <div className="space-y-2">
              {reentradas.map((a, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md bg-red-50 border border-red-100 p-2.5">
                  <Clock className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-700">
                      🚫 Reentrada proibida — {a.horasRestantes}h restantes
                    </p>
                    <p className="text-xs text-red-600 truncate">{a.fazenda} · {a.talhao}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.defensivo} · liberado em {new Date(a.liberadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Carência */}
        {carencias.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
              <Wheat className="h-3.5 w-3.5" />
              Carência ({carencias.length})
            </h3>
            <div className="space-y-2">
              {carencias.map((a, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-100 p-2.5">
                  <Wheat className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-700">
                      ⏳ Carência — {a.diasRestantes} dia(s) restante(s)
                    </p>
                    <p className="text-xs text-amber-600 truncate">{a.fazenda} · {a.talhao}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.defensivo} · colheita liberada em {new Date(a.liberadoEm).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <Link href="/estoque" className="block text-center text-xs text-primary hover:underline pt-1">
          Ver estoque →
        </Link>
      </CardContent>
    </Card>
  )
}
