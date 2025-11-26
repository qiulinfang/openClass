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
import { chatStorage } from '../services/chat-storage'
import { showMessage } from '../utils'
import { getUserInfo, getSubject, getUserId } from '../services/auth-storage-service'
import { useAiGeneralChatStore } from './aiGeneralChatStore'
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
  focus?: string // 引用的消息内容
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
  focus,
}: BuildTextbookMessageParams): AiChatMessageRequest => {
  // 从 localStorage 获取 userId
  const userId = getUserId() || 'User'

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
      name: userId,
      reason: 'start',
      bmNo: sessionId,
      isWebSearch: enableWebSearch ? '1' : '0',
      chatRole,
      subject: '',
      dstUrl: '/permission/previewPictureQA',
      focus, // 引用的消息内容
    }
  }

  const dstUrl = useScreenshotApi ? '/permission/previewPictureQA' : '/permission/chats'

  return {
    sessionId,
    newValue: isNewSession ? '1' : '0',
    coversation: content,
    question: '',
    answer: '',
    name: userId,
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole,
    subject: '',
    dstUrl,
    focus, // 引用的消息内容
  }
}

export const useAiTextbookChatStore = defineStore('aiTextbookChat', () => {
  // ==================== 状态管理 ====================
  
  const messages = ref<ChatBubble[]>([])
  const isChatLoading = ref(false) // 聊天加载状态
  const chatResponseTimes = ref(0) // 聊天响应次数计数器，记录已完成的对话轮数（用于判断是否可以查看答案）
  const enableWebSearch = ref(false) // 是否启用网络搜索功能（当前未使用，保留用于未来扩展）
  const resourceId = ref<string | null>(null) // 资源ID，用于加载消息历史
  const useScreenshotApi = ref(false)  // 是否使用截图接口（用于截图会话的后续消息）
  const currentSessionId = ref<string | null>(null) // 当前会话ID，用于加载消息历史
  const isNewSession = ref(true) // 是否是新会话
  const aiGeneralStore = useAiGeneralChatStore() // 引用 ai-general 场景，用于获取根会话ID
  
  const VIEW_ANSWER_CHAT_TIMES = 3
  const canViewAnswer = computed(() => chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES)
  
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
    useScreenshotApi.value = false  // 重置截图接口标记
    console.log('[AI_TEXTBOOK] 清空消息，重置 currentSessionId')
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
  // 确保存在一个可用的会话ID：优先使用 aiGeneral 顶部会话ID，否则生成一个 aitextbook 会话ID
const ensureTopGeneralSession = async () => {
  // 1. 取顶部会话
  if (aiGeneralStore.sessions.length > 0) {
    const topSession = aiGeneralStore.sessions[0]
    console.log('[AI_TEXTBOOK] 使用 ai-general 顶部会话ID:', topSession.sessionId)
    return topSession.sessionId
  }

  // 2. 一个会话都没有，创建一个新的 aiTextbook 会话ID
  const newSessionId = `textbook-session-${Date.now()}`
  console.log('[AI_TEXTBOOK] 创建新会话ID:', newSessionId)
  return newSessionId
}
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
    skipUserMessage?: boolean,
    focus?: string, // 引用的消息内容（发送给后端）
    quotedMessage?: { id: string; content: string; sender: 'user' | 'ai' | 'teacher' } // 引用消息信息（用于消息气泡展示）
  ): Promise<void> => {
    console.log('水电费水电费水电费收', currentSessionId.value)
    // 第1步：创建并添加用户消息（可选）
    if (!skipUserMessage) {
      const userMessage = createUserMessage(
        content,
        imageData,
        hidePrefix,
        currentSessionId.value || undefined,
        quotedMessage, // 传递引用消息信息（前端展示用）
      )
      addMessage(userMessage)
      // 用户消息创建后立即保存（确保即使AI回复未完成，用户消息也能被保存）
      await saveChatHistory()
    }
    
    // 第2步：创建临时AI回复消息
    const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage(
      selectedModel || 'mate',
      currentSessionId.value || undefined,
    )
    addMessage(tempReply)
    
    // 第3步：设置渲染状态（发送消息时不需要设置 isChatLoading，因为 isChatLoading 只用于加载聊天历史）
    
    try {
      // 第4步：获取用户信息和科目
      const userInfo = getUserInfo()
      
      // ========= 获取后端使用的根会话ID（来自 ai-general 的第一个会话） =========
      let backendSessionId: string | null = null
      backendSessionId = await ensureTopGeneralSession()
      console.log('[AI_TEXTBOOK] 使用会话ID:', backendSessionId)
      
      // 第5步：构建AI消息请求（传入科目以确定dstUrl）
      // 将 chatStoreUtils.ChatImageData 转换为构建请求所需的精简图片数据
      const builderImageData = imageData?.base64DataUrl
        ? { base64DataUrl: imageData.base64DataUrl }
        : undefined

      // 如果有图片数据且没有设置 sessionId，强制创建新会话（每次截图都创建新会话）
      // 注意：如果 currentSessionId 已经存在（比如从外部设置），则不覆盖它
      if (builderImageData && !currentSessionId.value) {
        const newSessionId = `textbook-session-${Date.now()}`
        console.log('[AI_TEXTBOOK] 创建新会话（有图片数据）', { sessionId: newSessionId })
        currentSessionId.value = newSessionId
        isNewSession.value = true
      } else if (!currentSessionId.value) {
        const newSessionId = `textbook-session-${Date.now()}`
        console.log('[AI_TEXTBOOK] 创建新会话（无图片数据）', { sessionId: newSessionId })
        currentSessionId.value = newSessionId
        isNewSession.value = true
      }
      const shouldUseScreenshotApi = !!builderImageData

      const aiMessage = buildAiTextbookMessage({
        sessionId: backendSessionId,
        content,
        userInfo: userInfo,
        enableWebSearch: enableWebSearch.value,
        chatRole: selectedModel || 'mate',
        imageData: builderImageData,
        useScreenshotApi: shouldUseScreenshotApi,
        isNewSession: isNewSession.value,
        focus, // 传递引用内容
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
    const retryingMessage = {
      ...updateMessageRetrying(message, retryCount),
      selectedModel: chatRole || message.selectedModel || 'mate' // 保留模式信息
    }
    updateMessage(messageId, retryingMessage)
    
    // 第4步：重新发送
    try {
      const userInfo = getUserInfo()
      // 将 chatStoreUtils.ChatImageData 转换为构建请求所需的精简图片数据
      const builderImageData = imageData?.base64DataUrl
        ? { base64DataUrl: imageData.base64DataUrl }
        : undefined
      if (!currentSessionId.value) {
        const newSessionId = `textbook-session-${Date.now()}`
        console.log('[AI_TEXTBOOK] 创建新会话（sendMessageWithImage）', { sessionId: newSessionId })
        currentSessionId.value = newSessionId
      }
      const shouldUseScreenshotApi = !!builderImageData
      
      const aiMessage = buildAiTextbookMessage({
        sessionId: currentSessionId.value,
        content: message.originalMessage!,
        userInfo: userInfo,
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
   * 注意：只有在 resourceId 真正变化时才重置 currentSessionId
   * 如果 resourceId 没有变化，保留当前的 currentSessionId（比如从 loadChatHistory 设置的）
   */
  const setResourceId = (id: string): void => {
    const resourceIdChanged = resourceId.value !== id
    const oldResourceId = resourceId.value
    resourceId.value = id
    // 只有在 resourceId 真正变化时才重置 currentSessionId
    if (resourceIdChanged) {
      console.log('[AI_TEXTBOOK] resourceId 变化，重置 currentSessionId', { oldResourceId, newResourceId: id })
      currentSessionId.value = null
      isNewSession.value = true
    }
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
      // 新的存储键：只按 resourceId 维度
      const storageKey = `ai-textbook-${resourceId.value}`

      await chatStorage.saveChatHistory(storageKey, {
        questionId: storageKey,
        messages: messages.value,
        lastUpdated: Date.now(),
        chatResponseTimes: chatResponseTimes.value,
      })
    } catch (error) {
      console.error('保存聊天历史失败:', error)
    }
  }
  
  /**
   * 加载聊天历史
   * @param resourceIdOrStorageKey - 可选的 resourceId（不再支持旧的 storageKey 形式）
   */
  const loadChatHistory = async (resourceIdOrStorageKey?: string): Promise<void> => {
    try {
      isChatLoading.value = true

      // 统一按 resourceId 维度存取
      const targetResourceId = resourceIdOrStorageKey || resourceId.value
      if (!targetResourceId) {
        return
      }

      const storageKey = `ai-textbook-${targetResourceId}`

      const data = await chatStorage.loadChatHistory(storageKey)
      if (data && Array.isArray(data.messages)) {
        // 统一按资源维度加载全部消息，具体按会话过滤由上层逻辑决定
        messages.value = data.messages
        chatResponseTimes.value = data.chatResponseTimes || 0
      } else {
        messages.value = []
        chatResponseTimes.value = 0
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error)
      messages.value = []
      chatResponseTimes.value = 0
    } finally {
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
      await chatStorage.removeChatHistory(storageKey)
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
    setResourceId,
  }
})

