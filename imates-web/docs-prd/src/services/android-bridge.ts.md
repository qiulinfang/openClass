# android-bridge.ts PRD 文档

## 📋 概述

**文件路径**：`src/services/android-bridge.ts`  
**文件类型**：`TypeScript 服务/工具`  
**主要职责**：统一管理与原生 Android 端的通信，处理原生功能（相机、录音、语音播放、图片处理等）

## 🎯 功能需求

### 1. 核心功能
- **原生功能调用**：相机、录音、语音播放、图片处理
- **用户信息同步**：同步 Web 端用户信息到 Android 原生 ViewModel
- **事件监听**：监听 Android 原生事件（题目更新、科目变化、加载状态等）
- **Toast 和通知**：显示 Android 原生 Toast 和通知
- **老师对话**：通过 WebView 桥接调用原生 RabbitMQ
- **课堂功能**：加入课堂、退出课堂、屏幕投屏、截图等

### 2. 功能边界
- **负责的功能**：
  - 原生功能调用（相机、录音、语音播放等）
  - 用户信息同步到原生
  - 事件监听和回调
  - Toast 和通知显示
- **不负责的功能**：
  - HTTP 请求（已移至 API 服务层）
  - 数据持久化（由 storage 服务负责）
  - 业务逻辑处理（由 stores 负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import type { UserInfo, VoiceRecordingResponse, ImagePickerResponse } from '../types'
  import { MessageType, ChatRole } from '../types'
  ```
- **被依赖**：
  - `src/services/api-service.ts`：同步用户信息
  - `src/stores/*.ts`：监听原生事件
  - `src/components/*.vue`：调用原生功能

### 2. 关键代码逻辑

#### 单例模式
```typescript
export class AndroidBridge {
  private static instance: AndroidBridge
  private isAvailable: boolean = false
  private eventListeners: Map<string, Function[]> = new Map()
  
  public static getInstance(): AndroidBridge {
    if (!AndroidBridge.instance) {
      AndroidBridge.instance = new AndroidBridge()
    }
    return AndroidBridge.instance
  }
}
```

#### 用户信息同步
```typescript
public syncUserInfo(userId: string, token: string, password?: string): boolean {
  try {
    if (!window.AndroidBridge?.syncUserInfo) {
      return false
    }
    
    const result = window.AndroidBridge.syncUserInfo(userId, token, password || '')
    const response = this.parseJSON<{ success: boolean; message: string }>(result, {
      success: false,
      message: '解析响应失败'
    })
    
    return response.success
  } catch (error) {
    return false
  }
}
```

#### 事件监听机制
```typescript
private eventListeners: Map<string, Function[]> = new Map()

public addEventListener(event: string, callback: Function): void {
  if (!this.eventListeners.has(event)) {
    this.eventListeners.set(event, [])
  }
  this.eventListeners.get(event)!.push(callback)
}

private emit(event: string, ...args: any[]): void {
  const listeners = this.eventListeners.get(event)
  if (listeners) {
    listeners.forEach(callback => {
      try {
        callback(...args)
      } catch (err) {
        // 静默处理
      }
    })
  }
}
```

### 3. 原生接口分类
- **用户相关**：`getUserToken()`, `getUserInfo()`, `syncUserInfo()`
- **语音相关**：`startVoiceRecording()`, `stopVoiceRecording()`, `playVoiceMessage()`
- **图片相关**：`selectImageFromGallery()`, `captureImageFromCamera()`, `compressImage()`
- **老师对话**：`createTeacherChatSession()`, `sendTextMessageToTeacher()`, `sendVoiceMessageToTeacher()`
- **课堂功能**：`joinClassroom()`, `exitClassroom()`, `startScreenProjection()`, `takeSnapshot()`

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：WebView JavaScript Bridge（通过 `window.AndroidBridge`）
- **React Native 实现**：React Native Native Modules（通过 `NativeModules`）

### 2. 需要的第三方库
- `react-native`：核心库（已安装）
- `@react-native-community/xxx`：可能需要社区原生模块（根据功能需求）

### 3. 迁移步骤
1. **创建 Native Module**：
   - Android：创建 Java/Kotlin 类继承 `ReactContextBaseJavaModule`
   - iOS：创建 Objective-C/Swift 类继承 `RCTBridgeModule`（可选）

2. **实现原生方法**：
   - 使用 `@ReactMethod` 注解标记需要暴露给 JS 的方法
   - 实现对应的原生功能逻辑

3. **注册 Native Module**：
   - Android：在 `MainApplication` 中注册模块
   - iOS：在 `BridgeDelegate` 中注册模块（可选）

4. **创建 TypeScript 接口**：
   - 创建 TypeScript 文件封装 Native Module 调用
   - 提供类型定义和方法封装

5. **实现事件监听**：
   - 使用 `NativeEventEmitter` 监听原生事件
   - 使用 `DeviceEventEmitter` 发送事件（如果需要）

### 4. 注意事项
- **异步操作**：所有原生方法调用都是异步的，需要使用 Promise 或回调
- **错误处理**：原生方法可能失败，需要处理错误情况
- **类型安全**：使用 TypeScript 定义类型，确保类型安全
- **平台差异**：Android 和 iOS 实现可能不同，需要处理平台差异

## 📝 迁移代码示例

### Web 实现（Android Bridge）
```typescript
export class AndroidBridge {
  public getUserInfo(): Partial<UserInfo> | null {
    const json = this.callString(() => window.AndroidBridge?.getUserInfo?.())
    if (!json) return null
    return this.parseJSON<any>(json, null)
  }
}
```

### React Native 实现（Native Module）
```typescript
// AndroidBridgeModule.java
package com.imates;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class AndroidBridgeModule extends ReactContextBaseJavaModule {
  public AndroidBridgeModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "AndroidBridge";
  }

  @ReactMethod
  public void getUserInfo(Promise promise) {
    try {
      // 从原生 ViewModel 获取用户信息
      UserInfo userInfo = getUserInfoFromViewModel();
      promise.resolve(convertToJson(userInfo));
    } catch (Exception e) {
      promise.reject("GET_USER_INFO_ERROR", e.getMessage());
    }
  }

  @ReactMethod
  public void syncUserInfo(String userId, String token, String password, Promise promise) {
    try {
      // 同步用户信息到原生 ViewModel
      syncUserInfoToViewModel(userId, token, password);
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("SYNC_USER_INFO_ERROR", e.getMessage());
    }
  }
}
```

```typescript
// androidBridge.ts
import { NativeModules, NativeEventEmitter } from 'react-native'

const { AndroidBridge } = NativeModules
const eventEmitter = new NativeEventEmitter(AndroidBridge)

export interface UserInfo {
  id: string
  name: string
  avatar?: string
  [key: string]: any
}

export class AndroidBridgeService {
  /**
   * 获取用户信息
   */
  public static async getUserInfo(): Promise<UserInfo | null> {
    try {
      if (!AndroidBridge) {
        return null
      }
      const result = await AndroidBridge.getUserInfo()
      return result ? JSON.parse(result) : null
    } catch (error) {
      console.error('[AndroidBridge] ❌ 获取用户信息失败:', error)
      return null
    }
  }

  /**
   * 同步用户信息到原生
   */
  public static async syncUserInfo(
    userId: string,
    token: string,
    password?: string
  ): Promise<boolean> {
    try {
      if (!AndroidBridge) {
        return false
      }
      await AndroidBridge.syncUserInfo(userId, token, password || '')
      return true
    } catch (error) {
      console.error('[AndroidBridge] ❌ 同步用户信息失败:', error)
      return false
    }
  }

  /**
   * 监听原生事件
   */
  public static addEventListener(
    eventName: string,
    callback: (data: any) => void
  ): void {
    eventEmitter.addListener(eventName, callback)
  }

  /**
   * 移除事件监听
   */
  public static removeEventListener(
    eventName: string,
    callback: (data: any) => void
  ): void {
    eventEmitter.removeListener(eventName, callback)
  }
}
```

## ⚠️ 迁移风险

### 高风险项
- **原生功能实现**：需要重新实现所有原生功能 - **解决方案**：参考现有 Android 原生代码，逐步迁移功能
- **事件监听机制**：React Native 的事件机制与 WebView Bridge 不同 - **解决方案**：使用 `NativeEventEmitter` 实现事件监听
- **异步操作**：所有原生方法调用都是异步的 - **解决方案**：使用 Promise 或 async/await 处理异步操作
- **类型安全**：需要手动定义 TypeScript 类型 - **解决方案**：创建完整的类型定义文件

## 🧪 测试要点

### 功能测试
- 测试用户信息获取
- 测试用户信息同步
- 测试原生功能调用（相机、录音等）
- 测试事件监听
- 测试错误处理
- 测试平台差异（Android/iOS）

## 📚 参考资源

- [React Native Native Modules 文档](https://reactnative.dev/docs/native-modules-intro)
- [React Native Native Modules Android 指南](https://reactnative.dev/docs/native-modules-android)
- [React Native Native Modules iOS 指南](https://reactnative.dev/docs/native-modules-ios)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
