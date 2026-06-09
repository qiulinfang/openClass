export interface UseChatSessionsAdapter<TSession> {
  save: (sessions: TSession[]) => Promise<void>
  load: () => Promise<TSession[]>
  saveSingle?: (session: TSession) => Promise<void>
  deleteSingle?: (sessionId: string) => Promise<void>
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

  const saveSingle = async (session: TSession): Promise<void> => {
    if (adapter.saveSingle) {
      await adapter.saveSingle(session)
    } else {
      // 降级方案：如果没有提供原子更新，则全量更新（可选）
      // await adapter.save([session]) 
    }
  }

  const deleteSingle = async (sessionId: string): Promise<void> => {
    if (adapter.deleteSingle) {
      await adapter.deleteSingle(sessionId)
    }
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
    saveSingle,
    deleteSingle,
    loadWithLegacy,
  }
}
