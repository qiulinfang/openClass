/**
 * 聊天历史存储服务（React Native 版本）
 * 使用 AsyncStorage 替代 IndexedDB/localforage
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ChatBubble } from '../types/chat'

/**
 * 聊天历史数据结构
 */
export interface ChatHistoryData {
  questionId: string
  messages: ChatBubble[]
  chatResponseTimes: number
  lastUpdated: number
}

/**
 * 聊天历史存储服务类
 */
export class ChatStorageService {
  private static instance: ChatStorageService

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ChatStorageService {
    if (!ChatStorageService.instance) {
      ChatStorageService.instance = new ChatStorageService()
    }
    return ChatStorageService.instance
  }

  /**
   * 深度序列化聊天数据，确保所有属性都可以被存储
   */
  private serializeChatData(data: ChatHistoryData): ChatHistoryData {
    return {
      questionId: data.questionId,
      messages: data.messages.map(msg => ({
        ...msg,
        // 确保 imageData 被正确序列化（去掉 base64DataUrl，因为太大）
        imageData: msg.imageData
          ? {
              filePath: msg.imageData.filePath || '',
              width: msg.imageData.width || 0,
              height: msg.imageData.height || 0,
              fileSize: msg.imageData.fileSize || 0,
              // 注意：不存储 base64DataUrl，太大，需要时从文件路径重新加载
            }
          : undefined,
      })),
      chatResponseTimes: data.chatResponseTimes,
      lastUpdated: data.lastUpdated,
    }
  }

  /**
   * 保存聊天历史记录
   */
  async saveChatHistory(questionId: string, data: ChatHistoryData): Promise<void> {
    try {
      const key = `chat_history_${questionId}`
      const serializedData = this.serializeChatData(data)

      console.log(`[CHAT_STORAGE] 💾 保存聊天记录:`, {
        questionId,
        key,
        messageCount: serializedData.messages.length,
        chatResponseTimes: serializedData.chatResponseTimes,
      })

      await AsyncStorage.setItem(key, JSON.stringify(serializedData))
      console.log(`[CHAT_STORAGE] ✅ 聊天记录保存成功: ${questionId}`)
    } catch (error) {
      console.error(`[CHAT_STORAGE] ❌ 保存聊天记录失败:`, error)
      throw error
    }
  }

  /**
   * 加载聊天历史记录
   */
  async loadChatHistory(questionId: string): Promise<ChatHistoryData | null> {
    try {
      const key = `chat_history_${questionId}`
      console.log(`[CHAT_STORAGE] 📥 加载聊天记录: ${questionId}`)

      const data = await AsyncStorage.getItem(key)
      if (!data) {
        console.log(`[CHAT_STORAGE] 📭 无聊天记录: ${questionId}`)
        return null
      }

      const parsedData = JSON.parse(data) as ChatHistoryData
      console.log(`[CHAT_STORAGE] ✅ 聊天记录加载成功:`, {
        questionId,
        messageCount: parsedData.messages.length,
        chatResponseTimes: parsedData.chatResponseTimes,
      })

      return parsedData
    } catch (error) {
      console.error(`[CHAT_STORAGE] ❌ 加载聊天记录失败:`, error)
      return null
    }
  }

  /**
   * 删除聊天历史记录
   */
  async removeChatHistory(questionId: string): Promise<void> {
    try {
      const key = `chat_history_${questionId}`
      await AsyncStorage.removeItem(key)
      console.log(`[CHAT_STORAGE] 🗑️ 聊天记录已删除: ${questionId}`)
    } catch (error) {
      console.error(`[CHAT_STORAGE] ❌ 删除聊天记录失败:`, error)
      throw error
    }
  }

  /**
   * 获取所有聊天记录的键
   */
  async getAllChatHistoryKeys(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys()
      return keys.filter(key => key.startsWith('chat_history_'))
    } catch (error) {
      console.error(`[CHAT_STORAGE] ❌ 获取聊天记录键失败:`, error)
      return []
    }
  }

  /**
   * 清空所有聊天记录
   */
  async clearAllChatHistory(): Promise<void> {
    try {
      const keys = await this.getAllChatHistoryKeys()
      await AsyncStorage.multiRemove(keys)
      console.log(`[CHAT_STORAGE] 🧹 已清空所有聊天记录: ${keys.length}个`)
    } catch (error) {
      console.error(`[CHAT_STORAGE] ❌ 清空聊天记录失败:`, error)
      throw error
    }
  }
}

// 导出单例实例
export const chatStorageService = ChatStorageService.getInstance()

