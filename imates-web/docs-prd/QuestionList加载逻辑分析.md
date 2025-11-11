# QuestionList 加载逻辑分析

## 概述

`QuestionList.vue` 组件采用**多层优化策略**实现高性能的题目列表加载和渲染，包括数据分页、渐进式渲染、视口懒加载等多种技术。

---

## 一、数据加载流程

### 1.1 初始化加载（onMounted）

```typescript
onMounted(() => {
  loadQuestions()      // 加载题目数据
  initFavoriteStatus() // 初始化收藏状态
})
```

### 1.2 数据加载策略（loadQuestions）

**第1步：检查 Store 缓存**
- 如果 `questionStore.questions.length > 0`，直接使用缓存数据
- 避免重复请求，提升性能

**第2步：确定加载科目**
```typescript
if (selectedSubjectFilter.value === null) {
  // 全部学科：加载所有学科的题目
  await questionStore.fetchAllSubjectsQuestions(true)
} else {
  // 具体学科：加载指定学科的题目
  await questionStore.fetchQuestions(subjectToLoad, true)
}
```

**第3步：数据来源优先级**
1. **本地存储**（IndexedDB）- `fetchQuestions` 会先尝试从本地加载
2. **API 请求** - 如果本地没有数据，再请求服务器

**第4步：初始化渲染状态**
- 标记前3个题目为已渲染（立即显示）
- 重置所有观察器和缓存

---

## 二、分页加载机制

### 2.1 分页参数

```typescript
const INITIAL_DISPLAY_COUNT = 20  // 初始显示20个题目
const LOAD_MORE_COUNT = 20        // 每次加载20个题目
const displayedCount = ref(INITIAL_DISPLAY_COUNT)
```

### 2.2 计算属性链

```
questions (原始数据)
  ↓ filteredQuestions (应用学科过滤)
  ↓ displayList (应用搜索过滤)
  ↓ displayedQuestions (应用分页切片)
  ↓ allRenderItems (应用渐进式渲染)
```

### 2.3 滚动加载更多

**触发条件：**
- 滚动到距离底部 < 100px
- 还有更多题目（`hasMoreQuestions.value === true`）
- 当前没有正在加载（`!loadingMore.value`）

**加载流程：**
```typescript
handleScroll (节流200ms)
  ↓
loadMoreQuestions()
  ↓
displayedCount.value += LOAD_MORE_COUNT (增加20个)
  ↓
标记新加载的题目为已渲染（如果在前3个位置）
```

---

## 三、渐进式渲染策略

### 3.1 渲染规则

```typescript
const PRE_RENDER_COUNT = 3  // 前3个题目立即渲染

const shouldRender = index < PRE_RENDER_COUNT || renderedIndexes.value.has(index)
```

**渲染决策：**
- **前3个题目**：立即渲染，不使用占位符（首屏优化）
- **其他题目**：使用占位符，进入视口时替换为实际内容

### 3.2 占位符机制

**占位符特点：**
- 显示骨架屏动画（shimmer 效果）
- 使用估算高度（`ESTIMATED_PLACEHOLDER_HEIGHT = 207px`）
- 禁用交互（`pointer-events: none`）

**高度缓存策略（优先级）：**
1. 已测量的题目高度（`questionHeights[questionId]`）
2. 当前索引的高度缓存（`indexToHeight[index]`）
3. 旧的高度缓存（`placeholderHeights[index]`）
4. 默认估算高度（207px）

### 3.3 占位符观察器

```typescript
const observer = new IntersectionObserver(
  (entries) => {
    if (entry.isIntersecting) {
      renderedIndexes.value.add(index)  // 标记为已渲染
    }
  },
  {
    root: scrollContainer.value,
    rootMargin: '200px',  // 提前200px开始渲染
    threshold: 0.01       // 只要有一点可见就触发
  }
)
```

**优化点：**
- **提前200px预加载**：用户滚动前就开始渲染，减少等待时间
- **阈值0.01**：元素刚进入视口就触发，响应迅速

---

## 四、MathJax 公式懒加载

### 4.1 渲染策略

```typescript
// 前3个题目：立即渲染
if (questionIndex < 3) {
  MathJaxUtils.renderMath(el, false)
  return
}

// 其他题目：视口懒加载
const observer = new IntersectionObserver(
  (entries) => {
    if (entry.isIntersecting) {
      MathJaxUtils.renderMath(el, false)
    }
  },
  {
    root: scrollContainer.value,
    rootMargin: '100px',  // 提前100px开始渲染
    threshold: 0.1        // 元素10%可见时触发
  }
)
```

**优化点：**
- **前3个立即渲染**：确保首屏公式正常显示
- **提前100px预加载**：公式渲染需要时间，提前开始
- **阈值0.1**：元素10%可见时触发，平衡性能和体验

### 4.2 防重复渲染

```typescript
const renderedQuestions = new Set<string>()

if (!renderedQuestions.has(questionId)) {
  renderedQuestions.add(questionId)
  // 开始渲染...
}
```

---

## 五、动态高度测量

### 5.1 高度缓存机制

```typescript
// 三层高度映射
questionHeights: Map<string, number>  // 题目ID -> 高度
indexToHeight: Map<number, number>    // 索引 -> 高度
placeholderHeights: Map<number, number> // 旧版兼容
```

### 5.2 ResizeObserver 监听

```typescript
const resizeObserver = new ResizeObserver((entries) => {
  const height = entry.target.getBoundingClientRect().height
  
  // 延迟200ms记录，等待MathJax渲染完成
  setTimeout(() => {
    questionHeights.value.set(questionId, height)
    indexToHeight.value.set(index, height)
  }, 200)
})
```

**优化点：**
- **延迟测量**：等待 MathJax 渲染完成后再记录高度
- **立即测量**：对于快速显示的题目，立即尝试测量一次

---

## 六、搜索和过滤触发重新加载

### 6.1 搜索变化（watch searchQuery）

```typescript
watch(searchQuery, () => {
  // 重置渲染状态
  renderedIndexes.value.clear()
  placeholderHeights.value.clear()
  indexToHeight.value.clear()
  
  // 清理观察器
  placeholderObservers.forEach(observer => observer.disconnect())
  placeholderObservers.clear()
  
  // 重新映射高度
  remapIndexHeights()
})
```

**特点：**
- 不重新加载数据（数据已在 `filteredQuestions` 中过滤）
- 只重置渲染状态，让列表重新渲染

### 6.2 学科过滤变化（watch selectedSubjectFilter）

```typescript
watch(selectedSubjectFilter, async (newFilter) => {
  // 重置渲染状态（同上）
  
  // 检查是否需要重新加载数据
  if (!hasTargetSubjectQuestions) {
    await questionStore.fetchQuestions(targetSubject, true)
    questions.value = [...questionStore.questions]
  }
})
```

**特点：**
- 如果当前 Store 中已有目标科目的题目，不重新加载
- 如果没有，才重新加载数据

---

## 七、性能优化总结

### 7.1 多层缓存策略

| 层级 | 缓存内容 | 用途 |
|------|---------|------|
| Store | 题目数据 | 避免重复请求 |
| IndexedDB | 持久化数据 | 离线可用 |
| 内存 | 高度缓存 | 避免重复测量 |
| 内存 | 渲染状态 | 避免重复渲染 |

### 7.2 懒加载策略

| 内容类型 | 策略 | 预加载距离 |
|---------|------|-----------|
| 题目卡片 | 前3个立即，其他视口加载 | 提前200px |
| MathJax公式 | 前3个立即，其他视口加载 | 提前100px |
| 分页数据 | 滚动到底部加载 | 距离底部100px |

### 7.3 节流和防抖

| 操作 | 节流/防抖 | 时间 |
|------|----------|------|
| 滚动事件 | 节流 | 200ms |
| 卡片点击 | 节流 | 快速（ThrottleUtils.fast） |
| 删除操作 | 节流 | 慢速（ThrottleUtils.slow） |
| 窗口大小变化 | 防抖 | 300ms |

---

## 八、加载流程图

```
组件挂载 (onMounted)
  ↓
loadQuestions()
  ↓
检查 Store 缓存
  ├─ 有数据 → 直接使用
  └─ 无数据 → 从本地存储/API 加载
  ↓
初始化渲染状态（前3个标记为已渲染）
  ↓
计算属性链处理数据
  ├─ filteredQuestions (学科过滤)
  ├─ displayList (搜索过滤)
  ├─ displayedQuestions (分页切片)
  └─ allRenderItems (渐进式渲染)
  ↓
渲染列表
  ├─ 前3个：立即渲染
  └─ 其他：占位符 + IntersectionObserver
  ↓
滚动监听
  ├─ 距离底部 < 100px → 加载更多
  └─ 占位符进入视口 → 替换为实际内容
  ↓
MathJax 懒加载
  ├─ 前3个：立即渲染
  └─ 其他：IntersectionObserver (提前100px)
```

---

## 九、关键参数配置

| 参数 | 值 | 说明 |
|------|-----|------|
| `PRE_RENDER_COUNT` | 3 | 立即渲染的题目数量 |
| `INITIAL_DISPLAY_COUNT` | 20 | 初始显示的题目数量 |
| `LOAD_MORE_COUNT` | 20 | 每次加载更多的数量 |
| `ESTIMATED_PLACEHOLDER_HEIGHT` | 207px | 占位符估算高度 |
| 占位符预加载距离 | 200px | 提前200px开始渲染 |
| MathJax 预加载距离 | 100px | 提前100px开始渲染 |
| 滚动加载触发距离 | 100px | 距离底部100px触发 |
| 滚动节流时间 | 200ms | 滚动事件节流间隔 |

---

## 十、优化建议

### 10.1 当前实现的优点

✅ **多层缓存**：Store + IndexedDB + 内存缓存  
✅ **渐进式渲染**：占位符 + 视口懒加载  
✅ **预加载优化**：提前200px/100px开始渲染  
✅ **防重复渲染**：使用 Set 记录已渲染的题目  
✅ **动态高度测量**：ResizeObserver + 延迟测量  
✅ **节流防抖**：减少不必要的计算和渲染  

### 10.2 可能的优化方向

1. **虚拟滚动**：如果题目数量非常大（>1000），考虑使用虚拟滚动
2. **预加载策略**：可以根据滚动速度动态调整预加载距离
3. **缓存策略**：可以增加 LRU 缓存，限制内存使用
4. **批量渲染**：可以批量处理多个占位符的渲染，减少重排

---

## 十一、总结

`QuestionList.vue` 的加载逻辑采用了**数据分页 + 渐进式渲染 + 视口懒加载 + 多层缓存**的综合策略，在保证首屏性能的同时，实现了流畅的滚动体验和高效的资源利用。

**核心设计理念：**
- 🚀 **首屏优先**：前3个题目立即渲染
- 📦 **按需加载**：视口懒加载 + 分页加载
- ⚡ **预加载优化**：提前200px/100px开始渲染
- 💾 **多层缓存**：Store + IndexedDB + 内存
- 🎯 **精准测量**：ResizeObserver + 延迟测量






