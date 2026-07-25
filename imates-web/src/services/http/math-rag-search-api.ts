/**
 * MathRAG v2 拍照搜题与同题判定 HTTP 服务 API
 * 服务地址: http://49.232.39.212:18211
 */

import { httpClient } from './http-client'
import type {
  SearchImageRequest,
  SearchImageResponse,
  SearchTextRequest,
  SearchTextResponse,
  SameQuestionRequest,
  SameQuestionResponse,
  MathRagHealthResponse,
} from '@/types'

export class MathRagSearchApi {
  /**
   * 1. 拍照搜题与同题判断 (/v2/search_image)
   */
  public async searchImage(params: SearchImageRequest): Promise<SearchImageResponse> {
    const payload = {
      ocr_text: params.ocr_text,
      ocr_confidence: params.ocr_confidence ?? null,
      image_base64: params.image_base64 ?? null,
      k: params.k ?? 5,
      explain: params.explain ?? true,
    }

    const response = await httpClient.post<SearchImageResponse>(
      '/v2/search_image',
      payload,
      { skipAuth401Retry: true }
    )
    return response.data!
  }

  /**
   * 2. 文本搜题 (/v2/search)
   */
  public async searchText(params: SearchTextRequest): Promise<SearchTextResponse> {
    const response = await httpClient.post<SearchTextResponse>(
      '/v2/search',
      params,
      { skipAuth401Retry: true }
    )
    return response.data!
  }

  /**
   * 3. 同题判别接口 (/v2/same_question)
   */
  public async judgeSameQuestion(params: SameQuestionRequest): Promise<SameQuestionResponse> {
    const response = await httpClient.post<SameQuestionResponse>(
      '/v2/same_question',
      params,
      { skipAuth401Retry: true }
    )
    return response.data!
  }

  /**
   * 4. 图片 OCR 识别 (/v2/ocr)
   */
  public async recognizeOcr(imageFile: File | Blob, ocrApiKey?: string): Promise<import('@/types').OcrResponse> {
    const formData = new FormData()
    formData.append('image', imageFile)

    const apiKey = ocrApiKey || (import.meta as any).env?.VITE_MATHRAG_OCR_API_KEY || ''

    const headers: Record<string, string> = {}
    if (apiKey) {
      headers['X-OCR-API-Key'] = apiKey
    }

    const response = await httpClient.post<import('@/types').OcrResponse>(
      '/v2/ocr',
      formData,
      { headers, skipAuth401Retry: true }
    )
    return response.data!
  }

  /**
   * 5. 健康检查 (/v2/health)
   */
  public async checkHealth(): Promise<MathRagHealthResponse> {
    const response = await httpClient.get<MathRagHealthResponse>('/v2/health', { skipAuth401Retry: true })
    return response.data!
  }
}

export const mathRagSearchApi = new MathRagSearchApi()
