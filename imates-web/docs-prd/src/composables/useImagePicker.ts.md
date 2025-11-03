# useImagePicker.ts PRD 文档

## 📋 概述

**文件路径**：`src/composables/useImagePicker.ts`  
**文件类型**：`Vue 3 Composable (TypeScript)`  
**主要职责**：全局图片选择器的组合式函数，提供统一的图片选择 API，确保全局只有一个 ImagePicker 实例，用于图片上传和分享功能

## 🎯 功能需求

### 1. 核心功能

#### 1.1 图片选择
- **显示选择器**：
  - 显示图片选择器对话框
  - 支持全局单例模式（确保只有一个实例）
  - 状态管理（`isPickerVisible`）
- **选择图片**：
  - 用户选择图片后返回 `ImageData` 对象
  - 包含图片路径、尺寸、大小等信息
- **取消选择**：
  - 用户取消选择时返回 `null`
  - 清理 Promise 回调

#### 1.2 Promise 模式
- **异步处理**：
  - 使用 Promise 处理异步选择流程
  - 保存 `resolve` 回调用于返回结果
  - 确保 Promise 只执行一次

#### 1.3 状态管理
- **全局状态**：
  - `isPickerVisible`：控制选择器对话框显示/隐藏
  - `resolveCallback`：保存 Promise 的 resolve 回调
  - 确保状态一致性

### 2. 功能边界

#### 2.1 负责的功能
- ✅ 图片选择器的状态管理
- ✅ Promise 的创建和 resolve 处理
- ✅ 全局单例模式管理
- ✅ 选择结果的返回

#### 2.2 不负责的功能
- ❌ 图片选择器 UI 的渲染（由 `ImagePicker.vue` 组件负责）
- ❌ 图片的实际选择操作（由 Android Bridge 或 Web API 负责）
- ❌ 图片的预览和处理（由使用方负责）
- ❌ 对话框的关闭逻辑（由 `ImagePicker.vue` 组件负责）

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
import { ref } from 'vue'
import type { ImageData } from '../types'
```

#### 1.2 被依赖
- `ImagePicker.vue`：使用 `useImagePicker` 的状态和方法
- `ChatView.vue`：通过 `useImagePicker` 调用图片选择功能
- 其他需要图片选择功能的组件

### 2. 关键代码逻辑

#### 2.1 全局状态

```typescript
// 全局单例状态
const isPickerVisible = ref(false) // 是否显示选择器
let resolveCallback: ((imageInfo: ImageData | null) => void) | null = null // Promise resolve 回调
```

#### 2.2 图片选择函数

```typescript
const pickImage = (): Promise<ImageData | null> => {
  return new Promise((resolve) => {
    // 第1步：保存 resolve 回调
    resolveCallback = resolve
    
    // 第2步：显示选择器对话框
    isPickerVisible.value = true
  })
}
```

**流程说明**：
1. 创建新的 Promise
2. 保存 `resolve` 回调到全局变量
3. 设置 `isPickerVisible` 为 `true`，触发 UI 显示
4. 等待用户选择或取消
5. 通过 `handleImageSelected` 或 `handleCancel` 返回结果

#### 2.3 图片选择处理

```typescript
const handleImageSelected = (imageInfo: ImageData) => {
  if (resolveCallback) {
    resolveCallback(imageInfo) // 返回图片数据
    resolveCallback = null // 清理回调
  } else {
    console.error('resolveCallback为null，Promise已经结束！')
  }
}
```

**流程说明**：
1. 接收图片选择结果（由 `ImagePicker.vue` 组件调用）
2. 检查是否存在 `resolveCallback`
3. 调用 `resolveCallback` 返回图片数据
4. 清理 `resolveCallback`，防止重复调用

#### 2.4 取消处理

```typescript
const handleCancel = () => {
  if (resolveCallback) {
    resolveCallback(null) // 返回 null 表示取消
    resolveCallback = null // 清理回调
  } else {
    console.warn('resolveCallback为null，Promise已经结束')
  }
}
```

**流程说明**：
1. 用户取消选择（由 `ImagePicker.vue` 组件调用）
2. 检查是否存在 `resolveCallback`
3. 调用 `resolveCallback(null)` 返回取消状态
4. 清理 `resolveCallback`

#### 2.5 返回值

```typescript
return {
  isPickerVisible,      // 响应式状态，控制对话框显示
  pickImage,            // 图片选择函数
  handleImageSelected,  // 选择结果处理函数
  handleCancel          // 取消处理函数
}
```

### 3. 使用示例

#### 3.1 基础使用

```typescript
import { useImagePicker } from '@/composables/useImagePicker'

const { pickImage } = useImagePicker()

// 选择图片
const handlePickImage = async () => {
  try {
    const imageInfo = await pickImage()
    if (imageInfo) {
      console.log('选择的图片:', imageInfo)
      // 处理图片数据
      // - imageInfo.filePath: 图片路径
      // - imageInfo.width: 图片宽度
      // - imageInfo.height: 图片高度
      // - imageInfo.fileSize: 文件大小
      // - imageInfo.base64DataUrl: base64 数据 URL（可选）
    } else {
      console.log('用户取消了选择')
    }
  } catch (error) {
    console.error('图片选择失败:', error)
  }
}
```

#### 3.2 在组件中使用

```typescript
// ChatView.vue
import { useImagePicker } from '@/composables/useImagePicker'

const { pickImage } = useImagePicker()

const handleImagePicker = async () => {
  const imageInfo = await pickImage()
  if (imageInfo) {
    // 创建图片消息
    const imageMessage: ChatBubble = {
      id: generateId(),
      content: '',
      sender: 'user',
      type: 'user',
      timestamp: new Date().toISOString(),
      messageType: 'image',
      imageData: imageInfo
    }
    
    // 发送图片消息
    await sendMessage(imageMessage)
  }
}
```

#### 3.3 ImagePicker 组件集成

```vue
<!-- ImagePicker.vue -->
<script setup>
import { useImagePicker } from '@/composables/useImagePicker'

const {
  isPickerVisible,
  handleImageSelected,
  handleCancel
} = useImagePicker()

const handleImageSelect = (imageInfo: ImageData) => {
  handleImageSelected(imageInfo)
  // 关闭对话框（由组件自行管理）
  isPickerVisible.value = false
}

const handleDialogCancel = () => {
  handleCancel()
  // 关闭对话框
  isPickerVisible.value = false
}
</script>

<template>
  <q-dialog v-model="isPickerVisible" @hide="handleDialogCancel">
    <!-- 图片选择器 UI -->
    <q-card>
      <q-card-section>
        <q-btn @click="handleImageSelectFromCamera">拍照</q-btn>
        <q-btn @click="handleImageSelectFromGallery">相册</q-btn>
        <q-btn @click="handleDialogCancel">取消</q-btn>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
```

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 当前实现
- **实现方式**：Vue 3 Composable + Promise 模式
- **特点**：全局单例、异步处理、状态管理

#### 1.2 React Native 实现
- **实现方式**：React Hook + Promise 模式
- **特点**：使用 React Native 的图片选择库（如 `react-native-image-picker`）

### 2. 需要的第三方库

```json
{
  "react-native": "^0.72.0",
  "react-native-image-picker": "^7.0.0",  // 图片选择库
  "@react-native-community/cameraroll": "^6.0.0"  // 相册访问（可选）
}
```

### 3. React Native 实现示例

```typescript
// useImagePicker.ts (React Native 版本)
import { useState, useCallback } from 'react'
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker'
import type { ImageData } from '../types'

interface ImagePickerOptions {
  mediaType?: MediaType
  quality?: number
  includeBase64?: boolean
}

export function useImagePicker() {
  const [isPickerVisible, setIsPickerVisible] = useState(false)

  const pickImage = useCallback(async (options: ImagePickerOptions = {}): Promise<ImageData | null> => {
    return new Promise((resolve) => {
      setIsPickerVisible(true)

      // 这里可以显示自定义的选择器 UI
      // 或者直接调用图片选择库
      const pickImageFromLibrary = async () => {
        const result = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.8,
          includeBase64: true,
          ...options
        })

        if (result.didCancel) {
          resolve(null)
        } else if (result.errorCode) {
          console.error('图片选择错误:', result.errorMessage)
          resolve(null)
        } else if (result.assets && result.assets[0]) {
          const asset = result.assets[0]
          const imageInfo: ImageData = {
            filePath: asset.uri || '',
            width: asset.width || 0,
            height: asset.height || 0,
            fileSize: asset.fileSize || 0,
            base64DataUrl: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined
          }
          resolve(imageInfo)
        } else {
          resolve(null)
        }

        setIsPickerVisible(false)
      }

      // 调用选择器
      pickImageFromLibrary()
    })
  }, [])

  const pickImageFromCamera = useCallback(async (options: ImagePickerOptions = {}): Promise<ImageData | null> => {
    return new Promise((resolve) => {
      launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
        ...options
      }, (result: ImagePickerResponse) => {
        if (result.didCancel) {
          resolve(null)
        } else if (result.errorCode) {
          console.error('拍照错误:', result.errorMessage)
          resolve(null)
        } else if (result.assets && result.assets[0]) {
          const asset = result.assets[0]
          const imageInfo: ImageData = {
            filePath: asset.uri || '',
            width: asset.width || 0,
            height: asset.height || 0,
            fileSize: asset.fileSize || 0,
            base64DataUrl: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined
          }
          resolve(imageInfo)
        } else {
          resolve(null)
        }
      })
    })
  }, [])

  const handleCancel = useCallback(() => {
    setIsPickerVisible(false)
  }, [])

  return {
    isPickerVisible,
    pickImage,
    pickImageFromCamera,
    handleCancel
  }
}
```

#### 使用示例

```typescript
// ChatView.tsx
import { useImagePicker } from '@/hooks/useImagePicker'

export const ChatView: React.FC = () => {
  const { pickImage, pickImageFromCamera } = useImagePicker()

  const handlePickImage = async () => {
    const imageInfo = await pickImage({
      quality: 0.8,
      includeBase64: true
    })

    if (imageInfo) {
      // 处理图片数据
      console.log('选择的图片:', imageInfo)
    }
  }

  const handleTakePhoto = async () => {
    const imageInfo = await pickImageFromCamera({
      quality: 0.8,
      includeBase64: true
    })

    if (imageInfo) {
      // 处理拍照结果
      console.log('拍摄的图片:', imageInfo)
    }
  }

  return (
    <View>
      <Button title="选择图片" onPress={handlePickImage} />
      <Button title="拍照" onPress={handleTakePhoto} />
    </View>
  )
}
```

### 4. 注意事项

#### 4.1 权限处理
- **Android**：需要在 `AndroidManifest.xml` 中添加权限
  ```xml
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
  ```
- **iOS**：需要在 `Info.plist` 中添加权限说明
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>需要访问相机以拍照</string>
  <key>NSPhotoLibraryUsageDescription</key>
  <string>需要访问相册以选择图片</string>
  ```

#### 4.2 文件路径差异
- **Web 端**：可能使用 base64 或 URL
- **React Native**：使用本地文件路径（`file://`）或 base64

#### 4.3 Promise 处理
- **Web 端**：使用全局单例模式，确保只有一个 Promise
- **React Native**：每次调用创建新的 Promise，无需全局单例

#### 4.4 图片处理
- **Web 端**：可能需要压缩和处理（由使用方负责）
- **React Native**：可以使用 `react-native-image-picker` 的内置压缩选项

## ⚠️ 迁移风险

### 高风险项

1. **权限处理**：
   - **风险**：React Native 需要显式请求权限
   - **解决方案**：使用权限请求库（如 `react-native-permissions`）
   - **影响**：需要处理权限拒绝的情况

2. **文件路径格式**：
   - **风险**：Web 和 React Native 的文件路径格式不同
   - **解决方案**：统一使用 base64 或 URL 格式
   - **影响**：需要调整图片处理逻辑

3. **图片选择库差异**：
   - **风险**：不同平台的图片选择行为可能不同
   - **解决方案**：使用跨平台库，或针对平台定制
   - **影响**：用户体验可能略有差异

### 中风险项

1. **Promise 管理**：
   - React Native 版本无需全局单例，需要确保 Promise 正确清理
   - 需要处理组件卸载时的 Promise 取消

2. **图片压缩**：
   - 不同平台可能需要不同的压缩策略
   - 需要测试压缩后的图片质量

## 🧪 测试要点

### 功能测试

1. **图片选择测试**：
   - ✅ 选择图片后正确返回 `ImageData`
   - ✅ 取消选择时返回 `null`
   - ✅ Promise 正确 resolve

2. **状态管理测试**：
   - ✅ 全局单例模式正常工作
   - ✅ `isPickerVisible` 状态正确更新
   - ✅ `resolveCallback` 正确清理

3. **错误处理测试**：
   - ✅ 图片选择失败时正确处理
   - ✅ Promise 重复调用时正确处理
   - ✅ 组件卸载时 Promise 正确清理

### 边界测试

1. **并发选择测试**：
   - 多个组件同时调用 `pickImage` 时的行为
   - Promise 状态管理是否正确

2. **取消操作测试**：
   - 快速取消和选择时的行为
   - Promise 回调是否正确清理

## 📚 参考资源

### 相关文档
- [react-native-image-picker 文档](https://github.com/react-native-image-picker/react-native-image-picker)
- [React Native Permissions 文档](https://github.com/zoontek/react-native-permissions)

### 相关文件
- `src/components/chat/ImagePicker.vue` - 图片选择器 UI 组件
- `src/components/ChatView.vue` - 使用图片选择器的组件
- `src/types/media.ts` - 图片数据类型定义

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**最后更新**：2025-01-XX  
**维护者**：开发团队
