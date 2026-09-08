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
    .select('nome, role, ativo, organizacao_id')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.ativo) {
    redirect('/login?erro=acesso_negado')
  }

  const [{ data: organizacaoAtual }, { data: minhasOrganizacoes }] = await Promise.all([
    supabase.from('organizacoes').select('nome').eq('id', profile.organizacao_id).single(),
    supabase.from('usuario_organizacoes').select('organizacao_id, organizacoes(nome)').eq('profile_id', user.id),
  ])

  return (
    <ClientLayout
      role={profile.role as UserRole}
      userName={profile.nome}
      organizacaoAtual={organizacaoAtual?.nome ?? ''}
      organizacoes={(minhasOrganizacoes ?? []).map(o => ({
        id: o.organizacao_id,
        nome: (o.organizacoes as unknown as { nome: string } | null)?.nome ?? '',
      }))}
    >
      {children}
    </ClientLayout>
  )
}
