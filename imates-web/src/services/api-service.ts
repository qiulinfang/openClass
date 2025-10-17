/**
 * API 服务层
 * 处理所有网络请求相关的接口调用
 */

import { httpClient } from './http-client'
import { resourceManager } from './resource-manager'
import CryptoJS from 'crypto-js'
import {
  getApiUrl,
  getExerciseListUrl,
  getChatUrl,
  getDeleteExerciseUrl,
  API_ENDPOINTS,
} from './api-endpoints'
import { AndroidBridge } from './android-bridge'
// 不再需要导入fileToBase64DataUrl，直接使用传入的Base64数据 

// 使用统一类型定义
import type {
  UserInfo,
  AiChatMessageRequest,
  TextbookVersion,
  TextbookOption,
  TextbookStructureRequest,
  LearningResourcesRequest,
  ChapterNode,
  LearningPackage,
  LoginResponse,
  LoginRequest,
  LoginData,
  FeedbackTicketRequest,
  FeedbackTicketResponse,
  UserTextbookInfo,
} from '../types'

// 使用统一的类型定义，不再重复定义

export class ApiService {
  private static instance: ApiService
  private androidBridge: AndroidBridge
  
  // 连接池和请求优化
  private requestCache = new Map<string, { data: unknown, timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存
  private activeRequests = new Map<string, Promise<unknown>>() // 请求去重

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
   * 优化的请求方法，支持缓存和请求去重
   * @param url 请求URL
   * @param options 请求选项
   * @param useCache 是否使用缓存
   * @returns Promise<any>
   */
  private async optimizedRequest(
    url: string, 
    options: RequestInit = {}, 
    useCache: boolean = true
  ): Promise<unknown> {
    const cacheKey = `${url}_${JSON.stringify(options)}`
    
    // 检查缓存
    if (useCache && this.requestCache.has(cacheKey)) {
      const cached = this.requestCache.get(cacheKey)!
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`使用缓存数据: ${url}`)
        return cached.data
      } else {
        this.requestCache.delete(cacheKey)
      }
    }
    
    // 检查是否有相同的请求正在进行
    if (this.activeRequests.has(cacheKey)) {
      console.log(`等待相同请求完成: ${url}`)
      return this.activeRequests.get(cacheKey)
    }
    
    // 创建新请求
    const requestPromise = this.executeRequest(url, options)
    this.activeRequests.set(cacheKey, requestPromise)
    
    try {
      const result = await requestPromise
      
      // 缓存结果
      if (useCache) {
        this.requestCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        })
      }
      
      return result
    } finally {
      this.activeRequests.delete(cacheKey)
    }
  }

  /**
   * 执行实际的请求
   * @param url 请求URL
   * @param options 请求选项
   * @returns Promise<any>
   */
  private async executeRequest(url: string, options: RequestInit = {}): Promise<unknown> {
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
        ...options.headers
      },
      ...options
    }
    
    const response = await fetch(url, defaultOptions)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    } else {
      return response.text()
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, value] of this.requestCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.requestCache.delete(key)
      }
    }
  }

  /**
   * 暂停教材下载
   * 对应Android LearnResourceManager.pauseDownload
   */
  public async pauseDownload(id: string): Promise<boolean> {
    try {
      // 这里可以实现暂停下载的逻辑
      // 由于是Web端，可能需要通过Android Bridge调用原生方法
      console.log(`暂停下载教材: ${id}`)
      return true
    } catch (error) {
      console.error('暂停下载失败:', error)
      return false
    }
  }

  /**
   * 删除教材资源
   * 对应Android LearnResourceManager.deleteTextbook
   */
  public async deleteTextbook(id: string): Promise<boolean> {
    try {
      // 这里可以实现删除教材的逻辑
      // 由于是Web端，可能需要通过Android Bridge调用原生方法
      console.log(`删除教材: ${id}`)
      return true
    } catch (error) {
      console.error('删除教材失败:', error)
      return false
    }
  }


  /**
   * 获取资源文件下载URL
   * 对应Android LearnResourceManager.getResourceDownloadUrl
   * 🔥 修改：使用相对路径通过Vite代理，解决CORS问题
   */
  public async getResourceDownloadUrl(resourceId: string): Promise<string | null> {
    try {
      console.log(`获取资源下载URL: ${resourceId}`)
      
      // 🔥 使用相对路径，通过Vite代理转发，避免CORS问题
      // 原来的绝对URL: https://43.138.16.5:50013/resource/20250919/xxx.pdf
      // 现在使用相对路径: /resource/20250919/xxx.pdf
      // Vite代理会将 /resource/* 转发到 https://43.138.16.5:50013/resource/*
      
      // 确保resourceId以/开头
      const relativePath = resourceId.startsWith('/') ? resourceId : `/${resourceId}`
      
      console.log(`使用代理路径: ${relativePath}`)
      return relativePath
    } catch (error) {
      console.error('获取资源下载URL失败:', error)
      return null
    }
  }

  /**
   * 验证资源文件完整性
   * 对应Android LearnResourceManager.verifyResourceIntegrity
   */
  public async verifyResourceIntegrity(resourceId: string, checksum: string): Promise<boolean> {
    try {
      // 这里可以实现验证文件完整性的逻辑
      // 由于是Web端，可能需要通过Android Bridge调用原生方法
      console.log(`验证资源完整性: ${resourceId}, checksum: ${checksum}`)
      return true
    } catch (error) {
      console.error('验证资源完整性失败:', error)
      return false
    }
  }

  /**
   * 获取习题列表
   */
  public async getExerciseList(subject: string): Promise<any[]> {
    try {
      const url = getExerciseListUrl(subject)
      
      // HTTP客户端会自动根据接口路径选择合适的token
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
      
      // HTTP客户端会自动根据接口路径选择合适的token
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

      // HTTP客户端会自动根据接口路径选择合适的token
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

      // HTTP客户端会自动根据接口路径选择合适的token
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
   * 用户登录（管理员登录）
   * @param account 账号
   * @param password 密码（明文，与Android端LoginActivity保持一致）
   * @returns Promise<string> 返回token
   */
  public async loginXueban(account: string, password: string): Promise<string> {
    try {
      const response = await httpClient.post<{
        success: boolean
        message: string
        data: {
          token: string
        }
      }>(getApiUrl(API_ENDPOINTS.USER.XUEBAN_LOGIN), {
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
      // 只通过URL参数传递token，http-client会自动添加认证头
      const response = await httpClient.get<{
        success: boolean
        message: string
        data: UserInfo
      }>(`${getApiUrl(API_ENDPOINTS.USER.ADMIN_INFO)}?token=${token}`)
      
      if (!response.success || !response.data) {
        throw new Error(response.message || '获取用户信息失败')
      }

      return response.data.data
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : '获取用户信息失败')
    }
  }


  // ==================== 教材相关 API ====================

  /**
   * 学生登录 - 与Android端LearnResourceManager.login保持一致
   */
  public async loginYanban(account: string, password: string): Promise<LoginResponse | null> {
    try {
      // 使用MD5加密密码，与Android端保持一致
      const md5Password = this.md5(password)
      
      const loginRequest: LoginRequest = {
        account,
        password: md5Password
      }
      
        // 使用代理路径，避免CORS问题
        const response = await httpClient.post<{
          code: number
          success: boolean
          message: string
          data: LoginData
        }>(
          API_ENDPOINTS.LEARNING_RESOURCE.YANBAN_LOGIN,
          loginRequest
        )
      
      if (response.success && response.data && response.data.data) {
        const loginResponse: LoginResponse = {
          token: response.data.data.token,
          userId: response.data.data.userId,
          defaultPassword: response.data.data.defaultPassword
        }
        
        // 确保token和userId都保存到localStorage
        localStorage.setItem('YANBAN_TOKEN', response.data.data.token)
        localStorage.setItem('studentUserId', response.data.data.userId)
        
        // 更新登录时间戳，用于会话管理
        localStorage.setItem('lastLoginTime', Date.now().toString())
        
        console.log('学生登录成功:', loginResponse)
        return loginResponse
      } else {
        console.error('学生登录失败:', response.message)
        return null
      }
    } catch (error) {
      console.error('学生登录异常:', error)
      return null
    }
  }

  /**
   * 检查学生登录状态
   */
  public isStudentLoggedIn(): boolean {
    const token = localStorage.getItem('YANBAN_TOKEN')
    const userId = localStorage.getItem('studentUserId')
    console.log('🔍 检查学生登录状态:', { token, userId })
    return !!(token && userId && token !== 'undefined' && userId !== 'undefined' && token.trim() !== '' && userId.trim() !== '')
  }

  /**
   * 学生登出
   */
  public logoutStudent(): void {
    localStorage.removeItem('YANBAN_TOKEN')
    localStorage.removeItem('studentUserId')
    console.log('学生已登出')
  }

  /**
   * MD5加密 - 与Android端保持一致
   */
  private md5(input: string): string {
    return CryptoJS.MD5(input).toString()
  }

  /**
   * 获取教材版本列表 - 修正为与Android端一致的流程
   */
  public async getTextbookVersions(): Promise<TextbookVersion[]> {
    try {
      const endpoint = API_ENDPOINTS.LEARNING_RESOURCE.TEXTBOOK.VERSIONS
      
      const response = await httpClient.post<{
        code: number
        success: boolean
        message: string
        data: TextbookVersion[]
      }>(endpoint, {})
      
      if (response.success && response.data && response.data.data) {
        return response.data.data
      }
      return []
    } catch (error) {
      console.error('获取教材版本失败:', error)
      return []
    }
  }


  /**
   * 获取教材结构 - 修正为与Android端一致的流程
   */
  public async getTextbookStructure(id: string): Promise<ChapterNode[]> {
    try {
      const endpoint = API_ENDPOINTS.LEARNING_RESOURCE.TEXTBOOK.STRUCTURE
      
      const request: TextbookStructureRequest = { id : id }
      const response = await httpClient.post<{
        code: number
        success: boolean
        message: string
        data: ChapterNode[]
      }>(endpoint, request)
      
      if (response.success && response.data && response.data.data && response.data.data.length > 0 && response.data.data[0]?.children && response.data.data[0].children.length > 0) {
        return response.data.data[0].children
      }
      
      return []
    } catch (error) {
      console.error('获取教材结构失败:', error)
      throw error
    }
  }

  /**
   * 获取学习资源包 - 修正为与Android端一致的流程
   */
  public async getLearningResources(id: string): Promise<LearningPackage[]> {
    try {
      const endpoint = API_ENDPOINTS.LEARNING_RESOURCE.TEXTBOOK.LEARNING_PACKAGE
      
      const request: LearningResourcesRequest = { id: id }
      const response = await httpClient.post<{
        code: number
        success: boolean
        message: string
        data: LearningPackage[]
      }>(endpoint, request)
      console.log(`获取学习资源包: ${id}`, response)
      if (response.success && response.data && response.data.data) {
        // 确保每个学习包都有packageId字段
        return response.data.data.map(pkg => ({
          ...pkg,
          packageId: pkg.id // 设置packageId为id的值
        }))
      }
      return []
    } catch (error) {
      console.error('获取学习资源失败:', error)
      return []
    }
  }

  /**
   * 将教材版本转换为选择器选项
   */
  public convertToTextbookOptions(versions: TextbookVersion[]): TextbookOption[] {
    return versions.map(version => ({
      value: `${version.textbookSubjectLabel}-${version.textbookGradeLabel}-${version.textbookSemesterLabel}-${version.id}`,
      label: `${version.textbookGradeLabel} ${version.textbookSemesterLabel} ${version.textbookSubjectLabel} ${version.textbookName}`,
      textbookId: version.textbookId,
      subject: version.textbookSubjectLabel,
      grade: version.textbookGradeLabel,
      semester: version.textbookSemesterLabel,
      publisher: version.textbookPublisher,
      cover: version.textbookCover
    }))
  }

  // ========== 反馈相关API ==========

  /**
   * 创建反馈工单
   * @param title 工单标题
   * @param body 反馈内容
   * @param imageFile 附件图片文件（可选）
   * @returns Promise<void> 与Android保持一致，只依赖HTTP状态码
   */
  public async createFeedbackTicket(
    title: string, 
    body: string, 
    imageFile?: File
  ): Promise<void> {
    try {
      const requestData: FeedbackTicketRequest = {
        title,
        group: 'Users',
        customer: 'app@imates.com.cn',
        article: {
          subject: title,
          body,
          type: 'note',
          internal: false
        }
      }

      // 如果有图片附件，添加到请求中
      if (imageFile) {
        const base64Data = await this.fileToBase64(imageFile)
        const mimeType = imageFile.type || 'image/jpeg'
        
        requestData.article.attachments = [{
          filename: imageFile.name,
          data: base64Data,
          'mime-type': mimeType
        }]
      }

      // 与Android保持一致：只依赖HTTP状态码判断成功/失败
      // HTTP状态码为2xx时，axios不会抛出异常，直接返回void表示成功
      await httpClient.post<FeedbackTicketResponse>(
        `${API_ENDPOINTS.ZAMMAD.BASE_URL}/tickets`,
        requestData,
        {
          headers: {
            'Authorization': 'Token token=tOsDC4Qjw-W9zPwK93p_o2DvwxQ6lYC9o2AKUT2zP736YbExUNiiUvbHlTQYn2tk',
            'Content-Type': 'application/json'
          }
        }
      )
    } catch (error) {
      console.error('创建反馈工单失败:', error)
      // 与Android保持一致：网络异常直接抛出，不返回包装对象
      throw error
    }
  }

  /**
   * 将文件转换为Base64字符串
   * @param file 文件对象
   * @returns Promise<string> Base64字符串
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // 移除data:image/jpeg;base64,前缀
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // ========== 资源管理相关API ==========

  /**
   * 获取用户所有在线教材
   * 对应Android LearnResourceManager.fetchUserAllOnlineTextbooks
   * 使用与安卓原生一致的接口路径和认证方式
   */
  public async fetchUserAllOnlineTextbooks(): Promise<UserTextbookInfo[]> {
    try {
      const endpoint = API_ENDPOINTS.LEARNING_RESOURCE.TEXTBOOK_MANAGEMENT.FETCH_ONLINE
      const response = await httpClient.post<{
        code: number
        success: boolean
        message: string
        data: UserTextbookInfo[]
      }>(endpoint, {}, {
        headers: {
          'sa-token': localStorage.getItem('YANBAN_TOKEN') || ''
        }
      })
      
      if (response.success && response.data && response.data.data) {
        return response.data.data
      }
      return []
    } catch (error) {
      console.error('获取用户在线教材失败:', error)
      return []
    }
  }

  /**
   * 获取用户所有本地教材
   * 对应Android LearnResourceManager.loadUserAllLocalTextbooks
   * 使用与安卓原生一致的接口路径和认证方式
   */
  public async loadUserAllLocalTextbooks(): Promise<UserTextbookInfo[]> {
    try {
      const endpoint = API_ENDPOINTS.LEARNING_RESOURCE.TEXTBOOK_MANAGEMENT.LOAD_LOCAL
      const response = await httpClient.post<{
        code: number
        success: boolean
        message: string
        data: UserTextbookInfo[]
      }>(endpoint, {}, {
        headers: {
          'sa-token': localStorage.getItem('YANBAN_TOKEN') || ''
        }
      })
      
      if (response.success && response.data && response.data.data) {
        return response.data.data
      }
      return []
    } catch (error) {
      console.error('获取用户本地教材失败:', error)
      return []
    }
  }

  /**
   * 检查教材更新 - 三级对比版本
   * 对应Android LearnResourceManager.checkForUpdates
   * 实现教材→包→文件三级对比逻辑
   */
  public async checkForUpdates(): Promise<TextbookVersion[]> {
    try {
      console.log('开始三级更新检查...')
      
      // 1. 获取服务器端教材版本列表
      const serverTextbooks = await this.getTextbookVersions()
      console.log('服务器教材版本:', serverTextbooks)
      
      // 2. 获取本地教材信息
      const localTextbooks = await resourceManager.getUserLocalTextbooks()
      console.log('本地教材信息:', localTextbooks)
      
      // 3. 执行三级对比检查
      const updatedTextbooks: TextbookVersion[] = []
      
      for (const serverTextbook of serverTextbooks) {
        const localTextbook = localTextbooks.find((t: UserTextbookInfo) => t.textbookId === serverTextbook.textbookId)
        
        // 检查是否需要更新
        const needsUpdate = await this.checkTextbookUpdate(serverTextbook, localTextbook)
        
        if (needsUpdate) {
          updatedTextbooks.push(serverTextbook)
          console.log(`教材 ${serverTextbook.textbookName} 需要更新`)
        }
      }
      
      console.log(`发现 ${updatedTextbooks.length} 个教材需要更新`)
      return updatedTextbooks
      
    } catch (error) {
      console.error('检查教材更新失败:', error)
      return []
    }
  }

  /**
   * 检查单个教材是否需要更新 - 三级对比逻辑
   * 对应Android LearnResourceManager.checkTextbookUpdate
   */
  private async checkTextbookUpdate(serverTextbook: TextbookVersion, localTextbook?: UserTextbookInfo): Promise<boolean> {
    try {
      // 第一级：教材级别检查
      if (!localTextbook) {
        console.log(`教材 ${serverTextbook.textbookName} 本地不存在，需要下载`)
        return true
      }
      
      // 教材更新时间比较
      const textbookUpdated = this.isNewer(serverTextbook.textbookUpdateTime, localTextbook.textbookUpdateTime)
      if (textbookUpdated) {
        console.log(`教材 ${serverTextbook.textbookName} 教材级别已更新`)
        return true
      }
      
      // 第二级：包级别检查
      const packageUpdated = await this.checkLearningPackageUpdates(serverTextbook, localTextbook)
      if (packageUpdated) {
        console.log(`教材 ${serverTextbook.textbookName} 包级别有更新`)
        return true
      }
      
      console.log(`教材 ${serverTextbook.textbookName} 无需更新`)
      return false
      
    } catch (error) {
      console.error(`检查教材 ${serverTextbook.textbookName} 更新失败:`, error)
      return true // 出错时默认需要更新（安全策略）
    }
  }

  /**
   * 检查学习包更新
   * 对应Android LearnResourceManager.checkLearningPackageUpdates
   */
  private async checkLearningPackageUpdates(serverTextbook: TextbookVersion, localTextbook: UserTextbookInfo): Promise<boolean> {
    try {
      // 获取服务器端学习包
      const serverPackages = await this.getLearningResources(serverTextbook.id)
      
      // 获取本地学习包
      const localPackages = localTextbook.learningPackages || []
      
      for (const serverPackage of serverPackages) {
        const localPackage = localPackages.find(p => p.id === serverPackage.id)
        
        if (!localPackage) {
          console.log(`发现新学习包: ${serverPackage.packageName}`)
          return true
        }
        
        // 包更新时间比较
        if (this.isNewer(serverPackage.updateTime, localPackage.updateTime)) {
          console.log(`学习包 ${serverPackage.packageName} 已更新`)
          return true
        }
        
        // 第三级：文件级别检查
        const fileUpdated = this.hasFileUpdates(serverPackage, localPackage)
        if (fileUpdated) {
          console.log(`学习包 ${serverPackage.packageName} 文件有更新`)
          return true
        }
      }
      
      // 检查是否有包被删除
      for (const localPackage of localPackages) {
        const foundOnServer = serverPackages.some(p => p.id === localPackage.id)
        if (!foundOnServer) {
          console.log(`学习包 ${localPackage.packageName} 已被删除`)
          return true
        }
      }
      
      return false
      
    } catch (error) {
      console.error('检查学习包更新失败:', error)
      return true
    }
  }

  /**
   * 检查文件更新
   * 对应Android LearnResourceManager.hasFileUpdates
   */
  private hasFileUpdates(serverPackage: LearningPackage, localPackage: any): boolean {
    try {
      // 如果本地包没有localFiles属性，说明还没有下载过，需要更新
      if (!localPackage.localFiles || !Array.isArray(localPackage.localFiles)) {
        console.log(`学习包 ${serverPackage.packageName} 尚未下载，需要更新`)
        return true
      }
      
      // 检查服务器文件
      for (const serverFile of serverPackage.resourceList) {
        const localFile = localPackage.localFiles.find((f: any) => f.id === serverFile.id)
        
        if (!localFile) {
          console.log(`发现新文件: ${serverFile.fileName}`)
          return true
        }
        
        // 文件校验和比较
        if (serverFile.checksum !== localFile.checksum) {
          console.log(`文件 ${serverFile.fileName} 校验和不匹配`)
          return true
        }
      }
      
      // 检查是否有文件被删除
      for (const localFile of localPackage.localFiles) {
        const foundOnServer = serverPackage.resourceList.some(f => f.id === localFile.id)
        if (!foundOnServer) {
          console.log(`文件 ${localFile.fileName} 已被删除`)
          return true
        }
      }
      
      return false
      
    } catch (error) {
      console.error('检查文件更新失败:', error)
      return true
    }
  }

  /**
   * 时间比较方法
   * 对应Android LearnResourceManager.isNewer
   */
  private isNewer(newTime: string, oldTime: string): boolean {
    try {
      const newDate = new Date(newTime)
      const oldDate = new Date(oldTime)
      
      if (isNaN(newDate.getTime()) || isNaN(oldDate.getTime())) {
        console.warn('时间格式解析失败:', { newTime, oldTime })
        return true // 解析失败时默认需要更新（安全策略）
      }
      
      return newDate > oldDate
    } catch (error) {
      console.error('时间比较失败:', error)
      return true // 出错时默认需要更新（安全策略）
    }
  }

  /**
   * 下载教材资源 - 增量下载优化版本（只下载需要更新的文件）
   * 对应Android LearnResourceManager.downloadAllResources
   * 使用与安卓原生一致的接口路径和认证方式
   */
  public async downloadTextbook(textbook: UserTextbookInfo, onProgress?: (progress: number) => void): Promise<boolean> {
    try {
      console.log(`开始下载教材: ${textbook.id}`)
      
      // 1. 获取服务器端的学习资源包
      const serverPackages = await this.getLearningResources(textbook.id)
      console.log('服务器学习资源包', serverPackages)
      
      if (!serverPackages || serverPackages.length === 0) {
        console.warn(`教材 ${textbook.id} 没有可下载的资源`)
        return true // 没有资源也算成功
      }
      
      // 2. 获取本地学习资源包
      const localPackages = textbook.learningPackages || []
      console.log(`本地已有 ${localPackages.length} 个学习资源包`)
      
      // 3. 收集需要更新的文件（增量下载逻辑）
      const filesToUpdate: Array<{resource: any, pkg: any}> = []
      let totalServerFiles = 0
      
      for (const serverPackage of serverPackages) {
        if (serverPackage.resourceList && serverPackage.resourceList.length > 0) {
          totalServerFiles += serverPackage.resourceList.length
          
          // 查找对应的本地包
          const localPackage = localPackages.find(p => p.packageId === serverPackage.packageId)
          
          if (!localPackage) {
            // 新包：下载所有文件
            console.log(`发现新学习包: ${serverPackage.packageName}，将下载所有 ${serverPackage.resourceList.length} 个文件`)
            for (const resource of serverPackage.resourceList) {
              filesToUpdate.push({ resource, pkg: serverPackage })
            }
          } else {
            // 已存在的包：检查文件更新
            const localFiles = localPackage.localFiles || []
            let updatedFilesCount = 0
            
            for (const serverFile of serverPackage.resourceList) {
              const localFile = localFiles.find(f => f.id === serverFile.id)
              
              if (!localFile) {
                // 新文件
                filesToUpdate.push({ resource: serverFile, pkg: serverPackage })
                updatedFilesCount++
              } else if (serverFile.checksum !== localFile.checksum) {
                // 文件已更新（校验和不匹配）
                filesToUpdate.push({ resource: serverFile, pkg: serverPackage })
                updatedFilesCount++
              }
            }
            
            if (updatedFilesCount > 0) {
              console.log(`学习包 ${serverPackage.packageName} 有 ${updatedFilesCount} 个文件需要更新`)
            }
          }
        }
      }
      
      const filesToDownload = filesToUpdate.length
      console.log(`教材 ${textbook.id} 总计 ${totalServerFiles} 个文件，需要下载 ${filesToDownload} 个文件`)
      
      // 4. 更新教材的学习资源包信息
      textbook.learningPackages = serverPackages
      
      // 保存学习资源包到IndexedDB（使用批量更新）
      try {
        const { ResourceManager } = await import('./resource-manager')
        const resourceManager = ResourceManager.getInstance()
        const updateSuccess = await resourceManager.updateTextbookInfo(textbook, undefined, false)
        
        if (updateSuccess) {
          console.log(`教材 ${textbook.textbookName} 学习资源包保存到IndexedDB成功`)
        } else {
          console.error(`教材 ${textbook.textbookName} 学习资源包保存到IndexedDB失败`)
        }
      } catch (storageError) {
        console.error('保存学习资源包到IndexedDB失败:', storageError)
      }
      
      // 5. 设置教材的总文件数（基于服务器端文件数）
      try {
        const { ResourceManager } = await import('./resource-manager')
        const resourceManager = ResourceManager.getInstance()
        await resourceManager.setTextbookTotalFiles(textbook.textbookId, totalServerFiles)
      } catch (error) {
        console.error('设置教材总文件数失败:', error)
      }
      
      if (filesToDownload === 0) {
        console.log(`教材 ${textbook.id} 所有文件都是最新的，无需下载`)
        return true
      }
      
      // 6. 并发下载需要更新的文件
      const result = await this.downloadFilesConcurrently(filesToUpdate, filesToDownload, textbook.textbookId, onProgress)
      
      // 7. 下载完成后强制刷新所有待更新的数据到IndexedDB
      try {
        const { ResourceManager } = await import('./resource-manager')
        const resourceManager = ResourceManager.getInstance()
        await resourceManager.forceFlushPendingUpdates()
        console.log('下载完成后强制刷新IndexedDB成功')
      } catch (flushError) {
        console.error('下载完成后强制刷新IndexedDB失败:', flushError)
      }
      
      console.log(`教材 ${textbook.id} 增量下载完成，成功: ${result.successCount}/${filesToDownload}`)
      return result.successCount === filesToDownload
      
    } catch (error) {
      console.error('下载教材失败:', error)
      return false
    }
  }

  /**
   * 获取教材学习资源包 - 用于存储到UserTextbookInfo中
   * @param id 教材版本ID
   * @returns 学习资源包列表
   */
  public async getTextbookLearningPackages(id: string): Promise<LearningPackage[]> {
    try {
      return await this.getLearningResources(id)
    } catch (error) {
      console.error('获取教材学习资源包失败:', error)
      return []
    }
  }

  /**
   * 更新学习包的本地文件信息
   * @param textbookId 教材ID
   * @param packageId 学习包ID
   * @param resource 资源文件信息
   * @param fileSize 文件大小
   * @param immediate 是否立即更新到IndexedDB（默认false，使用批量更新）
   */
  private async updateLocalFileInfo(textbookId: string, packageId: string, resource: any, fileSize: number, immediate: boolean = false): Promise<void> {
    try {
      const { ResourceManager } = await import('./resource-manager')
      const resourceManager = ResourceManager.getInstance()
      
      // 获取教材信息
      const textbook = await resourceManager.getTextbookInfo(textbookId)
      if (!textbook) {
        console.error(`教材 ${textbookId} 不存在`)
        return
      }
      
      // 查找对应的学习包
      const packageIndex = textbook.learningPackages.findIndex(p => p.packageId === packageId)
      if (packageIndex === -1) {
        console.error(`学习包 ${packageId} 不存在`)
        return
      }
      
      // 初始化localFiles数组
      if (!textbook.learningPackages[packageIndex].localFiles) {
        textbook.learningPackages[packageIndex].localFiles = []
      }
      
      // 查找或创建本地文件信息
      const localFileIndex = textbook.learningPackages[packageIndex].localFiles.findIndex(f => f.id === resource.id)
      
      const localFileInfo = {
        id: resource.id,
        fileName: resource.fileName,
        fileSize: fileSize,
        checksum: resource.checksum,
        isDownloaded: true,
        localPath: `${textbookId}/${packageId}/${resource.fileName}`
      }
      
      if (localFileIndex === -1) {
        // 添加新的本地文件信息
        textbook.learningPackages[packageIndex].localFiles.push(localFileInfo)
      } else {
        // 更新现有的本地文件信息
        textbook.learningPackages[packageIndex].localFiles[localFileIndex] = localFileInfo
      }
      
      // 保存更新后的教材信息（使用批量更新）
      await resourceManager.updateTextbookInfo(textbook, undefined, immediate)
      console.log(`✅ 更新学习包 ${packageId} 的本地文件信息: ${resource.fileName}`)
      
    } catch (error) {
      console.error('更新本地文件信息失败:', error)
    }
  }

  /**
   * 解析文件名中的章节顺序
   * @param fileName 文件名
   * @returns 章节顺序数字
   */
  private parseChapterOrderFromFileName(fileName: string): number {
    // 常见的章节命名模式
    const patterns = [
      // 模式1: 第X章、第X节、第X课
      /第(\d+)[章节课]/,
      // 模式2: Chapter X、ChapterX
      /Chapter\s*(\d+)/i,
      // 模式3: 纯数字开头
      /^(\d+)/,
      // 模式4: 数字-数字格式 (如: 1-1, 2-3)
      /^(\d+)-\d+/,
      // 模式5: 数字.数字格式 (如: 1.1, 2.3)
      /^(\d+)\.\d+/,
      // 模式6: 数字_数字格式 (如: 1_1, 2_3)
      /^(\d+)_\d+/,
      // 模式7: 数字-数字-数字格式 (如: 1-1-1)
      /^(\d+)-\d+-\d+/,
      // 模式8: 数字.数字.数字格式 (如: 1.1.1)
      /^(\d+)\.\d+\.\d+/,
      // 模式9: 数字_数字_数字格式 (如: 1_1_1)
      /^(\d+)_\d+_\d+/,
      // 模式10: 中文数字 (一、二、三等)
      /[一二三四五六七八九十百千万]+/,
    ]
    
    for (let i = 0; i < patterns.length; i++) {
      const match = fileName.match(patterns[i])
      if (match) {
        if (i === 9) {
          // 中文数字转换
          return this.convertChineseNumberToArabic(match[0])
        } else {
          return parseInt(match[1], 10)
        }
      }
    }
    
    // 如果没有匹配到任何模式，返回一个很大的数字，排在最后
    return 9999
  }

  /**
   * 中文数字转阿拉伯数字
   * @param chineseNum 中文数字
   * @returns 阿拉伯数字
   */
  private convertChineseNumberToArabic(chineseNum: string): number {
    // 简单的转换逻辑，可以根据需要扩展
    if (chineseNum === '一') return 1
    if (chineseNum === '二') return 2
    if (chineseNum === '三') return 3
    if (chineseNum === '四') return 4
    if (chineseNum === '五') return 5
    if (chineseNum === '六') return 6
    if (chineseNum === '七') return 7
    if (chineseNum === '八') return 8
    if (chineseNum === '九') return 9
    if (chineseNum === '十') return 10
    
    return 9999
  }

  /**
   * 并发下载文件列表 - 优化版本
   * @param allResources 所有资源文件列表
   * @param totalFiles 总文件数
   * @param textbookId 教材ID
   * @param onProgress 进度回调
   */
  private async downloadFilesConcurrently(
    allResources: Array<{resource: any, pkg: any}>, 
    totalFiles: number, 
    textbookId: string,
    onProgress?: (progress: number) => void
  ): Promise<{successCount: number, errorCount: number}> {
    
    // 并发下载配置
    const CONCURRENT_DOWNLOADS = 6 // 最多3个并发下载，与安卓端保持一致
    const downloadQueue = [...allResources]
    const results: Array<{success: boolean, fileName: string}> = []
    let completedFiles = 0
    let successCount = 0
    let errorCount = 0
    
    // 进度跟踪优化
    const fileProgressMap = new Map<string, number>() // 跟踪每个文件的下载进度
    let lastProgressUpdate = 0
    const PROGRESS_UPDATE_INTERVAL = 100 // 100ms更新一次进度
    
    // 更新整体进度的函数 - 优化版本（基于实际需要下载的文件数）
    const updateOverallProgress = () => {
      const now = Date.now()
      if (now - lastProgressUpdate < PROGRESS_UPDATE_INTERVAL) return
      
      let totalProgress = 0
      for (const progress of fileProgressMap.values()) {
        totalProgress += progress
      }
      
      // 计算整体进度：基于实际需要下载的文件数
      // 如果totalFiles为0（没有文件需要下载），直接返回100%
      if (totalFiles === 0) {
        onProgress?.(100)
        return
      }
      
      // 计算整体进度：(已完成文件数 * 100 + 当前文件总进度) / 需要下载的文件数
      const overallProgress = Math.round((totalProgress / totalFiles))
      onProgress?.(Math.min(overallProgress, 100))
      lastProgressUpdate = now
    }
    
    // 创建下载任务
    const downloadTask = async (resourceInfo: {resource: any, pkg: any}) => {
      const { resource, pkg } = resourceInfo
      const fileId = resource.fileName
      
      try {
        console.log(`开始下载文件: ${resource.fileName}`)
        
        // 初始化文件进度
        fileProgressMap.set(fileId, 0)
        
        // 使用流式下载减少内存占用
        const fileData = await this.downloadSingleFileStreaming(resource, (fileProgress) => {
          // 更新单个文件进度
          fileProgressMap.set(fileId, fileProgress)
          updateOverallProgress()
        })
        
        if (fileData) {
          console.log(`文件下载完成: ${resource.fileName}`)
          
          // 保存文件二进制数据到IndexedDB
          try {
            const { ResourceManager } = await import('./resource-manager')
            const resourceManager = ResourceManager.getInstance()
            
            // 解析章节顺序
            const chapterOrder = this.parseChapterOrderFromFileName(resource.fileName)
            
            // 构建文件信息
            const fileInfo = {
              id: `${textbookId}_${resource.fileName}`, // 使用教材ID+文件名作为唯一ID
              textbookId: textbookId, // 使用传入的教材ID
              packageId: pkg.packageId,
              fileName: resource.fileName,
              fileType: resource.fileType || 'unknown',
              fileSize: fileData.length,
              checksum: resource.checksum,
              chapterOrder: chapterOrder,
              sortOrder: chapterOrder
            }
            // 保存文件数据（使用批量更新）
            await resourceManager.storeFileData(fileInfo, fileData, false)
            
            // 更新学习包的本地文件信息（使用批量更新）
            await this.updateLocalFileInfo(textbookId, pkg.packageId, resource, fileData.length, false)
            
            console.log(`✅ 文件数据已保存到IndexedDB: ${resource.fileName}`)
          } catch (storageError) {
            console.error(`❌ 保存文件数据失败: ${resource.fileName}`, storageError)
            // 即使存储失败，也认为下载成功，但记录错误
          }
          
          results.push({ success: true, fileName: resource.fileName })
          successCount++
        } else {
          console.error(`文件下载失败: ${resource.fileName}`)
          results.push({ success: false, fileName: resource.fileName })
          errorCount++
        }
        
      } catch (error) {
        console.error(`下载文件 ${resource.fileName} 时出错:`, error)
        results.push({ success: false, fileName: resource.fileName })
        errorCount++
      } finally {
        // 清理进度跟踪
        fileProgressMap.delete(fileId)
        completedFiles++
        
        // 最终进度更新
        const progress = Math.round((completedFiles / totalFiles) * 100)
        onProgress?.(progress)
      }
    }
    
    // 并发执行下载任务
    const downloadPromises: Promise<void>[] = []
    
    for (let i = 0; i < Math.min(CONCURRENT_DOWNLOADS, downloadQueue.length); i++) {
      const resourceInfo = downloadQueue.shift()
      if (resourceInfo) {
        downloadPromises.push(downloadTask(resourceInfo))
      }
    }
    
    // 继续处理剩余文件
    while (downloadQueue.length > 0) {
      // 等待至少一个任务完成
      await Promise.race(downloadPromises.filter(p => p))
      
      // 移除已完成的任务，添加新任务
      const newResource = downloadQueue.shift()
      if (newResource) {
        downloadPromises.push(downloadTask(newResource))
      }
    }
    
    // 等待所有任务完成
    await Promise.all(downloadPromises)
    
    return { successCount, errorCount }
  }

  /**
   * 下载单个文件（纯网络下载，不处理存储）
   * 对应Android LearnResourceManager.downloadFile
   */
  private async downloadSingleFile(
    resource: { fileName: string; fileUrl: string; checksum?: string }, 
    localPath: string, 
    onProgress?: (progress: number) => void
  ): Promise<Uint8Array | null> {
    try {
      console.log('下载文件', resource)
      
      // 获取完整的下载URL
      const downloadUrl = await this.getResourceDownloadUrl(resource.fileUrl)
      if (!downloadUrl) {
        throw new Error('无法获取下载URL')
      }
      
      // 使用fetch下载文件
      const response = await fetch(downloadUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const contentLength = response.headers.get('content-length')
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
      
      if (!response.body) {
        throw new Error('响应体为空')
      }
      
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let downloadedBytes = 0
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        chunks.push(value)
        downloadedBytes += value.length
        
        if (totalBytes > 0 && onProgress) {
          const progress = Math.round((downloadedBytes / totalBytes) * 100)
          onProgress(progress)
        }
      }
      
      // 合并所有chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      
      console.log(`文件 ${resource.fileName} 下载完成，大小: ${result.length} bytes`)
      
      // 如果提供了校验和，验证文件完整性
      if (resource.checksum) {
        console.log(`开始校验文件 ${resource.fileName}，期望校验和: ${resource.checksum}`)
        try {
          const { ResourceManager } = await import('./resource-manager')
          const resourceManager = ResourceManager.getInstance()
          const isValid = await resourceManager.verifyLocalFileIntegrity(result, resource.checksum)
          if (!isValid) {
            console.error(`文件 ${resource.fileName} 校验失败，期望: ${resource.checksum}`)
            throw new Error(`文件校验失败: ${resource.fileName}`)
          }
          console.log(`文件 ${resource.fileName} 校验通过`)
        } catch (verifyError) {
          console.error(`文件 ${resource.fileName} 校验过程出错:`, verifyError)
          throw verifyError
        }
      } else {
        console.log(`文件 ${resource.fileName} 没有提供校验和，跳过校验`)
      }
      
      return result
      
    } catch (error) {
      console.error(`下载文件失败 ${resource.fileName}:`, error)
      return null
    }
  }

  /**
   * 流式下载单个文件（优化内存使用）
   * 对应Android LearnResourceManager.downloadFile
   * 使用流式处理减少内存占用
   */
  private async downloadSingleFileStreaming(
    resource: { fileName: string; fileUrl: string; checksum?: string }, 
    onProgress?: (progress: number) => void
  ): Promise<Uint8Array | null> {
    try {
      console.log('流式下载文件', resource)
      
      // 获取完整的下载URL
      const downloadUrl = await this.getResourceDownloadUrl(resource.fileUrl)
      if (!downloadUrl) {
        throw new Error('无法获取下载URL')
      }
      
      // 使用优化的fetch配置
      const controller = new AbortController()
      const response = await fetch(downloadUrl, {
        signal: controller.signal,
        headers: {
          'Accept-Encoding': 'gzip, deflate', // 启用压缩
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive' // 保持连接
        },
        // 优化网络配置
        keepalive: true,
        mode: 'cors'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const contentLength = response.headers.get('content-length')
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
      
      if (!response.body) {
        throw new Error('响应体为空')
      }
      
      // 使用流式处理，避免将所有数据加载到内存
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let downloadedBytes = 0
      
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          // 直接存储chunk，不进行额外处理
          chunks.push(value)
          downloadedBytes += value.length
          
          // 更新进度
          if (totalBytes > 0 && onProgress) {
            const progress = Math.round((downloadedBytes / totalBytes) * 100)
            onProgress(progress)
          }
          
          // 如果文件太大，可以考虑分块处理
          if (chunks.length > 1000) { // 防止chunks数组过大
            console.warn(`文件 ${resource.fileName} 过大，可能需要优化处理`)
          }
        }
      } finally {
        reader.releaseLock()
      }
      
      // 高效合并chunks
      const result = this.mergeChunksEfficiently(chunks)
      
      console.log(`文件 ${resource.fileName} 下载完成，大小: ${result.length} bytes`)
      
      // 如果提供了校验和，验证文件完整性
      if (resource.checksum) {
        console.log(`开始校验文件 ${resource.fileName}，期望校验和: ${resource.checksum}`)
        try {
          const { ResourceManager } = await import('./resource-manager')
          const resourceManager = ResourceManager.getInstance()
          const isValid = await resourceManager.verifyLocalFileIntegrity(result, resource.checksum)
          if (!isValid) {
            console.error(`文件 ${resource.fileName} 校验失败，期望: ${resource.checksum}`)
            throw new Error(`文件校验失败: ${resource.fileName}`)
          }
          console.log(`文件 ${resource.fileName} 校验通过`)
        } catch (verifyError) {
          console.error(`文件 ${resource.fileName} 校验过程出错:`, verifyError)
          throw verifyError
        }
      }
      
      return result
      
    } catch (error) {
      console.error(`下载文件 ${resource.fileName} 失败:`, error)
      return null
    }
  }

  /**
   * 高效合并Uint8Array chunks
   * 优化内存使用和性能
   */
  private mergeChunksEfficiently(chunks: Uint8Array[]): Uint8Array {
    if (chunks.length === 0) {
      return new Uint8Array(0)
    }
    
    if (chunks.length === 1) {
      return chunks[0]
    }
    
    // 计算总长度
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    
    // 创建结果数组
    const result = new Uint8Array(totalLength)
    let offset = 0
    
    // 批量复制，减少循环开销
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    
    return result
  }


  /**
   * 自动登录功能
   * 从localStorage获取保存的用户凭据并尝试登录
   * @param enableLogging 是否启用详细日志输出，默认为false
   * @returns Promise<boolean> 登录是否成功
   */
  async autoLogin(enableLogging: boolean = false): Promise<boolean> {
    try {
      // 从localStorage获取用户凭据
      const userId = localStorage.getItem('userId')
      const password = localStorage.getItem('userPassword')
      
      if (!userId || !password || userId === 'undefined' || password === 'undefined' || userId.trim() === '' || password.trim() === '') {
        if (enableLogging) {
          console.warn('没有找到保存的用户凭据')
        }
        return false
      }
      
      if (enableLogging) {
        console.log('找到保存的用户凭据，尝试自动登录...')
      }
      
      // 使用apiService进行登录
      const loginResult = await this.loginYanban(userId, password)
      if (!loginResult) {
        if (enableLogging) {
          console.error('自动登录失败')
        }
        return false
      }
      
      if (enableLogging) {
        console.log('自动登录成功:', loginResult)
      }
      
      // 更新登录时间戳
      localStorage.setItem('lastLoginTime', Date.now().toString())
      
      return true
    } catch (error) {
      if (enableLogging) {
        console.error('自动登录异常:', error)
      }
      return false
    }
  }

}

// 创建默认的 API 服务实例
export const apiService = ApiService.getInstance()
