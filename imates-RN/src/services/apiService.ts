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
}

// 导出单例
export const apiService = new ApiService()

