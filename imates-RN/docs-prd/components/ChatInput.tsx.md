# ChatInput.tsx PRD 文档（React Native）

## 📋 概述

**文件路径**：`src/components/ChatInput.tsx`  
**文件类型**：`React Native Component`  
**主要职责**：提供聊天输入框，支持文本、数学公式、语音、图片等多种输入方式

**场景特点**：
- 集成 MathFormulaEditor 进行文本和公式输入
- 支持 AI 角色选择（同桌、学长、大神）
- 支持联网搜索切换
- 支持语音录制（仅教师对话）
- 支持图片上传（教师对话）
- 支持消息编辑模式

## 🎯 功能需求

### 1. 核心功能

#### 1.1 文本输入
- **输入框功能**：
  - 使用 MathFormulaEditor 进行文本输入
  - 支持多行输入
  - 支持占位符提示
  - 支持禁用状态
  - 最大高度 200px，超出自动滚动
- **事件处理**：
  - `onFocus`: 输入框获得焦点
  - `onBlur`: 输入框失去焦点
  - `onKeyDown`: 键盘事件处理（Enter 键发送）
  - `onChange`: 内容变化处理

#### 1.2 数学公式输入
- **公式插入**：
  - 点击"插入公式"按钮插入数学公式
  - 通过 MathFormulaEditor 的 `insertMathField()` 方法插入
  - 支持防抖处理（300ms）
- **公式编辑**：
  - 在公式块内进行编辑
  - 支持公式内容更新事件监听
  - 支持公式回车键发送消息
  - 支持公式取消编辑

#### 1.3 消息发送
- **发送流程**：
  1. 调用 MathFormulaEditor 的 `getMarkdownContent()` 获取完整内容
  2. 检查内容是否为空
  3. 更新 v-model 的值
  4. 使用 nextTick 确保父组件更新后再发送
  5. 清空输入内容
- **发送按钮**：
  - 显示加载状态（isLoading）
  - 显示编辑状态（isEditing）
  - 禁用状态（canSend 为 false）
  - 图标切换（发送/检查/加载中）

#### 1.4 消息编辑
- **编辑状态**：
  - 显示编辑指示器（"编辑消息"标签）
  - 显示取消编辑按钮
  - 发送按钮变为"检查"图标
  - 禁用模式选择器和联网搜索按钮
- **取消编辑**：
  - 点击取消按钮触发 `cancel-edit` 事件
  - 恢复普通输入模式

#### 1.5 AI 角色选择（AI 通用、AI 题目、AI 教材模式）
- **角色选项**：
  - 同桌（mate）
  - 学长（mentor）
  - 大神（researcher）
- **显示逻辑**：
  - 仅在 AI 通用、AI 题目和 AI 教材模式下显示
  - 非编辑状态下显示
- **选择逻辑**：
  - 点击角色选择按钮显示下拉菜单
  - 选择角色后触发 `update:selected-model` 事件
  - 更新选中状态显示

#### 1.6 联网搜索切换（AI 通用、AI 题目、AI 教材模式）
- **显示逻辑**：
  - 仅在 AI 通用、AI 题目和 AI 教材对话时显示
  - 非编辑状态下显示
- **切换逻辑**：
  - 点击联网搜索按钮切换状态
  - 触发 `toggle-web-search` 事件
  - 更新按钮激活状态显示

#### 1.7 语音录制（仅教师对话）
- **显示逻辑**：
  - 仅在教师对话模式下显示
  - AI 模式下隐藏
- **录制控制**：
  - 按住开始录音（`mousedown`/`touchstart`）
  - 松开结束录音（`mouseup`/`touchend`）
  - 移动取消录音（`touchmove`）
- **状态显示**：
  - 录音时显示红色麦克风图标
  - 未录音时显示灰色麦克风图标
  - 触发 `start-voice-input`/`stop-voice-input`/`voice-move` 事件

#### 1.8 图片上传（教师对话）
- **显示逻辑**：
  - 仅在非 AI 模式下显示（教师对话）
  - AI 通用、AI 题目和 AI 教材模式下隐藏
- **上传控制**：
  - 点击图片按钮触发 `show-image-picker` 事件
  - 显示图片模式激活状态

#### 1.9 内容清空
- **清空流程**：
  1. 调用 MathFormulaEditor 的 `clearContent()` 方法
  2. 更新 v-model 为空字符串
  3. 清理所有 MathLive 实例（向后兼容）
  4. 清空内容块（向后兼容）
  5. 重置其他状态（向后兼容）

#### 1.10 焦点管理
- **焦点控制**：
  - `focus()`: 聚焦输入框（通过 MathFormulaEditor 的 `focus()` 方法）
  - `onFocus`: 处理焦点获得事件
  - `onBlur`: 处理焦点失去事件

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { View, TextInput, TouchableOpacity, StyleSheet, Keyboard } from 'react-native'
import MathFormulaEditor from './MathFormulaEditor'
import type { ChatInputProps, ChatInputEmits } from '../../types'
```

#### 1.2 被依赖
- `ChatScreen.tsx`：使用 `ChatInput` 组件进行消息输入
- `ChatView.tsx`：使用 `ChatInput` 组件进行消息输入（Web 版本参考）

#### 1.3 子组件依赖
- `MathFormulaEditor`：数学公式编辑器组件
  - `getMarkdownContent()`: 获取完整内容
  - `clearContent()`: 清空内容
  - `focus()`: 聚焦输入框
  - `insertMathField()`: 插入公式块

### 2. 关键代码逻辑

#### 2.1 Props 接口定义

```typescript
export interface ChatInputProps {
  value: string // 对应 Web 版本的 modelValue
  placeholderText: string
  isLoading: boolean
  isRecording: boolean
  enableWebSearch: boolean
  selectedModel: string
  type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'
  uploadedFiles: UploadedFile[]
  activeMode: ActiveMode | null
  canSend: boolean
  isEditing?: boolean
  editingMessageId?: string | null
  onChange?: (value: string) => void // 对应 Web 版本的 update:modelValue
  onSend?: () => void // 对应 Web 版本的 send-message
  onFocus?: () => void // 对应 Web 版本的 focus
  onBlur?: () => void // 对应 Web 版本的 blur
  onStartVoiceInput?: (event?: any) => void // 对应 Web 版本的 start-voice-input
  onStopVoiceInput?: (event?: any) => void // 对应 Web 版本的 stop-voice-input
  onVoiceMove?: (event: any) => void // 对应 Web 版本的 voice-move
  onShowImagePicker?: () => void // 对应 Web 版本的 show-image-picker
  onToggleWebSearch?: () => void // 对应 Web 版本的 toggle-web-search
  onScrollToBottom?: () => void // 对应 Web 版本的 scroll-to-bottom
  onSelectedModelChange?: (value: string) => void // 对应 Web 版本的 update:selected-model
  onRemoveFile?: (fileId: string) => void // 对应 Web 版本的 remove-file
  onCancelEdit?: () => void // 对应 Web 版本的 cancel-edit
}
```

#### 2.2 组件状态定义

```typescript
interface ChatInputState {
  editorContent: string // 编辑器内容
  isEditorFocused: boolean // 编辑器是否聚焦
  insertFormulaDebounceTimer: NodeJS.Timeout | null // 插入公式防抖定时器
}
```

#### 2.3 发送消息逻辑

```typescript
const handleSendMessage = () => {
  // 第1步：调用 MathFormulaEditor 的 getMarkdownContent 方法获取完整内容
  const markdownContent = mathEditorRef.current?.getMarkdownContent()
  
  // 第2步：检查内容是否为空
  if (!markdownContent || !markdownContent.trim()) {
    return
  }
  
  // 第3步：更新 value，将完整的 markdown 内容传递给父组件
  props.onChange?.(markdownContent)
  
  // 第4步：使用 setTimeout 确保父组件的 value 更新后再发送消息
  setTimeout(() => {
    props.onSend?.()
    clearInputContent()
  }, 0)
}
```

#### 2.4 清空输入内容逻辑

```typescript
const clearInputContent = () => {
  // 第1步：调用 MathFormulaEditor 的清空方法
  if (mathEditorRef.current) {
    mathEditorRef.current.clearContent()
  }
  
  // 第2步：确保父组件的 value 也被清空
  props.onChange?.('')
  
  // 第3步：重置状态
  setEditorContent('')
}
```

#### 2.5 插入数学公式逻辑

```typescript
const handleInsertMathFormula = () => {
  // 防抖保护：清除之前的定时器
  if (insertFormulaDebounceTimer) {
    clearTimeout(insertFormulaDebounceTimer)
  }
  
  // 设置新的防抖定时器
  insertFormulaDebounceTimer = setTimeout(() => {
    // 检查 MathFormulaEditor 组件是否已经正确初始化
    if (!mathEditorRef.current) {
      return
    }
    
    // 检查 insertMathField 方法是否存在
    if (typeof mathEditorRef.current.insertMathField !== 'function') {
      return
    }
    
    try {
      mathEditorRef.current.insertMathField()
      
      // 插入公式后触发滚动到底部事件
      props.onScrollToBottom?.()
    } catch (error) {
      console.error('插入数学公式失败:', error)
    }
    
    // 清除定时器引用
    insertFormulaDebounceTimer = null
  }, 300) // 300ms防抖延迟
}
```

#### 2.6 语音录制事件处理

```typescript
const handleVoiceStart = (event: any) => {
  // 第1步：阻止默认行为
  event?.preventDefault?.()
  
  // 第2步：触发开始录音事件
  props.onStartVoiceInput?.(event)
}

const handleVoiceEnd = (event: any) => {
  // 第1步：阻止默认行为
  event?.preventDefault?.()
  
  // 第2步：触发停止录音事件
  props.onStopVoiceInput?.(event)
}

const handleVoiceMove = (event: any) => {
  // 第1步：阻止默认行为
  event?.preventDefault?.()
  
  // 第2步：触发语音移动事件
  props.onVoiceMove?.(event)
}
```

#### 2.7 焦点管理逻辑

```typescript
const focus = () => {
  if (mathEditorRef.current) {
    mathEditorRef.current.focus()
  }
}

const handleEditorFocus = () => {
  setIsEditorFocused(true)
  props.onFocus?.()
}

const handleEditorBlur = () => {
  setIsEditorFocused(false)
  props.onBlur?.()
}
```

#### 2.8 键盘事件处理

```typescript
const handleEditorKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSendMessage()
  }
}
```

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 状态管理
- **当前实现**：Vue 3 Composition API（`ref`, `computed`, `watch`）
- **React Native 实现**：React Hooks（`useState`, `useEffect`, `useRef`, `useMemo`）

#### 1.2 组件通信
- **当前实现**：Vue Props & Emits
- **React Native 实现**：React Props & Callbacks

#### 1.3 事件处理
- **当前实现**：Vue 事件修饰符和自定义事件
- **React Native 实现**：React Native 事件处理（`onPress`, `onTouchStart`, `onTouchEnd`）

#### 1.4 生命周期
- **当前实现**：Vue `onMounted`/`onUnmounted`
- **React Native 实现**：React `useEffect`（清理函数）

### 2. 需要的第三方库

```json
{
  "react": "^18.2.0",
  "react-native": "^0.72.0",
  "@react-native-async-storage/async-storage": "^1.19.0"
}
```

### 3. 迁移步骤

1. **创建 React Native 组件**
   - 使用 `forwardRef` 暴露方法给父组件
   - 使用 `useImperativeHandle` 暴露 `clearInputContent` 和 `focus` 方法
   - 实现 Props 接口定义

2. **替换状态管理**
   - `ref()` → `useState()`
   - `computed()` → `useMemo()`
   - `watch()` → `useEffect()`

3. **替换事件处理**
   - Vue 事件 → React Native 事件处理
   - `@click` → `onPress`
   - `@mousedown`/`@touchstart` → `onTouchStart`
   - `@mouseup`/`@touchend` → `onTouchEnd`
   - `@touchmove` → `onTouchMove`

4. **替换生命周期**
   - `onMounted` → `useEffect(..., [])`
   - `onUnmounted` → `useEffect` 清理函数

5. **替换 MathFormulaEditor**
   - 确保 MathFormulaEditor 已迁移到 React Native
   - 使用 `useRef` 引用子组件
   - 调用子组件方法

6. **样式迁移**
   - Vue scoped CSS → React Native StyleSheet
   - CSS 类名 → StyleSheet.create

### 4. 注意事项

#### 4.1 事件处理差异
- React Native 使用 `onTouchStart`/`onTouchEnd` 而不是 `onPress`（用于按住操作）
- 需要处理触摸事件的原生行为

#### 4.2 键盘处理
- React Native 使用 `Keyboard` API 处理键盘显示/隐藏
- Enter 键发送需要特殊处理（可能需要使用自定义键盘）

#### 4.3 防抖定时器
- 使用 `setTimeout`/`clearTimeout` 而不是 `window.setTimeout`
- 需要在组件卸载时清理定时器

#### 4.4 下拉菜单
- React Native 没有原生的下拉菜单组件
- 需要使用第三方库（如 `react-native-picker-select`）或自定义实现

#### 4.5 图片选择器
- 需要使用 `react-native-image-picker` 或类似库
- 需要处理权限请求

## ⚠️ 迁移风险

### 高风险项

1. **MathFormulaEditor 依赖**：
   - **风险**：需要确保 MathFormulaEditor 已正确迁移到 React Native
   - **解决方案**：先迁移 MathFormulaEditor，再迁移 ChatInput
   - **影响**：如果 MathFormulaEditor 未迁移，ChatInput 无法正常工作

2. **键盘事件处理**：
   - **风险**：React Native 的键盘事件处理与 Web 不同
   - **解决方案**：使用 `Keyboard` API 和自定义键盘处理
   - **影响**：Enter 键发送功能可能无法正常工作

3. **下拉菜单实现**：
   - **风险**：React Native 没有原生的下拉菜单组件
   - **解决方案**：使用第三方库或自定义实现
   - **影响**：AI 角色选择功能可能体验不佳

### 中风险项

1. **触摸事件处理**：
   - React Native 的触摸事件处理与 Web 不同
   - 需要正确处理 `onTouchStart`/`onTouchEnd`/`onTouchMove`

2. **样式迁移**：
   - CSS 样式需要转换为 React Native StyleSheet
   - 某些 CSS 特性可能不支持

## 🧪 测试要点

### 功能测试

1. **文本输入测试**：
   - ✅ 输入文本成功
   - ✅ 多行输入正常
   - ✅ 占位符显示正常
   - ✅ 禁用状态正常
   - ✅ 最大高度限制正常

2. **数学公式输入测试**：
   - ✅ 插入公式成功
   - ✅ 公式编辑正常
   - ✅ 防抖处理正常
   - ✅ 公式回车键发送正常

3. **消息发送测试**：
   - ✅ 发送消息成功
   - ✅ 空内容不能发送
   - ✅ 发送后清空输入
   - ✅ 加载状态显示正常

4. **消息编辑测试**：
   - ✅ 编辑状态显示正常
   - ✅ 取消编辑正常
   - ✅ 编辑模式下功能禁用正常

5. **AI 角色选择测试**：
   - ✅ 角色选择菜单显示正常
   - ✅ 选择角色成功
   - ✅ 仅在 AI 模式下显示
   - ✅ 编辑模式下隐藏

6. **联网搜索切换测试**：
   - ✅ 联网搜索按钮显示正常
   - ✅ 切换状态成功
   - ✅ 仅在 AI 模式下显示
   - ✅ 编辑模式下隐藏

7. **语音录制测试**（仅教师对话）：
   - ✅ 语音按钮显示正常
   - ✅ 按住开始录音成功
   - ✅ 松开结束录音成功
   - ✅ 移动取消录音成功
   - ✅ 仅在教师模式下显示

8. **图片上传测试**（教师对话）：
   - ✅ 图片按钮显示正常
   - ✅ 点击触发图片选择器
   - ✅ 仅在教师模式下显示

9. **内容清空测试**：
   - ✅ 清空输入内容成功
   - ✅ 清空后状态重置正常

10. **焦点管理测试**：
    - ✅ 聚焦输入框成功
    - ✅ 焦点事件处理正常

## 📚 参考资源

### 相关文档
- [React Native 文档](https://reactnative.dev/)
- [React Native 触摸事件](https://reactnative.dev/docs/gesture-responder-system)
- [React Native Keyboard API](https://reactnative.dev/docs/keyboard)

### 相关文件
- `src/components/MathFormulaEditor.tsx` - 数学公式编辑器组件（需要先迁移）
- `src/components/ChatScreen.tsx` - 聊天屏幕组件（使用 ChatInput）
- `src/components/ChatMessage.tsx` - 聊天消息组件（参考）
- `src/types/chat.ts` - 聊天相关类型定义

---

**文档版本**：v1.0  
**创建日期**：2025-01-03  
**维护者**：开发团队

