/**
 * API 服务层
 * 处理所有网络请求相关的接口调用
 */

import { AndroidBridge } from '../business/android-bridge'

import { AiChatApi } from './ai-chat-api'
import { QuestionSearchApi } from './question-search-api'
import { TextbookDownloadApi } from './textbook-download-api'
// 不再需要导入fileToBase64DataUrl，直接使用传入的Base64数据 

// 使用统一类型定义
import type {
  UserInfo,
  AiChatMessageRequest,
  TextbookVersion,
  TextbookOption,
  TextbookStructureRequest,
  LearningResourcesRequest,
  ChapterNode,
  LearningPackage,
  LoginResponse,
  LoginRequest,
  LoginData,
  XuebanLoginResponse,
  FeedbackTicketRequest,
  FeedbackTicketResponse,
  UserTextbookInfo,
  ResourceFile,
  LocalFileInfo,
  BackendHistoryMessage,
  SSEPayload,
  ManageConversationMemoryRequest,
  FindSimilarQuestionByBmNoRequest,
  ApiResponse,
} from '@/types'


// 使用统一的类型定义，不再重复定义

export class ApiService {
  private static instance: ApiService
  private aiChatApi: AiChatApi
  private questionSearchApi: QuestionSearchApi
  private textbookDownloadApi: TextbookDownloadApi

  private constructor() {
    const androidBridge = AndroidBridge.getInstance()
    this.aiChatApi = new AiChatApi()
    this.questionSearchApi = new QuestionSearchApi()
    this.textbookDownloadApi = new TextbookDownloadApi(androidBridge)
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
   * 目前复用按知识点查题接口：把 bmNoList 当作 knowledgeNo 传入
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
   * 发送语音消息给老师
   */
  public async sendVoiceMessageToTeacher(
    voicePath: string,
    duration: string,
    sessionId: string,
    subject: string,
  ): Promise<boolean> {
    return this.aiChatApi.sendVoiceMessageToTeacher(voicePath, duration, sessionId, subject)
  }

  /**
   * 转发AI对话记录给老师
   */
  public async forwardAiChatToTeacher(
    selectedMessagesData: string,
    teacherSessionId: string,
  ): Promise<boolean> {
    return this.aiChatApi.forwardAiChatToTeacher(selectedMessagesData, teacherSessionId)
  }

  /**
   * 获取老师会话的消息历史
   */
  public async getTeacherChatHistory(sessionId: string): Promise<any[]> {
    return this.aiChatApi.getTeacherChatHistory(sessionId)
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
}

// 习题分页接口响应类型（作业套餐 + 套餐内题目列表）
export type TopicQuestionItem = import('./textbook-download-api').TopicQuestionItem

export type TopicPackageItem = import('./textbook-download-api').TopicPackageItem

export type TopicPackagePageResponse = import('./textbook-download-api').TopicPackagePageResponse

// 创建默认的 API 服务实例
export const apiService = ApiService.getInstance()
