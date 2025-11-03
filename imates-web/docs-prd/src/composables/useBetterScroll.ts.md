# useBetterScroll.ts PRD 文档

## 📋 概述

**文件路径**：`src/composables/useBetterScroll.ts`  
**文件类型**：`Vue 3 Composable (TypeScript)`  
**主要职责**：Better Scroll 滚动库的组合式函数封装，提供初始化、刷新、滚动控制等功能，用于实现流畅的滚动体验

## 🎯 功能需求

### 1. 核心功能

#### 1.1 Better Scroll 实例管理
- **初始化**：
  - 创建 BScroll 实例
  - 支持自定义配置选项
  - 自动等待 DOM 更新（使用 `nextTick`）
  - 如果已存在实例，自动销毁后重建
- **刷新**：
  - 刷新 BScroll 实例（用于内容变化后更新）
  - 自动等待 DOM 更新
- **销毁**：
  - 销毁 BScroll 实例
  - 清理资源，防止内存泄漏

#### 1.2 滚动控制
- **滚动到指定位置**：
  - `scrollTo(x, y, time)`：滚动到指定坐标
  - 支持动画时间设置
- **滚动到指定元素**：
  - `scrollToElement(element, time, offsetX, offsetY)`：滚动到指定元素
  - 支持偏移量设置
  - 支持时间设置

#### 1.3 自动监听
- **可选自动监听**：
  - 支持自动监听数据变化
  - 数据变化时自动刷新 BScroll 实例
  - 可配置监听的数据源数组

#### 1.4 配置选项
- **默认配置**：
  - `scrollY: true` - 垂直滚动
  - `scrollX: false` - 禁止横向滚动
  - `click: true` - 启用点击事件
  - `probeType: 2` - 实时滚动监听
  - `bounce: { top: true, bottom: true }` - 上下回弹
  - `bounceTime: 800` - 回弹时间
  - `deceleration: 0.003` - 减速系数
  - `useTransition: true` - 使用 CSS3 过渡
  - `HWCompositing: true` - 硬件加速

### 2. 功能边界

#### 2.1 负责的功能
- ✅ Better Scroll 实例的生命周期管理
- ✅ 滚动控制和导航
- ✅ 自动刷新机制
- ✅ DOM 更新等待（nextTick）
- ✅ 资源清理（销毁实例）

#### 2.2 不负责的功能
- ❌ Better Scroll 库本身的加载（由外部负责）
- ❌ 滚动事件监听（由使用方负责）
- ❌ 滚动性能优化（由 Better Scroll 库负责）
- ❌ 响应式布局处理（由使用方负责）

## 🔧 技术实现

### 1. 依赖关系

#### 1.1 导入依赖

```typescript
import { ref, nextTick, watch, onUnmounted, type Ref } from 'vue'
import BScroll from '@better-scroll/core'
import type { Options as BScrollOptions } from '@better-scroll/core'
```

#### 1.2 被依赖
- `ChatView.vue`：使用 `useBetterScroll` 实现聊天视图滚动
- 其他需要滚动的组件

### 2. 关键代码逻辑

#### 2.1 函数签名

```typescript
export function useBetterScroll(
  wrapperRef: Ref<HTMLElement | null>,
  options?: Partial<BScrollOptions>,
  autoWatch: boolean = false,
  watchSources?: Array<() => unknown>
)
```

**参数说明**：
- `wrapperRef`：滚动容器的 ref（必需）
- `options`：BScroll 配置选项（可选）
- `autoWatch`：是否自动监听数据变化（默认：false）
- `watchSources`：需要监听的数据源数组（当 autoWatch 为 true 时生效）

**返回值**：
```typescript
{
  init: () => Promise<void>
  refresh: () => Promise<void>
  destroy: () => void
  scrollTo: (x: number, y: number, time?: number) => void
  scrollToElement: (element: HTMLElement | string, time?: number, offsetX?: number | boolean, offsetY?: number | boolean) => void
  getInstance: () => BScroll | null
}
```

#### 2.2 初始化逻辑

```typescript
const init = async () => {
  await nextTick() // 等待 DOM 更新

  if (wrapperRef.value) {
    // 如果已存在实例，先销毁
    if (bscrollInstance) {
      destroy()
    }

    // 创建新实例
    bscrollInstance = new BScroll(wrapperRef.value, defaultOptions)
  }
}
```

#### 2.3 刷新逻辑

```typescript
const refresh = async () => {
  await nextTick() // 等待 DOM 更新
  bscrollInstance?.refresh() // 刷新实例
}
```

#### 2.4 销毁逻辑

```typescript
const destroy = () => {
  if (bscrollInstance) {
    bscrollInstance.destroy()
    bscrollInstance = null
  }
}
```

#### 2.5 滚动控制

```typescript
// 滚动到指定位置
const scrollTo = (x: number, y: number, time?: number) => {
  bscrollInstance?.scrollTo(x, y, time)
}

// 滚动到指定元素
const scrollToElement = (
  element: HTMLElement | string,
  time?: number,
  offsetX?: number | boolean,
  offsetY?: number | boolean
) => {
  bscrollInstance?.scrollToElement(element, time, offsetX, offsetY)
}
```

#### 2.6 自动监听逻辑

```typescript
// 自动监听数据变化
if (autoWatch && watchSources && watchSources.length > 0) {
  watch(
    () => watchSources.map(fn => fn()),
    () => {
      refresh()
    },
    { deep: true }
  )
}
```

#### 2.7 组件卸载清理

```typescript
onUnmounted(() => {
  destroy()
})
```

### 3. 使用示例

#### 3.1 基础使用

```typescript
import { ref } from 'vue'
import { useBetterScroll } from '@/composables/useBetterScroll'

const scrollWrapper = ref<HTMLElement | null>(null)

const {
  init: initBScroll,
  refresh: refreshBScroll,
  scrollTo,
  scrollToElement,
  getInstance
} = useBetterScroll(
  scrollWrapper,
  {
    scrollY: true,
    scrollX: false,
    click: true,
    probeType: 2,
    bounce: {
      top: true,
      bottom: true,
    },
    bounceTime: 800,
    deceleration: 0.003,
    useTransition: true,
    HWCompositing: true,
  }
)

// 初始化
onMounted(() => {
  initBScroll()
})

// 刷新（当内容变化时）
watch(() => messages.value.length, () => {
  refreshBScroll()
})

// 滚动到底部
const scrollToBottom = () => {
  const instance = getInstance()
  if (instance) {
    scrollTo(0, -instance.maxScrollY, 300)
  }
}
```

#### 3.2 自动监听使用

```typescript
const {
  init,
  refresh
} = useBetterScroll(
  scrollWrapper,
  {
    scrollY: true
  },
  true, // 启用自动监听
  [
    () => messages.value.length, // 监听消息数量
    () => isLoading.value // 监听加载状态
  ]
)
```

## 🔄 迁移到 React Native

### 1. 等价实现

#### 1.1 当前实现
- **实现方式**：Vue 3 Composable + Better Scroll 库
- **特点**：Web 端专用滚动库，支持触摸事件、回弹效果

#### 1.2 React Native 实现
- **实现方式**：React Native 原生组件 + 自定义 Hook
- **特点**：使用 `ScrollView` 或 `FlatList` 原生组件

### 2. 需要的第三方库

```json
{
  "react-native": "^0.72.0",
  "react-native-gesture-handler": "^2.0.0",  // 手势处理
  "react-native-reanimated": "^3.0.0"        // 动画库（可选）
}
```

### 3. React Native 实现示例

```typescript
// useBetterScroll.ts (React Native 版本)
import { useRef, useCallback, useEffect } from 'react'
import { ScrollView, FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

interface ScrollOptions {
  scrollY?: boolean
  scrollX?: boolean
  bounce?: boolean
  decelerationRate?: 'normal' | 'fast'
}

export function useBetterScroll<T>(
  options: ScrollOptions = {},
  autoWatch: boolean = false,
  watchSources?: Array<() => unknown>
) {
  const scrollViewRef = useRef<ScrollView | FlatList>(null)

  const scrollTo = useCallback((x: number, y: number, animated: boolean = true) => {
    if (scrollViewRef.current && 'scrollTo' in scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x, y, animated })
    }
  }, [])

  const scrollToElement = useCallback((offset: number, animated: boolean = true) => {
    if (scrollViewRef.current && 'scrollToOffset' in scrollViewRef.current) {
      scrollViewRef.current.scrollToOffset({ offset, animated })
    }
  }, [])

  const scrollToEnd = useCallback((animated: boolean = true) => {
    if (scrollViewRef.current) {
      if ('scrollToEnd' in scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated })
      }
    }
  }, [])

  const refresh = useCallback(() => {
    // React Native ScrollView 会自动刷新，无需手动刷新
    // 但可以触发重新渲染
  }, [])

  const destroy = useCallback(() => {
    // React Native 组件会自动清理，无需手动销毁
    scrollViewRef.current = null
  }, [])

  // 自动监听（使用 useEffect）
  useEffect(() => {
    if (autoWatch && watchSources) {
      // 监听数据变化，触发重新渲染
      watchSources.forEach(source => source())
    }
  }, [autoWatch, watchSources])

  return {
    scrollViewRef,
    scrollTo,
    scrollToElement,
    scrollToEnd,
    refresh,
    destroy,
    getInstance: () => scrollViewRef.current
  }
}
```

#### 使用示例

```typescript
// ChatView.tsx
import { useBetterScroll } from '@/hooks/useBetterScroll'
import { ScrollView } from 'react-native'

export const ChatView: React.FC = () => {
  const {
    scrollViewRef,
    scrollTo,
    scrollToEnd
  } = useBetterScroll({
    scrollY: true,
    bounce: true
  })

  // 滚动到底部
  const handleScrollToBottom = () => {
    scrollToEnd(true)
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      scrollEnabled={true}
      bounces={true}
      showsVerticalScrollIndicator={false}
    >
      {/* 消息列表 */}
    </ScrollView>
  )
}
```

### 4. 注意事项

#### 4.1 滚动行为差异
- **Web 端**：Better Scroll 提供更精细的滚动控制（回弹、减速等）
- **React Native**：使用原生组件，性能更好，但定制化较少

#### 4.2 性能优化
- **Web 端**：需要处理大量 DOM 元素时，Better Scroll 性能更好
- **React Native**：使用 `FlatList` 实现虚拟滚动，性能更优

#### 4.3 事件处理
- **Web 端**：Better Scroll 封装了触摸事件处理
- **React Native**：原生支持触摸事件，无需额外处理

#### 4.4 配置选项映射

| Better Scroll 选项 | React Native 对应 |
|-------------------|------------------|
| `scrollY: true` | `<ScrollView>` 默认支持 |
| `scrollX: false` | `horizontal={false}` |
| `bounce: true` | `bounces={true}` |
| `probeType: 2` | `onScroll` 事件 |
| `deceleration: 0.003` | `decelerationRate="normal"` |
| `useTransition: true` | 原生支持动画 |
| `HWCompositing: true` | 原生硬件加速 |

## ⚠️ 迁移风险

### 高风险项

1. **滚动库差异**：
   - **风险**：Better Scroll 和 React Native 滚动行为不完全一致
   - **解决方案**：使用 React Native 原生组件，根据需求调整配置
   - **影响**：滚动体验可能略有差异

2. **自动刷新机制**：
   - **风险**：React Native 组件会自动刷新，无需手动刷新
   - **解决方案**：移除手动刷新逻辑，依赖 React 的响应式更新
   - **影响**：需要调整代码逻辑

3. **滚动位置计算**：
   - **风险**：React Native 的滚动位置计算方式不同
   - **解决方案**：使用 `onScroll` 事件获取滚动位置
   - **影响**：滚动位置相关的逻辑需要重写

### 中风险项

1. **滚动动画**：
   - 需要测试动画效果是否一致
   - 可能需要使用 `react-native-reanimated` 实现自定义动画

2. **虚拟滚动**：
   - 长列表需要使用 `FlatList` 而不是 `ScrollView`
   - 需要重构列表渲染逻辑

## 🧪 测试要点

### 功能测试

1. **初始化测试**：
   - ✅ BScroll 实例正确创建
   - ✅ DOM 更新后正确初始化
   - ✅ 已存在实例时正确销毁重建

2. **滚动测试**：
   - ✅ `scrollTo` 功能正常
   - ✅ `scrollToElement` 功能正常
   - ✅ 滚动动画流畅

3. **刷新测试**：
   - ✅ DOM 内容变化后正确刷新
   - ✅ 自动监听正常工作

4. **销毁测试**：
   - ✅ 组件卸载时正确销毁实例
   - ✅ 无内存泄漏

### 性能测试

1. **大量内容滚动**：
   - 测试大量 DOM 元素时的滚动性能
   - 测试虚拟滚动效果

2. **频繁刷新**：
   - 测试频繁刷新时的性能影响
   - 测试防抖/节流机制

## 📚 参考资源

### 相关文档
- [Better Scroll 官方文档](https://better-scroll.github.io/docs/)
- [React Native ScrollView 文档](https://reactnative.dev/docs/scrollview)
- [React Native FlatList 文档](https://reactnative.dev/docs/flatlist)

### 相关文件
- `src/components/ChatView.vue` - 使用 `useBetterScroll` 的组件
- `@better-scroll/core` - Better Scroll 核心库

---

**文档版本**：v1.0  
**创建日期**：2025-01-XX  
**最后更新**：2025-01-XX  
**维护者**：开发团队
