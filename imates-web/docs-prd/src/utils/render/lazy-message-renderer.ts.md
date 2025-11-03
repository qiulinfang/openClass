# lazy-message-renderer.ts PRD 文档

## 📋 概述

**文件路径**：`src/utils/render/lazy-message-renderer.ts`  
**文件类型**：`TypeScript 工具类 + Vue Composable`  
**主要职责**：懒加载消息渲染器，按需处理 Markdown 解析和 MathJax 渲染，使用 Intersection Observer 实现视口内元素的高性能渲染

## 🎯 功能需求

### 1. 核心功能

#### 1.1 懒加载机制
- **Intersection Observer**：
  - 使用 Intersection Observer 监听元素进入视口
  - 元素进入视口时自动触发渲染
  - 可配置 `rootMargin` 和 `threshold`
  - 默认提前 50px 开始渲染
- **观察管理**：
  - 观察元素进入视口
  - 停止观察已渲染的元素
  - 避免重复渲染

#### 1.2 渲染队列管理
- **队列处理**：
  - 管理待渲染的元素队列
  - 批量处理元素，每批处理 5 个
  - 延迟 16ms（约 60fps）处理下一批
  - 避免阻塞主线程
- **渲染状态**：
  - 使用 `WeakSet` 记录已渲染的元素
  - 避免重复渲染同一元素
  - 标记元素为已渲染（`data-lazy-rendered`）

#### 1.3 数学公式渲染
- **MathJax 集成**：
  - 检测元素是否包含数学公式
  - 使用 `MathJaxUtils.renderMath()` 渲染公式
  - 不在懒加载流程中使用懒加载（因为已在懒加载流程中）
- **公式检测**：
  - 检测 `.math`、`[data-math]`、`.katex`、`.MathJax` 等选择器
  - 仅在包含公式时调用 MathJax 渲染

#### 1.4 单例模式
- **全局单例**：
  - 使用单例模式确保全局只有一个实例
  - 共享 Intersection Observer 和渲染队列
  - 提高性能和资源利用

#### 1.5 Vue Composable 集成
- **useLazyMessageRender Hook**：
  - 提供 Vue 组合式 API 接口
  - 自动管理元素的观察和停止观察
  - 组件挂载时开始观察，卸载时停止观察

### 2. 功能边界

#### 2.1 负责的功能
- ✅ 懒加载机制的实现
- ✅ 渲染队列的管理
- ✅ 数学公式的检测和渲染
- ✅ Vue 组件的集成

#### 2.2 不负责的功能
- ❌ Markdown 内容的解析（由 `useMessageRenderer` 负责）
- ❌ MathJax 库的加载（由外部负责）
- ❌ 元素的样式和布局（由 CSS 负责）
- ❌ 消息数据的获取（由 Store 负责）

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
import { ref, onMounted, onUnmounted } from 'vue'
import { MathJaxUtils } from '../math/mathjax'
```

#### 1.2 被依赖
- `ChatMessage.vue`：使用 `useLazyMessageRender` Hook 实现懒加载渲染
- 其他需要懒加载渲染的组件

### 2. 关键代码逻辑

#### 2.1 单例模式

```typescript
export class LazyMessageRenderer {
  private static instance: LazyMessageRenderer
  private intersectionObserver: IntersectionObserver | null = null
  private renderedElements = new WeakSet<HTMLElement>()
  private renderQueue: HTMLElement[] = []
  private isProcessing = false

  private constructor() {}

  static getInstance(): LazyMessageRenderer {
    if (!LazyMessageRenderer.instance) {
      LazyMessageRenderer.instance = new LazyMessageRenderer()
    }
    return LazyMessageRenderer.instance
  }
}
```

#### 2.2 Intersection Observer 初始化

```typescript
init(options: LazyRenderOptions = {}) {
  if (this.intersectionObserver) return

  const {
    rootMargin = '50px',
    threshold = 0.1
  } = options

  this.intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement
          this.addToRenderQueue(element)
          this.intersectionObserver?.unobserve(element) // 停止观察
        }
      })
    },
    {
      rootMargin,
      threshold
    }
  )
}
```

#### 2.3 渲染队列管理

```typescript
// 添加元素到渲染队列
private addToRenderQueue(element: HTMLElement) {
  if (this.renderedElements.has(element)) return // 避免重复渲染

  this.renderQueue.push(element)
  this.processRenderQueue()
}

// 处理渲染队列
private async processRenderQueue() {
  if (this.isProcessing || this.renderQueue.length === 0) return

  this.isProcessing = true

  try {
    // 批量处理元素（每批处理5个）
    const batch = this.renderQueue.splice(0, 5)
    
    for (const element of batch) {
      await this.renderElement(element)
      this.renderedElements.add(element) // 标记为已渲染
    }

    // 如果还有元素，延迟处理下一批（16ms，约60fps）
    if (this.renderQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 16))
      this.processRenderQueue()
    }
  } finally {
    this.isProcessing = false
  }
}
```

#### 2.4 元素渲染逻辑

```typescript
// 渲染单个元素
private async renderElement(element: HTMLElement) {
  try {
    // 检查元素是否包含数学公式
    const hasMath = element.querySelector('.math, [data-math], .katex, .MathJax')
    
    if (hasMath) {
      // 使用 MathJax 渲染数学公式
      // 不使用懒加载，因为已经在懒加载流程中
      await MathJaxUtils.renderMath(element, false)
    }

    // 标记为已渲染
    element.setAttribute('data-lazy-rendered', 'true')
  } catch (error) {
    console.warn('懒加载渲染失败:', error)
  }
}
```

#### 2.5 观察管理

```typescript
// 观察元素进行懒加载渲染
observe(element: HTMLElement) {
  if (!this.intersectionObserver) {
    this.init() // 自动初始化
  }
  
  if (element && !this.renderedElements.has(element)) {
    this.intersectionObserver?.observe(element)
  }
}

// 停止观察元素
unobserve(element: HTMLElement) {
  this.intersectionObserver?.unobserve(element)
}
```

#### 2.6 Vue Composable

```typescript
// Vue 组合式 API 钩子
export function useLazyMessageRender(_options?: LazyRenderOptions) {
  const elementRef = ref<HTMLElement | null>(null)
  const isRendered = ref(false)

  onMounted(() => {
    if (elementRef.value) {
      lazyMessageRenderer.observe(elementRef.value)
    }
  })

  onUnmounted(() => {
    if (elementRef.value) {
      lazyMessageRenderer.unobserve(elementRef.value)
    }
  })

  return {
    elementRef,
    isRendered
  }
}
```

### 3. 使用示例

#### 3.1 基础使用（类方法）

```typescript
import { LazyMessageRenderer } from '@/utils/render/lazy-message-renderer'

const renderer = LazyMessageRenderer.getInstance()

// 初始化
renderer.init({
  rootMargin: '100px',
  threshold: 0.1
})

// 观察元素
const element = document.getElementById('message-content')
if (element) {
  renderer.observe(element)
}

// 停止观察
renderer.unobserve(element)

// 清理资源
renderer.cleanup()
```

#### 3.2 Vue 组件中使用（Composable）

```typescript
// ChatMessage.vue
import { useLazyMessageRender } from '@/utils/render/lazy-message-renderer'

const { elementRef, isRendered } = useLazyMessageRender({
  rootMargin: '100px',
  threshold: 0.1
})

// 在模板中使用
<template>
  <div :ref="elementRef" class="message-content">
    <!-- 消息内容 -->
  </div>
</template>
```

#### 3.3 配置选项

```typescript
interface LazyRenderOptions {
  rootMargin?: string    // 默认 '50px'
  threshold?: number     // 默认 0.1
  batchSize?: number     // 默认 5
  batchDelay?: number    // 默认 16ms
}
```

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 当前实现
- **实现方式**：Intersection Observer API + MathJax 渲染
- **特点**：Web 端专用，使用浏览器原生 API

#### 1.2 React Native 实现
- **实现方式**：第三方库或自定义实现 + WebView 渲染
- **特点**：需要使用第三方库或自定义实现

### 2. 需要的第三方库

```json
{
  "react-native": "^0.72.0",
  "react-native-intersection-observer": "^0.1.0",  // Intersection Observer（可选）
  "react-native-webview": "^13.0.0",                 // WebView 渲染
  "@react-native-community/hooks": "^2.8.0"          // useIntersectionObserver（可选）
}
```

### 3. React Native 实现示例

#### 方案 A：使用第三方库

```typescript
// lazy-message-renderer.ts (React Native 版本)
import { useIntersectionObserver } from '@react-native-community/hooks'
import { MathJaxUtils } from '../math/mathjax'
import { useRef, useEffect } from 'react'

export function useLazyMessageRender(options?: {
  rootMargin?: string
  threshold?: number
}) {
  const elementRef = useRef<View>(null)
  const isRendered = useRef(false)

  const {
    rootMargin = '50px',
    threshold = 0.1
  } = options || {}

  // 使用 Intersection Observer
  const isIntersecting = useIntersectionObserver(elementRef, {
    rootMargin,
    threshold
  })

  useEffect(() => {
    if (isIntersecting && !isRendered.current && elementRef.current) {
      // 渲染元素
      renderElement(elementRef.current)
      isRendered.current = true
    }
  }, [isIntersecting])

  const renderElement = async (element: View) => {
    try {
      // 检查是否包含数学公式（需要转换为字符串内容）
      // 使用 MathJax 渲染（需要 WebView 支持）
      await MathJaxUtils.renderMath(element)
    } catch (error) {
      console.warn('懒加载渲染失败:', error)
    }
  }

  return {
    elementRef,
    isRendered: isRendered.current
  }
}
```

#### 方案 B：自定义实现（使用 FlatList）

```typescript
// lazy-message-renderer.ts (React Native FlatList 版本)
import { useState, useEffect, useRef } from 'react'
import { View, FlatList, LayoutChangeEvent } from 'react-native'

interface LazyRenderOptions {
  viewportHeight: number
  rootMargin?: number
}

export function useLazyMessageRender(options: LazyRenderOptions) {
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set())
  const itemLayouts = useRef<Map<string, { y: number; height: number }>>(new Map())

  const { viewportHeight, rootMargin = 50 } = options

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    const visibleIds = new Set(viewableItems.map(item => item.key))
    setVisibleItems(visibleIds)
  })

  const onLayout = (id: string) => (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout
    itemLayouts.current.set(id, { y, height })
  }

  const shouldRender = (id: string): boolean => {
    return visibleItems.has(id)
  }

  return {
    onViewableItemsChanged: onViewableItemsChanged.current,
    onLayout,
    shouldRender,
    viewableItemsConfig: {
      viewAreaCoveragePercentThreshold: 10,
      itemVisiblePercentThreshold: 50
    }
  }
}
```

#### 使用示例（FlatList 方案）

```typescript
// ChatMessageList.tsx
import { FlatList } from 'react-native'
import { useLazyMessageRender } from '@/utils/render/lazy-message-renderer'

export const ChatMessageList: React.FC<{ messages: ChatBubble[] }> = ({ messages }) => {
  const {
    onViewableItemsChanged,
    shouldRender
  } = useLazyMessageRender({
    viewportHeight: Dimensions.get('window').height
  })

  const renderItem = ({ item }: { item: ChatBubble }) => {
    // 仅在可见时渲染
    if (!shouldRender(item.id)) {
      return <View style={{ height: 100 }} /> // 占位视图
    }

    return <ChatMessage message={item} />
  }

  return (
    <FlatList
      data={messages}
      renderItem={renderItem}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{
        viewAreaCoveragePercentThreshold: 10,
        itemVisiblePercentThreshold: 50
      }}
      initialNumToRender={10}
      maxToRenderPerBatch={5}
      windowSize={5}
    />
  )
}
```

### 4. 注意事项

#### 4.1 Intersection Observer
- **Web 端**：使用浏览器原生 API
- **React Native**：需要使用第三方库或自定义实现

#### 4.2 性能优化
- **Web 端**：使用 `WeakSet` 记录已渲染元素
- **React Native**：使用 `Set` 或 `Map` 记录已渲染元素

#### 4.3 批量渲染
- **Web 端**：批量处理 DOM 元素
- **React Native**：使用 `FlatList` 的 `initialNumToRender` 和 `maxToRenderPerBatch`

#### 4.4 MathJax 渲染
- **Web 端**：直接使用 MathJax 库
- **React Native**：需要使用 WebView 或替代方案

## ⚠️ 迁移风险

### 高风险项

1. **Intersection Observer**：
   - **风险**：React Native 没有原生 Intersection Observer
   - **解决方案**：使用第三方库或自定义实现
   - **影响**：需要调整监听逻辑

2. **DOM 操作**：
   - **风险**：React Native 没有 DOM，无法直接操作元素
   - **解决方案**：使用 React Native 的组件和 API
   - **影响**：需要重构渲染逻辑

3. **MathJax 渲染**：
   - **风险**：React Native 无法直接使用 MathJax
   - **解决方案**：使用 WebView 或替代方案
   - **影响**：性能和体积可能受影响

### 中风险项

1. **渲染队列**：
   - React Native 的渲染机制不同，需要调整队列逻辑
   - 可能需要使用 `FlatList` 的虚拟滚动

2. **性能优化**：
   - React Native 的性能优化策略可能不同
   - 需要测试和调整批量渲染逻辑

## 🧪 测试要点

### 功能测试

1. **懒加载测试**：
   - ✅ 元素进入视口时正确触发渲染
   - ✅ 元素离开视口时正确停止观察
   - ✅ 避免重复渲染

2. **渲染队列测试**：
   - ✅ 队列正确处理元素
   - ✅ 批量处理正常工作
   - ✅ 延迟处理正常工作

3. **MathJax 渲染测试**：
   - ✅ 数学公式正确检测
   - ✅ MathJax 渲染正常工作
   - ✅ 渲染状态正确标记

### 性能测试

1. **大量元素渲染**：
   - 测试大量消息时的懒加载性能
   - 测试批量渲染的效果

2. **视口变化测试**：
   - 测试滚动时的懒加载性能
   - 测试快速滚动时的行为

## 📚 参考资源

### 相关文档
- [Intersection Observer API 文档](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [React Native FlatList 文档](https://reactnative.dev/docs/flatlist)
- [react-native-intersection-observer 文档](https://github.com/FormidableLabs/react-native-intersection-observer)

### 相关文件
- `src/components/chat/ChatMessage.vue` - 使用懒加载渲染的组件
- `src/utils/math/mathjax.ts` - MathJax 渲染工具
- `src/composables/useMessageRenderer.ts` - 消息渲染工具

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**最后更新**：2025-01-XX  
**维护者**：开发团队
