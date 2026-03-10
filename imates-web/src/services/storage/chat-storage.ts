// 异步数据存储服务 - 使用 IndexedDB 替代 localStorage
import localforage from 'localforage'
import { getUserId } from '../http/auth-service'
import type { ChatBubble, AiGeneralSession } from '@/types'

/**
 * 获取当前用户的 localforage 实例（聊天历史表）
 * 使用用户ID作为数据库名前缀，实现账号隔离
 * 每个用户拥有独立的 IndexedDB 数据库
 */
function getUserLocalForage() {
  const userId = getUserId()
  return localforage.createInstance({
    driver: localforage.INDEXEDDB, // 优先使用 IndexedDB
    name: `ExerciseSolveApp_${userId}`, // 使用用户ID作为数据库名前缀
    version: 1.0,
    storeName: 'chat_history', // 存储表名
    description: `练习解题应用聊天记录存储 (用户: ${userId})`
  })
}

/**
 * 获取当前用户的会话列表 localforage 实例
 * 用于存储 AI 题目会话列表（多会话管理）
 */
function getSessionsLocalForage() {
  const userId = getUserId()
  return localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: `ExerciseSolveApp_${userId}`,
    version: 1.0,
    storeName: 'ai_exercise_sessions', // 会话列表表名
    description: `AI题目会话列表存储 (用户: ${userId})`
  })
}

/**
 * 获取当前用户的教师题目会话列表 localforage 实例
 * 用于存储 TeacherExercise 场景下的多会话列表
 */
function getTeacherExerciseSessionsLocalForage() {
  const userId = getUserId()
  return localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: `ExerciseSolveApp_${userId}`,
    version: 1.0,
    storeName: 'teacher_exercise_sessions',
    description: `教师题目会话列表存储 (用户: ${userId})`
  })
}

/**
 * 获取当前用户的 AI 通用会话列表 localforage 实例
 * 用于存储 AI 通用聊天多会话列表（ExerciseSolveApp 数据库中的独立表）
 */
function getGeneralSessionsLocalForage() {
  const userId = getUserId()
  return localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: `ExerciseSolveApp_${userId}`,
    version: 1.0,
    storeName: 'ai_general_sessions',
    description: `AI通用会话列表存储 (用户: ${userId})`
  })
}

export interface ChatHistoryData {
  questionId: string
  messages: ChatBubble[]
  chatResponseTimes: number
  lastUpdated: number
}

export class ChatStorageService {
  private static instance: ChatStorageService
  private isInitialized = false

  private constructor() {}

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
      const userLocalForage = getUserLocalForage()
      // 测试 IndexedDB 是否可用
      await userLocalForage.setItem('test', 'test')
      await userLocalForage.removeItem('test')
      this.isInitialized = true
    } catch (error) {
      console.warn('⚠️ IndexedDB 不可用，降级到 localStorage:', error)
      this.isInitialized = true // 即使降级也标记为已初始化
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
        rawHtmlMap: msg.rawHtmlMap,
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
        chatRecordData: msg.chatRecordData,
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
      const userLocalForage = getUserLocalForage()
      const key = `${userId}_chat_history_${questionId}`
      
      // 序列化数据，确保可以被存储
      const serializedData = this.serializeChatData(data)
      console.log('保存聊天记录', serializedData)
      await userLocalForage.setItem(key, serializedData)
      
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
      const userLocalForage = getUserLocalForage()
      const key = `${userId}_teacher_chat_history_${questionId}`
      
      // 序列化数据，确保可以被存储
      const serializedData = this.serializeChatData(data)
      await userLocalForage.setItem(key, serializedData)
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
      const userLocalForage = getUserLocalForage()
      const key = `${userId}_chat_history_${questionId}`
      const data = await userLocalForage.getItem<ChatHistoryData>(key)
      
      return data
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
      const userLocalForage = getUserLocalForage()
      const key = `${userId}_teacher_chat_history_${questionId}`
      const data = await userLocalForage.getItem<ChatHistoryData>(key)
      
      
      return data
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
      const userLocalForage = getUserLocalForage()
      const key = `${userId}_chat_history_${questionId}`
      await userLocalForage.removeItem(key)
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
      const userLocalForage = getUserLocalForage()
      const key = `${userId}_teacher_chat_history_${questionId}`
      await userLocalForage.removeItem(key)
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
      const userLocalForage = getUserLocalForage()
      const prefix = `${userId}_chat_history_`
      const keys = await userLocalForage.keys()
      return keys.filter(key => key.startsWith(prefix))
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
      const userLocalForage = getUserLocalForage()
      const keys = await this.getAllChatHistoryKeys()
      const now = Date.now()
      let cleanedCount = 0

      for (const key of keys) {
        const data = await userLocalForage.getItem<ChatHistoryData>(key)
        if (data && (now - data.lastUpdated) > maxAge) {
          await userLocalForage.removeItem(key)
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
      const userLocalForage = getUserLocalForage()
      const prefix = `${userId}_chat_history_`
      const allKeys = await userLocalForage.keys()
      const chatKeys = allKeys.filter(key => key.startsWith(prefix))
      
      // 估算存储大小（粗略计算）
      let estimatedSize = 0
      for (const key of chatKeys) {
        const data = await userLocalForage.getItem(key)
        if (data) {
          estimatedSize += JSON.stringify(data).length
        }
      }

      return {
        totalKeys: allKeys.length,
        chatHistoryKeys: chatKeys.length,
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
      const userLocalForage = getUserLocalForage()
      const keys = await this.getAllChatHistoryKeys()
      
      for (const key of keys) {
        await userLocalForage.removeItem(key)
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

  // ==================== AI 题目会话列表存储 ====================

  /**
   * 保存 AI 题目会话列表
   * @param questionBmNo 题目 bmNo
   * @param sessions 会话列表元数据
   */
  async saveSessionsList(questionBmNo: string, sessions: SessionMeta[]): Promise<void> {
    try {
      await this.initialize()
      const sessionsLocalForage = getSessionsLocalForage()
      const key = `sessions_${questionBmNo}`
      // 使用 JSON 深拷贝，确保写入的是可结构化克隆的纯 JSON 数据
      const plainSessions: SessionMeta[] = JSON.parse(JSON.stringify(sessions))
      await sessionsLocalForage.setItem(key, plainSessions)
      console.log('[CHAT_STORAGE] 保存会话列表成功:', questionBmNo, plainSessions.length)
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
      const sessionsLocalForage = getSessionsLocalForage()
      const key = `sessions_${questionBmNo}`
      const sessions = await sessionsLocalForage.getItem<SessionMeta[]>(key)
      console.log('[CHAT_STORAGE] 加载会话列表成功:', questionBmNo, sessions?.length || 0)
      return sessions || []
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
      const sessionsLocalForage = getSessionsLocalForage()
      const key = `sessions_${questionBmNo}`
      await sessionsLocalForage.removeItem(key)
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
      const sessionsLocalForage = getTeacherExerciseSessionsLocalForage()
      const key = 'teacher_exercise_sessions'
      const plain = JSON.parse(JSON.stringify(allSessions))
      await sessionsLocalForage.setItem(key, plain)
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
      const sessionsLocalForage = getTeacherExerciseSessionsLocalForage()
      const key = 'teacher_exercise_sessions'
      const stored = await sessionsLocalForage.getItem<Record<string, T>>(key)
      return stored || {}
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
      const sessionsLocalForage = getTeacherExerciseSessionsLocalForage()
      const key = 'teacher_exercise_sessions'
      await sessionsLocalForage.removeItem(key)
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
      const generalSessionsForage = getGeneralSessionsLocalForage()
      const key = 'ai_general_sessions'
      // 使用 JSON 深拷贝，确保写入的是可结构化克隆的纯 JSON 数据
      const plainSessions: AiGeneralSession[] = JSON.parse(JSON.stringify(sessions))
      await generalSessionsForage.setItem(key, plainSessions)
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
      const generalSessionsForage = getGeneralSessionsLocalForage()
      const key = 'ai_general_sessions'
      const stored = await generalSessionsForage.getItem<AiGeneralSession[]>(key)
      return stored || []
    } catch (error) {
      console.error('[CHAT_STORAGE] 加载 AI 通用会话列表失败:', error)
      return []
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
