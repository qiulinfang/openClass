/**
 * AI 题目聊天 Store
 * 职责：管理AI题目场景下的聊天消息和业务逻辑
 * 
 * 场景特点：
 * - 需要选中题目才能对话
 * - 发送题目信息给AI
 * - 支持消息重试
 * - 保存到题目维度
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiService } from '../services/api-service'
import { asyncStorage, type ChatHistoryData } from '../services/chat-storage'
import type { AiChatMessageRequest, ChatBubble, ExerciseItem, UserInfo } from '../types'
import { createUserMessage, generateUniqueId, type ChatImageData } from './utils/chatStoreUtils'
import { useQuestionStore } from './questionStore'
import { getCurrentUserIdOrDefault } from '../utils/user/userId'

/**
 * 构建AI题目聊天消息请求
 */
const buildAiExerciseMessage = (
  content: string,
  currentQuestion: ExerciseItem,
  userInfo: UserInfo | null,
  subject: 'MATH' | 'BIOLOGY',
  enableWebSearch: boolean,
  selectedModel: string = 'mate',
  imageData?: ChatImageData
): AiChatMessageRequest => {
  // 获取用户ID，优先级：userInfo.userId > userInfo.id > getCurrentUserId() > 'User'
  const userId = userInfo?.userId || userInfo?.id || getCurrentUserIdOrDefault() || 'User'
  
  // 获取题目ID
  const questionId = currentQuestion.id || currentQuestion.bmNo || ''
  
  // 生成会话ID（使用题目ID和时间戳）
  const sessionId = `exercise-${questionId}-${Date.now()}`
  
  // 如果有图片数据，使用图片接口
  if (imageData?.base64DataUrl) {
    // 处理图片格式：jpeg -> jpg
    const questionDataUrl = imageData.base64DataUrl.startsWith('data:image/jpeg;')
      ? imageData.base64DataUrl.replace('data:image/jpeg;', 'data:image/jpg;')
      : imageData.base64DataUrl
    
    return {
      sessionId,
      newValue: '1',
      coversation: content,
      question: questionDataUrl,
      answer: '题目截图',
      name: userId,
      reason: 'start',
      bmNo: questionId,
      isWebSearch: enableWebSearch ? '1' : '0',
      chatRole: selectedModel,
      subject: subject,
      dstUrl: '/permission/previewPictureQA',
    }
  }
  
  // 普通文本消息
  return {
    sessionId,
    newValue: '1',
    coversation: content,
    question: currentQuestion.question || '',
    answer: currentQuestion.answer || '',
    name: userId,
    reason: 'start',
    bmNo: questionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole: selectedModel,
    subject: subject,
    dstUrl: '/permission/chatMath',
  }
}

export const useAiExerciseChatStore = defineStore('aiExerciseChat', () => {
  // 获取题目Store
  const questionStore = useQuestionStore()
  // ==================== 状态定义 ====================
  
  /** 消息列表 */
  const messages = ref<ChatBubble[]>([])
  
  /** AI回复次数 */
  const chatResponseTimes = ref(0)
  
  /** 聊天加载状态 */
  const isChatLoading = ref(false)
  
  /** Web搜索开关 */
  const enableWebSearch = ref(false)
  
  /** 查看答案所需最小交互次数 */
  const VIEW_ANSWER_CHAT_TIMES = 3
  
  /** 是否可以查看答案 */
  const canViewAnswer = ref(false)
  
  // ==================== 公开方法 ====================
  
  /**
   * 发送聊天消息（AI题目场景）
   * 
   * 第1步：验证题目
   * 第2步：创建用户消息
   * 第3步：创建临时AI回复
   * 第4步：构建AI请求
   * 第5步：发送请求
   * 第6步：更新消息
   * 第7步：保存历史
   */
  const sendMessage = async (
    content: string,
    currentQuestion: ExerciseItem | null,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel: string = 'mate',
    imageData?: ChatImageData,
    hidePrefix: boolean = false,
    skipUserMessage?: boolean
  ): Promise<void> => {
    // 第1步：验证题目
    if (!currentQuestion) {
      throw new Error('请先选择一道题目')
    }
    
    // 第2步：创建用户消息（可选）
    // 自动检测并去除"我们开始吧"前缀（如果未显式设置hidePrefix）
    const shouldHidePrefix = hidePrefix || content.includes('我们开始吧')
    if (!skipUserMessage) {
      const userMessage = createUserMessage(content, imageData, shouldHidePrefix)
      messages.value.push(userMessage)
    }
    
    // 第3步：创建临时AI回复（使用工具函数）
    const tempReplyId = generateUniqueId('temp_ai')
    const tempReply: ChatBubble = {
      id: tempReplyId,
      content: '',
      type: 'ai',
      timestamp: new Date().toISOString(),
      sender: 'ai',
      isStreaming: true
    }
    messages.value.push(tempReply)
    
    // 第4步：构建AI请求（使用标准构建函数）
    const aiRequest = buildAiExerciseMessage(
      content,
      currentQuestion,
      userInfo,
      subject,
      enableWebSearch.value,
      selectedModel,
      imageData
    )
    
    try {
      // 第5步：发送请求
      const response = await apiService.sendChatMessage(aiRequest)
      
      // 第6步：更新临时消息为实际回复
      const index = messages.value.findIndex(m => m.id === tempReplyId)
      if (index >= 0) {
        messages.value[index] = {
          ...tempReply,
          content: response.reply || '回复失败',
          isStreaming: false,
          messageId: response.messageId
        }
      }
      
      // 第7步：更新回复次数
      chatResponseTimes.value++
      
      // 检查是否可以查看答案
      if (chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES) {
        canViewAnswer.value = true
      }
      
      // 第8步：保存聊天历史
      await saveChatHistory(currentQuestion.id || currentQuestion.bmNo)
      
    } catch (error) {
      console.error('[AI_EXERCISE] 发送失败:', error)
      
      // 更新消息为错误状态
      const index = messages.value.findIndex(m => m.id === tempReplyId)
      if (index >= 0) {
        // 转换 imageData 类型
        const standardImageData = imageData && imageData.base64DataUrl ? {
          filePath: imageData.filePath || '',  // 保留原始 filePath，用于发送给后端等用途
          width: imageData.width || 0,
          height: imageData.height || 0,
          fileSize: imageData.fileSize || 0,
          base64DataUrl: imageData.base64DataUrl  // 使用 base64DataUrl 字段用于UI显示
        } : undefined
        
        messages.value[index] = {
          ...tempReply,
          content: '发送失败，请重试',
          isStreaming: false,
          isError: true,
          canRetry: true,
          originalMessage: content,
          imageData: standardImageData
        }
      }
      
      throw error
    }
  }
  
  /**
   * 重试失败的消息（AI题目场景）
   */
  const retryMessage = async (
    messageId: string,
    currentQuestion: ExerciseItem | null,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel: string = 'mate',
    imageData?: ChatImageData
  ): Promise<void> => {
    // 第1步：验证题目
    if (!currentQuestion) {
      throw new Error('请先选择一道题目')
    }
    
    // 第2步：查找消息
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index < 0) {
      throw new Error('消息不存在')
    }
    
    const message = messages.value[index]
    if (!message.canRetry || !message.originalMessage) {
      throw new Error('该消息不支持重发')
    }
    
    // 第3步：检查重试次数
    const maxRetries = 3
    const retryCount = message.retryCount || 0
    
    if (retryCount >= maxRetries) {
      throw new Error('已达到最大重试次数')
    }
    
    // 第4步：更新为重试中状态
    messages.value[index] = {
      ...message,
      content: '',
      isStreaming: true,
      isError: false,
      canRetry: false,
      retryCount: retryCount + 1
    }
    
    // 第5步：构建AI请求（使用标准构建函数）
    const aiRequest = buildAiExerciseMessage(
      message.originalMessage,
      currentQuestion,
      userInfo,
      subject,
      enableWebSearch.value,
      selectedModel,
      imageData
    )
    
    try {
      // 第6步：重新发送请求
      const response = await apiService.sendChatMessage(aiRequest)
      
      // 第7步：判断是否成功
      const isActuallySuccess = response.success && response.reply && response.reply !== '请求失败，请重试。'
      
      // 第8步：更新消息
      messages.value[index] = {
        ...message,
        content: response.reply || '请求失败，请重试。',
        timestamp: new Date().toISOString(),
        messageId: response.messageId,
        isStreaming: false,
        isError: !isActuallySuccess,
        canRetry: !isActuallySuccess && (retryCount + 1 < maxRetries),
        retryCount: !isActuallySuccess ? retryCount + 1 : undefined,
        originalMessage: !isActuallySuccess ? message.originalMessage : undefined
      }
      
      // 第9步：保存聊天历史
      await saveChatHistory(currentQuestion.id || currentQuestion.bmNo)
      
    } catch (error) {
      console.error('[AI_EXERCISE] 重试失败:', error)
      
      // 更新为重试失败状态
      messages.value[index] = {
        ...message,
        content: `重试失败 (${retryCount + 1}/${maxRetries})，请稍后重试。`,
        isError: true,
        isStreaming: false,
        canRetry: retryCount + 1 < maxRetries,
        retryCount: retryCount + 1
      }
      
      await saveChatHistory(currentQuestion.id || currentQuestion.bmNo)
      throw error
    }
  }
  
  /**
   * 保存聊天历史（AI题目场景）
   */
  const saveChatHistory = async (questionId: string): Promise<void> => {
    if (messages.value.length === 0) return
    
    const storageKey = `ai-exercise-${questionId}`
    const historyData: ChatHistoryData = {
      questionId: storageKey,
      messages: messages.value,
      chatResponseTimes: chatResponseTimes.value,
      lastUpdated: Date.now()
    }
    
    try {
      await asyncStorage.saveChatHistory(storageKey, historyData)
      console.log('[AI_EXERCISE] 🔵 保存聊天历史成功:', historyData)
    } catch (error) {
      console.error('[AI_EXERCISE] ❌ 保存聊天历史失败:', error)
    }
  }
  
  /**
   * 加载聊天历史（AI题目场景）
   */
  const loadChatHistory = async (questionId: string): Promise<void> => {
    try {
      isChatLoading.value = true
      console.log('[AI_EXERCISE] 🔵 loadChatHistory:', questionId)
      const storageKey = `ai-exercise-${questionId}`
      const historyData = await asyncStorage.loadChatHistory(storageKey)
      console.log('[AI_EXERCISE] 🔵 historyData:', historyData)
      if (historyData) {
        messages.value = historyData.messages || []
        chatResponseTimes.value = historyData.chatResponseTimes || 0
        
        // 更新是否可以查看答案（必须根据当前题目的chatResponseTimes判断）
        canViewAnswer.value = chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES
        console.log('[AI_EXERCISE] 🔵 canViewAnswer:', canViewAnswer.value)
      } else {
        // 无历史记录，清空状态
        messages.value = []
        chatResponseTimes.value = 0
        canViewAnswer.value = false
      }
    } catch (error) {
      console.error('[AI_EXERCISE] ❌ 加载聊天历史失败:', error)
      messages.value = []
      chatResponseTimes.value = 0
      canViewAnswer.value = false
    } finally {
      isChatLoading.value = false
    }
  }
  
  /**
   * 清空聊天历史（AI题目场景）
   */
  const clearChatHistory = async (questionId: string): Promise<void> => {
    try {
      const storageKey = `ai-exercise-${questionId}`
      await asyncStorage.removeChatHistory(storageKey)
      messages.value = []
      chatResponseTimes.value = 0
      canViewAnswer.value = false
    } catch (error) {
      console.error('[AI_EXERCISE] ❌ 清空聊天历史失败:', error)
      throw error
    }
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
      
      // 第3步：保存更新后的聊天历史（需要题目ID，从当前题目获取）
      const currentQuestion = questionStore.currentQuestion
      if (currentQuestion) {
        const questionId = currentQuestion.id || currentQuestion.bmNo
        await saveChatHistory(questionId)
      }
    } catch (error) {
      console.error('[AI_EXERCISE] ❌ 删除消息失败:', error)
      throw error
    }
  }
  
  /**
   * 重置状态
   */
  const resetState = (): void => {
    messages.value = []
    chatResponseTimes.value = 0
    canViewAnswer.value = false
    isChatLoading.value = false
  }
  
  // ==================== 返回接口 ====================
  
  /**
   * 切换Web搜索
   */
  const toggleWebSearch = (): void => {
    enableWebSearch.value = !enableWebSearch.value
  }
  
  return {
    // 状态
    messages,
    chatResponseTimes,
    isChatLoading,
    enableWebSearch,
    canViewAnswer,
    VIEW_ANSWER_CHAT_TIMES,
    
    // 方法
    sendMessage,
    retryMessage,
    deleteMessage,
    saveChatHistory,
    loadChatHistory,
    clearChatHistory,
    resetState,
    toggleWebSearch
  }
})

