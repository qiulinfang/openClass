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

// 认证信息存储
export { authStorageService, AuthStorageService } from './storage/auth-storage-service'
export {
  getUserInfo,
  setUserInfo,
  getUserId,
  getPassword,
  getYanbanToken,
  getXuebanToken,
  setYanbanToken,
  setXuebanToken,
  getSubject,
  loadFromStorage,
  initializeStore,
  cleanupOnAccountSwitch,
  setUserInfoWithCleanup
} from './storage/auth-storage-service'

// API 配置
export * from './http/api-endpoints'

// 请求配置类型已移至 types/index.ts