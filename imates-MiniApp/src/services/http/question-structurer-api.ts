import { httpClient } from './http-client'
import { getQuestionStructurerBaseUrl } from '@/config/env-config'
import type { ApiResponse } from '@/types'

/**
 * 题目结构化服务请求参数
 */
export interface StructureQuestionReq {
  id: string
  subject: string
  score?: number
  type_hint?: string
  question: string
  answer: string
}

/**
 * 批量题目结构化服务请求参数
 */
export interface StructureQuestionBatchReq {
  questions: StructureQuestionReq[]
}

/**
 * 题目结构化服务接口
 */
export class QuestionStructurerApi {
  private get baseUrl(): string {
    return getQuestionStructurerBaseUrl()
  }

  /**
   * 单道题结构化
   * @param req 请求参数
   */
  public async structureQuestion(req: StructureQuestionReq): Promise<ApiResponse<any>> {
    const url = `${this.baseUrl}/structure_question`
    return httpClient.post<any>(url, req)
  }

  /**
   * 批量题目结构化
   * @param req 请求参数
   */
  public async structureQuestionBatch(req: StructureQuestionBatchReq): Promise<ApiResponse<any>> {
    const url = `${this.baseUrl}/structure_question_batch`
    return httpClient.post<any>(url, req)
  }

  /**
   * 健康检查
   */
  public async checkHealth(): Promise<ApiResponse<any>> {
    const url = `${this.baseUrl}/health`
    return httpClient.get<any>(url)
  }

  /**
   * 查看服务配置和可用接口
   */
  public async getServiceInfo(): Promise<ApiResponse<any>> {
    const url = `${this.baseUrl}/service_info`
    return httpClient.get<any>(url)
  }
}
