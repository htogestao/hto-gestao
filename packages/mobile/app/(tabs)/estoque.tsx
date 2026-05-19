import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { getDB } from '../../src/services/sync'

interface DefensivoComEstoque {
  id: string
  nome_comercial: string
  principio_ativo: string | null
  classe: string
  unidade: string
  total_estoque: number
  lotes: LoteItem[]
  expanded: boolean
}

interface LoteItem {
  id: string
  quantidade_atual: number
  data_vencimento: string | null
  lote_fabricante: string | null
  status_venc: 'ok' | 'proximo' | 'vencido'
}

const CLASSE_CORES: Record<string, string> = {
  herbicida:           '#7c3aed',
  fungicida:           '#0891b2',
  inseticida:          '#dc2626',
  acaricida:           '#ea580c',
  nematicida:          '#92400e',
  adjuvante:           '#6b7280',
  fertilizante_foliar: '#16a34a',
  inoculante:          '#065f46',
  maturador:           '#ca8a04',
  default:             '#374151',
}

function statusVenc(data: string | null): 'ok' | 'proximo' | 'vencido' {
  if (!data) return 'ok'
  const diff = (new Date(data).getTime() - Date.now()) / 86400000
  if (diff < 0) return 'vencido'
  if (diff <= 30) return 'proximo'
  return 'ok'
}

export default function EstoqueScreen() {
  const [items, setItems] = useState<DefensivoComEstoque[]>([])
  const [filtro, setFiltro] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function loadEstoque() {
    const db = await getDB()
    const defensivos = await db.getAllAsync<{ id: string; nome_comercial: string; principio_ativo: string; classe: string; unidade: string }>(
      `SELECT id, nome_comercial, principio_ativo, classe, unidade FROM defensivos ORDER BY nome_comercial`
    )
    const result: DefensivoComEstoque[] = []
    for (const d of defensivos) {
      const loteRows = await db.getAllAsync<{ id: string; quantidade_atual: number; data_vencimento: string; lote_fabricante: string }>(
        `SELECT id, quantidade_atual, data_vencimento, lote_fabricante FROM lotes_field WHERE defensivo_id = ? AND quantidade_atual > 0 ORDER BY data_vencimento ASC`,
        [d.id]
      )
      if (loteRows.length === 0) continue
      const lotes: LoteItem[] = loteRows.map(l => ({
        ...l,
        status_venc: statusVenc(l.data_vencimento),
      }))
      result.push({
        ...d,
        total_estoque: lotes.reduce((s, l) => s + l.quantidade_atual, 0),
        lotes,
        expanded: false,
      })
    }
    setItems(result)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadEstoque()
    setRefreshing(false)
  }, [])

  useEffect(() => { loadEstoque() }, [])

  function toggleExpand(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, expanded: !i.expanded } : i))
  }

  const filtrados = filtro
    ? items.filter(i =>
        i.nome_comercial.toLowerCase().includes(filtro.toLowerCase()) ||
        (i.principio_ativo ?? '').toLowerCase().includes(filtro.toLowerCase())
      )
    : items

  function renderItem({ item }: { item: DefensivoComEstoque }) {
    const cor = CLASSE_CORES[item.classe] ?? CLASSE_CORES.default
    const temAlerta = item.lotes.some(l => l.status_venc !== 'ok')

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item.id)}>
          <View style={[styles.classeTag, { backgroundColor: cor + '22' }]}>
            <Text style={[styles.classeText, { color: cor }]}>{item.classe}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.nomeProduto}>{item.nome_comercial}</Text>
              {temAlerta && <MaterialCommunityIcons name="alert" size={14} color="#d97706" />}
            </View>
            {item.principio_ativo && (
              <Text style={styles.principioAtivo}>{item.principio_ativo}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.estoqueTotal}>{item.total_estoque.toFixed(1)}</Text>
            <Text style={styles.unidade}>{item.unidade}</Text>
          </View>
          <MaterialCommunityIcons
            name={item.expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#9ca3af"
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>

        {item.expanded && (
          <View style={styles.lotesContainer}>
            {item.lotes.map(l => {
              const bgColors = { ok: '#f0fdf4', proximo: '#fffbeb', vencido: '#fef2f2' }
              const textColors = { ok: '#166534', proximo: '#92400e', vencido: '#991b1b' }
              return (
                <View key={l.id} style={[styles.loteRow, { backgroundColor: bgColors[l.status_venc] }]}>
                  <MaterialCommunityIcons
                    name={l.status_venc === 'ok' ? 'check-circle' : l.status_venc === 'proximo' ? 'clock-alert' : 'alert-circle'}
                    size={16}
                    color={textColors[l.status_venc]}
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.loteQtd, { color: textColors[l.status_venc] }]}>
                      {l.quantidade_atual.toFixed(2)} {item.unidade}
                    </Text>
                    {l.data_vencimento && (
                      <Text style={styles.loteVenc}>
                        Vence: {new Date(l.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                        {l.status_venc === 'vencido' ? ' (VENCIDO)' : l.status_venc === 'proximo' ? ' (em breve)' : ''}
                      </Text>
                    )}
                    {l.lote_fabricante && (
                      <Text style={styles.loteFab}>Lote: {l.lote_fabricante}</Text>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Estoque</Text>
        <Text style={styles.subtitle}>{filtrados.length} produto(s)</Text>
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color="#9ca3af" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar produto ou princípio ativo..."
          placeholderTextColor="#9ca3af"
          value={filtro}
          onChangeText={setFiltro}
        />
        {filtro.length > 0 && (
          <TouchableOpacity onPress={() => setFiltro('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="package-variant-closed" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Nenhum produto em estoque</Text>
            <Text style={styles.emptySubtext}>Faça a sincronização para atualizar</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f9fafb' },
  headerBar:   { backgroundColor: '#14532d', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
                 flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title:       { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle:    { fontSize: 13, color: '#86efac' },
  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16,
                 borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  card:        { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, elevation: 2, overflow: 'hidden' },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', padding: 14 },
  classeTag:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  classeText:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  nomeProduto: { fontSize: 14, fontWeight: '700', color: '#111827' },
  principioAtivo: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  estoqueTotal: { fontSize: 18, fontWeight: 'bold', color: '#16a34a' },
  unidade:     { fontSize: 11, color: '#6b7280' },
  lotesContainer: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingHorizontal: 14, paddingBottom: 12 },
  loteRow:     { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 8, padding: 10, marginTop: 8 },
  loteQtd:     { fontSize: 14, fontWeight: '600' },
  loteVenc:    { fontSize: 12, color: '#6b7280', marginTop: 2 },
  loteFab:     { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  emptyState:  { alignItems: 'center', paddingTop: 80 },
  emptyText:   { fontSize: 16, color: '#9ca3af', marginTop: 12 },
  emptySubtext:{ fontSize: 13, color: '#d1d5db', marginTop: 4 },
})
