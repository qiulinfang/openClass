// 异步数据存储服务 - 使用 IndexedDB 替代 localStorage
import localforage from 'localforage'

// 配置 localforage
localforage.config({
  driver: localforage.INDEXEDDB, // 优先使用 IndexedDB
  name: 'ExerciseSolveApp',
  version: 1.0,
  storeName: 'chat_history', // 存储表名
  description: '练习解题应用聊天记录存储'
})

export interface ChatHistoryData {
  questionId: string
  messages: any[]
  chatResponseTimes: number
  lastUpdated: number
}

export class AsyncStorageService {
  private static instance: AsyncStorageService
  private isInitialized = false

  private constructor() {}

  static getInstance(): AsyncStorageService {
    if (!AsyncStorageService.instance) {
      AsyncStorageService.instance = new AsyncStorageService()
    }
    return AsyncStorageService.instance
  }

  /**
   * 初始化存储服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // 测试 IndexedDB 是否可用
      await localforage.setItem('test', 'test')
      await localforage.removeItem('test')
      this.isInitialized = true
      console.log('✅ 异步存储服务初始化成功')
    } catch (error) {
      console.warn('⚠️ IndexedDB 不可用，降级到 localStorage:', error)
      this.isInitialized = true // 即使降级也标记为已初始化
    }
  }

  /**
   * 深度序列化聊天数据，确保所有属性都可以被存储
   * @param data 聊天数据
   * @returns 序列化后的数据
   */
  private serializeChatData(data: ChatHistoryData): any {
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
        isStreaming: msg.isStreaming || false,
        imageData: msg.imageData ? {
          filePath: msg.imageData.filePath,
          width: msg.imageData.width,
          height: msg.imageData.height,
          fileSize: msg.imageData.fileSize
        } : undefined
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
      const key = `chat_history_${questionId}`
      
      // 序列化数据，确保可以被存储
      const serializedData = this.serializeChatData(data)
      
      console.log(`[CHAT_DEBUG] 💾 AsyncStorage保存聊天记录:`, {
        questionId,
        key,
        messageCount: serializedData.messages.length,
        chatResponseTimes: serializedData.chatResponseTimes,
        lastUpdated: new Date(serializedData.lastUpdated).toLocaleString(),
        dataSize: JSON.stringify(serializedData).length + ' bytes'
      })
      
      await localforage.setItem(key, serializedData)
      console.log(`[CHAT_DEBUG] ✅ AsyncStorage聊天记录保存成功: ${questionId}`)
    } catch (error) {
      console.warn('[CHAT_DEBUG] ❌ IndexedDB保存聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const key = `chat_history_${questionId}`
        const serializedData = this.serializeChatData(data)
        localStorage.setItem(key, JSON.stringify(serializedData))
        console.log(`[CHAT_DEBUG] ✅ localStorage聊天记录保存成功: ${questionId}`)
      } catch (localError) {
        console.error('[CHAT_DEBUG] ❌ localStorage 保存也失败:', localError)
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
      const key = `teacher_chat_history_${questionId}`
      
      // 序列化数据，确保可以被存储
      const serializedData = this.serializeChatData(data)
      
      console.log(`[TEACHER_CHAT_DEBUG] 💾 AsyncStorage保存老师聊天记录:`, {
        questionId,
        key,
        messageCount: serializedData.messages.length,
        lastUpdated: new Date(serializedData.lastUpdated).toLocaleString(),
        dataSize: JSON.stringify(serializedData).length + ' bytes'
      })
      
      await localforage.setItem(key, serializedData)
      console.log(`[TEACHER_CHAT_DEBUG] ✅ AsyncStorage老师聊天记录保存成功: ${questionId}`)
    } catch (error) {
      console.warn('[TEACHER_CHAT_DEBUG] ❌ IndexedDB保存老师聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const key = `teacher_chat_history_${questionId}`
        const serializedData = this.serializeChatData(data)
        localStorage.setItem(key, JSON.stringify(serializedData))
        console.log(`[TEACHER_CHAT_DEBUG] ✅ localStorage老师聊天记录保存成功: ${questionId}`)
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
      const key = `chat_history_${questionId}`
      
      console.log(`[CHAT_DEBUG] 📥 AsyncStorage加载聊天记录: ${questionId}`)
      const data = await localforage.getItem<ChatHistoryData>(key)
      
      if (data) {
        console.log(`[CHAT_DEBUG] ✅ AsyncStorage聊天记录加载成功:`, {
          questionId,
          messageCount: data.messages.length,
          chatResponseTimes: data.chatResponseTimes,
          lastUpdated: new Date(data.lastUpdated).toLocaleString()
        })
      } else {
        console.log(`[CHAT_DEBUG] 📭 AsyncStorage无聊天记录: ${questionId}`)
      }
      
      return data
    } catch (error) {
      console.warn('[CHAT_DEBUG] ❌ IndexedDB加载聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const key = `chat_history_${questionId}`
        const data = localStorage.getItem(key)
        const parsedData = data ? JSON.parse(data) : null
        
        if (parsedData) {
          console.log(`[CHAT_DEBUG] ✅ localStorage聊天记录加载成功:`, {
            questionId,
            messageCount: parsedData.messages.length,
            chatResponseTimes: parsedData.chatResponseTimes,
            lastUpdated: new Date(parsedData.lastUpdated).toLocaleString()
          })
        } else {
          console.log(`[CHAT_DEBUG] 📭 localStorage无聊天记录: ${questionId}`)
        }
        
        return parsedData
      } catch (localError) {
        console.error('[CHAT_DEBUG] ❌ localStorage 加载也失败:', localError)
        return null
      }
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
      const key = `teacher_chat_history_${questionId}`
      
      console.log(`[TEACHER_CHAT_DEBUG] 📥 AsyncStorage加载老师聊天记录: ${questionId}`)
      const data = await localforage.getItem<ChatHistoryData>(key)
      
      if (data) {
        console.log(`[TEACHER_CHAT_DEBUG] ✅ AsyncStorage老师聊天记录加载成功:`, {
          questionId,
          messageCount: data.messages.length,
          lastUpdated: new Date(data.lastUpdated).toLocaleString()
        })
      } else {
        console.log(`[TEACHER_CHAT_DEBUG] 📭 AsyncStorage无老师聊天记录: ${questionId}`)
      }
      
      return data
    } catch (error) {
      console.warn('[TEACHER_CHAT_DEBUG] ❌ IndexedDB加载老师聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const key = `teacher_chat_history_${questionId}`
        const data = localStorage.getItem(key)
        const parsedData = data ? JSON.parse(data) : null
        
        if (parsedData) {
          console.log(`[TEACHER_CHAT_DEBUG] ✅ localStorage老师聊天记录加载成功:`, {
            questionId,
            messageCount: parsedData.messages.length,
            lastUpdated: new Date(parsedData.lastUpdated).toLocaleString()
          })
        } else {
          console.log(`[TEACHER_CHAT_DEBUG] 📭 localStorage无老师聊天记录: ${questionId}`)
        }
        
        return parsedData
      } catch (localError) {
        console.error('[TEACHER_CHAT_DEBUG] ❌ localStorage 加载也失败:', localError)
        return null
      }
    }
  }

  /**
   * 删除聊天历史记录
   * @param questionId 题目ID
   */
  async removeChatHistory(questionId: string): Promise<void> {
    try {
      await this.initialize()
      const key = `chat_history_${questionId}`
      await localforage.removeItem(key)
      console.log(`🗑️ 聊天记录已删除: ${questionId}`)
    } catch (error) {
      console.warn('删除聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const key = `chat_history_${questionId}`
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
      const key = `teacher_chat_history_${questionId}`
      await localforage.removeItem(key)
      console.log(`🗑️ 老师聊天记录已删除: ${questionId}`)
    } catch (error) {
      console.warn('删除老师聊天记录失败，降级到 localStorage:', error)
      // 降级到 localStorage
      try {
        const key = `teacher_chat_history_${questionId}`
        localStorage.removeItem(key)
      } catch (localError) {
        console.error('localStorage 删除老师聊天记录也失败:', localError)
        throw localError
      }
    }
  }

  /**
   * 获取所有聊天记录的键
   * @returns 所有聊天记录的键列表
   */
  async getAllChatHistoryKeys(): Promise<string[]> {
    try {
      await this.initialize()
      const keys = await localforage.keys()
      return keys.filter(key => key.startsWith('chat_history_'))
    } catch (error) {
      console.warn('获取聊天记录键失败，降级到 localStorage:', error)
      // 降级到 localStorage
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('chat_history_')) {
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
        const data = await localforage.getItem<ChatHistoryData>(key)
        if (data && (now - data.lastUpdated) > maxAge) {
          await localforage.removeItem(key)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 清理了 ${cleanedCount} 个过期的聊天记录`)
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
      const allKeys = await localforage.keys()
      const chatKeys = allKeys.filter(key => key.startsWith('chat_history_'))
      
      // 估算存储大小（粗略计算）
      let estimatedSize = 0
      for (const key of chatKeys) {
        const data = await localforage.getItem(key)
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

  // ==================== 测试相关方法 ====================

  /**
   * 生成测试聊天记录并保存
   * @param questionId 题目ID
   * @param messageCount 消息数量
   */
  async generateAndSaveTestChatHistory(questionId: string, messageCount: number = 10): Promise<void> {
    try {
      // 导入模拟聊天服务
      const { mockChatService } = await import('./mock-chat-service')
      const testData = mockChatService.generateTestChatData(questionId)
      
      // 调整消息数量
      if (messageCount !== 10) {
        testData.messages = mockChatService.generateMockChatHistory(questionId, messageCount)
      }
      
      await this.saveChatHistory(questionId, testData)
      console.log(`🧪 测试聊天记录已生成并保存: ${questionId} (${testData.messages.length}条消息)`)
    } catch (error) {
      console.error('生成测试聊天记录失败:', error)
      throw error
    }
  }

  /**
   * 批量生成测试聊天记录
   * @param questionIds 题目ID列表
   * @param messageCount 每个题目的消息数量
   */
  async generateBatchTestChatHistory(questionIds: string[], messageCount: number = 8): Promise<void> {
    try {
      const { mockChatService } = await import('./mock-chat-service')
      
      for (const questionId of questionIds) {
        const testData = mockChatService.generateTestChatData(questionId)
        if (messageCount !== 10) {
          testData.messages = mockChatService.generateMockChatHistory(questionId, messageCount)
        }
        await this.saveChatHistory(questionId, testData)
      }
      
      console.log(`🧪 批量测试聊天记录已生成: ${questionIds.length}个题目`)
    } catch (error) {
      console.error('批量生成测试聊天记录失败:', error)
      throw error
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
        await localforage.removeItem(key)
      }
      
      console.log(`🧹 已清空所有聊天记录: ${keys.length}个`)
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
        console.log(`📤 聊天记录导出: ${questionId}`, data)
      }
      return data
    } catch (error) {
      console.error('导出聊天记录失败:', error)
      return null
    }
  }
}

// 导出单例实例
export const asyncStorage = AsyncStorageService.getInstance()
