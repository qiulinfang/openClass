/**
 * 作业管理 API
 * 处理作业相关的网络请求
 */

import { httpClient } from './http-client'
import type { ApiResponse } from '@/types'

import type { IdReq, HomeworkSubmitSaveReq, HomeworkUndoItem, HomeworkQuestionDetail, HomeworkQueryReq } from '@/types'
import { AppEnvType, getCurrentEnvType } from '@/config/env-config'
import { getYanbanToken } from './auth-service'
import { AndroidBridge } from '../business/android-bridge'

export class HomeworkApi {
  private readonly androidBridge: AndroidBridge

  constructor() {
    this.androidBridge = AndroidBridge.getInstance()
  }

  private async callYanban<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
    const envType = getCurrentEnvType()
    const bridgeAvailable = this.androidBridge.isAndroidBridgeAvailable()

    try {
      console.log('[HomeworkApi] callYanban:', {
        envType,
        bridgeAvailable,
        url,
        hasBody: body !== undefined && body !== null,
      })
    } catch {
    }

    if (envType === AppEnvType.INTERNAL_TEST && bridgeAvailable) {
      const apiPath = url.replace('/blw-edu-yb', '')
      const yanbanToken = getYanbanToken() || ''

      try {
        console.log('[HomeworkApi] callYanban -> AndroidBridge:', {
          url,
          apiPath,
          tokenPreview: yanbanToken ? `${yanbanToken.slice(0, 6)}...${yanbanToken.slice(-4)}` : '',
        })
      } catch {
      }
      const result = await this.androidBridge.callYanbanApi(apiPath, body, 'POST', envType, yanbanToken)

      return {
        success: (result as any)?.success ?? false,
        data: result as T,
        code: (result as any)?.code ?? ((result as any)?.success ? 200 : 0),
        message: (result as any)?.message,
      }
    }

    try {
      console.log('[HomeworkApi] callYanban -> HttpClient:', { url })
    } catch {
    }
    return httpClient.post<T>(url, body)
  }

  /**
   * 获取未完成作业列表
   */
  public async getHomeworkUndoList(queryReq?: HomeworkQueryReq): Promise<HomeworkUndoItem[]> {
    const endpoint = '/blw-edu-yb/api/app/homework-undo-list'
    try {
      const response = await this.callYanban<{
        code?: number
        data?: HomeworkUndoItem[]
        message?: string
      }>(endpoint, queryReq || {})

      if (response.success && response.data?.code === 200) {
        return response.data.data || []
      }
      return []
    } catch (error) {
      console.error('[HomeworkApi] getHomeworkUndoList error:', error)
      return []
    }
  }

  /**
   * 获取作业详情（问题列表）
   */
  public async getHomeworkDetailList(homeworkId: string): Promise<HomeworkQuestionDetail[]> {
    const endpoint = '/blw-edu-yb/api/app/homework-detail-list'
    const requestBody: IdReq = { id: homeworkId }
    try {
      const response = await this.callYanban<{
        code?: number
        data?: HomeworkQuestionDetail[]
        message?: string
      }>(endpoint, requestBody)

      if (response.success && response.data?.code === 200) {
        return response.data.data || []
      }
      return []
    } catch (error) {
      console.error('[HomeworkApi] getHomeworkDetailList error:', error)
      return []
    }
  }

  /**
   * 提交作业答案
   */
  public async homeworkSubmitSave(homeworkSubmitReq: HomeworkSubmitSaveReq): Promise<boolean> {
    const endpoint = '/blw-edu-yb/api/app/homework-submit-save'
    try {
      const response = await this.callYanban<{
        code?: number
        data?: Record<string, unknown>
        message?: string
      }>(endpoint, homeworkSubmitReq)

      return !!(response.success && response.data?.code === 200)
    } catch (error) {
      console.error('[HomeworkApi] homeworkSubmitSave error:', error)
      return false
    }
  }
}
