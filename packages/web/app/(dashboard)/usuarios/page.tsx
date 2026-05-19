import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UsuariosClient } from './usuarios-client'

export const dynamic = 'force-dynamic'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role, id')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: usuarios } = await supabase
    .from('profiles')
    .select('id, nome, telefone, role, ativo, created_at')
    .order('nome')

  return <UsuariosClient usuarios={usuarios ?? []} currentUserId={profile.id} />
}
