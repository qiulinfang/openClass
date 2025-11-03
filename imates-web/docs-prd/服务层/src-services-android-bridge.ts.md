# src/services/android-bridge.ts PRD 文档

## 📋 概述

**文件路径**：`imates-web/src/services/android-bridge.ts`  
**文件类型**：TypeScript 服务类  
**主要职责**：统一管理与原生 Android 端的通信，处理原生功能调用（相机、录音、语音播放、图片处理等）

## 🎯 功能需求

### 1. 原生功能调用
- **相机功能**：拍照、选择图片
- **录音功能**：开始/停止录音、播放语音
- **文件系统**：文件读写、资源管理
- **用户信息**：获取用户信息
- **设备信息**：获取设备信息
- **通知提示**：显示 Toast 提示

### 2. 事件监听
- 监听 Android 原生事件
- 处理回调函数
- 派发自定义事件供组件监听

### 3. 功能边界
- ✅ **负责**：原生功能调用（相机、录音、文件系统等）
- ❌ **不负责**：HTTP 相关接口（已移至 API 服务层）

## 🔧 技术实现

### 1. 单例模式
```typescript
export class AndroidBridge {
  private static instance: AndroidBridge
  
  public static getInstance(): AndroidBridge {
    if (!AndroidBridge.instance) {
      AndroidBridge.instance = new AndroidBridge()
    }
    return AndroidBridge.instance
  }
}
```

### 2. 可用性检测
```typescript
private checkAvailability(): void {
  this.isAvailable = typeof window !== 'undefined' && 
                    typeof window.AndroidBridge !== 'undefined'
}
```

### 3. 回调函数设置
```typescript
private setupCallbacks(): void {
  // 设置流式响应回调
  window.onStreamResponse = (requestId, chunk, isComplete) => { ... }
  
  // 设置聊天响应回调
  window.onChatResponse = (requestId, response) => { ... }
  
  // 设置图片相关回调
  this.setupImageCallbacks()
  
  // 设置课堂相关回调
  this.setupClassroomCallbacks()
}
```

### 4. 核心方法

#### getUserInfo
- **功能**：获取用户信息
- **返回**：`Promise<UserInfo | null>`

#### takePicture
- **功能**：拍照
- **返回**：`Promise<ImagePickerResponse>`

#### pickImage
- **功能**：选择图片
- **返回**：`Promise<ImagePickerResponse>`

#### startVoiceRecording
- **功能**：开始录音
- **返回**：`Promise<VoiceRecordingResponse>`

#### stopVoiceRecording
- **功能**：停止录音
- **返回**：`Promise<VoiceRecordingResponse>`

#### playVoice
- **功能**：播放语音
- **参数**：`filePath: string`
- **返回**：`Promise<void>`

#### showToast
- **功能**：显示 Toast 提示
- **参数**：`message: string`
- **返回**：`Promise<void>`

## 🔄 迁移到 React Native

### 1. 架构变化

#### 当前实现（Android Bridge）
```typescript
// WebView 中通过 window.AndroidBridge 调用原生方法
private callString(fn: (() => string | undefined) | undefined): string {
  if (this.isAvailable && fn) {
    return fn()
  }
  return ''
}
```

#### React Native 实现（Native Modules）
```typescript
// 创建 Native Module
import { NativeModules, NativeEventEmitter } from 'react-native'

const { ImatesNativeModule } = NativeModules
const nativeEmitter = new NativeEventEmitter(ImatesNativeModule)

export class ImatesNativeBridge {
  // 获取用户信息
  static async getUserInfo(): Promise<UserInfo | null> {
    try {
      const userInfo = await ImatesNativeModule.getUserInfo()
      return userInfo
    } catch (error) {
      console.error('获取用户信息失败:', error)
      return null
    }
  }
  
  // 拍照
  static async takePicture(): Promise<ImagePickerResponse> {
    try {
      const result = await ImatesNativeModule.takePicture()
      return result
    } catch (error) {
      console.error('拍照失败:', error)
      throw error
    }
  }
  
  // 选择图片
  static async pickImage(): Promise<ImagePickerResponse> {
    try {
      const result = await ImatesNativeModule.pickImage()
      return result
    } catch (error) {
      console.error('选择图片失败:', error)
      throw error
    }
  }
}
```

### 2. Native Module 实现（Android）

#### 创建 Java/Kotlin Module
```java
// android/app/src/main/java/com/imates/ImatesModule.java
package com.imates;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class ImatesModule extends ReactContextBaseJavaModule {
    public ImatesModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }
    
    @Override
    public String getName() {
        return "ImatesNativeModule";
    }
    
    @ReactMethod
    public void getUserInfo(Promise promise) {
        try {
            // 实现获取用户信息的逻辑
            WritableMap userInfo = Arguments.createMap();
            // ... 填充用户信息
            promise.resolve(userInfo);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
    
    @ReactMethod
    public void takePicture(Promise promise) {
        // 实现拍照逻辑
    }
    
    @ReactMethod
    public void pickImage(Promise promise) {
        // 实现选择图片逻辑
    }
}
```

### 3. 事件监听迁移

#### 当前实现（WebView 回调）
```typescript
window.onStreamResponse = (requestId, chunk, isComplete) => {
  const event = new CustomEvent('nativeStreamResponse', {
    detail: { requestId, chunk, isComplete }
  })
  window.dispatchEvent(event)
}
```

#### React Native 实现（EventEmitter）
```typescript
// 监听原生事件
import { NativeEventEmitter, NativeModules } from 'react-native'

const { ImatesNativeModule } = NativeModules
const nativeEmitter = new NativeEventEmitter(ImatesNativeModule)

nativeEmitter.addListener('StreamResponse', (data) => {
  const { requestId, chunk, isComplete } = data
  // 处理流式响应
})

nativeEmitter.addListener('ChatResponse', (data) => {
  const { requestId, response } = data
  // 处理聊天响应
})
```

### 4. 需要的第三方库

#### 相机和图片选择
```bash
npm install react-native-image-picker
# 或
npm install react-native-image-crop-picker
```

#### 文件系统
```bash
npm install react-native-fs
```

#### 语音录制和播放
```bash
npm install react-native-audio-recorder-player
# 或
npm install @react-native-community/audio-toolkit
```

#### 通知提示
```bash
npm install react-native-toast-message
# 或
npm install react-native-flash-message
```

### 5. 迁移步骤

1. **创建 Native Module**
   - 在 Android 项目中创建 Java/Kotlin Module
   - 在 iOS 项目中创建 Objective-C/Swift Module（如果需要）

2. **封装 React Native Bridge**
   - 创建 `ImatesNativeBridge.ts` 文件
   - 封装所有原生方法调用
   - 实现错误处理

3. **实现事件监听**
   - 使用 `NativeEventEmitter` 监听原生事件
   - 创建事件订阅/取消订阅机制

4. **替换调用方式**
   - 将所有 `androidBridge` 调用替换为 `ImatesNativeBridge`
   - 更新组件中的事件监听逻辑

5. **测试验证**
   - 测试所有原生功能是否正常工作
   - 验证事件监听是否正常

## ⚠️ 注意事项

### 1. 平台差异
- **Android**：需要创建 Java/Kotlin Module
- **iOS**：需要创建 Objective-C/Swift Module（如果需要支持 iOS）
- 两个平台的实现可能不同

### 2. 异步处理
- React Native 中的原生调用都是异步的
- 需要使用 `Promise` 或 `async/await` 处理

### 3. 错误处理
- 原生方法可能抛出异常
- 需要在 JavaScript 层处理错误

### 4. 类型定义
- 需要为 Native Module 创建 TypeScript 类型定义
- 可以使用 `@types/react-native` 或自定义类型

### 5. 事件监听生命周期
- 组件挂载时添加监听器
- 组件卸载时移除监听器，避免内存泄漏

## 📝 迁移代码示例

### Android Bridge 实现
```typescript
// 当前实现
export class AndroidBridge {
  public async getUserInfo(): Promise<UserInfo | null> {
    const userInfoStr = this.callString(() => 
      window.AndroidBridge?.getUserInfo?.()
    )
    if (!userInfoStr) return null
    return JSON.parse(userInfoStr)
  }
}
```

### React Native Bridge 实现
```typescript
// React Native 实现
import { NativeModules } from 'react-native'

const { ImatesNativeModule } = NativeModules

export class ImatesNativeBridge {
  public static async getUserInfo(): Promise<UserInfo | null> {
    try {
      const userInfo = await ImatesNativeModule.getUserInfo()
      return userInfo as UserInfo
    } catch (error) {
      console.error('获取用户信息失败:', error)
      return null
    }
  }
}
```

## 🧪 测试要点

### 功能测试
- ✅ 获取用户信息是否正常
- ✅ 拍照功能是否正常
- ✅ 选择图片功能是否正常
- ✅ 录音功能是否正常
- ✅ 语音播放是否正常

### 错误处理测试
- ✅ 原生方法调用失败时的错误处理
- ✅ 事件监听异常时的处理
- ✅ 网络异常时的处理

### 边界测试
- ✅ 原生模块不可用时的降级处理
- ✅ 权限被拒绝时的处理
- ✅ 设备不支持时的处理

## 📚 参考资源

- [React Native Native Modules 文档](https://reactnative.dev/docs/native-modules-intro)
- [React Native 事件监听](https://reactnative.dev/docs/native-modules-ios#sending-events-to-javascript)
- [react-native-image-picker 文档](https://github.com/react-native-image-picker/react-native-image-picker)
- [react-native-fs 文档](https://github.com/itinance/react-native-fs)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队

