# MainView.vue PRD 文档

## 📋 概述

**文件路径**：`src/views/MainView.vue`  
**文件类型**：`Vue 组件`  
**主要职责**：主应用界面，包含侧边导航菜单、内容区域和悬浮功能按钮

## 🎯 功能需求

### 1. 核心功能
- **侧边导航菜单**：显示用户头像和功能导航项（功能箱、我的资源、我的习题、知识图谱）
- **内容区域**：使用 `router-view` 显示子路由内容
- **悬浮功能按钮**：可拖拽的悬浮按钮，提供草稿本和 AI 聊天功能
- **路由导航**：根据点击的导航项跳转到对应的子路由
- **激活状态**：根据当前路由自动更新导航项的激活状态

### 2. 功能边界
- **负责的功能**：
  - 主应用布局结构
  - 侧边导航菜单展示和交互
  - 悬浮按钮拖拽功能
  - 路由状态同步
- **不负责的功能**：
  - 子路由内容展示（由子路由组件负责）
  - 对话框内容（由 Dialog 组件负责）

## 🔧 技术实现

### 1. 依赖关系
- **导入依赖**：
  ```typescript
  import { ref, watch, computed, onMounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useUIStore } from '@/stores/uiStore'
  import DraftDialog from '@/components/DraftDialog.vue'
  import AIChatDialog from '@/components/AIChatDialog.vue'
  ```
- **被依赖**：
  - `src/router/index.ts`：路由配置中使用

### 2. 关键代码逻辑

#### 导航处理逻辑
```typescript
// 监听路由变化，更新激活状态
watch(() => route.name, (newRouteName) => {
  switch (newRouteName) {
    case 'myProfile':
      activeNavItem.value = 'toolbox'
      break
    case 'myResources':
      activeNavItem.value = 'resources'
      break
    case 'exerciseSolve':
      activeNavItem.value = 'exercises'
      break
    case 'knowledgeGraph':
      activeNavItem.value = 'knowledge'
      break
    default:
      break
  }
  emit('nav-item-change', activeNavItem.value)
}, { immediate: true })

// 导航处理函数
const handleToolBoxClick = () => {
  activeNavItem.value = 'toolbox'
  emit('nav-item-change', 'toolbox')
  router.push({ name: 'myProfile' })
}
```

#### 悬浮按钮拖拽逻辑
```typescript
// 开始拖动
const startDrag = (event: MouseEvent | TouchEvent) => {
  isDragging.value = true
  hasMoved.value = false
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  dragStartPos.value = { x: clientX, y: clientY }
  // 计算按钮左上角位置和鼠标偏移
  // ...
}

// 拖动中
const handleDrag = (event: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  const deltaX = Math.abs(clientX - dragStartPos.value.x)
  const deltaY = Math.abs(clientY - dragStartPos.value.y)
  
  if (deltaX > 5 || deltaY > 5) {
    hasMoved.value = true
    // 计算新位置并限制在视口范围内
    // ...
  }
}
```

### 3. 导航项配置
- **功能箱**：跳转到 `myProfile` 路由
- **我的资源**：跳转到 `myResources` 路由
- **我的习题**：跳转到 `exerciseSolve` 路由
- **知识图谱**：跳转到 `knowledgeGraph` 路由

## 🔄 迁移到 React Native

### 1. 等价实现
- **当前实现**：Vue 3 + Quasar 组件 + Vue Router
- **React Native 实现**：React + React Native 组件 + React Navigation

### 2. 需要的第三方库
- `@react-navigation/native`：导航库（已在基础设施中安装）
- `@react-navigation/bottom-tabs`：标签导航（已在基础设施中安装）
- `react-native-paper`：UI 组件库（可选）
- `react-native-vector-icons`：图标库（可选）

### 3. 迁移步骤
1. **创建 MainScreen 组件**：
   - 使用 `React.FC` 创建函数组件
   - 使用 `useState` 管理导航状态
   - 使用 `useNavigation` 获取导航对象

2. **实现侧边导航菜单**：
   - 使用 `View` 和 `TouchableOpacity` 实现导航项
   - 使用 `Image` 显示图标
   - 使用 `StyleSheet` 实现样式

3. **实现内容区域**：
   - 使用 React Navigation 的 `Stack.Navigator` 或 `Tab.Navigator`
   - 配置子路由

4. **实现悬浮按钮**：
   - 使用 `PanResponder` 处理拖拽手势
   - 使用 `Animated` API 实现动画
   - 限制按钮位置在屏幕范围内

5. **路由状态同步**：
   - 使用 `useRoute` 监听路由变化
   - 根据路由名称更新导航激活状态

### 4. 注意事项
- **导航结构**：React Navigation 使用嵌套导航结构，需要在 `MainScreen` 中配置子导航
- **拖拽手势**：React Native 使用 `PanResponder` 处理拖拽，逻辑与 Web 不同
- **图标资源**：需要使用图标库或图片资源
- **样式适配**：需要使用 `StyleSheet` 创建样式，不支持 CSS

## 📝 迁移代码示例

### Vue 实现
```vue
<template>
  <div class="main-view">
    <div class="function-menu">
      <div class="nav-item" @click="handleToolBoxClick">功能箱</div>
    </div>
    <div class="content-area">
      <router-view />
    </div>
  </div>
</template>
```

### React Native 实现
```typescript
import React, { useState, useEffect } from 'react'
import { View, StyleSheet, TouchableOpacity, Text, Image } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { useUIStore } from '../stores/uiStore'

const Tab = createBottomTabNavigator()
const Stack = createStackNavigator()

const MainScreen: React.FC = () => {
  const [activeNavItem, setActiveNavItem] = useState('knowledge')
  const navigation = useNavigation()
  const route = useRoute()
  const uiStore = useUIStore()

  // 监听路由变化
  useEffect(() => {
    const routeName = route.name
    switch (routeName) {
      case 'MyProfile':
        setActiveNavItem('toolbox')
        break
      case 'MyResources':
        setActiveNavItem('resources')
        break
      case 'ExerciseSolve':
        setActiveNavItem('exercises')
        break
      case 'KnowledgeGraph':
        setActiveNavItem('knowledge')
        break
    }
  }, [route.name])

  const handleToolBoxClick = () => {
    setActiveNavItem('toolbox')
    navigation.navigate('MyProfile' as never)
  }

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <TouchableOpacity 
          style={[styles.navItem, activeNavItem === 'toolbox' && styles.navItemActive]}
          onPress={handleToolBoxClick}
        >
          <Text style={styles.navText}>功能箱</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {/* 子路由内容 */}
      </View>
    </View>
  )
}
```

## ⚠️ 迁移风险

### 高风险项
- **导航结构**：React Navigation 的嵌套导航结构复杂 - **解决方案**：参考 React Navigation 文档，使用 `Tab.Navigator` 或 `Stack.Navigator`
- **拖拽手势**：`PanResponder` 的 API 与 Web 事件不同 - **解决方案**：使用 `react-native-gesture-handler` 库简化拖拽逻辑
- **图标资源**：需要准备图标资源或使用图标库 - **解决方案**：使用 `react-native-vector-icons` 或准备图片资源

## 🧪 测试要点

### 功能测试
- 测试导航菜单点击
- 测试路由跳转
- 测试激活状态更新
- 测试悬浮按钮拖拽
- 测试悬浮按钮功能（草稿本、AI聊天）

## 📚 参考资源

- [React Navigation 文档](https://reactnavigation.org/)
- [React Native PanResponder 文档](https://reactnative.dev/docs/panresponder)
- [react-native-gesture-handler 文档](https://docs.swmansion.com/react-native-gesture-handler/)

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**维护者**：开发团队
