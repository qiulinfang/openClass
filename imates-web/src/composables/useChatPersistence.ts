import type { Ref } from 'vue'
import type { ChatBubble } from '@/types'

export interface ChatHistoryPayload {
  messages: ChatBubble[]
  lastUpdated?: number
}

export interface UseChatPersistenceAdapter<TPayload extends ChatHistoryPayload> {
  save: (key: string, payload: TPayload) => Promise<void>
  load: (key: string) => Promise<TPayload | null>
}

export interface UseChatPersistenceOptions {
  debounceMs?: number
}

export function useChatPersistence<TPayload extends ChatHistoryPayload>(
  adapter: UseChatPersistenceAdapter<TPayload>,
  options: UseChatPersistenceOptions = {},
) {
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

  const bind = (messages: Ref<ChatBubble[]>, getKey: () => string | null) => {
    const saveBound = async (payloadBuilder: () => TPayload): Promise<void> => {
      const key = getKey()
      if (!key) return
      await save(key, payloadBuilder())
    }

    const saveBoundDebounced = (payloadBuilder: () => TPayload): void => {
      const key = getKey()
      if (!key) return
      saveDebounced(key, payloadBuilder())
    }

    const loadBound = async (onLoaded?: (payload: TPayload | null) => void): Promise<void> => {
      const key = getKey()
      if (!key) {
        onLoaded?.(null)
        return
      }
      const payload = await load(key)
      if (payload?.messages) {
        messages.value = payload.messages as ChatBubble[]
      }
      onLoaded?.(payload)
    }

    return { saveBound, saveBoundDebounced, loadBound }
  }

  return {
    save,
    saveDebounced,
    load,
    bind,
  }
}
