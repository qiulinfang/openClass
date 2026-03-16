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
import type { AiChatMessageRequest, ChatBubble, UserInfo, BackendHistoryMessage, AttachedScreenshot } from '../types'
import { alignTailMessageIdsFromHistory, buildHistorySignature } from './utils/historySyncUtils'
import { validateTextbookChatRequest } from './utils/requestValidator'
import { getApiPaths } from '@/config/env-config'
import { Sender } from '@/types/enums'

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
  sessionId: string
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
    url: 'https://www.imates.com.cn:9099/wk/math/steiner-lab-tablet.html',
  },
  {
    chapterInfo: REQUIRED_CHAPTER_INFO_LIST[2],
    title: '微课',
    url: 'https://www.imates.com.cn:9099/wk/math/steiner-lab-tablet.html',
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
  if (!info) {
    console.log('[shouldSendChapterInfo] 章节信息为空，不发送')
    return false
  }
  const keys = Object.keys(info)
  if (keys.length !== 4) {
    console.log('[shouldSendChapterInfo] 章节信息字段数量不正确:', keys.length)
    return false
  }
  if (!keys.every((k) => k === 'grade' || k === 'subject' || k === 'textbook' || k === 'chapter_title')) {
    console.log('[shouldSendChapterInfo] 章节信息字段名不正确:', keys)
    return false
  }
  console.log('[shouldSendChapterInfo] :', REQUIRED_CHAPTER_INFO_LIST)
  console.log('[shouldSendChapterInfo] :', info)
  const matched = REQUIRED_CHAPTER_INFO_LIST.find((required) => {
    return (
      info.grade === required.grade &&
      info.subject === required.subject &&
      info.textbook === required.textbook &&
      info.chapter_title === required.chapter_title
    )
  })
  if (!matched) {
    console.log('[shouldSendChapterInfo] 未找到匹配的章节配置:', info)
    return false
  }
  console.log('[shouldSendChapterInfo] 章节信息验证通过，将发送:', info)
  return true
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
    question: content,
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
  const attachedScreenshots = ref<AttachedScreenshot[]>([])

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

  const enhanceResponsiveHtml = (html: string): string => {
    if (!html) return html

    let enhancedHtml = html

    // 仅展示绘图区：强制关闭 GeoGebra Classic 的非绘图 UI
    // 仅做替换（不插入新字段），避免破坏源 HTML
    const forceFalseKeys = [
      'showToolBar',
      'showAlgebraInput',
      'showMenuBar',
      'allowStyleBar',
      'showFullscreenButton',
      'enableLabelDrags',
      'enableRightClick',
      'errorDialogsActive',
    ]
    for (const key of forceFalseKeys) {
      const reg = new RegExp(`(["']?${key}["']?\\s*:\\s*)true`, 'gi')
      enhancedHtml = enhancedHtml.replace(reg, `$1false`)
    }

    // Classic 模式下强制仅几何视图：perspective 设为 "G"（不含 Algebra）
    // 仅替换已存在的 perspective 字段，避免对非 GeoGebra HTML 产生副作用
    enhancedHtml = enhancedHtml.replace(
      /(["']?perspective["']?\s*:\s*)["'][^"']*["']/gi,
      `$1"G"`,
    )

    // 如果没有 perspective 字段，主动插入 perspective: "G"
    // 查找 parameters 对象并在其中插入 perspective 配置
    if (!enhancedHtml.includes('perspective')) {
      enhancedHtml = enhancedHtml.replace(
        /(\bparameters\s*=\s*\{[^}]*)}/gi,
        (match, beforeBrace) => {
          // 如果 parameters 对象为空或已结束，在其末尾插入 perspective
          if (beforeBrace.trim().endsWith('{') || beforeBrace.trim().endsWith(',')) {
            return `${beforeBrace} perspective: "G" }`
          } else {
            return `${beforeBrace}, perspective: "G" }`
          }
        }
      )
    }

    enhancedHtml = enhancedHtml.replace(
      /"width": window\.innerWidth/g,
      `"width": document.getElementById('ggb-container').parentElement.clientWidth`,
    )
    enhancedHtml = enhancedHtml.replace(
      /"height": window\.innerHeight/g,
      `"height": document.getElementById('ggb-container').parentElement.clientHeight`,
    )

    // 已经注入过 ResizeObserver 则不重复注入，但仍保留上面的参数/尺寸替换
    if (!enhancedHtml.includes('ResizeObserver')) {
      const resizeScript = `
        <script>
          // 添加 ResizeObserver 监听容器变化
          if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(entries => {
              for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const ggbApplet = window.ggbApplet || document.querySelector('#ggb-container')?.ggbApplet;
                if (ggbApplet && ggbApplet.setSize) {
                  ggbApplet.setSize(width, height);
                }
              }
            });
            
            // 监听 ggb-container 容器
            const ggbContainer = document.getElementById('ggb-container');
            if (ggbContainer) {
              resizeObserver.observe(ggbContainer.parentElement);
            }
          }
        <\/script>
      `

      enhancedHtml = enhancedHtml.replace('</body>', resizeScript + '</body>')
    }
    return enhancedHtml
  }

  const ensureHtmlRawMapForMessage = async (message: ChatBubble): Promise<boolean> => {
    if (message.messageType !== 'html') return false

    const urlMatches = message.content
      ? message.content.match(/(https:\/\/kelvin-cosin\.cloud\/[a-f0-9-]+\.html)/gi)
      : null
    const urls = urlMatches || []
    if (urls.length === 0) return false

    if (!message.rawHtmlMap) {
      message.rawHtmlMap = {}
    }

    let changed = false

    for (const url of urls) {
      try {
        let html = message.rawHtmlMap[url]

        if (!html) {
          const htmlData = await apiService.fetchHtmlSource(url)
          if (htmlData && (htmlData.html || htmlData.raw_html)) {
            html = htmlData.html || htmlData.raw_html
          }
        }

        if (html) {
          const enhanced = enhanceResponsiveHtml(html)
          if (message.rawHtmlMap[url] !== enhanced) {
            message.rawHtmlMap[url] = enhanced
            changed = true
          }
        }
      } catch (error) {
        console.warn(`[AI_TEXTBOOK] 获取 rawHtml 失败:`, url, error)
      }
    }

    return changed
  }

  // 每张截图的 DrawingBoard 状态（按截图 id 索引）
  const screenshotDrawingStates = ref<Record<string, ScreenshotDrawingState>>({})
  
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

      // 确定用于后端 delete_messages 的起始 message_id
      let startBackendMessageId: string | undefined = messages.value[startIndex]?.messageId
      if (!startBackendMessageId) {
        for (let i = startIndex; i < messages.value.length; i++) {
          if (messages.value[i].messageId) {
            startBackendMessageId = messages.value[i].messageId
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

      // 调用后端 manageConversationMemory（教材场景仍归 chatbot）
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
   * 确保存在一个可用的后端会话ID（同步版本，用于没有资源ID的情况）
   * 优先级：
   * 1. 使用 aiGeneral 顶部会话ID
   * 2. 使用已维护的 backendSessionId
   * 3. 创建新的会话ID并保存到 backendSessionId
   */
  const ensureTopGeneralSessionSync = (): string => {
    const currentUserId = getUserId() || ''

    // 切换账号后，必须丢弃旧的 backendSessionId（以及不要复用旧的 ai-general session）
    if (backendSessionId.value && backendSessionOwnerUserId.value !== null && backendSessionOwnerUserId.value !== currentUserId) {
      console.warn('[AI_TEXTBOOK] userId 变化，丢弃旧 backendSessionId，避免串会话', {
        oldUserId: backendSessionOwnerUserId.value,
        newUserId: currentUserId,
        oldBackendSessionId: backendSessionId.value,
      })
      backendSessionId.value = null
      backendSessionOwnerUserId.value = null
    }

    // 1. 优先使用 ai-general 顶部会话ID
    if (aiGeneralStore.sessions.length > 0) {
      const topSession = aiGeneralStore.sessions[0]
      // 如果已经绑定过 userId，且当前 userId 与绑定不一致，则不能复用 ai-general 的旧会话（避免跨账号串线）
      if (backendSessionOwnerUserId.value !== null && backendSessionOwnerUserId.value !== currentUserId) {
        console.warn('[AI_TEXTBOOK] userId 与已绑定 backendSessionOwnerUserId 不一致，忽略 ai-general 顶部会话，重新生成', {
          boundUserId: backendSessionOwnerUserId.value,
          currentUserId,
          topGeneralSessionId: topSession.sessionId,
        })
      } else {
        // 同步更新 backendSessionId
        backendSessionId.value = topSession.sessionId
        backendSessionOwnerUserId.value = currentUserId
        return topSession.sessionId
      }
    }

    // 2. 如果没有 sessions，但有 backendSessionId，使用它
    if (backendSessionId.value) {
      if (backendSessionOwnerUserId.value === null) {
        backendSessionOwnerUserId.value = currentUserId
      }
      return backendSessionId.value
    }

    // 3. 都没有，创建新的会话ID并保存
    const newSessionId = `${currentUserId ? currentUserId + '-' : ''}textbook-session-${Date.now()}`
    backendSessionId.value = newSessionId
    backendSessionOwnerUserId.value = currentUserId
    return newSessionId
  }

  /**
   * 确保存在一个可用的后端会话ID
   * 优先级：
   * 1. 使用 aiGeneral 顶部会话ID
   * 2. 使用已维护的 backendSessionId
   * 3. 创建新的会话ID并保存到 backendSessionId
   */
  const ensureTopGeneralSession = (): string => {
    // 直接使用基于资源的会话ID
    const currentUserId = getUserId() || ''

    if (resourceId.value) {
      // 有资源ID，使用基于资源的会话ID
      const resourceSessionMap = getResourceSessionMap()
      const mapKey = `${currentUserId}_${resourceId.value}`

      if (resourceSessionMap[mapKey]) {
        // 已存在，直接复用
        console.log('[AI_TEXTBOOK] 复用资源会话ID:', {
          resourceId,
          sessionId: resourceSessionMap[mapKey],
          userId: currentUserId
        })
        return resourceSessionMap[mapKey]
      } else {
        // 不存在，创建新的并持久化
        const newSessionId = `${currentUserId}_${resourceId.value}_textbook`
        resourceSessionMap[mapKey] = newSessionId
        saveResourceSessionMap(resourceSessionMap)

        console.log('[AI_TEXTBOOK] 创建新的资源会话ID:', {
          resourceId,
          sessionId: newSessionId,
          userId: currentUserId
        })

        return newSessionId
      }
    } else {
      // 没有资源ID，使用原有逻辑（向后兼容）
      return ensureTopGeneralSessionSync()
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
  ): Promise<void> => {
    // 创建并添加用户消息（可选）
    if (!skipUserMessage) {
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
    
    // 创建临时AI回复消息
    const { message: tempReply, id: tempReplyId } = createTempAiReplyMessage(
      selectedModel || 'mate',
      currentSessionId.value || undefined,
    )
    addMessage(tempReply)
    
    // 设置渲染状态（发送消息时不需要设置 isChatLoading，因为 isChatLoading 只用于加载聊天历史）
    
    try {
      // 获取用户信息和科目
      const userInfo = getUserInfo()
      
      // ========= 获取后端使用的根会话ID（来自 ai-general 的第一个会话或已维护的 backendSessionId） =========
      const sessionIdForBackend = ensureTopGeneralSession()
      
      // 构建AI消息请求（传入科目以确定dstUrl）
      // 将 chatStoreUtils.ChatImageData 转换为构建请求所需的精简图片数据
      const builderImageData = imageData?.base64DataUrl
        ? { base64DataUrl: imageData.base64DataUrl }
        : undefined

      const builderImageList = imageList && imageList.length > 0
        ? imageList
            .filter((img) => !!img.base64DataUrl)
            .map((img) => ({ base64DataUrl: img.base64DataUrl! }))
        : undefined

      // 如果有图片数据且没有设置 sessionId，强制创建新会话（每次截图都创建新会话）
      // 注意：如果 currentSessionId 已经存在（比如从外部设置），则不覆盖它
      if (builderImageData && !currentSessionId.value) {
        const userId = getUserId() || ''
        const newSessionId = `${userId ? userId + '-' : ''}textbook-session-${Date.now()}`
        currentSessionId.value = newSessionId
        isNewSession.value = true
      } else if (!currentSessionId.value) {
        const userId = getUserId() || ''
        const newSessionId = `${userId ? userId + '-' : ''}textbook-session-${Date.now()}`
        currentSessionId.value = newSessionId
        isNewSession.value = true
      }
      // 只要有单图或多图中的任意一种，就应走截图接口 /ai/2.0/previewPictureQA
      const shouldUseScreenshotApi = !!builderImageData || !!(builderImageList && builderImageList.length > 0)

      const aiMessage = buildAiTextbookMessage({
        content,
        userInfo,
        subject: getSubject(),
        chatRole: selectedModel || 'mate',
        sessionId: sessionIdForBackend,
        resourceId: resourceId.value,
        sectionName: sectionName.value,
        chapterInfo: chapterInfo.value,
        imageData: builderImageData,
        useScreenshotApi: shouldUseScreenshotApi,
        isNewSession: isNewSession.value,
        imageList: builderImageList,
      })
      updateMessage(tempReplyId, { originalDstUrl: aiMessage.dstUrl })

      useScreenshotApi.value = shouldUseScreenshotApi
      isNewSession.value = false
      const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)

      const wrappedOnComplete = (finalResponse: any) => {
        onComplete?.(finalResponse)

        if (isResponseSuccess(finalResponse)) {
          chatResponseTimes.value++
          saveChatHistory()
        }
      }

      const response = await apiService.sendChatMessage(
        aiMessage,
        wrappedOnComplete,
        onStream,
        onHistoryUpdate,
      )

      const aiIndex = messages.value.findIndex((m) => m.id === tempReplyId)
      if (aiIndex >= 0) {
        const msg = messages.value[aiIndex]
        const changed = await ensureHtmlRawMapForMessage(msg)
        if (changed) {
          messages.value[aiIndex] = { ...msg }
          await saveChatHistory()
        }
      }
      
      // 处理响应（如果轮询已完成，这里response已经是最终结果）
      // 注意：由于使用了回调，这里主要是确保没有错误
      if (!isResponseSuccess(response)) {
        // 如果既没有成功响应，也没有累积内容，标记为错误
        const errorMessage = updateMessageError(
          tempReply,
          '抱歉，我暂时无法回答这个问题。请稍后重试。',
          content,
          imageData
        )
        updateMessage(tempReplyId, errorMessage)

        // 保底：失败场景也记录 originalDstUrl
        updateMessage(tempReplyId, { originalDstUrl: aiMessage.dstUrl })
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      
      // 错误处理
      const errorMessage = updateMessageError(
        tempReply,
        '发送失败，请检查网络连接后重试。',
        content,
        imageData
      )
      updateMessage(tempReplyId, errorMessage)
      
      showMessage('发送消息失败', 'error')
    } finally {
      // 重置渲染状态（发送消息时不需要重置 isChatLoading，因为 isChatLoading 只用于加载聊天历史）
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
            await ensureHtmlRawMapForMessage(message)
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
    resourceId,
    sectionName,
    chapterInfo,
    currentSessionId,
    isNewSession,
    backendSessionId,
    useScreenshotApi,
    attachedScreenshots,
    screenshotDrawingStates,
    
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
    setSectionName,
    setChapterInfo,
  }
})
