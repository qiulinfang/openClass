问题序号：PDF初次截图发送sessionId来源不清问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`PDF阅读页截图问答（AI教材聊天）发送链路、排查线上/联调问题`
- **发现日期**：`2025-12-26`
- **解决状态**：`进行中`

## 问题现象
PDF 阅读页进行“首次截图发送”时，业务/联调人员在抓包或日志中会看到 `sessionId` 相关字段，但难以快速判断：
- 本次截图消息使用的 `sessionId` 是从哪里来的（路由？store？后端返回？）
- 同一条发送链路里出现了两套 `sessionId`（前端会话ID vs 后端线程ID），导致误判为“sessionId 被覆盖/不一致/串会话”。

## 复现步骤
1. 步骤1：进入 `PdfViewerView` 打开任意 PDF。
2. 步骤2：框选截图并点击发送到 AI 教材聊天。
3. 步骤3：在控制台日志/网络请求中观察 `sessionId`：
   - UI/本地消息上可能出现 `currentSessionId`。
   - 请求体中同时存在用于后端的 `sessionId`（根会话/线程ID）。

## 用户体验
- 不容易解释“首次截图为什么会生成一个 sessionId”。
- 排查“截图会话归属/历史加载/串线”时成本高。
- 开发或测试容易把“前端 currentSessionId”误当成“后端线程 sessionId”，导致沟通反复。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/views/PdfViewerView.vue`：首次截图时生成并写入 `aiTextbookStore.currentSessionId`。
  - `imates-web/src/stores/aiTextbookChatStore.ts`：发送消息时通过 `ensureTopGeneralSession()` 选择/生成后端用 `sessionId`。
- **涉及模块**：
  - AI 教材聊天（PDF 场景）
  - 截图发送/多图发送（previewPictureQA）
  - 会话管理（currentSessionId / backendSessionId / ai-general 顶部会话）

## 技术原因 (❌)
1. 原因1：同一业务流程存在两套不同语义的 `sessionId`，命名/注释/日志不足以区分。
2. 原因2：首次截图发送时，`PdfViewerView.vue` 会“前端生成”一个 `currentSessionId` 写入 store，但该行为在接口层面并不直观。
3. 原因3：`aiTextbookChatStore.sendMessage()` 内部又会通过 `ensureTopGeneralSession()` 选择/生成后端线程 `sessionId`，并传入请求体字段 `sessionId`，进一步加剧混淆。

❌（易误解的片段：前端生成 currentSessionId，容易被误认为就是请求体 sessionId）
```typescript
// imates-web/src/views/PdfViewerView.vue
const userId = localStorage.getItem('userId') || ''
const resourceId = (route.query.resourceId as string) || aiTextbookStore.resourceId
const now = Date.now()
const sessionId = resourceId
  ? `${userId ? userId + '-' : ''}ai-textbook-${resourceId}-${now}`
  : `${userId ? userId + '-' : ''}ai-textbook-${now}`

aiTextbookStore.currentSessionId = sessionId
```

❌（易误解的片段：请求体中的 sessionId 实际来自 ensureTopGeneralSession，而不是 currentSessionId）
```typescript
// imates-web/src/stores/aiTextbookChatStore.ts
const sessionIdForBackend = await ensureTopGeneralSession()

const aiMessage = buildAiTextbookMessage({
  // ...
  sessionId: sessionIdForBackend,
})
```

## 正确实现方案 (✅)
1. 方案1：明确区分两类 ID 的语义与命名。
   - `currentSessionId`：前端“截图会话/本地会话/历史分组”ID。
   - `backendSessionId` / `threadId`：后端“线程/根会话”ID（请求体 `sessionId`）。
2. 方案2：在发送前打印结构化日志，一次性输出两套 ID，避免排查时误认。
3. 方案3：对外文档/接口字段说明补齐：截图首次发送的 `currentSessionId` 生成规则、生命周期、与后端 `sessionId` 的关系。

✅（建议：增加统一的调试日志字段名，突出语义）
```typescript
console.log('[AI_TEXTBOOK][PDF_SCREENSHOT] ids', {
  uiSessionId: currentSessionId.value,
  backendThreadSessionId: sessionIdForBackend,
  resourceId: resourceId.value,
})
```

## 关键代码/公式
- 代码片段1：首次截图生成 UI 会话ID
```typescript
// PdfViewerView.vue: userId/resourceId/Date.now() 拼接生成 currentSessionId
```

- 代码片段2：发送请求使用后端线程ID
```typescript
// aiTextbookChatStore.ts: ensureTopGeneralSession() -> sessionIdForBackend -> buildAiTextbookMessage.sessionId
```

## 测试验证
- **测试场景**：
  - 场景1：首次截图发送
    - 预期：能在日志中明确看到 `uiSessionId` 与 `backendThreadSessionId`，且两者允许不同。
  - 场景2：连续多次截图发送
    - 预期：`backendThreadSessionId` 可复用（或按规则变化），`uiSessionId` 仍用于前端分组/展示不混乱。
  - 场景3：切换账号后截图发送
    - 预期：不会复用旧账号的 `backendThreadSessionId`（避免串线）；`uiSessionId` 按新 userId 重新生成。
- **验证方法**：
  - 方法1：查看控制台结构化日志与网络请求 payload 中的 `sessionId`。
  - 方法2：检查聊天历史加载/会话分组是否符合预期。

## 预防措施
- 措施1：在类型定义中体现语义（例如 `uiSessionId`、`backendThreadId`），避免统一叫 `sessionId`。
- 措施2：关键链路（截图首次发送、切换账号）增加单测/集成测试覆盖。
- 措施3：补齐开发文档：字段含义、生成规则、生命周期、与后端关系。

## 相关链接/参考
- 相关文档：`imates-web/src/views/PdfViewerView.vue`
- 相关文档：`imates-web/src/stores/aiTextbookChatStore.ts`

## 可复用经验
- 经验1：同名字段在不同层（UI/本地/后端）语义不同时，必须在命名、日志、类型上显式区分。
- 经验2：会话类问题优先做“结构化日志”，一次输出关键ID与上下文，减少抓包依赖。
- 经验3：生成规则（如 `Date.now()` 拼接）应在文档中固化，避免后续重构引入不兼容。
