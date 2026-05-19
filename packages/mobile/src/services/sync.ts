/**
 * Sync service — SQLite local ↔ Supabase
 * Estratégia: pull-first (busca dados do servidor), depois push pendências locais.
 * Conflito: server wins para fazendas/defensivos; local wins para aplicações.
 */
import * as SQLite from 'expo-sqlite'
import { supabase } from './supabase'

let db: SQLite.SQLiteDatabase | null = null

export async function getDB() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('agro_local.db')
    await initDB(db)
  }
  return db
}

async function initDB(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS fazendas (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, municipio TEXT, uf TEXT,
      area_total_ha REAL, polo TEXT, fornecedor_principal TEXT,
      vencimento_contrato TEXT, unidade_industrial TEXT, synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS talhoes (
      id TEXT PRIMARY KEY, fazenda_id TEXT NOT NULL, nome TEXT NOT NULL,
      cultura_atual TEXT, area_ha REAL, variedade TEXT, numero_corte INTEGER,
      status_colheita TEXT, sistema_colheita TEXT, data_plantio TEXT,
      tch_estimado REAL, synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS defensivos (
      id TEXT PRIMARY KEY, nome_comercial TEXT NOT NULL, principio_ativo TEXT,
      classe TEXT, unidade TEXT, estoque_minimo REAL, empresa TEXT,
      local_armazenamento TEXT, synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS lotes_field (
      id TEXT PRIMARY KEY, defensivo_id TEXT NOT NULL, quantidade_atual REAL,
      data_vencimento TEXT, lote_fabricante TEXT, synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS aplicacoes (
      id TEXT PRIMARY KEY, data TEXT, fazenda_id TEXT, talhao_id TEXT,
      area_aplicada_ha REAL, praga_alvo TEXT, condicoes_climaticas TEXT,
      responsavel_id TEXT, status TEXT DEFAULT 'em_andamento',
      observacoes TEXT, synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS aplicacao_itens (
      id TEXT PRIMARY KEY, aplicacao_id TEXT, defensivo_id TEXT, lote_id TEXT,
      dose_por_hectare REAL, quantidade_usada REAL,
      quantidade_sobrou REAL DEFAULT 0, calda_total_l REAL,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY, value TEXT
    );
  `)
}

// ─── Pull do Supabase ────────────────────────────────────────────────────────
export async function pullFromSupabase(onProgress?: (msg: string) => void) {
  const db = await getDB()

  onProgress?.('Baixando fazendas...')
  const { data: fazendas } = await supabase.from('fazendas')
    .select('id,nome,municipio,uf,area_total_ha,polo,fornecedor_principal,vencimento_contrato,unidade_industrial')
  if (fazendas) {
    for (const f of fazendas) {
      await db.runAsync(
        `INSERT OR REPLACE INTO fazendas (id,nome,municipio,uf,area_total_ha,polo,fornecedor_principal,vencimento_contrato,unidade_industrial,synced)
         VALUES (?,?,?,?,?,?,?,?,?,1)`,
        [f.id,f.nome,f.municipio,f.uf,f.area_total_ha,f.polo,f.fornecedor_principal,f.vencimento_contrato,f.unidade_industrial]
      )
    }
  }

  onProgress?.('Baixando talhões...')
  const { data: talhoes } = await supabase.from('talhoes')
    .select('id,fazenda_id,nome,cultura_atual,area_ha,variedade,numero_corte,status_colheita,sistema_colheita,data_plantio,tch_estimado')
  if (talhoes) {
    for (const t of talhoes) {
      await db.runAsync(
        `INSERT OR REPLACE INTO talhoes (id,fazenda_id,nome,cultura_atual,area_ha,variedade,numero_corte,status_colheita,sistema_colheita,data_plantio,tch_estimado,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
        [t.id,t.fazenda_id,t.nome,t.cultura_atual,t.area_ha,t.variedade,t.numero_corte,t.status_colheita,t.sistema_colheita,t.data_plantio,t.tch_estimado]
      )
    }
  }

  onProgress?.('Baixando defensivos...')
  const { data: defensivos } = await supabase.from('defensivos')
    .select('id,nome_comercial,principio_ativo,classe,unidade,estoque_minimo,empresa,local_armazenamento')
  if (defensivos) {
    for (const d of defensivos) {
      await db.runAsync(
        `INSERT OR REPLACE INTO defensivos (id,nome_comercial,principio_ativo,classe,unidade,estoque_minimo,empresa,local_armazenamento,synced)
         VALUES (?,?,?,?,?,?,?,?,1)`,
        [d.id,d.nome_comercial,d.principio_ativo,d.classe,d.unidade,d.estoque_minimo,d.empresa,d.local_armazenamento]
      )
    }
  }

  onProgress?.('Baixando estoque (lotes)...')
  const { data: lotes } = await supabase.from('lotes_field_view')
    .select('id,defensivo_id,quantidade_atual,data_vencimento,lote_fabricante')
  if (lotes) {
    for (const l of lotes) {
      await db.runAsync(
        `INSERT OR REPLACE INTO lotes_field (id,defensivo_id,quantidade_atual,data_vencimento,lote_fabricante,synced)
         VALUES (?,?,?,?,?,1)`,
        [l.id,l.defensivo_id,l.quantidade_atual,l.data_vencimento,l.lote_fabricante]
      )
    }
  }

  // Marcar timestamp
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_meta (key,value) VALUES ('last_pull',?)`,
    [new Date().toISOString()]
  )

  onProgress?.('Sync concluído!')
}

// ─── Push para Supabase ──────────────────────────────────────────────────────
export async function pushToSupabase(onProgress?: (msg: string) => void) {
  const db = await getDB()

  // Aplicações não sincronizadas
  const aplicacoes = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM aplicacoes WHERE synced = 0`
  )
  onProgress?.(`Enviando ${aplicacoes.length} aplicação(ões)...`)

  for (const a of aplicacoes) {
    const { error } = await supabase.from('aplicacoes').upsert({
      id: a.id, data: a.data, fazenda_id: a.fazenda_id, talhao_id: a.talhao_id,
      area_aplicada_ha: a.area_aplicada_ha, praga_alvo: a.praga_alvo,
      condicoes_climaticas: a.condicoes_climaticas, responsavel_id: a.responsavel_id,
      status: a.status, observacoes: a.observacoes,
    })
    if (!error) {
      await db.runAsync(`UPDATE aplicacoes SET synced = 1 WHERE id = ?`, [a.id as string])
    }
  }

  // Itens de aplicação não sincronizados
  const itens = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM aplicacao_itens WHERE synced = 0`
  )
  for (const i of itens) {
    const { error } = await supabase.from('aplicacao_itens').upsert({
      id: i.id, aplicacao_id: i.aplicacao_id, defensivo_id: i.defensivo_id,
      lote_id: i.lote_id, dose_por_hectare: i.dose_por_hectare,
      quantidade_usada: i.quantidade_usada, quantidade_sobrou: i.quantidade_sobrou,
      calda_total_l: i.calda_total_l,
    })
    if (!error) {
      await db.runAsync(`UPDATE aplicacao_itens SET synced = 1 WHERE id = ?`, [i.id as string])
    }
  }
}

export async function syncAll(onProgress?: (msg: string) => void) {
  await pullFromSupabase(onProgress)
  await pushToSupabase(onProgress)
}

export async function countPending(): Promise<number> {
  const db = await getDB()
  const r = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM aplicacoes WHERE synced=0) +
            (SELECT COUNT(*) FROM aplicacao_itens WHERE synced=0) as n`
  )
  return r?.n ?? 0
}
