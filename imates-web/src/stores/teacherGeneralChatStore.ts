/**
 * 教师通用对话场景专用Store
 * 
 * 职责：管理教师通用对话场景的所有聊天相关状态和逻辑
 * - 消息管理
 * - 发送消息到教师
 * - 教师会话管理
 * - 聊天历史持久化
 * - 重试逻辑
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/api-service'
import { asyncStorage, type ChatHistoryData } from '../services/chat-storage'
import { showMessage } from '../utils'
import { useUserStore } from './userStore'
import { getCurrentUserIdOrDefault } from '../utils/user/userId'
import { useUnreadMessageStore } from './unreadMessageStore'
import { checkAccountStatus, checkNotificationPermission, sendSystemNotification } from '../utils/account-status'
import {
  updateMessageError,
  updateMessageRetrying,
  checkRetryCondition,
  buildRetryFailureMessage,
  findMessageIndex,
  validateMessageExists,
  type ChatImageData
} from './utils/chatStoreUtils'
import { buildAiGeneralMessage } from './utils/aiMessageBuilder'
import type { ChatBubble, UserInfo } from '../types'

/**
 * 教师会话信息
 */
export interface TeacherSession {
  sessionId: string
  sessionName: string
  subject: string
  createTime: number
  msgCount?: number  // 消息数量
  updateTime?: number  // 更新时间
}

export const useTeacherGeneralChatStore = defineStore('teacherGeneralChat', () => {
  // ==================== 状态管理 ====================
  
  const messages = ref<ChatBubble[]>([]) // 当前会话的消息列表，包含所有聊天消息（用户消息、教师回复等）
  
  // 用于对比的消息快照（保存时记录）
  const lastSavedMessagesSnapshot = ref<{ // 保存时记录的消息快照，用于后续对比验证保存和加载的一致性
    sessionId: string // 会话ID
    messages: ChatBubble[] // 保存时的消息列表
    timestamp: number // 保存时间戳
  } | null>(null)
  const currentSession = ref<TeacherSession | null>(null) // 当前选中的教师会话信息（包含sessionId、sessionName、subject等）
  const isChatLoading = ref(false) // 聊天加载状态，表示是否正在发送消息或等待教师回复
  const isChatRendering = ref(false) // 聊天渲染状态，表示是否正在渲染教师回复内容
  const chatResponseTimes = ref(0) // 聊天响应次数计数器，记录已完成的对话轮数（用于判断是否可以查看答案）
  const enableWebSearch = ref(false) // 是否启用网络搜索功能（当前未使用，保留用于未来扩展）
  
  const VIEW_ANSWER_CHAT_TIMES = 3 // 查看答案所需的聊天次数阈值（达到此次数后可以查看答案）
  const canViewAnswer = computed(() => chatResponseTimes.value >= VIEW_ANSWER_CHAT_TIMES) // 计算属性：是否可以查看答案（基于聊天响应次数）
  
  /** 待发送图片（用于拍作业场景） */
  const pendingImage = ref<{ // 待发送的图片信息（用于拍作业场景，在发送前临时保存图片数据）
    filePath: string // 图片文件路径
    width: number // 图片宽度（像素）
    height: number // 图片高度（像素）
    fileSize: number // 图片文件大小（字节）
    base64DataUrl?: string // 图片的base64编码数据URL（可选，用于前端预览）
  } | null>(null)
  
  /** 响应式的所有会话列表 */
  const allSessions = ref<TeacherSession[]>([])
  
  // ==================== 会话管理 ====================
  
  /**
   * 设置当前会话
   */
  const setSession = (session: TeacherSession): void => {
    currentSession.value = session
    // 清除该会话的未读标记
    const unreadStore = useUnreadMessageStore()
    const unreadKey = `teacher_${session.sessionId}`
    unreadStore.clearUnread(unreadKey)
  }
  
  /**
   * 清除会话
   * 第1步：清空当前会话信息
   * 第2步：清空消息列表
   */
  const clearSession = (): void => {
    currentSession.value = null
    clearMessages()
  }
  
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
      console.error('[TeacherStore] ❌ 消息ID为空或格式错误:', messageId)
      return false
    }
    if (!isValidUUID(messageId)) {
      console.error('[TeacherStore] ❌ 消息ID格式不正确（应为UUID格式）:', messageId)
      return false
    }
    return true
  }
  
  /**
   * 验证会话ID格式
   * 支持以下格式：
   * 1. 标准UUID格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   * 2. teacher-{hex}-{timestamp} 格式（Android/Web生成）：teacher-638e6e1c-1762486710774
   * 3. teacher-{timestamp} 格式（临时ID）：teacher-1762486710774
   * 4. teacher-chat-{timestamp} 格式（临时ID）：teacher-chat-1762486710774
   */
  const validateSessionId = (sessionId: string | null | undefined): boolean => {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      console.error('[TeacherStore] ❌ 会话ID为空或格式错误:', sessionId)
      return false
    }
    
    const trimmedId = sessionId.trim()
    
    // 1. 检查标准UUID格式
    if (isValidUUID(trimmedId)) {
      return true
    }
    
    // 2. 检查 teacher-{hex}-{timestamp} 格式（例如：teacher-638e6e1c-1762486710774）
    // hex: 8位十六进制数字，timestamp: 数字
    const teacherHexTimestampRegex = /^teacher-[0-9a-f]{8}-[0-9]+$/i
    if (teacherHexTimestampRegex.test(trimmedId)) {
      return true
    }
    
    // 3. 检查 teacher-{timestamp} 格式（临时ID）
    const teacherTimestampRegex = /^teacher-[0-9]+$/
    if (teacherTimestampRegex.test(trimmedId)) {
      return true
    }
    
    // 4. 检查 teacher-chat-{timestamp} 格式（临时ID）
    const teacherChatTimestampRegex = /^teacher-chat-[0-9]+$/
    if (teacherChatTimestampRegex.test(trimmedId)) {
      return true
    }
    
    // 如果都不匹配，记录错误
    console.error('[TeacherStore] ❌ 会话ID格式不正确，支持的格式：UUID、teacher-{hex}-{timestamp}、teacher-{timestamp}、teacher-chat-{timestamp}。实际值:', trimmedId)
    return false
  }
  
  /**
   * 验证并修正时间戳
   * 如果时间戳是未来时间或异常，使用当前时间
   */
  const validateAndFixTimestamp = (timestamp: number): number => {
    const now = Date.now()
    const MAX_FUTURE_OFFSET = 60000 // 允许1分钟的未来时间误差（考虑时钟不同步）
    const MAX_PAST_OFFSET = 365 * 24 * 60 * 60 * 1000 // 允许1年前的过去时间
    
    // 检查是否为有效数字
    if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp)) {
      console.warn('[TeacherStore] ⚠️ 时间戳无效，使用当前时间:', timestamp)
      return now
    }
    
    // 检查是否为未来时间（允许1分钟误差）
    if (timestamp > now + MAX_FUTURE_OFFSET) {
      console.warn('[TeacherStore] ⚠️ 时间戳是未来时间，使用当前时间:', {
        timestamp,
        now,
        offset: timestamp - now
      })
      return now
    }
    
    // 检查是否为过于久远的过去时间（超过1年）
    if (timestamp < now - MAX_PAST_OFFSET) {
      console.warn('[TeacherStore] ⚠️ 时间戳过于久远，使用当前时间:', {
        timestamp,
        now,
        offset: now - timestamp
      })
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
      console.warn('[TeacherStore] ⚠️ 检测到重复消息，跳过处理:', {
        messageId,
        existingIndex,
        currentTotal: messages.value.length,
        existingContent: messages.value[existingIndex].content?.substring(0, 50),
        existingTimestamp: messages.value[existingIndex].timestamp
      })
      return true
    }
    return false
  }
  
  /**
   * 添加消息到列表
   * 添加去重逻辑，防止重复添加相同 messageId 的消息
   */
  const addMessage = (message: ChatBubble): void => {
    console.log('[TeacherStore] 📝 [存储流程] 开始添加消息到列表', {
      messageId: message.id,
      messageType: message.messageType,
      sender: message.sender,
      contentPreview: message.content?.substring(0, 50),
      timestamp: message.timestamp,
      currentMessageCount: messages.value.length
    })
    
    // 检查是否已存在相同的消息ID
    const existingIndex = findMessageIndex(messages.value, message.id)
    if (existingIndex >= 0) {
      console.warn('[TeacherStore] ⚠️ [存储流程] 消息已存在，跳过重复添加:', {
        messageId: message.id,
        existingIndex,
        currentTotal: messages.value.length,
        existingContent: messages.value[existingIndex].content?.substring(0, 50)
      })
      return // 已存在，跳过添加
    }
    
    messages.value.push(message)
    console.log('[TeacherStore] ✅ [存储流程] 消息已添加到列表', {
      messageId: message.id,
      newMessageCount: messages.value.length,
      willTriggerSave: true
    })
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
    
    // 场景41：检查账号状态（是否被禁言）
    const userStore = useUserStore()
    const accountStatus = await checkAccountStatus(userStore.userInfo)
    if (!accountStatus.canSendMessage) {
      console.error('[TeacherStore] ❌ 发送失败：账号已被禁言')
      isChatLoading.value = false
      isChatRendering.value = false
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
      
      let result: string
      
      // 第4步：根据消息类型调用不同的Android Bridge方法
      // 教师聊天直接通过RabbitMQ发送，不使用HTTP接口
      
      if (imageData?.base64DataUrl) {
        // 图片消息：使用filePath发送给Android端（如果有），否则回退到base64DataUrl
        // 渲染时使用base64DataUrl
        if (imageData.filePath) {
          // 优先使用filePath（更高效，避免传递大base64字符串）
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
        result = await window.AndroidBridge.sendTextMessageToTeacher(
          content,
          sessionId,
          subject
        )
      }
      
      let data: { success: boolean; message?: string; data?: unknown }
      try {
        data = JSON.parse(result)
      } catch (parseError) {
        console.error('[TeacherStore] ❌ JSON解析失败:', parseError)
        console.error('[TeacherStore] ❌ 原始结果:', result)
        throw new Error('响应格式错误')
      }
      
      if (data.success) {
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
        console.error('[TeacherStore] ❌ 失败详情:', {
          success: data.success,
          message: data.message,
          data: data.data
        })
        
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
          
          // 等待延迟
          await new Promise(resolve => setTimeout(resolve, delay))
          
          try {
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
   * 第1步：验证会话和AndroidBridge
   * 第2步：查找并验证消息
   * 第3步：检查重试条件
   * 第4步：更新消息为重试中状态
   * 第5步：重新发送（使用RabbitMQ，与sendMessage保持一致）
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
    
    // 检查AndroidBridge
    if (!window.AndroidBridge) {
      console.error('[TeacherStore] ❌ 重试失败：AndroidBridge未初始化')
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
      const subject = currentSession.value.subject || 'math'
      
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
            subject
          )
        } else if (messageImageData.base64DataUrl) {
          console.warn('[TeacherStore] ⚠️ 重试时缺少filePath，使用base64DataUrl（不推荐）')
          result = await window.AndroidBridge.sendPictureToTeacher(
            messageImageData.base64DataUrl,
            sessionId,
            subject
          )
        } else {
          throw new Error('图片数据不完整')
        }
      } else {
        // 文本消息
        result = await window.AndroidBridge.sendTextMessageToTeacher(
          content,
          sessionId,
          subject
        )
      }
      
      // 解析响应
      let data: { success: boolean; message?: string; data?: unknown }
      try {
        data = JSON.parse(result)
      } catch (parseError) {
        console.error('[TeacherStore] ❌ 重试时JSON解析失败:', parseError)
        console.error('[TeacherStore] ❌ 原始结果:', result)
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
      console.error('[TeacherStore] ❌ 重试失败:', error)
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
  
  // ==================== 聊天历史 ====================
  
  /**
   * 保存聊天历史（立即执行，不使用防抖）
   */
  const saveChatHistory = async (): Promise<void> => {
    if (!currentSession.value) {
      console.log('[TeacherStore] ⚠️ [存储流程] 保存失败：无当前会话')
      return
    }
    
    const startTime = Date.now()
    const sessionId = currentSession.value.sessionId
    console.log('[TeacherStore] 💾 [存储流程] 开始保存聊天历史', {
      sessionId,
      currentMessageCount: messages.value.length
      })
      
      try {
      // 第1步：更新会话信息
      currentSession.value.msgCount = messages.value.length
      currentSession.value.updateTime = Date.now()
        
      // 第2步：过滤掉错误消息、流式消息、系统消息和撤回消息，只保存成功发送的消息
        // 注意：同时检查 id 和 messageId，因为有些消息可能只设置了其中一个
        const messagesToSave = messages.value.filter(msg => 
          !msg.isError && 
          !msg.isStreaming &&
          !msg.isSystemMessage && // 场景39：系统消息不保存到历史
          !msg.isRecalled && // 场景38：撤回消息不保存到历史
          (msg.messageId || msg.id) // 确保有messageId或id（兼容两种字段名）
        )
        
        console.log('[TeacherStore] 🔍 [存储流程] 消息过滤完成', {
          totalMessages: messages.value.length,
          messagesToSave: messagesToSave.length,
          filteredCount: messages.value.length - messagesToSave.length,
          filteredReasons: {
            error: messages.value.filter(m => m.isError).length,
            streaming: messages.value.filter(m => m.isStreaming).length,
            system: messages.value.filter(m => m.isSystemMessage).length,
            recalled: messages.value.filter(m => m.isRecalled).length,
            noMessageId: messages.value.filter(m => !m.messageId && !m.id).length
          }
        })
        
      // 第3步：构建存储键（每个会话独立存储）
      const storageKey = `teacher-general-${sessionId}`
      console.log('[TeacherStore] 🔑 [存储流程] 构建存储键', { storageKey, sessionId })
      
      // 第4步：保存消息到IndexedDB（每个会话独立存储）
      const historyData: ChatHistoryData = {
        questionId: sessionId,  // 使用sessionId作为questionId
        messages: messagesToSave,
        chatResponseTimes: chatResponseTimes.value,
        lastUpdated: Date.now()
      }
      
        console.log('[TeacherStore] 💾 [存储流程] 开始保存到IndexedDB', {
          storageKey,
        sessionId,
          messageCount: messagesToSave.length,
          chatResponseTimes: chatResponseTimes.value
        })
        
        const saveStartTime = Date.now()
      await asyncStorage.saveChatHistory(storageKey, historyData)
        const saveDuration = Date.now() - saveStartTime
      
      // 打印保存到 IndexedDB 的详细消息记录（特别是转发成功后）
      console.log('[TeacherStore] 📝 [存储流程] ========== 保存到 IndexedDB 的消息记录 ==========', {
        storageKey,
        sessionId,
        messageCount: messagesToSave.length,
        duration: `${saveDuration}ms`,
        timestamp: new Date().toISOString()
      })
      
      // 打印每条消息的详细信息
      messagesToSave.forEach((msg, index) => {
        console.log(`[TeacherStore] 📝 [存储流程] 消息 ${index + 1}/${messagesToSave.length}:`, {
          id: msg.id,
          messageId: msg.messageId,
          content: msg.content?.substring(0, 50) + (msg.content && msg.content.length > 50 ? '...' : ''),
          sender: msg.sender,
          type: msg.type,
          messageType: msg.messageType,
          timestamp: msg.timestamp,
          hasImageData: !!msg.imageData,
          hasVoiceData: !!msg.voiceData,
          isForwarded: msg.id?.startsWith('forwarded_') || false,
          fullMessage: JSON.parse(JSON.stringify(msg)) // 深拷贝完整消息对象
        })
      })
        
        console.log('[TeacherStore] ✅ [存储流程] IndexedDB保存成功', {
          storageKey,
        sessionId,
          messageCount: messagesToSave.length,
          duration: `${saveDuration}ms`
        })
        
      // 保存消息快照，用于后续对比
      lastSavedMessagesSnapshot.value = {
        sessionId,
        messages: JSON.parse(JSON.stringify(messagesToSave)), // 深拷贝
        timestamp: Date.now()
      }
      
      // 第5步：保存会话信息到localStorage（加上用户ID前缀）
        const userId = getCurrentUserIdOrDefault()
        const sessionKey = `${userId}_${storageKey}_session`
        console.log('[TeacherStore] 💾 [存储流程] 开始保存会话信息到localStorage', {
          sessionKey,
        sessionId
        })
        
        const sessionSaveStartTime = Date.now()
        localStorage.setItem(sessionKey, JSON.stringify(currentSession.value))
        const sessionSaveDuration = Date.now() - sessionSaveStartTime
        
        console.log('[TeacherStore] ✅ [存储流程] localStorage保存成功', {
          sessionKey,
          duration: `${sessionSaveDuration}ms`
        })
      
      // 第6步：保存会话列表
      const allSessions = loadAllSessions()
      allSessions[sessionId] = currentSession.value
      saveAllSessions(allSessions)
        
        const totalDuration = Date.now() - startTime
        console.log('[TeacherStore] ✅ [存储流程] 保存流程完成', {
        sessionId,
          messageCount: messagesToSave.length,
          totalDuration: `${totalDuration}ms`,
          indexedDBDuration: `${saveDuration}ms`,
          localStorageDuration: `${sessionSaveDuration}ms`
        })
      } catch (error) {
        // 处理存储错误
        const errorDuration = Date.now() - startTime
        console.error('[TeacherStore] ❌ [存储流程] 保存教师聊天历史失败', {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : typeof error,
          duration: `${errorDuration}ms`,
          sessionId: currentSession.value?.sessionId
        })
        
        // 检查是否是存储空间不足错误
        const isQuotaExceeded = error instanceof DOMException && 
          (error.name === 'QuotaExceededError' || error.code === 22)
        
        if (isQuotaExceeded) {
          // 存储空间不足，显示提示并提供清理选项
          showMessage('存储空间不足，无法保存聊天记录。建议清理历史记录释放空间。', 'warning', 5000)
          
          // 尝试清理旧数据（保留最近10条消息）
          try {
          const storageKey = `teacher-general-${sessionId}`
          const recentMessages = messages.value.filter(msg => 
            !msg.isError && 
            !msg.isStreaming &&
            !msg.isSystemMessage &&
            !msg.isRecalled &&
            (msg.messageId || msg.id)
          ).slice(-10)
          
          const historyData: ChatHistoryData = {
            questionId: sessionId,
              messages: recentMessages,
            chatResponseTimes: chatResponseTimes.value,
            lastUpdated: Date.now()
          }
          
          await asyncStorage.saveChatHistory(storageKey, historyData)
            showMessage('已清理旧数据，保留最近10条消息', 'info', 3000)
          } catch (cleanupError) {
            console.error('清理旧数据也失败:', cleanupError)
            // 如果清理也失败，使用内存缓存作为降级方案
            // 消息仍然会显示，但不会持久化
            console.warn('使用内存缓存作为降级方案，消息不会持久化')
          }
        } else {
          // 其他存储错误
          console.error('存储错误:', error)
        }
    }
  }
  
  /**
   * 加载聊天历史（从独立存储中加载指定会话的消息）
   */
  const loadChatHistory = async (sessionId: string): Promise<void> => {
    try {
      const storageKey = `teacher-general-${sessionId}`
      console.log('[TeacherStore] 📖 [加载流程] ========== 开始从 IndexedDB 加载聊天历史 ==========', {
        storageKey,
        sessionId,
        timestamp: new Date().toISOString()
      })
      
      const loadStartTime = Date.now()
      const history = await asyncStorage.loadChatHistory(storageKey)
      const loadDuration = Date.now() - loadStartTime
      
      if (history) {
        const loadedMessages = history.messages || []
        messages.value = loadedMessages
        chatResponseTimes.value = history.chatResponseTimes || 0
        
        // 打印从 IndexedDB 加载的详细消息记录
        console.log('[TeacherStore] 📖 [加载流程] ========== 从 IndexedDB 加载的消息记录 ==========', {
          storageKey,
          sessionId,
          messageCount: loadedMessages.length,
          chatResponseTimes: chatResponseTimes.value,
          duration: `${loadDuration}ms`,
          timestamp: new Date().toISOString()
        })
        
        // 打印每条消息的详细信息
        loadedMessages.forEach((msg, index) => {
          console.log(`[TeacherStore] 📖 [加载流程] 消息 ${index + 1}/${loadedMessages.length}:`, {
            id: msg.id,
            messageId: msg.messageId,
            content: msg.content?.substring(0, 50) + (msg.content && msg.content.length > 50 ? '...' : ''),
            sender: msg.sender,
            type: msg.type,
            messageType: msg.messageType,
            timestamp: msg.timestamp,
            hasImageData: !!msg.imageData,
            hasVoiceData: !!msg.voiceData,
            isForwarded: msg.id?.startsWith('forwarded_') || false,
            fullMessage: JSON.parse(JSON.stringify(msg)) // 深拷贝完整消息对象
          })
        })
        
        console.log('[TeacherStore] ✅ [加载流程] IndexedDB加载成功', {
          storageKey,
          sessionId,
          messageCount: loadedMessages.length,
          duration: `${loadDuration}ms`
        })
        
        // 对比保存和加载的消息记录
        if (lastSavedMessagesSnapshot.value && lastSavedMessagesSnapshot.value.sessionId === sessionId) {
          const savedMessages = lastSavedMessagesSnapshot.value.messages
          const savedCount = savedMessages.length
          const loadedCount = loadedMessages.length
          
          console.log('[TeacherStore] 🔍 [对比流程] ========== 保存与加载消息记录对比 ==========', {
            sessionId,
            savedCount,
            loadedCount,
            countMatch: savedCount === loadedCount,
            savedTimestamp: new Date(lastSavedMessagesSnapshot.value.timestamp).toISOString(),
            loadedTimestamp: new Date().toISOString(),
            timeDiff: `${Date.now() - lastSavedMessagesSnapshot.value.timestamp}ms`
          })
          
          // 对比消息数量
          if (savedCount !== loadedCount) {
            console.warn('[TeacherStore] ⚠️ [对比流程] 消息数量不匹配', {
              savedCount,
              loadedCount,
              diff: loadedCount - savedCount
            })
          } else {
            console.log('[TeacherStore] ✅ [对比流程] 消息数量匹配', {
              count: savedCount
            })
          }
          
          // 对比每条消息的ID
          const savedIds = new Set(savedMessages.map(m => m.id || m.messageId))
          const loadedIds = new Set(loadedMessages.map(m => m.id || m.messageId))
          
          const missingIds = Array.from(savedIds).filter(id => !loadedIds.has(id))
          const extraIds = Array.from(loadedIds).filter(id => !savedIds.has(id))
          
          if (missingIds.length > 0) {
            console.warn('[TeacherStore] ⚠️ [对比流程] 加载时缺失的消息ID', {
              missingIds,
              count: missingIds.length
            })
          }
          
          if (extraIds.length > 0) {
            console.warn('[TeacherStore] ⚠️ [对比流程] 加载时多出的消息ID', {
              extraIds,
              count: extraIds.length
            })
          }
          
          if (missingIds.length === 0 && extraIds.length === 0) {
            console.log('[TeacherStore] ✅ [对比流程] 消息ID完全匹配', {
              totalIds: savedIds.size
            })
          }
          
          // 对比每条消息的详细内容（仅对比前10条，避免日志过多）
          const compareCount = Math.min(10, Math.min(savedCount, loadedCount))
          for (let i = 0; i < compareCount; i++) {
            const savedMsg = savedMessages[i]
            const loadedMsg = loadedMessages[i]
            
            const idMatch = (savedMsg.id || savedMsg.messageId) === (loadedMsg.id || loadedMsg.messageId)
            const contentMatch = savedMsg.content === loadedMsg.content
            const senderMatch = savedMsg.sender === loadedMsg.sender
            const typeMatch = savedMsg.type === loadedMsg.type
            const messageTypeMatch = savedMsg.messageType === loadedMsg.messageType
            
            if (!idMatch || !contentMatch || !senderMatch || !typeMatch || !messageTypeMatch) {
              console.warn(`[TeacherStore] ⚠️ [对比流程] 消息 ${i + 1} 内容不匹配`, {
                saved: {
                  id: savedMsg.id || savedMsg.messageId,
                  content: savedMsg.content?.substring(0, 50),
                  sender: savedMsg.sender,
                  type: savedMsg.type,
                  messageType: savedMsg.messageType
                },
                loaded: {
                  id: loadedMsg.id || loadedMsg.messageId,
                  content: loadedMsg.content?.substring(0, 50),
                  sender: loadedMsg.sender,
                  type: loadedMsg.type,
                  messageType: loadedMsg.messageType
                },
                matches: {
                  id: idMatch,
                  content: contentMatch,
                  sender: senderMatch,
                  type: typeMatch,
                  messageType: messageTypeMatch
                }
              })
            }
          }
          
          if (compareCount === Math.min(savedCount, loadedCount) && savedCount === loadedCount) {
            console.log('[TeacherStore] ✅ [对比流程] 前10条消息内容匹配', {
              comparedCount: compareCount
            })
          }
          
          console.log('[TeacherStore] 🔍 [对比流程] ========== 对比完成 ==========')
        } else {
          console.log('[TeacherStore] ℹ️ [对比流程] 无保存快照，跳过对比', {
            hasSnapshot: !!lastSavedMessagesSnapshot.value,
            snapshotSessionId: lastSavedMessagesSnapshot.value?.sessionId,
            currentSessionId: sessionId
          })
        }
      } else {
        console.log('[TeacherStore] ⚠️ [加载流程] IndexedDB中未找到历史记录', {
          storageKey,
          sessionId
        })
        messages.value = []
        chatResponseTimes.value = 0
      }
        
        // 从localStorage加载会话信息（加上用户ID前缀）
        const userId = getCurrentUserIdOrDefault()
      const sessionKey = `${userId}_${storageKey}_session`
      const sessionInfoData = localStorage.getItem(sessionKey)
      if (sessionInfoData) {
        currentSession.value = JSON.parse(sessionInfoData)
      }
    } catch (error) {
      console.error('[TeacherStore] ❌ [加载流程] 加载教师聊天历史失败:', error)
      messages.value = []
      chatResponseTimes.value = 0
    }
  }
  
  /**
   * 清除聊天历史（删除指定会话的消息）
   */
  const clearChatHistory = async (sessionId: string): Promise<void> => {
    try {
      const storageKey = `teacher-general-${sessionId}`
      // 删除单个会话的消息
      await asyncStorage.removeChatHistory(storageKey)
      
      // 删除会话信息
      deleteSession(sessionId)
      clearMessages()
    } catch (error) {
      console.error('[TeacherStore] ❌ 清除教师聊天历史失败:', error)
    }
  }
  
  // ==================== 会话存储管理 ====================
  
  /**
   * 获取统一的会话存储键名
   */
  const getSessionsStorageKey = (): string => {
    const userId = getCurrentUserIdOrDefault()
    return `${userId}_teacher-general-sessions`
  }
  
  /**
   * 加载所有会话（从统一的localStorage记录）
   */
  const loadAllSessions = (): Record<string, TeacherSession> => {
    try {
      const storageKey = getSessionsStorageKey()
      const sessionsData = localStorage.getItem(storageKey)
      if (sessionsData) {
        return JSON.parse(sessionsData) as Record<string, TeacherSession>
      }
    } catch (error) {
      console.error('[TeacherStore] ❌ 加载会话列表失败:', error)
    }
    return {}
  }
  
  /**
   * 保存所有会话（到统一的localStorage记录）
   */
  const saveAllSessions = (sessions: Record<string, TeacherSession>): void => {
    try {
      const storageKey = getSessionsStorageKey()
      localStorage.setItem(storageKey, JSON.stringify(sessions))
    } catch (error) {
      console.error('[TeacherStore] ❌ 保存会话列表失败:', error)
    }
  }
  
  /**
   * 更新响应式的所有会话列表
   */
  const updateAllSessions = (): void => {
    const sessions = loadAllSessions()
    allSessions.value = Object.values(sessions).sort((a, b) => b.createTime - a.createTime)
  }
  
  /**
   * 获取单个会话
   */
  const getSession = (sessionId: string): TeacherSession | null => {
    const sessions = loadAllSessions()
    return sessions[sessionId] || null
  }
  
  /**
   * 保存单个会话（更新到统一的localStorage记录）
   */
  const saveSession = (session: TeacherSession): void => {
    const sessions = loadAllSessions()
    sessions[session.sessionId] = session
    saveAllSessions(sessions)
    // 更新响应式的会话列表
    updateAllSessions()
  }
  
  /**
   * 删除单个会话（从统一的localStorage记录）
   */
  const deleteSession = (sessionId: string): void => {
    const sessions = loadAllSessions()
    delete sessions[sessionId]
    saveAllSessions(sessions)
    // 更新响应式的会话列表
    updateAllSessions()
  }
  
  // ==================== 会话创建 ====================
  
  /**
   * 创建教师会话
   * 第1步：检查是否已存在相同的会话（基于sessionName和subject）
   * 第2步：如果已存在，复用已有会话；否则创建新会话
   * 第3步：保存到localStorage（统一格式）
   * 第4步：设置为当前会话
   */
  const createTeacherSession = (
    aiSessionId: string,
    aiSessionName: string,
    subject: 'biology' | 'math'
  ): TeacherSession => {
    // 第1步：检查是否已存在相同的会话（仅检查当前用户的数据）
    // 优先匹配：sessionName和subject完全相同
    // 如果是基于题目的会话，且sessionName相似（前20个字符相同）
    const sessions = loadAllSessions()
    let existingSession: TeacherSession | null = null
    
    for (const sessionId in sessions) {
      const session = sessions[sessionId]
            
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
                break
              }
              
              // 否则，选择最近创建的会话（如果有多个匹配）
              if (!existingSession || session.createTime > existingSession.createTime) {
                existingSession = session
        }
      }
    }
    
    // 第3步：如果已存在，复用已有会话；否则创建新会话
    let session: TeacherSession
    if (existingSession) {
      session = existingSession
    } else {
      const sessionId = generateSessionId(aiSessionId)
      session = {
        sessionId,
        sessionName: aiSessionName,
        subject,
        createTime: Date.now()
      }
    }
    
    // 第4步：保存到localStorage（统一格式）
    saveSession(session)
    
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
    return getSession(sessionId) !== null
  }
  
  /**
   * 为收到的消息创建或恢复会话
   * 当学生删除了对话但老师回复时，需要恢复或创建会话来接收消息
   * 
   * 第1步：尝试从 API 获取会话信息（如果可能）
   * 第2步：如果无法获取，使用默认 subject 创建新会话
   * 第3步：保存会话并设置为当前会话
   */
  const createOrRestoreSessionForMessage = async (sessionId: string): Promise<void> => {
    try {
      // 第1步：尝试从 API 获取会话信息（如果 API 支持）
      // 注意：这里假设 API 可能返回会话信息，如果 API 不支持，则使用默认值
      let subject: 'biology' | 'math' = 'math' // 默认使用数学
      let sessionName = '数学'
      
      try {
      // 尝试从 localStorage 获取最后使用的科目
      const userId = getCurrentUserIdOrDefault()
      const storedSubject = localStorage.getItem(`${userId}_currentTeacherSubject`)
      if (storedSubject === 'BIOLOGY') {
        subject = 'biology'
        sessionName = '生物'
      } else if (storedSubject === 'MATH') {
        subject = 'math'
        sessionName = '数学'
      }
      } catch (error) {
        console.warn('[TeacherStore] ⚠️ 获取科目信息失败，使用默认值:', error)
      }
      
      // 第2步：创建新会话
      const newSession: TeacherSession = {
        sessionId: sessionId,
        sessionName: sessionName,
        subject: subject,
        createTime: Date.now()
      }
      
      // 第3步：保存到 localStorage（统一格式）
      saveSession(newSession)
      
      // 第4步：设置为当前会话
      currentSession.value = newSession
      
      // 第5步：加载聊天历史（如果存在）
      try {
        await loadChatHistory(sessionId)
      } catch (error) {
        console.warn('[TeacherStore] ⚠️ 加载聊天历史失败（可能是新会话）:', error)
      }
      
      // 第6步：触发自定义事件，通知组件刷新会话列表
      try {
        window.dispatchEvent(new CustomEvent('teacher-session-restored', {
          detail: { sessionId, session: newSession }
        }))
      } catch (error) {
        console.warn('[TeacherStore] ⚠️ 触发事件失败:', error)
      }
    } catch (error) {
      console.error('[TeacherStore] ❌ 创建或恢复会话失败:', error)
      throw error
    }
  }
  
  /**
   * 获取会话消息数量（从独立存储中获取）
   */
  const getSessionMessageCount = async (sessionId: string): Promise<number> => {
    try {
      const storageKey = `teacher-general-${sessionId}`
      const history = await asyncStorage.loadChatHistory(storageKey)
      
      if (history && history.messages) {
        return history.messages.length || 0
      }
      return 0
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
        
        // 第7步：更新localStorage中的会话标题（统一格式）
        const session = getSession(sessionId)
        if (session) {
          session.sessionName = generatedTitle
          saveSession(session)
          
          // 第8步：同步更新当前会话
          if (currentSession.value && currentSession.value.sessionId === sessionId) {
            currentSession.value.sessionName = generatedTitle
          }
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
    
    let successCount = 0
    let failedCount = 0
    
    // 第2步：遍历消息
    for (let i = 0; i < messagesToForward.length; i++) {
      const msg = messagesToForward[i]
      
      try {
        if (msg.type === 'user' && msg.content) {
          let result
          
          // 第3步：根据消息类型发送
          if (msg.imageData?.filePath) {
            // 图片消息
            // 使用 filePath 发送给 Android 端（Android 端会将文件路径转换为 base64）
            // base64DataUrl 仅用于前端 UI 显示，不用于发送
            result = await window.AndroidBridge.sendPictureToTeacher(
              msg.imageData.filePath,  // 文件路径，用于发送给 Android 端
              currentSession.value.sessionId,
              currentSession.value.subject
            )
          } else if (msg.voiceData?.filePath) {
            // 语音消息
            result = await window.AndroidBridge.sendVoiceMessageToTeacher(
              msg.voiceData.filePath,
              msg.voiceData.duration.toString(),
              currentSession.value.sessionId,
              currentSession.value.subject
            )
          } else {
            // 文本消息
            result = await window.AndroidBridge.sendTextMessageToTeacher(
              msg.content,
              currentSession.value.sessionId,
              currentSession.value.subject
            )
          }
          
          const data = JSON.parse(result)
          if (data.success) {
            successCount++
            // 第4步：保存到前端数据库
            const sentMessage = JSON.parse(data.data)
            
            // 第4.1步：确定消息类型
            let messageType: 'text' | 'voice' | 'image' = 'text'
            if (msg.imageData?.filePath || msg.imageData?.base64DataUrl) {
              messageType = 'image'
            } else if (msg.voiceData?.filePath) {
              messageType = 'voice'
            } else if (msg.messageType && (msg.messageType === 'text' || msg.messageType === 'voice' || msg.messageType === 'image')) {
              messageType = msg.messageType
            }
            
            const newMessage: ChatBubble = {
              id: sentMessage.messageId,
              messageId: sentMessage.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
              content: msg.content,
              type: 'user',
              timestamp: new Date(sentMessage.timestamp).toISOString(),
              sender: 'user',
              messageType: messageType
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
    
    // 保存历史记录
    if (successCount > 0) {
      await saveChatHistory()
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
    console.log('[TeacherStore] 🔧 开始设置老师消息接收回调函数')
    
    // 先检查是否有旧的回调函数
    const oldCallbackType = typeof window.onTeacherMessageReceived
    console.log('[TeacherStore] 🔍 检查旧回调函数类型:', oldCallbackType)
    
    window.onTeacherMessageReceived = async (messageData: unknown) => {
      const receiveStartTime = Date.now()
      console.log('[TeacherStore] 📨 [存储流程] ========== 开始接收消息 ==========', {
        timestamp: new Date().toISOString(),
        messageData,
        type: typeof messageData,
        isObject: typeof messageData === 'object',
        isNull: messageData === null,
        isUndefined: messageData === undefined
      })
      
      try {
        console.log('[TeacherStore] 📨 [存储流程] 收到老师消息回调，开始处理', {
          messageData,
          type: typeof messageData,
          isObject: typeof messageData === 'object',
          isNull: messageData === null,
          isUndefined: messageData === undefined
        })
        
        // 参数验证
        if (!messageData) {
          console.error('[TeacherStore] ❌ 消息数据为空，拒绝处理')
          return
        }
        
        if (typeof messageData !== 'object') {
          console.error('[TeacherStore] ❌ 消息数据格式错误，期望对象，实际:', typeof messageData)
          return
        }
        
        const data = messageData as {
          messageId: string
          sessionId: string
          content: string
          messageType: string
          isSelf: boolean
          timestamp: number
          chatRole: string
          debugLogs?: string[] // Android端调试日志
        }
        
        console.log('[TeacherStore] 📨 解析后的消息数据:', {
          messageId: data.messageId,
          sessionId: data.sessionId,
          content: data.content?.substring(0, 50),
          messageType: data.messageType,
          timestamp: data.timestamp
        })
        
        // 打印Android端调试日志（如果有）
        if (data.debugLogs && data.debugLogs.length > 0) {
          data.debugLogs.forEach((log) => {
            // 根据日志级别使用不同的console方法
            if (log.includes('❌') || log.includes('失败')) {
              console.error(log)
            } else if (log.includes('⚠️') || log.includes('警告')) {
              console.warn(log)
            }
          })
        }
      
      // ==================== 第一阶段：核心功能验证 ====================
      // 1. ID验证：验证messageId和sessionId格式
      if (!validateMessageId(data.messageId)) {
        console.error('[TeacherStore] ❌ 消息ID验证失败，拒绝处理消息')
        return
      }
      
      if (!validateSessionId(data.sessionId)) {
        console.error('[TeacherStore] ❌ 会话ID验证失败，拒绝处理消息')
        return
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
        console.warn('[TeacherStore] ⚠️ 消息重复，已跳过处理')
        return
      }
      // ==================== 验证完成 ====================
      
      // 场景38：处理消息撤回
      if (data.messageType === 'RECALL' || data.content === '[MESSAGE_RECALLED]') {
        const messageIndex = findMessageIndex(messages.value, data.messageId)
        if (messageIndex >= 0) {
          // 更新消息为已撤回状态
          updateMessage(data.messageId, {
            isRecalled: true,
            content: '消息已撤回',
            messageType: 'text'
          })
          // 不保存到历史（撤回消息不需要持久化）
          return
        } else {
          console.warn('[TeacherStore] ⚠️ 撤回的消息不存在:', data.messageId)
          return
        }
      }
      
      // 场景39：处理系统消息（不保存到历史）
      const isSystemMessage = data.messageType === 'SYSTEM' || data.content?.startsWith('[SYSTEM]')
      if (isSystemMessage) {
        // 系统消息只显示，不保存到历史
        const systemMessage: ChatBubble = {
          id: data.messageId,
          messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
          content: data.content?.replace(/^\[SYSTEM\]\s*/, '') || data.content || '系统消息',
          type: 'teacher',
          sender: 'teacher',
          timestamp: new Date(data.timestamp).toISOString(),
          messageType: 'system',
          isSystemMessage: true
        }
        
        // 只添加到当前显示，不保存
        if (isCurrentSession) {
          addMessage(systemMessage)
        }
        
        // 显示系统通知
        showMessage(systemMessage.content, 'info', 3000)
        return // 系统消息不保存到历史，直接返回
      }
      
      // ==================== 全局通知（无论是否在当前会话） ====================
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
        
        // 场景42：发送系统通知（如果权限已授予）
        // 只在应用不在前台时发送系统通知，避免重复提示
        if (document.hidden || !document.hasFocus()) {
          sendSystemNotification('收到老师消息', notificationText)
        }
      } catch (error) {
        console.warn('[TeacherStore] ⚠️ 显示通知失败:', error)
      }
      
      // 场景42：检查通知权限（首次收到消息时检查）
      // 只在权限未授予时检查一次，避免频繁提示
      try {
        const permissionChecked = sessionStorage.getItem('notification_permission_checked')
        if (!permissionChecked) {
          await checkNotificationPermission()
          sessionStorage.setItem('notification_permission_checked', 'true')
        }
      } catch (error) {
        console.warn('[TeacherStore] ⚠️ 检查通知权限失败:', error)
      }
      
      // 如果消息不属于当前会话，尝试恢复或创建会话
      if (!isCurrentSession) {
        // 尝试从统一的 localStorage 记录恢复会话
        const restoredSession = getSession(data.sessionId)
        
        if (restoredSession) {
          // 会话数据存在，恢复会话
            currentSession.value = restoredSession
            
            // 触发自定义事件，通知组件刷新会话列表
            try {
              window.dispatchEvent(new CustomEvent('teacher-session-restored', {
                detail: { sessionId: restoredSession.sessionId, session: restoredSession }
              }))
            } catch (error) {
              console.warn('[TeacherStore] ⚠️ 触发事件失败:', error)
            }
            
            // 恢复会话后，继续处理消息（不返回）
        } else {
          // 会话不存在，尝试创建新会话
          await createOrRestoreSessionForMessage(data.sessionId)
        }
        
        // 如果恢复/创建后仍然不是当前会话，标记为未读
        if (currentSession.value?.sessionId !== data.sessionId) {
          const unreadStore = useUnreadMessageStore()
          const unreadKey = `teacher_${data.sessionId}`
          unreadStore.markUnread(unreadKey)
          return
        }
      }
      
      // 处理不同类型的消息
      const isImageMessage = data.messageType === 'IMAGE'
      const isVoiceMessage = data.messageType === 'VOICE'
      
      // 如果是图片消息，content可能是文件路径，需要转换为base64
      if (isImageMessage) {
        // 检查content是否是文件路径（以/storage/开头）
        const isFilePath = data.content?.startsWith('/storage/') || data.content?.startsWith('/data/')
        
        if (isFilePath) {
          // 调用Android Bridge将文件路径转换为base64
          // 注意：这里需要异步处理，但addMessage是同步的
          // 我们需要先创建一个临时消息，然后异步更新
          const tempMessage: ChatBubble = {
            id: data.messageId,
            messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
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
          console.log('[TeacherStore] 📨 [存储流程] 图片消息需要转换文件路径，先添加临时消息', {
            messageId: data.messageId,
            filePath: data.content
          })
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
                  
                  // 检查图片大小（base64数据大小）
                  const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
                  const imageSize = base64DataUrl.length * 0.75 // base64编码后大小约为原文件的1.33倍
                  
                  if (imageSize > MAX_IMAGE_SIZE) {
                    console.warn('[TeacherStore] ⚠️ 图片文件过大:', {
                      size: imageSize,
                      maxSize: MAX_IMAGE_SIZE,
                      messageId: data.messageId
                    })
                    
                    // 显示提示，但仍显示图片（使用缩略图）
                    showMessage('图片文件较大，可能影响加载速度', 'warning', 3000)
                    
                    // 更新消息，标记为大图片
                    const imageMessage: ChatBubble = {
                      id: data.messageId,
                      messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
                      content: '',
                      type: 'ai',
                      timestamp: new Date(data.timestamp).toISOString(),
                      sender: 'teacher',
                      messageType: 'image',
                      imageData: {
                        filePath: data.content,
                        base64DataUrl: base64DataUrl,
                        width: 0,
                        height: 0,
                        fileSize: imageSize,
                        isLargeImage: true // 标记为大图片
                      }
                    }
                    
                    const index = messages.value.findIndex(m => m.id === data.messageId)
                    if (index !== -1) {
                      messages.value[index] = imageMessage
                      saveChatHistory()
                    }
                    return
                  }
                  
                  // 更新消息，添加base64数据
                  const imageMessage: ChatBubble = {
                    id: data.messageId,
                    messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
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
                      fileSize: imageSize
                    }
                  }
                  
                  // 更新消息
                  const index = messages.value.findIndex(m => m.id === data.messageId)
                  if (index !== -1) {
                    console.log('[TeacherStore] 📨 [存储流程] 图片消息base64转换完成，更新消息并保存', {
                      messageId: data.messageId,
                      index,
                      imageSize: imageSize
                    })
                    messages.value[index] = imageMessage
                    console.log('[TeacherStore] 💾 [存储流程] 图片消息已更新，触发保存')
                    saveChatHistory()
                    
                    const receiveDuration = Date.now() - receiveStartTime
                    console.log('[TeacherStore] ✅ [存储流程] ========== 图片消息接收和存储流程完成 ==========', {
                      messageId: data.messageId,
                      messageType: 'IMAGE',
                      totalDuration: `${receiveDuration}ms`,
                      timestamp: new Date().toISOString()
                    })
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
                    saveChatHistory()
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
                  saveChatHistory()
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
                saveChatHistory()
              }
            }
          })()
        } else {
          // content已经是base64数据，直接使用
          const imageMessage: ChatBubble = {
            id: data.messageId,
            messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
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
          console.log('[TeacherStore] 📨 [存储流程] 图片消息处理完成（base64），准备添加到列表并保存', {
            messageId: data.messageId,
            hasBase64: !!data.content
          })
          addMessage(imageMessage)
          console.log('[TeacherStore] 💾 [存储流程] 图片消息已添加，触发保存')
          saveChatHistory()
          
          const receiveDuration = Date.now() - receiveStartTime
          console.log('[TeacherStore] ✅ [存储流程] ========== 图片消息接收和存储流程完成 ==========', {
            messageId: data.messageId,
            messageType: 'IMAGE',
            totalDuration: `${receiveDuration}ms`,
            timestamp: new Date().toISOString()
          })
        }
      } else if (isVoiceMessage) {
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
              console.warn('[TeacherStore] ⚠️ 语音消息时长为 0，可能是文件损坏或无法获取时长')
              // 如果有调试日志，已经在上面打印了，这里提示用户查看日志
              if (data.debugLogs && data.debugLogs.length > 0) {
                console.warn('[TeacherStore] ⚠️ 请查看上方的Android端调试日志，了解详细原因')
              }
            }
          } else {
            console.warn('[TeacherStore] ⚠️ 语音消息格式异常，parts.length < 2:', parts.length)
          }
        } else {
          console.warn('[TeacherStore] ⚠️ 语音消息 content 格式异常，不包含逗号:', data.content)
        }
        
        const teacherMessage: ChatBubble = {
          id: data.messageId,
          messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
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
        console.log('[TeacherStore] 📨 [存储流程] 语音消息处理完成，准备添加到列表并保存', {
          messageId: data.messageId,
          duration: voiceDuration,
          filePath: voiceFilePath?.substring(0, 50)
        })
        addMessage(teacherMessage)
        console.log('[TeacherStore] 💾 [存储流程] 语音消息已添加，触发保存')
        saveChatHistory()
        
        const receiveDuration = Date.now() - receiveStartTime
        console.log('[TeacherStore] ✅ [存储流程] ========== 语音消息接收和存储流程完成 ==========', {
          messageId: data.messageId,
          messageType: 'VOICE',
          totalDuration: `${receiveDuration}ms`,
          timestamp: new Date().toISOString()
        })
      } else {
        // 文本消息
        const teacherMessage: ChatBubble = {
          id: data.messageId,
          messageId: data.messageId, // 同时设置messageId字段，确保过滤逻辑能正确识别
          content: data.content,
          type: 'ai',
          timestamp: new Date(data.timestamp).toISOString(),
          sender: 'teacher'
        }
        console.log('[TeacherStore] 📨 [存储流程] 文本消息处理完成，准备添加到列表并保存', {
          messageId: data.messageId,
          contentLength: data.content?.length || 0
        })
        addMessage(teacherMessage)
        console.log('[TeacherStore] 💾 [存储流程] 文本消息已添加，触发保存')
        saveChatHistory()
        
        const receiveDuration = Date.now() - receiveStartTime
        console.log('[TeacherStore] ✅ [存储流程] ========== 消息接收和存储流程完成 ==========', {
          messageId: data.messageId,
          messageType: data.messageType,
          totalDuration: `${receiveDuration}ms`,
          timestamp: new Date().toISOString()
        })
      }
      } catch (error) {
        const errorDuration = Date.now() - receiveStartTime
        console.error('[TeacherStore] ❌ [存储流程] ========== 消息接收和存储流程失败 ==========', {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          duration: `${errorDuration}ms`,
          timestamp: new Date().toISOString()
        })
        console.error('[TeacherStore] ❌ 处理老师消息时发生错误:', error)
        console.error('[TeacherStore] ❌ 错误详情:', {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          messageData
        })
        // 不抛出错误，避免影响其他消息的处理
      }
    }
    
    // 确认回调函数已设置（立即验证）
    const callbackType = typeof window.onTeacherMessageReceived
    const isFunction = callbackType === 'function'
    console.log('[TeacherStore] ✅ 老师消息接收回调函数已设置', {
      callbackExists: isFunction,
      callbackType: callbackType,
      callbackValue: window.onTeacherMessageReceived,
      isNull: window.onTeacherMessageReceived === null,
      isUndefined: window.onTeacherMessageReceived === undefined
    })
    
    // 如果回调函数设置失败，抛出错误
    if (!isFunction) {
      const errorMsg = `回调函数设置失败！期望类型: function，实际类型: ${callbackType}`
      console.error('[TeacherStore] ❌', errorMsg)
      throw new Error(errorMsg)
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
            JSON.parse(cleanupResult)
          }
        } catch {
          // 忽略清理错误
        }
        
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
            break
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
        // 调用 initTeacherMessageListener 会添加监听器（如果已存在会先清理再添加，确保不重复）
        // 注意：这里会执行清理操作，但这是必要的，因为方法引用可能已变化
        try {
          const cleanupResult = window.AndroidBridge.cleanupTeacherMessageListener?.()
          if (cleanupResult) {
            JSON.parse(cleanupResult)
          }
        } catch {
          // 忽略清理错误
        }
        
        const result = window.AndroidBridge.initTeacherMessageListener()
        const data = JSON.parse(result)
        if (!data.success) {
          console.warn('[TeacherStore] ⚠️ 添加监听器失败:', data.message)
          // 不抛出错误，因为 MessagingManager 已经初始化，可能只是重复调用
        }
      }
      
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
    pendingImage.value = imageData
  }
  
  /**
   * 清除待发送图片
   * 第1步：清空待发送图片状态
   */
  const clearPendingImage = (): void => {
    pendingImage.value = null
  }
  
  // ==================== 老师选项管理 ====================
  
  /**
   * 所有可用的老师列表
   */
  const ALL_TEACHERS: Array<{ subject: 'biology' | 'math', name: string }> = [
    { subject: 'biology', name: '生物老师' },
    { subject: 'math', name: '数学老师' }
  ]
  
  /**
   * 获取所有老师列表
   */
  const getAllTeachers = (): Array<{ subject: 'biology' | 'math', name: string }> => {
    return ALL_TEACHERS
  }
  
  /**
   * 获取没有对话记录的老师列表
   * 第1步：获取所有老师列表
   * 第2步：从统一的localStorage记录中查找已有对话记录的老师
   * 第3步：过滤掉已有对话记录的老师
   */
  const getAvailableTeachers = (): Array<{ subject: 'biology' | 'math', name: string }> => {
    // 第1步：获取所有老师列表
    const allTeachers = getAllTeachers()
    
    // 第2步：从统一的localStorage记录中查找已有对话记录的老师
    const sessions = loadAllSessions()
    const existingSubjects = new Set<string>()
    
    for (const sessionId in sessions) {
      const session = sessions[sessionId]
            if (session.subject === 'biology' || session.subject === 'math') {
              existingSubjects.add(session.subject)
      }
    }
    
    // 第3步：返回没有对话记录的老师
    return allTeachers.filter(teacher => !existingSubjects.has(teacher.subject))
  }
  
  /**
   * 获取所有会话列表（供外部组件使用）
   */
  const getAllSessions = (): TeacherSession[] => {
    const sessions = loadAllSessions()
    return Object.values(sessions).sort((a, b) => b.createTime - a.createTime)
  }
  
  // 初始化时更新一次会话列表
  updateAllSessions()
  
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
    clearPendingImage,
    
    // 老师选项管理
    getAllTeachers,
    getAvailableTeachers,
    
    // 会话存储管理（供外部组件使用）
    getAllSessions,
    allSessions, // 响应式的会话列表（ref）
    getSession,
    saveSession,
    deleteSession
  }
})

