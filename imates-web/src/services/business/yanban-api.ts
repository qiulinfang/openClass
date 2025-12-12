import { httpClient } from '../http/http-client'
import { getYanbanToken } from '../http/auth-service'
import { saveLearningPackagesToDB, loadLearningPackagesFromDB } from '../storage/learning-packages-storage'
import { AndroidBridge } from './android-bridge'
import { getCurrentEnvType, AppEnvType } from '@/config/env-config'
import type {
  ApiResponse,
  ChapterNode,
  LearningPackage,
  LearningResourcesRequest,
  TextbookStructureRequest,
  TextbookVersion,
  UserTextbookInfo,
} from '@/types'

// 注意：loginYanban、isStudentLoggedIn、logoutStudent 已迁移到 auth-service.ts

export interface TopicQuestionItem {
  id: string
  questionData: string
  [key: string]: unknown
}

export interface TopicPackageItem {
  id: string
  name?: string
  tags?: string
  topicList: TopicQuestionItem[]
  [key: string]: unknown
}

export interface TopicPackagePageResponse {
  records: TopicPackageItem[]
  pageNumber: number
  pageSize: number
  totalPage: number
  totalRow: number
}

export class YanbanApi {
  private androidBridge: AndroidBridge

  constructor(androidBridge: AndroidBridge) {
    this.androidBridge = androidBridge
  }

  private async callYanban<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
    const envType = getCurrentEnvType()

    if (envType === AppEnvType.INTERNAL_TEST && this.androidBridge.isAndroidBridgeAvailable()) {
      const apiPath = url.replace('/blw-edu-yb', '')
      const yanbanToken = getYanbanToken() || ''
      const result = await this.androidBridge.callYanbanApi(apiPath, body, 'POST', envType, yanbanToken)

      return {
        success: (result as any)?.success ?? false,
        data: ((result as any)?.data ?? result) as T,
        code: (result as any)?.code ?? ((result as any)?.success ? 200 : 0),
        message: (result as any)?.message,
      }
    }

    return await httpClient.post<T>(url, body)
  }

  public async getTextbookVersions(): Promise<TextbookVersion[]> {
    const endpoint = '/blw-edu-yb/api/app/teacher-textbook'

    const response = await this.callYanban<{
      code: number
      success: boolean
      message: string
      data: TextbookVersion[]
    }>(endpoint, {})

    const respData = response.data as any
    const textbooks = respData?.data || respData

    if (response.success && Array.isArray(textbooks)) {
      return textbooks
    }
    return []
  }

  public async getTextbookStructure(id: string): Promise<ChapterNode[]> {
    const endpoint = '/blw-edu-yb/api/app/teacher-textbook-section-tree' 
    const request: TextbookStructureRequest = { id }

    const response = await this.callYanban<{
      code: number
      success: boolean
      message: string
      data: ChapterNode[]
    }>(endpoint, request)

    const respData = response.data as any
    const structure = respData?.data || respData

    if (response.success && Array.isArray(structure) && structure.length > 0 && structure[0]?.children?.length > 0) {
      return structure[0].children
    }

    return []
  }

  public async getLearningResources(id: string, useCache: boolean = true): Promise<LearningPackage[]> {
    const endpoint = '/blw-edu-yb/api/app/teacher-textbook-learning-package'
    const request: LearningResourcesRequest = { id }

    try {
      const response = await this.callYanban<{ data: LearningPackage[] }>(endpoint, request)

      const respData = response.data as any
      const packagesData = respData?.data || respData

      if (response.success && Array.isArray(packagesData)) {
        const packages = packagesData.map((pkg: LearningPackage) => ({
          ...pkg,
          packageId: (pkg as any).id,
          sectionId: (pkg as any).sectionId || '',
          packageName: (pkg as any).packageName || '未命名方案',
          description: (pkg as any).description || '暂无描述',
          updateTime: (pkg as any).updateTime || new Date().toISOString(),
          isDefault: (pkg as any).isDefault || 0,
          userId: (pkg as any).userId || '',
          releaseStatus: (pkg as any).releaseStatus || false,
          visibility: (pkg as any).visibility || 0,
          authors: (pkg as any).authors || '{}',
          tags: (pkg as any).tags || '{}',
          resourceList: (pkg as any).resourceList || [],
        }))

        if (useCache) {
          try {
            await saveLearningPackagesToDB(id, packages)
          } catch {
          }
        }

        return packages
      }

      return []
    } catch {
      if (useCache) {
        try {
          const cached = await loadLearningPackagesFromDB(id)
          if (cached && Array.isArray(cached)) {
            return cached
          }
        } catch {
        }
      }

      return []
    }
  }

  public async fetchUserAllOnlineTextbooks(): Promise<UserTextbookInfo[]> {
    const endpoint = '/blw-edu-yb/api/app/teacher-textbook'

    const response = await this.callYanban<{
      code: number
      success: boolean
      message: string
      data: UserTextbookInfo[]
    }>(endpoint, {})

    const respData = response.data as any
    const textbooks = respData?.data || respData

    if (response.success && Array.isArray(textbooks)) {
      const BASE_URL = 'https://www.imates.com.cn:9099'

      return textbooks.map((textbook: UserTextbookInfo) => {
        if (textbook.textbookCover && !textbook.textbookCover.startsWith('http')) {
          textbook.textbookCover = BASE_URL + textbook.textbookCover
        }
        return textbook
      })
    }

    return []
  }

  public async loadUserAllLocalTextbooks(): Promise<UserTextbookInfo[]> {
    const endpoint = '/blw-edu-yb/api/app/teacher-textbook'

    const response = await this.callYanban<{
      code: number
      success: boolean
      message: string
      data: UserTextbookInfo[]
    }>(endpoint, {})

    const respData = response.data as any
    const textbooks = respData?.data || respData

    if (response.success && Array.isArray(textbooks)) {
      return textbooks as UserTextbookInfo[]
    }

    return []
  }

  public async submitTopicAnswer(id: string, answerContent: string[]): Promise<boolean> {
    const requestBody = {
      id,
      answerContent,
    }

    const endpoint = '/blw-edu-yb/api/app/topic-package-answer'
    const envType = getCurrentEnvType()

    const response = await (async () => {
      if (envType === AppEnvType.INTERNAL_TEST && this.androidBridge.isAndroidBridgeAvailable()) {
        const apiPath = endpoint.replace('/blw-edu-yb', '')
        const yanbanToken = getYanbanToken() || ''
        const result = await this.androidBridge.callYanbanApi(apiPath, requestBody, 'POST', envType, yanbanToken)
        return {
          success: (result as any)?.success ?? false,
          data: ((result as any)?.data ?? result) as any,
          code: (result as any)?.code ?? ((result as any)?.success ? 200 : 0),
          message: (result as any)?.message,
        }
      }

      return httpClient.post<{
        code?: number
        data?: unknown
        message?: string
      }>(endpoint, requestBody)
    })()

    return !!(response.success && (response as any).data?.code === 200)
  }

  public async getTopicPackagePage(
    pageNumber: number = 0,
    pageSize: number = 20,
    updateTime?: string,
    subject?: string,
  ): Promise<TopicPackagePageResponse | null> {
    const endpoint = '/blw-edu-yb/api/app/topic-package-page'
    const requestBody = { pageNumber, pageSize, updateTime, subject }
    const envType = getCurrentEnvType()

    const response = await (async () => {
      if (envType === AppEnvType.INTERNAL_TEST && this.androidBridge.isAndroidBridgeAvailable()) {
        const apiPath = endpoint.replace('/blw-edu-yb', '')
        const yanbanToken = getYanbanToken() || ''
        const result = await this.androidBridge.callYanbanApi(apiPath, requestBody, 'POST', envType, yanbanToken)
        return {
          success: (result as any)?.success ?? false,
          data: ((result as any)?.data ?? result) as any,
          code: (result as any)?.code ?? ((result as any)?.success ? 200 : 0),
          message: (result as any)?.message,
        }
      }

      return httpClient.post<any>(endpoint, requestBody)
    })()

    const respData = (response as any).data
    const pageData = respData?.data || respData

    if ((response as any).success && pageData) {
      return pageData as TopicPackagePageResponse
    }

    return null
  }
}
