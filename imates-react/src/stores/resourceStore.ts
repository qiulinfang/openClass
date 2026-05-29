import { create } from 'zustand'

interface ResourceState {
  lastUpdateCheckTime: number | null
  lastUpdateTime: number | null
  hasResourceNotification: boolean
  
  setHasResourceNotification: (has: boolean) => void
  markUpdateCheckCompleted: () => void
  markTextbookUpdated: () => void
}

export const useResourceStore = create<ResourceState>((set) => ({
  lastUpdateCheckTime: null,
  lastUpdateTime: null,
  hasResourceNotification: false,
  
  setHasResourceNotification: (has) => set({ hasResourceNotification: has }),
  markUpdateCheckCompleted: () => set({ lastUpdateCheckTime: Date.now() }),
  markTextbookUpdated: () => set({ lastUpdateTime: Date.now() })
}))
