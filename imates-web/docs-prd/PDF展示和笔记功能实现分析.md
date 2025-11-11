# PDF展示和笔记功能实现分析

## 一、功能概述

PDF查看器提供了完整的PDF文档展示和笔记标注功能，支持多种绘制工具、缩放、截图等功能。

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                  PdfViewerView.vue                       │
│              (PDF查看器主视图 - 路由入口)                 │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐         ┌─────────▼──────────┐
│  PdfPage.vue  │         │ UnifiedToolbar.vue │
│ (PDF页面组件)  │         │  (统一工具栏组件)   │
└───────┬────────┘         └────────────────────┘
        │
┌───────▼──────────────────────────────────────┐
│         pdfViewerStore.ts                    │
│    (状态管理 - Pinia Store)                  │
└───────┬──────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────┐
│    PDF.js (pdfjs-dist)                       │
│    (PDF渲染引擎)                              │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│    Konva.js (konva)                         │
│    (笔记绘制引擎)                            │
└──────────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────┐
│    KonvaCanvasService.ts                    │
│    (Konva服务封装)                            │
└───────┬──────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────┐
│      IndexedDB (持久化存储)                   │
│    textbooks.localFiles[].annotations       │
└──────────────────────────────────────────────┘
```

### 2.2 核心组件职责

#### 2.2.1 PdfViewerView.vue
- **职责**：PDF查看器主视图，负责整体布局和状态管理
- **功能**：
  - PDF文件加载（从IndexedDB读取）
  - 工具栏集成
  - 虚拟滚动（使用q-virtual-scroll）
  - 缩放控制
  - 截图对话框管理
  - AI对话面板集成

#### 2.2.2 PdfPage.vue
- **职责**：单个PDF页面的渲染和笔记层管理
- **功能**：
  - PDF内容渲染（使用PDF.js）
  - Konva Stage初始化和管理
  - 笔记数据加载和保存
  - 触摸手势处理（双指缩放/滑动）
  - 鼠标滚轮缩放
  - 撤销/重做功能

#### 2.2.3 pdfViewerStore.ts
- **职责**：状态管理中心，管理PDF和标注数据
- **功能**：
  - PDF文档状态管理
  - 标注数据内存管理（allAnnotations）
  - 自动保存（防抖机制，1秒延迟）
  - IndexedDB持久化
  - 工具配置管理
  - 页面可见性监听（页面隐藏时立即保存）

#### 2.2.4 KonvaCanvasService.ts
- **职责**：Konva.js服务层封装，提供框架无关的Canvas操作
- **功能**：
  - Stage初始化和配置
  - 工具模式切换（pen/highlighter/eraser/screenshot/select）
  - 标注对象的增删改查
  - 截图功能实现
  - 事件监听和回调
  - 坐标转换（标准化坐标 ↔ 当前scale坐标）

## 三、PDF展示实现

### 3.1 PDF加载流程

```typescript
// 1. 从路由参数获取文件信息
const resourceId = route.query.resourceId
const id = route.query.id

// 2. 从IndexedDB获取教材信息
const textbook = await resourceManager.indexedDB.get('textbooks', id)

// 3. 从textbook_files表读取文件数据
const fileData = await resourceManager.getFileData(id, resourceId)

// 4. 转换为File对象
const file = new File([fileData.buffer], fileName, { type: 'application/pdf' })

// 5. 使用PDF.js加载
const loadingTask = pdfjsLib.getDocument({
  data: arrayBuffer,
  cMapUrl: '/cmaps/',
  cMapPacked: true
})
const pdfDoc = await loadingTask.promise
```

### 3.2 PDF渲染实现

#### 3.2.1 渲染流程（PdfPage.vue）

```typescript
// 第1步：获取PDF页面
const rawPdfDoc = toRaw(store.pdfDoc)
const page = await rawPdfDoc.getPage(props.layout.pageNum)

// 第2步：获取viewport（根据当前scale）
const viewport = rawPage.getViewport({ scale: store.scale })

// 第3步：设置Canvas尺寸（支持高DPI）
const dpr = window.devicePixelRatio || 1
canvas.width = viewport.width * dpr
canvas.height = viewport.height * dpr
canvas.style.width = `${viewport.width}px`
canvas.style.height = `${viewport.height}px`

// 第4步：缩放上下文以适应高DPI
context.scale(dpr, dpr)

// 第5步：渲染PDF页面
const renderContext = {
  canvasContext: context,
  viewport: viewport,
}
await page.render(renderContext).promise
```

#### 3.2.2 高DPI支持

- **设备像素比（DPR）**：自动检测 `window.devicePixelRatio`
- **Canvas分辨率**：实际像素 = CSS像素 × DPR
- **上下文缩放**：使用 `context.scale(dpr, dpr)` 确保绘制内容清晰

### 3.3 页面布局计算

```typescript
// 计算所有页面的布局信息
const layouts: PageLayout[] = []
let accumulatedTop = 0

for (let i = 1; i <= pdfDoc.numPages; i++) {
  const page = await pdfDoc.getPage(i)
  const viewport = page.getViewport({ scale: store.scale })
  
  layouts.push({
    pageNum: i,
    top: accumulatedTop,
    height: viewport.height,
    width: viewport.width
  })
  
  accumulatedTop += viewport.height + pageGap
}
```

### 3.4 缩放功能

#### 3.4.1 缩放实现

- **缩放范围**：0.5 ~ 3.0
- **缩放方式**：
  - 鼠标滚轮 + Ctrl键
  - 双指捏合（触摸设备）
  - 工具栏按钮

#### 3.4.2 缩放时保持视点

```typescript
// 以指定点为原点进行缩放
const zoomAtPoint = async (point: { x: number, y: number }, oldScale: number, newScale: number) => {
  // 1. 计算缩放点在文档中的绝对位置
  const pointInDocument = {
    y: scrollContainer.scrollTop + pointRelativeToContainer.y
  }
  
  // 2. 找到包含该点的页面
  let targetPageIndex = -1
  let pointInPageY = 0
  
  // 3. 执行缩放（触发布局重新计算）
  store.setScale(newScale)
  
  // 4. 等待布局更新完成
  await nextTick()
  
  // 5. 计算缩放点在文档中的新位置
  const newPointInPageY = pointInPageY * scaleRatio
  
  // 6. 调整滚动位置，使缩放点保持在视口中的相同位置
  scrollContainer.scrollTop = newPointInDocument - pointRelativeToContainer.y
}
```

## 四、笔记功能实现

### 4.1 笔记绘制架构

#### 4.1.1 双层Canvas设计

```
┌─────────────────────────────────────┐
│         PdfPage.vue 容器              │
├─────────────────────────────────────┤
│  PDF Canvas (z-index: 1)            │
│  - 渲染PDF内容                        │
│  - pointer-events: none              │
├─────────────────────────────────────┤
│  Konva Container (z-index: 2)        │
│  - Konva Stage                       │
│  - 笔记绘制层                         │
│  - pointer-events: auto              │
└─────────────────────────────────────┘
```

#### 4.1.2 Konva初始化

```typescript
// 第1步：创建Konva服务实例
konvaService = new KonvaCanvasService(drawingConfig, {
  onDataChange: () => {
    saveState()        // 保存到历史记录
    saveAnnotations()  // 保存到Store
  },
  onScreenshotCaptured: (blob) => {
    emit('screenshot-captured', blob)
  },
})

// 第2步：初始化Konva Stage
konvaService.init(konvaContainer.value, canvasWidth, canvasHeight, store.scale)

// 第3步：设置当前工具
konvaService.setTool(store.selectedTool)

// 第4步：加载现有笔记
await loadAnnotations()
```

### 4.2 绘制工具

#### 4.2.1 签字笔（Pen）

- **实现**：使用 `Konva.Line` 绘制路径
- **特性**：
  - 支持多种手写样式（writing、brush、pencil等）
  - 可配置颜色和粗细
  - 平滑路径绘制

```typescript
// 创建签字笔路径
const line = new Konva.Line({
  points: [x1, y1, x2, y2, ...],
  stroke: config.penColor,
  strokeWidth: config.penWidth,
  lineCap: 'round',
  lineJoin: 'round',
  tension: 0.5,  // 平滑曲线
})
```

#### 4.2.2 荧光笔（Highlighter）

- **实现**：使用 `Konva.Line` + 透明度
- **特性**：
  - 半透明效果
  - 可配置颜色、粗细、透明度

```typescript
const line = new Konva.Line({
  points: [...],
  stroke: config.highlighterColor,
  strokeWidth: config.highlighterWidth,
  opacity: config.highlighterOpacity / 100,
  globalCompositeOperation: 'multiply',  // 混合模式
})
```

#### 4.2.3 橡皮擦（Eraser）

- **实现**：整笔擦除模式
- **特性**：
  - 检测与绘制对象的相交
  - 删除整个绘制对象（不是部分擦除）

```typescript
// 检测橡皮擦位置的对象
const node = this.stage.getIntersection(pos)
if (node && node.name() === 'annotation') {
  node.destroy()  // 删除整个对象
  this.onDataChange()
}
```

#### 4.2.4 截图工具（Screenshot）

- **实现**：矩形或自由形状选区
- **特性**：
  - 支持矩形和自由形状（多边形）
  - 捕获PDF内容 + 笔记内容
  - 转换为Blob并触发回调

```typescript
// 截图流程
// 1. 绘制选区（矩形或路径）
// 2. 获取选区边界
// 3. 创建临时Canvas
// 4. 绘制PDF内容（从pdfCanvas）
// 5. 绘制笔记内容（从konvaStage）
// 6. 转换为Blob
tempCanvas.toBlob((blob) => {
  emit('screenshot-captured', blob)
}, 'image/jpeg', 0.9)
```

#### 4.2.5 选择工具（Select）

- **实现**：使用 `Konva.Transformer`
- **特性**：
  - 矩形框选
  - 自由形状框选
  - 多选支持
  - 拖拽和变换

```typescript
// 创建Transformer
this.transformer = new Konva.Transformer({
  nodes: selectedNodes,
  enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  borderStroke: '#2196F3',
})
```

### 4.3 坐标系统

#### 4.3.1 标准化坐标系统

笔记使用**标准化坐标系统**（基于 `scale=1.0`）存储，而不是基于当前缩放比例存储。

**优势**：
- 数据一致性：无论PDF处于什么缩放级别，笔记数据都保持一致
- 缩放精度：避免多次缩放导致的精度损失
- 跨设备兼容：不同设备上的缩放比例可以不同，但笔记数据一致

#### 4.3.2 坐标转换

```typescript
// 存储时：当前scale坐标 → 标准化坐标（scale=1）
const normalizeCoordinates = (obj: DrawObject, scale: number): DrawObject => {
  if (obj.type === 'path' && obj.points) {
    normalized.points = obj.points.map(p => ({
      x: p.x / scale,
      y: p.y / scale
    }))
  }
  // ... 其他类型
  return normalized
}

// 加载时：标准化坐标（scale=1） → 当前scale坐标
const scaleCoordinates = (obj: DrawObject, scale: number): DrawObject => {
  if (obj.type === 'path' && obj.points) {
    scaled.points = obj.points.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }))
  }
  // ... 其他类型
  return scaled
}
```

### 4.4 数据持久化

#### 4.4.1 存储结构

```typescript
// IndexedDB存储结构
textbooks: {
  id: string,
  localFiles: [
    {
      id: string,
      fileName: string,
      annotations: {
        [pageNum: number]: DrawObject[]  // 每页的笔记数组
      }
    }
  ]
}
```

#### 4.4.2 自动保存机制

```typescript
// 防抖保存（1秒延迟）
debouncedSave() {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
  }
  saveDebounceTimer = setTimeout(async () => {
    await this.autoSaveAnnotations()
  }, 1000)
}

// 立即保存（页面隐藏、组件卸载时）
async flushSave() {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
  }
  await this.autoSaveAnnotations()
}
```

#### 4.4.3 保存流程

```typescript
// 1. 序列化Konva对象为DrawObject（标准化坐标）
const normalizedObjects = konvaService.serialize(store.scale)

// 2. 深度序列化（移除Vue响应式代理）
const serializedObjects = IndexedDBService.deepSerialize(normalizedObjects)

// 3. 更新Store
store.updateAnnotations(props.layout.pageNum, serializedObjects)

// 4. 触发防抖保存
store.debouncedSave()

// 5. 保存到IndexedDB
await resourceManager.indexedDB.put('textbooks', textbook)
```

### 4.5 撤销/重做功能

#### 4.5.1 历史记录管理

```typescript
// 历史记录（每页独立）
const history = ref<DrawObject[][]>([[]])
const historyIndex = ref(0)
const maxHistorySize = 20

// 保存状态到历史记录
const saveState = () => {
  const currentState = konvaService.serialize(store.scale)
  
  // 如果不在历史记录末尾，删除后面的记录
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  
  // 保存当前状态
  history.value.push(JSON.parse(JSON.stringify(currentState)))
  historyIndex.value = history.value.length - 1
  
  // 限制历史记录数量
  if (history.value.length > maxHistorySize) {
    history.value.shift()
    historyIndex.value--
  }
}
```

#### 4.5.2 撤销/重做实现

```typescript
// 撤销
const undo = () => {
  if (historyIndex.value <= 0) return false
  
  historyIndex.value--
  const previousState = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
  
  // 加载到Konva
  konvaService.load(previousState, store.scale)
  
  // 保存到Store
  store.updateAnnotations(props.layout.pageNum, previousState)
  
  return true
}

// 重做
const redo = () => {
  if (historyIndex.value >= history.value.length - 1) return false
  
  historyIndex.value++
  const nextState = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
  
  // 加载到Konva
  konvaService.load(nextState, store.scale)
  
  // 保存到Store
  store.updateAnnotations(props.layout.pageNum, nextState)
  
  return true
}
```

## 五、触摸手势处理

### 5.1 双指手势识别

```typescript
// 触摸开始
const handleTouchStart = (event: TouchEvent) => {
  if (event.touches.length === 2) {
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]
    const distance = getDistance(touch1, touch2)
    
    // 记录初始状态
    touchState.value.initialDistance = distance
    touchState.value.initialScale = store.scale
    touchState.value.isTwoFinger = true
  }
}

// 触摸移动
const handleTouchMove = (event: TouchEvent) => {
  if (event.touches.length === 2 && touchState.value.isTwoFinger) {
    const currentDistance = getDistance(touch1, touch2)
    const initialDistance = touchState.value.initialDistance
    const distanceChange = Math.abs(currentDistance - initialDistance)
    
    // 判断是缩放还是滑动
    if (distanceChange > 15) {
      // 缩放
      const scaleRatio = currentDistance / initialDistance
      const newScale = touchState.value.initialScale * scaleRatio
      zoomAtPoint(centerPoint, oldScale, newScale)
    } else {
      // 滑动
      scrollContainer.scrollTop -= deltaY
    }
  }
}
```

### 5.2 单指触摸处理

单指触摸由Konva服务处理，用于绘制操作。

## 六、性能优化

### 6.1 虚拟滚动

使用 `q-virtual-scroll` 实现长列表虚拟滚动，只渲染可见区域的页面。

```vue
<q-virtual-scroll
  :items="pageLayouts"
  virtual-scroll-item-size="800"
  virtual-scroll-slice-size="5"
  virtual-scroll-slice-ratio-before="2"
  virtual-scroll-slice-ratio-after="2"
>
  <PdfPage :layout="item" />
</q-virtual-scroll>
```

### 6.2 渲染防抖

缩放时使用防抖机制，避免频繁重新渲染。

```typescript
const debouncedRender = () => {
  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer)
  }
  renderDebounceTimer = setTimeout(async () => {
    await initPdfPage()
    konvaService.updateSize(width, height, store.scale)
    await loadAnnotations()
  }, 150)
}
```

### 6.3 渲染任务取消

支持取消正在进行的PDF渲染任务，避免资源浪费。

```typescript
// 取消之前的渲染任务
if (currentRenderTask.value) {
  try {
    currentRenderTask.value.cancel()
  } catch {
    // 忽略取消错误
  }
  currentRenderTask.value = null
}
```

## 七、关键技术点

### 7.1 PDF.js集成

- **Worker配置**：使用动态导入的worker文件
- **CMap支持**：支持中文字体映射
- **高DPI支持**：自动适配设备像素比

### 7.2 Konva.js集成

- **Stage管理**：每个页面独立的Stage实例
- **事件处理**：统一的鼠标/触摸事件处理
- **对象管理**：使用name属性标记标注对象

### 7.3 状态管理

- **Pinia Store**：集中管理PDF和笔记状态
- **响应式更新**：使用Vue的响应式系统
- **数据同步**：Store ↔ IndexedDB ↔ 组件

### 7.4 数据序列化

- **深度序列化**：移除Vue响应式代理
- **标准化坐标**：统一使用scale=1的坐标
- **类型安全**：使用TypeScript类型定义

## 八、总结

PDF展示和笔记功能采用了分层架构设计：

1. **展示层**：PDF.js负责PDF内容渲染
2. **绘制层**：Konva.js负责笔记绘制
3. **状态层**：Pinia Store管理状态
4. **持久层**：IndexedDB存储数据

这种设计实现了：
- **职责分离**：各层职责清晰
- **性能优化**：虚拟滚动、防抖渲染
- **用户体验**：流畅的缩放、绘制、撤销/重做
- **数据安全**：自动保存、标准化坐标

