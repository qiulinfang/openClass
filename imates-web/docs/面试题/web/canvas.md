# Canvas 高级面试题（基于 imates-web 实际应用）

## Canvas 基础概念

### 1. 什么是 Canvas？它有什么优势和局限性？

**答案：**
Canvas 是 HTML5 提供的一个用于绘制图形的 API，允许通过 JavaScript 动态生成和操作图像。

**优势：**
- **高性能**：直接操作像素，性能比 DOM 更好
- **灵活性**：可以绘制任意形状和图形
- **实时渲染**：支持动画和实时更新
- **图像处理**：可以进行像素级操作
- **跨浏览器**：得到广泛支持

**局限性：**
- **不支持 DOM**：Canvas 中的内容不是 DOM 元素
- **无法选择文本**：Canvas 中的文本无法被选中
- **无法获取焦点**：Canvas 本身无法获得焦点
- **性能限制**：大量绘制操作可能导致性能问题
- **无法直接修改**：需要重新绘制整个 Canvas

**imates-web 中的应用场景：**
- 电子白板（DrawingBoard.vue）：笔迹绘制、图形绘制
- PDF 渲染（PdfPage.vue）：PDF 页面渲染
- 图片裁剪（ImageCropper.vue）：图像处理和裁剪
- 知识图谱（newGrap.vue）：关系网络绘制

---

### 2. Canvas 和 SVG 有什么区别？

**答案：**

| 特性 | Canvas | SVG |
|------|--------|-----|
| 渲染方式 | 栅格化（像素） | 矢量图 |
| 性能 | 高（大量简单图形） | 低（复杂图形） |
| 可缩放性 | 不可缩放（会失真） | 可无限缩放 |
| DOM 支持 | 不支持 | 支持 DOM |
| 文本选择 | 不支持 | 支持 |
| 编辑难度 | 高（需要重新绘制） | 低（可直接修改） |
| 文件大小 | 小（二进制） | 大（XML） |
| 适用场景 | 游戏、动画、实时渲染 | 图表、图标、可交互图形 |

**选择建议：**
- 使用 Canvas：需要高性能、实时渲染、像素级操作
- 使用 SVG：需要可缩放、可编辑、DOM 交互

---

### 3. 如何获取 Canvas 上下文（Context）？

**答案：**

**2D 上下文：**
```javascript
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

// 设置 Canvas 尺寸
canvas.width = 800;
canvas.height = 600;

// 绘制矩形
ctx.fillStyle = 'red';
ctx.fillRect(10, 10, 100, 100);

// 绘制圆形
ctx.beginPath();
ctx.arc(200, 200, 50, 0, Math.PI * 2);
ctx.fill();

// 绘制文本
ctx.fillStyle = 'black';
ctx.font = '20px Arial';
ctx.fillText('Hello Canvas', 10, 50);
```

**WebGL 上下文：**
```javascript
const canvas = document.getElementById('myCanvas');
const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');

// WebGL 用于 3D 图形
```

**imates-web 中的使用：**
```typescript
// DrawingBoard.vue
const historyCanvasRef = ref<HTMLCanvasElement | null>(null);
const liveCanvasRef = ref<HTMLCanvasElement | null>(null);

onMounted(() => {
  const historyCtx = historyCanvasRef.value?.getContext('2d');
  const liveCtx = liveCanvasRef.value?.getContext('2d');
  
  // 设置 Canvas 尺寸
  if (historyCanvasRef.value) {
    historyCanvasRef.value.width = containerWidth;
    historyCanvasRef.value.height = containerHeight;
  }
});
```

---

## 绘图基础

### 4. 如何在 Canvas 上绘制基本图形？

**答案：**

**矩形：**
```javascript
const ctx = canvas.getContext('2d');

// 填充矩形
ctx.fillStyle = 'blue';
ctx.fillRect(10, 10, 100, 100);

// 描边矩形
ctx.strokeStyle = 'red';
ctx.lineWidth = 2;
ctx.strokeRect(10, 10, 100, 100);

// 清除矩形
ctx.clearRect(10, 10, 100, 100);
```

**圆形和弧形：**
```javascript
// 圆形
ctx.beginPath();
ctx.arc(200, 200, 50, 0, Math.PI * 2);
ctx.fillStyle = 'green';
ctx.fill();

// 弧形
ctx.beginPath();
ctx.arc(300, 300, 50, 0, Math.PI);
ctx.stroke();

// 圆角矩形
ctx.beginPath();
ctx.moveTo(10, 10);
ctx.lineTo(100, 10);
ctx.arcTo(110, 10, 110, 20, 10);
ctx.lineTo(110, 100);
ctx.arcTo(110, 110, 100, 110, 10);
ctx.lineTo(10, 110);
ctx.arcTo(0, 110, 0, 100, 10);
ctx.lineTo(0, 20);
ctx.arcTo(0, 10, 10, 10, 10);
ctx.stroke();
```

**直线和路径：**
```javascript
// 直线
ctx.beginPath();
ctx.moveTo(10, 10);
ctx.lineTo(100, 100);
ctx.stroke();

// 多边形
ctx.beginPath();
ctx.moveTo(100, 100);
ctx.lineTo(200, 100);
ctx.lineTo(150, 200);
ctx.closePath();
ctx.fill();

// 贝塞尔曲线
ctx.beginPath();
ctx.moveTo(10, 10);
ctx.quadraticCurveTo(100, 100, 200, 10);  // 二次贝塞尔曲线
ctx.stroke();

ctx.beginPath();
ctx.moveTo(10, 10);
ctx.bezierCurveTo(100, 100, 200, 100, 300, 10);  // 三次贝塞尔曲线
ctx.stroke();
```

---

### 5. 如何在 Canvas 上绘制文本和图像？

**答案：**

**文本绘制：**
```javascript
const ctx = canvas.getContext('2d');

// 设置字体
ctx.font = 'bold 20px Arial';
ctx.fillStyle = 'black';

// 填充文本
ctx.fillText('Hello Canvas', 10, 50);

// 描边文本
ctx.strokeStyle = 'red';
ctx.strokeText('Hello Canvas', 10, 100);

// 文本对齐
ctx.textAlign = 'center';  // 'start', 'end', 'left', 'right', 'center'
ctx.textBaseline = 'middle';  // 'top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom'

// 测量文本宽度
const metrics = ctx.measureText('Hello Canvas');
console.log(metrics.width);
```

**图像绘制：**
```javascript
const ctx = canvas.getContext('2d');

// 从 Image 对象绘制
const img = new Image();
img.src = 'image.jpg';
img.onload = () => {
  ctx.drawImage(img, 10, 10);  // 原始尺寸
  ctx.drawImage(img, 10, 10, 100, 100);  // 指定尺寸
  ctx.drawImage(img, 0, 0, 100, 100, 10, 10, 50, 50);  // 裁剪并绘制
};

// 从 Canvas 绘制
const sourceCanvas = document.getElementById('sourceCanvas');
ctx.drawImage(sourceCanvas, 10, 10);

// 从 Video 绘制
const video = document.getElementById('myVideo');
ctx.drawImage(video, 10, 10);
```

**imates-web 中的应用：**
```typescript
// PdfPage.vue - 绘制 PDF 页面
const renderPdfPage = async (pageIndex: number) => {
  const page = pdfDocument.getPage(pageIndex);
  const viewport = page.getViewport({ scale: 1 });
  
  const canvas = pdfCanvasRefs[pageIndex];
  const ctx = canvas.getContext('2d');
  
  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };
  
  await page.render(renderContext).promise;
};

// ImageCropper.vue - 绘制图片
const drawImage = () => {
  const ctx = cropCanvasRef.value?.getContext('2d');
  if (!ctx || !loadedImage.value) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(loadedImage.value, 0, 0, canvas.width, canvas.height);
};
```

---

## 交互和事件处理

### 6. 如何处理 Canvas 上的鼠标和触摸事件？

**答案：**

**鼠标事件：**
```javascript
const canvas = document.getElementById('myCanvas');

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  console.log('Mouse down at:', x, y);
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  console.log('Mouse move to:', x, y);
});

canvas.addEventListener('mouseup', (e) => {
  console.log('Mouse up');
});

canvas.addEventListener('mouseleave', (e) => {
  console.log('Mouse left canvas');
});
```

**触摸事件：**
```javascript
canvas.addEventListener('touchstart', (e) => {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  console.log('Touch start at:', x, y);
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();  // 防止页面滚动
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  console.log('Touch move to:', x, y);
});

canvas.addEventListener('touchend', (e) => {
  console.log('Touch end');
});
```

**Pointer 事件（推荐）：**
```javascript
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  console.log('Pointer down at:', x, y);
});

canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  console.log('Pointer move to:', x, y);
});

canvas.addEventListener('pointerup', (e) => {
  console.log('Pointer up');
});
```

**imates-web 中的应用：**
```typescript
// DrawingBoard.vue - 处理绘制事件
const handleMouseDown = (e: MouseEvent) => {
  const rect = liveCanvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  isDrawing.value = true;
  startDrawing(x, y);
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDrawing.value) return;
  
  const rect = liveCanvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  continueDrawing(x, y);
};

const handleMouseUp = () => {
  isDrawing.value = false;
  finishDrawing();
};

// PdfPage.vue - 处理 Pointer 事件
const onPointerDown = (e: PointerEvent) => {
  const rect = viewportRef.value?.getBoundingClientRect();
  if (!rect) return;
  
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  handleDrawStart(x, y);
};

const onPointerMove = (e: PointerEvent) => {
  const rect = viewportRef.value?.getBoundingClientRect();
  if (!rect) return;
  
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  handleDrawMove(x, y);
};
```

---

### 7. 如何实现笔迹绘制（Drawing）？

**答案：**

**基本笔迹绘制：**
```javascript
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

let isDrawing = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
  isDrawing = true;
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // 绘制线段
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  
  lastX = x;
  lastY = y;
});

canvas.addEventListener('mouseup', () => {
  isDrawing = false;
});
```

**使用 perfect-freehand 库（imates-web 使用）：**
```typescript
import { getStroke } from 'perfect-freehand';

// 收集笔迹点
const points: Array<[number, number]> = [];

const handleMouseMove = (x: number, y: number) => {
  points.push([x, y]);
  
  // 获取平滑的笔迹
  const stroke = getStroke(points, {
    size: 16,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t) => t,
    start: {
      taper: 100,
      easing: (t) => t,
      cap: true,
    },
    end: {
      taper: 100,
      easing: (t) => t,
      cap: true,
    },
  });
  
  // 绘制笔迹
  drawStroke(stroke);
};

const drawStroke = (stroke: Array<[number, number]>) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = 'black';
  ctx.beginPath();
  
  for (let i = 0; i < stroke.length; i++) {
    const [x, y] = stroke[i];
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.fill();
};
```

**imates-web 中的笔迹绘制：**
```typescript
// DrawingBoard.vue
const startDrawing = (x: number, y: number) => {
  currentStroke.value = {
    type: currentTool.value,
    points: [[x, y]],
    color: toolConfig.value.penColor,
    width: toolConfig.value.penWidth,
  };
};

const continueDrawing = (x: number, y: number) => {
  if (!currentStroke.value) return;
  
  currentStroke.value.points.push([x, y]);
  
  // 使用 perfect-freehand 获取平滑笔迹
  const stroke = getStroke(currentStroke.value.points, pfConfig.value);
  
  // 在 live canvas 上绘制
  drawStrokeOnCanvas(liveCanvasRef.value, stroke);
};

const finishDrawing = () => {
  if (!currentStroke.value) return;
  
  // 保存到历史
  saveStrokeToHistory(currentStroke.value);
  
  // 清空 live canvas
  clearLiveCanvas();
  
  // 重新绘制历史
  redrawHistory();
};
```

---

## 高级技术

### 8. 如何实现 Canvas 的撤销和重做功能？

**答案：**

**历史管理：**
```typescript
interface HistoryState {
  imageData: ImageData;
  timestamp: number;
}

const history: HistoryState[] = [];
let historyIndex = -1;

const saveState = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // 移除当前位置之后的历史
  history.splice(historyIndex + 1);
  
  // 保存当前状态
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  history.push({
    imageData,
    timestamp: Date.now()
  });
  
  historyIndex++;
};

const undo = (canvas: HTMLCanvasElement) => {
  if (historyIndex <= 0) return;
  
  historyIndex--;
  restoreState(canvas, history[historyIndex]);
};

const redo = (canvas: HTMLCanvasElement) => {
  if (historyIndex >= history.length - 1) return;
  
  historyIndex++;
  restoreState(canvas, history[historyIndex]);
};

const restoreState = (canvas: HTMLCanvasElement, state: HistoryState) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.putImageData(state.imageData, 0, 0);
};
```

**imates-web 中的实现：**
```typescript
// DrawingBoard.vue
const canUndo = computed(() => historyIndex.value > 0);
const canRedo = computed(() => historyIndex.value < history.value.length - 1);

const undo = () => {
  if (!canUndo.value) return;
  
  historyIndex.value--;
  redrawFromHistory();
};

const redo = () => {
  if (!canRedo.value) return;
  
  historyIndex.value++;
  redrawFromHistory();
};

const saveStrokeToHistory = (stroke: Stroke) => {
  // 移除当前位置之后的历史
  strokes.value = strokes.value.slice(0, historyIndex.value + 1);
  
  // 添加新笔迹
  strokes.value.push(stroke);
  historyIndex.value++;
};

const redrawFromHistory = () => {
  // 清空 Canvas
  clearHistoryCanvas();
  
  // 重新绘制到当前历史位置
  for (let i = 0; i <= historyIndex.value; i++) {
    drawStroke(strokes.value[i]);
  }
};
```

---

### 9. 如何实现 Canvas 的缩放和平移？

**答案：**

**缩放实现：**
```javascript
let zoomLevel = 1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
  
  // 获取鼠标位置（相对于 Canvas）
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // 计算缩放中心
  const zoomRatio = newZoom / zoomLevel;
  offsetX -= (mouseX - offsetX) * (zoomRatio - 1);
  offsetY -= (mouseY - offsetY) * (zoomRatio - 1);
  
  zoomLevel = newZoom;
  redraw();
};

const redraw = () => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 应用变换
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(zoomLevel, zoomLevel);
  
  // 绘制内容
  drawContent();
  
  ctx.restore();
};
```

**平移实现：**
```javascript
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  
  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;
  
  offsetX += deltaX;
  offsetY += deltaY;
  
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  
  redraw();
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
});
```

**imates-web 中的实现：**
```typescript
// DrawingBoard.vue - 缩放
const zoomLevel = ref(1);
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

const zoomIn = () => {
  zoomLevel.value = Math.min(MAX_ZOOM, zoomLevel.value + 0.1);
  updateCanvasTransform();
};

const zoomOut = () => {
  zoomLevel.value = Math.max(MIN_ZOOM, zoomLevel.value - 0.1);
  updateCanvasTransform();
};

const updateCanvasTransform = () => {
  const canvasWrapper = document.querySelector('.canvas-wrapper');
  if (canvasWrapper) {
    (canvasWrapper as HTMLElement).style.transform = `scale(${zoomLevel.value})`;
  }
};

// PdfPage.vue - 缩放和平移
const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.max(0.5, Math.min(3, scale.value + delta));
  
  scale.value = newScale;
  updatePageLayout();
};
```

---

### 10. 如何实现图片裁剪功能？

**答案：**

**基本裁剪实现：**
```javascript
let cropRect = null;
let isDragging = false;

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  cropRect = {
    startX: x,
    startY: y,
    endX: x,
    endY: y
  };
  
  isDragging = true;
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  cropRect.endX = x;
  cropRect.endY = y;
  
  redraw();
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
});

const redraw = () => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // 绘制原始图片
  ctx.drawImage(image, 0, 0);
  
  // 绘制裁剪框
  if (cropRect) {
    const minX = Math.min(cropRect.startX, cropRect.endX);
    const minY = Math.min(cropRect.startY, cropRect.endY);
    const width = Math.abs(cropRect.endX - cropRect.startX);
    const height = Math.abs(cropRect.endY - cropRect.startY);
    
    // 绘制半透明蒙版
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 清除裁剪区域
    ctx.clearRect(minX, minY, width, height);
    
    // 绘制边框
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(minX, minY, width, height);
  }
};

const getCroppedImage = () => {
  const ctx = canvas.getContext('2d');
  if (!ctx || !cropRect) return null;
  
  const minX = Math.min(cropRect.startX, cropRect.endX);
  const minY = Math.min(cropRect.startY, cropRect.endY);
  const width = Math.abs(cropRect.endX - cropRect.startX);
  const height = Math.abs(cropRect.endY - cropRect.startY);
  
  // 创建新 Canvas 用于裁剪
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = width;
  croppedCanvas.height = height;
  
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) return null;
  
  // 从原始 Canvas 复制裁剪区域
  const imageData = ctx.getImageData(minX, minY, width, height);
  croppedCtx.putImageData(imageData, 0, 0);
  
  return croppedCanvas.toDataURL();
};
```

**imates-web 中的实现：**
```typescript
// ImageCropper.vue
const cropRect = ref<{
  x: number;
  y: number;
  width: number;
  height: number;
} | null>(null);

const handlePointerDown = (e: PointerEvent) => {
  const rect = cropCanvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  cropRect.value = {
    x,
    y,
    width: 0,
    height: 0
  };
};

const handlePointerMove = (e: PointerEvent) => {
  if (!cropRect.value) return;
  
  const rect = cropCanvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  cropRect.value.width = x - cropRect.value.x;
  cropRect.value.height = y - cropRect.value.y;
  
  redrawCropArea();
};

const handleConfirm = () => {
  if (!cropRect.value) return;
  
  const croppedImage = getCroppedImage();
  emit('confirm', croppedImage);
};

const getCroppedImage = () => {
  const canvas = cropCanvasRef.value;
  if (!canvas || !cropRect.value) return '';
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // 获取裁剪区域的图像数据
  const imageData = ctx.getImageData(
    cropRect.value.x,
    cropRect.value.y,
    cropRect.value.width,
    cropRect.value.height
  );
  
  // 创建新 Canvas
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropRect.value.width;
  croppedCanvas.height = cropRect.value.height;
  
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) return '';
  
  croppedCtx.putImageData(imageData, 0, 0);
  
  return croppedCanvas.toDataURL('image/jpeg', 0.9);
};
```

---

### 11. 如何实现 PDF 渲染到 Canvas？

**答案：**

**使用 pdf.js：**
```javascript
import * as pdfjsLib from 'pdfjs-dist';

// 设置 worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const renderPdfPage = async (pdfUrl: string, pageNum: number, canvas: HTMLCanvasElement) => {
  // 加载 PDF 文档
  const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
  
  // 获取指定页面
  const page = await pdf.getPage(pageNum);
  
  // 获取视口
  const viewport = page.getViewport({ scale: 2 });
  
  // 设置 Canvas 尺寸
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  // 获取 Canvas 上下文
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // 渲染页面
  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };
  
  await page.render(renderContext).promise;
};
```

**imates-web 中的实现：**
```typescript
// PdfPage.vue
import * as mupdf from 'mupdf';

const renderPdfPage = async (pageIndex: number) => {
  if (!pdfDocument) return;
  
  try {
    // 获取页面
    const page = pdfDocument.getPage(pageIndex);
    
    // 获取页面尺寸
    const bounds = page.getBounds();
    const width = bounds[2] - bounds[0];
    const height = bounds[3] - bounds[1];
    
    // 获取 Canvas
    const canvas = pdfCanvasRefs[pageIndex];
    if (!canvas) return;
    
    // 设置 Canvas 尺寸
    canvas.width = width;
    canvas.height = height;
    
    // 获取上下文
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 创建 Pixmap
    const pixmap = page.toPixmap(
      mupdf.Matrix.identity,
      mupdf.ColorSpace.DeviceRGB,
      false,
      true
    );
    
    // 从 Pixmap 创建 ImageData
    const imageData = ctx.createImageData(pixmap.width, pixmap.height);
    imageData.data.set(pixmap.samples);
    
    // 绘制到 Canvas
    ctx.putImageData(imageData, 0, 0);
    
    pixmap.destroy();
  } catch (error) {
    console.error('Error rendering PDF page:', error);
  }
};
```

---

### 12. 如何优化 Canvas 的性能？

**答案：**

**1. 使用离屏 Canvas：**
```javascript
// 创建离屏 Canvas
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// 在离屏 Canvas 上绘制
offscreenCtx.fillStyle = 'red';
offscreenCtx.fillRect(0, 0, 100, 100);

// 一次性绘制到主 Canvas
const mainCtx = mainCanvas.getContext('2d');
mainCtx.drawImage(offscreenCanvas, 0, 0);
```

**2. 使用 requestAnimationFrame：**
```javascript
let needsRedraw = false;

const scheduleRedraw = () => {
  if (!needsRedraw) {
    needsRedraw = true;
    requestAnimationFrame(redraw);
  }
};

const redraw = () => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 绘制内容
  
  needsRedraw = false;
};

// 事件处理
canvas.addEventListener('mousemove', () => {
  scheduleRedraw();
});
```

**3. 避免频繁的 Canvas 尺寸变化：**
```javascript
// ❌ 不好：频繁改变 Canvas 尺寸
canvas.width = newWidth;
canvas.height = newHeight;

// ✅ 好：使用 CSS 缩放
canvas.style.width = newWidth + 'px';
canvas.style.height = newHeight + 'px';
```

**4. 使用 Canvas 缓存：**
```javascript
const canvasCache = new Map();

const getOrCreateCanvas = (key: string, width: number, height: number) => {
  if (!canvasCache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvasCache.set(key, canvas);
  }
  return canvasCache.get(key);
};
```

**5. 避免频繁的 getImageData 和 putImageData：**
```javascript
// ❌ 不好：每帧都调用
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
// 处理像素
ctx.putImageData(imageData, 0, 0);

// ✅ 好：批量处理
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const data = imageData.data;

// 批量修改像素
for (let i = 0; i < data.length; i += 4) {
  data[i] = 255;     // R
  data[i + 1] = 0;   // G
  data[i + 2] = 0;   // B
  // data[i + 3] 是 Alpha
}

ctx.putImageData(imageData, 0, 0);
```

**imates-web 中的优化：**
```typescript
// DrawingBoard.vue - 使用离屏 Canvas
const historyCanvasRef = ref<HTMLCanvasElement | null>(null);  // 历史（离屏）
const liveCanvasRef = ref<HTMLCanvasElement | null>(null);     // 实时（显示）

// 在 live canvas 上绘制实时笔迹
const drawStrokeOnLiveCanvas = (stroke: Stroke) => {
  const ctx = liveCanvasRef.value?.getContext('2d');
  if (!ctx) return;
  
  // 绘制笔迹
};

// 完成绘制后，合并到 history canvas
const mergeToHistoryCanvas = () => {
  const historyCtx = historyCanvasRef.value?.getContext('2d');
  const liveCtx = liveCanvasRef.value?.getContext('2d');
  
  if (!historyCtx || !liveCtx) return;
  
  // 将 live canvas 的内容绘制到 history canvas
  historyCtx.drawImage(liveCanvasRef.value, 0, 0);
  
  // 清空 live canvas
  liveCtx.clearRect(0, 0, liveCanvasRef.value.width, liveCanvasRef.value.height);
};

// 使用 requestAnimationFrame 优化重绘
let needsRedraw = false;

const scheduleRedraw = () => {
  if (!needsRedraw) {
    needsRedraw = true;
    requestAnimationFrame(() => {
      redrawCanvas();
      needsRedraw = false;
    });
  }
};
```

---

## 实际应用场景

### 13. 如何实现电子白板功能？

**答案：**

**核心功能：**
1. 笔迹绘制
2. 图形绘制（矩形、圆形、直线）
3. 文本输入
4. 撤销/重做
5. 清空画布
6. 导出图像

**imates-web DrawingBoard.vue 的实现：**
```typescript
// 工具类型
type ToolType = 'draw' | 'rectangle' | 'circle' | 'line' | 'text' | 'eraser';

// 笔迹数据结构
interface Stroke {
  type: ToolType;
  points: Array<[number, number]>;
  color: string;
  width: number;
  timestamp: number;
}

// 核心方法
const startDrawing = (x: number, y: number) => {
  currentStroke.value = {
    type: currentTool.value,
    points: [[x, y]],
    color: toolConfig.value.penColor,
    width: toolConfig.value.penWidth,
    timestamp: Date.now()
  };
};

const continueDrawing = (x: number, y: number) => {
  if (!currentStroke.value) return;
  
  currentStroke.value.points.push([x, y]);
  
  // 实时绘制
  drawStrokeOnCanvas(currentStroke.value);
};

const finishDrawing = () => {
  if (!currentStroke.value) return;
  
  // 保存到历史
  strokes.value.push(currentStroke.value);
  historyIndex.value++;
  
  // 清空当前笔迹
  currentStroke.value = null;
};

// 导出功能
const exportImage = (format: 'png' | 'jpg' = 'png') => {
  const canvas = historyCanvasRef.value;
  if (!canvas) return;
  
  const dataUrl = canvas.toDataURL(`image/${format}`);
  
  // 下载
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `whiteboard.${format}`;
  link.click();
};

// 保存到数据库
const saveToDatabase = async () => {
  const canvas = historyCanvasRef.value;
  if (!canvas) return;
  
  const imageData = canvas.toDataURL('image/png');
  
  // 保存到 IndexedDB 或服务器
  await saveDrawingData({
    strokes: strokes.value,
    imageData,
    timestamp: Date.now()
  });
};
```

---

### 14. 如何实现 PDF 注释和绘制功能？

**答案：**

**核心功能：**
1. PDF 页面渲染
2. 在 PDF 上绘制注释
3. 支持多种绘制工具（笔、荧光笔、橡皮擦）
4. 保存注释

**imates-web PdfPage.vue 的实现：**
```typescript
// 绘制工具
type ToolMode = 'pan' | 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'screenshot';

// 笔迹数据结构
interface Stroke {
  id: string;
  type: 'pen' | 'highlighter' | 'rectangle';
  pageIndex: number;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
}

// 渲染 PDF 页面
const renderPdfPage = async (pageIndex: number) => {
  const page = pdfDocument.getPage(pageIndex);
  const bounds = page.getBounds();
  
  const canvas = pdfCanvasRefs[pageIndex];
  const ctx = canvas.getContext('2d');
  
  // 渲染 PDF 内容
  const pixmap = page.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB);
  const imageData = ctx.createImageData(pixmap.width, pixmap.height);
  imageData.data.set(pixmap.samples);
  ctx.putImageData(imageData, 0, 0);
};

// 在 PDF 上绘制
const drawOnPdf = (stroke: Stroke) => {
  const inkCanvas = inkCanvasRefs[stroke.pageIndex];
  if (!inkCanvas) return;
  
  const ctx = inkCanvas.getContext('2d');
  if (!ctx) return;
  
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.globalAlpha = stroke.opacity;
  
  ctx.beginPath();
  for (let i = 0; i < stroke.points.length; i++) {
    const point = stroke.points[i];
    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();
};

// 保存注释
const saveAnnotations = async () => {
  const data = {
    docKey: pdfDocKey.value,
    strokes: strokes.value,
    updatedAt: Date.now()
  };
  
  // 保存到 IndexedDB
  await IndexedDBService.saveAnnotations(data);
};
```

---

### 15. 如何实现图片裁剪和处理功能？

**答案：**

**核心功能：**
1. 图片加载和显示
2. 缩放和旋转
3. 裁剪框操作
4. 导出裁剪结果

**imates-web ImageCropper.vue 的实现：**
```typescript
// 图片加载
const loadImage = (src: string) => {
  const img = new Image();
  img.onload = () => {
    loadedImage.value = img;
    imageNaturalSize.value = {
      width: img.naturalWidth,
      height: img.naturalHeight
    };
    
    // 初始化 Canvas
    initializeCanvas();
  };
  img.src = src;
};

// 初始化 Canvas
const initializeCanvas = () => {
  const canvas = cropCanvasRef.value;
  if (!canvas) return;
  
  // 设置 Canvas 尺寸
  canvas.width = containerSize.value.width;
  canvas.height = containerSize.value.height;
  
  // 绘制图片
  drawImage();
};

// 绘制图片
const drawImage = () => {
  const ctx = cropCanvasRef.value?.getContext('2d');
  if (!ctx || !loadedImage.value) return;
  
  ctx.clearRect(0, 0, cropCanvasRef.value.width, cropCanvasRef.value.height);
  
  // 应用变换
  ctx.save();
  ctx.translate(translateX.value, translateY.value);
  ctx.scale(userScale.value, userScale.value);
  ctx.rotate((rotationDeg.value * Math.PI) / 180);
  
  // 绘制图片
  const x = -loadedImage.value.naturalWidth / 2;
  const y = -loadedImage.value.naturalHeight / 2;
  ctx.drawImage(loadedImage.value, x, y);
  
  ctx.restore();
};

// 缩放
const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  userScale.value = Math.max(0.5, Math.min(3, userScale.value + delta));
  
  drawImage();
};

// 旋转
const rotate = (angle: number) => {
  rotationDeg.value = (rotationDeg.value + angle) % 360;
  drawImage();
};

// 获取裁剪结果
const getCroppedImage = () => {
  const canvas = cropCanvasRef.value;
  if (!canvas || !cropRect.value) return '';
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // 获取裁剪区域
  const imageData = ctx.getImageData(
    cropRect.value.x,
    cropRect.value.y,
    cropRect.value.width,
    cropRect.value.height
  );
  
  // 创建新 Canvas
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropRect.value.width;
  croppedCanvas.height = cropRect.value.height;
  
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) return '';
  
  croppedCtx.putImageData(imageData, 0, 0);
  
  return croppedCanvas.toDataURL('image/jpeg', props.quality);
};
```

---

## 总结

**Canvas 的核心应用场景：**

| 场景 | 组件 | 关键技术 |
|------|------|---------|
| 电子白板 | DrawingBoard.vue | 笔迹绘制、撤销/重做、导出 |
| PDF 渲染 | PdfPage.vue | pdf.js/mupdf、多页面管理、注释 |
| 图片裁剪 | ImageCropper.vue | 图片变换、缩放旋转、裁剪框 |
| 知识图谱 | newGrap.vue | 图形绘制、关系网络 |

**最佳实践：**
- ✅ 使用离屏 Canvas 优化性能
- ✅ 使用 requestAnimationFrame 控制重绘
- ✅ 实现撤销/重做功能
- ✅ 支持多种输入方式（鼠标、触摸、Pointer）
- ✅ 提供导出和保存功能
- ✅ 处理高 DPI 设备的缩放

**性能优化：**
- ✅ 分离历史 Canvas 和实时 Canvas
- ✅ 使用缓存减少重绘
- ✅ 避免频繁的 getImageData/putImageData
- ✅ 使用 Worker 处理复杂计算
- ✅ 监控内存使用
