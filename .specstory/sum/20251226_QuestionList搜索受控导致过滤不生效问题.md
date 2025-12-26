问题序号：QuestionList搜索受控导致过滤不生效问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`作业作答页/习题列表页等使用 QuestionList 的页面（搜索过滤功能）`
- **发现日期**：`2025-12-16`
- **解决状态**：`已解决`

## 问题现象
在页面中使用 `QuestionList` 组件时，搜索输入框存在，但输入关键词后题目列表不发生过滤变化（看起来“搜索没有实现/不生效”）。

## 复现步骤
1. 打开包含 `QuestionList` 的页面（例如作业作答页 `HomeworkAnswerView`）。
2. 在 `QuestionList` 顶部搜索框输入任意关键词。
3. 观察题目列表：没有根据关键词过滤，空态文案可能也不随关键词变化。

## 用户体验
- 搜索框存在但不生效，用户会认为功能缺失或页面异常
- 题目较多时无法快速定位目标题目，效率降低

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/QuestionList.vue`：搜索框使用受控输入（值来自 `props.searchQuery`）
  - `imates-web/src/views/HomeworkAnswerView.vue`：使用 `QuestionList` 的页面之一，需要将搜索状态回传
- **涉及模块**：
  - 题目列表组件（QuestionList）
  - 搜索过滤（前端计算属性过滤）

## 技术原因 (❌)
1. **搜索输入为受控模式但父组件未回传**：
   - `QuestionList` 内部 `q-input` 的 `model-value` 绑定到 `computed(() => props.searchQuery || '')`。
   - 输入变化时仅触发 `emit('update:searchQuery', value)`。
   - 若父组件未绑定 `:search-query` 并监听 `@update:searchQuery`，则 `props.searchQuery` 永远不变，导致过滤计算属性依赖值不更新。
2. **部分页面只“使用了组件内部搜索框”，但仍走受控读取**：
   - 父组件未传 `searchQuery` 时，组件仍从 `props.searchQuery` 读取，等价于永远读取空字符串。

错误示例（示意）：
```vue
<!-- ❌ 父组件未接回 update:searchQuery，导致 props.searchQuery 不变 -->
<QuestionList type="homework" :external-questions="externalQuestions" />
```

## 正确实现方案 (✅)
1. **父组件使用受控绑定（推荐，便于跨组件共享状态/保留搜索词）**：
   - 在父组件中维护 `questionSearchQuery`。
   - 显式传入 `:search-query` 并监听 `@update:searchQuery`。
2. **组件兼容非受控模式（便于只用内部搜索框）**：
   - 当 `props.searchQuery === undefined` 时，使用组件内部 `internalSearchQuery` 作为搜索源。

正确示例（父组件受控）：
```vue
<QuestionList
  :search-query="questionSearchQuery"
  @update:searchQuery="(v) => (questionSearchQuery = v)"
  :external-questions="externalQuestions"
  type="homework"
/>
```

正确示例（组件内部兼容非受控）：
```ts
const internalSearchQuery = ref('')
const searchQuery = computed(() => {
  return props.searchQuery !== undefined ? (props.searchQuery || '') : internalSearchQuery.value
})

const handleSearchInput = (value: string | number | null) => {
  const next = (value || '').toString()
  if (props.searchQuery !== undefined) emit('update:searchQuery', next)
  else internalSearchQuery.value = next
}
```

## 关键代码/公式
- `QuestionList.vue`：`searchQuery` 计算来源 + `handleSearchInput` 的受控/非受控分支
- `HomeworkAnswerView.vue`：`:search-query` + `@update:searchQuery` 回传

## 测试验证
- **测试场景**：
  - 场景1：在 `HomeworkAnswerView` 输入关键词，列表按 `title/question` 过滤。
  - 场景2：清空关键词，列表恢复。
  - 场景3：某页面不传 `searchQuery`，仅使用内部搜索框，过滤仍生效。
- **验证方法**：
  - 方法1：手动操作 UI 检查过滤与空态文案。
  - 方法2：对 `filteredQuestions` 增加最小单测（输入不同 `searchQuery`，断言输出长度）。

## 预防措施
- 在组件设计上明确“受控/非受控”模式，并在 props 注释中写清楚。
- 给 `QuestionList` 增加 demo/用例页，确保搜索功能回归。

## 相关链接/参考
- 相关文件：`imates-web/src/components/QuestionList.vue`

## 可复用经验
- 组件若使用受控输入（props 驱动），必须保证调用方完成状态回传，否则表现为“输入失效”。
- 对可复用组件建议提供非受控兜底，减少集成成本。
