问题序号：ChatInput组件响应式布局优化

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`ChatInput组件的按钮文本显示`
- **发现日期**：2024-11-12
- **解决状态**：`已解决`

## 问题现象
ChatInput组件的按钮文本隐藏逻辑依赖于屏幕宽度（通过`@media (max-width: 400px)`查询），而非组件自身的实际宽度。这导致在特定布局或容器尺寸下，按钮文本的显示/隐藏行为不符合预期，可能影响用户界面的一致性和可用性。

## 复现步骤
1. 步骤1：将ChatInput组件放置在一个宽度小于400px的容器中，但屏幕宽度大于400px。
2. 步骤2：观察按钮文本是否隐藏。
3. 步骤3：预期是文本应隐藏，但实际可能未隐藏，因为媒体查询基于屏幕宽度而非组件宽度。

## 用户体验
- 影响点1：在分屏或小窗口模式下，按钮文本可能不恰当地显示，导致布局拥挤。
- 影响点2：组件的响应式行为不一致，用户难以预测界面变化。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/ChatInput.vue`：主要的组件文件，包含模板、脚本和样式。
- **涉及模块**：
  - ChatInput组件：负责渲染聊天输入框及其功能按钮。

## 技术原因 (❌)
1. 原因1：使用了全局的CSS媒体查询（`@media (max-width: 400px)`），该查询基于视口宽度，而非组件自身的尺寸。
2. 原因2：缺乏对组件自身宽度的动态监听和响应机制。

```css
/* 错误的实现方式 */
@media (max-width: 400px) {
  .action-mode-btn span {
    display: none;
  }
}
```

## 正确实现方案 (✅)
1. 方案1：使用`ResizeObserver` API监听组件根元素的宽度变化。
2. 方案2：在组件的`onMounted`生命周期钩子中初始化观察者，并在`onUnmounted`中清理。
3. 方案3：根据组件宽度动态设置一个响应式数据属性（如`isNarrow`），并将该属性绑定到组件的根元素上作为CSS类。
4. 方案4：更新CSS，使用类选择器（如`.is-narrow`）来控制按钮文本的显示和隐藏。

```vue
<!-- 正确的实现方式 -->
<template>
  <div ref="chatInputWrapper" :class="{ 'is-narrow': isNarrow }">
    <!-- 组件内容 -->
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const chatInputWrapper = ref(null);
const isNarrow = ref(false);
let resizeObserver = null;

onMounted(() => {
  if (chatInputWrapper.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      isNarrow.value = width < 400;
    });
    resizeObserver.observe(chatInputWrapper.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});
</script>

<style>
.is-narrow .action-mode-btn span {
  display: none;
}
</style>
```

## 关键代码/公式
- 代码片段1：`ResizeObserver`初始化与监听逻辑。
- 代码片段2：响应式数据`isNarrow`的更新逻辑。
- 公式/算法：当`组件宽度 < 400px`时，`isNarrow = true`。

## 测试验证
- **测试场景**：
  - 场景1：调整浏览器窗口大小，观察组件宽度小于400px时按钮文本是否隐藏。
  - 场景2：在开发者工具中模拟不同设备尺寸，验证响应式行为。
- **验证方法**：
  - 方法1：检查组件根元素是否在宽度小于阈值时正确添加`is-narrow`类。
  - 方法2：确认按钮文本的显示状态与`is-narrow`类的存在同步。

## 预防措施
- 措施1：对于组件级别的响应式需求，优先考虑使用`ResizeObserver`而非全局媒体查询。
- 措施2：建立组件设计规范，明确何时使用组件级响应式方案。
- 措施3：在代码审查中关注响应式实现的合理性。

## 相关链接/参考
- 相关文档：`ResizeObserver` API文档
- 参考资源：[MDN ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)

## 可复用经验
- 经验1：`ResizeObserver`是实现元素级响应式的强大工具，适用于需要根据元素自身尺寸调整布局的场景。
- 经验2：将尺寸监听逻辑封装在组件内部，通过CSS类来控制样式，可以提高代码的可维护性和可读性。
- 经验3：始终在组件卸载时清理观察者，以避免内存泄漏。