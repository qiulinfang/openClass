/**
 * 教师通用对话场景专用Store
 *
 * 职责：管理教师通用对话场景的所有聊天相关状态和逻辑
 * - 消息管理
 * - 发送消息到教师
 * - 教师会话管理
 * - 聊天历史持久化
 * - 重试逻辑
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/http/api-service'
import { showMessage } from '../utils'
import { getUserInfo, getUserId } from '../services'
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
import { validateAndFixTimestamp, validateSendMessagePreconditions } from './utils/validation'
import type { ChatBubble } from '../types'

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

/**
 * 获取写死的教师会话列表（按学科一一对应）
 * 会话 ID 规则：`teacher_${userId}_${subject}`，例如：`teacher_user123_math`、`teacher_user123_biology`
 */
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
 * 从sessionId中解析科目ID（直接返回数据库科目ID）
 * sessionId格式：teacher_${userId}_${subject}
 */
const extractSubjectIdFromSessionId = (sessionId: string): string => {
  if (!sessionId || !sessionId.startsWith('teacher_')) {
    return '2' // 默认数学
  }

  const parts = sessionId.split('_')
  if (parts.length >= 3) {
    const subjectKey = parts[2].toUpperCase() // 提取科目部分并转换为大写（如'MATH'）
    return SUBJECT_MAPPING[subjectKey] || '2' // 映射到数据库ID，默认数学
  }

  return '2' // 默认数学
}

// 获取写死的教师会话列表
const getHardcodedTeacherSessions = (): TeacherSession[] => {
  const userId = getUserId() || 'default'
  const now = Date.now()

  return [
    {
      sessionId: `teacher_${userId}_chinese`,
      sessionName: '语文',
      subject: 'CHINESE',
      createTime: now,
    },
    {
      sessionId: `teacher_${userId}_math`,
      sessionName: '数学',
      subject: 'MATH',
      createTime: now,
    },
    {
      sessionId: `teacher_${userId}_english`,
      sessionName: '英语',
      subject: 'ENGLISH',
      createTime: now,
    },
    {
      sessionId: `teacher_${userId}_politics`,
      sessionName: '政治',
      subject: 'POLITICS',
      createTime: now,
    },
    {
      sessionId: `teacher_${userId}_history`,
      sessionName: '历史',
      subject: 'HISTORY',
      createTime: now,
    },
    {
      sessionId: `teacher_${userId}_geography`,
      sessionName: '地理',
      subject: 'GEOGRAPHY',
      createTime: now,
    },
    {
      sessionId: `teacher_${userId}_physics`,
      sessionName: '物理',
      subject: 'PHYSICS',
      createTime: now,
    },
    {
      sessionId: `teacher_${userId}_chemistry`,
      sessionName: '化学',
      subject: 'CHEMISTRY',
      createTime: now,
    },
    {
      sessionId: `teacher_${userId}_biology`,
      sessionName: '生物',
      subject: 'BIOLOGY',
      createTime: now,
    },
  ]
}

export const useTeacherChatStore = defineStore('teacherChat', () => {

  const messages = ref<ChatBubble[]>([]) // 当前会话的消息列表，包含所有聊天消息（用户消息、教师回复等）


  const currentSession = ref<TeacherSession | null>(null) // 当前选中的教师会话信息（包含sessionId、sessionName、subject等）
  const isChatLoading = ref(false) // 聊天加载状态，表示是否正在发送消息或等待教师回复
  const isChatRendering = ref(false) // 聊天渲染状态，表示是否正在渲染教师回复内容
  const chatResponseTimes = ref(0) // 聊天响应次数计数器，记录已完成的对话轮数（用于判断是否可以查看答案）
  const enableWebSearch = ref(false) // 是否启用网络搜索功能（当前未使用，保留用于未来扩展）

  const VIEW_ANSWER_CHAT_TIMES = 3 // 查看答案所需的聊天次数阈值（达到此次数后可以查看答案）
  const canViewAnswer = computed(() => chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES) // 计算属性：是否可以查看答案（基于聊天响应次数）

  // WebSocket连接管理
  const webSocketInitialized = ref(false)
  
  // ==================== 会话管理 ====================

  /**
   * 设置当前会话
   */
  const setSession = (session: TeacherSession): void => {
    currentSession.value = session

    // 清除该会话的未读标记
    const unreadStore = useUnreadMessageStore()
    const unreadKey = `teacher_${session.sessionId}`
    unreadStore.clearUnread(unreadKey)

    // 注意：轮询由 initMessageReceiver 统一管理，这里不再单独启动
  }

  /**
   * 清除会话
   * 第1步：停止消息轮询
   * 第2步：清空当前会话信息
   * 第3步：清空消息列表
   */
  const clearSession = (): void => {
    currentSession.value = null
    clearMessages()
  }

  // ==================== 消息管理 ====================


  /**
   * 检查消息是否已存在（去重）
   */
  const isMessageDuplicate = (messageId: string): boolean => {
    const existingIndex = findMessageIndex(messages.value, messageId)
    if (existingIndex >= 0) {
      console.warn('[TeacherStore] ⚠️ 检测到重复消息，跳过处理:', {
        messageId,
        existingIndex,
        currentTotal: messages.value.length,
        existingContent: messages.value[existingIndex].content?.substring(0, 50),
        existingTimestamp: messages.value[existingIndex].timestamp,
      })
      return true
    }
    return false
  }

  /**
   * 添加消息到列表
   * 添加去重逻辑，防止重复添加相同 messageId 的消息
   */
  const addMessage = (message: ChatBubble): void => {
    // 检查是否已存在相同的消息ID
    const existingIndex = findMessageIndex(messages.value, message.id)
    if (existingIndex >= 0) {
      console.warn('[TeacherStore] ⚠️ [存储流程] 消息已存在，跳过重复添加:', {
        messageId: message.id,
        existingIndex,
        currentTotal: messages.value.length,
        existingContent: messages.value[existingIndex].content?.substring(0, 50),
      })
      return // 已存在，跳过添加
    }
    const oldCount = messages.value.length
    messages.value.push(message)
    console.log(`[messages] +1 添加消息 id=${message.id} ${oldCount}→${messages.value.length}`)
  }

  /**
   * 更新指定消息
   */
  const updateMessage = (messageId: string, updates: Partial<ChatBubble>): void => {
    const index = findMessageIndex(messages.value, messageId)
    if (index >= 0) {
      messages.value[index] = { ...messages.value[index], ...updates }
      console.log(`[messages] ~ 更新消息 id=${messageId} index=${index}`)
    }
  }

  /**
   * 清空消息列表
   */
  const clearMessages = (): void => {
    const oldCount = messages.value.length
    messages.value = []
    chatResponseTimes.value = 0
    console.log(`[messages] =0 清空消息 ${oldCount}→0`)
  }


  // ==================== 发送消息 ====================


  /**
   * 发送学生消息
   * 第1步：验证会话和WebSocket连接
   * 第2步：创建学生消息
   * 第3步：通过WebSocket直接发送到后端
   * 第4步：等待发送确认和教师回复
   */
  const sendMessage = async (content: string, imageData?: ChatImageData): Promise<void> => {
    if (!(await validateSendMessagePreconditions(
      currentSession.value,
      getUserInfo,
      checkAccountStatus,
      showMessage,
      (loading: boolean) => { isChatLoading.value = loading },
      (rendering: boolean) => { isChatRendering.value = rendering }
    ))) {
      return
    }

    const webSocket = getWebSocketService('teacher')
    if (!webSocket.isConnected()) {
      console.error('[TeacherStore] ❌ WebSocket未连接，无法发送消息')
      showMessage('连接未建立，请重试', 'error')
      return
    }

    // 注意：ChatView会在调用sendMessage前预先添加用户消息到store
    isChatLoading.value = true
    isChatRendering.value = true

    try {
      const sessionId = currentSession.value!.sessionId

      // 第5步：通过WebSocket发送学生消息到研伴后端
      const msgType = imageData ? '1' : '0' // 0=文本消息, 1=图片消息
      const msgContent = imageData ? imageData.base64DataUrl || imageData.filePath || content : content
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 从sessionId中解析科目ID（数据库ID）
      const subjectId = extractSubjectIdFromSessionId(sessionId)

      // 构建WebSocket消息
      const message: WebSocketMessage = {
        type: 'STUDENT_MESSAGE',
        sessionId: sessionId,
        content: msgContent,
        msgType: msgType,
        userId: getUserId() || '',
        messageId: messageId,
        subject: subjectId,  // 直接传递数据库科目ID
        timestamp: Date.now().toString()
      }

      // 发送消息
      webSocket.sendMessage(message)
      console.log('[TeacherStore] 📤 通过WebSocket发送学生消息:', message)

    } catch (error) {
      console.error('[TeacherStore] ❌ 发送学生消息异常:', error)
      showMessage('发送失败，请重试', 'error')

      // TODO: 可以在这里添加消息发送失败的处理逻辑，比如更新消息状态为失败
    } finally {
      // 第7步：重置加载状态
      isChatLoading.value = false
      isChatRendering.value = false
    }
  }





  /**
   * 加载聊天历史（从服务器获取历史消息）
   * 第1步：清空当前消息
   * 第2步：调用API获取历史消息
   * 第3步：转换数据格式并添加到消息列表
   */
  const loadChatHistory = async (sessionId: string, page?: number, pageSize?: number): Promise<void> => {
    try {
      // 第1步：清空当前消息
      messages.value = []
      chatResponseTimes.value = 0

      // 第2步：调用API获取历史消息
      const historyData = await apiService.getTeacherChatHistory(sessionId, page, pageSize)
      console.log("historyData",historyData.length)
      if (historyData && historyData.length > 0) {
        const historyMessages: ChatBubble[] = historyData
          .map((msg: {
            messageId: string
            content: string
            type: 'text' | 'image' | 'voice'
            isSelf: boolean
            timestamp: number
          }) => {
            // 构建消息对象（消息类型已在API层转换完成）
            const baseMessage: ChatBubble = {
              id: msg.messageId,
              messageId: msg.messageId,
              content: msg.content || '',
              type: msg.isSelf ? 'user' : 'ai', // 根据isSelf判断消息类型
              timestamp: new Date(msg.timestamp).toISOString(),
              sender: msg.isSelf ? 'user' : 'ai',
              messageType: msg.type, // 直接使用已转换的消息类型
            }

            // 处理多媒体消息
            if (msg.type === 'voice' && msg.content) {
              // 语音消息：msgContent是文件路径
              baseMessage.voiceData = {
                filePath: msg.content,
                duration: 0, // 后端可能没有时长信息
                fileSize: 0,
              }
            } else if (msg.type === 'image' && msg.content) {
              // 图片消息：msgContent是图片URL或base64
              baseMessage.imageData = {
                filePath: msg.content,
                width: 0,
                height: 0,
                fileSize: 0,
                base64DataUrl: msg.content.startsWith('data:') ? msg.content : undefined,
              }
            }

            return baseMessage
          })

        // 第3步：添加到消息列表
        if (historyMessages.length > 0) {
          messages.value.push(...historyMessages)
          console.log("historyMessages",historyMessages)
          console.log(`[TeacherStore] 从服务器加载了 ${historyMessages.length} 条历史消息`)
        }
      }

      console.log(`[TeacherStore] 初始化聊天历史加载完成，会话: ${sessionId}`)

    } catch (error) {
      console.error('[TeacherStore] ❌ 加载教师聊天历史失败:', error)
      // 加载失败时保持空历史，不抛出异常
      messages.value = []
      chatResponseTimes.value = 0
    }
  }



  /**
   * 加载所有会话（只返回写死的会话列表）
   */
  const loadAllSessions = (): Record<string, TeacherSession> => {
    // 只返回写死的会话列表
    const sessions: Record<string, TeacherSession> = {}

    // 将写死会话转换为记录格式
    for (const session of getHardcodedTeacherSessions()) {
      sessions[session.sessionId] = { ...session }
    }

    return sessions
  }

  const getAvailableTeachers = (): Array<{ subject: 'BIOLOGY' | 'MATH'; name: string }> => {
    // 只返回数学和生物两个科目，对应转发功能
    return [
      { subject: 'MATH', name: '数学老师' },
      { subject: 'BIOLOGY', name: '生物老师' }
    ]
  }




  // 标记是否已经初始化了消息接收器（本地标记）

  // 初始化 Promise 缓存，确保并发调用只执行一次初始化
  let initPromise: Promise<void> | null = null

  /**
   * 初始化教师消息接收器
   * 第1步：设置全局回调函数（如果还未设置）
   * 第2步：调用原生接口初始化RabbitMQ监听
   *
   * 使用 Promise 缓存机制，确保多个组件并发调用时只初始化一次
   */
  const initMessageReceiver = async (): Promise<void> => {
    // 如果正在初始化中，等待现有 Promise 完成
    if (initPromise) {
      return initPromise
    }

    // 创建新的初始化 Promise
    initPromise = (async () => {
      try {
        await doInitMessageReceiver()
      } finally {
        // 初始化完成后清除 Promise 缓存，允许后续重新初始化（如果需要）
        initPromise = null
      }
    })()

    return initPromise
  }


  /**
   * 检查并请求通知权限
   */
  const checkAndRequestNotificationPermission = async (): Promise<void> => {
    // 场景42：检查通知权限（首次收到消息时检查）
    // 只在权限未授予时检查一次，避免频繁提示
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


  /**
   * 实际执行初始化的内部函数
   */
  const doInitMessageReceiver = async (): Promise<void> => {
    if (!currentSession.value) {
      console.warn('[TeacherStore] 无当前会话，跳过WebSocket初始化')
      return
    }

    if (webSocketInitialized.value) {
      console.log('[TeacherStore] WebSocket已初始化，跳过重复初始化')
      return
    }

    // 获取WebSocket实例
    const webSocket = getWebSocketService('teacher')

    // 使用当前会话的sessionId设置WebSocket
    webSocket.setSessionId(currentSession.value.sessionId)

    // 连接到WebSocket服务器
    webSocket.connect().then(success => {
      if (success) {
        console.log('[TeacherStore] WebSocket连接建立成功')
      } else {
        console.warn('[TeacherStore] WebSocket连接建立失败，将使用HTTP轮询')
      }
    }).catch(error => {
      console.error('[TeacherStore] WebSocket连接异常:', error)
    })

    // 添加消息监听器（适配研伴后端功能）
    // 研伴后端只支持新问题推送通知
    webSocket.on('new_question', (message?: WebSocketMessage) => {
      if (!message) return
      console.log('[TeacherStore] 收到新问题通知:', message)

      // 处理新问题通知 - 可以触发会话列表刷新等操作
      // 这里可以添加刷新会话列表、显示通知等逻辑
    })

    // 教师回复推送功能
    webSocket.on('teacher_response', (message?: WebSocketMessage) => {
      if (!message) return
      console.log('[TeacherStore] 收到教师回复WebSocket消息:', message)

      try {
        // 验证消息格式
        if (!message.sessionId || !message.content || !message.messageId) {
          console.error('[TeacherStore] 教师回复消息格式不完整:', message)
          return
        }

        // 检查是否属于当前会话
        if (currentSession.value?.sessionId !== message.sessionId) {
          console.log('[TeacherStore] 教师回复不属于当前会话，跳过处理:', {
            currentSessionId: currentSession.value?.sessionId,
            messageSessionId: message.sessionId
          })
          return
        }

        // 检查消息是否已存在（去重）
        if (isMessageDuplicate(message.messageId)) {
          console.log('[TeacherStore] 教师回复消息已存在，跳过处理:', message.messageId)
          return
        }

        // 验证时间戳
        const validatedTimestamp = validateAndFixTimestamp(
          message.timestamp ? new Date(message.timestamp).getTime() : Date.now()
        )

        // 构建教师消息对象
        const teacherMessage: ChatBubble = {
          id: message.messageId,
          messageId: message.messageId,
          content: message.content,
          type: 'teacher',
          timestamp: new Date(validatedTimestamp).toISOString(),
          sender: 'teacher',
          messageType: message.msgType === '1' ? 'image' : 'text', // 0=文本, 1=图片
        }

        // 处理图片消息
        if (message.msgType === '1' && message.content) {
          teacherMessage.messageType = 'image'
          teacherMessage.imageData = {
            filePath: message.content,
            width: 0,
            height: 0,
            fileSize: 0,
            base64DataUrl: message.content.startsWith('data:') ? message.content : undefined,
          }
        }

        // 添加消息到列表
        addMessage(teacherMessage)
        console.log('[TeacherStore] 成功添加教师回复消息:', message.messageId)

        // 增加响应次数
        chatResponseTimes.value++

        // 显示通知
        showMessage('收到老师回复', 'info', 2000)

        // 发送系统通知（如果权限已授予且应用不在前台）
        if (document.hidden || !document.hasFocus()) {
          checkAndRequestNotificationPermission().then(() => {
            sendSystemNotification('收到老师消息', message.content?.substring(0, 50) || '收到老师回复')
          }).catch(error => {
            console.warn('[TeacherStore] 发送系统通知失败:', error)
          })
        }

      } catch (error) {
        console.error('[TeacherStore] 处理教师回复WebSocket消息失败:', error)
      }
    })

    webSocket.on('error', () => {
      console.error('[TeacherStore] WebSocket错误')
      // 不显示错误提示，因为连接失败不影响主要功能
    })

    webSocket.on('disconnected', () => {
      console.log('[TeacherStore] WebSocket连接断开')
      webSocketInitialized.value = false
    })

    webSocket.on('connected', () => {
      console.log('[TeacherStore] WebSocket连接成功')
      webSocketInitialized.value = true
      // 连接成功后不启动持续轮询，只在发送消息后检查回复
    })

    console.log('[TeacherStore] 初始化教师WebSocket系统完成')
  }

  /**
   * 清理消息接收器
   */
  const cleanupMessageReceiver = async (): Promise<void> => {
    // 清除初始化 Promise 缓存，允许重新初始化
    initPromise = null

    // 清理WebSocket连接
    destroyWebSocketService('teacher')
    webSocketInitialized.value = false

    console.log('[TeacherStore] 清理教师WebSocket接收器完成')
  }

  // ==================== 导出 ====================

  /**
   * 切换Web搜索
   */
  const toggleWebSearch = (): void => {
    enableWebSearch.value = !enableWebSearch.value
  }

  /**
   * 根据会话ID直接建立WebSocket连接（外部传入会话）
   * @param sessionId 要连接的教师会话ID
   * @returns Promise<boolean> 连接是否成功
   */
  const connectToTeacherSession = async (sessionId: string): Promise<boolean> => {
    try {
      // 1. 查找会话
      const allSessions = loadAllSessions()
      const session = allSessions[sessionId]

      if (!session) {
        console.error('[TeacherStore] 未找到教师会话:', sessionId)
        return false
      }

      // 2. 设置当前会话
      setSession(session)

      // 3. 建立连接
      const connected = await connectWebSocket()
      if (connected) {
        console.log('[TeacherStore] 成功连接到教师会话:', sessionId)
      }
      return connected
    } catch (error) {
      console.error('[TeacherStore] 连接教师会话失败:', sessionId, error)
      return false
    }
  }

  /**
   * 连接到WebSocket服务器（自动连接）
   */
  const connectWebSocket = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        // 获取WebSocket实例
        const webSocket = getWebSocketService('teacher')

        // 如果已经初始化且连接，直接返回成功
        if (webSocketInitialized.value && webSocket.isConnected()) {
          console.log('[TeacherStore] WebSocket已连接，无需重新连接')
          resolve(true)
          return
        }

        // 如果未初始化，先初始化
        if (!webSocketInitialized.value) {
          console.log('[TeacherStore] WebSocket未初始化，开始初始化并连接...')
          initMessageReceiver().then(() => {
            console.log('[TeacherStore] WebSocket初始化并连接成功')
            resolve(true)
          }).catch(error => {
            console.error('[TeacherStore] WebSocket初始化失败:', error)
            resolve(false)
          })
          return
        }

        // 如果已初始化但未连接，尝试重新连接
        console.log('[TeacherStore] WebSocket已初始化但未连接，尝试连接...')
        webSocket.connect().then(success => {
          if (success) {
            console.log('[TeacherStore] WebSocket重新连接成功')
            resolve(true)
          } else {
            console.warn('[TeacherStore] WebSocket重新连接失败')
            resolve(false)
          }
        }).catch(error => {
          console.error('[TeacherStore] WebSocket重新连接异常:', error)
          resolve(false)
        })

      } catch (error) {
        console.error('[TeacherStore] WebSocket连接异常:', error)
        resolve(false)
      }
    })
  }

  return {
    // 状态
    messages,
    currentSession,
    isChatLoading,
    isChatRendering,
    chatResponseTimes,
    enableWebSearch,
    VIEW_ANSWER_CHAT_TIMES,
    canViewAnswer,
    webSocketInitialized,

    // 会话管理
    setSession,
    clearSession,

    // 消息管理
    addMessage,
    updateMessage,
    clearMessages,
    sendMessage,

    // 历史记录
    loadChatHistory,

    // 消息接收
    initMessageReceiver,
    cleanupMessageReceiver,

    // 其他
    toggleWebSearch,

    // WebSocket管理
    connectWebSocket,
    connectToTeacherSession,

    // 会话存储管理（供外部组件使用）
    loadAllSessions,
    getAvailableTeachers,
  }
})
