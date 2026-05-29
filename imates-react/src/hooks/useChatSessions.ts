import { useCallback } from 'react'

export interface UseChatSessionsAdapter<TSession> {
  save: (sessions: TSession[]) => Promise<void>
  load: () => Promise<TSession[]>
}

export interface UseChatSessionsLegacy<TSession> {
  read: () => TSession[] | null
  clear: () => void
}

export function useChatSessions<TSession>(adapter: UseChatSessionsAdapter<TSession>) {
  const save = useCallback(async (sessions: TSession[]): Promise<void> => {
    await adapter.save(sessions)
  }, [adapter])

  const load = useCallback(async (): Promise<TSession[]> => {
    return adapter.load()
  }, [adapter])

  const loadWithLegacy = useCallback(async (legacy?: UseChatSessionsLegacy<TSession>): Promise<TSession[]> => {
    const legacySessions = legacy?.read()
    if (legacySessions && legacySessions.length > 0) {
      await adapter.save(legacySessions)
      legacy?.clear()
      return legacySessions
    }

    return adapter.load()
  }, [adapter])

  return {
    save,
    load,
    loadWithLegacy,
  }
}
