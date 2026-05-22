import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PerfilClient } from './perfil-client'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, role, ativo, created_at')
    .eq('id', user.id)
    .single()

  return (
    <PerfilClient
      userId={user.id}
      email={user.email ?? ''}
      nome={profile?.nome ?? ''}
      role={profile?.role ?? ''}
      criadoEm={profile?.created_at ?? ''}
    />
  )
}
