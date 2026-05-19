import { createClient } from '@/lib/supabase/server'
import { RelatoriosClient } from './relatorios-client'
export const dynamic = 'force-dynamic'

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()
  const { data: fazendas } = await supabase.from('fazendas').select('id, nome').order('nome')
  return <RelatoriosClient role={profile?.role ?? 'viewer'} fazendas={fazendas ?? []} />
}
