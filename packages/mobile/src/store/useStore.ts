import { create } from 'zustand'
import type { Profile, Fazenda, Defensivo } from '@agro/shared'

interface SyncStatus {
  online: boolean
  pendingCount: number
  lastSync: Date | null
  syncing: boolean
}

interface AppStore {
  profile:  Profile | null
  fazendas: Fazenda[]
  defensivos: Defensivo[]
  sync: SyncStatus

  setProfile:    (p: Profile | null) => void
  setFazendas:   (f: Fazenda[])     => void
  setDefensivos: (d: Defensivo[])   => void
  setSyncStatus: (s: Partial<SyncStatus>) => void
}

export const useStore = create<AppStore>((set) => ({
  profile:    null,
  fazendas:   [],
  defensivos: [],
  sync: { online: true, pendingCount: 0, lastSync: null, syncing: false },

  setProfile:    (profile)   => set({ profile }),
  setFazendas:   (fazendas)  => set({ fazendas }),
  setDefensivos: (defensivos)=> set({ defensivos }),
  setSyncStatus: (s)         => set(state => ({ sync: { ...state.sync, ...s } })),
}))
