/**
 * API 服务层
 * 封装所有业务相关的 API 接口调用
 */

import { HttpClient, ApiResponse } from './httpClient'
import { API_ENDPOINTS, getApiUrl } from './apiEndpoints'
import { StorageService, StorageKeys } from './storageService'
import type { ExerciseItem } from '../types/exercise'
// 注意：纯RN应用不需要桥接服务
// import { AndroidBridgeService } from './androidBridgeService'

export interface UserInfo {
  id?: string
  name: string
  avatar?: string
  roles?: string[]
  [key: string]: unknown
}

export interface LoginResponse {
  success: boolean
  message: string
  data?: {
    token: string
  }
}

/**
 * AI 聊天消息请求接口
 */
export interface AiChatMessageRequest {
  sessionId: string
  newValue: string
  coversation: string
  question: string
  answer: string
  name: string
  reason: string
  dstUrl?: string
  bmNo: string
  isWebSearch: string
  chatRole: string
}

/**
 * AI 聊天响应接口
 */
export interface AiChatResponse {
  success: boolean
  messageId: string
  reply: string
  sessionId?: string
  timestamp?: number
}

class ApiService {
  private httpClient: HttpClient
  private baseUrl: string

  constructor() {
    this.httpClient = new HttpClient()
    // 第1步：初始化时设置基础URL
    // 注意：在React Native中需要根据环境配置基础URL
    this.baseUrl = 'http://www.imates.com.cn:8222/blw-edu-service-alc'
  }

  /**
   * 设置基础URL
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl
    this.httpClient.setBaseURL(baseUrl)
  }

  /**
   * 用户登录（管理员登录）
   * 第1步：发送登录请求
   * 第2步：保存token和用户凭据到AsyncStorage
   * 第3步：返回token
   * @param account 账号
   * @param password 密码（明文，与Android端LoginActivity保持一致）
   * @returns Promise<string> 返回token
   */
  async loginXueban(account: string, password: string): Promise<string> {
    try {
      // 第1步：发送登录请求
      const url = getApiUrl(API_ENDPOINTS.USER.XUEBAN_LOGIN, this.baseUrl)
      const response = await this.httpClient.post<LoginResponse>(url, {
        account,
        password,
      })

      if (!response.success || !response.data?.data) {
        throw new Error(response.message || '登录失败')
      }

      const token = response.data.data.token

      // 第2步：保存token和用户凭据到AsyncStorage
      await StorageService.setItem(StorageKeys.XUEBAN_TOKEN, token)
      await StorageService.setItem(StorageKeys.USER_ID, account)
      await StorageService.setItem(StorageKeys.USER_PASSWORD, password)
      await StorageService.setItem(StorageKeys.LAST_LOGIN_TIME, Date.now().toString())

      // 第3步：返回token
      return token
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : '登录失败')
    }
  }

  /**
   * 获取用户信息
   * 第1步：调用API获取用户信息
   * 第2步：持久化到AsyncStorage
   * 
   * 注意：纯RN应用不需要同步到原生ViewModel
   * 如果需要与原生应用集成，可以调用 AndroidBridgeService.syncUserInfo()
   * 
   * @param token 用户token
   * @returns Promise<UserInfo> 用户信息
   */
  async getUserInfo(token: string): Promise<UserInfo> {
    try {
      // 第1步：调用API获取用户信息
      const url = getApiUrl(`${API_ENDPOINTS.USER.ADMIN_INFO}?token=${token}`, this.baseUrl)
      const response = await this.httpClient.get<ApiResponse<UserInfo>>(url)

      if (!response.success || !response.data) {
        throw new Error(response.message || '获取用户信息失败')
      }

      const userInfo = response.data

      // 第2步：持久化用户信息到AsyncStorage
      try {
        await StorageService.setItem('userInfo', JSON.stringify(userInfo))
      } catch (storageError) {
        console.error('[API] ❌ 持久化用户信息失败:', storageError)
      }

      // 注意：纯RN应用不需要同步到原生ViewModel
      // 如果需要与原生应用集成，可以取消注释以下代码：
      // try {
      //   const userId = await StorageService.getItem<string>(StorageKeys.USER_ID)
      //   const userPassword = await StorageService.getItem<string>(StorageKeys.USER_PASSWORD)
      //   if (userId && token) {
      //     await AndroidBridgeService.syncUserInfo(userId, token, userPassword || '')
      //   }
      // } catch (syncError) {
      //   console.error('[API] ❌ 同步用户信息到Android失败:', syncError)
      // }

      return userInfo
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : '获取用户信息失败')
    }
  }

  /**
   * 获取题目列表
   * @param subject 科目类型（math 或 biology）
   * @returns Promise<ExerciseItem[]> 题目列表
   */
  async getExerciseList(subject: string): Promise<any[]> {
    try {
      const endpoint = subject.toLowerCase() === 'biology' 
        ? API_ENDPOINTS.EXERCISES.LIST_BIOLOGY 
        : API_ENDPOINTS.EXERCISES.LIST_MATH
      const url = getApiUrl(endpoint, this.baseUrl)
      
      const response = await this.httpClient.get<ApiResponse<{
        questionsList: any[]
      }>>(url)

      if (response.success && response.data?.questionsList) {
        return response.data.questionsList
      }
      return []
    } catch (error) {
      console.error('[API] ❌ 获取题目列表失败:', error)
      return []
    }
  }

  /**
   * 删除题目
   * @param exerciseId 题目ID
   * @param subject 科目类型（math 或 biology）
   * @returns Promise<boolean> 是否成功
   */
  async deleteExercise(exerciseId: string, subject: string): Promise<boolean> {
    try {
      const endpoint = `${API_ENDPOINTS.EXERCISES.DELETE_BASE}/${exerciseId}/${subject.toLowerCase()}`
      const url = getApiUrl(endpoint, this.baseUrl)
      
      const response = await this.httpClient.delete<ApiResponse<unknown>>(url)
      return response.success
    } catch (error) {
      console.error('[API] ❌ 删除题目失败:', error)
      return false
    }
  }

  /**
   * 发送聊天消息至 AI（基于轮询机制实现打字机效果）
   * 
   * 注意：React Native 版本的实现需要简化，不需要流式响应回调
   */
  async sendChatMessage(
    message: AiChatMessageRequest,
  ): Promise<AiChatResponse> {
    try {
      // 第1步：验证 dstUrl 是否存在
      if (!message.dstUrl) {
        throw new Error('dstUrl is required. Please set message.dstUrl explicitly in the message builder.')
      }

      // 第2步：构造完整的请求URL
      const url = getApiUrl(message.dstUrl, this.baseUrl)

      // 第3步：构建请求体
      const requestBody = {
        sessionId: message.sessionId,
        newValue: message.newValue,
        coversation: message.coversation,
        question: message.question,
        answer: message.answer,
        name: message.name,
        reason: message.reason,
        bmNo: message.bmNo,
        isWebSearch: message.isWebSearch,
        role: message.chatRole,
      }

      // 第4步：开始轮询聊天
      return await this.pollChatMessage(message, url, requestBody)
    } catch (error) {
      console.error('[API] ❌ 发送聊天消息失败:', error)
      return {
        success: false,
        messageId: '',
        reply: '发送消息失败: ' + (error as Error).message,
        timestamp: Date.now(),
      }
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
    requestBody: any,
    accumulatedContent: string = '',
    messageId: string = 'ai_' + Date.now(),
  ): Promise<AiChatResponse> {
    try {
      // 第1步：发送HTTP请求
      const response = await this.httpClient.post<{
        success: boolean
        message?: string
        sessionId?: string
      }>(url, requestBody, {
        retries: 0, // 禁用HTTP层自动重试，避免与业务层重试冲突
        timeout: 10000, // 设置10秒超时
      })

      // 第2步：处理响应
      return await this.handleChatResponse(
        response,
        message,
        url,
        requestBody,
        accumulatedContent,
        messageId
      )
    } catch (error) {
      // 第3步：处理异常
      return this.handleChatError(error, messageId, accumulatedContent)
    }
  }

  /**
   * 处理聊天响应
   * 根据响应内容决定是结束轮询、继续轮询还是处理错误
   */
  private async handleChatResponse(
    response: ApiResponse<{
      success: boolean
      message?: string
      sessionId?: string
    }>,
    message: AiChatMessageRequest,
    url: string,
    requestBody: any,
    accumulatedContent: string,
    messageId: string,
  ): Promise<AiChatResponse> {
    // 检查响应是否成功
    if (!response.success || !response.data) {
      return this.createErrorResult(messageId, accumulatedContent || '请求失败，请重试。')
    }

    const chunk = response.data.message || ''
    const trimmedChunk = chunk.trim()

    // 根据响应内容类型进行处理
    if (trimmedChunk === 'end') {
      // 轮询结束 - 返回最终结果
      return {
        success: true,
        messageId,
        reply: accumulatedContent,
        sessionId: response.data.sessionId || message.sessionId,
        timestamp: Date.now(),
      }
    } else if (trimmedChunk !== '') {
      // 有新内容 - 累积内容并继续轮询
      const newAccumulatedContent = accumulatedContent + chunk
      const continueRequestBody = { ...requestBody, reason: 'continue' }
      return await this.pollChatMessage(
        { ...message, reason: 'continue' },
        url,
        continueRequestBody,
        newAccumulatedContent,
        messageId,
      )
    } else {
      // 空内容但未结束 - 继续轮询
      const continueRequestBody = { ...requestBody, reason: 'continue' }
      return await this.pollChatMessage(
        { ...message, reason: 'continue' },
        url,
        continueRequestBody,
        accumulatedContent,
        messageId,
      )
    }
  }

  /**
   * 处理聊天错误
   * 统一处理网络错误和其他异常情况
   */
  private handleChatError(
    error: any,
    messageId: string,
    accumulatedContent: string,
  ): AiChatResponse {
    const errorMessage = accumulatedContent || '网络错误: ' + (error as Error).message
    return this.createErrorResult(messageId, errorMessage)
  }

  /**
   * 创建错误结果
   * 统一创建错误响应格式
   */
  private createErrorResult(
    messageId: string,
    errorMessage: string,
  ): AiChatResponse {
    return {
      success: false,
      messageId,
      reply: errorMessage,
      timestamp: Date.now(),
    }
  }
}

// 导出单例
export const apiService = new ApiService()

