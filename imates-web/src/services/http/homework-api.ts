/**
 * 作业管理 API
 * 处理作业相关的网络请求
 */

import { httpClient } from './http-client'
import type { ApiResponse } from '@/types'
import { getApiPaths } from '@/config/env-config'

import type { IdReq, HomeworkSubmitSaveReq, HomeworkUndoItem, HomeworkQuestionDetail, HomeworkQueryReq } from '@/types'

export interface HomeworkSubmitSaveResult {
  success: boolean
  message?: string
}

export class HomeworkApi {
  constructor() {
  }

  /**
   * 获取未完成作业列表
   */
  public async getHomeworkUndoList(queryReq?: HomeworkQueryReq): Promise<HomeworkUndoItem[]> {
    const endpoint = getApiPaths().yanban.homework.undoList
    try {
      const response = await httpClient.post<{
        code?: number
        data?: HomeworkUndoItem[]
        msg?: string
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
    const endpoint = getApiPaths().yanban.homework.detailList
    const requestBody: IdReq = { id: homeworkId }
    try {
      const response = await httpClient.post<{
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
  public async homeworkSubmitSave(homeworkSubmitReq: HomeworkSubmitSaveReq): Promise<HomeworkSubmitSaveResult> {
    const endpoint = getApiPaths().yanban.homework.submitSave
    try {
      const response = await httpClient.post<{
        code?: number
        data?: HomeworkSubmitSaveResult
        msg?: string
        success?: boolean
      }>(endpoint, homeworkSubmitReq)

      const data: any = (response as any).data
      const ok = !!data?.success
      const backendMessage: string | undefined = data?.message || response.message

      return ok ? { success: true } : { success: false, message: backendMessage || '提交失败' }
    } catch (error) {
      console.error('[HomeworkApi] homeworkSubmitSave error:', error)
      return { success: false, message: error instanceof Error ? error.message : '提交失败' }
    }
  }
}
