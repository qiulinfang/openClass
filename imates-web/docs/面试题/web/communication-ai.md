# Web 面试题 - 实时通信与 AI 对话

> 本面试题基于项目实际代码，深入探讨技术实现细节与业务难点。

## 1. WebSocket 实时通信

### Q1: 项目中 WebSocket 的心跳检测和重连机制是如何设计的？请结合 `webSocketService.ts` 说明。
- **心跳检测**: 
  - 使用 `setInterval` 定期发送 `PING` 消息。
  - 服务器返回 `PONG` 或 ACK 确认连接存活。
  - 如果连续多次未收到心跳响应，客户端主动断开并尝试重连。
- **自动重连**:
  - 监听 `onclose` 和 `onerror` 事件。
  - 使用指数退避算法（Exponential Backoff）或固定频率尝试重连。
  - 设置最大重连次数，避免无限循环。
- **项目实践**: 
  - 本项目在 `WebSocketService` 中实现了 `startHeartbeat` 和 `attemptReconnect`。
  - 特别针对“研伴”后端采用了“单连接多会话”架构，通过消息体中的 `sessionId` 区分不同会话。

### Q2: 在“单连接多会话”架构下，前端如何确保消息准确路由到对应的会话？
- **原理**: WebSocket 建立后不再通过 URL 参数切换会话，而是在发送的消息体中包含 `sessionId`。
- **处理**: 
  - 前端维护一个全局的 WebSocket 实例。
  - 接收到消息后，根据 `sessionId` 将消息分发到对应的 Pinia Store（如 `aiExerciseChatStore` 或 `teacherChatStore`）。
  - 使用事件总线（Event Bus）或全局监听器实现分发逻辑。

## 2. AI 对话业务逻辑

### Q3: 如何处理 AI 流式输出（SSE/WebSocket Stream）导致的消息解析问题？
- **挑战**: AI 回复可能是分段传输的 Markdown，公式标签（如 `$$...$$`）可能被截断，导致渲染失败。
- **解决方案**: 
  - 前端维护一个缓冲区，拼接所有接收到的片段。
  - 实时更新 UI，但使用防抖（Debounce）或请求动画帧（rAF）优化渲染频率。
  - 对于公式等复杂渲染，可以等待标记完整后再进行重绘。

### Q4: 项目中如何实现 AI 对话的消息重试机制？
- **场景**: 网络波动导致消息发送失败。
- **实现**: 
  - 使用 `useChatRetry` composable。
  - 记录失败的消息状态，提供“重新发送”按钮。
  - 为每条消息生成唯一的 `messageId`，确保重试时后端能识别幂等性。

### Q5: AI 题目场景下，如何将题目信息与对话上下文关联？
- **实现**: 
  - 在 `aiExerciseChatStore` 中，发送请求时会自动附加当前题目的 `bmNo`, `question`, `answer` 等元数据。
  - 如果存在图片或截图，先将其转换为 Base64 或上传，再放入消息列表中。
  - 通过 `buildAiExerciseMessage` 统一构建请求体，确保参数完整性。
