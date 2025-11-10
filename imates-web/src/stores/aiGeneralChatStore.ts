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
import { apiService } from '../services/api-service'
import { asyncStorage, type ChatHistoryData } from '../services/chat-storage'
import type { ChatBubble, UserInfo, AiGeneralSession } from '../types'
import { buildAiGeneralMessage } from './utils/aiMessageBuilder'
import { getCurrentUserIdOrDefault } from '../utils/user/userId'
import localforage from 'localforage'
import { generateUniqueId } from './utils/chatStoreUtils'

export const useAiGeneralChatStore = defineStore('aiGeneralChat', () => {
  // ==================== 状态定义 ====================
  
  /** 消息列表 */
  const messages = ref<ChatBubble[]>([])
  
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
  
  /** 待发送图片（用于拍作业场景） */
  const pendingImage = ref<{
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  } | null>(null)
  
  // ==================== 私有方法 ====================
  // （已迁移到 aiMessageBuilder.ts 中的 buildAiGeneralMessage）
  
  /**
   * 创建用户消息
   */
  const createUserMessage = (content: string): ChatBubble => {
    return {
      id: Date.now().toString(),
      content,
      type: 'user',
      timestamp: new Date().toISOString(),
      sender: 'user'
    }
  }
  
  /**
   * 创建临时AI回复消息
   */
  const createTempReplyMessage = (): { message: ChatBubble; id: string } => {
    const tempReplyId = generateUniqueId('temp_ai')
    const tempReplyMessage: ChatBubble = {
      id: tempReplyId,
      content: '',
      type: 'ai',
      timestamp: new Date().toISOString(),
      sender: 'ai',
      isStreaming: true
    }
    
    return { message: tempReplyMessage, id: tempReplyId }
  }
  
  // ==================== 公开方法 ====================
  
  /**
   * 发送聊天消息（AI通用场景）
   * 
   * 第1步：如果没有当前会话，创建新会话
   * 第2步：创建用户消息
   * 第3步：创建临时AI回复
   * 第4步：构建AI请求
   * 第5步：发送请求
   * 第6步：更新消息
   * 第7步：保存历史
   */
  const sendMessage = async (
    content: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel: string = 'mate',
    skipUserMessage?: boolean
  ): Promise<void> => {
    // 第1步：如果没有当前会话，创建新会话
    if (!currentSession.value) {
      await createSession(content)
    }
    
    // 第2步：创建用户消息（可选）
    if (!skipUserMessage) {
      const userMessage = createUserMessage(content)
      messages.value.push(userMessage)
    }
    
    // 第3步：创建临时AI回复
    const { message: tempReply, id: tempReplyId } = createTempReplyMessage()
    messages.value.push(tempReply)
    
    // 第4步：构建AI请求（使用标准构建函数）
    const aiRequest = buildAiGeneralMessage(
      content,
      userInfo,
      enableWebSearch.value,
      selectedModel
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
        messages.value[index] = {
          ...tempReply,
          content: '发送失败，请重试',
          isStreaming: false,
          isError: true,
          canRetry: true,
          originalMessage: content
        }
      }
      
      throw error
    }
  }
  
  /**
   * 重试失败的消息（AI通用场景）
   */
  const retryMessage = async (
    messageId: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel: string = 'mate'
  ): Promise<void> => {
    // 第1步：查找消息
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index < 0) {
      throw new Error('消息不存在')
    }
    
    const message = messages.value[index]
    if (!message.canRetry || !message.originalMessage) {
      throw new Error('该消息不支持重发')
    }
    
    // 第2步：检查重试次数
    const maxRetries = 3
    const retryCount = message.retryCount || 0
    
    if (retryCount >= maxRetries) {
      throw new Error('已达到最大重试次数')
    }
    
    // 第3步：更新为重试中状态
    messages.value[index] = {
      ...message,
      content: '',
      isStreaming: true,
      isError: false,
      canRetry: false,
      retryCount: retryCount + 1
    }
    
    // 第4步：构建AI请求（使用标准构建函数）
    const aiRequest = buildAiGeneralMessage(
      message.originalMessage,
      userInfo,
      enableWebSearch.value,
      selectedModel
    )
    
    try {
      // 第5步：重新发送请求
      const response = await apiService.sendChatMessage(aiRequest)
      
      // 第6步：判断是否成功
      const isActuallySuccess = response.success && response.reply && response.reply !== '请求失败，请重试。'
      
      // 第7步：更新消息
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
      
      // 第8步：保存聊天历史
      await saveChatHistory()
      
    } catch (error) {
      console.error('[AI_GENERAL] 重试失败:', error)
      
      // 更新为重试失败状态
      messages.value[index] = {
        ...message,
        content: `重试失败 (${retryCount + 1}/${maxRetries})，请稍后重试。`,
        isError: true,
        isStreaming: false,
        canRetry: retryCount + 1 < maxRetries,
        retryCount: retryCount + 1
      }
      
      await saveChatHistory()
      throw error
    }
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
      const newSession: AiGeneralSession = {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      await asyncStorage.saveChatHistory(`ai-general-${currentSession.value.sessionId}`, historyData)
      
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
      
      const historyData = await asyncStorage.loadChatHistory(`ai-general-${sessionId}`)
      
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
   */
  const saveSessions = async (): Promise<void> => {
    try {
      const userId = getCurrentUserIdOrDefault()
      const key = `${userId}_ai-general-sessions`
      localStorage.setItem(key, JSON.stringify(sessions.value))
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 保存会话列表失败:', error)
    }
  }
  
  /**
   * 加载会话列表
   */
  const loadSessions = async (): Promise<void> => {
    try {
      const userId = getCurrentUserIdOrDefault()
      const key = `${userId}_ai-general-sessions`
      const data = localStorage.getItem(key)
      if (data) {
        sessions.value = JSON.parse(data)
      }
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
      
      // 第3步：删除聊天历史
      const key = `chat_history_session_${sessionId}`
      await localforage.removeItem(key)
      
      // 第4步：保存会话列表
      await saveSessions()
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 删除会话失败:', error)
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
      
      // 第3步：保存更新后的聊天历史
      await saveChatHistory()
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
      
      // 第5步：构建AI请求
      const titleRequest = buildAiGeneralMessage(
        titlePrompt,
        userInfo,
        false, // 不使用web搜索
        'mate'
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

