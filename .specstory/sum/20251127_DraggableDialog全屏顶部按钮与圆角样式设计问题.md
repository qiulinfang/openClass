问题序号：DraggableDialog 全屏顶部按钮与圆角样式设计问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`统一聊天对话框、所有使用 DraggableDialog 的全屏对话框`
- **发现日期**：`2025-11-27`
- **解决状态**：`已解决`

## 问题现象
在重构 `DraggableDialog.vue` 时，需要实现如下视觉与交互效果：
- 全屏模式下：不显示传统标题栏，只在右上角显示悬浮关闭按钮；后续又增加“大小切换 + 关闭”两个图标的需求。
- 全屏状态下，内容区域顶部需要有圆角（左上、右上），而整体容器仍为全屏无圆角。
- 遮罩与对话框背景、全屏顶部按钮的布局和样式需要整体协调。

在迭代过程中曾出现：
- 全屏时仍渲染标题栏，导致与新设计冲突。
- 全屏内容区域无圆角，上下边界生硬。
- 顶部双按钮样式、位置不统一，甚至出现多处重复 / 冲突的 `.fullscreen-top-buttons` 样式定义。

## 复现步骤
1. 在使用 `UnifiedChatDialog` 的页面中打开 AI 统一聊天对话框（已被设置为全屏 `fullscreen=true`）。
2. 观察：
   - 早期版本：仍有标题栏，关闭按钮在标题栏右侧，与设计不符。
   - 圆角缺失：全屏内容顶部直角，与背景过渡生硬。
   - 顶部按钮位置、尺寸多次调整前不统一。

## 用户体验
- 全屏对话框视觉不够“沉浸”，类似普通弹框放大，缺少专门的全屏样式处理。
- 关闭按钮与大小切换按钮不统一，用户不容易理解其作用。
- 无顶部圆角时，内容区域像一块矩形叠在深色背景上，观感略生硬。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/DraggableDialog.vue`：对话框容器、全屏逻辑、拖拽/缩放、顶部按钮与圆角样式。
  - `imates-web/src/components/UnifiedChatDialog.vue`：以全屏模式使用 DraggableDialog。
- **涉及模块**：
  - 全局对话框基础组件。
  - 统一聊天对话框 UI。

## 技术原因 (❌)
1. **全屏与非全屏逻辑混合**：
   - 初期未区分 `fullscreen` 状态下是否渲染标题栏，导致全屏和普通模式使用相同标题结构。
2. **圆角与容器边界未区分层级**：
   - `.dialog-container.fullscreen` 设置 `border-radius: 0` 后，内部 `.dialog-content-section` 也未单独加圆角，造成整体直角。
3. **顶部按钮样式重复与命名混乱**：
   - 多次尝试 `.fullscreen-top-buttons`、`.fullscreen-toggle-btn` 等样式，部分定义放在组件根部、部分在 `.draggable-dialog-card` 内，产生冲突和无法生效的问题。

错误样式示例（曾存在的残留）：
```scss
.fullscreen-top-buttons {
  top: 20px;
  right: 20px;
  display: flex;
  justify-content: ; // 缺少值导致 SCSS 报错
}
```

## 正确实现方案 (✅)
1. **拆分标题栏逻辑**：
   - 无左侧面板分支中，`v-if="!fullscreen"` 显示标题栏；`v-else` 仅显示右上角悬浮按钮容器，不再渲染标题栏。
2. **内容区域单独加圆角**：
   - 容器 `.dialog-container.fullscreen` 保持无圆角；
   - 在 `.draggable-dialog-card` 内，为 `.dialog-content-section` 根据 `fullscreen` 动态添加 `dialog-content-rounded` 类，设置顶部圆角与边框。
3. **统一顶部按钮容器与样式**：
   - 采用 `<div class="fullscreen-top-buttons">` 包裹左右两个 `img`：左为 Switcher，右为 close；按钮样式从多个 class 收拢到 `.fullscreen-top-buttons .switcher-btn` / `.close-btn` 中统一控制。

关键模板代码：
```vue
<!-- 无左侧面板时的主内容 -->
<div v-else class="draggable-dialog-card">
  <!-- 非全屏：标题栏 -->
  <div v-if="!fullscreen" class="dialog-header-section draggable-header" ...>
    ...
  </div>

  <!-- 全屏：右上角两个图标（左：大小切换，右：关闭） -->
  <div v-else class="fullscreen-top-buttons">
    <img
      :src="switcherIcon"
      alt="toggle size"
      class="switcher-btn"
      @click.stop="handleToggleFullscreen"
    />
    <img
      :src="closeIcon"
      alt="close"
      class="close-btn"
      @click.stop="handleClose"
    />
  </div>

  <div class="dialog-content-section" :class="{ 'dialog-content-rounded': fullscreen }">
    <slot></slot>
  </div>

  <div class="resize-handle" ...></div>
</div>
```

样式：
```scss
.dialog-container.fullscreen {
  max-width: 100vw;
  max-height: 100vh;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
  box-shadow: none;
}

.draggable-dialog-card {
  .dialog-content-section {
    flex: 1;
    background: #ffffff;
  }

  // 全屏状态下内容顶部圆角
  .dialog-content-rounded {
    border-top-left-radius: 32px;
    border-top-right-radius: 32px;
    overflow: hidden;
    border: 1px solid #452626;
  }

  .fullscreen-top-buttons {
    display: flex;
    justify-content: space-between;
    padding: 10px;

    .switcher-btn,
    .close-btn {
      width: 30px;
      height: 30px;
      cursor: pointer;
    }
  }
}
```

## 关键代码/公式
- 全屏标题栏隐藏逻辑：
```vue
<div 
  v-if="!fullscreen"
  class="dialog-header-section draggable-header"
>
  ...
</div>
<!-- fullscreen 时走 v-else 分支渲染顶部图标 -->
```

- 内容圆角应用：
```vue
<div
  class="dialog-content-section"
  :class="{ 'dialog-content-rounded': fullscreen }"
>
  <slot></slot>
</div>
```

## 测试验证
- **测试场景**：
  - 场景1：打开 UnifiedChatDialog，确认对话框为全屏、无标题栏，只在右上角显示两个图标。
  - 场景2：观察内容区顶部是否有圆角，且与背景过渡自然。
  - 场景3：在非全屏模式（未来如有）下，标题栏与内容区域表现是否保持原来的风格，无多余圆角。
- **验证方法**：
  - 手动对比设计稿与实际 UI。
  - 检查控制台是否存在 SCSS 语法错误或样式冲突。

## 预防措施
- 所有通用组件（如弹窗）在引入 `fullscreen` 等模式时，提前设计好“结构 + 样式 + 行为”的分支，而不是在原有结构上堆叠条件判断。
- 样式命名尽量语义化并集中管理，避免在多个作用域中定义相同类名导致冲突。
- 每次大改 UI 时优先清理无用样式，减少历史样式残留。

## 相关链接/参考
- `imates-web/src/components/DraggableDialog.vue` 当前实现。

## 可复用经验
- 全屏模式与普通模式应分别设计结构，而非简单通过样式开关控制显示与否。
- 圆角、阴影、背景等视觉属性可以通过“内外两层容器分离”来精细控制（外层负责布局，内层负责视觉）。
- 顶部控制按钮（关闭、放大/缩小等）集中在一个容器内管理布局，更利于后续扩展快捷按钮。
