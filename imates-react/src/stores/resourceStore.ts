import { create } from 'zustand'

interface ResourceState {
  hasResourceNotification: boolean
  updateCheckCompleted: boolean
  textbookUpdatedTrigger: number
  
  setHasResourceNotification: (has: boolean) => void
  markUpdateCheckCompleted: () => void
  markTextbookUpdated: () => void
}

export const useResourceStore = create<ResourceState>((set) => ({
  hasResourceNotification: false,
  updateCheckCompleted: false,
  textbookUpdatedTrigger: 0,
  
  setHasResourceNotification: (has) => set({ hasResourceNotification: has }),
  markUpdateCheckCompleted: () => set({ updateCheckCompleted: true }),
  markTextbookUpdated: () => set((state) => ({ textbookUpdatedTrigger: state.textbookUpdatedTrigger + 1 }))
}))
