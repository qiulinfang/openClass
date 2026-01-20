/**
 * 作业管理 API
 * 处理作业相关的网络请求
 */

import { httpClient } from './http-client'
import type { HomeworkQueryResp, HomeworkQueryReq, HomeworkInfoResp, IdReq, HomeworkSubmitSaveReq, PageResponse } from '@/types'

export class HomeworkApi {
  /**
   * 分页查询作业列表
   */
  public async homeworkPage(queryReq: HomeworkQueryReq): Promise<PageResponse<HomeworkQueryResp> | null> {
    const endpoint = '/homework/homeworkPage'
    try {
      const response = await httpClient.post<{
        code?: number
        data?: PageResponse<HomeworkQueryResp>
        message?: string
      }>(endpoint, queryReq)

      if (response.success && response.data?.code === 200) {
        return response.data.data || null
      }
      return null
    } catch (error) {
      console.error('[HomeworkApi] homeworkPage error:', error)
      return null
    }
  }


  /**
   * 获取作业详情
   */
  public async homeworkInfo(homeworkId: string): Promise<HomeworkInfoResp | null> {
    const endpoint = '/homework/homeworkInfo'
    const requestBody: IdReq = { id: homeworkId }
    try {
      const response = await httpClient.post<{
        code?: number
        data?: HomeworkInfoResp
        message?: string
      }>(endpoint, requestBody)

      if (response.success && response.data?.code === 200) {
        return response.data.data || null
      }
      return null
    } catch (error) {
      console.error('[HomeworkApi] homeworkInfo error:', error)
      return null
    }
  }

  /**
   * 提交作业答案
   */
  public async homeworkSubmitSave(homeworkSubmitReq: HomeworkSubmitSaveReq): Promise<boolean> {
    const endpoint = '/homework-submit-save'
    try {
      const response = await httpClient.post<{
        code?: number
        data?: any
        message?: string
      }>(endpoint, homeworkSubmitReq)

      return !!(response.success && response.data?.code === 200)
    } catch (error) {
      console.error('[HomeworkApi] homeworkSubmitSave error:', error)
      return false
    }
  }
}
