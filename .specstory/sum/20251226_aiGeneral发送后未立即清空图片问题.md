问题03：ai-general发送后未立即清空图片问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`AI通用聊天(ai-general)发送消息后的输入区状态`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
ai-general 输入框挂载了图片后，点击发送并不会立即清空图片缩略图；只有在 AI 回复成功后才消失。

## 复现步骤
1. ai-general 挂载 1~3 张图片。
2. 点击发送。
3. 观察：图片仍留在输入框上方，直到 AI 回复返回后才消失。

## 用户体验
- 用户误以为图片还没发出去。
- 可能重复点击发送导致重复请求或状态混乱。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/ChatView.vue`：`sendMessage()`

## 技术原因 (❌)
1. 清空 `localAttachedScreenshots` 的逻辑放在 `finally` 或等待请求结束/回复之后，导致 UI 延迟更新。

## 正确实现方案 (✅)
1. 在构造好 `imageDataForApi/imageListForApi` 后、真正 `await` 发送请求前，立即清空 `localAttachedScreenshots`。
2. 移除 `finally` 中的延迟清空逻辑，避免重复与“看起来等回复才清”。

正确示例：
```ts
// ChatView.vue
// 先把图片数据拷贝到请求变量
// ...imageDataForApi/imageListForApi...

// 点击发送即清空 UI
if (props.type === 'ai-general' && localAttachedScreenshots.value.length > 0) {
  localAttachedScreenshots.value = []
}

await chatStrategy.value?.sendMessage(...)
```

## 关键代码/公式
- `ChatView.vue`：`sendMessage()` 中清空时机调整

## 测试验证
- **测试场景**：
  - 场景1：挂载图片后点击发送，缩略图应立即消失。
  - 场景2：发送失败时也应保持已清空（符合“点击发送即清空”的交互定义）。
- **验证方法**：
  - 方法1：观察 UI 是否即时清空。
  - 方法2：抓包确认发送 payload 仍包含图片数据。

## 预防措施
- 将“输入区状态重置”与“请求生命周期”解耦：发送触发即重置输入区。

## 相关链接/参考
- `imates-web/src/components/ChatView.vue`

## 可复用经验
- IM/聊天类产品输入区状态应以“用户动作”为准同步更新，而不是以“服务端回包”为准。
