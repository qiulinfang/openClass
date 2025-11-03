# config-utils.ts PRD 文档

## 📋 概述

**文件路径**：`src/utils/config/config-utils.ts`  
**文件类型**：`TypeScript 服务/工具`  
**主要职责**：`位于 src/utils/config 目录的 TypeScript 服务/工具`

## 🎯 功能需求

### 1. 核心功能
- `[功能点1]`：`待补充`
- `[功能点2]`：`待补充`

### 2. 功能边界
- `[负责的功能]`
- `[不负责的功能]`

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  // 主要依赖
  ```
- **被依赖**：
  - `[文件路径]`：`[使用方式]`

### 2. 关键代码逻辑
```typescript
// config-utils.ts 的核心代码
/**
 * 配置工具函数
 * 简单的配置初始化和管理
 */

import { httpClient } from '../../services/http-client'
import { androidBridge } from '../../services/android-bridge'
import { setBaseUrl } from '../../services/api-endpoints'

/**
 * 初始化应用配置
 */
export async function initializeAppConfig(initData: unknown = {}) {
  // 1. 设置API基础URL - 使用相对路径让Vite代理处理
  const baseUrl = "" // 使用空字符串，让所有请求都通过Vite代理
  httpClient.setBaseURL(baseUrl)
  setBaseUrl(baseUrl) // 设置 api-endpoints 中的基础URL

  // 2. 收集所有认证信息
  const authConfig
```

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：`待补充`
- **React Native 实现**：`待补充`

### 2. 需要的第三方库
- `[库名]`：`[用途说明]`

### 3. 迁移步骤
1. `[步骤1]`
2. `[步骤2]`

### 4. 注意事项
- `[注意点1]`
- `[注意点2]`

## 📝 迁移代码示例

### Vue 实现
```typescript
// 当前 Vue 实现代码
```

### React Native 实现
```typescript
// React Native 实现代码
```

## ⚠️ 迁移风险

### 高风险项
- `[风险项]`：`[风险说明]` - `[解决方案]`

## 🧪 测试要点

### 功能测试
- `[测试场景1]`
- `[测试场景2]`

## 📚 参考资源

- `[相关文档链接]`

---

**文档版本**：v1.0  
**创建日期**：2025-11-03  
**维护者**：开发团队
