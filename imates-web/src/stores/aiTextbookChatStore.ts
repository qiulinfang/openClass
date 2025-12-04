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
import type { AiChatMessageRequest, ChatBubble, UserInfo, QuotedMessageInfo, BackendHistoryMessage, AttachedScreenshot } from '../types'

interface TextbookChatImageData {
  base64DataUrl: string
}

// 截图的 DrawingBoard 状态（用于保存/恢复绘图）
export interface ScreenshotDrawingState {
  objects: unknown
  history: unknown
  historyIndex: number
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
  focus?: QuotedMessageInfo[] // 引用的消息列表
  imageList?: TextbookChatImageData[] // 多图数据列表（用于截图多图场景）
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
  imageList,
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
      imageList, // 多图数据
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
    imageList,
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
  const backendSessionId = ref<string | null>(null) // 后端会话ID，用于发送消息时的sessionId字段
  const aiGeneralStore = useAiGeneralChatStore() // 引用 ai-general 场景，用于获取根会话ID
  // 当前挂在 AI 教材聊天输入框上的截图列表（PDF 场景）
  const attachedScreenshots = ref<AttachedScreenshot[]>([])

  // 每张截图的 DrawingBoard 状态（按截图 id 索引）
  const screenshotDrawingStates = ref<Record<string, ScreenshotDrawingState>>({})
  
  const VIEW_ANSWER_CHAT_TIMES = 3
  const canViewAnswer = computed(() => chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES)
  
  // ==================== 消息管理 ====================
  
  /**
   * 将后端 history_messages 映射为教材场景下的 ChatBubble 列表
   * 约定：
   * - history_messages 为当前会话的全量快照
   * - human -> user，ai -> ai
   * - id 同时作为 ChatBubble.id 和 ChatBubble.messageId
   * - 根据 agentStatus 标记最后一条 ai 消息的 isStreaming
   * - 保留前端独有字段（quotedMessage、imageData 等），后端不存储这些
   */
  const mapHistoryToChatBubbles = (
    history: BackendHistoryMessage[],
    agentStatus?: string,
  ): ChatBubble[] => {
    // 构建旧消息的 id -> ChatBubble 映射，用于保留前端独有字段
    const oldMessagesMap = new Map<string, ChatBubble>()
    for (const msg of messages.value) {
      if (msg.id) {
        oldMessagesMap.set(msg.id, msg)
      }
    }

    const result: ChatBubble[] = history.map((m) => {
      const sender: 'user' | 'ai' = m.type === 'human' ? 'user' : 'ai'

      // 从旧消息中查找，保留前端独有字段
      const oldMsg = oldMessagesMap.get(m.id)

      const bubble: ChatBubble = {
        id: m.id,
        messageId: m.id,
        content: m.content || '',
        sender,
        type: sender,
        timestamp: oldMsg?.timestamp || new Date().toISOString(),
        messageType: oldMsg?.messageType || 'text',
        isStreaming: false,
        // 保留前端独有字段（后端不存储）
        quotedMessage: oldMsg?.quotedMessage,
        imageData: oldMsg?.imageData,
        originalMessage: oldMsg?.originalMessage,
        canRetry: oldMsg?.canRetry,
      }

      return bubble
    })

    return result
  }
  
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
    console.log('[AI_TEXTBOOK] 清空消息，重置 currentSessionId 和 backendSessionId')
    currentSessionId.value = null
    backendSessionId.value = null  // 同时重置后端会话ID
    isNewSession.value = true
  }

  // ========== 截图挂载管理（PDF 场景用） ==========

  const setAttachedScreenshots = (shots: AttachedScreenshot[]): void => {
    attachedScreenshots.value = shots
  }

  const appendAttachedScreenshots = (shots: AttachedScreenshot[]): void => {
    if (!shots || shots.length === 0) return
    attachedScreenshots.value = attachedScreenshots.value.concat(shots)
  }

  const removeAttachedScreenshot = (id: string): void => {
    attachedScreenshots.value = attachedScreenshots.value.filter((shot) => shot.id !== id)
  }

  const clearAttachedScreenshots = (): void => {
    attachedScreenshots.value = []
  }

  const setScreenshotDrawingStates = (states: Record<string, ScreenshotDrawingState>): void => {
    screenshotDrawingStates.value = {
      ...screenshotDrawingStates.value,
      ...states,
    }
  }

  const removeScreenshotDrawingState = (id: string): void => {
    const copy = { ...screenshotDrawingStates.value }
    delete copy[id]
    screenshotDrawingStates.value = copy
  }

  const clearScreenshotDrawingStates = (): void => {
    screenshotDrawingStates.value = {}
  }
  
  /**
   * 删除消息及其之后的所有消息（AI教材场景）
   *
   * 规则与通用/解题一致：
   * - 选中 user：删该 user 及其之后所有消息
   * - 选中 ai：向前找到最近 user，从那条 user 起删到结尾
   * 后端使用 backendSessionId 作为 thread_id，agent_name = chatbot
   */
  const deleteMessage = async (messageId: string): Promise<void> => {
    try {
      // 第1步：查找被点击消息在列表中的索引
      const index = messages.value.findIndex(m => m.id === messageId)
      if (index < 0) {
        throw new Error('消息不存在')
      }

      // 第2步：确定删除起点索引
      let startIndex = index
      const target = messages.value[index]

      if (target.sender === 'ai') {
        for (let i = index - 1; i >= 0; i--) {
          if (messages.value[i].sender === 'user') {
            startIndex = i
            break
          }
        }
      }

      // 第3步：确定用于后端 delete_messages 的起始 message_id
      let startBackendMessageId: string | undefined = messages.value[startIndex]?.messageId
      if (!startBackendMessageId) {
        for (let i = startIndex; i < messages.value.length; i++) {
          if (messages.value[i].messageId) {
            startBackendMessageId = messages.value[i].messageId
            break
          }
        }
      }

      // 第4步：本地删除：从起点到末尾
      messages.value.splice(startIndex)

      // 第5步：保存更新后的聊天历史
      if (resourceId.value) {
        await saveChatHistory()
      }

      // 第6步：调用后端 manageConversationMemory（教材场景仍归 chatbot）
      if (backendSessionId.value && startBackendMessageId) {
        try {
          await apiService.manageConversationMemory({
            command: 'delete_messages',
            thread_id: backendSessionId.value,
            message_id: startBackendMessageId,
            agent_name: 'chatbot',
          })
        } catch (error) {
          console.warn('[AI_TEXTBOOK] 删除消息时同步后端记忆失败:', error)
        }
      }
    } catch (error) {
      console.error('[AI_TEXTBOOK] ❌ 删除消息失败:', error)
      throw error
    }
  }
  
  // ==================== 发送消息 ====================
  /**
   * 确保存在一个可用的后端会话ID
   * 优先级：
   * 1. 使用 aiGeneral 顶部会话ID
   * 2. 使用已维护的 backendSessionId
   * 3. 创建新的会话ID并保存到 backendSessionId
   */
  const ensureTopGeneralSession = async () => {
    // 1. 优先使用 ai-general 顶部会话ID
    if (aiGeneralStore.sessions.length > 0) {
      const topSession = aiGeneralStore.sessions[0]
      console.log('[AI_TEXTBOOK] 使用 ai-general 顶部会话ID:', topSession.sessionId)
      // 同步更新 backendSessionId
      backendSessionId.value = topSession.sessionId
      return topSession.sessionId
    }

    // 2. 如果没有 sessions，但有 backendSessionId，使用它
    if (backendSessionId.value) {
      console.log('[AI_TEXTBOOK] 使用已维护的 backendSessionId:', backendSessionId.value)
      return backendSessionId.value
    }

    // 3. 都没有，创建新的会话ID并保存
    const userId = localStorage.getItem('userId') || ''
    const newSessionId = `${userId ? userId + '-' : ''}textbook-session-${Date.now()}`
    console.log('[AI_TEXTBOOK] 创建新 backendSessionId:', newSessionId)
    backendSessionId.value = newSessionId
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
    focus?: QuotedMessageInfo[], // 引用的消息列表（发送给后端）
    quotedMessage?: { id: string; content: string; sender: 'user' | 'ai' | 'teacher' }, // 引用消息信息（用于消息气泡展示）
    imageList?: ChatImageData[], // 多图数据列表（用于截图多图场景）
  ): Promise<void> => {
    // 第1步：创建并添加用户消息（可选）
    if (!skipUserMessage) {
      // 如果有多张图片，则创建 multi_image 类型的消息气泡
      if (imageList && imageList.length > 1) {
        const standardImageList = imageList
          .filter((img) => !!img.base64DataUrl)
          .map((img) => ({
            filePath: img.filePath || '',
            width: img.width || 0,
            height: img.height || 0,
            fileSize: img.fileSize || 0,
            base64DataUrl: img.base64DataUrl,
            isLargeImage: img.isLargeImage || false,
          }))

        const now = Date.now()
        
        // 第一条消息：只包含图片，不包含文字
        const imageMessage: ChatBubble = {
          id: now.toString(),
          content: '', // 图片消息不包含文字
          type: 'user',
          timestamp: new Date().toISOString(),
          sender: 'user',
          messageType: 'multi_image',
          imageList: standardImageList,
          sessionId: currentSessionId.value || undefined,
          quotedMessage, // 引用消息信息（前端展示用）
        }
        addMessage(imageMessage)

        // 第二条消息：只包含文字（如果有文字内容）
        if (content && content.trim()) {
          const textMessage: ChatBubble = {
            id: (now + 1).toString(), // 确保 id 不重复
            content,
            type: 'user',
            timestamp: new Date().toISOString(),
            sender: 'user',
            messageType: 'text',
            sessionId: currentSessionId.value || undefined,
          }
          addMessage(textMessage)
        }
      } else {
        // 单图或纯文本，沿用原有逻辑
        const userMessage = createUserMessage(
          content,
          imageData,
          hidePrefix,
          currentSessionId.value || undefined,
          quotedMessage, // 传递引用消息信息（前端展示用）
        )
        addMessage(userMessage)
      }

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
      
      // ========= 获取后端使用的根会话ID（来自 ai-general 的第一个会话或已维护的 backendSessionId） =========
      const sessionIdForBackend = await ensureTopGeneralSession()
      console.log('[AI_TEXTBOOK] 使用后端会话ID:', sessionIdForBackend)
      
      // 第5步：构建AI消息请求（传入科目以确定dstUrl）
      // 将 chatStoreUtils.ChatImageData 转换为构建请求所需的精简图片数据
      const builderImageData = imageData?.base64DataUrl
        ? { base64DataUrl: imageData.base64DataUrl }
        : undefined

      const builderImageList = imageList && imageList.length > 0
        ? imageList
            .filter((img) => !!img.base64DataUrl)
            .map((img) => ({ base64DataUrl: img.base64DataUrl }))
        : undefined

      // 如果有图片数据且没有设置 sessionId，强制创建新会话（每次截图都创建新会话）
      // 注意：如果 currentSessionId 已经存在（比如从外部设置），则不覆盖它
      if (builderImageData && !currentSessionId.value) {
        const userId = localStorage.getItem('userId') || ''
        const newSessionId = `${userId ? userId + '-' : ''}textbook-session-${Date.now()}`
        console.log('[AI_TEXTBOOK] 创建新会话（有图片数据）', { sessionId: newSessionId })
        currentSessionId.value = newSessionId
        isNewSession.value = true
      } else if (!currentSessionId.value) {
        const userId = localStorage.getItem('userId') || ''
        const newSessionId = `${userId ? userId + '-' : ''}textbook-session-${Date.now()}`
        console.log('[AI_TEXTBOOK] 创建新会话（无图片数据）', { sessionId: newSessionId })
        currentSessionId.value = newSessionId
        isNewSession.value = true
      }
      const shouldUseScreenshotApi = !!builderImageData

      const aiMessage = buildAiTextbookMessage({
        sessionId: sessionIdForBackend,
        content,
        userInfo: userInfo,
        enableWebSearch: enableWebSearch.value,
        chatRole: selectedModel || 'mate',
        imageData: builderImageData,
        useScreenshotApi: shouldUseScreenshotApi,
        isNewSession: isNewSession.value,
        focus, // 传递引用内容
        imageList: builderImageList,
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
        },
        // onHistoryUpdate: 基于后端全量快照同步历史
        (history: BackendHistoryMessage[], agentStatus?: string) => {
          if (!history || history.length === 0) return
          messages.value = mapHistoryToChatBubbles(history, agentStatus)
          // 同步保存历史，确保刷新后与后端一致
          saveChatHistory().catch((error) => {
            console.warn('[AI_TEXTBOOK] 同步 history_messages 保存本地历史失败:', error)
          })
        },
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
   * 第3步：删除失败的消息（本地+后端同步）
   * 第4步：重新发送消息（复用 sendMessage 逻辑）
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
    
    // 第3步：保存原始内容，用于重新发送
    const originalContent = message.originalMessage
    const originalQuotedMessage = message.quotedMessage
    const originalImageData = message.imageData || imageData
    
    if (!originalContent) {
      showMessage('原始消息内容不存在', 'error')
      return
    }
    
    // 第4步：删除失败的消息（本地+后端同步）
    try {
      await deleteMessage(messageId)
    } catch (deleteError) {
      console.warn('[AI_TEXTBOOK] retryAiMessage.deleteFailed, 继续重试', deleteError)
      // 删除失败不阻塞重试，继续发送
    }
    
    // 第5步：重新发送消息（复用 sendMessage 逻辑）
    try {
      await sendMessage(
        originalContent,
        chatRole,
        originalImageData,
        false, // hidePrefix
        false, // skipUserMessage: false，重新创建用户消息
        undefined, // focus: 暂不传递
        originalQuotedMessage, // 保留原始引用信息用于 UI 展示
      )
    } catch (sendError) {
      console.error('[AI_TEXTBOOK] retryAiMessage.sendFailed', sendError)
      throw sendError
    }
  }
  
  // ==================== 聊天历史 ====================
  
  /**
   * 设置资源ID
   * 注意：只有在 resourceId 真正变化时才重置 currentSessionId 和 backendSessionId
   * 如果 resourceId 没有变化，保留当前的 currentSessionId（比如从 loadChatHistory 设置的）
   */
  const setResourceId = (id: string): void => {
    const resourceIdChanged = resourceId.value !== id
    const oldResourceId = resourceId.value
    resourceId.value = id
    // 只有在 resourceId 真正变化时才重置 currentSessionId 和 backendSessionId
    if (resourceIdChanged) {
      console.log('[AI_TEXTBOOK] resourceId 变化，重置 currentSessionId 和 backendSessionId', { oldResourceId, newResourceId: id })
      currentSessionId.value = null
      backendSessionId.value = null  // 同时重置后端会话ID
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
    attachedScreenshots,
    screenshotDrawingStates,
    resourceId,
    useScreenshotApi,
    currentSessionId,
    isNewSession,
    backendSessionId,
    
    // 方法
    addMessage,
    updateMessage,
    clearMessages,
    setAttachedScreenshots,
    appendAttachedScreenshots,
    removeAttachedScreenshot,
    clearAttachedScreenshots,
    setScreenshotDrawingStates,
    removeScreenshotDrawingState,
    clearScreenshotDrawingStates,
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

