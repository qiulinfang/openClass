问题序号：1 history_messages 字段结构缺乏说明

## 问题元信息
- **问题分类**：后端
- **严重程度**：低
- **影响范围**：AI 聊天历史同步、Web 与 Android 聊天模块维护人员
- **发现日期**：2025-12-12
- **解决状态**：已解决

## 问题现象
后台 SSE 返回的 `history_messages` 字段没有明确的结构说明，不同端同学在调试 AI 聊天记录时无法确认 `id`、`content`、`type` 的取值范围，尤其是 `type` 究竟是 `human/ai` 还是 `user/ai`，导致映射逻辑和 UI 字段保留策略存在疑惑。

## 复现步骤
1. 打开 Web 端 AI 聊天会话，监听 SSE 返回的 `history_messages`。
2. 仅能看到一个数组对象，缺乏正式文档说明其字段类型。
3. 需要阅读源码或逐条打印才能猜测结构，调试效率低下。

## 用户体验
- 影响点1：开发同学无法快速定位消息字段，沟通成本高。
- 影响点2：容易把 `type` 直接当成前端 `sender` 使用，导致头像或样式错误。
- 影响点3：会话快照 diff 逻辑无法准确复用旧字段，可能出现 UI 闪烁。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/types/chat.ts`：`BackendHistoryMessage` 与 `SSEPayload` 的权威定义。
  - `imates-web/src/stores/aiGeneralChatStore.ts`：`mapHistoryToChatBubbles` 消息映射逻辑。
  - `imates-web/src/stores/aiTextbookChatStore.ts`：教材场景映射逻辑。
- **涉及模块**：
  - Web SSE 订阅模块：负责解析 `history_messages`。
  - AI 聊天消息存储模块：负责前端气泡渲染。

## 技术原因 (❌)
1. 缺少 `history_messages` 的协议文档，导致多人实现时凭经验臆测字段。
2. `type` 字段真实取值为 `human/ai`，但部分代码示例直接当成 `user/ai` 使用。

```typescript
// ❌ 假设后端直接返回 user/ai，未做转换
const sender = msg.type as 'user' | 'ai'
```

## 正确实现方案 (✅)
1. 在共享类型文件中声明 `BackendHistoryMessage`，明确 `id/content/type` 字段。
2. SSE payload 中引用该类型数组，统一在前端转换逻辑里处理 `human -> user`。
3. 通过 `mapHistoryToChatBubbles` 复用旧消息，避免丢失前端独有字段。

```typescript
// ✅ 统一的类型定义，来源：imates-web/src/types/chat.ts
export interface BackendHistoryMessage {
  id: string
  content: string
  type: 'ai' | 'human'
}

export interface SSEPayload {
  content?: string
  agent_status?: 'talking' | 'drawing' | 'thinking' | string
  history_messages?: BackendHistoryMessage[]
}
```

## 关键代码/公式
- `mapHistoryToChatBubbles` 中将 `human` 映射成 `user`，并使用服务端下发的 `id` 维持前端消息一致性。

```typescript
const sender: 'user' | 'ai' = m.type === 'human' ? 'user' : 'ai'
const bubble: ChatBubble = {
  id: m.id,
  messageId: m.id,
  content: m.content || '',
  sender,
  type: sender,
  // ...复用旧字段
}
```

## 测试验证
- **测试场景**：
  - 场景1：打开已有会话，确认 SSE 全量快照能正确复用旧 UI 字段。
  - 场景2：触发一次新对话，请求完成后检查 `type` 转换是否正确。
- **验证方法**：
  - 方法1：在控制台打印 `history_messages` 并验证字段与定义一致。
  - 方法2：通过单元测试或 vitest 模拟 SSE payload，断言映射结果。

## 预防措施
- 措施1：后端新增字段时同步更新 `chat.ts` 类型定义。
- 措施2：在 API 文档或 /sum 文件中记录协议，避免凭经验猜测。
- 措施3：前端对未知字段统一做守卫，避免未定义值影响 UI。

## 相关链接/参考
- 相关文档：`imates-web/src/types/chat.ts`
- 相关 Issue：暂无
- 参考资源：SSE 返回示例（内部抓包）

## 可复用经验
- 经验1：跨端共享的协议字段必须落在公共类型文件中。
- 经验2：处理历史快照时优先复用旧消息，降低 UI 波动。
- 经验3：/sum 文档集中记录协议演进，便于后续排查。
