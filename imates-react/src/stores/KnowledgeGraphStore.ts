import { create } from 'zustand'

interface KnowledgeGraphState {
  currentSubject: string | null
  currentTextbook: any | null
  
  setCurrentSubject: (subject: string | null) => void
  setCurrentTextbook: (textbook: any | null) => void
}

export const useKnowledgeGraphStore = create<KnowledgeGraphState>((set) => ({
  currentSubject: null,
  currentTextbook: null,
  
  setCurrentSubject: (subject) => set({ currentSubject: subject }),
  setCurrentTextbook: (textbook) => set({ currentTextbook: textbook }),
}))
