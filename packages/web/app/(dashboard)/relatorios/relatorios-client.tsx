'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { formatarData, formatarMoeda, formatarNumero } from '@/lib/utils'
import { FileText, RefreshCw, Printer } from 'lucide-react'

interface FazSimple { id: string; nome: string }
interface CultSimple { id: string; nome: string }

const RELATORIOS = [
  { key: 'estoque',          label: 'Estoque Atual (com saldo)',   desc: 'Apenas os produtos que têm saldo em estoque' },
  { key: 'estoque_completo', label: 'Estoque Completo (todos)',    desc: 'Todos os produtos cadastrados, inclusive os zerados' },
  { key: 'vencimentos',      label: 'Vencidos e a Vencer',         desc: 'Produtos vencidos ou que vencem nos próximos 90 dias' },
  { key: 'aplicacoes',  label: 'Aplicações por Período',     desc: 'Histórico de aplicações com defensivos e doses' },
  { key: 'aplicacoes_fazenda', label: 'Aplicações por Fazenda (completo)', desc: 'Detalhado por fazenda: talhões, produtos, pragas, rankings e carência' },
  { key: 'compras',     label: 'Histórico de Compras',       desc: 'NFs, fornecedores, valores investidos', financeiro: true },
  { key: 'executivo',   label: 'Relatório Executivo',        desc: 'Custo por fazenda, custo/ha, defensivos mais usados', financeiro: true },
  { key: 'custo_talhao',label: 'Custo por Talhão',           desc: 'Quanto foi gasto em defensivos em cada talhão, com custo por hectare', financeiro: true },
]

export function RelatoriosClient({ role, fazendas, culturas }: { role: string; fazendas: FazSimple[]; culturas: CultSimple[] }) {
  const supabase = createClient()
  const [dataIni, setIni]     = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [dataFim, setFim]     = useState(new Date().toISOString().split('T')[0])
  const [fazenda, setFazenda] = useState('todas')
  const [cultura, setCultura] = useState('todas')
  const [loading, setLoading] = useState<string | null>(null)

  async function gerarPDF(tipo: string) {
    // Abre a janela JÁ no clique (antes do await) — senão o navegador bloqueia o pop-up, sobretudo no celular
    pdfWin = window.open('', '_blank')
    if (pdfWin) pdfWin.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Arial,sans-serif;padding:24px;color:#555">Gerando relatório, aguarde…</body></html>')
    setLoading(tipo)
    try {
      const supabase2 = createClient()

      if (tipo === 'estoque' || tipo === 'estoque_completo') {
        const todos = tipo === 'estoque_completo'
        const { data: estoqueRaw } = await supabase2.rpc('estoque_atual')
        // 'estoque' = só com saldo; 'estoque_completo' = todos os produtos
        const estoque = todos
          ? (estoqueRaw ?? [])
          : (estoqueRaw ?? []).filter((e: any) => e.quantidade_total > 0)
        let q = supabase2.from('lotes')
          .select('id, numero_nf, quantidade_atual, data_vencimento, preco_unitario, defensivo:defensivos(nome_comercial, unidade)')
          .order('data_vencimento', { ascending: true, nullsFirst: false })
        if (!todos) q = q.gt('quantidade_atual', 0)
        const { data: lotes } = await q

        imprimirEstoque(estoque ?? [], lotes ?? [], dataIni, dataFim)

      } else if (tipo === 'aplicacoes') {
        let q = supabase2.from('aplicacoes')
          .select(`data, status, area_aplicada_ha, praga_alvo,
            fazenda:fazendas(nome), talhao:talhoes(nome),
            cultura:culturas(nome),
            responsavel:profiles(nome),
            itens:aplicacao_itens(
              quantidade_usada, quantidade_sobrou, dose_por_hectare,
              defensivo:defensivos(nome_comercial, unidade)
            )`)
          .gte('data', dataIni).lte('data', dataFim).order('data', { ascending: false })

        if (fazenda !== 'todas') q = q.eq('fazenda_id', fazenda)
        if (cultura !== 'todas') q = q.eq('cultura_id', cultura)
        const { data: aplic } = await q
        imprimirAplicacoes(aplic ?? [], dataIni, dataFim)

      } else if (tipo === 'vencimentos') {
        const { data: lotes } = await supabase2.from('lotes')
          .select('numero_nf, quantidade_atual, data_vencimento, data_fabricacao, fornecedor, defensivo:defensivos(nome_comercial, unidade, empresa)')
          .gt('quantidade_atual', 0)
          .not('data_vencimento', 'is', null)
          .order('data_vencimento', { ascending: true })
        imprimirVencimentos((lotes ?? []) as any[])

      } else if (tipo === 'aplicacoes_fazenda') {
        let q = supabase2.from('aplicacoes')
          .select(`
            data, status, area_aplicada_ha, praga_alvo, condicoes_climaticas, vazao_l_ha,
            fazenda:fazendas(nome),
            cultura:culturas(nome),
            talhao:talhoes(nome, area_ha),
            talhoes_vinculados:aplicacao_talhoes(talhao:talhoes(nome, area_ha)),
            responsavel:profiles(nome),
            itens:aplicacao_itens(
              quantidade_usada, quantidade_sobrou, dose_por_hectare,
              defensivo:defensivos(nome_comercial, unidade, classe, carencia_dias)
            )
          `)
          .gte('data', dataIni).lte('data', dataFim).order('data', { ascending: true })
        if (fazenda !== 'todas') q = q.eq('fazenda_id', fazenda)
        if (cultura !== 'todas') q = q.eq('cultura_id', cultura)
        const { data: aplic } = await q
        imprimirAplicacoesFazenda((aplic ?? []) as any[], dataIni, dataFim)

      } else if (tipo === 'compras') {
        const { data: lotes } = await supabase2.from('lotes')
          .select('numero_nf, fornecedor, data_compra, quantidade_comprada, preco_unitario, valor_total, data_vencimento, defensivo:defensivos(nome_comercial, unidade, empresa)')
          .gte('data_compra', dataIni).lte('data_compra', dataFim).order('data_compra', { ascending: false })
        imprimirCompras(lotes ?? [], dataIni, dataFim)

      } else if (tipo === 'custo_talhao') {
        let q2 = supabase2.from('aplicacoes')
          .select(`fazenda_id, talhao_id, area_aplicada_ha,
            fazenda:fazendas(nome),
            talhao:talhoes(nome, area_ha),
            itens:aplicacao_itens(quantidade_usada, lote:lotes(preco_unitario), defensivo:defensivos(nome_comercial, classe))`)
          .gte('data', dataIni).lte('data', dataFim).eq('status', 'encerrada')
        if (fazenda !== 'todas') q2 = q2.eq('fazenda_id', fazenda)
        if (cultura !== 'todas') q2 = q2.eq('cultura_id', cultura)
        const { data: aplicCusto } = await q2
        imprimirCustoTalhao(aplicCusto ?? [], dataIni, dataFim)

      } else if (tipo === 'executivo') {
        let qExec = supabase2.from('aplicacoes')
          .select(`fazenda_id, area_aplicada_ha, fazenda:fazendas(nome),
            itens:aplicacao_itens(quantidade_usada, lote:lotes(preco_unitario), defensivo:defensivos(nome_comercial))`)
          .gte('data', dataIni).lte('data', dataFim).eq('status', 'encerrada')
        if (cultura !== 'todas') qExec = qExec.eq('cultura_id', cultura)
        const { data: aplic } = await qExec
        imprimirExecutivo(aplic ?? [], dataIni, dataFim)
      }
    } catch (e: any) {
      if (pdfWin) {
        pdfWin.document.body.innerHTML = `<p style="font-family:Arial,sans-serif;padding:24px;color:#b91c1c">Erro ao gerar o relatório: ${e?.message ?? e}. Feche esta janela e tente de novo.</p>`
        pdfWin = null
      } else {
        alert('Erro ao gerar o relatório: ' + (e?.message ?? e))
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
            {culturas.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Cultura:</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={cultura} onChange={e => setCultura(e.target.value)}>
                  <option value="todas">Todas</option>
                  {culturas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de relatórios (campo não vê os financeiros) */}
      <div className="grid gap-3">
        {RELATORIOS.filter(r => !r.financeiro || role === 'admin' || role === 'viewer').map(r => (
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
// Janela aberta no clique (em gerarPDF) e reutilizada aqui, para não ser bloqueada como pop-up.
let pdfWin: Window | null = null
function abrirJanelaPDF(titulo: string, html: string) {
  const w = pdfWin ?? window.open('', '_blank', 'width=900,height=700')
  pdfWin = null
  if (!w) { alert('Não foi possível abrir o relatório. Habilite os pop-ups para este site e tente novamente.'); return }
  w.document.open()
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

function imprimirVencimentos(lotes: any[]) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dias = (v: string) => Math.floor((new Date(v + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)

  // Considera vencidos + os que vencem em até 90 dias
  const relevantes = lotes
    .map(l => ({ ...l, _dias: dias(l.data_vencimento) }))
    .filter(l => l._dias <= 90)
    .sort((a, b) => a._dias - b._dias)

  const vencidos = relevantes.filter(l => l._dias < 0)
  const aVencer  = relevantes.filter(l => l._dias >= 0)

  const linha = (l: any) => {
    const def = l.defensivo
    const cls = l._dias < 0 ? 'alerta' : l._dias <= 30 ? 'alerta' : 'ok'
    const txt = l._dias < 0 ? `Vencido há ${Math.abs(l._dias)} dias` : `Vence em ${l._dias} dias`
    return `<tr>
      <td>${def?.nome_comercial ?? '—'}</td>
      <td>${def?.empresa ?? '—'}</td>
      <td>${l.numero_nf ?? 'S/NF'}</td>
      <td class="right">${formatarNumero(l.quantidade_atual, 1)} ${def?.unidade ?? ''}</td>
      <td class="center">${formatarData(l.data_vencimento)}</td>
      <td class="center"><span class="badge ${cls}">${txt}</span></td>
    </tr>`
  }

  const tabela = (titulo: string, arr: any[]) => arr.length === 0 ? '' : `
    <div class="section">${titulo} (${arr.length})</div>
    <table>
      <thead><tr><th>Produto</th><th>Empresa</th><th>NF</th><th class="right">Saldo</th><th class="center">Vencimento</th><th class="center">Situação</th></tr></thead>
      <tbody>${arr.map(linha).join('')}</tbody>
    </table>`

  abrirJanelaPDF('Vencidos e a Vencer', `
    <h1>Produtos Vencidos e a Vencer</h1>
    <div class="sub">Gerado em ${new Date().toLocaleString('pt-BR')} · ${vencidos.length} vencido(s) · ${aVencer.length} a vencer (90 dias)</div>
    ${relevantes.length === 0 ? '<p>Nenhum produto vencido ou vencendo nos próximos 90 dias. 👍</p>' : ''}
    ${tabela('🔴 VENCIDOS — descartar/não usar', vencidos)}
    ${tabela('🟡 A VENCER — usar com prioridade', aVencer)}`)
}

function imprimirAplicacoesFazenda(aplic: any[], ini: string, fim: string) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)

  const talsDe = (a: any): { nome: string; area_ha: number | null }[] => {
    if (a.talhoes_vinculados?.length > 0)
      return a.talhoes_vinculados.map((v: any) => v.talhao).filter(Boolean)
    return a.talhao ? [a.talhao] : []
  }

  // Agrupa por fazenda
  const grupos: Record<string, any[]> = {}
  for (const a of aplic) {
    const fz = a.fazenda?.nome ?? 'Sem fazenda'
    ;(grupos[fz] ||= []).push(a)
  }

  let html = `<h1>Relatório de Aplicações por Fazenda</h1>
    <div class="sub">Período ${formatarData(ini)} a ${formatarData(fim)} · Gerado em ${new Date().toLocaleString('pt-BR')} · ${aplic.length} aplicações</div>`

  if (aplic.length === 0) html += `<p>Nenhuma aplicação no período.</p>`

  for (const [fz, apps] of Object.entries(grupos)) {
    const talhoesSet = new Set<string>()
    let areaTotal = 0
    const pragaCount: Record<string, number> = {}
    const produtoVol: Record<string, { qtd: number; un: string }> = {}
    const carencia: { talhao: string; produto: string; liberado: Date }[] = []

    for (const a of apps) {
      const tals = talsDe(a)
      tals.forEach(t => talhoesSet.add(t.nome))
      areaTotal += (a.area_aplicada_ha ?? tals.reduce((s, t) => s + (t.area_ha ?? 0), 0))
      if (a.praga_alvo) pragaCount[a.praga_alvo] = (pragaCount[a.praga_alvo] ?? 0) + 1
      for (const it of (a.itens ?? [])) {
        const consumida = Math.max(0, it.quantidade_usada - (it.quantidade_sobrou ?? 0))
        const nome = it.defensivo?.nome_comercial ?? '—'
        const un = it.defensivo?.unidade ?? ''
        produtoVol[nome] ||= { qtd: 0, un }
        produtoVol[nome].qtd += consumida
        const car = it.defensivo?.carencia_dias
        if (car) {
          const liberado = new Date(new Date(a.data + 'T00:00:00').getTime() + car * 86400000)
          if (liberado > hoje) tals.forEach(t => carencia.push({ talhao: t.nome, produto: nome, liberado }))
        }
      }
    }

    const topPragas   = Object.entries(pragaCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const topProdutos = Object.entries(produtoVol).sort((a, b) => b[1].qtd - a[1].qtd).slice(0, 8)

    html += `<div class="section">🚜 Fazenda: ${fz}</div>
      <p><strong>${apps.length}</strong> aplicações · <strong>${formatarNumero(areaTotal, 1)} ha</strong> tratados ·
      <strong>${talhoesSet.size}</strong> talhões · Pragas: ${topPragas.map(p => p[0]).join(', ') || '—'}</p>`

    // Lista detalhada
    for (const a of apps) {
      const tals = talsDe(a)
      const talStr = tals.map(t => `${t.nome}${t.area_ha ? ` (${t.area_ha} ha)` : ''}`).join(', ') || '—'
      const itRows = (a.itens ?? []).map((it: any) => {
        const consumida = Math.max(0, it.quantidade_usada - (it.quantidade_sobrou ?? 0))
        return `<tr>
          <td>${it.defensivo?.nome_comercial ?? '—'}</td>
          <td>${String(it.defensivo?.classe ?? '').replace(/_/g, ' ')}</td>
          <td class="right">${it.dose_por_hectare ? formatarNumero(it.dose_por_hectare, 3) + ' ' + (it.defensivo?.unidade ?? '') + '/ha' : '—'}</td>
          <td class="right">${formatarNumero(consumida, 1)} ${it.defensivo?.unidade ?? ''}</td>
          <td class="center">${it.defensivo?.carencia_dias != null ? it.defensivo.carencia_dias + 'd' : '—'}</td>
        </tr>`
      }).join('')
      html += `<div style="margin-top:12px;font-size:11px">
          <strong>${formatarData(a.data)}</strong> · Talhões: ${talStr} · ${formatarNumero(a.area_aplicada_ha ?? 0, 1)} ha
          · Praga: ${a.praga_alvo ?? '—'} · Vazão: ${a.vazao_l_ha ? a.vazao_l_ha + ' L/ha' : '—'}
          · ${a.responsavel?.nome ?? '—'}${a.condicoes_climaticas ? ' · ' + a.condicoes_climaticas : ''}
        </div>
        <table>
          <thead><tr><th>Produto</th><th>Classe</th><th class="right">Dose/ha</th><th class="right">Consumido</th><th class="center">Carência</th></tr></thead>
          <tbody>${itRows || '<tr><td colspan="5">Sem produtos</td></tr>'}</tbody>
        </table>`
    }

    // Rankings
    html += `<div class="section">Resumo — ${fz}</div>
      <table>
        <thead><tr><th>Produto mais usado</th><th class="right">Total consumido</th></tr></thead>
        <tbody>${topProdutos.map(p => `<tr><td>${p[0]}</td><td class="right">${formatarNumero(p[1].qtd, 1)} ${p[1].un}</td></tr>`).join('') || '<tr><td>—</td><td class="right">—</td></tr>'}</tbody>
      </table>
      <table>
        <thead><tr><th>Praga / Alvo</th><th class="right">Nº de aplicações</th></tr></thead>
        <tbody>${topPragas.map(p => `<tr><td>${p[0]}</td><td class="right">${p[1]}</td></tr>`).join('') || '<tr><td>—</td><td class="right">0</td></tr>'}</tbody>
      </table>`

    // Alertas de carência
    if (carencia.length > 0) {
      const ordenado = carencia.sort((a, b) => b.liberado.getTime() - a.liberado.getTime())
      html += `<div class="section">⚠️ Talhões em carência (NÃO colher ainda)</div>
        <table>
          <thead><tr><th>Talhão</th><th>Produto</th><th>Liberado a partir de</th></tr></thead>
          <tbody>${ordenado.map(c => `<tr><td>${c.talhao}</td><td>${c.produto}</td><td><span class="badge alerta">${c.liberado.toLocaleDateString('pt-BR')}</span></td></tr>`).join('')}</tbody>
        </table>`
    }
  }

  abrirJanelaPDF('Aplicações por Fazenda', html)
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

function imprimirCustoTalhao(aplic: Record<string,unknown>[], ini: string, fim: string) {
  type AplicItem = {
    fazenda_id: string; talhao_id: string; area_aplicada_ha: number | null
    fazenda: { nome: string } | null
    talhao: { nome: string; area_ha: number | null } | null
    itens: Array<{
      quantidade_usada: number
      lote: { preco_unitario: number | null } | null
      defensivo: { nome_comercial: string; classe: string } | null
    }>
  }
  const aplicTyped = aplic as unknown as AplicItem[]

  // Agrupar por talhão
  const porTalhao = new Map<string, {
    fazenda: string; talhao: string; area_ha: number
    areaAplicada: number; custo: number; count: number
    inseticida: number; fungicida: number; herbicida: number; outros: number
  }>()

  aplicTyped.forEach(a => {
    const key     = a.talhao_id
    const fazenda = a.fazenda?.nome ?? '—'
    const talhao  = a.talhao?.nome ?? '—'
    const area_ha = a.talhao?.area_ha ?? 0
    const areaAp  = a.area_aplicada_ha ?? 0
    const custo   = (a.itens ?? []).reduce((s, i) => s + i.quantidade_usada * (i.lote?.preco_unitario ?? 0), 0)

    const ex = porTalhao.get(key) ?? { fazenda, talhao, area_ha, areaAplicada: 0, custo: 0, count: 0, inseticida: 0, fungicida: 0, herbicida: 0, outros: 0 }

    let ins = ex.inseticida, fun = ex.fungicida, her = ex.herbicida, out = ex.outros
    ;(a.itens ?? []).forEach(i => {
      const c = i.defensivo?.classe ?? ''
      const q = i.quantidade_usada * (i.lote?.preco_unitario ?? 0)
      if (['inseticida','acaricida','nematicida'].includes(c)) ins += q
      else if (c === 'fungicida') fun += q
      else if (c === 'herbicida') her += q
      else out += q
    })

    porTalhao.set(key, { fazenda, talhao, area_ha, areaAplicada: ex.areaAplicada + areaAp, custo: ex.custo + custo, count: ex.count + 1, inseticida: ins, fungicida: fun, herbicida: her, outros: out })
  })

  const sorted = [...porTalhao.values()].sort((a, b) => b.custo - a.custo)
  const totalCusto = sorted.reduce((s, t) => s + t.custo, 0)
  const totalArea  = sorted.reduce((s, t) => s + t.areaAplicada, 0)

  const rows = sorted.map(t => `
    <tr>
      <td>${t.fazenda}</td>
      <td>${t.talhao}</td>
      <td class="right">${formatarNumero(t.area_ha, 1)} ha</td>
      <td class="right">${t.count}</td>
      <td class="right">${t.inseticida > 0 ? formatarMoeda(t.inseticida) : '—'}</td>
      <td class="right">${t.fungicida > 0 ? formatarMoeda(t.fungicida) : '—'}</td>
      <td class="right">${t.herbicida > 0 ? formatarMoeda(t.herbicida) : '—'}</td>
      <td class="right"><strong>${formatarMoeda(t.custo)}</strong></td>
      <td class="right"><strong>${t.area_ha > 0 ? formatarMoeda(t.custo / t.area_ha) + '/ha' : '—'}</strong></td>
    </tr>`).join('')

  abrirJanelaPDF('Custo por Talhão', `
    <h1>Custo por Talhão — ${formatarData(ini)} a ${formatarData(fim)}</h1>
    <div class="sub">
      Total gasto: <strong>${formatarMoeda(totalCusto)}</strong> ·
      Área total aplicada: ${formatarNumero(totalArea, 1)} ha ·
      Custo médio: ${totalArea > 0 ? formatarMoeda(totalCusto / totalArea) + '/ha' : '—'} ·
      Gerado em ${new Date().toLocaleString('pt-BR')}
    </div>
    <table>
      <thead>
        <tr>
          <th>Fazenda</th><th>Talhão</th><th class="right">Área</th>
          <th class="right">Aplic.</th>
          <th class="right">Inseticida</th><th class="right">Fungicida</th><th class="right">Herbicida</th>
          <th class="right">Total</th><th class="right">R$/ha</th>
        </tr>
      </thead>
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
