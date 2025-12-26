问题序号：AI聊天移除停止回答AbortController机制问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`AI聊天停止/暂停能力、请求中止链路、相关调用点编译与运行`
- **发现日期**：`2025-12-26`
- **解决状态**：`进行中`

## 问题现象
项目中曾引入“停止回答/暂停”的实现（`AbortController` + `AbortSignal` 贯穿到 httpClient 请求与轮询），但需求调整为：
- **完全移除**停止/暂停能力的代码与调用链
- UI 侧不再依赖中止请求（可保留按钮，但不应再调用 abort API）

若移除不彻底，会出现：
- TypeScript 编译报错（参数不匹配/类型缺失）
- 运行期调用不存在的方法（如 `apiService.abortCurrentChat()`）
- 轮询继续/结束行为不一致

## 复现步骤
1. 代码中存在 `AbortController`/`signal` 相关实现与调用点。
2. 仅删除部分代码（例如只删 `abortCurrentChat` 方法），未同步更新所有调用处。
3. 执行 `typecheck` 或运行应用。
4. 观察到 TS 报错或运行时报错。

## 用户体验
- “停止回答”按钮点击无效或报错
- AI 聊天可能卡在 loading 或无法正确结束
- 开发/发版风险增大（编译不通过）

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/services/http/ai-chat-api.ts`：历史上引入 `AbortController`；当前正在移除，并调整为轮询间隔控制
  - `imates-web/src/services/http/http-client.ts`：曾支持 `signal` 透传，已被移除
  - `imates-web/src/types/config.ts`：曾在 `RequestConfig` 中添加 `signal`，后已移除
  - `imates-web/src/services/http/api-service.ts`：曾暴露 `abortCurrentChat()`，后已移除
  - `imates-web/src/components/ChatView.vue`：曾监听 `stop-response` 事件并调用 abort（需要确认无残留）
  - `imates-web/src/components/chat/ChatInput.vue`：发送按钮在 loading 时触发 `stop-response`（需要确认逻辑与新需求一致）
- **涉及模块**：
  - AI 聊天轮询
  - HTTP 请求封装
  - UI 交互（发送按钮/停止按钮）

## 技术原因 (❌)
1. **能力在多层被“贯穿”**：`signal` 从 UI -> ApiService -> AiChatApi -> httpClient 全链路传递，移除必须全链路一致。
2. **调用点分散**：UI/Store 中可能存在多个停止入口（事件、方法、store action）。
3. **异常分支依赖 abort**：如 `isAbortError`/`handleUserAbort` 这类“正常收尾”逻辑，移除时需确保轮询结束仍然可靠。

错误示例（示意）：
```typescript
// ❌ 仍然传递 signal，但下层已移除该参数
await httpClient.post(url, body, { signal })

// ❌ 仍然调用已删除的 API
apiService.abortCurrentChat()
```

## 正确实现方案 (✅)
1. **彻底删除中止相关抽象**：
   - 删除 `AbortController` 字段、`abortCurrentChat()`、`signal` 参数与透传。
   - 删除 `isAbortError` / `handleUserAbort` 这类“用户中止”的分支。
2. **轮询节流改用时间间隔**：
   - 继续轮询使用 `setTimeout` 延迟（例如 500ms），避免 tight loop。
3. **UI 侧行为重新定义**：
   - 如果仍保留“停止按钮/暂停 icon”，点击后只能做 UI 层行为（比如提示、不再触发中止请求），或彻底去掉 stop-response 链路。

正确示例（示意，关键点）：
```typescript
// ✅ 继续轮询前加间隔
if (message.reason === 'continue') {
  await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs))
}

// ✅ 不再传递 signal
const response = await this.sendChatRequest(url, message)
```

## 关键代码/公式
- 关键代码片段：`AiChatApi.pollChatMessage()` 使用 `pollIntervalMs` 控制 continue 间隔
```typescript
private async pollChatMessage(...) {
  if (message.reason === 'continue') {
    await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs))
  }
  const response = await this.sendChatRequest(url, message)
  return this.handleChatResponse(...)
}
```

## 测试验证
- **测试场景**：
  - 场景1：普通 AI 聊天，确保能持续轮询并最终结束（`end` 或 SSE ended）。
  - 场景2：快速连续发送多次消息，确保不会出现请求参数错误或报错。
  - 场景3：点击“加载中发送按钮（暂停 icon）”，确保不会触发已删除的 abort API（不报错）。
- **验证方法**：
  - 方法1：`pnpm typecheck` / `npm run typecheck` 通过。
  - 方法2：浏览器控制台无 `abortCurrentChat is not a function`、无 500/参数不匹配错误。

## 预防措施
- 将“可中止请求”作为明确可开关的能力（feature flag）而不是硬贯穿参数。
- 为 ApiService/AiChatApi 建立契约测试（方法签名变更时能快速暴露调用点）。
- UI 事件（如 `stop-response`）要有“是否仍被消费”的检查，避免变成悬空事件。

## 相关链接/参考
- 相关文档：`.specstory/sum/20251212_AI聊天流式接口调用规范缺失问题.md`（若存在可补充引用）

## 可复用经验
- 删除跨层能力时，优先用全局搜索建立“调用图”，按链路从底向上删除。
- 轮询系统的“结束/节流/错误处理”三者必须一起验收，否则容易产生卡死/刷屏/性能问题。
