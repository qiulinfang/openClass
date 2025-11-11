# 问题序号：QuestionList批量渲染加载逻辑改造

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`题目列表加载和渲染性能`
- **发现日期**：`2025-01-11`
- **解决状态**：`已解决`

## 问题现象
用户要求将 QuestionList 组件的加载逻辑从占位符+视口懒加载改为批量加载20个题目，全部渲染完成后再显示，否则处于加载状态。

## 复现步骤
1. 步骤1：打开题目列表页面
2. 步骤2：观察题目加载过程
3. 步骤3：发现使用占位符+视口懒加载的方式，题目逐个进入视口时才渲染

## 用户体验
- 用户希望看到完整的题目列表一次性显示，而不是逐个加载
- 占位符可能造成视觉上的闪烁和不连贯
- 批量渲染可以提供更好的用户体验

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/QuestionList.vue`：题目列表组件
- **涉及模块**：
  - 渐进式渲染模块：占位符机制
  - 视口懒加载模块：IntersectionObserver
  - MathJax 渲染模块：公式渲染

## 技术原因 (❌)
1. 原因1：使用了占位符机制，题目进入视口时才替换为实际内容
2. 原因2：使用了渐进式渲染，前3个题目立即渲染，其他使用占位符
3. 原因3：MathJax 公式也使用了视口懒加载，提前100px开始渲染

```typescript
// ❌ 旧的占位符机制
const allRenderItems = computed(() => {
  const shouldRender = index < PRE_RENDER_COUNT || renderedIndexes.value.has(index)
  items.push({
    isPlaceholder: !shouldRender,
    question: shouldRender ? question : undefined,
  })
})

// ❌ 占位符观察器
const observePlaceholderRef = (el: HTMLElement | null, index: number) => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entry.isIntersecting) {
        renderedIndexes.value.add(index)
      }
    },
    { rootMargin: '200px' }
  )
}
```

## 正确实现方案 (✅)
1. 方案1：移除占位符机制，直接渲染所有题目
2. 方案2：添加批量渲染完成检测机制，等待20个题目全部渲染完成
3. 方案3：使用 `renderingQuestions` 状态控制加载提示显示

```typescript
// ✅ 批量渲染相关状态
const renderingQuestions = ref(false) // 是否正在渲染题目
const renderedQuestionIds = ref(new Set<string>()) // 已渲染完成的题目ID集合

// ✅ 检查当前批次的所有题目是否都已渲染完成
const checkBatchRenderComplete = async (maxRetries = 100) => {
  const currentBatch = displayedQuestions.value.slice(0, displayedCount.value)
  const allRendered = currentBatch.every((question) => 
    renderedQuestionIds.value.has(question.id)
  )
  
  if (allRendered || maxRetries <= 0) {
    renderingQuestions.value = false
  } else {
    await new Promise((resolve) => setTimeout(resolve, 100))
    await checkBatchRenderComplete(maxRetries - 1)
  }
}

// ✅ 设置内容引用，渲染MathJax并标记为已渲染完成
const setContentRef = async (el: HTMLElement | null, questionId: string) => {
  if (el) {
    contentRefs.value.set(questionId, el)
    
    if (!renderedQuestions.has(questionId)) {
      renderedQuestions.add(questionId)
      
      // 渲染MathJax
      await MathJaxUtils.renderMath(el, false)
      
      // 标记为已渲染完成
      renderedQuestionIds.value.add(questionId)
      
      // 检查当前批次是否全部渲染完成
      await checkBatchRenderComplete()
    }
  }
}
```

```vue
<!-- ✅ 模板中使用渲染状态控制显示 -->
<!-- 加载状态 -->
<div v-if="renderingQuestions && displayedQuestions.length > 0" class="rendering-container">
  <q-spinner color="primary" size="32px" />
  <span class="rendering-text">正在渲染题目...</span>
</div>

<!-- 题目列表 -->
<div v-if="displayedQuestions.length > 0 && !renderingQuestions" class="question-cards-list">
  <div v-for="(question, index) in displayedQuestions" :key="question.id">
    <!-- 题目内容 -->
  </div>
</div>
```

## 关键代码/公式
- **批量渲染完成检测**：使用 `every()` 方法检查所有题目是否都已渲染完成
- **渲染状态管理**：使用 `renderedQuestionIds` Set 跟踪已渲染完成的题目
- **异步等待机制**：使用递归调用和 `setTimeout` 实现轮询检查

```typescript
// 关键逻辑：检查所有题目是否都已渲染
const allRendered = currentBatch.every((question) => 
  renderedQuestionIds.value.has(question.id)
)
```

## 测试验证
- **测试场景**：
  - 场景1：初始加载20个题目，验证所有题目渲染完成后才显示列表
  - 场景2：滚动加载更多，验证新加载的20个题目渲染完成后才显示
  - 场景3：切换科目，验证新科目的题目从1开始编号
- **验证方法**：
  - 方法1：观察加载提示是否在渲染期间显示
  - 方法2：检查控制台日志，确认渲染完成时机
  - 方法3：验证题目序号是否正确

## 预防措施
- 措施1：统一使用批量渲染机制，避免混合使用占位符和实际内容
- 措施2：确保渲染状态管理的一致性，使用单一状态变量控制显示
- 措施3：添加超时机制（maxRetries），避免无限等待

## 相关链接/参考
- 相关文档：`imates-web/docs-prd/QuestionList加载逻辑分析.md`

## 可复用经验
- 经验1：批量渲染可以提供更好的用户体验，避免逐个加载造成的视觉闪烁
- 经验2：使用 Set 数据结构跟踪已完成的渲染任务，性能更好
- 经验3：异步渲染完成检测应该添加超时机制，避免无限等待
- 经验4：渲染状态应该统一管理，避免多个状态变量造成混乱

