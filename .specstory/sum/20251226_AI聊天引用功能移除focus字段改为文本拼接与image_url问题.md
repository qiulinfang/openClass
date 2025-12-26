问题序号：AI聊天引用功能移除focus字段改为文本拼接与image_url问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`AI聊天引用(quote)功能；通用/题目/教材三类聊天发送链路`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
- 用户在聊天中点击“引用/quote”某条历史消息后发送新消息，前端会在请求体里携带 `focus` 字段。
- 后端期望的实际行为是：
  - 文本引用：把被引用文本拼接到本次发送的消息文本中（以换行分隔），不需要 `focus`。
  - 图片引用：把图片内容写入请求体的 `image_url` 字段（或后端约定字段）。

## 复现步骤
1. 在 AI 聊天页面选择任意一条历史消息点击“引用”。
2. 输入新消息并发送。
3. 观察前端请求 payload。
4. 旧行为：payload 中存在 `focus` 字段。

## 用户体验
- 引用行为与后端协议不一致，可能导致：
  - 后端无法正确理解“引用内容”与“用户新输入”的拼接语义。
  - 引用图片时后端拿不到图片内容（`focus` 对图片无意义）。
  - 不同聊天场景（通用/题目/教材）表现不一致。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/types/api.ts`：`AiChatMessageRequest` 类型（移除 `focus`，新增 `image_url`）。
  - `imates-web/src/components/chat/strategies/types.ts`：策略层 `SendMessageOptions`（删除 `focus`，新增 `imageUrl`）。
  - `imates-web/src/components/ChatView.vue`：发送入口（文本引用拼接；图片引用提取 base64 并透传）。
  - `imates-web/src/components/chat/strategies/AiGeneralStrategy.ts`：策略层透传 `imageUrl`。
  - `imates-web/src/components/chat/strategies/AiTextbookStrategy.ts`：策略层透传 `imageUrl`。
  - `imates-web/src/components/chat/strategies/AiExerciseStrategy.ts`：策略层透传 `imageUrl`。
  - `imates-web/src/stores/aiGeneralChatStore.ts`：请求构建/发送（写入 `image_url`，移除 `focus` 参数链路）。
  - `imates-web/src/stores/aiTextbookChatStore.ts`：请求构建/发送（写入 `image_url`，移除 `focus` 参数链路）。
  - `imates-web/src/stores/aiExerciseChatStore.ts`：请求构建/发送（写入 `image_url`，移除 `focus` 参数链路）。
- **涉及模块**：
  - `ChatView -> ChatStrategy -> Pinia Store -> ApiService.sendChatMessage` 发送链路

## 技术原因 (❌)
1. **前后端协议理解不一致**：前端用 `focus` 表达引用，但后端期望“文本拼接”/“image_url”两种行为。
2. **引用类型混用**：UI 引用展示（`quotedMessage`）与后端引用协议（`focus`）被耦合在一起，导致发送 payload 难以演进。

错误示例（旧逻辑，示意）：
```typescript
// ❌ 旧：构造 focus 发给后端
const focus = quotedMessageInfo ? [quotedMessageInfo] : undefined
await chatStrategy.sendMessage(messageContent, { focus })
```

## 正确实现方案 (✅)
1. **文本引用**：在发送前直接拼接到 `messageContent/coversation`：
   - `finalMessage = quotedText + "\n" + userText`
2. **图片引用**：在发送 options 中传 `imageUrl`，由 store 写入请求体 `image_url`。
3. **UI 与 API 解耦**：
   - `quotedMessage` 只用于气泡展示
   - 请求 payload 不再包含 `focus`

正确示例（新逻辑，示意）：
```typescript
// ✅ 新：文本引用拼接；图片引用写 image_url
let imageUrlForApi: string | undefined
let finalMessageContent = messageContent

if (quotedMessage) {
  if (isImageQuote(quotedMessage)) {
    imageUrlForApi = quotedMessage.imageData?.base64DataUrl
  } else {
    finalMessageContent = `${quotedMessage.content}\n${messageContent}`
  }
}

await chatStrategy.sendMessage(finalMessageContent, {
  quotedMessage: quotedMessageForUi,
  imageUrl: imageUrlForApi,
})
```

## 关键代码/公式
- 文本引用拼接：
```text
finalMessage = quotedText + "\n" + userInput
```

- 请求体关键字段：
```typescript
interface AiChatMessageRequest {
  coversation: string
  image_url?: string
}
```

## 测试验证
- **测试场景**：
  - 场景1：引用文本消息并发送
    - 预期：请求体不包含 `focus`；`coversation` 包含“引用文本 + 换行 + 新文本”。
  - 场景2：引用用户图片消息并发送
    - 预期：请求体 `image_url` 有值；不包含 `focus`。
  - 场景3：通用/教材/题目三种聊天场景分别验证
    - 预期：行为一致。
- **验证方法**：
  - 通过 DevTools/日志抓包对比请求 payload。
  - 运行 TypeScript 类型检查确保无 `focus` 调用链残留。

## 预防措施
- 明确“UI 引用展示字段”与“后端协议字段”的边界，避免耦合。
- 为聊天发送 payload 建立单测/契约测试（至少覆盖：纯文本、截图、多图、引用文本、引用图片）。
- 后端接口字段变更时同步更新 `AiChatMessageRequest` 并全局搜索旧字段。

## 相关链接/参考
- 相关文档：`imates-web/src/types/api.ts`、`imates-web/src/components/ChatView.vue`
- 相关Issue：无

## 可复用经验
- UI 状态（展示）与 API 协议（请求）应解耦。
- “引用”这类跨层特性适合在最上游（发送入口）做内容归一化（文本拼接/图片抽取），下游只负责透传。 
