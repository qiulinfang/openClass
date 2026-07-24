/**
 * MathRAG v2 拍照搜题与同题判定 HTTP 服务 API
 * 服务地址: http://49.232.39.212:18211
 */

import { ADDRESS_CATALOG } from '@/config/env-config'
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
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || ADDRESS_CATALOG.MATHRAG_V2_SEARCH
  }

  /**
   * 1. 拍照搜题与同题判断 (/v2/search_image)
   */
  public async searchImage(params: SearchImageRequest): Promise<SearchImageResponse> {
    const url = `${this.baseUrl}/v2/search_image`
    const payload = {
      ocr_text: params.ocr_text,
      ocr_confidence: params.ocr_confidence ?? null,
      image_base64: params.image_base64 ?? null,
      k: params.k ?? 5,
      explain: params.explain ?? true,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`[MathRagSearchApi] searchImage 状态码异常: ${response.status}`)
    }

    return (await response.json()) as SearchImageResponse
  }

  /**
   * 2. 文本搜题 (/v2/search)
   */
  public async searchText(params: SearchTextRequest): Promise<SearchTextResponse> {
    const url = `${this.baseUrl}/v2/search`
    const payload = {
      query: params.query,
      k: params.k ?? 5,
      candidate_pool: params.candidate_pool ?? 50,
      min_score: params.min_score ?? 0,
      explain: params.explain ?? false,
      solve_fallback: params.solve_fallback ?? false,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`[MathRagSearchApi] searchText 状态码异常: ${response.status}`)
    }

    return (await response.json()) as SearchTextResponse
  }

  /**
   * 3. 直接对比两道题 (/v2/same_question)
   */
  public async compareSameQuestion(params: SameQuestionRequest): Promise<SameQuestionResponse> {
    const url = `${this.baseUrl}/v2/same_question`
    const payload = {
      query: params.query,
      candidate: params.candidate,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`[MathRagSearchApi] compareSameQuestion 状态码异常: ${response.status}`)
    }

    return (await response.json()) as SameQuestionResponse
  }

  /**
   * 4. 图片 OCR 识别 (/v2/ocr)
   */
  public async recognizeOcr(imageFile: File | Blob, ocrApiKey?: string): Promise<import('@/types').OcrResponse> {
    const url = `${this.baseUrl}/v2/ocr`
    const formData = new FormData()
    formData.append('image', imageFile)

    const headers: Record<string, string> = {}
    if (ocrApiKey) {
      headers['X-OCR-API-Key'] = ocrApiKey
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null)
      throw new Error(errorJson?.detail ?? `[MathRagSearchApi] recognizeOcr 状态码异常: ${response.status}`)
    }

    return (await response.json()) as import('@/types').OcrResponse
  }

  /**
   * 5. 健康检查 (/v2/health)
   */
  public async getHealth(): Promise<MathRagHealthResponse> {
    const url = `${this.baseUrl}/v2/health`
    const response = await fetch(url, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error(`[MathRagSearchApi] getHealth 状态码异常: ${response.status}`)
    }

    return (await response.json()) as MathRagHealthResponse
  }
}

export const mathRagSearchApi = new MathRagSearchApi()
