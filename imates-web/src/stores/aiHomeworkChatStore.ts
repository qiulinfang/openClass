import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/http/api-service'
import { chatStorage, type ChatHistoryData } from '../services/storage/chat-storage'
import type { AiChatMessageRequest, AiGeneralSession, AiHomeworkSession, ChatBubble, UserInfo, BackendHistoryMessage, HtmlPreviewFocus, AttachedScreenshot, ExerciseItem } from '../types'
import type { ChatQuotedMessage, ChatImageData } from './utils/chatStoreUtils'
import { getUserId } from '../services'
import localforage from 'localforage'
import { generateUniqueId } from './utils/chatStoreUtils'
import { useChatPersistence } from '@/composables/useChatPersistence'
import { useChatSessions } from '@/composables/useChatSessions'
import { useChatRetry } from '@/composables/useChatRetry'
import { useChatEngine } from '@/composables/useChatEngine'
import { useHtmlMessageRawMap } from '@/composables/useHtmlMessageRawMap'
import { validateGeneralChatRequest } from './utils/requestValidator'
import { getApiPaths } from '@/config/env-config'
import { Sender } from '@/types/enums'

/**
 * 构建 AI 作业对话消息请求
 */
const buildAiHomeworkMessage = (
  content: string,
  userInfo: UserInfo | null,
  enableWebSearch: boolean,
  chatRole: string = 'mate',
  sessionId?: string | null,
  useScreenshotApi: boolean = false,
  imageList?: { base64DataUrl: string }[],
  focus?: HtmlPreviewFocus,
  question?: ExerciseItem | null,
): AiChatMessageRequest => {
  const createSessionId = (maybeSessionId?: string) => {
    const userId = getUserId() || ''
    const finalSessionId = maybeSessionId || `${userId ? userId + '-' : ''}homework-session-${Date.now()}`
    return {
      sessionId: finalSessionId,
      newValue: '1',
    }
  }
  const { sessionId: finalSessionId, newValue } = createSessionId(sessionId ?? undefined)
  const dstUrl = useScreenshotApi ? getApiPaths().xueban.ai.previewPictureQA : getApiPaths().xueban.ai.chats
  
  const request: AiChatMessageRequest = {
    sessionId: finalSessionId,
    newValue,
    coversation: content,
    question: question?.question || '',
    answer: question?.answer || '',
    name: getUserId() || 'User',
    reason: 'start',
    bmNo: question?.bmNo || finalSessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    role: chatRole,
    subject: '',
    dstUrl,
    explanation: question?.explanation || '',
    imageList: imageList && imageList.length > 0 ? imageList : undefined,
    focus,
  }
  
  validateGeneralChatRequest(request, finalSessionId)
  return request
}

export const useAiHomeworkChatStore = defineStore('aiHomeworkChat', () => {
  // ==================== 状态定义 ====================
  
  const messages = ref<ChatBubble[]>([])
  const lastHistorySignature = ref<string>('')
  const sessions = ref<AiHomeworkSession[]>([])
  const currentSession = ref<AiHomeworkSession | null>(null)
  const isChatLoading = ref(false)
  const enableWebSearch = ref(false)
  const isCreatingSession = ref(false)
  const currentQuestionId = ref<string | null>(null)

  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])
  const inputScreenshotDrawingStates = ref<Record<string, unknown>>({})

  // 基于题目 ID 过滤的会话列表
  const filteredSessions = computed(() => {
    if (!currentQuestionId.value) return []
    const results = sessions.value.filter(s => s.metadata?.questionBmNo === currentQuestionId.value)
    console.log('[AI_HOMEWORK_STORE] filteredSessions 更新, contextId:', currentQuestionId.value, 'count:', results.length)
    return results
  })

  const chatPersistence = useChatPersistence<ChatHistoryData>(
    {
      save: async (key: string, payload: ChatHistoryData) => {
        // 强制转换为纯对象，解决 DataCloneError
        const sanitizedPayload = JSON.parse(JSON.stringify(payload))
        await chatStorage.saveChatHistory(key, sanitizedPayload)
      },
      load: async (key: string) => {
        return await chatStorage.loadChatHistory(key)
      },
    },
    { debounceMs: 0 }
  )

  const sessionPersistence = useChatSessions<AiHomeworkSession>({
    save: async (data) => {
      // 强制转换为纯对象，解决 DataCloneError
      const sanitizedData = JSON.parse(JSON.stringify(data))
      await localforage.setItem(`ai_homework_sessions_${getUserId()}`, sanitizedData)
    },
    load: async () => {
      const data = await localforage.getItem<AiHomeworkSession[]>(`ai_homework_sessions_${getUserId()}`)
      return data || []
    },
  })

  const { ensureHtmlRawMapForMessage } = useHtmlMessageRawMap(apiService)

  /**
   * 从消息列表中提取快照信息用于卡片展示
   */
  const extractSnapshotFromMessages = (
    msgs: ChatBubble[]
  ): { previewMessagesMarkdown: string[] } => {
    const MAX_PREVIEW = 5
    const previewMessagesMarkdown = msgs
      .slice(0, MAX_PREVIEW)
      .map(m => (typeof m.content === 'string' ? m.content : String(m.content || '')))
    
    return {
      previewMessagesMarkdown,
    }
  }

  // ==================== 方法定义 ====================

  const saveChatHistory = async (): Promise<void> => {
    if (!currentSession.value || messages.value.length === 0) return
    
    // 更新会话快照信息用于卡片缩略图展示
    const snapshot = extractSnapshotFromMessages(messages.value)
    currentSession.value.msgCount = messages.value.length
    currentSession.value.updateTime = Date.now()
    ;(currentSession.value as any).previewMessagesMarkdown = snapshot.previewMessagesMarkdown
    
    const historyData: ChatHistoryData = {
      questionId: currentSession.value.sessionId,
      messages: messages.value,
      chatResponseTimes: 0,
      lastUpdated: Date.now()
    }
    await chatPersistence.save(`ai-homework-${currentSession.value.sessionId}`, historyData)
    await saveSessions()
  }

  const chatEngine = useChatEngine({
    messagesRef: messages,
    lastHistorySignatureRef: lastHistorySignature,
    onAfterHistorySync: () => saveChatHistory(),
  })

  const setQuestionContext = async (questionId: string) => {
    console.log('[AI_HOMEWORK_STORE] 📥 setQuestionContext 调用开始, ID:', questionId)
    
    try {
      if (sessions.value.length === 0) {
        console.log('[AI_HOMEWORK_STORE] sessions 为空, 准备执行 loadSessions...')
        await loadSessions()
        console.log('[AI_HOMEWORK_STORE] loadSessions 完成, 当前总会话数:', sessions.value.length)
      }
      
      currentQuestionId.value = questionId
      console.log('[AI_HOMEWORK_STORE] currentQuestionId 已更新为:', currentQuestionId.value)
      
      try {
        const mySessions = sessions.value
          .filter(s => s.metadata?.questionBmNo === questionId)
          .sort((a, b) => (b.updateTime || 0) - (a.updateTime || 0))
        
        console.log(`[AI_HOMEWORK_STORE] 题目 ${questionId} 关联的会话数:`, mySessions.length)
        
        if (mySessions.length > 0) {
          const targetSessionId = mySessions[0].sessionId
          console.log('[AI_HOMEWORK_STORE] 🎯 准备切换到匹配会话:', targetSessionId)
          if (currentSession.value?.sessionId !== targetSessionId) {
            await switchSession(targetSessionId)
            console.log('[AI_HOMEWORK_STORE] ✅ 成功加载历史记录')
          } else {
            console.log('[AI_HOMEWORK_STORE] ℹ️ 已在目标会话，无需切换')
          }
        } else {
          console.log('[AI_HOMEWORK_STORE] ℹ️ 该题目暂无历史会话, 重置界面')
          messages.value = []
          currentSession.value = null
        }
      } catch (err) {
        console.error('[AI_HOMEWORK_STORE] 过滤或切换会话失败:', err)
      }
    } catch (error) {
      console.error('[AI_HOMEWORK_STORE] ❌ setQuestionContext 执行失败:', error)
    }
  }

  const sendMessage = async (
    content: string,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    question: ExerciseItem | null,
    selectedModel: string = 'mate',
    skipUserMessage?: boolean,
    quotedMessage?: ChatQuotedMessage,
    imageData?: ChatImageData,
    imageList?: ChatImageData[],
    focus?: HtmlPreviewFocus,
  ): Promise<void> => {
    if (!currentSession.value) {
      await createSession(content)
    }
    
    if (!skipUserMessage) {
      const userMessage: ChatBubble = {
        id: Date.now().toString(),
        content,
        type: Sender.USER,
        timestamp: new Date().toISOString(),
        sender: Sender.USER,
        messageType: 'text',
        sessionId: currentSession.value?.sessionId,
        quotedMessage,
      }
      messages.value.push(userMessage)
    }

    const tempReplyId = generateUniqueId('temp_ai')
    const tempReply: ChatBubble = {
      id: tempReplyId,
      content: '',
      type: Sender.AI,
      timestamp: new Date().toISOString(),
      sender: Sender.AI,
      isStreaming: false,
      selectedModel: selectedModel || 'mate'
    }
    messages.value.push(tempReply)
    
    const useScreenshotApi = !!(imageData || (imageList && imageList.length > 0))
    const imageListForRequest = imageList?.map(img => ({ base64DataUrl: img.base64DataUrl! })) 
      || (imageData ? [{ base64DataUrl: imageData.base64DataUrl! }] : undefined)

    const aiRequest = buildAiHomeworkMessage(
      content,
      userInfo,
      enableWebSearch.value,
      selectedModel,
      currentSession.value?.sessionId,
      useScreenshotApi,
      imageListForRequest,
      focus,
      question
    )
    
    try {
      const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)
      await apiService.sendChatMessage(aiRequest, onComplete, onStream, onHistoryUpdate)
      await saveChatHistory()
    } catch (error) {
      console.error('[AI_HOMEWORK] 发送失败:', error)
      const index = messages.value.findIndex(m => m.id === tempReplyId)
      if (index >= 0) {
        messages.value[index] = { ...tempReply, content: '发送失败，请重试', isStreaming: false, isError: true, canRetry: true, originalMessage: content }
      }
      throw error
    }
  }

  const createSession = async (firstMessage: string): Promise<void> => {
    if (!currentQuestionId.value) return
    isCreatingSession.value = true
    try {
      const userId = getUserId() || ''
      const newSession: AiHomeworkSession = {
        sessionId: `${userId ? userId + '-' : ''}homework-session-${Date.now()}`,
        sessionName: firstMessage.substring(0, 20),
        createTime: Date.now(),
        updateTime: Date.now(),
        msgCount: 0,
        metadata: { questionBmNo: currentQuestionId.value }
      }
      
      sessions.value.unshift(newSession)
      currentSession.value = newSession
      messages.value = []
      await saveSessions()
    } finally {
      isCreatingSession.value = false
    }
  }

  const switchSession = async (sessionId: string): Promise<void> => {
    const session = sessions.value.find(s => s.sessionId === sessionId)
    if (!session) return
    currentSession.value = session
    await loadChatHistory(sessionId)
  }

  const loadChatHistory = async (sessionId: string): Promise<void> => {
    isChatLoading.value = true
    try {
      const historyData = await chatPersistence.load(`ai-homework-${sessionId}`)
      messages.value = historyData?.messages || []
    } finally {
      isChatLoading.value = false
    }
  }

  const saveSessions = async () => {
    await sessionPersistence.save(sessions.value)
  }

  const loadSessions = async () => {
    sessions.value = await sessionPersistence.load()
  }

  const resetState = (resetContext = true) => {
    messages.value = []
    currentSession.value = null
    if (resetContext) {
      currentQuestionId.value = null
    }
  }

  const deleteSession = async (sessionId: string) => {
    const index = sessions.value.findIndex(s => s.sessionId === sessionId)
    if (index >= 0) {
      sessions.value.splice(index, 1)
      if (currentSession.value?.sessionId === sessionId) {
        currentSession.value = null
        messages.value = []
      }
      await localforage.removeItem(`chat_history_session_${sessionId}`)
      await saveSessions()
    }
  }

  return {
    messages,
    sessions,
    filteredSessions,
    currentSession,
    isChatLoading,
    enableWebSearch,
    currentQuestionId,
    inputAttachedScreenshots,
    inputScreenshotDrawingStates,
    sendMessage,
    setQuestionContext,
    createSession,
    switchSession,
    deleteSession,
    resetState,
    loadSessions,
    saveChatHistory,
    setInputAttachedScreenshots: (shots: AttachedScreenshot[]) => { inputAttachedScreenshots.value = shots },
    clearInputAttachedScreenshots: () => { inputAttachedScreenshots.value = [] },
    removeInputAttachedScreenshot: (id: string) => { inputAttachedScreenshots.value = inputAttachedScreenshots.value.filter(s => s.id !== id) },
    setInputScreenshotDrawingStates: (states: any) => { inputScreenshotDrawingStates.value = states }
  }
})
