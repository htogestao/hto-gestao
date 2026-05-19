import { useState } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { TextInput, Button } from 'react-native-paper'
import { router } from 'expo-router'
import { supabase } from '../../src/services/supabase'
import { useStore } from '../../src/store/useStore'
import type { Profile } from '@agro/shared'

export default function LoginScreen() {
  const setProfile      = useStore(s => s.setProfile)
  const [email, setEmail]   = useState('')
  const [senha, setSenha]   = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !senha) { Alert.alert('Preencha e-mail e senha'); return }
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      Alert.alert('Erro de login', 'E-mail ou senha incorretos.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', (await supabase.auth.getUser()).data.user!.id).single()

    if (!profile?.ativo) {
      await supabase.auth.signOut()
      Alert.alert('Usuário inativo', 'Fale com o administrador.')
      setLoading(false)
      return
    }

    setProfile(profile as Profile)
    setLoading(false)
    router.replace('/(tabs)')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.logoBox}>
        <Text style={styles.logo}>🌱</Text>
        <Text style={styles.title}>AgroGestão</Text>
        <Text style={styles.subtitle}>Gestão Agrícola de Campo</Text>
      </View>

      <View style={styles.card}>
        <TextInput
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
          left={<TextInput.Icon icon="email" />}
        />
        <TextInput
          label="Senha"
          value={senha}
          onChangeText={setSenha}
          mode="outlined"
          secureTextEntry={!mostrar}
          style={styles.input}
          left={<TextInput.Icon icon="lock" />}
          right={<TextInput.Icon icon={mostrar ? 'eye-off' : 'eye'} onPress={() => setMostrar(!mostrar)} />}
        />
        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.btn}
          contentStyle={{ paddingVertical: 6 }}
        >
          Entrar
        </Button>
        <Text style={styles.hint}>Problemas? Fale com o administrador.</Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#14532d', justifyContent: 'center', padding: 24 },
  logoBox:    { alignItems: 'center', marginBottom: 32 },
  logo:       { fontSize: 56 },
  title:      { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  subtitle:   { fontSize: 14, color: '#86efac', marginTop: 4 },
  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 4 },
  input:      { marginBottom: 12 },
  btn:        { marginTop: 8, borderRadius: 8 },
  hint:       { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 },
})
