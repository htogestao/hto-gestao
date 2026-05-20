import { createClient } from '@/lib/supabase/server'
import { EstoqueTable } from './estoque-table'

export const dynamic = 'force-dynamic'

export default async function EstoquePage() {
  const supabase = await createClient()

  const { data: profile } = await supabase.from('profiles').select('role')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()

  const { data: estoque } = await supabase.rpc('estoque_atual')

  const { data: lotes } = await supabase
    .from('lotes')
    .select(`
      id, numero_nf, fornecedor, data_compra, quantidade_comprada, quantidade_atual,
      preco_unitario, valor_total, data_vencimento, lote_fabricante, observacoes,
      defensivo:defensivos(id, nome_comercial, unidade)
    `)
    .order('data_vencimento', { ascending: true, nullsFirst: false })

  return (
    <EstoqueTable
      estoque={estoque ?? []}
      lotes={(lotes ?? []) as any}
      role={profile?.role ?? 'viewer'}
    />
  )
}
