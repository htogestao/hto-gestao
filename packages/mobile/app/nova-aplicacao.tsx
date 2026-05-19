/**
 * Nova Aplicação — fluxo em etapas:
 * 1. Selecionar Fazenda
 * 2. Selecionar Talhão
 * 3. Configurar cabeçalho (data, área)
 * 4. Adicionar defensivos (com sugestão FEFO de lotes)
 * 5. Confirmar e salvar
 */
import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as Crypto from 'expo-crypto'
import { getDB } from '../src/services/sync'
import { useStore } from '../src/store/useStore'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Fazenda { id: string; nome: string; municipio: string | null }
interface Talhao  { id: string; nome: string; area_ha: number | null; cultura_atual: string | null }
interface Defensivo { id: string; nome_comercial: string; principio_ativo: string | null; unidade: string; classe: string }
interface LoteDisponivel {
  id: string
  quantidade_atual: number
  data_vencimento: string | null
  lote_fabricante: string | null
}
interface ItemAplicacao {
  defensivo_id: string
  defensivo_nome: string
  unidade: string
  lote_id: string
  lote_fab: string | null
  dose_por_hectare: string
  quantidade_calculada: number
}

type Step = 'fazenda' | 'talhao' | 'cabecalho' | 'defensivos' | 'confirmar'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hoje() {
  return new Date().toISOString().split('T')[0]
}

export default function NovaAplicacaoScreen() {
  const profile = useStore(s => s.profile)

  const [step, setStep]         = useState<Step>('fazenda')
  const [fazendas, setFazendas] = useState<Fazenda[]>([])
  const [talhoes, setTalhoes]   = useState<Talhao[]>([])
  const [defensivos, setDefensivos] = useState<Defensivo[]>([])

  // seleções
  const [fazendaSel, setFazendaSel] = useState<Fazenda | null>(null)
  const [talhaoSel, setTalhaoSel]   = useState<Talhao | null>(null)
  const [data, setData]             = useState(hoje())
  const [areaHa, setAreaHa]         = useState('')
  const [itens, setItens]           = useState<ItemAplicacao[]>([])

  // modal de defensivo
  const [modalDefensivo, setModalDefensivo]   = useState(false)
  const [defFiltro, setDefFiltro]             = useState('')
  const [defSel, setDefSel]                   = useState<Defensivo | null>(null)
  const [lotes, setLotes]                     = useState<LoteDisponivel[]>([])
  const [loteSel, setLoteSel]                 = useState<LoteDisponivel | null>(null)
  const [doseInput, setDoseInput]             = useState('')

  const [salvando, setSalvando] = useState(false)

  useEffect(() => { loadFazendas() }, [])

  async function loadFazendas() {
    const db = await getDB()
    const rows = await db.getAllAsync<Fazenda>(`SELECT id, nome, municipio FROM fazendas ORDER BY nome`)
    setFazendas(rows)
  }

  async function loadTalhoes(fazendaId: string) {
    const db = await getDB()
    const rows = await db.getAllAsync<Talhao>(
      `SELECT id, nome, area_ha, cultura_atual FROM talhoes WHERE fazenda_id = ? ORDER BY nome`,
      [fazendaId]
    )
    setTalhoes(rows)
  }

  async function loadDefensivos() {
    const db = await getDB()
    const rows = await db.getAllAsync<Defensivo>(
      `SELECT d.id, d.nome_comercial, d.principio_ativo, d.unidade, d.classe
       FROM defensivos d
       WHERE EXISTS (SELECT 1 FROM lotes_field l WHERE l.defensivo_id = d.id AND l.quantidade_atual > 0)
       ORDER BY d.nome_comercial`
    )
    setDefensivos(rows)
  }

  async function loadLotesDefensivo(defensivoId: string) {
    const db = await getDB()
    // FEFO: ordena por data_vencimento ASC, nulls no fim
    const rows = await db.getAllAsync<LoteDisponivel>(
      `SELECT id, quantidade_atual, data_vencimento, lote_fabricante
       FROM lotes_field
       WHERE defensivo_id = ? AND quantidade_atual > 0
       ORDER BY CASE WHEN data_vencimento IS NULL THEN 1 ELSE 0 END, data_vencimento ASC`,
      [defensivoId]
    )
    setLotes(rows)
    if (rows.length > 0) setLoteSel(rows[0]) // FEFO: pré-seleciona o primeiro
  }

  function selectFazenda(f: Fazenda) {
    setFazendaSel(f)
    loadTalhoes(f.id)
    // pré-preencher área se talhão já selecionado
    setStep('talhao')
  }

  function selectTalhao(t: Talhao) {
    setTalhaoSel(t)
    if (t.area_ha) setAreaHa(String(t.area_ha))
    setStep('cabecalho')
  }

  function abrirModalDefensivo() {
    setDefFiltro('')
    setDefSel(null)
    setLotes([])
    setLoteSel(null)
    setDoseInput('')
    loadDefensivos()
    setModalDefensivo(true)
  }

  function selecionarDefensivo(d: Defensivo) {
    setDefSel(d)
    loadLotesDefensivo(d.id)
  }

  function calcularQtd(): number {
    const dose = parseFloat(doseInput.replace(',', '.'))
    const area = parseFloat(areaHa.replace(',', '.'))
    if (isNaN(dose) || isNaN(area)) return 0
    return parseFloat((dose * area).toFixed(3))
  }

  function adicionarItem() {
    if (!defSel || !loteSel) {
      Alert.alert('Selecione o defensivo e o lote')
      return
    }
    const dose = parseFloat(doseInput.replace(',', '.'))
    if (isNaN(dose) || dose <= 0) {
      Alert.alert('Informe a dose por hectare')
      return
    }
    const qtd = calcularQtd()
    if (qtd > loteSel.quantidade_atual) {
      Alert.alert(
        'Estoque insuficiente',
        `Necessário: ${qtd.toFixed(2)} ${defSel.unidade}\nDisponível no lote: ${loteSel.quantidade_atual.toFixed(2)} ${defSel.unidade}`
      )
      return
    }
    // Verifica se já tem o mesmo defensivo
    const existe = itens.find(i => i.defensivo_id === defSel.id && i.lote_id === loteSel.id)
    if (existe) {
      Alert.alert('Defensivo já adicionado', 'Este defensivo com este lote já foi adicionado.')
      return
    }
    setItens(prev => [...prev, {
      defensivo_id: defSel.id,
      defensivo_nome: defSel.nome_comercial,
      unidade: defSel.unidade,
      lote_id: loteSel.id,
      lote_fab: loteSel.lote_fabricante,
      dose_por_hectare: doseInput,
      quantidade_calculada: qtd,
    }])
    setModalDefensivo(false)
  }

  function removerItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  async function salvarAplicacao() {
    if (!fazendaSel || !talhaoSel) return
    if (itens.length === 0) {
      Alert.alert('Adicione pelo menos um defensivo')
      return
    }
    setSalvando(true)
    try {
      const db = await getDB()
      const aplicacaoId = await Crypto.randomUUID()
      const areaNum = parseFloat(areaHa.replace(',', '.')) || null

      await db.runAsync(
        `INSERT INTO aplicacoes (id, data, fazenda_id, talhao_id, area_aplicada_ha, responsavel_id, status, synced, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'em_andamento', 0, datetime('now'))`,
        [aplicacaoId, data, fazendaSel.id, talhaoSel.id, areaNum, profile?.id ?? '']
      )

      for (const item of itens) {
        const itemId = await Crypto.randomUUID()
        const dose = parseFloat(item.dose_por_hectare.replace(',', '.'))
        await db.runAsync(
          `INSERT INTO aplicacao_itens (id, aplicacao_id, defensivo_id, lote_id, dose_por_hectare, quantidade_usada, synced)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          [itemId, aplicacaoId, item.defensivo_id, item.lote_id, dose, item.quantidade_calculada]
        )
        // Dar baixa no estoque local (otimista)
        await db.runAsync(
          `UPDATE lotes_field SET quantidade_atual = quantidade_atual - ? WHERE id = ?`,
          [item.quantidade_calculada, item.lote_id]
        )
      }

      Alert.alert(
        'Aplicação registrada!',
        'A aplicação foi salva localmente. Será sincronizada com o servidor quando houver conexão.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/aplicacoes') }]
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar'
      Alert.alert('Erro', msg)
    } finally {
      setSalvando(false)
    }
  }

  // ─── Render por etapa ────────────────────────────────────────────────────
  function StepIndicator() {
    const steps: Step[] = ['fazenda', 'talhao', 'cabecalho', 'defensivos', 'confirmar']
    const labels = ['Fazenda', 'Talhão', 'Dados', 'Defensivos', 'Confirmar']
    const currentIdx = steps.indexOf(step)
    return (
      <View style={styles.stepRow}>
        {steps.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepCircle, i <= currentIdx && styles.stepCircleActive]}>
              <Text style={[styles.stepNum, i <= currentIdx && styles.stepNumActive]}>{i + 1}</Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.stepLine, i < currentIdx && styles.stepLineActive]} />
            )}
          </View>
        ))}
      </View>
    )
  }

  const defsFiltrados = defFiltro
    ? defensivos.filter(d =>
        d.nome_comercial.toLowerCase().includes(defFiltro.toLowerCase()) ||
        (d.principio_ativo ?? '').toLowerCase().includes(defFiltro.toLowerCase())
      )
    : defensivos

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Aplicação</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <StepIndicator />

        {/* STEP 1: Fazenda */}
        {step === 'fazenda' && (
          <View>
            <Text style={styles.stepTitle}>Selecione a fazenda</Text>
            {fazendas.map(f => (
              <TouchableOpacity key={f.id} style={styles.listItem} onPress={() => selectFazenda(f)}>
                <MaterialCommunityIcons name="sprout" size={20} color="#16a34a" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.listItemTitle}>{f.nome}</Text>
                  {f.municipio && <Text style={styles.listItemSub}>{f.municipio}</Text>}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STEP 2: Talhão */}
        {step === 'talhao' && (
          <View>
            <TouchableOpacity style={styles.backLink} onPress={() => setStep('fazenda')}>
              <MaterialCommunityIcons name="arrow-left" size={16} color="#16a34a" />
              <Text style={styles.backLinkText}>Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.stepTitle}>Selecione o talhão</Text>
            <Text style={styles.stepSub}>{fazendaSel?.nome}</Text>
            {talhoes.map(t => (
              <TouchableOpacity key={t.id} style={styles.listItem} onPress={() => selectTalhao(t)}>
                <MaterialCommunityIcons name="texture-box" size={20} color="#16a34a" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.listItemTitle}>{t.nome}</Text>
                  <Text style={styles.listItemSub}>
                    {[t.cultura_atual, t.area_ha ? `${t.area_ha.toFixed(1)} ha` : null].filter(Boolean).join(' • ')}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* STEP 3: Cabeçalho */}
        {step === 'cabecalho' && (
          <View>
            <TouchableOpacity style={styles.backLink} onPress={() => setStep('talhao')}>
              <MaterialCommunityIcons name="arrow-left" size={16} color="#16a34a" />
              <Text style={styles.backLinkText}>Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.stepTitle}>Dados da aplicação</Text>
            <Text style={styles.stepSub}>{fazendaSel?.nome} / {talhaoSel?.nome}</Text>

            <Text style={styles.label}>Data da aplicação</Text>
            <TextInput
              style={styles.input}
              value={data}
              onChangeText={setData}
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.label}>Área aplicada (ha)</Text>
            <TextInput
              style={styles.input}
              value={areaHa}
              onChangeText={setAreaHa}
              keyboardType="decimal-pad"
              placeholder="Ex: 12.5"
              placeholderTextColor="#9ca3af"
            />

            <TouchableOpacity
              style={[styles.btnProximo, (!data || !areaHa) && styles.btnDesabilitado]}
              onPress={() => {
                if (!data || !areaHa) { Alert.alert('Preencha data e área'); return }
                loadDefensivos()
                setStep('defensivos')
              }}
              disabled={!data || !areaHa}
            >
              <Text style={styles.btnProximoText}>Próximo →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: Defensivos */}
        {step === 'defensivos' && (
          <View>
            <TouchableOpacity style={styles.backLink} onPress={() => setStep('cabecalho')}>
              <MaterialCommunityIcons name="arrow-left" size={16} color="#16a34a" />
              <Text style={styles.backLinkText}>Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.stepTitle}>Defensivos usados</Text>
            <Text style={styles.stepSub}>Área: {areaHa} ha  •  {data}</Text>

            {itens.map((item, idx) => (
              <View key={idx} style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemNome}>{item.defensivo_nome}</Text>
                  <Text style={styles.itemDetalhe}>
                    Dose: {item.dose_por_hectare} {item.unidade}/ha  •  Total: {item.quantidade_calculada.toFixed(2)} {item.unidade}
                  </Text>
                  {item.lote_fab && <Text style={styles.itemLote}>Lote: {item.lote_fab}</Text>}
                </View>
                <TouchableOpacity onPress={() => removerItem(idx)}>
                  <MaterialCommunityIcons name="close-circle" size={22} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.btnAdicionar} onPress={abrirModalDefensivo}>
              <MaterialCommunityIcons name="plus" size={20} color="#16a34a" />
              <Text style={styles.btnAdicionarText}>Adicionar defensivo</Text>
            </TouchableOpacity>

            {itens.length > 0 && (
              <TouchableOpacity style={styles.btnProximo} onPress={() => setStep('confirmar')}>
                <Text style={styles.btnProximoText}>Revisar e confirmar →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* STEP 5: Confirmar */}
        {step === 'confirmar' && (
          <View>
            <TouchableOpacity style={styles.backLink} onPress={() => setStep('defensivos')}>
              <MaterialCommunityIcons name="arrow-left" size={16} color="#16a34a" />
              <Text style={styles.backLinkText}>Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.stepTitle}>Confirmar aplicação</Text>

            <View style={styles.resumoCard}>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Fazenda</Text>
                <Text style={styles.resumoValor}>{fazendaSel?.nome}</Text>
              </View>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Talhão</Text>
                <Text style={styles.resumoValor}>{talhaoSel?.nome}</Text>
              </View>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Data</Text>
                <Text style={styles.resumoValor}>{new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}</Text>
              </View>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Área</Text>
                <Text style={styles.resumoValor}>{areaHa} ha</Text>
              </View>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Defensivos</Text>
                <Text style={styles.resumoValor}>{itens.length} produto(s)</Text>
              </View>
            </View>

            {itens.map((item, idx) => (
              <View key={idx} style={[styles.itemCard, { marginTop: 8 }]}>
                <MaterialCommunityIcons name="flask" size={18} color="#16a34a" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemNome}>{item.defensivo_nome}</Text>
                  <Text style={styles.itemDetalhe}>
                    {item.quantidade_calculada.toFixed(2)} {item.unidade}
                    {item.lote_fab ? `  •  Lote: ${item.lote_fab}` : ''}
                  </Text>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.btnSalvar, salvando && styles.btnDesabilitado]}
              onPress={salvarAplicacao}
              disabled={salvando}
            >
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.btnSalvarText}>
                {salvando ? 'Salvando...' : 'Registrar aplicação'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal de defensivo */}
      <Modal visible={modalDefensivo} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Adicionar defensivo</Text>
            <TouchableOpacity onPress={() => setModalDefensivo(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {!defSel ? (
            <>
              <View style={styles.modalSearch}>
                <MaterialCommunityIcons name="magnify" size={18} color="#9ca3af" />
                <TextInput
                  style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' }}
                  placeholder="Buscar defensivo..."
                  placeholderTextColor="#9ca3af"
                  value={defFiltro}
                  onChangeText={setDefFiltro}
                />
              </View>
              <FlatList
                data={defsFiltrados}
                keyExtractor={d => d.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.modalItem} onPress={() => selecionarDefensivo(item)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalItemTitle}>{item.nome_comercial}</Text>
                      {item.principio_ativo && (
                        <Text style={styles.modalItemSub}>{item.principio_ativo}</Text>
                      )}
                    </View>
                    <Text style={styles.modalItemUnidade}>{item.unidade}</Text>
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {/* Defensivo selecionado */}
              <View style={styles.defSelCard}>
                <Text style={styles.defSelNome}>{defSel.nome_comercial}</Text>
                {defSel.principio_ativo && (
                  <Text style={styles.defSelSub}>{defSel.principio_ativo}</Text>
                )}
                <TouchableOpacity onPress={() => { setDefSel(null); setLotes([]); setLoteSel(null) }}>
                  <Text style={{ color: '#16a34a', fontSize: 13, marginTop: 6 }}>Trocar produto</Text>
                </TouchableOpacity>
              </View>

              {/* Lotes disponíveis (FEFO) */}
              <Text style={styles.label}>Lote (FEFO — primeiros a vencer primeiro)</Text>
              {lotes.map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.loteOption, loteSel?.id === l.id && styles.loteOptionSelected]}
                  onPress={() => setLoteSel(l)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loteOptionQtd}>
                      {l.quantidade_atual.toFixed(2)} {defSel.unidade} disponível
                    </Text>
                    {l.data_vencimento && (
                      <Text style={styles.loteOptionVenc}>Vence: {new Date(l.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</Text>
                    )}
                    {l.lote_fabricante && (
                      <Text style={styles.loteOptionFab}>Lote: {l.lote_fabricante}</Text>
                    )}
                  </View>
                  {loteSel?.id === l.id && (
                    <MaterialCommunityIcons name="check-circle" size={22} color="#16a34a" />
                  )}
                </TouchableOpacity>
              ))}

              {/* Dose */}
              <Text style={[styles.label, { marginTop: 16 }]}>Dose por hectare ({defSel.unidade}/ha)</Text>
              <TextInput
                style={styles.input}
                value={doseInput}
                onChangeText={setDoseInput}
                keyboardType="decimal-pad"
                placeholder="Ex: 2.5"
                placeholderTextColor="#9ca3af"
              />

              {/* Preview quantidade */}
              {doseInput && areaHa && (
                <View style={styles.previewQtd}>
                  <Text style={styles.previewText}>
                    Quantidade necessária: {calcularQtd().toFixed(2)} {defSel.unidade}
                    {loteSel && calcularQtd() > loteSel.quantidade_atual
                      ? '  ⚠️ Insuficiente no lote'
                      : '  ✓'}
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.btnAdicionar2} onPress={adicionarItem}>
                <Text style={styles.btnAdicionar2Text}>Adicionar ao registro</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header:       { backgroundColor: '#14532d', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
                  flexDirection: 'row', alignItems: 'center' },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  container:    { flex: 1, backgroundColor: '#f0fdf4' },
  content:      { padding: 20, paddingBottom: 40 },
  stepRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 24, justifyContent: 'center' },
  stepItem:     { flexDirection: 'row', alignItems: 'center' },
  stepCircle:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e5e7eb',
                  alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: '#16a34a' },
  stepNum:      { fontSize: 12, fontWeight: 'bold', color: '#9ca3af' },
  stepNumActive:{ color: '#fff' },
  stepLine:     { width: 20, height: 2, backgroundColor: '#e5e7eb', marginHorizontal: 2 },
  stepLineActive: { backgroundColor: '#16a34a' },
  stepTitle:    { fontSize: 20, fontWeight: 'bold', color: '#14532d', marginBottom: 4 },
  stepSub:      { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  backLink:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backLinkText: { color: '#16a34a', fontSize: 14 },
  listItem:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12,
                  padding: 14, marginBottom: 10, elevation: 1 },
  listItemTitle:{ fontSize: 14, fontWeight: '600', color: '#111827' },
  listItemSub:  { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  label:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:        { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                  fontSize: 15, color: '#111827', borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 14 },
  btnProximo:   { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnProximoText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  btnDesabilitado: { backgroundColor: '#9ca3af' },
  itemCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10,
                  padding: 12, marginBottom: 8, elevation: 1 },
  itemNome:     { fontSize: 13, fontWeight: '700', color: '#111827' },
  itemDetalhe:  { fontSize: 12, color: '#6b7280', marginTop: 2 },
  itemLote:     { fontSize: 11, color: '#9ca3af' },
  btnAdicionar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 2,
                  borderColor: '#16a34a', paddingVertical: 12, paddingHorizontal: 16, marginTop: 4,
                  justifyContent: 'center', backgroundColor: '#f0fdf4' },
  btnAdicionarText: { color: '#16a34a', fontWeight: '700', fontSize: 14 },
  resumoCard:   { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1 },
  resumoRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
                  borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  resumoLabel:  { fontSize: 13, color: '#6b7280' },
  resumoValor:  { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1, textAlign: 'right' },
  btnSalvar:    { backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, borderRadius: 12, paddingVertical: 16, marginTop: 20 },
  btnSalvarText:{ color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalTitle:   { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  modalSearch:  { flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: '#f3f4f6',
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  modalItem:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
                  borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  modalItemTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  modalItemSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  modalItemUnidade: { fontSize: 12, color: '#16a34a', fontWeight: '600' },
  defSelCard:   { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 16 },
  defSelNome:   { fontSize: 15, fontWeight: '700', color: '#14532d' },
  defSelSub:    { fontSize: 13, color: '#6b7280' },
  loteOption:   { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 10, padding: 12,
                  marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  loteOptionSelected: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  loteOptionQtd: { fontSize: 14, fontWeight: '600', color: '#111827' },
  loteOptionVenc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  loteOptionFab: { fontSize: 11, color: '#9ca3af' },
  previewQtd:   { backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, marginBottom: 12 },
  previewText:  { fontSize: 13, color: '#1d4ed8' },
  btnAdicionar2: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnAdicionar2Text: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
})
