/**
 * 服务层统一导出文件
 * 提供项目中所有服务的统一入口
 */

// 统一类型定义
export * from '../types'

// 核心服务 - 业务层
export { apiService, ApiService } from './http/api-service'
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
  getScopedStorageKey,
  getScopedStorageValue,
  loadFromStorage,
  getCurrentYanbanUserId,
  isYanbanLoggedIn
} from './http/auth-service'
