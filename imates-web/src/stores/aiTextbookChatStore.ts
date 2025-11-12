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
  type ChatImageData,
} from './utils/chatStoreUtils'
import type { AiChatMessageRequest, ChatBubble, UserInfo } from '../types'

interface TextbookChatImageData {
  base64DataUrl: string
}

interface BuildTextbookMessageParams {
  sessionId: string
  content: string
  userInfo: UserInfo | null
  enableWebSearch: boolean
  chatRole?: string
  imageData?: TextbookChatImageData
  useScreenshotApi?: boolean
  isNewSession?: boolean
}

const buildAiTextbookMessage = ({
  sessionId,
  content,
  userInfo,
  enableWebSearch,
  chatRole = 'mate',
  imageData,
  useScreenshotApi = false,
  isNewSession = true,
}: BuildTextbookMessageParams): AiChatMessageRequest => {
  // 统一使用 userName，与通用场景保持一致
  const userName = userInfo?.userName || 'User'

  if (imageData?.base64DataUrl) {
    const questionDataUrl = imageData.base64DataUrl.startsWith('data:image/jpeg;')
      ? imageData.base64DataUrl.replace('data:image/jpeg;', 'data:image/jpg;')
      : imageData.base64DataUrl

    return {
      sessionId,
      newValue: isNewSession ? '1' : '0',
      coversation: content,
      question: questionDataUrl,
      answer: '',
      name: userName,
      reason: 'start',
      bmNo: sessionId,
      isWebSearch: enableWebSearch ? '1' : '0',
      chatRole,
      subject: '',
      dstUrl: '/permission/previewPictureQA',
    }
  }

  const dstUrl = useScreenshotApi ? '/permission/previewPictureQA' : '/permission/chats'

  return {
    sessionId,
    newValue: isNewSession ? '1' : '0',
    coversation: content,
    question: '',
    answer: '',
    name: userName,
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole,
    subject: '',
    dstUrl,
  }
}

export const useAiTextbookChatStore = defineStore('aiTextbookChat', () => {
  // ==================== 状态管理 ====================
  
  const messages = ref<ChatBubble[]>([])
  const isChatLoading = ref(false)
  const chatResponseTimes = ref(0)
  const enableWebSearch = ref(false)
  const resourceId = ref<string | null>(null)
  const useScreenshotApi = ref(false)  // 是否使用截图接口（用于截图会话的后续消息）
  const currentSessionId = ref<string | null>(null)
  const isNewSession = ref(true)
  
  const VIEW_ANSWER_CHAT_TIMES = 3
  const canViewAnswer = computed(() => chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES)
  
  // ==================== 消息管理 ====================
  
  /**
   * 添加消息到列表
   */
  const addMessage = (message: ChatBubble): void => {
    messages.value.push(message)
    console.log('[消息] 创建', { id: message.id, type: message.type, hasImage: !!(message.imageData || message.messageType === 'image') })
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
    useScreenshotApi.value = false  // 重置截图接口标记
    currentSessionId.value = null
    isNewSession.value = true
  }
  
  /**
   * 删除单条消息
   * 
   * 第1步：从消息列表中删除指定消息
   * 第2步：保存更新后的聊天历史
   */
  const deleteMessage = async (messageId: string): Promise<void> => {
    try {
      // 第1步：查找消息索引
      const index = messages.value.findIndex(m => m.id === messageId)
      if (index < 0) {
        throw new Error('消息不存在')
      }
      
      // 第2步：从列表中删除消息
      messages.value.splice(index, 1)
      
      // 第3步：保存更新后的聊天历史
      if (resourceId.value) {
        await saveChatHistory()
      }
    } catch (error) {
      console.error('[AI_TEXTBOOK] ❌ 删除消息失败:', error)
      throw error
    }
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
      // 用户消息创建后立即保存（确保即使AI回复未完成，用户消息也能被保存）
      await saveChatHistory()
    }
    
    // 第2步：创建临时AI回复消息
    const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage()
    addMessage(tempReply)
    
    // 第3步：设置渲染状态（发送消息时不需要设置 isChatLoading，因为 isChatLoading 只用于加载聊天历史）
    
    try {
      // 第4步：获取用户信息和科目
      const userStore = useUserStore()
      
      // 第5步：构建AI消息请求（传入科目以确定dstUrl）
      // 将 chatStoreUtils.ChatImageData 转换为构建请求所需的精简图片数据
      const builderImageData = imageData?.base64DataUrl
        ? { base64DataUrl: imageData.base64DataUrl }
        : undefined

      // 如果有图片数据且没有设置 sessionId，强制创建新会话（每次截图都创建新会话）
      // 注意：如果 currentSessionId 已经存在（比如从外部设置），则不覆盖它
      if (builderImageData && !currentSessionId.value) {
        currentSessionId.value = `textbook-session-${Date.now()}`
        isNewSession.value = true
      } else if (!currentSessionId.value) {
        currentSessionId.value = `textbook-session-${Date.now()}`
        isNewSession.value = true
      }

      const shouldUseScreenshotApi = !!builderImageData

      const aiMessage = buildAiTextbookMessage({
        sessionId: currentSessionId.value,
        content,
        userInfo: userStore.userInfo,
        enableWebSearch: enableWebSearch.value,
        chatRole: selectedModel || 'mate',
        imageData: builderImageData,
        useScreenshotApi: shouldUseScreenshotApi,
        isNewSession: isNewSession.value,
      })

      // 调试日志：验证文字和图片是否一起发送
      if (builderImageData) {
        console.log('[AI_TEXTBOOK] 📤 发送截图消息:', {
          coversation: aiMessage.coversation,
          question: aiMessage.question?.substring(0, 50) + '...', // 只显示前50个字符
          hasImage: !!aiMessage.question?.startsWith('data:image'),
        })
      }

      useScreenshotApi.value = shouldUseScreenshotApi
      isNewSession.value = false
      
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
      // 第9步：重置渲染状态（发送消息时不需要重置 isChatLoading，因为 isChatLoading 只用于加载聊天历史）
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
      // 将 chatStoreUtils.ChatImageData 转换为构建请求所需的精简图片数据
      const builderImageData = imageData?.base64DataUrl
        ? { base64DataUrl: imageData.base64DataUrl }
        : undefined
      if (!currentSessionId.value) {
        currentSessionId.value = `textbook-session-${Date.now()}`
      }
      const shouldUseScreenshotApi = !!builderImageData
      
      const aiMessage = buildAiTextbookMessage({
        sessionId: currentSessionId.value,
        content: message.originalMessage!,
        userInfo: userStore.userInfo,
        enableWebSearch: enableWebSearch.value,
        chatRole,
        imageData: builderImageData,
        useScreenshotApi: shouldUseScreenshotApi,
        isNewSession: false,
      })
      useScreenshotApi.value = shouldUseScreenshotApi
      
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
   * 设置资源ID
   */
  const setResourceId = (id: string): void => {
    resourceId.value = id
    currentSessionId.value = null
    isNewSession.value = true
  }
  
  /**
   * 保存聊天历史（立即保存）
   */
  const saveChatHistory = async (): Promise<void> => {
    // 如果没有 resourceId，不保存
    if (!resourceId.value) {
      return
    }
    
      try {
      // 构建存储键：如果有 sessionId，使用 ai-textbook-${resourceId}-${sessionId}，否则使用 ai-textbook-${resourceId}
        const storageKey = currentSessionId.value 
          ? `ai-textbook-${resourceId.value}-${currentSessionId.value}`
          : `ai-textbook-${resourceId.value}`
        
      // 保存到IndexedDB
        await asyncStorage.saveChatHistory(storageKey, {
          questionId: storageKey,
          messages: messages.value,
          lastUpdated: Date.now(),
          chatResponseTimes: chatResponseTimes.value
        })
        console.log('[消息] 存储', { resourceId: resourceId.value, sessionId: currentSessionId.value, storageKey, count: messages.value.length })
      } catch (error) {
        console.error('保存聊天历史失败:', error)
    }
  }
  
  /**
   * 加载聊天历史
   * @param resourceIdOrStorageKey - resourceId 或完整的 storageKey（格式：ai-textbook-${resourceId}-${sessionId}）
   * @param sessionId - 可选的 sessionId，如果提供，会构建包含 sessionId 的存储键
   */
  const loadChatHistory = async (resourceIdOrStorageKey?: string, sessionId?: string): Promise<void> => {
    try {
      // 设置加载状态
      isChatLoading.value = true
      
      let storageKey: string
      
      // 如果传入的是完整的 storageKey（包含 ai-textbook- 前缀），直接使用
      if (resourceIdOrStorageKey?.startsWith('ai-textbook-')) {
        storageKey = resourceIdOrStorageKey
      } else {
        // 否则作为 resourceId 处理
        const targetResourceId = resourceIdOrStorageKey || resourceId.value
        if (!targetResourceId) {
          // 如果没有 resourceId，清空状态
          messages.value = []
          chatResponseTimes.value = 0
          isChatLoading.value = false
          return
        }
        
        // 如果有 sessionId，构建包含 sessionId 的存储键，否则使用旧的格式
        storageKey = sessionId 
          ? `ai-textbook-${targetResourceId}-${sessionId}`
          : `ai-textbook-${targetResourceId}`
      }
      
      const history = await asyncStorage.loadChatHistory(storageKey)
      
      if (history && history.messages) {
        messages.value = history.messages
        chatResponseTimes.value = history.chatResponseTimes || 0
        // 检查加载的消息中是否有图片消息，如果有则标记使用截图接口
        useScreenshotApi.value = messages.value.some(msg => msg.messageType === 'image' || msg.imageData)
        console.log('[消息] 加载', { storageKey, count: messages.value.length })
      } else {
        // 无历史记录，清空状态
        messages.value = []
        chatResponseTimes.value = 0
        useScreenshotApi.value = false
        console.log('[消息] 加载', { storageKey, count: 0 })
      }
      
      // 如果加载成功且有 sessionId，更新 currentSessionId
      if (sessionId) {
        currentSessionId.value = sessionId
        isNewSession.value = false
      } else {
        currentSessionId.value = null
        isNewSession.value = true
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error)
      messages.value = []
      chatResponseTimes.value = 0
    } finally {
      // 重置加载状态
      isChatLoading.value = false
    }
  }
  
  /**
   * 清除聊天历史
   */
  const clearChatHistory = async (): Promise<void> => {
    try {
      if (!resourceId.value) {
        clearMessages()
        return
      }
      
      const storageKey = `ai-textbook-${resourceId.value}`
      await asyncStorage.removeChatHistory(storageKey)
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
    chatResponseTimes,
    enableWebSearch,
    VIEW_ANSWER_CHAT_TIMES,
    canViewAnswer,
    resourceId,
    useScreenshotApi,
    currentSessionId,
    isNewSession,
    
    // 方法
    addMessage,
    updateMessage,
    clearMessages,
    deleteMessage,
    sendMessage,
    retryAiMessage,
    saveChatHistory,
    loadChatHistory,
    clearChatHistory,
    toggleWebSearch,
    setResourceId
  }
})

