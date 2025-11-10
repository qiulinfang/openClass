# Konva.js 重构 PDF 阅读和笔记功能设计方案

## 一、任务概述

### 1.1 目标
使用 Konva.js 重构当前基于原生 Canvas API 实现的 PDF 阅读和笔记功能，提升交互性能和开发体验。

### 1.2 现状分析

#### 当前实现方式
- **PDF 渲染层**：使用 PDF.js 渲染到原生 Canvas
- **笔记绘制层**：使用原生 Canvas API 手动管理绘制对象
- **交互处理**：手动处理鼠标/触摸事件，手动计算坐标转换
- **对象管理**：使用数组存储 DrawObject，手动实现选择、拖拽、删除等功能

#### 当前实现的问题
1. **代码复杂度高**：需要手动管理所有绘制对象的生命周期
2. **性能问题**：每次重绘需要清空整个画布并重新绘制所有对象
3. **交互体验**：选择、拖拽等交互需要手动实现碰撞检测和坐标计算
4. **维护困难**：绘制逻辑分散在多个函数中，难以维护和扩展
5. **功能扩展性差**：添加新功能（如旋转、缩放单个对象）需要大量代码

### 1.3 Konva.js 的优势

1. **对象化绘制**：每个图形都是独立的对象，易于管理
2. **高性能**：内置图层管理和脏矩形重绘优化
3. **丰富的交互**：内置拖拽、选择、变换等交互功能
4. **事件系统**：完善的事件系统，简化交互处理
5. **变换支持**：内置旋转、缩放、倾斜等变换功能
6. **滤镜支持**：内置多种滤镜效果
7. **动画支持**：内置动画系统，支持平滑过渡

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    UnifiedToolbar.vue                    │
│              (统一工具栏 - 工具选择和配置)                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   PdfPage.vue                            │
│  ┌────────────────────────────────────────────────────┐ │
│  │  PDF 渲染层 (原生 Canvas - PDF.js)                  │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Konva Stage (Konva.js)                            │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │ Konva Layer (笔记绘制层)                      │ │ │
│  │  │ - Konva Line (路径绘制)                       │ │ │
│  │  │ - Konva Rect (矩形/截图)                      │ │ │
│  │  │ - Konva Circle (圆形)                         │ │ │
│  │  │ - Konva Text (文本)                           │ │ │
│  │  │ - Konva Transformer (变换控制)                 │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│         KonvaCanvasService.ts                            │
│    (Konva.js 服务层封装)                                  │
│  - Stage 初始化和管理                                     │
│  - 工具模式切换                                          │
│  - 对象创建和转换                                        │
│  - 事件处理和坐标转换                                    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│         pdfViewerStore.ts                                 │
│    (状态管理 - Pinia Store)                               │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│      IndexedDB (持久化存储)                                │
│    textbooks.localFiles[].annotations                     │
└───────────────────────────────────────────────────────────┘
```

### 2.2 核心组件设计

#### 2.2.1 PdfPage.vue（重构后）

**职责**：
- PDF 内容渲染（保持不变，使用 PDF.js）
- Konva Stage 初始化和生命周期管理
- 工具切换和配置更新
- 触摸手势处理（双指缩放/滑动）

**主要变化**：
- 移除原生 Canvas 绘制逻辑
- 使用 Konva Stage 替代原生 Canvas
- 通过 KonvaCanvasService 管理绘制对象

#### 2.2.2 KonvaCanvasService.ts（新建）

**职责**：Konva.js 服务层封装，提供框架无关的 Canvas 操作

**核心功能**：

1. **Stage 管理**
   - Stage 初始化和配置
   - 高 DPI 支持（devicePixelRatio）
   - 尺寸同步（与 PDF 页面尺寸一致）

2. **工具模式切换**
   - `pen`：签字笔模式（使用 Konva.Line）
   - `highlighter`：荧光笔模式（使用 Konva.Line + 透明度）
   - `eraser`：橡皮擦模式（整笔擦除）
   - `screenshot`：截图模式（使用 Konva.Rect 或 Konva.Line）
   - `select`：选择模式（使用 Konva.Transformer）

3. **对象管理**
   - 创建绘制对象（Line、Rect、Circle、Text 等）
   - 对象选择和多选
   - 对象拖拽和变换
   - 对象删除

4. **坐标转换**
   - 屏幕坐标 → Konva 坐标
   - 标准化坐标转换（scale=1 ↔ 当前 scale）

5. **事件处理**
   - 鼠标/触摸事件监听
   - 绘制事件处理
   - 选择事件处理

6. **数据序列化**
   - Konva 对象 → DrawObject（用于存储）
   - DrawObject → Konva 对象（用于加载）

#### 2.2.3 pdfViewerStore.ts（保持兼容）

**职责**：状态管理中心，管理 PDF 和标注数据

**变化**：
- 保持现有接口不变，确保向后兼容
- 数据格式保持 DrawObject 格式，KonvaCanvasService 负责转换

## 三、详细设计

### 3.1 Konva Stage 初始化

```typescript
// KonvaCanvasService.ts
class KonvaCanvasService {
  private stage: Konva.Stage | null = null
  private layer: Konva.Layer | null = null
  private transformer: Konva.Transformer | null = null
  
  init(container: HTMLElement, width: number, height: number, scale: number) {
    // 第1步：创建 Stage
    this.stage = new Konva.Stage({
      container: container,
      width: width,
      height: height,
      scaleX: scale,
      scaleY: scale,
    })
    
    // 第2步：创建 Layer
    this.layer = new Konva.Layer()
    this.stage.add(this.layer)
    
    // 第3步：创建 Transformer（用于选择和变换）
    this.transformer = new Konva.Transformer({
      nodes: [],
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      rotateAnchorOffset: 20,
    })
    this.layer.add(this.transformer)
    
    // 第4步：绑定事件
    this.bindEvents()
  }
}
```

### 3.2 工具模式实现

#### 3.2.1 签字笔模式（Pen）

```typescript
// 使用 Konva.Line 绘制路径
private currentLine: Konva.Line | null = null
private linePoints: number[] = []

handlePenStart(x: number, y: number) {
  // 第1步：创建新的 Line 对象
  this.currentLine = new Konva.Line({
    points: [x, y],
    stroke: this.config.penColor,
    strokeWidth: this.config.penWidth,
    lineCap: 'round',
    lineJoin: 'round',
    tension: 0.5, // 平滑曲线
  })
  
  // 第2步：添加到 Layer
  this.layer?.add(this.currentLine)
  this.linePoints = [x, y]
}

handlePenMove(x: number, y: number) {
  if (!this.currentLine) return
  
  // 第1步：添加点到路径
  this.linePoints.push(x, y)
  
  // 第2步：更新 Line 的 points
  this.currentLine.points(this.linePoints)
  
  // 第3步：触发重绘（Konva 会自动优化）
  this.layer?.batchDraw()
}
```

#### 3.2.2 荧光笔模式（Highlighter）

```typescript
// 与签字笔类似，但使用透明度和混合模式
handleHighlighterStart(x: number, y: number) {
  this.currentLine = new Konva.Line({
    points: [x, y],
    stroke: this.config.highlighterColor,
    strokeWidth: this.config.highlighterWidth,
    opacity: this.config.highlighterOpacity / 100,
    globalCompositeOperation: 'multiply', // 混合模式
    lineCap: 'round',
    lineJoin: 'round',
  })
  this.layer?.add(this.currentLine)
}
```

#### 3.2.3 橡皮擦模式（Eraser）

```typescript
// 整笔擦除：检测点击位置的对象并删除
handleEraser(x: number, y: number) {
  // 第1步：获取点击位置的对象
  const shape = this.stage?.getIntersection({ x, y })
  
  if (shape && shape !== this.transformer) {
    // 第2步：删除对象
    shape.destroy()
    
    // 第3步：更新 Transformer
    this.updateTransformer()
    
    // 第4步：触发重绘
    this.layer?.batchDraw()
    
    // 第5步：通知数据变化
    this.onDataChange()
  }
}
```

#### 3.2.4 截图模式（Screenshot）

```typescript
// 使用 Konva.Rect 绘制截图选区
private screenshotRect: Konva.Rect | null = null

handleScreenshotStart(x: number, y: number) {
  this.screenshotRect = new Konva.Rect({
    x,
    y,
    width: 0,
    height: 0,
    stroke: this.config.screenshotStrokeColor,
    fill: this.config.screenshotFillColor,
    strokeWidth: this.config.screenshotStrokeWidth,
  })
  this.layer?.add(this.screenshotRect)
}

handleScreenshotMove(x: number, y: number) {
  if (!this.screenshotRect) return
  
  const startX = this.screenshotRect.x()
  const startY = this.screenshotRect.y()
  
  this.screenshotRect.width(Math.abs(x - startX))
  this.screenshotRect.height(Math.abs(y - startY))
  
  if (x < startX) this.screenshotRect.x(x)
  if (y < startY) this.screenshotRect.y(y)
  
  this.layer?.batchDraw()
}
```

#### 3.2.5 选择模式（Select）

```typescript
// 使用 Konva.Transformer 实现选择和变换
handleSelectStart(x: number, y: number) {
  // 第1步：获取点击位置的对象
  const shape = this.stage?.getIntersection({ x, y })
  
  if (shape && shape !== this.transformer) {
    // 第2步：选中对象
    this.transformer?.nodes([shape])
    this.transformer?.moveToTop()
    
    // 第3步：触发重绘
    this.layer?.batchDraw()
  } else {
    // 第4步：框选模式（使用 Konva.Rect 绘制选框）
    this.startBoxSelection(x, y)
  }
}

// 框选实现
private selectionBox: Konva.Rect | null = null

startBoxSelection(x: number, y: number) {
  this.selectionBox = new Konva.Rect({
    x,
    y,
    width: 0,
    height: 0,
    stroke: '#2196F3',
    fill: 'rgba(33, 150, 243, 0.1)',
    dash: [5, 5],
  })
  this.layer?.add(this.selectionBox)
  this.selectionBox.moveToBottom()
}
```

### 3.3 坐标转换

#### 3.3.1 屏幕坐标 → Konva 坐标

```typescript
getKonvaPosition(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if (!this.stage) return null
  
  // 第1步：获取事件坐标
  const pointerPos = this.stage.getPointerPosition()
  if (!pointerPos) return null
  
  // 第2步：考虑 Stage 的 scale
  return {
    x: pointerPos.x / this.stage.scaleX(),
    y: pointerPos.y / this.stage.scaleY(),
  }
}
```

#### 3.3.2 标准化坐标转换

```typescript
// 将 Konva 对象坐标转换为标准化坐标（scale=1）
normalizeKonvaObject(node: Konva.Node, currentScale: number): DrawObject {
  const attrs = node.getAttrs()
  
  if (node instanceof Konva.Line) {
    // 第1步：获取 points
    const points = node.points()
    
    // 第2步：转换为标准化坐标
    const normalizedPoints = []
    for (let i = 0; i < points.length; i += 2) {
      normalizedPoints.push({
        x: points[i] / currentScale,
        y: points[i + 1] / currentScale,
      })
    }
    
    return {
      type: 'path',
      color: attrs.stroke,
      lineWidth: attrs.strokeWidth / currentScale,
      points: normalizedPoints,
    }
  }
  
  // 其他类型类似处理...
}

// 将标准化坐标转换为 Konva 对象
createKonvaObject(obj: DrawObject, currentScale: number): Konva.Node {
  if (obj.type === 'path') {
    // 第1步：转换 points
    const points: number[] = []
    obj.points?.forEach(p => {
      points.push(p.x * currentScale, p.y * currentScale)
    })
    
    // 第2步：创建 Konva.Line
    return new Konva.Line({
      points,
      stroke: obj.color,
      strokeWidth: obj.lineWidth * currentScale,
      lineCap: 'round',
      lineJoin: 'round',
    })
  }
  
  // 其他类型类似处理...
}
```

### 3.4 数据序列化

#### 3.4.1 Konva 对象 → DrawObject

```typescript
serializeKonvaObjects(): DrawObject[] {
  const objects: DrawObject[] = []
  
  this.layer?.children.forEach((node) => {
    // 跳过 Transformer 和临时对象
    if (node === this.transformer || node.name() === 'temp') return
    
    const normalized = this.normalizeKonvaObject(node, this.stage?.scaleX() || 1)
    objects.push(normalized)
  })
  
  return objects
}
```

#### 3.4.2 DrawObject → Konva 对象

```typescript
loadDrawObjects(objects: DrawObject[], currentScale: number) {
  // 第1步：清空当前 Layer
  this.layer?.destroyChildren()
  this.layer = new Konva.Layer()
  this.stage?.add(this.layer)
  
  // 第2步：重新创建 Transformer
  this.transformer = new Konva.Transformer({ nodes: [] })
  this.layer.add(this.transformer)
  
  // 第3步：加载对象
  objects.forEach(obj => {
    const konvaNode = this.createKonvaObject(obj, currentScale)
    this.layer?.add(konvaNode)
  })
  
  // 第4步：触发重绘
  this.layer?.batchDraw()
}
```

### 3.5 触摸手势处理

```typescript
// 双指缩放
handleTwoFingerZoom(
  touch1: Touch,
  touch2: Touch,
  initialDistance: number,
  initialScale: number
) {
  // 第1步：计算当前距离
  const currentDistance = this.getTouchDistance(touch1, touch2)
  
  // 第2步：计算缩放比例
  const scaleRatio = currentDistance / initialDistance
  const newScale = initialScale * scaleRatio
  
  // 第3步：限制缩放范围
  const clampedScale = Math.max(0.5, Math.min(3.0, newScale))
  
  // 第4步：计算中心点
  const center = this.getTouchCenter(touch1, touch2)
  
  // 第5步：以中心点为原点缩放
  this.zoomAtPoint(center, initialScale, clampedScale)
}

zoomAtPoint(point: { x: number; y: number }, oldScale: number, newScale: number) {
  if (!this.stage) return
  
  // 第1步：获取当前 Stage 位置
  const stagePos = this.stage.position()
  
  // 第2步：计算缩放点在 Stage 上的坐标
  const pointInStage = {
    x: (point.x - stagePos.x) / oldScale,
    y: (point.y - stagePos.y) / oldScale,
  }
  
  // 第3步：应用新缩放
  this.stage.scaleX(newScale)
  this.stage.scaleY(newScale)
  
  // 第4步：调整位置，使缩放点保持在原位置
  this.stage.position({
    x: point.x - pointInStage.x * newScale,
    y: point.y - pointInStage.y * newScale,
  })
  
  // 第5步：触发重绘
  this.layer?.batchDraw()
}
```

## 四、迁移方案

### 4.1 迁移步骤

#### 阶段一：基础框架搭建（1-2天）
1. 创建 `KonvaCanvasService.ts` 服务类
2. 实现 Stage 和 Layer 初始化
3. 实现基础的事件绑定
4. 在 `PdfPage.vue` 中集成 Konva Stage

#### 阶段二：工具模式实现（2-3天）
1. 实现签字笔模式（Konva.Line）
2. 实现荧光笔模式（Konva.Line + 透明度）
3. 实现橡皮擦模式（整笔擦除）
4. 实现截图模式（Konva.Rect）
5. 实现选择模式（Konva.Transformer）

#### 阶段三：坐标转换和数据序列化（1-2天）
1. 实现坐标转换函数
2. 实现 Konva 对象 ↔ DrawObject 转换
3. 实现数据加载和保存

#### 阶段四：触摸手势和缩放（1-2天）
1. 实现双指缩放
2. 实现双指滑动
3. 实现鼠标滚轮缩放

#### 阶段五：测试和优化（2-3天）
1. 功能测试
2. 性能优化
3. 兼容性测试
4. 文档更新

### 4.2 兼容性保证

#### 数据格式兼容
- 保持 `DrawObject` 数据格式不变
- 在 `KonvaCanvasService` 中实现转换逻辑
- 确保旧数据可以正常加载

#### API 兼容
- 保持 `pdfViewerStore` 接口不变
- 保持 `PdfPage.vue` 的 props 和 events 不变
- 确保父组件无需修改

### 4.3 回滚方案

如果迁移过程中出现问题，可以：
1. 保留原有 `PdfPage.vue` 代码（重命名为 `PdfPage.legacy.vue`）
2. 通过配置开关切换实现方式
3. 逐步迁移，确保每个阶段都可以回滚

## 五、技术细节

### 5.1 性能优化

#### 图层管理
```typescript
// 使用多个 Layer 分离不同类型的对象
private pdfLayer: Konva.Layer  // PDF 背景层（静态）
private annotationLayer: Konva.Layer  // 标注层（动态）
private tempLayer: Konva.Layer  // 临时绘制层（高频更新）
```

#### 脏矩形重绘
```typescript
// Konva 自动优化，但可以手动控制
this.layer?.batchDraw()  // 批量绘制，减少重绘次数
```

#### 对象缓存
```typescript
// 对静态对象启用缓存
node.cache()
node.getLayer()?.batchDraw()
```

### 5.2 高 DPI 支持

```typescript
init(container: HTMLElement, width: number, height: number, scale: number) {
  const dpr = window.devicePixelRatio || 1
  
  this.stage = new Konva.Stage({
    container: container,
    width: width * dpr,
    height: height * dpr,
    scaleX: scale,
    scaleY: scale,
  })
  
  // 设置容器 CSS 尺寸
  container.style.width = `${width}px`
  container.style.height = `${height}px`
}
```

### 5.3 事件处理优化

```typescript
// 使用事件委托，减少事件监听器数量
this.stage?.on('mousedown touchstart', (e) => {
  const tool = this.currentTool
  const pos = this.getKonvaPosition(e.evt)
  
  switch (tool) {
    case 'pen':
      this.handlePenStart(pos.x, pos.y)
      break
    // ...
  }
})
```

## 六、风险评估

### 6.1 技术风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| Konva.js 性能问题 | 高 | 充分测试，必要时使用图层分离和对象缓存 |
| 坐标转换精度损失 | 中 | 使用浮点数计算，避免整数截断 |
| 触摸手势冲突 | 中 | 实现手势优先级和冲突检测 |
| 数据格式不兼容 | 低 | 保持数据格式不变，只改变内部实现 |

### 6.2 时间风险

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 迁移时间超期 | 中 | 分阶段迁移，每个阶段独立可测试 |
| 功能遗漏 | 中 | 详细的功能对比清单，确保所有功能都实现 |

## 七、预期收益

### 7.1 开发效率提升
- **代码量减少**：预计减少 30-40% 的代码量
- **维护成本降低**：使用成熟的库，减少自定义代码
- **功能扩展更容易**：Konva 内置功能丰富，扩展更方便

### 7.2 性能提升
- **渲染性能**：Konva 的脏矩形重绘优化，减少不必要的重绘
- **交互响应**：内置的事件系统和对象管理，交互更流畅
- **内存占用**：对象化管理，内存使用更合理

### 7.3 用户体验提升
- **交互更流畅**：Konva 的优化使交互更顺滑
- **功能更丰富**：可以更容易地添加旋转、缩放等高级功能
- **视觉效果更好**：支持滤镜和动画，视觉效果更佳

## 八、后续优化方向

### 8.1 功能增强
1. **对象旋转**：使用 Konva.Transformer 的旋转功能
2. **对象缩放**：单个对象的独立缩放
3. **对象分组**：多个对象组合成一个组
4. **对象锁定**：防止误操作
5. **图层管理**：支持多个图层，可以显示/隐藏

### 8.2 性能优化
1. **虚拟滚动**：只渲染可见区域的 Konva 对象
2. **对象池**：复用 Konva 对象，减少创建/销毁开销
3. **Web Worker**：将复杂计算移到 Worker 线程

### 8.3 用户体验优化
1. **动画效果**：使用 Konva 动画系统实现平滑过渡
2. **手势识别**：更丰富的手势支持
3. **快捷键**：键盘快捷键支持

## 九、总结

使用 Konva.js 重构 PDF 阅读和笔记功能是一个值得投入的重构项目。通过使用成熟的 Canvas 库，可以显著提升开发效率、代码质量和用户体验。

**关键成功因素**：
1. 保持数据格式和 API 兼容性
2. 分阶段迁移，确保每个阶段都可以独立测试
3. 充分测试，确保功能完整性和性能
4. 保留回滚方案，降低风险

**建议**：
- 先在开发环境完成完整实现和测试
- 在测试环境进行充分的功能测试和性能测试
- 逐步灰度发布，确保稳定性





