import { createClient } from '@/lib/supabase/server'
import { DefensivosClient } from './defensivos-client'
export const dynamic = 'force-dynamic'

export default async function DefensivosPage() {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()
  const { data: defensivos } = await supabase
    .from('defensivos').select('*').order('nome_comercial')
  return <DefensivosClient defensivos={defensivos ?? []} role={profile?.role ?? 'viewer'} />
}
