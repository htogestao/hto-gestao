import { createClient } from '@/lib/supabase/server'
import { EstoqueTable } from './estoque-table'

export const dynamic = 'force-dynamic'

export default async function EstoquePage() {
  const supabase = await createClient()

  const { data: profile } = await supabase.from('profiles').select('role')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()

  const { data: estoque } = await supabase.rpc('estoque_atual')

  // Líder (field) lê pela view sem colunas de preço (migration 018): o preço
  // não chega nem à resposta da API, não só à tela.
  const isField = profile?.role === 'field'
  const { data: lotes } = await supabase
    .from(isField ? 'lotes_field_view' : 'lotes')
    .select(isField ? `
      id, numero_nf, fornecedor, data_compra, quantidade_comprada, quantidade_atual,
      data_vencimento, lote_fabricante, observacoes,
      defensivo:defensivos(id, nome_comercial, unidade)
    ` : `
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
