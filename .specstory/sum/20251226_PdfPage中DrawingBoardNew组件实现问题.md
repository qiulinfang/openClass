问题序号：PdfPage中DrawingBoardNew组件实现问题

## 问题元信息
- **问题分类**：前端
- **严重程度**：中
- **影响范围**：PDF阅读页面的绘图功能模块
- **发现日期**：2025-11-08
- **解决状态**：进行中

## 问题现象
PdfPage.vue 组件目前使用原生 Canvas API 直接实现绘图功能，包括高亮、画笔、橡皮擦等工具。但是项目中已有 DrawingBoardNew.vue 组件实现了更完善的多页绘图功能，需要在 PdfPage.vue 中替换现有的 Canvas 实现为 DrawingBoardNew 组件，以统一绘图功能的实现和维护。

## 复现步骤
1. 步骤1：打开 PdfPage.vue 文件
2. 步骤2：查看模板部分，发现使用的是 `<canvas>` 元素进行绘图
3. 步骤3：查看脚本部分，发现有大量的 Canvas 绘图逻辑（如 `drawStrokePreview`、`drawEraserHitPreview` 等函数）

## 用户体验
- 影响点1：绘图功能代码重复，维护成本高
- 影响点2：PdfPage 和 HomeworkAnswerView 的绘图功能实现不一致
- 影响点3：缺少统一的绘图组件配置和调试功能

## 相关文件/模块
- **涉及文件**：
  - `d:\Project\xueban-qianduan\imates-web\src\components\PdfPage.vue`：需要替换绘图组件的主文件
  - `d:\Project\xueban-qianduan\imates-web\src\components\DrawingBoardNew.vue`：目标绘图组件
- **涉及模块**：
  - PDF阅读器模块：PdfPage 组件的绘图功能
  - 绘图组件模块：DrawingBoardNew 组件的多页绘图实现

## 技术原因 (❌)
1. 原因1：PdfPage.vue 目前使用原生 Canvas 2D API 直接实现绘图功能，包括坐标转换、笔迹绘制、橡皮擦等逻辑
2. 原因2：DrawingBoardNew.vue 组件提供了更完善的绘图功能，包括多页支持、背景图定位、调试面板等特性
3. 原因3：两种实现方式不统一，导致代码重复和维护困难

（包含错误的代码示例，使用代码块）

```typescript
// 当前 PdfPage.vue 中的绘图实现（使用 Canvas）
const drawStrokePreview = (pageIndex: number, layout: { width: number; height: number }) => {
  const stroke = currentStroke.value
  if (!stroke) return
  const canvas = drawingCanvasRefs.value[pageIndex]
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // 大量 Canvas 绘图逻辑...
  ctx.strokeStyle = previewColor
  ctx.lineWidth = Math.max(previewWidth, 2)
  ctx.beginPath()
  // ...更多绘图代码
}
```

## 正确实现方案 (✅)
1. 方案1：在 PdfPage.vue 中导入 DrawingBoardNew 组件
2. 方案2：替换模板中的 Canvas 元素为 DrawingBoardNew 组件
3. 方案3：适配 DrawingBoardNew 的 props 和事件，处理坐标转换和 MuPDF 注释保存逻辑
4. 方案4：移除原有的 Canvas 绘图逻辑，统一使用 DrawingBoardNew 的绘图接口

（包含正确的代码示例，使用代码块）

```vue
<template>
  <!-- 替换 Canvas 为 DrawingBoardNew -->
  <DrawingBoardNew
    :background-image="currentPageImage"
    :initial-zoom="1"
    :show-grid="false"
    @stroke-drawn="handleStrokeDrawn"
    @canvas-ready="handleCanvasReady"
  />
</template>

<script setup>
import DrawingBoardNew from './DrawingBoardNew.vue'

// 处理笔迹数据并保存为 MuPDF 注释
const handleStrokeDrawn = async (strokeData: any) => {
  // 将 DrawingBoardNew 的笔迹数据转换为 MuPDF Ink 格式
  // 保存到 PDF 文档
  await saveStrokeToPdf(strokeData)
}
</script>
```

## 关键代码/公式
- 代码片段1：坐标转换逻辑（Screen ↔ PDF 坐标系）
- 代码片段2：MuPDF Ink 注释格式转换
- 代码片段3：DrawingBoardNew 组件集成

```typescript
// 坐标转换关键代码
const screenPointToPdfPoint = (
  clientX: number,
  clientY: number,
  pageIndex: number,
  layout: { width: number; height: number }
): HighlightStrokePoint | null => {
  const norm = screenPointToNormalized(clientX, clientY, pageIndex, layout)
  if (!norm) return null
  const pdfPoint = normalizedToPdfPoint(norm, pageIndex)
  if (!pdfPoint) return null
  return { x: pdfPoint.x, y: pdfPoint.y }
}
```

## 测试验证
- **测试场景**：
  - 场景1：打开 PDF 页面，验证 DrawingBoardNew 组件正常渲染
  - 场景2：使用高亮工具绘制，验证笔迹能正确保存为 PDF 注释
  - 场景3：使用橡皮擦工具，验证能正确擦除已保存的注释
- **验证方法**：
  - 方法1：检查 PDF 文件大小变化确认注释已保存
  - 方法2：重新打开 PDF 验证笔迹是否持久化
  - 方法3：测试坐标精度，确保笔迹位置准确

## 预防措施
- 措施1：在替换前充分测试 DrawingBoardNew 组件的所有功能
- 措施2：保留原 Canvas 实现作为降级方案
- 措施3：建立统一的绘图组件接口规范，避免未来再次出现实现不一致

## 相关链接/参考
- 相关文档：`d:\Project\xueban-qianduan\docs\LearningView流程分析.md`
- 相关Issue：HomeworkAnswerView.vue 中 DrawingBoardNew 的多页实现

## 可复用经验
- 经验1：绘图组件应该统一接口，避免重复实现
- 经验2：Canvas 绘图逻辑复杂时优先考虑封装为组件
- 经验3：PDF 注释保存需要考虑坐标系转换的精度问题
