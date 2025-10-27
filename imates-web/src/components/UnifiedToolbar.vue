<template>
  <div class="unified-toolbar-container" @click="showPopup = false">
    <!-- 统一工具栏 -->
    <div class="unified-toolbar">
      <div class="toolbar-content">
        <!-- 左侧区域 -->
        <div class="left-section">
          <!-- 1. 插槽优先 -->
          <slot name="left">
            <!-- 2. 默认显示返回按钮 -->
            <q-btn v-if="showBack" flat round dense icon="arrow_back" @click="emit('back')" />
          </slot>
        </div>

        <!-- 中间区域 -->
        <div class="center-section">
          <!-- 1. 工具按钮组 -->
          <div class="tool-section">
            <div class="tool-buttons">
              <!-- 遍历工具列表 -->
              <div v-for="tool in toolOptions" :key="tool.value" class="tool-icon-wrapper">
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
                  src="/icons/erasersettingsIcon.svg"
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

          <!-- 2. 中间插槽（可以放额外的操作按钮） -->
          <slot name="center"></slot>
        </div>

        <!-- 右侧区域 -->
        <div class="right-section">
          <!-- 1. 插槽优先 -->
          <slot name="right">
            <!-- 2. 默认显示聊天按钮 -->
            <q-btn
              v-if="showChat"
              flat
              round
              dense
              icon="chat"
              @click="emit('toggle-chat')"
              class="chat-button"
            />
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

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
  // 工具名称列表（如 ['pen', 'highlighter', 'eraser']）
  tools: string[]
  // 当前选中的工具
  selectedTool: string
  // 工具配置
  toolConfig?: ToolConfig
  // 是否显示返回按钮
  showBack?: boolean
  // 是否显示聊天按钮
  showChat?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tools: () => [],
  selectedTool: '',
  toolConfig: () => ({}),
  showBack: true,
  showChat: false,
})

// 内置的所有工具配置定义
const ALL_TOOLS: Record<string, ToolOption> = {
  // PDF 批注工具
  pen: {
    value: 'pen',
    label: '签字笔',
    icon: '/icons/signaturePen.svg',
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
    icon: '/icons/highlighter.svg',
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
    icon: '/icons/eraser.svg',
    showSizePicker: true,
    sizes: [
      { value: 8, label: '小', icon: '/icons/eraserSmall.svg' },
      { value: 15, label: '中', icon: '/icons/eraserMedium.svg' },
      { value: 25, label: '大', icon: '/icons/eraserLarge.svg' },
    ],
    sizeLabel: '大小',
  },
  screenshot: {
    value: 'screenshot',
    label: '圈选截图',
    icon: '/icons/screenshot.svg',
    showShapePicker: true,
    shapes: [
      { value: 'rectangle', label: '矩形', icon: 'crop_square' },
      { value: 'polygon', label: '自由形状', icon: 'polyline' },
    ],
  },
  reset: {
    value: 'reset',
    label: '重置',
    icon: '/icons/reset.svg',
  },
  
  // 绘图工具
  select: {
    value: 'select',
    label: '选择',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJNMTMgMWwtMiAyIDYgNiAyLTIgNiA2di02eiIvPjwvc3ZnPg==',
  },
  draw: {
    value: 'draw',
    label: '画笔',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJNMyAxNy4yNVYyMWgzLjc1TDE3LjgxIDkuOTRsLTMuNzUtMy43NUwzIDE3LjI1ek0yMC43MSA3LjA0YTEgMSAwIDAgMCAwLTEuNDFsLTIuMzQtMi4zNGExIDEgMCAwIDAtMS40MSAwbC0xLjgzIDEuODMgMy43NSAzLjc1IDEuODMtMS44M3oiLz48L3N2Zz4=',
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
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHBhdGggZD0iTTYuNCA2LjRMMTIgMTJsNS42LTUuNkwyMCA4bC02IDYgNiA2LTIuNiAxLjZMMTIgMTZsLTUuNiA1LjZMMiAyMGw2LTYtNi02IDIuNC0yLjR6Ii8+PC9zdmc+',
    showSizePicker: true,
    sizes: [
      { value: 1, label: '细', displayHeight: '1px' },
      { value: 3, label: '中', displayHeight: '3px' },
      { value: 5, label: '粗', displayHeight: '5px' },
      { value: 10, label: '特粗', displayHeight: '8px' },
    ],
    sizeLabel: '大小',
  },
  text: {
    value: 'text',
    label: '文本',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHBhdGggZD0iTTUgNHYzaDQuNXY5aDNoVjdIMTdWNHoiLz48L3N2Zz4=',
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
}

// Emits 定义
const emit = defineEmits<{
  'tool-change': [tool: string]
  'config-change': [config: ToolConfig]
  'back': []
  'toggle-chat': []
}>()

// 弹出框状态
const showPopup = ref(false)

// 根据传入的工具名称列表获取完整的工具配置
const toolOptions = computed(() => {
  return props.tools
    .map((toolName) => ALL_TOOLS[toolName])
    .filter((tool) => tool !== undefined)
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

// 处理工具点击
const handleToolClick = (tool: string) => {
  // 1. 通知父组件工具变化
  emit('tool-change', tool)
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
.unified-toolbar-container {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.unified-toolbar {
  background: #100035;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  min-height: 64px;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.center-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  justify-content: center;
}

.right-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.tool-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-buttons {
  display: flex;
  gap: 4px;
}

.tool-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-icon {
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  filter: brightness(0) invert(1);
  cursor: pointer;
}

.tool-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.tool-icon-selected {
  background-color: rgba(255, 255, 255, 0.2);
}

.popup-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup-icon {
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  cursor: pointer;
  filter: brightness(0) invert(0.8);
}

.popup-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.popup-icon-active {
  background-color: rgba(255, 255, 255, 0.2);
  filter: brightness(0) invert(1);
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

.popup-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
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

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #100035;
  font-weight: 600;
  margin-bottom: 12px;
  font-size: 14px;
  user-select: none;
}

.section-content {
  color: #100035;
}

/* 颜色选项 */
.color-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  position: relative;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-display {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #e0e0e0;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.color-selected .color-display {
  box-shadow: inset 0 0 0 5px white;
}

/* 大小选项 */
.size-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.size-option {
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
  transition: all 0.2s ease;
  min-width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.size-option:hover {
  border-color: #100035;
  background-color: rgba(16, 0, 53, 0.05);
}

.size-selected {
  border-color: #100035;
  background-color: rgba(16, 0, 53, 0.1);
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
  background-color: #100035;
  border-radius: 2px;
}

.size-label {
  font-size: 12px;
  color: #666;
}

/* 形状选项 */
.shape-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.shape-option {
  cursor: pointer;
  padding: 12px;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 80px;
}

.shape-option:hover {
  border-color: #100035;
  background-color: rgba(16, 0, 53, 0.05);
}

.shape-selected {
  border-color: #100035;
  background-color: rgba(16, 0, 53, 0.1);
  font-weight: 600;
}

.shape-label {
  font-size: 12px;
  color: #666;
}

.chat-button {
  transition: all 0.2s ease;
}

.chat-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
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

/* 响应式设计 */
@media (max-width: 768px) {
  .toolbar-content {
    padding: 6px 12px;
    min-height: 56px;
  }

  .tool-icon,
  .popup-icon {
    width: 48px;
    height: 48px;
    padding: 6px;
  }

  .center-section {
    gap: 8px;
  }

  .tool-buttons {
    gap: 2px;
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

