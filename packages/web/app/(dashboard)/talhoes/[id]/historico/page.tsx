import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HistoricoTalhaoClient } from './historico-client'

export const dynamic = 'force-dynamic'

export default async function HistoricoTalhaoPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: talhao }, { data: aplicacoes, error: erroAplicacoes }] = await Promise.all([
    supabase.from('talhoes')
      .select('id, nome, area_ha, cultura_atual, variedade, numero_corte, status_colheita, fazenda:fazendas(nome)')
      .eq('id', params.id)
      .single(),

    supabase.from('aplicacoes')
      .select(`
        id, data, status, area_aplicada_ha, praga_alvo, condicoes_climaticas, observacoes,
        responsavel:profiles!aplicacoes_responsavel_id_fkey(nome),
        itens:aplicacao_itens(
          quantidade_usada, dose_por_hectare, quantidade_sobrou,
          defensivo:defensivos(nome_comercial, classe, unidade, carencia_dias, reentrada_horas)
        )
      `)
      .eq('talhao_id', params.id)
      .neq('status', 'cancelada')
      .order('data', { ascending: false }),
  ])

  if (!talhao) redirect('/talhoes')
  if (erroAplicacoes) console.error('Erro ao buscar aplicações do talhão:', erroAplicacoes)

  return (
    <HistoricoTalhaoClient
      talhao={talhao as any}
      aplicacoes={(aplicacoes ?? []) as any}
      erro={erroAplicacoes?.message ?? null}
    />
  )
}
