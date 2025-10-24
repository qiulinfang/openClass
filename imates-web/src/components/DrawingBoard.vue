<template>
  <div class="fabric-demo-container">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-section">
        <h3>Fabric.js 绘图示例</h3>
      </div>
      
      <!-- 工具选择 -->
      <div class="toolbar-section">
        <q-btn-toggle
          v-model="selectedTool"
          :options="toolOptions"
          color="primary"
          toggle-color="secondary"
          size="sm"
        />
      </div>
      
      <!-- 颜色选择 -->
      <div class="toolbar-section" v-if="showColorPicker">
        <q-color
          v-model="currentColor"
          @update:model-value="(color: string | null) => color && updateColor(color)"
          class="color-picker"
        />
      </div>
      
      <!-- 线条粗细 -->
      <div class="toolbar-section" v-if="showStrokeWidth">
        <q-slider
          v-model="strokeWidth"
          :min="1"
          :max="20"
          :step="1"
          label
          label-always
          color="primary"
          @update:model-value="(width: number | null) => width && updateStrokeWidth(width)"
        />
        <span class="slider-label">{{ strokeWidth }}px</span>
      </div>
      
      <!-- 文本大小 -->
      <div class="toolbar-section" v-if="showTextSize">
        <q-select
          v-model="textSize"
          :options="textSizeOptions"
          label="字体大小"
          dense
          @update:model-value="updateTextSize"
        />
      </div>
      
      <!-- 操作按钮 -->
      <div class="toolbar-section">
        <q-btn
          icon="undo"
          color="secondary"
          size="sm"
          @click="undo"
          :disable="!canUndo"
        >
          <q-tooltip>撤销</q-tooltip>
        </q-btn>
        
        <q-btn
          icon="redo"
          color="secondary"
          size="sm"
          @click="redo"
          :disable="!canRedo"
        >
          <q-tooltip>重做</q-tooltip>
        </q-btn>
        
        <q-btn
          icon="delete"
          color="negative"
          size="sm"
          @click="clearCanvas"
        >
          <q-tooltip>清空画布</q-tooltip>
        </q-btn>
        
        <q-btn
          icon="save"
          color="positive"
          size="sm"
          @click="saveCanvas"
        >
          <q-tooltip>保存</q-tooltip>
        </q-btn>
        
        <q-btn
          icon="upload"
          color="info"
          size="sm"
          @click="loadCanvas"
        >
          <q-tooltip>加载</q-tooltip>
        </q-btn>
      </div>
    </div>
    
    <!-- 画布区域 -->
    <div class="canvas-area">
      <canvas ref="canvasContainer" class="canvas-container"></canvas>
    </div>
    
    <!-- 属性面板 -->
    <div class="properties-panel" v-if="selectedObject">
      <h4>对象属性</h4>
      <div class="property-group">
        <label>位置 X:</label>
        <q-input
          v-model.number="selectedObject.left"
          type="number"
          dense
          @update:model-value="updateObjectProperty"
        />
      </div>
      <div class="property-group">
        <label>位置 Y:</label>
        <q-input
          v-model.number="selectedObject.top"
          type="number"
          dense
          @update:model-value="updateObjectProperty"
        />
      </div>
      <div class="property-group">
        <label>宽度:</label>
        <q-input
          v-model.number="selectedObject.width"
          type="number"
          dense
          @update:model-value="updateObjectProperty"
        />
      </div>
      <div class="property-group">
        <label>高度:</label>
        <q-input
          v-model.number="selectedObject.height"
          type="number"
          dense
          @update:model-value="updateObjectProperty"
        />
      </div>
      <div class="property-group">
        <label>旋转角度:</label>
        <q-input
          v-model.number="selectedObject.angle"
          type="number"
          dense
          @update:model-value="updateObjectProperty"
        />
      </div>
      <div class="property-group">
        <label>透明度:</label>
        <q-slider
          v-model="selectedObject.opacity"
          :min="0"
          :max="1"
          :step="0.1"
          @update:model-value="updateObjectProperty"
        />
      </div>
    </div>
    
    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileLoad"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { Canvas, FabricObject, PencilBrush, IText, Rect, Circle, Line, Triangle } from 'fabric'

// 画布实例
const canvasContainer = ref<HTMLCanvasElement>()
const fabricCanvas = ref<Canvas | null>(null)

// 工具状态
const selectedTool = ref('select')
const currentColor = ref('#000000')
const strokeWidth = ref(3)
const textSize = ref(16)

// 选中的对象
const selectedObject = ref<FabricObject | null>(null)

// 历史记录
const history = ref<string[]>([])
const historyIndex = ref(-1)

// 工具选项
const toolOptions = [
  { label: '选择', value: 'select', icon: 'mouse' },
  { label: '画笔', value: 'pen', icon: 'edit' },
  { label: '橡皮', value: 'eraser', icon: 'eraser' },
  { label: '文本', value: 'text', icon: 'text_fields' },
  { label: '矩形', value: 'rectangle', icon: 'crop_square' },
  { label: '圆形', value: 'circle', icon: 'radio_button_unchecked' },
  { label: '直线', value: 'line', icon: 'horizontal_rule' },
  { label: '三角形', value: 'triangle', icon: 'change_history' }
]

// 文本大小选项
const textSizeOptions = [
  { label: '12px', value: 12 },
  { label: '16px', value: 16 },
  { label: '20px', value: 20 },
  { label: '24px', value: 24 },
  { label: '32px', value: 32 }
]

// 计算属性
const showColorPicker = computed(() => 
  ['pen', 'rectangle', 'circle', 'line', 'triangle'].includes(selectedTool.value)
)

const showStrokeWidth = computed(() => 
  ['pen', 'rectangle', 'circle', 'line', 'triangle'].includes(selectedTool.value)
)

const showTextSize = computed(() => 
  selectedTool.value === 'text'
)

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

// 初始化画布
const initCanvas = async () => {
  if (!canvasContainer.value) return
  
  await nextTick()
  
  // 创建 Fabric Canvas 实例
  fabricCanvas.value = new Canvas(canvasContainer.value, {
    width: 800,
    height: 600,
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true
  })
  
  // 设置画笔
  setupBrush()
  
  // 监听画布事件
  setupCanvasEvents()
  
  // 保存初始状态
  saveState()
  
  console.log('Fabric Canvas 初始化完成')
}

// 设置画笔
const setupBrush = () => {
  if (!fabricCanvas.value) return
  
  const brush = new PencilBrush(fabricCanvas.value as unknown as Canvas)
  brush.color = currentColor.value
  brush.width = strokeWidth.value
  fabricCanvas.value.freeDrawingBrush = brush
}

// 设置画布事件
const setupCanvasEvents = () => {
  if (!fabricCanvas.value) return
  
  // 对象选择事件
  fabricCanvas.value.on('selection:created', (e) => {
    selectedObject.value = e.selected?.[0] || null
  })
  
  fabricCanvas.value.on('selection:updated', (e) => {
    selectedObject.value = e.selected?.[0] || null
  })
  
  fabricCanvas.value.on('selection:cleared', () => {
    selectedObject.value = null
  })
  
  // 对象修改事件
  fabricCanvas.value.on('object:modified', () => {
    saveState()
  })
  
  fabricCanvas.value.on('object:added', () => {
    saveState()
  })
  
  fabricCanvas.value.on('object:removed', () => {
    saveState()
  })
  
  // 路径创建事件（绘制完成）
  fabricCanvas.value.on('path:created', (event) => {
    // 如果是橡皮擦模式，设置路径为擦除模式
    if (selectedTool.value === 'eraser') {
      const path = event.path
      if (path) {
        // 设置路径的合成操作为擦除模式
        path.set({ globalCompositeOperation: 'destination-out' })
      }
    }
    saveState()
  })
  
  // 鼠标点击事件
  fabricCanvas.value.on('mouse:down', (e) => {
    handleMouseDown(e)
  })
}

// 处理鼠标点击
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleMouseDown = (e: { e: any }) => {
  if (!fabricCanvas.value) return
  
  const pointer = fabricCanvas.value.getPointer(e.e)
  
  switch (selectedTool.value) {
    case 'text':
      addText(pointer)
      break
    case 'rectangle':
      addRectangle(pointer)
      break
    case 'circle':
      addCircle(pointer)
      break
    case 'line':
      addLine(pointer)
      break
    case 'triangle':
      addTriangle(pointer)
      break
  }
}

// 添加文本
const addText = (pointer: { x: number; y: number }) => {
  if (!fabricCanvas.value) return
  
  const text = new IText('点击编辑文本', {
    left: pointer.x,
    top: pointer.y,
    fontFamily: 'Arial',
    fontSize: textSize.value,
    fill: currentColor.value
  })
  
  fabricCanvas.value.add(text)
  fabricCanvas.value.setActiveObject(text)
  text.enterEditing()
}

// 添加矩形
const addRectangle = (pointer: { x: number; y: number }) => {
  if (!fabricCanvas.value) return
  
  const rect = new Rect({
    left: pointer.x,
    top: pointer.y,
    width: 100,
    height: 60,
    fill: 'transparent',
    stroke: currentColor.value,
    strokeWidth: strokeWidth.value
  })
  
  fabricCanvas.value.add(rect)
  fabricCanvas.value.setActiveObject(rect)
}

// 添加圆形
const addCircle = (pointer: { x: number; y: number }) => {
  if (!fabricCanvas.value) return
  
  const circle = new Circle({
    left: pointer.x,
    top: pointer.y,
    radius: 50,
    fill: 'transparent',
    stroke: currentColor.value,
    strokeWidth: strokeWidth.value
  })
  
  fabricCanvas.value.add(circle)
  fabricCanvas.value.setActiveObject(circle)
}

// 添加直线
const addLine = (pointer: { x: number; y: number }) => {
  if (!fabricCanvas.value) return
  
  const line = new Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
    stroke: currentColor.value,
    strokeWidth: strokeWidth.value
  })
  
  fabricCanvas.value.add(line)
  fabricCanvas.value.setActiveObject(line)
}

// 添加三角形
const addTriangle = (pointer: { x: number; y: number }) => {
  if (!fabricCanvas.value) return
  
  const triangle = new Triangle({
    left: pointer.x,
    top: pointer.y,
    width: 80,
    height: 80,
    fill: 'transparent',
    stroke: currentColor.value,
    strokeWidth: strokeWidth.value
  })
  
  fabricCanvas.value.add(triangle)
  fabricCanvas.value.setActiveObject(triangle)
}

// 更新工具模式
const updateToolMode = () => {
  if (!fabricCanvas.value) return
  
  switch (selectedTool.value) {
    case 'select':
      fabricCanvas.value.isDrawingMode = false
      fabricCanvas.value.selection = true
      break
    case 'pen':
      fabricCanvas.value.isDrawingMode = true
      fabricCanvas.value.selection = false
      setupBrush()
      // 重置为正常绘制模式
      if (fabricCanvas.value.freeDrawingBrush) {
        Object.assign(fabricCanvas.value.freeDrawingBrush, { globalCompositeOperation: 'source-over' })
      }
      break
    case 'eraser':
      fabricCanvas.value.isDrawingMode = true
      fabricCanvas.value.selection = false
      // 创建橡皮擦画笔
      const eraserBrush = new PencilBrush(fabricCanvas.value as unknown as Canvas)
      eraserBrush.width = strokeWidth.value
      eraserBrush.color = 'red'
      // 设置为擦除模式
      Object.assign(eraserBrush, { globalCompositeOperation: 'destination-out' })
      fabricCanvas.value.freeDrawingBrush = eraserBrush
      break
    default:
      fabricCanvas.value.isDrawingMode = false
      fabricCanvas.value.selection = true
      break
  }
}

// 更新颜色
const updateColor = (color: string) => {
  currentColor.value = color
  if (selectedTool.value === 'pen' && fabricCanvas.value?.freeDrawingBrush) {
    fabricCanvas.value.freeDrawingBrush.color = color
  }
}

// 更新线条粗细
const updateStrokeWidth = (width: number) => {
  strokeWidth.value = width
  if (fabricCanvas.value?.freeDrawingBrush) {
    fabricCanvas.value.freeDrawingBrush.width = width
  }
}

// 更新文本大小
const updateTextSize = (size: number) => {
  textSize.value = size
}

// 更新对象属性
const updateObjectProperty = () => {
  if (!fabricCanvas.value || !selectedObject.value) return
  
  fabricCanvas.value.renderAll()
  saveState()
}

// 保存状态到历史记录
const saveState = () => {
  if (!fabricCanvas.value) return
  
  const state = JSON.stringify(fabricCanvas.value.toJSON())
  
  // 如果当前不在历史记录末尾，删除后面的记录
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  
  history.value.push(state)
  historyIndex.value = history.value.length - 1
  
  // 限制历史记录数量
  if (history.value.length > 20) {
    history.value.shift()
    historyIndex.value--
  }
}

// 撤销
const undo = () => {
  if (!fabricCanvas.value || !canUndo.value) return
  
  historyIndex.value--
  const state = history.value[historyIndex.value]
  fabricCanvas.value.loadFromJSON(state, () => {
    fabricCanvas.value?.renderAll()
  })
}

// 重做
const redo = () => {
  if (!fabricCanvas.value || !canRedo.value) return
  
  historyIndex.value++
  const state = history.value[historyIndex.value]
  fabricCanvas.value.loadFromJSON(state, () => {
    fabricCanvas.value?.renderAll()
  })
}

// 清空画布
const clearCanvas = () => {
  if (!fabricCanvas.value) return
  
  fabricCanvas.value.clear()
  fabricCanvas.value.backgroundColor = '#ffffff'
  saveState()
}

// 保存画布
const saveCanvas = () => {
  if (!fabricCanvas.value) return
  
  const data = JSON.stringify(fabricCanvas.value.toJSON())
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `fabric-canvas-${Date.now()}.json`
  link.click()
  
  URL.revokeObjectURL(url)
}

// 加载画布
const loadCanvas = () => {
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  fileInput?.click()
}

// 处理文件加载
const handleFileLoad = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file || !fabricCanvas.value) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      fabricCanvas.value?.loadFromJSON(data, () => {
        fabricCanvas.value?.renderAll()
        saveState()
      })
    } catch (error) {
      console.error('加载文件失败:', error)
    }
  }
  reader.readAsText(file)
}

// 监听工具变化
watch(() => selectedTool.value, () => {
  updateToolMode()
})

// 生命周期
onMounted(async () => {
  await initCanvas()
})

onUnmounted(() => {
  if (fabricCanvas.value) {
    fabricCanvas.value.dispose()
  }
})
</script>

<style scoped>
.fabric-demo-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 15px;
  background-color: white;
  border-bottom: 1px solid #e0e0e0;
  flex-wrap: wrap;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-section h3 {
  margin: 0;
  color: #1976d2;
}

.color-picker {
  width: 40px;
  height: 40px;
}

.slider-label {
  font-size: 12px;
  color: #666;
  margin-left: 10px;
}

.canvas-area {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  overflow: auto;
}

.canvas-container {
  border: 2px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  background-color: white;
}

.properties-panel {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 250px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.properties-panel h4 {
  margin: 0 0 15px 0;
  color: #1976d2;
}

.property-group {
  margin-bottom: 10px;
}

.property-group label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 5px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .toolbar-section {
    justify-content: center;
  }
  
  .properties-panel {
    position: relative;
    right: auto;
    top: auto;
    transform: none;
    width: 100%;
    margin-top: 20px;
  }
  
  .canvas-container {
    max-width: 100%;
  }
}
</style>
