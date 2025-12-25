/**
 * AI 通用聊天 Store
 * 职责：管理AI通用场景下的聊天消息和会话
 * 
 * 场景特点：
 * - 不需要题目，可以自由对话
 * - 支持多会话管理
 * - 每个会话有独立的聊天历史
 * - 保存到会话维度
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/http/api-service'
import { chatStorage, type ChatHistoryData } from '../services/storage/chat-storage'
import type { AiChatMessageRequest, AiGeneralSession, ChatBubble, UserInfo, BackendHistoryMessage } from '../types'
import type { ChatQuotedMessage, ChatImageData } from './utils/chatStoreUtils'
import { getUserId, getCurrentUserIdOrDefault } from '../services'
import localforage from 'localforage'
import { generateUniqueId } from './utils/chatStoreUtils'
import { alignTailMessageIdsFromHistory, buildHistorySignature } from './utils/historySyncUtils'
import { useChatPersistence } from '@/composables/useChatPersistence'
import { useChatSessions } from '@/composables/useChatSessions'
import { useChatRetry } from '@/composables/useChatRetry'
import { useChatEngine } from '@/composables/useChatEngine'
import { validateGeneralChatRequest } from './utils/requestValidator'
import { getCurrentEnvConfig } from '@/config/env-config'

/**
 * 构建 AI 通用聊天消息请求
 * @param content 用户输入内容
 * @param userInfo 用户信息
 * @param enableWebSearch 是否启用网络搜索
 * @param chatRole 聊天角色（mate/mentor/researcher）
 * @param sessionId 会话ID（可选，不传则自动生成）
 */
const buildAiGeneralMessage = (
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate',
  sessionId?: string | null,
  useScreenshotApi: boolean = false,
  imageList?: { base64DataUrl: string }[],
): AiChatMessageRequest => {
  // 优先使用传入的 sessionId，如果没有则新建
  const createSessionId = (maybeSessionId?: string) => {
    const userId = localStorage.getItem('userId') || ''
    const finalSessionId = maybeSessionId || `${userId ? userId + '-' : ''}general-session-${Date.now()}`
    return {
      sessionId: finalSessionId,
      newValue: '1',
    }
  }
  const { sessionId: finalSessionId, newValue } = createSessionId(sessionId ?? undefined)
  const apiPaths = getCurrentEnvConfig().apiPaths
  const dstUrl = useScreenshotApi ? apiPaths.previewPictureQA : apiPaths.chats
  
  const request: AiChatMessageRequest = {
    sessionId: finalSessionId,
    newValue,
    coversation: content,
    question: '',
    answer: '',
    name: getUserId() || 'User',
    reason: 'start',
    bmNo: finalSessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    role: chatRole,
    subject: '',
    dstUrl,
    explanation: '', // 通用对话占位
    imageList: imageList && imageList.length > 0 ? imageList : undefined,
  }
  
  // 校验请求参数完整性
  validateGeneralChatRequest(request, finalSessionId)
  
  return request
}

export const useAiGeneralChatStore = defineStore('aiGeneralChat', () => {
  // ==================== 状态定义 ====================
  
  /** 消息列表 */
  const messages = ref<ChatBubble[]>([])
  const lastHistorySignature = ref<string>('')
  
  /** 会话列表 */
  const sessions = ref<AiGeneralSession[]>([])
  
  /** 当前会话 */
  const currentSession = ref<AiGeneralSession | null>(null)
  
  /** 聊天加载状态 */
  const isChatLoading = ref(false)
  
  /** Web搜索开关 */
  const enableWebSearch = ref(false)
  
  /** 是否正在创建会话 */
  const isCreatingSession = ref(false)

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

  const sessionPersistence = useChatSessions<AiGeneralSession>({
    save: async (data) => {
      await chatStorage.saveGeneralSessions(data)
    },
    load: async () => {
      return await chatStorage.loadGeneralSessions()
    },
  })

  const retryHelper = useChatRetry({ maxRetries: 3 })

  const chatEngine = useChatEngine({
    messagesRef: messages,
    lastHistorySignatureRef: lastHistorySignature,
    onAfterHistorySync: () => saveChatHistory(),
  })
  
  /** 待发送图片（用于拍作业场景） */
  const pendingImage = ref<{
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  } | null>(null)
  
  // ==================== 私有方法 ====================
  // （使用本文件内的 buildAiGeneralMessage）
  
  /**
   * 将后端 history_messages 映射为前端 ChatBubble[]
   * 协议约定：
   * - history_messages 是全量快照
   * - 当前 streaming 消息也包含在 history 里
   * - ID 统一由服务端生成并在前端全链路使用
   * - 需要保留前端独有字段（quotedMessage、imageData 等），后端不存这些
   */
  const mapHistoryToChatBubbles = (
    history: BackendHistoryMessage[],
    agentStatus?: string,
  ): ChatBubble[] => {
    const oldMessages = messages.value

    // 1) 找到前后端共同的前缀长度（按 id / messageId 对比）
    let prefixLen = 0
    const maxPrefix = Math.min(oldMessages.length, history.length)
    while (prefixLen < maxPrefix) {
      const old = oldMessages[prefixLen]
      const h = history[prefixLen]
      const oldId = old.messageId || old.id
      if (!oldId || oldId !== h.id) break
      prefixLen++
    }

    // 2) 构建旧消息的 id -> ChatBubble 映射，用于后续 suffix merge
    const oldMessagesMap = new Map<string, ChatBubble>()
    for (const msg of oldMessages) {
      const key = msg.messageId || msg.id
      if (key) {
        oldMessagesMap.set(key, msg)
      }
    }

    const result: ChatBubble[] = []

    // 2.1 复用前缀：前缀部分完全一致，直接使用旧消息，保留所有 UI 字段
    for (let i = 0; i < prefixLen; i++) {
      const old = oldMessages[i]
      const h = history[i]
      const sender: 'user' | 'ai' = h.type === 'human' ? 'user' : 'ai'
      const roleFromHistory = (h as any)?.additional_kwargs?.role as string | undefined

      // 以 history 为准覆盖核心字段（content / sender / selectedModel），保留旧消息的 UI 独有字段
      result.push({
        ...old,
        id: h.id,
        messageId: h.id,
        content: old.content,
        sender,
        type: sender,
        isStreaming: false,
        selectedModel: sender === 'ai' ? (roleFromHistory || old.selectedModel || 'mate') : undefined,
      })
    }

    // 2.2 从 prefixLen 开始，对新增 history 做映射（必要时 merge 旧字段）
    for (let i = prefixLen; i < history.length; i++) {
      const m = history[i]
      const sender: 'user' | 'ai' = m.type === 'human' ? 'user' : 'ai'

      const oldMsg = oldMessagesMap.get(m.id)

      const roleFromHistory = (m as any)?.additional_kwargs?.role as string | undefined

      const bubble: ChatBubble = {
        id: m.id,            // 直接用服务端 ID，全链路统一
        messageId: m.id,     // 兼容 messageId 字段
        content: oldMsg?.content && oldMsg.content.trim() !== '' ? oldMsg.content : (m.content || ''),
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
        // AI 消息需要 selectedModel 来显示正确的头像
        // 优先从旧消息取，否则默认 'mate'
        selectedModel: sender === 'ai' ? (roleFromHistory || oldMsg?.selectedModel || 'mate') : undefined,
        originalDstUrl: oldMsg?.originalDstUrl,
      }

      result.push(bubble)
    }

    return result
  }
  
  /**
   * 创建用户消息
   * 支持挂前端引用信息（quotedMessage），仅用于 UI 展示，不发送给后端
   */
  const createUserMessage = (content: string, sessionId?: string, quotedMessage?: ChatQuotedMessage): ChatBubble => {
    return {
      id: Date.now().toString(),
      content,
      type: 'user',
      timestamp: new Date().toISOString(),
      sender: 'user',
      messageType: 'text',
      sessionId,
      quotedMessage,
    }
  }
  
  /**
   * 创建临时AI回复消息
   */
  const createTempReplyMessage = (selectedModel?: string): { message: ChatBubble; id: string } => {
    const tempReplyId = generateUniqueId('temp_ai')
    const tempReplyMessage: ChatBubble = {
      id: tempReplyId,
      content: '',
      type: 'ai',
      timestamp: new Date().toISOString(),
      sender: 'ai',
      // 初始不处于流式状态，避免在还未收到任何服务端帧时就展示骨架屏
      isStreaming: false,
      selectedModel: selectedModel || 'mate' // 保存当前模式
    }
    
    return { message: tempReplyMessage, id: tempReplyId }
  }
  
  // ==================== 公开方法 ====================
  
  /**
   * 发送消息到AI
   * 
   * 流程：
   * 1. 如果没有当前会话，创建新会话
   * 2. 创建用户消息（可选）
   * 3. 创建临时AI回复
   * 4. 构建AI请求
   * 5. 发送请求并处理响应
   * 6. 保存聊天历史
   * 
   * @param content 用户输入内容
   * @param userInfo 用户信息
   * @param subject 学科
   * @param selectedModel 选择的模型
   * @param skipUserMessage 是否跳过创建用户消息
   */
  const sendMessage = async (
    content: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel: string = 'mate',
    skipUserMessage?: boolean,
    quotedMessage?: ChatQuotedMessage,
    imageData?: ChatImageData,
    imageList?: ChatImageData[],
  ): Promise<void> => {
    // 第1步：如果没有当前会话，创建新会话
    if (!currentSession.value) {
      console.log('没有当前会话，创建新会话')
      await createSession(content)
    }
    
    // 第2步：创建用户消息（可选）
    if (!skipUserMessage) {
      // 普通文本消息（无图片）
      const userMessage = createUserMessage(content, currentSession.value?.sessionId, quotedMessage)
      messages.value.push(userMessage)
    } else if ((imageList && imageList.length > 0) || (imageData && imageData.base64DataUrl)) {
      // 当上游已通过“挂载图片”方式传入图片数据时，这里负责创建图片气泡（以及可选的文本气泡）
      const now = Date.now()

      const hasMulti = !!(imageList && imageList.length > 0)

      if (hasMulti) {
        const standardImageList = (imageList || [])
          .filter((img) => !!img.base64DataUrl)
          .slice(0, 3)
          .map((img) => ({
            filePath: img.filePath || '',
            width: img.width || 0,
            height: img.height || 0,
            fileSize: img.fileSize || 0,
            base64DataUrl: img.base64DataUrl!,
            isLargeImage: img.isLargeImage || false,
          }))

        const imageMessage: ChatBubble = {
          id: now.toString(),
          content: '',
          type: 'user',
          timestamp: new Date().toISOString(),
          sender: 'user',
          messageType: 'multi_image',
          imageList: standardImageList,
          sessionId: currentSession.value?.sessionId,
          quotedMessage,
        }
        messages.value.push(imageMessage)
      } else if (imageData && imageData.base64DataUrl) {
        const imageMessage: ChatBubble = {
          id: now.toString(),
          content: '',
          type: 'user',
          timestamp: new Date().toISOString(),
          sender: 'user',
          messageType: 'image',
          imageData: {
            filePath: imageData.filePath || '',
            width: imageData.width || 0,
            height: imageData.height || 0,
            fileSize: imageData.fileSize || 0,
            base64DataUrl: imageData.base64DataUrl,
          },
          sessionId: currentSession.value?.sessionId,
          quotedMessage,
        }
        messages.value.push(imageMessage)
      }

      // 第2个气泡：如果有文本内容，则单独再创建一条文本消息
      if (content && content.trim()) {
        const textMessage: ChatBubble = {
          id: (now + 1).toString(),
          content,
          type: 'user',
          timestamp: new Date().toISOString(),
          sender: 'user',
          messageType: 'text',
          sessionId: currentSession.value?.sessionId,
        }
        messages.value.push(textMessage)
      }
    }
    
    // 第3步：创建临时AI回复
    const { message: tempReply, id: tempReplyId } = createTempReplyMessage(selectedModel)
    messages.value.push(tempReply)
    
    // 第4步：构建AI请求（使用标准构建函数，传入当前会话的 sessionId）
    // 当存在图片数据时，使用截图接口 /permission/previewPictureQA，并附带 imageList
    const hasMultiImages = !!(imageList && imageList.length > 0)
    const hasSingleImage = !!(imageData && imageData.base64DataUrl)
    const useScreenshotApi = hasMultiImages || hasSingleImage

    const imageListForRequest = hasMultiImages
      ? (imageList || [])
          .filter((img) => !!img.base64DataUrl)
          .slice(0, 3)
          .map((img) => ({ base64DataUrl: img.base64DataUrl! }))
      : hasSingleImage
        ? [{ base64DataUrl: imageData!.base64DataUrl! }]
        : undefined
    const aiRequest = buildAiGeneralMessage(
      content,
      userInfo,
      enableWebSearch.value,
      selectedModel,
      currentSession.value?.sessionId,
      useScreenshotApi,
      imageListForRequest,
    )
    
    // 记录本次 AI 回复对应的后端接口地址，供后续刷新(handleRefresh) 时严格跟随原接口
    const tempIndex = messages.value.findIndex((m) => m.id === tempReplyId)
    if (tempIndex >= 0) {
      messages.value[tempIndex] = {
        ...messages.value[tempIndex],
        originalDstUrl: aiRequest.dstUrl,
      }
    }
    
    try {
      // 第5步：发送请求（带流式回调）
      const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)
      const response = await apiService.sendChatMessage(aiRequest, onComplete, onStream, onHistoryUpdate)
      
      // 第7步：保存聊天历史
      await saveChatHistory()
      // 第8步：检查是否需要自动生成标题（第3轮对话后，加上临时消息后，7条消息）
      if (currentSession.value && messages.value.length === 7) {
        // 异步生成标题，不阻塞主流程
        generateSessionTitle(currentSession.value.sessionId, userInfo, subject).catch(error => {
          console.warn('[AI_GENERAL] ⚠️ 自动生成标题失败:', error)
        })
      }
      
    } catch (error) {
      console.error('[AI_GENERAL] 发送失败:', error)
      
      // 更新消息为错误状态
      const index = messages.value.findIndex(m => m.id === tempReplyId)
      if (index >= 0) {
        const old = messages.value[index]
        messages.value[index] = {
          ...tempReply,
          content: '发送失败，请重试',
          isStreaming: false,
          isError: true,
          canRetry: true,
          originalMessage: content,
          // 保留 originalDstUrl
          originalDstUrl: old.originalDstUrl,
        }
      }
      
      throw error
    }
  }
  
  /**
   * 重试失败的消息（AI通用场景）
   * 
   * 流程：
   * 1. 查找失败的消息，提取原始内容
   * 2. 删除失败的消息（本地+后端同步）
   * 3. 重新发送原始内容
   */
  const retryMessage = async (
    messageId: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel: string = 'mate'
  ): Promise<void> => {
    await retryHelper.retryByDeleteAndResend({
      ctx: {
        messages,
        deleteMessage,
      },
      messageId,
      selectedModel,
      resend: async ({ originalContent, quotedMessage, selectedModel: model }) => {
        await sendMessage(
          originalContent,
          userInfo,
          subject,
          model || selectedModel,
          false,
          quotedMessage,
          undefined,
        )
      },
    })
  }
  
  /**
   * 检查是否可以创建新会话
   * 规则：
   * 1. 不能正在创建中
   * 2. 如果有当前会话且消息数为0，不允许创建
   */
  const canCreateSession = computed(() => {
    // 第1步：检查是否正在创建
    if (isCreatingSession.value) {
      return false
    }
    
    // 第2步：检查当前会话是否有消息
    if (currentSession.value && currentSession.value.msgCount === 0) {
      return false
    }
    
    return true
  })
  
  /**
   * 创建新会话（AI通用场景专属）
   */
  const createSession = async (firstMessage: string): Promise<void> => {
    // 第1步：检查是否可以创建
    if (!canCreateSession.value) {
      console.warn('[AI_GENERAL] ⚠️ 无法创建新会话：当前会话无消息或正在创建中')
      return
    }
    
    try {
      // 第2步：设置创建中状态
      isCreatingSession.value = true
      
      // 第3步：生成会话信息
      const MAX_SESSION_NAME_LENGTH = 20 // 会话名称最大长度（约10个汉字）
      const userId = localStorage.getItem('userId') || ''
      const newSession: AiGeneralSession = {
        // 与 buildAiGeneralMessage 的默认 thread_id 生成规则保持一致，避免 thread_id 在同一对话中漂移
        sessionId: `${userId ? userId + '-' : ''}general-session-${Date.now()}`,
        sessionName: firstMessage.length > MAX_SESSION_NAME_LENGTH 
          ? firstMessage.substring(0, MAX_SESSION_NAME_LENGTH) + '...' 
          : firstMessage,
        createTime: Date.now(),
        updateTime: Date.now(),
        msgCount: 0
      }
      
      // 第4步：添加到会话列表（置顶）
      sessions.value.unshift(newSession)
      currentSession.value = newSession
      
      // 第5步：清空当前消息
      messages.value = []
      
      // 第6步：保存会话列表
      await saveSessions()
    } finally {
      // 第7步：重置创建中状态（延迟500ms防止频繁点击）
      setTimeout(() => {
        isCreatingSession.value = false
      }, 500)
    }
  }
  
  /**
   * 切换会话（AI通用场景专属）
   */
  const switchSession = async (sessionId: string): Promise<void> => {
    // 第1步：查找会话
    const session = sessions.value.find(s => s.sessionId === sessionId)
    if (!session) {
      console.warn(`[AI_GENERAL] ⚠️ 会话不存在: ${sessionId}`)
      return
    }
    
    // 第2步：切换当前会话
    currentSession.value = session
    
    // 第3步：加载该会话的聊天记录
    await loadChatHistory(sessionId)
  }
  
  /**
   * 保存聊天历史（AI通用场景）
   */
  const saveChatHistory = async (): Promise<void> => {
    if (!currentSession.value || messages.value.length === 0) return
    
    // 第1步：更新会话信息
    currentSession.value.msgCount = messages.value.length
    currentSession.value.updateTime = Date.now()
    
    // 第2步：保存消息
    const historyData: ChatHistoryData = {
      questionId: currentSession.value.sessionId,  // 使用sessionId作为存储键
      messages: messages.value,
      chatResponseTimes: 0,  // 通用场景不计算回复次数
      lastUpdated: Date.now()
    }
    
    try {
      await chatPersistence.save(`ai-general-${currentSession.value.sessionId}`, historyData)
      
      // 第3步：保存会话列表
      await saveSessions()
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 保存聊天历史失败:', error)
    }
  }
  
  /**
   * 加载聊天历史（AI通用场景）
   */
  const loadChatHistory = async (sessionId: string): Promise<void> => {
    try {
      isChatLoading.value = true
      
      const historyData = await chatPersistence.load(`ai-general-${sessionId}`)
      
      if (historyData) {
        messages.value = historyData.messages || []
      } else {
        // 无历史记录，清空状态
        messages.value = []
      }
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 加载聊天历史失败:', error)
      messages.value = []
    } finally {
      isChatLoading.value = false
    }
  }
  
  /**
   * 保存会话列表
   * 目标存储：ExerciseSolveApp 的 ai_general_sessions 表（IndexedDB/localforage）
   */
  const saveSessions = async (): Promise<void> => {
    try {
      await sessionPersistence.save(sessions.value)
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 保存会话列表失败:', error)
    }
  }
  
  /**
   * 加载会话列表
   * 优先从老的 localStorage 迁移到新表，然后以后都走新表
   */
  const loadSessions = async (): Promise<void> => {
    try {
      const userId = getCurrentUserIdOrDefault()
      const legacyKey = `${userId}_ai-general-sessions`
      sessions.value = await sessionPersistence.loadWithLegacy({
        read: () => {
          const legacyData = localStorage.getItem(legacyKey)
          if (!legacyData) return null
          return JSON.parse(legacyData) as AiGeneralSession[]
        },
        clear: () => {
          localStorage.removeItem(legacyKey)
        },
      })
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 加载会话列表失败:', error)
      sessions.value = []
    }
  }
  
  /**
   * 重命名会话
   */
  const renameSession = async (sessionId: string, newName: string): Promise<void> => {
    try {
      // 第1步：查找会话
      const session = sessions.value.find(s => s.sessionId === sessionId)
      if (!session) {
        throw new Error('会话不存在')
      }
      
      // 第2步：更新会话名称
      session.sessionName = newName
      session.updateTime = Date.now()
      
      // 第3步：保存会话列表
      await saveSessions()
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 重命名会话失败:', error)
      throw error
    }
  }
  
  /**
   * 切换置顶状态
   */
  const togglePin = async (sessionId: string): Promise<void> => {
    try {
      // 第1步：查找会话
      const session = sessions.value.find(s => s.sessionId === sessionId)
      if (!session) {
        throw new Error('会话不存在')
      }
      
      // 第2步：切换置顶状态
      session.pinned = !session.pinned
      session.updateTime = Date.now()
      
      // 第3步：重新排序（置顶的排在前面）
      sessions.value.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.updateTime - a.updateTime
      })
      
      // 第4步：保存会话列表
      await saveSessions()
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 置顶操作失败:', error)
      throw error
    }
  }
  
  /**
   * 删除会话
   */
  const deleteSession = async (sessionId: string): Promise<void> => {
    try {
      // 第1步：从列表中移除
      const index = sessions.value.findIndex(s => s.sessionId === sessionId)
      if (index >= 0) {
        sessions.value.splice(index, 1)
      }
      
      // 第2步：如果是当前会话，清空
      if (currentSession.value?.sessionId === sessionId) {
        currentSession.value = null
        messages.value = []
      }
      
      // 第3步：删除本地聊天历史
      const key = `chat_history_session_${sessionId}`
      await localforage.removeItem(key)

      // 第4步：同步删除后端记忆（chatbot 线程）
      try {
        await apiService.manageConversationMemory({
          command: 'delete_thread',
          thread_id: sessionId,
          agent_name: 'chatbot',
        })
      } catch (error) {
        console.warn('[AI_GENERAL] 删除会话时同步后端记忆失败:', error)
      }
      
      // 第5步：保存会话列表
      await saveSessions()
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 删除会话失败:', error)
      throw error
    }
  }
  
  /**
   * 删除消息及其之后的所有消息（AI通用场景）
   *
   * 规则：
   * - 如果选中的是 user 消息：删除该 user 及其之后的所有消息
   * - 如果选中的是 ai 消息：向前找到最近一条 user 消息，从这条 user 开始删除直到最后
   * 本地历史与后端 manageConversationMemory(delete_messages, chatbot) 同步
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
        // 向前查找最近一条 user 消息
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

      // 第4步：先更新本地消息列表（从起点到末尾全部删除）
      messages.value.splice(startIndex)

      // 第5步：保存更新后的聊天历史
      await saveChatHistory()

      // 第6步：调用后端 manageConversationMemory，同步删除对应线程的后续历史
      if (currentSession.value?.sessionId && startBackendMessageId) {
        try {
          await apiService.manageConversationMemory({
            command: 'delete_messages',
            thread_id: currentSession.value.sessionId,
            message_id: startBackendMessageId,
            agent_name: 'chatbot',
          })
        } catch (error) {
          console.warn('[AI_GENERAL] 删除消息时同步后端记忆失败:', error)
        }
      }
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 删除消息失败:', error)
      throw error
    }
  }
  
  /**
   * 重置状态
   */
  const resetState = (): void => {
    messages.value = []
    currentSession.value = null
    isChatLoading.value = false
  }
  
  // ==================== 返回接口 ====================
  
  /**
   * 自动生成会话标题（基于会话内容）
   * 
   * 第1步：获取会话的前几条消息
   * 第2步：构建生成标题的提示词
   * 第3步：调用AI接口生成标题
   * 第4步：更新会话名称
   */
  const generateSessionTitle = async (
    sessionId: string,
    userInfo: UserInfo | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _subject: 'MATH' | 'BIOLOGY'
  ): Promise<void> => {
    try {
      // 第1步：查找会话
      const session = sessions.value.find(s => s.sessionId === sessionId)
      if (!session) {
        throw new Error('会话不存在')
      }
      
      // 第2步：获取前6条消息（3轮对话）
      const firstMessages = messages.value.slice(0, 6)
        .filter(m => m.sender === 'user' || m.sender === 'ai')
        .map(m => ({
          role: m.sender === 'user' ? '用户' : 'AI',
          content: m.content
        }))
      
      if (firstMessages.length < 2) {
        console.warn('[AI_GENERAL] ⚠️ 消息数量不足，跳过生成标题')
        return
      }
      
      // 第3步：构建对话摘要
      const conversationSummary = firstMessages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n')
      
      // 第4步：构建生成标题的提示词
      const titlePrompt = `你是一个对话标题生成器。请为以下对话生成一个使用动宾结构或名词短语的标题（不超过15个字）。只返回标题文本，不要有引号或其他说明。

对话内容：
${conversationSummary}



标题：`
      
      // 第5步：构建AI请求（使用独立 session，避免提示词污染当前会话）
      const titleSessionId = `${sessionId}-title-${Date.now()}`
      const titleRequest = buildAiGeneralMessage(
        titlePrompt,
        userInfo,
        false, // 不使用web搜索
        'mate',
        titleSessionId,
        false,
      )
      // 第6步：调用AI接口
      const response = await apiService.sendChatMessage(titleRequest)
      
      if (response && response.reply) {
        // 第7步：清理生成的标题（去除引号、换行等）
        const generatedTitle = response.reply
          .trim()
          .replace(/^["']|["']$/g, '') // 去除开头和结尾的引号
          .replace(/\n/g, '') // 去除换行
          .replace(/^标题[：:]\s*/,'') // 去除"标题："前缀
          .substring(0, 20) // 限制最大长度
        
        // 如果标题为空或太短，使用默认标题
        if (!generatedTitle || generatedTitle.length < 2) {
          console.warn('[AI_GENERAL] ⚠️ 生成的标题无效，保持原标题')
          return
        }
        
        // 第8步：更新会话标题
        session.sessionName = generatedTitle
        session.updateTime = Date.now()
        
        // 第9步：保存会话列表
        await saveSessions()
      } else {
        console.warn('[AI_GENERAL] ⚠️ AI未返回有效标题')
      }
      
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 生成标题失败:', error)
      throw error
    }
  }
  
  /**
   * 切换Web搜索
   */
  const toggleWebSearch = (): void => {
    enableWebSearch.value = !enableWebSearch.value
  }
  
  /**
   * 设置待发送图片（用于拍作业场景）
   * 第1步：保存图片信息到状态
   */
  const setPendingImage = (imageData: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  }): void => {
    pendingImage.value = imageData
  }
  
  /**
   * 清除待发送图片
   * 第1步：清空待发送图片状态
   */
  const clearPendingImage = (): void => {
    pendingImage.value = null
  }
  
  return {
    // 状态
    messages,
    sessions,
    currentSession,
    isChatLoading,
    enableWebSearch,
    isCreatingSession,
    canCreateSession,
    pendingImage,
    
    // 方法
    sendMessage,
    retryMessage,
    createSession,
    switchSession,
    renameSession,
    togglePin,
    deleteSession,
    deleteMessage,
    generateSessionTitle,
    saveChatHistory,
    loadChatHistory,
    saveSessions,
    loadSessions,
    resetState,
    toggleWebSearch,
    setPendingImage,
    clearPendingImage
  }
})

