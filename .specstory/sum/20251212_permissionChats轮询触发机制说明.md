问题序号：permissionChats轮询触发机制说明

## 问题元信息
- **问题分类**：`[前端逻辑]`
- **严重程度**：`[中]`
- **影响范围**：`[AI聊天前端轮询策略]`
- **发现日期**：`2025-12-12`
- **解决状态**：`[已记录]`

## 问题描述
用户关心前端调用 `/permission/chats` 接口后，下一次请求是在什么时机触发。需要弄清楚 `ApiService.sendChatMessage` 内部轮询逻辑，确认不存在并发多请求的误解。

## 结论
- 前端严格遵循“上一轮 HTTP 完成后再发下一轮”的串行策略。
- `handleNewContent` / `handleEmptyContent` 中在收到响应后立即以 `reason: 'continue'` 调用 `pollChatMessage`，不会产生并行请求。
- 轮询频率由后端响应速度决定：后端一返回新内容，前端才会继续发送下一次请求。

## 关键代码
- `api-service.ts` 中 `sendChatMessage → pollChatMessage → handleNewContent`：
```ts
const continueMessage = { ...message, reason: 'continue' }
return await this.pollChatMessage(
  continueMessage,
  url,
  onComplete,
  onStream,
  newAccumulatedContent,
  messageId,
  onHistoryUpdate,
)
```
- `http-client.ts` 的 `request` 方法使用 `await fetch`，确保单次请求完成后才继续。

## 建议
- 在开发文档中注明该串行轮询特性，方便排除“并发导致高峰”误解。
- 若需实现真正流式传输，应考虑 SSE/fetch-streaming，减少多次 HTTP 往返。
