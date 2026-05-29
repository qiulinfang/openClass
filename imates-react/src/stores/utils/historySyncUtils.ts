import type { BackendHistoryMessage, ChatBubble } from '@/types'

/**
 * 构建历史消息摘要签名
 * 用于判断消息列表是否发生实质性变化
 */
export const buildHistorySignature = (history: BackendHistoryMessage[]): string => {
  if (!history || history.length === 0) return ''
  // 采样最后两条消息的内容和ID
  const tail = history.slice(-2)
  return tail.map((m) => `${m.id}-${m.content?.length || 0}`).join('|')
}

/**
 * 将后端历史消息中的 message_id 同步给前端本地气泡
 * 规则：从后往前匹配，遇到第一个 type 匹配且 content 相似的消息即停止（通常只同步最后一条 AI 回复的真正 ID）
 */
export const alignTailMessageIdsFromHistory = (
  localMessages: ChatBubble[],
  history: BackendHistoryMessage[],
): void => {
  if (!localMessages || localMessages.length === 0 || !history || history.length === 0) return

  // 1. 获取后端最后一条 AI 消息
  const lastAiInHistory = [...history].reverse().find((m) => m.type === 'ai')
  if (!lastAiInHistory || !lastAiInHistory.id) return

  // 2. 找到前端最后一条 AI 消息（可能是处于流式或刚完成的临时气泡）
  const lastAiInLocalIndex = [...localMessages].reverse().findIndex((m) => m.sender === 'ai')
  if (lastAiInLocalIndex < 0) return

  const realIndex = localMessages.length - 1 - lastAiInLocalIndex
  const targetLocal = localMessages[realIndex]

  // 3. 如果本地气泡还没有 messageId，或者 messageId 与后端不一致，则更新
  if (!targetLocal.messageId || targetLocal.messageId !== lastAiInHistory.id) {
    targetLocal.messageId = lastAiInHistory.id
    // 如果本地还没有内容，也可以顺便带一下（通常用于兜底）
    if (!targetLocal.content && lastAiInHistory.content) {
      targetLocal.content = lastAiInHistory.content
    }
  }
}
