/**
 * AI教材对话策略（使用场景独立Store）
 * 处理教材问答逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy, ForwardResult, ForwardOptions } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'
import { useAiTextbookChatStore } from '../../../stores/aiTextbookChatStore'
import { useKnowledgeGraphStore } from '../../../stores/KnowledgeGraphStore'
import { useTeacherGeneralChatStore } from '../../../stores/teacherGeneralChatStore'
import { apiService } from '../../../services/business/api-service'
import { Dialog } from 'quasar'
import { showMessage } from '../../../utils'
import { generateUniqueId } from '../../../stores/utils/chatStoreUtils'

export class AiTextbookStrategy implements ChatStrategy {
  private aiTextbookStore = useAiTextbookChatStore()
  private knowledgeGraphStore = useKnowledgeGraphStore()
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiTextbookStore.messages
  }
  
  // 第2步：添加消息
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiTextbookStore.addMessage(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const hidePrefix = content.includes('我们开始吧')
    await this.aiTextbookStore.sendMessage(
      content,
      options.selectedModel,
      options.imageData,
      hidePrefix,
      options.skipUserMessage,
      options.quotedMessage, // 传递引用消息信息（用于消息气泡展示）
      options.imageList,
    )
  }
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    return '你好！我可以帮你解答教材中的问题。请告诉我你的疑问，或者使用探索区域工具发送教材截图。'
  }
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return false // AI教材对话不需要题目
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
    await this.aiTextbookStore.saveChatHistory()
  }
  
  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean {
    return true // AI教材对话支持转发
  }
  
  // 第10步：获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    // AI教材场景：使用知识图谱的 store 的科目状态字段
    try {
      const subject = this.knowledgeGraphStore.getCurrentSubjectLowercase()
      return subject || null
    } catch (error) {
      console.error('[AiTextbookStrategy] ❌ 获取知识图谱科目失败:', error)
      return null
    }
  }
  
  // 第11步：转发单条消息
  async forwardMessage(message: ChatBubble, options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 选择或创建老师会话
      const session = await this.selectOrCreateTeacherSession(
        this.getCurrentSubjectForForward()
      )
      
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
      // 选择或创建老师会话
      const session = await this.selectOrCreateTeacherSession(
        this.getCurrentSubjectForForward()
      )
      
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
    // 第1步：如果是AI教材对话模式且提供了resourceId，加载聊天历史
    if (options.resourceId) {
      await this.aiTextbookStore.loadChatHistory(options.resourceId)
    }
    
    // 第2步：只有在没有选择题目且没有聊天记录时才添加引导消息
    if (!options.hasSelectedQuestion && this.aiTextbookStore.messages.length === 0) {
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
  
  // 第14步：发送语音消息
  async sendVoiceMessage(voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }> {
    // AI教材场景：暂时模拟成功
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
    const messages = this.aiTextbookStore.messages
    const messageIndex = messages.findIndex((msg) => msg.id === messageId)
    
    if (messageIndex === -1) {
      throw new Error('消息不存在')
    }
    
    // 更新消息内容
    messages[messageIndex].content = newContent
    
    // 删除该消息之后的所有消息
    const messagesToKeep = messages.slice(0, messageIndex + 1)
    this.aiTextbookStore.messages.length = 0
    this.aiTextbookStore.messages.push(...messagesToKeep)
    
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
    return '向AI教材助手提问...'
  }
  
  // 第18步：获取会话信息（AI策略不需要）
  // getSessionInfo 不实现，因为AI策略不需要
  
  // 第19步：是否显示转发按钮
  shouldShowForwardButton(): boolean {
    return true // AI教材对话支持转发
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
    // AI教材场景使用knowledgeGraphStore中的科目
    const subject = this.knowledgeGraphStore.getCurrentSubject()
    return subject === 'BIOLOGY' ? 'biology' : 'math'
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
   * 选择或创建老师会话（通用会话）
   */
  private async selectOrCreateTeacherSession(
    subject: 'biology' | 'math' | null,
    onSubjectSelected?: (subject: 'biology' | 'math') => Promise<'biology' | 'math'>
  ): Promise<{ sessionId: string; sessionName: string; subject: 'biology' | 'math' } | null> {
    const teacherStore = useTeacherGeneralChatStore()
    
    // 如果科目为null，需要用户选择
    if (subject === null) {
      console.log('选择的科目为null，需要用户选择')
      if (!onSubjectSelected) {
        // 如果没有提供选择回调，使用默认对话框
        return new Promise<{ sessionId: string; sessionName: string; subject: 'biology' | 'math' } | null>((resolve) => {
          Dialog.create({
            title: '选择老师',
            message: '请选择要转发的老师类型：',
            options: {
              type: 'radio',
              model: '',
              items: [
                {
                  label: '生物老师',
                  value: 'biology',
                  color: 'green',
                },
                {
                  label: '数学老师',
                  value: 'math',
                  color: 'blue',
                },
              ],
            },
            cancel: {
              label: '取消',
              color: 'grey',
              flat: true,
            },
            ok: {
              label: '确定',
              color: 'primary',
              unelevated: true,
            },
            persistent: false,
          }).onOk(async (selectedSubject: string) => {
            const result = await this.selectOrCreateTeacherSession(selectedSubject as 'biology' | 'math')
            console.log('选择或创建的老师会话selectOrCreateTeacherSession', result)
            resolve(result)
          }).onCancel(() => {
            resolve(null)
          })
        })
      } else {
        // 使用提供的选择回调（这种情况不应该发生，因为 subject 为 null）
        // 但为了类型安全，我们仍然处理
        if (subject === null) {
          return null
        }
        const selectedSubject = await onSubjectSelected(subject)
        console.log('选择后的科目', selectedSubject)
        return this.selectOrCreateTeacherSession(selectedSubject)
      }
    }
    console.log('选择的科目不为null，不需要用户选择')
    
    // 初始化老师消息监听器
    await teacherStore.initMessageReceiver()
    
    // 加载老师会话列表
    const sessions = teacherStore.allSessions
    console.log('老师会话列表', sessions)
    // 查找对应科目的会话
    const existingSession = sessions.find((s: { subject: string }) => s.subject === subject)
    console.log('找到的会话', existingSession)
    if (existingSession) {
      // 如果已存在，复用已有会话
      teacherStore.setSession(existingSession)
      console.log('加载聊天记录selectOrCreateTeacherSession')
      await teacherStore.loadChatHistory(existingSession.sessionId)
      console.log('加载的会话历史记录', existingSession.sessionId)
      return {
        sessionId: existingSession.sessionId,
        sessionName: existingSession.sessionName,
        subject: existingSession.subject as 'biology' | 'math',
      }
    } else {
      // 如果不存在，创建新会话
      const subjectName = subject === 'biology' ? '生物' : '数学'
      const aiSessionId = `teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const aiSessionName = `${subjectName}`
      
      const createdSession = teacherStore.createTeacherSession(
        aiSessionId,
        aiSessionName,
        subject as 'biology' | 'math'
      )
      
      if (createdSession) {
        console.log('创建的会话', createdSession)
        return {
          sessionId: createdSession.sessionId,
          sessionName: createdSession.sessionName,
          subject: createdSession.subject as 'biology' | 'math',
        }
      }
      
      console.log('创建的会话失败', createdSession)
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
      console.error('[AiTextbookStrategy] ❌ 序列化失败:', error)
      return false
    }
    
    // 第3步：调用API转发
    try {
      const success = await apiService.forwardAiChatToTeacher(
        selectedMessagesData,
        sessionId,
      )
      
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
        
        // AI教材策略固定使用 general 类型的 store
        const teacherStore = useTeacherGeneralChatStore()
        // 确保 currentSession 指向正确的会话，避免会话列表重复存储
        const targetSession = teacherStore.getSession(sessionId)
        if (targetSession) {
          teacherStore.setSession(targetSession)
        }
        // 直接添加到老师通用消息存储并持久化
        teacherStore.messages.push(...convertedMessages)
        // 立即保存，避免防抖问题导致消息丢失（saveChatHistory 内部会加载本地消息）
        await teacherStore.saveChatHistory()
      }
      
      return success
    } catch (error) {
      console.error('[AiTextbookStrategy] ❌ forwardMessageToTeacher 异常:', error)
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
      
      // AI教材策略固定使用 general 类型的 store
      console.log('[AiTextbookStrategy] 🔍 [存储流程] 保存聊天历史完成', convertedMessages)
      const teacherStore = useTeacherGeneralChatStore()
      // 确保 currentSession 指向正确的会话，避免会话列表重复存储
      const targetSession = teacherStore.getSession(sessionId)
      if (targetSession) {
        teacherStore.setSession(targetSession)
        // 在添加消息之前，先加载该会话的历史消息，确保 messages 只包含当前会话的消息
        await teacherStore.loadChatHistory(sessionId)
      }
      // 直接添加到老师通用消息存储
      teacherStore.messages.push(...convertedMessages)
      // 立即保存，避免防抖问题导致消息丢失（saveChatHistory 内部会加载本地消息）
      await teacherStore.saveChatHistory()
    }
    
    return { successCount, totalCount: messages.length }
  }

  /**
   * 显示转发成功对话框
   */
  private showForwardSuccessDialog(
    result: ForwardResult,
    options: ForwardOptions,
    onNavigateToTeacher?: (sessionId: string) => void | Promise<void>
  ) {
    if (!options.showDialog) {
      return
    }
    
    const message = result.successCount && result.successCount > 1
      ? `已成功转发 ${result.successCount} 条消息给老师，是否前往老师对话查看？`
      : '消息已成功转发给老师，是否前往老师对话查看？'
    
    Dialog.create({
      title: '转发成功',
      message: message,
      cancel: {
        label: '留在当前会话',
        color: 'grey-7',
        flat: true,
      },
      ok: {
        label: '前往老师对话',
        color: 'primary',
        unelevated: true,
      },
      persistent: false,
    }).onOk(() => {
      if (result.sessionId && onNavigateToTeacher) {
        onNavigateToTeacher(result.sessionId)
      }
      if (options.onSuccess) {
        options.onSuccess(result)
      }
    }).onCancel(() => {
      if (options.onSuccess) {
        options.onSuccess(result)
      }
    })
  }

  // 获取联网搜索状态
  getEnableWebSearch(): boolean {
    return this.aiTextbookStore.enableWebSearch
  }

  // 切换联网搜索状态
  toggleWebSearch(): void {
    this.aiTextbookStore.toggleWebSearch()
  }
}

