# MathFormulaEditor.tsx PRD 文档

## 📋 概述

**文件路径**：`src/components/MathFormulaEditor.tsx`  
**文件类型**：`React Native 组件`  
**主要职责**：提供数学公式编辑功能，支持文本和数学公式混合输入

## 🎯 功能需求

### 1. 核心功能
- **文本输入**：支持多行文本输入
- **数学公式编辑**：插入和编辑 LaTeX 数学公式
- **混合内容**：支持文本和公式混合编辑
- **内容导出**：将编辑器内容导出为 Markdown 格式
- **内容设置**：支持从 Markdown 设置编辑器内容

### 2. 功能边界
- **负责的功能**：
  - 文本和公式的混合编辑
  - 公式插入和编辑
  - 内容格式转换（Markdown）
- **不负责的功能**：
  - 公式的实际渲染（由显示组件负责）
  - 内容的发送（由父组件负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { View, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native'
  // 需要数学公式输入组件（可能需要 WebView 或第三方库）
  ```
- **被依赖**：
  - `ChatInput.tsx`：作为输入框使用

### 2. Props 接口
```typescript
export interface MathFormulaEditorProps {
  value: string              // 编辑器内容（Markdown 格式）
  placeholder?: string       // 占位符文本
  disabled?: boolean         // 是否禁用
  maxHeight?: string         // 最大高度
  onChange?: (value: string) => void  // 内容变化回调
  onFocus?: () => void       // 获得焦点回调
  onBlur?: () => void        // 失去焦点回调
  onKeyDown?: (event: KeyboardEvent) => void  // 键盘事件回调
}
```

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现（Web）**：使用 Quill 编辑器 + MathLive
- **React Native 实现**：使用 `TextInput` + WebView（用于数学公式）或专门的数学公式输入库

### 2. 需要的第三方库
- `react-native-webview`：用于数学公式编辑（使用 MathLive）
- 或专门的数学公式输入库（如果有的话）

### 3. 迁移步骤
1. 创建基础文本输入（使用 `TextInput`）
2. 实现公式插入功能（弹出公式编辑器）
3. 使用 WebView 集成 MathLive 进行公式编辑
4. 实现内容格式转换（Markdown 格式）
5. 实现内容设置和获取

### 4. 注意事项
- React Native 中没有类似 Quill 的富文本编辑器，需要自行实现
- 数学公式编辑可能需要使用 WebView 加载 MathLive
- 文本和公式的混合编辑需要特殊处理

## 📝 迁移代码示例

### Vue 实现
```vue
<div ref="editorRef" :id="editorId"></div>
<!-- 使用 Quill + MathLive -->
```

### React Native 实现
```tsx
<View style={styles.container}>
  <TextInput
    value={textContent}
    onChangeText={handleTextChange}
    multiline
    placeholder={placeholder}
  />
  {/* 公式显示和编辑区域 */}
  {formulas.map((formula, index) => (
    <TouchableOpacity
      key={index}
      onPress={() => editFormula(index)}
    >
      <WebView source={{ html: renderFormula(formula) }} />
    </TouchableOpacity>
  ))}
</View>
```

## ⚠️ 迁移风险

### 高风险项
- **富文本编辑复杂性**：React Native 中实现富文本编辑器较复杂
- **数学公式编辑**：需要使用 WebView，性能可能受影响
- **用户体验**：与 Web 版本的体验可能有所不同

## 🧪 测试要点

### 功能测试
- 文本输入正常
- 公式插入功能正常
- 公式编辑功能正常
- 内容导出为正确的 Markdown 格式
- 内容设置功能正常
- 键盘事件正确处理

## 📚 参考资源

- [React Native TextInput 文档](https://reactnative.dev/docs/textinput)
- [React Native WebView 文档](https://github.com/react-native-webview/react-native-webview)
- [MathLive 文档](https://cortexjs.io/mathlive/)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
