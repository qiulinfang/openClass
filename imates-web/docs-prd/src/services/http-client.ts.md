# http-client.ts PRD 文档

## 📋 概述

**文件路径**：`src/services/http-client.ts`  
**文件类型**：`HTTP 客户端工具类`  
**主要职责**：封装 HTTP 请求，处理认证、重试、超时、错误处理等通用逻辑

## 🎯 功能需求

### 1. 核心功能
- **统一请求封装**：封装 GET、POST、PUT、DELETE 等 HTTP 方法
- **动态认证配置**：根据请求路径动态选择不同的 token（XUEBAN_TOKEN/YANBAN_TOKEN）
- **自动重试机制**：网络错误时自动重试（最多 3 次）
- **401 自动登录**：401 错误时尝试自动重新登录
- **超时控制**：请求超时自动取消
- **路由映射**：在 file:// 环境下将路径映射到对应的后端网关
- **文件下载**：支持流式下载二进制文件
- **流式请求**：支持 SSE（Server-Sent Events）流式请求

### 2. 功能边界
- **负责**：
  - HTTP 请求的发送和响应处理
  - 认证头的动态添加
  - 请求重试和错误处理
  - 401 自动登录逻辑
  - URL 构建和路由映射
- **不负责**：
  - 具体的 API 接口定义（由 api-service 负责）
  - 业务逻辑处理（由各个服务层负责）
  - UI 提示（只负责调用 showMessage）

### 3. 输入输出
- **输入**：
  - `url`：请求 URL（相对路径或绝对 URL）
  - `config`：请求配置（方法、headers、body、timeout、retries）
- **输出**：
  - `ApiResponse<T>`：统一的 API 响应格式

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import type { ApiResponse, RequestConfig } from '../types'
  import { createTimeoutController } from '../utils/common/polyfills'
  import { showMessage } from '../utils'
  ```
- **被依赖**：
  - `src/services/api-service.ts`：所有 API 调用都通过 httpClient

### 2. 关键代码逻辑

#### 动态认证配置
```typescript
private getDynamicAuthConfig(url: string): Record<string, string> {
  // 第1步：登录接口不需要认证头
  if (url === '/admin/login') {
    return {}
  }
  
  // 第2步：根据请求路径选择不同的token
  let selectedToken: string | null = null
  
  if (url.startsWith('/permission') || url.startsWith('/admin/info')) {
    selectedToken = localStorage.getItem('XUEBAN_TOKEN')
  } else if (url.startsWith('/blw-edu-yb')) {
    selectedToken = localStorage.getItem('YANBAN_TOKEN')
  } else {
    selectedToken = localStorage.getItem('token')
  }
  
  // 第3步：将token赋值给所有认证字段
  if (selectedToken) {
    return {
      'sa-token': selectedToken,
      'authorization': selectedToken,
      'token': selectedToken
    }
  }
  
  return {}
}
```

#### 401 自动登录流程
```typescript
// 第1步：检测401未授权错误
if (response.status === 401 && !skipAuth401Retry) {
  // 第2步：根据接口路径删除对应的token
  this.clearTokenByPath(url)
  
  // 第3步：尝试自动重新登录获取新token
  const loginSuccess = await this.tryAutoRelogin(url)
  
  // 第4步：如果登录成功，重新发起请求
  if (loginSuccess) {
    return await this.request<T>(url, { 
      ...config, 
      skipAuth401Retry: true 
    })
  }
  
  // 第5步：登录失败，提示用户并抛出401错误
  showMessage('登录已过期，请重新登录', 'warning')
  throw new Error('认证失败(401): 请重新登录')
}
```

### 3. 数据流
- **请求流程**：
  1. 构建完整 URL（处理 file:// 环境路由映射）
  2. 动态获取认证配置
  3. 创建超时控制器
  4. 发送 HTTP 请求
  5. 处理响应（检查 401，自动登录）
  6. 返回统一响应格式

### 4. 路由映射表
在 file:// 环境（Android WebView）下，根据路径前缀路由到不同的后端网关：
- `/admin`、`/permission` → `http://www.imates.com.cn:8222/blw-edu-service-alc`
- `/blw-edu-yb` → `https://www.imates.com.cn:9099`
- `/resource` → `https://www.imates.com.cn:9099`
- `/api/v1` → `http://app.imates.com.cn:8080`

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：使用 `fetch` API，localStorage 存储 token
- **React Native 实现**：使用 `axios`，AsyncStorage 存储 token

### 2. 需要的第三方库
- `axios`：HTTP 客户端库
- `@react-native-async-storage/async-storage`：持久化存储 token
- `@tanstack/react-query`：可选，用于请求缓存和状态管理

### 3. 迁移步骤
1. **安装依赖**：
   ```bash
   yarn add axios
   yarn add @react-native-async-storage/async-storage
   ```

2. **创建 Axios 实例**：
   - 创建 `src/services/http-client.ts`
   - 使用 `axios.create()` 创建实例

3. **实现拦截器**：
   - 请求拦截器：动态添加认证头
   - 响应拦截器：处理 401 错误和自动登录

4. **迁移路由映射**：
   - React Native 不需要 file:// 路由映射
   - 使用环境变量或配置文件管理 baseURL

5. **实现重试机制**：
   - 使用 axios-retry 插件
   - 或手动实现重试逻辑

### 4. 注意事项
- **localStorage**：React Native 使用 AsyncStorage 替代，所有操作都是异步的
- **路由映射**：React Native 不需要 file:// 路由映射，直接使用 baseURL
- **超时控制**：axios 内置支持 timeout 配置
- **401 自动登录**：需要在响应拦截器中实现，注意避免无限循环

### 5. 迁移代码示例

#### Fetch 实现
```typescript
const response = await fetch(fullUrl, requestOptions)
const data = await response.json()
return { success: data.success, data, code: response.status }
```

#### Axios 实现
```typescript
const response = await axios.request({
  url: fullUrl,
  method: config.method,
  headers: requestHeaders,
  data: body,
  timeout: timeout
})

return {
  success: response.data.success,
  data: response.data,
  code: response.status
}
```

## ⚠️ 迁移风险

### 高风险项
- **异步存储**：AsyncStorage 所有操作都是异步的，需要 await - **解决方案**：将所有 token 读取操作改为异步
- **401 自动登录**：需要避免无限循环 - **解决方案**：使用标志位 `skipAuth401Retry` 防止重复重试
- **路由映射**：React Native 不需要 file:// 路由映射，但需要配置 baseURL - **解决方案**：使用环境变量或配置文件管理不同环境的 baseURL

### 低风险项
- **请求重试**：axios 可以使用 axios-retry 插件简化实现
- **超时控制**：axios 内置支持，无需手动实现

## 🧪 测试要点

### 功能测试
- 测试动态认证配置是否正常工作
- 测试 401 自动登录是否正常工作
- 测试请求重试是否正常工作
- 测试超时控制是否正常工作
- 测试文件下载是否正常工作
- 测试流式请求是否正常工作

### 边界测试
- 测试 token 不存在时的行为
- 测试自动登录失败时的行为
- 测试网络超时时的行为
- 测试服务器错误时的行为

## 📚 参考资源

- [Axios 官方文档](https://axios-http.com/)
- [AsyncStorage 文档](https://react-native-async-storage.github.io/async-storage/)
- [Fetch API 文档](https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
