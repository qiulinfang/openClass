# 组合式函数与Store的区别分析

## 一、核心问题：组合式函数是否有组件共享数据的功能？

### 答案：可以，但需要特殊处理

**默认情况下**：组合式函数每次调用都会创建**新的状态实例**，不同组件调用时状态是**独立的**。

**但可以通过全局单例模式**：将状态定义在函数外部，让所有组件共享同一个状态实例。

## 二、组合式函数（Composable）的特性

### 2.1 默认行为：每次调用创建新实例

```typescript
// 示例：普通的组合式函数
export function useCounter() {
  const count = ref(0)  // 每次调用都创建新的 ref
  
  const increment = () => {
    count.value++
  }
  
  return { count, increment }
}

// 组件A
const { count: countA } = useCounter()  // countA 是独立的

// 组件B  
const { count: countB } = useCounter()  // countB 是独立的，与 countA 无关
```

**特点**：
- ✅ 每次调用创建新的响应式状态
- ✅ 适合组件内部状态管理
- ❌ 默认不支持组件间数据共享

### 2.2 全局单例模式：实现组件间共享

项目中 `useImagePicker` 就是一个很好的例子：

```4:6:imates-web/src/composables/useImagePicker.ts
// 全局单例状态
const isPickerVisible = ref(false)
let resolveCallback: ((imageInfo: ImageData | null) => void) | null = null
```

**关键点**：
- 状态定义在**函数外部**（模块级别）
- 所有组件调用 `useImagePicker()` 时，都访问**同一个**状态实例
- 实现了组件间数据共享

**使用场景**：
- 全局工具类功能（如图片选择器）
- 简单的全局状态
- 不需要持久化的共享状态

### 2.3 组合式函数的生命周期

```typescript
export function useBetterScroll(wrapperRef) {
  let bscrollInstance = null  // 每个组件实例独立
  
  const init = () => {
    // 初始化逻辑
  }
  
  onUnmounted(() => {
    // 组件卸载时清理
    destroy()
  })
  
  return { init, destroy }
}
```

**特点**：
- 生命周期与组件绑定
- 组件卸载时自动清理
- 适合组件级资源管理

## 三、Store（Pinia）的特性

### 3.1 天然支持组件间共享

项目中 `useQuestionStore` 的示例：

```15:25:imates-web/src/stores/questionStore.ts
export const useQuestionStore = defineStore('question', () => {
  // ==================== 状态定义 ====================
  
  /** 题目列表 */
  const questions = ref<ExerciseItem[]>([])
  
  /** 相似题目列表 */
  const similarQuestions = ref<ExerciseItem[]>([])
  
  /** 当前选中的题目索引 */
  const currentQuestionIndex = ref(-1)
```

**特点**：
- ✅ 使用 `defineStore` 定义，Pinia 自动管理单例
- ✅ 所有组件调用 `useQuestionStore()` 时，返回**同一个** store 实例
- ✅ 天然支持组件间数据共享
- ✅ 支持响应式更新（所有使用该 store 的组件都会自动更新）

### 3.2 Store 的高级特性

#### 3.2.1 持久化支持

```52:59:imates-web/src/stores/questionStore.ts
  const saveQuestionsToLocal = async (subject: string): Promise<void> => {
    try {
      await saveQuestionsToIndexedDB(subject, questions.value)
      console.log('[QUESTION] ✅ 题目列表已保存到 IndexedDB:', questions.value.length)
    } catch (error) {
      console.error('[QUESTION] ❌ 保存题目列表到 IndexedDB 失败:', error)
    }
  }
```

#### 3.2.2 计算属性

```35:44:imates-web/src/stores/questionStore.ts
  /** 当前选中的题目 */
  const currentQuestion = computed(() => {
    if (currentQuestionIndex.value >= 0 && currentQuestionIndex.value < questions.value.length) {
      return questions.value[currentQuestionIndex.value]
    }
    return null
  })
  
  /** 是否有题目数据 */
  const hasQuestions = computed(() => questions.value.length > 0)
```

#### 3.2.3 生命周期独立

- Store 的生命周期独立于组件
- 组件卸载时 Store 状态不会丢失
- 适合需要持久化的全局状态

## 四、对比总结

| 特性 | 组合式函数（默认） | 组合式函数（全局单例） | Store（Pinia） |
|------|------------------|---------------------|---------------|
| **组件间共享** | ❌ 不支持 | ✅ 支持（需手动实现） | ✅ 天然支持 |
| **状态隔离** | ✅ 每个组件独立 | ❌ 全局共享 | ❌ 全局共享 |
| **生命周期** | 绑定组件 | 绑定模块 | 独立管理 |
| **持久化** | 需手动实现 | 需手动实现 | ✅ 插件支持 |
| **DevTools** | ❌ 不支持 | ❌ 不支持 | ✅ 支持 |
| **TypeScript** | ✅ 良好支持 | ✅ 良好支持 | ✅ 良好支持 |
| **使用复杂度** | 简单 | 中等 | 简单 |
| **适用场景** | 组件内部逻辑 | 全局工具类 | 全局状态管理 |

## 五、项目中的实际应用

### 5.1 组合式函数的使用场景

#### 场景1：组件级功能封装（不共享）
```typescript
// useBetterScroll.ts - 每个组件独立使用
export function useBetterScroll(wrapperRef) {
  let bscrollInstance = null  // 每个组件有自己的实例
  // ...
}
```

#### 场景2：全局工具类（共享状态）
```typescript
// useImagePicker.ts - 全局共享状态
const isPickerVisible = ref(false)  // 全局单例

export function useImagePicker() {
  // 所有组件共享同一个 isPickerVisible
  return { isPickerVisible, pickImage }
}
```

### 5.2 Store 的使用场景

#### 场景1：全局状态管理
```typescript
// questionStore.ts - 题目数据全局共享
export const useQuestionStore = defineStore('question', () => {
  const questions = ref<ExerciseItem[]>([])  // 全局共享
  // ...
})
```

#### 场景2：用户信息管理
```typescript
// userStore.ts - 用户信息全局共享
export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)  // 全局共享
  // ...
})
```

#### 场景3：复杂状态管理（类实例）
```typescript
// textbookChapterState.ts - 使用类管理复杂状态
export class TextbookChapterStateManager {
  private states = ref<Map<string, Map<number, ChapterState>>>(new Map())
  // ...
}

// 全局单例
export const textbookChapterStateManager = new TextbookChapterStateManager()
```

## 六、选择建议

### 6.1 使用组合式函数的场景

1. **组件内部逻辑复用**
   - 不涉及组件间数据共享
   - 例如：滚动处理、表单验证、动画控制

2. **简单的全局工具**
   - 需要全局共享，但状态简单
   - 例如：图片选择器、对话框控制

### 6.2 使用 Store 的场景

1. **全局状态管理**
   - 多个组件需要共享数据
   - 需要持久化
   - 需要 DevTools 支持

2. **复杂业务状态**
   - 状态结构复杂
   - 需要计算属性、监听器等高级特性
   - 例如：用户信息、题目列表、聊天记录

### 6.3 混合使用

项目中实际采用了混合模式：

- **组合式函数**：封装 UI 逻辑、工具函数（`useBetterScroll`、`useMessageRenderer`）
- **Store**：管理业务状态（`questionStore`、`userStore`、`aiGeneralChatStore`）
- **类实例**：管理复杂状态结构（`TextbookChapterStateManager`）

## 七、最佳实践

### 7.1 组合式函数实现共享的注意事项

```typescript
// ✅ 正确：状态定义在函数外部
const globalState = ref(0)

export function useSharedState() {
  return { globalState }
}

// ❌ 错误：状态定义在函数内部（无法共享）
export function useSharedState() {
  const globalState = ref(0)  // 每次调用都创建新实例
  return { globalState }
}
```

### 7.2 Store 的命名和组织

```typescript
// ✅ 正确：按业务领域命名
export const useQuestionStore = defineStore('question', () => {})
export const useUserStore = defineStore('user', () => {})

// ✅ 正确：一个 Store 管理一个业务领域的状态
// 避免在一个 Store 中管理过多不相关的状态
```

## 八、总结

1. **组合式函数默认不支持组件间共享**，但可以通过全局单例模式实现
2. **Store 天然支持组件间共享**，是全局状态管理的首选
3. **选择依据**：
   - 需要组件间共享 → Store
   - 仅组件内部使用 → 组合式函数
   - 简单全局工具 → 组合式函数（全局单例）
   - 复杂全局状态 → Store

4. **项目中的实践**：
   - 组合式函数用于 UI 逻辑和工具函数
   - Store 用于业务状态管理
   - 两者可以混合使用，各司其职

