/**
 * 服务层统一导出文件
 * 提供项目中所有服务的统一入口
 */

// 统一类型定义
export * from '../types'

// 核心服务 - 业务层
export { apiService, ApiService } from './business/api-service'
export { androidBridge, AndroidBridge } from './business/android-bridge'

// 核心服务 - HTTP & 认证
export { httpClient, HttpClient } from './http/http-client'

// 认证
export {
  authService,
  UserType,
  getUserInfo,
  setUserInfo,
  getUserId,
  getPassword,
  getYanbanToken,
  getXuebanToken,
  setYanbanToken,
  setXuebanToken,
  getSubject,
  getCurrentUserId,
  getCurrentUserType,
  getCurrentUserIdOrDefault,
  getScopedStorageKey,
  setCurrentUser,
} from './http/auth-service'

// API 配置
export * from './http/api-endpoints'

// 请求配置类型已移至 types/index.ts