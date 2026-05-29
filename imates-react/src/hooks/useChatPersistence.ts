import { useCallback, useRef, useEffect } from 'react'
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(async (key: string, payload: TPayload): Promise<void> => {
    await adapter.save(key, payload)
  }, [adapter])

  const saveDebounced = useCallback((key: string, payload: TPayload): void => {
    if (debounceMs <= 0) {
      void adapter.save(key, payload)
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      void adapter.save(key, payload)
      timerRef.current = null
    }, debounceMs)
  }, [adapter, debounceMs])

  const load = useCallback(async (key: string): Promise<TPayload | null> => {
    return adapter.load(key)
  }, [adapter])

  const bind = useCallback((setMessages: (messages: ChatBubble[]) => void, getKey: () => string | null) => {
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
        setMessages(payload.messages as ChatBubble[])
      }
      onLoaded?.(payload)
    }

    return { saveBound, saveBoundDebounced, loadBound }
  }, [save, saveDebounced, load])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return {
    save,
    saveDebounced,
    load,
    bind,
  }
}
