问题序号：Pdf手写涂抹高亮-MuPDF-Ink实现

## 问题元信息
- **问题分类**：`前端 / PDF 注释`
- **严重程度**：`中`
- **影响范围**：`PdfPage 中的手写高亮体验、注释持久化能力`
- **发现日期**：2025-11-19
- **解决状态**：`已实现基础版`

## 背景
- 目标是在 PDF 页面上支持“手写涂抹高亮”能力，效果类似荧光笔，在文字上随手划过即可生成高亮。
- 要求：
  - 不再依赖前端 canvas 叠加图层，而是**使用 MuPDF 的原生注释 API**（Ink / Highlight 等）；
  - 和现有的 PdfPage 组件保持一致的坐标与缩放行为；
  - 可以通过 PdfViewerView 顶部工具栏切换“高亮模式”；
  - 后续可以将带注释的 PDF 保存到 IndexedDB 或后端。

---

## 2025-11-19 更新：MuPDF Ink 高亮基础实现

### 1. MuPDF Ink 注释基础

- MuPDF 支持多种注释类型，其中包含 `Ink`：

```ts
// 注释类型枚举
// type PDFAnnotationType = 'Text' | 'Link' | ... | 'Highlight' | 'Ink' | ...

const pdfDoc = document.asPDF()
if (pdfDoc) {
  const page = pdfDoc.loadPage(pageIndex) as mupdf.PDFPage
  const annot = page.createAnnotation('Ink')

  // 典型操作（API 形式依赖 MuPDF.js 版本）：
  // annot.setInkList(inkList)
  // annot.setColor([1, 1, 0])
  // annot.setBorderWidth(width)

  page.update() // 应用注释更改
}
```

- Ink 注释本质上是 **若干条笔画（paths）** 的集合，每条笔画由一组点（Point）组成。

```ts
type Point = [number, number]
// InkList: Point[][]
```

### 2. PdfPage 中的高亮模式状态

在 `imates-web/src/components/pdfpage.vue` 中新增高亮模式状态，与笔记模式互斥：

```ts
const isAddingNote = ref(false)
const isHighlightMode = ref(false)

defineExpose({
  toggleDebugPanel: () => {
    showDebugPanel.value = !showDebugPanel.value
  },
  toggleNoteMode: () => {
    isAddingNote.value = !isAddingNote.value
    if (isAddingNote.value) {
      isHighlightMode.value = false
    }
  },
  toggleHighlightMode: () => {
    isHighlightMode.value = !isHighlightMode.value
    if (isHighlightMode.value) {
      isAddingNote.value = false
    }
  },
})
```

- 设计要点：
  - 保持“模式互斥”：高亮模式和添加笔记模式不可同时开启，降低交互混乱；
  - 暂不引入完整的 `currentMode` 枚举，仅在现有布尔状态上实现最小改动版。

### 3. Stroke 数据结构与坐标转换

#### 3.1 Stroke 数据结构

```ts
interface HighlightStrokePoint {
  x: number // PDF 页面坐标系中的 x
  y: number // PDF 页面坐标系中的 y
}

interface HighlightStroke {
  pageIndex: number
  points: HighlightStrokePoint[]
}

let currentStroke: HighlightStroke | null = null
```

- `pageIndex`：当前笔画所属的 PDF 页索引；
- `points`：已经转换到 **MuPDF 页面坐标系** 下的点集合。

#### 3.2 屏幕坐标 → MuPDF 页面坐标

在 `pdfpage.vue` 中添加辅助函数 `screenPointToPdfPoint`：

```ts
const screenPointToPdfPoint = (
  clientX: number,
  clientY: number,
  pageIndex: number,
  layout: { width: number; height: number },
): HighlightStrokePoint | null => {
  if (!viewerContainer.value || !pdfDoc.value) return null

  const pageElements = viewerContainer.value.querySelectorAll<HTMLElement>('.page')
  const pageEl = pageElements[pageIndex]
  if (!pageEl) return null

  const rect = pageEl.getBoundingClientRect()
  const localX = clientX - rect.left
  const localY = clientY - rect.top

  const scale = store.scale || 1
  const xInLayout = localX / scale
  const yInLayout = localY / scale

  // 归一化到 [0,1]
  const nx = xInLayout / layout.width
  const ny = yInLayout / layout.height
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null

  const pdf = pdfDoc.value.asPDF()
  if (!pdf) return null

  const page = pdf.loadPage(pageIndex) as mupdf.PDFPage
  const bounds = page.getBounds() // [ulx, uly, lrx, lry]
  const pageWidth = bounds[2] - bounds[0]
  const pageHeight = bounds[3] - bounds[1]

  const pdfX = bounds[0] + nx * pageWidth
  const pdfY = bounds[1] + ny * pageHeight

  return { x: pdfX, y: pdfY }
}
```

- 输入：浏览器 PointerEvent 的 `clientX/clientY`、当前页索引、当前页 layout（渲染尺寸）；
- 输出：MuPDF 页面坐标系下的 `(x, y)`；
- 关键点：
  - 先通过 `getBoundingClientRect` 将 `clientX/Y` 转为当前页容器内坐标；
  - 再通过 `store.scale` 还原到未缩放的 layout 坐标；
  - 最后根据页面 bounds 映射到 MuPDF 页面坐标。

### 4. 模板中的 Pointer 事件绑定

在每一页的 `.page` 容器上绑定 Pointer 事件（高亮模式下生效）：

```vue
<div
  v-for="(layout, index) in pageLayouts"
  :key="index"
  class="page"
  :style="getPageStyle(layout)"
  @click="handlePageClick($event, index, layout)"
  @pointerdown.passive="handleHighlightPointerDown($event, index, layout)"
  @pointermove.passive="handleHighlightPointerMove($event, index, layout)"
  @pointerup.passive="handleHighlightPointerUp($event, index, layout)"
  @pointercancel.passive="handleHighlightPointerUp($event, index, layout)"
>
  <!-- 笔记 marker、提示气泡、canvas 等 -->
</div>
```

- `handlePageClick` 仍然用于添加笔记锚点，在高亮模式下会直接 `return`。

### 5. Pointer 事件到 Ink 注释

#### 5.1 PointerDown：开始一条笔画

```ts
const handleHighlightPointerDown = (
  event: PointerEvent,
  pageIndex: number,
  layout: { width: number; height: number },
) => {
  if (!isHighlightMode.value) return
  if (!pdfDoc.value) return

  // 仅处理鼠标左键或触摸/笔
  if (event.pointerType === 'mouse' && event.button !== 0) return

  const point = screenPointToPdfPoint(event.clientX, event.clientY, pageIndex, layout)
  if (!point) return

  currentStroke = {
    pageIndex,
    points: [point],
  }
}
```

#### 5.2 PointerMove：追加中间点

```ts
const handleHighlightPointerMove = (
  event: PointerEvent,
  pageIndex: number,
  layout: { width: number; height: number },
) => {
  if (!isHighlightMode.value) return
  if (!currentStroke) return
  if (currentStroke.pageIndex !== pageIndex) return

  const point = screenPointToPdfPoint(event.clientX, event.clientY, pageIndex, layout)
  if (!point) return

  currentStroke.points.push(point)
}
```

#### 5.3 PointerUp：生成 MuPDF Ink 注释

```ts
const handleHighlightPointerUp = async (
  event: PointerEvent,
  pageIndex: number,
  layout: { width: number; height: number },
) => {
  if (!isHighlightMode.value) {
    currentStroke = null
    return
  }

  if (!currentStroke || currentStroke.pageIndex !== pageIndex || !pdfDoc.value) {
    currentStroke = null
    return
  }

  // 收尾点
  const endPoint = screenPointToPdfPoint(event.clientX, event.clientY, pageIndex, layout)
  if (endPoint) {
    currentStroke.points.push(endPoint)
  }

  const stroke = currentStroke
  currentStroke = null

  if (!stroke || stroke.points.length < 2) {
    return
  }

  try {
    const pdf = pdfDoc.value.asPDF()
    if (!pdf) return

    const page = pdf.loadPage(pageIndex) as mupdf.PDFPage
    const annot = page.createAnnotation('Ink')

    const inkList = [stroke.points.map((p) => [p.x, p.y] as mupdf.Point)]
    ;(annot as any).setInkList?.(inkList)
    ;(annot as any).setColor?.([1, 1, 0]) // 黄色荧光笔

    // 根据页面高度设置相对线宽
    const bounds = page.getBounds()
    const pageHeight = bounds[3] - bounds[1]
    const width = Math.max(pageHeight * 0.003, 1)
    ;(annot as any).setBorderWidth?.(width)

    page.update()

    // 简单处理：整份文档重渲
    await render()
  } catch (e) {
    console.error('创建高亮注释失败', e)
  }
}
```

- 设计要点：
  - 用 `asPDF()` 获取可写的 `PDFDocument`；
  - 通过 `createAnnotation('Ink')` 创建 Ink 注释；
  - `inkList` 中仅放入当前这一条笔画；
  - 颜色固定为黄色 `[1, 1, 0]`，线宽按页面高度占比设置，兼顾不同尺寸；
  - 当前版本每次结束笔画后调用一次 `render()`，实现简单可靠的刷新（后续可优化为只渲染当前页）。

### 6. PdfViewerView 顶部工具栏联动

在 `imates-web/src/views/PdfViewerView.vue` 中，使用 `ref="pdfPageRef"` 获取 PdfPage 实例，并通过工具栏按钮切换高亮模式：

```vue
<UnifiedToolbar ...>
  <template #right-actions>
    <q-btn
      flat
      dense
      icon="bug_report"
      label="调试"
      class="q-ml-sm"
      @click="handleToggleDebug"
    />
    <q-btn
      flat
      dense
      icon="note"
      label="笔记"
      class="q-ml-sm"
      @click="handleToggleNoteMode"
    />
    <q-btn
      flat
      dense
      icon="highlight"
      label="高亮"
      class="q-ml-sm"
      @click="handleToggleHighlight"
    />
    <q-btn flat round dense icon="chat" @click="chatPanelVisible = !chatPanelVisible" />
  </template>
</UnifiedToolbar>

<PdfPage
  v-if="currentFile"
  ref="pdfPageRef"
  :file="currentFile"
/>
```

对应的脚本部分：

```ts
const pdfPageRef = ref<PdfPagePublicInstance | null>(null)

const handleToggleHighlight = () => {
  pdfPageRef.value?.toggleHighlightMode()
}

const handleToggleDebug = () => {
  pdfPageRef.value?.toggleDebugPanel()
}

const handleToggleNoteMode = () => {
  pdfPageRef.value?.toggleNoteMode()
}
```

- 这样，视图层只负责“当前模式”的 UI 入口，具体高亮行为全部封装在 PdfPage 内部。

---

## 未来待办 / 扩展方向

1. **注释持久化到 IndexedDB / 后端**
   - 在用户退出或定时触发时，调用：
     - `const pdf = pdfDoc.asPDF()`
     - `const buffer = pdf.saveToBuffer('incremental')`
   - 将 `buffer` 存入 IndexedDB（按文档 `docKey`），或上传服务器。

2. **高亮 / 画笔 / 橡皮擦模式统一**
   - 将当前的 `isHighlightMode` 扩展为统一的 `currentMode`：`'hand' | 'note' | 'highlighter' | 'pen' | 'eraser-draw'`；
   - 与 `20251119_Pdf手势模式触摸行为设计.md` 中的模式设计对齐。

3. **只重绘当前页**
   - 为优化性能，可以新增 `renderPage(pageIndex: number)` 用于只重绘某一页，将高亮后的刷新范围缩小。

4. **橡皮擦对 Ink 注释的支持**
   - 通过检测 Ink 注释与擦除路径的交集，选择删除或部分修改 Ink 注释（取决于 MuPDF API 能力）。

通过上述实现，PdfPage 已经支持基于 MuPDF Ink 注释的“手写涂抹高亮”，并且与现有的笔记功能、工具栏模式切换、缩放滚动行为保持了良好的一致性，为后续的画笔、橡皮擦和注释持久化打下了基础。
