import type { UserTextbookInfo } from '@/services/api/resourceApi'

/**
 * 本地存储服务类 (Storage Service)
 * 对应 imates-web 的 ResourceManager 元数据层：
 * - 教材完整状态持久化（downloadStatus / totalFiles / localFiles checksum 等）
 * - 为双路加载策略提供快速本地数据来源
 */
export class StorageService {
  private static readonly KEYS = {
    XUEBAN_TOKEN: 'XUEBAN_TOKEN',
    YANBAN_TOKEN: 'YANBAN_TOKEN',
    XUEBAN_USER_ID: 'xuebanuserid',
    USER_PASSWORD: 'userPassword',
    USER_INFO: 'userInfo',
    SAVED_ACCOUNTS: 'saved_accounts',
    DOWNLOADED_TEXTBOOKS: 'downloaded_textbooks',
    TEXTBOOK_META_PREFIX: 'textbook_meta_'   // 完整教材元数据
  }

  // ─── 教材完整元数据（双路加载策略的本地快速路径数据源） ─────────────────────

  /** 保存单本教材完整元数据（下载状态、文件数、本地文件列表等） */
  static saveTextbookMeta(textbook: UserTextbookInfo): void {
    try {
      const id = String(textbook.textbookId || textbook.id)
      const key = `${this.KEYS.TEXTBOOK_META_PREFIX}${id}`
      // 只持久化必要字段，避免数据膨胀
      const meta: Partial<UserTextbookInfo> = {
        id: textbook.id,
        textbookId: textbook.textbookId,
        textbookName: textbook.textbookName,
        textbookCover: textbook.textbookCover,
        textbookPublisher: textbook.textbookPublisher,
        textbookGradeLabel: textbook.textbookGradeLabel,
        textbookSubjectLabel: textbook.textbookSubjectLabel,
        textbookSemesterLabel: textbook.textbookSemesterLabel,
        isDownloaded: textbook.isDownloaded,
        downloadStatus: textbook.downloadStatus,
        downloadedFiles: textbook.downloadedFiles,
        totalFiles: textbook.totalFiles,
        hasUpdatesAvailable: textbook.hasUpdatesAvailable,
        lastDownloadTime: textbook.lastDownloadTime
      }
      uni.setStorageSync(key, JSON.stringify(meta))
    } catch (e) {
      console.warn('[StorageService] 保存教材元数据失败:', e)
    }
  }

  /** 读取单本教材元数据 */
  static getTextbookMeta(textbookId: string): Partial<UserTextbookInfo> | null {
    try {
      const key = `${this.KEYS.TEXTBOOK_META_PREFIX}${textbookId}`
      const data = uni.getStorageSync(key)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  /** 读取全部已缓存的教材元数据列表（用于本地快速路径渲染） */
  static getAllTextbookMetas(): Partial<UserTextbookInfo>[] {
    try {
      const ids = this.getDownloadedTextbookIds()
      return ids
        .map(id => this.getTextbookMeta(id))
        .filter((m): m is Partial<UserTextbookInfo> => m !== null)
    } catch {
      return []
    }
  }

  /** 删除单本教材元数据 */
  static removeTextbookMeta(textbookId: string): void {
    try {
      const key = `${this.KEYS.TEXTBOOK_META_PREFIX}${textbookId}`
      uni.removeStorageSync(key)
    } catch {}
  }

  // ─── 已下载 ID 列表（快速判断是否已下载） ──────────────────────────────────

  static getDownloadedTextbookIds(): string[] {
    try {
      const data = uni.getStorageSync(this.KEYS.DOWNLOADED_TEXTBOOKS)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  static saveDownloadedTextbookId(textbookId: string): void {
    const list = this.getDownloadedTextbookIds()
    if (!list.includes(textbookId)) {
      list.push(textbookId)
      uni.setStorageSync(this.KEYS.DOWNLOADED_TEXTBOOKS, JSON.stringify(list))
    }
  }

  static removeDownloadedTextbookId(textbookId: string): void {
    const list = this.getDownloadedTextbookIds().filter(id => id !== textbookId)
    uni.setStorageSync(this.KEYS.DOWNLOADED_TEXTBOOKS, JSON.stringify(list))
    this.removeTextbookMeta(textbookId)
  }

  // Token 相关
  static getXuebanToken(): string {
    return uni.getStorageSync(this.KEYS.XUEBAN_TOKEN) || ''
  }

  static setXuebanToken(token: string): void {
    uni.setStorageSync(this.KEYS.XUEBAN_TOKEN, token)
  }

  static removeXuebanToken(): void {
    uni.removeStorageSync(this.KEYS.XUEBAN_TOKEN)
  }

  // 账号密码
  static getSavedCredentials(): { account: string; password: string } {
    return {
      account: uni.getStorageSync(this.KEYS.XUEBAN_USER_ID) || '',
      password: uni.getStorageSync(this.KEYS.USER_PASSWORD) || ''
    }
  }

  static setSavedCredentials(account: string, password: string): void {
    uni.setStorageSync(this.KEYS.XUEBAN_USER_ID, account)
    uni.setStorageSync(this.KEYS.USER_PASSWORD, password)
  }

  // 多历史账号管理
  static getSavedAccounts<T = any>(): T[] {
    try {
      const data = uni.getStorageSync(this.KEYS.SAVED_ACCOUNTS)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  static setSavedAccounts<T = any>(accounts: T[]): void {
    try {
      uni.setStorageSync(this.KEYS.SAVED_ACCOUNTS, JSON.stringify(accounts))
    } catch (e) {
      console.error('[StorageService] 保存账号失败:', e)
    }
  }

  // 清除全部登录数据
  static clearAllAuth(): void {
    uni.removeStorageSync(this.KEYS.XUEBAN_TOKEN)
    uni.removeStorageSync(this.KEYS.YANBAN_TOKEN)
    uni.removeStorageSync(this.KEYS.USER_INFO)
  }
}
