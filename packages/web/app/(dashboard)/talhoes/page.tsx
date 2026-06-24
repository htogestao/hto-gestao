import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TalhoesClient from './talhoes-client'

export const dynamic = 'force-dynamic'

export default async function TalhoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: talhoes }, { data: fazendas }] = await Promise.all([
    supabase
      .from('talhoes')
      .select('*')
      .order('nome'),
    supabase
      .from('fazendas')
      .select('id, nome, municipio, uf, unidade')
      .order('nome'),
  ])

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (
    <TalhoesClient
      talhoes={talhoes ?? []}
      fazendas={fazendas ?? []}
      isAdmin={['admin', 'viewer', 'field'].includes(profile?.role ?? '')}
    />
  )
}
