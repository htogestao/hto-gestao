export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

export function parsarDataBR(str: string): string | null {
  // aceita DD/MM/AAAA
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  return `${match[3]}-${match[2]}-${match[1]}`
}

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarNumero(n: number | null | undefined, decimais = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais })
}
