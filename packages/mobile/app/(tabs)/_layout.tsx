import { Tabs } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useStore } from '../../src/store/useStore'
import { View, Text, StyleSheet } from 'react-native'

function TabIcon({ name, color, size, badge }: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name']
  color: string
  size: number
  badge?: number
}) {
  return (
    <View>
      <MaterialCommunityIcons name={name} color={color} size={size} />
      {!!badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
  )
}

export default function TabsLayout() {
  const pendingCount = useStore(s => s.sync.pendingCount)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e7eb',
          elevation: 8,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="estoque"
        options={{
          title: 'Estoque',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="package-variant" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="aplicacoes"
        options={{
          title: 'Aplicações',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="tractor" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="fazendas"
        options={{
          title: 'Fazendas',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="map-marker-multiple" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: 'Mais',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="dots-horizontal-circle" color={color} size={size} badge={pendingCount > 0 ? pendingCount : undefined} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
})
