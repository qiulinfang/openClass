问题序号：AI聊天previewPictureQA拼接JSON解析与轮询优化问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`AI教材截图问答、previewPictureQA接口响应解析、多段消息渲染`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
`/permission/previewPictureQA` 接口返回的拼接JSON格式（如 `{"message":"方案1..."}{" message":"方案2..."}`）只渲染了第一段内容,后续段落丢失。

具体表现:
- 后端返回多个JSON对象直接拼接（`}{`分隔）
- 前端只解析并渲染了第一个JSON的message字段
- 用户看到的回答不完整,缺少后续方案/内容

## 复现步骤
1. 在AI教材场景下使用截图问答功能
2. 后端返回拼接JSON格式的响应: `{"message":"方案 1：..."}{"message":"方案 2：..."}`
3. 观察前端只显示"方案 1"的内容
4. 检查网络请求,确认完整响应已返回但未完全渲染

## 用户体验
- AI回答不完整,影响学习效果
- 多方案/多步骤解答只显示第一个,用户无法看到完整思路
- 用户可能误以为AI能力不足或回答质量差

## 相关文件/模块
- **涉及文件**:
  - `imates-web/src/services/http/ai-chat-api.ts`: 核心修复点,`handleNonSseResponse`、`extractMessageFromConcatenatedJson`、`stripTrailingEnd`
  - `imates-web/src/config/env-config.ts`: 添加 `apiPaths.previewPictureQA` 配置
  - `imates-web/src/stores/utils/requestValidator.ts`: 更新截图API判断逻辑
- **涉及模块**:
  - AI聊天轮询系统
  - 非SSE响应解析
  - 拼接JSON提取

## 技术原因 (❌)

### 1. 提前结束轮询
原逻辑在 `handleNonSseResponse` 中:
```typescript
// ❌ 只要 accumulatedContent.length > 0 就直接结束
if (message.dstUrl === '/permission/previewPictureQA' && !raw.includes('data:') && accumulatedContent.length > 0) {
  return this.handlePollingEnd(messageId, accumulatedContent, ...)
}
```
问题:
- 第一帧返回后立即结束,不再继续轮询
- 当前帧的拼接JSON未被提取,直接用旧的 `accumulatedContent` 结束
- 后续帧永远不会被获取

### 2. 拼接JSON提取时机错误
```typescript
// ❌ 在已经决定结束后才提取
const normalizedChunk = this.extractMessageFromConcatenatedJson(trimmedChunk) ?? trimmedChunk
const chunk = this.stripTrailingEnd(normalizedChunk)
const newAccumulated = accumulatedContent + chunk
return this.handlePollingEnd(messageId, newAccumulated, ...)
```
问题:
- 提取逻辑在错误的分支中,未被执行
- 即使执行,也是在已决定结束之后,无法继续获取后续内容

### 3. 空白处理过度
```typescript
// ❌ trim() 导致有效换行丢失
.map((m) => String(m).trim())
.filter((m) => m.length > 0)
return messages.join('')  // ❌ 直接拼接,段落间无分隔
```

## 正确实现方案 (✅)

### 1. 先提取再累积,持续轮询
```typescript
// ✅ previewPictureQA 非SSE响应:先提取拼接JSON,累积内容,继续轮询
if (message.dstUrl === getCurrentEnvConfig().apiPaths.previewPictureQA && !raw.includes('data:')) {
  // 提取拼接的 JSON 消息
  const normalizedChunk = this.extractMessageFromConcatenatedJson(raw) ?? raw
  const chunk = this.stripTrailingEnd(normalizedChunk)
  
  // 如果有新内容,累积并继续轮询
  if (chunk && chunk.trim()) {
    return this.handleNewContent(chunk, message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate, true)
  }

  // 空帧不代表结束,继续轮询等待后续内容或 end
  return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
}
```

### 2. 优化拼接JSON提取
```typescript
// ✅ 保留原始格式,段落间用换行分隔
const messages = objects
  .map((o) => (o && typeof o.message === 'string' ? o.message : ''))
  .map((m) => String(m))  // 不trim,保留原始空白
  .filter((m) => m.length > 0)

if (messages.length === 0) return null
return messages.join('\n')  // 用换行分隔段落
```

### 3. 优化 stripTrailingEnd
```typescript
// ✅ 仅移除末尾的 end 标记,保留其它空白
private stripTrailingEnd(text: string): string {
  const input = String(text ?? '')
  const trimmed = input.trim()
  // 整帧只有 end
  if (/^end$/i.test(trimmed)) return ''
  // 仅移除"末尾的 end 标记 + 其后的空白",其它内容保留
  return input.replace(/end\s*$/i, '')
}
```

### 4. 在 handleNewContent 中强制追加换行
```typescript
// ✅ previewPictureQA 每帧后强制换行,确保段落分隔
private handleNewContent(
  chunk: string,
  message: AiChatMessageRequest,
  url: string,
  onComplete?: (content: string, sessionId?: string) => void,
  onStream?: (chunk: string, isDone: boolean) => void,
  accumulatedContent: string = '',
  messageId: string = generateUniqueId('ai'),
  onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  forceAppendNewline: boolean = false,
) {
  const outgoingChunk = forceAppendNewline && chunk && !chunk.endsWith('\n') ? `${chunk}\n` : chunk
  const newAccumulatedContent = accumulatedContent + outgoingChunk
  if (onStream) {
    onStream(outgoingChunk, false)
  }
  // 继续轮询
  return this.pollChatMessage({ ...message, reason: 'continue' }, url, onComplete, onStream, newAccumulatedContent, messageId, onHistoryUpdate)
}
```

### 5. 统一轮询间隔
```typescript
// ✅ 在 pollChatMessage 入口统一控制间隔
private async pollChatMessage(...) {
  if (message.reason === 'continue') {
    await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs))  // 500ms
  }
  const response = await this.sendChatRequest(url, message)
  return this.handleChatResponse(...)
}
```

## 关键代码/公式

### 拼接JSON正则提取
```typescript
private extractMessageFromConcatenatedJson(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  // 匹配所有 {...} 对象
  const objectPattern = /\{[^{}]*\}/g
  const matches = trimmed.match(objectPattern)
  if (!matches || matches.length === 0) return null

  // 解析每个对象并提取 message
  const objects = matches.map((m) => {
    try {
      return JSON.parse(m)
    } catch {
      return null
    }
  }).filter((o) => o !== null)

  const messages = objects
    .map((o) => (o && typeof o.message === 'string' ? o.message : ''))
    .map((m) => String(m))
    .filter((m) => m.length > 0)

  if (messages.length === 0) return null
  return messages.join('\n')
}
```

## 测试验证
- **测试场景**:
  - 场景1: 截图问答返回单个JSON对象,验证正常解析和渲染
  - 场景2: 截图问答返回拼接JSON（2-3个对象）,验证所有段落都被渲染
  - 场景3: 截图问答返回空帧后再返回内容,验证轮询不会提前结束
  - 场景4: 截图问答返回 `end` 标记,验证轮询正确结束
- **验证方法**:
  - 方法1: 网络面板查看完整响应,对比前端渲染内容
  - 方法2: 控制台日志确认 `extractMessageFromConcatenatedJson` 返回完整内容
  - 方法3: 用户界面显示所有方案/段落,无遗漏

## 预防措施
- 为拼接JSON格式建立单元测试,覆盖各种边界情况
- 在 `handleNonSseResponse` 中添加详细日志,记录每帧的解析结果
- 建立"轮询结束条件"的清单检查表,避免提前结束
- 为 `previewPictureQA` 等特殊接口建立专门的响应格式文档

## 相关链接/参考
- 相关文档: `.specstory/sum/20251212_AI聊天流式接口调用规范缺失问题.md`
- 相关Issue: `20251226_AI聊天移除停止回答AbortController机制问题.md`

## 可复用经验
- **拼接JSON解析模式**: 使用正则 `/\{[^{}]*\}/g` 提取所有对象,逐个解析后合并
- **轮询结束判断**: 明确区分"空帧"、"end标记"、"有内容"三种情况,避免提前结束
- **空白处理策略**: 控制逻辑用 `trim()`,正文内容保留原始格式,段落间用 `\n` 分隔
- **分帧追加换行**: 对于多帧累积的场景,可在 `handleNewContent` 中强制追加换行,确保段落分隔清晰
