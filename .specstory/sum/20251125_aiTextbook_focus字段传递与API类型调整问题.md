问题序号：aiTextbook_focus字段传递与API类型调整问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`AI 教材聊天接口发送参数`
- **发现日期**：`2025-11-25`
- **解决状态**：`已解决`

## 问题现象
- 新需求：在 ChatInput 中引用消息后，发送给后端的请求体需要增加 `focus` 字段，其值为被引用消息的内容（纯文本）。
- 初次实现后：
  - 在 `ChatView.sendMessage` 中通过 `SendMessageOptions` 传递 `focus`；
  - AiTextbookStrategy 调用 `aiTextbookStore.sendMessage` 时多传了一个参数；
  - aiTextbookStore 内部通过 `buildAiTextbookMessage` 构造 `AiChatMessageRequest`。
- TypeScript 报错：
  - `SendMessageOptions` 中不存在 `focus`；
  - `AiChatMessageRequest` 类型中也没有 `focus`；
  - AiTextbookStrategy 调用 `sendMessage` 时参数个数不匹配。

## 复现步骤
1. 在 ChatView 中实现 `quotedMessage` 和引用区域显示。
2. 在 `sendMessage` 调用策略时尝试加入：

```ts
await chatStrategy.value?.sendMessage(messageContent, {
  selectedModel: selectedModel.value,
  currentQuestion: currentQuestion.value ?? undefined,
  focus: focusContent,
})
```

3. 修改 AiTextbookStrategy 和 aiTextbookChatStore，让 `focus` 最终进入 API 请求。
4. 编译或运行项目，观察 TS 报错和类型不匹配问题。

## 用户体验
- **影响点1**：如果 `focus` 没有正确传递，后端无法获知引用上下文，AI 回答质量可能下降。
- **影响点2**：类型错误阻塞构建，功能无法上线。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/ChatView.vue`：调用策略的 `sendMessage`，组装 `SendMessageOptions`。
  - `imates-web/src/components/chat/strategies/types.ts`：`SendMessageOptions` 类型定义。
  - `imates-web/src/components/chat/strategies/AiTextbookStrategy.ts`：场景策略，转调 store 的 `sendMessage`。
  - `imates-web/src/stores/aiTextbookChatStore.ts`：构造 `AiChatMessageRequest` 并调用 `apiService.sendChatMessage`。
  - `imates-web/src/types/api.ts`：`AiChatMessageRequest` 类型定义。
- **涉及模块**：
  - Pinia store：`useAiTextbookChatStore`。
  - API service：`apiService.sendChatMessage`。

## 技术原因 (❌)
1. **SendMessageOptions 中缺少 focus 字段**

```ts
// ❌ 原始 SendMessageOptions 定义
export interface SendMessageOptions {
  selectedModel?: string
  imageData?: ChatImageData
  skipUserMessage?: boolean
  question?: unknown
  currentQuestion?: unknown
  currentQuestionId?: string
}
```

2. **AiTextbookStrategy.sendMessage 直接把所有参数透传给 store，但 store 的签名没有 focus**

```ts
// ❌ 初版 AiTextbookStrategy
async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
  await this.aiTextbookStore.sendMessage(
    content,
    options.selectedModel,
    options.imageData,
    hidePrefix,
  )
}
```

3. **AiChatMessageRequest 类型没有 focus 字段，且 explanation 为必填**

```ts
// ❌ 原始 AiChatMessageRequest
export interface AiChatMessageRequest {
  sessionId: string
  newValue: string
  coversation: string
  question: string
  answer: string
  name: string
  reason: string
  dstUrl?: string
  bmNo: string
  isWebSearch: string
  chatRole: string
  subject: string
  explanation: string
}
```

4. **aiTextbookChatStore.buildAiTextbookMessage 返回的对象中没有 explanation / focus**
- TS 报错：缺少 explanation，不能多出 focus。

## 正确实现方案 (✅)
1. **在 SendMessageOptions 中添加 focus 字段**

```ts
// ✅ strategies/types.ts
export interface SendMessageOptions {
  selectedModel?: string
  imageData?: ChatImageData
  skipUserMessage?: boolean
  question?: unknown
  currentQuestion?: unknown
  currentQuestionId?: string
  // 新增：引用内容
  focus?: string
}
```

2. **在 ChatView.sendMessage 中传入 focus**

```ts
// ✅ ChatView.vue（局部）
const focusContent = quotedMessage.value?.content || undefined
await chatStrategy.value?.sendMessage(messageContent, {
  selectedModel: selectedModel.value,
  currentQuestion: currentQuestion.value ?? undefined,
  focus: focusContent,
})
// 发送成功后清空引用
quotedMessage.value = null
```

3. **扩展 aiTextbookChatStore.sendMessage 签名，接收 focus 参数**

```ts
// ✅ aiTextbookChatStore.ts
const sendMessage = async (
  content: string,
  selectedModel?: string,
  imageData?: ChatImageData,
  hidePrefix: boolean = false,
  skipUserMessage?: boolean,
  focus?: string,
): Promise<void> => {
  // ...
  const aiMessage = buildAiTextbookMessage({
    sessionId: currentSessionId.value,
    content,
    userInfo: userInfo,
    enableWebSearch: enableWebSearch.value,
    chatRole: selectedModel || 'mate',
    imageData: builderImageData,
    useScreenshotApi: shouldUseScreenshotApi,
    isNewSession: isNewSession.value,
    focus, // 传递引用内容
  })
  // ...
}
```

4. **在 BuildTextbookMessageParams 和 buildAiTextbookMessage 中添加 focus**

```ts
// ✅ aiTextbookChatStore.ts
interface BuildTextbookMessageParams {
  sessionId: string
  content: string
  userInfo: UserInfo | null
  enableWebSearch: boolean
  chatRole?: string
  imageData?: TextbookChatImageData
  useScreenshotApi?: boolean
  isNewSession?: boolean
  focus?: string
}

const buildAiTextbookMessage = ({
  sessionId,
  content,
  userInfo,
  enableWebSearch,
  chatRole = 'mate',
  imageData,
  useScreenshotApi = false,
  isNewSession = true,
  focus,
}: BuildTextbookMessageParams): AiChatMessageRequest => {
  // 图片消息
  if (imageData?.base64DataUrl) {
    return {
      sessionId,
      newValue: isNewSession ? '1' : '0',
      coversation: content,
      question: questionDataUrl,
      answer: '',
      name: userId,
      reason: 'start',
      bmNo: sessionId,
      isWebSearch: enableWebSearch ? '1' : '0',
      chatRole,
      subject: '',
      dstUrl: '/permission/previewPictureQA',
      focus,
    }
  }

  // 纯文本
  const dstUrl = useScreenshotApi ? '/permission/previewPictureQA' : '/permission/chats'
  return {
    sessionId,
    newValue: isNewSession ? '1' : '0',
    coversation: content,
    question: '',
    answer: '',
    name: userId,
    reason: 'start',
    bmNo: sessionId,
    isWebSearch: enableWebSearch ? '1' : '0',
    chatRole,
    subject: '',
    dstUrl,
    focus,
  }
}
```

5. **调整 AiChatMessageRequest 类型，允许 explanation 可选并添加 focus 字段**

```ts
// ✅ types/api.ts
export interface AiChatMessageRequest {
  sessionId: string
  newValue: string
  coversation: string
  question: string
  answer: string
  name: string
  reason: string
  dstUrl?: string
  bmNo: string
  isWebSearch: string
  chatRole: string
  subject: string
  explanation?: string
  focus?: string
}
```

6. **更新 AiTextbookStrategy.sendMessage 调用签名**

```ts
// ✅ AiTextbookStrategy.ts
async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
  const hidePrefix = content.includes('我们开始吧')
  await this.aiTextbookStore.sendMessage(
    content,
    options.selectedModel,
    options.imageData,
    hidePrefix,
    undefined,
    options.focus, // 传递引用内容
  )
}
```

## 关键代码/公式
- **focus 传递链**：
  - ChatInput：引用消息 → `quotedMessage` → 发送时取 `quotedMessage.value.content`；
  - ChatView：`sendMessage(messageContent, { focus })`；
  - AiTextbookStrategy：`sendMessage(content, options)` → `aiTextbookStore.sendMessage(..., options.focus)`；
  - aiTextbookChatStore：`buildAiTextbookMessage({ focus })`；
  - API 请求：`AiChatMessageRequest.focus`。

## 测试验证
- **测试场景1：引用文本消息并发送**
  - 步骤：
    1. 长按一条文本消息 → 选择“引用”；
    2. 在 ChatInput 输入新问题并发送；
    3. 在浏览器 DevTools 的 Network 面板查看请求体。
  - 预期：
    - 请求 JSON 中包含 `focus: '被引用消息的内容'`；
    - 其他字段（sessionId、coversation、question 等）与原行为一致。

- **测试场景2：引用图片+文字混合消息**
  - 发送截图问题并获得回答，再引用相关文本消息进行追问。
  - 预期：
    - 如有需要，focus 中只包含文本部分（当前实现中 focus 直接使用 message.content）。

- **验证方法**：
  - 查看后台日志或拦截请求，确认 focus 字段值与引用消息一致；
  - 确认类型系统无错误，构建通过。

## 预防措施
- **措施1**：在为 API 扩展字段时，统一维护：请求类型定义、构造函数、策略调用处、store 签名四个层次，避免只改一层。
- **措施2**：为重要请求体结构编写单元测试或集成测试，校验字段完整性和默认值。
- **措施3**：在请求类型中，非所有场景必需的字段应设为可选，以降低耦合和改动成本。

## 相关链接/参考
- 项目内已有的 `AiChatMessageRequest` 使用场景。

## 可复用经验
- 当需要在多层结构中传递新字段时，优先画出 **数据流**，然后按链路逐层实现：调用方 → 策略层 → store 层 → API 层。
- TS 类型应与真实请求结构同步维护，否则编译期与运行期容易不一致。
- 对于“引用/上下文”类字段，用统一的命名（如 focus/context/reference）可以方便后续功能扩展和排查。
