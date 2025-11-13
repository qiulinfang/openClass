/**
 * 服务层统一导出文件
 * 提供项目中所有服务的统一入口
 */

// 统一类型定义
export * from '../types'

// 核心服务
export { apiService, ApiService } from './api-service'
export { androidBridge, AndroidBridge } from './android-bridge'
export { httpClient, HttpClient } from './http-client'
export { authStorageService, AuthStorageService } from './auth-storage-service'
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
} from './auth-storage-service'

// API 配置
export * from './api-endpoints'

// 请求配置类型已移至 types/index.ts