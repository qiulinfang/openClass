# App.vue PRD 文档

## 📋 概述

**文件路径**：`src/App.vue`  
**文件类型**：`Vue 组件`  
**主要职责**：`位于 src 目录的 Vue 组件`

## 🎯 功能需求

### 1. 核心功能
- **全局资源自动更新检查**：应用启动后自动检查资源更新，每1小时检查一次
- **全局图片选择器**：提供全局单例图片选择器组件

### 2. 功能边界
- **负责的功能**：
  - 全局资源自动更新检查（每1小时）
  - 全局图片选择器组件挂载
  - 应用级别的生命周期管理
- **不负责的功能**：
  - 具体的资源更新逻辑（由apiService和resourceManager负责）
  - 图片选择器的具体实现（由ImagePicker组件负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { onMounted, onBeforeUnmount } from 'vue'
  import ImagePicker from './components/chat/ImagePicker.vue'
  import { apiService } from './services/api-service'
  import { resourceManager } from './services/resource-storage'
  ```
- **被依赖**：
  - `src/main.ts`：作为应用的根组件被挂载

### 2. 关键代码逻辑

#### 全局资源自动更新检查
```typescript
// 全局资源自动更新检查定时器
let resourceUpdateTimer: ReturnType<typeof setInterval> | null = null

// 全局资源自动更新检查函数
// 第1步：调用API服务检查需要更新的教材
// 第2步：获取本地所有教材信息
// 第3步：重置所有教材的更新状态
// 第4步：标记需要更新的教材
const checkResourceUpdates = async () => {
  try {
    // 第1步：调用API服务检查需要更新的教材
    const updatedTextbooks = await apiService.checkForUpdates()

    // 第2步：获取本地所有教材信息
    const localTextbooks = await resourceManager.getUserLocalTextbooks()

    // 第3步：重置所有教材的更新状态
    const resetPromises = localTextbooks.map(async (textbook) => {
      textbook.hasUpdatesAvailable = false
      await resourceManager.updateTextbookInfo(textbook, {
        hasUpdatesAvailable: false,
      })
    })
    await Promise.all(resetPromises)

    // 第4步：标记需要更新的教材
    if (updatedTextbooks.length > 0) {
      const updatePromises = updatedTextbooks.map(async (updatedTextbook) => {
        const localTextbook = localTextbooks.find(
          (textbook) => textbook.textbookId === updatedTextbook.textbookId,
        )

        if (localTextbook) {
          localTextbook.hasUpdatesAvailable = true
          await resourceManager.updateTextbookInfo(localTextbook, {
            hasUpdatesAvailable: true,
          })
        }
      })

      await Promise.all(updatePromises)
    }
  } catch {
    // 静默处理错误，避免影响应用正常运行
  }
}

onMounted(() => {
  // 启动全局资源自动更新检查（每1小时检查一次）
  // 第1步：设置定时器，每1小时检查一次
  resourceUpdateTimer = setInterval(() => {
    checkResourceUpdates()
  }, 60 * 60 * 1000) // 1小时 = 60 * 60 * 1000 毫秒

  // 第2步：立即执行一次检查
  checkResourceUpdates()
})

onBeforeUnmount(() => {
  // 清理资源自动更新定时器
  if (resourceUpdateTimer) {
    clearInterval(resourceUpdateTimer)
    resourceUpdateTimer = null
  }
})
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
