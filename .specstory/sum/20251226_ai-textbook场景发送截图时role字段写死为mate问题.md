# ai-textbook场景发送截图时role字段写死为mate问题

## 问题元信息
- **问题分类**：前端
- **严重程度**：高
- **影响范围**：ai-textbook场景的AI聊天功能，用户在切换AI模型后发送截图/图片时role字段仍为固定值
- **发现日期**：2025-11-08
- **解决状态**：已解决

## 问题现象
在PDF教材页（ai-textbook场景）中，用户可以切换不同的AI模型（如从mate切换到其他模型）。但是当用户发送截图或图片消息时，后端请求体中的`role`字段始终被写死为`mate`，与用户选择的模型不一致，导致AI回复使用错误的模型。

## 复现步骤
1. 步骤1：在PDF教材页切换AI模型为非mate的选项
2. 步骤2：截取PDF内容或上传图片
3. 步骤3：发送消息，检查后端请求体中的role字段始终为'mate'

## 用户体验
- 用户切换AI模型后期望使用选定的模型进行回答
- 实际收到的是默认mate模型的回复，造成困惑
- 影响AI聊天功能的准确性和用户信任度

## 相关文件/模块
- **涉及文件**：
  - `d:\Project\xueban-qianduan\imates-web\src\views\PdfViewerView.vue`：处理PDF截图发送的逻辑，包含写死role的问题
  - `d:\Project\xueban-qianduan\imates-web\src\components\ChatView.vue`：聊天组件，发送截图事件触发处
  - `d:\Project\xueban-qianduan\imates-web\src\components\PdfChatPanel.vue`：透传发送截图事件
  - `d:\Project\xueban-qianduan\imates-web\src\stores\aiTextbookChatStore.ts`：AI教材聊天状态管理
- **涉及模块**：
  - PDF查看器模块：处理PDF显示和交互
  - AI聊天模块：处理不同场景的聊天逻辑

## 技术原因 (❌)
1. **事件参数缺失**：`ChatView.vue`的`send-with-screenshot`事件只传递了`text`和`screenshots`，未包含`selectedModel`
2. **硬编码role值**：`PdfViewerView.vue`的`handlePdfSendWithScreenshot`方法直接写死`role: 'mate'`
3. **组件间通信不完整**：`PdfChatPanel.vue`作为中间组件未正确透传`selectedModel`参数

错误的代码示例：
```typescript
// ❌ PdfViewerView.vue - 硬编码role
const handlePdfSendWithScreenshot = async (text: string, shots: AttachedScreenshot[]) => {
  // ...
  await aiTextbookStore.sendMessage(
    text,
    'mate', // 硬编码
    imageData,
    false,
    false,
  )
}

// ❌ ChatView.vue - 事件定义缺少selectedModel
'send-with-screenshot': [string, import('../types').AttachedScreenshot[]]
```

## 正确实现方案 (✅)
1. **扩展事件签名**：在`ChatView.vue`中为`send-with-screenshot`事件添加`selectedModel`参数
2. **透传参数**：`PdfChatPanel.vue`正确透传`selectedModel`到父组件
3. **使用动态role**：`PdfViewerView.vue`接收并使用`selectedModel`，提供'mate'作为默认值

正确的代码示例：
```typescript
// ✅ PdfViewerView.vue - 使用动态selectedModel
const handlePdfSendWithScreenshot = async (text: string, shots: AttachedScreenshot[], selectedModel?: string) => {
  // ...
  await aiTextbookStore.sendMessage(
    text,
    selectedModel || 'mate', // 动态使用selectedModel
    imageData,
    false,
    false,
  )
}

// ✅ ChatView.vue - 事件签名包含selectedModel
'send-with-screenshot': [string, import('../types').AttachedScreenshot[], string]

// ✅ PdfChatPanel.vue - 正确透传参数
@send-with-screenshot="(text, shots, selectedModel) => emit('send-with-screenshot', text, shots, selectedModel)"
```

## 关键代码/公式
- **事件透传逻辑**：
  ```typescript
  // PdfChatPanel.vue - 透传selectedModel
  @send-with-screenshot="(text, shots, selectedModel) => emit('send-with-screenshot', text, shots, selectedModel)"
  ```
- **动态role赋值**：
  ```typescript
  // PdfViewerView.vue - 动态role
  selectedModel || 'mate'
  ```

## 测试验证
- **测试场景**：
  - 场景1：PDF教材页切换AI模型为非mate，发送截图消息，验证请求体role字段与选中模型一致
  - 场景2：PDF教材页切换AI模型为mate，发送截图消息，验证正常使用mate模型
  - 场景3：ai-general和ai-exercise场景发送图片，验证role字段不受影响
- **验证方法**：
  - 检查浏览器网络请求中的role字段值
  - 验证AI回复是否使用正确的模型（通过UI头像或气泡显示）

## 预防措施
- 在设计组件间通信时，确保所有必要参数都包含在事件签名中
- 避免在业务逻辑层硬编码配置值，改为从UI层动态传递
- 为可选参数提供合理的默认值，确保向后兼容性

## 相关链接/参考
- 相关文档：`d:\Project\xueban-qianduan\docs-prd\会话和消息持久化存储分析.md`
- 相关Issue：无

## 可复用经验
- **组件通信设计模式**：在Vue组件间传递复杂数据时，使用事件参数而非props可以减少耦合
- **默认值处理**：为可选参数提供合理的默认值，确保API的健壮性
- **参数一致性**：在多层组件透传时，确保参数类型和顺序的一致性
