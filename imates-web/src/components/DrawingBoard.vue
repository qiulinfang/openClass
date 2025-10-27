<template>
  <div class="fabric-demo-container">
    <!-- 统一工具栏 -->
    <UnifiedToolbar
      :tools="['select', 'draw', 'eraser-draw', 'text', 'rectangle', 'circle', 'line', 'triangle']"
      :selected-tool="displayedTool"
      :tool-config="toolConfig"
      :show-back="false"
      :show-chat="false"
      @tool-change="handleToolChange"
      @config-change="handleConfigChange"
    >
      <!-- 中间插槽：额外操作按钮 -->
      <template #center>
        <div class="extra-buttons">
          <q-btn
            flat
            round
            dense
            icon="undo"
            :disable="!canUndo"
            @click="undo"
            class="action-btn"
          >
            <q-tooltip>撤销</q-tooltip>
          </q-btn>
          
          <q-btn
            flat
            round
            dense
            icon="redo"
            :disable="!canRedo"
            @click="redo"
            class="action-btn"
          >
            <q-tooltip>重做</q-tooltip>
          </q-btn>
          
          <q-btn
            flat
            round
            dense
            icon="delete"
            @click="clearCanvas"
            class="action-btn"
          >
            <q-tooltip>清空画布</q-tooltip>
          </q-btn>
        </div>
      </template>
    </UnifiedToolbar>
    
    <!-- 滚动容器 -->
    <div class="scroll-container">
      <!-- 画布区域 -->
      <div class="canvas-area">
        <canvas ref="canvasContainer" class="canvas-container"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Canvas, PencilBrush, IText, Rect, Circle, Line, Triangle } from 'fabric'
import UnifiedToolbar from './UnifiedToolbar.vue'

// 画布实例
const canvasContainer = ref<HTMLCanvasElement>()
const fabricCanvas = ref<Canvas | null>(null)

// 画布尺寸
const canvasWidth = ref(800)
const canvasHeight = ref(600)

// 工具状态（内部使用，Fabric.js 的工具名称）
const selectedTool = ref('select')

// 显示的工具名称（传递给 UnifiedToolbar 显示）
const displayedTool = ref('select')

// 工具配置
const toolConfig = ref<{ color?: string; size?: number; [key: string]: string | number | boolean | undefined }>({
  color: '#000000',
  size: 3,
})

// 历史记录
const history = ref<string[]>([])
const historyIndex = ref(-1)
const isPerformingHistoryAction = ref(false) // 标记是否正在执行撤销/重做操作

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

// 计算画布尺寸
const calculateCanvasSize = () => {
  // 1. 设置一个固定的较大画布尺寸，支持滚动查看
  // 2. 用户可以在较大的画布上自由绘制
  canvasWidth.value = 1200
  canvasHeight.value = 800
}

// 初始化画布
const initCanvas = async () => {
  // 1. 检查画布容器是否存在
  if (!canvasContainer.value) return
  
  await nextTick()
  
  // 2. 计算画布尺寸
  calculateCanvasSize()
  
  // 3. 创建 Fabric Canvas 实例
  fabricCanvas.value = new Canvas(canvasContainer.value, {
    width: canvasWidth.value,
    height: canvasHeight.value,
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true
  })
  
  // 4. 设置画笔
  setupBrush()
  
  // 5. 监听画布事件
  setupCanvasEvents()
  
  // 6. 保存初始状态
  saveState()
}


// 设置画笔
const setupBrush = () => {
  if (!fabricCanvas.value) return
  
  const brush = new PencilBrush(fabricCanvas.value as unknown as Canvas)
  brush.color = toolConfig.value.color || '#000000'
  brush.width = toolConfig.value.size || 3
  fabricCanvas.value.freeDrawingBrush = brush
}

// 设置画布事件
const setupCanvasEvents = () => {
  if (!fabricCanvas.value) return
  
  // 1. 监听对象修改事件
  fabricCanvas.value.on('object:modified', () => {
    // 如果正在执行历史操作（撤销/重做），跳过保存
    if (isPerformingHistoryAction.value) return
    // 保存当前状态到历史记录
    saveState()
  })
  
  // 2. 监听对象添加事件
  fabricCanvas.value.on('object:added', (e) => {
    // 如果正在执行历史操作（撤销/重做），跳过保存
    if (isPerformingHistoryAction.value) return
    // 如果是路径对象（画笔绘制），跳过保存，等待 path:created 事件
    if (e.target?.type === 'path') return
    // 保存当前状态到历史记录
    saveState()
  })
  
  // 3. 监听对象删除事件
  fabricCanvas.value.on('object:removed', () => {
    // 如果正在执行历史操作（撤销/重做），跳过保存
    if (isPerformingHistoryAction.value) return
    // 保存当前状态到历史记录
    saveState()
  })
  
  // 4. 监听路径创建事件（画笔绘制完成）
  fabricCanvas.value.on('path:created', (event) => {
    // 如果正在执行历史操作（撤销/重做），跳过保存
    if (isPerformingHistoryAction.value) return
    // 如果是橡皮擦模式，设置路径为擦除模式
    if (selectedTool.value === 'eraser') {
      const path = event.path
      if (path) {
        // 设置路径的合成操作为擦除模式
        path.set({ globalCompositeOperation: 'destination-out' })
      }
    }
    // 保存当前状态到历史记录
    saveState()
  })
  
  // 5. 监听鼠标点击事件
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
    fontSize: toolConfig.value.size || 16,
    fill: toolConfig.value.color || '#000000'
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
    stroke: toolConfig.value.color || '#000000',
    strokeWidth: toolConfig.value.size || 3
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
    stroke: toolConfig.value.color || '#000000',
    strokeWidth: toolConfig.value.size || 3
  })
  
  fabricCanvas.value.add(circle)
  fabricCanvas.value.setActiveObject(circle)
}

// 添加直线
const addLine = (pointer: { x: number; y: number }) => {
  if (!fabricCanvas.value) return
  
  const line = new Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
    stroke: toolConfig.value.color || '#000000',
    strokeWidth: toolConfig.value.size || 3
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
    stroke: toolConfig.value.color || '#000000',
    strokeWidth: toolConfig.value.size || 3
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
      eraserBrush.width = toolConfig.value.size || 3
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

// 工具名称映射（UnifiedToolbar 中的工具名称到 Fabric.js 中的工具名称）
const toolNameMap: Record<string, string> = {
  draw: 'pen',
  'eraser-draw': 'eraser',
}

// 处理工具切换
const handleToolChange = (tool: string) => {
  // 1. 保存显示的工具名称
  displayedTool.value = tool
  
  // 2. 映射为内部工具名称
  const mappedTool = toolNameMap[tool] || tool
  
  // 3. 更新选中的工具
  selectedTool.value = mappedTool
}

// 处理配置变化
const handleConfigChange = (config: { color?: string; size?: number; [key: string]: string | number | boolean | undefined }) => {
  // 1. 更新工具配置（合并而非替换）
  toolConfig.value = { ...toolConfig.value, ...config }
  
  // 2. 如果当前是画笔模式，更新画笔配置
  if (selectedTool.value === 'pen' && fabricCanvas.value?.freeDrawingBrush) {
    if (config.color) {
      fabricCanvas.value.freeDrawingBrush.color = config.color
    }
    if (config.size !== undefined) {
      fabricCanvas.value.freeDrawingBrush.width = config.size
    }
  }
  
  // 3. 如果当前是橡皮擦模式，更新橡皮擦大小
  if (selectedTool.value === 'eraser' && fabricCanvas.value?.freeDrawingBrush && config.size !== undefined) {
    fabricCanvas.value.freeDrawingBrush.width = config.size
  }
}

// 保存状态到历史记录
const saveState = () => {
  // 1. 检查画布实例是否存在
  if (!fabricCanvas.value) return
  
  // 2. 将当前画布状态序列化为JSON
  const state = JSON.stringify(fabricCanvas.value.toJSON())
  
  // 3. 如果当前不在历史记录末尾，删除后面的记录（分支截断）
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  
  // 4. 将新状态添加到历史记录
  history.value.push(state)
  historyIndex.value = history.value.length - 1
  
  // 5. 限制历史记录数量为20条
  if (history.value.length > 20) {
    history.value.shift()
    historyIndex.value--
  }
}

// 撤销
const undo = () => {
  // 1. 检查画布实例和撤销条件
  if (!fabricCanvas.value || !canUndo.value) return
  
  // 2. 设置标志，防止 loadFromJSON 触发保存
  isPerformingHistoryAction.value = true
  
  // 3. 移动到上一个历史状态
  historyIndex.value--
  
  // 4. 从历史记录加载状态
  const state = history.value[historyIndex.value]
  fabricCanvas.value.loadFromJSON(state, () => {
    if (!fabricCanvas.value) return
    
    // 5. 第一次渲染canvas
    fabricCanvas.value.renderAll()
    
    // 6. 恢复画笔配置（如果是绘图模式）
    if (selectedTool.value === 'pen' || selectedTool.value === 'eraser') {
      setupBrush()
    }
    
    // 7. 延迟清除标志并再次渲染，确保canvas完全刷新
    setTimeout(() => {
      isPerformingHistoryAction.value = false
      // 8. 第二次渲染canvas，确保所有变更生效
      fabricCanvas.value?.renderAll()
    }, 50)
  })
}

// 重做
const redo = () => {
  // 1. 检查画布实例和重做条件
  if (!fabricCanvas.value || !canRedo.value) return
  
  // 2. 设置标志，防止 loadFromJSON 触发保存
  isPerformingHistoryAction.value = true
  
  // 3. 移动到下一个历史状态
  historyIndex.value++
  
  // 4. 从历史记录加载状态
  const state = history.value[historyIndex.value]
  fabricCanvas.value.loadFromJSON(state, () => {
    if (!fabricCanvas.value) return
    
    // 5. 第一次渲染canvas
    fabricCanvas.value.renderAll()
    
    // 6. 恢复画笔配置（如果是绘图模式）
    if (selectedTool.value === 'pen' || selectedTool.value === 'eraser') {
      setupBrush()
    }
    
    // 7. 延迟清除标志并再次渲染，确保canvas完全刷新
    setTimeout(() => {
      isPerformingHistoryAction.value = false
      // 8. 第二次渲染canvas，确保所有变更生效
      fabricCanvas.value?.renderAll()
    }, 50)
  })
}

// 清空画布
const clearCanvas = () => {
  // 1. 检查画布实例是否存在
  if (!fabricCanvas.value) return
  
  // 2. 清空画布所有对象
  fabricCanvas.value.clear()
  
  // 3. 重置背景色为白色
  fabricCanvas.value.backgroundColor = '#ffffff'
  
  // 4. 保存当前状态到历史记录
  saveState()
}

// 监听工具变化
watch(() => selectedTool.value, () => {
  updateToolMode()
})

// 生命周期
onMounted(async () => {
  // 1. 初始化画布
  await initCanvas()
})

onUnmounted(() => {
  // 1. 销毁画布
  if (fabricCanvas.value) {
    fabricCanvas.value.dispose()
  }
})
</script>

<style scoped>
.fabric-demo-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: #f5f5f5;
  position: relative;
}

/* UnifiedToolbar 置顶样式 */
.unified-toolbar-container {
  position: sticky;
  top: 0;
  z-index: 100;
}

.extra-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-left: 16px;
}

.action-btn {
  color: white;
}

.action-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

/* 滚动容器 - 占据工具栏之外的所有剩余空间 */
.scroll-container {
  flex: 1;
  overflow: scroll;
  background-color: #f5f5f5;
  position: relative;
}

.canvas-area {
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.canvas-container {
  border: 2px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  background-color: white;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .scroll-container {
    overflow-x: auto;
    overflow-y: auto;
  }
  
  .canvas-area {
    padding: 10px;
  }
  
  .canvas-container {
    max-width: calc(100vw - 40px);
  }
}
</style>
