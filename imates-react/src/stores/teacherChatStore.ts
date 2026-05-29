import { create } from 'zustand'
import type { ChatBubble, UserInfo } from '../types'
import { Sender } from '../types/enums'
import { apiService } from '../services/http/api-service'
import { showMessage } from '@/utils'
import { getUserInfo, getUserId } from '../services/http/auth-service'
import { resolveTeacherImageUrl } from '@/config/env-config'
import { useUnreadMessageStore } from './unreadMessageStore'
import { getWebSocketService, destroyWebSocketService } from '../services/websocket/webSocketService'
import type { WebSocketMessage } from '../services/websocket/webSocketService'
import {
  checkAccountStatus,
  checkNotificationPermission,
  sendSystemNotification,
} from '../utils/account-status'
import {
  findMessageIndex,
  type ChatImageData,
} from './utils/chatStoreUtils'
import { validateAndFixTimestamp, validateSendMessagePreconditions } from '@/stores/utils/validation'

/**
 * 教师会话信息
 */
export interface TeacherSession {
  sessionId: string
  sessionName: string
  subject: string
  createTime: number
  msgCount?: number // 消息数量
  updateTime?: number // 更新时间
}

// 科目映射表：前端科目名称 -> 数据库科目ID
const SUBJECT_MAPPING: Record<string, string> = {
  CHINESE: '1',    // 语文
  MATH: '2',       // 数学
  ENGLISH: '3',    // 英语
  PHYSICS: '4',    // 物理
  CHEMISTRY: '5',  // 化学
  BIOLOGY: '6',    // 生物
  HISTORY: '7',    // 历史
  GEOGRAPHY: '8',  // 地理
  POLITICS: '9',   // 政治
}

/**
 * 从sessionId中解析科目ID
 */
const extractSubjectIdFromSessionId = (sessionId: string): string => {
  if (!sessionId || !sessionId.startsWith('teacher_')) {
    return '2' // 默认数学
  }

  const parts = sessionId.split('_')
  if (parts.length >= 3) {
    const subjectKey = parts[2].toUpperCase()
    return SUBJECT_MAPPING[subjectKey] || '2'
  }

  return '2'
}

// 获取写死的教师会话列表
const getHardcodedTeacherSessions = (): TeacherSession[] => {
  const userId = getUserId() || 'default'
  const now = Date.now()

  return [
    { sessionId: `teacher_${userId}_chinese`, sessionName: '语文', subject: 'CHINESE', createTime: now },
    { sessionId: `teacher_${userId}_math`, sessionName: '数学', subject: 'MATH', createTime: now },
    { sessionId: `teacher_${userId}_english`, sessionName: '英语', subject: 'ENGLISH', createTime: now },
    { sessionId: `teacher_${userId}_politics`, sessionName: '政治', subject: 'POLITICS', createTime: now },
    { sessionId: `teacher_${userId}_history`, sessionName: '历史', subject: 'HISTORY', createTime: now },
    { sessionId: `teacher_${userId}_geography`, sessionName: '地理', subject: 'GEOGRAPHY', createTime: now },
    { sessionId: `teacher_${userId}_physics`, sessionName: '物理', subject: 'PHYSICS', createTime: now },
    { sessionId: `teacher_${userId}_chemistry`, sessionName: '化学', subject: 'CHEMISTRY', createTime: now },
    { sessionId: `teacher_${userId}_biology`, sessionName: '生物', subject: 'BIOLOGY', createTime: now },
  ]
}

interface SessionCache {
  messages: ChatBubble[]
  pagination: {
    currentPage: number
    pageSize: number
    hasMore: boolean
    isLoadingMore: boolean
    total: number
  }
  chatResponseTimes: number
  lastUpdateTime: number
}

const CACHE_EXPIRE_TIME = 30 * 60 * 1000

interface TeacherChatState {
  messages: ChatBubble[]
  currentSession: TeacherSession | null
  isChatLoading: boolean
  isChatRendering: boolean
  chatResponseTimes: number
  enableWebSearch: boolean
  pagination: {
    currentPage: number
    pageSize: number
    hasMore: boolean
    isLoadingMore: boolean
    total: number
  }
  webSocketInitialized: boolean
  sessionCache: Map<string, SessionCache>
  
  // Actions
  setMessages: (messages: ChatBubble[]) => void
  addMessage: (message: ChatBubble) => void
  updateMessage: (messageId: string, updates: Partial<ChatBubble>) => void
  clearMessages: () => void
  setIsChatLoading: (loading: boolean) => void
  setSession: (session: TeacherSession) => void
  clearSession: () => void
  
  sendMessage: (content: string, imageData?: ChatImageData, sender?: Sender) => Promise<void>
  loadChatHistory: (sessionId: string, page?: number, loadMore?: boolean, forceRefresh?: boolean) => Promise<void>
  loadMoreChatHistory: () => Promise<void>
  refreshSessionCache: (sessionId: string) => Promise<void>
  
  initMessageReceiver: () => Promise<void>
  cleanupMessageReceiver: () => Promise<void>
  connectWebSocket: () => Promise<boolean>
  connectToTeacherSession: (sessionId: string) => Promise<boolean>
  activateTeacherSession: (sessionId: string, options?: { connect?: boolean; loadHistory?: boolean }) => Promise<boolean>
  
  // Helpers
  isCacheValid: (cache: SessionCache) => boolean
  saveSessionToCache: (sessionId: string) => void
  loadSessionFromCache: (sessionId: string) => boolean
  clearSessionCache: (sessionId: string) => void
  cleanupExpiredCache: () => void
  canViewAnswer: () => boolean
  loadAllSessions: () => Record<string, TeacherSession>
  getAvailableTeachers: () => Array<{ subject: 'BIOLOGY' | 'MATH'; name: string }>
  toggleWebSearch: () => void
}

export const useTeacherChatStore = create<TeacherChatState>((set, get) => {
  let initPromise: Promise<void> | null = null
  const activatePromiseMap = new Map<string, Promise<boolean>>()

  const isMessageDuplicate = (messageId: string): boolean => {
    return findMessageIndex(get().messages, messageId) >= 0
  }

  const checkAndRequestNotificationPermission = async (): Promise<void> => {
    try {
      const permissionChecked = sessionStorage.getItem('notification_permission_checked')
      if (!permissionChecked) {
        await checkNotificationPermission()
        sessionStorage.setItem('notification_permission_checked', 'true')
      }
    } catch (error) {
      console.warn('[TeacherStore] ⚠️ 检查通知权限失败:', error)
    }
  }

  const doInitMessageReceiver = async (): Promise<void> => {
    if (get().webSocketInitialized) return

    const webSocket = getWebSocketService('teacher')
    
    webSocket.connect().then(success => {
      if (success) {
        set({ webSocketInitialized: true })
      } else {
        console.warn('[TeacherStore] WebSocket连接建立失败')
      }
    }).catch(error => {
      console.error('[TeacherStore] WebSocket连接异常:', error)
    })

    webSocket.on('new_question', (message?: WebSocketMessage) => {
      if (!message) return
      console.log('[TeacherStore] 收到新问题通知:', message)
    })

    webSocket.on('teacher_response', (message?: WebSocketMessage) => {
      if (!message || !message.sessionId || !message.content || !message.messageId) return
      if (isMessageDuplicate(message.messageId)) return

      const validatedTimestamp = validateAndFixTimestamp(
        message.timestamp ? new Date(message.timestamp).getTime() : Date.now()
      )

      const teacherMessage: ChatBubble = {
        id: message.messageId,
        messageId: message.messageId,
        content: message.content,
        type: Sender.TEACHER,
        timestamp: new Date(validatedTimestamp).toISOString(),
        sender: Sender.TEACHER,
        messageType: message.msgType === '1' ? 'image' : 'text',
      }

      if (message.msgType === '1' && message.content) {
        const resolvedImageUrl = resolveTeacherImageUrl(message.content) || undefined
        teacherMessage.imageData = {
          filePath: message.content,
          width: 0,
          height: 0,
          fileSize: 0,
          base64DataUrl: resolvedImageUrl,
        }
      }

      get().addMessage(teacherMessage)

      if (get().currentSession?.sessionId !== message.sessionId) {
        useUnreadMessageStore.getState().markUnread(message.sessionId)
      }

      set((state) => ({ chatResponseTimes: state.chatResponseTimes + 1 }))
      showMessage('收到老师回复', 'info', 2000)

      if (document.hidden || !document.hasFocus()) {
        checkAndRequestNotificationPermission().then(() => {
          sendSystemNotification('收到老师消息', message.content?.substring(0, 50) || '收到老师回复')
        })
      }
    })

    webSocket.on('disconnected', () => set({ webSocketInitialized: false }))
    webSocket.on('connected', () => set({ webSocketInitialized: true }))
    webSocket.on('error', () => {
      console.error('[TeacherStore] WebSocket错误')
    })
  }

  return {
    messages: [],
    currentSession: null,
    isChatLoading: false,
    isChatRendering: false,
    chatResponseTimes: 0,
    enableWebSearch: false,
    pagination: {
      currentPage: 1,
      pageSize: 20,
      hasMore: true,
      isLoadingMore: false,
      total: 0
    },
    webSocketInitialized: false,
    sessionCache: new Map(),

    canViewAnswer: () => get().chatResponseTimes >= 3,

    isCacheValid: (cache) => (Date.now() - cache.lastUpdateTime) < CACHE_EXPIRE_TIME,

    saveSessionToCache: (sessionId) => {
      const { messages, pagination, chatResponseTimes, sessionCache } = get()
      const cache: SessionCache = {
        messages: [...messages],
        pagination: { ...pagination },
        chatResponseTimes,
        lastUpdateTime: Date.now()
      }
      const nextCache = new Map(sessionCache)
      nextCache.set(sessionId, cache)
      set({ sessionCache: nextCache })
    },

    loadSessionFromCache: (sessionId) => {
      const cache = get().sessionCache.get(sessionId)
      if (cache && get().isCacheValid(cache)) {
        set({
          messages: [...cache.messages],
          pagination: { ...cache.pagination },
          chatResponseTimes: cache.chatResponseTimes
        })
        return true
      }
      return false
    },

    clearSessionCache: (sessionId) => {
      const nextCache = new Map(get().sessionCache)
      if (nextCache.delete(sessionId)) {
        set({ sessionCache: nextCache })
      }
    },

    cleanupExpiredCache: () => {
      const now = Date.now()
      const { sessionCache } = get()
      const nextCache = new Map(sessionCache)
      let deleted = false

      nextCache.forEach((cache, sessionId) => {
        if ((now - cache.lastUpdateTime) >= CACHE_EXPIRE_TIME) {
          nextCache.delete(sessionId)
          deleted = true
        }
      })

      if (deleted) {
        set({ sessionCache: nextCache })
      }
    },

    setMessages: (messages) => set({ messages }),

    addMessage: (message) => {
      if (isMessageDuplicate(message.id)) return
      set((state) => {
        const nextMessages = [...state.messages, message]
        if (state.currentSession) {
          // 异步更新缓存，不阻塞状态更新
          setTimeout(() => get().saveSessionToCache(state.currentSession!.sessionId), 0)
        }
        return { messages: nextMessages }
      })
    },

    updateMessage: (messageId, updates) => {
      set((state) => {
        const index = findMessageIndex(state.messages, messageId)
        if (index < 0) return state
        const nextMessages = [...state.messages]
        nextMessages[index] = { ...nextMessages[index], ...updates }
        return { messages: nextMessages }
      })
    },

    clearMessages: () => set({ messages: [], chatResponseTimes: 0 }),

    setIsChatLoading: (loading) => set({ isChatLoading: loading }),

    setSession: (session) => {
      const prev = get().currentSession
      if (prev && prev.sessionId !== session.sessionId) {
        get().saveSessionToCache(prev.sessionId)
      }

      set({ currentSession: session })
      const loaded = get().loadSessionFromCache(session.sessionId)
      useUnreadMessageStore.getState().clearUnread(session.sessionId)
      
      if (!loaded) {
        get().loadChatHistory(session.sessionId)
      }
    },

    clearSession: () => {
      const curr = get().currentSession
      if (curr) get().saveSessionToCache(curr.sessionId)
      set({ currentSession: null, messages: [], chatResponseTimes: 0 })
    },

    sendMessage: async (content, imageData, sender = Sender.USER) => {
      if (!(await validateSendMessagePreconditions(
        get().currentSession,
        getUserInfo,
        checkAccountStatus,
        showMessage,
        (l: boolean) => set({ isChatLoading: l }),
        (r: boolean) => set({ isChatRendering: r })
      ))) return
      const webSocket = getWebSocketService('teacher')
      if (!webSocket.isConnected()) {
        const connected = await get().connectWebSocket()
        if (!connected) {
          showMessage('连接建立失败，请重试', 'error')
          return
        }
      }

      set({ isChatLoading: true, isChatRendering: true })

      try {
        const sessionId = get().currentSession!.sessionId
        const msgType = imageData ? '1' : '0'
        let msgContent = content
        
        if (imageData) {
          const rawImage = imageData.filePath || imageData.base64DataUrl || ''
          if (rawImage.startsWith('http') || rawImage.startsWith('/')) {
            msgContent = rawImage
          } else {
            const base64 = (imageData.base64DataUrl || imageData.filePath || '').toString()
            if (!base64.startsWith('data:')) {
              showMessage('图片数据异常', 'error')
              return
            }
            msgContent = await apiService.uploadImageToYanban(base64)
          }
        }

        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const subjectId = extractSubjectIdFromSessionId(sessionId)

        webSocket.sendMessage({
          type: 'STUDENT_MESSAGE',
          sessionId,
          content: msgContent,
          msgType,
          userId: getUserId() || '',
          messageId,
          subject: subjectId,
          timestamp: Date.now().toString(),
          senderType: sender,
        })
      } catch (error) {
        console.error('[TeacherStore] ❌ 发送失败:', error)
        showMessage('发送失败，请重试', 'error')
      } finally {
        set({ isChatLoading: false, isChatRendering: false })
      }
    },

    loadChatHistory: async (sessionId, page, loadMore = false, forceRefresh = false) => {
      try {
        if (!loadMore) {
          set({ 
            messages: [], 
            chatResponseTimes: 0,
            pagination: { ...get().pagination, currentPage: 1, hasMore: true, isLoadingMore: false }
          })
        } else {
          set((state) => ({ pagination: { ...state.pagination, isLoadingMore: true } }))
        }

        const pageToLoad = loadMore ? (page || get().pagination.currentPage + 1) : (page || 1)
        const historyData = await apiService.getTeacherChatHistory(sessionId, pageToLoad, get().pagination.pageSize)

        if (historyData && historyData.length > 0) {
          const historyMessages: ChatBubble[] = historyData.map((msg: any) => {
            const base: ChatBubble = {
              id: msg.messageId,
              messageId: msg.messageId,
              content: msg.content || '',
              type: msg.isSelf ? Sender.USER : Sender.AI,
              timestamp: new Date(msg.timestamp).toISOString(),
              sender: msg.isSelf ? Sender.USER : Sender.AI,
              messageType: msg.type,
            }

            if (msg.type === 'voice' && msg.content) {
              base.voiceData = { filePath: msg.content, duration: 0, fileSize: 0 }
            } else if (msg.type === 'image' && msg.content) {
              base.imageData = {
                filePath: msg.content,
                width: 0, height: 0, fileSize: 0,
                base64DataUrl: resolveTeacherImageUrl(msg.content) || undefined,
              }
            }
            return base
          })

          set((state) => {
            const nextMessages = loadMore ? [...historyMessages, ...state.messages] : [...state.messages, ...historyMessages]
            return {
              messages: nextMessages,
              pagination: {
                ...state.pagination,
                currentPage: pageToLoad,
                hasMore: historyData.length === state.pagination.pageSize,
                isLoadingMore: false
              }
            }
          })

          if (!loadMore) {
            get().saveSessionToCache(sessionId)
          }
        } else {
          set((state) => ({ pagination: { ...state.pagination, hasMore: false, isLoadingMore: false } }))
        }
      } catch (error) {
        console.error('[TeacherStore] ❌ 加载历史失败:', error)
        set((state) => ({ pagination: { ...state.pagination, isLoadingMore: false } }))
      }
    },

    loadMoreChatHistory: async () => {
      const { currentSession, pagination } = get()
      if (!currentSession || !pagination.hasMore || pagination.isLoadingMore) return
      await get().loadChatHistory(currentSession.sessionId, pagination.currentPage + 1, true)
    },

    refreshSessionCache: async (sessionId) => {
      get().clearSessionCache(sessionId)
      await get().loadChatHistory(sessionId, 1, false, true)
    },

    initMessageReceiver: async () => {
      if (initPromise) return initPromise
      initPromise = (async () => {
        try {
          await doInitMessageReceiver()
        } finally {
          initPromise = null
        }
      })()
      return initPromise
    },

    cleanupMessageReceiver: async () => {
      initPromise = null
      destroyWebSocketService('teacher')
      set({ webSocketInitialized: false })
    },

    connectWebSocket: async () => {
      const { webSocketInitialized } = get()
      const webSocket = getWebSocketService('teacher')
      if (webSocketInitialized && webSocket.isConnected()) return true

      if (!webSocketInitialized) {
        await get().initMessageReceiver()
        return true
      }
      return false
    },

    connectToTeacherSession: async (sessionId) => {
      const session = get().loadAllSessions()[sessionId]
      if (!session) return false
      get().setSession(session)
      return await get().connectWebSocket()
    },

    activateTeacherSession: async (sessionId, options) => {
      const connect = options?.connect !== false
      const loadHistory = options?.loadHistory !== false

      if (!sessionId) return false

      if (activatePromiseMap.has(sessionId)) {
        return activatePromiseMap.get(sessionId)!
      }

      const p = (async (): Promise<boolean> => {
        try {
          if (connect) {
            const connected = await get().connectToTeacherSession(sessionId)
            if (!connected) return false
          } else {
            const allSessions = get().loadAllSessions()
            const session = allSessions[sessionId]
            if (!session) {
              console.error('[TeacherStore] 未找到教师会话:', sessionId)
              return false
            }
            get().setSession(session)
          }

          if (loadHistory) {
            await get().loadChatHistory(sessionId, 1)
          }

          return true
        } finally {
          activatePromiseMap.delete(sessionId)
        }
      })()

      activatePromiseMap.set(sessionId, p)
      return p
    },

    loadAllSessions: () => {
      const sessions: Record<string, TeacherSession> = {}
      for (const s of getHardcodedTeacherSessions()) {
        sessions[s.sessionId] = { ...s }
      }
      return sessions
    },

    getAvailableTeachers: () => {
      return [
        { subject: 'MATH', name: '数学老师' },
        { subject: 'BIOLOGY', name: '生物老师' }
      ]
    },

    toggleWebSearch: () => set((state) => ({ enableWebSearch: !state.enableWebSearch }))
  }
})
