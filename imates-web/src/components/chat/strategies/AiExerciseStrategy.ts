/**
 * AI题目对话策略（使用场景独立Store）
 * 处理基于题目的AI对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy, ForwardResult, ForwardOptions } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'
import { useAiExerciseChatStore } from '../../../stores/aiExerciseChatStore'
import { getUserInfo, getSubject } from '../../../services/auth-storage-service'
import { useTeacherExerciseChatStore } from '../../../stores/teacherExerciseChatStore'
import { apiService } from '../../../services/api-service'
import { showMessage } from '../../../utils'
import { generateUniqueId } from '../../../stores/utils/chatStoreUtils'

export class AiExerciseStrategy implements ChatStrategy {
  private aiExerciseStore = useAiExerciseChatStore()
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiExerciseStore.messages
  }
  
  // 第2步：添加消息（直接操作messages）
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiExerciseStore.messages.push(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    // 优先使用 options.currentQuestion（由 ChatView 通过 props.overrideQuestion 传入）
    const currentQuestion = options.currentQuestion as unknown | undefined

    // 如果没有传入题目，则提示用户先选择题目
    if (!currentQuestion) {
      throw new Error('请先选择题目')
    }
    
    const hidePrefix = content.includes('我们开始吧')
    
    // 调用Store的sendMessage方法，传递所有必需参数
    await this.aiExerciseStore.sendMessage(
      content,
      currentQuestion as any,
      getUserInfo(),
      getSubject(),
      options.selectedModel || 'mate',
      options.imageData,
      hidePrefix
    )
  }
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    return '请先选择一道题目，然后我们可以开始讨论。你可以从题目列表中选择一道感兴趣的题目。'
  }
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return true
  }
  
  // 第6步：获取消息类型
  getMessageType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 第7步：获取发送者类型
  getSenderType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 第8步：保存聊天历史（AI题目场景统一使用 bmNo 作为存储键）
  async saveChatHistory(questionBmNo?: string): Promise<void> {
    if (questionBmNo) {
      await this.aiExerciseStore.saveChatHistory(questionBmNo)
    }
  }
  
  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean {
    return true // AI题目对话支持转发
  }
  
  // 第10步：获取当前科目（用于转发）
  getCurrentSubjectForForward(question: unknown): 'biology' | 'math' | null {
    // AI题目场景：通过题目的科目字段进行判断
    try {
      const q = question as { subject?: string } | null | undefined
      if (q?.subject) {
        const subjectLower = q.subject.toLowerCase()
        if (subjectLower === 'biology' || subjectLower === '生物') {
          return 'biology'
        } else if (subjectLower === 'math' || subjectLower === '数学') {
          return 'math'
        }
      }
      return null
    } catch (error) {
      console.error('[AiExerciseStrategy] ❌ 获取题目科目失败:', error)
      return null
    }
  }
  
  // 第11步：转发单条消息
  async forwardMessage(message: ChatBubble, options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      const question = (options.currentQuestion ?? null) as { id?: string; bmNo?: string; title?: string; subject?: string } | null

      // 验证是否选择了题目
      if (!question) {
        return {
          success: false,
          error: '请先选择题目',
        }
      }
      
      const subject = this.getCurrentSubjectForForward(question)
      
      if (!subject) {
        return {
          success: false,
          error: '无法确定题目科目',
        }
      }
      
      // 选择或创建老师题目会话
      const session = await this.selectOrCreateTeacherExerciseSession(
        question.bmNo,
        question.title || '题目',
        subject
      )

      
      if (!session) {
        return {
          success: false,
          error: '会话创建失败',
        }
      }
      
      // 转发消息到题目会话
      const success = await this.forwardMessageToTeacher([message], session.sessionId)
      
      if (success) {
        const result: ForwardResult = {
          success: true,
          successCount: 1,
          sessionId: session.sessionId,
        }
        
        // AI题目对话页面不显示对话框，只显示简单提示
        showMessage('转发成功', 'success')
        if (options.onSuccess) {
          await options.onSuccess(result)
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
      const question = (options.currentQuestion ?? null) as { id?: string; bmNo?: string; title?: string; subject?: string } | null

      // 验证是否选择了题目
      if (!question) {
        return {
          success: false,
          error: '请先选择题目',
        }
      }
      
      const subject = this.getCurrentSubjectForForward(question)
      
      if (!subject) {
        return {
          success: false,
          error: '无法确定题目科目',
        }
      }
      
      // 选择或创建老师题目会话
      const session = await this.selectOrCreateTeacherExerciseSession(
        question.bmNo,
        question.title || '题目',
        subject
      )
      
      if (!session) {
        return {
          success: false,
          error: '会话创建失败',
        }
      }
      
      // 逐条转发消息到题目会话
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
        
        // AI题目对话页面不显示对话框，只显示简单提示
        showMessage(`转发成功，已转发 ${successCount} 条消息`, 'success')
        if (options.onSuccess) {
          await options.onSuccess(result)
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
    console.log('初始化消息', options)
    
    // 如果有题目，加载该题目的聊天历史（此处 currentQuestionId 约定为 bmNo）
    if (options.hasSelectedQuestion && options.currentQuestionId) {
      const questionBmNo = options.currentQuestionId
      if (questionBmNo) {
        console.log('[AiExerciseStrategy] 加载题目聊天历史 (bmNo):', questionBmNo)
        await this.aiExerciseStore.loadChatHistory(questionBmNo)
        console.log('[AiExerciseStrategy] 聊天历史加载完成，消息数量:', this.aiExerciseStore.messages.length)
      }
    } else {
      // 如果没有题目且消息为空，添加欢迎消息
      if (this.aiExerciseStore.messages.length === 0) {
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
    console.log('初始化消息完成', this.aiExerciseStore.messages)
  }
  
  // 第14步：发送语音消息
  async sendVoiceMessage(voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }> {
    // AI题目场景：暂时模拟成功
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
    options?: { selectedModel?: string; currentQuestionId?: string; currentQuestion?: unknown }
  ): Promise<void> {
    const messages = this.aiExerciseStore.messages
    const messageIndex = messages.findIndex((msg) => msg.id === messageId)
    
    if (messageIndex === -1) {
      throw new Error('消息不存在')
    }
    
    // 更新消息内容
    messages[messageIndex].content = newContent
    
    // 不保留原来的旧消息，只保留之前的上下文
    const messagesToKeep = messages.slice(0, messageIndex)
    this.aiExerciseStore.messages.length = 0
    this.aiExerciseStore.messages.push(...messagesToKeep)
    
    // 保存聊天记录（此处 currentQuestionId 约定为 bmNo）
    await this.saveChatHistory(options?.currentQuestionId)
    
    // 发送编辑后的消息给AI
    await this.sendMessage(newContent, { 
      selectedModel: options?.selectedModel,
      currentQuestion: options?.currentQuestion,
    })
  }
  
  // 第17步：获取占位符文本
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    if (!hasSelectedQuestion) {
      return '可以先聊聊，或选择题目后开始讨论'
    }
    return '输入你的问题'
  }
  
  // 第18步：获取会话信息（AI策略不需要）
  // getSessionInfo 不实现，因为AI策略不需要
  
  // 第19步：是否显示转发按钮
  shouldShowForwardButton(): boolean {
    return true // AI题目对话支持转发
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
   * 选择或创建老师题目会话
   */
  private async selectOrCreateTeacherExerciseSession(
    questionId: string,
    questionTitle: string,
    subject: 'biology' | 'math'
  ): Promise<{ sessionId: string; sessionName: string; subject: 'biology' | 'math' } | null> {
    const teacherExerciseStore = useTeacherExerciseChatStore()
    
    // 创建或获取题目会话
    const session = teacherExerciseStore.getOrCreateSession(questionId, questionTitle, subject)
    console.log('加载聊天记录selectOrCreateTeacherExerciseSession')
    // 加载聊天历史（使用 questionId 而不是 sessionId，确保与保存时的 storageKey 一致）
    await teacherExerciseStore.loadChatHistory(session.questionId)
    
    return {
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      subject: session.subject,
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
      console.error('[AiExerciseStrategy] ❌ 序列化失败:', error)
      return false
    }
    
    // 第3步：调用API转发
    try {
      const success = await apiService.forwardAiChatToTeacher(
        selectedMessagesData,
        sessionId,
      )
      console.log('[AiExerciseStrategy] 🔍 [转发流程] 调用API转发 success', success)
      if (success) {
        // 第4步：保存转发消息到本地存储
        const convertedMessages = messages.map((msg) => {
          // 确定消息类型
          let messageType: 'text' | 'voice' | 'image' = (msg.messageType || 'text') as 'text' | 'voice' | 'image'
          if (!messageType || (messageType !== 'text' && messageType !== 'voice' && messageType !== 'image')) {
            // 如果没有 messageType 或类型不正确，根据数据判断
            if (msg.imageData?.filePath || msg.imageData?.base64DataUrl) {
              messageType = 'image'
            } else if (msg.voiceData?.filePath) {
              messageType = 'voice'
            } else {
              messageType = 'text'
            }
          }
          
          // 生成唯一的转发消息ID，允许同一条消息多次转发
          // 提取原始ID（如果已经是转发消息，提取原始ID）
          const originalId = msg.id.startsWith('forwarded_') 
            ? msg.id.replace(/^forwarded_/, '').split('_')[0] // 提取第一个下划线前的原始ID
            : msg.id
          const uniqueId = generateUniqueId(`forwarded_${originalId}`)
          
          return {
            ...msg,
            id: uniqueId,
            sender: 'user' as const,
            type: 'user' as const,
            messageType: messageType
          }
        })
        
        // AI题目策略固定使用 exercise 类型的 store
          const teacherExerciseStore = useTeacherExerciseChatStore()
          // 确保 currentSession 指向正确的会话，避免会话列表重复存储
          const targetSession = teacherExerciseStore.getSession(sessionId)
          if (targetSession) {
            teacherExerciseStore.setSession(targetSession)
          }
          // 直接添加到老师题目消息存储并持久化
          teacherExerciseStore.messages.push(...convertedMessages)
        console.log('[AiExerciseStrategy] 🔍 [存储流程] 保存聊天历史完成', teacherExerciseStore.messages)
          // 立即保存，避免防抖问题导致消息丢失（saveChatHistory 内部会加载本地消息）
        await teacherExerciseStore.saveChatHistory()
      }
      
      return success
    } catch (error) {
      console.error('[AiExerciseStrategy] ❌ forwardMessageToTeacher 异常:', error)
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
    let successCount = 0
    
    for (const message of messages) {
      const selectedMessagesData = JSON.stringify([this.convertMessageForForwarding(message)])
      
      const success = await apiService.forwardAiChatToTeacher(
        selectedMessagesData,
        sessionId,
      )
      
      if (success) {
        successCount++
      }
      
      // 每条消息之间延迟50ms，避免发送过快
      if (messages.indexOf(message) < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    
    // 如果至少有一条消息转发成功，保存所有消息到本地存储
    if (successCount > 0) {
      const convertedMessages = messages.map((msg) => {
        // 生成唯一的转发消息ID，允许同一条消息多次转发
        // 提取原始ID（如果已经是转发消息，提取原始ID）
        const originalId = msg.id.startsWith('forwarded_') 
          ? msg.id.replace(/^forwarded_/, '').split('_')[0] // 提取第一个下划线前的原始ID
          : msg.id
        const uniqueId = generateUniqueId(`forwarded_${originalId}`)
        
        return {
        ...msg,
          id: uniqueId,
        sender: 'user' as const,
        type: 'user' as const,
        }
      })
      
      // AI题目策略固定使用 exercise 类型的 store
        const teacherExerciseStore = useTeacherExerciseChatStore()
        // 确保 currentSession 指向正确的会话，避免会话列表重复存储
        const targetSession = teacherExerciseStore.getSession(sessionId)
        if (targetSession) {
          teacherExerciseStore.setSession(targetSession)
        }
        // 直接添加到老师题目消息存储
        teacherExerciseStore.messages.push(...convertedMessages)
        // 立即保存，避免防抖问题导致消息丢失（saveChatHistory 内部会加载本地消息）
      await teacherExerciseStore.saveChatHistory()
    }
    
    return { successCount, totalCount: messages.length }
  }
}
