import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientLayout } from './client-layout'
import type { UserRole } from '@agro/shared'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, role, ativo')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.ativo) {
    redirect('/login?erro=acesso_negado')
  }

  return (
    <ClientLayout role={profile.role as UserRole} userName={profile.nome}>
      {children}
    </ClientLayout>
  )
}
