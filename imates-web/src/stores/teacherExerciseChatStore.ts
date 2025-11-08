/**
 * 教师题目聊天 Store
 * 职责：管理教师题目场景下的聊天消息和业务逻辑
 * 
 * 场景特点：
 * - 需要选中题目才能对话
 * - 发送题目信息给教师
 * - 支持消息重试
 * - 每道题目都有独立的会话
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { asyncStorage, type ChatHistoryData } from '../services/chat-storage'
import type { ChatBubble, ExerciseItem, UserInfo } from '../types'
import { createUserMessage } from './utils/chatStoreUtils'
import { getCurrentUserIdOrDefault } from '../utils/user/userId'
import type { ChatImageData } from './utils/chatStoreUtils'
import {
  updateMessageError,
  updateMessageRetrying,
  checkRetryCondition,
  buildRetryFailureMessage,
  findMessageIndex,
  validateMessageExists
} from './utils/chatStoreUtils'
import { showMessage } from '../utils'
import { useUnreadMessageStore } from './unreadMessageStore'

/**
 * 教师题目会话信息
 */
export interface TeacherExerciseSession {
  sessionId: string
  sessionName: string
  questionId: string
  subject: 'biology' | 'math'
  createTime: number
}

export const useTeacherExerciseChatStore = defineStore('teacherExerciseChat', () => {
  // ==================== 状态定义 ====================
  
  /** 消息列表 */
  const messages = ref<ChatBubble[]>([])
  
  /** 教师回复次数 */
  const chatResponseTimes = ref(0)
  
  /** 聊天加载状态 */
  const isChatLoading = ref(false)
  
  /** Web搜索开关 */
  const enableWebSearch = ref(false)
  
  /** 查看答案所需最小交互次数 */
  const VIEW_ANSWER_CHAT_TIMES = 3
  
  /** 是否可以查看答案 */
  const canViewAnswer = ref(false)
  
  /** 当前会话 */
  const currentSession = ref<TeacherExerciseSession | null>(null)
  
  // 防抖定时器
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
  
  // ==================== 消息管理 ====================
  
  /**
   * 验证UUID格式（支持标准UUID格式）
   */
  const isValidUUID = (id: string | null | undefined): boolean => {
    if (!id || typeof id !== 'string') {
      return false
    }
    // UUID格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(id)
  }
  
  /**
   * 验证消息ID格式
   */
  const validateMessageId = (messageId: string | null | undefined): boolean => {
    if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
      console.error('[TEACHER_EXERCISE] ❌ 消息ID为空或格式错误:', messageId)
      return false
    }
    if (!isValidUUID(messageId)) {
      console.error('[TEACHER_EXERCISE] ❌ 消息ID格式不正确（应为UUID格式）:', messageId)
      return false
    }
    return true
  }
  
  /**
   * 验证会话ID格式
   * 支持以下格式：
   * 1. 标准UUID格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   * 2. teacher-exercise-{questionId}-{timestamp}-{random} 格式
   * 3. teacher-{hex}-{timestamp} 格式
   */
  const validateSessionId = (sessionId: string | null | undefined): boolean => {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      console.error('[TEACHER_EXERCISE] ❌ 会话ID为空或格式错误:', sessionId)
      return false
    }
    
    const trimmedId = sessionId.trim()
    
    // 1. 检查标准UUID格式
    if (isValidUUID(trimmedId)) {
      return true
    }
    
    // 2. 检查 teacher-exercise- 格式
    if (trimmedId.startsWith('teacher-exercise-')) {
      return true
    }
    
    // 3. 检查 teacher-{hex}-{timestamp} 格式
    const teacherHexTimestampRegex = /^teacher-[0-9a-f]{8}-[0-9]+$/i
    if (teacherHexTimestampRegex.test(trimmedId)) {
      return true
    }
    
    console.error('[TEACHER_EXERCISE] ❌ 会话ID格式不正确:', trimmedId)
    return false
  }
  
  /**
   * 验证并修正时间戳
   */
  const validateAndFixTimestamp = (timestamp: number): number => {
    const now = Date.now()
    const MAX_FUTURE_OFFSET = 60000 // 允许1分钟的未来时间误差
    const MAX_PAST_OFFSET = 365 * 24 * 60 * 60 * 1000 // 允许1年前的过去时间
    
    if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp)) {
      console.warn('[TEACHER_EXERCISE] ⚠️ 时间戳无效，使用当前时间:', timestamp)
      return now
    }
    
    if (timestamp > now + MAX_FUTURE_OFFSET) {
      console.warn('[TEACHER_EXERCISE] ⚠️ 时间戳是未来时间，使用当前时间:', timestamp)
      return now
    }
    
    if (timestamp < now - MAX_PAST_OFFSET) {
      console.warn('[TEACHER_EXERCISE] ⚠️ 时间戳过于久远，使用当前时间:', timestamp)
      return now
    }
    
    return timestamp
  }
  
  /**
   * 检查消息是否已存在（去重）
   */
  const isMessageDuplicate = (messageId: string): boolean => {
    const existingIndex = findMessageIndex(messages.value, messageId)
    if (existingIndex >= 0) {
      console.warn('[TEACHER_EXERCISE] ⚠️ 检测到重复消息，跳过处理:', messageId)
      return true
    }
    return false
  }
  
  /**
   * 添加消息到列表（带去重）
   */
  const addMessage = (message: ChatBubble): void => {
    const existingIndex = findMessageIndex(messages.value, message.id)
    if (existingIndex >= 0) {
      console.warn('[TEACHER_EXERCISE] ⚠️ 消息已存在，跳过重复添加:', message.id)
      return
    }
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
  
  // ==================== 会话管理 ====================
  
  /**
   * 设置当前会话
   */
  const setSession = (session: TeacherExerciseSession): void => {
    currentSession.value = session
  }
  
  /**
   * 清除会话
   */
  const clearSession = (): void => {
    currentSession.value = null
    resetState()
  }
  
  /**
   * 创建或获取题目会话
   * 第1步：检查是否已存在该题目的会话
   * 第2步：如果已存在，复用已有会话；否则创建新会话
   * 第3步：保存到localStorage
   * 第4步：设置为当前会话
   */
  const createOrGetSession = (
    questionId: string,
    questionTitle: string,
    subject: 'biology' | 'math'
  ): TeacherExerciseSession => {
    // 第1步：迁移旧格式数据（如果存在）
    migrateOldSessions()
    
    // 第2步：检查是否已存在该题目的会话（使用统一存储格式）
    const allSessions = loadAllSessions()
    let existingSession: TeacherExerciseSession | null = null
    
    for (const session of Object.values(allSessions)) {
      // 匹配条件：题目ID和科目完全相同
      if (session.questionId === questionId && session.subject === subject) {
        existingSession = session
        break
      }
    }
    
    // 第3步：如果已存在，复用已有会话；否则创建新会话
    let session: TeacherExerciseSession
    if (existingSession) {
      session = existingSession
    } else {
      // 生成会话ID（基于题目ID和时间戳）
      const sessionId = generateSessionId(questionId)
      
      // 清理题目标题（移除LaTeX）
      const cleanTitle = questionTitle
        .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
        .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
        .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim()
      
      const sessionName = (cleanTitle || '题目').substring(0, 30) + '...'
      
      session = {
        sessionId,
        sessionName,
        questionId,
        subject,
        createTime: Date.now()
      }
    }
    
    // 第4步：保存到localStorage（使用统一存储格式）
    saveSession(session)
    
    // 第5步：设置为当前会话
    currentSession.value = session
    
    return session
  }
  
  /**
   * 生成会话ID（基于题目ID生成唯一ID）
   */
  const generateSessionId = (questionId: string): string => {
    // 使用题目ID和时间戳生成唯一ID
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `teacher-exercise-${questionId}-${timestamp}-${random}`
  }
  
  /**
   * 根据题目ID获取会话
   */
  const getSessionByQuestionId = (
    questionId: string,
    subject: 'biology' | 'math'
  ): TeacherExerciseSession | null => {
    // 迁移旧格式数据（如果存在）
    migrateOldSessions()
    
    // 使用统一存储格式查找会话
    const allSessions = loadAllSessions()
    
    for (const session of Object.values(allSessions)) {
      if (session.questionId === questionId && session.subject === subject) {
        return session
      }
    }
    
    return null
  }
  
  // ==================== 公开方法 ====================
  
  /**
   * 发送聊天消息（教师题目场景）
   * 使用 RabbitMQ 通过 Android Bridge 发送
   * 
   * 第1步：验证题目和会话
   * 第2步：创建用户消息（可选）
   * 第3步：通过Android Bridge发送到RabbitMQ
   * 第4步：等待教师回复（通过RabbitMQ接收）
   */
  const sendMessage = async (
    content: string,
    currentQuestion: ExerciseItem | null,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _selectedModel: string = 'teacher', // 未使用，保留以兼容接口
    imageData?: { filePath: string; base64DataUrl?: string },
    hidePrefix: boolean = false,
    skipUserMessage?: boolean
  ): Promise<void> => {
    // 第1步：验证题目和会话
    if (!currentQuestion) {
      throw new Error('请先选择一道题目')
    }
    
    if (!currentSession.value) {
      throw new Error('请先创建会话')
    }
    
    // 检查AndroidBridge
    if (!window.AndroidBridge) {
      console.error('[TEACHER_EXERCISE] ❌ 发送失败：AndroidBridge未初始化')
      showMessage('系统未初始化，请重试', 'error')
      return
    }
    
    // 第2步：创建用户消息（可选）
    // 注意：采用乐观发送，消息已在ChatView中预先添加，这里不再添加
    // 如果skipUserMessage为false，说明需要添加用户消息
    if (!skipUserMessage) {
      const chatImageData: ChatImageData | undefined = imageData && imageData.base64DataUrl ? {
        filePath: imageData.filePath || '',
        base64DataUrl: imageData.base64DataUrl,
        width: (imageData as { width?: number }).width || 0,
        height: (imageData as { height?: number }).height || 0,
        fileSize: (imageData as { fileSize?: number }).fileSize || 0
      } : undefined
      const userMessage = createUserMessage(content, chatImageData, hidePrefix)
      addMessage(userMessage)
    }
    
    // 第3步：设置加载状态
    isChatLoading.value = true
    
    try {
      const sessionId = currentSession.value.sessionId
      const subjectLower = subject.toLowerCase() as 'math' | 'biology'
      
      let result: string
      
      // 第4步：根据消息类型调用不同的Android Bridge方法
      // 教师题目聊天直接通过RabbitMQ发送，不使用HTTP接口
      // 注意：题目信息会通过sessionId传递（sessionId包含questionId）
      
      if (imageData?.base64DataUrl) {
        // 图片消息：使用filePath发送给Android端（如果有），否则回退到base64DataUrl
        if (imageData.filePath) {
          result = await window.AndroidBridge.sendPictureToTeacher(
            imageData.filePath,
            sessionId,
            subjectLower
          )
        } else {
          console.warn('[TEACHER_EXERCISE] ⚠️ 缺少filePath，使用base64DataUrl（不推荐）')
          result = await window.AndroidBridge.sendPictureToTeacher(
            imageData.base64DataUrl,
            sessionId,
            subjectLower
          )
        }
      } else {
        // 文本消息：将题目信息包含在消息内容中
        // 格式：题目信息 + 用户消息
        const questionInfo = `题目ID: ${currentQuestion.id}\n题目: ${currentQuestion.title || currentQuestion.question || ''}\n`
        const fullContent = questionInfo + content
        
        result = await window.AndroidBridge.sendTextMessageToTeacher(
          fullContent,
          sessionId,
          subjectLower
        )
      }
      
      let data: { success: boolean; message?: string; data?: unknown }
      try {
        data = JSON.parse(result)
      } catch (parseError) {
        console.error('[TEACHER_EXERCISE] ❌ JSON解析失败:', parseError)
        console.error('[TEACHER_EXERCISE] ❌ 原始结果:', result)
        throw new Error('响应格式错误')
      }
      
      if (data.success) {
        // 增加响应次数
        chatResponseTimes.value++
        
        // 检查是否可以查看答案
        if (chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES) {
          canViewAnswer.value = true
        }
        
        // 保存聊天历史（使用防抖）
        await saveChatHistory()
        
        // 检查是否需要自动生成标题（第3轮对话后，6条消息）
        if (currentSession.value && messages.value.length === 6) {
          // 异步生成标题，不阻塞主流程
          // 注意：题目场景可能不需要自动生成标题，这里先保留
        }
      } else {
        console.error('[TEACHER_EXERCISE] ❌ 消息发送失败:', data.message)
        
        // 检查是否为"正在初始化中"错误，如果是则自动重试
        const errorMessage = data.message || '发送失败'
        if (errorMessage.includes('正在初始化中')) {
          throw new Error('INITIALIZING_RETRY:' + errorMessage)
        }
        
        throw new Error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // 处理"正在初始化中"的自动重试
      if (errorMessage.startsWith('INITIALIZING_RETRY:')) {
        // 保存当前会话信息，避免重试过程中状态变化
        if (!currentSession.value || !currentQuestion) {
          console.error('[TEACHER_EXERCISE] ❌ 重试失败：会话或题目已失效')
          showMessage('会话已失效，请重新选择', 'error')
          return
        }
        
        const sessionInfo = {
          sessionId: currentSession.value.sessionId,
          subject: currentSession.value.subject || 'math',
          questionId: currentQuestion.id
        }
        
        // 最多重试3次，每次延迟递增
        const maxRetries = 3
        let retryCount = 0
        let lastError = error
        
        while (retryCount < maxRetries) {
          retryCount++
          const delay = retryCount * 2000 // 2秒、4秒、6秒
          
          await new Promise(resolve => setTimeout(resolve, delay))
          
          try {
            const { sessionId, subject } = sessionInfo
            const subjectLower = subject as 'math' | 'biology'
            
            let result: string
            if (imageData?.base64DataUrl) {
              if (imageData.filePath) {
                result = await window.AndroidBridge.sendPictureToTeacher(
                  imageData.filePath,
                  sessionId,
                  subjectLower
                )
              } else {
                result = await window.AndroidBridge.sendPictureToTeacher(
                  imageData.base64DataUrl,
                  sessionId,
                  subjectLower
                )
              }
            } else {
              const questionInfo = `题目ID: ${currentQuestion.id}\n题目: ${currentQuestion.title || currentQuestion.question || ''}\n`
              const fullContent = questionInfo + content
              result = await window.AndroidBridge.sendTextMessageToTeacher(
                fullContent,
                sessionId,
                subjectLower
              )
            }
            
            const retryData = JSON.parse(result)
            if (retryData.success) {
              chatResponseTimes.value++
              await saveChatHistory()
              return // 重试成功，退出
            } else {
              if (retryData.message?.includes('正在初始化中')) {
                lastError = new Error(retryData.message)
                continue
              } else {
                throw new Error(retryData.message || '发送失败')
              }
            }
          } catch (retryError) {
            const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError)
            if (retryErrorMessage.includes('正在初始化中') || retryErrorMessage.startsWith('INITIALIZING_RETRY:')) {
              lastError = retryError as Error
              continue
            } else {
              throw retryError
            }
          }
        }
        
        console.error(`[TEACHER_EXERCISE] ❌ 自动重试 ${maxRetries} 次后仍失败`)
        throw lastError
      }
      
      console.error('[TEACHER_EXERCISE] ❌ 发送教师消息异常:', error)
      showMessage('发送失败，请重试', 'error')
    } finally {
      isChatLoading.value = false
    }
  }
  
  /**
   * 重试失败的消息（教师题目场景）
   * 使用 RabbitMQ 通过 Android Bridge 重试
   */
  const retryMessage = async (
    messageId: string,
    currentQuestion: ExerciseItem | null,
    userInfo: UserInfo | null,
    subject: 'MATH' | 'BIOLOGY',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _selectedModel: string = 'teacher', // 未使用，保留以兼容接口
    imageData?: { filePath: string; base64DataUrl?: string }
  ): Promise<void> => {
    // 第1步：验证会话和AndroidBridge
    if (!currentSession.value) {
      showMessage('会话已失效', 'error')
      return
    }
    
    if (!window.AndroidBridge) {
      console.error('[TEACHER_EXERCISE] ❌ 重试失败：AndroidBridge未初始化')
      showMessage('系统未初始化，请重试', 'error')
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
    
    // 第5步：重新发送（使用RabbitMQ，与sendMessage保持一致）
    try {
      const sessionId = currentSession.value.sessionId
      const subjectLower = subject.toLowerCase() as 'math' | 'biology'
      
      // 优先使用传入的imageData，如果没有则使用消息中保存的imageData
      const messageImageData = imageData || message.imageData
      const content = message.originalMessage || message.content
      
      if (!content) {
        throw new Error('消息内容为空')
      }
      
      let result: string
      
      // 根据消息类型选择发送方式（与sendMessage逻辑一致）
      if (messageImageData?.base64DataUrl || messageImageData?.filePath) {
        // 图片消息：优先使用filePath（更高效），否则回退到base64DataUrl
        if (messageImageData.filePath) {
          result = await window.AndroidBridge.sendPictureToTeacher(
            messageImageData.filePath,
            sessionId,
            subjectLower
          )
        } else if (messageImageData.base64DataUrl) {
          console.warn('[TEACHER_EXERCISE] ⚠️ 重试时缺少filePath，使用base64DataUrl（不推荐）')
          result = await window.AndroidBridge.sendPictureToTeacher(
            messageImageData.base64DataUrl,
            sessionId,
            subjectLower
          )
        } else {
          throw new Error('图片数据不完整')
        }
      } else {
        // 文本消息：包含题目信息
        if (currentQuestion) {
          const questionInfo = `题目ID: ${currentQuestion.id}\n题目: ${currentQuestion.title || currentQuestion.question || ''}\n`
          const fullContent = questionInfo + content
          result = await window.AndroidBridge.sendTextMessageToTeacher(
            fullContent,
            sessionId,
            subjectLower
          )
        } else {
          result = await window.AndroidBridge.sendTextMessageToTeacher(
            content,
            sessionId,
            subjectLower
          )
        }
      }
      
      // 解析响应
      let data: { success: boolean; message?: string; data?: unknown }
      try {
        data = JSON.parse(result)
      } catch (parseError) {
        console.error('[TEACHER_EXERCISE] ❌ 重试时JSON解析失败:', parseError)
        console.error('[TEACHER_EXERCISE] ❌ 原始结果:', result)
        throw new Error('响应格式错误')
      }
      
      // 处理发送结果
      if (data.success) {
        // 重试成功：消息已发送到RabbitMQ，等待异步回复
        // 注意：教师聊天的回复是通过RabbitMQ异步接收的，不需要立即更新消息内容
        // 只需要将消息状态从"重试中"恢复为正常状态，等待异步回复
        const successMessage = {
          ...message,
          isStreaming: true, // 标记为流式更新，等待回复
          isError: false,
          retryCount,
          canRetry: false // 重试成功后，暂时禁用重试，等待回复
        }
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
          messageImageData
        )
        updateMessage(messageId, errorMessage)
      }
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 重试失败:', error)
      const errorContent = buildRetryFailureMessage(retryCount, 3)
      // 优先使用传入的imageData，如果没有则使用消息中保存的imageData
      const messageImageData = imageData || message.imageData
      const errorMessage = updateMessageError(
        message,
        errorContent,
        message.originalMessage,
        messageImageData
      )
      updateMessage(messageId, errorMessage)
    }
  }
  
  /**
   * 保存聊天历史（教师题目场景）
   * 使用会话ID作为存储键，带防抖
   */
  const saveChatHistory = async (immediate: boolean = false): Promise<void> => {
    if (!currentSession.value) {
      console.log('[TEACHER_EXERCISE] ⚠️ 保存失败：无当前会话')
      return
    }
    
    if (messages.value.length === 0) return
    
    // 清除旧定时器
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer)
      saveDebounceTimer = null
    }
    
    const saveAction = async () => {
      if (!currentSession.value) {
        console.log('[TEACHER_EXERCISE] ⚠️ 保存动作取消：无当前会话')
        return
      }
      
      try {
        const storageKey = `teacher-exercise-${currentSession.value.questionId}`
        
        // 过滤掉错误消息、流式消息、系统消息和撤回消息，只保存成功发送的消息
        const messagesToSave = messages.value.filter(msg => 
          !msg.isError && 
          !msg.isStreaming &&
          !msg.isSystemMessage &&
          !msg.isRecalled &&
          (msg.messageId || msg.id)
        )
        
        const historyData: ChatHistoryData = {
          questionId: storageKey,
          messages: messagesToSave,
          chatResponseTimes: chatResponseTimes.value,
          lastUpdated: Date.now()
        }
        
        await asyncStorage.saveTeacherChatHistory(storageKey, historyData)
        
        // 保存会话信息到localStorage（使用统一存储格式）
        if (currentSession.value) {
          saveSession(currentSession.value)
        }
      } catch (error) {
        console.error('[TEACHER_EXERCISE] ❌ 保存聊天历史失败:', error)
      }
    }
    
    // 立即保存或防抖保存
    if (immediate) {
      await saveAction()
    } else {
      saveDebounceTimer = setTimeout(saveAction, 1000)
    }
  }
  
  /**
   * 加载聊天历史（教师题目场景）
   * 使用题目ID作为存储键
   */
  const loadChatHistory = async (sessionIdOrQuestionId?: string): Promise<void> => {
    try {
      isChatLoading.value = true
      
      // 优先使用传入的questionId，如果没有则使用当前会话的questionId
      let storageKey: string
      if (sessionIdOrQuestionId) {
        storageKey = sessionIdOrQuestionId.startsWith('teacher-exercise-')
          ? sessionIdOrQuestionId
          : `teacher-exercise-${sessionIdOrQuestionId}`
      } else if (currentSession.value) {
        storageKey = `teacher-exercise-${currentSession.value.questionId}`
      } else {
        console.warn('[TEACHER_EXERCISE] ⚠️ 无法加载历史：无题目ID')
        return
      }
      
      const historyData = await asyncStorage.loadTeacherChatHistory(storageKey)
      
      if (historyData) {
        messages.value = historyData.messages || []
        chatResponseTimes.value = historyData.chatResponseTimes || 0
        
        // 更新是否可以查看答案
        if (chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES) {
          canViewAnswer.value = true
        }
        
        // 从localStorage加载会话信息（使用统一存储格式）
        let sessionId: string | null = null
        if (sessionIdOrQuestionId) {
          if (sessionIdOrQuestionId.startsWith('teacher-exercise-')) {
            // 提取 sessionId（去掉 teacher-exercise- 前缀）
            sessionId = sessionIdOrQuestionId.replace('teacher-exercise-', '')
          } else {
            // 直接使用作为 sessionId
            sessionId = sessionIdOrQuestionId
          }
        } else if (currentSession.value) {
          sessionId = currentSession.value.sessionId
        }
        
        if (sessionId) {
          const session = getSession(sessionId)
          if (session) {
            currentSession.value = session
          }
        }
      } else {
        // 无历史记录，清空状态
        messages.value = []
        chatResponseTimes.value = 0
        canViewAnswer.value = false
      }
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 加载聊天历史失败:', error)
      messages.value = []
      chatResponseTimes.value = 0
      canViewAnswer.value = false
    } finally {
      isChatLoading.value = false
    }
  }
  
  /**
   * 清空聊天历史（教师题目场景）
   * 使用题目ID作为存储键
   */
  const clearChatHistory = async (sessionIdOrQuestionId?: string): Promise<void> => {
    try {
      // 优先使用传入的questionId，如果没有则使用当前会话的questionId
      let storageKey: string
      let questionId: string
      if (sessionIdOrQuestionId) {
        if (sessionIdOrQuestionId.startsWith('teacher-exercise-')) {
          storageKey = sessionIdOrQuestionId
          questionId = sessionIdOrQuestionId.replace('teacher-exercise-', '')
        } else {
          storageKey = `teacher-exercise-${sessionIdOrQuestionId}`
          questionId = sessionIdOrQuestionId
        }
      } else if (currentSession.value) {
        storageKey = `teacher-exercise-${currentSession.value.questionId}`
        questionId = currentSession.value.questionId
      } else {
        console.warn('[TEACHER_EXERCISE] ⚠️ 无法清空历史：无题目ID')
        return
      }
      
      // 注意：删除消息历史时，需要找到所有相关的会话并删除
      // 因为一个题目可能有多个会话，但存储键是按题目ID的
      // 所以这里需要特殊处理：删除该题目的所有会话
      const allSessions = loadAllSessions()
      const sessionsToDelete: string[] = []
      for (const [sessionId, session] of Object.entries(allSessions)) {
        if (session.questionId === questionId) {
          sessionsToDelete.push(sessionId)
        }
      }
      
      // 删除所有相关会话
      for (const sessionId of sessionsToDelete) {
        deleteSession(sessionId)
      }
      
      await asyncStorage.removeTeacherChatHistory(storageKey)
      
      messages.value = []
      chatResponseTimes.value = 0
      canViewAnswer.value = false
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 清空聊天历史失败:', error)
      throw error
    }
  }
  
  // ==================== 会话存储管理 ====================
  
  /**
   * 获取统一的会话存储键名
   */
  const getSessionsStorageKey = (): string => {
    const userId = getCurrentUserIdOrDefault()
    return `${userId}_teacher-exercise-sessions`
  }
  
  /**
   * 加载所有会话（从统一的localStorage记录）
   */
  const loadAllSessions = (): Record<string, TeacherExerciseSession> => {
    try {
      const storageKey = getSessionsStorageKey()
      const sessionsData = localStorage.getItem(storageKey)
      if (sessionsData) {
        return JSON.parse(sessionsData) as Record<string, TeacherExerciseSession>
      }
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 加载会话列表失败:', error)
    }
    return {}
  }
  
  /**
   * 保存所有会话（到统一的localStorage记录）
   */
  const saveAllSessions = (sessions: Record<string, TeacherExerciseSession>): void => {
    try {
      const storageKey = getSessionsStorageKey()
      localStorage.setItem(storageKey, JSON.stringify(sessions))
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 保存会话列表失败:', error)
    }
  }
  
  /**
   * 获取单个会话
   */
  const getSession = (sessionId: string): TeacherExerciseSession | null => {
    const sessions = loadAllSessions()
    return sessions[sessionId] || null
  }
  
  /**
   * 保存单个会话（更新到统一的localStorage记录）
   */
  const saveSession = (session: TeacherExerciseSession): void => {
    const sessions = loadAllSessions()
    sessions[session.sessionId] = session
    saveAllSessions(sessions)
  }
  
  /**
   * 删除单个会话（从统一的localStorage记录）
   */
  const deleteSession = (sessionId: string): void => {
    const sessions = loadAllSessions()
    delete sessions[sessionId]
    saveAllSessions(sessions)
  }
  
  /**
   * 获取所有会话（供外部使用）
   */
  const getAllSessions = (): TeacherExerciseSession[] => {
    const sessions = loadAllSessions()
    return Object.values(sessions).sort((a, b) => b.createTime - a.createTime)
  }
  
  /**
   * 迁移旧格式的会话数据到新格式（一次性迁移）
   */
  const migrateOldSessions = (): void => {
    try {
      const userId = getCurrentUserIdOrDefault()
      const sessionPrefix = `${userId}_teacher-exercise-`
      const sessions: Record<string, TeacherExerciseSession> = {}
      let hasOldData = false
      
      // 遍历localStorage查找所有旧格式的会话
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(sessionPrefix) && key.endsWith('_session')) {
          try {
            const sessionData = localStorage.getItem(key)
            if (sessionData) {
              const session = JSON.parse(sessionData) as TeacherExerciseSession
              if (session && session.sessionId) {
                sessions[session.sessionId] = session
                hasOldData = true
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
      
      // 如果有旧数据，迁移到新格式
      if (hasOldData) {
        const existingSessions = loadAllSessions()
        const mergedSessions = { ...existingSessions, ...sessions }
        saveAllSessions(mergedSessions)
        
        // 删除旧格式的数据
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith(sessionPrefix) && key.endsWith('_session')) {
            localStorage.removeItem(key)
          }
        }
        
        console.log('[TEACHER_EXERCISE] ✅ 已迁移旧格式会话数据到新格式', {
          migratedCount: Object.keys(sessions).length
        })
      }
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 迁移旧格式会话数据失败:', error)
    }
  }
  
  /**
   * 重置状态
   */
  const resetState = (): void => {
    messages.value = []
    chatResponseTimes.value = 0
    canViewAnswer.value = false
    isChatLoading.value = false
  }
  
  // ==================== 返回接口 ====================
  
  /**
   * 切换Web搜索
   */
  const toggleWebSearch = (): void => {
    enableWebSearch.value = !enableWebSearch.value
  }
  
  // ==================== 消息接收 ====================
  
  // 标记是否已经初始化了消息接收器（本地标记）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let isReceiverInitialized = false
  
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
   * 实际执行初始化的内部函数
   */
  const doInitMessageReceiver = async (): Promise<void> => {
    // 第1步：设置全局回调（每次调用都重新设置，确保使用最新的回调）
    console.log('[TEACHER_EXERCISE] 🔧 开始设置老师消息接收回调函数')
    
    // 注意：题目场景和通用场景共享同一个全局回调函数
    // 需要在回调中根据 sessionId 判断消息属于哪个场景
    // 这里我们使用一个特殊的回调函数，只处理题目场景的消息
    const originalCallback = window.onTeacherMessageReceived
    
    window.onTeacherMessageReceived = async (messageData: unknown) => {
      try {
        if (!messageData || typeof messageData !== 'object') {
          return
        }
        
        const data = messageData as {
          messageId: string
          sessionId: string
          content: string
          messageType: string
          timestamp: number
          chatRole: string
        }
        
        // 检查消息是否属于题目场景（sessionId 以 teacher-exercise- 开头）
        if (!data.sessionId.startsWith('teacher-exercise-')) {
          // 不属于题目场景，调用原始回调（如果有）
          if (originalCallback && typeof originalCallback === 'function') {
            await originalCallback(messageData)
          }
          return
        }
        
        // 验证消息ID和会话ID格式
        if (!validateMessageId(data.messageId)) {
          console.error('[TEACHER_EXERCISE] ❌ 消息ID验证失败，拒绝处理消息')
          return
        }
        
        if (!validateSessionId(data.sessionId)) {
          console.error('[TEACHER_EXERCISE] ❌ 会话ID验证失败，拒绝处理消息')
          return
        }
        
        // 验证并修正时间戳
        const validatedTimestamp = validateAndFixTimestamp(data.timestamp)
        if (validatedTimestamp !== data.timestamp) {
          data.timestamp = validatedTimestamp
        }
        
        // 检查消息是否属于当前会话
        const isCurrentSession = currentSession.value?.sessionId === data.sessionId
        
        // 消息去重
        if (isCurrentSession && isMessageDuplicate(data.messageId)) {
          console.warn('[TEACHER_EXERCISE] ⚠️ 消息重复，已跳过处理')
          return
        }
        
        // 如果消息不属于当前会话，尝试恢复会话
        if (!isCurrentSession) {
          // 使用统一存储格式恢复会话
          const session = getSession(data.sessionId)
          
          if (session) {
            currentSession.value = session
            
            // 加载聊天历史
            await loadChatHistory(data.sessionId)
          } else {
            // 会话不存在，标记为未读
            const unreadStore = useUnreadMessageStore()
            const unreadKey = `teacher_exercise_${data.sessionId}`
            unreadStore.markUnread(unreadKey)
            return
          }
        }
        
        // 处理不同类型的消息
        const isImageMessage = data.messageType === 'IMAGE'
        const isVoiceMessage = data.messageType === 'VOICE'
        
        if (isImageMessage) {
          // 图片消息处理（类似 teacherGeneralChatStore）
          const isFilePath = data.content?.startsWith('/storage/') || data.content?.startsWith('/data/')
          
          if (isFilePath) {
            // 需要转换文件路径为base64
            const tempMessage: ChatBubble = {
              id: data.messageId,
              messageId: data.messageId,
              content: '[图片加载中...]',
              type: 'teacher',
              timestamp: new Date(data.timestamp).toISOString(),
              sender: 'teacher',
              messageType: 'image',
              imageData: {
                filePath: data.content,
                width: 0,
                height: 0,
                fileSize: 0
              }
            }
            addMessage(tempMessage)
            
            // 异步转换文件路径为base64
            ;(async () => {
              try {
                const bridge = window.AndroidBridge as (typeof window.AndroidBridge & { loadImageFileToBase64?: (filePath: string) => string })
                if (bridge?.loadImageFileToBase64) {
                  const base64Result = bridge.loadImageFileToBase64(data.content)
                  const base64Data = JSON.parse(base64Result)
                  
                  if (base64Data.success && base64Data.data) {
                    const imageMessage: ChatBubble = {
                      id: data.messageId,
                      messageId: data.messageId,
                      content: '',
                      type: 'teacher',
                      timestamp: new Date(data.timestamp).toISOString(),
                      sender: 'teacher',
                      messageType: 'image',
                      imageData: {
                        filePath: data.content,
                        base64DataUrl: base64Data.data,
                        width: 0,
                        height: 0,
                        fileSize: 0
                      }
                    }
                    updateMessage(data.messageId, imageMessage)
                    await saveChatHistory(true)
                  }
                }
              } catch (error) {
                console.error('[TEACHER_EXERCISE] ❌ 转换文件路径时出错:', error)
                updateMessage(data.messageId, {
                  content: '[图片加载失败]',
                  isError: true
                })
              }
            })()
          } else {
            // content已经是base64数据，直接使用
            const imageMessage: ChatBubble = {
              id: data.messageId,
              messageId: data.messageId,
              content: '',
              type: 'teacher',
              timestamp: new Date(data.timestamp).toISOString(),
              sender: 'teacher',
              messageType: 'image',
              imageData: {
                filePath: '',
                base64DataUrl: data.content,
                width: 0,
                height: 0,
                fileSize: 0
              }
            }
            addMessage(imageMessage)
            await saveChatHistory(true)
          }
        } else if (isVoiceMessage) {
          // 语音消息处理
          let voiceFilePath = data.content
          let voiceDuration = 0
          
          if (data.content && data.content.includes(',')) {
            const parts = data.content.split(',')
            if (parts.length >= 2) {
              const durationStr = parts[0].trim()
              voiceFilePath = parts.slice(1).join(',')
              voiceDuration = parseInt(durationStr, 10) || 0
            }
          }
          
          const teacherMessage: ChatBubble = {
            id: data.messageId,
            messageId: data.messageId,
            content: data.content,
            type: 'teacher',
            timestamp: new Date(data.timestamp).toISOString(),
            sender: 'teacher',
            messageType: 'voice',
            voiceData: {
              filePath: voiceFilePath,
              duration: voiceDuration * 1000, // 转换为毫秒
              fileSize: 0
            }
          }
          addMessage(teacherMessage)
          await saveChatHistory(true)
        } else {
          // 文本消息
          const teacherMessage: ChatBubble = {
            id: data.messageId,
            messageId: data.messageId,
            content: data.content,
            type: 'teacher',
            timestamp: new Date(data.timestamp).toISOString(),
            sender: 'teacher'
          }
          addMessage(teacherMessage)
          
          // 更新回复次数
          chatResponseTimes.value++
          if (chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES) {
            canViewAnswer.value = true
          }
          
          await saveChatHistory(true)
        }
      } catch (error) {
        console.error('[TEACHER_EXERCISE] ❌ 处理老师消息时发生错误:', error)
      }
    }
    
    // 第2步：初始化原生监听器
    if (!window.AndroidBridge) {
      const errorMsg = 'AndroidBridge未初始化，无法连接教师消息系统'
      console.error(errorMsg)
      throw new Error(errorMsg)
    }
    
    try {
      // 检查是否已经初始化
      const isInitialized = window.AndroidBridge.isMessagingManagerInitialized?.() ?? false
      
      if (!isInitialized) {
        // 调用初始化接口
        const result = window.AndroidBridge.initTeacherMessageListener()
        const data = JSON.parse(result)
        if (!data.success) {
          const errorMsg = `初始化教师消息监听失败: ${data.message}`
          console.error(errorMsg)
          throw new Error(errorMsg)
        }
        
        // 等待初始化完成（最多等待10秒）
        let waitCount = 0
        const maxWait = 100 // 100次 * 100ms = 10秒
        
        while (waitCount < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 100))
          waitCount++
          
          const initialized = window.AndroidBridge.isMessagingManagerInitialized?.() ?? false
          if (initialized) {
            break
          }
        }
      }
      
      isReceiverInitialized = true
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '初始化教师消息监听失败'
      console.error('初始化教师消息监听失败:', error)
      isReceiverInitialized = false
      throw new Error(errorMsg)
    }
  }
  
  /**
   * 清理消息接收器
   */
  const cleanupMessageReceiver = async (): Promise<void> => {
    // 清除初始化 Promise 缓存，允许重新初始化
    initPromise = null
    
    // 注意：不清理全局回调，因为可能被其他场景使用
    // 如果需要完全清理，需要检查是否有其他场景在使用
    isReceiverInitialized = false
    
    // 不清理原生监听器，因为可能被其他场景使用
    // 如果需要完全清理，需要检查是否有其他场景在使用
  }
  
  return {
    // 状态
    messages,
    chatResponseTimes,
    isChatLoading,
    enableWebSearch,
    canViewAnswer,
    VIEW_ANSWER_CHAT_TIMES,
    currentSession,
    
    // 会话管理
    setSession,
    clearSession,
    createOrGetSession,
    getSessionByQuestionId,
    
    // 方法
    sendMessage,
    retryMessage,
    saveChatHistory,
    loadChatHistory,
    clearChatHistory,
    resetState,
    toggleWebSearch,
    
    // 消息管理
    addMessage,
    updateMessage,
    
    // 消息接收
    initMessageReceiver,
    cleanupMessageReceiver,
    
    // 会话存储管理（供外部使用）
    getAllSessions,
    getSession,
    saveSession,
    deleteSession
  }
})


