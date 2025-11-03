# api-service.ts PRD 文档

## 📋 概述

**文件路径**：`src/services/api-service.ts`  
**文件类型**：`API 服务层`  
**主要职责**：封装所有业务相关的 API 接口调用，提供统一的接口方法

## 🎯 功能需求

### 1. 核心功能
- **用户认证**：管理员登录、学生登录、获取用户信息
- **习题管理**：获取习题列表、删除习题、添加题目、查找相似题目
- **AI 聊天**：发送聊天消息、轮询聊天响应、流式渲染
- **教材管理**：获取教材版本、获取教材结构、下载教材资源
- **资源管理**：获取学习资源包、检查更新、下载文件
- **反馈功能**：创建反馈工单、上传图片

### 2. 功能边界
- **负责**：
  - API 接口调用
  - 请求参数构造
  - 响应数据转换
  - 请求缓存和去重
- **不负责**：
  - HTTP 请求发送（由 http-client 负责）
  - 数据持久化（由 storage 服务负责）
  - 业务逻辑处理（由 stores 负责）

### 3. 输入输出
- **输入**：业务参数（用户账号、题目数据、教材ID等）
- **输出**：统一的 API 响应格式

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { httpClient } from './http-client'
  import { resourceManager } from './resource-storage'
  import { API_ENDPOINTS } from './api-endpoints'
  import { AndroidBridge } from './android-bridge'
  ```
- **被依赖**：
  - `src/stores/*.ts`：各个 Store 调用 API 服务
  - `src/views/*.vue`：视图组件调用 API 服务

### 2. 关键代码逻辑

#### 单例模式
```typescript
export class ApiService {
  private static instance: ApiService
  
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService()
    }
    return ApiService.instance
  }
}
```

#### 请求缓存和去重
```typescript
private requestCache = new Map<string, { data: unknown, timestamp: number }>()
private activeRequests = new Map<string, Promise<unknown>>()

private async optimizedRequest(url: string, options: RequestInit, useCache: boolean = true) {
  // 第1步：检查缓存
  if (useCache && this.requestCache.has(cacheKey)) {
    const cached = this.requestCache.get(cacheKey)!
    if (Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }
  }
  
  // 第2步：检查是否有相同请求正在进行
  if (this.activeRequests.has(cacheKey)) {
    return this.activeRequests.get(cacheKey)
  }
  
  // 第3步：创建新请求并缓存
  const requestPromise = this.executeRequest(url, options)
  this.activeRequests.set(cacheKey, requestPromise)
  // ...
}
```

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：使用 httpClient（基于 fetch），localStorage 缓存
- **React Native 实现**：使用 axios，AsyncStorage 缓存

### 2. 需要的第三方库
- `axios`：HTTP 客户端（已在 http-client 中安装）
- `@react-native-async-storage/async-storage`：持久化存储
- `@tanstack/react-query`：可选，用于请求缓存和状态管理

### 3. 迁移步骤
1. **迁移类结构**：
   - 保持单例模式
   - 使用 axios 替代 httpClient

2. **迁移缓存机制**：
   - 使用 AsyncStorage 替代 Map 缓存
   - 或使用 React Query 的缓存机制

3. **迁移方法**：
   - 所有方法保持接口不变
   - 内部实现使用 axios 替代 httpClient

4. **处理 Android Bridge**：
   - 创建 React Native Native Module 替代 Android Bridge

### 4. 注意事项
- **Android Bridge**：所有 Android Bridge 调用需要创建 Native Module
- **缓存策略**：AsyncStorage 是异步的，需要注意时序
- **请求去重**：可以使用 React Query 的请求去重机制

## ⚠️ 迁移风险

### 高风险项
- **Android Bridge 依赖**：大量方法依赖 Android Bridge - **解决方案**：创建 Native Module 封装所有原生功能
- **缓存机制**：缓存逻辑需要改为异步实现 - **解决方案**：使用 AsyncStorage 或 React Query

## 🧪 测试要点

### 功能测试
- 测试所有 API 接口是否正常工作
- 测试请求缓存是否正常工作
- 测试请求去重是否正常工作
- 测试下载功能是否正常工作

## 📚 参考资源

- [Axios 官方文档](https://axios-http.com/)
- [React Query 文档](https://tanstack.com/query/latest)
- [React Native Native Modules](https://reactnative.dev/docs/native-modules-intro)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
