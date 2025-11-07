/**
 * AI教材聊天场景专用Store
 * 
 * 职责：管理AI教材场景的所有聊天相关状态和逻辑
 * - 消息管理
 * - 发送消息（包括截图问答）
 * - 聊天历史持久化
 * - 重试逻辑
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { apiService } from '../services/api-service'
import { asyncStorage } from '../services/chat-storage'
import { showMessage } from '../utils'
import { useUserStore } from './userStore'
import {
  createUserMessage,
  createTempAiReplyMessage,
  updateMessageSuccess,
  updateMessageError,
  updateMessageRetrying,
  checkRetryCondition,
  isResponseSuccess,
  buildRetryFailureMessage,
  findMessageIndex,
  validateMessageExists,
  type ChatImageData
} from './utils/chatStoreUtils'
import { buildAiTextbookMessage } from './utils/aiMessageBuilder'
import type { ChatBubble } from '../types'

export const useAiTextbookChatStore = defineStore('aiTextbookChat', () => {
  // ==================== 状态管理 ====================
  
  const messages = ref<ChatBubble[]>([])
  const isChatLoading = ref(false)
  const isChatRendering = ref(false)
  const chatResponseTimes = ref(0)
  const enableWebSearch = ref(false)
  
  const VIEW_ANSWER_CHAT_TIMES = 3
  const canViewAnswer = computed(() => chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES)
  
  // 防抖定时器
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
  
  // ==================== 消息管理 ====================
  
  /**
   * 添加消息到列表
   */
  const addMessage = (message: ChatBubble): void => {
    messages.value.push(message)
  }
  
  /**
   * 更新指定消息
   */
  const updateMessage = (messageId: string, updates: Partial<ChatBubble>): void => {
    const index = findMessageIndex(messages.value, messageId)
    if (index >= 0) {
      messages.value[index] = { ...messages.value[index], ...updates }
    }
  }
  
  /**
   * 清空消息列表
   */
  const clearMessages = (): void => {
    messages.value = []
    chatResponseTimes.value = 0
  }
  
  // ==================== 发送消息 ====================
  
  /**
   * 发送聊天消息
   * 第1步：创建用户消息
   * 第2步：调用API发送
   * 第3步：处理流式响应
   * 第4步：错误处理和重试
   */
  const sendMessage = async (
    content: string,
    selectedModel?: string,
    imageData?: ChatImageData,
    hidePrefix: boolean = false,
    skipUserMessage?: boolean
  ): Promise<void> => {
    // 第1步：创建并添加用户消息（可选）
    if (!skipUserMessage) {
      const userMessage = createUserMessage(content, imageData, hidePrefix)
      addMessage(userMessage)
    }
    
    // 第2步：创建临时AI回复消息
    const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage()
    addMessage(tempReply)
    
    // 第3步：设置加载状态
    isChatLoading.value = true
    isChatRendering.value = true
    
    try {
      // 第4步：获取用户信息和科目
      const userStore = useUserStore()
      
      // 第5步：构建AI消息请求（传入科目以确定dstUrl）
      // 将 chatStoreUtils.ChatImageData 转换为 aiMessageBuilder.ChatImageData
      const builderImageData = imageData && imageData.base64DataUrl 
        ? { base64DataUrl: imageData.base64DataUrl } 
        : undefined
      const aiMessage = buildAiTextbookMessage(
        content,
        userStore.userInfo,
        enableWebSearch.value,
        selectedModel || 'mate',
        builderImageData,
        userStore.subject  // ⭐ 传入科目参数
      )
      
      // 第6步：累积内容（用于流式更新）
      let accumulatedContent = ''
      // 第7步：调用API发送消息（带流式更新回调）
      const response = await apiService.sendChatMessage(
        aiMessage,
        // onComplete: 完成回调
        (finalResponse) => {
          // 最终完成：更新消息为最终状态
          if (isResponseSuccess(finalResponse)) {
            const updatedMessage = updateMessageSuccess(
              tempReply,
              finalResponse.reply || accumulatedContent || '',
              finalResponse.messageId
            )
            updateMessage(tempReplyId, updatedMessage)
            
            // 增加响应次数
            chatResponseTimes.value++
            
            // 保存聊天历史
            saveChatHistory()
          } else {
            // 失败：标记为错误
            const errorMessage = updateMessageError(
              tempReply,
              '抱歉，我暂时无法回答这个问题。请稍后重试。',
              content,
              imageData
            )
            updateMessage(tempReplyId, errorMessage)
          }
        },
        // onStream: 流式更新回调
        (chunk: string, isComplete: boolean) => {
          if (isComplete) {
            // 流式完成，标记消息不再流式更新
            updateMessage(tempReplyId, { isStreaming: false })
          } else {
            // 累积内容并实时更新消息
            accumulatedContent += chunk
            updateMessage(tempReplyId, {
              content: accumulatedContent,
              isStreaming: true
            })
          }
        }
      )
      
      // 第8步：处理响应（如果轮询已完成，这里response已经是最终结果）
      // 注意：由于使用了回调，这里主要是确保没有错误
      if (!isResponseSuccess(response) && !accumulatedContent) {
        // 如果既没有成功响应，也没有累积内容，标记为错误
        const errorMessage = updateMessageError(
          tempReply,
          '抱歉，我暂时无法回答这个问题。请稍后重试。',
          content,
          imageData
        )
        updateMessage(tempReplyId, errorMessage)
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      
      // 第8步：错误处理
      const errorMessage = updateMessageError(
        tempReply,
        '发送失败，请检查网络连接后重试。',
        content,
        imageData
      )
      updateMessage(tempReplyId, errorMessage)
      
      showMessage('发送消息失败', 'error')
    } finally {
      // 第9步：重置加载状态
      isChatLoading.value = false
      isChatRendering.value = false
    }
  }
  
  // ==================== 重试消息 ====================
  
  /**
   * 重试失败的消息
   * 第1步：查找并验证消息
   * 第2步：检查重试条件
   * 第3步：更新消息为重试中状态
   * 第4步：重新发送
   */
  const retryAiMessage = async (
    messageId: string,
    chatRole: string = 'mate',
    imageData?: ChatImageData
  ): Promise<void> => {
    // 第1步：查找消息
    const index = findMessageIndex(messages.value, messageId)
    try {
      validateMessageExists(index)
    } catch {
      showMessage('消息不存在', 'error')
      return
    }
    
    const message = messages.value[index]
    
    // 第2步：检查重试条件
    const { canRetry, error } = checkRetryCondition(message)
    if (!canRetry) {
      showMessage(error || '无法重试', 'warning')
      return
    }
    
    // 第3步：更新为重试中状态
    const retryCount = (message.retryCount || 0) + 1
    const retryingMessage = updateMessageRetrying(message, retryCount)
    updateMessage(messageId, retryingMessage)
    
    // 第4步：重新发送
    try {
      const userStore = useUserStore()
      // 将 chatStoreUtils.ChatImageData 转换为 aiMessageBuilder.ChatImageData
      const builderImageData = imageData && imageData.base64DataUrl 
        ? { base64DataUrl: imageData.base64DataUrl } 
        : undefined
      const aiMessage = buildAiTextbookMessage(
        message.originalMessage!,
        userStore.userInfo,
        enableWebSearch.value,
        chatRole,
        builderImageData,
        userStore.subject  // ⭐ 传入科目参数
      )
      
      // 累积内容（用于流式更新）
      let accumulatedContent = ''
      const response = await apiService.sendChatMessage(
        aiMessage,
        // onComplete: 完成回调
        (finalResponse) => {
          if (isResponseSuccess(finalResponse)) {
            // 重试成功
            const successMessage = updateMessageSuccess(
              message,
              finalResponse.reply || accumulatedContent || '',
              finalResponse.messageId
            )
            updateMessage(messageId, successMessage)
            
            chatResponseTimes.value++
            saveChatHistory()
          } else {
            // 重试失败
            const errorContent = buildRetryFailureMessage(retryCount, 3)
            const errorMessage = updateMessageError(
              message,
              errorContent,
              message.originalMessage,
              imageData
            )
            updateMessage(messageId, errorMessage)
          }
        },
        // onStream: 流式更新回调
        (chunk: string, isComplete: boolean) => {
          if (isComplete) {
            // 流式完成，标记消息不再流式更新
            updateMessage(messageId, { isStreaming: false })
          } else {
            // 累积内容并实时更新消息
            accumulatedContent += chunk
            updateMessage(messageId, {
              content: accumulatedContent,
              isStreaming: true
            })
          }
        }
      )
      
      // 处理响应（如果轮询已完成）
      if (!isResponseSuccess(response) && !accumulatedContent) {
        // 重试失败
        const errorContent = buildRetryFailureMessage(retryCount, 3)
        const errorMessage = updateMessageError(
          message,
          errorContent,
          message.originalMessage,
          imageData
        )
        updateMessage(messageId, errorMessage)
      }
    } catch (error) {
      console.error('重试失败:', error)
      const errorContent = buildRetryFailureMessage(retryCount, 3)
      const errorMessage = updateMessageError(
        message,
        errorContent,
        message.originalMessage,
        imageData
      )
      updateMessage(messageId, errorMessage)
    }
  }
  
  // ==================== 聊天历史 ====================
  
  /**
   * 保存聊天历史（带防抖）
   * 第1步：清除旧的定时器
   * 第2步：如果是立即保存，直接执行
   * 第3步：否则设置防抖定时器
   */
  const saveChatHistory = async (immediate: boolean = false): Promise<void> => {
    // 第1步：清除旧定时器
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer)
      saveDebounceTimer = null
    }
    
    const saveAction = async () => {
      try {
        // 第2步：构建存储键
        const storageKey = 'ai_textbook_chat_history'
        
        // 第3步：保存到IndexedDB
        await asyncStorage.saveChatHistory(storageKey, {
          questionId: storageKey,
          messages: messages.value,
          lastUpdated: Date.now(),
          chatResponseTimes: chatResponseTimes.value
        })
      } catch (error) {
        console.error('保存聊天历史失败:', error)
      }
    }
    
    // 第4步：立即保存或防抖保存
    if (immediate) {
      await saveAction()
    } else {
      saveDebounceTimer = setTimeout(saveAction, 1000)
    }
  }
  
  /**
   * 加载聊天历史
   */
  const loadChatHistory = async (): Promise<void> => {
    try {
      const storageKey = 'ai_textbook_chat_history'
      const history = await asyncStorage.loadChatHistory(storageKey)
      
      if (history && history.messages) {
        messages.value = history.messages
        chatResponseTimes.value = history.chatResponseTimes || 0
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error)
    }
  }
  
  /**
   * 清除聊天历史
   */
  const clearChatHistory = async (): Promise<void> => {
    try {
      const storageKey = 'ai_textbook_chat_history'
      const key = `chat_history_${storageKey}`
      // 直接使用localforage删除
      await localforage.removeItem(key)
      clearMessages()
    } catch (error) {
      console.error('清除聊天历史失败:', error)
    }
  }
  
  // ==================== Web搜索 ====================
  
  /**
   * 切换Web搜索
   */
  const toggleWebSearch = (): void => {
    enableWebSearch.value = !enableWebSearch.value
  }
  
  // ==================== 导出 ====================
  
  return {
    // 状态
    messages,
    isChatLoading,
    isChatRendering,
    chatResponseTimes,
    enableWebSearch,
    VIEW_ANSWER_CHAT_TIMES,
    canViewAnswer,
    
    // 方法
    addMessage,
    updateMessage,
    clearMessages,
    sendMessage,
    retryAiMessage,
    saveChatHistory,
    loadChatHistory,
    clearChatHistory,
    toggleWebSearch
  }
})

