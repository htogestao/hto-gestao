import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getDB } from '../../src/services/sync'

interface AplicacaoItem {
  id: string
  data: string
  fazenda_nome: string
  talhao_nome: string
  status: string
  praga_alvo: string | null
  area_aplicada_ha: number | null
  synced: number
}

const STATUS_CONFIG = {
  em_andamento: { label: 'Em andamento', color: '#16a34a', bg: '#dcfce7', icon: 'tractor' as const },
  encerrada:    { label: 'Encerrada',    color: '#6b7280', bg: '#f3f4f6', icon: 'check-circle' as const },
  cancelada:    { label: 'Cancelada',    color: '#dc2626', bg: '#fef2f2', icon: 'close-circle' as const },
}

export default function AplicacoesScreen() {
  const [aplicacoes, setAplicacoes] = useState<AplicacaoItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [filtro, setFiltro] = useState<'todas' | 'em_andamento' | 'encerrada'>('todas')

  async function loadAplicacoes() {
    const db = await getDB()
    const rows = await db.getAllAsync<AplicacaoItem>(`
      SELECT a.id, a.data, a.status, a.praga_alvo, a.area_aplicada_ha, a.synced,
             f.nome as fazenda_nome, t.nome as talhao_nome
      FROM aplicacoes a
      LEFT JOIN fazendas f ON f.id = a.fazenda_id
      LEFT JOIN talhoes t ON t.id = a.talhao_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `)
    setAplicacoes(rows)
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadAplicacoes()
    setRefreshing(false)
  }, [])

  useEffect(() => { loadAplicacoes() }, [])

  const filtradas = filtro === 'todas' ? aplicacoes : aplicacoes.filter(a => a.status === filtro)

  function renderItem({ item }: { item: AplicacaoItem }) {
    const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.em_andamento
    const dataFmt = item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '—'

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          if (item.status === 'em_andamento') {
            router.push({ pathname: '/encerrar-aplicacao', params: { id: item.id } })
          }
        }}
      >
        <View style={styles.cardTop}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {item.synced === 0 && (
              <MaterialCommunityIcons name="cloud-off-outline" size={14} color="#d97706" />
            )}
            <Text style={styles.dataText}>{dataFmt}</Text>
          </View>
        </View>

        <Text style={styles.fazendaNome}>{item.fazenda_nome ?? '—'}</Text>
        <Text style={styles.talhaoNome}>Talhão: {item.talhao_nome ?? '—'}</Text>

        {item.praga_alvo && (
          <View style={styles.pragaRow}>
            <MaterialCommunityIcons name="bug" size={13} color="#6b7280" />
            <Text style={styles.pragaText}>{item.praga_alvo}</Text>
          </View>
        )}

        {item.area_aplicada_ha && (
          <Text style={styles.areaText}>{item.area_aplicada_ha.toFixed(1)} ha</Text>
        )}

        {item.status === 'em_andamento' && (
          <View style={styles.encerrarBtn}>
            <Text style={styles.encerrarBtnText}>Encerrar aplicação →</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Aplicações</Text>
        <TouchableOpacity style={styles.btnNova} onPress={() => router.push('/nova-aplicacao')}>
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={styles.filtrosRow}>
        {(['todas', 'em_andamento', 'encerrada'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroBtn, filtro === f && styles.filtroBtnAtivo]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.filtroText, filtro === f && styles.filtroTextAtivo]}>
              {f === 'todas' ? 'Todas' : f === 'em_andamento' ? 'Em andamento' : 'Encerradas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="tractor" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>Nenhuma aplicação encontrada</Text>
            <TouchableOpacity style={styles.btnNovaEmpty} onPress={() => router.push('/nova-aplicacao')}>
              <Text style={styles.btnNovaEmptyText}>Registrar nova aplicação</Text>
            </TouchableOpacity>
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
  btnNova:     { backgroundColor: '#16a34a', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  filtrosRow:  { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, gap: 8,
                 borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  filtroBtn:   { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  filtroBtnAtivo: { backgroundColor: '#dcfce7' },
  filtroText:  { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filtroTextAtivo: { color: '#16a34a', fontWeight: '700' },
  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
                 elevation: 2, borderLeftWidth: 4, borderLeftColor: '#e5e7eb' },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText:  { fontSize: 12, fontWeight: '600' },
  dataText:    { fontSize: 12, color: '#9ca3af' },
  fazendaNome: { fontSize: 15, fontWeight: '700', color: '#111827' },
  talhaoNome:  { fontSize: 13, color: '#6b7280', marginTop: 2 },
  pragaRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  pragaText:   { fontSize: 12, color: '#6b7280' },
  areaText:    { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  encerrarBtn: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8 },
  encerrarBtnText: { fontSize: 13, color: '#16a34a', fontWeight: '600' },
  emptyState:  { alignItems: 'center', paddingTop: 80 },
  emptyText:   { fontSize: 16, color: '#9ca3af', marginTop: 12, marginBottom: 20 },
  btnNovaEmpty: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  btnNovaEmptyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
