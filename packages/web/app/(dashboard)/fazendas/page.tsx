import { createClient } from '@/lib/supabase/server'
import { FazendasClient } from './fazendas-client'

export const dynamic = 'force-dynamic'

export default async function FazendasPage() {
  const supabase = await createClient()

  const { data: profile } = await supabase.from('profiles').select('role')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()

  const { data: fazendas } = await supabase
    .from('fazendas')
    .select(`
      id, nome, municipio, uf, area_total_ha, unidade,
      fornecedor_principal, vencimento_contrato, unidade_industrial,
      codigo_externo, observacoes, created_at,
      talhoes(id, nome, area_ha, variedade, status_colheita, numero_corte, cultura_atual)
    `)
    .order('nome')

  return <FazendasClient fazendas={fazendas ?? []} role={profile?.role ?? 'viewer'} />
}
