export interface ChatSessionsOptions<TSession> {
  save: (data: TSession[]) => Promise<void>
  load: () => Promise<TSession[]>
}

export const createChatSessions = <TSession>(options: ChatSessionsOptions<TSession>) => {
  const save = async (data: TSession[]): Promise<void> => {
    await options.save(data)
  }

  const load = async (): Promise<TSession[]> => {
    return await options.load()
  }

  const loadWithLegacy = async (params: {
    read: () => TSession[] | null
    clear: () => void
  }): Promise<TSession[]> => {
    const current = await load()
    if (current && current.length > 0) return current

    const legacy = params.read()
    if (legacy && legacy.length > 0) {
      await save(legacy)
      params.clear()
      return legacy
    }

    return []
  }

  return {
    save,
    load,
    loadWithLegacy,
  }
}
