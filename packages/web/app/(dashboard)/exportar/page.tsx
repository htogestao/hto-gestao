import { createClient } from '@/lib/supabase/server'
import { ExportarClient } from './exportar-client'

export const dynamic = 'force-dynamic'

export default async function ExportarPage() {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()

  return <ExportarClient role={profile?.role ?? 'viewer'} />
}
