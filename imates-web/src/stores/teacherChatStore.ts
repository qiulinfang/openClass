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
import { apiService } from '../services/api-service'
import { asyncStorage } from '../services/chat-storage'
import { showMessage } from '../utils'
import { useUserStore } from './userStore'
import { useQuestionStore } from './questionStore'
import { getCurrentUserIdOrDefault } from '../utils/userId'
import {
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
  
  /** 待发送图片（用于拍作业场景） */
  const pendingImage = ref<{
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  } | null>(null)
  
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
   * 添加去重逻辑，防止重复添加相同 messageId 的消息
   */
  const addMessage = (message: ChatBubble): void => {
    // 检查是否已存在相同的消息ID
    const existingIndex = findMessageIndex(messages.value, message.id)
    if (existingIndex >= 0) {
      console.warn('[TeacherStore] ⚠️ 消息已存在，跳过重复添加:', {
        messageId: message.id,
        existingIndex,
        currentTotal: messages.value.length,
        existingContent: messages.value[existingIndex].content?.substring(0, 50)
      })
      return // 已存在，跳过添加
    }
    
    console.log('[TeacherStore] 📨 添加消息:', { 
      id: message.id, 
      type: message.type, 
      messageType: message.messageType,
      content: message.content?.substring(0, 50),
      hasVoiceData: !!message.voiceData,
      hasImageData: !!message.imageData
    })
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
  const sendMessage = async (
    content: string,
    imageData?: ChatImageData,
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
    
    // 第2步：采用乐观发送，消息已在ChatView中预先添加，这里不再添加
    // 注意：ChatView会在调用sendMessage前预先添加用户消息到store
    
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
      const sendStartTime = performance.now()
      
      if (imageData?.base64DataUrl) {
        // 图片消息：使用filePath发送给Android端（如果有），否则回退到base64DataUrl
        // 渲染时使用base64DataUrl
        console.log('[TeacherStore] 🖼️ 发送图片消息')
        console.log('[TeacherStore] 🖼️ 图片数据 -', {
          hasFilePath: !!imageData.filePath,
          hasBase64: !!imageData.base64DataUrl,
          base64Length: imageData.base64DataUrl?.length || 0
        })
        
        if (imageData.filePath) {
          // 优先使用filePath（更高效，避免传递大base64字符串）
          console.log('[TeacherStore] 📁 使用filePath发送:', imageData.filePath)
          result = await window.AndroidBridge.sendPictureToTeacher(
            imageData.filePath,
            sessionId,
            subject
          )
        } else {
          // 如果没有filePath，回退使用base64DataUrl（兼容旧代码）
          console.warn('[TeacherStore] ⚠️ 缺少filePath，使用base64DataUrl（不推荐）')
          result = await window.AndroidBridge.sendPictureToTeacher(
            imageData.base64DataUrl,
            sessionId,
            subject
          )
        }
      } else {
        // 文本消息
        console.log('[TeacherStore] 💬 发送文本消息')
        console.log('[TeacherStore] 💬 消息内容 -', {
          contentLength: content?.length || 0,
          contentPreview: content?.substring(0, 100) || 'null',
          sessionId,
          subject
        })
        result = await window.AndroidBridge.sendTextMessageToTeacher(
          content,
          sessionId,
          subject
        )
      }
      
      const sendDuration = performance.now() - sendStartTime
      console.log('[TeacherStore] 📥 发送结果返回, 耗时=' + sendDuration.toFixed(2) + 'ms')
      console.log('[TeacherStore] 📥 原始结果类型:', typeof result)
      console.log('[TeacherStore] 📥 原始结果长度:', result?.length || 0)
      console.log('[TeacherStore] 📥 原始结果预览:', result?.substring(0, 200) || 'null')
      
      let data: { success: boolean; message?: string; data?: unknown }
      try {
        data = JSON.parse(result)
        console.log('[TeacherStore] 📥 解析后的结果 -', {
          success: data.success,
          message: data.message,
          hasData: !!data.data,
          dataKeys: data.data ? Object.keys(data.data) : []
        })
      } catch (parseError) {
        console.error('[TeacherStore] ❌ JSON解析失败:', parseError)
        console.error('[TeacherStore] ❌ 原始结果:', result)
        throw new Error('响应格式错误')
      }
      
      if (data.success) {
        console.log('[TeacherStore] ✅ 消息发送成功，等待教师回复...')
        
        if (data.data) {
          console.log('[TeacherStore] ✅ 返回数据详情:', data.data)
          const messageData = data.data as { messageId?: string }
          if (messageData.messageId) {
            console.log('[TeacherStore] ✅ messageId:', messageData.messageId)
          }
        }
        
        // 增加响应次数
        chatResponseTimes.value++
        console.log('[TeacherStore] 📊 响应次数:', chatResponseTimes.value)
        
        // 保存聊天历史
        console.log('[TeacherStore] 💾 开始保存聊天历史')
        const saveStartTime = performance.now()
        await saveChatHistory()
        const saveDuration = performance.now() - saveStartTime
        console.log('[TeacherStore] 💾 聊天历史保存完成, 耗时=' + saveDuration.toFixed(2) + 'ms')
        
        // 检查是否需要自动生成标题（第3轮对话后，6条消息）
        if (currentSession.value && messages.value.length === 6) {
          console.log('[TeacherStore] 📝 触发自动生成标题（消息数=' + messages.value.length + '）')
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
        console.error('[TeacherStore] ❌ 失败详情:', {
          success: data.success,
          message: data.message,
          data: data.data
        })
        
        // 检查是否为"正在初始化中"错误，如果是则自动重试
        const errorMessage = data.message || '发送失败'
        if (errorMessage.includes('正在初始化中')) {
          console.log('[TeacherStore] 🔄 检测到初始化中错误，准备自动重试')
          throw new Error('INITIALIZING_RETRY:' + errorMessage)
        }
        
        throw new Error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // 处理"正在初始化中"的自动重试
      if (errorMessage.startsWith('INITIALIZING_RETRY:')) {
        console.log('[TeacherStore] 🔄 开始自动重试（RabbitMQ初始化中）')
        
        // 保存当前会话信息，避免重试过程中状态变化
        if (!currentSession.value) {
          console.error('[TeacherStore] ❌ 重试失败：会话已失效')
          showMessage('会话已失效，请重新选择', 'error')
          return
        }
        
        const sessionInfo = {
          sessionId: currentSession.value.sessionId,
          subject: currentSession.value.subject || 'math'
        }
        
        // 最多重试3次，每次延迟递增
        const maxRetries = 3
        let retryCount = 0
        let lastError = error
        
        while (retryCount < maxRetries) {
          retryCount++
          const delay = retryCount * 2000 // 2秒、4秒、6秒
          console.log(`[TeacherStore] 🔄 等待 ${delay}ms 后重试 (${retryCount}/${maxRetries})`)
          
          // 等待延迟
          await new Promise(resolve => setTimeout(resolve, delay))
          
          try {
            console.log(`[TeacherStore] 🔄 执行第 ${retryCount} 次重试`)
            // 重新发送消息（使用保存的会话信息）
            const { sessionId, subject } = sessionInfo
            
            let result: string
            if (imageData?.base64DataUrl) {
              if (imageData.filePath) {
                result = await window.AndroidBridge.sendPictureToTeacher(
                  imageData.filePath,
                  sessionId,
                  subject
                )
              } else {
                result = await window.AndroidBridge.sendPictureToTeacher(
                  imageData.base64DataUrl,
                  sessionId,
                  subject
                )
              }
            } else {
              result = await window.AndroidBridge.sendTextMessageToTeacher(
                content,
                sessionId,
                subject
              )
            }
            
            const retryData = JSON.parse(result)
            if (retryData.success) {
              console.log(`[TeacherStore] ✅ 第 ${retryCount} 次重试成功`)
              // 重试成功，更新状态
              chatResponseTimes.value++
              await saveChatHistory()
              
              // 检查是否需要自动生成标题
              if (currentSession.value && messages.value.length === 6) {
                const userStore = useUserStore()
                generateSessionTitle(
                  sessionInfo.sessionId,
                  userStore.userInfo,
                  sessionInfo.subject as 'MATH' | 'BIOLOGY'
                ).catch((err: Error) => {
                  console.warn('[TeacherStore] ⚠️ 自动生成标题失败:', err)
                })
              }
              return // 重试成功，退出
            } else {
              // 如果仍然是初始化中错误，继续重试
              if (retryData.message?.includes('正在初始化中')) {
                console.log(`[TeacherStore] ⚠️ 第 ${retryCount} 次重试仍为初始化中，继续重试`)
                lastError = new Error(retryData.message)
                continue
              } else {
                // 其他错误，直接抛出
                throw new Error(retryData.message || '发送失败')
              }
            }
          } catch (retryError) {
            const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError)
            if (retryErrorMessage.includes('正在初始化中') || retryErrorMessage.startsWith('INITIALIZING_RETRY:')) {
              console.log(`[TeacherStore] ⚠️ 第 ${retryCount} 次重试仍为初始化中，继续重试`)
              lastError = retryError as Error
              continue
            } else {
              // 其他错误，直接抛出
              throw retryError
            }
          }
        }
        
        // 所有重试都失败了
        console.error(`[TeacherStore] ❌ 自动重试 ${maxRetries} 次后仍失败`)
        throw lastError
      }
      
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
        
        // 第4步：单独保存会话信息到localStorage（加上用户ID前缀）
        const userId = getCurrentUserIdOrDefault()
        localStorage.setItem(`${userId}_${storageKey}_session`, JSON.stringify(currentSession.value))
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
        
        // 从localStorage加载会话信息（加上用户ID前缀）
        const userId = getCurrentUserIdOrDefault()
        const sessionData = localStorage.getItem(`${userId}_${storageKey}_session`)
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
      const userId = getCurrentUserIdOrDefault()
      const storageKey = `teacher_chat_${sessionId}`
      // 使用asyncStorage删除聊天记录（会带上用户ID前缀）
      await asyncStorage.removeChatHistory(storageKey)
      // 删除会话信息（加上用户ID前缀）
      localStorage.removeItem(`${userId}_${storageKey}_session`)
      clearMessages()
    } catch (error) {
      console.error('清除教师聊天历史失败:', error)
    }
  }
  
  // ==================== 会话创建 ====================
  
  /**
   * 创建教师会话
   * 第1步：尝试从aiSessionId提取题目ID（如果格式为 ai_session_{questionId}_...）
   * 第2步：检查是否已存在相同的会话（基于题目ID、sessionName和subject）
   * 第3步：如果已存在，复用已有会话；否则创建新会话
   * 第4步：保存到localStorage
   * 第5步：设置为当前会话
   */
  const createTeacherSession = (
    aiSessionId: string,
    aiSessionName: string,
    subject: 'biology' | 'math'
  ): TeacherSession => {
    // 第1步：尝试从aiSessionId提取题目ID
    // aiSessionId格式可能是: ai_session_{questionId}_{timestamp}_{random}
    let questionId: string | null = null
    const match = aiSessionId.match(/^ai_session_([^_]+)_/)
    if (match && match[1]) {
      questionId = match[1]
      console.log('[TeacherStore] 📋 从aiSessionId提取题目ID:', questionId)
    }
    
    // 第2步：检查是否已存在相同的会话（仅检查当前用户的数据）
    // 优先匹配：sessionName和subject完全相同
    // 如果是基于题目的会话，也可以基于题目ID匹配
    const userId = getCurrentUserIdOrDefault()
    const sessionPrefix = `${userId}_teacher_chat_`
    let existingSession: TeacherSession | null = null
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(sessionPrefix) && key.endsWith('_session')) {
        try {
          const sessionData = localStorage.getItem(key)
          if (sessionData) {
            const session = JSON.parse(sessionData) as TeacherSession
            
            // 匹配条件1：sessionName和subject完全相同
            const nameAndSubjectMatch = session.sessionName === aiSessionName && 
                                      session.subject === subject
            
            // 匹配条件2：如果是基于题目的会话，且sessionName相似（前20个字符相同）
            // 这样可以匹配同一个题目的不同会话（即使标题略有变化）
            const nameSimilar = aiSessionName.length >= 20 && 
                              session.sessionName.length >= 20 &&
                              session.sessionName.substring(0, 20) === aiSessionName.substring(0, 20) &&
                              session.subject === subject
            
            if (nameAndSubjectMatch || nameSimilar) {
              // 如果已有当前会话且匹配，直接复用
              if (currentSession.value?.sessionId === session.sessionId) {
                existingSession = session
                console.log('[TeacherStore] 🔍 找到当前会话，复用:', session.sessionId)
                break
              }
              
              // 否则，选择最近创建的会话（如果有多个匹配）
              if (!existingSession || session.createTime > existingSession.createTime) {
                existingSession = session
              }
            }
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
    
    // 第3步：如果已存在，复用已有会话；否则创建新会话
    let session: TeacherSession
    if (existingSession) {
      session = existingSession
      console.log('[TeacherStore] ♻️ 复用已有会话:', session.sessionId)
    } else {
      const sessionId = generateSessionId(aiSessionId)
      session = {
        sessionId,
        sessionName: aiSessionName,
        subject,
        createTime: Date.now()
      }
      console.log('[TeacherStore] ✨ 创建新会话:', session.sessionId)
    }
    
    // 第4步：保存到localStorage（如果已存在，确保使用正确的键名，加上用户ID前缀）
    // 复用第469行已声明的userId
    const storageKey = `${userId}_teacher_chat_${session.sessionId}_session`
    localStorage.setItem(storageKey, JSON.stringify(session))
    
    // 第5步：设置为当前会话
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
    const userId = getCurrentUserIdOrDefault()
    const storageKey = `${userId}_teacher_chat_${sessionId}_session`
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
        
        // 第7步：更新localStorage中的会话标题（加上用户ID前缀）
        const userId = getCurrentUserIdOrDefault()
        const storageKey = `${userId}_teacher_chat_${sessionId}_session`
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
            // 使用 filePath 发送给 Android 端（Android 端会将文件路径转换为 base64）
            // base64DataUrl 仅用于前端 UI 显示，不用于发送
            console.log('[TeacherStore] 🖼️ 转发图片消息')
            result = await window.AndroidBridge.sendPictureToTeacher(
              msg.imageData.filePath,  // 文件路径，用于发送给 Android 端
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
      console.log('[TeacherStore] ⏳ 检测到并发调用，等待现有初始化完成...')
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
    const previousCallback = window.onTeacherMessageReceived
    window.onTeacherMessageReceived = (messageData: unknown) => {
      console.log('[TeacherStore] 📨 收到教师消息:', messageData)
      
      // 添加调用栈跟踪，帮助排查重复消息的来源
      if (console.trace) {
        console.trace('[TeacherStore] 🔍 消息接收调用栈:')
      }
      
      const data = messageData as {
        messageId: string
        sessionId: string
        content: string
        messageType: string
        isSelf: boolean
        timestamp: number
        chatRole: string
      }
      
      console.log('[TeacherStore] 📨 消息详情:', {
        messageId: data.messageId,
        sessionId: data.sessionId,
        messageType: data.messageType,
        contentLength: data.content?.length || 0,
        contentPreview: data.content?.substring(0, 100),
        currentSessionId: currentSession.value?.sessionId,
        hasCurrentSession: !!currentSession.value
      })
      
      // 只添加属于当前会话的消息
      if (currentSession.value?.sessionId !== data.sessionId) {
        console.warn('[TeacherStore] ⚠️ 会话ID不匹配，忽略消息:', {
          receivedSessionId: data.sessionId,
          currentSessionId: currentSession.value?.sessionId || 'null',
          reason: !currentSession.value ? '当前会话为空' : '会话ID不一致'
        })
        return
      }
      
      // 处理不同类型的消息
      const isImageMessage = data.messageType === 'IMAGE'
      const isVoiceMessage = data.messageType === 'VOICE'
      
      // 如果是图片消息，content可能是文件路径，需要转换为base64
      if (isImageMessage) {
        console.log('[TeacherStore] 🖼️ 收到图片消息，开始处理...')
        
        // 检查content是否是文件路径（以/storage/开头）
        const isFilePath = data.content?.startsWith('/storage/') || data.content?.startsWith('/data/')
        
        if (isFilePath) {
          console.log('[TeacherStore] 📁 检测到文件路径，需要转换为base64:', data.content)
          
          // 调用Android Bridge将文件路径转换为base64
          // 注意：这里需要异步处理，但addMessage是同步的
          // 我们需要先创建一个临时消息，然后异步更新
          const tempMessage: ChatBubble = {
            id: data.messageId,
            content: '[图片加载中...]',
            type: 'ai',
            timestamp: new Date(data.timestamp).toISOString(),
            sender: 'teacher',
            messageType: 'image',
            // 临时使用文件路径作为标识
            imageData: {
              filePath: data.content,
              width: 0,
              height: 0,
              fileSize: 0
            }
          }
          
          // 先添加临时消息
          addMessage(tempMessage)
          
          // 异步转换文件路径为base64
          ;(async () => {
            try {
              // 调用Android Bridge方法（如果存在）
              // 使用类型断言，因为loadImageFileToBase64可能尚未在所有类型定义中
              const bridge = window.AndroidBridge as (typeof window.AndroidBridge & { loadImageFileToBase64?: (filePath: string) => string })
              if (bridge?.loadImageFileToBase64) {
                const base64Result = bridge.loadImageFileToBase64(data.content)
                const base64Data = JSON.parse(base64Result)
                
                if (base64Data.success && base64Data.data) {
                  const base64DataUrl = base64Data.data
                  console.log('[TeacherStore] ✅ 文件路径转换成功，base64长度:', base64DataUrl.length)
                  
                  // 更新消息，添加base64数据
                  const imageMessage: ChatBubble = {
                    id: data.messageId,
                    content: '', // 图片消息不显示文字内容
                    type: 'ai',
                    timestamp: new Date(data.timestamp).toISOString(),
                    sender: 'teacher',
                    messageType: 'image',
                    imageData: {
                      filePath: data.content,
                      base64DataUrl: base64DataUrl,
                      width: 0, // 可以从Android端获取，但这里先设为0
                      height: 0,
                      fileSize: 0
                    }
                  }
                  
                  // 更新消息
                  const index = messages.value.findIndex(m => m.id === data.messageId)
                  if (index !== -1) {
                    messages.value[index] = imageMessage
                    saveChatHistory(true)
                  }
                } else {
                  console.error('[TeacherStore] ❌ 文件路径转换失败:', base64Data.message)
                  // 更新消息显示错误
                  const index = messages.value.findIndex(m => m.id === data.messageId)
                  if (index !== -1) {
                    messages.value[index] = {
                      ...tempMessage,
                      content: '[图片加载失败: ' + (base64Data.message || '未知错误') + ']',
                      isError: true
                    }
                    saveChatHistory(true)
                  }
                }
              } else {
                console.warn('[TeacherStore] ⚠️ Android Bridge不支持loadImageFileToBase64，尝试直接使用文件路径')
                // 如果Bridge不支持，尝试使用file://协议（但WebView可能不支持）
                // 或者显示错误提示
                const index = messages.value.findIndex(m => m.id === data.messageId)
                if (index !== -1) {
                  messages.value[index] = {
                    ...tempMessage,
                    content: '[图片加载失败: 不支持的文件路径格式]',
                    isError: true
                  }
                  saveChatHistory(true)
                }
              }
            } catch (error) {
              console.error('[TeacherStore] ❌ 转换文件路径时出错:', error)
              const index = messages.value.findIndex(m => m.id === data.messageId)
              if (index !== -1) {
                messages.value[index] = {
                  ...tempMessage,
                  content: '[图片加载失败: ' + (error instanceof Error ? error.message : '未知错误') + ']',
                  isError: true
                }
                saveChatHistory(true)
              }
            }
          })()
        } else {
          // content已经是base64数据，直接使用
          console.log('[TeacherStore] ✅ content是base64数据，直接使用')
          const imageMessage: ChatBubble = {
            id: data.messageId,
            content: '', // 图片消息不显示文字内容
            type: 'ai',
            timestamp: new Date(data.timestamp).toISOString(),
            sender: 'teacher',
            messageType: 'image',
            imageData: {
              filePath: '', // 如果content是base64，可能没有filePath
              base64DataUrl: data.content,
              width: 0,
              height: 0,
              fileSize: 0
            }
          }
          addMessage(imageMessage)
          saveChatHistory(true)
        }
      } else if (isVoiceMessage) {
        // 语音消息处理（类似图片消息）
        console.log('[TeacherStore] 🎤 收到语音消息')
        console.log('[TeacherStore] 🎤 原始 content:', data.content)
        
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
            
            console.log('[TeacherStore] 🎤 解析语音消息成功:', {
              durationSeconds: voiceDuration,
              durationMs: voiceDuration * 1000,
              filePath: voiceFilePath,
              filePathLength: voiceFilePath.length
            })
            
            // 检查 duration 是否为 0，可能是文件问题
            if (voiceDuration === 0) {
              console.warn('[TeacherStore] ⚠️ 语音消息时长为 0，可能是文件损坏或无法获取时长')
            }
          } else {
            console.warn('[TeacherStore] ⚠️ 语音消息格式异常，parts.length < 2:', parts.length)
          }
        } else {
          console.warn('[TeacherStore] ⚠️ 语音消息 content 格式异常，不包含逗号:', data.content)
        }
        
        const teacherMessage: ChatBubble = {
          id: data.messageId,
          content: data.content,
          type: 'ai',
          timestamp: new Date(data.timestamp).toISOString(),
          sender: 'teacher',
          messageType: 'voice',
          voiceData: {
            filePath: voiceFilePath,
            duration: voiceDuration * 1000, // 转换为毫秒（与前端其他地方的 duration 保持一致）
            fileSize: 0 // 语音消息暂时不需要fileSize，设为0
          }
        }
        addMessage(teacherMessage)
        saveChatHistory(true)
      } else {
        // 文本消息
        const teacherMessage: ChatBubble = {
          id: data.messageId,
          content: data.content,
          type: 'ai',
          timestamp: new Date(data.timestamp).toISOString(),
          sender: 'teacher'
        }
        console.log('[TeacherStore] ✅ 会话ID匹配，添加消息到列表')
        addMessage(teacherMessage)
        saveChatHistory(true)
      }
    }
    
    // 记录回调设置情况
    if (previousCallback) {
      console.log('[TeacherStore] 🔄 重新设置消息接收回调（覆盖之前的回调）')
    } else {
      console.log('[TeacherStore] ✅ 首次设置消息接收回调')
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
      
      // 如果已经初始化过，只更新回调函数，不重复初始化 Android 端
      if (isReceiverInitialized && isInitialized) {
        console.log('[TeacherStore] ℹ️ 消息接收器已初始化，只更新回调函数，跳过 Android 端初始化')
        // 回调函数已经在第1步设置，这里直接返回即可
        return
      }
      
      if (!isInitialized) {
        // 在初始化之前，先清理旧的监听器（防止重复添加）
        // 这是关键：Android端的 addMessageListener 使用 contains() 检查，但方法引用每次都是新对象
        // 所以即使有去重逻辑，仍然会重复添加。我们需要先清理再添加。
        // 注意：即使清理失败也不影响后续初始化
        try {
          const cleanupResult = window.AndroidBridge.cleanupTeacherMessageListener?.()
          if (cleanupResult) {
            const cleanupData = JSON.parse(cleanupResult)
            console.log('[TeacherStore] 🧹 清理旧监听器:', cleanupData.success ? '成功' : '失败（可能不存在）')
          }
        } catch (cleanupError) {
          console.log('[TeacherStore] 🧹 清理旧监听器时出错（可忽略）:', cleanupError)
        }
        console.log('🔄 MessagingManager未初始化，开始初始化...')
        
        // 调用初始化接口（会同时初始化 MessagingManager 和添加监听器）
        const result = window.AndroidBridge.initTeacherMessageListener()
        const data = JSON.parse(result)
        if (!data.success) {
          const errorMsg = `初始化教师消息监听失败: ${data.message}`
          console.error(errorMsg)
          throw new Error(errorMsg)
        }
        
        // 等待初始化完成（最多等待10秒，与Android端保持一致）
        let waitCount = 0
        const maxWait = 100 // 100次 * 100ms = 10秒
        let lastWarningTime = 0
        const warningInterval = 2000 // 每2秒最多输出一次警告
        
        while (waitCount < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 100))
          waitCount++
          
          const initialized = window.AndroidBridge.isMessagingManagerInitialized?.() ?? false
          const connecting = window.AndroidBridge.isMessagingManagerConnecting?.() ?? false
          
          if (initialized) {
            console.log(`✅ MessagingManager初始化完成，等待耗时: ${waitCount * 100}ms`)
            break
          }
          
          // 每2秒输出一次进度日志
          if (waitCount % 20 === 0) {
            const elapsed = waitCount * 100
            const remaining = maxWait * 100 - elapsed
            console.log(`⏳ 等待MessagingManager初始化中... (${elapsed}ms/${maxWait * 100}ms, 剩余约${Math.ceil(remaining / 1000)}秒)`)
          }
          
          // 如果不再连接中且未初始化，且距离上次警告超过2秒，才输出警告
          const now = Date.now()
          if (!connecting && waitCount > 20 && (now - lastWarningTime) > warningInterval) {
            console.warn(`⚠️ MessagingManager初始化可能失败（已等待${waitCount * 100}ms），但继续等待...`)
            lastWarningTime = now
          }
        }
        
        // 最终检查初始化状态
        const finalInitialized = window.AndroidBridge.isMessagingManagerInitialized?.() ?? false
        const finalConnecting = window.AndroidBridge.isMessagingManagerConnecting?.() ?? false
        
        if (!finalInitialized) {
          if (finalConnecting) {
            console.warn('⚠️ MessagingManager初始化超时（10秒），但仍在后台初始化中，后续操作会自动重试')
          } else {
            console.warn('⚠️ MessagingManager初始化超时（10秒），可能初始化失败，后续发送消息时会自动重试')
          }
          // 不抛出错误，因为可能仍在后台初始化，后续发送消息时会重试
        }
      } else {
        // MessagingManager 已初始化，但我们仍需要确保监听器已添加
        // 注意：如果本地标记未设置，说明可能是页面刷新或首次调用，需要确保监听器已添加
        console.log('✅ MessagingManager已初始化，确保监听器已添加')
        
        // 调用 initTeacherMessageListener 会添加监听器（如果已存在会先清理再添加，确保不重复）
        // 注意：这里会执行清理操作，但这是必要的，因为方法引用可能已变化
        try {
          const cleanupResult = window.AndroidBridge.cleanupTeacherMessageListener?.()
          if (cleanupResult) {
            const cleanupData = JSON.parse(cleanupResult)
            console.log('[TeacherStore] 🧹 清理旧监听器（确保不重复）:', cleanupData.success ? '成功' : '失败（可能不存在）')
          }
        } catch (cleanupError) {
          console.log('[TeacherStore] 🧹 清理旧监听器时出错（可忽略）:', cleanupError)
        }
        
        const result = window.AndroidBridge.initTeacherMessageListener()
        const data = JSON.parse(result)
        if (!data.success) {
          console.warn('[TeacherStore] ⚠️ 添加监听器失败:', data.message)
          // 不抛出错误，因为 MessagingManager 已经初始化，可能只是重复调用
        } else {
          console.log('[TeacherStore] ✅ 监听器已添加')
        }
      }
      
      console.log('✅ 教师消息监听器初始化完成')
      isReceiverInitialized = true
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
    
    // 第1步：清理全局回调
    if (window.onTeacherMessageReceived) {
      console.log('[TeacherStore] 🧹 清理消息接收回调')
      window.onTeacherMessageReceived = undefined
    }
    isReceiverInitialized = false
    
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
  
  /**
   * 设置待发送图片（用于拍作业场景）
   * 第1步：保存图片信息到状态
   */
  const setPendingImage = (imageData: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  }): void => {
    console.log('[TeacherStore] 📸 设置待发送图片:', imageData.filePath)
    pendingImage.value = imageData
  }
  
  /**
   * 清除待发送图片
   * 第1步：清空待发送图片状态
   */
  const clearPendingImage = (): void => {
    console.log('[TeacherStore] 🗑️ 清除待发送图片')
    pendingImage.value = null
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
    pendingImage,
    
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
    sendMessage,
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
    toggleWebSearch,
    setPendingImage,
    clearPendingImage
  }
})

