import { request } from '@/utils/request'
import { getApiPaths, getYanbanBaseUrl } from '@/config/env-config'

/**
 * 作业提交批改详情请求体
 */
export interface HomeworkSubmitJudgeDetailReq {
  id: string
  [key: string]: any
}

/**
 * 作业提交批改详情响应数据
 */
export interface HomeworkSubmitJudgeDetailRes {
  code?: number
  message?: string
  msg?: string
  data?: any
  success?: boolean
  [key: string]: any
}

/**
 * 作业 API 服务类
 */
export class HomeworkApi {
  /**
   * 获取作业提交批改详情 (/homework-submit-judge-detail)
   * @param id 作业提交或批改ID (或 HomeworkSubmitJudgeDetailReq 请求对象)
   */
  static async getSubmitJudgeDetail(
    params: string | HomeworkSubmitJudgeDetailReq
  ): Promise<HomeworkSubmitJudgeDetailRes | null> {
    const paths = getApiPaths()
    const yanbanBaseUrl = getYanbanBaseUrl()

    const requestBody: HomeworkSubmitJudgeDetailReq = typeof params === 'string' ? { id: params } : params

    try {
      const res = await request<any>({
        url: paths.yanban.homework.submitJudgeDetail,
        method: 'POST',
        baseUrl: yanbanBaseUrl,
        data: requestBody
      })
      return res?.data || res
    } catch (e) {
      console.error('[HomeworkApi] 获取作业批改详情失败:', e)
      return null
    }
  }

  /**
   * 获取未完成作业列表 (/homework-undo-list)
   */
  static async getHomeworkUndoList(data: Record<string, any> = {}): Promise<any> {
    const paths = getApiPaths()
    const yanbanBaseUrl = getYanbanBaseUrl()
    try {
      const res = await request<any>({
        url: paths.yanban.homework.undoList,
        method: 'POST',
        baseUrl: yanbanBaseUrl,
        data
      })
      return res?.data || res
    } catch (e) {
      console.error('[HomeworkApi] 获取未完成作业列表失败:', e)
      return null
    }
  }

  /**
   * 获取作业详情列表 (/homework-detail-list)
   */
  static async getHomeworkDetailList(homeworkId: string): Promise<any> {
    const paths = getApiPaths()
    const yanbanBaseUrl = getYanbanBaseUrl()
    try {
      const res = await request<any>({
        url: paths.yanban.homework.detailList,
        method: 'POST',
        baseUrl: yanbanBaseUrl,
        data: { id: homeworkId, homeworkId }
      })
      return res?.data || res
    } catch (e) {
      console.error('[HomeworkApi] 获取作业详情列表失败:', e)
      return null
    }
  }

  /**
   * 提交保存作业 (/homework-submit-save)
   */
  static async submitSave(data: Record<string, any>): Promise<any> {
    const paths = getApiPaths()
    const yanbanBaseUrl = getYanbanBaseUrl()
    try {
      const res = await request<any>({
        url: paths.yanban.homework.submitSave,
        method: 'POST',
        baseUrl: yanbanBaseUrl,
        data
      })
      return res?.data || res
    } catch (e) {
      console.error('[HomeworkApi] 提交保存作业失败:', e)
      return null
    }
  }
}
