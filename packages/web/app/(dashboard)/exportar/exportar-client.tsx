'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react'

type TipoExport = 'estoque' | 'movimentacoes' | 'aplicacoes' | 'compras' | 'fazendas_talhoes'

interface ExportOption {
  key: TipoExport; label: string; desc: string; adminOnly?: boolean
}

const OPTIONS: ExportOption[] = [
  { key: 'estoque',          label: 'Estoque Atual',           desc: 'Defensivos, lotes, quantidades, vencimentos e valores' },
  { key: 'fazendas_talhoes', label: 'Fazendas e Talhões',      desc: 'Lista completa com áreas, variedades e status de colheita' },
  { key: 'aplicacoes',       label: 'Aplicações por período',  desc: 'Histórico de aplicações com defensivos, doses e responsáveis' },
  { key: 'movimentacoes',    label: 'Movimentações',           desc: 'Entradas, saídas, devoluções por período' },
  { key: 'compras',          label: 'Histórico de Compras (NFs)', desc: 'NFs, fornecedores, valores e vencimentos', adminOnly: true },
]

export function ExportarClient({ role }: { role: string }) {
  const supabase   = createClient()
  const [dataInicio, setDataInicio] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString().split('T')[0]
  )
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0])
  const [carregando, setCarregando] = useState<TipoExport | null>(null)

  async function exportar(tipo: TipoExport) {
    setCarregando(tipo)
    try {
      const wb = XLSX.utils.book_new()
      const hoje = new Date().toISOString().split('T')[0]

      if (tipo === 'estoque') {
        const { data: estoque } = await supabase.rpc('estoque_atual')
        const { data: lotes }   = await supabase.from('lotes').select(`
          numero_nf, fornecedor, data_compra, quantidade_comprada, quantidade_atual,
          preco_unitario, valor_total, data_vencimento, lote_fabricante, observacoes,
          defensivo:defensivos(nome_comercial, unidade, empresa)
        `).order('data_vencimento', { ascending: true, nullsFirst: false })

        // Aba 1: Resumo
        const resumo = estoque?.map(e => ({
          'Defensivo':        e.nome_comercial,
          'Princípio Ativo':  e.principio_ativo,
          'Classe':           e.classe,
          'Empresa':          e.empresa ?? '',
          'Unidade':          e.unidade,
          'Qtd Total':        e.quantidade_total,
          'Estoque Mín.':     e.estoque_minimo,
          'Status':           e.tem_vencido ? 'VENCIDO' : e.em_alerta ? 'ABAIXO DO MÍNIMO' : 'OK',
        })) ?? []
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo')

        // Aba 2: Lotes
        const lotesExport = lotes?.map(l => ({
          'Defensivo':       (l.defensivo as { nome_comercial: string; unidade: string; empresa?: string | null } | null)?.nome_comercial ?? '',
          'NF':              l.numero_nf ?? '',
          'Fornecedor':      l.fornecedor ?? '',
          'Data Compra':     l.data_compra ?? '',
          'Qtd Comprada':    l.quantidade_comprada,
          'Qtd Atual':       l.quantidade_atual,
          'Preço Unit.':     l.preco_unitario ?? '',
          'Valor Total':     l.valor_total ?? '',
          'Vencimento':      l.data_vencimento ?? '',
          'Lote Fabricante': l.lote_fabricante ?? '',
          'Observações':     l.observacoes ?? '',
        })) ?? []
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lotesExport), 'Lotes Detalhado')
        XLSX.writeFile(wb, `estoque_${hoje}.xlsx`)

      } else if (tipo === 'fazendas_talhoes') {
        const { data: fazendas } = await supabase.from('fazendas')
          .select('nome,municipio,uf,area_total_ha,polo,fornecedor_principal,vencimento_contrato,unidade_industrial')
          .order('nome')
        const { data: talhoes } = await supabase.from('talhoes')
          .select('nome,area_ha,cultura_atual,variedade,numero_corte,status_colheita,sistema_colheita,data_plantio,tch_estimado,toneladas_estimadas,fazenda:fazendas(nome)')
          .order('nome')

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
          fazendas?.map(f => ({
            'Fazenda':         f.nome,
            'Município':       f.municipio ?? '',
            'UF':              f.uf ?? '',
            'Área Total (ha)': f.area_total_ha ?? '',
            'Polo':            f.polo ?? '',
            'Fornecedor':      f.fornecedor_principal ?? '',
            'Venc. Contrato':  f.vencimento_contrato ?? '',
            'Unid. Industrial':f.unidade_industrial ?? '',
          })) ?? []
        ), 'Fazendas')

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
          talhoes?.map(t => ({
            'Fazenda':        (t.fazenda as { nome: string } | null)?.nome ?? '',
            'Talhão':         t.nome,
            'Cultura':        t.cultura_atual ?? '',
            'Variedade':      t.variedade ?? '',
            'Nº Corte':       t.numero_corte ?? '',
            'Área (ha)':      t.area_ha ?? '',
            'Status Colheita':t.status_colheita ?? '',
            'Sistema':        t.sistema_colheita ?? '',
            'Data Plantio':   t.data_plantio ?? '',
            'TCH Estimado':   t.tch_estimado ?? '',
            'Ton. Estimadas': t.toneladas_estimadas ?? '',
          })) ?? []
        ), 'Talhões')
        XLSX.writeFile(wb, `fazendas_talhoes_${hoje}.xlsx`)

      } else if (tipo === 'aplicacoes') {
        const { data: aplic } = await supabase.from('aplicacoes')
          .select(`
            data, status, area_aplicada_ha, praga_alvo, condicoes_climaticas, observacoes,
            fazenda:fazendas(nome), talhao:talhoes(nome),
            responsavel:profiles(nome),
            itens:aplicacao_itens(
              quantidade_usada, quantidade_sobrou, dose_por_hectare, calda_total_l,
              defensivo:defensivos(nome_comercial),
              lote:lotes(numero_nf)
            )
          `)
          .gte('data', dataInicio).lte('data', dataFim).order('data', { ascending: false })

        const rows = aplic?.flatMap(a => {
          const itens = (a.itens as Array<{
            quantidade_usada: number; quantidade_sobrou: number
            dose_por_hectare: number | null; calda_total_l: number | null
            defensivo: { nome_comercial: string } | null
            lote: { numero_nf: string | null } | null
          }> | null) ?? []
          if (itens.length === 0) return [{
            'Data': a.data, 'Status': a.status,
            'Fazenda': (a.fazenda as { nome: string } | null)?.nome ?? '',
            'Talhão': (a.talhao as { nome: string } | null)?.nome ?? '',
            'Área (ha)': a.area_aplicada_ha ?? '',
            'Responsável': (a.responsavel as { nome: string } | null)?.nome ?? '',
            'Defensivo': '', 'NF Lote': '', 'Dose/ha': '', 'Qtd Usada': '', 'Sobrou': '',
            'Praga': a.praga_alvo ?? '', 'Condições': a.condicoes_climaticas ?? '',
          }]
          return itens.map(it => ({
            'Data': a.data, 'Status': a.status,
            'Fazenda': (a.fazenda as { nome: string } | null)?.nome ?? '',
            'Talhão': (a.talhao as { nome: string } | null)?.nome ?? '',
            'Área (ha)': a.area_aplicada_ha ?? '',
            'Responsável': (a.responsavel as { nome: string } | null)?.nome ?? '',
            'Defensivo': it.defensivo?.nome_comercial ?? '',
            'NF Lote': it.lote?.numero_nf ?? '',
            'Dose/ha': it.dose_por_hectare ?? '',
            'Qtd Usada': it.quantidade_usada,
            'Sobrou': it.quantidade_sobrou,
            'Praga': a.praga_alvo ?? '',
            'Condições': a.condicoes_climaticas ?? '',
          }))
        }) ?? []
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Aplicações')
        XLSX.writeFile(wb, `aplicacoes_${dataInicio}_${dataFim}.xlsx`)

      } else if (tipo === 'movimentacoes') {
        const { data: movim } = await supabase.from('movimentacoes')
          .select(`
            data_hora, tipo, quantidade, observacoes,
            defensivo:defensivos(nome_comercial, unidade),
            lote:lotes(numero_nf),
            usuario:profiles(nome)
          `)
          .gte('data_hora', dataInicio).lte('data_hora', dataFim + 'T23:59:59')
          .order('data_hora', { ascending: false })

        const rows = movim?.map(m => ({
          'Data/Hora':  m.data_hora,
          'Defensivo':  (m.defensivo as { nome_comercial: string; unidade: string } | null)?.nome_comercial ?? '',
          'Lote NF':    (m.lote as { numero_nf: string | null } | null)?.numero_nf ?? '',
          'Tipo':       m.tipo,
          'Quantidade': m.quantidade,
          'Unidade':    (m.defensivo as { nome_comercial: string; unidade: string } | null)?.unidade ?? '',
          'Usuário':    (m.usuario as { nome: string } | null)?.nome ?? '',
          'Observações':m.observacoes ?? '',
        })) ?? []
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Movimentações')
        XLSX.writeFile(wb, `movimentacoes_${dataInicio}_${dataFim}.xlsx`)

      } else if (tipo === 'compras') {
        const { data: lotes } = await supabase.from('lotes')
          .select(`
            numero_nf, fornecedor, data_compra, quantidade_comprada, quantidade_atual,
            preco_unitario, valor_total, data_fabricacao, data_vencimento, lote_fabricante, observacoes,
            defensivo:defensivos(nome_comercial, unidade, empresa)
          `)
          .gte('data_compra', dataInicio).lte('data_compra', dataFim)
          .order('data_compra', { ascending: false })

        const rows = lotes?.map(l => ({
          'Data Compra':  l.data_compra ?? '',
          'Defensivo':    (l.defensivo as { nome_comercial: string; unidade: string; empresa?: string | null } | null)?.nome_comercial ?? '',
          'Empresa':      (l.defensivo as { nome_comercial: string; unidade: string; empresa?: string | null } | null)?.empresa ?? '',
          'NF':           l.numero_nf ?? '',
          'Fornecedor':   l.fornecedor ?? '',
          'Qtd Comprada': l.quantidade_comprada,
          'Unidade':      (l.defensivo as { nome_comercial: string; unidade: string; empresa?: string | null } | null)?.unidade ?? '',
          'Preço Unit.':  l.preco_unitario ?? '',
          'Valor Total':  l.valor_total ?? '',
          'Fabricação':   l.data_fabricacao ?? '',
          'Vencimento':   l.data_vencimento ?? '',
          'Lote Fab.':    l.lote_fabricante ?? '',
        })) ?? []
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Compras')
        XLSX.writeFile(wb, `compras_${dataInicio}_${dataFim}.xlsx`)
      }
    } finally {
      setCarregando(null)
    }
  }

  const visibleOptions = OPTIONS.filter(o => !o.adminOnly || role === 'admin')

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Exportar Excel</h1>
        <p className="text-sm text-muted-foreground mt-1">Baixe relatórios em formato .xlsx</p>
      </div>

      {/* Período */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Período para exportações</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">De:</label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Até:</label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
          </div>
        </CardContent>
      </Card>

      {/* Opções */}
      <div className="grid gap-3">
        {visibleOptions.map(opt => (
          <Card key={opt.key} className="hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </div>
              <Button
                onClick={() => exportar(opt.key)}
                disabled={carregando !== null}
                variant="outline"
              >
                {carregando === opt.key
                  ? <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  : <Download className="h-4 w-4 mr-2" />}
                Exportar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
