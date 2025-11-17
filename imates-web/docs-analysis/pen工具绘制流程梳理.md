# Pen 工具绘制流程梳理

## 📋 概述

本文档详细梳理了点击 pen（签字笔）工具后进行绘制的完整流程，包括事件处理、坐标转换、MuPDF 注释创建和 Canvas 渲染等各个环节。

---

## 🔄 完整流程图

```
用户点击 pen 工具
    ↓
用户按下鼠标 (mousedown)
    ↓
handleDrawingMouseDown()
    ↓
[1] 检查工具类型是否为 'pen'
    ↓
[2] 获取点击坐标 (getCanvasCoords)
    ↓
[3] 初始化 annotationService.startInkDrawing()
    ├─ 坐标转换：Canvas → PDF 页面坐标
    ├─ 创建 currentDrawing 对象
    └─ 初始化笔画数组 strokes
    ↓
[4] 设置绘制状态
    ├─ isDrawing = true
    ├─ startPoint = coords
    └─ currentPath = [coords]
    ↓
用户移动鼠标 (mousemove)
    ↓
handleDrawingMouseMove()
    ↓
[5] 检查绘制状态和工具类型
    ↓
[6] 更新路径和继续绘制
    ├─ currentPath.push(coords)
    ├─ annotationService.continueInkDrawing()
    │   └─ 坐标转换并添加到 strokes
    └─ 创建临时预览对象 tempObject
    ↓
[7] 实时渲染预览 (render())
    └─ 在 Drawing Canvas 上绘制临时路径
    ↓
用户释放鼠标 (mouseup)
    ↓
handleDrawingMouseUp()
    ↓
[8] 完成绘制
    ├─ annotationService.finishInkDrawing()
    │   ├─ 创建 MuPDF INK 注释
    │   ├─ 设置颜色、线宽、路径
    │   └─ 返回 MuPDFAnnotationData
    ├─ 转换为 DrawObject
    ├─ 添加到 objects 数组
    ├─ 保存历史记录 (saveState)
    └─ 保存到 PDF (saveAnnotations)
    ↓
[9] 重新渲染
    ├─ 重新渲染 PDF 页面（包含新注释）
    └─ 重新渲染 Drawing Canvas
    ↓
绘制完成 ✅
```

---

## 📝 详细步骤说明

### 步骤 1: 工具选择

**位置**: `PdfPage.vue` - `handleDrawingMouseDown()`

```1320:1341:imates-web/src/components/PdfPage.vue
  } else if (tool === 'pen' || tool === 'highlighter') {
    // 使用 MuPDF 注释服务开始绘制
    if (!annotationService || !currentPageProxy) {
      console.warn('注释服务未初始化')
      return
    }
    
    const pageBounds = currentPageProxy.getBounds()
    const canvasSize = {
      width: drawingCanvasSize.value.width,
      height: drawingCanvasSize.value.height
    }
    
    if (tool === 'pen') {
      annotationService.startInkDrawing(coords.x, coords.y, pageBounds, canvasSize)
    } else if (tool === 'highlighter') {
      annotationService.startHighlightDrawing(coords.x, coords.y, pageBounds, canvasSize)
    }
    
    startPoint.value = coords
    isDrawing.value = true
    currentPath.value = [coords]
  }
```

**关键点**:
- 检查 `annotationService` 和 `currentPageProxy` 是否已初始化
- 获取页面边界和 Canvas 尺寸（用于坐标转换）
- 调用 `startInkDrawing()` 开始绘制

---

### 步骤 2: 开始绘制 (startInkDrawing)

**位置**: `PdfCoreService.ts` - `startInkDrawing()`

```1166:1182:imates-web/src/services/pdf/core/PdfCoreService.ts
  startInkDrawing(
    x: number,
    y: number,
    pageBounds: mupdf.Rect,
    canvasSize: { width: number; height: number },
  ): void {
    if (!this.currentPage || !this.drawingConfig) return

    // 将 Canvas 坐标转换为 PDF 页面坐标
    const pagePoint = this.canvasToPageCoords({ x, y }, pageBounds, canvasSize)

    this.currentDrawing = {
      type: 'ink',
      points: [pagePoint],
      strokes: [[pagePoint]],
    }
  }
```

**关键点**:
- **坐标转换**: Canvas 坐标 → PDF 页面坐标
- **初始化绘制状态**: 创建 `currentDrawing` 对象
- **笔画结构**: `strokes` 是二维数组，每个元素代表一个笔画（stroke），每个笔画包含多个点

**坐标转换公式**:
```typescript
// Canvas 坐标 → PDF 页面坐标
const pageX = (canvasX / canvasWidth) * pageWidth + pageBounds[0]
const pageY = (canvasY / canvasHeight) * pageHeight + pageBounds[1]
```

---

### 步骤 3: 鼠标移动 (continueInkDrawing)

**位置**: `PdfPage.vue` - `handleDrawingMouseMove()`

```1420:1448:imates-web/src/components/PdfPage.vue
  } else if (tool === 'pen' || tool === 'highlighter') {
    if (!isDrawing.value || !startPoint.value || !annotationService || !currentPageProxy) return
    
    currentPath.value.push(coords)
    
    const pageBounds = currentPageProxy.getBounds()
    const canvasSize = {
      width: drawingCanvasSize.value.width,
      height: drawingCanvasSize.value.height
    }
    
    // 继续绘制
    if (tool === 'pen') {
      annotationService.continueInkDrawing(coords.x, coords.y, pageBounds, canvasSize)
    } else if (tool === 'highlighter') {
      annotationService.continueHighlightDrawing(coords.x, coords.y, pageBounds, canvasSize)
    }
    
    // 实时预览（使用临时对象）
    const config = store.drawingConfig
    tempObject.value = {
      type: 'path',
      color: tool === 'pen' ? config.penColor : config.highlighterColor,
      lineWidth: tool === 'pen' ? config.penWidth : config.highlighterWidth,
      points: [...currentPath.value],
      rawPoints: [...currentPath.value],
      opacity: tool === 'highlighter' ? config.highlighterOpacity / 100 : undefined
    }
    render()
  }
```

**关键点**:
- **更新路径**: `currentPath` 数组持续添加新坐标点
- **继续绘制**: 调用 `continueInkDrawing()` 更新 MuPDF 绘制状态
- **实时预览**: 创建 `tempObject` 用于在 Drawing Canvas 上实时显示

---

### 步骤 4: 继续绘制 (continueInkDrawing)

**位置**: `PdfCoreService.ts` - `continueInkDrawing()`

```1187:1209:imates-web/src/services/pdf/core/PdfCoreService.ts
  continueInkDrawing(
    x: number,
    y: number,
    pageBounds: mupdf.Rect,
    canvasSize: { width: number; height: number },
  ): void {
    if (
      !this.currentPage ||
      !this.drawingConfig ||
      !this.currentDrawing ||
      this.currentDrawing.type !== 'ink'
    ) {
      return
    }

    // 将 Canvas 坐标转换为 PDF 页面坐标
    const pagePoint = this.canvasToPageCoords({ x, y }, pageBounds, canvasSize)

    // 添加到当前笔画
    this.currentDrawing.points.push(pagePoint)
    const lastStroke = this.currentDrawing.strokes[this.currentDrawing.strokes.length - 1]
    lastStroke.push(pagePoint)
  }
```

**关键点**:
- **坐标转换**: 每次移动都进行坐标转换
- **更新笔画**: 将新点添加到当前笔画的最后一个 stroke
- **数据结构**: 
  ```typescript
  currentDrawing = {
    type: 'ink',
    points: [point1, point2, point3, ...],  // 所有点的扁平数组
    strokes: [[point1, point2, ...]]        // 笔画数组（当前只有一个笔画）
  }
  ```

---

### 步骤 5: 实时预览渲染 (render)

**位置**: `PdfPage.vue` - `render()`

```715:850:imates-web/src/components/PdfPage.vue
// 渲染画布
const render = () => {
  if (!ctx || !drawingCanvas.value) return
  
  // 获取当前scale下的viewport尺寸（用于逻辑坐标）
  const dpr = window.devicePixelRatio || 1
  // 获取当前viewport的逻辑尺寸（CSS像素）
  const logicalWidth = drawingCanvas.value.width / dpr
  const logicalHeight = drawingCanvas.value.height / dpr
  
  // 清空画布（使用逻辑坐标，因为ctx已经设置了scale(dpr, dpr)）
  ctx.clearRect(0, 0, logicalWidth, logicalHeight)
  
  // 绘制所有对象
  objects.value.forEach((obj) => {
    // ... 绘制已保存的对象
  })
  
  // 绘制临时对象（预览）
  if (tempObject.value) {
    // ... 绘制 tempObject
  }
}
```

**关键点**:
- **清空画布**: 每次渲染前清空
- **绘制已保存对象**: 遍历 `objects` 数组绘制所有已保存的注释
- **绘制临时预览**: 如果存在 `tempObject`，绘制当前正在绘制的路径

---

### 步骤 6: 完成绘制 (finishInkDrawing)

**位置**: `PdfPage.vue` - `handleDrawingMouseUp()`

```1563:1599:imates-web/src/components/PdfPage.vue
  } else if (tool === 'pen' || tool === 'highlighter') {
    if (!isDrawing.value || !annotationService || !currentPageProxy) {
      isDrawing.value = false
      currentPath.value = []
      startPoint.value = null
      tempObject.value = null
      return
    }
    
    // 完成绘制并创建 MuPDF 注释
    let annotData: MuPDFAnnotationData | null = null
    if (tool === 'pen') {
      annotData = annotationService.finishInkDrawing()
    } else if (tool === 'highlighter') {
      annotData = annotationService.finishHighlightDrawing()
    }
    
    if (annotData) {
      // 转换为 DrawObject 用于显示
      const drawObj = convertMuPDFAnnotationToDrawObject(annotData, currentPageProxy)
      objects.value.push(drawObj)
      
      // 保存历史记录
      saveState()
      
      // 保存状态到Store（MuPDF 注释会自动保存到 PDF）
      saveAnnotations()
      
      // 重新渲染 PDF（包含新注释）
      initPdfPage()
    }
    
    tempObject.value = null
    isDrawing.value = false
    currentPath.value = []
    startPoint.value = null
  }
```

**关键点**:
- **完成绘制**: 调用 `finishInkDrawing()` 创建 MuPDF 注释
- **转换对象**: 将 `MuPDFAnnotationData` 转换为 `DrawObject`
- **保存状态**: 
  - 添加到 `objects` 数组
  - 保存历史记录（用于撤销/重做）
  - 保存到 PDF（MuPDF 注释会自动保存）

---

### 步骤 7: 创建 MuPDF 注释 (finishInkDrawing)

**位置**: `PdfCoreService.ts` - `finishInkDrawing()`

```1214:1246:imates-web/src/services/pdf/core/PdfCoreService.ts
  finishInkDrawing(): MuPDFAnnotationData | null {
    if (
      !this.currentPage ||
      !this.drawingConfig ||
      !this.currentDrawing ||
      this.currentDrawing.type !== 'ink'
    ) {
      return null
    }

    if (this.currentDrawing.strokes.length === 0 || this.currentDrawing.strokes[0].length < 2) {
      this.currentDrawing = null
      return null
    }

    // 创建 INK 注释
    const annot = this.createInkAnnotation(
      this.currentPage,
      this.currentDrawing.strokes,
      this.drawingConfig,
    )

    // 转换为数据格式
    const data = this.fromPDFAnnotation(annot, this.currentPageNum)

    // 通知变更
    this.notifyAnnotationChanged()

    // 清理当前绘制状态
    this.currentDrawing = null

    return data
  }
```

**关键点**:
- **验证数据**: 检查笔画是否有效（至少 2 个点）
- **创建注释**: 调用 `createInkAnnotation()` 创建 MuPDF INK 注释
- **转换数据**: 将 MuPDF 注释对象转换为 `MuPDFAnnotationData`
- **通知变更**: 触发 `onAnnotationChanged` 回调

---

### 步骤 8: 创建 INK 注释 (createInkAnnotation)

**位置**: `PdfCoreService.ts` - `createInkAnnotation()`

```640:667:imates-web/src/services/pdf/core/PdfCoreService.ts
    const annot = page.createAnnotation('Ink')

    // 设置颜色（从 hex 转换为 RGB，0-1 范围）
    const rgb = this.hexToRgb(config.penColor)
    annot.setColor([rgb.r, rgb.g, rgb.b])

    // 设置透明度（0-1 范围）
    annot.setOpacity(1.0) // 签字笔不透明

    // 设置线宽
    annot.setBorderWidth(config.penWidth)

    // 设置手绘路径
    annot.setInkList(inkList)

    // 计算边界框
    const rect = this.calculateInkRect(inkList)
    annot.setRect(rect)

    // 更新注释
    annot.update()

    return annot
```

**关键点**:
- **创建注释**: `page.createAnnotation('Ink')` 创建 MuPDF INK 注释
- **设置属性**:
  - 颜色: 从 hex 转换为 RGB（0-1 范围）
  - 透明度: 1.0（不透明）
  - 线宽: 从配置读取
  - 路径: `setInkList(inkList)` 设置手绘路径
- **计算边界**: 根据路径点计算注释的边界框
- **更新注释**: `annot.update()` 应用更改

---

### 步骤 9: 转换注释数据 (convertMuPDFAnnotationToDrawObject)

**位置**: `PdfPage.vue` - `convertMuPDFAnnotationToDrawObject()`

```636:673:imates-web/src/components/PdfPage.vue
const convertMuPDFAnnotationToDrawObject = (
  annot: MuPDFAnnotationData,
  pageProxy: MuPDFPageProxy
): DrawObject => {
  const pageBounds = pageProxy.getBounds()
  const canvasSize = {
    width: drawingCanvasSize.value.width || 800,
    height: drawingCanvasSize.value.height || 1000
  }
  
  if (annot.type === 'Ink' && annot.inkList) {
    // INK 注释转换为 path
    const points: { x: number; y: number }[] = []
    for (const stroke of annot.inkList) {
      for (const point of stroke) {
        const canvasCoords = pdfCoreService.pageToCanvasCoords(
          point,
          pageBounds,
          canvasSize
        )
        points.push(canvasCoords)
      }
    }
    
    // 将 RGB 颜色转换为 hex
    const color = pdfCoreService.rgbToHex(
      annot.color[0] ?? 0,
      annot.color[1] ?? 0,
      annot.color[2] ?? 0
    )
    
    return {
      type: 'path',
      color,
      lineWidth: annot.borderWidth,
      points,
      opacity: annot.opacity
    }
  }
  // ...
}
```

**关键点**:
- **坐标转换**: PDF 页面坐标 → Canvas 坐标（反向转换）
- **数据转换**: 
  - `MuPDFAnnotationData` → `DrawObject`
  - RGB 颜色 → hex 颜色
- **路径展开**: 将 `inkList`（二维数组）展开为 `points`（一维数组）

---

### 步骤 10: 保存和渲染

**位置**: `PdfPage.vue` - `handleDrawingMouseUp()`

```1580:1593:imates-web/src/components/PdfPage.vue
    if (annotData) {
      // 转换为 DrawObject 用于显示
      const drawObj = convertMuPDFAnnotationToDrawObject(annotData, currentPageProxy)
      objects.value.push(drawObj)
      
      // 保存历史记录
      saveState()
      
      // 保存状态到Store（MuPDF 注释会自动保存到 PDF）
      saveAnnotations()
      
      // 重新渲染 PDF（包含新注释）
      initPdfPage()
    }
```

**关键点**:
- **添加到对象列表**: `objects.value.push(drawObj)`
- **保存历史**: `saveState()` 用于撤销/重做功能
- **保存到 PDF**: `saveAnnotations()` 保存到 Store（MuPDF 注释已自动保存到 PDF）
- **重新渲染**: `initPdfPage()` 重新渲染 PDF 页面和 Drawing Canvas

---

## 🔑 关键数据结构

### 1. currentDrawing (PdfCoreService)

```typescript
{
  type: 'ink',
  points: [point1, point2, ...],      // 所有点的扁平数组
  strokes: [[point1, point2, ...]]    // 笔画数组（二维数组）
}
```

### 2. DrawObject (PdfPage)

```typescript
{
  type: 'path',
  color: '#ff0000',                   // hex 颜色
  lineWidth: 2.0,                     // 线宽
  points: [{x, y}, {x, y}, ...],      // Canvas 坐标点数组
  opacity?: number                     // 透明度（可选）
}
```

### 3. MuPDFAnnotationData

```typescript
{
  type: 'Ink',
  color: [1, 0, 0],                   // RGB 颜色（0-1 范围）
  borderWidth: 2.0,                    // 线宽
  opacity: 1.0,                        // 透明度
  inkList: [[[x, y], [x, y], ...]],   // 笔画数组（PDF 页面坐标）
  rect: [x0, y0, x1, y1]              // 边界框
}
```

---

## 🎯 坐标转换

### Canvas → PDF 页面坐标

```typescript
const pageX = (canvasX / canvasWidth) * pageWidth + pageBounds[0]
const pageY = (canvasY / canvasHeight) * pageHeight + pageBounds[1]
```

### PDF 页面坐标 → Canvas

```typescript
const canvasX = ((pageX - pageBounds[0]) / pageWidth) * canvasWidth
const canvasY = ((pageY - pageBounds[1]) / pageHeight) * canvasHeight
```

---

## 📊 数据流向

```
用户操作
    ↓
Canvas 坐标 (鼠标事件)
    ↓
PDF 页面坐标 (坐标转换)
    ↓
MuPDF 注释对象 (createAnnotation)
    ↓
MuPDFAnnotationData (fromPDFAnnotation)
    ↓
DrawObject (convertMuPDFAnnotationToDrawObject)
    ↓
Canvas 渲染 (render)
```

---

## ⚠️ 注意事项

1. **坐标系统**: 
   - Canvas 坐标系统：左上角为 (0, 0)，单位是像素
   - PDF 页面坐标系统：左下角为 (0, 0)，单位是点（point）

2. **高DPI支持**: 
   - Canvas 使用 `devicePixelRatio` 进行高DPI适配
   - 渲染时需要考虑 DPR 缩放

3. **实时预览**: 
   - 使用 `tempObject` 在 Drawing Canvas 上实时显示
   - 绘制完成后才创建 MuPDF 注释

4. **数据持久化**: 
   - MuPDF 注释自动保存到 PDF 文件
   - DrawObject 保存到 Store（用于 UI 显示）

5. **撤销/重做**: 
   - 通过 `saveState()` 保存历史记录
   - 使用 `history` 数组和 `historyIndex` 实现

---

## 🔍 相关文件

- `imates-web/src/components/PdfPage.vue` - 主要绘制逻辑
- `imates-web/src/services/pdf/core/PdfCoreService.ts` - MuPDF 注释服务
- `imates-web/src/stores/pdfViewerStore.ts` - 状态管理
- `imates-web/src/components/UnifiedToolbar.vue` - 工具栏配置

---

## 📝 总结

Pen 工具的绘制流程是一个**双轨制**的设计：

1. **实时预览轨道**: 
   - 使用 Canvas 2D API 在 Drawing Canvas 上实时绘制
   - 使用 `tempObject` 存储临时路径
   - 提供流畅的绘制体验

2. **持久化轨道**: 
   - 使用 MuPDF 创建 INK 注释
   - 注释自动保存到 PDF 文件
   - 转换为 DrawObject 用于 UI 显示

这种设计既保证了**实时性**（流畅的绘制体验），又保证了**持久性**（注释保存到 PDF）。

---

## 📚 关于 Ink Annotation 的说明

### Ink Annotation 是什么？

**Ink Annotation** 是 PDF 标准中的一种注释类型，用于在 PDF 文档中添加手绘笔迹。

- **类型**: `"Ink"` 或 `"ink"`
- **数据结构**: 一个或多个笔画（strokes），每个笔画是一组 `[x, y]` 坐标点
- **效果**: 在 PDF 阅读器中显示为手写轨迹（类似签字、圈画）
- **兼容性**: 保存后，其他支持标准 PDF 注释的阅读器（如 Adobe Acrobat、Foxit）均可正常显示

### MuPDF.js 中的 Ink Annotation 格式

在 MuPDF.js 中，Ink Annotation 的数据格式如下：

```typescript
// inkList 是一个点数组的数组，每个子数组代表一条连续的笔画
const inkList: mupdf.Point[][] = [
  [
    [100, 100],  // 笔画 1 的点
    [150, 120],
    [200, 110]
  ],
  [
    [100, 200],  // 笔画 2 的点
    [150, 220],
    [200, 210]
  ]
]
```

**关键点**：
- `inkList` 是二维数组：`mupdf.Point[][]`
- 每个笔画是一个点数组：`mupdf.Point[]`
- 每个点是 `[x, y]` 格式：`mupdf.Point = [number, number]`
- 坐标单位：点（pt），与 PDF 页面尺寸一致

### 坐标系统说明

**重要**：PDF 页面坐标系统和 Canvas 坐标系统的差异：

| 系统 | 原点位置 | Y 轴方向 |
|------|---------|---------|
| HTML Canvas | 左上角 `(0, 0)` | 向下为正 |
| PDF 页面（MuPDF） | 左下角 `(0, 0)` | 向上为正 |

**注意**：在当前的实现中，坐标转换通过 `pageBounds` 来处理，MuPDF.js 会根据页面边界框自动处理坐标系统差异，因此不需要手动进行 Y 轴翻转。

### 创建 Ink Annotation 的完整流程

```typescript
// 1. 创建 Ink 注释对象
const annot = page.createAnnotation('Ink')

// 2. 设置颜色（RGB，0-1 范围）
const rgb = hexToRgb('#ff0000')  // 红色
annot.setColor([rgb.r, rgb.g, rgb.b])

// 3. 设置透明度（0-1 范围）
annot.setOpacity(1.0)  // 不透明

// 4. 设置线宽（单位：pt）
annot.setBorderWidth(2.0)

// 5. 设置手绘路径
annot.setInkList(inkList)

// 6. 计算并设置边界框
const rect = calculateInkRect(inkList)
annot.setRect(rect)

// 7. 更新注释（应用更改）
annot.update()
```

### 与文档说明的对比

**文档说明中的格式**（可能来自其他 API）：
```javascript
inkList: [
  [x1, y1, x2, y2, x3, y3, ...],  // 扁平化的坐标序列
  [x1, y1, x2, y2, ...]
]
```

**MuPDF.js 实际格式**：
```typescript
inkList: [
  [[x1, y1], [x2, y2], [x3, y3], ...],  // 点数组
  [[x1, y1], [x2, y2], ...]
]
```

**差异**：
- 文档说明使用的是扁平化的坐标数组：`[x1, y1, x2, y2, ...]`
- MuPDF.js 使用的是点数组：`[[x, y], [x, y], ...]`
- 当前实现使用的是 MuPDF.js 的标准格式，这是正确的

### 注意事项

1. **坐标单位**：所有坐标使用点（pt）作为单位，1 pt = 1/72 英寸
2. **最小点数**：每个笔画至少需要 2 个点才能创建有效的 Ink 注释
3. **边界框**：必须正确计算并设置边界框（rect），否则注释可能无法正确显示
4. **颜色格式**：颜色使用 RGB 格式，值范围 0-1（不是 0-255）
5. **透明度**：透明度值范围 0-1，1.0 表示完全不透明

### 扩展功能建议

如果需要更高级的功能，可以考虑：

1. **压感笔迹**：MuPDF.js 的 Ink 注释不支持压感，如果需要压感效果，可以：
   - 先用 Canvas 绘制高清笔迹图
   - 再通过 `page.insertImage()` 插入为图像（牺牲可编辑性，换取视觉效果）

2. **平滑曲线**：可以在绘制时对点进行平滑处理，使用贝塞尔曲线或样条曲线

3. **撤销/重做**：维护注释 ID 列表，调用 `page.deleteAnnotation(annot)` 实现撤销

4. **多页支持**：为每页单独管理笔迹，监听页面切换事件

5. **同步协作**：将 `inkList` 数据发送到服务器，供其他用户加载和显示

