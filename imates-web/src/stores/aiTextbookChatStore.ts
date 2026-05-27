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
import { apiService } from '../services/http/api-service'
import { chatStorage } from '../services/storage/chat-storage'
import { showMessage } from '../utils'
import { getUserInfo, getSubject, getUserId } from '../services'
import { useAiGeneralChatStore } from './aiGeneralChatStore'
import { useChatPersistence } from '@/composables/useChatPersistence'
import { useChatRetry } from '@/composables/useChatRetry'
import { useChatEngine } from '@/composables/useChatEngine'
import { useHtmlMessageRawMap } from '@/composables/useHtmlMessageRawMap'
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
  truncateText,
  type ChatImageData,
} from './utils/chatStoreUtils'
import type { AiChatMessageRequest, ChatBubble, UserInfo, BackendHistoryMessage, HtmlPreviewFocus, AttachedScreenshot } from '../types'
import { alignTailMessageIdsFromHistory, buildHistorySignature } from './utils/historySyncUtils'
import { validateTextbookChatRequest } from './utils/requestValidator'
import { getApiPaths } from '@/config/env-config'
import { Sender } from '@/types/enums'
import { addScreenshotSession } from '@/utils/storage/screenshotSessions'

interface TextbookChatHistoryData {
  questionId: string
  messages: ChatBubble[]
  lastUpdated: number
  chatResponseTimes: number
}

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
  content: string
  userInfo: UserInfo | null
  subject: string
  chatRole: string
  sessionId: string      // 后端会话ID (root session)
  resourceId?: string | null
  sectionName?: string | null
  chapterInfo?: {
    grade: string
    subject: string
    textbook: string
    chapter_title: string
  } | null
  imageData?: TextbookChatImageData
  useScreenshotApi?: boolean
  isNewSession?: boolean
  imageList?: TextbookChatImageData[] // 多图数据列表（用于截图多图场景）
  focus?: HtmlPreviewFocus
}

export const REQUIRED_CHAPTER_INFO_LIST = [
  {
    grade: '初一',
    subject: '数学',
    textbook: '探究型公开课',
    chapter_title: '最短路径的基本原理',
  },
  {
    grade: '初一',
    subject: '数学',
    textbook: '探究型公开课',
    chapter_title: '能移回去吗',
  },
  {
    grade: '初一',
    subject: '数学',
    textbook: '探究型公开课',
    chapter_title: '平行四边形的面积',
  },
  {
    grade: '初一',
    subject: '数学',
    textbook: '探究型公开课',
    chapter_title: '利用导数证明分式指数不等式',
  },
] as const

export const MINI_CLASS_CHAPTER_URL_MAP = [
  {
    chapterInfo: REQUIRED_CHAPTER_INFO_LIST[0],
    title: '微课',
    url: 'https://www.imates.com.cn:9099/wk/math/steiner-lab-tablet.html',
  },
  {
    chapterInfo: REQUIRED_CHAPTER_INFO_LIST[1],
    title: '微课',
    url: 'https://www.imates.com.cn:9099/wk/math/swallow-tool.html',
  },
  {
    chapterInfo: REQUIRED_CHAPTER_INFO_LIST[2],
    title: '微课',
    url: 'https://www.imates.com.cn:9099/wk/math/classtool1.html',
  },
  {
    chapterInfo: REQUIRED_CHAPTER_INFO_LIST[3],
    title: '微课',
    url: '', // TODO: 待提供具体的微课 URL
  },
] as const

export const getMiniClassConfig = (info: BuildTextbookMessageParams['chapterInfo']) => {
  if (!info) return undefined
  return MINI_CLASS_CHAPTER_URL_MAP.find((item) => {
    const required = item.chapterInfo
    return (
      info.grade === required.grade &&
      info.subject === required.subject &&
      info.textbook === required.textbook &&
      info.chapter_title === required.chapter_title
    )
  })
}

const getMatchedChapterInfo = (info: BuildTextbookMessageParams['chapterInfo']) => {
  const matched = getMiniClassConfig(info)
  return matched?.chapterInfo
}

const shouldSendChapterInfo = (info: BuildTextbookMessageParams['chapterInfo']): boolean => {
  if (!info) return false
  const keys = Object.keys(info)
  if (keys.length !== 4) return false
  if (!keys.every((k) => k === 'grade' || k === 'subject' || k === 'textbook' || k === 'chapter_title')) {
    return false
  }
  const matchedInfo = getMatchedChapterInfo(info)
  if (!matchedInfo) return false
  return (
    info.grade === matchedInfo.grade &&
    info.subject === matchedInfo.subject &&
    info.textbook === matchedInfo.textbook &&
    info.chapter_title === matchedInfo.chapter_title
  )
}

const buildAiTextbookMessage = ({
  sessionId,
  content,
  userInfo,
  subject,
  chatRole = 'mate',
  sectionName,
  chapterInfo,
  imageData,
  useScreenshotApi = false,
  isNewSession = true,
  imageList,
  focus,
}: BuildTextbookMessageParams): AiChatMessageRequest => {
  // 从 localStorage 获取 userId
  const userId = getUserId() || 'User'

  if (imageData?.base64DataUrl) {
    const questionDataUrl = imageData.base64DataUrl.startsWith('data:image/jpeg;')
      ? imageData.base64DataUrl.replace('data:image/jpeg;', 'data:image/jpg;')
      : imageData.base64DataUrl

    const request: AiChatMessageRequest = {
      sessionId,
      newValue: isNewSession ? '1' : '0',
      // 文本内容：使用用户输入的 content
      coversation: content,
      // 截图会话下，question 字段不用图片或文字，占位为空字符串即可
      question: '',
      answer: sectionName || '',
      name: userId,
      reason: 'start',
      bmNo: sessionId,
      isWebSearch: '0',
      role: chatRole,
      subject,
      sectionName: sectionName || undefined,
      chapter_info: shouldSendChapterInfo(chapterInfo) ? getMatchedChapterInfo(chapterInfo) : undefined,
      dstUrl: getApiPaths().xueban.ai.previewPictureQA,
      explanation: '', // 教材场景占位
      imageList,
      focus,
    }
    
    // 校验请求参数完整性
    validateTextbookChatRequest(request, sessionId)
    
    return request
  }

  const dstUrl = useScreenshotApi ? getApiPaths().xueban.ai.previewPictureQA : getApiPaths().xueban.ai.chats

  const request: AiChatMessageRequest = {
    sessionId,
    newValue: isNewSession ? '1' : '0',
    coversation: content,
    question: '',
    answer: sectionName || '',
    name: userId,
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: '0',
    role: chatRole,
    subject,
    sectionName: sectionName || undefined,
    chapter_info: shouldSendChapterInfo(chapterInfo) ? getMatchedChapterInfo(chapterInfo) : undefined,
    dstUrl,
    explanation: '', // 教材场景占位
    imageList,
    focus,
  }
  
  // 校验请求参数完整性
  validateTextbookChatRequest(request, sessionId)
  
  return request
}

export const useAiTextbookChatStore = defineStore('aiTextbookChat', () => {
  // ==================== 状态管理 ====================
  
  const messages = ref<ChatBubble[]>([])
  const lastHistorySignature = ref<string>('')
  const isChatLoading = ref(false) // 聊天加载状态
  const chatResponseTimes = ref(0) // 聊天响应次数计数器，记录已完成的对话轮数（用于判断是否可以查看答案）
  const enableWebSearch = ref(false) // 是否启用网络搜索功能（当前未使用，保留用于未来扩展）
  const resourceId = ref<string | null>(null) // 资源ID，用于加载消息历史
  const sectionName = ref<string | null>(null) // 章节名称：用于聊天接口透传上下文（PDF/学习场景）
  const chapterInfo = ref<{
    grade: string
    subject: string
    textbook: string
    chapter_title: string
  } | null>(null)
  const useScreenshotApi = ref(false)  // 是否使用截图接口（用于截图会话的后续消息）
  const currentSessionId = ref<string | null>(null) // 当前会话ID，用于加载消息历史
  const isNewSession = ref(true) // 是否是新会话
  const backendSessionId = ref<string | null>(null) // 后端会话ID，用于发送消息时的sessionId字段
  const backendSessionOwnerUserId = ref<string | null>(null) // backendSessionId 归属的 userId，用于避免切换账号后串会话
  const aiGeneralStore = useAiGeneralChatStore() // 引用 ai-general 场景，用于获取根会话ID
  // 当前挂在 AI 教材聊天输入框上的截图列表（PDF 场景）
  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])

  const setChapterInfo = (info: {
    grade: string
    subject: string
    textbook: string
    chapter_title: string
  } | null): void => {
    chapterInfo.value = info
  }

  const chatPersistence = useChatPersistence<TextbookChatHistoryData>(
    {
      save: async (key: string, payload: TextbookChatHistoryData) => {
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
    onAfterHistorySync: () => saveChatHistory(),
  })

  const { ensureHtmlRawMapForMessage } = useHtmlMessageRawMap(apiService)

  // 每张截图的 DrawingBoard 状态（按截图 id 索引）
  const inputScreenshotDrawingStates = ref<Record<string, ScreenshotDrawingState>>({})
  
  const VIEW_ANSWER_CHAT_TIMES = 3
  const canViewAnswer = computed(() => chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES)
  
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
    currentSessionId.value = null
    backendSessionId.value = null  // 同时重置后端会话ID
    backendSessionOwnerUserId.value = null
    isNewSession.value = true
  }

  // ========== 截图挂载管理（PDF 场景用） ==========

  const setInputAttachedScreenshots = (shots: AttachedScreenshot[]): void => {
    inputAttachedScreenshots.value = shots
  }

  const appendInputAttachedScreenshots = (shots: AttachedScreenshot[]): void => {
    if (!shots || shots.length === 0) return
    inputAttachedScreenshots.value = inputAttachedScreenshots.value.concat(shots)
  }

  const removeInputAttachedScreenshot = (id: string): void => {
    inputAttachedScreenshots.value = inputAttachedScreenshots.value.filter((shot) => shot.id !== id)
  }

  const clearInputAttachedScreenshots = (): void => {
    inputAttachedScreenshots.value = []
  }

  const setInputScreenshotDrawingStates = (states: Record<string, ScreenshotDrawingState>): void => {
    inputScreenshotDrawingStates.value = {
      ...inputScreenshotDrawingStates.value,
      ...states,
    }
  }

  const removeInputScreenshotDrawingState = (id: string): void => {
    const copy = { ...inputScreenshotDrawingStates.value }
    delete copy[id]
    inputScreenshotDrawingStates.value = copy
  }

  const clearInputScreenshotDrawingStates = (): void => {
    inputScreenshotDrawingStates.value = {}
  }
  
  /**
   * 删除消息及其之后的所有消息（AI教材场景）
   *
   * 规则与通用/解题一致：
   * - 选中 user：删该 user 及其之后所有消息
   * - 选中 ai：向前找到最近 user，从那条 user 起删到结尾
   */
  const deleteMessage = async (messageId: string): Promise<void> => {
    try {
      // 查找被点击消息在列表中的索引
      const index = messages.value.findIndex(m => m.id === messageId)
      if (index < 0) {
        throw new Error('消息不存在')
      }

      // 确定删除起点索引
      let startIndex = index
      const target = messages.value[index]

      if (target.sender === Sender.AI) {
        for (let i = index - 1; i >= 0; i--) {
          if (messages.value[i].sender === Sender.USER) {
            startIndex = i
            break
          }
        }
      }

      // 本地删除：从起点到末尾
      messages.value.splice(startIndex)

      // 保存更新后的聊天历史
      if (resourceId.value) {
        await saveChatHistory()
      }
    } catch (error) {
      console.error('[AI_TEXTBOOK] ❌ 删除消息失败:', error)
      throw error
    }
  }
  
  // ==================== 发送消息 ====================

  // 基于资源ID的会话ID持久化管理
  const RESOURCE_SESSION_KEY = 'ai_textbook_resource_sessions'

  /**
   * 获取资源ID到会话ID的映射
   */
  const getResourceSessionMap = (): Record<string, string> => {
    try {
      const stored = localStorage.getItem(RESOURCE_SESSION_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('[AI_TEXTBOOK] 读取资源会话映射失败:', error)
      return {}
    }
  }

  /**
   * 保存资源ID到会话ID的映射
   */
  const saveResourceSessionMap = (map: Record<string, string>): void => {
    try {
      localStorage.setItem(RESOURCE_SESSION_KEY, JSON.stringify(map))
    } catch (error) {
      console.error('[AI_TEXTBOOK] 保存资源会话映射失败:', error)
    }
  }
  /**
   * 确保存在一个可用的后端会话ID
   * 优先级：
   * 1. 使用 aiGeneral 顶部会话ID
   * 2. 使用已维护的 backendSessionId
   * 3. 创建新的会话ID并保存到 backendSessionId
   */
  const ensureTopGeneralSession = (): string => {
    const currentUserId = getUserId() || ''

    // 1. 优先使用 ai-general 顶部会话ID
    if (aiGeneralStore.sessions.length > 0) {
      const topSession = aiGeneralStore.sessions[0]
      backendSessionId.value = topSession.sessionId
      backendSessionOwnerUserId.value = currentUserId
      return topSession.sessionId
    }

    // 2. ai-general 没有会话时：如果有资源ID，则新建 `${userId}_${resourceId}_textbook`
    if (resourceId.value) {
      const newSessionId = `${currentUserId}_${resourceId.value}_textbook`
      console.log('[AI_TEXTBOOK] 创建新的资源会话ID:', {
        resourceId,
        sessionId: newSessionId,
        userId: currentUserId,
      })
      return newSessionId
    }

    throw new Error('[AI_TEXTBOOK] resourceId 为空，无法生成教材会话ID')
  }
  // ========== 内部辅助方法 (私有逻辑) ==========

  /**
   * 1. 添加用户消息到列表并保存初步历史
   */
  const _addUserMessages = async (
    content: string,
    imageData?: ChatImageData,
    hidePrefix: boolean = false,
    quotedMessage?: { id: string; content: string; sender: Sender },
    imageList?: ChatImageData[],
  ) => {
    // 如果有图片列表，则创建 multi_image 类型的消息气泡
    if (imageList && imageList.length > 0) {
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
        type: Sender.USER,
        timestamp: new Date().toISOString(),
        sender: Sender.USER,
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
          type: Sender.USER,
          timestamp: new Date().toISOString(),
          sender: Sender.USER,
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

  /**
   * 2. 初始化会话 ID 上下文（保持前后端分离）
   */
  const _initSessionContext = () => {
    console.log('[AI_TEXTBOOK] >>> 进入 _initSessionContext', {
      currentSessionId: currentSessionId.value,
      isNewSession: isNewSession.value
    })

    // 确保前端会话 ID 已初始化（用于本地存储和 UI 分隔）
    if (!currentSessionId.value) {
      const userId = getUserId() || ''
      const generatedId = `${userId ? userId + '-' : ''}textbook-session-${Date.now()}`
      currentSessionId.value = generatedId
      isNewSession.value = true
      console.log('[AI_TEXTBOOK] _initSessionContext 生成了新的前端 ID:', generatedId)
    }

    // 确保后端会话 ID 唯一且与前端 ID 分隔开
    if (isNewSession.value || !backendSessionId.value) {
      const userId = getUserId() || ''
      backendSessionId.value = `${userId ? userId + '-' : ''}textbook-backend-${Date.now()}`
      console.log('[AI_TEXTBOOK] _initSessionContext 生成了新的后端 ID:', backendSessionId.value)
    }

    return {
      frontendId: currentSessionId.value,
      backendId: backendSessionId.value!,
      isBackendNew: isNewSession.value
    }
  }

  /**
   * 3. 持久化截图会话记录（侧边栏索引）
   */
  const _saveScreenshotRecord = async (
    content: string,
    finalResponse: any,
    builderImageData?: { base64DataUrl: string },
    builderImageList?: { base64DataUrl: string }[]
  ) => {
    const hasImages = !!builderImageData || !!(builderImageList && builderImageList.length > 0)
    
    if (hasImages && currentSessionId.value) {
      try {
        const now = Date.now()
        const firstImageData = builderImageData?.base64DataUrl || (builderImageList && builderImageList[0]?.base64DataUrl) || ''
        const finalResId = resourceId.value || ''

        const newSession = {
          sessionId: currentSessionId.value,
          sessionName: truncateText(content || '截图提问'),
          createTime: now,
          updateTime: now,
          msgCount: messages.value.length,
          pinned: false,
          thumbnailImage: firstImageData,
          hasImage: true,
          resourceId: finalResId,
          id: currentSessionId.value,
          question: content,
          answer: finalResponse?.reply || '', 
        }
        await addScreenshotSession(newSession)
      } catch (err) {
        console.error('[AI_TEXTBOOK] 持久化会话记录失败:', err)
      }
    }
  }

  /**
   * 发送聊天消息
   * 创建用户消息
   * 调用API发送
   * 处理流式响应
   * 错误处理和重试
   */
  const sendMessage = async (
    content: string,
    selectedModel?: string,
    imageData?: ChatImageData,
    hidePrefix: boolean = false,
    skipUserMessage?: boolean,
    quotedMessage?: { id: string; content: string; sender: Sender }, // 引用消息信息（用于消息气泡展示）
    imageList?: ChatImageData[], // 多图数据列表（用于截图多图场景）
    focus?: HtmlPreviewFocus,
  ): Promise<void> => {
    // 0. 自动识别截图提问场景：如果有图片，强制视为新会话
    const hasImages = !!imageData || !!(imageList && imageList.length > 0)
    if (hasImages && !skipUserMessage) {
      console.log('[AI_TEXTBOOK] 检测到截图提问，强制开启新会话状态')
      isNewSession.value = true
      currentSessionId.value = null // 清空旧 ID，确保 _initSessionContext 生成新 ID
    }

    // 1. 初始化 ID 上下文 (必须在添加任何消息之前执行，确保消息带有正确的 sessionId)
    const { backendId, isBackendNew } = _initSessionContext()

    console.log('[AI_TEXTBOOK] >>> sendMessage 入口', {
      content: content?.substring(0, 20),
      hasImageData: !!imageData,
      hasImageList: !!imageList?.length,
      currentSessionId: currentSessionId.value,
      isNewSession: isNewSession.value
    })
    
    // 2. 创建并添加用户消息（可选）
    if (!skipUserMessage) {
      await _addUserMessages(content, imageData, hidePrefix, quotedMessage, imageList)
    }
    
    // 3. 创建临时AI回复消息
    const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage(
      selectedModel || 'mate',
      currentSessionId.value || undefined,
    )
    addMessage(tempReply)
    
    try {
      const userInfo = getUserInfo()
      
      console.log("[AI_TEXTBOOK] 发送消息 ID 详情:", { 
        backendSessionId: backendId, 
        frontendSessionId: currentSessionId.value,
        newValue: isBackendNew ? '1' : '0'
      })

      // 4. 转换图片数据
      const builderImageData = imageData?.base64DataUrl ? { base64DataUrl: imageData.base64DataUrl } : undefined
      const builderImageList = imageList?.filter((img) => !!img.base64DataUrl).map((img) => ({ base64DataUrl: img.base64DataUrl! }))

      // 5. 构建请求对象
      const shouldUseScreenshotApi = !!builderImageData || !!(builderImageList && builderImageList.length > 0)
      const aiMessage = buildAiTextbookMessage({
        content,
        userInfo,
        subject: getSubject(),
        chatRole: selectedModel || 'mate',
        sessionId: backendId,
        resourceId: resourceId.value,
        sectionName: sectionName.value,
        chapterInfo: chapterInfo.value,
        imageData: builderImageData,
        useScreenshotApi: shouldUseScreenshotApi,
        isNewSession: isBackendNew,
        imageList: builderImageList,
        focus,
      })

      updateMessage(tempReplyId, { originalDstUrl: aiMessage.dstUrl })
      useScreenshotApi.value = shouldUseScreenshotApi
      isNewSession.value = false

      // 6. 处理流式回调
      const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)

      const wrappedOnComplete = async (finalResponse: any) => {
        await onComplete?.(finalResponse)
        
        // 持久化截图记录
        await _saveScreenshotRecord(content, finalResponse, builderImageData, builderImageList)

        if (isResponseSuccess(finalResponse)) {
          chatResponseTimes.value++
          await saveChatHistory()
        }
      }

      // 7. 执行 API 调用
      const response = await apiService.sendChatMessage(aiMessage, wrappedOnComplete, onStream, onHistoryUpdate)

      // 8. HTML 增强与后期处理
      const aiIndex = messages.value.findIndex((m) => m.id === tempReplyId)
      if (aiIndex >= 0) {
        const msg = messages.value[aiIndex]
        const changed = await ensureHtmlRawMapForMessage(msg, { logTag: 'AI_TEXTBOOK' })
        if (changed) {
          messages.value[aiIndex] = { ...msg }
          await saveChatHistory()
        }
      }
      
      if (!isResponseSuccess(response)) {
        const errorMessage = updateMessageError(tempReply, '抱歉，我暂时无法回答这个问题。请稍后重试。', content, imageData)
        updateMessage(tempReplyId, errorMessage)
        updateMessage(tempReplyId, { originalDstUrl: aiMessage.dstUrl })
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      const errorMessage = updateMessageError(tempReply, '发送失败，请检查网络连接后重试。', content, imageData)
      updateMessage(tempReplyId, errorMessage)
      showMessage('发送消息失败', 'error')
    }
  }
  
  // ==================== 重试消息 ====================
  
  /**
   * 重试失败的消息
   * 查找并验证消息
   * 检查重试条件
   * 删除失败的消息（本地+后端同步）
   * 重新发送消息（复用 sendMessage 逻辑）
   */
  const retryAiMessage = async (
    messageId: string,
    chatRole: string = 'mate',
    imageData?: ChatImageData
  ): Promise<void> => {
    // 查找消息
    const index = findMessageIndex(messages.value, messageId)
    try {
      validateMessageExists(index)
    } catch {
      showMessage('消息不存在', 'error')
      return
    }
    
    const message = messages.value[index]
    
    // 检查重试条件
    const { canRetry, error } = checkRetryCondition(message)
    if (!canRetry) {
      showMessage(error || '无法重试', 'warning')
      return
    }
    
    // 保存原始内容，用于重新发送
    const originalContent = message.originalMessage
    const originalQuotedMessage = message.quotedMessage
    const originalImageData = (message.imageData as ChatImageData | undefined) || imageData

    // 如果是多图截图气泡，提取原始 imageList，确保重试时仍然使用截图接口
    let originalImageList: ChatImageData[] | undefined
    if (message.messageType === 'multi_image' && Array.isArray(message.imageList) && message.imageList.length > 0) {
      originalImageList = message.imageList
        .filter((img) => !!img.base64DataUrl)
        .map((img) => ({
          filePath: img.filePath || '',
          width: img.width || 0,
          height: img.height || 0,
          fileSize: img.fileSize || 0,
          base64DataUrl: img.base64DataUrl!,
          isLargeImage: img.isLargeImage || false,
        }))
    }
    
    if (!originalContent) {
      showMessage('原始消息内容不存在', 'error')
      return
    }

    await retryHelper.retryByDeleteAndResend({
      ctx: {
        messages,
        deleteMessage,
      },
      messageId,
      selectedModel: chatRole,
      resend: async ({ originalContent, quotedMessage, selectedModel }) => {
        await sendMessage(
          originalContent,
          selectedModel || chatRole,
          originalImageData,
          false,
          false,
          quotedMessage,
          originalImageList,
        )
      },
    })
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
      currentSessionId.value = null
      backendSessionId.value = null  // 同时重置后端会话ID
      backendSessionOwnerUserId.value = null
      isNewSession.value = true
    }
  }

  const setSectionName = (name: string | null): void => {
    sectionName.value = name
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

      const payload: TextbookChatHistoryData = {
        questionId: storageKey,
        messages: messages.value,
        lastUpdated: Date.now(),
        chatResponseTimes: chatResponseTimes.value,
      }

      await chatPersistence.save(storageKey, payload)
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

      const data = await chatPersistence.load(storageKey)
      if (data && Array.isArray(data.messages)) {
        const enhancedMessages = await Promise.all(
          data.messages.map(async (message) => {
            await ensureHtmlRawMapForMessage(message, { logTag: 'AI_TEXTBOOK' })
            return message
          }),
        )
        
        messages.value = enhancedMessages
        chatResponseTimes.value = data.chatResponseTimes || 0
        
        // 🔄 保存增强后的历史消息（一次性升级）
        if (enhancedMessages.some((msg) => msg.messageType === 'html' && !!msg.rawHtmlMap)) {
          const enhancedData = { ...data, messages: enhancedMessages }
          await chatPersistence.save(storageKey, enhancedData)
          console.log(`🔄 [AI_TEXTBOOK] 历史消息 rawHtml 已增强并保存`)
        }
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

  const reloadHtmlImage = async (messageId: string, url: string): Promise<void> => {
    if (!messageId || !url) return
    const index = messages.value.findIndex((m) => m.id === messageId)
    if (index < 0) return

    const msg = messages.value[index]
    if (msg.messageType !== 'html') return
    if (!msg.rawHtmlMap) msg.rawHtmlMap = {}

    const prev = msg.rawHtmlMap[url]
    const prevHtml = prev?.[0] || ''
    msg.rawHtmlMap[url] = [prevHtml, '']
    messages.value[index] = { ...msg }

    const changed = await ensureHtmlRawMapForMessage(msg, {
      logTag: 'AI_TEXTBOOK',
      onlyUrls: [url],
      forceRender: true,
    })
    if (changed) {
      messages.value[index] = { ...msg }
    }
    await saveChatHistory()
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
  
  // ==================== 截图消息发送（PDF场景专用） ====================
  
  /**
   * 发送截图消息（封装PDF场景的完整数据逻辑）
   * - 清空截图列表
   * - 生成会话ID
   * - 发送消息
   * - 创建截图会话记录
   */
  const sendScreenshotMessage = async (
    text: string,
    shots: AttachedScreenshot[],
    selectedModel?: string,
  ): Promise<void> => {
    if (!shots || !shots.length) {
      return
    }

    // 用户点击发送时，立刻清空挂在输入框上的截图
    clearInputAttachedScreenshots()
    clearInputScreenshotDrawingStates()

    // 最多只保留前三张截图
    const limitedShots = shots.slice(0, 3)
    const firstShot = limitedShots[0]
    const dataUrl = firstShot.dataUrl

    // 设置当前教材ID（如果还没有设置）
    if (!resourceId.value) {
      console.warn('[AI_TEXTBOOK] resourceId 为空，无法生成教材会话ID')
    }

    // 为本次截图会话生成会话ID
    const now = Date.now()
    const userId = getUserId() || ''
    const currentResourceId = resourceId.value || ''
    const sessionId = currentResourceId
      ? `${userId ? userId + '-' : ''}ai-textbook-${currentResourceId}-${now}`
      : `${userId ? userId + '-' : ''}ai-textbook-${now}`
    
    console.log('[AI_TEXTBOOK] sendScreenshotMessage 生成新 ID:', {
      newId: sessionId,
      oldId: currentSessionId.value,
      resourceId: currentResourceId
    })

    // 设置当前会话ID
    currentSessionId.value = sessionId
    isNewSession.value = true

    const fileName = `screenshot-${Date.now()}.jpg`

    // 首图 imageData
    const imageData: ChatImageData = {
      filePath: fileName,
      base64DataUrl: dataUrl,
      width: firstShot.width,
      height: firstShot.height,
      fileSize: Math.round(dataUrl.length * 0.75),
    }

    // 构建多图列表
    const imageList: ChatImageData[] = limitedShots.map((shot, index) => {
      const shotDataUrl = shot.dataUrl
      const shotFileName = `screenshot-${Date.now()}-${index}.jpg`
      return {
        filePath: shotFileName,
        base64DataUrl: shotDataUrl,
        width: shot.width,
        height: shot.height,
        fileSize: Math.round(shotDataUrl.length * 0.75),
      }
    })

    // 发送消息
    await sendMessage(
      text,
      selectedModel || 'mate',
      imageData,
      false,
      false,
      undefined,
      imageList,
    )

    // 发送成功后，创建并持久化截图会话记录
    const newSession = {
      sessionId,
      sessionName: text,
      createTime: now,
      updateTime: now,
      msgCount: 0,
      pinned: false,
      thumbnailImage: dataUrl,
      hasImage: true,
      resourceId: currentResourceId || undefined,
      id: sessionId,
      question: text,
      answer: '',
    }
    addScreenshotSession(newSession)
  }
  
  // ==================== 导出 ====================
  
  return {
    // 状态
    messages,
    isChatLoading,
    chatResponseTimes,
    enableWebSearch,
    resourceId,
    sectionName,
    chapterInfo,
    currentSessionId,
    isNewSession,
    backendSessionId,
    useScreenshotApi,
    inputAttachedScreenshots,
    inputScreenshotDrawingStates,
    
    // 方法
    addMessage,
    updateMessage,
    clearMessages,
    setInputAttachedScreenshots,
    appendInputAttachedScreenshots,
    removeInputAttachedScreenshot,
    clearInputAttachedScreenshots,
    setInputScreenshotDrawingStates,
    removeInputScreenshotDrawingState,
    clearInputScreenshotDrawingStates,
    deleteMessage,
    sendMessage,
    sendScreenshotMessage,
    retryAiMessage,
    saveChatHistory,
    loadChatHistory,
    clearChatHistory,
    reloadHtmlImage,
    toggleWebSearch,
    setResourceId,
    setSectionName,
    setChapterInfo,
  }
})
