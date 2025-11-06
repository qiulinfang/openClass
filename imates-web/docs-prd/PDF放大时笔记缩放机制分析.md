# PDF放大时笔记缩放机制分析

## 概述

PDF查看器在放大/缩小时，笔记（标注）会随着PDF页面一起缩放，保持笔记与PDF内容的相对位置和大小关系。本文档详细分析笔记在PDF缩放时的处理机制。

## 核心设计理念

### 1. 坐标系统标准化

笔记使用**标准化坐标系统**（基于 `scale=1.0`）存储，而不是基于当前缩放比例存储。这带来以下优势：

- **数据一致性**：无论PDF处于什么缩放级别，笔记数据都保持一致
- **缩放精度**：避免多次缩放导致的精度损失
- **跨设备兼容**：不同设备上的缩放比例可以不同，但笔记数据一致

### 2. 坐标转换流程

```
存储时：当前scale坐标 → 标准化坐标（scale=1）
加载时：标准化坐标（scale=1） → 当前scale坐标
```

## 详细实现机制

### 1. 笔记存储：坐标归一化

当保存笔记时，需要将当前scale的坐标转换为标准坐标（scale=1）：

```typescript
// 将坐标从当前scale转换为标准坐标（scale=1）
const normalizeCoordinates = (obj: DrawObject, scale: number): DrawObject => {
  const normalized = { ...obj }
  
  if (obj.type === 'path' && obj.points) {
    normalized.points = obj.points.map(p => ({
      x: p.x / scale,  // 除以scale，得到标准坐标
      y: p.y / scale
    }))
  } else if (obj.type === 'rectangle' || obj.type === 'triangle') {
    if (obj.x !== undefined) normalized.x = obj.x / scale
    if (obj.y !== undefined) normalized.y = obj.y / scale
    if (obj.width !== undefined) normalized.width = obj.width / scale
    if (obj.height !== undefined) normalized.height = obj.height / scale
  } else if (obj.type === 'circle') {
    if (obj.x !== undefined) normalized.x = obj.x / scale
    if (obj.y !== undefined) normalized.y = obj.y / scale
    if (obj.radius !== undefined) normalized.radius = obj.radius / scale
  } else if (obj.type === 'line') {
    if (obj.x1 !== undefined) normalized.x1 = obj.x1 / scale
    if (obj.y1 !== undefined) normalized.y1 = obj.y1 / scale
    if (obj.x2 !== undefined) normalized.x2 = obj.x2 / scale
    if (obj.y2 !== undefined) normalized.y2 = obj.y2 / scale
  } else if (obj.type === 'text') {
    if (obj.x !== undefined) normalized.x = obj.x / scale
    if (obj.y !== undefined) normalized.y = obj.y / scale
    if (obj.fontSize !== undefined) normalized.fontSize = obj.fontSize / scale
  }
  
  // 线宽也需要归一化
  if (obj.lineWidth !== undefined) {
    normalized.lineWidth = obj.lineWidth / scale
  }
  
  return normalized
}
```

**关键点**：
- 所有坐标属性（x, y, width, height, radius等）都除以scale
- 线宽（lineWidth）也需要归一化
- 字体大小（fontSize）也需要归一化

### 2. 笔记加载：坐标缩放

当加载笔记时，需要将标准坐标转换为当前scale的坐标：

```typescript
// 将坐标从标准坐标（scale=1）转换为当前scale的坐标
const scaleCoordinates = (obj: DrawObject, scale: number): DrawObject => {
  const scaled = { ...obj }
  
  if (obj.type === 'path' && obj.points) {
    scaled.points = obj.points.map(p => ({
      x: p.x * scale,  // 乘以scale，得到当前scale坐标
      y: p.y * scale
    }))
  } else if (obj.type === 'rectangle' || obj.type === 'triangle') {
    if (obj.x !== undefined) scaled.x = obj.x * scale
    if (obj.y !== undefined) scaled.y = obj.y * scale
    if (obj.width !== undefined) scaled.width = obj.width * scale
    if (obj.height !== undefined) scaled.height = obj.height * scale
  } else if (obj.type === 'circle') {
    if (obj.x !== undefined) scaled.x = obj.x * scale
    if (obj.y !== undefined) scaled.y = obj.y * scale
    if (obj.radius !== undefined) scaled.radius = obj.radius * scale
  } else if (obj.type === 'line') {
    if (obj.x1 !== undefined) scaled.x1 = obj.x1 * scale
    if (obj.y1 !== undefined) scaled.y1 = obj.y1 * scale
    if (obj.x2 !== undefined) scaled.x2 = obj.x2 * scale
    if (obj.y2 !== undefined) scaled.y2 = obj.y2 * scale
  } else if (obj.type === 'text') {
    if (obj.x !== undefined) scaled.x = obj.x * scale
    if (obj.y !== undefined) scaled.y = obj.y * scale
    if (obj.fontSize !== undefined) scaled.fontSize = obj.fontSize * scale
  }
  
  // 线宽也需要缩放
  if (obj.lineWidth !== undefined) {
    scaled.lineWidth = obj.lineWidth * scale
  }
  
  return scaled
}
```

**加载笔记时的使用**：

```typescript
const loadAnnotations = async () => {
  try {
    // 从store获取注释
    const pageAnnotations = store.allAnnotations[props.layout.pageNum] || []
    
    if (pageAnnotations.length > 0) {
      // 将store中的对象转换为DrawObject格式，并应用当前scale
      objects.value = pageAnnotations.map((obj: unknown) => {
        const drawObj = obj as Partial<DrawObject>
        if (drawObj.type && drawObj.color !== undefined) {
          // 笔记坐标是标准化的（基于scale=1），需要转换为当前scale
          return scaleCoordinates(obj as DrawObject, store.scale)
        }
        // ... 兼容性处理
      })
    } else {
      objects.value = []
    }
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页加载笔记失败:`, err)
    objects.value = []
  }
}
```

### 3. Canvas尺寸调整

PDF缩放时，笔记Canvas的尺寸也需要相应调整：

```typescript
const initDrawingCanvas = async () => {
  // 获取PDF页面原始尺寸（用于坐标标准化）
  if (baseViewportWidth === 0 || baseViewportHeight === 0) {
    const rawPdfDoc = toRaw(store.pdfDoc)
    const page = await rawPdfDoc.getPage(props.layout.pageNum)
    const rawPage = toRaw(page)
    const baseViewport = rawPage.getViewport({ scale: 1.0 })
    baseViewportWidth = baseViewport.width
    baseViewportHeight = baseViewport.height
  }
  
  // 获取设备像素比
  const dpr = window.devicePixelRatio || 1
  // 获取当前scale下的viewport尺寸
  const rawPdfDoc = toRaw(store.pdfDoc)
  const page = await rawPdfDoc.getPage(props.layout.pageNum)
  const rawPage = toRaw(page)
  const currentViewport = rawPage.getViewport({ scale: store.scale })
  
  // 设置Canvas实际分辨率（高DPI支持）
  const canvasWidth = currentViewport.width * dpr
  const canvasHeight = currentViewport.height * dpr
  
  // 设置Canvas尺寸
  drawingCanvas.value.width = canvasWidth
  drawingCanvas.value.height = canvasHeight
  drawingCanvas.value.style.width = `${currentViewport.width}px`
  drawingCanvas.value.style.height = `${currentViewport.height}px`
  
  // 获取上下文并重置变换矩阵，然后设置缩放以适应高DPI
  ctx = drawingCanvas.value.getContext('2d')
  if (!ctx) {
    throw new Error('无法获取Canvas上下文')
  }
  // 重置变换矩阵（确保之前的状态被清除）
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  
  // 加载现有笔记（会在加载时进行坐标转换）
  await loadAnnotations()
  
  // 初始渲染
  render()
}
```

**关键点**：
- Canvas的物理尺寸（width/height） = `currentViewport.width * dpr`
- Canvas的CSS尺寸（style.width/height） = `currentViewport.width`
- Canvas上下文设置了 `ctx.scale(dpr, dpr)`，所以绘制时使用逻辑坐标（CSS像素）

### 4. 缩放监听与重新初始化

当PDF缩放比例改变时，需要重新初始化Canvas并重新加载笔记：

```typescript
// 防抖渲染函数
const debouncedRender = () => {
  // 清除之前的定时器
  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer)
  }
  
  // 设置新的定时器
  renderDebounceTimer = setTimeout(async () => {
    // 重新渲染 PDF
    await initPdfPage()
    
    // 重新初始化 DrawingBoard Canvas
    await initDrawingCanvas()
    
    renderDebounceTimer = null
  }, 150) // 150ms防抖延迟
}

// 监听缩放变化
watch(() => store.scale, () => {
  debouncedRender()
})
```

**流程**：
1. 缩放比例改变 → 触发 `watch(() => store.scale)`
2. 防抖延迟150ms（避免频繁缩放时重复初始化）
3. 重新初始化PDF页面（`initPdfPage`）
4. 重新初始化笔记Canvas（`initDrawingCanvas`）
   - 调整Canvas尺寸
   - 重新加载笔记（`loadAnnotations`）
   - 笔记坐标从标准坐标转换为当前scale坐标
5. 重新渲染笔记（`render`）

## 支持的笔记类型及缩放处理

### 1. 路径（Path）
- **坐标**：所有点的 `x` 和 `y` 坐标
- **线宽**：`lineWidth`

```typescript
// 标准化
normalized.points = obj.points.map(p => ({
  x: p.x / scale,
  y: p.y / scale
}))

// 缩放
scaled.points = obj.points.map(p => ({
  x: p.x * scale,
  y: p.y * scale
}))
```

### 2. 矩形（Rectangle）
- **坐标**：`x`, `y`, `width`, `height`
- **线宽**：`lineWidth`

### 3. 圆形（Circle）
- **坐标**：`x`, `y`, `radius`
- **线宽**：`lineWidth`

### 4. 线条（Line）
- **坐标**：`x1`, `y1`, `x2`, `y2`
- **线宽**：`lineWidth`

### 5. 三角形（Triangle）
- **坐标**：`x`, `y`, `width`, `height`
- **线宽**：`lineWidth`

### 6. 文本（Text）
- **坐标**：`x`, `y`
- **字体大小**：`fontSize`（需要缩放）
- **注意**：文本颜色和内容不需要缩放

## 缩放时的完整流程

### 场景：用户从 scale=1.0 放大到 scale=2.0

1. **触发缩放**
   - 用户操作（按钮、滚轮、双指）触发 `store.setScale(2.0)`

2. **PDF页面重新渲染**
   - `initPdfPage()` 重新渲染PDF Canvas
   - 使用新的 `scale=2.0` 计算viewport尺寸

3. **笔记Canvas重新初始化**（防抖150ms）
   - `initDrawingCanvas()` 被调用
   - Canvas尺寸调整为 `currentViewport.width * dpr`

4. **笔记坐标转换**
   - `loadAnnotations()` 加载笔记
   - 对每个笔记对象调用 `scaleCoordinates(obj, 2.0)`
   - 所有坐标乘以2.0

5. **笔记重新渲染**
   - `render()` 使用转换后的坐标绘制笔记
   - 笔记与PDF页面保持相同的缩放比例

### 场景：用户从 scale=2.0 缩小到 scale=1.0

流程相同，但坐标转换方向相反：
- 存储时：当前坐标（scale=2.0） → 标准化坐标（除以2.0）
- 加载时：标准化坐标 → 当前坐标（乘以1.0）

## 性能优化

### 1. 防抖处理
- 缩放时使用150ms防抖，避免频繁缩放时重复初始化
- 减少不必要的计算和渲染

### 2. 异步处理
- 使用 `async/await` 处理异步操作
- 使用 `nextTick()` 等待DOM更新

### 3. 坐标转换时机
- 只在加载时转换坐标，而不是每次绘制时转换
- 转换后的坐标存储在 `objects.value` 中，直接用于绘制

## 注意事项

### 1. 坐标精度
- 使用标准坐标（scale=1）可以避免多次缩放导致的精度损失
- 但需要注意浮点数精度问题

### 2. 高DPI支持
- Canvas需要考虑设备像素比（DPR）
- 使用 `ctx.scale(dpr, dpr)` 确保在高DPI屏幕上清晰显示

### 3. 绘制时的坐标系统
- 绘制时使用的坐标是**逻辑坐标**（CSS像素）
- Canvas的实际像素 = 逻辑像素 × DPR
- 因为 `ctx.scale(dpr, dpr)`，所以绘制时直接使用逻辑坐标即可

### 4. 兼容性
- 代码中包含对旧格式（Fabric格式）的兼容处理
- 假设旧数据也是基于scale=1的

## 与草稿本缩放的对比

| 特性 | PDF笔记缩放 | 草稿本缩放 |
|------|------------|-----------|
| **存储方式** | 标准化坐标（scale=1） | 逻辑坐标（固定） |
| **缩放实现** | 重新计算坐标 + 重新渲染 | CSS Transform |
| **性能** | 需要重新渲染Canvas | GPU加速，性能优异 |
| **精度** | 高精度（标准化坐标） | 中等精度（CSS Transform） |
| **复杂度** | 需要坐标转换逻辑 | 实现简单 |

## 总结

PDF放大时笔记的缩放机制：

1. **标准化存储**：笔记以标准坐标（scale=1）存储
2. **动态转换**：加载时根据当前scale转换为显示坐标
3. **Canvas同步**：Canvas尺寸随PDF viewport尺寸变化
4. **防抖优化**：使用防抖避免频繁缩放时的性能问题

这种设计确保了笔记与PDF内容的完美同步，无论PDF处于什么缩放级别，笔记都能保持正确的位置和大小。



