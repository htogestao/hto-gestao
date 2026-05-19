'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatarData, formatarMoeda, formatarNumero } from '@/lib/utils'
import { FileText, RefreshCw, Printer } from 'lucide-react'

interface FazSimple { id: string; nome: string }

const RELATORIOS = [
  { key: 'estoque',     label: 'Estoque Atual',              desc: 'Lista completa de defensivos, saldos e vencimentos', adminOnly: false },
  { key: 'aplicacoes',  label: 'Aplicações por Período',     desc: 'Histórico de aplicações com defensivos e doses',     adminOnly: false },
  { key: 'compras',     label: 'Histórico de Compras',       desc: 'NFs, fornecedores, valores investidos',              adminOnly: false },
  { key: 'executivo',   label: 'Relatório Executivo',        desc: 'Custo por fazenda, custo/ha, defensivos mais usados', adminOnly: false },
]

export function RelatoriosClient({ role, fazendas }: { role: string; fazendas: FazSimple[] }) {
  const supabase = createClient()
  const [dataIni, setIni]     = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [dataFim, setFim]     = useState(new Date().toISOString().split('T')[0])
  const [fazenda, setFazenda] = useState('todas')
  const [loading, setLoading] = useState<string | null>(null)

  async function gerarPDF(tipo: string) {
    setLoading(tipo)
    try {
      const supabase2 = createClient()

      if (tipo === 'estoque') {
        const { data: estoque } = await supabase2.rpc('estoque_atual')
        const { data: lotes }   = await supabase2.from('lotes')
          .select('id, numero_nf, quantidade_atual, data_vencimento, preco_unitario, defensivo:defensivos(nome_comercial, unidade)')
          .gt('quantidade_atual', 0).order('data_vencimento', { ascending: true, nullsFirst: false })

        imprimirEstoque(estoque ?? [], lotes ?? [], dataIni, dataFim)

      } else if (tipo === 'aplicacoes') {
        const q = supabase2.from('aplicacoes')
          .select(`data, status, area_aplicada_ha, praga_alvo,
            fazenda:fazendas(nome), talhao:talhoes(nome),
            responsavel:profiles(nome),
            itens:aplicacao_itens(
              quantidade_usada, quantidade_sobrou, dose_por_hectare,
              defensivo:defensivos(nome_comercial, unidade)
            )`)
          .gte('data', dataIni).lte('data', dataFim).order('data', { ascending: false })

        if (fazenda !== 'todas') q.eq('fazenda_id', fazenda)
        const { data: aplic } = await q
        imprimirAplicacoes(aplic ?? [], dataIni, dataFim)

      } else if (tipo === 'compras') {
        const { data: lotes } = await supabase2.from('lotes')
          .select('numero_nf, fornecedor, data_compra, quantidade_comprada, preco_unitario, valor_total, data_vencimento, defensivo:defensivos(nome_comercial, unidade, empresa)')
          .gte('data_compra', dataIni).lte('data_compra', dataFim).order('data_compra', { ascending: false })
        imprimirCompras(lotes ?? [], dataIni, dataFim)

      } else if (tipo === 'executivo') {
        const { data: aplic } = await supabase2.from('aplicacoes')
          .select(`fazenda_id, area_aplicada_ha, fazenda:fazendas(nome),
            itens:aplicacao_itens(quantidade_usada, lote:lotes(preco_unitario), defensivo:defensivos(nome_comercial))`)
          .gte('data', dataIni).lte('data', dataFim).eq('status', 'encerrada')
        imprimirExecutivo(aplic ?? [], dataIni, dataFim)
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">Gere relatórios em PDF para impressão ou compartilhamento</p>
      </div>

      {/* Filtros globais */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Filtros do período</p>
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">De:</label>
              <Input type="date" value={dataIni} onChange={e => setIni(e.target.value)} className="w-36" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Até:</label>
              <Input type="date" value={dataFim} onChange={e => setFim(e.target.value)} className="w-36" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Fazenda:</label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={fazenda} onChange={e => setFazenda(e.target.value)}>
                <option value="todas">Todas</option>
                {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de relatórios */}
      <div className="grid gap-3">
        {RELATORIOS.map(r => (
          <Card key={r.key} className="hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
              <Button onClick={() => gerarPDF(r.key)} disabled={loading !== null} variant="outline">
                {loading === r.key
                  ? <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  : <Printer className="h-4 w-4 mr-2" />}
                Gerar PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Helpers de impressão (window.print com HTML inline) ─────────────────────
function abrirJanelaPDF(titulo: string, html: string) {
  const w = window.open('', '_blank', 'width=900,height=700')!
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="utf-8"/>
    <title>${titulo}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#1a1a1a}
      h1{font-size:18px;margin-bottom:4px}
      .sub{color:#666;font-size:11px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#166534;color:#fff;padding:6px 8px;text-align:left;font-size:11px}
      td{padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}
      tr:nth-child(even) td{background:#f9fafb}
      .right{text-align:right} .center{text-align:center}
      .badge{display:inline-block;padding:2px 6px;border-radius:9999px;font-size:10px}
      .ok{background:#dcfce7;color:#166534} .alerta{background:#fee2e2;color:#991b1b}
      .section{margin-top:24px;font-weight:bold;font-size:13px;border-bottom:2px solid #166534;padding-bottom:4px;margin-bottom:8px}
      @media print{button{display:none}}
    </style>
  </head><body>
    <button onclick="window.print()" style="margin-bottom:12px;padding:6px 16px;background:#166534;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimir</button>
    ${html}
  </body></html>`)
  w.document.close()
}

function imprimirEstoque(estoque: Record<string,unknown>[], lotes: Record<string,unknown>[], ini: string, fim: string) {
  const rows = estoque.map((e: Record<string,unknown>) => `
    <tr>
      <td>${e.nome_comercial}</td>
      <td>${e.principio_ativo}</td>
      <td>${String(e.classe).replace(/_/g,' ')}</td>
      <td class="right">${formatarNumero(e.quantidade_total as number, 1)} ${e.unidade}</td>
      <td class="right">${formatarNumero(e.estoque_minimo as number, 1)} ${e.unidade}</td>
      <td class="center"><span class="badge ${e.em_alerta || e.tem_vencido ? 'alerta' : 'ok'}">${e.tem_vencido ? 'VENCIDO' : e.em_alerta ? 'BAIXO' : 'OK'}</span></td>
    </tr>`).join('')

  abrirJanelaPDF('Estoque Atual', `
    <h1>Relatório de Estoque Atual</h1>
    <div class="sub">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
    <table>
      <thead><tr><th>Defensivo</th><th>Princípio Ativo</th><th>Classe</th><th class="right">Qtd Total</th><th class="right">Mínimo</th><th class="center">Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`)
}

function imprimirAplicacoes(aplic: Record<string,unknown>[], ini: string, fim: string) {
  const rows = aplic.map((a: Record<string,unknown>) => {
    const fazenda = (a.fazenda as { nome: string } | null)?.nome ?? '—'
    const talhao  = (a.talhao as { nome: string } | null)?.nome ?? '—'
    const resp    = (a.responsavel as { nome: string } | null)?.nome ?? '—'
    const itens   = (a.itens as Array<{ quantidade_usada: number; dose_por_hectare: number | null; defensivo: { nome_comercial: string; unidade: string } | null }>) ?? []
    const defStr  = itens.map(i => `${i.defensivo?.nome_comercial ?? ''} ${formatarNumero(i.quantidade_usada, 1)}${i.defensivo?.unidade}`).join(', ')
    return `<tr>
      <td>${formatarData(a.data as string)}</td>
      <td>${fazenda}</td><td>${talhao}</td>
      <td class="right">${formatarNumero(a.area_aplicada_ha as number, 1)} ha</td>
      <td>${defStr}</td>
      <td>${a.praga_alvo ?? '—'}</td>
      <td>${resp}</td>
    </tr>`
  }).join('')

  abrirJanelaPDF('Aplicações por Período', `
    <h1>Aplicações — ${formatarData(ini)} a ${formatarData(fim)}</h1>
    <div class="sub">Gerado em ${new Date().toLocaleString('pt-BR')} · ${aplic.length} registros</div>
    <table>
      <thead><tr><th>Data</th><th>Fazenda</th><th>Talhão</th><th class="right">Área</th><th>Defensivos</th><th>Praga</th><th>Responsável</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`)
}

function imprimirCompras(lotes: Record<string,unknown>[], ini: string, fim: string) {
  const total = (lotes as Array<{ valor_total?: number | null }>).reduce((s, l) => s + (l.valor_total ?? 0), 0)
  const rows  = lotes.map((l: Record<string,unknown>) => {
    const def = (l.defensivo as { nome_comercial: string; unidade: string; empresa: string | null } | null)
    return `<tr>
      <td>${formatarData(l.data_compra as string)}</td>
      <td>${def?.nome_comercial ?? '—'}</td>
      <td>${def?.empresa ?? '—'}</td>
      <td>${l.numero_nf ?? 'S/NF'}</td>
      <td>${l.fornecedor ?? '—'}</td>
      <td class="right">${formatarNumero(l.quantidade_comprada as number, 1)} ${def?.unidade}</td>
      <td class="right">${formatarMoeda(l.preco_unitario as number)}</td>
      <td class="right"><strong>${formatarMoeda(l.valor_total as number)}</strong></td>
      <td>${formatarData(l.data_vencimento as string)}</td>
    </tr>`
  }).join('')

  abrirJanelaPDF('Histórico de Compras', `
    <h1>Histórico de Compras — ${formatarData(ini)} a ${formatarData(fim)}</h1>
    <div class="sub">Total investido: <strong>${formatarMoeda(total)}</strong> · Gerado em ${new Date().toLocaleString('pt-BR')}</div>
    <table>
      <thead><tr><th>Data</th><th>Produto</th><th>Empresa</th><th>NF</th><th>Fornecedor</th><th class="right">Qtd</th><th class="right">Preço Unit.</th><th class="right">Total</th><th>Vencimento</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`)
}

function imprimirExecutivo(aplic: Record<string,unknown>[], ini: string, fim: string) {
  type AplicItem = {
    fazenda_id: string
    area_aplicada_ha: number | null
    fazenda: { nome: string } | null
    itens: Array<{
      quantidade_usada: number
      lote: { preco_unitario: number | null } | null
      defensivo: { nome_comercial: string } | null
    }>
  }
  const aplicTyped = aplic as unknown as AplicItem[]

  // Agrupar por fazenda
  const porFazenda = new Map<string, { nome: string; area: number; custo: number; count: number }>()
  aplicTyped.forEach(a => {
    const key  = a.fazenda_id
    const nome = a.fazenda?.nome ?? key
    const area = a.area_aplicada_ha ?? 0
    const custo = (a.itens ?? []).reduce((s, i) => s + i.quantidade_usada * (i.lote?.preco_unitario ?? 0), 0)
    const ex = porFazenda.get(key) ?? { nome, area: 0, custo: 0, count: 0 }
    porFazenda.set(key, { nome, area: ex.area + area, custo: ex.custo + custo, count: ex.count + 1 })
  })

  const totalCusto = [...porFazenda.values()].reduce((s, f) => s + f.custo, 0)
  const totalArea  = [...porFazenda.values()].reduce((s, f) => s + f.area, 0)

  const rowsFaz = [...porFazenda.values()].sort((a,b) => b.custo - a.custo).map(f => `
    <tr>
      <td>${f.nome}</td>
      <td class="right">${formatarNumero(f.area, 1)} ha</td>
      <td class="right">${f.count}</td>
      <td class="right">${formatarMoeda(f.custo)}</td>
      <td class="right">${f.area > 0 ? formatarMoeda(f.custo / f.area) : '—'}/ha</td>
    </tr>`).join('')

  // Defensivos mais usados
  const porDef = new Map<string, number>()
  aplicTyped.forEach(a => {
    (a.itens ?? []).forEach(i => {
      const n = i.defensivo?.nome_comercial ?? '?'
      porDef.set(n, (porDef.get(n) ?? 0) + i.quantidade_usada)
    })
  })
  const rowsDef = [...porDef.entries()].sort((a,b) => b[1]-a[1]).slice(0,10).map(([n,q]) =>
    `<tr><td>${n}</td><td class="right">${formatarNumero(q, 1)}</td></tr>`).join('')

  abrirJanelaPDF('Relatório Executivo', `
    <h1>Relatório Executivo — ${formatarData(ini)} a ${formatarData(fim)}</h1>
    <div class="sub">Total aplicado: ${formatarMoeda(totalCusto)} · Área: ${formatarNumero(totalArea,1)} ha · Custo médio: ${totalArea > 0 ? formatarMoeda(totalCusto/totalArea) : '—'}/ha</div>

    <div class="section">Custo por Fazenda</div>
    <table>
      <thead><tr><th>Fazenda</th><th class="right">Área (ha)</th><th class="right">Aplicações</th><th class="right">Custo Total</th><th class="right">Custo/ha</th></tr></thead>
      <tbody>${rowsFaz}</tbody>
    </table>

    <div class="section">Defensivos Mais Utilizados (volume)</div>
    <table>
      <thead><tr><th>Defensivo</th><th class="right">Volume Total</th></tr></thead>
      <tbody>${rowsDef}</tbody>
    </table>`)
}
