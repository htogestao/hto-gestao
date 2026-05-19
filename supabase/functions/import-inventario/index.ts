/**
 * Edge Function: import-inventario
 * Lê o arquivo Inventario MV (formato SIG) enviado como FormData
 * e upsert fazendas + talhoes no banco.
 *
 * POST /functions/v1/import-inventario
 * Content-Type: multipart/form-data
 * Body: file = <inventario.xlsx>
 *
 * Mapeamento de colunas (linha 1 = cabeçalho):
 * CHAVESIG, SAFRA, POLO, EMPRESA, EMPDESC, MOD, NUM, FAZENDA,
 * SETOR, TALHAO, BLOCO, BLOCO_COLH, BLOCO_PLAN, AREA_HA, AREA_DANO,
 * VARIED, MAN_HIPOT, ESTAGIO, TIPO_PROP, DATA_PLANTIO, FRENTE,
 * DEVOLUCAO, REFORMA, TP_REFORMA, SIST_PLANT, VINHACA_E, SISTEMA_COL,
 * DIST_TERRA, DIST_ASFALTO, DIST_HIDR, UNID_IND, AMBIENTE, ESPAC,
 * AREA_PROD, TCH_PROD, TON_ESTIM, ... SIT_TALHAO, DATA_FECHA,
 * CANA_ENT, ADMIN, FORNEC, DT_VENC_CONTR
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verificar role admin
    const authHeader = req.headers.get('Authorization')
    const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') ?? '')
    if (!user) return new Response('Não autorizado', { status: 401, headers: corsHeaders })

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin')
      return new Response('Apenas admins podem importar', { status: 403, headers: corsHeaders })

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return new Response('Arquivo não enviado', { status: 400, headers: corsHeaders })

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null })

    const colMap: Record<string, string> = {
      CHAVESIG: 'codigo_sig', SAFRA: 'safra', POLO: 'polo',
      NUM: 'codigo_externo', FAZENDA: 'fazenda_nome',
      SETOR: 'setor', TALHAO: 'numero_talhao', BLOCO: 'bloco',
      BLOCO_COLH: 'bloco_colheita', AREA_HA: 'area_ha', AREA_DANO: 'area_dano',
      VARIED: 'variedade', ESTAGIO: 'estagio_raw',
      DATA_PLANTIO: 'data_plantio', SISTEMA_COL: 'sistema_col_raw',
      DIST_TERRA: 'dist_terra_km', DIST_ASFALTO: 'dist_asfalto_km',
      UNID_IND: 'unidade_industrial', AMBIENTE: 'ambiente', ESPAC: 'espacamento',
      AREA_PROD: 'area_prod', TCH_PROD: 'tch_estimado', TON_ESTIM: 'toneladas_estimadas',
      SIT_TALHAO: 'sit_talhao_raw', FORNEC: 'fornecedor', DT_VENC_CONTR: 'venc_contrato_raw',
    }

    // Parse helpers
    function parseSistemaColheita(raw: unknown): string | null {
      const s = String(raw ?? '').trim().toUpperCase()
      if (s.includes('MECANI')) return 'mecanizada'
      if (s.includes('MANUAL')) return 'manual'
      if (s.includes('SEMI'))   return 'semimecanizada'
      return null
    }
    function parseStatusColheita(raw: unknown): string | null {
      const s = String(raw ?? '').trim().toUpperCase()
      if (s.includes('A COLHER') || s.includes('COLHER')) return 'a_colher'
      if (s.includes('COLHENDO')) return 'colhendo'
      if (s.includes('COLHIDO')) return 'colhido'
      if (s.includes('REFORMA')) return 'reforma'
      return 'outro'
    }
    function parseCorte(estagio: unknown): number | null {
      const s = String(estagio ?? '')
      const m = s.match(/(\d+)[°o\.]?\s*[Cc]orte/i) || s.match(/^(\d+)/)
      return m ? parseInt(m[1]) : null
    }
    function parseDate(v: unknown): string | null {
      if (!v) return null
      if (v instanceof Date) return v.toISOString().split('T')[0]
      const s = String(v)
      // DD/MM/YYYY
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (m) return `${m[3]}-${m[2]}-${m[1]}`
      return null
    }

    // Normalizar linhas
    const normalized = rows.map((raw) => {
      const r: Record<string, unknown> = {}
      for (const [src, dst] of Object.entries(colMap)) {
        r[dst] = raw[src] ?? null
      }
      return r
    }).filter((r) => r.fazenda_nome)

    // Upsert fazendas
    const fazendaMap = new Map<string, string>() // nome → id
    const uniqueFazendas = [...new Set(normalized.map((r) => r.fazenda_nome as string))]

    for (const nome of uniqueFazendas) {
      const row = normalized.find((r) => r.fazenda_nome === nome)!
      const { data: faz } = await supabase
        .from('fazendas')
        .upsert({
          nome: nome,
          codigo_externo: row.codigo_externo ? String(row.codigo_externo) : null,
          polo: row.polo ? String(row.polo) : null,
          unidade_industrial: row.unidade_industrial ? String(row.unidade_industrial) : null,
          fornecedor_principal: row.fornecedor ? String(row.fornecedor) : null,
          vencimento_contrato: parseDate(row.venc_contrato_raw),
          created_by: user.id,
        }, { onConflict: 'nome', ignoreDuplicates: false })
        .select('id, nome')
        .single()
      if (faz) fazendaMap.set(nome, faz.id)
    }

    // Upsert talhões
    let inserted = 0
    let updated = 0

    for (const row of normalized) {
      const fazendaId = fazendaMap.get(row.fazenda_nome as string)
      if (!fazendaId) continue

      const talhao = {
        fazenda_id:         fazendaId,
        nome:               `Talhão ${row.numero_talhao}`,
        codigo_sig:         row.codigo_sig ? String(row.codigo_sig) : null,
        numero_talhao:      row.numero_talhao ? Number(row.numero_talhao) : null,
        setor:              row.setor ? Number(row.setor) : null,
        bloco:              row.bloco ? Number(row.bloco) : null,
        bloco_colheita:     row.bloco_colheita ? Number(row.bloco_colheita) : null,
        cultura_atual:      'Cana',
        variedade:          row.variedade ? String(row.variedade) : null,
        numero_corte:       parseCorte(row.estagio_raw),
        area_ha:            row.area_ha ? Number(String(row.area_ha).replace(',','.')) : null,
        data_plantio:       parseDate(row.data_plantio),
        sistema_colheita:   parseSistemaColheita(row.sistema_col_raw),
        status_colheita:    parseStatusColheita(row.sit_talhao_raw),
        tch_estimado:       row.tch_estimado ? Number(row.tch_estimado) : null,
        toneladas_estimadas:row.toneladas_estimadas ? Number(row.toneladas_estimadas) : null,
        dist_terra_km:      row.dist_terra_km ? Number(row.dist_terra_km) : null,
        dist_asfalto_km:    row.dist_asfalto_km ? Number(row.dist_asfalto_km) : null,
        unidade_industrial: row.unidade_industrial ? String(row.unidade_industrial) : null,
        ambiente:           row.ambiente ? String(row.ambiente) : null,
        espacamento:        row.espacamento ? String(row.espacamento) : null,
      }

      const { data: existing } = await supabase
        .from('talhoes')
        .select('id')
        .eq('fazenda_id', fazendaId)
        .eq('numero_talhao', talhao.numero_talhao ?? -1)
        .eq('setor', talhao.setor ?? -1)
        .maybeSingle()

      if (existing) {
        await supabase.from('talhoes').update(talhao).eq('id', existing.id)
        updated++
      } else {
        await supabase.from('talhoes').insert(talhao)
        inserted++
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        fazendas_processadas: uniqueFazendas.length,
        talhoes_inseridos:    inserted,
        talhoes_atualizados:  updated,
        total_linhas:         rows.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
