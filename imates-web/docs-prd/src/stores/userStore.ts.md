# userStore.ts PRD 文档

## 📋 概述

**文件路径**：`src/stores/userStore.ts`  
**文件类型**：`Pinia Store（状态管理）`  
**主要职责**：管理用户信息、应用配置、学习进度和持久化存储

## 🎯 功能需求

### 1. 核心功能
- **用户信息管理**：存储和更新用户信息（从 Android Bridge 或 localStorage 获取）
- **科目管理**：管理当前选择的科目（数学/生物）
- **持久化存储**：将用户信息保存到 localStorage，实现跨会话持久化
- **应用初始化**：从缓存或 Android Bridge 加载用户信息
- **原生交互**：与 Android Bridge 交互，获取用户信息、拍照、退出应用

### 2. 功能边界
- **负责**：
  - 用户信息的存储和读取
  - 用户信息的持久化
  - 与 Android Bridge 的用户信息交互
  - 科目切换
- **不负责**：
  - 用户登录认证（由 api-service 负责）
  - 网络请求（由 api-service 负责）
  - UI 渲染（由视图组件负责）

### 3. 输入输出
- **输入**：
  - `initializeStore()`：无参数，初始化 Store
  - `setUserInfo(user: UserInfo)`：设置用户信息
  - `setSubject(subject: 'MATH' | 'BIOLOGY')`：设置科目
- **输出**：
  - `userInfo`：响应式用户信息
  - `subject`：响应式当前科目

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { defineStore } from 'pinia'
  import { ref } from 'vue'
  import { androidBridge } from '../services/android-bridge'
  import type { UserInfo } from '../types'
  ```
- **被依赖**：
  - `src/main.ts`：应用启动时初始化 Store
  - `src/views/LoginView.vue`：登录后设置用户信息
  - `src/views/MainView.vue`：读取用户信息和科目

### 2. 关键代码逻辑

#### 状态定义
```typescript
export const useUserStore = defineStore('user', () => {
  // 第1步：定义响应式状态
  const userInfo = ref<UserInfo | null>(null)
  const subject = ref<'MATH' | 'BIOLOGY'>('MATH')
  
  // 第2步：定义方法
  const initializeStore = async () => {
    // 从 localStorage 或 Android Bridge 加载用户信息
  }
  
  // 第3步：返回状态和方法
  return { userInfo, subject, initializeStore, ... }
})
```

#### 初始化流程
```typescript
const initializeStore = async (): Promise<void> => {
  // 第1步：尝试从 localStorage 读取缓存
  const cachedData = localStorage.getItem(STORAGE_KEY)
  if (cachedData) {
    userInfo.value = JSON.parse(cachedData)
    return
  }
  
  // 第2步：从 Android Bridge 获取用户信息
  const user = await androidBridge.getUserInfo()
  
  // 第3步：设置用户信息并持久化
  if (user) {
    userInfo.value = user
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  }
}
```

### 3. 数据流
- **用户信息加载流程**：
  1. 应用启动时调用 `initializeStore()`
  2. 首先尝试从 localStorage 读取缓存
  3. 如果缓存不存在，从 Android Bridge 获取
  4. 将获取的用户信息保存到 localStorage
  5. 更新 Store 状态，触发响应式更新

### 4. 持久化策略
- **存储位置**：localStorage
- **存储键名**：`USER_INFO_CACHE`
- **存储格式**：JSON 字符串
- **更新时机**：用户信息变更时自动更新

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：使用 Pinia（基于 Composition API），localStorage 持久化
- **React Native 实现**：使用 Zustand，AsyncStorage 持久化

### 2. 需要的第三方库
- `zustand`：轻量级状态管理库
- `@react-native-async-storage/async-storage`：持久化存储
- `zustand/middleware/persist`：Zustand 持久化中间件（可选）

### 3. 迁移步骤
1. **安装依赖**：
   ```bash
   yarn add zustand
   yarn add @react-native-async-storage/async-storage
   ```

2. **创建 Store**：
   - 创建 `src/stores/userStore.ts`
   - 使用 `create` 函数定义 Store

3. **实现持久化**：
   - 使用 Zustand 的 `persist` 中间件
   - 或手动使用 AsyncStorage 实现持久化

4. **迁移方法**：
   - 将 Pinia 的 `ref` 转换为 Zustand 的状态
   - 将方法转换为 Zustand 的 actions

5. **Android Bridge 交互**：
   - 需要在 React Native 中创建 Native Module
   - 或使用 React Native Bridge 替代方案

### 4. 注意事项
- **响应式更新**：Zustand 不是响应式的，需要手动触发更新
- **持久化时机**：AsyncStorage 是异步的，需要注意时序
- **Android Bridge**：需要创建 React Native Native Module 替代 Android Bridge
- **类型安全**：Zustand 支持 TypeScript，保持类型定义

### 5. 迁移代码示例

#### Pinia 实现
```typescript
export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)
  
  const setUserInfo = (user: UserInfo) => {
    userInfo.value = user
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  }
  
  return { userInfo, setUserInfo }
})

// 使用
const store = useUserStore()
store.setUserInfo(user)
```

#### Zustand 实现
```typescript
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface UserState {
  userInfo: UserInfo | null
  subject: 'MATH' | 'BIOLOGY'
  setUserInfo: (user: UserInfo) => Promise<void>
  setSubject: (subject: 'MATH' | 'BIOLOGY') => void
}

export const useUserStore = create<UserState>((set) => ({
  userInfo: null,
  subject: 'MATH',
  
  setUserInfo: async (user: UserInfo) => {
    set({ userInfo: user })
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  },
  
  setSubject: (subject) => set({ subject })
}))
```

## ⚠️ 迁移风险

### 高风险项
- **Android Bridge 交互**：需要创建 React Native Native Module - **解决方案**：创建原生模块封装 Android Bridge 功能
- **响应式更新**：Zustand 不是响应式的，组件需要手动订阅更新 - **解决方案**：使用 Zustand 的 hook，组件会自动订阅
- **持久化时序**：AsyncStorage 是异步的，初始化时需要注意 - **解决方案**：在应用启动时异步加载持久化数据

### 低风险项
- **状态结构**：Zustand 的状态结构与 Pinia 类似，迁移简单
- **方法迁移**：方法可以直接迁移，逻辑保持不变

## 🧪 测试要点

### 功能测试
- 测试用户信息初始化是否正常
- 测试从缓存加载用户信息是否正常
- 测试从 Android Bridge 获取用户信息是否正常
- 测试用户信息持久化是否正常
- 测试科目切换是否正常

### 边界测试
- 测试 localStorage 为空时的行为
- 测试 Android Bridge 返回空值时的行为
- 测试网络错误时的降级处理

## 📚 参考资源

- [Zustand 官方文档](https://github.com/pmndrs/zustand)
- [AsyncStorage 文档](https://react-native-async-storage.github.io/async-storage/)
- [Pinia 官方文档](https://pinia.vuejs.org/)
- [React Native Native Modules](https://reactnative.dev/docs/native-modules-intro)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
