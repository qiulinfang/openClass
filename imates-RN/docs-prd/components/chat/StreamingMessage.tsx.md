# StreamingMessage.tsx PRD 文档

## 📋 概述

**文件路径**：`src/components/chat/StreamingMessage.tsx`  
**文件类型**：`React Native 组件`  
**主要职责**：显示流式消息和打字机效果，支持实时流式更新和打字机动画

## 🎯 功能需求

### 1. 核心功能
- **流式显示**：实时显示流式消息内容
- **打字机效果**：非流式模式下逐字符显示的打字机动画
- **Markdown 渲染**：支持 Markdown 和数学公式渲染
- **光标动画**：显示闪烁的光标指示正在输入
- **进度回调**：打字机效果时报告进度

### 2. 功能边界
- **负责的功能**：
  - 消息内容的流式显示
  - 打字机动画效果
  - 光标闪烁动画
  - 内容渲染
- **不负责的功能**：
  - Markdown 解析（由 MarkdownRenderer 负责）
  - 数学公式渲染（由 MarkdownRenderer 负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { View, Text, StyleSheet, Animated } from 'react-native'
  import Markdown from 'react-native-markdown-display'
  import { renderMessageContent } from '../../utils/render/markdownRenderer'
  ```
- **被依赖**：
  - `ChatMessage.tsx`：在消息气泡中显示流式消息

### 2. Props 接口
```typescript
export interface StreamingMessageProps {
  content: string           // 消息内容
  isStreaming?: boolean     // 是否为流式模式
  typewriterSpeed?: number  // 打字机速度（毫秒）
  onComplete?: () => void   // 打字机完成回调
  onProgress?: (progress: number) => void  // 进度回调
}
```

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现（Web）**：使用 `v-html` 和定时器实现打字机效果
- **React Native 实现**：使用 `react-native-markdown-display` 和 `Animated` API

### 2. 需要的第三方库
- `react-native-markdown-display`：Markdown 渲染
- 无需额外动画库，使用 React Native 内置的 `Animated`

### 3. 迁移步骤
1. 创建 `StreamingMessage.tsx` 组件
2. 实现流式显示逻辑（直接显示完整内容）
3. 实现打字机效果（使用定时器逐字符显示）
4. 使用 `react-native-markdown-display` 渲染 Markdown
5. 实现光标闪烁动画（使用 `Animated`）

### 4. 注意事项
- React Native 中不能使用 `v-html`，需要使用 `react-native-markdown-display` 组件
- 打字机效果需要控制渲染的内容长度
- 光标动画需要使用 `Animated` API 实现闪烁效果

## 📝 迁移代码示例

### Vue 实现
```vue
<div v-if="isStreaming" v-html="renderedContent">
  <span class="typing-cursor">▊</span>
</div>
<div v-else>
  <span v-html="displayedContent"></span>
  <span v-if="isTyping" class="typing-cursor">|</span>
</div>
```

### React Native 实现
```tsx
{isStreaming ? (
  <View>
    <Markdown>{renderedContent}</Markdown>
    <Animated.Text style={[styles.cursor, cursorOpacity]}>▊</Animated.Text>
  </View>
) : (
  <View>
    <Markdown>{displayedContent}</Markdown>
    {isTyping && (
      <Animated.Text style={[styles.cursor, cursorOpacity]}>|</Animated.Text>
    )}
  </View>
)}
```

## ⚠️ 迁移风险

### 高风险项
- **Markdown 渲染性能**：大量内容可能影响性能
- **打字机效果流畅性**：需要优化渲染性能
- **数学公式渲染**：数学公式的渲染可能需要额外处理

## 🧪 测试要点

### 功能测试
- 流式模式正确显示内容
- 打字机效果流畅运行
- 光标动画正常闪烁
- Markdown 正确渲染
- 数学公式正确显示
- 进度回调正确触发

## 📚 参考资源

- [react-native-markdown-display 文档](https://github.com/iamacup/react-native-markdown-display)
- [React Native Animated 文档](https://reactnative.dev/docs/animated)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
