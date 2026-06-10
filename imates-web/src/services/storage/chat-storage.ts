// 异步数据存储服务 - 使用 IndexedDB 替代 localStorage
import { getUserId } from '../http/auth-service'
import type { ChatBubble, AiGeneralSession, AiHomeworkSession } from '@/types'
import { DB_NAMES, DB_VERSIONS, STORE_NAMES, IDB_CONFIGS } from './db-config'
import { IndexedDBService } from './indexeddb-service'

export interface ChatHistoryData {
  questionId: string
  messages: ChatBubble[]
  chatResponseTimes: number
  lastUpdated: number
}

export class ChatStorageService {
  private static instance: ChatStorageService
  private dbInstance: IndexedDBService
  private isInitialized = false

  private constructor() {
    this.dbInstance = IndexedDBService.getInstance(IDB_CONFIGS.CHAT_STORAGE())
  }

  static getInstance(): ChatStorageService {
    if (!ChatStorageService.instance) {
      ChatStorageService.instance = new ChatStorageService()
    }
    return ChatStorageService.instance
  }

  /**
   * 初始化存储服务
   * 注意：每次调用都会获取当前用户的存储实例，确保账号隔离
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      await this.dbInstance.init()
      this.isInitialized = true
    } catch (error) {
      console.warn('⚠️ IndexedDB 不可用:', error)
      this.isInitialized = true 
    }
  }

  /**
   * 获取数据库升级前的旧版本号
   * 利用 IndexedDB 原生 version，替代自定义 system_config 表
   */
  getDatabaseOldVersion(): number {
    return this.dbInstance.getOldVersion()
  }

  /**
   * 获取消息数量
   * @param messages 消息数组
   * @returns 消息数量
   */
  private getMessageCount(messages: ChatBubble[] | undefined): number {
    if (!messages || !Array.isArray(messages)) return 0
    return messages.length
  }

  /**
   * 深度序列化聊天数据，确保所有属性都可以被存储
   * @param data 聊天数据
   * @returns 序列化后的数据
   */
  private serializeChatData(data: ChatHistoryData): ChatHistoryData {
    const toPlainRecord = (input: unknown): Record<string, any> | undefined => {
      if (!input || typeof input !== 'object') return undefined
      try {
        if (Array.isArray(input)) {
          // 解除 Vue 响应式，确保 IndexedDB 能存储
          return JSON.parse(JSON.stringify(input)) as unknown as Record<string, any>
        }
        return { ...(input as Record<string, any>) }
      } catch {
        return undefined
      }
    }

    const serializeChatRecordData = (input: ChatBubble['chatRecordData']) => {
      if (!input) return undefined
      const messages = Array.isArray(input.messages)
        ? input.messages.map((m) => ({
            id: m.id,
            messageId: m.messageId,
            content: m.content,
            sender: m.sender,
            type: m.type,
            timestamp: m.timestamp,
            messageType: m.messageType,
            rawHtml: m.rawHtml,
            rawHtmlMap: toPlainRecord(m.rawHtmlMap),
            isStreaming: m.isStreaming || false,
            isError: m.isError,
            canRetry: m.canRetry,
            retryCount: m.retryCount,
            originalMessage: m.originalMessage,
            selectedModel: m.selectedModel,
            sessionId: m.sessionId,
            originalDstUrl: m.originalDstUrl,
          }))
        : []

      return {
        messages,
        additionalMessage: input.additionalMessage,
      }
    }

    // messages 必须是数组格式
    if (!Array.isArray(data.messages)) {
      console.warn('⚠️ messages 必须是数组格式，但收到了非数组类型，已转换为空数组')
      return {
        questionId: data.questionId,
        messages: [],
        chatResponseTimes: data.chatResponseTimes,
        lastUpdated: data.lastUpdated
      }
    }
    
    // 标准格式：messages 是数组，进行序列化
    return {
      questionId: data.questionId,
      messages: data.messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        type: msg.type,
        timestamp: msg.timestamp,
        messageId: msg.messageId,
        messageType: msg.messageType,
        rawHtml: msg.rawHtml,
        rawHtmlMap: msg.rawHtmlMap ? JSON.parse(JSON.stringify(msg.rawHtmlMap)) : undefined,
        isRead: msg.isRead, // 序列化已读状态
        isStreaming: msg.isStreaming || false,
        // 完整序列化 imageData，包括 base64DataUrl（用于UI显示）
        imageData: msg.imageData ? {
          filePath: msg.imageData.filePath,
          width: msg.imageData.width,
          height: msg.imageData.height,
          fileSize: msg.imageData.fileSize,
          base64DataUrl: msg.imageData.base64DataUrl // 保存base64数据，用于重新打开时显示图片
        } : undefined,
        // 多图消息的 imageList 也需要完整序列化，否则刷新后多图气泡会丢失图片
        imageList: Array.isArray(msg.imageList)
          ? msg.imageList.map(item => ({
              filePath: item.filePath,
              width: item.width,
              height: item.height,
              fileSize: item.fileSize,
              base64DataUrl: item.base64DataUrl,
              isLargeImage: item.isLargeImage,
            }))
          : undefined,
        // 完整序列化 voiceData（之前缺失，导致语音消息丢失）
        voiceData: msg.voiceData ? {
          filePath: msg.voiceData.filePath,
          duration: msg.voiceData.duration,
          fileSize: msg.voiceData.fileSize
        } : undefined,
        // 保存其他可能需要的字段
        isError: msg.isError,
        canRetry: msg.canRetry,
        retryCount: msg.retryCount,
        originalMessage: msg.originalMessage,
        chatRecordData: serializeChatRecordData(msg.chatRecordData),
        selectedModel: msg.selectedModel, // 保存模式信息（mate/mentor/researcher）
        sessionId: msg.sessionId,
        originalDstUrl: msg.originalDstUrl,
      })),
      chatResponseTimes: data.chatResponseTimes,
      lastUpdated: data.lastUpdated
    }
  }

  /**
   * 保存聊天历史记录
   * @param questionId 题目ID
   * @param data 聊天数据
   */
  async saveChatHistory(questionId: string, data: ChatHistoryData): Promise<void> {
    try {
      await this.initialize()
      
      const key = questionId
      
      // 序列化数据，确保可以被存储
      const serializedData = this.serializeChatData(data)
      const record = { id: key, ...serializedData }
      await this.dbInstance.put(STORE_NAMES.CHAT_HISTORY, record)
      
    } catch (error) {
      console.warn('⚠️ IndexedDB保存聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const key = questionId
        const serializedData = this.serializeChatData(data)
        localStorage.setItem(key, JSON.stringify(serializedData))
      } catch (localError) {
        throw localError
      }
    }
  }

  /**
   * 保存老师聊天历史记录
   * @param questionId 题目ID
   * @param data 老师聊天数据
   */
  async saveTeacherChatHistory(questionId: string, data: ChatHistoryData): Promise<void> {
    try {
      await this.initialize()
      const key = questionId
      
      // 序列化数据，确保可以被存储
      const serializedData = this.serializeChatData(data)
      const record = { id: key, ...serializedData }
      await this.dbInstance.put(STORE_NAMES.CHAT_HISTORY, record)
    } catch (error) {
      console.warn('[TEACHER_CHAT_DEBUG] ❌ IndexedDB保存老师聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const key = questionId
        const serializedData = this.serializeChatData(data)
        localStorage.setItem(key, JSON.stringify(serializedData))
      } catch (localError) {
        console.error('[TEACHER_CHAT_DEBUG] ❌ localStorage保存老师聊天记录也失败:', localError)
        throw localError
      }
    }
  }

  /**
   * 加载聊天历史记录
   * @param questionId 题目ID
   * @returns 聊天数据或 null
   */
  async loadChatHistory(questionId: string): Promise<ChatHistoryData | null> {
    try {
      await this.initialize()
      const key = questionId
      const data = await this.dbInstance.get<ChatHistoryData>(STORE_NAMES.CHAT_HISTORY, key)
      
      if (data) {
        console.log(`[CHAT_STORAGE] ✅ 成功加载聊天记录: ${questionId}, 消息数: ${data.messages?.length || 0}`)
      } else {
        console.log(`[CHAT_STORAGE] ℹ️ 未找到聊天记录: ${questionId}`)
      }
      
      return data || null
    } catch (error) {
      console.error('[CHAT_DEBUG] ❌ IndexedDB加载聊天记录失败:', error)
      return null
    }
  }

  /**
   * 加载老师聊天历史记录
   * @param questionId 题目ID
   * @returns 老师聊天数据或 null
   */
  async loadTeacherChatHistory(questionId: string): Promise<ChatHistoryData | null> {
    try {
      await this.initialize()
      const key = questionId
      const data = await this.dbInstance.get<ChatHistoryData>(STORE_NAMES.CHAT_HISTORY, key)
      
      if (data) {
        console.log(`[CHAT_STORAGE] ✅ 成功加载老师聊天记录: ${questionId}, 消息数: ${data.messages?.length || 0}`)
      } else {
        console.log(`[CHAT_STORAGE] ℹ️ 未找到老师聊天记录: ${questionId}`)
      }
      
      return data || null
    } catch (error) {
      console.error('[TEACHER_CHAT_DEBUG] ❌ IndexedDB加载老师聊天记录失败:', error)
      return null
    }
  }

  /**
   * 删除聊天历史记录
   * @param questionId 题目ID
   */
  async removeChatHistory(questionId: string): Promise<void> {
    try {
      await this.initialize()
      const key = questionId
      await this.dbInstance.delete(STORE_NAMES.CHAT_HISTORY, key)
    } catch (error) {
      console.warn('删除聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const key = questionId
        localStorage.removeItem(key)
      } catch (localError) {
        console.error('localStorage 删除也失败:', localError)
        throw localError
      }
    }
  }

  /**
   * 获取所有聊天历史的 Keys (用于统计或清理)
   */
  async getAllChatHistoryKeys(): Promise<string[]> {
    try {
      await this.initialize()
      return await this.dbInstance.getAllKeys(STORE_NAMES.CHAT_HISTORY)
    } catch (error) {
      console.error('获取所有聊天历史Keys失败:', error)
      return []
    }
  }

  /**
   * 获取存储使用情况统计
   */
  async getStorageUsage(): Promise<{
    chatHistoryKeys: number
    estimatedSize: number
  }> {
    try {
      await this.initialize()
      const keys = await this.getAllChatHistoryKeys()
      
      // 估算大小（仅作为参考）
      let estimatedSize = 0
      for (const key of keys.slice(0, 10)) { // 抽样前10条估算
        const data = await this.loadChatHistory(key)
        if (data) {
          estimatedSize += new Blob([JSON.stringify(data)]).size
        }
      }
      
      if (keys.length > 10) {
        estimatedSize = (estimatedSize / 10) * keys.length
      }

      return {
        chatHistoryKeys: keys.length,
        estimatedSize
      }
    } catch (error) {
      console.error('获取存储统计失败:', error)
      return {
        chatHistoryKeys: 0,
        estimatedSize: 0
      }
    }
  }


  /**
   * 清空所有聊天记录
   */
  async clearAllChatHistory(): Promise<void> {
    try {
      await this.initialize()
      const keys = await this.getAllChatHistoryKeys()
      
      for (const key of keys) {
        await this.dbInstance.delete(STORE_NAMES.CHAT_HISTORY, key)
      }
    } catch (error) {
      console.error('清空所有聊天记录失败:', error)
      throw error
    }
  }


  // ==================== AI 作业会话列表存储 ====================

  /**
   * 保存 AI 作业会话列表 (批量)
   */
  async saveHomeworkSessions(sessions: AiHomeworkSession[]): Promise<void> {
    try {
      await this.initialize()
      const userId = getUserId()
      const oldKey = `ai_homework_sessions_${userId}`
      
      const plainSessions = JSON.parse(JSON.stringify(sessions))
      for (const session of plainSessions) {
        if (session.sessionId) {
          await this.dbInstance.put(STORE_NAMES.AI_HOMEWORK_SESSIONS, { 
            id: session.sessionId, 
            ...session 
          })
        }
      }

      // 清理旧记录
      try { await this.dbInstance.delete(STORE_NAMES.AI_HOMEWORK_SESSIONS, oldKey) } catch (e) {}
    } catch (error) {
      console.error('[CHAT_STORAGE] 保存作业会话列表失败:', error)
      throw error
    }
  }

  /**
   * 保存单个 AI 作业会话 (原子更新)
   */
  async saveHomeworkSession(session: AiHomeworkSession): Promise<void> {
    try {
      await this.initialize()
      const plain = JSON.parse(JSON.stringify(session))
      await this.dbInstance.put(STORE_NAMES.AI_HOMEWORK_SESSIONS, {
        id: session.sessionId,
        ...plain
      })
    } catch (error) {
      console.error('[CHAT_STORAGE] 保存单个作业会话失败:', error)
    }
  }

  /**
   * 删除单个 AI 作业会话 (原子操作)
   */
  async deleteHomeworkSession(sessionId: string): Promise<void> {
    try {
      await this.initialize()
      await this.dbInstance.delete(STORE_NAMES.AI_HOMEWORK_SESSIONS, sessionId)
    } catch (error) {
      console.error('[CHAT_STORAGE] 删除作业会话失败:', error)
    }
  }

  /**
   * 加载 AI 作业会话列表
   */
  async loadHomeworkSessions(): Promise<AiHomeworkSession[]> {
    try {
      await this.initialize()
      const userId = getUserId()
      const oldKey = `ai_homework_sessions_${userId}`
      
      const allRecords = await this.dbInstance.getAll<any>(STORE_NAMES.AI_HOMEWORK_SESSIONS)
      const sessions = allRecords.filter(r => r.id !== oldKey) as AiHomeworkSession[]
      
      return sessions.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return (b.updateTime || 0) - (a.updateTime || 0)
      })
    } catch (error) {
      console.error('[CHAT_STORAGE] 加载 AI 作业会话列表失败:', error)
      return []
    }
  }

  // ==================== AI 题目会话列表存储 ====================

  /**
   * 保存 AI 题目会话列表 (批量原子化保存)
   * @param sessions 会话列表元数据
   */
  async saveSessionsList(sessions: SessionMeta[]): Promise<void> {
    try {
      await this.initialize()
      const plainSessions: SessionMeta[] = JSON.parse(JSON.stringify(sessions))
      
      for (const session of plainSessions) {
        if (session.id) {
          await this.dbInstance.put(STORE_NAMES.AI_EXERCISE_SESSIONS, session)
        }
      }
    } catch (error) {
      console.error('[CHAT_STORAGE] 保存会话列表失败:', error)
      throw error
    }
  }

  /**
   * 保存单个 AI 题目会话 (原子更新)
   */
  async saveExerciseSession(session: SessionMeta): Promise<void> {
    try {
      await this.initialize()
      const plain = JSON.parse(JSON.stringify(session))
      await this.dbInstance.put(STORE_NAMES.AI_EXERCISE_SESSIONS, plain)
    } catch (error) {
      console.error('[CHAT_STORAGE] 保存单个题目会话失败:', error)
    }
  }

  /**
   * 删除单个 AI 题目会话 (原子操作)
   */
  async deleteExerciseSession(sessionId: string): Promise<void> {
    try {
      await this.initialize()
      await this.dbInstance.delete(STORE_NAMES.AI_EXERCISE_SESSIONS, sessionId)
    } catch (error) {
      console.error('[CHAT_STORAGE] 删除题目会话失败:', error)
    }
  }

  /**
   * 加载 AI 题目会话列表
   * @param questionBmNo 题目 bmNo
   * @returns 会话列表元数据
   */
  async loadSessionsList(questionBmNo: string): Promise<SessionMeta[]> {
    try {
      await this.initialize()
      
      // 使用索引查询该题目下的所有会话
      const sessions = await this.dbInstance.getAllByIndex<SessionMeta>(
        STORE_NAMES.AI_EXERCISE_SESSIONS,
        'questionBmNo',
        questionBmNo
      )
      
      return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    } catch (error) {
      console.error('[CHAT_STORAGE] 加载会话列表失败:', error)
      return []
    }
  }

  /**
   * 删除 AI 题目下所有的会话列表
   * @param questionBmNo 题目 bmNo
   */
  async removeSessionsList(questionBmNo: string): Promise<void> {
    try {
      await this.initialize()
      const sessions = await this.loadSessionsList(questionBmNo)
      for (const s of sessions) {
        await this.deleteExerciseSession(s.id)
      }
      console.log('[CHAT_STORAGE] 删除题目所有会话成功:', questionBmNo)
    } catch (error) {
      console.error('[CHAT_STORAGE] 删除会话列表失败:', error)
      throw error
    }
  }

  // ==================== 教师题目会话列表存储 ====================

  /**
   * 保存教师题目会话列表（按统一 Map 结构存储）
   */
  async saveTeacherExerciseSessions(allSessions: Record<string, unknown>): Promise<void> {
    try {
      await this.initialize()
      const key = 'teacher_exercise_sessions'
      const plain = JSON.parse(JSON.stringify(allSessions))
      const record = { id: key, sessions: plain }
      await this.dbInstance.put(STORE_NAMES.TEACHER_EXERCISE_SESSIONS, record)
      console.log('[CHAT_STORAGE] 保存教师题目会话列表成功')
    } catch (error) {
      console.error('[CHAT_STORAGE] 保存教师题目会话列表失败:', error)
      throw error
    }
  }

  /**
   * 加载教师题目会话列表
   */
  async loadTeacherExerciseSessions<T = unknown>(): Promise<Record<string, T>> {
    try {
      await this.initialize()
      const key = 'teacher_exercise_sessions'
      const record = await this.dbInstance.get<{sessions: Record<string, T>}>(STORE_NAMES.TEACHER_EXERCISE_SESSIONS, key)
      return record?.sessions || {}
    } catch (error) {
      console.error('[CHAT_STORAGE] 加载教师题目会话列表失败:', error)
      return {}
    }
  }

  /**
   * 清空教师题目会话列表
   */
  async clearTeacherExerciseSessions(): Promise<void> {
    try {
      await this.initialize()
      const key = 'teacher_exercise_sessions'
      await this.dbInstance.delete(STORE_NAMES.TEACHER_EXERCISE_SESSIONS, key)
      console.log('[CHAT_STORAGE] 清空教师题目会话列表成功')
    } catch (error) {
      console.error('[CHAT_STORAGE] 清空教师题目会话列表失败:', error)
      throw error
    }
  }

  // ==================== AI 通用会话列表存储 ====================

  /**
   * 保存 AI 通用会话列表 (批量)
   */
  async saveGeneralSessions(sessions: AiGeneralSession[]): Promise<void> {
    try {
      await this.initialize()
      const oldKey = 'ai_general_sessions'
      
      const plainSessions: AiGeneralSession[] = JSON.parse(JSON.stringify(sessions))
      for (const session of plainSessions) {
        if (session.sessionId) {
          await this.dbInstance.put(STORE_NAMES.AI_GENERAL_SESSIONS, { 
            id: session.sessionId, 
            ...session 
          })
        }
      }

      // 清理旧记录
      try { await this.dbInstance.delete(STORE_NAMES.AI_GENERAL_SESSIONS, oldKey) } catch (e) {}
    } catch (error) {
      console.error('[CHAT_STORAGE] 保存 AI 通用会话列表失败:', error)
      throw error
    }
  }

  /**
   * 保存单个 AI 通用会话 (原子更新)
   */
  async saveGeneralSession(session: AiGeneralSession): Promise<void> {
    try {
      await this.initialize()
      const plain = JSON.parse(JSON.stringify(session))
      await this.dbInstance.put(STORE_NAMES.AI_GENERAL_SESSIONS, {
        id: session.sessionId,
        ...plain
      })
    } catch (error) {
      console.error('[CHAT_STORAGE] 保存单个通用会话失败:', error)
    }
  }

  /**
   * 删除单个 AI 通用会话 (原子操作)
   */
  async deleteGeneralSession(sessionId: string): Promise<void> {
    try {
      await this.initialize()
      await this.dbInstance.delete(STORE_NAMES.AI_GENERAL_SESSIONS, sessionId)
    } catch (error) {
      console.error('[CHAT_STORAGE] 删除通用会话失败:', error)
    }
  }

  /**
   * 加载 AI 通用会话列表
   */
  async loadGeneralSessions(): Promise<AiGeneralSession[]> {
    try {
      await this.initialize()
      const oldKey = 'ai_general_sessions'
      
      const allRecords = await this.dbInstance.getAll<any>(STORE_NAMES.AI_GENERAL_SESSIONS)
      const sessions = allRecords.filter(r => r.id !== oldKey) as AiGeneralSession[]
      
      return sessions.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return (b.updateTime || 0) - (a.updateTime || 0)
      })
    } catch (error) {
      console.error('[CHAT_STORAGE] 加载 AI 通用会话列表失败:', error)
      return []
    }
  }

  /**
   * 获取所有数据库中的原始记录（调试用）
   */
  async getDebugStorageInfo(): Promise<Record<string, any[]>> {
    try {
      await this.initialize()
      const info: Record<string, any[]> = {}
      const stores = [
        STORE_NAMES.CHAT_HISTORY,
        STORE_NAMES.AI_EXERCISE_SESSIONS,
        STORE_NAMES.AI_HOMEWORK_SESSIONS,
        STORE_NAMES.TEACHER_EXERCISE_SESSIONS,
        STORE_NAMES.AI_GENERAL_SESSIONS
      ]
      
      for (const store of stores) {
        info[store] = await this.dbInstance.getAll(store)
      }
      return info
    } catch (error) {
      console.error('获取调试存储信息失败:', error)
      return {}
    }
  }

  /**
   * 获取特定表中的记录
   */
  async getRecordFromStore<T>(storeName: string, id: string): Promise<T | null> {
    try {
      await this.initialize()
      const data = await this.dbInstance.get<T>(storeName, id)
      return data || null
    } catch (error) {
      console.error(`加载记录失败 (${storeName}/${id}):`, error)
      return null
    }
  }
}

/**
 * 会话元数据接口（不包含完整消息，用于列表存储）
 */
export interface SessionMeta {
  id: string
  questionBmNo: string
  title: string
  chatResponseTimes: number
  createdAt: number
  updatedAt: number
  messageCount: number
  aiMessage?: string
  userMessage?: string
  lastMessage?: string
  previewMessagesMarkdown?: string[]
}

// 导出单例实例
export const chatStorage = ChatStorageService.getInstance()
