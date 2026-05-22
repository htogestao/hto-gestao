import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NovoInventarioClient } from './novo-inventario-client'

export const dynamic = 'force-dynamic'

export default async function NovoInventarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Busca estoque atual por defensivo (usando RPC que já existe)
  const { data: estoque } = await supabase.rpc('estoque_atual')

  return (
    <NovoInventarioClient
      userId={user.id}
      estoque={(estoque ?? []) as any}
    />
  )
}
