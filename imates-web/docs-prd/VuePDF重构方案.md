# VuePDF 重构方案

## 一、重构目标

使用 VuePDF 组件库重构现有的 PDF 阅读和笔记页面，简化 PDF 渲染逻辑，同时保持所有现有功能（笔记、缩放、截图等）不变。

## 二、现状分析

### 2.1 现有架构

```
PdfViewerView.vue (主视图)
  └─ PdfPage.vue (单页组件)
      ├─ Canvas (PDF.js 直接渲染)
      └─ Konva Container (笔记层)
```

### 2.2 现有实现方式

1. **PDF 加载**：使用 `pdfjs-dist` 的 `getDocument` 直接加载
2. **PDF 渲染**：手动创建 Canvas，使用 `page.render()` 渲染
3. **笔记层**：使用 Konva.js 在独立容器中绘制
4. **状态管理**：Pinia Store 管理 PDF 文档和笔记数据

### 2.3 现有功能

- ✅ PDF 文档加载和渲染
- ✅ 多页虚拟滚动
- ✅ 缩放功能（0.5x - 3.0x）
- ✅ 笔记绘制（签字笔、荧光笔、橡皮擦、截图、选择）
- ✅ 笔记持久化（IndexedDB）
- ✅ 撤销/重做
- ✅ 触摸手势（双指缩放/滑动）
- ✅ 鼠标滚轮缩放

## 三、重构方案

### 3.1 架构设计

```
PdfViewerView.vue (主视图)
  └─ PdfPage.vue (单页组件)
      ├─ VuePDF 组件 (PDF 渲染)
      └─ Konva Container (笔记层，保持不变)
```

### 3.2 核心改动

#### 3.2.1 PDF 加载方式

**现有方式：**
```typescript
// 使用 pdfjs-dist 直接加载
const loadingTask = pdfjsLib.getDocument({
  data: arrayBuffer,
  cMapUrl: '/cmaps/',
  cMapPacked: true
})
const pdfDoc = await loadingTask.promise
```

**重构后：**
```typescript
// 使用 VuePDF 的 usePDF
import { usePDF } from '@tato30/vue-pdf'

const { pdf, pages, info } = usePDF({
  data: arrayBuffer,
  cMapUrl: '/cmaps/',
  cMapPacked: true
})
```

#### 3.2.2 PDF 渲染方式

**现有方式：**
```vue
<template>
  <canvas ref="pdfCanvas" class="pdf-layer" />
</template>

<script>
// 手动渲染
const page = await pdfDoc.getPage(pageNum)
const viewport = page.getViewport({ scale })
const renderTask = page.render({
  canvasContext: context,
  viewport: viewport
})
await renderTask.promise
</script>
```

**重构后：**
```vue
<template>
  <VuePDF 
    :pdf="pdf" 
    :page="layout.pageNum"
    :scale="store.scale"
    text-layer
    annotation-layer
    @loaded="onPageLoaded"
  />
</template>

<script setup>
import { VuePDF, usePDF } from '@tato30/vue-pdf'
import '@tato30/vue-pdf/style.css'

const { pdf } = usePDF(pdfSource)
</script>
```

### 3.3 关键问题与解决方案

#### 3.3.1 PDF 文档对象传递

**问题**：VuePDF 需要 `PDFDocumentLoadingTask` 对象，而现有代码使用 `PDFDocumentProxy`。

**解决方案**：
- 方案1：在 Store 中保存 `loadingTask` 而不是 `pdfDoc`
- 方案2：使用 `usePDF` 的响应式特性，直接传递文件数据

**推荐方案2**：
```typescript
// 在 Store 中保存原始文件数据
const pdfSource = ref<ArrayBuffer | null>(null)

// 在组件中使用
const { pdf } = usePDF(pdfSource)
```

#### 3.3.2 页面布局计算

**问题**：VuePDF 渲染后，需要获取页面尺寸来计算布局。

**解决方案**：
- 使用 VuePDF 的 `@loaded` 事件获取页面尺寸
- 或者继续使用 PDF.js API 计算布局（VuePDF 内部使用 pdf.js）

```typescript
// 继续使用 pdf.js 计算布局
const page = await pdfDoc.getPage(i)
const viewport = page.getViewport({ scale: store.scale })
```

#### 3.3.3 缩放功能

**问题**：VuePDF 的 `scale` prop 是响应式的，需要与 Store 的 scale 同步。

**解决方案**：
```vue
<VuePDF 
  :pdf="pdf" 
  :page="layout.pageNum"
  :scale="store.scale"
/>
```

#### 3.3.4 笔记层叠加

**问题**：笔记层需要覆盖在 PDF 内容之上。

**解决方案**：
- 使用 CSS 定位，笔记层绝对定位在 VuePDF 组件之上
- 保持现有的 Konva 容器结构不变

```vue
<template>
  <div class="pdf-page-container">
    <!-- VuePDF 组件 -->
    <VuePDF 
      :pdf="pdf" 
      :page="layout.pageNum"
      :scale="store.scale"
      class="pdf-layer"
    />
    
    <!-- Konva 笔记层（保持不变） -->
    <div 
      v-if="!store.hideNotes"
      ref="konvaContainer"
      class="konva-container"
    />
  </div>
</template>

<style>
.pdf-page-container {
  position: relative;
}

.pdf-layer {
  position: relative;
  z-index: 1;
}

.konva-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: auto;
}
</style>
```

#### 3.3.5 截图功能

**问题**：截图需要同时捕获 PDF 内容和笔记内容。

**解决方案**：
- 方案1：使用 VuePDF 的 `@loaded` 事件获取渲染后的 Canvas
- 方案2：继续使用现有的 PDF Canvas（如果 VuePDF 暴露）

**推荐方案1**：
```typescript
const onPageLoaded = (data: any) => {
  // data 包含渲染后的 canvas 或 image
  // 可以用于截图功能
}
```

或者继续使用 Store 中的 `pdfDoc` 来获取页面进行截图。

### 3.4 文件结构变更

#### 3.4.1 PdfPage.vue 重构

**主要变更：**
1. 移除手动 Canvas 渲染代码
2. 使用 VuePDF 组件替代
3. 保持 Konva 笔记层不变
4. 保持触摸手势处理不变

#### 3.4.2 PdfViewerView.vue 变更

**主要变更：**
1. PDF 加载逻辑简化（使用 usePDF）
2. 保持虚拟滚动不变
3. 保持工具栏和缩放控制不变

#### 3.4.3 Store 变更

**主要变更：**
1. 保存 `loadingTask` 或文件数据，而不是 `pdfDoc`
2. 或者同时保存两者（兼容性考虑）

## 四、实施步骤

### 步骤1：安装依赖（已完成）

项目已安装 `@tato30/vue-pdf@^1.11.5`，无需额外安装。

### 步骤2：导入样式

在 `PdfPage.vue` 或全局导入 VuePDF 样式：

```typescript
import '@tato30/vue-pdf/style.css'
```

### 步骤3：重构 PdfPage.vue

1. 导入 VuePDF 组件
2. 使用 `usePDF` 加载 PDF
3. 替换 Canvas 渲染为 VuePDF 组件
4. 保持笔记层和事件处理不变

### 步骤4：重构 PdfViewerView.vue

1. 调整 PDF 加载逻辑
2. 确保页面布局计算正常
3. 测试虚拟滚动

### 步骤5：测试验证

1. PDF 渲染测试
2. 缩放功能测试
3. 笔记功能测试
4. 截图功能测试
5. 触摸手势测试
6. 性能测试

## 五、兼容性考虑

### 5.1 向后兼容

- 保持 Store 中的 `pdfDoc` 字段（用于截图等功能）
- 保持现有的笔记数据格式
- 保持现有的 API 接口

### 5.2 数据迁移

无需数据迁移，笔记数据格式保持不变。

## 六、优势分析

### 6.1 代码简化

- ✅ 移除手动 Canvas 渲染代码（约 200+ 行）
- ✅ 简化 PDF 加载逻辑
- ✅ 减少高DPI处理代码

### 6.2 功能增强

- ✅ 自动支持文本选择（text-layer）
- ✅ 自动支持注释交互（annotation-layer）
- ✅ 更好的 PDF.js 集成

### 6.3 维护性提升

- ✅ 使用成熟的组件库，减少维护成本
- ✅ 自动处理 PDF.js 更新
- ✅ 更好的错误处理

## 七、风险评估

### 7.1 潜在风险

1. **性能影响**：VuePDF 可能增加一些开销
   - **缓解**：使用虚拟滚动，只渲染可见页面

2. **功能缺失**：某些自定义功能可能无法实现
   - **缓解**：保留 pdfDoc 引用，用于特殊功能

3. **样式冲突**：VuePDF 样式可能与现有样式冲突
   - **缓解**：使用 scoped 样式和深度选择器

### 7.2 回退方案

如果重构后出现问题，可以：
1. 保留原有代码分支
2. 使用 feature flag 控制切换
3. 逐步迁移，先迁移部分页面

## 八、实施计划

### 阶段1：基础重构（预计 2-3 小时）

1. 重构 `PdfPage.vue` 使用 VuePDF
2. 测试基本渲染功能
3. 确保笔记层正常显示

### 阶段2：功能验证（预计 1-2 小时）

1. 测试缩放功能
2. 测试笔记绘制
3. 测试截图功能

### 阶段3：优化完善（预计 1 小时）

1. 性能优化
2. 样式调整
3. 错误处理

### 阶段4：测试验收（预计 1 小时）

1. 功能测试
2. 兼容性测试
3. 性能测试

## 九、代码示例

### 9.1 重构后的 PdfPage.vue 结构

```vue
<template>
  <div 
    class="pdf-page pdf-page-item" 
    :style="pageStyle"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @wheel="handleWheel"
  >
    <!-- VuePDF 组件 -->
    <VuePDF 
      ref="vuePdfRef"
      :pdf="pdf" 
      :page="layout.pageNum"
      :scale="store.scale"
      text-layer
      annotation-layer
      class="pdf-layer"
      @loaded="onPageLoaded"
      @text-loaded="onTextLoaded"
    />
    
    <!-- Konva 标注层（保持不变） -->
    <div 
      v-if="!store.hideNotes"
      ref="konvaContainer"
      class="konva-container"
      :style="drawingBoardStyle"
    />
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="page-loading">
      <q-spinner-dots size="30px" color="primary" />
    </div>
    
    <!-- 错误状态 -->
    <div v-if="error" class="page-error">
      <div class="error-icon">⚠️</div>
      <div class="error-text">第 {{ layout.pageNum }} 页加载失败</div>
      <q-btn size="sm" color="primary" @click="retryLoad">重试</q-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { VuePDF, usePDF } from '@tato30/vue-pdf'
import '@tato30/vue-pdf/style.css'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { KonvaCanvasService } from '@/services/pdf/konva/KonvaCanvasService'

// Props
interface Props {
  layout: {
    pageNum: number
    top: number
    height: number
    width: number
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'screenshot-captured': [blob: Blob]
}>()

const store = usePdfViewerStore()
const vuePdfRef = ref()
const konvaContainer = ref<HTMLDivElement>()
const isLoading = ref(false)
const error = ref<string | null>(null)

// 使用 usePDF 加载 PDF
// 注意：需要从 Store 获取 PDF 数据源
const pdfSource = computed(() => {
  if (store.originalPdfBytes) {
    return {
      data: store.originalPdfBytes,
      cMapUrl: '/cmaps/',
      cMapPacked: true
    }
  }
  return null
})

const { pdf } = usePDF(pdfSource)

// Konva 服务实例
let konvaService: KonvaCanvasService | null = null

// 页面样式
const pageStyle = computed(() => ({
  position: 'relative' as const,
  width: `${props.layout.width}px`,
  height: `${props.layout.height}px`,
  margin: '0 auto 20px',
  backgroundColor: '#f5f5f5',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  borderRadius: '4px',
}))

// DrawingBoard 容器样式
const drawingBoardStyle = computed(() => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  userSelect: 'none' as const,
  width: '100%',
  height: '100%',
  pointerEvents: 'auto' as const,
  zIndex: 2
}))

// PDF 页面加载完成
const onPageLoaded = (data: any) => {
  isLoading.value = false
  error.value = null
  // 可以在这里获取页面尺寸等信息
}

// 文本层加载完成
const onTextLoaded = (data: any) => {
  // 文本层加载完成
}

// 初始化 Konva Canvas（保持不变）
const initKonvaCanvas = async () => {
  // ... 保持现有实现
}

// 触摸手势处理（保持不变）
const handleTouchStart = (event: TouchEvent) => {
  // ... 保持现有实现
}

const handleTouchMove = (event: TouchEvent) => {
  // ... 保持现有实现
}

const handleTouchEnd = (event: TouchEvent) => {
  // ... 保持现有实现
}

// 鼠标滚轮处理（保持不变）
const handleWheel = (event: WheelEvent) => {
  // ... 保持现有实现
}

// 重试加载
const retryLoad = () => {
  vuePdfRef.value?.reload()
}

// 生命周期
onMounted(async () => {
  if (!store.hideNotes) {
    await initKonvaCanvas()
  }
})

onUnmounted(() => {
  konvaService?.destroy()
  konvaService = null
})
</script>

<style scoped>
.pdf-page {
  position: relative;
}

.pdf-layer {
  position: relative;
  z-index: 1;
}

.konva-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}
</style>
```

### 9.2 Store 调整示例

```typescript
// pdfViewerStore.ts
export const usePdfViewerStore = defineStore('pdfViewer', {
  state: () => ({
    // ... 其他状态
    
    // 保留 pdfDoc 用于特殊功能（如截图）
    pdfDoc: null as pdfjsLib.PDFDocumentProxy | null,
    
    // 保存原始 PDF 数据，用于 VuePDF
    originalPdfBytes: null as ArrayBuffer | null,
    
    // ... 其他状态
  }),
  
  actions: {
    async loadPdf(file: File) {
      // ... 加载逻辑
      
      // 保存原始数据
      const arrayBuffer = await file.arrayBuffer()
      this.originalPdfBytes = arrayBuffer
      
      // 同时保存 pdfDoc（用于截图等功能）
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: '/cmaps/',
        cMapPacked: true
      })
      this.pdfDoc = await loadingTask.promise
      
      // ... 其他逻辑
    }
  }
})
```

## 十、总结

使用 VuePDF 重构 PDF 阅读页面可以：

1. **简化代码**：减少手动渲染代码，提高可维护性
2. **增强功能**：自动支持文本选择和注释交互
3. **保持兼容**：笔记功能和其他功能保持不变
4. **降低风险**：使用成熟组件库，减少 bug

重构的关键是：
- 使用 `usePDF` 加载 PDF
- 使用 `VuePDF` 组件渲染
- 保持 Konva 笔记层不变
- 保留 `pdfDoc` 用于特殊功能

---

**下一步**：等待确认后开始实施重构。


