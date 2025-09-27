/**
 * 教材相关类型定义
 * 与Android端LearnResourceManager保持一致
 */

/**
 * 教材版本信息
 */
export interface TextbookVersion {
  id: string
  textbookId: string
  textbookName: string
  textbookSubjectLabel: string
  textbookGradeLabel: string
  textbookSemesterLabel: string
  textbookPublisher: string
  textbookEditionYear: string
  textbookIsbn: string
  textbookCover: string
  textbookUpdateTime: string
}

/**
 * 教材选择器选项
 */
export interface TextbookOption {
  value: string
  label: string
  textbookId: string
  subject: string
  grade: string
  semester: string
  publisher: string
  cover: string
}

/**
 * 教材结构请求
 */
export interface TextbookStructureRequest {
  textbookId: string
}

/**
 * 学习资源请求
 */
export interface LearningResourcesRequest {
  textbookId: string
}

/**
 * 章节节点
 */
export interface ChapterNode {
  id: string
  name: string
  level: number
  parentId?: string
  children?: ChapterNode[]
  order: number
}

/**
 * 学习资源包
 */
export interface LearningPackage {
  id: string
  packageName: string
  packageDescription: string
  updateTime: string
  resourceList: ResourceFile[]
  eliminateNull(): void
}

/**
 * 资源文件
 */
export interface ResourceFile {
  id: string
  fileName: string
  fileUrl: string
  fileSize: number
  checksum: string
  fileType: string
}

/**
 * 用户学习数据
 */
export interface UserLearnData {
  username: string
  lastSyncTime: string
  textbooks: UserTextbookInfo[]
}

/**
 * 用户教材信息
 */
export interface UserTextbookInfo {
  id: string
  textbookId: string
  textbookName: string
  textbookSubjectLabel: string
  textbookGradeLabel: string
  textbookSemesterLabel: string
  textbookPublisher: string
  textbookEditionYear: string
  textbookIsbn: string
  textbookCover: string
  textbookUpdateTime: string
  totalFiles: number
  downloadedFiles: number
  isDownloaded: boolean
  downloadStatus: number
  lastDownloadTime: string
  hasUpdatesAvailable: boolean
  structure: ChapterNode[]
  localPackages: LocalPackageInfo[]
  
  updateStructure(structure: ChapterNode[]): void
  updatePackages(packages: LearningPackage[]): void
  getLocalResourceFileName(resource: ResourceFile): string
}

/**
 * 本地资源包信息
 */
export interface LocalPackageInfo {
  packageId: string
  packageName: string
  packageDescription: string
  updateTime: string
  totalFiles: number
  downloadedFiles: number
  downloadStatus: number
  localFiles: LocalFileInfo[]
  
  updateDownloadStatus(): void
}

/**
 * 本地文件信息
 */
export interface LocalFileInfo {
  id: string
  fileName: string
  fileSize: number
  checksum: string
  isDownloaded: boolean
  localPath?: string
}

/**
 * 资源索引
 */
export interface ResourceIndex {
  textbook: TextbookVersion
  packages: LearningPackage[]
  downloadTime: string
}

/**
 * 登录响应
 */
export interface LoginResponse {
  token: string
  userId: string
  defaultPassword: boolean
}

/**
 * 登录请求
 */
export interface LoginRequest {
  account: string
  password: string
}

/**
 * 登录数据
 */
export interface LoginData {
  token: string
  userId: string
  defaultPassword: boolean
}
