# VoiceMessage.tsx PRD 文档

## 📋 概述

**文件路径**：`src/components/chat/VoiceMessage.tsx`  
**文件类型**：`React Native 组件`  
**主要职责**：显示和播放语音消息，支持播放控制、波形动画和时长显示

## 🎯 功能需求

### 1. 核心功能
- **语音播放**：播放本地语音文件
- **播放控制**：播放/暂停切换
- **波形动画**：播放时显示动态波形动画
- **时长显示**：显示语音时长
- **状态管理**：管理播放状态和加载状态

### 2. 功能边界
- **负责的功能**：
  - 语音播放控制
  - 播放状态显示
  - 波形动画
  - 时长格式化显示
- **不负责的功能**：
  - 语音录制（由 VoiceRecorder 负责）
  - 语音文件存储（由存储服务负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
  import { Audio } from 'expo-av'  // 或其他音频库
  ```
- **被依赖**：
  - `ChatMessage.tsx`：在消息气泡中显示语音消息

### 2. Props 接口
```typescript
export interface VoiceMessageProps {
  filePath: string     // 语音文件路径
  duration: number     // 语音时长（秒）
  isUser?: boolean     // 是否为用户消息
}
```

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现（Web）**：使用 Android Bridge 调用原生播放功能
- **React Native 实现**：使用 `expo-av` 或 `react-native-sound` 进行音频播放

### 2. 需要的第三方库
- `expo-av`：音频播放（推荐）
- 或 `react-native-sound`：音频播放（备选）

### 3. 迁移步骤
1. 安装音频播放库（如 `expo-av`）
2. 创建 `VoiceMessage.tsx` 组件
3. 实现音频播放逻辑
4. 实现播放状态管理
5. 实现波形动画（使用 `Animated` API）
6. 实现时长显示

### 4. 注意事项
- React Native 中需要使用专门的音频库，不能直接调用原生桥接
- 波形动画需要使用 `Animated` API 实现
- 需要处理音频播放的生命周期（组件卸载时停止播放）

## 📝 迁移代码示例

### Vue 实现
```vue
<q-btn
  :icon="isPlaying ? 'pause' : 'play_arrow'"
  @click="togglePlayback"
/>
```

### React Native 实现
```tsx
<TouchableOpacity onPress={togglePlayback}>
  <Icon name={isPlaying ? 'pause' : 'play-arrow'} />
</TouchableOpacity>
```

## ⚠️ 迁移风险

### 高风险项
- **音频播放库选择**：需要选择稳定且支持本地文件播放的库
- **性能**：波形动画可能影响性能
- **平台兼容性**：不同平台（iOS/Android）的音频行为可能不同

## 🧪 测试要点

### 功能测试
- 语音文件正常播放
- 播放/暂停功能正常
- 播放状态正确更新
- 波形动画正常显示
- 时长显示正确
- 组件卸载时正确停止播放

## 📚 参考资源

- [Expo AV 文档](https://docs.expo.dev/versions/latest/sdk/av/)
- [React Native Sound 文档](https://github.com/zmxv/react-native-sound)
- [React Native Animated 文档](https://reactnative.dev/docs/animated)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
