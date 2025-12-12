问题序号：MainChatPanel新增会话sessionId复用原因

## 问题元信息
- **问题分类**：`[前端状态管理]`
- **严重程度**：`[中]`
- **影响范围**：`[AI通用/教材/题目会话切换]`
- **发现日期**：`2025-12-12`
- **解决状态**：`[已记录]`

## 问题描述
点击 MainChatPanel.vue 的“新增会话”按钮后，用户发送第一条消息时发现 `sessionId` 仍然是上一会话的值，导致后台日志中 thread_id 没有切换。

## 原因分析
1. `handleNewChatClick` 在 AI 场景只执行 `aiGeneralStore.resetState()`，不会立即创建新会话，只是将 `currentSession` 置空。
2. 真正生成新 `sessionId` 是在 `aiGeneralChatStore.sendMessage` 里，当发现 `currentSession` 为空时才调用 `createSession`。
3. 其他场景（教材、题目聊天）通过 `ensureTopGeneralSession` 复用 `aiGeneralStore.sessions[0].sessionId` 作为后端 thread_id。如果在 AI 通用里还没发送第一条新消息，`sessions[0]` 仍是旧会话，自然被复用。

## 结论
- 按现实现实：**必须先在 AI 通用模式发送一条消息**，才会真正创建新的 session 并更新 `sessions[0]`。
- 在未发送前直接进入教材/题目聊天，`ensureTopGeneralSession` 会继续拿旧的 sessionId。

## 改进建议
1. 点击“新增会话”时直接调用 `createSession`，避免依赖首次发送来生成 ID。
2. 对教材/题目聊天增加可选参数，允许独立 sessionId，不强制复用 ai-general 顶部会话。
3. 在调试文档里说明“resetState 只是清状态，不生成新 sessionId”，提醒使用者。
