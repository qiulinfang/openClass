# MarkdownRenderer PRD 文档

## 📋 概述

**文件路径**：`src/utils/render/markdownRenderer.ts`  
**文件类型**：`TypeScript 工具/服务`  
**主要职责**：提供 Markdown 渲染功能，用于渲染聊天消息中的 Markdown 和数学公式

## 🎯 功能需求

### 1. 核心功能
- **Markdown 渲染**：将 Markdown 文本转换为 HTML 结构
- **数学公式支持**：支持 LaTeX 数学公式渲染（行内和块级）
- **缓存管理**：缓存渲染结果，避免重复渲染相同内容
- **LaTeX 预处理**：将各种 LaTeX 格式统一转换为 Markdown 可识别的格式

### 2. 功能边界
- **负责的功能**：
  - Markdown 到 HTML 的转换
  - LaTeX 公式的预处理和格式转换
  - 渲染缓存管理
- **不负责的功能**：
  - 实际的 HTML 渲染（由组件负责）
  - 数学公式的实际渲染（由 react-native-math-view 或 WebView 负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import Markdown from 'react-native-markdown-display'
  // 或者使用 react-native-markdown-display 的渲染函数
  ```
- **被依赖**：
  - `ChatMessage.tsx`：用于渲染消息内容
  - `StreamingMessage.tsx`：用于流式消息渲染

### 2. 关键代码逻辑
```typescript
// markdownRenderer.ts 的核心代码
import Markdown from 'react-native-markdown-display'

// 预处理 LaTeX 公式格式
const preprocessLatexFormats = (content: string): string => {
  // 处理各种 LaTeX 格式
  // 1. MathLive 输出格式
  // 2. 行内公式 \(...\)
  // 3. 块级公式 \[...\]
  // 4. Markdown 格式 $...$ 和 $$...$$
}

// 渲染消息内容
export const renderMessageContent = (content: string): string => {
  // 1. 预处理 LaTeX
  // 2. 使用 Markdown 渲染器
  // 3. 返回渲染结果
}
```

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现（Web）**：使用 `markdown-it` + `markdown-it-mathjax3` + MathJax
- **React Native 实现**：使用 `react-native-markdown-display` 进行 Markdown 渲染，使用 WebView 或 `react-native-math-view` 进行数学公式渲染

### 2. 需要的第三方库
- `react-native-markdown-display`：Markdown 渲染
- `react-native-math-view` 或 WebView + MathJax：数学公式渲染（可选，根据需要）

### 3. 迁移步骤
1. 安装 `react-native-markdown-display`
2. 创建 `markdownRenderer.ts` 工具文件
3. 实现 LaTeX 预处理逻辑
4. 实现渲染函数，返回可用于 `react-native-markdown-display` 的内容
5. 在 `ChatMessage` 和 `StreamingMessage` 中使用

### 4. 注意事项
- React Native 中不能直接使用 `v-html`，需要使用 `react-native-markdown-display` 的组件
- 数学公式渲染可能需要使用 WebView 或专门的数学公式组件
- 缓存策略需要适配 React Native 的内存管理

## 📝 迁移代码示例

### Vue 实现
```typescript
// useMessageRenderer.ts
import MarkdownIt from 'markdown-it'
import mathjax3 from 'markdown-it-mathjax3'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
}).use(mathjax3)

export function useMessageRenderer() {
  const renderMessageContent = (content: string): string => {
    const processed = preprocessLatexFormats(content)
    return md.render(processed)
  }
  
  return { renderMessageContent }
}
```

### React Native 实现
```typescript
// markdownRenderer.ts
import Markdown from 'react-native-markdown-display'

// 预处理 LaTeX 格式
const preprocessLatexFormats = (content: string): string => {
  // 实现格式转换逻辑
}

// 渲染消息内容（返回可用于 Markdown 组件的内容）
export const renderMessageContent = (content: string): string => {
  return preprocessLatexFormats(content)
}

// 获取 Markdown 渲染规则（用于 react-native-markdown-display）
export const getMarkdownRules = () => {
  // 返回自定义的渲染规则，支持数学公式等
}
```

## ⚠️ 迁移风险

### 高风险项
- **数学公式渲染**：React Native 中数学公式渲染可能需要 WebView，性能开销较大
- **样式兼容性**：`react-native-markdown-display` 的样式可能与 Web 版本不完全一致
- **性能影响**：大量消息渲染时可能影响性能

## 🧪 测试要点

### 功能测试
- Markdown 文本正确渲染
- 数学公式（行内和块级）正确显示
- 缓存机制正常工作
- 各种 LaTeX 格式都能正确处理

## 📚 参考资源

- [react-native-markdown-display 文档](https://github.com/iamacup/react-native-markdown-display)
- [react-native-math-view 文档](https://github.com/acdibble/react-native-math-view)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
