问题2：ChatInput删除缩略图导致多张被删除问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`高`
- **影响范围**：`AI聊天 ChatInput 已挂载截图缩略图删除交互（ai-general）`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
在 `MainChatPanel.vue` / `UnifiedChatDialog.vue` 的聊天输入框（`ChatInput`）中：
- 当挂载了多张截图（尤其是内容相同/重复操作后），删除某一张缩略图时，**其余缩略图也被一起删除**。

## 复现步骤
1. 在 `ai-general` 聊天场景中，通过截图/批注流程向输入框挂载多张截图（最多 3 张）。
2. 观察输入框缩略图区出现 3 张图。
3. 点击删除第 1 张缩略图。
4. 观察 `ChatView` 日志：`beforeLength: 3 -> afterLength: 1`，即删除 1 张但实际减少 2 张。

## 用户体验
- 用户想保留的截图被误删。
- 多图对话场景易造成内容缺失，需重复截图。
- 对“删除”动作缺乏信任，影响使用效率。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/ChatView.vue`：本地截图列表 `localAttachedScreenshots` 管理、合并/删除
  - `imates-web/src/components/chat/ChatInput.vue`：缩略图展示与删除事件上抛
  - `imates-web/src/components/ScreenshotInputDialog.vue`：批注确认回传 shots 的合并入口
- **涉及模块**：
  - ai-general 截图批注挂载（多图）

## 技术原因 (❌)
1. 删除逻辑按 `id` 过滤是正确的：
   - `localAttachedScreenshots = filter(shot.id !== id)`
2. 真实问题是：**列表中存在重复的 `id`**（同一张图被加入了两次或合并策略导致重复项）。
3. `ChatView.handleAnnotateConfirm` 中，`finalShots` 已经由 `annotateExistingShots + exported` 合并得到，但 ai-general 分支又将 `localAttachedScreenshots` 与 `finalShots` 二次叠加，导致旧图重复、`id` 重复。

错误示例（摘取思路，示意）：
```ts
// ❌ finalShots 已包含旧图，却又和 localAttachedScreenshots 叠加
const combined = [...localAttachedScreenshots.value, ...finalShots]
localAttachedScreenshots.value = combined.slice(-3)

// 删除时按 id 过滤会一次删掉所有同 id 项
localAttachedScreenshots.value = localAttachedScreenshots.value.filter(s => s.id !== id)
```

## 正确实现方案 (✅)
1. ai-general 批注确认后，`localAttachedScreenshots` 应以“最终合并结果”为准，避免二次叠加。
2. 对最终列表按 `id` 去重，确保每个截图 `id` 唯一。

正确示例（实际修复逻辑摘要）：
```ts
const uniqueFinalShots: AttachedScreenshot[] = []
const seen = new Set<string>()
for (const s of finalShots) {
  if (!s?.id || !s?.dataUrl) continue
  if (seen.has(s.id)) continue
  seen.add(s.id)
  uniqueFinalShots.push(s)
}

localAttachedScreenshots.value = uniqueFinalShots
```

## 关键代码/公式
- **关键代码片段**：
```ts
// ChatView.vue
const handleRemoveScreenshot = (id: string) => {
  localAttachedScreenshots.value = localAttachedScreenshots.value.filter((shot) => shot.id !== id)
}
```

## 测试验证
- **测试场景**：
  - 场景1：连续添加 3 张截图，删除其中一张。
  - 场景2：3 张截图 dataUrl 完全相同，删除其中一张。
  - 场景3：多次打开批注弹窗确认，确保不会插入重复 id。
- **验证方法**：
  - 方法1：删除前后 `length` 应满足 `3 -> 2 -> 1 -> 0`。
  - 方法2：日志中 `remainingScreenshots` 的 `id` 列表无重复。

## 预防措施
- 合并列表时使用幂等策略：`按 id replace/去重`，而不是简单 `push/concat`。
- 在关键数据结构（截图列表）上加断言/开发态告警：检测重复 `id`。

## 相关链接/参考
- 相关文档：`imates-web/src/components/ChatView.vue`（handleAnnotateConfirm / handleRemoveScreenshot）

## 可复用经验
- “删除一条却删多条”优先检查：数据源是否存在重复主键。
- 合并策略（merge）应具备幂等性，避免重复执行带来重复数据。
