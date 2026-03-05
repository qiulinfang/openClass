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
import { apiService } from '../services/http/api-service'
import { chatStorage, type ChatHistoryData } from '../services/storage/chat-storage'
import type { AiChatMessageRequest, ChatBubble, ExerciseItem, UserInfo, BackendHistoryMessage } from '../types'
import { createUserMessage, generateUniqueId, type ChatImageData, type ChatQuotedMessage } from './utils/chatStoreUtils'
import { alignTailMessageIdsFromHistory, buildHistorySignature } from './utils/historySyncUtils'
import { useChatPersistence } from '@/composables/useChatPersistence'
import { useChatRetry } from '@/composables/useChatRetry'
import { useChatEngine } from '@/composables/useChatEngine'
import { validateExerciseChatRequest } from './utils/requestValidator'
import { getApiPaths } from '@/config/env-config'
import { showMessage } from '../utils'
import { normalizeSubject } from '@/constants/subjects'
import { getUserId } from '../services'
import { Sender } from '@/types/enums'

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
  imageData?: ChatImageData,
  sessionId?: string | null,
): AiChatMessageRequest => {
  
  // 如果内容包含"我们开始吧"，只发送"我们开始吧"给后端
  let conversationContent = content
  if (content.includes('我们开始吧')) {
    conversationContent = '我们开始吧'
  }
  
  // 获取题目ID
  const questionId = currentQuestion.bmNo || ''
  
  // 优先使用传入的 sessionId，如果没有则新建（使用题目ID和时间戳）
  const userId = getUserId() || ''
  const finalSessionId = sessionId || `${userId ? userId + '-' : ''}exercise-${questionId}-${Date.now()}`
  
  // 如果有图片数据，使用图片接口
  if (imageData?.base64DataUrl) {
    // 处理图片格式：jpeg -> jpg
    const questionDataUrl = imageData.base64DataUrl.startsWith('data:image/jpeg;')
      ? imageData.base64DataUrl.replace('data:image/jpeg;', 'data:image/jpg;')
      : imageData.base64DataUrl
    
    const request: AiChatMessageRequest = {
      sessionId: finalSessionId,
      newValue: '1',
      coversation: conversationContent,
      question: currentQuestion.question || currentQuestion.title || '',
      answer: currentQuestion.answer || '',
      name: getUserId() || 'User',
      reason: 'start',
      bmNo: questionId, // 修复：使用题目的 bmNo 而不是 sessionId
      isWebSearch: enableWebSearch ? '1' : '0',
      role: selectedModel,
      subject: subject,
      dstUrl: '/ai/2.0/previewPictureQA',
      explanation: currentQuestion.explanation || '',
    }
    
    // 校验请求参数完整性
    validateExerciseChatRequest(request, currentQuestion.title || currentQuestion.question || '未知题目')
    
    return request
  } else {
    // 根据题目学科确定API路径，而不是全局用户学科设置
    const effectiveApiSubject = normalizeSubject((currentQuestion as any).subject)
    const apiUrl = effectiveApiSubject === 'math' ? '/ai/2.0/chatMath' : '/ai/2.0/chat'

    // 普通文本消息
    const request: AiChatMessageRequest = {
      sessionId: finalSessionId,
      newValue: '1',
      coversation: conversationContent,
      question: currentQuestion.question || currentQuestion.title || '',
      answer: currentQuestion.answer || '',
      name: getUserId() || 'User',
      reason: 'start',
      bmNo: questionId, // 修复：使用题目的 bmNo 而不是 sessionId
      isWebSearch: enableWebSearch ? '1' : '0',
      role: selectedModel,
      subject: subject,
      dstUrl: apiUrl,
      explanation: currentQuestion.explanation || '', // 添加 explanation 字段
    }
    
    // 校验请求参数完整性
    validateExerciseChatRequest(request, currentQuestion.title || currentQuestion.question || '未知题目')
    
    return request
  }
}

/**
 * 会话信息接口
 */
export interface ExerciseSession {
  id: string                    // 会话ID
  questionBmNo: string          // 关联的题目bmNo
  title: string                 // 会话标题
  messages: ChatBubble[]        // 聊天记录
  chatResponseTimes: number     // AI回复次数
  createdAt: number             // 创建时间
  updatedAt: number             // 更新时间
  // 快照信息（用于CardStack展示）
  aiMessage?: string            // AI第一条消息
  userMessage?: string          // 用户第一条消息
  lastMessage?: string          // 最后一条消息
  /**
   * 聊天记录预览（Markdown 源）
   * 存储前几条消息的原始内容，用于会话卡片中用统一的 Markdown+公式渲染
   */
  previewMessagesMarkdown?: string[]
}

export const useAiExerciseChatStore = defineStore('aiExerciseChat', () => {
  // ==================== 状态定义 ====================
  
  /** 消息列表（当前会话） */
  const messages = ref<ChatBubble[]>([])
  const lastHistorySignature = ref<string>('')
  
  /** 当前会话ID */
  const currentSessionId = ref<string | null>(null)
  
  /** 当前题目的所有会话列表 */
  const sessions = ref<ExerciseSession[]>([])
  
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

  const chatPersistence = useChatPersistence<ChatHistoryData>(
    {
      save: async (key: string, payload: ChatHistoryData) => {
        await chatStorage.saveChatHistory(key, payload)
      },
      load: async (key: string) => {
        return await chatStorage.loadChatHistory(key)
      },
    },
    {
      debounceMs: 0,
    },
  )

  const retryHelper = useChatRetry({ maxRetries: 3 })

  const chatEngine = useChatEngine({
    messagesRef: messages,
    lastHistorySignatureRef: lastHistorySignature,
  })

  /**
   * 将后端 history_messages（最新快照，最多20条）映射为前端 ChatBubble[]
   * 约定：
   * - history_messages 为当前会话的快照（后端只返回最新20条）
   * - human -> user，ai -> ai
   * - id 同时作为 ChatBubble.id 和 ChatBubble.messageId
   * - 尽量保留前端独有字段（quotedMessage、imageData 等）
   */
  const mapHistoryToChatBubbles = (history: BackendHistoryMessage[]): ChatBubble[] => {
    const oldMessagesMap = new Map<string, ChatBubble>()
    for (const msg of messages.value) {
      const key = msg.messageId || msg.id
      if (key) oldMessagesMap.set(key, msg)
    }

    return history.map((m) => {
      const sender: 'user' | 'ai' = m.type === 'human' ? 'user' : 'ai'
      const oldMsg = oldMessagesMap.get(m.id)

      const roleFromHistory = (m as any)?.additional_kwargs?.role as string | undefined
      return {
        id: m.id,
        messageId: m.id,
        content: oldMsg?.content,
        sender,
        type: sender,
        timestamp: oldMsg?.timestamp || new Date().toISOString(),
        messageType: oldMsg?.messageType || 'text',
        isStreaming: false,
        quotedMessage: oldMsg?.quotedMessage,
        imageData: oldMsg?.imageData,
        originalMessage: oldMsg?.originalMessage,
        canRetry: oldMsg?.canRetry,
        selectedModel: sender === 'ai' ? (roleFromHistory || oldMsg?.selectedModel || 'mate') : undefined,
        originalDstUrl: oldMsg?.originalDstUrl,
      } as ChatBubble
    })
  }
  
  // ==================== 公开方法 ====================
  
  /**
   * 发送聊天消息（AI题目场景）
   *
   * 验证题目
   * 新建会话ID（如需要）
   * 构建并验证AI请求参数
   * 创建用户消息
   * 创建临时AI回复
   * 发送请求
   * 更新消息
   * 保存历史
   */
  const sendMessage = async (
    content: string,
    currentQuestion: ExerciseItem | null,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel: string = 'mate',
    imageData?: ChatImageData,
    hidePrefix: boolean = false,
    skipUserMessage?: boolean,
    quotedMessage?: ChatQuotedMessage,
  ): Promise<void> => {
    // 验证题目
    if (!currentQuestion) {
      throw new Error('请先选择一道题目')
    }
    
    // 如果没有 sessionId，则新建（基于题目bmNo）
    if (!currentSessionId.value) {
      const questionBmNo = currentQuestion.bmNo || ''
      const userId = getUserId() || ''
      const newSessionId = `${userId ? userId + '-' : ''}exercise-${questionBmNo}-${Date.now()}`
      currentSessionId.value = newSessionId
    }

    // 构建AI请求并验证参数完整性（在插入占位消息前进行校验）
    let aiRequest: AiChatMessageRequest
    try {
      aiRequest = buildAiExerciseMessage(
        content,
        currentQuestion,
        userInfo,
        subject,
        enableWebSearch.value,
        selectedModel,
        imageData,
        currentSessionId.value,
      )
    } catch (error) {
      // 验证失败时显示友好的错误提示
      const errorMessage = error instanceof Error ? error.message : '参数验证失败'
      showMessage(errorMessage, 'warning')
      throw error // 重新抛出错误，让上层处理
    }

    // 创建用户消息（可选）
    // 自动检测并去除"我们开始吧"前缀（如果未显式设置 shouldHidePrefix）
    const shouldHidePrefixFlag = hidePrefix || content.includes('我们开始吧')
    if (!skipUserMessage) {
      const userMessage = createUserMessage(
        content,
        imageData,
        shouldHidePrefixFlag,
        currentSessionId.value || undefined,
        quotedMessage,
      )
      messages.value.push(userMessage)
    }

    // 创建临时AI回复（使用工具函数）
    const tempReplyId = generateUniqueId('temp_ai')
    const tempReply: ChatBubble = {
      id: tempReplyId,
      content: '',
      type: Sender.AI,
      timestamp: new Date().toISOString(),
      sender: Sender.AI,
      // 题目聊天场景不需要骨架屏，这里不标记为流式中，避免触发 StreamingMessage 的 skeleton-card
      isStreaming: false,
      selectedModel: selectedModel || 'mate' // 保存当前模式
    }
    messages.value.push(tempReply)
    
    try {
      // 发送请求（带流式回调）
      const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)

      const wrappedOnStream = (chunk: string, isComplete: boolean) => {
        if (isComplete) {
          onStream?.(chunk, isComplete)
          return
        }

        // drawing 控制帧：chunk 为空字符串，仅标记流式中以展示骨架
        if (!chunk) {
          const index = messages.value.findIndex((m) => m.id === tempReplyId)
          if (index >= 0) {
            messages.value[index] = {
              ...messages.value[index],
              isStreaming: true,
            }
          }
          return
        }

        onStream?.(chunk, isComplete)
      }

      const response = await apiService.sendChatMessage(aiRequest, onComplete, wrappedOnStream, onHistoryUpdate)

      // 更新回复次数
      chatResponseTimes.value++

      // 检查是否可以查看答案
      if (chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES) {
        canViewAnswer.value = true
      }

      // 保存聊天历史（统一使用 bmNo 作为存储键）
      const questionBmNo = currentQuestion.bmNo
      if (questionBmNo) {
        await saveChatHistory(questionBmNo)
        // 同时保存当前会话到会话列表
        await saveCurrentSession(questionBmNo)
      }
      
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
    imageData?: ChatImageData,
    quotedMessage?: ChatQuotedMessage,
  ): Promise<void> => {
    // 验证题目
    if (!currentQuestion) {
      throw new Error('请先选择一道题目')
    }
    
    const { index, message, retryCount, originalContent } = retryHelper.prepareRetryInfo(messages, messageId)
    const maxRetries = retryHelper.maxRetries
    
    // 更新为重试中状态
    messages.value[index] = {
      ...message,
      content: '',
      isStreaming: true,
      isError: false,
      canRetry: false,
      retryCount: retryCount + 1,
      selectedModel: selectedModel || message.selectedModel || 'mate' // 保留模式信息
    }
    
    // 构建AI请求（使用标准构建函数，传入当前会话的 sessionId）
    let aiRequest: AiChatMessageRequest
    try {
      aiRequest = buildAiExerciseMessage(
        originalContent,
        currentQuestion,
        userInfo,
        subject,
        enableWebSearch.value,
        selectedModel,
        imageData,
        currentSessionId.value,
      )
    } catch (error) {
      // 验证失败时显示友好的错误提示
      const errorMessage = error instanceof Error ? error.message : '参数验证失败'
      showMessage(errorMessage, 'warning')
      throw error // 重新抛出错误，让上层处理
    }
    
    try {
      // 重新发送请求（带流式回调）
      let accumulatedContent = ''
      const response = await apiService.sendChatMessage(
        aiRequest,
        (finalResponse) => {
          const isActuallySuccess =
            finalResponse.success &&
            finalResponse.reply &&
            finalResponse.reply !== '请求失败，请重试。'

          messages.value[index] = {
            ...message,
            content: finalResponse.reply || accumulatedContent || '请求失败，请重试。',
            timestamp: new Date().toISOString(),
            messageId: finalResponse.messageId,
            isStreaming: false,
            isError: !isActuallySuccess,
            canRetry: !isActuallySuccess && retryCount + 1 < maxRetries,
            retryCount: !isActuallySuccess ? retryCount + 1 : undefined,
            originalMessage: !isActuallySuccess ? message.originalMessage : undefined,
            selectedModel: selectedModel || message.selectedModel || 'mate', // 保留模式信息
          }
        },
        (chunk: string, isComplete: boolean) => {
          if (isComplete) {
            messages.value[index] = {
              ...messages.value[index],
              isStreaming: false,
            }
          } else {
            accumulatedContent += chunk
            messages.value[index] = {
              ...messages.value[index],
              content: accumulatedContent,
              isStreaming: true,
            }
          }
        },
      )
      
      // 保存聊天历史（统一使用 bmNo 作为存储键）
      const questionBmNo = currentQuestion.bmNo
      if (questionBmNo) {
        await saveChatHistory(questionBmNo)
      }
      
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
      
      // 保存聊天历史（统一使用 bmNo 作为存储键）
      const questionBmNo = currentQuestion.bmNo
      if (questionBmNo) {
        await saveChatHistory(questionBmNo)
      }
      throw error
    }
  }
  
  /**
   * 保存聊天历史（AI题目场景）
   */
  // 约定：此处 questionBmNo 始终使用题目的 bmNo，
  // 实际存储键为：ai-exercise-${questionBmNo}-${currentSessionId}
  const saveChatHistory = async (questionBmNo: string): Promise<void> => {
    if (!currentSessionId.value || messages.value.length === 0) return
    
    const storageKey = `ai-exercise-${questionBmNo}-${currentSessionId.value}`
    const historyData: ChatHistoryData = {
      questionId: storageKey,
      messages: messages.value,
      chatResponseTimes: chatResponseTimes.value,
      lastUpdated: Date.now()
    }
    
    try {
      await chatPersistence.save(storageKey, historyData)
    } catch (error) {
      console.error('[AI_EXERCISE] ❌ 保存聊天历史失败:', error)
    }
  }
  
  /**
   * 加载聊天历史（AI题目场景）
   */
  // 约定：此处 questionBmNo 始终为题目的 bmNo
  const loadChatHistory = async (questionBmNo: string): Promise<void> => {
    try {
      isChatLoading.value = true
      
      // 关键：切换题目时，先清空上一题的 currentSessionId，避免把上一题的会话 ID 带到新题目
      // 这样在后续 switchToSession 保存"当前会话"时，不会误用上一题的 sessionId
      currentSessionId.value = null
      
      // 同时加载会话列表
      await loadSessionsList(questionBmNo)
      
      // 如果还没有任何会话，尝试从旧格式的聊天历史中迁移数据
      if (sessions.value.length === 0) {
        const legacyKey = `ai-exercise-${questionBmNo}`
        try {
          const legacyData = await chatPersistence.load(legacyKey)
          if (legacyData && Array.isArray(legacyData.messages) && legacyData.messages.length > 0) {
            
            // 创建一个默认会话 ID
            const userId = getUserId() || ''
            const newSessionId = `${userId ? userId + '-' : ''}exercise-${questionBmNo}-${Date.now()}`
            currentSessionId.value = newSessionId
            messages.value = legacyData.messages || []
            chatResponseTimes.value = legacyData.chatResponseTimes || 0
            canViewAnswer.value = chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES
            
            // 保存为当前会话：这一步会
            // 1）写入会话快照到 ai_exercise_sessions
            // 2）按新 key 写入完整聊天历史：ai-exercise-${questionBmNo}-${newSessionId}
            await saveCurrentSession(questionBmNo)
            
            // 删除旧的聊天历史 key，避免重复
            await chatStorage.removeChatHistory(legacyKey)
          }
        } catch (migrateError) {
          console.error('[AI_EXERCISE] ❌ 旧格式聊天历史迁移失败:', migrateError)
        }
      }
      
      // 尝试恢复最近活跃的会话（包括可能刚迁移生成的会话）
      if (sessions.value.length > 0) {
        // 选择最近更新的会话
        const recentSession = sessions.value.reduce((prev, current) => 
          (prev.updatedAt > current.updatedAt) ? prev : current
        )
        
        // 切换到该会话
        await switchToSession(recentSession.id)
      } else {
        // 仍然没有任何会话，清空状态并准备创建新会话
        messages.value = []
        chatResponseTimes.value = 0
        canViewAnswer.value = false
        currentSessionId.value = null
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
  // 约定：此处 questionBmNo 始终为题目的 bmNo
  const clearChatHistory = async (questionBmNo: string): Promise<void> => {
    try {
      const storageKey = `ai-exercise-${questionBmNo}`
      await chatStorage.removeChatHistory(storageKey)
      messages.value = []
      chatResponseTimes.value = 0
      currentSessionId.value = null
      canViewAnswer.value = false
    } catch (error) {
      console.error('[AI_EXERCISE] ❌ 清空聊天历史失败:', error)
      throw error
    }
  }
  
  /**
   * 删除消息及其之后的所有消息（AI题目场景）
   *
   * 规则：
   * - 如果选中的是 user 消息：删除该 user 及其之后的所有消息
   * - 如果选中的是 ai 消息：向前找到最近一条 user 消息，从这条 user 开始删除直到最后
   * 前端本地与后端 manageConversationMemory(delete_messages) 同步
   */
  /**
   * @param messageId 要删除的消息ID
   * @param questionBmNo 当前题目的bmNo（由调用方从 questionStore 或 homeworkStore 传入）
   */
  const deleteMessage = async (messageId: string, questionBmNo?: string): Promise<void> => {
    try {
      // 查找被点击消息在列表中的索引
      const index = messages.value.findIndex(m => m.id === messageId)
      if (index < 0) {
        throw new Error('消息不存在')
      }

      // 确定删除起点索引
      let startIndex = index
      const target = messages.value[index]

      if (target.sender === 'ai') {
        // 向前查找最近一条 user 消息
        for (let i = index - 1; i >= 0; i--) {
          if (messages.value[i].sender === 'user') {
            startIndex = i
            break
          }
        }
      }

      // 确定用于后端 delete_messages 的起始 message_id
      // 优先使用起点消息的 backend messageId；如果没有，则向后找第一条带 messageId 的消息
      let startBackendMessageId: string | undefined = messages.value[startIndex]?.messageId
      if (!startBackendMessageId) {
        for (let i = startIndex; i < messages.value.length; i++) {
          if (messages.value[i].messageId) {
            startBackendMessageId = messages.value[i].messageId
            break
          }
        }
      }

      // 先更新本地消息列表（从起点到末尾全部删除）
      messages.value.splice(startIndex)

      // 保存更新后的聊天历史（questionBmNo 由调用方传入）
      if (questionBmNo) {
        await saveChatHistory(questionBmNo)
      }

      // 调用后端 manageConversationMemory，同步删除对应线程的后续历史
      if (currentSessionId.value && startBackendMessageId) {
        try {
          await apiService.manageConversationMemory({
            command: 'delete_messages',
            thread_id: currentSessionId.value,
            message_id: startBackendMessageId,
            agent_name: 'solvingbot',
          })
        } catch (error) {
          console.warn('[AI_EXERCISE] 删除消息时同步后端记忆失败:', error)
        }
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
    currentSessionId.value = null
  }
  
  // ==================== 多会话管理 ====================
  
  /**
   * 从消息列表中提取快照信息
   */
  const extractSnapshotFromMessages = (
    msgs: ChatBubble[]
  ): { aiMessage?: string; userMessage?: string; lastMessage?: string; previewMessagesMarkdown: string[] } => {
    const aiMessages = msgs.filter(m => m.type === 'ai' && m.content)
    const userMessages = msgs.filter(m => m.type === 'user' && m.content)
    const MAX_PREVIEW = 5
    const previewMessagesMarkdown = msgs
      .slice(0, MAX_PREVIEW)
      .map(m => (typeof m.content === 'string' ? m.content : String(m.content || '')))
    
    return {
      aiMessage: aiMessages[0]?.content?.substring(0, 100),
      userMessage: userMessages[0]?.content?.substring(0, 100),
      lastMessage: msgs[msgs.length - 1]?.content?.substring(0, 100),
      previewMessagesMarkdown,
    }
  }
  
  /**
   * 保存当前会话到会话列表
   */
  const saveCurrentSession = async (questionBmNo: string): Promise<void> => {
    if (!currentSessionId.value || messages.value.length === 0) return
    
    const snapshot = extractSnapshotFromMessages(messages.value)
    const now = Date.now()
    
    // 查找是否已存在该会话
    const existingIndex = sessions.value.findIndex(s => s.id === currentSessionId.value)
    
    // 完整会话数据（用于内存）
    const sessionData: ExerciseSession = {
      id: currentSessionId.value,
      questionBmNo,
      title: `会话 ${existingIndex >= 0 ? existingIndex + 1 : sessions.value.length + 1}`,
      messages: [...messages.value],
      chatResponseTimes: chatResponseTimes.value,
      createdAt: existingIndex >= 0 ? sessions.value[existingIndex].createdAt : now,
      updatedAt: now,
      ...snapshot,
    }
    
    if (existingIndex >= 0) {
      sessions.value[existingIndex] = sessionData
    } else {
      sessions.value.push(sessionData)
    }
    
    // 持久化：只存储元数据（不含完整消息）
    await saveSessionsList(questionBmNo)
    
    // 单独存储当前会话的消息（使用 chatStorage）
    await saveChatHistory(questionBmNo)
  }
  
  /**
   * 保存会话列表到存储（使用 IndexedDB，只存储元数据）
   */
  const saveSessionsList = async (questionBmNo: string): Promise<void> => {
    try {
      // 只保存元数据，不保存完整消息
      const metaList = sessions.value.map(s => ({
        id: s.id,
        questionBmNo: s.questionBmNo,
        title: s.title,
        chatResponseTimes: s.chatResponseTimes,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
        aiMessage: s.aiMessage,
        userMessage: s.userMessage,
        lastMessage: s.lastMessage,
        previewMessagesMarkdown: s.previewMessagesMarkdown,
      }))
      
      await chatStorage.saveSessionsList(questionBmNo, metaList)
    } catch (error) {
      console.error('[AI_EXERCISE] 保存会话列表失败:', error)
    }
  }
  
  /**
   * 加载题目的所有会话列表（使用 IndexedDB，只加载元数据）
   */
  const loadSessionsList = async (questionBmNo: string): Promise<void> => {
    try {
      const metaList = await chatStorage.loadSessionsList(questionBmNo)
      // 保险：只保留 questionBmNo 与当前题目一致的会话，防止历史 bug 把其它题的会话写进来
      const filteredMetaList = metaList.filter(meta => meta.questionBmNo === questionBmNo)

      if (filteredMetaList.length > 0) {
        // 将元数据转换为完整会话结构（messages 为空，需要时再加载）
        sessions.value = filteredMetaList.map(meta => ({
          ...meta,
          messages: [], // 消息按需加载
          previewMessagesMarkdown: meta.previewMessagesMarkdown || [],
        }))
      } else {
        sessions.value = []
      }
    } catch (error) {
      console.error('[AI_EXERCISE] 加载会话列表失败:', error)
      sessions.value = []
    }
  }
  
  /**
   * 切换到指定会话
   */
  const switchToSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.find(s => s.id === sessionId)
    if (!session) {
      console.error('[AI_EXERCISE] 会话不存在:', sessionId)
      return
    }
    
    // 切换前保存当前会话（包含完整消息和会话快照）
    if (currentSessionId.value && messages.value.length > 0) {
      // 注意：这里要用“当前会话”所属题目的 questionBmNo，而不是目标会话的
      const prevSession = sessions.value.find(s => s.id === currentSessionId.value)
      if (prevSession) {
        await saveCurrentSession(prevSession.questionBmNo)
      }
    }
    
    // 加载目标会话的完整聊天历史
    const storageKey = `ai-exercise-${session.questionBmNo}-${session.id}`
    try {
      const historyData = await chatStorage.loadChatHistory(storageKey)
      if (historyData) {
        messages.value = historyData.messages || []
        chatResponseTimes.value = historyData.chatResponseTimes || 0
      } else {
        messages.value = []
        chatResponseTimes.value = 0
      }
    } catch (error) {
      console.error('[AI_EXERCISE] ❌ 加载会话聊天历史失败:', error)
      messages.value = []
      chatResponseTimes.value = 0
    }
    
    currentSessionId.value = session.id
    canViewAnswer.value = chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES
  }
  
  /**
   * 创建新会话
   */
  const createNewSession = async (questionBmNo: string): Promise<string> => {
    // 保存当前会话
    if (currentSessionId.value && messages.value.length > 0) {
      await saveCurrentSession(questionBmNo)
    }
    
    // 创建新会话ID
    const userId = getUserId() || ''
    const newSessionId = `${userId ? userId + '-' : ''}exercise-${questionBmNo}-${Date.now()}`
    currentSessionId.value = newSessionId
    messages.value = []
    chatResponseTimes.value = 0
    canViewAnswer.value = false
    
    return newSessionId
  }
  
  /**
   * 删除会话
   */
  const deleteSession = async (sessionId: string, questionBmNo: string): Promise<void> => {
    // 保险：只删除 questionBmNo 与当前题目一致的会话
    const index = sessions.value.findIndex(s => s.id === sessionId && s.questionBmNo === questionBmNo)
    if (index < 0) return
    
    sessions.value.splice(index, 1)
    
    // 删除后按题目维度重新编号会话标题，保证序号连续
    const sameQuestionSessions = sessions.value.filter(s => s.questionBmNo === questionBmNo)
    sameQuestionSessions.forEach((session, idx) => {
      session.title = `会话 ${idx + 1}`
    })
    
    // 如果删除的是当前会话，切换到第一个会话或清空
    if (currentSessionId.value === sessionId) {
      if (sessions.value.length > 0) {
        await switchToSession(sessions.value[0].id)
      } else {
        currentSessionId.value = null
        messages.value = []
        chatResponseTimes.value = 0
        canViewAnswer.value = false
      }
    }
    
    // 同步删除后端记忆（solvingbot）
    try {
      await apiService.manageConversationMemory({
        command: 'delete_thread',
        thread_id: sessionId,
        agent_name: 'solvingbot',
      })
    } catch (error) {
      console.warn('[AI_EXERCISE] 删除会话时同步后端记忆失败:', error)
    }

    // 删除本地存储中的该会话聊天历史
    try {
      const storageKey = `ai-exercise-${questionBmNo}-${sessionId}`
      await chatStorage.removeChatHistory(storageKey)
    } catch (error) {
      console.warn('[AI_EXERCISE] 删除会话时清理本地历史失败:', error)
    }

    await saveSessionsList(questionBmNo)
  }
  
  /**
   * 获取用于 CardStack 展示的会话卡片数据
   */
  const getSessionCards = () => {
    return sessions.value.map((session, index) => ({
      id: session.id,
      title: session.title || `会话 ${index + 1}`,
      aiMessage: session.aiMessage,
      userMessage: session.userMessage,
      lastMessage: session.lastMessage,
      updateTime: new Date(session.updatedAt).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      messageCount: session.messages.length,
      previewMessagesMarkdown: session.previewMessagesMarkdown || [],
    }))
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
    currentSessionId,
    sessions,
    
    // 方法
    sendMessage,
    retryMessage,
    deleteMessage,
    saveChatHistory,
    loadChatHistory,
    clearChatHistory,
    resetState,
    toggleWebSearch,
    
    // 多会话管理
    saveCurrentSession,
    loadSessionsList,
    switchToSession,
    createNewSession,
    deleteSession,
    getSessionCards,
  }
})

