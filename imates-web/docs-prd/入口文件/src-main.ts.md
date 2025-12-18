# src/main.ts PRD 文档

## 📋 概述

**文件路径**：`imates-web/src/main.ts`  
**文件类型**：应用入口文件  
**主要职责**：初始化 Vue 应用、配置全局设置、注册全局回调函数

## 🎯 功能需求

### 1. 应用初始化
- 创建 Vue 应用实例
- 配置 Pinia 状态管理
- 配置 Vue Router 路由
- 配置 Quasar UI 框架
- 初始化 IndexedDB 存储

### 2. Polyfill 兼容性
- WebView 兼容性 polyfills
- 配置初始化工具

### 3. 全局回调函数注册
- Android 原生聊天响应回调
- Android 原生流式响应回调
- Android 原生图片选择回调
- Android 原生拍照回调
- Android 原生键盘关闭回调

### 4. 样式导入
- 原生应用样式
- MathLive 自定义样式
- Gemini 通知样式

## 🔧 技术实现

### 1. 依赖导入

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import quasarUserOptions from './quasar'
import { initPolyfills } from './utils/common/polyfills'
import { httpClient } from './services/http/http-client'
import { initQuestionStorage } from './services/question-storage'
import App from './App.vue'
import router from './router'
```

### 2. 初始化流程

#### 步骤 1：初始化 Polyfills
```typescript
initPolyfills()
```

#### 步骤 2：设置 API BaseURL（策略1：相对路径/代理）
```typescript
httpClient.setBaseURL('')
```

#### 步骤 3：提前初始化 IndexedDB
```typescript
initQuestionStorage().then(() => {
  console.log('✅ IndexedDB 初始化完成')
}).catch((error) => {
  console.error('❌ IndexedDB 初始化失败:', error)
})
```

#### 步骤 4：创建 Vue 应用
```typescript
const app = createApp(App)
app.use(createPinia())
app.use(router)
quasarUserOptions(app)
```

#### 步骤 5：注册全局回调函数
```typescript
window.handleNativeChatResponse = (requestId, jsonResponse) => { ... }
window.handleNativeStreamResponse = (requestId, chunk, isComplete) => { ... }
window.onImagePickResult = (success, imageUri) => { ... }
window.onImageCaptureResult = (success, filePath, width, height, fileSize) => { ... }
window.onKeyboardClose = () => { ... }
```

#### 步骤 6：挂载应用
```typescript
app.mount('#app')
```

### 3. 全局回调函数实现

#### handleNativeChatResponse
- **功能**：处理 Android 原生聊天响应
- **参数**：
  - `requestId`: 请求 ID
  - `jsonResponse`: JSON 格式的响应字符串
- **处理流程**：
  1. 解析 JSON 响应
  2. 创建自定义事件 `nativeChatResponse`
  3. 派发事件供组件监听

#### handleNativeStreamResponse
- **功能**：处理 Android 原生流式响应
- **参数**：
  - `requestId`: 请求 ID
  - `chunk`: 数据块
  - `isComplete`: 是否完成
- **处理流程**：
  1. 创建自定义事件 `nativeStreamResponse`
  2. 派发事件供组件监听

#### onImagePickResult
- **功能**：处理 Android 原生图片选择结果
- **参数**：
  - `success`: 是否成功
  - `imageUri`: 图片 URI
- **处理流程**：
  1. 创建自定义事件 `nativeImagePickResult`
  2. 派发事件供组件监听

#### onImageCaptureResult
- **功能**：处理 Android 原生拍照结果
- **参数**：
  - `success`: 是否成功
  - `filePath`: 文件路径（可选）
  - `width`: 图片宽度（可选）
  - `height`: 图片高度（可选）
  - `fileSize`: 文件大小（可选）
- **处理流程**：
  1. 创建自定义事件 `nativeImageCaptureResult`
  2. 派发事件供组件监听

#### onKeyboardClose
- **功能**：处理 Android 原生键盘关闭事件
- **处理流程**：
  1. 创建自定义事件 `nativeKeyboardClose`
  2. 派发事件供组件监听

## 🔄 迁移到 React Native

### 1. 应用入口结构变化

#### 当前结构（Vue）
```typescript
// main.ts
const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

#### React Native 结构
```typescript
// App.tsx (React Native 入口)
import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { Provider } from 'react-redux' // 或 zustand
import AppNavigator from './navigation/AppNavigator'

export default function App() {
  return (
    <Provider store={store}>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </Provider>
  )
}

// index.js (React Native 注册入口)
import { AppRegistry } from 'react-native'
import App from './App'
import { name as appName } from './app.json'

AppRegistry.registerComponent(appName, () => App)
```

### 2. 全局回调函数替换

#### 当前实现（WebView 回调）
```typescript
window.handleNativeChatResponse = (requestId, jsonResponse) => {
  // 处理回调
}
```

#### React Native 实现（事件监听）
```typescript
// 使用 React Native 的事件监听
import { NativeEventEmitter, NativeModules } from 'react-native'

const { ChatModule } = NativeModules
const chatEmitter = new NativeEventEmitter(ChatModule)

chatEmitter.addListener('ChatResponse', (data) => {
  const { requestId, response } = data
  // 处理响应
})
```

### 3. Polyfill 处理

#### 当前实现
```typescript
initPolyfills() // WebView 兼容性
```

#### React Native 实现
React Native 不需要 WebView polyfills，但需要处理平台差异：

```typescript
// utils/platform.ts
import { Platform } from 'react-native'

export const isAndroid = Platform.OS === 'android'
export const isIOS = Platform.OS === 'ios'
```

### 4. IndexedDB 初始化替换

#### 当前实现
```typescript
initQuestionStorage() // IndexedDB 初始化
```

#### React Native 实现
```typescript
// 使用 AsyncStorage 或 Realm
import AsyncStorage from '@react-native-async-storage/async-storage'

async function initStorage() {
  try {
    // 初始化存储
    await AsyncStorage.setItem('storage_initialized', 'true')
  } catch (error) {
    console.error('存储初始化失败:', error)
  }
}
```

### 5. 配置初始化替换

#### 当前实现
```typescript
httpClient.setBaseURL('')
```

#### React Native 实现
```typescript
// config/appConfig.ts
import AsyncStorage from '@react-native-async-storage/async-storage'

export async function initializeAppConfig() {
  // 从 AsyncStorage 读取配置
  const config = await AsyncStorage.getItem('app_config')
  if (!config) {
    // 设置默认配置
    await AsyncStorage.setItem('app_config', JSON.stringify(defaultConfig))
  }
}
```

### 6. 样式导入变化

#### 当前实现
```typescript
import './styles/native-app.css'
import './styles/mathlive-custom.css'
import './styles/gemini-notify.css'
```

#### React Native 实现
```typescript
// React Native 不使用 CSS，需要使用 StyleSheet
import { StyleSheet } from 'react-native'

const styles = StyleSheet.create({
  // 样式定义
})

// 或者使用 styled-components
import styled from 'styled-components/native'
```

## ⚠️ 注意事项

### 1. 事件系统差异
- **WebView**：使用 `CustomEvent` 和 `window.dispatchEvent`
- **React Native**：使用 `NativeEventEmitter` 或 `EventEmitter`

### 2. 全局对象差异
- **WebView**：使用 `window` 对象
- **React Native**：没有 `window` 对象，需要使用模块导入

### 3. 异步初始化
- React Native 中需要确保所有异步初始化完成后再渲染
- 可以使用 `useEffect` 或 `useLayoutEffect` 处理

### 4. 错误处理
- React Native 中需要更完善的错误边界处理
- 使用 `ErrorBoundary` 组件包裹应用

## 📝 迁移步骤

1. **创建 React Native 项目入口**
   ```bash
   npx react-native init ImatesApp
   ```

2. **替换应用初始化代码**
   - 将 Vue 应用初始化替换为 React Native 组件
   - 配置 Redux/Zustand 状态管理
   - 配置 React Navigation 路由

3. **实现原生模块通信**
   - 创建 Native Modules 替代 Android Bridge
   - 实现事件监听机制替代全局回调

4. **迁移存储初始化**
   - 将 IndexedDB 初始化替换为 AsyncStorage
   - 实现配置初始化逻辑

5. **测试应用启动**
   - 确保应用正常启动
   - 验证所有初始化逻辑正常

## 📚 参考资源

- [React Native 官方文档 - 入门](https://reactnative.dev/docs/getting-started)
- [React Navigation 文档](https://reactnavigation.org/docs/getting-started)
- [React Native 事件监听](https://reactnative.dev/docs/native-modules-ios#sending-events-to-javascript)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队

