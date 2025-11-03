# SessionDrawer.tsx PRD 文档（React Native）

## 📋 概述

**文件路径**：`src/components/SessionDrawer.tsx`  
**文件类型**：`React Native Component`  
**主要职责**：会话列表抽屉组件，负责展示会话列表、支持会话切换、会话管理（重命名、置顶、删除）、会话搜索和批量管理等功能

## 🎯 功能需求

### 1. 核心功能

#### 1.1 会话列表展示
- **会话排序**：
  - 置顶会话优先显示
  - 按更新时间倒序排列
- **会话信息显示**：
  - 会话名称（支持置顶标识）
  - 更新时间（相对时间显示：刚刚、X分钟前、X小时前、昨天、月/日）
  - 最后一条消息预览（可选）
- **会话状态**：
  - 当前选中会话高亮显示
  - 支持会话激活状态标识

#### 1.2 会话切换
- **切换流程**：
  1. 切换前保存当前会话（调用 `saveChatHistory`）
  2. 切换到新会话（调用 `switchSession`）
  3. 关闭抽屉
  4. 滚动到底部（可选）
- **切换事件**：
  - 点击会话项触发切换
  - 支持切换成功/失败提示

#### 1.3 会话搜索
- **搜索功能**：
  - 支持按会话名称搜索
  - 支持按消息内容搜索（可选）
  - 实时搜索过滤
  - 清空搜索关键词
- **搜索显示**：
  - 搜索结果高亮（可选）
  - 无结果提示

#### 1.4 会话操作（单个）
- **重命名**：
  - 显示重命名对话框
  - 输入新名称并确认
  - 调用 Store 的 `renameSession` 方法
- **置顶/取消置顶**：
  - 切换置顶状态
  - 调用 Store 的 `togglePin` 方法
- **删除**：
  - 显示删除确认对话框
  - 确认后调用 Store 的 `deleteSession` 方法

#### 1.5 批量管理
- **进入批量选择模式**：
  - 显示批量选择工具栏
  - 显示选中数量
  - 禁用单个会话操作菜单
- **批量操作**：
  - 全选/取消全选
  - 批量删除（显示确认对话框）
  - 退出批量选择模式
- **选择状态**：
  - 显示复选框
  - 已选会话高亮显示

#### 1.6 创建新会话
- **创建流程**：
  - 点击创建按钮
  - 关闭抽屉
  - 允许用户输入第一条消息（会话会在发送消息时自动创建）

#### 1.7 空状态处理
- **无会话状态**：
  - 显示空状态提示
  - 显示引导文字
- **无搜索结果**：
  - 显示搜索无结果提示
  - 提供清空搜索建议

### 2. 功能边界

#### 2.1 负责的功能
- ✅ 会话列表的展示和渲染
- ✅ 会话搜索和过滤
- ✅ 会话切换触发
- ✅ 会话操作（重命名、置顶、删除）触发
- ✅ 批量管理功能
- ✅ 抽屉的打开/关闭控制

#### 2.2 不负责的功能
- ❌ 会话数据的存储和管理（由 Store 负责）
- ❌ 会话切换后的消息加载（由 ChatScreen 负责）
- ❌ 会话数据的持久化（由 Store 负责）

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Text,
} from 'react-native'
import { useAiGeneralChatStore } from '../stores/aiGeneralChatStore'
import type { ChatMessageSession } from '../types/chat'
```

#### 1.2 被依赖
- `ChatScreen.tsx`：使用 `SessionDrawer` 组件展示会话列表

#### 1.3 子组件依赖
- 无（可选的子组件：SearchBar、SessionItem、BatchToolbar）

### 2. 关键代码逻辑

#### 2.1 Props 接口定义

```typescript
export interface SessionDrawerProps {
  visible: boolean // 是否显示抽屉
  currentSessionId?: string // 当前选中的会话ID
  onClose: () => void // 关闭抽屉回调
  onSessionSwitch?: (sessionId: string) => Promise<void> // 会话切换回调
  onSessionCreate?: () => void // 创建新会话回调
  onSessionRename?: (sessionId: string, newName: string) => Promise<void> // 会话重命名回调
  onSessionPin?: (sessionId: string) => Promise<void> // 会话置顶回调
  onSessionDelete?: (sessionId: string) => Promise<void> // 会话删除回调
  onBatchDelete?: (sessionIds: string[]) => Promise<void> // 批量删除回调
}
```

#### 2.2 组件状态定义

```typescript
interface SessionDrawerState {
  searchKeyword: string // 搜索关键词
  isSelectionMode: boolean // 是否处于批量选择模式
  selectedSessions: Set<string> // 已选择的会话ID集合
  showRenameDialog: boolean // 是否显示重命名对话框
  renamingSession: ChatMessageSession | null // 正在重命名的会话
  newSessionName: string // 新会话名称
}
```

#### 2.3 会话列表过滤逻辑

```typescript
const filteredSessions = useMemo(() => {
  if (!searchKeyword.trim()) {
    return sortedSessions
  }
  
  const keyword = searchKeyword.toLowerCase().trim()
  
  return sortedSessions.filter((session) => {
    const sessionName = session.sessionName?.toLowerCase() || ''
    // 可选：搜索消息内容
    // const lastMessage = session.lastMessage?.toLowerCase() || ''
    // return sessionName.includes(keyword) || lastMessage.includes(keyword)
    return sessionName.includes(keyword)
  })
}, [sortedSessions, searchKeyword])
```

#### 2.4 批量选择逻辑

```typescript
// 切换会话选择状态
const toggleSessionSelection = useCallback((sessionId: string) => {
  setSelectedSessions((prev) => {
    const newSet = new Set(prev)
    if (newSet.has(sessionId)) {
      newSet.delete(sessionId)
    } else {
      newSet.add(sessionId)
    }
    return newSet
  })
}, [])

// 全选/取消全选
const toggleSelectAll = useCallback(() => {
  if (selectedSessions.size === filteredSessions.length) {
    setSelectedSessions(new Set())
  } else {
    setSelectedSessions(new Set(filteredSessions.map(s => s.sessionId)))
  }
}, [filteredSessions, selectedSessions.size])

// 进入批量选择模式
const enterSelectionMode = useCallback(() => {
  setIsSelectionMode(true)
  setSelectedSessions(new Set())
}, [])

// 退出批量选择模式
const exitSelectionMode = useCallback(() => {
  setIsSelectionMode(false)
  setSelectedSessions(new Set())
}, [])

// 批量删除
const handleBatchDelete = useCallback(() => {
  if (selectedSessions.size === 0) return
  
  const sessionIds = Array.from(selectedSessions)
  Alert.alert(
    '确认删除',
    `确定要删除 ${sessionIds.length} 个会话吗？`,
    [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await props.onBatchDelete?.(sessionIds)
          exitSelectionMode()
        },
      },
    ]
  )
}, [selectedSessions, props, exitSelectionMode])
```

#### 2.5 会话操作逻辑

```typescript
// 重命名会话
const handleRename = useCallback((session: ChatMessageSession) => {
  setRenamingSession(session)
  setNewSessionName(session.sessionName)
  setShowRenameDialog(true)
}, [])

const confirmRename = useCallback(async () => {
  if (!renamingSession || !newSessionName.trim()) return
  
  try {
    await props.onSessionRename?.(renamingSession.sessionId, newSessionName.trim())
    setShowRenameDialog(false)
    setRenamingSession(null)
    setNewSessionName('')
  } catch (error) {
    console.error('重命名失败:', error)
    Alert.alert('错误', '重命名失败，请重试')
  }
}, [renamingSession, newSessionName, props])

// 置顶/取消置顶
const handlePin = useCallback(async (session: ChatMessageSession) => {
  try {
    await props.onSessionPin?.(session.sessionId)
  } catch (error) {
    console.error('置顶失败:', error)
    Alert.alert('错误', '操作失败，请重试')
  }
}, [props])

// 删除会话
const handleDelete = useCallback((session: ChatMessageSession) => {
  Alert.alert(
    '确认删除',
    `确定要删除会话"${session.sessionName}"吗？`,
    [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await props.onSessionDelete?.(session.sessionId)
        },
      },
    ]
  )
}, [props])
```

#### 2.6 时间格式化逻辑

```typescript
const formatTime = (timestamp: number): string => {
  if (!timestamp) return ''
  
  const now = Date.now()
  const diff = now - timestamp
  
  // 小于1分钟：刚刚
  if (diff < 60 * 1000) {
    return '刚刚'
  }
  
  // 小于1小时：X分钟前
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return `${minutes}分钟前`
  }
  
  // 小于24小时：X小时前
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours}小时前`
  }
  
  // 小于48小时：昨天
  if (diff < 48 * 60 * 60 * 1000) {
    const date = new Date(timestamp)
    return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  
  // 其他：显示月/日 时:分
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  return `${month}/${day} ${hours}:${minutes}`
}
```

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 组件结构
- **当前实现**：Vue 3 Composition API + Quasar UI（SessionList.vue）
- **React Native 实现**：React Native 组件 + Modal

#### 1.2 核心差异

| Vue 功能 | React Native 实现 |
|---------|------------------|
| `<div>` | `<View>` |
| `v-if` | `{condition && <Component />}` |
| `v-for` | `{items.map(item => <Component key={item.id} />)}` |
| `@click` | `<TouchableOpacity onPress>` |
| `q-input` | `<TextInput>` |
| `q-menu` | `Modal` 或 `ActionSheetIOS` |
| `computed` | `useMemo` |
| `ref` | `useRef`, `useState` |
| `watch` | `useEffect` |

### 2. 需要的第三方库

```json
{
  "react-native": "^0.72.0",
  "@react-native-async-storage/async-storage": "^1.19.0"
}
```

### 3. 迁移步骤

1. **创建基础组件结构**
   - 定义 Props 接口
   - 创建 Modal 容器
   - 实现抽屉动画

2. **实现会话列表**
   - 使用 FlatList 渲染会话列表
   - 实现会话项组件
   - 实现会话点击和切换

3. **实现搜索功能**
   - 添加搜索输入框
   - 实现实时搜索过滤
   - 显示搜索结果

4. **实现会话操作**
   - 实现操作菜单（长按或点击更多按钮）
   - 实现重命名对话框
   - 实现置顶和删除功能

5. **实现批量管理**
   - 添加批量选择工具栏
   - 实现全选功能
   - 实现批量删除功能

### 4. 注意事项

#### 4.1 抽屉动画
- React Native 使用 `Modal` 组件
- 可以使用 `react-native-reanimated` 实现抽屉动画
- 或使用简单的透明度/位移动画

#### 4.2 触摸事件处理
- React Native 使用 `TouchableOpacity` 或 `Pressable`
- 长按需要使用 `onLongPress` 或自定义手势

#### 4.3 对话框实现
- React Native 使用 `Alert.alert` 或 `Modal`
- 重命名对话框使用 `TextInput` 和 `Modal` 实现

#### 4.4 性能优化
- 使用 `FlatList` 而不是 `ScrollView`
- 使用 `removeClippedSubviews` 优化渲染
- 搜索过滤使用 `useMemo` 避免重复计算

## ⚠️ 迁移风险

### 高风险项

1. **抽屉动画**：
   - **风险**：React Native 的抽屉动画需要手动实现
   - **解决方案**：使用 `react-native-reanimated` 或简单动画
   - **影响**：动画效果可能不如原生组件流畅

2. **操作菜单**：
   - **风险**：React Native 没有原生的弹出菜单组件
   - **解决方案**：使用 `Modal` 或第三方库（如 `react-native-popup-menu`）
   - **影响**：用户体验可能略有差异

### 中风险项

1. **搜索输入框**：
   - React Native 的 `TextInput` 与 Web 的 `input` 行为略有不同
   - 需要处理键盘显示/隐藏

2. **批量选择状态**：
   - 需要使用 `Set` 或数组管理选中状态
   - 注意状态更新的性能

## 🧪 测试要点

### 功能测试

1. **会话列表展示测试**：
   - ✅ 会话列表正确排序（置顶优先，按时间倒序）
   - ✅ 会话信息正确显示（名称、时间）
   - ✅ 当前选中会话高亮显示

2. **会话切换测试**：
   - ✅ 点击会话项切换成功
   - ✅ 切换前保存当前会话
   - ✅ 切换后关闭抽屉

3. **会话搜索测试**：
   - ✅ 搜索关键词正确过滤
   - ✅ 实时搜索响应正常
   - ✅ 清空搜索关键词正常
   - ✅ 无结果提示正确显示

4. **会话操作测试**：
   - ✅ 重命名功能正常
   - ✅ 置顶/取消置顶功能正常
   - ✅ 删除功能正常（包括确认对话框）

5. **批量管理测试**：
   - ✅ 进入批量选择模式正常
   - ✅ 全选/取消全选功能正常
   - ✅ 批量删除功能正常（包括确认对话框）
   - ✅ 退出批量选择模式正常

6. **空状态测试**：
   - ✅ 无会话时显示空状态提示
   - ✅ 无搜索结果时显示搜索无结果提示

## 📚 参考资源

### 相关文档
- [React Native Modal 文档](https://reactnative.dev/docs/modal)
- [React Native FlatList 文档](https://reactnative.dev/docs/flatlist)
- [React Native TextInput 文档](https://reactnative.dev/docs/textinput)

### 相关文件
- `src/screens/ChatScreen.tsx` - 父组件，使用 SessionDrawer
- `src/stores/aiGeneralChatStore.ts` - Store 实现（会话管理）
- `src/types/chat.ts` - 聊天相关类型定义
- `imates-web/src/components/SessionList.vue` - Web 版本参考实现

---

**文档版本**：v1.0  
**创建日期**：2025-01-03  
**维护者**：开发团队

