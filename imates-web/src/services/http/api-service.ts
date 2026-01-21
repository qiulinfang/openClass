/**
 * API 服务层
 * 处理所有网络请求相关的接口调用
 */

import { AndroidBridge } from '../business/android-bridge'
import { getImBaseUrl } from '../../config/env-config'

import { AiChatApi } from './ai-chat-api'
import { TeacherChatApi } from './teacher-chat-api'
import { QuestionSearchApi } from './question-search-api'
import { TextbookDownloadApi } from './textbook-download-api'
import { HomeworkApi } from './homework-api'
import type { TeacherHistoryMessage } from './teacher-chat-api'
// 不再需要导入fileToBase64DataUrl，直接使用传入的Base64数据 

// 使用统一类型定义
import type {
  AiChatMessageRequest,
  TextbookVersion,
  ChapterNode,
  LearningPackage,
  UserTextbookInfo,
  BackendHistoryMessage,
  ManageConversationMemoryRequest,
  FindSimilarQuestionByBmNoRequest,
  HomeworkQueryReq,
  HomeworkQueryResp,
  HomeworkInfoResp,
  HomeworkSubmitSaveReq,
} from '@/types'


// 使用统一的类型定义，不再重复定义

export class ApiService {
  private static instance: ApiService
  private aiChatApi: AiChatApi
  private teacherChatApi: TeacherChatApi
  private questionSearchApi: QuestionSearchApi
  private textbookDownloadApi: TextbookDownloadApi
  private homeworkApi: HomeworkApi

  private constructor() {
    const androidBridge = AndroidBridge.getInstance()
    this.aiChatApi = new AiChatApi()
    this.teacherChatApi = new TeacherChatApi()
    this.questionSearchApi = new QuestionSearchApi()
    this.textbookDownloadApi = new TextbookDownloadApi(androidBridge)
    this.homeworkApi = new HomeworkApi()
  }

  // ========== 对话记忆管理相关接口 ==========

  /**
   * 管理对话记忆（删除部分消息 / 删除整个线程）
   * 通过后端统一接口对 chatbot / solvingbot 的历史进行裁剪
   */
  public async manageConversationMemory(
    payload: ManageConversationMemoryRequest,
  ): Promise<any> {
    return this.aiChatApi.manageConversationMemory(payload)
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService()
    }
    return ApiService.instance
  }

  /**
   * 暂停教材下载
   * 对应Android LearnResourceManager.pauseDownload
   */
  public async pauseDownload(id: string): Promise<boolean> {
    return this.textbookDownloadApi.pauseDownload(id)
  }

  /**
   * 取消教材下载
   * 取消下载会清理已下载的文件数据
   */
  public async cancelDownload(id: string): Promise<boolean> {
    return this.textbookDownloadApi.cancelDownload(id)
  }

  /**
   * 检查是否有活跃的下载任务
   * @param textbookId 教材ID
   * @returns boolean 是否有活跃的下载任务
   */
  public hasActiveDownload(textbookId: string): boolean {
    return this.textbookDownloadApi.hasActiveDownload(textbookId)
  }

  /**
   * 获取习题列表
   */
  public async getExerciseList(subject: string): Promise<any[]> {
    return this.questionSearchApi.getExerciseList(subject)
  }

  /**
   * 删除习题
   */
  public async deleteExercise(exerciseId: string, subject: string): Promise<boolean> {
    return this.questionSearchApi.deleteExercise(exerciseId, subject)
  }

  /**
   * 添加题目到列表
   */
  public async addQuestionToList(questionData: any, subject: string): Promise<boolean> {
    return this.questionSearchApi.addQuestionToList(questionData, subject)
  }

  /**
   * 图片识别搜题（生物或数学）
   * @param imageFile 图片文件（File对象或Blob）
   * @param subject 科目类型（'biology' 或 'math'）
   * @returns Promise<ExerciseItem | null> 识别到的题目，失败返回null
   */
  public async recognizeImage(imageFile: File | Blob, subject: string): Promise<any | null> {
    return this.questionSearchApi.recognizeImage(imageFile, subject)
  }

  /**
   * 文本搜题（生物或数学）
   * @param keyText 搜索关键词
   * @param subject 科目类型（'biology' 或 'math'）
   * @returns Promise<ExerciseItem | null> 搜索到的题目，失败返回null
   */
  public async searchQuestionByText(keyText: string, subject: string): Promise<any | null> {
    return this.questionSearchApi.searchQuestionByText(keyText, subject)
  }

  /**
   * 查找相似题目
   */
  public async findSimilarQuestions(questionData: any, subject: string): Promise<any[]> {
    return this.questionSearchApi.findSimilarQuestions(questionData, subject)
  }

  /**
   * 根据章节节点ID查询知识点ID
   * 对应Android ApiGateWayService.queryKnowledgeIdsByNodeId方法
   * @param request 请求对象，包含subject和param数组
   * @returns Promise<string> 返回知识点ID字符串（逗号分隔）
   * @throws {Error} 当查询失败时抛出错误，如果 count 为 0 则抛出特殊错误（code: 'NO_QUESTIONS'）
   */
  public async queryKnowledgeIdsByNodeId(request: {
    subject: string
    param: Array<{
      textbook_id: string
      section_id: string
    }>
  }): Promise<string> {
    return this.questionSearchApi.queryKnowledgeIdsByNodeId(request)
  }

  /**
   * 根据知识点查找相似题目
   * 对应Android中的findSimilarKnowledgeQuestion方法
   */
  public async findSimilarQuestionsByKnowledge(request: any): Promise<{
    questions: any[]
    totalCount: number
    currentPage: number
    pageSize: number
  }> {
    return this.questionSearchApi.findSimilarQuestionsByKnowledge(request)
  }

  /**
   * 根据 bmNoList 查找相似题目
   * 走独立接口：/biologyTopicKnowledge/knowledgeTopicAndAck2
   */
  public async findSimilarQuestionsByBmNoList(request: FindSimilarQuestionByBmNoRequest): Promise<{
    questions: any[]
    totalCount: number
    currentPage: number
    pageSize: number
  }> {
    return this.questionSearchApi.findSimilarQuestionsByBmNoList(request)
  }

  /**
   * 发送聊天消息至 AI（基于轮询机制实现打字机效果）
   * @param message 聊天消息请求
   * @param onComplete 完成回调
   * @param onStream 流式内容回调
   * @param onHistoryUpdate 历史消息更新回调（用于同步后端全量历史）
   */
  public async sendChatMessage(
    message: AiChatMessageRequest,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ): Promise<any> {
    return this.aiChatApi.sendChatMessage(message, onComplete, onStream, onHistoryUpdate)
  }




  /**
   * 发送消息到教师
   */
  public async sendTeacherMessage(
    sessionId: string,
    msgType: string,
    msgContent: string
  ): Promise<boolean> {
    return this.teacherChatApi.sendMessage(sessionId, msgType, msgContent)
  }

  /**
   * 获取老师会话的消息历史
   */
  public async getTeacherChatHistory(sessionId: string, page?: number, pageSize?: number): Promise<TeacherHistoryMessage[]> {
    return this.teacherChatApi.getTeacherChatHistory(sessionId, page, pageSize)
  }


  /**
   * 获取教材结构 - 修正为与Android端一致的流程
   */
  public async getTextbookStructure(id: string): Promise<ChapterNode[]> {
    return this.textbookDownloadApi.getTextbookStructure(id)
  }

  /**
   * 获取学习资源包 - 修正为与Android端一致的流程，支持缓存
   */
  public async getLearningResources(id: string, useCache: boolean = true): Promise<LearningPackage[]> {
    return this.textbookDownloadApi.getLearningResources(id, useCache)
  }

  // ========== 资源管理相关API ==========

  /**
   * 获取用户所有在线教材
   * 对应Android LearnResourceManager.fetchUserAllOnlineTextbooks
   * 使用与安卓原生一致的接口路径和认证方式
   */
  public async fetchUserAllOnlineTextbooks(): Promise<UserTextbookInfo[]> {
    return this.textbookDownloadApi.fetchUserAllOnlineTextbooks()
  }

  /**
   * 检查教材更新 - 三级对比版本
   * 对应Android LearnResourceManager.checkForUpdates
   * 实现教材→包→文件三级对比逻辑
   */
  public async checkForUpdates(): Promise<TextbookVersion[]> {
    return this.textbookDownloadApi.checkForUpdates()
  }

  public async downloadTextbook(
    textbook: UserTextbookInfo,
    onProgress?: (progress: number, downloadedCount: number, totalToDownload: number) => void,
  ): Promise<boolean> {
    return this.textbookDownloadApi.downloadTextbook(textbook, onProgress)
  }

  public async submitTopicAnswer(id: string, answerContent: string[]): Promise<boolean> {
    return this.textbookDownloadApi.submitTopicAnswer(id, answerContent)
  }

  public async getTopicPackagePage(
    pageNumber: number = 0,
    pageSize: number = 20,
    updateTime?: string,
    subject?: string,
  ): Promise<TopicPackagePageResponse | null> {
    return this.textbookDownloadApi.getTopicPackagePage(pageNumber, pageSize, updateTime, subject)
  }

  // ========== 作业管理相关接口 ==========

  /**
   * 分页查询作业列表
   */
  public async homeworkPage(queryReq: HomeworkQueryReq): Promise<PageResponse<HomeworkQueryResp> | null> {
    return this.homeworkApi.homeworkPage(queryReq)
  }


  /**
   * 获取作业详情
   */
  public async homeworkInfo(homeworkId: string): Promise<HomeworkInfoResp | null> {
    return this.homeworkApi.homeworkInfo(homeworkId)
  }

  /**
   * 提交作业答案
   */
  public async homeworkSubmitSave(homeworkSubmitReq: HomeworkSubmitSaveReq): Promise<boolean> {
    return this.homeworkApi.homeworkSubmitSave(homeworkSubmitReq)
  }

  // ========== 图片上传相关接口 ==========

  /**
   * 上传图片并获取URL（用于转发图片消息）
   * 将base64数据上传到服务器获得可访问的URL
   */
  public async uploadImageAndGetUrl(base64Data: string): Promise<string> {
    console.log(`[API] 开始上传图片...`)

    // 将base64转换为blob
    const base64Parts = base64Data.split(',')
    const mimeType = base64Parts[0].split(':')[1].split(';')[0]
    const byteCharacters = atob(base64Parts[1])

    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: mimeType })

    const formData = new FormData()
    formData.append('file', blob, `forward_image_${Date.now()}.jpg`)

    const response = await fetch('/im/api/images/upload', {
      method: 'POST',
      body: formData
    })

    const result = await response.json()
    if (result.success) {
      console.log(`[API] 图片上传成功，URL: ${result.data.url}`)
      return result.data.url
    } else {
      console.error(`[API] 图片上传失败:`, result.message)
      throw new Error(`图片上传失败: ${result.message}`)
    }
  }
}

// 习题分页接口响应类型（作业套餐 + 套餐内题目列表）
export type TopicQuestionItem = import('./textbook-download-api').TopicQuestionItem

export type TopicPackageItem = import('./textbook-download-api').TopicPackageItem

export type TopicPackagePageResponse = import('./textbook-download-api').TopicPackagePageResponse

// 教师聊天相关类型
export type TeacherHistoryMessage = import('./teacher-chat-api').TeacherHistoryMessage

// 创建默认的 API 服务实例
export const apiService = ApiService.getInstance()
