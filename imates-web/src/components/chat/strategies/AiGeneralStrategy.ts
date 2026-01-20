/**
 * AI通用对话策略（使用场景独立Store）
 * 处理通用AI对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy, ForwardResult, ForwardOptions } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'
import { useAiGeneralChatStore } from '../../../stores/aiGeneralChatStore'
import { getUserInfo, getSubject } from '../../../services'
import { useTeacherChatStore } from '../../../stores/teacherChatStore'
import { apiService } from '../../../services/http/api-service'
import { showMessage } from '../../../utils'
import { generateUniqueId } from '../../../stores/utils/chatStoreUtils'
import TeacherSelectionDialog from '../../dialog/TeacherSelectionDialog.vue'

export class AiGeneralStrategy implements ChatStrategy {
  private aiGeneralStore = useAiGeneralChatStore()
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiGeneralStore.messages
  }
  
  // 第2步：添加消息（直接操作messages）
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiGeneralStore.messages.push(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    // 当 options.imageData 存在时，说明上游已插入了图片用户消息
    // 为避免再次插入空文本用户消息，传递 skipUserMessage 标记给 Store
    const skipUserMessage = !!options.imageData || !!(options.imageList && options.imageList.length > 0) || !!options.skipUserMessage

    await this.aiGeneralStore.sendMessage(
      content,
      getUserInfo(),
      getSubject(),
      options.selectedModel || 'mate',
      skipUserMessage,
      options.quotedMessage,
      options.imageData,
      options.imageList,
    )
  }
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    return '你好！我是你的学习伙伴。有什么问题我可以帮你解答吗？'
  }
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return false // AI通用对话不需要题目
  }
  
  // 第6步：获取消息类型
  getMessageType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 第7步：获取发送者类型
  getSenderType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 第8步：保存聊天历史
  async saveChatHistory(): Promise<void> {
    await this.aiGeneralStore.saveChatHistory()
  }
  
  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean {
    return true // AI通用对话支持转发
  }
  
  // 第10步：获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    // AI通用场景：返回 null，需要用户手动选择老师
    return null
  }
  
  // 第11步：转发单条消息
  async forwardMessage(message: ChatBubble, options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 选择老师会话
      const session = await this.selectTeacherSession(options.onTeacherSelect)
      if (!session) {
        return {
          success: false,
          error: '用户取消选择或会话创建失败',
        }
      }
      
      // 转发消息到通用会话
      const success = await this.forwardMessageToTeacher([message], session.sessionId)
      
      if (success) {
        const result: ForwardResult = {
          success: true,
          successCount: 1,
          sessionId: session.sessionId,
        }
        
        // 显示成功提示或对话框
        if (options.showDialog !== false) {
          this.showForwardSuccessDialog(result, options, async () => {
            if (options.onSuccess) {
              await options.onSuccess(result)
            }
          })
        } else {
          showMessage('转发成功', 'success')
          if (options.onSuccess) {
            await options.onSuccess(result)
          }
        }
        
        return result
      } else {
        const error = '转发失败'
        if (options.onError) {
          options.onError(error)
        }
        return {
          success: false,
          error,
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (options.onError) {
        options.onError(errorMessage)
      }
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
  
  // 第12步：转发多条消息
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 选择老师会话
      const session = await this.selectTeacherSession(options.onTeacherSelect)

      if (!session) {
        return {
          success: false,
          error: '用户取消选择或会话创建失败',
        }
      }
      
      // 逐条转发消息到通用会话
      const { successCount } = await this.forwardMessagesSeparately(
        messages,
        session.sessionId
      )
      
      if (successCount > 0) {
        const result: ForwardResult = {
          success: true,
          successCount,
          sessionId: session.sessionId,
        }
        
        // 显示成功提示或对话框
        if (options.showDialog !== false) {
          this.showForwardSuccessDialog(result, options, async () => {
            if (options.onSuccess) {
              await options.onSuccess(result)
            }
          })
        } else {
          showMessage(`转发成功，已转发 ${successCount} 条消息`, 'success')
          if (options.onSuccess) {
            await options.onSuccess(result)
          }
        }
        
        return result
      } else {
        const error = '转发失败，请重试'
        if (options.onError) {
          options.onError(error)
        }
        return {
          success: false,
          error,
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (options.onError) {
        options.onError(errorMessage)
      }
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
  
  // 第13步：初始化消息
  async initialize(options: InitializeOptions): Promise<void> {
    // AI通用对话不需要特殊初始化，只需要添加欢迎消息
    if (!options.hasSelectedQuestion && this.aiGeneralStore.messages.length === 0) {
      const welcomeMessage: ChatBubble = {
        id: 'welcome_' + Date.now(),
        content: this.getWelcomeMessage(),
        type: this.getMessageType(),
        timestamp: '',
        sender: this.getSenderType(),
      }
      await this.addMessage(welcomeMessage)
    }
  }

  // 第16步：检查是否应该乐观发送
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendVoiceMessage(_voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }> {
    // AI通用场景：暂时模拟成功
    return { success: true }
  }
  
  // 第15步：发送图片消息
  async sendImageMessage(
    imageInfo: {
      filePath: string
      width: number
      height: number
      fileSize: number
      base64DataUrl?: string
    },
    textContent?: string,
    options?: SendMessageOptions
  ): Promise<void> {
    // 创建图片消息
    const imageMessage: ChatBubble = {
      id: Date.now().toString(),
      content: '',
      type: 'user',
      timestamp: '',
      sender: 'user',
      messageType: 'image',
      imageData: {
        filePath: imageInfo.filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        fileSize: imageInfo.fileSize,
        base64DataUrl: imageInfo.base64DataUrl,
      },
    }
    
    await this.addMessage(imageMessage)
    
    // 发送图片消息给AI
    if (!imageInfo.base64DataUrl) {
      throw new Error('图片数据不完整，请重试')
    }
    
    await this.sendMessage(textContent || '', {
      selectedModel: options?.selectedModel,
      imageData: {
        filePath: imageInfo.filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        fileSize: imageInfo.fileSize,
        base64DataUrl: imageInfo.base64DataUrl,
      },
    })
  }
  
  // 第16步：更新编辑的消息
  async updateEditedMessage(
    messageId: string,
    newContent: string,
    options?: { selectedModel?: string }
  ): Promise<void> {
    const messages = this.aiGeneralStore.messages
    const messageIndex = messages.findIndex((msg) => msg.id === messageId)
    
    if (messageIndex === -1) {
      throw new Error('消息不存在')
    }
    
    // 更新消息内容
    messages[messageIndex].content = newContent
    
    // 删除该消息之后的所有消息
    const messagesToKeep = messages.slice(0, messageIndex + 1)
    this.aiGeneralStore.messages.length = 0
    this.aiGeneralStore.messages.push(...messagesToKeep)
    
    // 保存聊天记录
    await this.saveChatHistory()
    
    // 发送编辑后的消息给AI：跳过重新创建用户消息，只保留就地更新后的气泡
    await this.sendMessage(newContent, {
      selectedModel: options?.selectedModel,
      skipUserMessage: true,
    })
  }
  
  // 第17步：获取占位符文本
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    if (!hasSelectedQuestion) {
      return '可以先聊聊，或选择题目后开始讨论'
    }
    return '向AI助手提问...'
  }
  
  // 第18步：获取会话信息（AI策略不需要）
  // getSessionInfo 不实现，因为AI策略不需要
  
  // 第19步：是否显示转发按钮
  shouldShowForwardButton(): boolean {
    return true // AI通用对话支持转发
  }
  
  // 第20步：发送图片消息后是否清空输入框
  shouldClearInputAfterImage(): boolean {
    return true // AI场景需要清空输入框
  }
  
  // 第21步：是否使用乐观发送
  shouldOptimisticSend(): boolean {
    return false // AI场景不使用乐观发送
  }
  
  // 第22步：清理资源
  // cleanup 不实现，因为AI策略不需要特殊清理
  
  // 第23步：获取当前科目
  getCurrentSubject(): 'biology' | 'math' {
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
  }

  // ========== 转发消息相关私有方法 ==========

  /**
   * 转换消息格式用于转发
   */
  private convertMessageForForwarding(msg: ChatBubble) {
    // 获取数据类型，默认为text
    const dataType = msg.messageType || 'text'
    const messageType = dataType.toUpperCase() // text -> TEXT, voice -> VOICE, image -> IMAGE
    let messageContent = msg.content || ''

    // 根据角色类型添加前缀
    if (msg.type === 'user') {
      messageContent = '[学生] ' + messageContent
    } else if (msg.type === 'ai') {
      messageContent = '[AI助手] ' + messageContent
    }

    const cleanedContent = messageContent
      ? messageContent
          .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
          .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
          .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
          .replace(/\s+/g, ' ') // 合并多个空格
          .trim()
      : ''
    
    const result = {
      id: msg.id,
      type: messageType,
      content: cleanedContent,
      timestamp: '',
    }
    
    return result
  }


  /**
   * 选择老师会话（从写死会话中选择）
   */
  private async selectTeacherSession(onTeacherSelect?: () => Promise<'biology' | 'math'>): Promise<{ sessionId: string; sessionName: string; subject: string } | null> {
    if (!onTeacherSelect) {
      console.error('[AiGeneralStrategy] 未提供老师选择回调函数')
      return null
    }

    try {
      // 1. 用户手动选择科目
      const selectedSubject = await onTeacherSelect()

      // 2. 转换科目格式（小写 -> 大写）
      const subjectUpper = selectedSubject === 'biology' ? 'BIOLOGY' : 'MATH'

      // 3. 从写死会话中选择对应的会话
      const teacherStore = useTeacherChatStore()
      const allSessions = teacherStore.loadAllSessions()

      // 找到对应的写死会话
      const session = Object.values(allSessions).find(s => s.subject === subjectUpper)
      if (!session) {
        console.error('[AiGeneralStrategy] 未找到对应科目的写死会话:', selectedSubject)
        return null
      }

      return {
        sessionId: session.sessionId,
        sessionName: session.sessionName,
        subject: session.subject
      }
    } catch (error) {
      console.error('[AiGeneralStrategy] 老师选择失败:', error)
      return null
    }
  }

  /**
   * 转发消息到老师
   */
  private async forwardMessageToTeacher(
    messages: ChatBubble[],
    sessionId: string
  ): Promise<boolean> {
    // 第1步：转换消息格式
    const cleanedMessages = messages.map(msg => this.convertMessageForForwarding(msg))

    // 第2步：序列化消息数据
    let selectedMessagesData: string
    try {
      selectedMessagesData = JSON.stringify(cleanedMessages)
    } catch (error) {
      console.error('[AiGeneralStrategy] ❌ 序列化失败:', error)
      return false
    }
    
    // 第3步：直接通过WebSocket发送转发消息
    try {
      const teacherStore = useTeacherChatStore()

      // 确保当前会话设置正确
      const allSessions = teacherStore.loadAllSessions()
      const targetSession = allSessions[sessionId]
      if (targetSession) {
        teacherStore.setSession(targetSession)
      }

      // 预先添加转发消息到store（模拟正常发送流程）
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const forwardContent = `[AI聊天转发]\n${selectedMessagesData}`

      const forwardMessage: ChatBubble = {
        id: messageId,
        messageId: messageId,
        content: forwardContent,
        type: 'user',
        timestamp: new Date().toISOString(),
        sender: 'user',
        messageType: 'text',
      }

      teacherStore.addMessage(forwardMessage)

      // 检查WebSocket连接状态，如果未连接则主动建立连接
      const { getWebSocketService } = await import('../../../services/websocket/webSocketService')
      const webSocket = getWebSocketService('teacher')
      if (!webSocket.isConnected()) {
        console.log('[AiGeneralStrategy] WebSocket未连接，转发前先建立连接...')
        const connected = await teacherStore.connectWebSocket()
        if (!connected) {
          throw new Error('WebSocket连接失败')
        }
      }

      // 通过WebSocket发送转发消息
      await teacherStore.sendMessage(forwardContent)

      console.log('[AiGeneralStrategy] ✅ 转发消息通过WebSocket发送成功')
      return true
    } catch (error) {
      console.error('[AiGeneralStrategy] ❌ 转发消息失败:', error)
      return false
    }
  }

  /**
   * 逐条转发消息
   */
  private async forwardMessagesSeparately(
    messages: ChatBubble[],
    sessionId: string
  ): Promise<{ successCount: number; totalCount: number }> {
    const teacherStore = useTeacherChatStore()
    let successCount = 0

    // 确保当前会话设置正确
    const allSessions = teacherStore.loadAllSessions()
    const targetSession = allSessions[sessionId]
    if (targetSession) {
      teacherStore.setSession(targetSession)
    }

    // 检查WebSocket连接状态，如果未连接则主动建立连接
    const { getWebSocketService } = await import('../../../services/websocket/webSocketService')
    const webSocket = getWebSocketService('teacher')
    if (!webSocket.isConnected()) {
      console.log('[AiGeneralStrategy] WebSocket未连接，批量转发前先建立连接...')
      const connected = await teacherStore.connectWebSocket()
      if (!connected) {
        console.error('[AiGeneralStrategy] WebSocket连接失败，无法进行批量转发')
        return { successCount: 0, totalCount: messages.length }
      }
    }

    for (const message of messages) {
      try {
        const selectedMessagesData = JSON.stringify([this.convertMessageForForwarding(message)])

        // 预先添加转发消息到store
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const forwardContent = `[AI聊天转发]\n${selectedMessagesData}`

        const forwardMessage: ChatBubble = {
          id: messageId,
          messageId: messageId,
          content: forwardContent,
          type: 'user',
          timestamp: new Date().toISOString(),
          sender: 'user',
          messageType: 'text',
        }

        teacherStore.addMessage(forwardMessage)

        // 通过WebSocket发送转发消息
        await teacherStore.sendMessage(forwardContent)
        successCount++

        console.log(`[AiGeneralStrategy] ✅ 单条转发消息成功 (${successCount}/${messages.length})`)
      } catch (error) {
        console.error(`[AiGeneralStrategy] ❌ 单条转发消息失败:`, error)
      }

      // 每条消息之间延迟50ms，避免发送过快
      if (messages.indexOf(message) < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    console.log(`[AiGeneralStrategy] ✅ 批量转发完成: ${successCount}/${messages.length} 条消息`)
    return { successCount, totalCount: messages.length }
  }

  /**
   * 显示转发成功对话框
   */
  private async showForwardSuccessDialog(
    result: ForwardResult,
    options: ForwardOptions,
    onNavigateToTeacher?: (sessionId: string) => void | Promise<void>
  ) {
    if (!options.showDialog || !options.showForwardSuccessDialog) {
      return
    }

    const message = result.successCount && result.successCount > 1
      ? `已成功转发 ${result.successCount} 条消息给老师，是否前往老师对话查看？`
      : '消息已成功转发给老师，是否前往老师对话查看？'

    try {
      const dialogResult = await options.showForwardSuccessDialog(message, result.sessionId)
      if (dialogResult.goToTeacher && result.sessionId && onNavigateToTeacher) {
        onNavigateToTeacher(result.sessionId)
      }
      if (options.onSuccess) {
        options.onSuccess(result)
      }
    } catch (error) {
      console.error('[AiGeneralStrategy] 显示转发成功对话框失败:', error)
      // 如果对话框显示失败，仍执行成功回调
      if (options.onSuccess) {
        options.onSuccess(result)
      }
    }
  }

  // 获取联网搜索状态
  getEnableWebSearch(): boolean {
    return this.aiGeneralStore.enableWebSearch
  }

  // 切换联网搜索状态
  toggleWebSearch(): void {
    this.aiGeneralStore.toggleWebSearch()
  }
}