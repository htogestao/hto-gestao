import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../../src/services/supabase'
import { useStore } from '../../src/store/useStore'
import { syncAll, countPending } from '../../src/services/sync'

export default function MaisScreen() {
  const profile = useStore(s => s.profile)
  const setProfile = useStore(s => s.setProfile)
  const sync = useStore(s => s.sync)
  const setSyncStatus = useStore(s => s.setSyncStatus)
  const [syncLog, setSyncLog] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)

  async function refreshPending() {
    const n = await countPending()
    setSyncStatus({ pendingCount: n })
  }

  useEffect(() => { refreshPending() }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshPending()
    setRefreshing(false)
  }, [])

  async function handleSync() {
    if (sync.syncing) return
    setSyncLog([])
    setSyncStatus({ syncing: true })
    try {
      await syncAll((msg) => {
        setSyncLog(prev => [...prev, msg])
      })
      const n = await countPending()
      setSyncStatus({ syncing: false, lastSync: new Date(), pendingCount: n, online: true })
      setSyncLog(prev => [...prev, '✓ Sincronização concluída!'])
    } catch (e: unknown) {
      setSyncStatus({ syncing: false, online: false })
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      setSyncLog(prev => [...prev, `✗ Erro: ${msg}`])
    }
  }

  async function handleLogout() {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut()
            setProfile(null)
            router.replace('/(auth)/login')
          },
        },
      ]
    )
  }

  const lastSyncText = sync.lastSync
    ? sync.lastSync.toLocaleString('pt-BR')
    : 'Nunca sincronizado'

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />}
    >
      {/* Perfil */}
      <View style={styles.profileCard}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarText}>{(profile?.nome ?? 'U')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileNome}>{profile?.nome ?? '—'}</Text>
          <Text style={styles.profileEmail}>{profile?.email ?? '—'}</Text>
          <View style={[styles.roleBadge, { backgroundColor: profile?.role === 'admin' ? '#dcfce7' : '#eff6ff' }]}>
            <Text style={[styles.roleText, { color: profile?.role === 'admin' ? '#16a34a' : '#2563eb' }]}>
              {profile?.role === 'admin' ? 'Administrador' : profile?.role === 'field' ? 'Operador de campo' : 'Visualizador'}
            </Text>
          </View>
        </View>
      </View>

      {/* Status sync */}
      <View style={styles.syncCard}>
        <View style={styles.syncHeader}>
          <MaterialCommunityIcons
            name={sync.online ? 'cloud-check' : 'cloud-off-outline'}
            size={22}
            color={sync.online ? '#16a34a' : '#9ca3af'}
          />
          <Text style={styles.syncTitle}>Sincronização</Text>
          <View style={[styles.onlineDot, { backgroundColor: sync.online ? '#16a34a' : '#9ca3af' }]} />
          <Text style={[styles.onlineText, { color: sync.online ? '#16a34a' : '#9ca3af' }]}>
            {sync.online ? 'Online' : 'Offline'}
          </Text>
        </View>

        <View style={styles.syncInfoRow}>
          <Text style={styles.syncInfoLabel}>Última sync:</Text>
          <Text style={styles.syncInfoValue}>{lastSyncText}</Text>
        </View>
        <View style={styles.syncInfoRow}>
          <Text style={styles.syncInfoLabel}>Pendentes:</Text>
          <Text style={[styles.syncInfoValue, { color: sync.pendingCount > 0 ? '#dc2626' : '#16a34a', fontWeight: '700' }]}>
            {sync.pendingCount} {sync.pendingCount === 1 ? 'registro' : 'registros'}
          </Text>
        </View>

        {syncLog.length > 0 && (
          <View style={styles.logBox}>
            {syncLog.map((line, i) => (
              <Text key={i} style={styles.logLine}>{line}</Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.btnSync, sync.syncing && styles.btnSyncDisabled]}
          onPress={handleSync}
          disabled={sync.syncing}
        >
          <MaterialCommunityIcons
            name={sync.syncing ? 'loading' : 'sync'}
            size={18}
            color="#fff"
          />
          <Text style={styles.btnSyncText}>
            {sync.syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sobre */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sobre</Text>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="information" size={18} color="#6b7280" />
          <Text style={styles.infoText}>AgroGestão v1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="leaf" size={18} color="#6b7280" />
          <Text style={styles.infoText}>Gestão Agrícola de Campo</Text>
        </View>
      </View>

      {/* Sair */}
      <TouchableOpacity style={styles.btnSair} onPress={handleLogout}>
        <MaterialCommunityIcons name="logout" size={18} color="#dc2626" />
        <Text style={styles.btnSairText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f9fafb' },
  content:     { padding: 20, paddingTop: 60, paddingBottom: 40 },
  profileCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row',
                 alignItems: 'center', gap: 16, marginBottom: 16, elevation: 2 },
  avatarBox:   { width: 56, height: 56, borderRadius: 28, backgroundColor: '#16a34a',
                 alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  profileNome: { fontSize: 16, fontWeight: '700', color: '#111827' },
  profileEmail:{ fontSize: 13, color: '#6b7280', marginBottom: 6 },
  roleBadge:   { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleText:    { fontSize: 11, fontWeight: '700' },
  syncCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  syncHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  syncTitle:   { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  onlineDot:   { width: 8, height: 8, borderRadius: 4 },
  onlineText:  { fontSize: 13, fontWeight: '600' },
  syncInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
                 borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  syncInfoLabel: { fontSize: 13, color: '#6b7280' },
  syncInfoValue: { fontSize: 13, color: '#374151' },
  logBox:      { backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginTop: 12 },
  logLine:     { fontSize: 12, color: '#374151', fontFamily: 'monospace', marginBottom: 2 },
  btnSync:     { backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                 gap: 8, borderRadius: 10, paddingVertical: 12, marginTop: 14 },
  btnSyncDisabled: { backgroundColor: '#9ca3af' },
  btnSyncText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  section:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  infoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  infoText:    { fontSize: 13, color: '#374151' },
  btnSair:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                 backgroundColor: '#fef2f2', borderRadius: 12, paddingVertical: 14 },
  btnSairText: { fontSize: 15, fontWeight: '700', color: '#dc2626' },
})
