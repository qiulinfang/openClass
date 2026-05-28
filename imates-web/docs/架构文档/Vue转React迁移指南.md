# Vue 转 React 迁移指南

本文档总结了从 Vue 3 (Composition API) 迁移到 React (Hooks) 的核心对照和最佳实践。

---

## 一、核心概念对照表

| Vue 概念 | React 等价 | 说明 |
|---------|-----------|------|
| `ref()` / `reactive()` | `useState()` | 响应式状态 |
| `computed()` | `useMemo()` | 计算属性（缓存派生值） |
| `watch()` / `watchEffect()` | `useEffect()` | 副作用和监听 |
| `onMounted()` | `useEffect(() => {}, [])` | 组件挂载 |
| `onUnmounted()` | `useEffect` 的 return 函数 | 组件卸载清理 |
| `defineProps()` | 函数参数解构 | 属性定义 |
| `defineEmits()` | Props 回调函数 | 事件通信 |
| `v-model` | `value` + `onChange` | 双向绑定 |
| `provide/inject` | `useContext()` | 依赖注入 |
| `nextTick()` | `flushSync` / `setTimeout(fn, 0)` | DOM 更新后执行 |

---

## 二、状态管理

### Vue
```js
const count = ref(0)
count.value++  // 直接赋值修改
```

### React
```tsx
const [count, setCount] = useState(0)
setCount(prev => prev + 1)  // 必须通过 setter 函数更新
```

### 关键区别
- React **不能直接赋值**状态变量，必须调用 `setState` 函数。
- React 的状态更新是**异步**的，如果需要基于之前的状态更新，使用函数式更新：`setCount(prev => prev + 1)`。
- 对于不需要触发重渲染的可变值（类似 Vue 中普通变量），使用 `useRef()`。

---

## 三、计算属性

### Vue
```js
const fullName = computed(() => firstName.value + ' ' + lastName.value)
```

### React
```tsx
const fullName = useMemo(() => firstName + ' ' + lastName, [firstName, lastName])
```

### 关键区别
- `useMemo` 需要手动声明**依赖数组**，Vue 的 `computed` 会自动追踪依赖。
- 如果缓存的是函数，使用 `useCallback` 而非 `useMemo`。

---

## 四、模板语法 → JSX

### 4.1 条件渲染

| Vue | React |
|-----|-------|
| `v-if="condition"` | `{condition && <Component />}` |
| `v-if` / `v-else` | `{condition ? <A /> : <B />}` |
| `v-show="visible"` | `style={{ display: visible ? 'block' : 'none' }}` |

### 4.2 列表渲染

**Vue:**
```html
<li v-for="item in list" :key="item.id">{{ item.name }}</li>
```

**React:**
```tsx
{list.map(item => (
  <li key={item.id}>{item.name}</li>
))}
```

### 4.3 属性绑定

| Vue | React |
|-----|-------|
| `:class="{ active: isActive }"` | `` className={`${isActive ? 'active' : ''}`} `` |
| `:style="{ color: textColor }"` | `style={{ color: textColor }}` |
| `:src="imageUrl"` | `src={imageUrl}` |
| `{{ text }}` | `{text}` |

### 4.4 事件绑定

| Vue | React |
|-----|-------|
| `@click="handleClick"` | `onClick={handleClick}` |
| `@click="handleClick(arg)"` | `onClick={() => handleClick(arg)}` |
| `@click.stop` | `onClick={(e) => { e.stopPropagation(); ... }}` |
| `@click.prevent` | `onClick={(e) => { e.preventDefault(); ... }}` |
| `@input="handleInput"` | `onChange={handleInput}` |

> ⚠️ **注意**：`onClick={handleClick(arg)}` 会**立即执行**函数！必须写成箭头函数形式 `onClick={() => handleClick(arg)}`。

---

## 五、组件通信

### 5.1 Props (父 → 子)

**Vue:**
```js
const props = defineProps<{ title: string; count?: number }>()
// 使用: props.title
```

**React:**
```tsx
interface MyProps { title: string; count?: number }

const MyComponent: React.FC<MyProps> = ({ title, count = 0 }) => {
  // 直接使用解构后的 title, count
}
```

### 5.2 Events / Emit (子 → 父)

**Vue:**
```js
const emit = defineEmits(['change', 'update:modelValue'])
emit('change', newValue)
```

**React:**
```tsx
// 父组件传入回调函数
interface Props { onChange?: (value: string) => void }

// 子组件调用
onChange?.(newValue)
```

### 5.3 v-model 双向绑定

**Vue:**
```html
<MyInput v-model="text" />
```

**React:**
```tsx
<MyInput value={text} onChange={setText} />
```

---

## 六、Ref 与 DOM 操作

### Vue
```js
const inputRef = ref<HTMLInputElement | null>(null)
inputRef.value?.focus()
```

### React
```tsx
const inputRef = useRef<HTMLInputElement>(null)
inputRef.current?.focus()

// JSX 中绑定
<input ref={inputRef} />
```

### 暴露方法给父组件

**Vue:**
```js
defineExpose({ focus, reset })
```

**React:**
```tsx
// 使用 forwardRef + useImperativeHandle
const MyInput = forwardRef<MyInputRef, Props>((props, ref) => {
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    reset: () => setValue(''),
  }))
})
```

---

## 七、插槽 → Children / Render Props

### 7.1 默认插槽

**Vue:**
```html
<Card><p>内容</p></Card>
```

**React:**
```tsx
<Card><p>内容</p></Card>

// Card 组件内部
const Card: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return <div className="card">{children}</div>
}
```

### 7.2 具名插槽

**Vue:**
```html
<Layout>
  <template #header>头部</template>
  <template #footer>底部</template>
</Layout>
```

**React:**
```tsx
<Layout header={<div>头部</div>} footer={<div>底部</div>} />

// Layout 组件
interface LayoutProps {
  header?: React.ReactNode
  footer?: React.ReactNode
}
```

### 7.3 作用域插槽

**Vue:**
```html
<List>
  <template #item="{ data }">{{ data.name }}</template>
</List>
```

**React (Render Props):**
```tsx
<List renderItem={(data) => <span>{data.name}</span>} />

// List 组件
interface ListProps {
  renderItem: (data: Item) => React.ReactNode
}
```

---

## 八、Teleport → Portal

**Vue:**
```html
<Teleport to="body">
  <Modal />
</Teleport>
```

**React:**
```tsx
import { createPortal } from 'react-dom'

{createPortal(<Modal />, document.body)}
```

---

## 九、生命周期对照

| Vue | React |
|-----|-------|
| `onMounted(() => {})` | `useEffect(() => {}, [])` |
| `onUpdated(() => {})` | `useEffect(() => {})` (无依赖数组) |
| `onUnmounted(() => {})` | `useEffect(() => { return () => { /* cleanup */ } }, [])` |
| `onBeforeUnmount(() => {})` | 同上，return 函数 |

---

## 十、常见陷阱

### 1. 闭包问题
React 中事件处理函数和 useEffect 捕获的是渲染时的状态快照。如果需要最新值，使用 `useRef` 存储。

### 2. useEffect 依赖数组
- 空数组 `[]`：只在挂载时执行一次。
- 有依赖 `[a, b]`：a 或 b 变化时重新执行。
- 不传数组：每次渲染都执行（慎用）。

### 3. 对象/数组状态更新
```tsx
// ❌ 错误：直接修改
items.push(newItem)
setItems(items)

// ✅ 正确：创建新引用
setItems([...items, newItem])
setItems(prev => [...prev, newItem])
```

### 4. className 不能写两次
```tsx
// ❌ 错误：两个 className 只有最后一个生效
<span className="a" className="b">

// ✅ 正确：合并到一个字符串
<span className={`a ${condition ? 'b' : ''}`}>
```

### 5. 事件回调传参
```tsx
// ❌ 错误：会立即执行
onClick={handleClick(id)}

// ✅ 正确：包裹箭头函数
onClick={() => handleClick(id)}
```

---

## 十一、样式迁移

| Vue | React |
|-----|-------|
| `<style scoped>` | 独立 `.css` 文件 + `import './Component.css'` |
| `:deep(.child)` | 直接写类名选择器（无 scoped 隔离） |
| SCSS 变量 | CSS 变量 或 直接写值 |
| `v-bind()` in CSS | `style` prop 内联样式 |

---

## 十二、迁移检查清单

- [ ] Props 接口定义（TypeScript interface）
- [ ] 状态变量使用 `useState`
- [ ] 计算值使用 `useMemo`
- [ ] 事件用 Props 回调替代 emit
- [ ] 模板指令转为 JSX 表达式
- [ ] 插槽转为 children / render props
- [ ] CSS 独立文件并导入
- [ ] Teleport 转为 createPortal
- [ ] 生命周期转为 useEffect
- [ ] 外部点击等全局事件在 useEffect 中注册/清理
