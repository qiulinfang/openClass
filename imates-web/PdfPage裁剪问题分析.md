# PdfPage.vue 裁剪问题分析

## 问题概述

对比HTML示例和PdfPage.vue的裁剪逻辑，发现了一个关键的坐标系统不一致问题。

## HTML示例的裁剪逻辑

HTML示例使用Canvas的`clip()`方法进行裁剪：
1. 绘制底层内容（低对比度）
2. 使用`ctx.clip()`定义裁剪区域
3. 在裁剪区域内重新绘制高亮内容
4. 预览Canvas使用`drawImage`裁剪并显示

**关键点**：HTML示例中只有一个Canvas，坐标系统统一。

## PdfPage.vue的裁剪逻辑问题

PdfPage.vue中有两个Canvas：
- `pdfCanvas`: 渲染PDF内容
- `drawingCanvas`: 渲染绘制层（标注、截图选区等）

### Canvas尺寸设置

**pdfCanvas**:
```typescript
canvas.width = viewport.width * dpr  // 实际像素
canvas.style.width = `${viewport.width}px`  // CSS像素
context.scale(dpr, dpr)  // 上下文缩放
```

**drawingCanvas**:
```typescript
canvas.width = currentViewport.width * dpr  // 实际像素
canvas.style.width = `${currentViewport.width}px`  // CSS像素
ctx.scale(dpr, dpr)  // 上下文缩放
```

### 问题所在：坐标系统不一致

在`captureScreenshot`函数中（第1287-1416行）：

1. **bounds的计算**：
   ```typescript
   const bounds = getObjectBounds(shape)
   ```
   `bounds`是相对于`drawingCanvas`的**逻辑坐标**（CSS像素），因为：
   - `shape`的坐标是在`drawingCanvas`上绘制的
   - `drawingCanvas`的上下文已经应用了`ctx.scale(dpr, dpr)`
   - 所以绘制时使用的坐标是逻辑坐标

2. **drawImage的使用**：
   ```typescript
   tempCtx.drawImage(
     pdfCanvas.value,
     sourceX,      // bounds.x (逻辑坐标)
     sourceY,      // bounds.y (逻辑坐标)
     sourceWidth,  // bounds.width (逻辑坐标)
     sourceHeight, // bounds.height (逻辑坐标)
     ...
   )
   ```
   **问题**：`drawImage`的源坐标参数需要的是**实际像素坐标**，而不是逻辑坐标！

3. **坐标转换缺失**：
   - `pdfCanvas.value.width` = `viewport.width * dpr`（实际像素）
   - `bounds.x` = 逻辑坐标（CSS像素）
   - 需要转换：`实际像素坐标 = 逻辑坐标 * dpr`

## 修复方案

在`captureScreenshot`函数中，需要将bounds从逻辑坐标转换为实际像素坐标：

```typescript
// 获取设备像素比
const dpr = window.devicePixelRatio || 1

// 将bounds从逻辑坐标转换为实际像素坐标
const sourceX = Math.round(bounds.x * dpr)
const sourceY = Math.round(bounds.y * dpr)
const sourceWidth = bounds.width * dpr
const sourceHeight = bounds.height * dpr

// 临时Canvas也需要使用实际像素尺寸
tempCanvas.width = Math.max(1, Math.round(sourceWidth))
tempCanvas.height = Math.max(1, Math.round(sourceHeight))

// 绘制PDF内容（使用实际像素坐标）
tempCtx.drawImage(
  pdfCanvas.value,
  sourceX,
  sourceY,
  sourceWidth,
  sourceHeight,
  0,
  0,
  tempCanvas.width,
  tempCanvas.height
)
```

## 其他潜在问题

1. **绘制层内容的坐标转换**：
   - `drawObjectToContext`中使用的offset也需要考虑DPR
   - 或者临时Canvas的上下文也需要应用相同的缩放

2. **边界检查**：
   - 边界检查应该使用实际像素坐标：
   ```typescript
   sourceX >= 0 && sourceX < pdfCanvas.value.width
   sourceY >= 0 && sourceY < pdfCanvas.value.height
   ```

## 总结

核心问题是：**坐标系统不一致**
- `bounds`是逻辑坐标（CSS像素）
- `drawImage`需要实际像素坐标
- 缺少`dpr`的转换

修复方法：在截图时，将所有坐标乘以`dpr`转换为实际像素坐标。

