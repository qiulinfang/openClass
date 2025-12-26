问题序号：homeworkExercise题目列表显示为习题列表问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`作业作答跳转到作业答题（homeworkExercise/ExerciseSolveView）题目列表`
- **发现日期**：`2025-12-26`
- **解决状态**：`进行中`

## 问题现象
从 `homework-answer` 跳转到 `homework-exercise` 后，左侧题目列表显示成“习题（exercise）场景”的题库题目（aiExercise/题库列表），而不是当前作业的题目列表。

## 复现步骤
1. 步骤1：先进入习题答题页（ExerciseSolveView 的 exercise 场景），左侧加载题库题目。
2. 步骤2：再进入作业作答页 `homework-answer`。
3. 步骤3：点击“学伴辅导/去学伴”，跳转到 `homeworkExercise`（ExerciseSolveView 的 homework 场景）。
4. 步骤4：观察左侧题目列表仍为题库题目（exercise），而非作业题目。

## 用户体验
- 影响点1：用户以为进入作业答题，但看到的是题库题目，严重困惑。
- 影响点2：右侧问答/聊天可能基于错误题目上下文。
- 影响点3：影响作业流程闭环（无法定位到正确的作业题）。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/views/HomeworkAnswerView.vue`：跳转到 `homeworkExercise`，通过 query 传 `scene=homework&questionId=...`。
  - `imates-web/src/router/index.ts`：`homeworkExercise` 路由配置（component=ExerciseSolveView）。
  - `imates-web/src/views/ExerciseSolveView.vue`：通过 `isFromHomework` 决定 `QuestionList` 的 type 与数据源。
  - `imates-web/src/components/QuestionList.vue`：根据 `type` 决定使用 `homeworkStore` 或 `questionStore`。
  - `imates-web/src/views/MainView.vue`：keep-alive include 配置（可能导致组件复用）。
- **涉及模块**：
  - homeworkStore：作业题目来源
  - questionStore：题库题目来源

## 技术原因 (❌)
1. `ExerciseSolveView` 在主框架 `MainView` 内被 `keep-alive` 缓存时，可能复用上一轮“exercise 场景”渲染的子组件状态。
2. 即便 `ExerciseSolveView` 的 `isFromHomework` 判定正确，`QuestionList` 组件内部如果未对 `type` 变化做完整重载（或内部缓存了题目列表），也可能继续显示上一次的题库题目。
3. 作业场景下 `ExerciseSolveView` 不会主动拉题，只依赖 `homeworkStore.questions`；如果 store 为空或未按当前作业写入，也会导致 UI fallback（具体取决于 QuestionList 内部实现）。

可能的错误表现代码（节选）：
```vue
<!-- ❌ 当 keep-alive 复用 + 子组件未 watch type 时，type 切换不生效 -->
<QuestionList :type="isFromHomework ? 'homework' : 'exercise'" />
```

## 正确实现方案 (✅)
1. 确保在场景切换时，题目列表组件能“强制重载”，避免复用旧状态：
   - 方案A：给 `QuestionList` 增加 `:key="isFromHomework ? 'homework' : 'exercise'"`，让 Vue 直接销毁重建。
   - 方案B：在 `QuestionList` 内部 `watch(() => props.type, ...)`，当 type 变化时重新绑定数据源并刷新列表。
2. 进入 `homeworkExercise` 时校验 `homeworkStore.questions` 非空；若为空应提示并引导回退或重新加载作业。
3. 进入页面后按 `questionId` 强制同步 `homeworkStore.currentQuestionIndex`（避免仅滚动选中但 store 未对齐）。

推荐修复代码（节选）：
```vue
<!-- ✅ 强制重建，规避 keep-alive/内部缓存问题 -->
<QuestionList
  :key="isFromHomework ? 'homework' : 'exercise'"
  :type="isFromHomework ? 'homework' : 'exercise'"
/>
```

## 关键代码/公式
- 代码片段1：`HomeworkAnswerView.vue`
```ts
router.push({ name: 'homeworkExercise', query: { scene: 'homework', questionId } })
```
- 代码片段2：`ExerciseSolveView.vue`
```ts
const isFromHomework = computed(() => scene === 'homework' || route.name === 'homeworkExercise')
```

## 测试验证
- **测试场景**：
  - 场景1：先进入 exercise 场景 -> 再从 homework-answer 跳 homeworkExercise；预期 homeworkExercise 左侧为作业题目。
  - 场景2：直接从 MyHomeworkView -> homeworkAnswer -> homeworkExercise；预期题目一致且能定位到传入 questionId。
- **验证方法**：
  - 方法1：在 homeworkExercise 进入时打印 `isFromHomework`、`homeworkStore.questions.length`。
  - 方法2：观察 `QuestionList` 在 type 切换时是否重新渲染/重新加载。

## 预防措施
- 措施1：在可复用页面（ExerciseSolveView）明确“场景切换”的生命周期策略（重建/重载）。
- 措施2：对依赖 store 注入数据的路由（homeworkExercise）增加必要的前置校验（store 为空时友好提示）。

## 相关链接/参考
- 相关文档：`imates-web/src/views/ExerciseSolveView.vue`

## 可复用经验
- 经验1：keep-alive 缓存的页面，如果内部有“多场景”切换，必须有可靠的重置机制（key 或 watch）。
- 经验2：路由 query 只负责“定位”，数据源仍依赖 store 时，要对 store 进行完整性校验。
