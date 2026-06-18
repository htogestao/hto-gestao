import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EditarAplicacaoClient } from './editar-aplicacao-client'

export const dynamic = 'force-dynamic'

export default async function EditarAplicacaoPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: aplicacao },
    { data: fazendas },
    { data: talhoes },
    { data: defensivos },
    { data: lotes },
  ] = await Promise.all([
    supabase.from('aplicacoes')
      .select(`
        id, data, status, area_aplicada_ha, praga_alvo, condicoes_climaticas, observacoes,
        fazenda_id, talhao_id, responsavel_id, vazao_l_ha,
        talhoes_vinculados:aplicacao_talhoes(talhao_id),
        itens:aplicacao_itens(
          id, defensivo_id, lote_id, quantidade_usada, quantidade_sobrou,
          dose_por_hectare, calda_total_l
        )
      `)
      .eq('id', params.id)
      .single(),
    supabase.from('fazendas').select('id, nome').order('nome'),
    supabase.from('talhoes').select('id, nome, fazenda_id, area_ha').order('nome'),
    supabase.from('defensivos').select('id, nome_comercial, unidade').order('nome_comercial'),
    supabase.from('lotes').select('id, numero_nf, defensivo_id, quantidade_atual').order('data_vencimento'),
  ])

  if (!aplicacao) redirect('/aplicacoes')

  return (
    <EditarAplicacaoClient
      aplicacao={aplicacao as any}
      fazendas={fazendas ?? []}
      talhoes={talhoes ?? []}
      defensivos={defensivos ?? []}
      lotes={lotes ?? []}
    />
  )
}
