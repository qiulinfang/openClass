/**
 * 教材相关类型定义
 * 与Android端LearnResourceManager保持一致
 */

/**
 * 教材版本信息
 */
export interface TextbookVersion {
  id: string // 教材版本唯一标识
  textbookId: string // 教材ID
  textbookGrade: number // 年级编号
  textbookGradeLabel: string // 年级标签
  textbookSemester: number // 学期编号
  textbookSemesterLabel: string // 学期标签
  textbookSubject: number // 学科编号
  textbookSubjectLabel: string // 学科标签
  textbookName: string // 教材名称
  textbookEditionYear: string // 教材版本年份
  textbookIsbn: string // 教材ISBN号
  textbookPublisher: string // 出版社
  textbookCover: string // 教材封面图片URL
  textbookUpdateTime: string // 教材更新时间
}

/**
 * 教材选择器选项
 */
export interface TextbookOption {
  value: string // 选项值
  label: string // 显示标签
  textbookId: string // 教材ID
  subject: string // 学科
  grade: string // 年级
  semester: string // 学期
  publisher: string // 出版社
  cover: string // 封面图片URL
}

/**
 * 教材结构请求
 */
export interface TextbookStructureRequest {
  id: string // 教材版本ID
}

/**
 * 学习资源请求
 */
export interface LearningResourcesRequest {
  id: string // 教材版本ID
}

/**
 * 章节节点
 */
export interface ChapterNode {
  id: string // 章节唯一标识
  name: string // 章节名称
  parentId?: string | null // 父章节ID
  label: string // 章节标签
  level: number | null // 章节层级
  isRoot: boolean // 是否为根节点
  updateTime: string // 更新时间
  children?: ChapterNode[] // 子章节列表
}

/**
 * 学习资源包
 */
export interface LearningPackage {
  id: string // 资源包唯一标识
  packageId?: string // 资源包ID（与id相同，用于兼容性）
  sectionId: string // 章节ID
  packageName: string // 资源包名称
  description: string // 资源包描述
  updateTime: string // 更新时间
  isDefault: number // 是否为默认方案
  userId: string // 用户ID
  releaseStatus: boolean // 发布状态
  visibility: number // 可见性
  authors: string // 作者信息
  tags: string // 标签信息
  resourceList: ResourceFile[] // 资源文件列表
  localFiles?: LocalFileInfo[] // 本地文件信息列表
}

/**
 * 资源文件
 */
export interface ResourceFile {
  id: string // 资源文件唯一标识
  packageId?: string // 资源包ID
  fileName: string // 文件名
  fileUrl: string // 文件下载URL
  checksum: string // 文件校验和
  size: number // 文件大小（字节）
  mimeType?: string | null // MIME类型
  directoryId?: string | null // 目录ID
  uploadTime: string // 上传时间
  previewCount: number // 预览次数
  downloadCount: number // 下载次数
}

/**
 * 用户教材信息
 */
export interface UserTextbookInfo {
  id: string // 用户教材信息唯一标识
  textbookId: string // 教材ID
  textbookName: string // 教材名称
  textbookSubjectLabel: string // 学科标签
  textbookGradeLabel: string // 年级标签
  textbookSemesterLabel: string // 学期标签
  textbookPublisher: string // 出版社
  textbookEditionYear: string // 版本年份
  textbookIsbn: string // ISBN号
  textbookCover: string // 封面图片URL
  textbookUpdateTime: string // 教材更新时间
  totalFiles: number // 总文件数
  downloadedFiles: number // 已下载文件数
  isDownloaded: boolean // 是否已下载
  downloadStatus: number // 下载状态: 0=未下载/下载失败, 1=下载中, 2=下载完成, 3=已暂停
  downloadPath: string // 下载路径
  lastDownloadTime: string // 最后下载时间
  hasUpdatesAvailable: boolean // 是否有可用更新
  structure: ChapterNode[] // 教材结构
  learningPackages: LearningPackage[] // 学习资源包列表
  localFiles: LocalFileInfo[] // 本地文件信息列表
  
  updateStructure(structure: ChapterNode[]): void // 更新教材结构方法
  updatePackages(packages: LearningPackage[]): void // 更新资源包方法
  getLocalResourceFileName(resource: ResourceFile): string // 获取本地资源文件名方法
}


/**
 * 资源索引
 */
export interface ResourceIndex {
  textbook: TextbookVersion // 教材版本信息
  packages: LearningPackage[] // 学习资源包列表
  downloadTime: string // 下载时间
}

/**
 * 本地文件信息（元数据）
 * 注意：fileData已分离存储到textbook_files表，不在localFiles中
 */
export interface LocalFileInfo {
  id: string // 文件唯一标识
  fileName: string // 文件名
  fileSize: number // 文件大小（字节）
  checksum: string // 文件校验和
  isDownloaded: boolean // 是否已下载
  localPath?: string // 本地文件路径
  fileData?: Uint8Array // 已弃用：文件二进制数据已分离存储到textbook_files表，通过resourceManager.getFileData()获取
  thumbnail?: string // PDF缩略图（base64格式）
  annotations?: Record<number, object[]> // PDF注释数据，key为页码，value为fabric对象数组
}

/**
 * 登录响应
 */
export interface LoginResponse {
  token: string // 认证令牌
  userId: string // 用户ID
  defaultPassword: boolean // 是否为默认密码
}

/**
 * 登录请求
 */
export interface LoginRequest {
  account: string // 账号
  password: string // 密码
}

/**
 * 登录数据
 */
export interface LoginData {
  token: string // 认证令牌
  userId: string // 用户ID
  defaultPassword: boolean // 是否为默认密码
}

/**
 * 学伴登录响应 - Token 数据
 */
export interface XuebanLoginTokenData {
  token: string // 认证令牌
}

/**
 * 学伴登录响应 - 内层数据
 */
export interface XuebanLoginData {
  code: number // 响应代码
  data: XuebanLoginTokenData | null // Token 数据
  message: string // 响应消息
  pageNo: number | null // 页码
  pageSize: number | null // 每页大小
  sessionId: string | null // 会话ID
  success: boolean // 是否成功
  totalCount: number | null // 总数量
}

/**
 * 学伴登录响应 - 外层响应
 */
export interface XuebanLoginResponse {
  code: number // HTTP 状态码
  data: XuebanLoginData // 响应数据
  success: boolean // 是否成功
}
