/**
 * API 服务层
 * 处理所有网络请求相关的接口调用
 */

import { httpClient } from '../http/http-client'
import { resourceManager, ResourceManager } from '../storage/resource-storage'
import CryptoJS from 'crypto-js'
import { authStorageService } from '../storage/auth-storage-service'
import { saveLearningPackagesToDB, loadLearningPackagesFromDB } from '../storage/learning-packages-storage'
import {
  getApiUrl,
  getExerciseListUrl,
  getDeleteExerciseUrl,
  API_ENDPOINTS,
} from '../http/api-endpoints'
import { AndroidBridge } from '../business/android-bridge'
import { generateUniqueId } from '@/stores/utils/chatStoreUtils'
// 不再需要导入fileToBase64DataUrl，直接使用传入的Base64数据 

// 章节相关工具函数
import { parseChapterOrderFromFileName as parseChapterOrderFromFileNameUtil } from '@/utils/business/chapter-utils'

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
  BackendHistoryMessage,
  SSEPayload,
  ManageConversationMemoryRequest,
  FindSimilarQuestionByBmNoRequest,
  ApiResponse,
} from '@/types'
import { date } from 'quasar'
import { getCurrentEnvType, AppEnvType } from '@/config/env-config'

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

  // ========== 对话记忆管理相关接口 ==========

  /**
   * 管理对话记忆（删除部分消息 / 删除整个线程）
   * 通过后端统一接口对 chatbot / solvingbot 的历史进行裁剪
   */
  public async manageConversationMemory(
    payload: ManageConversationMemoryRequest,
  ): Promise<any> {
    // try {
    //   const url = getApiUrl('/permission/manageConversationMemory')
    //   const response = await httpClient.post(url, payload)
    //   return response.data
    // } catch (error) {
    //   console.error('[API Service] manageConversationMemory 调用失败:', {
    //     payload,
    //     error: error instanceof Error ? error.message : String(error),
    //   })
    //   throw error
    // }

    console.info('[API Service] manageConversationMemory 调用已被跳过(本地禁用)', payload)
    return Promise.resolve(null)
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
   * 研伴接口统一调用封装
   * - 保持与 Android 原生一致的分流策略：内部测试环境 + 有 AndroidBridge 时走原生网络
   * - 其他环境直接通过 httpClient 调用 Web 接口
   */
  private async callYanban<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
    const envType = getCurrentEnvType()

    if (envType === AppEnvType.INTERNAL_TEST && this.androidBridge.isAndroidBridgeAvailable()) {
      // 测试环境 + 有原生桥接：走 Android 原生网络请求
      console.log('[ApiService] 🔀 Yanban 接口走原生:', { url })

      // 提取 /blw-edu-yb 后面的路径部分给原生
      const apiPath = url.replace('/blw-edu-yb', '')

      // 从统一存储获取 Token，传给原生（避免原生读 localStorage 导致死锁）
      const yanbanToken = authStorageService.getYanbanToken() || ''

      const result = await this.androidBridge.callYanbanApi(apiPath, body, 'POST', envType, yanbanToken)

      return {
        success: (result as any)?.success ?? false,
        data: ((result as any)?.data ?? result) as T,
        code: (result as any)?.code ?? ((result as any)?.success ? 200 : 0),
        message: (result as any)?.message,
      }
    }

    // 其他环境：直接通过 Web HTTP 调用
    const response = await httpClient.post<T>(url, body)
    // 针对研伴登录等关键接口输出精简日志
    if (url === API_ENDPOINTS.LEARNING_RESOURCE.YANBAN_LOGIN) {
      console.log('[Debug][Yanban] Web login-student 响应概要:', {
        httpSuccess: response.success,
        hasData: !!response.data,
        code: response.code,
      })
    }
    return response
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
   * Web 端检查应用更新
   * 对齐 Android MainWebViewActivity.checkUpdateWithHttpRequest
   * 调用同一更新接口，返回服务器版本信息，供 Web 自行处理
   */
  public async checkAppUpdate(): Promise<{ versionName: string; raw: any } | null> {
    try {
      // 根据当前环境动态获取更新接口 URL
      const { getAppUpdateUrl } = await import('@/config/env-config')
      const url = getAppUpdateUrl()
      console.log("url",url)
      const response = await httpClient.get<any>(url)
      const data = response?.data ?? response
      if (!data) {
        return null
      }

      const versionName: string = data.VersionName || data.versionName || ''
      if (!versionName) {
        return null
      }

      return {
        versionName,
        raw: data,
      }
    } catch (error) {
      console.warn('[ApiService] Web 检查应用更新失败:', error)
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
      // 只发送规范字段，避免把前端临时标记字段透传给后端
      const requestBody = {
        bmNo: questionData.bmNo || questionData.id,
        type: subject.toLowerCase(),
        exercisesId: questionData.exercisesId || '',
        // 下面字段与后端/Android 模型对齐，按需从 questionData 中提取
        title: questionData.title || questionData.question || '',
        answer: questionData.answer || '',
        explanation: questionData.explanation || questionData.aiExplanation || '',
        analysisData: questionData.analysisData || questionData.answerAnalysis || '',
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
        pageSize: request.size,
      }
    } catch (error) {
      return {
        questions: [],
        totalCount: 0,
        currentPage: request.current,
        pageSize: request.size,
      }
    }
  }

  /**
   * 根据 bmNoList 查找相似题目
   * 目前复用按知识点查题接口：把 bmNoList 当作 knowledgeNo 传入
   */
  public async findSimilarQuestionsByBmNoList(request: FindSimilarQuestionByBmNoRequest): Promise<{
    questions: any[]
    totalCount: number
    currentPage: number
    pageSize: number
  }> {
    const mappedRequest: any = {
      bmNoList: request.bmNoList,
      exercisesId: request.exercisesId,
      type: request.type,
      size: request.size,
      current: request.current,
      totalCount: request.totalCount,
    }

    return this.findSimilarQuestionsByKnowledge(mappedRequest)
  }

  /**
   * 发送聊天消息至 AI（基于轮询机制实现打字机效果）
   * @param message 聊天消息请求
   * @param onComplete 完成回调
   * @param onStream 流式内容回调
   * @param onHistoryUpdate 历史消息更新回调（用于同步后端全量历史）
   */
  public async sendChatMessage(
    message: AiChatMessageRequest,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ): Promise<any> {
    try {
      // 第1步：验证 dstUrl 是否存在
      if (!message.dstUrl) {
        throw new Error('dstUrl is required. Please set message.dstUrl explicitly in the message builder.')
      }

      // 第2步：构造完整的请求URL
      const url = getApiUrl(message.dstUrl)

      // 第3步：开始轮询聊天
      return await this.pollChatMessage(message, url, onComplete, onStream, '', generateUniqueId('ai'), onHistoryUpdate)
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
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ): Promise<any> {
    try {
      // 1. 直接使用 message 作为请求体
      const requestBody = {
        ...message,
        // 如果后端使用的是 role 字段，可以兼容一下
        role: (message as any).chatRole ?? (message as any).role,
      }

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
        messageId,
        onHistoryUpdate
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
   * 发送聊天请求
   * 执行HTTP POST请求并返回响应
   * 禁用HTTP层自动重试，由上层业务逻辑控制重试
   */
  private async sendChatRequest(url: string, requestBody: any) {
    // continue 请求需要更长的超时时间，因为服务器可能需要更多时间生成响应
    const timeout = requestBody.reason === 'continue' ? 60000 : 60000
    
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
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ): Promise<any> {
    // 第0步：基础校验
    if (!response || !response.success || !response.data) {
      console.warn('[API Service] 响应失败:', {
        messageId,
        success: response?.success,
        hasData: !!response?.data,
        accumulatedContentLength: accumulatedContent.length,
      })
      return this.createErrorResult(
        messageId,
        accumulatedContent || '请求失败，请重试。',
        onComplete,
        onStream,
      )
    }

    // 兼容两种返回格式：优先使用 data.message，其次回退到顶层 message
    const rawMessage =
      response.data && response.data.message != null
        ? response.data.message
        : response.message ?? ''
    const trimmedChunk = String(rawMessage).trim()

    // ========== 特殊处理：截图问答接口 /permission/previewPictureQA ==========
    const raw = String(rawMessage)

    // 兜底逻辑：对于 /permission/previewPictureQA，如果已经累计出了非空内容，
    // 且当前帧不再包含任何 "data:" 片段，则视为后端在 end 之后返回的噪声帧，
    // 直接按结束处理，避免继续通过 handleEmptyContent 触发新一轮轮询。
    if (message.dstUrl === '/permission/previewPictureQA' && !raw.includes('data:') && accumulatedContent.length > 0) {
      return this.handlePollingEnd(
        messageId,
        accumulatedContent,
        response.data.sessionId,
        message.sessionId,
        onComplete,
        onStream,
      )
    }

    // 真正带 data: 的帧，继续走专用解析逻辑
    if (message.dstUrl === '/permission/previewPictureQA' && raw.includes('data:')) {

      const isEndFrame = raw.trim().endsWith('end')
      // 按 "data:" 拆分，注意第一个片段可能是空串
      const parts = raw
        .split('data:')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      let accumulated = accumulatedContent
      let latestHistory: BackendHistoryMessage[] | undefined
      let agentStatus: string | undefined

      for (const part of parts) {
        try {
          const jsonStr = part
          if (!jsonStr) continue

          const payload = JSON.parse(jsonStr) as SSEPayload

          if (typeof payload.content === 'string' && payload.content.length > 0) {
            accumulated += payload.content
          }

          if (Array.isArray(payload.history_messages) && payload.history_messages.length > 0) {
            latestHistory = payload.history_messages as BackendHistoryMessage[]
          }

          // 无论 history_messages 是否为空，都要记录当前帧的 agent_status
          // 这样像 { content: "", agent_status: "drawing", history_messages: [] }
          // 这种纯控制帧也能正确触发前端的“绘图中”动画
          if (typeof payload.agent_status === 'string' && payload.agent_status.length > 0) {
            agentStatus = payload.agent_status
          }
        } catch (e) {
          console.warn('[API Service] 预览截图接口 payload 解析失败:', { part, error: e })
        }
      }

      // 如果既没有任何可见内容，也没有 history_messages，说明这只是一个控制帧（例如 drawing 状态），
      // 不应当终止轮询，而是继续按空内容处理逻辑走下一轮 poll。
      if (accumulated === accumulatedContent && (!latestHistory || latestHistory.length === 0)) {
        // 如果是绘图状态，通知前端可以展示“绘图中”动画（不携带文本增量）
        if (onStream && agentStatus === 'drawing') {
          try {
            onStream('', false)
          } catch (e) {
            console.warn('[API Service] 预览截图接口 onStream drawing 控制帧回调失败:', { error: e })
          }
        }

        return this.handleEmptyContent(
          message,
          url,
          onComplete,
          onStream,
          accumulatedContent,
          messageId,
          onHistoryUpdate
        )
      }

      // 如果存在 history_messages，则回调给前端（一次性）
      if (onHistoryUpdate && latestHistory && latestHistory.length > 0) {
        try {
          onHistoryUpdate(latestHistory, agentStatus)
        } catch (e) {
          console.warn('[API Service] 预览截图接口 onHistoryUpdate 回调失败:', { error: e })
        }
      }

      // 计算本帧新增的文本（相对于传入的 accumulatedContent）
      const deltaText = accumulated.slice(accumulatedContent.length)

      if (!isEndFrame) {
        // 中间帧：如果有新增文本，按流式语义推给前端，然后继续轮询
        if (onStream && deltaText) {
          try {
            onStream(deltaText, false)
          } catch (e) {
            console.warn('[API Service] 预览截图接口 onStream 中间帧回调失败:', { error: e })
          }
        }

        const continueMessage = { ...message, reason: 'continue' }

        // 为预览接口保持 1 秒轮询间隔
        await new Promise((resolve) => setTimeout(resolve, 1000))

        return await this.pollChatMessage(
          continueMessage,
          url,
          onComplete,
          onStream,
          accumulated,
          messageId,
          onHistoryUpdate,
        )
      }

      // 结束帧（以 end 结尾）：直接构造最终结果并返回（不再继续轮询）
      const finalResult = {
        success: true,
        messageId,
        reply: accumulated,
        sessionId: response.data.sessionId || message.sessionId,
        timestamp: Date.now(),
      }

      if (onComplete) {
        try {
          onComplete(finalResult)
        } catch (e) {
          console.warn('[API Service] 预览截图接口 onComplete 回调失败:', { error: e })
        }
      }

      // 通知前端流式结束（如果有监听）
      if (onStream) {
        try {
          onStream('', true)
        } catch (e) {
          console.warn('[API Service] 预览截图接口 onStream 结束回调失败:', { error: e })
        }
      }

      return finalResult
    }

    // 第1步：处理结束标记
    if (trimmedChunk === 'end') {
      return this.handlePollingEnd(
        messageId,
        accumulatedContent,
        response.data.sessionId,
        message.sessionId,
        onComplete,
        onStream,
      )
    }

    // 第2步：基于 rawMessage（单行 data: {...} 或普通文本）解析 SSE，提取 content
    let textChunk = ''
    let hasHistoryOnlyPayload = false
    let parsedPayload: SSEPayload | null = null
    let agentStatus: string | undefined
    try {
      const raw = String(rawMessage).trim()

      // 后端保证每次只有一行 data:，因此这里只需处理单行
      if (raw.startsWith('data:')) {
        const jsonStr = raw.slice('data:'.length).trim()
        if (jsonStr) {
          try {
            parsedPayload = JSON.parse(jsonStr) as SSEPayload

            // 记录本帧的 agent_status，供 /permission/chats 等接口用于绘图中状态
            if (typeof parsedPayload.agent_status === 'string' && parsedPayload.agent_status.length > 0) {
              agentStatus = parsedPayload.agent_status
            }

            if (typeof parsedPayload.content === 'string' && parsedPayload.content.length > 0) {
              // 正常内容帧：直接使用 content 作为文本片段
              textChunk = parsedPayload.content
            } else if (
              parsedPayload &&
              parsedPayload.history_messages &&
              Array.isArray(parsedPayload.history_messages) &&
              (!parsedPayload.content || parsedPayload.content.length === 0)
            ) {
              // 仅包含 history_messages 的控制帧，记录标记，后面避免回退到原始 rawMessage
              hasHistoryOnlyPayload = true
            }

            // 第2.1步：如果有 history_messages，触发回调同步到前端
            if (
              onHistoryUpdate &&
              parsedPayload.history_messages &&
              Array.isArray(parsedPayload.history_messages) &&
              parsedPayload.history_messages.length > 0
            ) {
              onHistoryUpdate(
                parsedPayload.history_messages as BackendHistoryMessage[],
                parsedPayload.agent_status
              )
            }

            // 增加与 /permission/previewPictureQA 类似的 drawing 控制帧处理
            if (
              message.dstUrl === '/permission/chats' &&
              !parsedPayload.content &&
              (!parsedPayload.history_messages || parsedPayload.history_messages.length === 0) &&
              agentStatus === 'drawing'
            ) {
              if (onStream) {
                try {
                  onStream('', false)
                } catch (e) {
                  console.warn('[API Service] /permission/chats drawing 控制帧 onStream 回调失败:', { error: e })
                }
              }

              return this.handleEmptyContent(
                message,
                url,
                onComplete,
                onStream,
                accumulatedContent,
                messageId,
                onHistoryUpdate,
              )
            }
          } catch (e) {
            console.warn('[API Service] SSE 行解析失败:', { raw, error: e })
          }
        }
      } else {
        // 非 data: 开头，视为普通文本
        textChunk = raw
      }
    } catch (e) {
      console.warn('[API Service] SSE 消息解析异常，将回退到原始 message 文本:', {
        messageId,
        error: e,
      })
    }

    // 如果是 /permission/chats 且仅为 drawing 控制帧（无文本、无 history），
    // 则触发一次 onStream('', false) 通知前端“绘图中”，并继续轮询。
    if (
      message.dstUrl === '/permission/chats' &&
      parsedPayload &&
      agentStatus === 'drawing' &&
      (!parsedPayload.content || parsedPayload.content.length === 0) &&
      (!parsedPayload.history_messages || parsedPayload.history_messages.length === 0)
    ) {
      if (onStream) {
        try {
          onStream('', false)
        } catch (e) {
          console.warn('[API Service] /permission/chats drawing 控制帧 onStream 回调失败:', { error: e })
        }
      }

      // 视为一帧“空内容”，继续轮询下一帧
      return this.handleEmptyContent(
        message,
        url,
        onComplete,
        onStream,
        accumulatedContent,
        messageId,
        onHistoryUpdate,
      )
    }

    // 如果是仅携带 history_messages 的控制帧，则视为“无可见文本”，避免把 JSON 打到气泡中
    let effectiveChunk = ''
    if (!(hasHistoryOnlyPayload && textChunk === '')) {
      // 如果成功解析出 SSE 内容或前置纯文本，则以解析出的文本为准；否则回退到原始 message 文本
      effectiveChunk = textChunk !== '' ? textChunk : String(rawMessage)
    }

    // 第3步：根据内容类型进行处理
    if (/^[\r\n]+$/.test(effectiveChunk)) {
      // 仅有换行符，不累积内容，只继续轮询
      return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
    }

    if (effectiveChunk.trim() !== '') {
      // 有新内容：累积内容并继续轮询
      return this.handleNewContent(
        effectiveChunk,
        message,
        url,
        onComplete,
        onStream,
        accumulatedContent,
        messageId,
        onHistoryUpdate,
      )
    }

    // 空内容但未结束 - 继续轮询
    return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
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
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ) {
    const newAccumulatedContent = accumulatedContent + chunk
    // 发送流式数据
    if (onStream) {
      try {
        onStream(chunk, false)
        console.log('[API Service] onStream', { messageId, chunk })
      } catch (e) {
        console.error('[API Service] onStream error', { messageId, error: e })
      }
    }

    // 设置为继续轮询并递归调用
    const continueMessage = { ...message, reason: 'continue' }

    // 对截图问答接口（/permission/previewPictureQA）增加固定 1 秒的轮询间隔
    if (message.dstUrl === '/permission/previewPictureQA') {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return await this.pollChatMessage(
      continueMessage,
      url,
      onComplete,
      onStream,
      newAccumulatedContent,
      messageId,
      onHistoryUpdate,
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
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ) {
    const continueMessage = { ...message, reason: 'continue' }

    // 对截图问答接口（/permission/previewPictureQA）增加固定 1 秒的轮询间隔
    if (message.dstUrl === '/permission/previewPictureQA') {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return await this.pollChatMessage(
      continueMessage,
      url,
      onComplete,
      onStream,
      accumulatedContent,
      messageId,
      onHistoryUpdate,
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
      console.error('[ApiService] loginYanban 调用失败:', error)
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
      const result = this.androidBridge.sendTextMessageToTeacher(content, sessionId, subject, 'STUDENT')
      
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
        const result = this.androidBridge.sendPictureToTeacher(imagePath, sessionId, subject, 'STUDENT')
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
   * 第3步：同步登录研伴系统获取YANBAN_TOKEN
   * 第4步：返回token
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

      // 第3步：同步登录研伴系统获取YANBAN_TOKEN（切换账号后立即更新）
      try {
        await this.loginYanban(account, password)
      } catch (yanbanError) {
        // 研伴登录失败不影响主登录流程，仅打印警告
        console.warn('[API] ⚠️ 研伴登录失败，将在需要时自动重试:', yanbanError)
      }

      // 第4步：返回token
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
        const { setUserInfoWithCleanup, initializeStore } = await import("../storage/auth-storage-service");
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
      const response = await this.callYanban<{
        code: number
        success: boolean
        message: string
        data: LoginData
      }>(
        API_ENDPOINTS.LEARNING_RESOURCE.YANBAN_LOGIN,
        loginRequest
      )
      
      // 兼容两种响应结构：
      // 1. 走 Vite 代理时：response.data.data.token
      // 2. 走 Android 原生代理时：response.data.token（原生已经解包一层）
      const respData = response.data as any
      const tokenData = respData?.data || respData

      if (response.success && tokenData && tokenData.token) {
        const loginResponse: LoginResponse = {
          token: tokenData.token,
          userId: tokenData.userId,
          defaultPassword: tokenData.defaultPassword
        }
        
        // 本地状态写入放在独立的 try/catch 中，避免本地存储异常导致整个登录流程失败
        try {
          // 确保token和userId都保存到localStorage
          localStorage.setItem('YANBAN_TOKEN', tokenData.token)
          localStorage.setItem('studentUserId', tokenData.userId)
          
          // 同步更新统一认证存储中的当前用户ID，确保 isSessionValid/autoLogin 能正确识别已登录用户
          try {
            const effectiveUserId = tokenData.userId || account
            if (effectiveUserId) {
              authStorageService.setCurrentUserId(effectiveUserId, UserType.YANBAN)
            }
          } catch (e) {
            
          }

          // 更新登录时间戳，用于会话管理
          localStorage.setItem('lastLoginTime', Date.now().toString())

          // 调试日志：写入完成后再次读取验证
          try {
            const storedToken = localStorage.getItem('YANBAN_TOKEN')
            const storedStudentUserId = localStorage.getItem('studentUserId')
            
          } catch (e) {
            
          }
        } catch (e) {
          // 本地存储出现异常时，仍然返回 loginResponse，避免影响调用方判断登录成功
        }

        return loginResponse
      } else {
        // 登录接口 HTTP 成功但未能从响应中解析出 token，记录结构异常方便排查
        console.warn('[ApiService] loginYanban 响应结构异常，未能解析出 token', {
          httpSuccess: response.success,
          httpCode: response.code,
          hasData: !!response.data,
        })
        return null
      }
    } catch (error) {
      console.error('[ApiService] loginYanban 调用失败:', error)
      return null
    }
  }

  /**
   * 检查学生登录状态
   */
  public isStudentLoggedIn(): boolean {
    const token = localStorage.getItem('YANBAN_TOKEN')
    const userId = localStorage.getItem('userId')
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
      
      // 兼容两种响应结构：
      // 1. 走 Vite 代理时：response.data.data
      // 2. 走 Android 原生代理时：response.data（原生已经解包一层）
      const respData = response.data as any
      const textbooks = respData?.data || respData
      
      if (response.success && Array.isArray(textbooks)) {
        return textbooks
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
      
      // 兼容两种响应结构
      const respData = response.data as any
      const structure = respData?.data || respData
      
      if (response.success && Array.isArray(structure) && structure.length > 0 && structure[0]?.children?.length > 0) {
        return structure[0].children
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
      
      // 兼容两种响应结构
      const respData = response.data as any
      const packagesData = respData?.data || respData
      
      if (response.success && Array.isArray(packagesData)) {
        // 处理学习包数据，确保字段完整性
        const packages = packagesData.map((pkg: LearningPackage) => ({
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
        
        // 缓存到 IndexedDB（按用户ID实现账号隔离）
        if (useCache) {
          try {
            // 这里的 id 即为学习包查询维度（与原 localStorage key 中的 id 一致）
            await saveLearningPackagesToDB(id, packages)
          } catch {
            // 静默处理缓存失败
          }
        }
        
        return packages
      }
      
      return []
    } catch (error) {
      // 网络请求或解析失败，先记录错误，再尝试从 IndexedDB 缓存获取数据
      console.warn('[ApiService] getLearningResources 调用失败，尝试使用缓存', {
        id,
        error: error instanceof Error ? error.message : String(error),
      })

      // 尝试从 IndexedDB 缓存获取数据（按用户ID隔离）
      if (useCache) {
        try {
          const cached = await loadLearningPackagesFromDB(id)
          if (cached && Array.isArray(cached)) {
            return cached
          }
        } catch {
          // 静默处理缓存读取失败
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
      
      // 兼容两种响应结构：
      // 1. 走 Vite 代理时：response.data.data
      // 2. 走 Android 原生代理时：response.data（原生已经解包一层）
      const respData = response.data as any
      const textbooks = respData?.data || respData
      
      if (response.success && Array.isArray(textbooks)) {
        // 🔥 处理封面URL拼接，与后端逻辑保持一致
        // 后端在 LearnResourceManager.fetchUserAllOnlineTextbooks() 第342行拼接URL
        // BASE_URL = "https://www.imates.com.cn:9099"
        const BASE_URL = 'https://www.imates.com.cn:9099'
        
        return textbooks.map((textbook: UserTextbookInfo) => {
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
      
      // 兼容两种响应结构：
      // 1. 走 Vite 代理时：response.data.data
      // 2. 走 Android 原生代理时：response.data（原生已经解包一层）
      const respData = response.data as any
      const textbooks = respData?.data || respData

      if (response.success && Array.isArray(textbooks)) {
        return textbooks as UserTextbookInfo[]
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
   * 提交习题回答
   * @param id 套餐题目ID
   * @param answerContent 回答图片 base64 数组
   * @returns Promise<boolean> 是否提交成功
   */
  async submitTopicAnswer(id: string, answerContent: string[]): Promise<boolean> {
    try {
      const requestBody = {
        id,
        answerContent, // base64 图片字符串数组
      }

      // 调试日志：打印提交作业的请求体（不包含 token）
      console.log('[Debug][Homework] 提交习题回答 请求体 =', requestBody)

      const response = await this.callYanban<{
        code?: number
        data?: unknown
        message?: string
      }>('/blw-edu-yb/api/app/topic-package-answer', requestBody)

      // 调试日志：打印基础响应信息，方便对比 Android 原生日志
      console.log('[Debug][Homework] 提交习题回答 响应概要 =', {
        success: response.success,
        code: response.data?.code,
        message: response.data?.message ?? response.message,
        hasData: !!response.data,
      })

      if (response.success && response.data?.code === 200) {
        return true
      }

      console.error('[ApiService] 提交习题回答失败:', response.data?.message || response.message)
      return false
    } catch (error) {
      console.error('[ApiService] 提交习题回答异常:', error)
      return false
    }
  }

  /**
   * 获取习题发布分页列表
   * @param pageNumber 当前页码（从0开始）
   * @param pageSize 分页大小
   * @param updateTime 最后更新时间（可选）
   * @param subject 学科（可选）
   * @returns Promise<TopicPackagePageResponse | null>
   */
  async getTopicPackagePage(
    pageNumber: number = 0,
    pageSize: number = 20,
    updateTime?: string,
    subject?: string,
  ): Promise<TopicPackagePageResponse | null> {
    try {
      const response = await this.callYanban<TopicPackagePageApiResponse>(
        '/blw-edu-yb/api/app/topic-package-page',
        { pageNumber, pageSize, updateTime, subject }
      )
      
      // 兼容两种响应结构：
      // 1. Vite 代理：response.data.data
      // 2. Android 原生代理：response.data（原生已解包一层）
      const respData = response.data as any
      const pageData = respData?.data || respData

      if (response.success && pageData) {
        const records = (pageData as TopicPackagePageResponse).records || []
        console.log('[Debug][Homework] topic-package-page 返回条数 =', records.length)
        return pageData as TopicPackagePageResponse
      }

      console.error('[ApiService] 获取习题分页列表失败:', response.message, response)
      return null
    } catch (error) {
      console.error('[ApiService] 获取习题分页列表异常:', error)
      return null
    }
  }

}

// 习题分页接口响应类型（作业套餐 + 套餐内题目列表）
export interface TopicQuestionItem {
  id: string
  questionData: string
  [key: string]: unknown
}

export interface TopicPackageItem {
  id: string
  name?: string
  tags?: string
  topicList: TopicQuestionItem[]
  [key: string]: unknown
}

export interface TopicPackagePageResponse {
  records: TopicPackageItem[]
  pageNumber: number
  pageSize: number
  totalPage: number
  totalRow: number
}

interface TopicPackagePageApiResponse {
  code?: number
  data?: TopicPackagePageResponse
  message?: string
}

// 创建默认的 API 服务实例
export const apiService = ApiService.getInstance()
