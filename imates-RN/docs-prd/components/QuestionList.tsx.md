# QuestionList.tsx PRD 文档

## 📋 概述

**文件路径**：`src/components/QuestionList.tsx`  
**文件类型**：`React Native 组件`  
**主要职责**：习题列表展示组件，提供题目搜索、选择、操作等功能，支持渐进式渲染和懒加载优化

## 🎯 功能需求

### 1. 核心功能
- **题目列表展示**：展示用户习题列表，支持滚动浏览
- **题目搜索**：支持按题目标题和内容进行实时搜索
- **题目选择**：点击题目卡片选择题目，触发相关操作
- **题目操作**：提供发送给AI、拍作业、微课、置顶、删除等操作
- **渐进式渲染**：使用占位符实现虚拟滚动，提升长列表性能
- **懒加载优化**：使用 Intersection Observer 实现内容的懒加载
- **高度缓存**：智能缓存题目高度，优化占位符渲染

### 2. 功能边界
- **负责的功能**：
  - 题目列表的展示和交互
  - 题目的搜索和过滤
  - 题目的选择和操作
  - 题目的渐进式渲染和性能优化
- **不负责的功能**：
  - 题目数据的获取（由 questionStore 负责）
  - AI 聊天的具体实现（由 ChatView 负责）
  - 微课的具体展示（由 MiniClass 组件负责）

### 3. 输入输出
- **Props**：
  ```typescript
  interface QuestionListProps {
    onStartAiGuidance?: (question: ExerciseItem) => void
    onQuestionSelected?: (question: ExerciseItem, index: number) => void
    onSendQuestionToTeacher?: (question: ExerciseItem) => void
    onOpenMiniClass?: (question: ExerciseItem) => void
  }
  ```
- **输出**：通过回调函数通知父组件相关事件

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  // React Native 核心
  import React, { useState, useEffect, useRef, useCallback } from 'react'
  import { View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet } from 'react-native'
  
  // 状态管理
  import { useQuestionStore } from '../stores/questionStore'
  import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
  
  // 服务层
  import { apiService } from '../services/apiService'
  
  // 工具函数
  import { useMessageRenderer } from '../hooks/useMessageRenderer'
  
  // 类型定义
  import type { ExerciseItem } from '../types/exercise'
  ```
- **被依赖**：
  - `src/screens/ExerciseSolveScreen.tsx`：使用 QuestionList 组件

### 2. 关键代码逻辑

#### 2.1 渐进式渲染
- 使用占位符（Placeholder）实现虚拟滚动
- 前 N 个题目立即渲染，其余使用占位符
- 当占位符进入视口时，替换为实际题目

#### 2.2 懒加载优化
- 使用 React Native 的 `onViewableItemsChanged` 实现视口检测
- 只有进入视口的题目才渲染完整内容
- 使用 Intersection Observer 模式（通过 FlatList 的 viewabilityConfig）

#### 2.3 高度缓存
- 测量题目实际渲染高度并缓存
- 使用缓存高度优化占位符渲染
- 支持智能估算高度（基于题目内容统计）

#### 2.4 搜索功能
- 实时搜索，支持防抖
- 搜索结果高亮显示
- 搜索时重置渲染状态

### 3. 数据流
- **数据流向**：
  1. 组件挂载 → 从 questionStore 加载题目列表
  2. 用户搜索 → 过滤本地题目列表 → 更新显示
  3. 用户选择题目 → 更新选中状态 → 通知父组件
  4. 用户操作题目 → 调用 API → 更新本地状态
- **状态管理**：
  - 使用 Zustand 的 questionStore 管理题目数据
  - 使用本地 state 管理搜索、选中、渲染状态

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 组件结构
- **Vue 实现**：`<template>` + `<script>` + `<style>`
- **React Native 实现**：`React.FC` + JSX + `StyleSheet`

#### 1.2 列表渲染
- **Vue 实现**：`v-for` 遍历渲染
- **React Native 实现**：`FlatList` 组件，使用 `renderItem` 渲染

#### 1.3 滚动容器
- **Vue 实现**：`<div>` + CSS `overflow-y: auto`
- **React Native 实现**：`FlatList` 自带滚动功能

#### 1.4 视口检测
- **Vue 实现**：`IntersectionObserver` API
- **React Native 实现**：`FlatList` 的 `onViewableItemsChanged` + `viewabilityConfig`

#### 1.5 搜索输入
- **Vue 实现**：`<q-input>` 组件
- **React Native 实现**：`<TextInput>` 组件

#### 1.6 按钮操作
- **Vue 实现**：`<q-btn>` 组件
- **React Native 实现**：`<TouchableOpacity>` + `<Text>` 或图标库

#### 1.7 消息渲染
- **Vue 实现**：`v-html` + MarkdownIt + MathJax
- **React Native 实现**：`react-native-render-html` + `react-native-mathjax` 或自定义渲染器

### 2. 需要的第三方库
- `react-native-render-html`：用于渲染 HTML/Markdown 内容
- `react-native-mathjax` 或 `react-native-math-view`：用于渲染数学公式
- `react-native-vector-icons` 或 `@expo/vector-icons`：用于图标显示
- `@react-native-async-storage/async-storage`：用于本地存储（已集成）

### 3. 迁移步骤
1. **创建基础组件结构**：
   - 创建 `src/components/QuestionList.tsx`
   - 定义 Props 接口和组件基础结构
   
2. **迁移状态管理**：
   - 使用 `useQuestionStore` 获取题目数据
   - 实现本地搜索和过滤逻辑
   
3. **实现列表渲染**：
   - 使用 `FlatList` 替换 Vue 的 `v-for`
   - 实现渐进式渲染逻辑（占位符 + 实际题目）
   
4. **实现视口检测**：
   - 使用 `FlatList` 的 `onViewableItemsChanged` 实现懒加载
   - 配置 `viewabilityConfig` 参数
   
5. **迁移搜索功能**：
   - 使用 `TextInput` 实现搜索框
   - 实现防抖搜索逻辑
   
6. **迁移题目操作**：
   - 实现发送给AI、拍作业、微课、置顶、删除等操作
   - 使用节流函数优化性能
   
7. **实现内容渲染**：
   - 集成 Markdown 渲染器
   - 集成数学公式渲染器
   
8. **优化性能**：
   - 实现高度缓存
   - 优化列表渲染性能

### 4. 注意事项
- **性能优化**：
  - React Native 的 FlatList 性能较好，但需要注意 `keyExtractor` 的正确性
  - 使用 `getItemLayout` 可以进一步提升性能（需要知道每个 item 的高度）
  - 避免在 renderItem 中创建新函数，使用 `useCallback` 优化
  
- **样式适配**：
  - React Native 不支持 CSS，需要使用 `StyleSheet.create` 创建样式
  - 不支持 `:hover`、`:active` 等伪类，需要使用 Pressable 或 TouchableOpacity 的状态
  
- **数学公式渲染**：
  - React Native 不支持直接使用 MathJax，需要使用专门的库
  - 考虑使用 WebView 渲染公式（性能较差）或使用原生库（如 react-native-math-view）
  
- **图片处理**：
  - React Native 的图片需要明确指定尺寸
  - 使用 `Image` 组件加载图片，需要处理加载状态和错误状态

## 📝 迁移代码示例

### Vue 实现（关键部分）
```vue
<template>
  <div class="question-list">
    <!-- 搜索栏 -->
    <div class="search-container">
      <q-input v-model="searchQuery" placeholder="搜索题目..." />
    </div>
    
    <!-- 题目列表 -->
    <div class="question-cards-container">
      <div v-for="item in allRenderItems" :key="item.id">
        <div v-if="item.isPlaceholder" class="question-card-placeholder">
          <!-- 占位符 -->
        </div>
        <div v-else class="question-card" @click="selectQuestion(item.actualIndex)">
          <!-- 题目内容 -->
        </div>
      </div>
    </div>
  </div>
</template>
```

### React Native 实现（关键部分）
```typescript
const QuestionList: React.FC<QuestionListProps> = (props) => {
  const { questions, loading } = useQuestionStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  // 过滤后的题目列表
  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return questions
    const query = searchQuery.toLowerCase()
    return questions.filter(q => 
      q.title?.toLowerCase().includes(query) ||
      q.question?.toLowerCase().includes(query)
    )
  }, [questions, searchQuery])
  
  // 渲染题目项
  const renderItem = useCallback(({ item, index }: { item: ExerciseItem; index: number }) => {
    const isSelected = selectedIndex === index
    return (
      <TouchableOpacity
        style={[styles.questionCard, isSelected && styles.questionCardSelected]}
        onPress={() => handleSelectQuestion(item, index)}
      >
        <Text style={styles.questionNumber}>{index + 1}</Text>
        <Text style={styles.questionContent}>{item.title || item.question}</Text>
      </TouchableOpacity>
    )
  }, [selectedIndex])
  
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="搜索题目..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <FlatList
        data={filteredQuestions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />
    </View>
  )
}
```

## ⚠️ 迁移风险

### 高风险项
- **数学公式渲染**：React Native 不支持 MathJax，需要使用专门的库或 WebView，可能影响性能和兼容性
  - **解决方案**：优先使用原生库（如 react-native-math-view），如果不可用则使用 WebView
  
- **渐进式渲染实现**：FlatList 的视口检测机制与 Vue 的 IntersectionObserver 不完全相同
  - **解决方案**：使用 FlatList 的 `onViewableItemsChanged` 和 `viewabilityConfig`，仔细调整阈值参数
  
- **高度缓存**：React Native 中测量元素高度的方式与 Web 不同
  - **解决方案**：使用 `onLayout` 回调获取组件高度，实现高度缓存逻辑

### 低风险项
- **搜索防抖**：React Native 中可以使用 `useDebounce` hook 实现，与 Vue 类似
- **样式适配**：需要手动转换 CSS 到 StyleSheet，但逻辑基本相同
- **状态管理**：Zustand 在 React Native 中使用方式与 Vue 中的 Pinia 类似

## 🧪 测试要点

### 功能测试
- **题目列表加载**：验证题目列表能够正确加载和显示
- **搜索功能**：验证搜索能够正确过滤题目
- **题目选择**：验证点击题目能够正确选择并触发回调
- **题目操作**：验证发送给AI、拍作业、微课、置顶、删除等操作能够正常工作
- **滚动性能**：验证长列表滚动流畅，无明显卡顿

### 边界测试
- **空列表状态**：验证空列表时显示正确的提示信息
- **搜索无结果**：验证搜索无结果时显示正确的提示信息
- **网络错误**：验证网络错误时的错误处理和提示
- **大量题目**：验证大量题目时的性能和内存使用

## 📚 参考资源

- [React Native FlatList 文档](https://reactnative.dev/docs/flatlist)
- [React Native TextInput 文档](https://reactnative.dev/docs/textinput)
- [react-native-render-html 文档](https://github.com/meliorence/react-native-render-html)
- [React Native 性能优化指南](https://reactnative.dev/docs/performance)
- [Vue 原组件实现](../imates-web/src/components/QuestionList.vue)
- [Vue PRD 文档](../imates-web/docs-prd/src/components/QuestionList.vue.md)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**最后更新**：2025-01-XX  
**维护者**：开发团队
