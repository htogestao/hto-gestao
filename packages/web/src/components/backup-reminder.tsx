'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DatabaseBackup, X } from 'lucide-react'

const CHAVE = 'hto_ultimo_backup'
const DIAS_LIMITE = 7

/**
 * Lembrete de backup: mostra um aviso quando faz mais de 7 dias
 * (ou nunca) que um backup completo foi baixado neste navegador.
 * A data é gravada em localStorage pela tela Exportar ao baixar o backup.
 */
export function BackupReminder() {
  const [diasSemBackup, setDias] = useState<number | null>(null)
  const [fechado, setFechado]    = useState(false)

  useEffect(() => {
    const ultimo = localStorage.getItem(CHAVE)
    if (!ultimo) { setDias(-1); return } // nunca fez backup
    const dias = Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000)
    setDias(dias)
  }, [])

  if (fechado || diasSemBackup === null) return null
  if (diasSemBackup >= 0 && diasSemBackup < DIAS_LIMITE) return null

  const nunca = diasSemBackup < 0

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
        <DatabaseBackup className="h-5 w-5 text-amber-600" />
      </div>
      <div className="flex-1 text-sm">
        <p className="font-semibold text-amber-800">
          {nunca
            ? 'Você ainda não fez nenhum backup do sistema'
            : `Faz ${diasSemBackup} dias desde o último backup`}
        </p>
        <p className="text-amber-700">
          Baixe um backup completo e guarde em local seguro para proteger seus dados.
        </p>
      </div>
      <Link
        href="/exportar"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        <DatabaseBackup className="h-4 w-4" />
        Fazer backup
      </Link>
      <button onClick={() => setFechado(true)} className="shrink-0 text-amber-400 hover:text-amber-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
