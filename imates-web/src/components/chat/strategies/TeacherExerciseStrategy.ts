/**
 * 教师题目对话策略（使用场景独立Store）
 * 处理基于题目的教师对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'
import { useTeacherExerciseChatStore } from '../../../stores/teacherExerciseChatStore'
// 注意：此策略不再直接依赖 questionStore/homeworkStore
// 所有题目信息通过 options.currentQuestion 传入
import { getUserInfo, getSubject } from '../../../services/storage/auth-storage-service'

export class TeacherExerciseStrategy implements ChatStrategy {
  private teacherExerciseStore = useTeacherExerciseChatStore()
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.teacherExerciseStore.messages
  }
  
  // 第2步：添加消息（直接操作messages）
  async addMessage(message: ChatBubble): Promise<void> {
    this.teacherExerciseStore.messages.push(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    // 优先使用 options.currentQuestion（由 ChatView 通过 props.overrideQuestion 传入）
    const currentQuestion = options.currentQuestion as unknown | undefined
    
    // 验证是否选择了题目
    if (!currentQuestion) {
      throw new Error('请先选择题目')
    }
    
    const hidePrefix = content.includes('我们开始吧')
    
    // 调用Store的sendMessage方法，传递所有必需参数
    await this.teacherExerciseStore.sendMessage(
      content,
      currentQuestion as any,
      getUserInfo(),
      getSubject(),
      (options.selectedModel || 'teacher') as string,
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
    return 'teacher'
  }
  
  // 第7步：获取发送者类型
  getSenderType(): 'ai' | 'teacher' {
    return 'teacher'
  }
  
  // 第8步：保存聊天历史
  async saveChatHistory(): Promise<void> {
    await this.teacherExerciseStore.saveChatHistory()
  }
  
  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean {
    return false // 老师对话不支持转发
  }
  
  // 第10步：获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null // 老师对话不支持转发
  }
  
  // 第11步：转发单条消息
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async forwardMessage(_message: ChatBubble, _options?: import('./ChatStrategy').ForwardOptions): Promise<import('./ChatStrategy').ForwardResult> {
    return {
      success: false,
      error: '老师对话不支持转发消息',
    }
  }
  
  // 第12步：转发多条消息
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async forwardMessages(_messages: ChatBubble[], _options?: import('./ChatStrategy').ForwardOptions): Promise<import('./ChatStrategy').ForwardResult> {
    return {
      success: false,
      error: '老师对话不支持转发消息',
    }
  }
  
  // 第13步：初始化消息
  async initialize(options: InitializeOptions): Promise<void> {
    // 步骤1：验证当前题目
    if (!options.currentQuestionId) {
      console.warn('[TeacherExerciseStrategy] ⚠️ 初始化老师题目会话失败：没有当前题目')
      return
    }

    // 步骤2：初始化老师消息监听器（使用 Store 统一方法）
    await this.teacherExerciseStore.initMessageReceiver()

    // 步骤3：确定科目
    const subject = (options.currentSubject || 'math') as 'biology' | 'math'

    // 步骤4：创建或获取题目会话
    const questionTitle = options.currentQuestionTitle || '题目'
    const session = this.teacherExerciseStore.getOrCreateSession(
      options.currentQuestionId,
      questionTitle,
      subject
    )

    // 步骤5：加载该会话的聊天历史（使用 questionId 而不是 sessionId，确保与保存时的 storageKey 一致）
    await this.teacherExerciseStore.loadChatHistory(session.questionId)

    console.log('[TeacherExerciseStrategy] ✅ 老师题目会话初始化成功', {
      sessionId: session.sessionId,
      questionId: session.questionId,
      subject: session.subject
    })
  }
  
  // 第14步：发送语音消息
  async sendVoiceMessage(voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }> {
    // 教师题目场景：暂时模拟成功
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
    
    // 发送图片消息给老师
    if (!imageInfo.base64DataUrl) {
      throw new Error('图片数据不完整，请重试')
    }
    
    await this.sendMessage(textContent || '', {
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
    const messages = this.teacherExerciseStore.messages
    const messageIndex = messages.findIndex((msg) => msg.id === messageId)
    
    if (messageIndex === -1) {
      throw new Error('消息不存在')
    }
    
    // 更新消息内容
    messages[messageIndex].content = newContent
    
    // 删除该消息之后的所有消息
    const messagesToKeep = messages.slice(0, messageIndex + 1)
    this.teacherExerciseStore.messages.length = 0
    this.teacherExerciseStore.messages.push(...messagesToKeep)
    
    // 保存聊天记录
    await this.saveChatHistory()
    
    // 教师场景不支持编辑后重新发送，只更新消息内容
  }
  
  // 第17步：获取占位符文本
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    if (!hasSelectedQuestion) {
      return '可以先聊聊，或选择题目后开始讨论'
    }
    return '向老师提问...'
  }
  
  // 第18步：获取会话信息（教师题目策略不需要）
  // getSessionInfo 不实现，因为教师题目策略不需要
  
  // 第19步：是否显示转发按钮
  shouldShowForwardButton(): boolean {
    return false // 教师题目对话不支持转发
  }
  
  // 第20步：发送图片消息后是否清空输入框
  shouldClearInputAfterImage(): boolean {
    return false // 教师场景不清空输入框
  }
  
  // 第21步：是否使用乐观发送
  shouldOptimisticSend(): boolean {
    return false // 教师题目场景不使用乐观发送
  }
  
  // 第22步：清理资源
  // cleanup 不实现，因为教师题目策略不需要特殊清理
  
  // 第23步：获取当前科目
  getCurrentSubject(): 'biology' | 'math' {
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
  }
  
  // 第24步：重置会话
  resetSession(): void {
    this.teacherExerciseStore.clearSession()
  }

  // 第25步：删除消息（题目老师场景）
  async deleteMessage(messageId: string): Promise<void> {
    await this.teacherExerciseStore.deleteMessage(messageId)
  }

  // 获取联网搜索状态
  getEnableWebSearch(): boolean {
    return this.teacherExerciseStore.enableWebSearch
  }

  // 切换联网搜索状态
  toggleWebSearch(): void {
    this.teacherExerciseStore.toggleWebSearch()
  }
}


