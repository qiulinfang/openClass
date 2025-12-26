问题07：PDF截图多次发送sessionId变化问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`PdfViewerView(ai-textbook)截图问答会话、以及后端上下文一致性排查`
- **发现日期**：`2025-12-26`
- **解决状态**：`待解决（属于设计确认）`

## 问题现象
在 PDF 阅读页进行截图框选并发送给学伴后，再次框选截图并发送，会发现（前端）sessionId 发生变化。团队在排查“模型上下文是否会断”时对此存在疑问。

## 复现步骤
1. 进入 `PdfViewerView`，框选截图，点击发送。
2. 再次框选另一处截图，点击发送。
3. 观察日志/状态：`aiTextbookStore.currentSessionId` 变化（通常带 Date.now）。

## 用户体验
- 若后端上下文绑定在该 sessionId 上，可能导致模型上下文断裂。
- 如果该 sessionId 仅用于前端分组展示，则用户无感，但排查时容易误判。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/views/PdfViewerView.vue`：`handlePdfSendWithScreenshot` 生成并设置 sessionId
  - `imates-web/src/stores/aiTextbookChatStore.ts`：`currentSessionId` 与 `ensureTopGeneralSession`（后端 thread_id）

## 技术原因 (❌)
1. PDF 场景的“截图发送”逻辑每次都会使用 `Date.now()` 生成一个新的 `ai-textbook-...` 会话 id，并写入 `aiTextbookStore.currentSessionId`，因此多次截图发送必然变化。
2. 同时，真正发给后端用于模型记忆的 thread_id 通常来自 `ensureTopGeneralSession()`（优先取 ai-general 顶部会话），两者并非同一概念，容易混淆。

错误（易误解点）示例：
```ts
// PdfViewerView.vue
aiTextbookStore.currentSessionId = `ai-textbook-${resourceId}-${Date.now()}`
```

## 正确实现方案 (✅)
需要先明确产品/架构口径：
1. 若“每次截图发送都是一个独立会话”（仅用于前端分组），现状合理，但需文档说明。
2. 若“同一本PDF内多次截图应属于同一会话（保持上下文）”，则应改为复用固定 sessionId（例如首次生成后缓存，直到 resourceId 变化才重置）。

建议实现（复用）：
```ts
if (!aiTextbookStore.currentSessionId) {
  aiTextbookStore.currentSessionId = `ai-textbook-${resourceId}-${Date.now()}`
}
// 后续截图发送复用 aiTextbookStore.currentSessionId
```

## 关键代码/公式
- `PdfViewerView.vue`：`handlePdfSendWithScreenshot`
- `aiTextbookChatStore.ts`：
  - `setResourceId()` resourceId 变化会清空 currentSessionId
  - `ensureTopGeneralSession()` 决定后端 thread_id

## 测试验证
- **测试场景**：
  - 场景1：同一 PDF 连续截图发送 2 次，确认 currentSessionId 是否按期望复用/变化。
  - 场景2：切换教材(resourceId变化)后再次截图发送，应生成新的会话 id。
- **验证方法**：
  - 方法1：控制台打印 currentSessionId。
  - 方法2：后端日志确认 thread_id 是否保持一致（如果上下文依赖 thread_id）。

## 预防措施
- 对“前端会话ID”与“后端 thread_id”命名区分（例如 `uiSessionId` vs `threadId`），避免混淆。
- 在日志中同时打印两者，便于排查。

## 相关链接/参考
- `imates-web/src/views/PdfViewerView.vue`

## 可复用经验
- 会话ID一旦承担“上下文一致性”职责，就必须稳定；否则应明确其只是 UI 分组标识。 
