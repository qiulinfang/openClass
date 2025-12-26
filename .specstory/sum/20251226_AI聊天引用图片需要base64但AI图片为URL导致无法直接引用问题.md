问题序号：AI聊天引用图片需要base64但AI图片为URL导致无法直接引用问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`AI聊天图片引用；题目/教材/通用聊天中与 previewPictureQA 相关的图片能力`
- **发现日期**：`2025-12-26`
- **解决状态**：`进行中`

## 问题现象
- 当前系统“能稳定携带图片”的主要接口是 `previewPictureQA`（截图问答），其 `question`/`imageList.base64DataUrl` 期望 base64 DataURL。
- 聊天气泡的图片存在两类：
  - **用户图片气泡**：通常存的是 `base64DataUrl`（data:image/...;base64,xxx），可直接复用。
  - **AI 图文气泡**：图片往往来自 Markdown 渲染的 `<img src="https://...">` 链接（URL），而不是 base64。
- 当用户引用的是“AI 输出的图片 URL”时：
  - 前端无法直接拿到 base64
  - 导致无法按 `previewPictureQA` 的协议把图片塞进 `question` 或 `imageList`。

## 复现步骤
1. 让 AI 回复一条包含图片链接的消息（AI 图文混排）。
2. 在该气泡上点击“引用图片”。
3. 发送消息。
4. 观察 payload：只有 URL，没有 base64，导致后端图片问答接口无法识别/处理。

## 用户体验
- 用户无法“引用 AI 生成的图”继续追问。
- 引用图片行为在不同来源下不一致：
  - 引用用户截图 OK
  - 引用 AI 图片不稳定/失败

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/stores/aiExerciseChatStore.ts`：`buildAiExerciseMessage` 在 `imageData.base64DataUrl` 时把 `question` 设为 base64，并设置 `dstUrl: /permission/previewPictureQA`。
  - `imates-web/src/stores/aiTextbookChatStore.ts`：`buildAiTextbookMessage` 截图模式使用 `dstUrl: /permission/previewPictureQA` 并携带 `imageList`。
  - `imates-web/src/stores/aiGeneralChatStore.ts`：截图模式同样指向 `previewPictureQA` 并携带 `imageList`。
  - `imates-web/src/composables/useMessageRenderer.ts`：Markdown 渲染允许输出 `<img>`，AI 图片多为 URL。
  - `imates-web/src/components/chat/ImageMessage.vue`：图片消息组件只使用 `base64DataUrl` 作为 `img.src`。
- **涉及模块**：
  - 图片消息数据模型（base64 vs URL）
  - 引用链路（quote -> sendMessage -> store -> api）

## 技术原因 (❌)
1. **接口能力差异**：
   - `previewPictureQA` 需要 base64 DataURL（或 `imageList.base64DataUrl`）。
   - 普通 chat 接口更多处理文本，对“图片引用”未形成统一约束。
2. **消息数据不统一**：
   - 用户图片：前端天然有 base64（本地选择/截图）。
   - AI 图片：通常只有 URL（来自 Markdown 内容），缺乏 base64 缓存。
3. **URL 转 base64 的前端限制**：
   - 直接 `fetch(url)` 再 `blob -> FileReader -> dataURL` 会遇到 CORS；
   - 某些 URL 需要鉴权 cookie/header；
   - 大图转 base64 可能带来内存/性能问题。

错误示例（期望 base64，但实际是 URL，示意）：
```typescript
// ❌ 引用到的是 https URL，但 previewPictureQA 需要 data:image/...;base64
request.question = 'https://xx.com/ai-image.png'
```

## 正确实现方案 (✅)
1. **优先复用已有 base64**：
   - 若引用消息本身带 `imageData.base64DataUrl`（用户截图/上传图），直接作为 `question` 或 `imageList.base64DataUrl`。
2. **为 AI 图片 URL 建立“可转 base64”的链路**（需选择其一或组合）：
   - 方案A：前端 fetch + blob 转 base64
     - 前提：图片 URL 支持跨域（CORS 允许）或同域可访问
   - 方案B：后端提供“图片代理/转码接口”
     - 前端把 URL 发给后端，由后端拉取并转为 base64 或直接作为文件流处理
     - 优点：绕过浏览器 CORS；可统一鉴权
   - 方案C：在 AI 生成图片时就同步保存 base64/文件到对象存储，并在消息结构里返回可直接用于 `previewPictureQA` 的 base64 或内部 fileId
3. **降级策略**：
   - URL 无法转 base64 时：提示“该图片不可引用，请保存到本地后再引用/截图引用”。

正确示例（前端转 base64，示意）：
```typescript
// ✅ 仅在同域或 CORS 允许时可用
async function urlToDataUrl(url: string): Promise<string> {
  const resp = await fetch(url, { mode: 'cors', credentials: 'include' })
  const blob = await resp.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
```

## 关键代码/公式
- base64 DataURL 形态：
```text
data:image/png;base64,xxxxxxxx
```

- previewPictureQA 请求关键字段（现状）：
```typescript
// 当 imageData.base64DataUrl 存在时
{
  dstUrl: '/permission/previewPictureQA',
  question: '<base64 dataURL>',
  imageList?: [{ base64DataUrl: '<base64 dataURL>' }]
}
```

## 测试验证
- **测试场景**：
  - 场景1：引用用户截图图片（base64）
    - 预期：可正常发送并触发图片 QA。
  - 场景2：引用 AI 图文中的 URL 图片（CORS 允许）
    - 预期：URL 可转 base64，走图片 QA。
  - 场景3：引用 AI 图文中的 URL 图片（CORS 不允许）
    - 预期：触发降级提示，不发送错误 payload。
- **验证方法**：
  - 抓包确认 `question/imageList.base64DataUrl` 是否为 DataURL。
  - 观察内存占用与 UI 卡顿（大图转码时）。

## 预防措施
- 在消息模型层面区分并显式标注：`imageSourceType: 'dataUrl' | 'url'`。
- 建立统一的“引用图片归一化”函数：输入（base64/url），输出（可用于 previewPictureQA 的 base64 或失败原因）。
- 若业务强依赖引用 AI 图片：推动后端提供图片代理/转码接口，避免浏览器 CORS。

## 相关链接/参考
- 相关文档：`imates-web/src/stores/aiExerciseChatStore.ts`、`imates-web/src/stores/aiTextbookChatStore.ts`
- 参考资源：浏览器 CORS 与 fetch/blob/dataURL 转换

## 可复用经验
- 图片能力要么统一走“上传/文件ID”，要么统一走“base64”，避免一会儿 URL 一会儿 base64。
- 涉及第三方 URL 的前端处理要提前评估 CORS、鉴权与性能，最好由后端提供统一代理。 
