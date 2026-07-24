import { httpClient } from '../http/http-client'
import type { FindSimilarQuestionByBmNoRequest, ApiResponse } from '@/types'
import { validateKnowledgeTopicAndAck2Request } from '@/stores/utils/requestValidator'
import { normalizeSubject, SUBJECT_TO_EXERCISE_LIST_ENDPOINT, type ApiSubjectType } from '@/constants/subjects'
import { getApiPaths } from '@/config/env-config'

export class QuestionSearchApi {
  public async getExerciseList(subject: string): Promise<any[]> {
    const normalized = normalizeSubject(subject)
    const apiSubject = normalized as ApiSubjectType
    const url = SUBJECT_TO_EXERCISE_LIST_ENDPOINT[apiSubject]
    if (!url) {
      throw new Error(`不支持的科目类型: ${subject}`)
    }

    const response = await httpClient.get<{
      success: boolean
      data: {
        questionsList: any[]
      }
    }>(url)

    if (response.success && (response.data as any)?.data?.questionsList) {
      return (response.data as any).data.questionsList
    }
    return []
  }

  public async deleteExercise(exerciseId: string, subject: string): Promise<boolean> {
    const subjectLower = normalizeSubject(subject).toLowerCase()
    const url = `${getApiPaths().xueban.permission.deleteExercisesBase}/${exerciseId}/${subjectLower}`
    const response = await httpClient.delete(url)
    return response.success
  }

  public async addQuestionToList(questionData: any, subject: string): Promise<ApiResponse<any>> {
    const url = getApiPaths().xueban.permission.exercises

    const requestBody = {
      bmNo: questionData.bmNo || questionData.id,
      type: normalizeSubject(subject).toLowerCase(),
      exercisesId: questionData.exercisesId || '',
      title: questionData.title || questionData.question || '',
      answer: questionData.answer || '',
      explanation: questionData.explanation || questionData.aiExplanation || '',
      analysisData: questionData.analysisData || questionData.answerAnalysis || '',
    }

    return await httpClient.post(url, requestBody)
  }

  public async recognizeImage(imageFile: File | Blob, subject: string): Promise<any | null> {
    const { mathRagSearchApi } = await import('./math-rag-search-api')

    try {
      // 1. 调用新版 MathRAG v2 系统的 /v2/ocr 接口对上传图片进行 PaddleOCR 级提取
      let ocrRes: import('@/types').OcrResponse | null = null
      let rawTitle = ''
      let ocrConfidence = 0.92

      try {
        ocrRes = await mathRagSearchApi.recognizeOcr(imageFile)
        if (ocrRes && ocrRes.questions && ocrRes.questions.length > 0) {
          const topQ = ocrRes.questions[0]
          rawTitle = topQ.question_text || topQ.text || ocrRes.ocr_text || ''
          ocrConfidence = topQ.confidence ?? ocrRes.ocr_confidence ?? 0.92
        } else if (ocrRes?.ocr_text) {
          rawTitle = ocrRes.ocr_text
          ocrConfidence = ocrRes.ocr_confidence ?? 0.92
        }
      } catch (ocrErr) {
        console.warn('[QuestionSearchApi] MathRAG v2 /v2/ocr 接口调用未就绪或报错，回退兼容识别模式:', ocrErr)
      }

      // 2. 如果 /v2/ocr 暂时未能返回文本，作为兼容兜底尝试传统网关识别
      if (!rawTitle) {
        const endpoint =
          normalizeSubject(subject).toLowerCase() === 'biology'
            ? getApiPaths().xueban.permission.img
            : getApiPaths().xueban.permission.imgMath

        const formData = new FormData()
        formData.append('imgFile', imageFile, 'default.jpg')

        const legacyRes = await httpClient.post<{
          success: boolean
          data: { item: { questionsConfirm: Array<{ title: string; id: string; bmNo: string }> } }
        }>(endpoint, formData)

        if (legacyRes.success && (legacyRes.data as any)?.data?.item?.questionsConfirm?.length > 0) {
          rawTitle = (legacyRes.data as any).data.item.questionsConfirm[0].title || ''
        }
      }

      if (!rawTitle) {
        return null
      }

      // 3. 将 OCR 提取到的精细题目文本和置信度送入 /v2/search_image 完成同题与相似题判定
      const ragRes = await mathRagSearchApi.searchImage({
        ocr_text: rawTitle,
        ocr_confidence: ocrConfidence,
        k: 5,
        explain: true,
      })

      const topResult = ragRes.results && ragRes.results.length > 0 ? ragRes.results[0] : null

      return {
        id: topResult?.id || 'temp-' + Date.now(),
        bmNo: String(topResult?.id || ''),
        title: topResult?.question || rawTitle,
        question: topResult?.question || rawTitle,
        answer: '',
        explanation: '',
        analysisData: '',
        subject: subject.toLowerCase(),
        mathRagV2: {
          sameQuestionLabel: ragRes.same_question_label || topResult?.same_question?.label,
          questionBankHit: ragRes.question_bank_hit,
          autoReusable: ragRes.question_bank_auto_reusable,
          autoJudgementFailed: ragRes.auto_judgement_failed,
          failureReason: ragRes.auto_judgement_failure_reason,
          conflicts: topResult?.same_question?.conflicts || [],
          probability: topResult?.same_question?.probability,
          results: ragRes.results || [],
          ocrQuestions: ocrRes?.questions || [],
        },
      }
    } catch (err) {
      console.error('[QuestionSearchApi] recognizeImage 异常:', err)
    }

    return null
  }

  public async searchQuestionByText(keyText: string, subject: string): Promise<any | null> {
    try {
      // 调用 MathRAG v2 /v2/search 进行文本搜题
      const { mathRagSearchApi } = await import('./math-rag-search-api')
      const ragRes = await mathRagSearchApi.searchText({
        query: keyText,
        k: 5,
        candidate_pool: 50,
        min_score: 0,
        explain: true,
      })

      const topResult = ragRes.results && ragRes.results.length > 0 ? ragRes.results[0] : null

      if (topResult) {
        return {
          id: topResult.id,
          bmNo: String(topResult.id),
          title: topResult.question,
          question: topResult.question,
          answer: '',
          explanation: '',
          analysisData: '',
          subject: subject.toLowerCase(),
          mathRagV2: {
            sameQuestionLabel: topResult.same_question?.label || 'similar',
            questionBankHit: true,
            autoReusable: false,
            autoJudgementFailed: false,
            failureReason: null,
            conflicts: topResult.same_question?.conflicts || [],
            probability: topResult.same_question?.probability,
            results: ragRes.results || [],
          },
        }
      }
    } catch (err) {
      console.warn('[QuestionSearchApi] MathRAG v2 文本搜题失败，尝试备用搜题:', err)
    }

    // 备用文本搜题
    const endpointBase =
      normalizeSubject(subject).toLowerCase() === 'biology'
        ? getApiPaths().xueban.permission.textSearchBase
        : getApiPaths().xueban.permission.textSearchMathBase
    const url = `${endpointBase}/${encodeURIComponent(keyText)}`

    const response = await httpClient.get<{
      success: boolean
      code: number
      message: string
      data: {
        item: {
          questionsConfirm: Array<{
            bmNo: string
            title: string
            answer: string
            explanation: string
            analysisData: string
            id: string
          }>
        }
      }
    }>(url)

    if (response.success && (response.data as any)?.data?.item?.questionsConfirm?.length > 0) {
      const questionData = (response.data as any).data.item.questionsConfirm[0]
      return {
        id: questionData.id,
        bmNo: questionData.bmNo,
        title: questionData.title,
        question: questionData.title,
        answer: questionData.answer,
        explanation: questionData.explanation,
        analysisData: questionData.analysisData,
        subject: subject.toLowerCase(),
      }
    }

    return null
  }

  public async findSimilarQuestions(questionData: any, subject: string): Promise<any[]> {
    const url = getApiPaths().xueban.permission.topicAndAck

    const requestBody = {
      bmNo: questionData.bmNo || questionData.id,
      title: questionData.title || questionData.question,
      answer: questionData.answer || '',
      explanation: questionData.explanation || questionData.aiExplanation || '',
      analysisData: questionData.analysisData || questionData.answerAnalysis || '',
      exercisesId: questionData.exercisesId || '',
      type: subject.toLowerCase(),
    }

    const response = await httpClient.post<{
      success: boolean
      data: {
        questions: any[]
      }
    }>(url, requestBody)

    if (response.success && (response.data as any)?.data?.questions) {
      return (response.data as any).data.questions
    }
    return []
  }

  public async queryKnowledgeIdsByNodeId(request: {
    subject: string
    param: Array<{ textbook_id: string; section_id: string }>
  }): Promise<string> {
    const url = '/knowledge'

    const response = await httpClient.post<{
      success: boolean
      subject?: string
      knowledge?: string
      count?: number
      message?: string
    }>(url, request)

    if (!response.success || !response.data) {
      const message = (response.data as any)?.message || response.message || '查询知识点失败'
      throw new Error(message)
    }

    const responseData = response.data as {
      success?: boolean
      subject?: string
      knowledge?: string
      count?: number
      message?: string
    }

    const count =
      responseData.count ??
      (responseData.knowledge ? responseData.knowledge.split(',').filter(id => id.trim()).length : 0)

    if (count === 0 || !responseData.knowledge || responseData.knowledge.trim() === '') {
      const error = new Error('该知识点暂无相关练习题，请选择其他知识点进行练习')
      ;(error as any).code = 'NO_QUESTIONS'
      throw error
    }

    return responseData.knowledge as string
  }

  public async findSimilarQuestionsByKnowledge(request: any): Promise<{
    questions: any[]
    totalCount: number
    currentPage: number
    pageSize: number
  }> {
    const url = getApiPaths().xueban.biologyTopicKnowledge.knowledgeTopicAndAck

    const response = await httpClient.post<{
      success: boolean
      totalCount?: string
      pageNo?: string
      pageSize?: string
      data: {
        questions: any[]
      }
    }>(url, request)

    if (response.success && (response.data as any)?.data?.questions) {
      return {
        questions: (response.data as any).data.questions,
        totalCount:
          parseInt((response.data as any).totalCount || '0') || (response.data as any).data.questions.length,
        currentPage: parseInt((response.data as any).pageNo || '1') || request.current,
        pageSize: parseInt((response.data as any).pageSize || '5') || request.size,
      }
    }

    return {
      questions: [],
      totalCount: 0,
      currentPage: request.current,
      pageSize: request.size,
    }
  }

  public async findSimilarQuestionsByBmNoList(request: FindSimilarQuestionByBmNoRequest): Promise<{
    questions: any[]
    totalCount: number
    currentPage: number
    pageSize: number
  }> {
    const url = getApiPaths().xueban.biologyTopicKnowledge.knowledgeTopicAndAck2

    // 后端入参 TopicVO：目前核心只需要 bmNoList（必填）+ exercisesId（字段存在但实现里可能未使用）
    const requestBody: any = {
      bmNoList: request.bmNoList,
      exercisesId: request.exercisesId,
    }

    validateKnowledgeTopicAndAck2Request(requestBody)

    const response = await httpClient.post<{
      success: boolean
      data: {
        questions: any[]
      }
      message?: string
    }>(url, requestBody)

    const questions = (response.data as any)?.data?.questions || []

    if (response.success && Array.isArray(questions)) {
      return {
        questions,
        totalCount: questions.length,
        currentPage: request.current,
        pageSize: request.size,
      }
    }

    return {
      questions: [],
      totalCount: 0,
      currentPage: request.current,
      pageSize: request.size,
    }
  }
}
