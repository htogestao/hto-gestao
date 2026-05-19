import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { supabase } from '../src/services/supabase'

export default function Index() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<boolean>(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session)
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#14532d' }}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  )

  return session ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />
}
