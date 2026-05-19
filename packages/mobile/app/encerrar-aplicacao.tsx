/**
 * Encerrar Aplicação — preenche os dados finais e gera o comprovante PDF.
 * Campos: praga_alvo, condicoes_climaticas, calda_total_L, sobra por item
 */
import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import * as Print from 'expo-print'
import { getDB } from '../src/services/sync'
import { useStore } from '../src/store/useStore'

interface AplicacaoDetalhe {
  id: string
  data: string
  fazenda_nome: string
  talhao_nome: string
  area_aplicada_ha: number | null
  status: string
}

interface ItemDetalhe {
  id: string
  aplicacao_id: string
  defensivo_id: string
  lote_id: string
  defensivo_nome: string
  unidade: string
  lote_fabricante: string | null
  dose_por_hectare: number
  quantidade_usada: number
  quantidade_sobrou: number
  calda_total_l: number | null
}

export default function EncerrarAplicacaoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const profile = useStore(s => s.profile)

  const [aplicacao, setAplicacao] = useState<AplicacaoDetalhe | null>(null)
  const [itens, setItens]         = useState<ItemDetalhe[]>([])
  const [loading, setLoading]     = useState(true)
  const [salvando, setSalvando]   = useState(false)

  // Campos do encerramento
  const [pragaAlvo, setPragaAlvo]           = useState('')
  const [condicoes, setCondicoes]           = useState('')
  const [caldaTotal, setCaldaTotal]         = useState('')
  // sobra por item: { [itemId]: string }
  const [sobras, setSobras]                 = useState<Record<string, string>>({})

  useEffect(() => { loadAplicacao() }, [id])

  async function loadAplicacao() {
    if (!id) return
    const db = await getDB()
    const ap = await db.getFirstAsync<AplicacaoDetalhe>(`
      SELECT a.id, a.data, a.area_aplicada_ha, a.status,
             a.praga_alvo, a.condicoes_climaticas,
             f.nome as fazenda_nome, t.nome as talhao_nome
      FROM aplicacoes a
      LEFT JOIN fazendas f ON f.id = a.fazenda_id
      LEFT JOIN talhoes t ON t.id = a.talhao_id
      WHERE a.id = ?
    `, [id])

    const itemRows = await db.getAllAsync<ItemDetalhe>(`
      SELECT ai.id, ai.aplicacao_id, ai.defensivo_id, ai.lote_id,
             d.nome_comercial as defensivo_nome, d.unidade,
             l.lote_fabricante,
             ai.dose_por_hectare, ai.quantidade_usada, ai.quantidade_sobrou, ai.calda_total_l
      FROM aplicacao_itens ai
      JOIN defensivos d ON d.id = ai.defensivo_id
      JOIN lotes_field l ON l.id = ai.lote_id
      WHERE ai.aplicacao_id = ?
    `, [id])

    setAplicacao(ap ?? null)
    setItens(itemRows)
    // inicializar sobras com 0
    const sobrasInit: Record<string, string> = {}
    itemRows.forEach(i => { sobrasInit[i.id] = '0' })
    setSobras(sobrasInit)
    setLoading(false)
  }

  async function encerrar() {
    if (!id || !aplicacao) return
    if (!pragaAlvo.trim()) { Alert.alert('Informe a praga alvo'); return }

    setSalvando(true)
    try {
      const db = await getDB()

      // Atualizar aplicação
      await db.runAsync(
        `UPDATE aplicacoes SET status='encerrada', praga_alvo=?, condicoes_climaticas=?, synced=0 WHERE id=?`,
        [pragaAlvo, condicoes, id]
      )

      // Atualizar itens com sobra e calda
      for (const item of itens) {
        const sobra = parseFloat((sobras[item.id] ?? '0').replace(',', '.')) || 0
        const calda = parseFloat(caldaTotal.replace(',', '.')) || null
        await db.runAsync(
          `UPDATE aplicacao_itens SET quantidade_sobrou=?, calda_total_l=?, synced=0 WHERE id=?`,
          [sobra, calda, item.id]
        )
        // Devolver sobra ao estoque local
        if (sobra > 0) {
          await db.runAsync(
            `UPDATE lotes_field SET quantidade_atual = quantidade_atual + ? WHERE id=?`,
            [sobra, item.lote_id]
          )
        }
      }

      // Gerar PDF do comprovante
      await gerarPDF()

      Alert.alert(
        'Aplicação encerrada!',
        'Os dados foram salvos. O comprovante foi gerado.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/aplicacoes') }]
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao encerrar'
      Alert.alert('Erro', msg)
    } finally {
      setSalvando(false)
    }
  }

  async function gerarPDF() {
    if (!aplicacao) return
    const dataFmt = aplicacao.data
      ? new Date(aplicacao.data).toLocaleDateString('pt-BR')
      : '—'

    const itensHTML = itens.map(item => {
      const sobra = parseFloat((sobras[item.id] ?? '0').replace(',', '.')) || 0
      const usado = item.quantidade_usada - sobra
      return `
        <tr>
          <td>${item.defensivo_nome}</td>
          <td>${item.dose_por_hectare.toFixed(2)} ${item.unidade}/ha</td>
          <td>${item.quantidade_usada.toFixed(2)} ${item.unidade}</td>
          <td>${sobra.toFixed(2)} ${item.unidade}</td>
          <td>${Math.max(0, usado).toFixed(2)} ${item.unidade}</td>
          <td>${item.lote_fabricante ?? '—'}</td>
        </tr>
      `
    }).join('')

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #16a34a; padding-bottom: 12px; }
          .header h1 { font-size: 20px; color: #14532d; }
          .header h2 { font-size: 14px; color: #6b7280; margin-top: 4px; }
          .section { margin-bottom: 16px; }
          .section h3 { font-size: 13px; font-weight: bold; color: #14532d; margin-bottom: 8px;
                        border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .field { background: #f9fafb; border-radius: 4px; padding: 6px 10px; }
          .field-label { font-size: 10px; color: #9ca3af; }
          .field-value { font-weight: bold; color: #111; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #14532d; color: #fff; padding: 6px 8px; font-size: 11px; text-align: left; }
          td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; font-size: 11px; }
          tr:nth-child(even) td { background: #f9fafb; }
          .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;
                    display: flex; justify-content: space-between; }
          .assinatura { text-align: center; flex: 1; }
          .assinatura-linha { border-top: 1px solid #374151; width: 180px; margin: 0 auto 4px; }
          .assinatura-nome { font-size: 11px; color: #6b7280; }
          .rodape { text-align: center; margin-top: 16px; font-size: 10px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🌱 AgroGestão</h1>
          <h2>Comprovante de Aplicação de Defensivos</h2>
        </div>

        <div class="section">
          <h3>Identificação</h3>
          <div class="grid">
            <div class="field">
              <div class="field-label">Fazenda</div>
              <div class="field-value">${aplicacao.fazenda_nome ?? '—'}</div>
            </div>
            <div class="field">
              <div class="field-label">Talhão</div>
              <div class="field-value">${aplicacao.talhao_nome ?? '—'}</div>
            </div>
            <div class="field">
              <div class="field-label">Data</div>
              <div class="field-value">${dataFmt}</div>
            </div>
            <div class="field">
              <div class="field-label">Área aplicada</div>
              <div class="field-value">${aplicacao.area_aplicada_ha?.toFixed(1) ?? '—'} ha</div>
            </div>
            <div class="field">
              <div class="field-label">Praga alvo</div>
              <div class="field-value">${pragaAlvo}</div>
            </div>
            <div class="field">
              <div class="field-label">Volume de calda total</div>
              <div class="field-value">${caldaTotal ? caldaTotal + ' L' : '—'}</div>
            </div>
          </div>
          ${condicoes ? `
          <div class="field" style="margin-top: 8px;">
            <div class="field-label">Condições climáticas</div>
            <div class="field-value">${condicoes}</div>
          </div>` : ''}
        </div>

        <div class="section">
          <h3>Defensivos utilizados</h3>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Dose/ha</th>
                <th>Separado</th>
                <th>Sobrou</th>
                <th>Utilizado</th>
                <th>Lote</th>
              </tr>
            </thead>
            <tbody>${itensHTML}</tbody>
          </table>
        </div>

        <div class="footer">
          <div class="assinatura">
            <div class="assinatura-linha"></div>
            <div class="assinatura-nome">Responsável técnico</div>
          </div>
          <div class="assinatura">
            <div class="assinatura-linha"></div>
            <div class="assinatura-nome">Operador: ${profile?.nome ?? '—'}</div>
          </div>
        </div>

        <div class="rodape">
          Gerado em ${new Date().toLocaleString('pt-BR')} • AgroGestão v1.0
        </div>
      </body>
      </html>
    `

    await Print.printAsync({ html })
  }

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4' }}>
      <ActivityIndicator size="large" color="#16a34a" />
    </View>
  )

  if (!aplicacao) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Aplicação não encontrada</Text>
      <TouchableOpacity onPress={() => router.back()}><Text style={{ color: '#16a34a' }}>Voltar</Text></TouchableOpacity>
    </View>
  )

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Encerrar Aplicação</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Info resumo */}
        <View style={styles.resumoCard}>
          <View style={styles.resumoRow}>
            <MaterialCommunityIcons name="sprout" size={16} color="#16a34a" />
            <Text style={styles.resumoText}>{aplicacao.fazenda_nome}</Text>
          </View>
          <View style={styles.resumoRow}>
            <MaterialCommunityIcons name="texture-box" size={16} color="#16a34a" />
            <Text style={styles.resumoText}>{aplicacao.talhao_nome}
              {aplicacao.area_aplicada_ha ? `  •  ${aplicacao.area_aplicada_ha.toFixed(1)} ha` : ''}
            </Text>
          </View>
          <View style={styles.resumoRow}>
            <MaterialCommunityIcons name="calendar" size={16} color="#16a34a" />
            <Text style={styles.resumoText}>
              {aplicacao.data ? new Date(aplicacao.data).toLocaleDateString('pt-BR') : '—'}
            </Text>
          </View>
        </View>

        {/* Campos finais */}
        <Text style={styles.sectionTitle}>Dados do encerramento</Text>

        <Text style={styles.label}>Praga alvo *</Text>
        <TextInput
          style={styles.input}
          value={pragaAlvo}
          onChangeText={setPragaAlvo}
          placeholder="Ex: Cigarrinha, Spodoptera, Broca..."
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Condições climáticas</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          value={condicoes}
          onChangeText={setCondicoes}
          placeholder="Ex: Temp. 28°C, UR 70%, vento 5 km/h, sem chuva"
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Volume total de calda (L)</Text>
        <TextInput
          style={styles.input}
          value={caldaTotal}
          onChangeText={setCaldaTotal}
          keyboardType="decimal-pad"
          placeholder="Ex: 300"
          placeholderTextColor="#9ca3af"
        />

        {/* Sobra por defensivo */}
        <Text style={styles.sectionTitle}>Sobra por produto</Text>
        <Text style={styles.hint}>Informe quanto sobrou para devolução ao estoque</Text>

        {itens.map(item => (
          <View key={item.id} style={styles.itemCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemNome}>{item.defensivo_nome}</Text>
              <Text style={styles.itemDetalhe}>
                Separado: {item.quantidade_usada.toFixed(2)} {item.unidade}
                {item.lote_fabricante ? `  •  Lote: ${item.lote_fabricante}` : ''}
              </Text>
            </View>
            <View style={styles.sobraInput}>
              <Text style={styles.sobraLabel}>Sobrou</Text>
              <TextInput
                style={styles.sobraField}
                value={sobras[item.id] ?? '0'}
                onChangeText={v => setSobras(prev => ({ ...prev, [item.id]: v }))}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <Text style={styles.sobraUnidade}>{item.unidade}</Text>
            </View>
          </View>
        ))}

        {/* Botão encerrar */}
        <TouchableOpacity
          style={[styles.btnEncerrar, salvando && styles.btnDesabilitado]}
          onPress={encerrar}
          disabled={salvando}
        >
          {salvando
            ? <ActivityIndicator color="#fff" />
            : <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
          }
          <Text style={styles.btnEncerrarText}>
            {salvando ? 'Encerrando...' : 'Encerrar e gerar comprovante'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.pdfHint}>
          Um PDF será gerado automaticamente ao encerrar. Você poderá imprimir ou compartilhar.
        </Text>
      </ScrollView>
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
  resumoCard:   { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 20,
                  elevation: 2, borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  resumoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  resumoText:   { fontSize: 14, color: '#374151', fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#14532d', marginBottom: 12, marginTop: 8 },
  hint:         { fontSize: 12, color: '#6b7280', marginBottom: 12, marginTop: -8 },
  label:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:        { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                  fontSize: 15, color: '#111827', borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 14 },
  itemCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10,
                  padding: 12, marginBottom: 10, elevation: 1 },
  itemNome:     { fontSize: 13, fontWeight: '700', color: '#111827' },
  itemDetalhe:  { fontSize: 12, color: '#6b7280', marginTop: 2 },
  sobraInput:   { alignItems: 'center', marginLeft: 12 },
  sobraLabel:   { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  sobraField:   { borderWidth: 2, borderColor: '#16a34a', borderRadius: 8, width: 70,
                  textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: '#16a34a',
                  paddingVertical: 6 },
  sobraUnidade: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  btnEncerrar:  { backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 10, borderRadius: 12, paddingVertical: 16, marginTop: 24 },
  btnEncerrarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnDesabilitado: { backgroundColor: '#9ca3af' },
  pdfHint:      { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 12 },
})
