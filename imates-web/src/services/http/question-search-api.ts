import { httpClient } from '../http/http-client'
import type { FindSimilarQuestionByBmNoRequest } from '@/types'

export class QuestionSearchApi {
  public async getExerciseList(subject: string): Promise<any[]> {
    const subjectLower = subject.toLowerCase()
    const url =
      subjectLower === 'biology' || subjectLower === '生物'
        ? '/permission/selectExercises/biology'
        : subjectLower === 'math' || subjectLower === '数学'
          ? '/permission/selectExercises/math'
          : (() => {
              throw new Error(`不支持的科目类型: ${subject}`)
            })()

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
    const subjectLower = subject.toLowerCase()
    const url = `/permission/deleteExercises/${exerciseId}/${subjectLower}`
    const response = await httpClient.delete(url)
    return response.success
  }

  public async addQuestionToList(questionData: any, subject: string): Promise<boolean> {
    const url = '/permission/exercises'

    const requestBody = {
      bmNo: questionData.bmNo || questionData.id,
      type: subject.toLowerCase(),
      exercisesId: questionData.exercisesId || '',
      title: questionData.title || questionData.question || '',
      answer: questionData.answer || '',
      explanation: questionData.explanation || questionData.aiExplanation || '',
      analysisData: questionData.analysisData || questionData.answerAnalysis || '',
    }

    const response = await httpClient.post(url, requestBody)
    return response.success
  }

  public async recognizeImage(imageFile: File | Blob, subject: string): Promise<any | null> {
    const endpoint = subject.toLowerCase() === 'biology' ? '/permission/img' : '/permission/imgMath'

    const formData = new FormData()
    formData.append('imgFile', imageFile, 'default.jpg')

    const response = await httpClient.post<{
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
    }>(endpoint, formData)

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

  public async searchQuestionByText(keyText: string, subject: string): Promise<any | null> {
    const endpoint = subject.toLowerCase() === 'biology' ? '/permission/textSearch' : '/permission/textSearchMath'
    const url = `${endpoint}/${encodeURIComponent(keyText)}`

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
    const url = '/permission/topicAndAck'

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
    const url = '/biologyTopicKnowledge/knowledgeTopicAndAck'

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
    const mappedRequest: any = {
      bmNoList: request.bmNoList,
      exercisesId: request.exercisesId,
      type: request.type,
      size: request.size,
      current: request.current,
      totalCount: request.totalCount,
    }

    return this.findSimilarQuestionsByKnowledge(mappedRequest)
  }
}
