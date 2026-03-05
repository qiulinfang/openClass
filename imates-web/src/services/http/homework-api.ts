/**
 * 作业管理 API
 * 处理作业相关的网络请求
 */

import { httpClient } from './http-client'
import type { ApiResponse } from '@/types'

import type { IdReq, HomeworkSubmitSaveReq, HomeworkUndoItem, HomeworkQuestionDetail, HomeworkQueryReq } from '@/types'

export class HomeworkApi {
  constructor() {
  }

  /**
   * 获取未完成作业列表
   */
  public async getHomeworkUndoList(queryReq?: HomeworkQueryReq): Promise<HomeworkUndoItem[]> {
    const endpoint = '/blw-edu-yb/api/app/homework-undo-list'
    try {
      const response = await httpClient.post<{
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
  public async homeworkSubmitSave(homeworkSubmitReq: HomeworkSubmitSaveReq): Promise<boolean> {
    const endpoint = '/blw-edu-yb/api/app/homework-submit-save'
    try {
      const response = await httpClient.post<{
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
