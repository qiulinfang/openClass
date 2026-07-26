import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Sender, MessageType } from '@/types/enums'
import type { ChatBubble, AiGeneralSession } from '@/types/chat'
import { AiChatApi } from '@/services/api/aiChatApi'
import { ChatStorageService } from '@/services/chatStorageService'

export const useChatStore = defineStore('chat', () => {
  // 当前会话列表
  const sessions = ref<AiGeneralSession[]>([])
  // 当前激活的会话 ID
  const activeSessionId = ref<string>('')
  // 当前激活会话的消息列表 (ChatBubble[])
  const messages = ref<ChatBubble[]>([])
  // 是否正在生成中
  const isGenerating = ref<boolean>(false)
  // 当前引用回复的消息
  const quotedMessage = ref<ChatBubble | null>(null)
  // 是否开启联网搜索
  const enableWebSearch = ref<boolean>(false)
  // 当前选中的模型 (mate / mentor)
  const selectedModel = ref<string>('mate')

  // 初始化：从本地持久化装载会话列表与首条欢迎消息
  function initStore() {
    const savedSessions = ChatStorageService.getSessions()
    sessions.value = savedSessions

    if (savedSessions.length > 0 && !activeSessionId.value) {
      switchSession(savedSessions[0].sessionId)
    } else if (savedSessions.length === 0) {
      createNewSession()
    }
  }

  /**
   * 创建新的 AI 通用会话
   */
  function createNewSession(sessionName: string = '新对话'): AiGeneralSession {
    const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const newSession: AiGeneralSession = {
      sessionId: newSessionId,
      sessionName,
      createTime: Date.now(),
      updateTime: Date.now(),
      msgCount: 0,
      messages: []
    }

    sessions.value.unshift(newSession)
    ChatStorageService.saveSessions(sessions.value)
    switchSession(newSessionId)
    return newSession
  }

  /**
   * 切换激活会话
   */
  function switchSession(sessionId: string) {
    activeSessionId.value = sessionId
    const localMsgs = ChatStorageService.getSessionMessages(sessionId)

    if (localMsgs.length === 0) {
      // 若会话无消息，插入初始欢迎气泡
      const welcomeBubble: ChatBubble = {
        id: `welcome_${Date.now()}`,
        content: '你好！我是你的 AI 学习助手。你可以问我任何学科知识问题，比如：“讲解一下一元二次方程” 或 “英语时态怎么区分”。',
        sender: Sender.AI,
        type: Sender.AI,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messageType: 'text'
      }
      messages.value = [welcomeBubble]
      ChatStorageService.saveSessionMessages(sessionId, messages.value)
    } else {
      messages.value = localMsgs
    }
  }

  /**
   * 删除指定会话
   */
  function deleteSession(sessionId: string) {
    ChatStorageService.removeSession(sessionId)
    sessions.value = sessions.value.filter(s => s.sessionId !== sessionId)

    if (activeSessionId.value === sessionId) {
      if (sessions.value.length > 0) {
        switchSession(sessions.value[0].sessionId)
      } else {
        createNewSession()
      }
    }
  }

  /**
   * 设置引用回复消息
   */
  function setQuotedMessage(msg: ChatBubble | null) {
    quotedMessage.value = msg
  }

  /**
   * 保存当前会话状态到持久化
   */
  function saveCurrentState() {
    if (!activeSessionId.value) return
    // 保存消息列表
    ChatStorageService.saveSessionMessages(activeSessionId.value, messages.value)

    // 更新会话列表元数据
    const sessionIndex = sessions.value.findIndex(s => s.sessionId === activeSessionId.value)
    if (sessionIndex >= 0) {
      sessions.value[sessionIndex].msgCount = messages.value.length
      sessions.value[sessionIndex].updateTime = Date.now()
      ChatStorageService.saveSessions(sessions.value)
    }
  }

  /**
   * 自动打字/生成会话标题（3轮对话后触发，对齐 imates-web）
   */
  async function checkAutoGenerateTitle() {
    if (messages.value.length === 7) {
      const userFirstMsg = messages.value.find(m => m.sender === Sender.USER)
      if (userFirstMsg && activeSessionId.value) {
        const title = userFirstMsg.content.slice(0, 12) + (userFirstMsg.content.length > 12 ? '...' : '')
        const session = sessions.value.find(s => s.sessionId === activeSessionId.value)
        if (session) {
          session.sessionName = title
          ChatStorageService.saveSessions(sessions.value)
        }
      }
    }
  }

  /**
   * 发送用户消息主逻辑 (完全使用 ChatBubble Schema)
   */
  async function sendMessage(userContent: string) {
    if (!userContent || !userContent.trim() || isGenerating.value) return

    const text = userContent.trim()
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // 1. 构建用户 ChatBubble
    const userBubble: ChatBubble = {
      id: `user_${Date.now()}`,
      content: text,
      sender: Sender.USER,
      type: Sender.USER,
      timestamp: timestampStr,
      messageType: 'text',
      sessionId: activeSessionId.value,
      quotedMessage: quotedMessage.value
        ? {
            id: quotedMessage.value.id,
            content: quotedMessage.value.content,
            sender: quotedMessage.value.sender
          }
        : undefined
    }

    // 清空引用
    quotedMessage.value = null

    // 2. 构建 AI 占位 ChatBubble
    const aiBubbleId = `ai_${Date.now()}`
    const aiBubble: ChatBubble = {
      id: aiBubbleId,
      content: 'AI 思考中...',
      sender: Sender.AI,
      type: Sender.AI,
      timestamp: timestampStr,
      messageType: 'text',
      isStreaming: true,
      sessionId: activeSessionId.value
    }

    messages.value.push(userBubble, aiBubble)
    saveCurrentState()
    isGenerating.value = true

    try {
      // 3. 构建与 imates-web (buildAiGeneralMessage) 100% 严格一致的后端 Payload 请求体
      const userId = uni.getStorageSync('xuebanuserid') || 'User'
      const aiRequestPayload = {
        sessionId: activeSessionId.value,
        newValue: '1',
        coversation: text,     // 注意：imates-web 后端契约为 coversation
        query: text,           // 兼顾 query
        question: '',
        answer: '',
        name: userId,
        reason: 'start',       // 首帧为 start
        bmNo: activeSessionId.value,
        isWebSearch: enableWebSearch.value ? '1' : '0',
        role: selectedModel.value || 'mate',
        subject: '',
        explanation: ''
      }

      // 调用 AI 接口并进行增量流式更新 (第2个参数为 onComplete，第3个参数为 onStream)
      const res = await AiChatApi.sendChatMessage(
        aiRequestPayload,
        undefined,
        (chunkText: string, isComplete: boolean) => {
          const aiMsg = messages.value.find(m => m.id === aiBubbleId)
          if (aiMsg) {
            aiMsg.content = chunkText || 'AI 思考中...'
            aiMsg.isStreaming = !isComplete
          }
          messages.value = [...messages.value]
          saveCurrentState()
        }
      )

      if (res.success && res.messageId && !activeSessionId.value) {
        activeSessionId.value = res.messageId
      }

      await checkAutoGenerateTitle()
    } catch (err: any) {
      const aiMsg = messages.value.find(m => m.id === aiBubbleId)
      if (aiMsg) {
        aiMsg.content = '网络开小差了，请重发。'
        aiMsg.isStreaming = false
        aiMsg.isError = true
        aiMsg.canRetry = true
        aiMsg.originalMessage = text
      }
      saveCurrentState()
    } finally {
      isGenerating.value = false
    }
  }

  /**
   * 重试发送失败的消息
   */
  async function retryMessage(failedMsg: ChatBubble) {
    if (!failedMsg.originalMessage || isGenerating.value) return
    // 移除失败气泡
    messages.value = messages.value.filter(m => m.id !== failedMsg.id)
    await sendMessage(failedMsg.originalMessage)
  }

  /**
   * 删除单条消息
   */
  function deleteMessage(msgId: string) {
    messages.value = messages.value.filter(m => m.id !== msgId)
    saveCurrentState()
  }

  /**
   * 清空当前会话
   */
  function clearCurrentSession() {
    messages.value = []
    saveCurrentState()
    switchSession(activeSessionId.value)
  }

  return {
    sessions,
    activeSessionId,
    messages,
    isGenerating,
    quotedMessage,
    enableWebSearch,
    selectedModel,
    initStore,
    createNewSession,
    switchSession,
    deleteSession,
    setQuotedMessage,
    sendMessage,
    retryMessage,
    deleteMessage,
    clearCurrentSession
  }
})
