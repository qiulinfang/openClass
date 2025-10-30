/**
 * 教师答疑场景专用Store
 * 
 * 职责：管理教师答疑场景的所有聊天相关状态和逻辑
 * - 消息管理
 * - 发送消息到教师
 * - 教师会话管理
 * - 聊天历史持久化
 * - 重试逻辑
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { apiService } from '../services/api-service'
import { asyncStorage } from '../services/async-storage'
import { showMessage } from '../utils'
import { useUserStore } from './userStore'
import { useQuestionStore } from './questionStore'
import {
  createUserMessage,
  updateMessageSuccess,
  updateMessageError,
  updateMessageRetrying,
  checkRetryCondition,
  isResponseSuccess,
  buildRetryFailureMessage,
  findMessageIndex,
  validateMessageExists,
  type ChatImageData
} from './utils/chatStoreUtils'
import { buildAiGeneralMessage } from './utils/aiMessageBuilder'
import type { ChatBubble, AiChatMessageRequest, UserInfo } from '../types'

/**
 * 教师会话信息
 */
export interface TeacherSession {
  sessionId: string
  sessionName: string
  subject: string
  createTime: number
}

/**
 * 教师消息使用AI Chat Message Request格式
 * 通过chatRole='teacher'和dstUrl来区分教师场景
 */
type TeacherMessageRequest = AiChatMessageRequest

export const useTeacherChatStore = defineStore('teacherChat', () => {
  // ==================== 状态管理 ====================
  
  const messages = ref<ChatBubble[]>([])
  const currentSession = ref<TeacherSession | null>(null)
  const isChatLoading = ref(false)
  const isChatRendering = ref(false)
  const chatResponseTimes = ref(0)
  const enableWebSearch = ref(false)
  
  const VIEW_ANSWER_CHAT_TIMES = 3
  const canViewAnswer = computed(() => chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES)
  
  // 防抖定时器
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
  
  // ==================== 会话管理 ====================
  
  /**
   * 设置当前会话
   */
  const setSession = (session: TeacherSession): void => {
    currentSession.value = session
  }
  
  /**
   * 清除会话
   * 第1步：清空当前会话信息
   * 第2步：清空消息列表
   */
  const clearSession = (): void => {
    console.log('[TeacherStore] 🧹 clearSession() - 清空会话和消息')
    currentSession.value = null
    clearMessages()
  }
  
  // ==================== 消息管理 ====================
  
  /**
   * 添加消息到列表
   */
  const addMessage = (message: ChatBubble): void => {
    console.log('[TeacherStore] 📨 添加消息:', { id: message.id, type: message.type, content: message.content?.substring(0, 50) })
    messages.value.push(message)
    console.log('[TeacherStore] 📊 当前消息总数:', messages.value.length)
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
  }
  
  // ==================== 发送消息 ====================
  
  /**
   * 发送教师消息
   * 第1步：验证会话
   * 第2步：创建用户消息
   * 第3步：通过Android Bridge直接发送到RabbitMQ（不使用HTTP接口）
   * 第4步：等待教师回复（通过RabbitMQ接收）
   */
  const sendChatMessage = async (
    content: string,
    imageData?: ChatImageData,
    hidePrefix: boolean = false
  ): Promise<void> => {
    console.log('[TeacherStore] 📤 开始发送教师消息:', { content, hasImage: !!imageData })
    
    // 第1步：验证会话
    if (!currentSession.value) {
      console.error('[TeacherStore] ❌ 发送失败：未选择教师会话')
      showMessage('请先选择教师会话', 'warning')
      return
    }
    
    // 检查AndroidBridge
    if (!window.AndroidBridge) {
      console.error('[TeacherStore] ❌ 发送失败：AndroidBridge未初始化')
      showMessage('系统未初始化，请重试', 'error')
      return
    }
    
    // 第2步：创建并添加用户消息
    const userMessage = createUserMessage(content, imageData, hidePrefix)
    addMessage(userMessage)
    
    // 第3步：设置加载状态
    isChatLoading.value = true
    isChatRendering.value = true
    
    try {
      const sessionId = currentSession.value.sessionId
      const subject = currentSession.value.subject || 'math'
      
      console.log('[TeacherStore] 📋 发送参数:', { sessionId, subject })
      
      let result: string
      
      // 第4步：根据消息类型调用不同的Android Bridge方法
      // 教师聊天直接通过RabbitMQ发送，不使用HTTP接口
      if (imageData?.filePath) {
        // 图片消息
        console.log('[TeacherStore] 🖼️ 发送图片消息:', imageData.filePath)
        result = await window.AndroidBridge.sendPictureToTeacher(
          imageData.filePath,
          sessionId,
          subject
        )
      } else {
        // 文本消息
        console.log('[TeacherStore] 💬 发送文本消息:', content.substring(0, 100))
        result = await window.AndroidBridge.sendTextMessageToTeacher(
          content,
          sessionId,
          subject
        )
      }
      
      console.log('[TeacherStore] 📥 发送结果:', result)
      
      const data = JSON.parse(result)
      if (data.success) {
        console.log('[TeacherStore] ✅ 消息发送成功，等待教师回复...')
        
        // 增加响应次数
        chatResponseTimes.value++
        
        // 保存聊天历史
        await saveChatHistory()
        
        // 检查是否需要自动生成标题（第3轮对话后，6条消息）
        if (currentSession.value && messages.value.length === 6) {
          // 异步生成标题，不阻塞主流程
          const userStore = useUserStore()
          generateSessionTitle(
            currentSession.value.sessionId,
            userStore.userInfo,
            currentSession.value.subject as 'MATH' | 'BIOLOGY'
          ).catch((error: Error) => {
            console.warn('[TeacherStore] ⚠️ 自动生成标题失败:', error)
          })
        }
      } else {
        console.error('[TeacherStore] ❌ 消息发送失败:', data.message)
        throw new Error(data.message || '发送失败')
      }
    } catch (error) {
      console.error('[TeacherStore] ❌ 发送教师消息异常:', error)
      showMessage('发送失败，请重试', 'error')
    } finally {
      // 第5步：重置加载状态
      isChatLoading.value = false
      isChatRendering.value = false
    }
  }
  
  // ==================== 重试消息 ====================
  
  /**
   * 重试失败的教师消息
   * 第1步：查找并验证消息
   * 第2步：检查重试条件
   * 第3步：更新消息为重试中状态
   * 第4步：重新发送
   */
  const retryTeacherMessage = async (
    messageId: string,
    imageData?: ChatImageData
  ): Promise<void> => {
    // 第1步：验证会话
    if (!currentSession.value) {
      showMessage('会话已失效', 'error')
      return
    }
    
    // 第2步：查找消息
    const index = findMessageIndex(messages.value, messageId)
    try {
      validateMessageExists(index)
    } catch {
      showMessage('消息不存在', 'error')
      return
    }
    
    const message = messages.value[index]
    
    // 第3步：检查重试条件
    const { canRetry, error } = checkRetryCondition(message)
    if (!canRetry) {
      showMessage(error || '无法重试', 'warning')
      return
    }
    
    // 第4步：更新为重试中状态
    const retryCount = (message.retryCount || 0) + 1
    const retryingMessage = updateMessageRetrying(message, retryCount)
    updateMessage(messageId, retryingMessage)
    
    // 第5步：重新发送
    try {
      const userStore = useUserStore()
      const questionStore = useQuestionStore()
      const currentQuestion = questionStore.currentQuestion
      
      if (!currentQuestion) {
        throw new Error('未选择题目')
      }
      
      const teacherMessage: TeacherMessageRequest = {
        sessionId: currentSession.value.sessionId,
        newValue: '1',
        coversation: message.originalMessage!,
        question: currentQuestion.question || currentQuestion.title,
        answer: currentQuestion.answer || '',
        name: userStore.userInfo?.userName || 'User',
        reason: 'start',
        bmNo: currentQuestion.bmNo || currentQuestion.id,
        isWebSearch: '0',
        chatRole: 'teacher',
        dstUrl: '/permission/teacherChat'
      }
      
      const response = await apiService.sendChatMessage(teacherMessage)
      
      if (isResponseSuccess(response)) {
        // 重试成功
        const successMessage = updateMessageSuccess(
          message,
          response.reply || '',
          response.messageId
        )
        updateMessage(messageId, successMessage)
        
        chatResponseTimes.value++
        await saveChatHistory()
      } else {
        // 重试失败
        const errorContent = buildRetryFailureMessage(retryCount, 3)
        const errorMessage = updateMessageError(
          message,
          errorContent,
          message.originalMessage,
          imageData
        )
        updateMessage(messageId, errorMessage)
      }
    } catch (error) {
      console.error('重试失败:', error)
      const errorContent = buildRetryFailureMessage(retryCount, 3)
      const errorMessage = updateMessageError(
        message,
        errorContent,
        message.originalMessage,
        imageData
      )
      updateMessage(messageId, errorMessage)
    }
  }
  
  // ==================== 聊天历史 ====================
  
  /**
   * 保存聊天历史（带防抖）
   * 第1步：验证会话
   * 第2步：清除旧的定时器
   * 第3步：如果是立即保存，直接执行
   * 第4步：否则设置防抖定时器
   */
  const saveChatHistory = async (immediate: boolean = false): Promise<void> => {
    if (!currentSession.value) {
      return
    }
    
    // 第1步：清除旧定时器
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer)
      saveDebounceTimer = null
    }
    
    const saveAction = async () => {
      if (!currentSession.value) return
      
      try {
        // 第2步：构建存储键
        const storageKey = `teacher_chat_${currentSession.value.sessionId}`
        
        // 第3步：保存到IndexedDB
        await asyncStorage.saveChatHistory(storageKey, {
          questionId: storageKey,
          messages: messages.value,
          lastUpdated: Date.now(),
          chatResponseTimes: chatResponseTimes.value
        })
        
        // 第4步：单独保存会话信息到localStorage
        localStorage.setItem(`${storageKey}_session`, JSON.stringify(currentSession.value))
      } catch (error) {
        console.error('保存教师聊天历史失败:', error)
      }
    }
    
    // 第4步：立即保存或防抖保存
    if (immediate) {
      await saveAction()
    } else {
      saveDebounceTimer = setTimeout(saveAction, 1000)
    }
  }
  
  /**
   * 加载聊天历史
   */
  const loadChatHistory = async (sessionId: string): Promise<void> => {
    try {
      const storageKey = `teacher_chat_${sessionId}`
      const history = await asyncStorage.loadChatHistory(storageKey)
      
      if (history && history.messages) {
        messages.value = history.messages
        chatResponseTimes.value = history.chatResponseTimes || 0
        
        // 从localStorage加载会话信息
        const sessionData = localStorage.getItem(`${storageKey}_session`)
        if (sessionData) {
          currentSession.value = JSON.parse(sessionData)
        }
      }
    } catch (error) {
      console.error('加载教师聊天历史失败:', error)
    }
  }
  
  /**
   * 清除聊天历史
   */
  const clearChatHistory = async (sessionId: string): Promise<void> => {
    try {
      const storageKey = `teacher_chat_${sessionId}`
      const key = `chat_history_${storageKey}`
      // 使用localforage删除聊天记录
      await localforage.removeItem(key)
      // 删除会话信息
      localStorage.removeItem(`${storageKey}_session`)
      clearMessages()
    } catch (error) {
      console.error('清除教师聊天历史失败:', error)
    }
  }
  
  // ==================== 会话创建 ====================
  
  /**
   * 创建教师会话
   * 第1步：生成会话ID（与Android逻辑一致）
   * 第2步：创建会话对象
   * 第3步：保存到localStorage
   * 第4步：设置为当前会话
   */
  const createTeacherSession = (
    aiSessionId: string,
    aiSessionName: string,
    subject: 'biology' | 'math'
  ): TeacherSession => {
    const sessionId = generateSessionId(aiSessionId)
    
    const session: TeacherSession = {
      sessionId,
      sessionName: aiSessionName,
      subject,
      createTime: Date.now()
    }
    
    localStorage.setItem(`teacher_chat_${sessionId}_session`, JSON.stringify(session))
    currentSession.value = session
    
    return session
  }
  
  /**
   * 生成会话ID（与Android的UUID.nameUUIDFromBytes逻辑保持一致）
   */
  const generateSessionId = (aiSessionId: string): string => {
    let hash = 0
    for (let i = 0; i < aiSessionId.length; i++) {
      const char = aiSessionId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转为32位整数
    }
    
    const hex = Math.abs(hash).toString(16).padStart(8, '0')
    return `teacher-${hex}-${Date.now()}`
  }
  
  // ==================== 会话查询 ====================
  
  /**
   * 检查会话是否存在
   */
  const checkSessionExists = (sessionId: string): boolean => {
    const storageKey = `teacher_chat_${sessionId}_session`
    return localStorage.getItem(storageKey) !== null
  }
  
  /**
   * 获取会话消息数量
   */
  const getSessionMessageCount = async (sessionId: string): Promise<number> => {
    try {
      const storageKey = `teacher_chat_${sessionId}`
      const history = await asyncStorage.loadChatHistory(storageKey)
      return history?.messages?.length || 0
    } catch {
      return 0
    }
  }
  
  // ==================== 自动生成标题 ====================
  
  /**
   * 自动生成会话标题（基于会话内容）
   * 
   * 第1步：获取会话的前几条消息
   * 第2步：构建生成标题的提示词
   * 第3步：调用AI接口生成标题
   * 第4步：更新localStorage中的会话名称
   */
  const generateSessionTitle = async (
    sessionId: string,
    userInfo: UserInfo | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _subject: 'MATH' | 'BIOLOGY'
  ): Promise<void> => {
    console.log(`[TeacherStore] 🤖 开始为会话 ${sessionId} 生成标题...`)
    
    try {
      // 第1步：获取前6条消息（3轮对话）
      const firstMessages = messages.value.slice(0, 6)
        .filter(m => m.sender === 'user' || m.sender === 'teacher')
        .map(m => ({
          role: m.sender === 'user' ? '学生' : '老师',
          content: m.content
        }))
      
      if (firstMessages.length < 2) {
        console.warn('[TeacherStore] ⚠️ 消息数量不足，跳过生成标题')
        return
      }
      
      // 第2步：构建对话摘要
      const conversationSummary = firstMessages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n')
      
      // 第3步：构建生成标题的提示词
      const titlePrompt = `你是一个对话标题生成器。请为以下对话生成一个使用动宾结构或名词短语的标题（不超过15个字）。只返回标题文本，不要有引号或其他说明。

对话内容：
${conversationSummary}


标题：`
      
      // 第4步：构建AI请求（使用通用AI接口生成标题）
      const titleRequest = buildAiGeneralMessage(
        titlePrompt,
        userInfo,
        false, // 不使用web搜索
        'mate'
      )
      
      console.log('[TeacherStore] 📝 发送标题生成请求...')
      
      // 第5步：调用AI接口
      const response = await apiService.sendChatMessage(titleRequest)
      
      if (response && response.reply) {
        // 第6步：清理生成的标题（去除引号、换行等）
        const generatedTitle = response.reply
          .trim()
          .replace(/^["']|["']$/g, '') // 去除开头和结尾的引号
          .replace(/\n/g, '') // 去除换行
          .replace(/^标题[：:]\s*/,'') // 去除"标题："前缀
          .substring(0, 20) // 限制最大长度
        
        // 如果标题为空或太短，使用默认标题
        if (!generatedTitle || generatedTitle.length < 2) {
          console.warn('[TeacherStore] ⚠️ 生成的标题无效，保持原标题')
          return
        }
        
        // 第7步：更新localStorage中的会话标题
        const storageKey = `teacher_chat_${sessionId}_session`
        const sessionData = localStorage.getItem(storageKey)
        if (sessionData) {
          const session = JSON.parse(sessionData)
          session.sessionName = generatedTitle
          localStorage.setItem(storageKey, JSON.stringify(session))
          
          // 第8步：同步更新当前会话
          if (currentSession.value && currentSession.value.sessionId === sessionId) {
            currentSession.value.sessionName = generatedTitle
          }
          
          console.log(`[TeacherStore] ✅ 标题生成成功: "${generatedTitle}"`)
        }
      } else {
        console.warn('[TeacherStore] ⚠️ AI未返回有效标题')
      }
      
    } catch (error) {
      console.error('[TeacherStore] ❌ 生成标题失败:', error)
      throw error
    }
  }
  
  // ==================== 消息转发 ====================
  
  /**
   * 转发消息给教师
   * 第1步：验证会话
   * 第2步：遍历消息列表
   * 第3步：根据消息类型调用原生接口发送
   * 第4步：保存到前端数据库
   */
  const forwardMessagesToTeacher = async (
    messagesToForward: ChatBubble[]
  ): Promise<{ success: number; failed: number }> => {
    console.log('[TeacherStore] 🔄 开始转发消息给老师', {
      messageCount: messagesToForward.length,
      session: currentSession.value
    })
    
    // 第1步：验证会话
    if (!currentSession.value) {
      console.error('[TeacherStore] ❌ 转发失败：未创建教师会话')
      throw new Error('请先创建教师会话')
    }
    
    // 检查AndroidBridge是否存在
    if (!window.AndroidBridge) {
      console.error('[TeacherStore] ❌ 转发失败：AndroidBridge未初始化')
      throw new Error('AndroidBridge未初始化')
    }
    
    console.log('[TeacherStore] 📋 转发参数:', {
      sessionId: currentSession.value.sessionId,
      subject: currentSession.value.subject
    })
    
    let successCount = 0
    let failedCount = 0
    
    // 第2步：遍历消息
    for (let i = 0; i < messagesToForward.length; i++) {
      const msg = messagesToForward[i]
      console.log(`[TeacherStore] 📤 转发消息 ${i + 1}/${messagesToForward.length}:`, {
        type: msg.type,
        content: msg.content?.substring(0, 50) + '...',
        hasImageData: !!msg.imageData,
        hasVoiceData: !!msg.voiceData
      })
      
      try {
        if (msg.type === 'user' && msg.content) {
          let result
          
          // 第3步：根据消息类型发送
          if (msg.imageData?.filePath) {
            // 图片消息
            console.log('[TeacherStore] 🖼️ 发送图片消息:', msg.imageData.filePath)
            result = await window.AndroidBridge.sendPictureToTeacher(
              msg.imageData.filePath,
              currentSession.value.sessionId,
              currentSession.value.subject
            )
          } else if (msg.voiceData?.filePath) {
            // 语音消息
            console.log('[TeacherStore] 🎤 发送语音消息:', msg.voiceData.filePath)
            result = await window.AndroidBridge.sendVoiceMessageToTeacher(
              msg.voiceData.filePath,
              msg.voiceData.duration.toString(),
              currentSession.value.sessionId,
              currentSession.value.subject
            )
          } else {
            // 文本消息
            console.log('[TeacherStore] 💬 发送文本消息:', msg.content.substring(0, 100))
            result = await window.AndroidBridge.sendTextMessageToTeacher(
              msg.content,
              currentSession.value.sessionId,
              currentSession.value.subject
            )
          }
          
          console.log(`[TeacherStore] 📥 发送结果:`, result)
          
          const data = JSON.parse(result)
          if (data.success) {
            console.log(`[TeacherStore] ✅ 消息 ${i + 1} 发送成功`)
            successCount++
            // 第4步：保存到前端数据库
            const sentMessage = JSON.parse(data.data)
            const newMessage: ChatBubble = {
              id: sentMessage.messageId,
              content: msg.content,
              type: 'user',
              timestamp: new Date(sentMessage.timestamp).toISOString(),
              sender: 'user'
            }
            
            // 添加图片或语音数据
            if (msg.imageData) {
              newMessage.imageData = msg.imageData
            }
            if (msg.voiceData) {
              newMessage.voiceData = msg.voiceData
            }
            
            addMessage(newMessage)
          } else {
            console.error(`[TeacherStore] ❌ 消息 ${i + 1} 发送失败:`, data.message)
            failedCount++
          }
        } else {
          console.warn(`[TeacherStore] ⚠️ 跳过非用户消息:`, { type: msg.type, hasContent: !!msg.content })
        }
        
        // 避免发送过快
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`[TeacherStore] ❌ 转发消息 ${i + 1} 异常:`, error)
        failedCount++
      }
    }
    
    console.log(`[TeacherStore] 📊 转发完成统计:`, {
      total: messagesToForward.length,
      success: successCount,
      failed: failedCount
    })
    
    // 保存历史记录
    if (successCount > 0) {
      console.log('[TeacherStore] 💾 保存聊天历史...')
      await saveChatHistory(true)
    }
    
    return { success: successCount, failed: failedCount }
  }
  
  // ==================== 消息接收 ====================
  
  /**
   * 初始化教师消息接收器
   * 第1步：设置全局回调函数
   * 第2步：调用原生接口初始化RabbitMQ监听
   */
  const initMessageReceiver = async (): Promise<void> => {
    // 第1步：设置全局回调
    window.onTeacherMessageReceived = (messageData: unknown) => {
      console.log('收到教师消息:', messageData)
      
      const data = messageData as {
        messageId: string
        sessionId: string
        content: string
        messageType: string
        isSelf: boolean
        timestamp: number
        chatRole: string
      }
      
      const teacherMessage: ChatBubble = {
        id: data.messageId,
        content: data.content,
        type: 'ai',
        timestamp: new Date(data.timestamp).toISOString(),
        sender: 'teacher'
      }
      
      // 只添加属于当前会话的消息
      if (currentSession.value?.sessionId === data.sessionId) {
        addMessage(teacherMessage)
        saveChatHistory(true) // 立即保存
      }
    }
    
    // 第2步：初始化原生监听器
    if (!window.AndroidBridge) {
      const errorMsg = 'AndroidBridge未初始化，无法连接教师消息系统'
      console.error(errorMsg)
      throw new Error(errorMsg)
    }
    
    try {
      const result = await window.AndroidBridge.initTeacherMessageListener()
      const data = JSON.parse(result)
      if (!data.success) {
        const errorMsg = `初始化教师消息监听失败: ${data.message}`
        console.error(errorMsg)
        throw new Error(errorMsg)
      }
      console.log('✅ 教师消息监听器初始化成功')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '初始化教师消息监听失败'
      console.error('初始化教师消息监听失败:', error)
      throw new Error(errorMsg)
    }
  }
  
  /**
   * 清理消息接收器
   */
  const cleanupMessageReceiver = async (): Promise<void> => {
    // 第1步：清理全局回调
    if (window.onTeacherMessageReceived) {
      window.onTeacherMessageReceived = undefined
    }
    
    // 第2步：清理原生监听器
    if (!window.AndroidBridge) {
      return
    }
    
    try {
      const result = await window.AndroidBridge.cleanupTeacherMessageListener()
      const data = JSON.parse(result)
      if (!data.success) {
        console.error('清理教师消息监听失败:', data.message)
      }
    } catch (error) {
      console.error('清理教师消息监听失败:', error)
    }
  }
  
  // ==================== 导出 ====================
  
  /**
   * 切换Web搜索
   */
  const toggleWebSearch = (): void => {
    enableWebSearch.value = !enableWebSearch.value
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
    
    // 会话管理
    setSession,
    clearSession,
    createTeacherSession,
    checkSessionExists,
    getSessionMessageCount,
    generateSessionTitle,
    
    // 消息管理
    addMessage,
    updateMessage,
    clearMessages,
    sendChatMessage,
    retryTeacherMessage,
    forwardMessagesToTeacher,
    
    // 历史记录
    saveChatHistory,
    loadChatHistory,
    clearChatHistory,
    
    // 消息接收
    initMessageReceiver,
    cleanupMessageReceiver,
    
    // 其他
    toggleWebSearch
  }
})

