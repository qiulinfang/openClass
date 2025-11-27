问题序号：ChatInput 与 ChatView 多层插槽透传设计问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`聊天输入区域的可扩展性（自定义按钮、提示区域等）`
- **发现日期**：`2025-11-27`
- **解决状态**：`已解决`

## 问题现象
在聊天界面中，需要在输入框上方或输入区域附近放置额外按钮/提示（例如模式切换、标签、提示文案等）。

现有结构为：
- 爷爷组件：如 `UnifiedChatDialog` / `MainChatPanel`。
- 父组件：`ChatView.vue`，负责消息列表与输入组件整体布局。
- 孙组件：`ChatInput.vue`，是真正渲染输入框 UI 的组件。

需求：
- 希望在“爷爷组件”层级就能插入额外的 UI 到 **输入框主容器上方**，而不需要直接引用 `ChatInput`。
- 原始实现中 `ChatInput` 没有提供插槽，`ChatView` 也没有透传机制，导致扩展 UI 只能直接修改 ChatInput 内部模板，耦合度高。

## 复现步骤
1. 在 `UnifiedChatDialog` 或 `MainChatPanel` 中使用 `ChatView` 显示聊天界面。
2. 试图在此层级为输入框上方增加一些按钮或文本时，发现：
   - 只能在 ChatView 外层加 DOM，无法准确插入到 ChatInput 容器附近。
   - 如直接修改 ChatInput，会影响所有使用场景，且不方便按场景差异化配置。

## 用户体验
- 不同聊天场景（AI 通用、老师对话等）需要在输入框附近呈现不同的提示与操作按钮，如果缺少插槽，很难做到按场景灵活配置。
- 使用者需要深入 ChatInput 内部修改模板，增加后续维护成本，且会污染通用组件。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/chat/ChatInput.vue`：聊天输入框组件。
  - `imates-web/src/components/ChatView.vue`：聊天视图组件，包含消息列表与输入组件。
- **涉及模块**：
  - 聊天 UI 组件体系。

## 技术原因 (❌)
1. **ChatInput 未暴露插槽**：
   - 之前的 `ChatInput` 模板仅有固定结构，无法从外部插入扩展内容。
2. **ChatView 未转发插槽**：
   - 即使在 ChatInput 添加插槽，如果 ChatView 不转发，爷爷组件也无法直接使用。
3. **插槽层级设计缺失**：
   - 没有事先规划好“从孙组件向上暴露插槽”的模式，导致后期需求时只能在中间层硬编码。

简化前结构示例：
```vue
<!-- ChatInput.vue -->
<div class="modern-chat-container">
  <div class="chat-input-wrapper">
    <!-- 引用消息、截图、MathFormulaEditor、控制栏等等 -->
  </div>
</div>

<!-- ChatView.vue -->
<ChatInput ... />
```

## 正确实现方案 (✅)
1. **在 ChatInput 上增加主容器上方插槽**：
   - 在 `modern-chat-container` 内、`chat-input-wrapper` 之前添加 `header` 命名插槽。
2. **在 ChatView 中暴露并透传插槽**：
   - 在 `ChatView` 使用 `ChatInput` 时，占用其 `#header` 插槽；
   - 将 `ChatView` 自己的 `#input-header` 插槽内容原样转发给 `ChatInput` 的 `header`。
3. **爷爷组件只与 ChatView 交互**：
   - 在使用 `ChatView` 的地方通过 `#input-header` 插槽插入内容，不直接依赖 `ChatInput`。

关键改动：

**ChatInput.vue**
```vue
<template>
  <div class="modern-chat-container">
    <!-- 主容器上方扩展插槽：可用于放置额外按钮、提示等 -->
    <slot name="header"></slot>

    <!-- 主容器 -->
    <div class="chat-input-wrapper" ref="inputAreaRef" :class="{ 'is-narrow': isNarrow }">
      ...
    </div>
  </div>
</template>
```

**ChatView.vue**
```vue
<ChatInput
  v-if="inputMode === 'full'"
  ref="chatInputRef"
  v-model="inputMessage"
  ...
>
  <!-- 透传 ChatView 的 input-header 插槽到 ChatInput 的 header 插槽 -->
  <template #header>
    <slot name="input-header"></slot>
  </template>
</ChatInput>
```

**使用示例（爷爷组件）**：
```vue
<ChatView
  type="ai-general"
  :compressed-height="225"
>
  <template #input-header>
    <div class="chat-input-header-extra">
      <button @click="doSomething">额外按钮</button>
    </div>
  </template>
</ChatView>
```

## 关键代码/公式
- 孙组件插槽定义：
```vue
<slot name="header"></slot>
```
- 父组件插槽透传：
```vue
<template #header>
  <slot name="input-header"></slot>
</template>
```

## 测试验证
- **测试场景**：
  - 场景1：在某个使用 ChatView 的页面里，通过 `#input-header` 插入一个按钮，确认按钮显示在输入框主容器上方。
  - 场景2：在未提供 `#input-header` 的页面中，确认布局不受影响，行为与改动前一致。
- **验证方法**：
  - 检查 DOM 结构，确认插槽内容位于 `.modern-chat-container` 内、`.chat-input-wrapper` 之前。
  - 多场景对比，保证改动只影响提供插槽的页面。

## 预防措施
- 在设计通用组件（如 ChatInput）时，应预留合理插槽位置，尤其是容器级组件。
- 复杂组件链路（爷爷 → 父 → 孙）要提前规划“插槽透传”模式，避免后期频繁改内部结构。
- 插槽命名要语义化，如 `header`、`toolbar`、`input-header` 等，便于理解与维护。

## 相关链接/参考
- `imates-web/src/components/chat/ChatInput.vue`
- `imates-web/src/components/ChatView.vue`

## 可复用经验
- 多层组件中的插槽可以通过逐层转发的方式实现“爷爷组件控制孙组件局部 UI”，无需打破封装。
- 为通用输入组件设计“头部/尾部/工具栏”插槽，是提升可扩展性的简单而有效的手段。
- 在 Vue3 中通过 `<slot>` + `<template #xxx>` 可以非常优雅地实现插槽透传，无需增加多余的 props 或事件。
