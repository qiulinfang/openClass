/**
 * 作业管理 API
 * 处理作业相关的网络请求
 */

import { httpClient } from '@/services/http/http-client'
import type { ApiResponse } from '@/types'
import { getApiPaths } from '@/config/env-config'

import type {
  IdReq,
  HomeworkSubmitSaveReq,
  HomeworkUndoItem,
  HomeworkQuestionDetail,
  HomeworkQueryReq,
  RecognizeHandwrittenFormulaJsonRequest,
  RecognizeHandwrittenFormulaResponse
} from '@/types'

export type GaokaoQuestionType = 'single_choice' | 'multiple_choice' | 'judgment' | 'subjective'

export interface GaokaoAgentQuestionReq {
  question: string
  answer?: string
  analysis?: string
}

export type GaokaoAgentResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export interface GaokaoQuestionTypeData {
  questionType: GaokaoQuestionType
}

export interface GaokaoChoiceOption {
  optionId: string
  optionContent: string
}

export interface GaokaoChoiceParseData {
  questionType: Exclude<GaokaoQuestionType, 'subjective'>
  questionContent: string
  options: GaokaoChoiceOption[]
}

export interface HomeworkSubmitSaveResult {
  success: boolean
  message?: string
}

export class HomeworkApi {
  constructor() {
  }

  private readonly gaokaoAgentBaseUrl = 'http://49.232.39.212:9011'
  private readonly hwFormulaRecognizeBaseUrl = 'http://49.232.39.212:9012'

  /**
   * 手写公式识别 (Base64 JSON)
   */
  public async recognizeHandwrittenFormula(image: string): Promise<RecognizeHandwrittenFormulaResponse | null> {
    const endpoint = '/api/recognize-handwritten-formula-image/json'
    // 去掉 data:image/xxx;base64, 前缀，只保留纯 Base64 字符串
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '')
    const body: RecognizeHandwrittenFormulaJsonRequest = {
      file: base64Data,
      filename: 'handwritten_formula.png'
    }
    try {
      const response = await httpClient.post<RecognizeHandwrittenFormulaResponse>(endpoint, body)
      // 如果请求本身失败（success 为 false），直接返回整个响应对象，让上层能看到 code
      if (!response.success) {
        return response as any
      }
      return response.data
    } catch (error) {
      console.error('[HomeworkApi] recognizeHandwrittenFormula error:', error)
      return null
    }
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

  /**
   * 高考AI接口 - 题型识别
   */
  public async gaokaoQuestionType(req: GaokaoAgentQuestionReq): Promise<GaokaoAgentResponse<GaokaoQuestionTypeData>> {
    const endpoint = '/v1/question/type'
    try {
      const response = await httpClient.post<GaokaoAgentResponse<GaokaoQuestionTypeData>>(endpoint, {
        question: req.question,
        answer: req.answer || '',
        analysis: req.analysis || '',
      })

      if (response.success && response.data) {
        return response.data
      }
      return { success: false, error: response.message || '题型识别失败' }
    } catch (error) {
      console.error('[HomeworkApi] gaokaoQuestionType error:', error)
      return { success: false, error: error instanceof Error ? error.message : '题型识别失败' }
    }
  }

  /**
   * 高考AI接口 - 选择题拆分
   */
  public async gaokaoChoiceParse(req: GaokaoAgentQuestionReq): Promise<GaokaoAgentResponse<GaokaoChoiceParseData>> {
    const endpoint = '/v1/question/choice/parse'
    try {
      const response = await httpClient.post<GaokaoAgentResponse<GaokaoChoiceParseData>>(endpoint, {
        question: req.question,
        answer: req.answer || '',
        analysis: req.analysis || '',
      })

      if (response.success && response.data) {
        return response.data
      }
      return { success: false, error: response.message || '选择题拆分失败' }
    } catch (error) {
      console.error('[HomeworkApi] gaokaoChoiceParse error:', error)
      return { success: false, error: error instanceof Error ? error.message : '选择题拆分失败' }
    }
  }
}
