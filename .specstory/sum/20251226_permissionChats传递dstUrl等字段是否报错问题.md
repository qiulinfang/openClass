问题01：permission/chats传递dstUrl等字段是否报错问题

## 问题元信息
- **问题分类**：`其他`
- **严重程度**：`低`
- **影响范围**：`AI聊天/跨端联调（手工构造请求体调用 /permission/chats）`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
在调用 `/permission/chats` 时，手工构造并传递如下请求体（包含 `dstUrl`、`chatRole` 等字段），担心后端会因为“字段多/字段名不匹配”而报错（例如 400 参数校验失败）。

典型请求体：
```json
{
  "sessionId": "guest045-general-session-1766048173748",
  "newValue": "1",
  "coversation": "1",
  "question": "",
  "answer": "",
  "name": "guest045",
  "reason": "start",
  "bmNo": "guest045-general-session-1766048173748",
  "isWebSearch": "0",
  "chatRole": "mate",
  "subject": "",
  "dstUrl": "/permission/chats",
  "role": "mate"
}
```

## 复现步骤
1. 步骤1：在 `imates-web` 中构造 `AiChatMessageRequest`，令 `dstUrl = '/permission/chats'`
2. 步骤2：调用 `AiChatApi.sendChatRequest(url, requestBody)`，观察实际发送的 body
3. 步骤3：对比手工构造的 body 与 `AiChatMessageRequest` 类型定义，确认哪些字段是“协议内字段”、哪些是“多余字段”

## 用户体验
- 手工联调/抓包时不敢确定请求体字段是否可多传，增加排障成本
- 前后端协议不明确时，容易出现“线上能用但手工调用报错”的误判

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/types/api.ts`：`AiChatMessageRequest` 类型定义（包含 `dstUrl`、`role` 等）
  - `imates-web/src/stores/aiGeneralChatStore.ts`：通用对话请求体构造（必传 `dstUrl`）
  - `imates-web/src/stores/utils/requestValidator.ts`：请求参数必填字段校验（把 `dstUrl` 当必填）
  - `imates-web/src/services/http/ai-chat-api.ts`：实际发送 `POST(url, message)`，即把整个 `message` 作为 JSON body 发出
- **涉及模块**：
  - imates-web：AI 通用聊天（`/permission/chats`）

## 技术原因 (❌)
1. 原因1：把 `dstUrl` 当成“仅前端内部使用字段”，误以为不应出现在请求 body
2. 原因2：混用了字段名：前端类型是 `role`，但手工请求体里同时出现 `chatRole` 与 `role`
3. 原因3：不清楚后端是否开启“严格 DTO 白名单校验”（例如 `forbidNonWhitelisted`），导致对“多余字段是否 400”不确定

（错误示例）
```json
{
  "sessionId": "...",
  "coversation": "hi",
  "chatRole": "mate",
  "dstUrl": "/permission/chats"
}
```

## 正确实现方案 (✅)
1. 方案1：以 `AiChatMessageRequest` 为准构造请求体（字段名用 `role`，不要额外混入 `chatRole`）
2. 方案2：允许携带 `dstUrl`：在当前 `imates-web` 实现中，`dstUrl` 被强制要求存在，并且会被作为 body 字段随请求一起发送
3. 方案3：如果你要“纯后端协议”手工调用（例如 Postman/curl），建议只传后端确实需要的字段集合（避免未来后端开启严格白名单校验后被 400）

（正确示例）
```json
{
  "sessionId": "guest045-general-session-1766048173748",
  "newValue": "1",
  "coversation": "1",
  "question": "",
  "answer": "",
  "name": "guest045",
  "reason": "start",
  "bmNo": "guest045-general-session-1766048173748",
  "isWebSearch": "0",
  "role": "mate",
  "subject": "",
  "dstUrl": "/permission/chats",
  "explanation": ""
}
```

## 关键代码/公式
- 代码片段1：`AiChatMessageRequest` 明确包含 `dstUrl` 字段
```typescript
// imates-web/src/types/api.ts
export interface AiChatMessageRequest {
  sessionId: string
  newValue: string
  coversation: string
  question: string
  answer: string
  name: string
  reason: string
  dstUrl: string
  bmNo: string
  isWebSearch: string
  role: string
  subject: string
  explanation: string
}
```

- 代码片段2：通用对话构造时强制设置 `dstUrl` 为 chats 端点
```typescript
// imates-web/src/stores/aiGeneralChatStore.ts
const dstUrl = useScreenshotApi ? apiPaths.previewPictureQA : apiPaths.chats

const request: AiChatMessageRequest = {
  sessionId: finalSessionId,
  newValue,
  coversation: content,
  name: getUserId() || 'User',
  reason: 'start',
  bmNo: finalSessionId,
  isWebSearch: enableWebSearch ? '1' : '0',
  role: chatRole,
  subject: '',
  dstUrl,
  explanation: '',
}
```

- 代码片段3：发送请求时直接把 `message` 整体作为 body
```typescript
// imates-web/src/services/http/ai-chat-api.ts
private async pollChatMessage(message: AiChatMessageRequest, url: string, ...) {
  const response = await this.sendChatRequest(url, message)
  // ...
}
```

## 测试验证
- **测试场景**：
  - 场景1：使用 `imates-web` 正常发起通用对话，确认请求 body 中确实包含 `dstUrl` 字段
  - 场景2：手工请求体去掉 `chatRole`，只保留 `role`，验证接口仍可正常响应
- **验证方法**：
  - 方法1：浏览器 DevTools / Charles 抓包查看请求体字段
  - 方法2：在前端发送前 `console.log(request)`（或在 `httpClient` 层加日志）确认序列化后字段

## 预防措施
- 措施1：把 `/permission/chats` 的“必填字段/可选字段/是否允许扩展字段”写入接口文档
- 措施2：跨端统一字段命名：统一只用 `role`（避免同时出现 `chatRole`）
- 措施3：如果后端未来启用严格 DTO 校验，前端应同步收敛请求体字段，避免传递与后端无关的字段

## 相关链接/参考
- 相关文档：`d:\Project\xueban-qianduan\.specstory\sum\20251226_permissionChats是否传递sessionId问题.md`

## 可复用经验
- 经验1：判断“多传字段是否会报错”要看后端是否开启 DTO 白名单校验；不确定时，以项目内真实请求构造代码为准
- 经验2：手工调用接口应尽量只传“后端明确需要”的字段，减少协议漂移风险
- 经验3：对同一业务（Web/Android）应统一字段命名（如 `role`），避免引入同义字段造成歧义
