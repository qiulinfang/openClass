# PDF截图面积问题分析

## 问题描述

在 `PdfViewerView.vue` 中使用截图功能时，截图结果的面积少于用户绘制的面积。

## 问题原因分析

### 1. 矩形截图的问题

在 `PdfPage.vue` 的 `captureScreenshot` 函数中：

```typescript:1386:1441:imates-web/src/components/PdfPage.vue
// 捕获截图
const captureScreenshot = async () => {
  // ...
  const shape = screenshotState.value.currentShape
  const bounds = getObjectBounds(shape)
  
  // 创建临时canvas合并PDF和绘制内容
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = Math.max(1, Math.round(bounds.width))
  tempCanvas.height = Math.max(1, Math.round(bounds.height))
  
  // 绘制PDF内容
  tempCtx.drawImage(
    pdfCanvas.value,
    Math.round(bounds.x),
    Math.round(bounds.y),
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height
  )
}
```

**问题根源**：

1. **矩形边界计算不考虑线宽**：
   - `getObjectBounds` 对于矩形类型，直接返回 `obj.x, obj.y, obj.width, obj.height`
   - 但矩形绘制时使用了 `lineWidth: 2`（见第 1268 行）
   - Canvas 的 `strokeRect` 绘制时，线条是从矩形边界**中心**向外扩展的
   - 因此，实际绘制的矩形区域 = 矩形边界 + 线宽的一半（上下左右各扩展 `lineWidth/2`）

2. **截图区域小于实际绘制区域**：
   - `bounds` 只包含矩形的内部区域（不包含线宽）
   - 截图时从 `bounds.x, bounds.y` 开始，提取 `bounds.width × bounds.height` 的区域
   - 这导致矩形边框的一部分（特别是边框的外侧）被裁剪掉了

3. **路径（polygon）截图的问题**：
   - `getObjectBounds` 对于路径类型，计算所有点的最小/最大 x/y 值
   - 同样没有考虑 `lineWidth`，导致路径的边框被裁剪

### 2. 具体代码位置

**矩形边界计算**（第 817-823 行）：
```typescript:817:823:imates-web/src/components/PdfPage.vue
} else if (obj.type === 'rectangle' && obj.x !== undefined && obj.y !== undefined && obj.width !== undefined && obj.height !== undefined) {
  return {
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height
  }
}
```

**矩形绘制时的线宽**（第 1268 行）：
```typescript:1265:1273:imates-web/src/components/PdfPage.vue
const rectShape: DrawObject = {
  type: 'rectangle' as const,
  color: store.drawingConfig.screenshotStrokeColor || '#ff0000',
  lineWidth: 2,
  x: width > 0 ? startPoint.x : coords.x,
  y: height > 0 ? startPoint.y : coords.y,
  width: Math.abs(width),
  height: Math.abs(height)
}
```

## 拍照搜题截图实现对比

### 拍照搜题的实现方式

在 `PhotoSearchView.vue` 的 `getCroppedImage` 函数中：

```typescript:1758:1808:imates-web/src/views/PhotoSearchView.vue
const getCroppedImage = (): Promise<File | null> => {
  // ...
  // 将 canvas 上的裁剪区域坐标映射回原始图片坐标
  const { drawX, drawY, drawWidth, drawHeight, originalWidth, originalHeight } =
    imageDrawInfo.value!

  // 计算 canvas 上的裁剪区域相对于图片绘制区域的位置
  const cropXInImage = cropRect.value!.x - drawX
  const cropYInImage = cropRect.value!.y - drawY
  const cropWidthInImage = cropRect.value!.width
  const cropHeightInImage = cropRect.value!.height

  // 将绘制区域的坐标映射回原始图片坐标
  const scaleX = originalWidth / drawWidth
  const scaleY = originalHeight / drawHeight

  const sourceX = Math.max(0, cropXInImage * scaleX)
  const sourceY = Math.max(0, cropYInImage * scaleY)
  const sourceWidth = Math.min(originalWidth - sourceX, cropWidthInImage * scaleX)
  const sourceHeight = Math.min(originalHeight - sourceY, cropHeightInImage * scaleY)

  // 设置输出 canvas 尺寸（保持裁剪区域的宽高比）
  canvas.width = cropRect.value!.width
  canvas.height = cropRect.value!.height

  // 从原始图片裁剪
  ctx.drawImage(
    img,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  )
}
```

### 两种实现的区别

| 特性 | PDF截图（PdfViewerView） | 拍照搜题（PhotoSearchView） |
|------|-------------------------|---------------------------|
| **选区表示** | 使用 `DrawObject`（带 `lineWidth` 的图形对象） | 使用 `cropRect`（纯坐标矩形，无边框） |
| **边界计算** | `getObjectBounds` 不考虑线宽 | 直接使用 `cropRect` 的坐标 |
| **截图方式** | 从 PDF canvas + 绘制层提取 | 从原始图片映射坐标后提取 |
| **线宽影响** | ❌ 有影响（边框被裁剪） | ✅ 无影响（无边框） |
| **坐标映射** | 直接使用 canvas 坐标 | 需要映射到原始图片坐标 |

### 关键区别

1. **选区表示方式不同**：
   - **PDF截图**：选区是一个**绘制的图形对象**（带边框线），有 `lineWidth` 属性
   - **拍照搜题**：选区是一个**纯坐标矩形**（无边框），直接表示要裁剪的区域

2. **边界计算方式不同**：
   - **PDF截图**：`getObjectBounds` 只返回图形的内部区域，不包含线宽
   - **拍照搜题**：`cropRect` 直接表示裁剪区域，无需额外计算

3. **截图逻辑不同**：
   - **PDF截图**：需要合并 PDF canvas 和绘制层，然后提取指定区域
   - **拍照搜题**：需要将 canvas 坐标映射回原始图片坐标，然后从原始图片提取

## 解决方案

### 方案1：在边界计算时考虑线宽（推荐）

修改 `getObjectBounds` 函数，在计算边界时加上线宽的一半：

```typescript
const getObjectBounds = (obj: DrawObject): { x: number; y: number; width: number; height: number } | null => {
  const lineWidth = obj.lineWidth || 0
  const halfLineWidth = lineWidth / 2
  
  if (obj.type === 'rectangle' && obj.x !== undefined && obj.y !== undefined && obj.width !== undefined && obj.height !== undefined) {
    return {
      x: obj.x - halfLineWidth,  // 向左扩展
      y: obj.y - halfLineWidth,   // 向上扩展
      width: obj.width + lineWidth,   // 宽度增加线宽
      height: obj.height + lineWidth  // 高度增加线宽
    }
  } else if (obj.type === 'path' && obj.points && obj.points.length > 0) {
    const xs = obj.points.map(p => p.x)
    const ys = obj.points.map(p => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    return {
      x: minX - halfLineWidth,
      y: minY - halfLineWidth,
      width: (maxX - minX) + lineWidth,
      height: (maxY - minY) + lineWidth
    }
  }
  // ... 其他类型类似处理
}
```

### 方案2：在截图时扩展边界

在 `captureScreenshot` 函数中，截图前扩展边界：

```typescript
const captureScreenshot = async () => {
  // ...
  const shape = screenshotState.value.currentShape
  let bounds = getObjectBounds(shape)
  
  // 扩展边界以包含线宽
  const lineWidth = shape.lineWidth || 0
  const halfLineWidth = lineWidth / 2
  bounds = {
    x: bounds.x - halfLineWidth,
    y: bounds.y - halfLineWidth,
    width: bounds.width + lineWidth,
    height: bounds.height + lineWidth
  }
  
  // 确保不超出 canvas 边界
  bounds.x = Math.max(0, bounds.x)
  bounds.y = Math.max(0, bounds.y)
  bounds.width = Math.min(bounds.width, pdfCanvas.value.width - bounds.x)
  bounds.height = Math.min(bounds.height, pdfCanvas.value.height - bounds.y)
  
  // ... 后续截图逻辑
}
```

### 方案3：使用 clip 区域（不推荐）

使用 Canvas 的 `clip` 功能，但这会增加复杂度，且可能影响性能。

## 推荐方案

**推荐使用方案1**，因为：
1. 修复了根本问题（边界计算）
2. 不影响其他使用 `getObjectBounds` 的地方（因为其他地方可能也需要考虑线宽）
3. 代码更清晰，逻辑更统一

## 总结

PDF截图面积少于绘制面积的根本原因是：
- **矩形和路径的边界计算没有考虑线宽**
- Canvas 绘制时，线条从边界中心向外扩展，实际绘制区域 = 边界 + 线宽/2
- 截图时只截取了边界内的区域，导致边框被裁剪

拍照搜题没有这个问题，因为：
- 它使用的是纯坐标矩形（无边框）
- 直接表示要裁剪的区域，无需考虑线宽


