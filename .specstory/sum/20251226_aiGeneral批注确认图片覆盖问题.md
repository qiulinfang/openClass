问题01：ai-general批注确认图片覆盖问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`AI通用聊天(ai-general)输入框挂载图片/批注流程`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
ai-general 场景下，用户已挂载图片后再次选择图片进入批注，点击“给学伴/确认”后，输入框上方已挂载的图片会被新图片覆盖，只剩最新一次批注确认的图片。

## 复现步骤
1. 进入 ai-general 聊天输入框。
2. 点击添加图片，进入批注，确认挂载第一张图。
3. 再次点击添加图片，进入批注，确认挂载第二张图。
4. 观察输入框上方图片列表：旧图片被覆盖。

## 用户体验
- 之前挂载的图片丢失，用户需要重新添加。
- 多图提问场景不可用。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/ChatView.vue`：批注弹窗打开/确认合并逻辑
- **涉及模块**：
  - ChatView 截图挂载与批注流程

## 技术原因 (❌)
1. ai-general 批注确认回调中直接对 `localAttachedScreenshots` 做整体赋值，导致覆盖。
2. 打开批注弹窗时没有把当前输入框已挂载图片作为 `annotateExistingShots` 的初始值，确认时合并链路缺失。

错误示例：
```ts
// ChatView.vue
if (props.type === 'ai-general') {
  localAttachedScreenshots.value = finalShots
  return
}
```

## 正确实现方案 (✅)
1. 打开批注弹窗时（ai-general），若 `annotateExistingShots` 为空，则用 `localAttachedScreenshots` 初始化，保证弹窗内“已有截图”与输入框一致。
2. 确认时（ai-general）把本次导出结果与当前输入框已挂载列表做追加合并，再做最多 3 张裁剪。

正确示例：
```ts
// ChatView.vue
if (props.type === 'ai-general') {
  if (annotateExistingShots.value.length === 0 && localAttachedScreenshots.value.length > 0) {
    annotateExistingShots.value = [...localAttachedScreenshots.value]
  }
}

if (props.type === 'ai-general') {
  const combined = [...localAttachedScreenshots.value, ...finalShots]
  localAttachedScreenshots.value = combined.slice(-3)
  return
}
```

## 关键代码/公式
- `openAnnotateDialog()`：初始化 `annotateExistingShots`
- `handleAnnotateConfirm()`：合并追加并 `slice(-3)`

## 测试验证
- **测试场景**：
  - 场景1：已挂载1张，再批注添加第2张，确认后应显示2张。
  - 场景2：连续添加到第4张，最终只保留最新3张。
- **验证方法**：
  - 方法1：观察输入框缩略图列表数量与顺序。
  - 方法2：发送消息时 payload 中图片数量符合预期。

## 预防措施
- 在多图挂载场景避免直接覆盖式赋值，统一使用“合并+裁剪”策略。
- 为挂载图片相关状态增加单元/组件测试用例。

## 相关链接/参考
- 相关文档：`imates-web/src/components/ChatView.vue`

## 可复用经验
- 多来源状态（弹窗态/输入框态）需要明确“单一事实来源”或同步策略，避免覆盖与丢失。
