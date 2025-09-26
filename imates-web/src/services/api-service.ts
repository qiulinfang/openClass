/**
 * API 服务层
 * 处理所有网络请求相关的接口调用
 */

import { httpClient } from './http-client'
import {
  getApiUrl,
  getExerciseListUrl,
  getChatUrl,
  getDeleteExerciseUrl,
  API_ENDPOINTS,
} from './api-endpoints'
import { AndroidBridge } from './android-bridge'
import { mockChatService } from './mock-chat-service'
// 不再需要导入fileToBase64DataUrl，直接使用传入的Base64数据 

// 使用统一类型定义
import type {
  ExerciseItem,
  UserInfo,
  ChatResponse,
  SimilarExercise,
  BridgeProgressData,
  ChatMessageSession,
  ConversationRecord,
  AiChatMessageRequest,
  EnvType,
} from '../types'

// 使用统一的类型定义，不再重复定义

export class ApiService {
  private static instance: ApiService
  private androidBridge: AndroidBridge
  private testMode: boolean = false

  private constructor() {
    this.androidBridge = AndroidBridge.getInstance()
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService()
    }
    return ApiService.instance
  }

  /**
   * 设置测试模式
   */
  public setTestMode(enabled: boolean): void {
    this.testMode = enabled
    console.log('🧪 API服务测试模式:', enabled ? '开启' : '关闭')
  }

  /**
   * 获取测试模式状态
   */
  public isTestMode(): boolean {
    return this.testMode
  }

  /**
   * 获取习题列表
   */
  public async getExerciseList(subject: string): Promise<any[]> {
    try {
      const url = getExerciseListUrl(subject)
      const response = await httpClient.get<{
        success: boolean
        data: {
          questionsList: any[]
        }
      }>(url)

      if (response.success && response.data?.data?.questionsList) {
        return response.data.data.questionsList
      }
      return []
    } catch (error) {
      return []
    }
  }

  /**
   * 删除习题
   */
  public async deleteExercise(exerciseId: string, subject: string): Promise<boolean> {
    try {
      const url = getDeleteExerciseUrl(exerciseId, subject)
      const response = await httpClient.delete(url)
      return response.success
    } catch (error) {
      return false
    }
  }

  /**
   * 添加题目到列表
   */
  public async addQuestionToList(questionData: any, subject: string): Promise<boolean> {
    try {
      const url = getApiUrl(API_ENDPOINTS.EXERCISES.ADD)

      // 构造与Android AddQuestionRequest一致的请求体
      const requestBody = {
        bmNo: questionData.bmNo || questionData.id,
        type: subject.toLowerCase(),
        exercisesId: questionData.exercisesId || '',
        ...questionData,
      }

      const response = await httpClient.post(url, requestBody)
      return response.success
    } catch (error) {
      return false
    }
  }

  /**
   * 查找相似题目
   */
  public async findSimilarQuestions(questionData: any, subject: string): Promise<any[]> {
    try {
      const url = getApiUrl(API_ENDPOINTS.EXERCISES.SIMILAR)

      // 构造与Android FindSimilarQuestionRequest一致的请求体
      const requestBody = {
        bmNo: questionData.bmNo || questionData.id,
        title: questionData.title || questionData.question,
        answer: questionData.answer || '',
        explanation: questionData.explanation || questionData.aiExplanation || '',
        analysisData: questionData.analysisData || questionData.answerAnalysis || '',
        exercisesId: questionData.exercisesId || '',
        type: subject.toLowerCase(),
      }

      const response = await httpClient.post<{
        success: boolean
        data: {
          questions: any[]
        }
      }>(url, requestBody)

      if (response.success && response.data?.data?.questions) {
        return response.data.data.questions
      }
      return []
    } catch (error) {
      return []
    }
  }

  /**
   * 根据知识点查找相似题目
   * 对应Android中的findSimilarKnowledgeQuestion方法
   */
  public async findSimilarQuestionsByKnowledge(request: any): Promise<{
    questions: any[]
    totalCount: number
    currentPage: number
    pageSize: number
  }> {
    try {
      const url = getApiUrl(API_ENDPOINTS.EXERCISES.SIMILAR_BY_KNOWLEDGE)
      
      const response = await httpClient.post<{
        success: boolean
        totalCount?: string
        pageNo?: string
        pageSize?: string
        data: {
          questions: any[]
        }
      }>(url, request)
      
      if (response.success && response.data?.data?.questions) {
        return {
          questions: response.data.data.questions,
          totalCount: parseInt(response.data.totalCount || '0') || response.data.data.questions.length,
          currentPage: parseInt(response.data.pageNo || '1') || request.current,
          pageSize: parseInt(response.data.pageSize || '5') || request.size
        }
      }
      return {
        questions: [],
        totalCount: 0,
        currentPage: request.current,
        pageSize: request.size
      }
    } catch (error) {
      console.error('查找相似题目失败:', error)
      return {
        questions: [],
        totalCount: 0,
        currentPage: request.current,
        pageSize: request.size
      }
    }
  }

  /**
   * 发送聊天消息至 AI（基于轮询机制实现打字机效果）
   */
  public async sendChatMessage(
    message: AiChatMessageRequest,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
  ): Promise<any> {
    try {
      // 测试模式：使用模拟聊天服务
      if (this.testMode) {
        console.log('🧪 测试模式：使用模拟聊天服务发送消息')
        return await mockChatService.simulateSendMessage(message, onComplete, onStream, true)
      }

      // 确定请求URL：优先使用message中的dstUrl，否则根据科目动态生成
      let url: string
      if (message.dstUrl) {
        // 如果指定了dstUrl，使用它来构造完整的请求URL
        url = getApiUrl(message.dstUrl)
      } else {
        // 回退到原有逻辑：根据bmNo中的科目信息确定URL
        const subject = this.extractSubjectFromBmNo(message.bmNo)
        url = getChatUrl(subject)
      }

      // 开始轮询聊天
      return await this.pollChatMessage(message, url, onComplete, onStream)
    } catch (error) {
      const errorResult = {
        success: false,
        messageId: '',
        reply: '发送消息失败: ' + (error as Error).message,
        timestamp: Date.now(),
      }

      if (onComplete) {
        onComplete(errorResult)
      }

      return errorResult
    }
  }

  /**
   * 轮询聊天消息 - 主流程控制函数
   * 负责协调整个轮询过程，包括请求发送、响应处理和错误处理
   * 模拟Android端的轮询机制
   */
  private async pollChatMessage(
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = 'ai_' + Date.now(),
  ): Promise<any> {
    try {
      // 1. 构建请求体
      const requestBody = this.buildChatRequestBody(message)
      
      // 2. 发送HTTP请求
      const response = await this.sendChatRequest(url, requestBody)
      
      // 3. 处理响应
      return await this.handleChatResponse(
        response,
        message,
        url,
        onComplete,
        onStream,
        accumulatedContent,
        messageId
      )
    } catch (error) {
      // 4. 处理异常
      return this.handleChatError(error, messageId, accumulatedContent, onComplete, onStream)
    }
  }

  /**
   * 构建聊天请求体
   * 将消息对象转换为与Android端一致的请求格式
   */
  private buildChatRequestBody(message: AiChatMessageRequest) {
    return {
      sessionId: message.sessionId,
      newValue: message.newValue,
      coversation: message.coversation,
      question: message.question,
      answer: message.answer,
      name: message.name,
      reason: message.reason, // "start" 或 "continue"
      bmNo: message.bmNo,
      isWebSearch: message.isWebSearch,
      role: message.chatRole,
    }
  }

  /**
   * 发送聊天请求
   * 执行HTTP POST请求并返回响应
   * 禁用HTTP层自动重试，由上层业务逻辑控制重试
   */
  private async sendChatRequest(url: string, requestBody: any) {
    return await httpClient.post<{
      success: boolean
      message: string
      sessionId: string
    }>(url, requestBody, {
      retries: 0, // 禁用HTTP层自动重试，避免与业务层重试冲突
      timeout: 10000 // 设置10秒超时
    })
  }

  /**
   * 处理聊天响应
   * 根据响应内容决定是结束轮询、继续轮询还是处理错误
   */
  private async handleChatResponse(
    response: any,
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = 'ai_' + Date.now(),
  ): Promise<any> {
    // 检查响应是否成功
    if (!response.success || !response.data) {
      return this.createErrorResult(messageId, accumulatedContent || '请求失败，请重试。', onComplete, onStream)
    }

    const chunk = response.data.message || ''
    const trimmedChunk = chunk.trim()

    // 根据响应内容类型进行处理
    if (trimmedChunk === 'end') {
      // 轮询结束 - 返回最终结果
      return this.handlePollingEnd(messageId, accumulatedContent, response.data.sessionId, message.sessionId, onComplete, onStream)
    } else if (trimmedChunk !== '') {
      // 有新内容 - 累积内容并继续轮询
      return this.handleNewContent(chunk, message, url, onComplete, onStream, accumulatedContent, messageId)
    } else {
      // 空内容但未结束 - 继续轮询
      return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId)
    }
  }

  /**
   * 处理轮询结束
   * 当收到"end"信号时，返回最终结果
   */
  private handlePollingEnd(
    messageId: string,
    accumulatedContent: string,
    responseSessionId: string,
    messageSessionId: string,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
  ) {
    // 发送完成信号
    if (onStream) {
      onStream('', true)
    }

    const finalResult = {
      success: true,
      messageId,
      reply: accumulatedContent,
      sessionId: responseSessionId || messageSessionId,
      timestamp: Date.now(),
    }

    if (onComplete) {
      onComplete(finalResult)
    }

    return finalResult
  }

  /**
   * 处理新内容
   * 当收到新内容时，累积内容并继续轮询
   */
  private async handleNewContent(
    chunk: string,
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = 'ai_' + Date.now(),
  ) {
    const newAccumulatedContent = accumulatedContent + chunk

    // 发送流式数据
    if (onStream) {
      onStream(chunk, false)
    }

    // 设置为继续轮询并递归调用
    const continueMessage = { ...message, reason: 'continue' }
    return await this.pollChatMessage(
      continueMessage,
      url,
      onComplete,
      onStream,
      newAccumulatedContent,
      messageId,
    )
  }

  /**
   * 处理空内容
   * 当收到空内容但未结束时，继续轮询
   */
  private async handleEmptyContent(
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = 'ai_' + Date.now(),
  ) {
    const continueMessage = { ...message, reason: 'continue' }
    return await this.pollChatMessage(
      continueMessage,
      url,
      onComplete,
      onStream,
      accumulatedContent,
      messageId,
    )
  }

  /**
   * 处理聊天错误
   * 统一处理网络错误和其他异常情况
   */
  private handleChatError(
    error: any,
    messageId: string,
    accumulatedContent: string,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
  ) {
    const errorMessage = accumulatedContent || '网络错误: ' + (error as Error).message
    return this.createErrorResult(messageId, errorMessage, onComplete, onStream)
  }

  /**
   * 创建错误结果
   * 统一创建错误响应格式
   */
  private createErrorResult(
    messageId: string,
    errorMessage: string,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
  ) {
    const errorResult = {
      success: false,
      messageId,
      reply: errorMessage,
      timestamp: Date.now(),
    }

    // 发送完成信号
    if (onStream) {
      onStream('', true)
    }

    if (onComplete) {
      onComplete(errorResult)
    }

    return errorResult
  }

  /**
   * 从bmNo中提取科目信息
   */
  private extractSubjectFromBmNo(bmNo: string): string {
    // 可以根据bmNo的前缀或其他规则推断科目
    // 这里简化处理，默认返回数学
    if (bmNo && bmNo.toLowerCase().includes('bio')) {
      return 'biology'
    }
    return 'math'
  }

  /**
   * 发送消息给老师
   */
  public async sendMessageToTeacher(
    message: import('../types').BridgeChatMessageData,
  ): Promise<any> {
    try {
      const response = await httpClient.post<{
        messageId?: string
        status?: string
      }>('/api/chat/teacher', message)
      return {
        success: response.success,
        messageId: response.data?.messageId || 'api_' + Date.now(),
        status: response.data?.status || '消息已发送',
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        success: false,
        messageId: '',
        status: '发送失败: ' + (error as Error).message,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * 创建老师对话会话
   */
  public async createTeacherChatSession(
    aiSessionId: string,
    aiSessionName: string,
    subject: string,
  ): Promise<any | null> {
    try {
      // 使用AndroidBridge封装方法
      if (typeof window !== 'undefined' && window.AndroidBridge?.createTeacherChatSession) {
        const result = this.androidBridge.createTeacherChatSession(aiSessionId, aiSessionName, subject)
        
        console.log('🔍 API创建老师会话 - AndroidBridge返回结果:', result)
        
        // AndroidBridge已经解析了JSON，直接返回data部分
        if (result && result.data) {
          console.log('🔍 API创建老师会话 - 返回真实会话数据:', result.data)
          return result.data
        } else {
          console.log('🔍 API创建老师会话 - 没有有效数据，返回null')
          return null
        }
      }

      return null
    } catch (error) {
      console.log('🔍 API创建老师会话 - 发生错误:', error)
      return null
    }
  }

  /**
   * 发送文本消息给老师
   */
  public async sendTextMessageToTeacher(
    content: string,
    sessionId: string,
    subject: string,
  ): Promise<boolean> {
    console.log('🔍 API发送文本消息给老师 - 开始', {
      content: content.substring(0, 50) + '...',
      sessionId,
      subject,
      hasAndroidBridge: !!(typeof window !== 'undefined' && window.AndroidBridge?.sendTextMessageToTeacher)
    })

    try {
      // 使用AndroidBridge封装方法
      if (typeof window !== 'undefined' && window.AndroidBridge?.sendTextMessageToTeacher) {
        console.log('🔍 API发送文本消息给老师 - 调用AndroidBridge封装方法')
        const result = this.androidBridge.sendTextMessageToTeacher(content, sessionId, subject)
        console.log('🔍 API发送文本消息给老师 - AndroidBridge封装方法返回结果', {
          result,
          resultType: typeof result
        })
        return result
      }

      console.log('🔍 API发送文本消息给老师 - AndroidBridge不可用')
      return false
    } catch (error) {
      console.log('🔍 API发送文本消息给老师 - 发生错误', error)
      return false
    }
  }

  /**
   * 发送语音消息给老师
   */
  public async sendVoiceMessageToTeacher(
    voicePath: string,
    duration: string,
    sessionId: string,
    subject: string,
  ): Promise<boolean> {
    try {
      // 使用AndroidBridge封装方法
      if (typeof window !== 'undefined' && window.AndroidBridge?.sendVoiceMessageToTeacher) {
        const result = this.androidBridge.sendVoiceMessageToTeacher(voicePath, duration, sessionId, subject)
        return result
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * 发送图片消息给老师
   */
  public async sendPictureToTeacher(
    imagePath: string,
    sessionId: string,
    subject: string,
  ): Promise<boolean> {
    try {
      // 使用AndroidBridge封装方法
      if (typeof window !== 'undefined' && window.AndroidBridge?.sendPictureToTeacher) {
        const result = this.androidBridge.sendPictureToTeacher(imagePath, sessionId, subject)
        return result
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * 转发AI对话记录给老师
   */
  public async forwardAiChatToTeacher(
    selectedMessagesData: string,
    teacherSessionId: string,
  ): Promise<boolean> {
    try {
      // 使用AndroidBridge封装方法
      if (typeof window !== 'undefined' && window.AndroidBridge?.forwardAiChatToTeacher) {
        const result = this.androidBridge.forwardAiChatToTeacher(selectedMessagesData, teacherSessionId)
        return result
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * 获取老师会话的消息历史
   */
  public async getTeacherChatHistory(sessionId: string): Promise<any[]> {
    try {
      // 使用AndroidBridge封装方法
      if (typeof window !== 'undefined' && window.AndroidBridge?.getTeacherChatHistory) {
        const result = this.androidBridge.getTeacherChatHistory(sessionId)
        return result
      }

      return []
    } catch (error) {
      return []
    }
  }

  /**
   * 检查老师会话是否存在
   */
  public async checkTeacherSessionExists(sessionId: string): Promise<boolean> {
    try {
      // 使用AndroidBridge封装方法
      if (typeof window !== 'undefined' && window.AndroidBridge?.checkTeacherSessionExists) {
        const result = this.androidBridge.checkTeacherSessionExists(sessionId)
        return result
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * 获取当前会话的消息数量
   */
  public async getCurrentSessionMessageCount(sessionId: string): Promise<number> {
    try {
      // 使用AndroidBridge封装方法
      if (typeof window !== 'undefined' && window.AndroidBridge?.getCurrentSessionMessageCount) {
        const result = this.androidBridge.getCurrentSessionMessageCount(sessionId)
        return result
      }

      return 0
    } catch (error) {
      return 0
    }
  }

  /**
   * 保存学习进度
   */
  public async saveExerciseProgress(progress: any): Promise<boolean> {
    try {
      const response = await httpClient.post('/api/progress', progress)
      return response.success
    } catch (error) {
      return false
    }
  }

  /**
   * 用户登录
   * @param account 账号
   * @param password 密码（明文，与Android端LoginActivity保持一致）
   * @returns Promise<string> 返回token
   */
  public async login(account: string, password: string): Promise<string> {
    try {
      const response = await httpClient.post<{
        success: boolean
        message: string
        data: {
          token: string
        }
      }>('http://www.imates.com.cn:8222/blw-edu-service-alc/admin/login', {
        account,
        password
      })
      
      if (!response.success || !response.data) {
        throw new Error(response.message || '登录失败')
      }

      return response.data.data.token
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : '登录失败')
    }
  }

  /**
   * 获取用户信息
   * @param token 用户token
   * @returns Promise<UserInfo> 用户信息
   */
  public async getUserInfo(token: string): Promise<UserInfo> {
    try {
      const response = await httpClient.get<{
        success: boolean
        message: string
        data: UserInfo
      }>('http://www.imates.com.cn:8222/blw-edu-service-alc/admin/info', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.success || !response.data) {
        throw new Error(response.message || '获取用户信息失败')
      }

      return response.data.data
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : '获取用户信息失败')
    }
  }

  // ==================== 测试相关方法 ====================

  /**
   * 生成测试聊天历史记录
   */
  public generateTestChatHistory(questionId: string, messageCount: number = 10): any {
    return mockChatService.generateTestChatData(questionId)
  }

  /**
   * 启动自动回复测试
   */
  public startAutoReplyTest(
    questionId: string,
    onNewMessage: (message: any) => void,
    interval: number = 10000
  ): () => void {
    return mockChatService.startAutoReply(questionId, onNewMessage, interval)
  }

  /**
   * 生成模拟用户消息
   */
  public generateMockUserMessage(): string {
    return mockChatService.generateMockUserMessage()
  }

  /**
   * 生成模拟AI回复
   */
  public generateMockResponse(subject: 'math' | 'biology' | 'general' = 'general'): string {
    return mockChatService.generateMockResponse(subject)
  }
}

// 创建默认的 API 服务实例
export const apiService = ApiService.getInstance()
