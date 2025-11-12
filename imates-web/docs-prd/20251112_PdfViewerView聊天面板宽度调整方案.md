# PdfViewerView 聊天面板宽度调整方案

## 问题描述
当聊天面板隐藏时，PDF内容区域的宽度没有变化，左侧区域没有自动占据整个屏幕。

## 根本原因
这是 `q-splitter` 组件的特性导致的。当设置 `:disable="true"` 时，分割器会进入非活动状态，但不会自动调整其内部 `before` 插槽的宽度来填满整个容器。

## 解决方案
通过动态 class 绑定和 CSS 强制宽度调整：

### 1. 模板修改
在 `q-splitter` 组件上添加动态 class 绑定：
```vue
<q-splitter
  v-model="splitterModel"
  :limits="[30, 70]"
  :disable="!chatPanelVisible"
  class="full-height"
  :class="{ 'full-width-before': !chatPanelVisible }"
>
```

### 2. 样式添加
添加 CSS 规则强制 `before` 插槽占据 100% 宽度：
```css
/* 当聊天面板隐藏时，让before插槽占据整个宽度 */
.full-width-before :deep(.q-splitter__before) {
  width: 100% !important;
}
```

## 技术原理
- 使用 Vue 的动态 class 绑定，根据 `chatPanelVisible` 状态切换样式
- 通过 Quasar 的 `q-splitter` 组件内部结构，使用 `:deep()` 选择器访问 `q-splitter__before` 元素
- 使用 `!important` 确保样式优先级，强制覆盖默认的分割器宽度计算

## 预期效果
当用户点击工具栏上的聊天按钮隐藏聊天面板时：
1. 聊天面板会完全消失（通过 `v-if="chatPanelVisible"` 控制）
2. PDF 内容区域会自动扩展到占据整个可用空间
3. 用户获得更大的 PDF 阅读区域

## 测试验证
1. 打开 PDF 查看器页面
2. 确认聊天面板默认显示在右侧
3. 点击工具栏上的聊天按钮隐藏面板
4. 验证 PDF 内容区域是否扩展到全宽
5. 再次点击聊天按钮恢复面板显示
6. 验证布局是否正常恢复

## 相关文件
- `src/views/PdfViewerView.vue` - 主要修改文件

## 实现时间
2025年1月12日