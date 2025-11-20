问题序号：ChatView解耦questionStore导致拍照搜题无题目提示问题

## 问题元信息
- **问题分类**：`[前端]`
- **严重程度**：`[中]`
- **影响范围**：`[拍照搜题页面中的AI题目聊天功能]`
- **发现日期**：`2025-11-19`
- **解决状态**：`[已解决]`

## 问题现象
拍照搜题（PhotoSearchView）中，图片识别出题目后打开聊天抽屉，用户输入内容并发送时，ChatView 返回提示“请先选择一道题”，无法正常围绕识别出的题目进行 AI 聊天。

## 复现步骤
1. 打开拍照搜题页面 PhotoSearchView。
2. 选择学科，拍照并框选题目区域。
3. 点击搜索/识别，等待识别结果，并在抽屉中看到识别出的题目内容。
4. 在 Chat 区域输入问题并发送。
5. 观察系统返回的提示：“请先选择一道题”。

## 用户体验
- 影响点1：用户已经看到识别出的题目，却被提示“请先选择一道题”，造成困惑。
- 影响点2：拍照搜题的核心功能（针对识别题目进行 AI 讲解）无法顺畅使用。
- 影响点3：用户需要额外操作（去练习列表选题）才能聊天，损害效率。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/ChatView.vue`：通用聊天组件，负责当前题目判断和发送逻辑。
  - `imates-web/src/views/PhotoSearchView.vue`：拍照搜题页面，负责图片识别和本地题目管理。
  - `imates-web/src/components/chat/strategies/AiExerciseStrategy.ts`：AI题目对话策略，实现基于题目的发消息逻辑。
  - `imates-web/src/components/chat/strategies/types.ts`：策略相关类型定义，包括 SendMessageOptions、InitializeOptions 等。
- **涉及模块**：
  - ChatView 组件模块：统一处理 AI / 教师多种聊天类型。
  - AI 题目对话策略模块：`AiExerciseStrategy`。
  - 拍照搜题业务模块：PhotoSearchView 中的图片识别与抽屉聊天。

## 技术原因 (❌)
1. ChatView 组件原本依赖 `questionStore.currentQuestion` 作为“当前题目”来源：
   - `currentQuestion` 计算属性直接读取 questionStore。
   - `hasSelectedQuestion` 用于决定是否允许发送题目相关消息。
2. 拍照搜题页面 `handleSearch` 识别题目后，并没有（也不应）将识别结果写入 questionStore：
   - 识别出的题目只保存在本地变量 `photoQuestionData` / `keywordQuestionData`。
   - questionStore 仍然认为“当前没有选中题目”。
3. AiExerciseStrategy.sendMessage 内部再次依赖 questionStore：
   ```typescript
   async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
     if (!this.questionStore.currentQuestion) {
       throw new Error('请先选择题目')
     }
     await this.aiExerciseStore.sendMessage(
       content,
       this.questionStore.currentQuestion,
       getUserInfo(),
       getSubject(),
       ...
     )
   }
   ```
   - 即使 ChatView 允许发送，一旦策略里发现 `currentQuestion` 为空，仍会抛出“请先选择题目”的错误。
4. 解耦 ChatView 与 questionStore 时，最初只做了部分修改：
   - 增加了 `overrideQuestion`/`question` prop，但依然在某些逻辑中兼容性回退到 questionStore。
   - AiExerciseStrategy 仍然通过 `this.questionStore.currentQuestion` 获取题目，没有从 options 中接题目对象。

## 正确实现方案 (✅)
1. ChatView 完全通过 props 管理当前题目：
   - 定义 `question?: unknown` prop，取消对 questionStore 的直接访问。
   - 统一 `currentQuestion` 计算属性：
     ```typescript
     const currentQuestion = computed(() => {
       return (props.question || null) as any
     })
     const hasSelectedQuestion = computed(() => currentQuestion.value !== null)
     ```
2. 各业务页面负责维护并传入当前题目对象：
   - 拍照搜题 PhotoSearchView：
     ```vue
     <ChatView
       type="ai-exercise"
       input-mode="simple"
       :compressed-height="97"
       :question="currentQuestionData"
       @response="handleChatResponse"
     />
     ```
     ```typescript
     const currentQuestionData = computed(() => {
       if (activeTab.value === 'photo') return photoQuestionData.value
       if (activeTab.value === 'keyword') return keywordQuestionData.value
       return null
     })
     ```
   - 练习页 ExerciseSolveView：
     ```vue
     <ChatView
       v-if="currentFunction === 'chatAi'"
       type="ai-exercise"
       :compressed-height="327"
       :question="currentQuestion"
     />
     ```
3. AiExerciseStrategy 从 SendMessageOptions 里获取当前题目：
   - 在 `types.ts` 中扩展选项类型：
     ```typescript
     export interface SendMessageOptions {
       selectedModel?: string
       imageData?: ChatImageData
       skipUserMessage?: boolean
       question?: unknown
     }
     ```
   - 修改发送逻辑：
     ```typescript
     async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
       const currentQuestion = options.question as unknown | undefined
       if (!currentQuestion) {
         throw new Error('请先选择题目')
       }
       const hidePrefix = content.includes('我们开始吧')
       await this.aiExerciseStore.sendMessage(
         content,
         currentQuestion as any,
         getUserInfo(),
         getSubject(),
         options.selectedModel || 'mate',
         options.imageData,
         hidePrefix,
       )
     }
     ```
4. 初始化与历史加载统一使用题目的 bmNo 作为 key：
   - ChatView 中构造 InitializeOptions：
     ```typescript
     const initializeOptions = {
       currentSubject: currentSubject.value as 'biology' | 'math',
       currentQuestionId: currentQuestion.value?.bmNo, // 统一使用 bmNo
       currentQuestionTitle: currentQuestion.value?.question || currentQuestion.value?.title,
       resourceId: props.resourceId,
       hasSelectedQuestion: hasSelectedQuestion.value,
     }
     ```
   - AiExerciseStrategy.initialize 中使用 `options.currentQuestionId` 调用 `loadChatHistory`。

## 关键代码/公式
- **ChatView 当前题目计算与发送**：
  ```typescript
  const currentQuestion = computed(() => {
    return (props.question || null) as any
  })

  await chatStrategy.value?.sendMessage(messageContent, {
    selectedModel: selectedModel.value,
    question: currentQuestion.value ?? undefined,
  })
  ```

- **PhotoSearchView 中题目来源与 ChatView 绑定**：
  ```typescript
  const currentQuestionData = computed(() => {
    if (activeTab.value === 'photo') return photoQuestionData.value
    if (activeTab.value === 'keyword') return keywordQuestionData.value
    return null
  })
  ```
  ```vue
  <ChatView
    type="ai-exercise"
    input-mode="simple"
    :compressed-height="97"
    :question="currentQuestionData"
  />
  ```

- **AiExerciseStrategy 发送消息逻辑**：
  ```typescript
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const currentQuestion = options.question as unknown | undefined
    if (!currentQuestion) {
      throw new Error('请先选择题目')
    }
    const hidePrefix = content.includes('我们开始吧')
    await this.aiExerciseStore.sendMessage(
      content,
      currentQuestion as any,
      getUserInfo(),
      getSubject(),
      options.selectedModel || 'mate',
      options.imageData,
      hidePrefix,
    )
  }
  ```

## 测试验证
- **测试场景**：
  - 场景1：拍照识别成功后立即聊天
    - 步骤：拍照 → 识别题目 → 在抽屉中直接发送消息。
    - 预期：不再出现“请先选择一道题”，AI 能基于识别题目正常回复。
  - 场景2：关键词搜索题目后聊天
    - 步骤：输入关键词 → 搜索题目 → 在抽屉中发送消息。
    - 预期：与拍照场景一致，使用关键词结果作为当前题进行聊天。
  - 场景3：更换 tab 切换不同识别结果
    - 步骤：先拍照识别并聊天，再切换到关键词 tab 搜出另一题聊天。
    - 预期：不同题目有各自独立的聊天记录，切回时能看到对应历史。
- **验证方法**：
  - 方法1：通过浏览器开发者工具或日志，确认 AiExerciseStrategy.sendMessage 收到的 question 参数非空且内容正确。
  - 方法2：检查聊天历史存储（IndexedDB 或本地存储）中是否按 bmNo 作为 key 保存和加载记录。

## 预防措施
- 措施1：所有 ChatView 与业务 store 的耦合都通过 props/事件解耦，避免组件内部直接访问全局 store。
- 措施2：策略接口统一通过 options 传入上下文（题目、资源、会话信息），不在策略内部直接获取全局状态。
- 措施3：在新增聊天场景时，先设计好“上下文传递链路”（页面 → ChatView → 策略 → store），再落地实现。

## 相关链接/参考
- 相关文档：`imates-web/src/views/PhotoSearchView.vue` 中拍照搜题业务逻辑说明。
- 参考资源：团队内部关于组件解耦与状态管理的设计规范（如有）。

## 可复用经验
- 经验1：聊天组件应通过 props 接收上下文（题目/资源/会话），而不是直接绑定业务 store，提升复用性和可测试性。
- 经验2：策略模式下，所有上下文信息都应通过方法参数或 options 显式传入，避免隐藏依赖。
- 经验3：统一使用业务稳定标识（如 bmNo）作为跨页面、跨模块的会话 key，可以保证聊天记录等数据在不同入口之间一致。
