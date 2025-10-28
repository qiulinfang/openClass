<template>
  <div class="unified-toolbar-container" @click="showPopup = false">
    <!-- 统一工具栏 -->
    <div class="unified-toolbar">
      <div class="toolbar-content">
        <!-- 左侧区域 -->
        <div class="left-section">
          <!-- 左侧工具按钮 -->
          <q-btn
            v-for="tool in leftTools"
            :key="tool.value"
            flat
            round
            dense
            :icon="isImageIcon(tool.icon) ? undefined : tool.icon"
            :disable="toolStates[tool.value] === false"
            @click="handleActionClick(tool.value)"
            class="action-btn"
          >
            <!-- SVG 图标 -->
            <img
              v-if="isImageIcon(tool.icon)"
              :src="tool.icon"
              class="action-icon"
            />
            <q-tooltip>{{ tool.label }}</q-tooltip>
          </q-btn>
        </div>

        <!-- 中间区域 -->
        <div class="center-section">
          <!-- 1. 工具按钮组 -->
          <div class="tool-section">
            <div class="tool-buttons">
              <!-- 遍历绘图工具列表 -->
              <div v-for="tool in drawingTools" :key="tool.value" class="tool-icon-wrapper">
                <img
                  :src="tool.icon"
                  :class="{ 'tool-icon-selected': selectedTool === tool.value }"
                  class="tool-icon"
                  @click="handleToolClick(tool.value)"
                />
              </div>

              <!-- 配置弹出框 -->
              <div v-if="hasConfigurableTools" class="popup-icon-wrapper" @click.stop>
                <!-- 配置按钮 -->
                <img
                  :src="eraserSettingsIcon"
                  :class="{ 'popup-icon-active': showPopup }"
                  class="popup-icon"
                  @click.stop="togglePopup"
                />

                <!-- 气泡框 -->
                <div v-if="showPopup" class="config-popup">
                  <div class="popup-content">
                    <!-- 配置内容区域 -->
                    <div class="config-sections">
                      <!-- 颜色配置 -->
                      <div v-if="currentToolConfig.showColorPicker" class="config-section">
                        <div class="section-title">
                          <q-icon name="palette" size="16px" />
                          <span>颜色</span>
                        </div>
                        <div class="section-content">
                          <div class="color-options">
                            <div
                              v-for="color in currentToolConfig.colors"
                              :key="color.value"
                              class="color-option"
                              :class="{ 'color-selected': toolConfig.color === color.value }"
                              @click="updateConfig({ color: color.value })"
                            >
                              <div class="color-display" :style="{ backgroundColor: color.value }"></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- 粗细/大小配置 -->
                      <div v-if="currentToolConfig.showSizePicker" class="config-section">
                        <div class="section-title">
                          <q-icon name="line_weight" size="16px" />
                          <span>{{ currentToolConfig.sizeLabel || '粗细' }}</span>
                        </div>
                        <div class="section-content">
                          <div class="size-options">
                            <div
                              v-for="size in currentToolConfig.sizes"
                              :key="size.value"
                              class="size-option"
                              :class="{ 'size-selected': toolConfig.size === size.value }"
                              @click="updateConfig({ size: size.value })"
                            >
                              <!-- 图标方式显示 -->
                              <img v-if="size.icon" :src="size.icon" class="size-icon" />
                              <!-- 线条方式显示 -->
                              <div v-else class="size-display">
                                <div class="size-line" :style="{ height: size.displayHeight || '2px' }"></div>
                                <span class="size-label">{{ size.label }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- 形状配置（截图用） -->
                      <div v-if="currentToolConfig.showShapePicker" class="config-section">
                        <div class="section-title">
                          <q-icon name="crop" size="16px" />
                          <span>形状</span>
                        </div>
                        <div class="section-content">
                          <div class="shape-options">
                            <div
                              v-for="shape in currentToolConfig.shapes"
                              :key="shape.value"
                              class="shape-option"
                              :class="{ 'shape-selected': toolConfig.shape === shape.value }"
                              @click="updateConfig({ shape: shape.value })"
                            >
                              <q-icon :name="shape.icon" size="24px" />
                              <span class="shape-label">{{ shape.label }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- 气泡框箭头 -->
                  <div class="popup-arrow"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧区域 -->
        <div class="right-section">
          <!-- 右侧工具按钮 -->
          <q-btn
            v-for="tool in rightTools"
            :key="tool.value"
            flat
            round
            dense
            :icon="isImageIcon(tool.icon) ? undefined : tool.icon"
            :disable="toolStates[tool.value] === false"
            @click="handleActionClick(tool.value)"
            class="action-btn"
          >
            <!-- SVG 图标 -->
            <img
              v-if="isImageIcon(tool.icon)"
              :src="tool.icon"
              class="action-icon"
            />
            <q-tooltip>{{ tool.label }}</q-tooltip>
          </q-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// 流程：导入图标资源
import eraserSettingsIcon from '/icons/erasersettingsIcon.svg'
import signaturePenIcon from '/icons/signaturePen.svg'
import highlighterIcon from '/icons/highlighter.svg'
import eraserIcon from '/icons/eraser.svg'
import eraserSmallIcon from '/icons/eraserSmall.svg'
import eraserMediumIcon from '/icons/eraserMedium.svg'
import eraserLargeIcon from '/icons/eraserLarge.svg'
import screenshotIcon from '/icons/screenshot.svg'
import resetIcon from '/icons/reset.svg'
import selectIcon from '/icons/select.svg'
import handIcon from '/icons/hand.svg'
import insertTextIcon from '/icons/InsertText.svg'

// 工具配置接口
interface ToolOption {
  value: string
  label: string
  icon: string
  // 工具特定配置
  showColorPicker?: boolean
  colors?: Array<{ value: string; label: string }>
  showSizePicker?: boolean
  sizes?: Array<{ value: number; label: string; displayHeight?: string; icon?: string }>
  sizeLabel?: string // 自定义粗细/大小的标签
  showShapePicker?: boolean
  shapes?: Array<{ value: string; label: string; icon: string }>
}

// 工具配置状态接口
interface ToolConfig {
  color?: string
  size?: number
  shape?: string
  [key: string]: string | number | boolean | undefined
}

// Props 定义
interface Props {
  // 工具名称列表（如 ['pen', 'highlighter', 'eraser', 'undo', 'redo', 'back', 'chat']）
  tools: string[]
  // 当前选中的工具
  selectedTool: string
  // 工具配置
  toolConfig?: ToolConfig
  // 工具状态（用于禁用某些工具，如 { undo: false, redo: false }）
  toolStates?: Record<string, boolean>
}

const props = withDefaults(defineProps<Props>(), {
  tools: () => [],
  selectedTool: '',
  toolConfig: () => ({}),
  toolStates: () => ({}),
})

// 内置的所有工具配置定义
const ALL_TOOLS: Record<string, ToolOption> = {
  // PDF 批注工具
  pen: {
    value: 'pen',
    label: '签字笔',
    icon: signaturePenIcon,
    showColorPicker: true,
    colors: [
      { value: '#ff0000', label: '红色' },
      { value: '#ffd400', label: '黄色' },
      { value: '#007bff', label: '蓝色' },
      { value: '#13df00', label: '绿色' },
      { value: '#8000ff', label: '紫色' },
      { value: '#111111', label: '黑色' },
    ],
    showSizePicker: true,
    sizes: [
      { value: 0.5, label: '细', displayHeight: '1px' },
      { value: 1.0, label: '中', displayHeight: '2px' },
      { value: 2.0, label: '粗', displayHeight: '3px' },
    ],
    sizeLabel: '粗细',
  },
  highlighter: {
    value: 'highlighter',
    label: '荧光笔',
    icon: highlighterIcon,
    showColorPicker: true,
    colors: [
      { value: '#FFFF00', label: '黄色' },
      { value: '#00FF00', label: '绿色' },
      { value: '#0080FF', label: '蓝色' },
      { value: '#00FFFF', label: '青色' },
      { value: '#FF80FF', label: '粉色' },
      { value: '#8000FF', label: '紫色' },
    ],
    showSizePicker: true,
    sizes: [
      { value: 5, label: '细', displayHeight: '4px' },
      { value: 10, label: '中', displayHeight: '7px' },
      { value: 15, label: '粗', displayHeight: '10px' },
    ],
    sizeLabel: '粗细',
  },
  eraser: {
    value: 'eraser',
    label: '橡皮擦',
    icon: eraserIcon,
    showSizePicker: true,
    sizes: [
      { value: 8, label: '小', icon: eraserSmallIcon },
      { value: 15, label: '中', icon: eraserMediumIcon },
      { value: 25, label: '大', icon: eraserLargeIcon },
    ],
    sizeLabel: '大小',
  },
  screenshot: {
    value: 'screenshot',
    label: '圈选截图',
    icon: screenshotIcon,
    showShapePicker: true,
    shapes: [
      { value: 'rectangle', label: '矩形', icon: 'crop_square' },
      { value: 'polygon', label: '自由形状', icon: 'polyline' },
    ],
  },
  reset: {
    value: 'reset',
    label: '重置',
    icon: resetIcon,
  },
  
  // 绘图工具
  select: {
    value: 'select',
    label: '选择',
    icon: selectIcon,
  },
  hand: {
    value: 'hand',
    label: '移动画布',
    icon: handIcon,
  },
  draw: {
    value: 'draw',
    label: '画笔',
    icon: signaturePenIcon,
    showColorPicker: true,
    colors: [
      { value: '#000000', label: '黑色' },
      { value: '#FF0000', label: '红色' },
      { value: '#00FF00', label: '绿色' },
      { value: '#0000FF', label: '蓝色' },
      { value: '#FFFF00', label: '黄色' },
      { value: '#FF00FF', label: '紫色' },
    ],
    showSizePicker: true,
    sizes: [
      { value: 1, label: '细', displayHeight: '1px' },
      { value: 3, label: '中', displayHeight: '3px' },
      { value: 5, label: '粗', displayHeight: '5px' },
      { value: 10, label: '特粗', displayHeight: '8px' },
    ],
    sizeLabel: '粗细',
  },
  'eraser-draw': {
    value: 'eraser-draw',
    label: '橡皮',
    icon: eraserIcon,
    showSizePicker: true,
    sizes: [
      { value: 1, label: '小', icon: eraserSmallIcon },
      { value: 3, label: '中', icon: eraserMediumIcon },
      { value: 5, label: '大', icon: eraserLargeIcon },
    ],
    sizeLabel: '大小',
  },
  text: {
    value: 'text',
    label: '文本',
    icon: insertTextIcon,
    showColorPicker: true,
    colors: [
      { value: '#000000', label: '黑色' },
      { value: '#FF0000', label: '红色' },
      { value: '#00FF00', label: '绿色' },
      { value: '#0000FF', label: '蓝色' },
      { value: '#FFFF00', label: '黄色' },
      { value: '#FF00FF', label: '紫色' },
    ],
    showSizePicker: true,
    sizes: [
      { value: 12, label: '小', displayHeight: '2px' },
      { value: 16, label: '中', displayHeight: '3px' },
      { value: 24, label: '大', displayHeight: '5px' },
      { value: 32, label: '特大', displayHeight: '7px' },
    ],
    sizeLabel: '字体大小',
  },
  rectangle: {
    value: 'rectangle',
    label: '矩形',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHJlY3QgeD0iMyIgeT0iNSIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+',
    showColorPicker: true,
    colors: [
      { value: '#000000', label: '黑色' },
      { value: '#FF0000', label: '红色' },
      { value: '#00FF00', label: '绿色' },
      { value: '#0000FF', label: '蓝色' },
      { value: '#FFFF00', label: '黄色' },
      { value: '#FF00FF', label: '紫色' },
    ],
    showSizePicker: true,
    sizes: [
      { value: 1, label: '细', displayHeight: '1px' },
      { value: 3, label: '中', displayHeight: '3px' },
      { value: 5, label: '粗', displayHeight: '5px' },
      { value: 10, label: '特粗', displayHeight: '8px' },
    ],
    sizeLabel: '边框粗细',
  },
  circle: {
    value: 'circle',
    label: '圆形',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==',
    showColorPicker: true,
    colors: [
      { value: '#000000', label: '黑色' },
      { value: '#FF0000', label: '红色' },
      { value: '#00FF00', label: '绿色' },
      { value: '#0000FF', label: '蓝色' },
      { value: '#FFFF00', label: '黄色' },
      { value: '#FF00FF', label: '紫色' },
    ],
    showSizePicker: true,
    sizes: [
      { value: 1, label: '细', displayHeight: '1px' },
      { value: 3, label: '中', displayHeight: '3px' },
      { value: 5, label: '粗', displayHeight: '5px' },
      { value: 10, label: '特粗', displayHeight: '8px' },
    ],
    sizeLabel: '边框粗细',
  },
  line: {
    value: 'line',
    label: '直线',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGxpbmUgeDE9IjQiIHkxPSIxMiIgeDI9IjIwIiB5Mj0iMTIiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=',
    showColorPicker: true,
    colors: [
      { value: '#000000', label: '黑色' },
      { value: '#FF0000', label: '红色' },
      { value: '#00FF00', label: '绿色' },
      { value: '#0000FF', label: '蓝色' },
      { value: '#FFFF00', label: '黄色' },
      { value: '#FF00FF', label: '紫色' },
    ],
    showSizePicker: true,
    sizes: [
      { value: 1, label: '细', displayHeight: '1px' },
      { value: 3, label: '中', displayHeight: '3px' },
      { value: 5, label: '粗', displayHeight: '5px' },
      { value: 10, label: '特粗', displayHeight: '8px' },
    ],
    sizeLabel: '粗细',
  },
  triangle: {
    value: 'triangle',
    label: '三角形',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHBhdGggZD0iTTEyIDQgMiAyMGgyMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=',
    showColorPicker: true,
    colors: [
      { value: '#000000', label: '黑色' },
      { value: '#FF0000', label: '红色' },
      { value: '#00FF00', label: '绿色' },
      { value: '#0000FF', label: '蓝色' },
      { value: '#FFFF00', label: '黄色' },
      { value: '#FF00FF', label: '紫色' },
    ],
    showSizePicker: true,
    sizes: [
      { value: 1, label: '细', displayHeight: '1px' },
      { value: 3, label: '中', displayHeight: '3px' },
      { value: 5, label: '粗', displayHeight: '5px' },
      { value: 10, label: '特粗', displayHeight: '8px' },
    ],
    sizeLabel: '边框粗细',
  },
  
  // 操作工具（渲染到右侧）
  undo: {
    value: 'undo',
    label: '撤销',
    icon: 'undo',
  },
  redo: {
    value: 'redo',
    label: '重做',
    icon: 'redo',
  },
  clear: {
    value: 'clear',
    label: '清空画布',
    icon: 'delete',
  },
  
  // 导航工具
  back: {
    value: 'back',
    label: '返回',
    icon: 'arrow_back',
  },
  chat: {
    value: 'chat',
    label: '聊天',
    icon: 'chat',
  },
}

// Emits 定义
const emit = defineEmits<{
  'tool-change': [tool: string]
  'config-change': [config: ToolConfig]
  'back': []
  'chat': []
  'undo': []
  'redo': []
  'clear': []
}>()

// 弹出框状态
const showPopup = ref(false)

// 工具位置分类
const LEFT_TOOLS = ['back']
const RIGHT_TOOLS = ['undo', 'redo', 'clear', 'chat']

// 根据传入的工具名称列表获取完整的工具配置
const toolOptions = computed(() => {
  return props.tools
    .map((toolName) => ALL_TOOLS[toolName])
    .filter((tool) => tool !== undefined)
})

// 左侧工具
const leftTools = computed(() => {
  return toolOptions.value.filter((tool) => LEFT_TOOLS.includes(tool.value))
})

// 绘图工具（渲染到中间）
const drawingTools = computed(() => {
  return toolOptions.value.filter((tool) => 
    !LEFT_TOOLS.includes(tool.value) && !RIGHT_TOOLS.includes(tool.value)
  )
})

// 右侧工具
const rightTools = computed(() => {
  return toolOptions.value.filter((tool) => RIGHT_TOOLS.includes(tool.value))
})

// 是否有可配置的工具
const hasConfigurableTools = computed(() => {
  return toolOptions.value.some(
    (tool) => tool.showColorPicker || tool.showSizePicker || tool.showShapePicker
  )
})

// 当前工具的配置选项
const currentToolConfig = computed((): ToolOption => {
  const tool = toolOptions.value.find((t) => t.value === props.selectedTool)
  return tool || { value: '', label: '', icon: '' }
})

// 判断是否为图片图标（SVG 或图片路径）
const isImageIcon = (icon: string) => {
  // 1. 包含路径分隔符（/）表示是文件路径
  // 2. 包含扩展名（.）表示是文件
  // 3. 以 data:image 开头表示是 base64 编码图片
  return icon.includes('/') || icon.includes('.') || icon.startsWith('data:image')
}

// 处理工具点击
const handleToolClick = (tool: string) => {
  // 1. 通知父组件工具变化
  emit('tool-change', tool)
}

// 处理操作工具点击
const handleActionClick = (action: string) => {
  // 1. 根据操作类型触发对应的事件
  switch (action) {
    case 'back':
      emit('back')
      break
    case 'chat':
      emit('chat')
      break
    case 'undo':
      emit('undo')
      break
    case 'redo':
      emit('redo')
      break
    case 'clear':
      emit('clear')
      break
  }
}

// 切换弹出框
const togglePopup = (event?: Event) => {
  // 1. 阻止事件冒泡
  if (event) {
    event.stopPropagation()
  }
  
  // 2. 切换显示状态
  showPopup.value = !showPopup.value
}

// 更新工具配置
const updateConfig = (config: ToolConfig) => {
  // 1. 合并配置
  const newConfig = { ...props.toolConfig, ...config }
  
  // 2. 通知父组件配置变化
  emit('config-change', newConfig)
}

// 暴露关闭弹出框方法供外部调用
defineExpose({
  closePopup: () => {
    showPopup.value = false
  }
})
</script>

<style scoped>
/* Excalidraw 风格容器 */
.unified-toolbar-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

/* Excalidraw 风格悬浮工具栏 */
.unified-toolbar {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 14px;
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  max-width: fit-content;
}

.unified-toolbar:hover {
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 12px 32px rgba(0, 0, 0, 0.1),
    0 4px 8px rgba(0, 0, 0, 0.06);
}

.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  gap: 2px;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 2px;
}

.center-section {
  display: flex;
  align-items: center;
  gap: 2px;
}

.right-section {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tool-section {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tool-buttons {
  display: flex;
  gap: 2px;
}

.tool-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Excalidraw 风格工具图标 */
.tool-icon {
  padding: 10px;
  border-radius: 8px;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  cursor: pointer;
  filter: none;
}

.tool-icon:hover {
  background-color: #f5f5f5;
}

.tool-icon:active {
  transform: scale(0.96);
}

.tool-icon-selected {
  background-color: #e3e2fe;
}

.popup-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Excalidraw 风格弹出图标 */
.popup-icon {
  padding: 10px;
  border-radius: 8px;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  cursor: pointer;
  filter: none;
  opacity: 0.7;
}

.popup-icon:hover {
  background-color: #f5f5f5;
  opacity: 1;
}

.popup-icon:active {
  transform: scale(0.96);
}

.popup-icon-active {
  background-color: #e3e2fe;
  opacity: 1;
}

.config-popup {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  min-width: 300px;
  max-width: 400px;
  animation: popup-fade-in 0.2s ease-out;
}

@keyframes popup-fade-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* Excalidraw 风格弹窗内容 */
.popup-content {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.04),
    0 12px 32px rgba(0, 0, 0, 0.1),
    0 4px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.popup-arrow {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 8px solid white;
}

.config-sections {
  padding: 16px;
}

.config-section {
  margin-bottom: 16px;
}

.config-section:last-child {
  margin-bottom: 0;
}

/* Excalidraw 风格章节标题 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1e1e1e;
  font-weight: 600;
  margin-bottom: 12px;
  font-size: 13px;
  letter-spacing: -0.01em;
  user-select: none;
}

.section-content {
  color: #1e1e1e;
}

/* 颜色选项 */
.color-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Excalidraw 风格颜色选项 */
.color-option {
  position: relative;
  cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.color-option:hover {
  transform: scale(1.08);
}

.color-option:active {
  transform: scale(0.98);
}

.color-display {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #e8e8e8;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.color-selected .color-display {
  border-color: #6965db;
  box-shadow: 
    inset 0 0 0 4px white,
    0 2px 6px rgba(105, 101, 219, 0.3);
}

/* 大小选项 */
.size-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* Excalidraw 风格尺寸选项 */
.size-option {
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1.5px solid #e8e8e8;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
}

.size-option:hover {
  border-color: #6965db;
  background-color: #fafafb;
}

.size-option:active {
  transform: scale(0.98);
}

.size-selected {
  border-color: #6965db;
  background-color: #e3e2fe;
  font-weight: 600;
}

.size-icon {
  width: 24px;
  height: 24px;
}

.size-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.size-line {
  width: 40px;
  background-color: #1e1e1e;
  border-radius: 2px;
}

.size-label {
  font-size: 12px;
  color: #6b6b6b;
  font-weight: 500;
}

/* Excalidraw 风格形状选项 */
.shape-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.shape-option {
  cursor: pointer;
  padding: 12px;
  border-radius: 8px;
  border: 1.5px solid #e8e8e8;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 80px;
  background: #ffffff;
}

.shape-option:hover {
  border-color: #6965db;
  background-color: #fafafb;
}

.shape-option:active {
  transform: scale(0.98);
}

.shape-selected {
  border-color: #6965db;
  background-color: #e3e2fe;
  font-weight: 600;
}

.shape-label {
  font-size: 12px;
  color: #6b6b6b;
  font-weight: 500;
}

/* Excalidraw 风格操作按钮 */
.action-btn {
  color: #6b6b6b;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  width: 40px;
  height: 40px;
}

.action-btn:hover:not(:disabled) {
  background-color: #f5f5f5;
  color: #1e1e1e;
}

.action-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.action-btn:disabled {
  color: #d1d1d1;
  cursor: not-allowed;
}

.action-icon {
  width: 20px;
  height: 20px;
  filter: none;
}

/* 禁用用户选择，避免拖动时选中文本 */
.tool-icon,
.popup-icon,
.color-option,
.size-option,
.shape-option {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

/* Excalidraw 风格响应式设计 */
@media (max-width: 768px) {
  .unified-toolbar-container {
    padding: 12px 0;
  }

  .toolbar-content {
    padding: 4px 8px;
  }

  .tool-icon,
  .popup-icon,
  .action-btn {
    width: 36px;
    height: 36px;
    padding: 8px;
  }

  .left-section,
  .center-section,
  .right-section {
    gap: 1px;
  }

  .tool-section {
    gap: 1px;
  }

  .tool-buttons {
    gap: 1px;
  }

  .config-popup {
    min-width: 280px;
    max-width: 90vw;
  }

  .color-display {
    width: 28px;
    height: 28px;
  }

  .size-option,
  .shape-option {
    padding: 6px 10px;
    min-width: 50px;
  }
}

/* 平板设备适配 */
@media (min-width: 769px) and (max-width: 1024px) {
  .config-popup {
    min-width: 320px;
  }
}
</style>

