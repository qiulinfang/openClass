问题02：ai-general三张图仍可继续添加问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`AI通用聊天(ai-general)输入框挂载图片上限控制`
- **发现日期**：`2025-12-26`
- **解决状态**：`已解决`

## 问题现象
ai-general 输入框已挂载 3 张图片（上限）后，仍然可以继续点击“加图片”进入选图/批注流程，导致交互与上限规则不一致。

## 复现步骤
1. 进入 ai-general。
2. 连续添加图片至 3 张。
3. 再次点击“加图片”。
4. 仍可进入选图/批注。

## 用户体验
- 上限规则不明确，用户操作被允许但最终可能被裁剪，造成困惑。
- 额外的选图/批注操作浪费时间。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/ChatView.vue`：`showImagePickerDialog`、`handleAnnotateAddMore`
- **涉及模块**：
  - 图片选择器/批注弹窗继续添加逻辑

## 技术原因 (❌)
1. 入口函数 `showImagePickerDialog` 未对 ai-general 的 `localAttachedScreenshots.length` 做上限拦截。
2. 批注弹窗内“继续添加”回调 `handleAnnotateAddMore` 在输入框已达上限时仍允许继续选图。

## 正确实现方案 (✅)
1. 在 `showImagePickerDialog` 中增加上限判断，达到 3 张直接提示并 return。
2. 在 `handleAnnotateAddMore` 中增加上限判断，达到上限直接提示并关闭/清理批注状态。

正确示例：
```ts
if (props.type === 'ai-general' && localAttachedScreenshots.value.length >= 3) {
  showMessage('最多只能添加 3 张图片', 'info')
  return
}
```

## 关键代码/公式
- `ChatView.vue`：
  - `showImagePickerDialog()` 上限拦截
  - `handleAnnotateAddMore()` 上限拦截

## 测试验证
- **测试场景**：
  - 场景1：已挂载3张，点击加图片，应提示并不进入选图。
  - 场景2：挂载2张，点击加图片，正常进入选图并追加。
- **验证方法**：
  - 方法1：UI操作验证。
  - 方法2：确认 `localAttachedScreenshots` 长度不会超过 3。

## 预防措施
- 所有入口（按钮/快捷操作/弹窗内继续添加）都必须做一致的上限校验。

## 相关链接/参考
- `imates-web/src/components/ChatView.vue`

## 可复用经验
- 上限控制应在“入口层”和“流程中间层”双重兜底，避免绕过。
