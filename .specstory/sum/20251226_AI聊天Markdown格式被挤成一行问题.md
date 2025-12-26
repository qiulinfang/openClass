问题序号：AI聊天Markdown格式被挤成一行问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`AI聊天（/permission/chats 等轮询/流式返回）的表格/列表/段落渲染`
- **发现日期**：`2025-12-26`
- **解决状态**：`进行中`

## 问题现象
AI 回复中包含 Markdown 表格、列表、分段文本时，最终在聊天气泡内渲染为“单行文本”，导致：
- 表格竖线对不齐或整段被压成一行
- 列表项之间无换行
- 段落之间无空行

## 复现步骤
1. 打开 AI 聊天页面（触发 `/permission/chats` 或对应环境下 `/ai/2.0/chats`）。
2. 发送提示词，让 AI 返回包含 Markdown 表格/列表/段落的内容。
3. 等待 AI 回复结束。
4. 观察渲染结果：换行被压缩，表格/列表显示异常（表现为一整行）。

## 用户体验
- 表格不可读，信息对齐丢失
- 列表/段落结构丢失，阅读成本大幅提升
- 用户会认为“AI 输出错误/不专业”，降低信任

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/services/http/ai-chat-api.ts`：轮询 + chunk 累积逻辑；此前对 chunk 做了过度 `trim()`
  - `imates-web/src/composables/useMessageRenderer.ts`：MarkdownIt 渲染入口（最终展示依赖其输出）
  - `imates-web/src/views/RenderTestView.vue`：现有 Markdown 渲染测试页（用于回归验证）
- **涉及模块**：
  - AI 聊天消息流式/轮询聚合
  - Markdown 渲染

## 技术原因 (❌)
1. **过度清理空白**：对流式/轮询返回的 chunk 使用 `trim()` 或类似逻辑，导致合法换行（`\n`）和段落空行被吞。
2. **非 SSE 场景缺少 chunk 间分隔**：轮询接口可能多次返回“片段”，如果直接拼接，片段边界处会连成一行。
3. **判断用的 trimmedChunk 被误用为正文**：控制判断需要 `trim()`（例如识别 `end`），但正文累积不应依赖 trimmed 内容。

错误示例（示意）：
```typescript
// ❌ 会吞掉换行，破坏 Markdown 结构
const chunk = raw.trim()
accumulated += chunk
```

## 正确实现方案 (✅)
1. **控制判断与正文处理分离**：
   - 用 `trim()` 仅用于判断 `end/成功` 等控制信号。
   - 正文累积使用原始内容（保留 `\n`/空格）。
2. **非 SSE 轮询强制追加换行**：
   - 片段之间若 chunk 末尾没有换行，则补 `\n`，避免片段边界粘连。
3. **兼容拼接 JSON 响应**：
   - 针对 `{...}{...}` 这种拼接返回，拆分并提取 message，再用 `\n` join。

正确示例（示意，关键点）：
```typescript
// ✅ trimmedChunk 只用于控制判断
const raw = String(rawMessage)
const trimmedChunk = raw.trim()

// ✅ 正文尽量保留 raw（只在末尾剔除 end 标记）
const chunk = stripTrailingEnd(raw)
const outgoingChunk = forceAppendNewline && !chunk.endsWith('\n') ? chunk + '\n' : chunk
accumulated += outgoingChunk
```

## 关键代码/公式
- 关键代码片段：`AiChatApi.handleNewContent()` 对非 SSE 场景传入 `forceAppendNewline=true`
```typescript
private async handleNewContent(
  chunk: string,
  ...,
  forceAppendNewline: boolean = false,
) {
  const outgoingChunk = forceAppendNewline && chunk && !chunk.endsWith('\n') ? `${chunk}\n` : chunk
  const newAccumulatedContent = accumulatedContent + outgoingChunk
  onStream?.(outgoingChunk, false)
  return this.pollChatMessage({ ...message, reason: 'continue' }, url, onComplete, onStream, newAccumulatedContent, messageId, onHistoryUpdate)
}
```

## 测试验证
- **测试场景**：
  - 场景1：让 AI 输出 Markdown 表格（至少 3 行），期望表格按行渲染、非单行。
  - 场景2：让 AI 输出 Markdown 列表（有序/无序），期望每项独立换行。
  - 场景3：让 AI 输出多段文本（含空行），期望段落间留空。
- **验证方法**：
  - 方法1：使用 `RenderTestView.vue (/render-test)` 输入同样内容，看 Markdown 渲染是否正常。
  - 方法2：走真实 AI 接口（/permission/chats 或 /ai/2.0/chats），观察最终气泡内容是否保留换行。

## 预防措施
- 增加“流式/轮询文本聚合”的单元测试（输入多段 chunk，断言输出包含预期换行）。
- 在代码评审中明确：`trim()` 仅用于控制信号，不用于正文。
- 对不同后端返回形态（SSE / 非 SSE / 拼接 JSON）补充回归用例。

## 相关链接/参考
- 相关文档：`imates-web/src/views/RenderTestView.vue`
- 参考资源：Markdown 语法规则（表格/列表/段落依赖换行）

## 可复用经验
- 区分“协议控制字段/控制信号”和“展示正文”是流式聚合的基本原则。
- 聚合层不要做激进清洗，应把清洗策略下放到渲染层或以白名单方式处理。
- 轮询分片接口需要显式定义“分片边界”策略（例如换行/空格/零宽分隔符）。
