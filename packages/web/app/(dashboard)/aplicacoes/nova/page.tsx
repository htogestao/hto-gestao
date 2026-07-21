import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NovaAplicacaoClient } from './nova-aplicacao-client'

export const dynamic = 'force-dynamic'

export default async function NovaAplicacaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: fazendas },
    { data: talhoes },
    { data: defensivos },
    { data: lotes },
    { data: profile },
    { data: culturas },
    { data: operadores },
    { data: frotas },
  ] = await Promise.all([
    supabase.from('fazendas').select('id, nome').order('nome'),
    supabase.from('talhoes').select('id, nome, fazenda_id, area_ha').order('nome'),
    supabase.from('defensivos').select('id, nome_comercial, unidade').order('nome_comercial'),
    supabase.from('lotes').select('id, numero_nf, defensivo_id, quantidade_atual').gt('quantidade_atual', 0).order('data_vencimento'),
    supabase.from('profiles').select('id, nome, role').eq('id', user.id).single(),
    supabase.from('culturas').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('operadores').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('frotas').select('id, identificador, categoria').eq('ativo', true).order('identificador'),
  ])

  return (
    <NovaAplicacaoClient
      fazendas={fazendas ?? []}
      talhoes={talhoes ?? []}
      defensivos={defensivos ?? []}
      lotes={lotes ?? []}
      culturas={culturas ?? []}
      operadores={operadores ?? []}
      frotas={frotas ?? []}
      userId={user.id}
      userName={profile?.nome ?? ''}
    />
  )
}
