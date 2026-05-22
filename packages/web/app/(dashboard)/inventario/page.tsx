import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InventarioClient } from './inventario-client'

export const dynamic = 'force-dynamic'

export default async function InventarioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: inventarios } = await supabase
    .from('inventario_fisico')
    .select(`
      id, data, observacoes, created_at,
      usuario:profiles(nome),
      itens:inventario_itens(
        id, quantidade_sistema, quantidade_contada, diferenca,
        defensivo:defensivos(id, nome_comercial, unidade, classe)
      )
    `)
    .order('data', { ascending: false })

  return <InventarioClient inventarios={(inventarios ?? []) as any} />
}
