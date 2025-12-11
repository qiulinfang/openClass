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
import { chatStorage, type ChatHistoryData } from '../services/storage/chat-storage'
import type { ChatBubble, ExerciseItem, UserInfo } from '../types'
import { createUserMessage } from './utils/chatStoreUtils'
import { authStorageService } from '../services/storage/auth-storage-service'
import type { ChatImageData } from './utils/chatStoreUtils'
import {
  updateMessageError,
  updateMessageRetrying,
  checkRetryCondition,
  buildRetryFailureMessage,
  findMessageIndex,
  validateMessageExists,
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

  /**
   * 删除指定消息
   */
  const deleteMessage = async (messageId: string): Promise<void> => {
    try {
      // 第1步：查找消息索引
      const index = findMessageIndex(messages.value, messageId)
      if (index < 0) {
        throw new Error('消息不存在')
      }
      
      // 第2步：从列表中删除消息
      messages.value.splice(index, 1)
      
      // 第3步：直接保存更新后的聊天历史（不合并，避免已删除的消息重新加载）
      if (currentSession.value) {
        await saveChatHistoryDirect()
      }
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 删除消息失败:', error)
      throw error
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
   * 获取或创建题目会话
   * 第1步：检查是否已存在该题目的会话
   * 第2步：如果已存在，复用已有会话；否则创建新会话
   * 第3步：保存到localStorage
   * 第4步：设置为当前会话
   */
  const getOrCreateSession = (
    questionId: string,
    questionTitle: string,
    subject: 'biology' | 'math',
  ): TeacherExerciseSession => {
    // 第1步：检查是否已存在该题目的会话（使用统一存储格式）
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
        createTime: Date.now(),
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
    const userId = localStorage.getItem('userId') || ''
    return `${userId ? userId + '-' : ''}teacher-exercise-${questionId}-${timestamp}-${random}`
  }

  /**
   * 根据题目ID获取会话
   */
  const getSessionByQuestionId = (
    questionId: string,
    subject: 'biology' | 'math',
  ): TeacherExerciseSession | null => {
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
    skipUserMessage?: boolean,
  ): Promise<void> => {
    console.log('[TEACHER_EXERCISE] 发送消息:', content)
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
      const chatImageData: ChatImageData | undefined =
        imageData && imageData.base64DataUrl
          ? {
              filePath: imageData.filePath || '',
              base64DataUrl: imageData.base64DataUrl,
              width: (imageData as { width?: number }).width || 0,
              height: (imageData as { height?: number }).height || 0,
              fileSize: (imageData as { fileSize?: number }).fileSize || 0,
            }
          : undefined
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
            subjectLower,
            'STUDENT',
          )
        } else {
          console.warn('[TEACHER_EXERCISE] ⚠️ 缺少filePath，使用base64DataUrl（不推荐）')
          result = await window.AndroidBridge.sendPictureToTeacher(
            imageData.base64DataUrl,
            sessionId,
            subjectLower,
            'STUDENT',
          )
        }
      } else {
        // 文本消息：将题目信息包含在消息内容中
        // 格式：题目信息 + 用户消息
        const questionInfo = `题目bmNo: ${currentQuestion.bmNo}\n题目: ${currentQuestion.title || currentQuestion.question || ''}\n`
        const fullContent = questionInfo + content

        result = await window.AndroidBridge.sendTextMessageToTeacher(
          fullContent,
          sessionId,
          subjectLower,
          'STUDENT',
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
          questionBmNo: currentQuestion.bmNo,
        }

        // 最多重试3次，每次延迟递增
        const maxRetries = 3
        let retryCount = 0
        let lastError = error

        while (retryCount < maxRetries) {
          retryCount++
          const delay = retryCount * 2000 // 2秒、4秒、6秒

          await new Promise((resolve) => setTimeout(resolve, delay))

          try {
            const { sessionId, subject } = sessionInfo
            const subjectLower = subject as 'math' | 'biology'

            let result: string
            if (imageData?.base64DataUrl) {
              if (imageData.filePath) {
                result = await window.AndroidBridge.sendPictureToTeacher(
                  imageData.filePath,
                  sessionId,
                  subjectLower,
                  'STUDENT',
                )
              } else {
                result = await window.AndroidBridge.sendPictureToTeacher(
                  imageData.base64DataUrl,
                  sessionId,
                  subjectLower,
                  'STUDENT',
                )
              }
            } else {
              const questionInfo = `题目bmNo: ${currentQuestion.bmNo}\n题目: ${currentQuestion.title || currentQuestion.question || ''}\n`
              const fullContent = questionInfo + content
              result = await window.AndroidBridge.sendTextMessageToTeacher(
                fullContent,
                sessionId,
                subjectLower,
                'STUDENT',
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
            const retryErrorMessage =
              retryError instanceof Error ? retryError.message : String(retryError)
            if (
              retryErrorMessage.includes('正在初始化中') ||
              retryErrorMessage.startsWith('INITIALIZING_RETRY:')
            ) {
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
    imageData?: { filePath: string; base64DataUrl?: string },
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
            subjectLower,
            'STUDENT',
          )
        } else if (messageImageData.base64DataUrl) {
          console.warn('[TEACHER_EXERCISE] ⚠️ 重试时缺少filePath，使用base64DataUrl（不推荐）')
          result = await window.AndroidBridge.sendPictureToTeacher(
            messageImageData.base64DataUrl,
            sessionId,
            subjectLower,
            'STUDENT',
          )
        } else {
          throw new Error('图片数据不完整')
        }
      } else {
        // 文本消息：包含题目信息
        if (currentQuestion) {
          const questionInfo = `题目bmNo: ${currentQuestion.bmNo}\n题目: ${currentQuestion.title || currentQuestion.question || ''}\n`
          const fullContent = questionInfo + content
          result = await window.AndroidBridge.sendTextMessageToTeacher(
            fullContent,
            sessionId,
            subjectLower,
            'STUDENT',
          )
        } else {
          result = await window.AndroidBridge.sendTextMessageToTeacher(
            content,
            sessionId,
            subjectLower,
            'STUDENT',
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
          canRetry: false, // 重试成功后，暂时禁用重试，等待回复
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
          messageImageData,
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
        messageImageData,
      )
      updateMessage(messageId, errorMessage)
    }
  }

  /**
   * 直接保存当前消息列表（不合并，用于删除消息等场景）
   */
  const saveChatHistoryDirect = async (): Promise<void> => {
    if (!currentSession.value) {
      console.log('[TEACHER_EXERCISE] ⚠️ 保存失败：无当前会话')
      return
    }

    try {
      const storageKey = `teacher-exercise-${currentSession.value.questionId}`

      // 过滤掉错误消息、流式消息、系统消息和撤回消息，只保存成功发送的消息
      const messagesToSave = messages.value.filter(
        (msg) =>
          !msg.isError &&
          !msg.isStreaming &&
          !msg.isSystemMessage &&
          !msg.isRecalled &&
          (msg.messageId || msg.id),
      )

      const historyData: ChatHistoryData = {
        questionId: storageKey,
        messages: messagesToSave,
        chatResponseTimes: chatResponseTimes.value,
        lastUpdated: Date.now(),
      }

      await chatStorage.saveTeacherChatHistory(storageKey, historyData)

      // 保存会话信息到localStorage（使用统一存储格式）
      if (currentSession.value) {
        saveSession(currentSession.value)
      }
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 直接保存聊天历史失败:', error)
      throw error
    }
  }

  /**
   * 保存聊天历史（教师题目场景）
   * 使用会话ID作为存储键，立即保存
   */
  const saveChatHistory = async (): Promise<void> => {
    if (!currentSession.value) {
      console.log('[TEACHER_EXERCISE] ⚠️ 保存失败：无当前会话')
      return
    }

    if (messages.value.length === 0) return

    try {
      const storageKey = `teacher-exercise-${currentSession.value.questionId}`

      // 先加载本地消息，避免覆盖已有消息
      console.log('[TEACHER_EXERCISE] 🔍 [存储流程] 保存聊天历史 storageKey', storageKey)
      const loadedHistoryData = await chatStorage.loadTeacherChatHistory(storageKey)
      console.log('[TEACHER_EXERCISE] 🔍 [存储流程] 加载聊天历史', loadedHistoryData)
      if (loadedHistoryData && loadedHistoryData.messages) {
        const loadedMessages = loadedHistoryData.messages || []
        // 合并当前消息和已加载的消息（去重）
        const existingIds = new Set(loadedMessages.map((m) => m.id || m.messageId))
        const newMessages = messages.value.filter((m) => {
          const msgId = m.id || m.messageId
          return msgId && !existingIds.has(msgId)
        })
        // 合并：已加载的消息 + 新的消息
        messages.value = [...loadedMessages, ...newMessages]
        chatResponseTimes.value = loadedHistoryData.chatResponseTimes || chatResponseTimes.value
        console.log(
          `[TEACHER_EXERCISE] 🔍 [存储流程] 合并消息: 已加载=${loadedMessages.length} 新增=${newMessages.length} 总计=${messages.value.length}`,
        )
      }

      // 过滤掉错误消息、流式消息、系统消息和撤回消息，只保存成功发送的消息
      const messagesToSave = messages.value.filter(
        (msg) =>
          !msg.isError &&
          !msg.isStreaming &&
          !msg.isSystemMessage &&
          !msg.isRecalled &&
          (msg.messageId || msg.id),
      )

      const historyData: ChatHistoryData = {
        questionId: storageKey,
        messages: messagesToSave,
        chatResponseTimes: chatResponseTimes.value,
        lastUpdated: Date.now(),
      }

      await chatStorage.saveTeacherChatHistory(storageKey, historyData)

      // 保存会话信息到localStorage（使用统一存储格式）
      if (currentSession.value) {
        saveSession(currentSession.value)
      }
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 保存聊天历史失败:', error)
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
      console.log('[TEACHER_EXERCISE] 🔍 [存储流程] 加载聊天历史 storageKey', storageKey)
      const historyData = await chatStorage.loadTeacherChatHistory(storageKey)

      if (historyData) {
        messages.value = historyData.messages || []
        console.log('[TEACHER_EXERCISE] 🔍 [存储流程] 加载聊天历史', messages.value)
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
        console.log('[TEACHER_EXERCISE] 🔍 [存储流程] 加载聊天历史清空', messages.value)
        chatResponseTimes.value = 0
        canViewAnswer.value = false
      }
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 加载聊天历史失败:', error)
      messages.value = []
      console.log('[TEACHER_EXERCISE] 🔍 [存储流程] 加载聊天历史清空', messages.value)
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

      await chatStorage.removeTeacherChatHistory(storageKey)

      messages.value = []
      console.log('[TEACHER_EXERCISE] 🔍 [存储流程] 清空聊天历史清空', messages.value)
      chatResponseTimes.value = 0
      canViewAnswer.value = false
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 清空聊天历史失败:', error)
      throw error
    }
  }

  // ==================== 会话存储管理 ====================

  /**
   * 获取旧版 localStorage 会话存储键名（仅用于一次性迁移）
   */
  const getLegacySessionsStorageKey = (): string => {
    const userId = authStorageService.getCurrentUserIdOrDefault()
    return `${userId}_teacher-exercise-sessions`
  }

  /**
   * 加载所有会话
   * 优先从旧版 localStorage 迁移到 IndexedDB/localforage，之后都走新表
   */
  const loadAllSessions = (): Record<string, TeacherExerciseSession> => {
    try {
      const legacyKey = getLegacySessionsStorageKey()
      const legacyData = localStorage.getItem(legacyKey)

      if (legacyData) {
        // 一次性迁移：localStorage -> ExerciseSolveApp(teacher_exercise_sessions)
        const legacySessions = JSON.parse(legacyData) as Record<string, TeacherExerciseSession>
        // 异步写入新表（不阻塞当前同步返回）
        chatStorage
          .saveTeacherExerciseSessions(legacySessions)
          .then(() => {
            localStorage.removeItem(legacyKey)
          })
          .catch((error) => {
            console.error('[TEACHER_EXERCISE] ❌ 迁移教师会话到 IndexedDB 失败:', error)
          })
        return legacySessions
      }

      // 无旧数据时，从新表加载
      // 注意：chatStorage.loadTeacherExerciseSessions 是异步，这里只做最佳努力的同步包装
      // 初次调用时可以先返回空对象，实际数据通过上层重新 loadAllSessions 时获取
      // 为了兼容当前同步调用场景，这里采用“同步返回缓存 + 异步刷新”的模式
      // 简化起见：直接返回空对象，真实数据依赖后续显式刷新
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 加载会话列表失败:', error)
    }
    return {}
  }

  /**
   * 保存所有会话
   * 新版：保存到 ExerciseSolveApp 的 teacher_exercise_sessions 表
   */
  const saveAllSessions = (sessions: Record<string, TeacherExerciseSession>): void => {
    try {
      // 新实现：写入 IndexedDB/localforage
      chatStorage
        .saveTeacherExerciseSessions(sessions)
        .catch((error) => {
          console.error('[TEACHER_EXERCISE] ❌ 保存会话列表失败:', error)
        })
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
   * 重置状态
   */
  const resetState = (): void => {
    messages.value = []
    console.log('[TEACHER_EXERCISE] 🔍 [存储流程] 重置状态清空', messages.value)
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
   * 消息数据类型定义
   */
  type TeacherMessageData = {
    messageId: string
    sessionId: string
    content: string
    messageType: string
    isSelf: boolean
    timestamp: number
    chatRole: string
    debugLogs?: string[] // Android端调试日志
  }

  /**
   * 验证消息数据格式
   */
  const validateMessageData = (messageData: unknown): TeacherMessageData | null => {
    if (!messageData) {
      console.error('[TEACHER_EXERCISE] ❌ 消息数据为空，拒绝处理')
      return null
    }

    if (typeof messageData !== 'object') {
      console.error('[TEACHER_EXERCISE] ❌ 消息数据格式错误，期望对象，实际:', typeof messageData)
      return null
    }

    return messageData as TeacherMessageData
  }

  /**
   * 验证消息核心信息（ID、时间戳、去重）
   */
  const validateMessageCore = (
    data: TeacherMessageData,
  ): { isValid: boolean; isCurrentSession: boolean; validatedTimestamp: number } => {
    // 1. ID验证：验证messageId和sessionId格式
    if (!validateMessageId(data.messageId)) {
      console.error('[TEACHER_EXERCISE] ❌ 消息ID验证失败，拒绝处理消息')
      return { isValid: false, isCurrentSession: false, validatedTimestamp: data.timestamp }
    }

    if (!validateSessionId(data.sessionId)) {
      console.error('[TEACHER_EXERCISE] ❌ 会话ID验证失败，拒绝处理消息')
      return { isValid: false, isCurrentSession: false, validatedTimestamp: data.timestamp }
    }

    // 2. 时间戳验证：验证并修正时间戳
    const validatedTimestamp = validateAndFixTimestamp(data.timestamp)
    // 如果时间戳被修正，更新data对象
    if (validatedTimestamp !== data.timestamp) {
      data.timestamp = validatedTimestamp
    }

    // 检查消息是否属于当前会话
    const isCurrentSession = currentSession.value?.sessionId === data.sessionId

    // 3. 消息去重：如果消息属于当前会话，检查是否已存在
    // 注意：如果消息不属于当前会话，需要在恢复会话后再检查去重（addMessage中已有去重逻辑）
    if (isCurrentSession && isMessageDuplicate(data.messageId)) {
      console.warn('[TEACHER_EXERCISE] ⚠️ 消息重复，已跳过处理')
      return { isValid: false, isCurrentSession: true, validatedTimestamp }
    }

    return { isValid: true, isCurrentSession, validatedTimestamp }
  }

  /**
   * 处理系统消息
   */
  const handleSystemMessage = (data: TeacherMessageData, isCurrentSession: boolean): boolean => {
    const isSystemMessage = data.messageType === 'SYSTEM' || data.content?.startsWith('[SYSTEM]')
    if (!isSystemMessage) {
      return false
    }

    // 系统消息只显示，不保存到历史
    const systemMessage: ChatBubble = {
      id: data.messageId,
      messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
      content: data.content?.replace(/^\[SYSTEM\]\s*/, '') || data.content || '系统消息',
      type: 'teacher',
      sender: 'teacher',
      timestamp: new Date(data.timestamp).toISOString(),
      messageType: 'system',
      isSystemMessage: true,
    }

    // 只添加到当前显示，不保存
    if (isCurrentSession) {
      addMessage(systemMessage)
    }

    // 显示系统通知
    showMessage(systemMessage.content, 'info', 3000)
    return true // 系统消息不保存到历史，直接返回
  }

  /**
   * 显示消息通知
   */
  const showMessageNotification = (data: TeacherMessageData, isCurrentSession: boolean): void => {
    // 构建通知消息内容
    let notificationText = ''
    if (data.messageType === 'IMAGE') {
      notificationText = '收到老师发送的图片'
    } else if (data.messageType === 'VOICE') {
      notificationText = '收到老师发送的语音'
    } else {
      // 文本消息，显示内容预览（最多50个字符）
      const contentPreview = data.content?.substring(0, 50) || ''
      notificationText = contentPreview.length >= 50 ? `${contentPreview}...` : contentPreview
      if (!notificationText.trim()) {
        notificationText = '收到老师的消息'
      }
    }

    // 如果不在当前会话，添加提示
    if (!isCurrentSession) {
      notificationText = `[其他会话] ${notificationText}`
    }

    // 显示全局通知
    try {
      showMessage(notificationText, 'info', 3000)
    } catch (error) {
      console.warn('[TEACHER_EXERCISE] ⚠️ 显示通知失败:', error)
    }
  }

  /**
   * 为消息确保会话存在
   */
  const ensureSessionForMessage = async (
    data: TeacherMessageData,
    isCurrentSession: boolean,
  ): Promise<boolean> => {
    // 如果消息属于当前会话，直接返回
    if (isCurrentSession) {
      return true
    }

    // 尝试从统一的 localStorage 记录恢复会话
    const restoredSession = getSession(data.sessionId)
    if (restoredSession) {
      // 会话数据存在，恢复会话
      currentSession.value = restoredSession

      // 加载聊天历史（使用 questionId 而不是 sessionId，确保与保存时的 storageKey 一致）
      await loadChatHistory(restoredSession.questionId)

      // 触发自定义事件，通知组件刷新会话列表
      try {
        window.dispatchEvent(
          new CustomEvent('teacher-exercise-session-restored', {
            detail: { sessionId: restoredSession.sessionId, session: restoredSession },
          }),
        )
      } catch (error) {
        console.warn('[TEACHER_EXERCISE] ⚠️ 触发事件失败:', error)
      }

      // 恢复会话后，继续处理消息（不返回）
      return true
    } else {
      // 会话不存在，标记为未读
      const unreadStore = useUnreadMessageStore()
      const unreadKey = `teacher_exercise_${data.sessionId}`
      unreadStore.markUnread(unreadKey)
      return false
    }
  }

  /**
   * 处理图片消息（文件路径转base64）
   */
  const processImageMessageFromFilePath = async (
    data: TeacherMessageData,
    filePath: string,
  ): Promise<void> => {
    // 调用Android Bridge将文件路径转换为base64
    // 注意：这里需要异步处理，但addMessage是同步的
    // 我们需要先创建一个临时消息，然后异步更新
    const tempMessage: ChatBubble = {
      id: data.messageId,
      messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
      content: '[图片加载中...]',
      type: 'teacher',
      timestamp: new Date(data.timestamp).toISOString(),
      sender: 'teacher',
      messageType: 'image',
      // 临时使用文件路径作为标识
      imageData: {
        filePath: filePath,
        width: 0,
        height: 0,
        fileSize: 0,
      },
    }

    addMessage(tempMessage)

    // 异步转换文件路径为base64
    try {
      // 调用Android Bridge方法（如果存在）
      // 使用类型断言，因为loadImageFileToBase64可能尚未在所有类型定义中
      const bridge = window.AndroidBridge as typeof window.AndroidBridge & {
        loadImageFileToBase64?: (filePath: string) => string
      }
      if (bridge?.loadImageFileToBase64) {
        const base64Result = bridge.loadImageFileToBase64(filePath)
        const base64Data = JSON.parse(base64Result)

        if (base64Data.success && base64Data.data) {
          const base64DataUrl = base64Data.data

          // 更新消息，添加base64数据
          const imageMessage: ChatBubble = {
            id: data.messageId,
            messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
            content: '', // 图片消息不显示文字内容
            type: 'teacher',
            timestamp: new Date(data.timestamp).toISOString(),
            sender: 'teacher',
            messageType: 'image',
            imageData: {
              filePath: filePath,
              base64DataUrl: base64DataUrl,
              width: 0, // 可以从Android端获取，但这里先设为0
              height: 0,
              fileSize: 0,
            },
          }

          // 更新消息
          const index = messages.value.findIndex((m) => m.id === data.messageId)
          if (index !== -1) {
            messages.value[index] = imageMessage
            console.log(`[messages] ~ 更新图片消息 id=${data.messageId} index=${index}`)
            await saveChatHistory()
          }
        } else {
          console.error('[TEACHER_EXERCISE] ❌ 文件路径转换失败:', base64Data.message)
          // 更新消息显示错误
          const index = messages.value.findIndex((m) => m.id === data.messageId)
          if (index !== -1) {
            messages.value[index] = {
              ...tempMessage,
              content: '[图片加载失败: ' + (base64Data.message || '未知错误') + ']',
              isError: true,
            }
            console.log(`[messages] ~ 更新图片消息(错误) id=${data.messageId} index=${index}`)
            await saveChatHistory()
          }
        }
      } else {
        console.warn(
          '[TEACHER_EXERCISE] ⚠️ Android Bridge不支持loadImageFileToBase64，尝试直接使用文件路径',
        )
        // 如果Bridge不支持，尝试使用file://协议（但WebView可能不支持）
        // 或者显示错误提示
        const index = messages.value.findIndex((m) => m.id === data.messageId)
        if (index !== -1) {
          messages.value[index] = {
            ...tempMessage,
            content: '[图片加载失败: 不支持的文件路径格式]',
            isError: true,
          }
          console.log(`[messages] ~ 更新图片消息(不支持) id=${data.messageId} index=${index}`)
          await saveChatHistory()
        }
      }
    } catch (error) {
      console.error('[TEACHER_EXERCISE] ❌ 转换文件路径时出错:', error)
      const index = messages.value.findIndex((m) => m.id === data.messageId)
      if (index !== -1) {
        messages.value[index] = {
          ...tempMessage,
          content: '[图片加载失败: ' + (error instanceof Error ? error.message : '未知错误') + ']',
          isError: true,
        }
        console.log(`[messages] ~ 更新图片消息(异常) id=${data.messageId} index=${index}`)
        await saveChatHistory()
      }
    }
  }

  /**
   * 处理图片消息
   */
  const processImageMessage = (data: TeacherMessageData): void => {
    // 检查content是否是文件路径（以/storage/开头）
    const isFilePath = data.content?.startsWith('/storage/') || data.content?.startsWith('/data/')

    if (isFilePath) {
      // 异步处理文件路径转换（不等待完成）
      processImageMessageFromFilePath(data, data.content).catch((error) => {
        console.error('[TEACHER_EXERCISE] ❌ 处理图片消息失败:', error)
      })
    } else {
      // content已经是base64数据，直接使用
      const imageMessage: ChatBubble = {
        id: data.messageId,
        messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
        content: '', // 图片消息不显示文字内容
        type: 'teacher',
        timestamp: new Date(data.timestamp).toISOString(),
        sender: 'teacher',
        messageType: 'image',
        imageData: {
          filePath: '', // 如果content是base64，可能没有filePath
          base64DataUrl: data.content,
          width: 0,
          height: 0,
          fileSize: 0,
        },
      }
      addMessage(imageMessage)
      saveChatHistory()
    }
  }

  /**
   * 处理语音消息
   */
  const processVoiceMessage = (data: TeacherMessageData): void => {
    // 语音消息处理（类似图片消息）
    // 解析语音消息内容：格式为 "duration,filePath"
    // 参考 Android 端 VoiceDbUtil.extractDbVoiceContent 方法
    // Android 端 getDuration 返回秒，然后设置为 "duration,filePath" 格式
    let voiceFilePath = data.content
    let voiceDuration = 0

    if (data.content && data.content.includes(',')) {
      const parts = data.content.split(',')
      if (parts.length >= 2) {
        // 第一部分是时长（秒），第二部分是文件路径
        const durationStr = parts[0].trim()
        voiceFilePath = parts.slice(1).join(',') // 处理路径中可能包含逗号的情况
        voiceDuration = parseInt(durationStr, 10) || 0

        // 检查 duration 是否为 0，可能是文件问题
        if (voiceDuration === 0) {
          console.warn('[TEACHER_EXERCISE] ⚠️ 语音消息时长为 0，可能是文件损坏或无法获取时长')
          // 如果有调试日志，已经在上面打印了，这里提示用户查看日志
          if (data.debugLogs && data.debugLogs.length > 0) {
            console.warn('[TEACHER_EXERCISE] ⚠️ 请查看上方的Android端调试日志，了解详细原因')
          }
        }
      } else {
        console.warn('[TEACHER_EXERCISE] ⚠️ 语音消息格式异常，parts.length < 2:', parts.length)
      }
    } else {
      console.warn('[TEACHER_EXERCISE] ⚠️ 语音消息 content 格式异常，不包含逗号:', data.content)
    }

    const teacherMessage: ChatBubble = {
      id: data.messageId,
      messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
      content: data.content,
      type: 'teacher',
      timestamp: new Date(data.timestamp).toISOString(),
      sender: 'teacher',
      messageType: 'voice',
      voiceData: {
        filePath: voiceFilePath,
        duration: voiceDuration * 1000, // 转换为毫秒（与前端其他地方的 duration 保持一致）
        fileSize: 0, // 语音消息暂时不需要fileSize，设为0
      },
    }
    addMessage(teacherMessage)
    saveChatHistory()
  }

  /**
   * 处理文本消息
   */
  const processTextMessage = (data: TeacherMessageData): void => {
    const teacherMessage: ChatBubble = {
      id: data.messageId,
      messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
      content: data.content,
      type: 'teacher',
      timestamp: new Date(data.timestamp).toISOString(),
      sender: 'teacher',
    }
    addMessage(teacherMessage)

    // 更新回复次数
    chatResponseTimes.value++
    if (chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES) {
      canViewAnswer.value = true
    }

    saveChatHistory()
  }

  /**
   * 创建消息接收回调函数
   */
  const createMessageReceiverCallback = (): ((messageData: unknown) => Promise<void>) => {
    return async (messageData: unknown) => {
      try {
        // 参数验证
        const data = validateMessageData(messageData)
        if (!data) {
          return
        }

        // 注意：场景检查已在包装回调中完成，这里只处理属于题目场景的消息
        const validation = validateMessageCore(data)
        if (!validation.isValid) {
          return
        }

        // 更新时间戳
        const { isCurrentSession, validatedTimestamp } = validation
        data.timestamp = validatedTimestamp

        // 处理系统消息（不保存到历史）
        if (handleSystemMessage(data, isCurrentSession)) {
          return
        }

        // 显示全局通知
        showMessageNotification(data, isCurrentSession)

        // 如果消息不属于当前会话，尝试恢复或创建会话
        const canContinue = await ensureSessionForMessage(data, isCurrentSession)
        if (!canContinue) {
          return
        }

        // 处理不同类型的消息
        if (data.messageType === 'IMAGE') {
          processImageMessage(data)
        } else if (data.messageType === 'VOICE') {
          processVoiceMessage(data)
        } else {
          processTextMessage(data)
        }
      } catch {
        // 不抛出错误，避免影响其他消息的处理
      }
    }
  }

  /**
   * 清理旧的Android Bridge监听器
   */
  const cleanupAndroidBridgeListener = (): void => {
    if (!window.AndroidBridge) {
      return
    }
    try {
      const cleanupResult = window.AndroidBridge.cleanupTeacherMessageListener?.()
      if (cleanupResult) {
        JSON.parse(cleanupResult)
      }
    } catch {
      // 忽略清理错误
    }
  }

  /**
   * 等待MessagingManager初始化完成
   */
  const waitForMessagingManagerInitialization = async (): Promise<void> => {
    if (!window.AndroidBridge) {
      return
    }

    // 等待初始化完成（最多等待10秒，与Android端保持一致）
    let waitCount = 0
    const maxWait = 100 // 100次 * 100ms = 10秒
    let lastWarningTime = 0
    const warningInterval = 2000 // 每2秒最多输出一次警告

    while (waitCount < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      waitCount++

      const initialized = window.AndroidBridge.isMessagingManagerInitialized?.() ?? false
      const connecting = window.AndroidBridge.isMessagingManagerConnecting?.() ?? false

      if (initialized) {
        break
      }

      // 如果不再连接中且未初始化，且距离上次警告超过2秒，才输出警告
      const now = Date.now()
      if (!connecting && waitCount > 20 && now - lastWarningTime > warningInterval) {
        console.warn(
          `⚠️ MessagingManager初始化可能失败（已等待${waitCount * 100}ms），但继续等待...`,
        )
        lastWarningTime = now
      }
    }

    // 最终检查初始化状态
    const finalInitialized = window.AndroidBridge.isMessagingManagerInitialized?.() ?? false
    const finalConnecting = window.AndroidBridge.isMessagingManagerConnecting?.() ?? false

    if (!finalInitialized) {
      if (finalConnecting) {
        console.warn(
          '⚠️ MessagingManager初始化超时（10秒），但仍在后台初始化中，后续操作会自动重试',
        )
      } else {
        console.warn(
          '⚠️ MessagingManager初始化超时（10秒），可能初始化失败，后续发送消息时会自动重试',
        )
      }
      // 不抛出错误，因为可能仍在后台初始化，后续发送消息时会重试
    }
  }

  /**
   * 初始化Android Bridge监听器
   */
  const initializeAndroidBridgeListener = async (): Promise<void> => {
    if (!window.AndroidBridge) {
      const errorMsg = 'AndroidBridge未初始化，无法连接教师消息系统'
      console.error(errorMsg)
      throw new Error(errorMsg)
    }

    // 检查是否已经初始化
    const isInitialized = window.AndroidBridge.isMessagingManagerInitialized?.() ?? false

    // 如果已经初始化过，只更新回调函数，不重复初始化 Android 端
    if (isReceiverInitialized && isInitialized) {
      // 回调函数已经在第1步设置，这里直接返回即可
      return
    }

    if (!isInitialized) {
      // 在初始化之前，先清理旧的监听器（防止重复添加）
      cleanupAndroidBridgeListener()

      // 调用初始化接口（会同时初始化 MessagingManager 和添加监听器）
      const result = window.AndroidBridge.initTeacherMessageListener()
      const data = JSON.parse(result)
      if (!data.success) {
        const errorMsg = `初始化教师消息监听失败: ${data.message}`
        console.error(errorMsg)
        throw new Error(errorMsg)
      }

      // 等待初始化完成
      await waitForMessagingManagerInitialization()
    } else {
      // MessagingManager 已初始化，但我们仍需要确保监听器已添加
      // 注意：如果本地标记未设置，说明可能是页面刷新或首次调用，需要确保监听器已添加
      // 调用 initTeacherMessageListener 会添加监听器（如果已存在会先清理再添加，确保不重复）
      // 注意：这里会执行清理操作，但这是必要的，因为方法引用可能已变化
      cleanupAndroidBridgeListener()

      const result = window.AndroidBridge.initTeacherMessageListener()
      const data = JSON.parse(result)
      if (!data.success) {
        console.warn('[TEACHER_EXERCISE] ⚠️ 添加监听器失败:', data.message)
        // 不抛出错误，因为 MessagingManager 已经初始化，可能只是重复调用
      }
    }

    isReceiverInitialized = true
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
    const exerciseCallback = createMessageReceiverCallback()

    // 创建包装回调，处理场景路由
    window.onTeacherMessageReceived = async (messageData: unknown) => {
      console.log('收到老师回复', messageData)
      try {
        // 先检查消息是否属于题目场景
        if (messageData && typeof messageData === 'object') {
          const data = messageData as { sessionId?: string }
          if (data.sessionId?.startsWith('teacher-exercise-')) {
            // 属于题目场景，使用题目场景的回调
            await exerciseCallback(messageData)
            return
          }
        }

        // 不属于题目场景，调用原始回调（如果有）
        if (originalCallback && typeof originalCallback === 'function') {
          await originalCallback(messageData)
        }
      } catch (error) {
        console.error('[TEACHER_EXERCISE] ❌ 处理消息时发生错误:', error)
      }
    }

    // 确认回调函数已设置（立即验证）
    const callbackType = typeof window.onTeacherMessageReceived
    const isFunction = callbackType === 'function'

    // 如果回调函数设置失败，抛出错误
    if (!isFunction) {
      const errorMsg = `回调函数设置失败！期望类型: function，实际类型: ${callbackType}`
      console.error('[TEACHER_EXERCISE] ❌', errorMsg)
      throw new Error(errorMsg)
    }

    // 第2步：初始化原生监听器
    try {
      await initializeAndroidBridgeListener()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '初始化教师消息监听失败'
      console.error('初始化教师消息监听失败:', error)
      // 初始化失败时清除标志，允许重试
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
    getOrCreateSession,
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
    deleteMessage,

    // 消息接收
    initMessageReceiver,
    cleanupMessageReceiver,

    // 会话存储管理（供外部使用）
    getAllSessions,
    getSession,
    saveSession,
    deleteSession,
  }
})
