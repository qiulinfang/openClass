# ImageMessage.tsx PRD 文档

## 📋 概述

**文件路径**：`src/components/chat/ImageMessage.tsx`  
**文件类型**：`React Native 组件`  
**主要职责**：显示聊天中的图片消息，支持图片预览、加载状态和错误处理

## 🎯 功能需求

### 1. 核心功能
- **图片显示**：从 base64 数据 URL 显示图片
- **图片预览**：点击图片全屏预览
- **加载状态**：显示图片加载中的状态
- **错误处理**：图片加载失败时显示错误提示和重试按钮
- **尺寸适配**：根据图片原始尺寸和最大限制自动适配显示尺寸
- **信息显示**：显示图片尺寸和文件大小（可选）

### 2. 功能边界
- **负责的功能**：
  - 图片加载和显示
  - 图片预览对话框
  - 加载状态管理
  - 错误处理和重试
- **不负责的功能**：
  - 图片选择（由 ImagePicker 负责）
  - 图片上传（由 API 服务负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { Image, Modal, TouchableOpacity, View, Text, ActivityIndicator, StyleSheet } from 'react-native'
  ```
- **被依赖**：
  - `ChatMessage.tsx`：在消息气泡中显示图片消息

### 2. Props 接口
```typescript
export interface ImageMessageProps {
  base64DataUrl: string  // Base64 数据 URL
  width?: number         // 图片宽度（像素）
  height?: number        // 图片高度（像素）
  fileSize?: number      // 文件大小（字节）
  isUser?: boolean       // 是否为用户消息
  maxWidth?: number      // 最大显示宽度
  maxHeight?: number     // 最大显示高度
  showInfo?: boolean     // 是否显示图片信息
}
```

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现（Web）**：使用 `<img>` 标签和 Quasar Dialog
- **React Native 实现**：使用 `Image` 组件和 `Modal` 组件

### 2. 需要的第三方库
- 无需额外库，使用 React Native 内置组件

### 3. 迁移步骤
1. 将 `<img>` 替换为 `Image` 组件
2. 将 `q-dialog` 替换为 `Modal` 组件
3. 将 `q-spinner-dots` 替换为 `ActivityIndicator`
4. 使用 `TouchableOpacity` 实现点击预览
5. 适配样式到 React Native StyleSheet

### 4. 注意事项
- React Native 的 `Image` 组件支持 `source={{ uri: 'data:image/...' }}` 格式的 base64
- Modal 需要使用 `visible` prop 控制显示/隐藏
- 样式需要使用 StyleSheet 而非 CSS

## 📝 迁移代码示例

### Vue 实现
```vue
<img
  :src="base64DataUrl"
  :style="imageStyle"
  @load="handleImageLoad"
  @error="handleImageError"
/>
```

### React Native 实现
```tsx
<Image
  source={{ uri: base64DataUrl }}
  style={imageStyle}
  onLoad={handleImageLoad}
  onError={handleImageError}
  resizeMode="contain"
/>
```

## ⚠️ 迁移风险

### 高风险项
- **Base64 支持**：确保 `Image` 组件正确支持 base64 数据 URL
- **性能**：大图片可能影响性能，需要优化
- **内存管理**：图片预览时需要注意内存使用

## 🧪 测试要点

### 功能测试
- 图片正常加载和显示
- 点击图片可以全屏预览
- 加载状态正确显示
- 加载失败时显示错误提示和重试功能
- 图片尺寸适配正确

## 📚 参考资源

- [React Native Image 文档](https://reactnative.dev/docs/image)
- [React Native Modal 文档](https://reactnative.dev/docs/modal)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
