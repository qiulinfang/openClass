/**
 * AI 通用聊天 Store（React Native 版本）
 * 职责：管理AI通用场景下的聊天消息和会话
 * 
 * 场景特点：
 * - 不需要题目，可以自由对话
 * - 支持多会话管理
 * - 每个会话有独立的聊天历史
 * - 保存到会话维度
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiService, type AiChatMessageRequest } from '../services/apiService'
import { chatStorageService, type ChatHistoryData } from '../services/chatStorageService'
import type { ChatBubble } from '../types/chat'
import type { UserInfo } from './userStore'

/**
 * 构建AI消息请求（AI通用场景）
 * 通用场景不需要题目信息
 */
function buildAiGeneralMessage(
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate'
): AiChatMessageRequest {
  const sessionId = `general-session-${Date.now()}`
  
  // 第1步：获取用户名称
  const userName = userInfo?.name || (userInfo?.userName as string | undefined) || 'User'
  
  return {
    sessionId,
    newValue: '1',
    coversation: content,
    question: '',  // 通用场景无题目
    answer: '',
    name: userName,
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole: chatRole,
    dstUrl: '/permission/chats'  // 通用AI对话接口
  }
}

/**
 * AI通用会话接口
 */
export interface AiGeneralSession {
  sessionId: string
  sessionName: string
  createTime: number
  updateTime: number
  msgCount: number
  pinned?: boolean
}

interface AiGeneralChatState {
  // 状态定义
  messages: ChatBubble[]
  sessions: AiGeneralSession[]
  currentSession: AiGeneralSession | null
  isChatLoading: boolean
  enableWebSearch: boolean
  isCreatingSession: boolean
  pendingImage: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  } | null

  // 计算属性（Zustand 不支持 computed，需要在组件中计算）
  // canCreateSession 需要在组件中计算

  // 方法定义
  sendMessage: (
    content: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string,
    skipUserMessage?: boolean
  ) => Promise<void>
  retryMessage: (
    messageId: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel?: string
  ) => Promise<void>
  createSession: (firstMessage: string) => Promise<void>
  switchSession: (sessionId: string) => Promise<void>
  saveChatHistory: () => Promise<void>
  loadChatHistory: (sessionId: string) => Promise<void>
  saveSessions: () => Promise<void>
  loadSessions: () => Promise<void>
  renameSession: (sessionId: string, newName: string) => Promise<void>
  togglePin: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  generateSessionTitle: (
    sessionId: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY'
  ) => Promise<void>
  resetState: () => void
  toggleWebSearch: () => void
  setPendingImage: (imageData: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  }) => void
  clearPendingImage: () => void
}

/**
 * AI 通用聊天 Store
 * 使用 Zustand 创建，支持持久化
 */
export const useAiGeneralChatStore = create<AiGeneralChatState>((set, get) => ({
  // 初始状态
  messages: [],
  sessions: [],
  currentSession: null,
  isChatLoading: false,
  enableWebSearch: false,
  isCreatingSession: false,
  pendingImage: null,

  /**
   * 发送聊天消息（AI通用场景）
   */
  sendMessage: async (
    content: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel: string = 'mate',
    skipUserMessage?: boolean
  ): Promise<void> => {
    const state = get()
    
    // 第1步：如果没有当前会话，创建新会话
    if (!state.currentSession) {
      await get().createSession(content)
    }
    
    // 第2步：创建用户消息（可选）
    if (!skipUserMessage) {
      const userMessage: ChatBubble = {
        id: Date.now().toString(),
        content,
        type: 'user',
        timestamp: new Date().toISOString(),
        sender: 'user',
      }
      set({ messages: [...state.messages, userMessage] })
    }
    
    // 第3步：创建临时AI回复
    const tempReplyId = (Date.now() + 1).toString()
    const tempReply: ChatBubble = {
      id: tempReplyId,
      content: '',
      type: 'ai',
      timestamp: new Date().toISOString(),
      sender: 'ai',
      isStreaming: true,
    }
    set({ messages: [...get().messages, tempReply] })
    
    // 第4步：构建AI请求（使用标准构建函数）
    const aiRequest = buildAiGeneralMessage(
      content,
      userInfo,
      get().enableWebSearch,
      selectedModel
    )
    
    try {
      // 第5步：发送请求
      const response = await apiService.sendChatMessage(aiRequest)
      
      // 第6步：更新临时消息为实际回复
      const currentMessages = get().messages
      const index = currentMessages.findIndex(m => m.id === tempReplyId)
      if (index >= 0) {
        const updatedMessages = [...currentMessages]
        updatedMessages[index] = {
          ...tempReply,
          content: response.reply || '回复失败',
          isStreaming: false,
          messageId: response.messageId,
        }
        set({ messages: updatedMessages })
      }
      
      // 第7步：保存聊天历史
      await get().saveChatHistory()
      
      // 第8步：检查是否需要自动生成标题（第3轮对话后，加上临时消息后，7条消息）
      const finalMessages = get().messages
      if (state.currentSession && finalMessages.length === 7) {
        // 异步生成标题，不阻塞主流程
        get().generateSessionTitle(state.currentSession.sessionId, userInfo, subject).catch(error => {
          console.warn('[AI_GENERAL] ⚠️ 自动生成标题失败:', error)
        })
      }
      
    } catch (error) {
      console.error('[AI_GENERAL] 发送失败:', error)
      
      // 更新消息为错误状态
      const currentMessages = get().messages
      const index = currentMessages.findIndex(m => m.id === tempReplyId)
      if (index >= 0) {
        const updatedMessages = [...currentMessages]
        updatedMessages[index] = {
          ...tempReply,
          content: '发送失败，请重试',
          isStreaming: false,
          isError: true,
          canRetry: true,
          originalMessage: content,
        }
        set({ messages: updatedMessages })
      }
      
      throw error
    }
  },

  /**
   * 重试失败的消息（AI通用场景）
   */
  retryMessage: async (
    messageId: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    selectedModel: string = 'mate'
  ): Promise<void> => {
    const state = get()
    
    // 第1步：查找消息
    const index = state.messages.findIndex(m => m.id === messageId)
    if (index < 0) {
      throw new Error('消息不存在')
    }
    
    const message = state.messages[index]
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
    const updatedMessages = [...state.messages]
    updatedMessages[index] = {
      ...message,
      content: '',
      isStreaming: true,
      isError: false,
      canRetry: false,
      retryCount: retryCount + 1,
    }
    set({ messages: updatedMessages })
    
    // 第4步：构建AI请求（使用标准构建函数）
    const aiRequest = buildAiGeneralMessage(
      message.originalMessage,
      userInfo,
      state.enableWebSearch,
      selectedModel
    )
    
    try {
      // 第5步：重新发送请求
      const response = await apiService.sendChatMessage(aiRequest)
      
      // 第6步：判断是否成功
      const isActuallySuccess = response.success && response.reply && response.reply !== '请求失败，请重试。'
      
      // 第7步：更新消息
      const finalMessages = [...get().messages]
      finalMessages[index] = {
        ...message,
        content: response.reply || '请求失败，请重试。',
        timestamp: new Date().toISOString(),
        messageId: response.messageId,
        isStreaming: false,
        isError: !isActuallySuccess,
        canRetry: !isActuallySuccess && (retryCount + 1 < maxRetries),
        retryCount: !isActuallySuccess ? retryCount + 1 : undefined,
        originalMessage: !isActuallySuccess ? message.originalMessage : undefined,
      }
      set({ messages: finalMessages })
      
      // 第8步：保存聊天历史
      await get().saveChatHistory()
      
    } catch (error) {
      console.error('[AI_GENERAL] 重试失败:', error)
      
      // 更新为重试失败状态
      const currentMessages = get().messages
      const updatedMessages = [...currentMessages]
      updatedMessages[index] = {
        ...message,
        content: `重试失败 (${retryCount + 1}/${maxRetries})，请稍后重试。`,
        isError: true,
        isStreaming: false,
        canRetry: retryCount + 1 < maxRetries,
        retryCount: retryCount + 1,
      }
      set({ messages: updatedMessages })
      
      await get().saveChatHistory()
      throw error
    }
  },

  /**
   * 创建新会话（AI通用场景专属）
   */
  createSession: async (firstMessage: string): Promise<void> => {
    const state = get()
    
    // 第1步：检查是否可以创建（不能正在创建中，且当前会话有消息才允许创建）
    if (state.isCreatingSession) {
      console.warn('[AI_GENERAL] ⚠️ 无法创建新会话：正在创建中')
      return
    }
    
    if (state.currentSession && state.currentSession.msgCount === 0) {
      console.warn('[AI_GENERAL] ⚠️ 无法创建新会话：当前会话无消息')
      return
    }
    
    try {
      // 第2步：设置创建中状态
      set({ isCreatingSession: true })
      
      // 第3步：生成会话信息
      const MAX_SESSION_NAME_LENGTH = 20
      const newSession: AiGeneralSession = {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionName: firstMessage.length > MAX_SESSION_NAME_LENGTH 
          ? firstMessage.substring(0, MAX_SESSION_NAME_LENGTH) + '...' 
          : firstMessage,
        createTime: Date.now(),
        updateTime: Date.now(),
        msgCount: 0,
      }
      
      // 第4步：添加到会话列表（置顶）
      set({
        sessions: [newSession, ...state.sessions],
        currentSession: newSession,
        messages: [],
      })
      
      // 第5步：保存会话列表
      await get().saveSessions()
    } finally {
      // 第6步：重置创建中状态（延迟500ms防止频繁点击）
      setTimeout(() => {
        set({ isCreatingSession: false })
      }, 500)
    }
  },

  /**
   * 切换会话（AI通用场景专属）
   */
  switchSession: async (sessionId: string): Promise<void> => {
    const state = get()
    
    // 第1步：查找会话
    const session = state.sessions.find(s => s.sessionId === sessionId)
    if (!session) {
      console.warn(`[AI_GENERAL] ⚠️ 会话不存在: ${sessionId}`)
      return
    }
    
    // 第2步：切换当前会话
    set({ currentSession: session })
    
    // 第3步：加载该会话的聊天记录
    await get().loadChatHistory(sessionId)
  },

  /**
   * 保存聊天历史（AI通用场景）
   */
  saveChatHistory: async (): Promise<void> => {
    const state = get()
    if (!state.currentSession || state.messages.length === 0) return
    
    // 第1步：更新会话信息
    const updatedSession = {
      ...state.currentSession,
      msgCount: state.messages.length,
      updateTime: Date.now(),
    }
    set({ currentSession: updatedSession })
    
    // 更新会话列表中的会话信息
    const updatedSessions = state.sessions.map(s =>
      s.sessionId === updatedSession.sessionId ? updatedSession : s
    )
    set({ sessions: updatedSessions })
    
    // 第2步：保存消息
    const historyData: ChatHistoryData = {
      questionId: state.currentSession.sessionId,
      messages: state.messages,
      chatResponseTimes: 0,
      lastUpdated: Date.now(),
    }
    
    try {
      await chatStorageService.saveChatHistory(`ai-general-${state.currentSession.sessionId}`, historyData)
      
      // 第3步：保存会话列表
      await get().saveSessions()
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 保存聊天历史失败:', error)
    }
  },

  /**
   * 加载聊天历史（AI通用场景）
   */
  loadChatHistory: async (sessionId: string): Promise<void> => {
    try {
      set({ isChatLoading: true })
      
      const historyData = await chatStorageService.loadChatHistory(`ai-general-${sessionId}`)
      
      if (historyData) {
        set({ messages: historyData.messages || [] })
      } else {
        // 无历史记录，清空状态
        set({ messages: [] })
      }
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 加载聊天历史失败:', error)
      set({ messages: [] })
    } finally {
      set({ isChatLoading: false })
    }
  },

  /**
   * 保存会话列表
   */
  saveSessions: async (): Promise<void> => {
    try {
      const state = get()
      await AsyncStorage.setItem('ai-general-sessions', JSON.stringify(state.sessions))
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 保存会话列表失败:', error)
    }
  },

  /**
   * 加载会话列表
   */
  loadSessions: async (): Promise<void> => {
    try {
      const data = await AsyncStorage.getItem('ai-general-sessions')
      if (data) {
        const sessions = JSON.parse(data) as AiGeneralSession[]
        set({ sessions })
      }
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 加载会话列表失败:', error)
      set({ sessions: [] })
    }
  },

  /**
   * 重命名会话
   */
  renameSession: async (sessionId: string, newName: string): Promise<void> => {
    try {
      const state = get()
      
      // 第1步：查找会话
      const updatedSessions = state.sessions.map(s => {
        if (s.sessionId === sessionId) {
          return { ...s, sessionName: newName, updateTime: Date.now() }
        }
        return s
      })
      
      // 第2步：更新会话列表
      set({ sessions: updatedSessions })
      
      // 第3步：如果当前会话，也更新
      if (state.currentSession?.sessionId === sessionId) {
        set({
          currentSession: {
            ...state.currentSession,
            sessionName: newName,
            updateTime: Date.now(),
          },
        })
      }
      
      // 第4步：保存会话列表
      await get().saveSessions()
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 重命名会话失败:', error)
      throw error
    }
  },

  /**
   * 切换置顶状态
   */
  togglePin: async (sessionId: string): Promise<void> => {
    try {
      const state = get()
      
      // 第1步：查找会话并切换置顶状态
      const updatedSessions = state.sessions.map(s => {
        if (s.sessionId === sessionId) {
          return { ...s, pinned: !s.pinned, updateTime: Date.now() }
        }
        return s
      })
      
      // 第2步：重新排序（置顶的排在前面）
      updatedSessions.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.updateTime - a.updateTime
      })
      
      // 第3步：更新会话列表
      set({ sessions: updatedSessions })
      
      // 第4步：保存会话列表
      await get().saveSessions()
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 置顶操作失败:', error)
      throw error
    }
  },

  /**
   * 删除会话
   */
  deleteSession: async (sessionId: string): Promise<void> => {
    try {
      const state = get()
      
      // 第1步：从列表中移除
      const updatedSessions = state.sessions.filter(s => s.sessionId !== sessionId)
      set({ sessions: updatedSessions })
      
      // 第2步：如果是当前会话，清空
      if (state.currentSession?.sessionId === sessionId) {
        set({ currentSession: null, messages: [] })
      }
      
      // 第3步：删除聊天历史
      await chatStorageService.removeChatHistory(`ai-general-${sessionId}`)
      
      // 第4步：保存会话列表
      await get().saveSessions()
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 删除会话失败:', error)
      throw error
    }
  },

  /**
   * 重置状态
   */
  resetState: (): void => {
    set({
      messages: [],
      currentSession: null,
      isChatLoading: false,
    })
  },

  /**
   * 自动生成会话标题（基于会话内容）
   */
  generateSessionTitle: async (
    sessionId: string,
    userInfo: UserInfo | null,
    _subject: 'MATH' | 'BIOLOGY'
  ): Promise<void> => {
    try {
      const state = get()
      
      // 第1步：查找会话
      const session = state.sessions.find(s => s.sessionId === sessionId)
      if (!session) {
        throw new Error('会话不存在')
      }
      
      // 第2步：获取前6条消息（3轮对话）
      const firstMessages = state.messages.slice(0, 6)
        .filter(m => m.sender === 'user' || m.sender === 'ai')
        .map(m => ({
          role: m.sender === 'user' ? '用户' : 'AI',
          content: m.content,
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
        await get().renameSession(sessionId, generatedTitle)
      } else {
        console.warn('[AI_GENERAL] ⚠️ AI未返回有效标题')
      }
      
    } catch (error) {
      console.error('[AI_GENERAL] ❌ 生成标题失败:', error)
      throw error
    }
  },

  /**
   * 切换Web搜索
   */
  toggleWebSearch: (): void => {
    const state = get()
    set({ enableWebSearch: !state.enableWebSearch })
  },

  /**
   * 设置待发送图片（用于拍作业场景）
   */
  setPendingImage: (imageData: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  }): void => {
    set({ pendingImage: imageData })
  },

  /**
   * 清除待发送图片
   */
  clearPendingImage: (): void => {
    set({ pendingImage: null })
  },
}))

