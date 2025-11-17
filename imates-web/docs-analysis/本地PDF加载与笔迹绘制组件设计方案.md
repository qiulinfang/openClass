# 本地PDF加载与笔迹绘制组件设计方案

## 📋 任务分析

### 需求概述
创建一个新组件，具备以下功能：
1. **加载本地PDF文件**：通过文件选择器选择本地PDF文件
2. **渲染PDF**：将PDF内容渲染到Canvas上
3. **支持绘制笔迹**：在PDF上绘制手写笔迹（签字笔工具）

### 现有实现分析

#### 1. PDF加载相关
- **PdfCoreService.ts**：提供PDF加载、渲染、布局计算等核心功能
  - `loadPdf(file: File)`：加载PDF文件
  - `renderPage()`：渲染单页到Canvas
  - `calculatePageLayouts()`：计算页面布局
- **pdfViewerStore.ts**：PDF状态管理，包含`loadPdf()`方法

#### 2. PDF渲染相关
- **PdfPage.vue**：单页PDF渲染组件
  - 支持PDF页面渲染
  - 支持DrawingBoard标注层
  - 支持笔迹绘制（pen工具）
- **PdfContinuousView.vue**：连续视图PDF组件
  - 支持多页连续显示
  - 支持注释渲染

#### 3. 笔迹绘制相关
- **PdfPage.vue**：包含完整的笔迹绘制逻辑
  - `handleDrawingMouseDown()`：开始绘制
  - `handleDrawingMouseMove()`：继续绘制
  - `handleDrawingMouseUp()`：完成绘制
  - 使用`PdfCoreService`的注释服务创建INK注释
- **pen工具绘制流程**：已完整实现，支持：
  - Canvas坐标到PDF坐标转换
  - MuPDF INK注释创建
  - 实时预览渲染

### 代码复用策略

根据用户规则"代码复用优先"，新组件应该：
1. **复用PdfCoreService**：使用现有的PDF加载和渲染服务
2. **复用笔迹绘制逻辑**：参考PdfPage.vue的绘制实现
3. **独立组件设计**：不依赖Store，可以独立使用

---

## 🎯 设计方案

### 组件名称
`LocalPdfViewer.vue`

### 组件位置
`imates-web/src/components/LocalPdfViewer.vue`

### 功能设计

#### 1. 文件选择功能
- 使用HTML5 `<input type="file">` 文件选择器
- 支持PDF文件类型过滤（`accept="application/pdf"`）
- 文件选择后自动加载PDF

#### 2. PDF渲染功能
- 使用`PdfCoreService`加载PDF
- 支持单页显示模式（简化版，类似PdfPage）
- 使用Canvas渲染PDF页面
- 支持高DPI设备

#### 3. 笔迹绘制功能
- 集成pen工具绘制逻辑
- 使用`PdfCoreService`的注释服务
- 支持实时预览
- 笔迹保存到PDF注释中

### 组件结构

```
LocalPdfViewer.vue
├── 文件选择区域（未加载时显示）
│   └── 文件选择按钮
├── PDF渲染区域（加载后显示）
│   ├── PDF Canvas层
│   └── Drawing Canvas层（笔迹绘制）
└── 工具栏（可选）
    └── 笔迹工具按钮
```

### Props设计

```typescript
interface Props {
  // 是否显示文件选择器（默认true）
  showFilePicker?: boolean
  // 是否显示工具栏（默认true）
  showToolbar?: boolean
  // 初始PDF文件（可选）
  initialFile?: File | null
}
```

### Events设计

```typescript
interface Emits {
  // PDF加载完成
  'pdf-loaded': [pdfDoc: MuPDFDocumentProxy, totalPages: number]
  // PDF加载失败
  'pdf-error': [error: Error]
  // 文件选择
  'file-selected': [file: File]
  // 笔迹变更
  'annotation-changed': [annotations: MuPDFAnnotationData[]]
}
```

### 状态管理

组件内部状态（不依赖外部Store）：
- `pdfDoc: MuPDFDocumentProxy | null`：PDF文档对象
- `currentPage: number`：当前页码（默认1）
- `isLoading: boolean`：加载状态
- `error: string | null`：错误信息
- `selectedTool: 'pen' | 'none'`：当前工具
- `drawingConfig: DrawingConfig`：绘制配置

### 核心方法

#### 1. 文件加载
```typescript
async handleFileSelect(file: File): Promise<void>
```
- 步骤1：验证文件类型
- 步骤2：使用PdfCoreService加载PDF
- 步骤3：初始化PDF渲染
- 步骤4：初始化标注层

#### 2. PDF渲染
```typescript
async renderPdfPage(pageNum: number): Promise<void>
```
- 步骤1：获取页面对象
- 步骤2：设置Canvas尺寸（高DPI支持）
- 步骤3：渲染PDF页面到Canvas

#### 3. 笔迹绘制
```typescript
// 开始绘制
handleDrawingMouseDown(e: MouseEvent): void

// 继续绘制
handleDrawingMouseMove(e: MouseEvent): void

// 完成绘制
handleDrawingMouseUp(e: MouseEvent): void
```

### 绘制配置

使用简化的绘制配置：
```typescript
const defaultDrawingConfig: DrawingConfig = {
  penColor: '#000000',
  penWidth: 2,
  highlighterColor: '#ffff00',
  highlighterWidth: 10,
  highlighterOpacity: 50,
  eraserMode: 'stroke',
  eraserSize: 20,
  screenshotShape: 'rectangle',
  screenshotStrokeColor: '#ff0000',
  screenshotFillColor: 'transparent',
  screenshotStrokeWidth: 2
}
```

---

## 🔧 技术实现细节

### 1. PDF加载流程

```
用户选择文件
    ↓
handleFileSelect()
    ↓
PdfCoreService.loadPdf(file)
    ↓
获取pdfDoc和totalPages
    ↓
初始化PDF渲染
    ↓
初始化标注层
    ↓
触发'pdf-loaded'事件
```

### 2. 笔迹绘制流程

```
用户按下鼠标
    ↓
handleDrawingMouseDown()
    ↓
检查工具类型（pen）
    ↓
初始化annotationService
    ↓
开始绘制（startInkDrawing）
    ↓
用户移动鼠标
    ↓
handleDrawingMouseMove()
    ↓
继续绘制（continueInkDrawing）
    ↓
实时预览渲染
    ↓
用户释放鼠标
    ↓
handleDrawingMouseUp()
    ↓
完成绘制（finishInkDrawing）
    ↓
创建MuPDF INK注释
    ↓
重新渲染PDF页面
```

### 3. 坐标转换

复用PdfCoreService的坐标转换方法：
- `canvasToPageCoords()`：Canvas坐标 → PDF页面坐标
- `pageToCanvasCoords()`：PDF页面坐标 → Canvas坐标

### 4. 注释管理

使用PdfCoreService的注释服务：
- `initializeAnnotationService()`：初始化注释服务
- `startInkDrawing()`：开始绘制
- `continueInkDrawing()`：继续绘制
- `finishInkDrawing()`：完成绘制并创建注释

---

## 📦 依赖关系

### 外部依赖
- `PdfCoreService`：PDF核心服务
- `MuPDFDocumentProxy`：PDF文档代理类型
- `MuPDFAnnotationData`：注释数据类型
- `DrawingConfig`：绘制配置类型

### 内部依赖
- Vue 3 Composition API
- Canvas API（浏览器原生）

### 不依赖
- ❌ `pdfViewerStore`：组件独立，不依赖Store
- ❌ `PdfPage.vue`：参考实现，但不直接依赖
- ❌ 路由系统：组件可独立使用

---

## 🎨 UI设计

### 未加载状态
```
┌─────────────────────────────┐
│                             │
│      📄 选择PDF文件          │
│                             │
│   [选择文件] 按钮            │
│                             │
└─────────────────────────────┘
```

### 已加载状态
```
┌─────────────────────────────┐
│ [工具: 笔] [颜色] [大小]    │ ← 工具栏（可选）
├─────────────────────────────┤
│                             │
│      PDF页面渲染区域         │
│      (Canvas)               │
│                             │
│      Drawing层（笔迹）       │
│      (Canvas)               │
│                             │
└─────────────────────────────┘
```

---

## ✅ 实现检查清单

### 核心功能
- [ ] 文件选择器实现
- [ ] PDF加载功能
- [ ] PDF渲染功能
- [ ] 笔迹绘制功能
- [ ] 坐标转换
- [ ] 注释创建和保存

### 用户体验
- [ ] 加载状态提示
- [ ] 错误处理
- [ ] 文件类型验证
- [ ] 绘制实时预览

### 代码质量
- [ ] 类型定义完整
- [ ] 错误处理完善
- [ ] 资源清理（组件卸载时）
- [ ] 代码注释清晰

---

## 🔄 后续扩展建议

### 功能扩展
1. **多页支持**：支持翻页查看多页PDF
2. **工具栏**：添加颜色选择、笔触大小等工具
3. **撤销/重做**：支持笔迹撤销和重做
4. **保存功能**：支持保存修改后的PDF
5. **导出功能**：支持导出带笔迹的PDF

### 性能优化
1. **懒加载**：多页时按需加载页面
2. **虚拟滚动**：大量页面时使用虚拟滚动
3. **绘制优化**：优化绘制性能，减少重绘

---

## 📝 总结

### 设计原则
1. **代码复用优先**：复用PdfCoreService和现有绘制逻辑
2. **独立组件**：不依赖Store，可独立使用
3. **简化设计**：先实现核心功能，后续可扩展

### 实现步骤
1. 创建组件文件`LocalPdfViewer.vue`
2. 实现文件选择功能
3. 实现PDF加载和渲染
4. 集成笔迹绘制功能
5. 添加错误处理和状态管理
6. 测试和优化

### 预期效果
- 用户可以点击按钮选择本地PDF文件
- PDF自动加载并渲染
- 用户可以在PDF上绘制笔迹
- 笔迹保存到PDF注释中

---

## 📚 参考文档

- `imates-web/src/services/pdf/core/PdfCoreService.ts`：PDF核心服务
- `imates-web/src/components/PdfPage.vue`：单页PDF组件（参考）
- `imates-web/docs-analysis/pen工具绘制流程梳理.md`：笔迹绘制流程文档
- `imates-web/docs-prd/MuPDF.js使用文档.md`：MuPDF.js使用文档



