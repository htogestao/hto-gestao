import { createClient } from '@/lib/supabase/server'
import { ComprasClient } from './compras-client'
export const dynamic = 'force-dynamic'

export default async function ComprasPage() {
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('role')
    .eq('id', (await supabase.auth.getUser()).data.user!.id).single()
  const [{ data: lotes }, { data: defensivos }, { data: culturas }] = await Promise.all([
    supabase.from('lotes')
      .select(`
        id, numero_nf, fornecedor, data_compra, quantidade_comprada, quantidade_atual,
        preco_unitario, valor_total, data_fabricacao, data_vencimento, lote_fabricante, observacoes, created_at, cultura_id,
        defensivo:defensivos(id, nome_comercial, unidade, empresa),
        cultura:culturas(id, nome)
      `)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('defensivos').select('id, nome_comercial, unidade').order('nome_comercial'),
    supabase.from('culturas').select('id, nome').eq('ativo', true).order('nome'),
  ])

  return <ComprasClient lotes={(lotes ?? []) as any} defensivos={(defensivos ?? []) as any} culturas={culturas ?? []} role={profile?.role ?? 'viewer'} />
}
