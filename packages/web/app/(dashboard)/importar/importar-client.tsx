'use client'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle,
  AlertTriangle, Download, RefreshCw, Eye
} from 'lucide-react'

type TabImport = 'areas' | 'inventario' | 'defensivos' | 'compras'

interface PreviewRow { [key: string]: string | number | null }
interface ValidationError { linha: number; campo: string; mensagem: string }

export function ImportarClient() {
  const [aba, setAba]                   = useState<TabImport>('areas')
  const [arquivo, setArquivo]           = useState<File | null>(null)
  const [preview, setPreview]           = useState<PreviewRow[]>([])
  const [colunas, setColunas]           = useState<string[]>([])
  const [erros, setErros]               = useState<ValidationError[]>([])
  const [fase, setFase]                 = useState<'idle'|'preview'|'importando'|'concluido'|'erro'>('idle')
  const [resultado, setResultado]       = useState<Record<string,number> | null>(null)
  const [msgErro, setMsgErro]           = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // ─── Leitura do arquivo ──────────────────────────────────────────────────
  async function handleFile(file: File) {
    setArquivo(file)
    setErros([])
    setResultado(null)
    setMsgErro(null)

    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array', cellDates: true })
    const ws   = wb.Sheets[wb.SheetNames[0]]

    // Inventário MV: cabeçalho na linha 1 (sheet_to_json já pega)
    const rows: PreviewRow[] = XLSX.utils.sheet_to_json(ws, { defval: null })

    if (rows.length === 0) { setMsgErro('Planilha vazia ou sem cabeçalho reconhecido.'); return }

    const cols = Object.keys(rows[0])
    setColunas(cols)
    setPreview(rows)

    // Validação prévia conforme tipo
    const novosErros: ValidationError[] = []

    if (aba === 'areas') {
      validateAreas(rows, novosErros)
    } else if (aba === 'inventario') {
      validateInventario(rows, novosErros)
    } else if (aba === 'defensivos') {
      validateDefensivos(rows, novosErros)
    } else if (aba === 'compras') {
      validateCompras(rows, novosErros)
    }

    setErros(novosErros)
    setFase('preview')
  }

  function validateAreas(rows: PreviewRow[], erros: ValidationError[]) {
    const statusValidos = ['colhida', 'reforma', 'planta', 'soca']
    const required = ['FAZENDA', 'TALHAO', 'AREA_HA']
    rows.forEach((row, i) => {
      required.forEach(campo => {
        if (!row[campo]) erros.push({ linha: i + 2, campo, mensagem: `Campo ${campo} obrigatório` })
      })
      if (row['AREA_HA'] && isNaN(Number(String(row['AREA_HA']).replace(',', '.'))))
        erros.push({ linha: i + 2, campo: 'AREA_HA', mensagem: 'Deve ser um número (ex: 10.5)' })
      if (row['STATUS']) {
        const s = String(row['STATUS']).toLowerCase().trim()
        if (!statusValidos.includes(s))
          erros.push({ linha: i + 2, campo: 'STATUS', mensagem: `Deve ser: colhida, reforma, planta ou soca` })
      }
    })
  }

  function validateInventario(rows: PreviewRow[], erros: ValidationError[]) {
    const required = ['FAZENDA', 'TALHAO', 'AREA_HA']
    rows.forEach((row, i) => {
      required.forEach(campo => {
        if (!row[campo]) erros.push({ linha: i + 2, campo, mensagem: `Campo ${campo} obrigatório` })
      })
    })
  }

  function validateDefensivos(rows: PreviewRow[], erros: ValidationError[]) {
    const required = ['NOME_PRODUTO', 'PRINCIPIO_ATIVO', 'CLASSIFICACAO', 'UNIDADE', 'ESTOQUE_ATUAL']
    const classesValidas = [
      'herbicida','fungicida','inseticida','acaricida','adjuvante','espalhante_adesivo',
      'fertilizante','fertilizante_foliar','adubo_foliar','nematicida','inoculante',
      'maturador','regulador_crescimento','ativador_crescimento','fungicida_herbicida','outro'
    ]
    rows.forEach((row, i) => {
      required.forEach(campo => {
        if (!row[campo]) erros.push({ linha: i + 2, campo, mensagem: `Campo ${campo} obrigatório` })
      })
      const unid = String(row['UNIDADE'] ?? '').toUpperCase()
      if (row['UNIDADE'] && unid !== 'LT' && unid !== 'KG' && unid !== 'L')
        erros.push({ linha: i+2, campo: 'UNIDADE', mensagem: 'Deve ser LT ou KG' })
      const classe = String(row['CLASSIFICACAO'] ?? '').toLowerCase().replace(/ /g,'_')
      if (row['CLASSIFICACAO'] && !classesValidas.includes(classe))
        erros.push({ linha: i+2, campo: 'CLASSIFICACAO', mensagem: `Classe inválida: ${row['CLASSIFICACAO']}` })
    })
  }

  function validateCompras(rows: PreviewRow[], erros: ValidationError[]) {
    const required = ['NOME_PRODUTO', 'NUMERO_NF', 'FORNECEDOR', 'DATA_COMPRA', 'QUANTIDADE', 'PRECO_UNITARIO']
    const nfsVistas = new Set<string>()
    rows.forEach((row, i) => {
      required.forEach(campo => {
        if (!row[campo]) erros.push({ linha: i+2, campo, mensagem: `Campo ${campo} obrigatório` })
      })
      const nf = String(row['NUMERO_NF'] ?? '').trim()
      if (nf && nfsVistas.has(nf))
        erros.push({ linha: i+2, campo: 'NUMERO_NF', mensagem: `NF duplicada: ${nf}` })
      if (nf) nfsVistas.add(nf)
    })
  }

  // ─── Importação ──────────────────────────────────────────────────────────
  async function handleImportar() {
    if (!arquivo || erros.length > 0) return
    setFase('importando')
    setMsgErro(null)

    try {
      if (aba === 'areas') {
        await importarAreas()
      } else if (aba === 'inventario') {
        await importarInventario()
      } else if (aba === 'defensivos') {
        await importarDefensivos()
      } else if (aba === 'compras') {
        await importarCompras()
      }
      setFase('concluido')
    } catch (e) {
      setMsgErro(String(e))
      setFase('erro')
    }
  }

  async function importarAreas() {
    let fazendasIns = 0, talhoesIns = 0, talhoesAtual = 0

    for (const row of preview) {
      const nomeFazenda = String(row['FAZENDA']).trim()
      const nomeTalhao  = String(row['TALHAO']).trim()
      const areaHa      = Number(String(row['AREA_HA']).replace(',', '.'))
      const municipio   = row['MUNICIPIO'] ? String(row['MUNICIPIO']).trim() : null
      const uf          = row['UF'] ? String(row['UF']).trim().toUpperCase() : null
      const polo        = row['USINA'] ? String(row['USINA']).trim() : null

      // Busca ou cria fazenda
      let { data: fazenda } = await supabase
        .from('fazendas').select('id').eq('nome', nomeFazenda).maybeSingle()

      if (!fazenda) {
        const { data: nova } = await supabase.from('fazendas').insert({
          nome: nomeFazenda, municipio, uf, polo
        }).select('id').single()
        fazenda = nova
        fazendasIns++
      }

      if (!fazenda) continue

      // Busca ou cria talhão
      const { data: talhaoExist } = await supabase
        .from('talhoes').select('id').eq('fazenda_id', fazenda.id).eq('nome', nomeTalhao).maybeSingle()

      const numCortes = row['NUM_CORTES'] ? Number(row['NUM_CORTES']) : null
      const status    = row['STATUS'] ? String(row['STATUS']).toLowerCase().trim() : null

      if (talhaoExist) {
        await supabase.from('talhoes').update({
          area_ha: areaHa,
          ...(numCortes !== null && { num_cortes: numCortes }),
          ...(status && { status_area: status }),
        }).eq('id', talhaoExist.id)
        talhoesAtual++
      } else {
        await supabase.from('talhoes').insert({
          fazenda_id: fazenda.id,
          nome: nomeTalhao,
          area_ha: areaHa,
          ...(numCortes !== null && { num_cortes: numCortes }),
          ...(status && { status_area: status }),
        })
        talhoesIns++
      }
    }

    setResultado({ fazendas_criadas: fazendasIns, talhoes_inseridos: talhoesIns, talhoes_atualizados: talhoesAtual })
  }

  async function importarInventario() {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-inventario`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: (() => { const f = new FormData(); f.append('file', arquivo!); return f })(),
      }
    )
    const json = await res.json()
    if (!json.ok) throw new Error(json.error)
    setResultado(json)
  }

  async function importarDefensivos() {
    const classesValidas = [
      'herbicida','fungicida','inseticida','acaricida','adjuvante','espalhante_adesivo',
      'fertilizante','fertilizante_foliar','adubo_foliar','nematicida','inoculante',
      'maturador','regulador_crescimento','ativador_crescimento','fungicida_herbicida','outro'
    ]
    const localValidos = ['quartinho','container','quartinho_container','outro']
    let inseridos = 0, atualizados = 0

    for (const row of preview) {
      const nome   = String(row['NOME_PRODUTO']).trim()
      const classe = String(row['CLASSIFICACAO'] ?? '').toLowerCase().replace(/ /g,'_')
      const classeNorm = classesValidas.includes(classe) ? classe : 'outro'
      const unidRaw = String(row['UNIDADE'] ?? '').toUpperCase()
      const unidade = unidRaw === 'LT' || unidRaw === 'L' ? 'L' : 'kg'
      const localRaw = String(row['LOCAL_ARMAZENAMENTO'] ?? '').toLowerCase().replace(/ \//g,'_').replace(/\//g,'_')
      const local = localValidos.includes(localRaw) ? localRaw : null
      const estAtual = Number(row['ESTOQUE_ATUAL'] ?? 0)
      const estMin   = Number(row['ESTOQUE_MINIMO'] ?? 0)

      const { data: existing } = await supabase.from('defensivos')
        .select('id').eq('nome_comercial', nome).maybeSingle()

      const payload = {
        nome_comercial: nome,
        principio_ativo: String(row['PRINCIPIO_ATIVO'] ?? '').trim(),
        classe: classeNorm,
        unidade,
        empresa: row['EMPRESA'] ? String(row['EMPRESA']).trim() : null,
        local_armazenamento: local as string | null,
        estoque_minimo: estMin,
        observacoes: row['OBSERVACAO'] ? String(row['OBSERVACAO']).trim() : null,
      }

      let defId: string

      if (existing) {
        await supabase.from('defensivos').update(payload).eq('id', existing.id)
        defId = existing.id
        atualizados++
      } else {
        const { data } = await supabase.from('defensivos').insert(payload).select('id').single()
        defId = data!.id
        inseridos++
      }

      // Criar lote inicial se tem estoque
      if (estAtual > 0) {
        const obsRaw = String(row['OBSERVACAO'] ?? '')
        const matchVencido = obsRaw.match(/^(\d+(?:[.,]\d+)?)\s*vencido/i)
        let qtdOk     = estAtual
        let qtdVencida = 0

        if (matchVencido) {
          qtdVencida = parseFloat(matchVencido[1].replace(',', '.'))
          qtdOk = Math.max(0, estAtual - qtdVencida)
        } else if (/vencido/i.test(obsRaw)) {
          qtdVencida = estAtual
          qtdOk = 0
        }

        if (qtdOk > 0) {
          await supabase.from('lotes').insert({
            defensivo_id: defId, quantidade_comprada: qtdOk, quantidade_atual: qtdOk,
            observacoes: 'Estoque inicial — importado da planilha física',
          })
        }
        if (qtdVencida > 0) {
          await supabase.from('lotes').insert({
            defensivo_id: defId, quantidade_comprada: qtdVencida, quantidade_atual: qtdVencida,
            data_vencimento: '2020-01-01',
            observacoes: `VENCIDO — ${obsRaw}`,
          })
        }
      }
    }

    setResultado({ defensivos_inseridos: inseridos, defensivos_atualizados: atualizados })
  }

  async function importarCompras() {
    let inseridos = 0, erroNF = 0

    for (const row of preview) {
      const nome = String(row['NOME_PRODUTO']).trim()

      const { data: def } = await supabase.from('defensivos')
        .select('id').eq('nome_comercial', nome).maybeSingle()
      if (!def) { erroNF++; continue }

      function parseDate(v: unknown): string | null {
        if (!v) return null
        if (v instanceof Date) return v.toISOString().split('T')[0]
        const s = String(v)
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        return m ? `${m[3]}-${m[2]}-${m[1]}` : null
      }

      const qtd    = Number(row['QUANTIDADE'])
      const preco  = Number(row['PRECO_UNITARIO'])

      await supabase.from('lotes').insert({
        defensivo_id: def.id,
        numero_nf:          String(row['NUMERO_NF']).trim(),
        fornecedor:         String(row['FORNECEDOR'] ?? '').trim() || null,
        data_compra:        parseDate(row['DATA_COMPRA']),
        quantidade_comprada: qtd,
        quantidade_atual:    qtd,
        preco_unitario:      preco,
        valor_total:         qtd * preco,
        data_fabricacao:    parseDate(row['DATA_FABRICACAO']),
        data_vencimento:    parseDate(row['DATA_VENCIMENTO']),
        lote_fabricante:    row['LOTE_FABRICANTE'] ? String(row['LOTE_FABRICANTE']).trim() : null,
        observacoes:        row['OBSERVACOES'] ? String(row['OBSERVACOES']).trim() : null,
      })
      inseridos++
    }

    setResultado({ lotes_inseridos: inseridos, erros_nf: erroNF })
  }

  // ─── Modelos para download ───────────────────────────────────────────────
  function baixarModelo(tipo: TabImport) {
    const modelos: Record<TabImport, { colunas: string[]; exemplo: (string|number)[] }> = {
      areas: {
        colunas: ['FAZENDA', 'TALHAO', 'AREA_HA', 'NUM_CORTES', 'STATUS', 'MUNICIPIO', 'UF', 'USINA'],
        exemplo: ['Fazenda Santa Maria', 'Talhão 01', 25.5, 3, 'soca', 'Dourados', 'MS', 'Polo Sul'],
      },
      inventario: {
        colunas: ['CHAVESIG','SAFRA','USINA','EMPRESA','EMPDESC','MOD','NUM','FAZENDA','SETOR',
                  'TALHAO','BLOCO','BLOCO_COLH','BLOCO_PLAN','AREA_HA','AREA_DANO','VARIED',
                  'MAN_HIPOT','ESTAGIO','TIPO_PROP','DATA_PLANTIO','FRENTE','DEVOLUCAO','REFORMA',
                  'TP_REFORMA','SIST_PLANT','VINHACA_E','SISTEMA_COL','DIST_TERRA','DIST_ASFALTO',
                  'DIST_HIDR','UNID_IND','AMBIENTE','ESPAC','AREA_PROD','TCH_PROD','TON_ESTIM',
                  'AREA_REEST','TCH_REEST','TON_REEST','SIT_TALHAO','DATA_FECHA','CANA_ENT',
                  'ADMIN','FORNEC','DT_VENC_CONTR'],
        exemplo: ['32805800010001','22526','PSL','32','USL','32','328058','FAZENDA RECANTO PRIMAVERA',
                  1,1,1,'','1','5,06',0,'CTC4','A Definir','3° Corte',10,'15/06/2021',99,'N','N',
                  '','Manual','N',4,'30,7',0,0,32,'Cn','1,5 Mts','5,06',76,'384,56','','','',
                  'A Colher','','S','FORNECEDOR','MARCIO VERRUNES','31/12/2027'],
      },
      defensivos: {
        colunas: ['NOME_PRODUTO','LOCAL_ARMAZENAMENTO','EMPRESA','PRINCIPIO_ATIVO','CLASSIFICACAO',
                  'UNIDADE','ESTOQUE_ATUAL','ESTOQUE_MINIMO','OBSERVACAO'],
        exemplo: ['APROACH POWER','QUARTINHO','DUPONT','PICOXISTROBINA, CIPROCONAZOLE',
                  'fungicida','LT',1340,50,''],
      },
      compras: {
        colunas: ['NOME_PRODUTO','NUMERO_NF','FORNECEDOR','DATA_COMPRA','QUANTIDADE',
                  'PRECO_UNITARIO','DATA_FABRICACAO','DATA_VENCIMENTO','LOTE_FABRICANTE','OBSERVACOES'],
        exemplo: ['APROACH POWER','004521','Agroquímica Silva','10/03/2026',200,12.50,
                  '01/09/2025','01/09/2027','LOT-2025-09-A',''],
      },
    }

    const m  = modelos[tipo]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([m.colunas, m.exemplo])
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo')
    XLSX.writeFile(wb, `modelo_${tipo}.xlsx`)
  }

  // ─── UI ──────────────────────────────────────────────────────────────────
  const tabs: { key: TabImport; label: string; desc: string }[] = [
    { key: 'areas',      label: 'Fazendas e Talhões', desc: 'Importa fazendas e talhões com hectares a partir de planilha simples' },
    { key: 'inventario', label: 'Inventário MV (SIG)', desc: 'Importa fazendas e talhões direto do arquivo exportado pelo SIG' },
    { key: 'defensivos', label: 'Defensivos / Estoque', desc: 'Cadastra defensivos e estoque inicial em lote' },
    { key: 'compras',    label: 'Compras / NFs',        desc: 'Registra entradas de estoque com nota fiscal e preços' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Importar Excel</h1>
        <p className="text-sm text-muted-foreground mt-1">Importe dados em lote a partir de planilhas Excel</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setAba(t.key); setFase('idle'); setArquivo(null); setPreview([]); setErros([]) }}
            className={cn(
              'flex-1 min-w-40 rounded-lg border p-3 text-left transition-colors',
              aba === t.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            )}
          >
            <p className={cn('font-semibold text-sm', aba === t.key && 'text-primary')}>{t.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
          </button>
        ))}
      </div>

      {/* Drop zone */}
      {fase === 'idle' && (
        <Card>
          <CardContent className="p-8">
            <div
              className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            >
              <FileSpreadsheet className="h-12 w-12 text-primary/40 mx-auto mb-4" />
              <p className="text-base font-medium">Arraste o arquivo Excel aqui</p>
              <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar — .xlsx, .xls</p>
              <Button variant="outline" className="mt-4">
                <Upload className="h-4 w-4 mr-2" />
                Selecionar arquivo
              </Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />

            <div className="mt-4 text-center">
              <button onClick={() => baixarModelo(aba)} className="text-sm text-primary hover:underline flex items-center gap-1 mx-auto">
                <Download className="h-3.5 w-3.5" />
                Baixar modelo de {aba === 'inventario' ? 'Inventário MV' : aba === 'defensivos' ? 'defensivos' : 'compras'} (.xlsx)
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {(fase === 'preview') && preview.length > 0 && (
        <div className="space-y-4">
          {/* Sumário */}
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <FileSpreadsheet className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{arquivo?.name}</p>
                <p className="text-sm text-muted-foreground">{preview.length} linhas · {colunas.length} colunas</p>
              </div>
              <div className="flex items-center gap-2">
                {erros.length === 0
                  ? <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Sem erros</Badge>
                  : <Badge variant="danger"><XCircle className="h-3 w-3 mr-1" />{erros.length} erro(s)</Badge>
                }
                <Button variant="ghost" size="sm" onClick={() => { setFase('idle'); setArquivo(null) }}>
                  Trocar arquivo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Erros de validação */}
          {erros.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Erros encontrados — corrija antes de importar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 max-h-40 overflow-y-auto">
                {erros.map((e, i) => (
                  <div key={i} className="text-xs text-red-600 flex gap-2">
                    <span className="font-mono bg-red-50 px-1 rounded">L{e.linha}</span>
                    <span className="font-medium">{e.campo}:</span>
                    <span>{e.mensagem}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Preview tabela */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Pré-visualização (primeiras 5 linhas)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {colunas.slice(0,10).map(c => (
                      <th key={c} className="text-left p-2 font-medium whitespace-nowrap">{c}</th>
                    ))}
                    {colunas.length > 10 && <th className="p-2 text-muted-foreground">+{colunas.length-10} cols</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0,5).map((row, i) => (
                    <tr key={i} className="border-b hover:bg-muted/10">
                      {colunas.slice(0,10).map(c => (
                        <td key={c} className="p-2 whitespace-nowrap max-w-32 truncate">
                          {row[c] !== null ? String(row[c]) : <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              onClick={handleImportar}
              disabled={erros.length > 0}
              className="min-w-36"
            >
              <Upload className="h-4 w-4 mr-2" />
              Confirmar Importação ({preview.length} linhas)
            </Button>
            <Button variant="outline" onClick={() => { setFase('idle'); setArquivo(null) }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Importando */}
      {fase === 'importando' && (
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="h-10 w-10 text-primary mx-auto mb-4 animate-spin" />
            <p className="font-medium">Importando dados...</p>
            <p className="text-sm text-muted-foreground mt-1">Aguarde, isso pode levar alguns segundos</p>
          </CardContent>
        </Card>
      )}

      {/* Concluído */}
      {fase === 'concluido' && resultado && (
        <Card className="border-green-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-green-700 text-lg">Importação concluída!</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(resultado).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-green-50 p-3">
                      <p className="text-xl font-bold text-green-700">{v}</p>
                      <p className="text-xs text-green-600 mt-0.5">{k.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={() => { setFase('idle'); setArquivo(null); setPreview([]) }}>
                    Nova importação
                  </Button>
                  <Button asChild>
                    <a href={aba === 'areas' || aba === 'inventario' ? '/fazendas' : '/estoque'}>
                      Ver resultado →
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Erro */}
      {fase === 'erro' && (
        <Card className="border-red-200">
          <CardContent className="p-6 flex items-start gap-4">
            <XCircle className="h-8 w-8 text-red-500 shrink-0" />
            <div>
              <p className="font-semibold text-red-700">Erro na importação</p>
              <p className="text-sm text-muted-foreground mt-1">{msgErro}</p>
              <Button variant="outline" className="mt-3" onClick={() => { setFase('preview') }}>
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
