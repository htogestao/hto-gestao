import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useStore } from '../../src/store/useStore'
import { getDB } from '../../src/services/sync'
import { syncAll, countPending } from '../../src/services/sync'

interface AplicacaoResumida {
  id: string
  data: string
  fazenda_nome: string
  talhao_nome: string
  status: string
  praga_alvo: string | null
}

interface Alerta {
  tipo: 'vencido' | 'vencimento_proximo' | 'estoque_baixo'
  nome: string
  detalhe: string
}

export default function HomeScreen() {
  const profile = useStore(s => s.profile)
  const sync = useStore(s => s.sync)
  const setSyncStatus = useStore(s => s.setSyncStatus)

  const [aplicacoes, setAplicacoes] = useState<AplicacaoResumida[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [refreshing, setRefreshing] = useState(false)

  async function loadData() {
    const db = await getDB()

    const rows = await db.getAllAsync<AplicacaoResumida & { fazenda_nome: string; talhao_nome: string }>(`
      SELECT a.id, a.data, a.status, a.praga_alvo,
             f.nome as fazenda_nome, t.nome as talhao_nome
      FROM aplicacoes a
      LEFT JOIN fazendas f ON f.id = a.fazenda_id
      LEFT JOIN talhoes t ON t.id = a.talhao_id
      WHERE a.status = 'em_andamento'
      ORDER BY a.created_at DESC
      LIMIT 5
    `)
    setAplicacoes(rows)

    // alertas locais: lotes vencidos ou próximos
    const vencidos = await db.getAllAsync<{ nome: string; data_vencimento: string }>(`
      SELECT d.nome_comercial as nome, l.data_vencimento
      FROM lotes_field l
      JOIN defensivos d ON d.id = l.defensivo_id
      WHERE l.data_vencimento < date('now') AND l.quantidade_atual > 0
    `)
    const proximos = await db.getAllAsync<{ nome: string; data_vencimento: string }>(`
      SELECT d.nome_comercial as nome, l.data_vencimento
      FROM lotes_field l
      JOIN defensivos d ON d.id = l.defensivo_id
      WHERE l.data_vencimento BETWEEN date('now') AND date('now', '+30 days') AND l.quantidade_atual > 0
    `)

    const alertasList: Alerta[] = [
      ...vencidos.map(v => ({ tipo: 'vencido' as const, nome: v.nome, detalhe: `Vencido em ${v.data_vencimento}` })),
      ...proximos.map(p => ({ tipo: 'vencimento_proximo' as const, nome: p.nome, detalhe: `Vence em ${p.data_vencimento}` })),
    ]
    setAlertas(alertasList)

    const pending = await countPending()
    setSyncStatus({ pendingCount: pending })
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setSyncStatus({ syncing: true })
      await syncAll((msg) => console.log(msg))
      const pending = await countPending()
      setSyncStatus({ syncing: false, lastSync: new Date(), pendingCount: pending })
      await loadData()
    } catch (e) {
      setSyncStatus({ syncing: false })
    }
    setRefreshing(false)
  }, [])

  useEffect(() => { loadData() }, [])

  const nomeUsuario = profile?.nome?.split(' ')[0] ?? 'Campo'
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {nomeUsuario} 👋</Text>
          <Text style={styles.date}>{hoje}</Text>
        </View>
        <View style={[styles.syncDot, { backgroundColor: sync.online ? '#16a34a' : '#9ca3af' }]} />
      </View>

      {/* Cards rápidos */}
      <View style={styles.cardsRow}>
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/aplicacoes')}>
          <MaterialCommunityIcons name="tractor" size={28} color="#16a34a" />
          <Text style={styles.cardNum}>{aplicacoes.length}</Text>
          <Text style={styles.cardLabel}>Em andamento</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => router.push('/(tabs)/estoque')}>
          <MaterialCommunityIcons name="package-variant" size={28} color="#d97706" />
          <Text style={styles.cardNum}>{alertas.length}</Text>
          <Text style={styles.cardLabel}>Alertas estoque</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card}>
          <MaterialCommunityIcons name="cloud-sync" size={28} color={sync.pendingCount > 0 ? '#dc2626' : '#6b7280'} />
          <Text style={styles.cardNum}>{sync.pendingCount}</Text>
          <Text style={styles.cardLabel}>Pendentes sync</Text>
        </TouchableOpacity>
      </View>

      {/* Botão nova aplicação */}
      <TouchableOpacity style={styles.btnNova} onPress={() => router.push('/nova-aplicacao')}>
        <MaterialCommunityIcons name="plus-circle" size={22} color="#fff" />
        <Text style={styles.btnNovaText}>Nova Aplicação</Text>
      </TouchableOpacity>

      {/* Aplicações em andamento */}
      {aplicacoes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aplicações em andamento</Text>
          {aplicacoes.map(a => (
            <TouchableOpacity
              key={a.id}
              style={styles.aplicacaoCard}
              onPress={() => router.push({ pathname: '/encerrar-aplicacao', params: { id: a.id } })}
            >
              <View style={styles.aplicacaoHeader}>
                <MaterialCommunityIcons name="tractor" size={18} color="#16a34a" />
                <Text style={styles.aplicacaoFazenda}>{a.fazenda_nome}</Text>
                <View style={styles.tagAndamento}>
                  <Text style={styles.tagText}>Em andamento</Text>
                </View>
              </View>
              <Text style={styles.aplicacaoTalhao}>Talhão: {a.talhao_nome}</Text>
              <Text style={styles.aplicacaoData}>{a.data ? new Date(a.data).toLocaleDateString('pt-BR') : ''}</Text>
              <Text style={styles.encerrarHint}>Toque para encerrar →</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Alertas */}
      {alertas.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alertas de estoque</Text>
          {alertas.map((a, i) => (
            <View key={i} style={[styles.alertaCard, a.tipo === 'vencido' ? styles.alertaVencido : styles.alertaProximo]}>
              <MaterialCommunityIcons
                name={a.tipo === 'vencido' ? 'alert-circle' : 'clock-alert'}
                size={18}
                color={a.tipo === 'vencido' ? '#dc2626' : '#d97706'}
              />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.alertaNome}>{a.nome}</Text>
                <Text style={styles.alertaDetalhe}>{a.detalhe}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {aplicacoes.length === 0 && alertas.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="check-circle" size={48} color="#16a34a" />
          <Text style={styles.emptyText}>Tudo em dia!</Text>
          <Text style={styles.emptySubtext}>Nenhuma aplicação em andamento{'\n'}e sem alertas de estoque.</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f0fdf4' },
  content:     { padding: 16, paddingBottom: 32 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting:    { fontSize: 22, fontWeight: 'bold', color: '#14532d' },
  date:        { fontSize: 13, color: '#6b7280', marginTop: 2 },
  syncDot:     { width: 12, height: 12, borderRadius: 6 },
  cardsRow:    { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card:        { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', elevation: 2 },
  cardNum:     { fontSize: 22, fontWeight: 'bold', color: '#111827', marginTop: 6 },
  cardLabel:   { fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 2 },
  btnNova:     { backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                 gap: 8, borderRadius: 12, paddingVertical: 14, marginBottom: 20, elevation: 3 },
  btnNovaText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  section:     { marginBottom: 20 },
  sectionTitle:{ fontSize: 16, fontWeight: 'bold', color: '#14532d', marginBottom: 10 },
  aplicacaoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2,
                   borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  aplicacaoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  aplicacaoFazenda: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  tagAndamento: { backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tagText:     { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  aplicacaoTalhao: { fontSize: 13, color: '#374151' },
  aplicacaoData: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  encerrarHint: { fontSize: 12, color: '#16a34a', marginTop: 6, fontWeight: '500' },
  alertaCard:  { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 8 },
  alertaVencido: { backgroundColor: '#fef2f2' },
  alertaProximo: { backgroundColor: '#fffbeb' },
  alertaNome:  { fontSize: 13, fontWeight: '600', color: '#111827' },
  alertaDetalhe: { fontSize: 12, color: '#6b7280' },
  emptyState:  { alignItems: 'center', paddingTop: 60 },
  emptyText:   { fontSize: 20, fontWeight: 'bold', color: '#16a34a', marginTop: 12 },
  emptySubtext:{ fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
})
