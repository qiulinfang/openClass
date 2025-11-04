# ChatRecordCard.vue PRD 文档

## 📋 概述

**文件路径**：`src/components/chat/ChatRecordCard.vue`  
**文件类型**：`Vue 组件`  
**主要职责**：聊天记录卡片组件，用于在聊天消息中显示历史聊天记录的折叠/展开卡片

## 🎯 功能需求

### 1. 核心功能
- **聊天记录卡片显示**：显示一个可折叠的聊天记录卡片，包含消息数量统计
- **展开/折叠功能**：点击卡片可以展开/折叠，显示消息预览列表
- **消息预览**：展开后显示聊天记录中的消息预览，支持文本、语音、图片等不同类型消息的预览
- **附加消息显示**：支持显示额外的附加消息（如提示信息）

### 2. 功能边界
- **负责的功能**：
  - 聊天记录卡片的 UI 展示
  - 展开/折叠状态的切换
  - 消息预览文本的生成（支持不同类型消息）
  - 消息数量统计显示
- **不负责的功能**：
  - 实际消息的详细渲染（由 ChatMessage 组件负责）
  - 消息的编辑、删除等操作（由父组件负责）
  - 聊天记录的存储和管理（由 store 负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { ref, computed } from 'vue'
  import type { ChatBubble } from '../../types'
  import type { ChatRecordCardProps } from '../../types'
  ```
- **被依赖**：
  - `src/components/chat/ChatMessage.vue`：在消息中显示聊天记录卡片

### 2. 关键代码逻辑

#### Props 定义
```typescript
export interface ChatRecordCardProps {
  messages: ChatBubble[]        // 聊天记录消息列表
  additionalMessage?: string    // 附加消息（可选）
}
```

#### 核心功能实现
```typescript
// 1. 展开/折叠状态管理
const isExpanded = ref(false)
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

// 2. 消息数量统计
const messageCount = computed(() => props.messages.length)

// 3. 消息预览文本生成
const getMessagePreview = (message: ChatBubble): string => {
  if (message.messageType === 'voice') {
    return '[语音消息]'
  } else if (message.messageType === 'image') {
    return '[图片消息]'
  } else {
    // 文本消息，截取前50个字符
    const content = message.content || ''
    return content.length > 50 ? content.substring(0, 50) + '...' : content
  }
}
```

### 3. 数据流
- **数据流向**：
  - 父组件（ChatMessage）传入 `messages` 和 `additionalMessage` Props
  - 组件内部管理 `isExpanded` 状态
  - 用户点击卡片触发 `toggleExpanded` 切换展开状态
- **状态管理**：使用 Vue 3 Composition API 的 `ref` 管理组件内部状态

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：
  - 使用 Quasar UI 组件（`q-icon`、`q-avatar`）
  - 使用 Vue 3 Composition API
  - 使用 Scoped CSS 样式
  - 支持深色模式（CSS Media Query）
- **React Native 实现**：
  - 使用 React Native 原生组件（`View`、`Text`、`TouchableOpacity`）
  - 使用 React Hooks（`useState`、`useMemo`）
  - 使用 StyleSheet API
  - 使用 `react-native-vector-icons` 或内置图标组件

### 2. 需要的第三方库
- `react-native-vector-icons` 或 `@expo/vector-icons`：用于显示图标（聊天图标、展开/折叠图标、用户图标等）

### 3. 迁移步骤
1. **创建组件文件**：在 `imates-RN/src/components/chat/` 目录下创建 `ChatRecordCard.tsx`
2. **定义 Props 接口**：使用 TypeScript 定义 `ChatRecordCardProps` 接口
3. **实现状态管理**：使用 `useState` 管理展开/折叠状态
4. **实现 UI 渲染**：
   - 使用 `TouchableOpacity` 实现可点击卡片
   - 使用 `View` 和 `Text` 实现布局和文本
   - 使用图标库显示图标
5. **实现样式**：使用 `StyleSheet.create` 创建样式对象
6. **集成到 ChatMessage**：在 `ChatMessage.tsx` 中导入并使用该组件

### 4. 注意事项
- **图标替换**：Quasar 的图标需要替换为 React Native 兼容的图标库
- **样式差异**：CSS 的某些特性（如 `hover`、深色模式 Media Query）需要特殊处理
- **触摸反馈**：使用 `TouchableOpacity` 的 `activeOpacity` 属性提供触摸反馈
- **滚动容器**：展开后的消息预览列表可能需要使用 `ScrollView` 或 `FlatList`

## 📝 迁移代码示例

### Vue 实现
```vue
<template>
  <div class="chat-record-card" @click="toggleExpanded">
    <div class="card-header">
      <div class="header-left">
        <q-icon name="chat" color="primary" size="20px" />
        <span class="header-title">聊天记录</span>
        <span class="message-count">{{ messageCount }}条消息</span>
      </div>
      <div class="header-right">
        <q-icon 
          :name="isExpanded ? 'expand_less' : 'expand_more'" 
          color="grey-6" 
          size="20px"
        />
      </div>
    </div>

    <div v-if="isExpanded" class="card-content">
      <div class="messages-preview">
        <div 
          v-for="(message, index) in messages" 
          :key="message.id"
          class="preview-message preview-user"
        >
          <div class="preview-avatar">
            <q-avatar color="primary" text-color="white" size="24px">
              <q-icon name="person" />
            </q-avatar>
          </div>
          <div class="preview-content">
            <div class="preview-sender">我</div>
            <div class="preview-text">
              {{ getMessagePreview(message) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="additionalMessage" class="additional-message">
      <q-icon name="note" color="grey-6" size="20px" />
      <span class="additional-text">{{ additionalMessage }}</span>
    </div>
  </div>
</template>
```

### React Native 实现
```typescript
import React, { useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import type { ChatRecordCardProps } from '../../types/chat'
import type { ChatBubble } from '../../types/chat'

const ChatRecordCard: React.FC<ChatRecordCardProps> = ({
  messages,
  additionalMessage,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const messageCount = useMemo(() => messages.length, [messages.length])
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }
  
  const getMessagePreview = (message: ChatBubble): string => {
    if (message.messageType === 'voice') {
      return '[语音消息]'
    } else if (message.messageType === 'image') {
      return '[图片消息]'
    } else {
      const content = message.content || ''
      return content.length > 50 ? content.substring(0, 50) + '...' : content
    }
  }
  
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={toggleExpanded}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.iconText}>💬</Text>
          <Text style={styles.headerTitle}>聊天记录</Text>
          <View style={styles.messageCountBadge}>
            <Text style={styles.messageCountText}>{messageCount}条消息</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.expandIcon}>
            {isExpanded ? '▲' : '▼'}
          </Text>
        </View>
      </View>

      {isExpanded && (
        <View style={styles.cardContent}>
          <ScrollView style={styles.messagesPreview}>
            {messages.map((message) => (
              <View key={message.id} style={styles.previewMessage}>
                <View style={styles.previewAvatar}>
                  <Text style={styles.avatarText}>👤</Text>
                </View>
                <View style={styles.previewContent}>
                  <Text style={styles.previewSender}>我</Text>
                  <Text style={styles.previewText}>
                    {getMessagePreview(message)}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {additionalMessage && (
        <View style={styles.additionalMessage}>
          <Text style={styles.additionalIcon}>📝</Text>
          <Text style={styles.additionalText}>{additionalMessage}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
```

## ⚠️ 迁移风险

### 高风险项
- **图标显示**：Vue 使用 Quasar 图标库，React Native 需要替换为兼容的图标库或使用 Unicode 图标
- **样式兼容**：CSS 的某些特性（如 `hover`、媒体查询）在 React Native 中不支持，需要重新设计交互方式

### 低风险项
- **展开/折叠动画**：Vue 版本使用 CSS 过渡效果，React Native 可以使用 `Animated` API 或第三方动画库
- **滚动性能**：大量消息预览时，需要使用 `FlatList` 替代 `ScrollView` 以优化性能

## 🧪 测试要点

### 功能测试
- **卡片显示**：验证卡片能够正常显示，包含标题和消息数量
- **展开/折叠**：验证点击卡片可以正确展开/折叠消息列表
- **消息预览**：验证不同类型的消息（文本、语音、图片）能够正确显示预览文本
- **附加消息**：验证附加消息能够正确显示（如果提供）
- **空消息列表**：验证当 `messages` 为空数组时的处理

### 边界测试
- **大量消息**：验证当消息数量较多时，滚动容器是否正常工作
- **长文本消息**：验证长文本消息预览是否正确截断并添加省略号
- **特殊字符**：验证包含特殊字符的消息预览是否正确显示

## 📚 参考资源

- `[相关文档链接]`

---

**文档版本**：v1.0  
**创建日期**：2025-11-03  
**维护者**：开发团队
