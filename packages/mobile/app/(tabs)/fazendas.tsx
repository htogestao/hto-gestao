import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { getDB } from '../../src/services/sync'

interface FazendaItem {
  id: string
  nome: string
  municipio: string | null
  uf: string | null
  area_total_ha: number | null
  polo: string | null
  talhoes: TalhaoItem[]
  expanded: boolean
}

interface TalhaoItem {
  id: string
  nome: string
  cultura_atual: string | null
  area_ha: number | null
  variedade: string | null
  status_colheita: string | null
  numero_corte: number | null
}

const STATUS_COLHEITA: Record<string, { label: string; color: string; bg: string }> = {
  a_colher:   { label: 'A colher',  color: '#16a34a', bg: '#dcfce7' },
  colhendo:   { label: 'Colhendo',  color: '#d97706', bg: '#fffbeb' },
  colhido:    { label: 'Colhido',   color: '#6b7280', bg: '#f3f4f6' },
  reforma:    { label: 'Reforma',   color: '#7c3aed', bg: '#f3e8ff' },
  outro:      { label: 'Outro',     color: '#374151', bg: '#f9fafb' },
}

export default function FazendasScreen() {
  const [fazendas, setFazendas] = useState<FazendaItem[]>([])
  const [filtro, setFiltro] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function loadFazendas() {
    const db = await getDB()
    const fazRows = await db.getAllAsync<{ id: string; nome: string; municipio: string; uf: string; area_total_ha: number; polo: string }>(
      `SELECT id, nome, municipio, uf, area_total_ha, polo FROM fazendas ORDER BY nome`
    )
    const result: FazendaItem[] = []
    for (const f of fazRows) {
      const talhoes = await db.getAllAsync<TalhaoItem>(
        `SELECT id, nome, cultura_atual, area_ha, variedade, status_colheita, numero_corte
         FROM talhoes WHERE fazenda_id = ? ORDER BY nome`,
        [f.id]
      )
      result.push({ ...f, talhoes, expanded: false })
    }
    setFazendas(result)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadFazendas()
    setRefreshing(false)
  }, [])

  useEffect(() => { loadFazendas() }, [])

  function toggleExpand(id: string) {
    setFazendas(prev => prev.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f))
  }

  const filtradas = filtro
    ? fazendas.filter(f =>
        f.nome.toLowerCase().includes(filtro.toLowerCase()) ||
        (f.municipio ?? '').toLowerCase().includes(filtro.toLowerCase()) ||
        (f.polo ?? '').toLowerCase().includes(filtro.toLowerCase())
      )
    : fazendas

  function renderItem({ item }: { item: FazendaItem }) {
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item.id)}>
          <View style={styles.fazIconBox}>
            <MaterialCommunityIcons name="sprout" size={22} color="#16a34a" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.fazNome}>{item.nome}</Text>
            <Text style={styles.fazLocal}>
              {[item.municipio, item.uf].filter(Boolean).join(' - ')}
              {item.polo ? ` • Polo ${item.polo}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {item.area_total_ha && (
              <Text style={styles.areaTotal}>{item.area_total_ha.toFixed(0)} ha</Text>
            )}
            <Text style={styles.talhaoCount}>{item.talhoes.length} talhão(s)</Text>
          </View>
          <MaterialCommunityIcons
            name={item.expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#9ca3af"
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>

        {item.expanded && item.talhoes.length > 0 && (
          <View style={styles.talhoesContainer}>
            {item.talhoes.map(t => {
              const sc = t.status_colheita ? STATUS_COLHEITA[t.status_colheita] : null
              return (
                <View key={t.id} style={styles.talhaoRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.talhaoNome}>{t.nome}</Text>
                      {sc && (
                        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                          <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.talhaoInfo}>
                      {[
                        t.cultura_atual,
                        t.variedade,
                        t.numero_corte ? `${t.numero_corte}º corte` : null,
                        t.area_ha ? `${t.area_ha.toFixed(1)} ha` : null,
                      ].filter(Boolean).join(' • ')}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {item.expanded && item.talhoes.length === 0 && (
          <View style={{ padding: 14, paddingTop: 0 }}>
            <Text style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>Nenhum talhão cadastrado</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Fazendas</Text>
        <Text style={styles.subtitle}>{filtradas.length} fazenda(s)</Text>
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color="#9ca3af" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome, município, polo..."
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
        data={filtradas}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="map-marker-off" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Nenhuma fazenda encontrada</Text>
            <Text style={styles.emptySubtext}>Faça a sincronização para carregar os dados</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f9fafb' },
  headerBar:    { backgroundColor: '#14532d', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title:        { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle:     { fontSize: 13, color: '#86efac' },
  searchRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16,
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, elevation: 2 },
  searchInput:  { flex: 1, fontSize: 14, color: '#111827' },
  card:         { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, elevation: 2, overflow: 'hidden' },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', padding: 14 },
  fazIconBox:   { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f0fdf4',
                  alignItems: 'center', justifyContent: 'center' },
  fazNome:      { fontSize: 14, fontWeight: '700', color: '#111827' },
  fazLocal:     { fontSize: 12, color: '#6b7280', marginTop: 2 },
  areaTotal:    { fontSize: 15, fontWeight: 'bold', color: '#16a34a' },
  talhaoCount:  { fontSize: 11, color: '#9ca3af' },
  talhoesContainer: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingHorizontal: 14, paddingBottom: 10 },
  talhaoRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                  borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  talhaoNome:   { fontSize: 13, fontWeight: '600', color: '#374151' },
  talhaoInfo:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statusBadge:  { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  statusText:   { fontSize: 10, fontWeight: '700' },
  emptyState:   { alignItems: 'center', paddingTop: 80 },
  emptyText:    { fontSize: 16, color: '#9ca3af', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#d1d5db', marginTop: 4 },
})
