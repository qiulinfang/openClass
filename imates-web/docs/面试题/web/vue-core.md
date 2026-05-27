# Web 面试题 - Vue 核心与状态管理

> 本面试题基于项目实际代码，深入探讨技术实现细节与业务难点。

## 1. Vue 3 响应式系统 (Reactivity)

### Q1: Vue 3 的 `ref` 和 `reactive` 在源码层面有什么区别？为什么 `ref` 需要 `.value` 而 `reactive` 不需要？
- **实现原理**: `ref` 内部使用一个包含 `value` 属性的对象来存储值，并通过 `Object.defineProperty` 的 getter/setter 劫持访问；而 `reactive` 直接使用 `Proxy` 代理整个对象。
- **为什么需要 `.value`**: `ref` 设计初衷是处理基本类型值，通过 `.value` 可以保持数据的响应性，同时在模板中自动解包。
- **解包机制**: 当 `ref` 作为响应式对象的属性时（如 `const obj = reactive({ count: ref(0) })`），访问 `obj.count` 会自动解包。

### Q2: Vue 3 的响应式系统是如何处理数组的？监听 `arr.push()` 和 `arr.length = 0` 有什么区别？
- **数组拦截**: Vue 3 使用 `Proxy` 重写了数组方法（如 `push`, `splice`），可以监听到索引赋值和长度变化。
- **`arr.push()`**: 触发 `set` 和可能多次 `get`（取决于新增元素数量）。
- **`arr.length = 0`**: 触发 `set`，但不会触发数组元素的 `delete` 监听（Vue 3.3+ 修复了部分问题）。

### Q3: `watch` 和 `watchEffect` 在使用场景上有什么区别？请结合项目中的实际用法说明。
- **watch**: 
  - 显式指定监听源，可以获取旧值。
  - 惰性执行（组件挂载时不执行，除非设置 `immediate: true`）。
  - 适合监听特定响应式变量的变化。
- **watchEffect**: 
  - 自动追踪依赖，立即执行。
  - 无法获取旧值。
  - 适合副作用逻辑（如本项目中 `pdfViewerStore.drawingConfig.eraserSize` 变化时更新橡皮光标）。

### Q4: 项目中如何使用 Pinia 的 `storeToRefs`？为什么有时候解构会丢失响应性？
- **问题**: 直接解构 `const { count } = store` 会丢失响应性，因为解构得到的是普通值。
- **解决**: 使用 `storeToRefs` 或 `store.$state`。
- **原理**: `storeToRefs` 会把 state 和 getter 转换为 ref，保留响应性。

### Q5: Vue 3 的 `toRaw` 和 `markRaw` 是什么？什么场景下需要使用？
- **`toRaw`**: 获取响应式对象的原始值（Proxy 包裹前的对象），用于避免不必要的响应式追踪。
- **`markRaw`**: 标记一个对象为"非响应式"，后续对该对象的修改不会触发视图更新。
- **应用场景**: 
  - 第三方库创建的对象（如 MuPDF Document）使用 `markRaw` 避免响应式开销。
  - 项目中 `pdfDoc`, `allStrokes` 使用 `shallowRef` 配合 `toRaw` 使用。

### Q6: `triggerRef` 和 `flush: 'sync'` 是什么作用？为什么需要同步更新？
- **`triggerRef`**: 强制触发 `shallowRef` 的更新，即使内部属性没有变化。
- **`flush: 'sync'`**: watch 的同步模式，立即执行回调，不等待微任务队列。
- **场景**: 当需要在同一个 tick 内立即看到更新效果时使用。

## 2. 组件通信与依赖注入

### Q7: `provide` / `inject` 和 `props` / `emit` 有什么区别？项目中如何选择？
- **props / emit**: 父子组件通信，类型安全，层层传递。
- **provide / inject**: 跨层级通信（祖先 -> 后代），不依赖组件树结构。
- **项目实践**: 
  - `KnowledgeGraphView.vue` 使用 `provide('knowledgeGraphAngleData', {...})` 向调试面板传递数据。
  - `GraphNode.vue` 使用 `inject<Ref<KnowledgeGraphDebugParams>>('knowledgeGraphDebugParams')` 获取调试参数。
- **选择原则**: 
  - 父 -> 子：优先使用 props。
  - 跨多层级：使用 provide/inject。
  - 需要类型安全时使用泛型。

### Q8: 项目中如何使用 `defineExpose`？为什么 `<script setup>` 组件默认不暴露属性？
- **原理**: `<script setup>` 组件默认不暴露任何属性，需要通过 `defineExpose` 显式暴露。
- **项目实践**: 
  ```typescript
  // KnowledgeGraph.vue
  defineExpose({
    refreshLearningStatus
  })
  ```
- **父组件调用**:
  ```typescript
  const graphRef = ref<InstanceType<typeof GraphNode>>()
  graphRef.value?.refreshLearningStatus()
  ```

### Q9: 什么是"依赖注入"（DI）模式？Vue 的 provide/inject 是如何实现的？
- **概念**: 一种设计模式，通过"提供者"提供依赖，"消费者"使用依赖，解耦对象创建。
- **Vue 实现**: 
  - 祖先组件使用 `provide(key, value)` 提供依赖。
  - 后代组件使用 `inject(key)` 获取依赖。
  - 支持默认值和类型推导。
- **项目示例**: 调试参数通过 provide 注入，子组件无需关心数据来源。

### Q10: 项目中如何处理多层 provide/inject 的响应式？请说明 `toRef` 的作用。
- **问题**: 直接解构 `const { count } = inject('data')` 会丢失响应性。
- **解决**: 使用 `toRef` 或 `toRefs` 转换。
- **示例**: 
  ```typescript
  const data = inject('data')
  const count = toRef(data, 'count') // 保持响应性
  ```

## 3. 异步组件与代码分割

### Q11: 项目中如何使用 `defineAsyncComponent`？它和静态导入有什么区别？
- **区别**: 
  - 静态导入: `import BubblePopup from '...'` 同步加载，打包时合并。
  - 异步组件: `defineAsyncComponent(() => import('...'))` 按需加载，代码分割。
- **项目实践**:
  ```typescript
  // SimpleChatInput.vue
  const BubblePopup = defineAsyncComponent(() => import('../../base/Popover.vue'))
  const ActionList = defineAsyncComponent(() => import('../../base/DropdownMenu.vue'))
  ```
- **优势**: 减少首屏加载时间，按需加载非关键组件。

### Q12: `defineAsyncComponent` 有哪些配置选项？项目中如何使用？
- **选项**:
  - `loadingComponent`: 加载时显示的组件。
  - `errorComponent`: 加载失败时显示的组件。
  - `delay`: 延迟显示 loading 的时间（默认 200ms）。
  - `timeout`: 超时时间。
- **项目实践**: 可以为知识图谱等重型组件添加 loading 状态。

### Q13: 什么是 Suspense 组件？项目中是否使用？
- **作用**: 处理异步依赖的占位符，可以在异步组件加载时显示 fallback 内容。
- **场景**: 组件树中有多个异步组件时，统一处理加载状态。
- **项目**: 目前项目中使用 `defineAsyncComponent` + 手动 loading 状态，暂未使用 Suspense。

## 4. 自定义指令 (Directives)

### Q14: 项目中有哪些自定义指令？请说明 `v-mathjax-preview` 的实现原理。
- **项目指令**: 
  - `v-mathjax-preview`: 数学公式预览
  - `v-paste-to-draft`: 图片粘贴到草稿本
- **实现原理** (`v-mathjax-preview`):
  ```typescript
  export const mathjaxPreview: ObjectDirective = {
    mounted(el, binding) {
      renderAndBind(el, binding)
    },
    updated(el, binding) {
      renderAndBind(el, binding)
    }
  }
  ```
- **核心逻辑**: 
  - 监听元素挂载和更新。
  - 调用 `MathJaxUtils.renderMath` 渲染公式。
  - 附加图片点击事件监听器。

### Q15: `v-paste-to-draft` 指令是如何实现的？请说明其核心逻辑。
- **功能**: 为 Markdown 图片添加"贴到草稿本"按钮。
- **核心实现**:
  - 使用 `MutationObserver` 监听 DOM 变化。
  - 扫描新插入的图片，添加 wrapper 和按钮。
  - 使用 `requestAnimationFrame` 优化扫描性能。
  - 处理 MathJax 公式图片的排除逻辑。

### Q16: 自定义指令的钩子函数有哪些？`beforeUpdate` 和 `updated` 有什么区别？
- **钩子**: `created`, `beforeMount`, `mounted`, `beforeUpdate`, `updated`, `beforeUnmount`, `unmounted`
- **区别**: 
  - `beforeUpdate`: 元素属性/事件更新前调用，可以访问旧值。
  - `updated`: 元素更新后调用，DOM 已更新。

## 5. 性能优化 (Performance)

### Q17: 项目中 `shallowRef` 和 `ref` 有什么区别？什么场景下应该使用 `shallowRef`？
- **区别**: `shallowRef` 只监听 `.value` 的替换，不监听内部属性的变化。
- **应用场景**: 
  - 大型数据（如本项目中的 `pdfDoc`, `allStrokes`）使用 `shallowRef` 避免深度响应式开销。
  - 外部库创建的对象（如 MuPDF Document）通常不需要 Vue 响应式追踪。

### Q18: Vue 组件的 `v-memo` 指令是什么？项目中哪里可以用到？
- **作用**: 缓存组件模板的渲染结果，只有当依赖变化时才重新渲染。
- **适用场景**: 列表中大量静态内容、复杂的条件渲染分支。
- **示例**: 本项目的 PDF 页面列表可以使用 `v-memo` 优化。

### Q19: 什么是 Virtual DOM 的"靶向更新"？Vue 3 如何实现？
- **原理**: Vue 3 使用 Block Tree 和 Vue Felix 的靶向更新算法。
- **Block Tree**: 将模板编译为包含动态节点的 Block，运行时快速定位变化。
- **对比 Vue 2**: Vue 2 需要遍历整个 VNode 树，Vue 3 只需遍历动态节点。

### Q20: 项目中如何处理大量数据的列表渲染？虚拟滚动是什么？
- **问题**: 大量 DOM 节点会导致页面卡顿。
- **方案**: 虚拟滚动（Virtual Scroll），只渲染可视区域内的元素。
- **项目实践**: 使用 `RubberBandList` 组件实现虚拟滚动。

### Q21: 什么是"计算属性缓存"？`computed` 和 `methods` 有什么区别？
- **缓存**: 计算属性基于依赖进行缓存，依赖不变时返回缓存结果。
- **区别**: 
  - `computed`: 响应式依赖变化时重新计算，缓存结果。
  - `methods`: 每次调用都重新执行。

## 6. 工程实践 (Engineering)

### Q22: 项目中如何处理 TypeScript 类型？有哪些最佳实践？
- **类型定义**: 使用 `interface` 定义数据结构（如 `Stroke`, `Point`, `HistoryAction`）。
- **类型推导**: 充分利用 TypeScript 的类型推导，减少冗余类型标注。
- **类型守卫**: 使用 `typeof` 和 `instanceof` 进行运行时类型检查。
- **泛型**: 组件和函数使用泛型增加灵活性。

### Q23: Vue 3 的 `<script setup>` 语法糖是如何工作的？编译器会生成什么代码？
- **编译结果**: `<script setup>` 会被编译为 `setup()` 函数的返回值。
- **自动注册**: 组件导入、defineProps、defineEmits 会自动注册，无需手动返回。
- **性能**: 减少运行时开销，所有逻辑在编译阶段处理。

### Q24: 项目中如何实现 Pinia Store 的热更新（HMR）？
- **原理**: Pinia 内置支持 HMR，通过 `import.meta.hot` 接收模块更新。
- **实践**: 修改 Store 文件时，页面无需刷新即可看到变化。

### Q25: 项目中如何组织 composables？有哪些最佳实践？
- **目录**: `src/composables/` 目录。
- **命名**: 使用 `use` 前缀（如 `useMessageRenderer`, `usePdfViewer`）。
- **实践**: 
  - 单一职责：一个 composable 只做一件事。
  - 依赖明确：明确声明依赖的响应式状态。
  - 返回值：返回响应式对象和清理函数。

### Q26: 什么是"渲染函数"（Render Function）？项目中是否使用？
- **概念**: 直接操作 VNode 的函数，用于动态渲染内容。
- **场景**: 动态组件、渲染函数式组件。
- **项目**: 主要使用模板，暂未直接使用渲染函数。

### Q27: Vue 3 的 `v-model` 原理是什么？项目中如何使用？
- **原理**: 
  - 组件上 `v-model` 相当于 `:modelValue="value"` + `@update:modelValue="value = $event"`。
  - 可以通过 `defineModel` 简化。
- **项目实践**: 
  ```typescript
  // 组件内
  const props = defineProps<{ modelValue: string }>()
  const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
  ```
