问题序号：使用 ResizeObserver 监听工具栏高度变化问题

## 问题元信息
- **问题分类**：前端
- **严重程度**：中
- **影响范围**：PDF 阅读页面中依赖工具栏高度计算布局的功能
- **发现日期**：2025-11-17
- **解决状态**：已解决

## 问题现象
在 PdfPage 组件中：
- 工具栏使用 `ResizeObserver` 监听高度变化，以便重新计算 `toolbarHeight` 并更新 PDF 视口布局。
- 若监听或初始化时机不当，可能出现：
  - 工具栏初始高度未正确计算，导致 PDF 内容顶部被遮挡或留白。
  - 工具栏高度变化（如折叠/展开）后，PDF 页布局未更新，滚动或定位偏移。

## 复现步骤
1. 打开包含 `UnifiedToolbar` 的 PDF 阅读页面（PdfPage + PdfViewerView）。
2. 让工具栏在挂载时高度发生变化（例如动态 slot、异步按钮渲染）。
3. 观察：
   - 若未在 `nextTick` 后再测量高度，初始 `toolbarHeight` 可能是 0 或旧值。
   - 工具栏内容变化后，若未正确监听对应 DOM 元素，布局不更新。

## 用户体验
- 工具栏遮挡 PDF 内容，用户需要手动滚动才能看到完整页面。
- 工具栏折叠/展开后，PDF 内容跳动或与预期对齐位置不一致。
- 在小屏幕设备上尤为明显，体验不连贯。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/PdfPage.vue`：PDF 页渲染及布局调整逻辑。
  - `imates-web/src/components/UnifiedToolbar.vue`：统一工具栏组件。
- **涉及模块**：
  - 布局与视口计算模块：依赖 `toolbarHeight` 调整 PDF 页偏移。
  - 工具栏 UI 模块：高度可能根据内容变化。

## 技术原因 (❌)
1. 初始化时机不当：
   - 在组件挂载时立即读取工具栏高度，DOM 尚未完成渲染，获取到的高度不准确。
2. 监听目标不精确：
   - 未针对实际工具栏容器（`.unified-toolbar-container.variant-browser`）使用 `ResizeObserver`，导致高度变化未被捕获。
3. 缺乏统一的高度更新逻辑：
   - 没有在工具栏高度变化后统一调用 `calculateToolbarHeight()` 并触发 PDF 布局更新。

错误示例（简化）：
```ts
onMounted(() => {
  // ❌ 直接读取高度，可能为 0
  calculateToolbarHeight()

  // 未监听工具栏高度变化
})
```

## 正确实现方案 (✅)
1. 在 `onMounted` 中使用 `nextTick` 确保 DOM 渲染完成后再计算高度：
   - `await nextTick(); calculateToolbarHeight()`。
2. 使用 `ResizeObserver` 监听工具栏容器高度变化：
   - 选中 `.unified-toolbar-container.variant-browser` 元素，监听变化并在回调中调用 `calculateToolbarHeight()`。
3. 在组件卸载时释放监听，避免内存泄漏：
   - 在 `onBeforeUnmount` 中调用 `toolbarResizeObserver.disconnect()` 并移除 `resize` 事件监听。

正确实现示例（PdfPage.vue 片段）：

```ts
// ==================== 布局与视口 ====================
const toolbarHeight = ref(0) // 工具栏高度
let toolbarResizeObserver: ResizeObserver | null = null

const calculateToolbarHeight = () => {
  const toolbar = document.querySelector(
    '.unified-toolbar-container.variant-browser',
  ) as HTMLElement | null
  toolbarHeight.value = toolbar?.offsetHeight || 0
}

onMounted(async () => {
  isUnmounting = false

  await nextTick()
  // ✅ 初次挂载后计算工具栏高度
  calculateToolbarHeight()

  // ✅ 使用 ResizeObserver 监听工具栏高度变化
  const toolbar = document.querySelector(
    '.unified-toolbar-container.variant-browser',
  ) as HTMLElement | null
  if (toolbar) {
    toolbarResizeObserver = new ResizeObserver(() => {
      calculateToolbarHeight()
      // 若需要，还可以在这里触发 PDF 布局更新，比如重新计算页偏移
    })
    toolbarResizeObserver.observe(toolbar)
  }

  // 监听窗口大小变化（可选）
  window.addEventListener('resize', handleResize)

  if (props.file) {
    await loadPdf(props.file)
    await loadNotesFromDb()
  }
})

onBeforeUnmount(() => {
  isUnmounting = true

  // ✅ 清理 ResizeObserver
  if (toolbarResizeObserver) {
    toolbarResizeObserver.disconnect()
    toolbarResizeObserver = null
  }

  window.removeEventListener('resize', handleResize)
})
```

## 关键代码/公式
- 代码片段1：使用 `nextTick` 确保 DOM 渲染完成后再测量高度：

```ts
await nextTick()
calculateToolbarHeight()
```

- 代码片段2：使用 `ResizeObserver` 监听工具栏容器：

```ts
const toolbar = document.querySelector(
  '.unified-toolbar-container.variant-browser',
) as HTMLElement | null
if (toolbar) {
  toolbarResizeObserver = new ResizeObserver(() => {
    calculateToolbarHeight()
  })
  toolbarResizeObserver.observe(toolbar)
}
```

## 测试验证
- **测试场景**：
  - 场景1：初次进入 PDF 页面，确认 PDF 内容顶部不被遮挡，滚动正常。
  - 场景2：工具栏内容发生变化（例如显示/隐藏右侧按钮），确认工具栏高度变化后 PDF 布局自动适配。
- **验证方法**：
  - 通过浏览器开发者工具查看 `toolbarHeight` 的变化；
  - 手动缩放窗口，确认布局仍然正确。

## 预防措施
- 在涉及 DOM 尺寸计算时，总是使用 `nextTick` 确保布局完成。
- 对动态高度元素统一使用 `ResizeObserver`，并在组件卸载时清理。
- 与布局相关的状态（如 `toolbarHeight`）集中管理，避免分散在多个组件中。

## 相关链接/参考
- MDN：[`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
- Vue 3 文档：[`nextTick`](https://vuejs.org/api/general.html#nexttick)

## 可复用经验
- 对于顶部/侧边固定工具栏，使用 `ResizeObserver + nextTick` 是一套通用的高度同步模式。
- 把“布局依赖”提炼成专门的 `calculateXXX` 函数，便于在多个场景（挂载、窗口变化、DOM 变动）复用。
- 在复杂交互页面中，始终注意监听资源的清理（Observer / 事件监听），避免内存泄漏和重复计算。
