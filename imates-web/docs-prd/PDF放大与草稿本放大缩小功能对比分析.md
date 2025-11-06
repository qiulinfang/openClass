# PDF放大与草稿本放大缩小功能对比分析

## 一、概述

本文档对比分析了PDF查看器（PdfPage）和草稿本（DrawingBoard）的放大缩小功能实现，包括技术架构、交互方式、缩放算法等方面的差异。

## 二、核心差异总结

| 对比维度 | PDF查看器 | 草稿本 |
|---------|----------|--------|
| **缩放实现方式** | 重新计算布局 + 重新渲染 | CSS Transform |
| **缩放范围** | 0.5 - 3.0（50%-300%） | 0.1 - 3.0（10%-300%） |
| **缩放步长** | 0.03（3%） | 0.1（10%） |
| **鼠标滚轮缩放** | ✅ 支持（Ctrl+滚轮） | ❌ 不支持 |
| **缩放中心点** | 鼠标位置 | 画布中心（按钮）或双指中心（触摸） |
| **状态管理** | Pinia Store | 组件内ref |
| **布局计算** | 异步重新计算页面布局 | 无需布局计算 |
| **坐标系统** | 文档坐标 + 页面坐标 | Canvas逻辑坐标 |
| **性能影响** | 需要重新渲染页面 | 纯CSS变换，性能优异 |

## 三、技术实现对比

### 3.1 缩放实现方式

#### PDF查看器：布局重新计算 + 重新渲染

**实现原理：**
```typescript
// 1. 缩放状态管理（Pinia Store）
scale: 1.0  // 初始缩放

// 2. 缩放变化监听，触发布局重新计算
watch(() => store.scale, async (newScale, oldScale) => {
  // 重新计算页面布局
  const layouts = await pdfCoreService.calculatePageLayouts(newScale, store.pageGap)
  store.pageLayouts = layouts
})

// 3. 布局计算（根据scale计算每页的高度和位置）
async calculatePageLayouts(scale: number = 1.0, pageGap?: number): Promise<PageLayout[]> {
  const layouts: PageLayout[] = []
  let accumulatedTop = 0

  for (let i = 1; i <= this.pdfDoc.numPages; i++) {
    const page = await this.pdfDoc.getPage(i)
    const viewport = page.getViewport({ scale: this.scale })  // 根据scale计算viewport
    
    layouts.push({
      pageNum: i,
      top: accumulatedTop,
      height: viewport.height,  // 高度随scale变化
      width: viewport.width
    })
    
    accumulatedTop += viewport.height + gap
  }
  
  return layouts
}
```

**特点：**
- 缩放会改变PDF页面的实际尺寸（width/height）
- 需要重新计算所有页面的布局位置
- 需要重新渲染PDF页面内容
- 性能开销较大，但能保持PDF内容的清晰度

#### 草稿本：CSS Transform

**实现原理：**
```typescript
// 1. 缩放状态管理（组件内ref）
const zoomLevel = ref(1)

// 2. 通过CSS transform实现缩放
const canvasStyle = computed(() => {
  return {
    width: `${canvasWidth.value}px`,
    height: `${canvasHeight.value}px`,
    transform: `translate(-50%, -50%) translate(${canvasOffset.value.x}px, ${canvasOffset.value.y}px) scale(${zoomLevel.value})`,
  }
})
```

**特点：**
- 缩放不改变canvas的实际尺寸
- 纯CSS变换，无需重新渲染
- 性能优异，缩放流畅
- 但可能导致内容在某些缩放级别下不够清晰

### 3.2 缩放中心点算法

#### PDF查看器：`zoomAtPoint`函数

**核心算法：**
```typescript
const zoomAtPoint = async (point: { x: number, y: number }, oldScale: number, newScale: number) => {
  // 1. 计算缩放点在文档中的绝对位置
  const pointInDocument = {
    y: scrollContainer.scrollTop + pointRelativeToContainer.y
  }

  // 2. 找到包含该点的页面，计算点在页面中的位置
  for (let i = 0; i < store.pageLayouts.length; i++) {
    const layout = store.pageLayouts[i]
    if (pointInDocument.y >= layout.top && pointInDocument.y < layout.top + layout.height) {
      targetPageIndex = i
      pointInPageY = pointInDocument.y - layout.top  // 点在页面内的相对位置
      oldLayoutHeight = layout.height
      break
    }
  }

  // 3. 执行缩放（触发布局重新计算）
  store.setScale(newScale)

  // 4. 等待布局重新计算完成（轮询检查）
  while (Date.now() - startTime < maxWaitTime) {
    const newLayout = store.pageLayouts[targetPageIndex]
    if (Math.abs(newLayout.height - expectedNewHeight) < 1) {
      break  // 布局已更新
    }
    await new Promise(resolve => setTimeout(resolve, 16))
  }

  // 5. 计算缩放点在文档中的新位置
  const scaleRatio = newScale / oldScale
  const newPointInPageY = pointInPageY * scaleRatio
  const newPointInDocument = newLayout.top + newPointInPageY

  // 6. 调整滚动位置，使缩放点保持在视口中的相同位置
  scrollContainer.scrollTop = newPointInDocument - pointRelativeToContainer.y
}
```

**算法特点：**
- 需要等待布局重新计算完成（异步）
- 通过调整滚动位置保持缩放点不变
- 算法复杂度较高，但能精确控制缩放中心

#### 草稿本：CSS Transform + offset调整

**核心算法（双指缩放）：**
```typescript
// 1. 计算手指在canvas上的逻辑坐标
const canvasPointX = (fingerRelativeX - initialTouchTranslateX.value) / initialTouchScale.value
const canvasPointY = (fingerRelativeY - initialTouchTranslateY.value) / initialTouchScale.value

// 2. 应用新的缩放
zoomLevel.value = clampedScale

// 3. 计算新的offset，使该逻辑坐标点保持在当前手指位置
canvasOffset.value = {
  x: currentFingerRelativeX - canvasPointX * clampedScale,
  y: currentFingerRelativeY - canvasPointY * clampedScale,
}
```

**算法特点：**
- 同步计算，无需等待
- 通过调整canvasOffset保持缩放中心
- 算法简单高效
- 但按钮点击缩放仍以画布中心为缩放中心

### 3.3 交互方式对比

#### PDF查看器

**1. 鼠标滚轮缩放（Ctrl+滚轮）**
```typescript
const handleWheel = (event: WheelEvent) => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    const zoomStep = 0.03
    const delta = event.deltaY > 0 ? -zoomStep : zoomStep
    const newScale = Math.max(0.5, Math.min(3.0, oldScale + delta))
    
    // 以鼠标位置为原点进行缩放
    zoomAtPoint({ x: event.clientX, y: event.clientY }, oldScale, newScale)
  } else {
    // 否则正常滚动
    scrollContainer.scrollTop += event.deltaY
  }
}
```

**2. 按钮点击缩放**
```typescript
// 放大/缩小按钮
handleZoomIn() {
  store.zoomIn(0.03)  // 步长3%
}

handleZoomOut() {
  store.zoomOut(0.03)  // 步长3%
}
```

**3. 双指触摸缩放**
```typescript
if (touchState.value.isZooming) {
  const scaleRatio = currentDistance / initialDistance
  const newScale = oldScale * scaleRatio
  const clampedScale = Math.max(0.5, Math.min(3.0, newScale))
  
  // 以双指中心为原点进行缩放
  const centerX = (touch1.clientX + touch2.clientX) / 2
  const centerY = (touch1.clientY + touch2.clientY) / 2
  zoomAtPoint({ x: centerX, y: centerY }, oldScale, clampedScale)
}
```

#### 草稿本

**1. 按钮点击缩放**
```typescript
const zoomIn = () => {
  if (zoomLevel.value >= 3) return
  zoomLevel.value = Math.min(3, zoomLevel.value + 0.1)  // 步长10%
}

const zoomOut = () => {
  if (zoomLevel.value <= 0.1) return
  zoomLevel.value = Math.max(0.1, zoomLevel.value - 0.1)  // 步长10%
}
```

**2. 双指触摸缩放**
```typescript
// 双指缩放时保持手指下内容不变
if (hasZoomIntent) {
  // 计算手指在canvas上的逻辑坐标
  const canvasPointX = (fingerRelativeX - initialTouchTranslateX.value) / initialTouchScale.value
  const canvasPointY = (fingerRelativeY - initialTouchTranslateY.value) / initialTouchScale.value
  
  // 应用新的缩放
  zoomLevel.value = clampedScale
  
  // 调整offset保持手指下内容不变
  canvasOffset.value = {
    x: currentFingerRelativeX - canvasPointX * clampedScale,
    y: currentFingerRelativeY - canvasPointY * clampedScale,
  }
}
```

**3. 手型工具拖动**
```typescript
// 拖动画布调整视口位置
if (isPanning.value && panStartPoint.value) {
  const dx = e.clientX - panStartPoint.value.x
  const dy = e.clientY - panStartPoint.value.y
  canvasOffset.value = {
    x: panStartOffset.value.x + dx,
    y: panStartOffset.value.y + dy,
  }
}
```

### 3.4 状态管理对比

#### PDF查看器：Pinia Store

```typescript
// stores/pdfViewerStore.ts
export const usePdfViewerStore = defineStore('pdfViewer', {
  state: () => ({
    scale: 1.0,  // 缩放比例
    pageLayouts: [] as PageLayout[],  // 页面布局信息
  }),
  
  getters: {
    scalePercentage: (state) => Math.round(state.scale * 100)
  },
  
  actions: {
    setScale(newScale: number) {
      this.scale = Math.max(0.5, Math.min(3.0, newScale))
    },
    zoomIn(step: number = 0.03) {
      this.setScale(this.scale + step)
    },
    zoomOut(step: number = 0.03) {
      this.setScale(this.scale - step)
    },
    resetZoom() {
      this.setScale(1.0)
    }
  }
})
```

**特点：**
- 全局状态管理，可在多个组件间共享
- 缩放变化会触发布局重新计算（通过watch）
- 状态持久化方便

#### 草稿本：组件内ref

```typescript
// DrawingBoard.vue
const zoomLevel = ref(1)  // 缩放级别
const canvasOffset = ref({ x: 0, y: 0 })  // 画布偏移
```

**特点：**
- 局部状态管理，作用域限于组件内
- 响应式更新，自动触发CSS样式更新
- 实现简单，无需额外的状态管理库

### 3.5 坐标系统对比

#### PDF查看器：文档坐标 + 页面坐标

**坐标层次：**
1. **屏幕坐标**：鼠标/触摸点在屏幕上的位置（clientX, clientY）
2. **容器坐标**：相对于滚动容器的位置
3. **文档坐标**：相对于文档顶部的绝对位置（scrollTop + 相对位置）
4. **页面坐标**：相对于页面顶部的相对位置

**坐标转换流程：**
```
屏幕坐标 → 容器坐标 → 文档坐标 → 页面坐标
```

#### 草稿本：Canvas逻辑坐标

**坐标层次：**
1. **屏幕坐标**：鼠标/触摸点在屏幕上的位置
2. **Canvas逻辑坐标**：不受缩放影响的canvas内部坐标

**坐标转换：**
```typescript
const getCanvasCoords = (e: MouseEvent | TouchEvent) => {
  const rect = canvasRef.value.getBoundingClientRect()
  return {
    x: (clientX - rect.left) / zoomLevel.value,  // 除以缩放级别
    y: (clientY - rect.top) / zoomLevel.value
  }
}
```

### 3.6 性能影响对比

#### PDF查看器

**性能开销：**
- 缩放时需要重新计算所有页面的布局
- 需要重新渲染PDF页面内容（通过PDF.js）
- 异步操作，需要等待布局更新完成
- 对于大文档，性能开销较大

**优化措施：**
- 使用虚拟滚动（virtual-scroll）只渲染可见页面
- 布局计算使用异步操作，不阻塞UI
- 轮询检查布局更新，避免长时间等待

#### 草稿本

**性能开销：**
- 纯CSS transform，无需重新渲染
- 同步操作，响应即时
- 性能开销极小

**优化措施：**
- CSS transform由GPU加速
- 无需额外的优化措施（已足够高效）

## 四、功能完整性对比

### 4.1 PDF查看器

**已实现功能：**
- ✅ 鼠标滚轮缩放（Ctrl+滚轮）
- ✅ 按钮点击缩放
- ✅ 双指触摸缩放
- ✅ 缩放中心点保持（鼠标位置）
- ✅ 缩放百分比显示
- ✅ 缩放重置功能

**UI设计：**
- 工具栏中的缩放控制按钮组
- 显示当前缩放百分比
- 支持点击百分比重置缩放

### 4.2 草稿本

**已实现功能：**
- ✅ 按钮点击缩放
- ✅ 双指触摸缩放
- ✅ 手型工具拖动（调整视口）
- ✅ 缩放百分比显示
- ❌ 鼠标滚轮缩放（未实现）
- ❌ 缩放重置功能（未实现）
- ⚠️ 按钮缩放以画布中心为缩放中心（体验不佳）

**UI设计：**
- 浮动缩放控制面板（Excalidraw风格）
- 显示当前缩放百分比
- 精美的阴影和过渡效果

## 五、使用场景差异

### 5.1 PDF查看器

**适用场景：**
- 需要查看PDF文档内容
- 需要精确的缩放控制（3%步长）
- 需要保持PDF内容的清晰度
- 需要查看多页文档

**特点：**
- 缩放会改变内容的实际尺寸
- 适合需要阅读和标记的场景
- 缩放后需要重新渲染，但能保证清晰度

### 5.2 草稿本

**适用场景：**
- 需要流畅的绘制体验
- 需要快速缩放调整
- 需要精细绘制（10%步长过大）
- 单页画布绘制

**特点：**
- 缩放不改变内容实际尺寸
- 适合需要频繁缩放调整的场景
- 缩放流畅，但可能导致内容在某些缩放级别下不够清晰

## 六、改进建议

### 6.1 PDF查看器改进建议

1. **优化缩放性能**
   - 考虑使用CSS transform实现初始缩放预览
   - 延迟重新渲染，先显示transform效果

2. **添加缩放动画**
   - 使用CSS transition实现平滑的缩放动画
   - 提升用户体验

3. **优化布局计算**
   - 缓存已计算的布局信息
   - 减少不必要的重新计算

### 6.2 草稿本改进建议

1. **添加鼠标滚轮缩放**
   ```typescript
   const handleWheel = (e: WheelEvent) => {
     if (e.ctrlKey || e.metaKey) {
       e.preventDefault()
       const zoomStep = 0.03
       const delta = e.deltaY > 0 ? -zoomStep : zoomStep
       const newScale = Math.max(0.1, Math.min(3, zoomLevel.value + delta))
       
       // 实现zoomAtPoint函数，以鼠标位置为缩放中心
       zoomAtPoint({ x: e.clientX, y: e.clientY }, zoomLevel.value, newScale)
     }
   }
   ```

2. **优化按钮缩放中心点**
   - 以鼠标位置（或画布中心）为缩放中心
   - 实现`zoomAtPoint`函数，类似PDF查看器

3. **减小缩放步长**
   - 将按钮点击缩放步长从10%改为3%
   - 提供更精细的缩放控制

4. **添加缩放重置功能**
   - 添加重置按钮，快速恢复到100%缩放
   - 快捷键支持（如`Ctrl+0`）

5. **添加缩放动画**
   - 使用CSS transition实现平滑的缩放动画
   - 提升用户体验

## 七、总结

### 7.1 核心差异

1. **实现方式**：PDF使用布局重新计算+重新渲染，草稿本使用CSS Transform
2. **性能**：PDF性能开销较大，草稿本性能优异
3. **缩放中心**：PDF支持以任意点为缩放中心，草稿本按钮缩放以画布中心为缩放中心
4. **交互方式**：PDF支持鼠标滚轮缩放，草稿本不支持
5. **缩放步长**：PDF使用3%步长（精细），草稿本使用10%步长（粗糙）

### 7.2 适用场景

- **PDF查看器**：适合需要精确缩放控制和保持内容清晰度的场景
- **草稿本**：适合需要流畅缩放体验和频繁调整的场景

### 7.3 最佳实践

1. **PDF查看器**：可以借鉴草稿本的CSS Transform实现，提升性能
2. **草稿本**：可以借鉴PDF查看器的鼠标滚轮缩放和缩放中心点算法，提升用户体验

两者各有优劣，可以根据具体需求选择合适的实现方式，或结合两种方式的优点进行优化。



