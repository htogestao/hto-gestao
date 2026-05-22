import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  // Se já tem hora (timestamp completo), parseia direto; senão adiciona T00:00:00 para evitar fuso
  const date = iso.includes('T') ? new Date(iso) : new Date(iso + 'T00:00:00')
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR')
}

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarNumero(n: number | null | undefined, dec = 2): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export function diasParaVencer(dataVencimento: string | null): number | null {
  if (!dataVencimento) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.floor((new Date(dataVencimento).getTime() - hoje.getTime()) / 86400000)
}

export function statusVencimentoCor(dias: number | null): string {
  if (dias === null) return 'text-muted-foreground'
  if (dias < 0)  return 'text-red-600 font-semibold'
  if (dias <= 30) return 'text-red-500 font-medium'
  if (dias <= 60) return 'text-orange-500 font-medium'
  if (dias <= 90) return 'text-yellow-600'
  return 'text-green-600'
}

export function statusVencimentoBadge(dias: number | null): string {
  if (dias === null) return 'bg-gray-100 text-gray-600'
  if (dias < 0)   return 'bg-red-100 text-red-700'
  if (dias <= 30) return 'bg-red-50 text-red-600'
  if (dias <= 60) return 'bg-orange-100 text-orange-600'
  if (dias <= 90) return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}
