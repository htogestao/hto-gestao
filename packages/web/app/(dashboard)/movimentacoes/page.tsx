import { createClient } from '@/lib/supabase/server'
import { MovimentacoesClient } from './movimentacoes-client'
export const dynamic = 'force-dynamic'

export default async function MovimentacoesPage() {
  const supabase = await createClient()
  const dataIni = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0]
  const { data } = await supabase
    .from('movimentacoes')
    .select(`
      id, tipo, quantidade, data_hora, observacoes,
      defensivo:defensivos(nome_comercial, unidade),
      lote:lotes(numero_nf),
      usuario:profiles(nome)
    `)
    .gte('data_hora', dataIni)
    .order('data_hora', { ascending: false })
    .limit(500)
  return <MovimentacoesClient movimentacoes={data ?? []} dataIniPadrao={dataIni} />
}
