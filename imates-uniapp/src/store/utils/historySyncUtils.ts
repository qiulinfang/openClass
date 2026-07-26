import type { BackendHistoryMessage, ChatBubble } from '@/types/chat'

export function buildHistorySignature(history: BackendHistoryMessage[]): string {
  return history.map((m) => m.id).join('|')
}

export function alignTailMessageIdsFromHistory(
  messages: ChatBubble[],
  history: BackendHistoryMessage[],
): ChatBubble[] {
  if (!history || history.length === 0) return messages

  const ids = history.map((m) => m.id)
  const n = Math.min(ids.length, messages.length)
  if (n <= 0) return messages

  const start = messages.length - n
  for (let i = 0; i < n; i++) {
    const backendId = ids[ids.length - n + i]
    const idx = start + i
    const old = messages[idx]
    messages[idx] = {
      ...old,
      messageId: backendId,
    }
  }

  return messages
}
