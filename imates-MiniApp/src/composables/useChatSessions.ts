export interface UseChatSessionsAdapter<TSession> {
  save: (sessions: TSession[]) => Promise<void>
  load: () => Promise<TSession[]>
}

export interface UseChatSessionsLegacy<TSession> {
  read: () => TSession[] | null
  clear: () => void
}

export function useChatSessions<TSession>(adapter: UseChatSessionsAdapter<TSession>) {
  const save = async (sessions: TSession[]): Promise<void> => {
    await adapter.save(sessions)
  }

  const load = async (): Promise<TSession[]> => {
    return adapter.load()
  }

  const loadWithLegacy = async (legacy?: UseChatSessionsLegacy<TSession>): Promise<TSession[]> => {
    const legacySessions = legacy?.read()
    if (legacySessions && legacySessions.length > 0) {
      await adapter.save(legacySessions)
      legacy?.clear()
      return legacySessions
    }

    return adapter.load()
  }

  return {
    save,
    load,
    loadWithLegacy,
  }
}
