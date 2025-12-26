问题05：ai-general thread_id漂移导致上下文丢失问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`AI通用聊天(ai-general)连续对话上下文`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决/需持续验证`

## 问题现象
后端日志显示同一用户连续两句话请求携带的 `thread_id` 不一致（例如 `general-session-...` 变化），导致模型认为是新会话，上下文断裂。

## 复现步骤
1. 进入 ai-general。
2. 发送一条消息。
3. 不切换页面的情况下再发送第二条。
4. 观察后端日志：两次请求 thread_id 不一致。（部分场景与 UI 重置/新建会话/删除当前会话相关）

## 用户体验
- AI “不知道前文在说什么”，对话体验极差。
- 用户需要重复描述上下文。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/stores/aiGeneralChatStore.ts`：会话创建与 currentSession
  - `imates-web/src/components/MainChatPanel.vue`：新建对话时 resetState
  - `imates-web/src/components/UnifiedChatDialog.vue`：新建对话时 resetState
- **涉及模块**：
  - ai-general 会话管理/会话列表

## 技术原因 (❌)
1. 请求构建 `buildAiGeneralMessage` 在缺少 sessionId 时会生成新的 `general-session-${Date.now()}`，任何 currentSession 丢失都会导致 thread_id 漂移。
2. `createSession()` 生成的 sessionId 规则与请求侧默认规则不一致，增加了不一致风险。
3. UI 的“新建对话”流程通过 `resetState()` 清空 `currentSession`，导致下一次发送必然创建新会话。

错误示例（会话生成规则不一致）：
```ts
// 旧 createSession
sessionId: `session_${Date.now()}_${Math.random()}`

// buildAiGeneralMessage 兜底
sessionId: `general-session-${Date.now()}`
```

## 正确实现方案 (✅)
1. 统一 `createSession()` 的 sessionId 生成规则与 `buildAiGeneralMessage` 一致（`general-session-${Date.now()}`）。
2. 明确哪些 UI 行为应该创建新会话（例如“新建对话”按钮），避免误触 reset 导致漂移。

正确示例：
```ts
// aiGeneralChatStore.ts
sessionId: `${userId ? userId + '-' : ''}general-session-${Date.now()}`
```

## 关键代码/公式
- `aiGeneralChatStore.sendMessage()`：`if (!currentSession) createSession(...)`
- `aiGeneralChatStore.resetState()`：会清空 `currentSession`

## 测试验证
- **测试场景**：
  - 场景1：同一会话连续发送两条消息，后端 thread_id 保持一致。
  - 场景2：点击“新建对话”后再发送，thread_id 应变化（符合新会话定义）。
- **验证方法**：
  - 方法1：后端日志比对 thread_id。
  - 方法2：前端打印 `currentSession.sessionId` 与请求入参。

## 预防措施
- 将“UI重置消息列表”与“清空会话ID”解耦，必要时提供两个 API（如 `resetMessages()` vs `resetState()`）。
- 增加埋点：每次发送打印 thread_id 与触发来源（新建/切换/恢复）。

## 相关链接/参考
- 后端日志：`thread_id` 变化示例（对话记录）

## 可复用经验
- 会话 ID 是“上下文一致性”的根，必须做到：创建点单一、生命周期清晰、任何重置都要谨慎。
