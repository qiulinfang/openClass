/**
 * API 服务层
 * 处理所有网络请求相关的接口调用
 */

import { httpClient } from './http-client'
import { resourceManager, ResourceManager } from './resource-storage'
import CryptoJS from 'crypto-js'
import { authStorageService } from './auth-storage-service'
import {
  getApiUrl,
  getExerciseListUrl,
  getDeleteExerciseUrl,
  API_ENDPOINTS,
} from './api-endpoints'
import { AndroidBridge } from './android-bridge'
import { generateUniqueId } from '../stores/utils/chatStoreUtils'
// 不再需要导入fileToBase64DataUrl，直接使用传入的Base64数据 

// 章节相关工具函数
import { parseChapterOrderFromFileName as parseChapterOrderFromFileNameUtil } from '../utils/business/chapter-utils'

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
  XuebanLoginResponse,
  FeedbackTicketRequest,
  FeedbackTicketResponse,
  UserTextbookInfo,
  ResourceFile,
  LocalFileInfo,
} from '../types'

// 使用统一的类型定义，不再重复定义

export class ApiService {
  private static instance: ApiService
  private androidBridge: AndroidBridge
  
  // 连接池和请求优化
  private requestCache = new Map<string, { data: unknown, timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存
  private activeRequests = new Map<string, Promise<unknown>>() // 请求去重
  
  // 下载请求管理
  private downloadControllers = new Map<string, AbortController>() // 存储每个教材的下载控制器

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
        return cached.data
      } else {
        this.requestCache.delete(cacheKey)
      }
    }
    
    // 检查是否有相同的请求正在进行
    if (this.activeRequests.has(cacheKey)) {
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
      // 获取该教材的下载控制器
      const controller = this.downloadControllers.get(id)
      if (controller) {
        // 取消所有正在进行的下载请求
        controller.abort()
        
        // 清理控制器
        this.downloadControllers.delete(id)
        return true
      } else {
        return true
      }
    } catch (error) {
      return false
    }
  }

  /**
   * 取消教材下载
   * 取消下载会清理已下载的文件数据
   */
  public async cancelDownload(id: string): Promise<boolean> {
    try {
      // 获取该教材的下载控制器
      const controller = this.downloadControllers.get(id)
      if (controller) {
        // 取消所有正在进行的下载请求
        controller.abort()
        
        // 清理控制器
        this.downloadControllers.delete(id)
      }
      
      // 清理已下载的文件数据
      const resourceManager = ResourceManager.getInstance()
      await resourceManager.clearTextbookFiles(id)
      
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 检查是否有活跃的下载任务
   * @param textbookId 教材ID
   * @returns boolean 是否有活跃的下载任务
   */
  public hasActiveDownload(textbookId: string): boolean {
    return this.downloadControllers.has(textbookId)
  }



  /**
   * 验证资源文件完整性
   * 对应Android LearnResourceManager.verifyResourceIntegrity
   */
  public async verifyResourceIntegrity(resourceId: string, checksum: string): Promise<boolean> {
    try {
      // 这里可以实现验证文件完整性的逻辑
      // 由于是Web端，可能需要通过Android Bridge调用原生方法
      return true
    } catch (error) {
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
      // 动态导入日志工具（避免循环依赖）
      const { photoSearchLogger } = await import('@/utils/logging/photoSearchLogger')
      
      const url = getApiUrl(API_ENDPOINTS.EXERCISES.ADD)

      // 构造与Android AddQuestionRequest一致的请求体
      const requestBody = {
        bmNo: questionData.bmNo || questionData.id,
        type: subject.toLowerCase(),
        exercisesId: questionData.exercisesId || '',
        ...questionData,
      }

      // 记录API调用
      photoSearchLogger.apiAddToList(url, requestBody)

      // HTTP客户端会自动根据接口路径选择合适的token
      const response = await httpClient.post(url, requestBody)
      
      // 记录API响应（已在PhotoSearchView中记录，这里可选）
      // photoSearchLogger.apiAddToListResponse(response.success)
      
      return response.success
    } catch (error) {
      // 记录API错误（已在PhotoSearchView中记录，这里可选）
      // photoSearchLogger.error('添加到列表API', error)
      return false
    }
  }

  /**
   * 图片识别搜题（生物或数学）
   * @param imageFile 图片文件（File对象或Blob）
   * @param subject 科目类型（'biology' 或 'math'）
   * @returns Promise<ExerciseItem | null> 识别到的题目，失败返回null
   */
  public async recognizeImage(imageFile: File | Blob, subject: string): Promise<any | null> {
    try {
      // 动态导入日志工具（避免循环依赖）
      const { photoSearchLogger } = await import('@/utils/logging/photoSearchLogger')
      
      // 根据科目选择对应的API端点
      const endpoint = subject.toLowerCase() === 'biology' 
        ? API_ENDPOINTS.IMAGE_RECOGNITION.BIOLOGY 
        : API_ENDPOINTS.IMAGE_RECOGNITION.MATH
      
      const url = getApiUrl(endpoint)

      // 记录API调用
      photoSearchLogger.apiRecognizeImage(subject, endpoint, imageFile.size)

      // 构建FormData，与Android端保持一致
      const formData = new FormData()
      formData.append('imgFile', imageFile, 'default.jpg')

      // 使用httpClient发送multipart/form-data请求
      // 注意：不设置 Content-Type，让浏览器自动设置（包括 boundary）
      const response = await httpClient.post<{
        success: boolean
        code: number
        message: string
        data: {
          item: {
            questionsConfirm: Array<{
              bmNo: string
              title: string
              answer: string
              explanation: string
              analysisData: string
              id: string
            }>
          }
        }
      }>(url, formData)

      if (response.success && response.data?.data?.item?.questionsConfirm && response.data.data.item.questionsConfirm.length > 0) {
        const questionData = response.data.data.item.questionsConfirm[0]
        const result = {
          id: questionData.id,
          bmNo: questionData.bmNo,
          title: questionData.title,
          question: questionData.title, // 兼容旧版本
          answer: questionData.answer,
          explanation: questionData.explanation,
          analysisData: questionData.analysisData,
          subject: subject.toLowerCase(),
        }
        
        // 记录API响应成功（已在PhotoSearchView中记录，这里可选）
        // photoSearchLogger.apiRecognizeImageResponse(true, result)
        
        return result
      }
      
      // 记录API响应失败
      photoSearchLogger.apiRecognizeImageResponse(false)
      return null
    } catch (error) {
      // 记录API错误（已在PhotoSearchView中记录，这里可选）
      // photoSearchLogger.error('图片识别API', error)
      console.error('[API] 图片识别失败:', error)
      return null
    }
  }

  /**
   * 文本搜题（生物或数学）
   * @param keyText 搜索关键词
   * @param subject 科目类型（'biology' 或 'math'）
   * @returns Promise<ExerciseItem | null> 搜索到的题目，失败返回null
   */
  public async searchQuestionByText(keyText: string, subject: string): Promise<any | null> {
    try {
      // 根据科目选择对应的API端点
      const endpoint = subject.toLowerCase() === 'biology'
        ? API_ENDPOINTS.TEXT_SEARCH.BIOLOGY
        : API_ENDPOINTS.TEXT_SEARCH.MATH
      
      const url = `${getApiUrl(endpoint)}/${encodeURIComponent(keyText)}`

      // HTTP客户端会自动根据接口路径选择合适的token
      const response = await httpClient.get<{
        success: boolean
        code: number
        message: string
        data: {
          item: {
            questionsConfirm: Array<{
              bmNo: string
              title: string
              answer: string
              explanation: string
              analysisData: string
              id: string
            }>
          }
        }
      }>(url)

      if (response.success && response.data?.data?.item?.questionsConfirm && response.data.data.item.questionsConfirm.length > 0) {
        const questionData = response.data.data.item.questionsConfirm[0]
        return {
          id: questionData.id,
          bmNo: questionData.bmNo,
          title: questionData.title,
          question: questionData.title, // 兼容旧版本
          answer: questionData.answer,
          explanation: questionData.explanation,
          analysisData: questionData.analysisData,
          subject: subject.toLowerCase(),
        }
      }
      return null
    } catch (error) {
      console.error('[API] 文本搜题失败:', error)
      return null
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
   * 根据章节节点ID查询知识点ID
   * 对应Android ApiGateWayService.queryKnowledgeIdsByNodeId方法
   * @param request 请求对象，包含subject和param数组
   * @returns Promise<string> 返回知识点ID字符串（逗号分隔）
   * @throws {Error} 当查询失败时抛出错误，如果 count 为 0 则抛出特殊错误（code: 'NO_QUESTIONS'）
   */
  public async queryKnowledgeIdsByNodeId(request: {
    subject: string
    param: Array<{
      textbook_id: string
      section_id: string
    }>
  }): Promise<string> {
    try {
      const url = API_ENDPOINTS.EXERCISES.QUERY_KNOWLEDGE_BY_CHAPTER
      
      // 使用httpClient，会自动使用Vite代理（开发环境）或路由映射（生产环境）
      const response = await httpClient.post<{
        success: boolean
        subject?: string
        knowledge?: string
        count?: number
        message?: string
      }>(url, request)
      
      // 第1步：检查响应格式（response.data 是原始响应JSON，包含 success、knowledge、count 等字段）
      if (!response.success || !response.data) {
        const message = (response.data as any)?.message || response.message || '查询知识点失败'
        throw new Error(message)
      }
      
      // 第2步：检查 count 字段，如果为 0 则说明没有题目
      // response.data 是原始响应JSON，可以直接访问 count 字段
      const responseData = response.data as { success?: boolean; subject?: string; knowledge?: string; count?: number; message?: string }
      const count = responseData.count ?? (responseData.knowledge ? responseData.knowledge.split(',').filter(id => id.trim()).length : 0)
      if (count === 0) {
        const error = new Error('该知识点暂无相关练习题，请选择其他知识点进行练习')
        ;(error as any).code = 'NO_QUESTIONS'
        throw error
      }
      
      // 第3步：检查 knowledge 字段是否存在且不为空
      if (!responseData.knowledge || responseData.knowledge.trim() === '') {
        const error = new Error('该知识点暂无相关练习题，请选择其他知识点进行练习')
        ;(error as any).code = 'NO_QUESTIONS'
        throw error
      }
      
      // 第4步：返回知识点ID字符串
      return responseData.knowledge as string
    } catch (error) {
      // 如果已经是带有 code 的错误，直接抛出
      if (error instanceof Error && (error as any).code === 'NO_QUESTIONS') {
        throw error
      }
      // 否则抛出通用错误
      throw new Error(error instanceof Error ? error.message : '查询知识点失败')
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
      // 第1步：验证 dstUrl 是否存在
      if (!message.dstUrl) {
        throw new Error('dstUrl is required. Please set message.dstUrl explicitly in the message builder.')
      }

      // 第2步：构造完整的请求URL
      const url = getApiUrl(message.dstUrl)

      // 第3步：开始轮询聊天
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
    messageId: string = generateUniqueId('ai'),
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
      console.error('[API Service] 轮询异常:', {
        messageId,
        url,
        reason: message.reason,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
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
    // continue 请求需要更长的超时时间，因为服务器可能需要更多时间生成响应
    const timeout = requestBody.reason === 'continue' ? 30000 : 10000
    
    try {
      const response = await httpClient.post<{
        success: boolean
        message: string
        sessionId: string
      }>(url, requestBody, {
        retries: 0, // 禁用HTTP层自动重试，避免与业务层重试冲突
        timeout: timeout // continue 请求使用30秒超时，start 请求使用10秒超时
      })
      
      return response
    } catch (error) {
      console.error('[API Service] HTTP请求失败:', {
        url,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
      throw error
    }
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
    messageId: string = generateUniqueId('ai'),
  ): Promise<any> {
    // 检查响应是否成功
    if (!response.success || !response.data) {
      console.warn('[API Service] 响应失败:', {
        messageId,
        success: response.success,
        hasData: !!response.data,
        accumulatedContentLength: accumulatedContent.length
      })
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
    messageId: string = generateUniqueId('ai'),
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
    messageId: string = generateUniqueId('ai'),
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
    console.error('[API Service] 处理聊天错误:', {
      messageId,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      accumulatedContentLength: accumulatedContent.length
    })
    
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
        
        
        // AndroidBridge已经解析了JSON，直接返回data部分
        if (result && result.data) {
          return result.data
        } else {
          return null
        }
      }

      return null
    } catch (error) {
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
    const startTime = performance.now()
    
    try {
      // 使用AndroidBridge封装方法
      if (typeof window === 'undefined') {
        console.error('[ApiService] ❌ sendTextMessageToTeacher: window未定义')
        return false
      }
      
      if (!window.AndroidBridge) {
        console.error('[ApiService] ❌ sendTextMessageToTeacher: AndroidBridge未定义')
        return false
      }
      
      if (!window.AndroidBridge.sendTextMessageToTeacher) {
        console.error('[ApiService] ❌ sendTextMessageToTeacher: 方法不存在')
        return false
      }
      const result = this.androidBridge.sendTextMessageToTeacher(content, sessionId, subject)
      
      const duration = performance.now() - startTime
      
      if (result) {
      } else {
        console.error('[ApiService] ❌ sendTextMessageToTeacher: 发送失败')
      }
      
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      console.error('[ApiService] ❌ sendTextMessageToTeacher: 异常 -', error, ', 耗时=' + duration.toFixed(2) + 'ms')
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
    const startTime = performance.now()
    
    try {
      // 使用AndroidBridge封装方法
      if (typeof window === 'undefined') {
        console.error('[ApiService] ❌ sendVoiceMessageToTeacher: window未定义')
        return false
      }
      
      if (!window.AndroidBridge) {
        console.error('[ApiService] ❌ sendVoiceMessageToTeacher: AndroidBridge未定义')
        return false
      }
      
      if (!window.AndroidBridge.sendVoiceMessageToTeacher) {
        console.error('[ApiService] ❌ sendVoiceMessageToTeacher: 方法不存在')
        return false
      }
      const result = this.androidBridge.sendVoiceMessageToTeacher(voicePath, duration, sessionId, subject)
      
      const elapsedTime = performance.now() - startTime
      
      if (result) {
      } else {
        console.error('[ApiService] ❌ sendVoiceMessageToTeacher: 发送失败')
      }
      
      return result
    } catch (error) {
      const elapsedTime = performance.now() - startTime
      console.error('[ApiService] ❌ sendVoiceMessageToTeacher: 异常 -', error, ', 耗时=' + elapsedTime.toFixed(2) + 'ms')
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
        console.log('[ApiService] 🔍 forwardAiChatToTeacher 原生返回:', result)
        return result
      } else {
        console.error('[ApiService] ❌ AndroidBridge 不可用或 forwardAiChatToTeacher 方法不存在')
        console.error('[ApiService] ❌ window 类型:', typeof window)
        console.error('[ApiService] ❌ window.AndroidBridge 存在:', typeof window !== 'undefined' && !!window.AndroidBridge)
        console.error('[ApiService] ❌ forwardAiChatToTeacher 方法存在:', typeof window !== 'undefined' && !!window.AndroidBridge?.forwardAiChatToTeacher)
        return false
      }
    } catch (error) {
      console.error('[ApiService] ❌ forwardAiChatToTeacher 异常:', error)
      console.error('[ApiService] ❌ 错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息')
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
   * 第1步：发送登录请求
   * 第2步：保存token和用户凭据到localStorage
   * 第3步：返回token
   * @param account 账号
   * @param password 密码（明文，与Android端LoginActivity保持一致）
   * @returns Promise<string> 返回token
   */
  public async loginXueban(account: string, password: string): Promise<string> {
    try {
      // 第1步：发送登录请求
      const response = await httpClient.post<XuebanLoginResponse>(
        getApiUrl(API_ENDPOINTS.USER.XUEBAN_LOGIN),
        {
          account,
          password
        }
      )
      
      // 检查响应结构：response.data 是 XuebanLoginResponse
      if (!response.success) {
        throw new Error(response?.data?.message || '登录失败')
      }

      const token = response.data.data.token
      
      if (!token) {
        throw new Error('登录失败：未获取到token')
      }
      
      // 第2步：保存token和用户凭据到localStorage
      localStorage.setItem('XUEBAN_TOKEN', token)
      localStorage.setItem('userId', account)
      localStorage.setItem('userPassword', password)
      
      // 更新登录时间戳，用于会话管理
      localStorage.setItem('lastLoginTime', Date.now().toString())

      // 第3步：返回token
      return token
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : '登录失败')
    }
  }


  /**
   * 获取用户信息
   * 第1步：调用API获取用户信息
   * 第2步：持久化到localStorage
   * 第3步：同步到Android原生ViewModel（如果在Android环境）
   * 
   * @param token 用户token
   * @returns Promise<UserInfo> 用户信息
   */
  public async getUserInfo(token: string): Promise<UserInfo> {
    try {
      // 第1步：调用API获取用户信息
      const response = await httpClient.get<{
        success: boolean
        message: string
        data: UserInfo
      }>(`${getApiUrl(API_ENDPOINTS.USER.ADMIN_INFO)}?token=${token}`)
      
      if (!response.success || !response.data) {
        throw new Error(response.message || '获取用户信息失败')
      }

      const userInfo = response.data.data
      
      // 第2步：持久化用户信息到localStorage
      try {
        localStorage.setItem('userInfo', JSON.stringify(userInfo))
      } catch (storageError) {
        // 静默处理
      }
      
      // 第3步：同步用户信息到Android原生ViewModel（关键！）
      // 确保Android原生接口（如教师消息监听）能正常工作
      try {
        const userId = localStorage.getItem('userId')
        const userPassword = localStorage.getItem('userPassword')
        
        if (userId && token) {
          this.androidBridge.syncUserInfo(
            userId,
            token,
            userPassword || ''
          )
        }
      } catch (syncError) {
        // 静默处理
      }

      try {
        const { setUserInfoWithCleanup, initializeStore } = await import('./auth-storage-service')
        await setUserInfoWithCleanup(userInfo)
        await initializeStore()
      } catch (storeError) {
        console.warn('[API] ⚠️ 同步 userStore 失败:', storeError)
      }

      return userInfo
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
        
        return loginResponse
      } else {
        return null
      }
    } catch (error) {
      return null
    }
  }

  /**
   * 检查学生登录状态
   */
  public isStudentLoggedIn(): boolean {
    const token = localStorage.getItem('YANBAN_TOKEN')
    const userId = localStorage.getItem('studentUserId')
    return !!(token && userId && token !== 'undefined' && userId !== 'undefined' && token.trim() !== '' && userId.trim() !== '')
  }

  /**
   * 学生登出
   */
  public logoutStudent(): void {
    localStorage.removeItem('YANBAN_TOKEN')
    localStorage.removeItem('studentUserId')
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
      throw error
    }
  }

  /**
   * 获取学习资源包 - 修正为与Android端一致的流程，支持缓存
   */
  public async getLearningResources(id: string, useCache: boolean = true): Promise<LearningPackage[]> {
    try {
      const endpoint = API_ENDPOINTS.LEARNING_RESOURCE.TEXTBOOK.LEARNING_PACKAGE
      const request: LearningResourcesRequest = { id: id }
      
      // 使用httpClient而不是optimizedRequest，确保认证头正确添加
      const response = await httpClient.post<{
        data: LearningPackage[]
      }>(endpoint, request)
      
      if (response.success && response.data && response.data.data) {
        // 处理学习包数据，确保字段完整性
        const packages = response.data.data.map((pkg: LearningPackage) => ({
          ...pkg,
          packageId: pkg.id,
          sectionId: pkg.sectionId || '',
          packageName: pkg.packageName || '未命名方案',
          description: pkg.description || '暂无描述',
          updateTime: pkg.updateTime || new Date().toISOString(),
          isDefault: pkg.isDefault || 0,
          userId: pkg.userId || '',
          releaseStatus: pkg.releaseStatus || false,
          visibility: pkg.visibility || 0,
          authors: pkg.authors || '{}',
          tags: pkg.tags || '{}',
          resourceList: pkg.resourceList || []
        }))
        
        // 缓存到本地存储（加上用户ID前缀，实现账号隔离）
        if (useCache) {
          try {
            const userId = authStorageService.getCurrentUserIdOrDefault()
            localStorage.setItem(`learning_packages_${userId}_${id}`, JSON.stringify({
              data: packages,
              timestamp: Date.now()
            }))
          } catch (storageError) {
            // 静默处理
          }
        }
        
        return packages
      }
      
      return []
    } catch (error) {
      // 尝试从本地缓存获取数据（加上用户ID前缀，实现账号隔离）
      if (useCache) {
        try {
          const userId = authStorageService.getCurrentUserIdOrDefault()
          const cached = localStorage.getItem(`learning_packages_${userId}_${id}`)
          if (cached) {
            const cachedData = JSON.parse(cached)
            // 检查缓存是否过期（24小时）
            if (Date.now() - cachedData.timestamp < 24 * 60 * 60 * 1000) {
              return cachedData.data
            }
          }
        } catch (cacheError) {
          // 静默处理
        }
      }
      
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
        // 🔥 处理封面URL拼接，与后端逻辑保持一致
        // 后端在 LearnResourceManager.fetchUserAllOnlineTextbooks() 第342行拼接URL
        // BASE_URL = "https://www.imates.com.cn:9099"
        const BASE_URL = 'https://www.imates.com.cn:9099'
        
        return response.data.data.map((textbook) => {
          // 如果 textbookCover 不是完整URL（不以 http 开头），则拼接 BASE_URL
          if (textbook.textbookCover && !textbook.textbookCover.startsWith('http')) {
            textbook.textbookCover = BASE_URL + textbook.textbookCover
          }
          return textbook
        })
      }
      return []
    } catch (error) {
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
      // 第1步：获取服务器端教材版本列表
      const serverTextbooks = await this.getTextbookVersions()
      
      // 第2步：获取本地教材信息
      const localTextbooks = await resourceManager.getUserLocalTextbooks()
      
      // 第3步：执行三级对比检查
      const updatedTextbooks: TextbookVersion[] = []
      
      for (const serverTextbook of serverTextbooks) {
        const localTextbook = localTextbooks.find((t: UserTextbookInfo) => t.textbookId === serverTextbook.textbookId)
        
        // 检查是否需要更新
        const needsUpdate = await this.checkTextbookUpdate(serverTextbook, localTextbook)
        
        if (needsUpdate) {
          updatedTextbooks.push(serverTextbook)
        }
      }
      
      return updatedTextbooks
      
    } catch (error) {
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
        return true
      }
      
      // 教材更新时间比较
      const textbookUpdated = this.isNewer(serverTextbook.textbookUpdateTime, localTextbook.textbookUpdateTime)
      
      if (textbookUpdated) {
        return true
      }
      
      // 第二级：包级别检查
      const packageUpdated = await this.checkLearningPackageUpdates(serverTextbook, localTextbook)
      
      if (packageUpdated) {
        return true
      }
      
      return false
      
    } catch (error) {
      // 出错时默认需要更新（安全策略）
      return true
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
          return true
        }
        
        // 包更新时间比较
        if (this.isNewer(serverPackage.updateTime, localPackage.updateTime)) {
          return true
        }
        
        // 第三级：文件级别检查
        const fileUpdated = this.hasFileUpdates(serverPackages, localTextbook)
        
        if (fileUpdated) {
          return true
        }
      }
      
      // 检查是否有包被删除
      for (const localPackage of localPackages) {
        const foundOnServer = serverPackages.some(p => p.id === localPackage.id)
        if (!foundOnServer) {
          return true
        }
      }
      
      return false
      
    } catch (error) {
      return true
    }
  }

  /**
   * 检查文件更新 - 重构版本，现在使用textbook.localFiles
   * 对应Android LearnResourceManager.hasFileUpdates
   * 检查整个教材的所有文件，而不是单个包的文件
   */
  private hasFileUpdates(serverPackages: LearningPackage[], textbook: UserTextbookInfo): boolean {
    try {
      // 如果教材没有localFiles属性，说明还没有下载过，需要更新
      if (!textbook.localFiles || !Array.isArray(textbook.localFiles)) {
        return true
      }
      
      // 收集所有服务器文件
      const allServerFiles: ResourceFile[] = []
      for (const serverPackage of serverPackages) {
        if (serverPackage.resourceList && serverPackage.resourceList.length > 0) {
          allServerFiles.push(...serverPackage.resourceList)
        }
      }
      
      // 检查服务器文件
      for (const serverFile of allServerFiles) {
        const localFile = textbook.localFiles.find(f => f.id === serverFile.id)
        
        if (!localFile) {
          return true
        }
        
        // 文件校验和比较
        if (serverFile.checksum !== localFile.checksum) {
          return true
        }
      }
      
      // 检查是否有文件被删除
      for (const localFile of textbook.localFiles) {
        const foundOnServer = allServerFiles.some(f => f.id === localFile.id)
        if (!foundOnServer) {
          return true
        }
      }
      
      return false
      
    } catch (error) {
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
        return true // 解析失败时默认需要更新（安全策略）
      }
      
      return newDate > oldDate
    } catch (error) {
      return true // 出错时默认需要更新（安全策略）
    }
  }

  /**
   * 获取服务器学习资源包（区分首次下载和继续下载）
   * @param textbook 教材信息
   * @returns 学习资源包列表
   */
  private async getServerLearningPackages(textbook: UserTextbookInfo): Promise<any[]> {
    // 🔥 优化：区分首次下载和继续下载
    let serverPackages: any[]
    
    // 检查是否已有学习资源包（继续下载的情况）
    if (textbook.learningPackages && textbook.learningPackages.length > 0) {
      // 继续下载：直接使用已有的学习资源包
      serverPackages = textbook.learningPackages
    } else {
      // 首次下载：获取服务器端的学习资源包
      serverPackages = await this.getLearningResources(textbook.id)
      
      if (!serverPackages || serverPackages.length === 0) {
        return []
      }
      
      // 更新教材的学习资源包信息
      textbook.learningPackages = serverPackages
    }
    
    return serverPackages
  }

  /**
   * 收集需要更新的文件（增量下载逻辑）- 性能优化版本
   * @param textbook 教材信息
   * @param serverPackages 服务器学习资源包
   * @returns 需要更新的文件列表和总文件数
   */
  private async collectFilesToUpdate(textbook: UserTextbookInfo, serverPackages: any[]): Promise<{
    filesToUpdate: Array<{resource: any, pkg: any}>,
    totalServerFiles: number
  }> {
    const filesToUpdate: Array<{resource: any, pkg: any}> = []
    let totalServerFiles = 0
    
    // 第1步：获取本地学习资源包（用于增量对比）
    const localLearningPackages = textbook.learningPackages || []
    // 第2步：一次性从IndexedDB获取最新的教材数据（包含所有localFiles）
    // 避免在循环中多次查询数据库，提升性能
    const resourceManager = ResourceManager.getInstance()
    
    // 使用三层降级策略查询：id主键 -> textbookId索引 -> getAll
    let latestTextbook = await resourceManager.getTextbookByIdOrTextbookIdWithFallback(
      textbook.id,
      textbook.textbookId,
      'ApiService.collectFilesToUpdate'
    )
    
    // 如果通过降级策略查不到，但在降级过程中使用了getAll，打印调试信息
    if (!latestTextbook && textbook.textbookId) {
      const allTextbooks = await resourceManager.indexedDB.getAll<UserTextbookInfo>('textbooks')
      // 打印数据库中的所有教材数据（用于调试）
    }
    
    // 如果还是查不到，使用传入的 textbook 对象（可能还没有保存到 IndexedDB）
    if (!latestTextbook) {
      latestTextbook = textbook
    }
    
    const localFiles = latestTextbook.localFiles || []
    // 第3步：构建文件ID到localFile的映射表，避免重复查找
    const localFileMap = new Map<string, LocalFileInfo>()
    for (const file of localFiles) {
      localFileMap.set(file.id, file)
    }
    
    // 第4步：遍历服务器学习资源包，收集需要更新的文件
    let packagesWithResourceList = 0
    let packagesWithoutResourceList = 0
    let packagesWithEmptyResourceList = 0
    
    for (const serverPackage of serverPackages) {
      // 检查包的结构
      const hasResourceList = 'resourceList' in serverPackage
      const resourceListLength = serverPackage.resourceList?.length || 0
      
      if (!hasResourceList) {
        packagesWithoutResourceList++
      } else if (resourceListLength === 0) {
        packagesWithEmptyResourceList++
      } else {
        packagesWithResourceList++
      }
      
      if (serverPackage.resourceList && serverPackage.resourceList.length > 0) {
        totalServerFiles += serverPackage.resourceList.length
        
        // 查找对应的本地包
        const localLearningPackage = localLearningPackages.find(p => p.packageId === serverPackage.packageId)
        if (!localLearningPackage) {
          // 新包：下载所有文件
          for (const resource of serverPackage.resourceList) {
            filesToUpdate.push({ resource, pkg: serverPackage })
          }
        } else {
          // 已存在的包：检查文件更新和fileData存在性
          for (const serverFile of serverPackage.resourceList) {
            const localFile = localFileMap.get(serverFile.id)
            
            // 检查文件是否需要下载：
            // 1. localFiles中没有记录（新文件）
            // 2. 校验和不匹配（文件已更新）
            // 3. textbook_files表中不存在实际数据（暂停后继续下载）
            let needsDownload = false
            if (!localFile) {
              needsDownload = true
            } else if (serverFile.checksum !== localFile.checksum) {
              needsDownload = true
            } else {
              // 检查textbook_files表中是否存在文件数据
              // 注意：hasFileData 方法实际上只需要 fileId，但为了保持接口一致性，传入 textbook id
              const textbookId = latestTextbook.id || latestTextbook.textbookId || ''
              if (textbookId) {
                const hasFileData = await resourceManager.hasFileData(textbookId, serverFile.id)
                if (!hasFileData) {
                  needsDownload = true
                }
              } else {
                // 如果连 textbookId 都没有，视为新文件，需要下载
                needsDownload = true
              }
            }
            
            if (needsDownload) {
              filesToUpdate.push({ resource: serverFile, pkg: serverPackage })
            }
          }
        }
      }
    }
    return { filesToUpdate, totalServerFiles }
  }


  /**
   * 获取格式化时间（HH:mm:ss.SSS）
   */
  private getFormattedTime(): string {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0')
    return `${hours}:${minutes}:${seconds}.${milliseconds}`
  }

  /**
   * 获取下载类型标签
   */
  private getDownloadType(textbook: UserTextbookInfo): string {
    const downloaded = textbook.downloadedFiles || 0
    const total = textbook.totalFiles || 0
    
    if (downloaded === 0) {
      return '首次下载'
    } else if (downloaded > 0 && downloaded < total) {
      if (textbook.downloadStatus === 3) {
        return '继续下载（从暂停恢复）'
      }
      return '继续下载（断点续传）'
    } else if (textbook.hasUpdatesAvailable) {
      return '更新下载'
    }
    return '重新下载'
  }

  /**
   * 获取下载状态标签
   */
  private getStatusLabel(status: number): string {
    const statusMap: Record<number, string> = {
      0: '未下载',
      1: '下载中',
      2: '已完成',
      3: '已暂停'
    }
    return statusMap[status] || '未知状态'
  }

  /**
   * 下载教材资源 - 增量下载优化版本（只下载需要更新的文件）
   * 对应Android LearnResourceManager.downloadAllResources
   * 使用与安卓原生一致的接口路径和认证方式
   */
  public async downloadTextbook(textbook: UserTextbookInfo, onProgress?: (progress: number, downloadedCount: number, totalToDownload: number) => void): Promise<boolean> {
    const startTime = Date.now()
    try {
      // 第1步：初始化下载控制器
      const controller = new AbortController()
      this.downloadControllers.set(textbook.textbookId, controller)
      
      // 第2步：获取学习资源包（优先使用本地数据）
      let serverPackages: any[] = []
      
      if (textbook.learningPackages && textbook.learningPackages.length > 0) {
        serverPackages = textbook.learningPackages
      } else {
        serverPackages = await this.getServerLearningPackages(textbook)
      }
      
      if (!serverPackages || serverPackages.length === 0) {
        return true
      }
      
      // 第3步：增量文件筛选（收集需要更新的文件）
      const { filesToUpdate, totalServerFiles } = await this.collectFilesToUpdate(textbook, serverPackages)
      const filesToDownload = filesToUpdate.length
      // 第4步：保存学习资源包到IndexedDB
      const resourceManager = ResourceManager.getInstance()
      await resourceManager.updateTextbookInfo(textbook, undefined)
      
      // 第5步：设置教材总文件数
      const textbooks = await resourceManager.getUserLocalTextbooks()
      const textbookRecord = textbooks.find(t => t.textbookId === textbook.textbookId)
      if (textbookRecord) {
        textbookRecord.totalFiles = totalServerFiles
        await resourceManager.updateTextbookInfo(textbookRecord, { totalFiles: totalServerFiles })
      }
      textbook.totalFiles = totalServerFiles
      
      if (filesToDownload === 0) {
        return true
      }
      
      // 第6步：并发下载需要更新的文件
      // 流程：计算已下载的文件数（总文件数 - 需要下载的文件数）
      const alreadyDownloadedFiles = totalServerFiles - filesToDownload
      
      const downloadStartTime = Date.now()
      const result = await this.downloadFilesConcurrently(
        filesToUpdate, 
        filesToDownload, 
        textbook.textbookId, 
        controller, 
        (progress, newlyDownloadedCount) => {
          // 流程：总下载文件数 = 已完成的旧文件 + 新下载的文件
          const totalDownloadedFiles = alreadyDownloadedFiles + newlyDownloadedCount
          onProgress?.(progress, totalDownloadedFiles, filesToDownload)
        }, 
        textbook
      )
      
      // 第7步：强制刷新IndexedDB
      await resourceManager.forceFlushPendingUpdates()
            
      // 第8步：清理下载控制器
      this.downloadControllers.delete(textbook.textbookId)
      
      const isSuccess = result.successCount === filesToDownload
      
      return isSuccess
      
    } catch (error) {
      console.error('[ApiService.下载] 下载过程发生异常', {
        textbookId: textbook.textbookId,
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        elapsedTime: Date.now() - startTime + 'ms',
      })
      
      if (error instanceof Error && error.name === 'AbortError') {
        this.downloadControllers.delete(textbook.textbookId)
        throw error
      }
      this.downloadControllers.delete(textbook.textbookId)
      
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
      return []
    }
  }

  /**
   * 更新学习包的本地文件信息 - 分离存储版本
   * 此方法只更新元数据（localFiles），fileData存储在独立的textbook_files表中
   * @param textbookId 教材ID
   * @param packageId 学习包ID
   * @param resource 资源文件信息
   * @param fileSize 文件大小
   */
  private async updateLocalFileInfo(textbookId: string, packageId: string, resource: ResourceFile, fileSize: number): Promise<void> {
    try {
      const resourceManager = ResourceManager.getInstance()
      
      // 获取教材信息（使用降级策略：textbookId索引 -> getAll）
      const textbook = await resourceManager.getTextbookByTextbookIdWithFallback(
        textbookId,
        'ApiService.updateLocalFileInfo'
      )
      
      if (!textbook) {
        return
      }
      
      // 初始化textbook.localFiles数组
      if (!textbook.localFiles) {
        textbook.localFiles = []
      }
      
      // 查找现有的本地文件信息
      const localFileIndex = textbook.localFiles.findIndex(f => f.id === resource.id)
      
      if (localFileIndex !== -1) {
        // 更新现有的本地文件元数据
        textbook.localFiles[localFileIndex] = {
          ...textbook.localFiles[localFileIndex],
          fileName: resource.fileName,
          fileSize: fileSize,
          checksum: resource.checksum,
          isDownloaded: true,
          localPath: `${textbookId}/${packageId}/${resource.fileName}`
        }
        
        // 保存更新后的教材信息
        await resourceManager.updateTextbookInfo(textbook, undefined)
      } else {
        // 创建新的本地文件信息（元数据，不含fileData）
        textbook.localFiles.push({
          id: resource.id,
          fileName: resource.fileName,
          fileSize: fileSize,
          checksum: resource.checksum,
          isDownloaded: true,
          localPath: `${textbookId}/${packageId}/${resource.fileName}`
          // 注意：fileData存储在独立的textbook_files表中
        })
        
        // 保存更新后的教材信息
        await resourceManager.updateTextbookInfo(textbook, undefined)
      }
      
    } catch (error) {
      // 静默处理
    }
  }

  /**
   * 解析文件名中的章节顺序
   * 使用公共工具函数 parseChapterOrderFromFileNameUtil
   * @param fileName 文件名
   * @returns 章节顺序数字
   */
  private parseChapterOrderFromFileName(fileName: string): number {
    // 使用公共工具函数（支持更多命名模式，包括中文数字）
    return parseChapterOrderFromFileNameUtil(fileName)
  }

  /**
   * 并发下载文件列表 - 优化版本
   * @param allResources 所有资源文件列表
   * @param totalFiles 总文件数
   * @param textbookId 教材ID
   * @param controller AbortController用于取消下载
   * @param onProgress 进度回调
   */
  private async downloadFilesConcurrently(
    allResources: Array<{resource: any, pkg: any}>, 
    totalFiles: number, 
    textbookId: string,
    controller: AbortController,
    onProgress?: (progress: number, downloadedCount: number) => void,
    textbook?: any
  ): Promise<{successCount: number, errorCount: number, totalDownloadedBytes: number, averageSpeed: string}> {
    
    // 第1步：初始化下载统计
    const downloadStartTime = Date.now()
    let totalDownloadedBytes = 0
    
    // 第2步：并发下载配置
    const CONCURRENT_DOWNLOADS = 6
    const downloadQueue = [...allResources]
    const results: Array<{success: boolean, fileName: string, fileSize: number}> = []
    let completedFiles = 0
    let successCount = 0
    let errorCount = 0
    
    // 第3步：创建下载任务
    const downloadTask = async (resourceInfo: {resource: any, pkg: any}): Promise<void> => {
      const { resource, pkg } = resourceInfo
        
      if (controller.signal.aborted) {
        results.push({ success: false, fileName: resource.fileName, fileSize: 0 })
        errorCount++
        return
      }
      
      try {
        const fileData = await this.downloadSingleFileStreaming(resource, controller)
        
        if (fileData) {
          totalDownloadedBytes += fileData.length
          
          try {
            const resourceManager = ResourceManager.getInstance()
            const chapterOrder = this.parseChapterOrderFromFileName(resource.fileName)
            
            const fileInfo = {
              id: resource.id,
              textbookId: textbookId,
              packageId: pkg.packageId,
              fileName: resource.fileName,
              fileType: resource.fileType || 'unknown',
              fileSize: fileData.length,
              checksum: resource.checksum,
              chapterOrder: chapterOrder,
              sortOrder: chapterOrder
            }
            
            await resourceManager.storeFileData(fileInfo, fileData, textbook)
          } catch {
            // 存储失败，忽略错误继续
          }
          
          results.push({ success: true, fileName: resource.fileName, fileSize: fileData.length })
          successCount++
        } else {
          results.push({ success: false, fileName: resource.fileName, fileSize: 0 })
          errorCount++
        }
        
      } catch {
        results.push({ success: false, fileName: resource.fileName, fileSize: 0 })
        errorCount++
      } finally {
        completedFiles++
        const progress = Math.round((completedFiles / totalFiles) * 100)
        onProgress?.(progress, successCount)
      }
    }
    
    // 第4步：并发执行下载任务
    const downloadPromises: Promise<void>[] = []
    
    for (let i = 0; i < Math.min(CONCURRENT_DOWNLOADS, downloadQueue.length); i++) {
      const resourceInfo = downloadQueue.shift()
      if (resourceInfo) {
        downloadPromises.push(downloadTask(resourceInfo))
      }
    }
    
    while (downloadQueue.length > 0) {
      if (controller.signal.aborted) {
        break
      }
      
      await Promise.race(downloadPromises.filter(p => p))
      
      const newResource = downloadQueue.shift()
      if (newResource) {
        downloadPromises.push(downloadTask(newResource))
      }
    }
    
    await Promise.all(downloadPromises)
    
    // 第5步：计算下载性能
    const downloadDuration = Date.now() - downloadStartTime
    const downloadDurationSeconds = downloadDuration / 1000
    const averageSpeed = downloadDurationSeconds > 0 
      ? `${(totalDownloadedBytes / downloadDurationSeconds / 1024 / 1024).toFixed(2)}MB/s`
      : '0B/s'
    
    if (controller.signal.aborted) {
      throw new DOMException('下载被用户取消', 'AbortError')
    }
    
    return { successCount, errorCount, totalDownloadedBytes, averageSpeed }
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
      // 流程：确保资源URL格式正确（以/开头的相对路径）
      const resourceUrl = resource.fileUrl.startsWith('/') ? resource.fileUrl : `/${resource.fileUrl}`
      
      // 流程：使用httpClient下载文件
      const response = await httpClient.downloadStream(resourceUrl, {})
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
      
      
      // 如果提供了校验和，验证文件完整性
      if (resource.checksum) {
        try {
          const resourceManager = ResourceManager.getInstance()
          const isValid = await resourceManager.verifyLocalFileIntegrity(result, resource.checksum)
          if (!isValid) {
            throw new Error(`文件校验失败: ${resource.fileName}`)
          }
        } catch (verifyError) {
          throw verifyError
        }
      } else {
      }
      
      return result
      
    } catch (error) {
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
    controller: AbortController
  ): Promise<Uint8Array | null> {
    try {
      // 流程：确保资源URL格式正确（以/开头的相对路径）
      const resourceUrl = resource.fileUrl.startsWith('/') ? resource.fileUrl : `/${resource.fileUrl}`
      
      // 流程：使用httpClient下载文件流，支持file://协议和认证
      const response = await httpClient.downloadStream(resourceUrl, {
        signal: controller.signal
      })
      
      // 流程：获取文件大小
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
          // 检查是否已被取消
          if (controller.signal.aborted) {
            reader.releaseLock()
            throw new Error('Download aborted')
          }
          
          const { done, value } = await reader.read()
          if (done) break
          
          chunks.push(value)
          downloadedBytes += value.length
        }
      } finally {
        reader.releaseLock()
      }
      
      
      // 高效合并chunks
      const result = this.mergeChunksEfficiently(chunks)
      
      // 如果提供了校验和，验证文件完整性
      if (resource.checksum) {
        try {
          const resourceManager = ResourceManager.getInstance()
          const isValid = await resourceManager.verifyLocalFileIntegrity(result, resource.checksum)
          if (!isValid) {
            throw new Error(`文件校验失败: ${resource.fileName}`)
          }
        } catch (verifyError) {
          throw verifyError
        }
      }
      
      return result
      
    } catch (error) {
      // 检查是否是取消错误
      if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Download aborted')) {
        return null
      }
      
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
        return false
      }
      
      
      // 使用apiService进行登录
      const loginResult = await this.loginYanban(userId, password)
      if (!loginResult) {

        return false
      }
      
      // 更新登录时间戳
      localStorage.setItem('lastLoginTime', Date.now().toString())
      
      return true
    } catch (error) {
      return false
    }
  }

}

// 创建默认的 API 服务实例
export const apiService = ApiService.getInstance()
