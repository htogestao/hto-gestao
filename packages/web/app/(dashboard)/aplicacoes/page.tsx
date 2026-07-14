import { createClient } from '@/lib/supabase/server'
import { AplicacoesClient } from './aplicacoes-client'

export const dynamic = 'force-dynamic'

export default async function AplicacoesPage() {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()

  const [{ data: aplicacoes }, { data: culturas }] = await Promise.all([
    supabase.from('aplicacoes')
      .select(`
        id, data, status, area_aplicada_ha, praga_alvo, condicoes_climaticas,
        observacoes, created_at, vazao_l_ha,
        cultura:culturas(id, nome),
        fazenda:fazendas(id, nome),
        talhao:talhoes(id, nome, area_ha),
        talhoes_vinculados:aplicacao_talhoes(
          talhao:talhoes(id, nome, area_ha)
        ),
        responsavel:profiles(id, nome),
        itens:aplicacao_itens(
          id, quantidade_usada, quantidade_sobrou, dose_por_hectare, calda_total_l,
          defensivo:defensivos(id, nome_comercial, unidade),
          lote:lotes(id, numero_nf, data_vencimento)
        )
      `)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('culturas').select('id, nome').eq('ativo', true).order('nome'),
  ])

  return <AplicacoesClient aplicacoes={(aplicacoes ?? []) as any} role={profile?.role ?? 'viewer'} culturas={culturas ?? []} />
}
