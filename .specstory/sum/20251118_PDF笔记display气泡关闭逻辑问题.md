问题序号：PDF笔记display气泡关闭逻辑问题

## 问题元信息
- **问题分类**：`前端`
- **严重程度**：`中`
- **影响范围**：`PDF 阅读页中已保存笔记的 display 模式气泡交互`
- **发现日期**：`2025-11-18`
- **解决状态**：`已解决`

## 问题现象
在 PDF 笔记的 display 模式下，当用户点击某个笔记锚点气泡 icon 时，会在该位置弹出显示内容的气泡卡片（`PdfNoteAnchor` display 模式），并通过 `activeNoteId` 控制显示/隐藏。但存在以下问题：

- 气泡展开后，再点击 PDF 页面其他空白区域时，display 气泡不会自动收起。
- 用户想在同一页面继续添加新的笔记或进行其他操作时，display 气泡仍停留在原位置，遮挡内容或干扰后续点击。

## 复现步骤
1. 在 PDF 页面 note 模式下，先创建若干个笔记（保证右侧列表有内容）。
2. 点击某个笔记锚点气泡 icon，展开 display 模式的笔记气泡（`activeNoteId` 被设置为该 note 的 id）。
3. 点击 PDF 页面空白区域。
4. 实际表现：display 气泡仍然停留在原位置，没有自动关闭。
5. 预期行为：在笔记模式下，点击页面空白区域时，如有已展开的 display 气泡，应先将其关闭（即清空 `activeNoteId`）。

## 用户体验
- 影响点1：display 气泡不自动收起，会长期遮挡 PDF 内容，影响阅读与继续操作。
- 影响点2：用户难以通过自然的“点击空白处”关闭气泡，只能再点击一次对应锚点，交互不符合直觉。
- 影响点3：在 note 模式下频繁切换不同笔记时，多个 display 气泡可能轮流出现，容易造成视觉与操作干扰。

## 相关文件/模块
- **涉及文件**：
  - `imates-web/src/components/PdfPage.vue`：整体 PDF 页面组件，管理 `activeNoteId` 状态和 `handlePageClick`、`onNoteMarkerClick` 逻辑。
  - `imates-web/src/components/PdfNoteAnchor.vue`：笔记锚点组件，通过 `active` 属性控制 display 模式气泡的显示。
- **涉及模块**：
  - PDF 笔记展示与交互模块。

## 技术原因 (❌)
1. 原因1：`onNoteMarkerClick` 在用户点击笔记气泡 icon 时，只负责设置 `activeNoteId` 和右侧列表选中状态，没有配套关闭逻辑。
2. 原因2：`handlePageClick` 仅针对 create 模式的内联输入做了“点击外部自动保存/取消”的处理，没有在“无 create 输入、仅有 display 展开”的情况下注入关闭 display 的逻辑。
3. 原因3：缺少“在 note 模式下点击空白区域优先关闭 display 气泡”的统一入口，导致 display 气泡生命周期和其他交互（如新增笔记）脱节。

❌ 错误代码示例（缺少 display 关闭逻辑）：
```ts
// PdfPage.vue（问题前，节选）
const handlePageClick = (
  event: MouseEvent,
  pageIndex: number,
  layout: { width: number; height: number }
) => {
  // 非绘图模式 + 处于笔记模式才处理点击
  if (['highlighter', 'pen', 'eraser-draw'].includes(currentMode.value)) return
  if (currentMode.value !== 'note') return

  // 仅处理 create 模式的内联输入
  if (editingInlineNote.value) {
    const text = inlineNoteText.value.trim()
    if (text) {
      handleInlineCreateConfirm(text)
      return
    } else {
      handleInlineCreateCancel()
      return
    }
  }

  // 直接进入创建新笔记锚点的逻辑...
}
```

## 正确实现方案 (✅)
1. 方案1：在 `handlePageClick` 中增加一个优先级更高的分支：当当前处于 note 模式、`editingInlineNote` 为空且 `activeNoteId` 非空时，点击页面的第一件事是关闭 display 气泡，即将 `activeNoteId` 置空并直接 `return`，不再创建新的笔记。
2. 方案2：保持 `PdfNoteAnchor` display 模式渲染逻辑不变，通过 `:active="activeNoteId === note.id"` 统一控制，并在模板中使用 `v-if="mode === 'display' && active"`，保证只会有一个 display 气泡处于展开状态。
3. 方案3：将 display 关闭逻辑限定在 note 模式下，避免 hand/其他模式误关闭笔记提示。

✅ 正确代码示例（增加 display 关闭逻辑）：
```ts
// PdfPage.vue（修复后，节选）
const handlePageClick = (
  event: MouseEvent,
  pageIndex: number,
  layout: { width: number; height: number }
) => {
  // 非绘图模式 + 处于笔记模式才处理点击
  if (['highlighter', 'pen', 'eraser-draw'].includes(currentMode.value)) return
  if (currentMode.value !== 'note') return

  // ✅ 优先处理已展开的 display 模式气泡
  if (!editingInlineNote.value && activeNoteId.value) {
    activeNoteId.value = null
    return
  }

  // 处理 create 模式的内联新增输入
  if (editingInlineNote.value) {
    const text = inlineNoteText.value.trim()
    if (text) {
      handleInlineCreateConfirm(text)
      return
    } else {
      handleInlineCreateCancel()
      return
    }
  }

  // 之后才是创建新 tempNote 的逻辑...
}
```

✅ 正确代码示例（display 气泡渲染保持不变）：
```vue
<!-- PdfPage.vue 模板中，display 模式锚点 -->
<PdfNoteAnchor
  v-for="note in pageNotesByIndex[index] || []"
  :key="note.id"
  mode="display"
  :x="note.x"
  :y="note.y"
  :page-layout="layout"
  :text="note.text"
  :active="activeNoteId === note.id"
  @marker-click="onNoteMarkerClick(note)"
/>
```

```ts
// 点击锚点时设置 activeNoteId
const onNoteMarkerClick = (note: PageNote) => {
  activeNoteId.value = note.id
  selectedNoteId.value = note.id
  isNotePanelOpen.value = true
}
```

## 关键代码/公式
- 代码片段1：`handlePageClick` 中优先关闭 display 气泡的逻辑分支。
- 代码片段2：`activeNoteId` 与 display 模式 `PdfNoteAnchor` 的绑定关系。

```ts
// 关键关闭逻辑
if (!editingInlineNote.value && activeNoteId.value) {
  activeNoteId.value = null
  return
}
```

## 测试验证
- **测试场景**：
  - 场景1：在 note 模式下点击某个笔记锚点展开 display 气泡，然后点击页面空白区域，确认气泡被关闭且不会创建新的内联输入锚点。
  - 场景2：在 note 模式下先存在一个 create 模式气泡，再展开 display 气泡，点击空白区域时应优先处理 create（保存/取消），display 的打开/关闭与 create 不互相干扰。
- **验证方法**：
  - 方法1：通过 Vue DevTools 观察 `activeNoteId` 的变化，确保点击空白区域时该值被置空。
  - 方法2：在不同页面、多条笔记间频繁切换锚点，确认再点击空白处时 display 气泡均能正确收起。

## 预防措施
- 措施1：在设计交互逻辑时，为所有“弹出层/气泡”统一考虑“点击外部关闭”的行为，并在入口函数（如 `handlePageClick`）集中处理。
- 措施2：对与 "active/selected" 状态相关的变量（如 `activeNoteId`、`selectedNoteId`）建立明确的生命周期管理和优先级规则。
- 措施3：增加针对弹出层的交互测试用例，覆盖常见操作路径（点击图标、点击空白、多次切换）。

## 相关链接/参考
- 相关文档：无（项目内部交互约定）。
- 相关Issue：无。
- 参考资源：常见 UI 框架中 Tooltip/Popover 的“点击外部关闭”模式。

## 可复用经验
- 经验1：对于 "active" 状态控制的组件（如气泡、对话框），建议集中在容器组件中统一处理关闭逻辑，而不是分散在各个子组件内部。
- 经验2：在点击事件入口处（如页面 click handler）明确优先级：先处理关闭已有浮层，再处理新建操作，避免状态冲突。
- 经验3：使用单一源（例如 `activeId`）控制同类浮层的显示状态，可以显著简化逻辑并避免多个浮层同时显示。
