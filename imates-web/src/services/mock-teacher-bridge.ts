/**
 * 模拟老师对话功能（仅开发环境使用）
 * 用于在 Web 环境中模拟 Android Bridge 的老师对话接口
 * 
 * 注意：此功能仅在开发环境启用，生产环境不会加载
 */

// 检测是否为开发环境（用于日志输出等）
const isDev = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true'

// 检查是否在真实的 Android WebView 环境中
function isRealAndroidWebView(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  // 检查是否有真实的 AndroidBridge 且包含关键方法
  return !!(
    window.AndroidBridge &&
    typeof window.AndroidBridge.sendTextMessageToTeacher === 'function' &&
    // 真实的 AndroidBridge 通常会有一些原生特有的方法
    // 如果只有我们模拟的方法，说明是模拟环境
    !window.AndroidBridge.sendTextMessageToTeacher.toString().includes('[MockTeacherBridge]')
  )
}

// 消息历史存储键前缀
const STORAGE_KEY_PREFIX = 'mock_teacher_chat_history_'

// 模拟消息ID生成器（生成符合UUID格式的ID）
function generateMessageId(): string {
  // 使用浏览器原生的 crypto.randomUUID() 生成标准UUID格式
  // 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // 降级方案：手动生成UUID格式的ID
  // UUID格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12)
  const randomHex = (length: number): string => {
    let result = ''
    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 16).toString(16)
    }
    return result
  }
  
  // 生成符合UUID格式的字符串：8-4-4-4-12
  return `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`
}

// 模拟老师回复的模板
const TEACHER_REPLY_TEMPLATES = [
  '好的，我理解了你的问题。',
  '这是一个很好的问题，让我来帮你解答。',
  '根据你提供的信息，我建议你...',
  '这个问题需要从几个方面来分析：',
  '我明白你的困惑，让我详细解释一下。',
  '你的思路是对的，我们可以这样继续...',
  '这是一个常见的疑问，我来为你解答。',
  '根据题目内容，我们可以这样思考...',
]

// 随机选择回复模板
function getRandomReply(content: string): string {
  const template = TEACHER_REPLY_TEMPLATES[Math.floor(Math.random() * TEACHER_REPLY_TEMPLATES.length)]
  // 简单模拟：根据用户消息长度生成不同长度的回复
  const userLength = content.length
  if (userLength < 20) {
    return `${template}请详细描述一下你的问题。`
  } else if (userLength < 50) {
    return `${template}我会仔细分析并给出建议。`
  } else {
    return `${template}这是一个比较复杂的问题，我会为你提供详细的解答。`
  }
}

// 消息历史项类型
interface MessageHistoryItem {
  messageId: string
  sessionId: string
  content: string
  type: number
  isSelf: boolean
  timestamp: number
  chatRole: string
  imagePath?: string
  voicePath?: string
  duration?: string
  forwarded?: boolean
}

// 获取或创建消息历史
function getMessageHistory(sessionId: string): MessageHistoryItem[] {
  try {
    const key = `${STORAGE_KEY_PREFIX}${sessionId}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('[MockTeacherBridge] ❌ 读取消息历史失败:', error)
    return []
  }
}

// 保存消息历史
function saveMessageHistory(sessionId: string, messages: MessageHistoryItem[]): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${sessionId}`
    localStorage.setItem(key, JSON.stringify(messages))
  } catch (error) {
    console.error('[MockTeacherBridge] ❌ 保存消息历史失败:', error)
  }
}

// 添加消息到历史
function addMessageToHistory(sessionId: string, message: MessageHistoryItem): void {
  const history = getMessageHistory(sessionId)
  history.push(message)

  // 为避免 mock 环境下 localStorage 占用过大，这里限制每个会话最多保留最近的 N 条消息
  const MAX_HISTORY = 200
  const trimmedHistory =
    history.length > MAX_HISTORY ? history.slice(history.length - MAX_HISTORY) : history

  saveMessageHistory(sessionId, trimmedHistory)
}

/**
 * 初始化模拟的 AndroidBridge 老师对话功能
 * 仅在开发环境且 AndroidBridge 不可用时启用
 */
export function initMockTeacherBridge(): void {
  if (typeof window === 'undefined') {
    return
  }

  // 如果已经在真实的 Android WebView 环境中，不启用模拟
  if (isRealAndroidWebView()) {
    return
  }

  // 如果 AndroidBridge 已存在且不是我们模拟的，不覆盖
  if (window.AndroidBridge?.sendTextMessageToTeacher) {
    const funcStr = window.AndroidBridge.sendTextMessageToTeacher.toString()
    // 检查是否是我们模拟的函数（包含我们的标识）
    if (!funcStr.includes('[MockTeacherBridge]') && !funcStr.includes('模拟发送文本消息')) {
      return
    }
  }

  // 如果没有真实的 AndroidBridge，即使不在开发环境也启用模拟（用于浏览器测试）
  // 这样可以确保在浏览器环境中也能正常测试老师对话功能

  // 确保 AndroidBridge 对象存在
  if (!window.AndroidBridge) {
    window.AndroidBridge = {} as NonNullable<typeof window.AndroidBridge>
  }

  const bridge = window.AndroidBridge!

  // 模拟发送文本消息给老师
  bridge.sendTextMessageToTeacher = (
    content: string,
    sessionId: string,
    subject: string
  ): string => {

    // 保存用户消息到历史
    const userMessage = {
      messageId: generateMessageId(),
      sessionId,
      content,
      type: 0, // TEXT
      isSelf: true,
      timestamp: Date.now(),
      chatRole: 'user',
    }
    addMessageToHistory(sessionId, userMessage)

    // 模拟异步响应（延迟 1-2 秒）
    const delay = 1000 + Math.random() * 1000
    setTimeout(() => {
      // 生成模拟的老师回复
      const teacherReply = getRandomReply(content)
      const teacherMessage = {
        messageId: generateMessageId(),
        sessionId,
        content: teacherReply,
        type: 0, // TEXT
        isSelf: false,
        timestamp: Date.now(),
        chatRole: 'teacher',
      }

      // 保存老师消息到历史
      addMessageToHistory(sessionId, teacherMessage)

      // 触发消息接收回调
      if (window.onTeacherMessageReceived) {
        window.onTeacherMessageReceived(teacherMessage)
      }
    }, delay)

    // 立即返回成功响应
    return JSON.stringify({
      success: true,
      message: '消息已发送（模拟）',
      data: {
        messageId: userMessage.messageId,
        timestamp: userMessage.timestamp,
      },
    })
  }

  // 模拟发送图片消息给老师
  bridge.sendPictureToTeacher = (
    imagePath: string,
    sessionId: string,
    subject: string
  ): string => {

    // 保存用户图片消息到历史
    const userMessage = {
      messageId: generateMessageId(),
      sessionId,
      content: '[图片]',
      type: 1, // IMAGE
      isSelf: true,
      timestamp: Date.now(),
      chatRole: 'user',
      imagePath,
    }
    addMessageToHistory(sessionId, userMessage)

    // 模拟异步响应（延迟 1.5-2.5 秒）
    const delay = 1500 + Math.random() * 1000
    setTimeout(() => {
      // 生成模拟的老师回复
      const teacherReply = '我看到了你发送的图片，让我来分析一下。'
      const teacherMessage = {
        messageId: generateMessageId(),
        sessionId,
        content: teacherReply,
        type: 0, // TEXT
        isSelf: false,
        timestamp: Date.now(),
        chatRole: 'teacher',
      }

      // 保存老师消息到历史
      addMessageToHistory(sessionId, teacherMessage)

      // 触发消息接收回调
      if (window.onTeacherMessageReceived) {
        window.onTeacherMessageReceived(teacherMessage)
      }
    }, delay)

    // 立即返回成功响应
    return JSON.stringify({
      success: true,
      message: '图片已发送（模拟）',
      data: {
        messageId: userMessage.messageId,
        timestamp: userMessage.timestamp,
      },
    })
  }

  // 模拟发送语音消息给老师
  bridge.sendVoiceMessageToTeacher = (
    voicePath: string,
    duration: string,
    sessionId: string,
    subject: string
  ): string => {

    // 保存用户语音消息到历史
    const userMessage = {
      messageId: generateMessageId(),
      sessionId,
      content: '[语音]',
      type: 2, // VOICE
      isSelf: true,
      timestamp: Date.now(),
      chatRole: 'user',
      voicePath,
      duration,
    }
    addMessageToHistory(sessionId, userMessage)

    // 模拟异步响应（延迟 1.5-2.5 秒）
    const delay = 1500 + Math.random() * 1000
    setTimeout(() => {
      // 生成模拟的老师回复
      const teacherReply = '我听到了你的语音消息，让我来为你解答。'
      const teacherMessage = {
        messageId: generateMessageId(),
        sessionId,
        content: teacherReply,
        type: 0, // TEXT
        isSelf: false,
        timestamp: Date.now(),
        chatRole: 'teacher',
      }

      // 保存老师消息到历史
      addMessageToHistory(sessionId, teacherMessage)

      // 触发消息接收回调
      if (window.onTeacherMessageReceived) {
        window.onTeacherMessageReceived(teacherMessage)
      }
    }, delay)

    // 立即返回成功响应
    return JSON.stringify({
      success: true,
      message: '语音已发送（模拟）',
      data: {
        messageId: userMessage.messageId,
        timestamp: userMessage.timestamp,
      },
    })
  }

  // 模拟转发AI聊天到老师
  bridge.forwardAiChatToTeacher = (
    selectedMessagesData: string,
    teacherSessionId: string
  ): string => {
      try {
        const messages = JSON.parse(selectedMessagesData) as Array<{
          content?: string
          type?: string
        }>
        if (!Array.isArray(messages)) {
          throw new Error('消息数据格式错误')
        }

        // 将转发的消息添加到历史
        messages.forEach((msg) => {
        const forwardedMessage = {
          messageId: generateMessageId(),
          sessionId: teacherSessionId,
          content: msg.content || '',
          type: msg.type === 'TEXT' ? 0 : msg.type === 'IMAGE' ? 1 : msg.type === 'VOICE' ? 2 : 0,
          isSelf: true,
          timestamp: Date.now(),
          chatRole: 'user',
          forwarded: true,
        }
        addMessageToHistory(teacherSessionId, forwardedMessage)
      })

      // 模拟异步响应（延迟 1-2 秒）
      const delay = 1000 + Math.random() * 1000
      setTimeout(() => {
        // 生成模拟的老师回复
        const teacherReply = `我收到了你转发的 ${messages.length} 条消息，让我来帮你分析一下。`
        const teacherMessage = {
          messageId: generateMessageId(),
          sessionId: teacherSessionId,
          content: teacherReply,
          type: 0, // TEXT
          isSelf: false,
          timestamp: Date.now(),
          chatRole: 'teacher',
        }

        // 保存老师消息到历史
        addMessageToHistory(teacherSessionId, teacherMessage)

        // 触发消息接收回调
        if (window.onTeacherMessageReceived) {
          window.onTeacherMessageReceived(teacherMessage)
        }
      }, delay)

      const result = JSON.stringify({
        success: true,
        message: `已转发 ${messages.length} 条消息（模拟）`,
      })
      return result
    } catch (error) {
      console.error('[MockTeacherBridge] ❌ 转发失败:', error)
      const errorResult = JSON.stringify({
        success: false,
        message: '转发失败: ' + (error instanceof Error ? error.message : '未知错误'),
      })
      return errorResult
    }
  }

  // 模拟获取老师聊天历史
  bridge.getTeacherChatHistory = (sessionId: string): string => {
    const history = getMessageHistory(sessionId)
    return JSON.stringify(history)
  }

  // 模拟检查会话是否存在
  bridge.checkTeacherSessionExists = (sessionId: string): string => {
    const history = getMessageHistory(sessionId)
    return JSON.stringify({
      exists: history.length > 0,
    })
  }

  // 模拟获取当前会话消息数量
  bridge.getCurrentSessionMessageCount = (sessionId: string): string => {
    const history = getMessageHistory(sessionId)
    return JSON.stringify({
      count: history.length,
    })
  }

  // 模拟初始化消息监听器
  bridge.initTeacherMessageListener = (): string => {
    return JSON.stringify({
      success: true,
      message: '消息监听器已初始化（模拟）',
    })
  }

  // 模拟清理消息监听器
  bridge.cleanupTeacherMessageListener = (): string => {
    return JSON.stringify({
      success: true,
      message: '消息监听器已清理（模拟）',
    })
  }

  // 模拟检查消息管理器是否已初始化
  bridge.isMessagingManagerInitialized = (): boolean => {
    return true
  }

  // 模拟检查消息管理器是否正在连接
  bridge.isMessagingManagerConnecting = (): boolean => {
    return false
  }

  // 模拟创建老师会话
  bridge.createTeacherChatSession = (
    aiSessionId: string,
    aiSessionName: string,
    subject: string
  ): string => {
    return JSON.stringify({
      success: true,
      message: '会话已创建（模拟）',
      data: {
        sessionId: aiSessionId,
        sessionName: aiSessionName,
        subject,
      },
    })
  }


}

// 立即执行初始化（如果是在浏览器环境中）
// 这样可以确保在任何 store 或组件使用之前，模拟功能已经就绪
// 关键：同步初始化，确保对象和方法在 store 检查时都已经存在
if (typeof window !== 'undefined') {
  // 立即同步初始化（不使用 setTimeout，避免时序问题）
  // 这些方法都是简单的函数，同步初始化不会阻塞
  try {
    initMockTeacherBridge()
  } catch (error) {
    console.error('[MockTeacherBridge] ❌ 初始化失败:', error)
  }
}

