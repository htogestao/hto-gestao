import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImportarClient } from './importar-client'

export const dynamic = 'force-dynamic'

export default async function ImportarPage() {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return <ImportarClient />
}
