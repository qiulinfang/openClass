// 异步数据存储服务 - 使用 IndexedDB 替代 localStorage
import { getUserId } from '../http/auth-service'
import type { ChatBubble, AiGeneralSession } from '@/types'
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
      
      const userId = getUserId()
      const key = `${userId}_chat_history_${questionId}`
      
      // 序列化数据，确保可以被存储
      const serializedData = this.serializeChatData(data)
      const record = { id: key, ...serializedData }
      await this.dbInstance.put(STORE_NAMES.CHAT_HISTORY, record)
      
    } catch (error) {
      console.warn('⚠️ IndexedDB保存聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const userId = getUserId()
        const key = `${userId}_chat_history_${questionId}`
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
      const userId = getUserId()
      const key = `${userId}_teacher_chat_history_${questionId}`
      
      // 序列化数据，确保可以被存储
      const serializedData = this.serializeChatData(data)
      const record = { id: key, ...serializedData }
      await this.dbInstance.put(STORE_NAMES.CHAT_HISTORY, record)
    } catch (error) {
      console.warn('[TEACHER_CHAT_DEBUG] ❌ IndexedDB保存老师聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const userId = getUserId()
        const key = `${userId}_teacher_chat_history_${questionId}`
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
      const userId = getUserId()
      const key = `${userId}_chat_history_${questionId}`
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
      const userId = getUserId()
      const key = `${userId}_teacher_chat_history_${questionId}`
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
      const userId = getUserId()
      const key = `${userId}_chat_history_${questionId}`
      await this.dbInstance.delete(STORE_NAMES.CHAT_HISTORY, key)
    } catch (error) {
      console.warn('删除聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const userId = getUserId()
        const key = `${userId}_chat_history_${questionId}`
        localStorage.removeItem(key)
      } catch (localError) {
        console.error('localStorage 删除也失败:', localError)
        throw localError
      }
    }
  }

  /**
   * 删除老师聊天历史记录
   * @param questionId 题目ID
   */
  async removeTeacherChatHistory(questionId: string): Promise<void> {
    try {
      await this.initialize()
      const userId = getUserId()
      const key = `${userId}_teacher_chat_history_${questionId}`
      await this.dbInstance.delete(STORE_NAMES.CHAT_HISTORY, key)
    } catch (error) {
      console.warn('删除老师聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const userId = getUserId()
        const key = `${userId}_teacher_chat_history_${questionId}`
        localStorage.removeItem(key)
      } catch (localError) {
        console.error('localStorage 删除老师聊天记录也失败:', localError)
        throw localError
      }
    }
  }

  /**
   * 获取所有聊天记录的键
   * @returns 所有聊天记录的键列表（仅返回当前用户的数据）
   */
  async getAllChatHistoryKeys(): Promise<string[]> {
    try {
      await this.initialize()
      const userId = getUserId()
      const prefix = `${userId}_chat_history_`
      const allRecords = await this.dbInstance.getAll<{id: string}>(STORE_NAMES.CHAT_HISTORY)
      return allRecords.map(r => r.id).filter(key => key.startsWith(prefix))
    } catch (error) {
      console.warn('获取聊天记录键失败，降级到 localStorage:', error)
      // 降级到 localStorage
      const userId = getUserId()
      const prefix = `${userId}_chat_history_`
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(prefix)) {
          keys.push(key)
        }
      }
      return keys
    }
  }

  /**
   * 清理过期的聊天记录
   * @param maxAge 最大保存时间（毫秒），默认30天
   */
  async cleanupExpiredChatHistory(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      await this.initialize()
      const keys = await this.getAllChatHistoryKeys()
      const now = Date.now()
      let cleanedCount = 0

      for (const key of keys) {
        const data = await this.dbInstance.get<ChatHistoryData>(STORE_NAMES.CHAT_HISTORY, key)
        if (data && (now - data.lastUpdated) > maxAge) {
          await this.dbInstance.delete(STORE_NAMES.CHAT_HISTORY, key)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
      }
    } catch (error) {
      console.warn('清理过期聊天记录失败:', error)
    }
  }

  /**
   * 获取存储使用情况
   * @returns 存储使用情况信息
   */
  async getStorageInfo(): Promise<{
    totalKeys: number
    chatHistoryKeys: number
    estimatedSize: number
  }> {
    try {
      await this.initialize()
      const userId = getUserId()
      const prefix = `${userId}_chat_history_`
      const allRecords = await this.dbInstance.getAll<{id: string}>(STORE_NAMES.CHAT_HISTORY)
      const chatRecords = allRecords.filter(r => r.id.startsWith(prefix))
      
      // 估算存储大小（粗略计算）
      let estimatedSize = 0
      for (const record of chatRecords) {
        estimatedSize += JSON.stringify(record).length
      }

      return {
        totalKeys: allRecords.length,
        chatHistoryKeys: chatRecords.length,
        estimatedSize
      }
    } catch (error) {
      console.warn('获取存储信息失败:', error)
      return {
        totalKeys: 0,
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

  /**
   * 导出聊天记录数据（用于调试）
   * @param questionId 题目ID
   */
  async exportChatHistory(questionId: string): Promise<ChatHistoryData | null> {
    try {
      const data = await this.loadChatHistory(questionId)
      if (data) {
      }
      return data
    } catch (error) {
      console.error('导出聊天记录失败:', error)
      return null
    }
  }

  // ==================== AI 作业会话列表存储 ====================

  /**
   * 保存 AI 作业会话列表
   */
  async saveHomeworkSessions(sessions: any[]): Promise<void> {
    try {
      await this.initialize()
      const userId = getUserId()
      const key = `ai_homework_sessions_${userId}`
      const plainSessions = JSON.parse(JSON.stringify(sessions))
      const record = { id: key, sessions: plainSessions }
      await this.dbInstance.put(STORE_NAMES.AI_HOMEWORK_SESSIONS, record)
    } catch (error) {
      console.error('[CHAT_STORAGE] 保存作业会话列表失败:', error)
      throw error
    }
  }

  /**
   * 加载 AI 作业会话列表
   */
  async loadHomeworkSessions(): Promise<any[]> {
    try {
      await this.initialize()
      const userId = getUserId()
      const key = `ai_homework_sessions_${userId}`
      const record = await this.dbInstance.get<{sessions: any[]}>(STORE_NAMES.AI_HOMEWORK_SESSIONS, key)
      const sessions = record?.sessions || []
      console.log(`[CHAT_STORAGE] ✅ 加载作业会话列表成功: ${sessions.length} 条`)
      return sessions
    } catch (error) {
      console.error('[CHAT_STORAGE] 加载作业会话列表失败:', error)
      return []
    }
  }

  // ==================== AI 题目会话列表存储 ====================

  /**
   * 保存 AI 题目会话列表
   * @param questionBmNo 题目 bmNo
   * @param sessions 会话列表元数据
   */
  async saveSessionsList(questionBmNo: string, sessions: SessionMeta[]): Promise<void> {
    try {
      await this.initialize()
      const key = `sessions_${questionBmNo}`
      // 使用 JSON 深拷贝，确保写入的是可结构化克隆的纯 JSON 数据
      const plainSessions: SessionMeta[] = JSON.parse(JSON.stringify(sessions))
      const record = { id: key, sessions: plainSessions }
      await this.dbInstance.put(STORE_NAMES.AI_EXERCISE_SESSIONS, record)
      console.log('[CHAT_STORAGE] ✅ 保存会话列表成功:', questionBmNo, plainSessions.length)
    } catch (error) {
      console.error('[CHAT_STORAGE] 保存会话列表失败:', error)
      throw error
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
      const key = `sessions_${questionBmNo}`
      const record = await this.dbInstance.get<{sessions: SessionMeta[]}>(STORE_NAMES.AI_EXERCISE_SESSIONS, key)
      const sessions = record?.sessions || []
      console.log(`[CHAT_STORAGE] ✅ 加载会话列表成功: ${questionBmNo}, 会话数: ${sessions.length}`)
      return sessions
    } catch (error) {
      console.error('[CHAT_STORAGE] 加载会话列表失败:', error)
      return []
    }
  }

  /**
   * 删除 AI 题目会话列表
   * @param questionBmNo 题目 bmNo
   */
  async removeSessionsList(questionBmNo: string): Promise<void> {
    try {
      await this.initialize()
      const key = `sessions_${questionBmNo}`
      await this.dbInstance.delete(STORE_NAMES.AI_EXERCISE_SESSIONS, key)
      console.log('[CHAT_STORAGE] 删除会话列表成功:', questionBmNo)
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
   * 保存 AI 通用会话列表
   * 存储位置：ExerciseSolveApp_{userId} / ai_general_sessions 表
   */
  async saveGeneralSessions(sessions: AiGeneralSession[]): Promise<void> {
    try {
      await this.initialize()
      const key = 'ai_general_sessions'
      // 使用 JSON 深拷贝，确保写入的是可结构化克隆的纯 JSON 数据
      const plainSessions: AiGeneralSession[] = JSON.parse(JSON.stringify(sessions))
      const record = { id: key, sessions: plainSessions }
      await this.dbInstance.put(STORE_NAMES.AI_GENERAL_SESSIONS, record)
    } catch (error) {
      console.error('[CHAT_STORAGE] 保存 AI 通用会话列表失败:', error)
      throw error
    }
  }

  /**
   * 加载 AI 通用会话列表
   */
  async loadGeneralSessions(): Promise<AiGeneralSession[]> {
    try {
      await this.initialize()
      const key = 'ai_general_sessions'
      const record = await this.dbInstance.get<{sessions: AiGeneralSession[]}>(STORE_NAMES.AI_GENERAL_SESSIONS, key)
      const sessions = record?.sessions || []
      console.log(`[CHAT_STORAGE] ✅ 加载 AI 通用会话列表成功: ${sessions.length} 条`)
      return sessions
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
