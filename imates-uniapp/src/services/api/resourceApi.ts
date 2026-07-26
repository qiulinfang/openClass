import { request } from '@/utils/request'
import { getApiPaths, getYanbanBaseUrl } from '@/config/env-config'

export interface UserTextbookInfo {
  id?: string | number
  textbookId?: string
  textbookName: string
  textbookCover?: string
  textbookPublisher?: string
  textbookGradeLabel?: string
  textbookSubjectLabel?: string
  textbookSemesterLabel?: string
  textbookIsbn?: string
  isDownloaded?: boolean
  downloadStatus?: number // 0未下载 1下载中 2已完成 3暂停
  hasUpdatesAvailable?: boolean
  downloadedFiles?: number
  totalFiles?: number
  lastDownloadTime?: string  // 最后一次下载完成时间
  learningPackages?: any[]
}

export interface ChapterNode {
  id: string
  name: string
  children?: ChapterNode[]
  sectionId?: string
  [key: string]: any
}

export interface LearningPackage {
  id: string
  packageName?: string
  resources?: any[]
  [key: string]: any
}

export class ResourceApi {
  /**
   * 获取用户教材/资源列表 (POST 请求)
   */
  static async getTextbookList(): Promise<UserTextbookInfo[]> {
    const paths = getApiPaths()
    const yanbanBaseUrl = getYanbanBaseUrl()
    try {
      const res = await request<any>({
        url: paths.yanban.textbook.teacherTextbook,
        method: 'POST',
        baseUrl: yanbanBaseUrl,
        data: {}
      })
      const list = res?.data?.list || res?.data || res || []
      return Array.isArray(list) ? list : []
    } catch (e) {
      console.warn('[ResourceApi] 获取教材列表失败:', e)
      return []
    }
  }

  /**
   * 获取教材章节树结构 (/teacher-textbook-section-tree)
   */
  static async getSectionTree(textbookId: string): Promise<ChapterNode[]> {
    const paths = getApiPaths()
    const yanbanBaseUrl = getYanbanBaseUrl()
    try {
      const res = await request<any>({
        url: `${paths.yanban.textbook.teacherTextbookSectionTree}?textbookId=${textbookId}`,
        method: 'GET',
        baseUrl: yanbanBaseUrl
      })
      const data = res?.data || res || []
      return Array.isArray(data) ? data : []
    } catch (e) {
      console.warn('[ResourceApi] 获取章节树失败:', e)
      return []
    }
  }

  /**
   * 获取章节学习包详情 (/teacher-textbook-learning-package)
   * 对应下载前拉取远端文件清单的真实网络 API
   */
  static async getLearningPackage(textbookIdOrSectionId: string): Promise<LearningPackage[]> {
    const paths = getApiPaths()
    const yanbanBaseUrl = getYanbanBaseUrl()
    try {
      const res = await request<any>({
        url: paths.yanban.textbook.teacherTextbookLearningPackage,
        method: 'POST',
        baseUrl: yanbanBaseUrl,
        data: {
          id: textbookIdOrSectionId,
          textbookId: textbookIdOrSectionId
        }
      })
      const data = res?.data || res || []
      return Array.isArray(data) ? data : [data]
    } catch (e) {
      console.warn('[ResourceApi] 获取学习包详情失败:', e)
      return []
    }
  }

  /**
   * 删除本地下载资料记录
   */
  static async deleteTextbook(textbookId: string): Promise<boolean> {
    try {
      const downloadedKeys = uni.getStorageSync('downloaded_textbooks') || []
      const updatedKeys = downloadedKeys.filter((id: string) => id !== textbookId)
      uni.setStorageSync('downloaded_textbooks', updatedKeys)
      return true
    } catch (e) {
      console.error('[ResourceApi] 删除本地教材缓存失败:', e)
      return false
    }
  }
}
