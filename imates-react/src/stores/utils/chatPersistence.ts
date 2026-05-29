import type { ChatBubble } from '../../types'

export interface ChatHistoryPayload {
  messages: ChatBubble[]
  lastUpdated?: number
}

export interface ChatPersistenceAdapter<TPayload extends ChatHistoryPayload> {
  save: (key: string, payload: TPayload) => Promise<void>
  load: (key: string) => Promise<TPayload | null>
}

export interface ChatPersistenceOptions {
  debounceMs?: number
}

export const createChatPersistence = <TPayload extends ChatHistoryPayload>(
  adapter: ChatPersistenceAdapter<TPayload>,
  options: ChatPersistenceOptions = {},
) => {
  const debounceMs = options.debounceMs ?? 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const save = async (key: string, payload: TPayload): Promise<void> => {
    await adapter.save(key, payload)
  }

  const saveDebounced = (key: string, payload: TPayload): void => {
    if (debounceMs <= 0) {
      void adapter.save(key, payload)
      return
    }

    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(() => {
      void adapter.save(key, payload)
      timer = null
    }, debounceMs)
  }

  const load = async (key: string): Promise<TPayload | null> => {
    return adapter.load(key)
  }

  return {
    save,
    saveDebounced,
    load,
  }
}
