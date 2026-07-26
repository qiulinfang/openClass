import type { AiGeneralSession, ChatBubble } from '@/types/chat'

/**
 * 聊天本地持久化存储服务 (ChatStorageService)
 * 对应 imates-web IndexedDB / LocalStorage 持久化机制：
 * - 存储全局会话列表 (`ai_general_sessions`)
 * - 存储单会话消息历史 (`ai_general_messages_${sessionId}`)
 */
export class ChatStorageService {
  private static readonly SESSIONS_KEY = 'ai_general_sessions'
  private static readonly MSG_PREFIX = 'ai_general_messages_'

  /** 获取所有保存的会话列表 */
  static getSessions(): AiGeneralSession[] {
    try {
      const data = uni.getStorageSync(this.SESSIONS_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  /** 保存全局会话列表 */
  static saveSessions(sessions: AiGeneralSession[]): void {
    try {
      uni.setStorageSync(this.SESSIONS_KEY, JSON.stringify(sessions))
    } catch (e) {
      console.error('[ChatStorageService] 保存会话列表失败:', e)
    }
  }

  /** 获取单会话的消息列表 */
  static getSessionMessages(sessionId: string): ChatBubble[] {
    if (!sessionId) return []
    try {
      const key = `${this.MSG_PREFIX}${sessionId}`
      const data = uni.getStorageSync(key)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  /** 保存单会话的消息列表 */
  static saveSessionMessages(sessionId: string, messages: ChatBubble[]): void {
    if (!sessionId) return
    try {
      const key = `${this.MSG_PREFIX}${sessionId}`
      uni.setStorageSync(key, JSON.stringify(messages))
    } catch (e) {
      console.error(`[ChatStorageService] 保存会话消息失败 [${sessionId}]:`, e)
    }
  }

  /** 删除某个会话及其对应的消息列表 */
  static removeSession(sessionId: string): void {
    if (!sessionId) return
    try {
      // 1. 从会话列表中移除
      const sessions = this.getSessions().filter(s => s.sessionId !== sessionId)
      this.saveSessions(sessions)

      // 2. 清除消息列表缓存
      const key = `${this.MSG_PREFIX}${sessionId}`
      uni.removeStorageSync(key)
    } catch (e) {
      console.error(`[ChatStorageService] 删除会话失败 [${sessionId}]:`, e)
    }
  }

  /** 清空所有 AI 会话数据 */
  static clearAll(): void {
    try {
      const sessions = this.getSessions()
      sessions.forEach(s => {
        uni.removeStorageSync(`${this.MSG_PREFIX}${s.sessionId}`)
      })
      uni.removeStorageSync(this.SESSIONS_KEY)
    } catch {}
  }
}
