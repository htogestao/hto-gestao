import type { StatusVencimento } from '../types/enums'

export function calcularStatusVencimento(dataVencimento: string | null): StatusVencimento {
  if (!dataVencimento) return 'ok'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(dataVencimento)
  const dias = Math.floor((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  if (dias < 0) return 'vencido'
  if (dias <= 30) return 'proximo_30'
  if (dias <= 60) return 'proximo_60'
  if (dias <= 90) return 'proximo_90'
  return 'ok'
}

export function diasParaVencer(dataVencimento: string | null): number | null {
  if (!dataVencimento) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(dataVencimento)
  return Math.floor((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export function fefoSort<T extends { data_vencimento: string | null; quantidade_atual: number }>(
  lotes: T[]
): T[] {
  return [...lotes]
    .filter((l) => l.quantidade_atual > 0)
    .sort((a, b) => {
      if (!a.data_vencimento) return 1
      if (!b.data_vencimento) return -1
      return new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
    })
}

export function parsarObservacaoVencida(observacao: string | null): {
  qtdVencida: number
  texto: string | null
} {
  if (!observacao) return { qtdVencida: 0, texto: null }
  const match = observacao.match(/^(\d+(?:[.,]\d+)?)\s*vencido/i)
  if (match) {
    return {
      qtdVencida: parseFloat(match[1].replace(',', '.')),
      texto: observacao,
    }
  }
  if (/vencido/i.test(observacao)) {
    return { qtdVencida: -1, texto: observacao } // -1 = tudo vencido
  }
  return { qtdVencida: 0, texto: observacao }
}
