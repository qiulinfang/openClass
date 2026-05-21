import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiService } from '../services/http/api-service'
import { getApiPaths } from '@/config/env-config'
import { Sender } from '@/types/enums'
import type { ChatBubble, AiChatMessageRequest, UserInfo, HtmlPreviewFocus, AttachedScreenshot } from '@/types'
import { useChatEngine } from '@/composables/useChatEngine'
import { useChatRetry } from '@/composables/useChatRetry'
import { generateUniqueId, type ChatQuotedMessage, type ChatImageData } from './utils/chatStoreUtils'
import { getUserId } from '../services'

export const useHtmlPreviewChatStore = defineStore('htmlPreviewChat', () => {
  // ==================== 状态定义 ====================

  /** 消息列表 */
  const messages = ref<ChatBubble[]>([])

  /** 聊天加载状态 */
  const isChatLoading = ref(false)

  /** 是否禁用历史记录保存 */
  const disableHistorySave = ref(true)

  /** 当前复用的会话 ID (从跳转来源传入) */
  const sessionId = ref<string | null>(null)

  /** Web搜索开关 */
  const enableWebSearch = ref(false)

  /** 截图相关状态 */
  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])

  // ==================== 复合逻辑集成 ====================

  const chatEngine = useChatEngine({
    messagesRef: messages,
    onAfterHistorySync: () => {}, // HTML 预览不同步历史
  })

  const retryHelper = useChatRetry({ maxRetries: 3 })

  // ==================== 私有工具方法 ====================

  const createTempReplyMessage = (selectedModel?: string): { message: ChatBubble; id: string } => {
    const tempReplyId = generateUniqueId('temp_ai_preview')
    const tempReplyMessage: ChatBubble = {
      id: tempReplyId,
      content: '',
      type: Sender.AI,
      timestamp: new Date().toISOString(),
      sender: Sender.AI,
      isStreaming: false,
      selectedModel: selectedModel || 'mate'
    }
    return { message: tempReplyMessage, id: tempReplyId }
  }

  const buildRequest = (
    content: string,
    userInfo: UserInfo | null,
    options: {
      selectedModel?: string
      enableWebSearch?: boolean
      imageList?: { base64DataUrl: string }[]
      focus?: HtmlPreviewFocus
    }
  ): AiChatMessageRequest => {
    // 优先使用传入的 sessionId，如果没有则新建
    const finalSessionId = sessionId.value || `preview-${Date.now()}`
    console.log('[HtmlPreviewStore] buildRequest: 使用 sessionId =', finalSessionId, ' (来自 store.sessionId =', sessionId.value, ')')
    const useScreenshotApi = !!(options.imageList && options.imageList.length > 0)
    const dstUrl = useScreenshotApi ? getApiPaths().xueban.ai.previewPictureQA : getApiPaths().xueban.ai.chats

    return {
      sessionId: finalSessionId,
      newValue: '1',
      coversation: content,
      question: '',
      answer: '',
      name: userInfo?.userName || getUserId() || 'User',
      reason: 'start',
      bmNo: finalSessionId,
      isWebSearch: options.enableWebSearch ? '1' : '0',
      role: options.selectedModel || 'mate',
      subject: '',
      dstUrl,
      explanation: '',
      imageList: options.imageList,
      focus: options.focus,
    }
  }

  // ==================== 核心方法 ====================

  /**
   * 设置复用的会话 ID
   */
  const setSessionId = (id: string | null): void => {
    console.log('[HtmlPreviewStore] setSessionId 调用:', id)
    sessionId.value = id
  }

  /**
   * 发送消息
   */
  const sendMessage = async (
    content: string,
    userInfo: UserInfo | null,
    options: {
      selectedModel?: string
      skipUserMessage?: boolean
      quotedMessage?: ChatQuotedMessage
      imageData?: ChatImageData
      imageList?: ChatImageData[]
      focus?: HtmlPreviewFocus
    } = {}
  ): Promise<void> => {
    const { selectedModel = 'mate', skipUserMessage = false, quotedMessage, imageData, imageList, focus } = options

    // 1. 处理用户消息展示
    if (!skipUserMessage) {
      messages.value.push({
        id: Date.now().toString(),
        content,
        type: Sender.USER,
        timestamp: new Date().toISOString(),
        sender: Sender.USER,
        messageType: 'text',
        quotedMessage,
      })
    } else if ((imageList && imageList.length > 0) || (imageData && imageData.base64DataUrl)) {
      // 如果有图片，由外部策略层先通过 addMessage 插入了 UI，这里处理请求逻辑即可
    }

    // 2. 创建 AI 临时回复
    const { message: tempReply, id: tempReplyId } = createTempReplyMessage(selectedModel)
    messages.value.push(tempReply)

    // 3. 构建请求
    const hasMultiImages = !!(imageList && imageList.length > 0)
    const hasSingleImage = !!(imageData && imageData.base64DataUrl)
    const imageListForRequest = hasMultiImages
      ? (imageList || []).filter(img => !!img.base64DataUrl).map(img => ({ base64DataUrl: img.base64DataUrl! }))
      : hasSingleImage
        ? [{ base64DataUrl: imageData!.base64DataUrl! }]
        : undefined

    const request = buildRequest(content, userInfo, {
      selectedModel,
      enableWebSearch: enableWebSearch.value,
      imageList: imageListForRequest,
      focus,
    })

    try {
      isChatLoading.value = true
      const { onComplete, onStream, onHistoryUpdate } = chatEngine.createSendChatCallbacks(tempReplyId, tempReply)
      await apiService.sendChatMessage(request, onComplete, onStream, onHistoryUpdate)
    } catch (error) {
      console.error('[HtmlPreviewStore] 发送失败:', error)
      const index = messages.value.findIndex(m => m.id === tempReplyId)
      if (index >= 0) {
        messages.value[index] = {
          ...tempReply,
          content: '发送失败，请检查网络后重试',
          isStreaming: false,
          isError: true,
          canRetry: true,
          originalMessage: content,
        }
      }
      throw error
    } finally {
      isChatLoading.value = false
    }
  }

  /**
   * 重试消息
   */
  const retryMessage = async (
    messageId: string,
    userInfo: UserInfo | null,
    selectedModel: string = 'mate'
  ): Promise<void> => {
    await retryHelper.retryByDeleteAndResend({
      ctx: { messages, deleteMessage },
      messageId,
      selectedModel,
      resend: async ({ originalContent, quotedMessage, selectedModel: model }) => {
        await sendMessage(originalContent, userInfo, {
          selectedModel: model || selectedModel,
          quotedMessage,
        })
      },
    })
  }

  /**
   * 删除消息
   */
  const deleteMessage = async (messageId: string): Promise<void> => {
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index < 0) return

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
    messages.value.splice(startIndex)
  }

  /**
   * 编辑并重新发送消息
   */
  const editMessage = async (
    messageId: string,
    newContent: string,
    userInfo: UserInfo | null,
    options: { selectedModel?: string; focus?: HtmlPreviewFocus } = {}
  ): Promise<void> => {
    const index = messages.value.findIndex((msg) => msg.id === messageId)
    if (index === -1) {
      throw new Error('消息不存在')
    }

    // 1. 更新内容并截断后续消息
    messages.value[index].content = newContent
    messages.value.splice(index + 1)

    // 2. 重新发送（跳过用户消息创建，因为我们是原地编辑）
    await sendMessage(newContent, userInfo, {
      ...options,
      skipUserMessage: true,
    })
  }

  /**
   * 清空消息
   */
  const clearMessages = (): void => {
    messages.value = []
  }

  /**
   * 切换 Web 搜索
   */
  const toggleWebSearch = (): void => {
    enableWebSearch.value = !enableWebSearch.value
  }

  /**
   * 重置状态
   */
  const resetState = (): void => {
    messages.value = []
    sessionId.value = null
    isChatLoading.value = false
    enableWebSearch.value = false
    inputAttachedScreenshots.value = []
  }

  return {
    // 状态
    messages,
    isChatLoading,
    disableHistorySave,
    sessionId,
    enableWebSearch,
    inputAttachedScreenshots,

    // 方法
    setSessionId,
    sendMessage,
    retryMessage,
    deleteMessage,
    editMessage,
    clearMessages,
    toggleWebSearch,
    resetState,
    
    // 兼容 Strategy 的截图操作
    setInputAttachedScreenshots: (shots: AttachedScreenshot[]) => {
      inputAttachedScreenshots.value = Array.isArray(shots) ? shots : []
    },
  }
})
