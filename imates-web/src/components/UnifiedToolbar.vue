<template>
  <div :class="['unified-toolbar-container', `variant-${variant}`]" @click="showPopup = false">
    <!-- 统一工具栏 -->
    <div
      :class="['unified-toolbar', `unified-toolbar-${variant}`]"
      :style="backgroundColor ? { 'background-color': backgroundColor } : {}"
    >
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
            <img v-if="isImageIcon(tool.icon)" :src="tool.icon" class="action-icon" />
            <q-tooltip>{{ tool.label }}</q-tooltip>
          </q-btn>
        </div>

        <!-- 中间区域 -->
        <div class="center-section">
          <!-- 1. 工具按钮组 -->
          <div class="tool-section">
            <div class="tool-buttons">
              <!-- 搜索工具（作为操作按钮） -->
              <q-btn
                v-for="tool in middleActionTools"
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
                <img v-if="isImageIcon(tool.icon)" :src="tool.icon" class="action-icon" />
                <q-tooltip>{{ tool.label }}</q-tooltip>
              </q-btn>

              <!-- 遍历绘图工具列表 -->
              <div v-for="tool in drawingTools" :key="tool.value" class="tool-icon-wrapper">
                <img
                  :src="tool.icon"
                  :class="{ 'tool-icon-selected': selectedTool === tool.value }"
                  class="tool-icon"
                  @click="handleToolClick(tool.value)"
                />
              </div>
              <!-- 气泡框 -->
              <div v-if="showPopup" class="config-popup">
                <div class="popup-content">
                  <!-- 配置内容区域 -->
                  <div class="config-sections">
                    <!-- 颜色配置 -->
                    <div v-if="currentToolConfig.config?.showColorPicker" class="config-section">
                      <div class="section-title">
                        <q-icon name="palette" size="16px" />
                        <span>颜色</span>
                      </div>
                      <div class="section-content">
                        <div class="color-options">
                          <div
                            v-for="color in currentToolConfig.config?.colors"
                            :key="color.value"
                            class="color-option"
                            :class="{ 'color-selected': toolConfig.color === color.value }"
                            @click="updateConfig({ color: color.value })"
                          >
                            <div
                              class="color-display"
                              :style="{ backgroundColor: color.value }"
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 粗细/大小配置 -->
                    <div v-if="currentToolConfig.config?.showSizePicker" class="config-section">
                      <div class="section-title">
                        <q-icon name="line_weight" size="16px" />
                        <span>{{ currentToolConfig.config?.sizeLabel || '粗细' }}</span>
                      </div>
                      <div class="section-content">
                        <!-- 固定选项 -->
                        <div class="size-options">
                          <div
                            v-for="size in currentToolConfig.config?.sizes"
                            :key="size.value"
                            class="size-option"
                            :class="{ 'size-selected': toolConfig.size === size.value }"
                            @click="updateConfig({ size: size.value })"
                          >
                            <!-- 图标方式显示 -->
                            <img v-if="size.icon" :src="size.icon" class="size-icon" />
                            <!-- 线条方式显示 -->
                            <div v-else class="size-display">
                              <div
                                class="size-line"
                                :style="{ height: size.displayHeight || '2px' }"
                              ></div>
                              <span class="size-label">{{ size.label }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 形状配置（截图用） -->
                    <div v-if="currentToolConfig.config?.showShapePicker" class="config-section">
                      <div class="section-title">
                        <q-icon name="crop" size="16px" />
                        <span>形状</span>
                      </div>
                      <div class="section-content">
                        <div class="shape-options">
                          <div
                            v-for="shape in currentToolConfig.config?.shapes"
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

                    <!-- 笔迹样式配置（画笔用） -->
                    <div v-if="currentToolConfig.config?.showHandwritingStylePicker" class="config-section">
                      <div class="section-title">
                        <q-icon name="edit" size="16px" />
                        <span>{{ currentToolConfig.config?.handwritingStyleLabel || '笔迹样式' }}</span>
                      </div>
                      <div class="section-content">
                        <div class="handwriting-style-options">
                          <div
                            v-for="style in currentToolConfig.config?.handwritingStyles"
                            :key="style.value"
                            class="handwriting-style-option"
                            :class="{ 'handwriting-style-selected': toolConfig.handwritingStyle === style.value }"
                            @click="updateConfig({ handwritingStyle: style.value })"
                          >
                            <div class="handwriting-style-icon">{{ style.icon || '✍️' }}</div>
                            <div class="handwriting-style-info">
                              <div class="handwriting-style-label">{{ style.label }}</div>
                              <div v-if="style.description" class="handwriting-style-desc">{{ style.description }}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 选择模式配置（选择工具用） -->
                    <div v-if="currentToolConfig.config?.showSelectionModePicker" class="config-section">
                      <div class="section-title">
                        <q-icon name="crop_free" size="16px" />
                        <span>{{ currentToolConfig.config?.selectionModeLabel || '选择模式' }}</span>
                      </div>
                      <div class="section-content">
                        <div class="handwriting-style-options">
                          <div
                            v-for="mode in currentToolConfig.config?.selectionModes"
                            :key="mode.value"
                            class="handwriting-style-option"
                            :class="{ 'handwriting-style-selected': toolConfig.selectMode === mode.value }"
                            @click="updateConfig({ selectMode: mode.value })"
                          >
                            <div class="handwriting-style-icon">
                              <q-icon :name="mode.icon" size="20px" />
                            </div>
                            <div class="handwriting-style-info">
                              <div class="handwriting-style-label">{{ mode.label }}</div>
                              <div v-if="mode.description" class="handwriting-style-desc">{{ mode.description }}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <!-- 配置弹出框 -->
              <div v-if="hasConfigurableTools && currentToolConfig.config" class="popup-icon-wrapper" @click.stop>
                <!-- 配置按钮 -->
                <img
                  :src="eraserSettingsIcon"
                  :class="{ 'popup-icon-active': showPopup }"
                  class="popup-icon"
                  @click.stop="togglePopup"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧区域（包含分隔线） -->
        <div class="right-section">
          <!-- 分隔线 -->
          <div v-if="rightTools.length > 0" class="toolbar-divider"></div>
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
            <img v-if="isImageIcon(tool.icon)" :src="tool.icon" class="action-icon" />
            <q-tooltip>{{ tool.label }}</q-tooltip>
          </q-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'

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
interface ToolConfig {
  showColorPicker?: boolean
  colors?: Array<{ value: string; label: string }>
  showSizePicker?: boolean
  sizes?: Array<{ value: number; label: string; displayHeight?: string; icon?: string }>
  sizeLabel?: string // 自定义粗细/大小的标签
  showShapePicker?: boolean
  shapes?: Array<{ value: string; label: string; icon: string }>
  showHandwritingStylePicker?: boolean // 笔迹样式选择器
  handwritingStyles?: Array<{ value: string; label: string; icon?: string; description?: string }> // 笔迹样式选项
  handwritingStyleLabel?: string // 笔迹样式标签
  showSelectionModePicker?: boolean // 选择模式选择器
  selectionModes?: Array<{ value: string; label: string; icon?: string; description?: string }> // 选择模式选项
  selectionModeLabel?: string // 选择模式标签
}

interface ToolOption {
  value: string
  label: string
  icon: string
  // 工具特定配置
  config?: ToolConfig
}

// 工具配置状态接口（用户当前选择的配置值）
interface ToolConfigState {
  color?: string
  size?: number
  shape?: string
  handwritingStyle?: string // 笔迹样式
  selectMode?: string // 选择模式
  [key: string]: string | number | boolean | undefined
}
// 工具名称列表类型：可以是数组（全部放在中间）或对象（按左中右分布）
type ToolsInput =
  | string[]
  | {
      left?: string[]
      middle?: string[]
      right?: string[]
    }

const props = withDefaults(
  defineProps<{
    // 工具名称列表
    // 1. 数组形式：全部放在中间位置（如 ['pen', 'highlighter', 'eraser']）
    // 2. 对象形式：按左中右分布（如 { left: ['back', 'undo'], middle: ['pen', 'highlighter'], right: ['help'] }）
    tools: ToolsInput
    // 当前选中的工具
    selectedTool: string
    // 工具配置
    toolConfig?: ToolConfigState
    // 工具状态（用于禁用某些工具，如 { undo: false, redo: false }）
    toolStates?: Record<string, boolean>
    // 工具栏风格：'floating' 悬浮风格（Excalidraw 风格），'browser' 浏览器式顶部工具栏
    variant?: 'floating' | 'browser'
    // 背景色（仅对 browser 风格有效）
    backgroundColor?: string
  }>(),
  {
    tools: () => [],
    selectedTool: '',
    toolConfig: () => ({}),
    toolStates: () => ({}),
    variant: 'floating',
    backgroundColor: undefined,
  },
)

// 内置的所有工具配置定义
const ALL_TOOLS: Record<string, ToolOption> = {
  // PDF 批注工具
  pen: {
    value: 'pen',
    label: '签字笔',
    icon: signaturePenIcon,
    config: {
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
      showHandwritingStylePicker: true,
      handwritingStyles: [
        { value: 'signature', label: 'Signature Pad风格', icon: '✍️', description: '流畅的签名效果' },
        { value: 'normal', label: '普通风格', icon: '✏️', description: '标准绘制效果' },
      ],
      handwritingStyleLabel: '绘制风格',
    },
  },
  highlighter: {
    value: 'highlighter',
    label: '荧光笔',
    icon: highlighterIcon,
    config: {
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
  },
  eraser: {
    value: 'eraser',
    label: '橡皮擦',
    icon: eraserIcon,
    config: {
      showSizePicker: true,
      sizes: [
        { value: 8, label: '小', icon: eraserSmallIcon },
        { value: 15, label: '中', icon: eraserMediumIcon },
        { value: 25, label: '大', icon: eraserLargeIcon },
      ],
      sizeLabel: '大小',
    },
  },
  screenshot: {
    value: 'screenshot',
    label: '圈选截图',
    icon: screenshotIcon,
    config: {
      showShapePicker: true,
      shapes: [
        { value: 'rectangle', label: '矩形', icon: 'crop_square' },
        { value: 'polygon', label: '自由形状', icon: 'polyline' },
      ],
    },
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
    config: {
      showSelectionModePicker: true,
      selectionModes: [
        { value: 'rectangle', label: '矩形选择', icon: 'crop_square', description: '拖拽形成矩形选区' },
        { value: 'freeform', label: '自由框选', icon: 'polyline', description: '自由绘制选区' },
      ],
      selectionModeLabel: '选择模式',
    },
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
    config: {
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
      showHandwritingStylePicker: true,
      handwritingStyles: [
        { value: 'signature', label: 'Signature Pad风格', icon: '✍️', description: '流畅的签名效果' },
        { value: 'normal', label: '普通风格', icon: '✏️', description: '标准绘制效果' },
      ],
      handwritingStyleLabel: '绘制风格',
    },
  },
  'eraser-draw': {
    value: 'eraser-draw',
    label: '橡皮',
    icon: eraserIcon,
    config: {
      showSizePicker: true,
      sizes: [
        { value: 1, label: '小', icon: eraserSmallIcon },
        { value: 3, label: '中', icon: eraserMediumIcon },
        { value: 5, label: '大', icon: eraserLargeIcon },
      ],
      sizeLabel: '大小',
    },
  },
  text: {
    value: 'text',
    label: '文本',
    icon: insertTextIcon,
    config: {
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
  },
  rectangle: {
    value: 'rectangle',
    label: '矩形',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHJlY3QgeD0iMyIgeT0iNSIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+',
    config: {
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
  },
  circle: {
    value: 'circle',
    label: '圆形',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==',
    config: {
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
  },
  line: {
    value: 'line',
    label: '直线',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PGxpbmUgeDE9IjQiIHkxPSIxMiIgeDI9IjIwIiB5Mj0iMTIiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=',
    config: {
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
  },
  triangle: {
    value: 'triangle',
    label: '三角形',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHBhdGggZD0iTTEyIDQgMiAyMGgyMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=',
    config: {
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
  },

  // 操作工具
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
    icon: 'delete_outline',
  },
  search: {
    value: 'search',
    label: '搜索',
    icon: 'search',
  },
  hideNotes: {
    value: 'hideNotes',
    label: '隐藏笔记',
    icon: 'visibility_off',
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
  help: {
    value: 'help',
    label: '帮助',
    icon: 'help_outline',
  },
}

// Emits 定义
const emit = defineEmits<{
  'tool-change': [tool: string]
  'config-change': [config: ToolConfigState]
  back: []
  chat: []
  undo: []
  redo: []
  clear: []
  search: []
  'hide-notes': []
  help: []
}>()

// 使用 Store
const store = usePdfViewerStore()

// 弹出框状态
const showPopup = ref(false)

// 根据工具名称列表获取完整的工具配置
const getToolOptions = (toolNames: string[]) => {
  return toolNames.map((toolName) => ALL_TOOLS[toolName]).filter((tool) => tool !== undefined)
}

// 解析后的工具分布
const toolsDistribution = computed(() => {
  // 如果是数组，全部放在中间
  if (Array.isArray(props.tools)) {
    return {
      left: [] as string[],
      middle: props.tools,
      right: [] as string[],
    }
  }
  // 如果是对象，按左中右分布
  return {
    left: props.tools.left || [],
    middle: props.tools.middle || [],
    right: props.tools.right || [],
  }
})

// 左侧工具
const leftTools = computed(() => {
  return getToolOptions(toolsDistribution.value.left)
})

// 中间操作工具（如搜索、撤销、重做、清空、隐藏笔记）
const middleActionTools = computed(() => {
  const tools = getToolOptions(toolsDistribution.value.middle).filter((tool) =>
    ['search', 'undo', 'redo', 'clear', 'hideNotes'].includes(tool.value),
  )
  
  // 根据 hideNotes 状态动态修改 hideNotes 工具的图标和标签
  return tools.map((tool) => {
    if (tool.value === 'hideNotes') {
      return {
        ...tool,
        icon: store.hideNotes ? 'visibility_off' : 'visibility',
        label: store.hideNotes ? '隐藏笔记': '显示笔记',
      }
    }
    return tool
  })
})

// 绘图工具（渲染到中间）
const drawingTools = computed(() => {
  return getToolOptions(toolsDistribution.value.middle).filter(
    (tool) => !['search', 'undo', 'redo', 'clear', 'hideNotes'].includes(tool.value),
  )
})

// 右侧工具
const rightTools = computed(() => {
  return getToolOptions(toolsDistribution.value.right)
})

// 所有工具选项（用于配置等）
const toolOptions = computed(() => {
  const allToolNames = [
    ...toolsDistribution.value.left,
    ...toolsDistribution.value.middle,
    ...toolsDistribution.value.right,
  ]
  return getToolOptions(allToolNames)
})

// 是否有可配置的工具
const hasConfigurableTools = computed(() => {
  return toolOptions.value.some((tool) => tool.config !== undefined)
})

// 当前工具的配置选项
const currentToolConfig = computed((): ToolOption => {
  const tool = toolOptions.value.find((t) => t.value === props.selectedTool)
  return tool || { value: '', label: '', icon: '' }
})

// 监听工具切换，如果切换到没有配置的工具，关闭配置面板
watch(
  () => props.selectedTool,
  (newTool) => {
    const tool = toolOptions.value.find((t) => t.value === newTool)
    if (!tool?.config && showPopup.value) {
      showPopup.value = false
    }
  },
)

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
    case 'search':
      emit('search')
      break
    case 'hideNotes':
      emit('hide-notes')
      break
    case 'help':
      emit('help')
      break
  }
}

// 切换弹出框
const togglePopup = (event?: Event) => {
  // 1. 阻止事件冒泡
  if (event) {
    event.stopPropagation()
  }

  // 2. 检查当前工具是否有配置，如果没有则不打开
  if (!currentToolConfig.value.config) {
    return
  }

  // 3. 切换显示状态
  showPopup.value = !showPopup.value
}

// 更新工具配置
const updateConfig = (config: ToolConfigState) => {
  // 1. 合并配置
  const newConfig = { ...props.toolConfig, ...config }

  // 2. 通知父组件配置变化
  emit('config-change', newConfig)
}



// 暴露关闭弹出框方法供外部调用
defineExpose({
  closePopup: () => {
    showPopup.value = false
  },
})
</script>

<style scoped>
/* ========== 悬浮风格（Excalidraw 风格） ========== */
.variant-floating .unified-toolbar-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

.unified-toolbar-floating {
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

.unified-toolbar-floating:hover {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 12px 32px rgba(0, 0, 0, 0.1),
    0 4px 8px rgba(0, 0, 0, 0.06);
}

/* ========== 浏览器式风格（顶部固定工具栏） ========== */
.variant-browser .unified-toolbar-container {
  width: 100%;
  padding: 0;
  align-items: stretch;
  margin-top: -1px;
}

.unified-toolbar-browser {
  background: #0a0020;
  border-top: 1px solid #d0d0d0;
  border-bottom: none;
  border-radius: 0;
  box-shadow: none;
  width: 100%;
  position: relative;
  z-index: 10;
}

.unified-toolbar-browser:hover {
  box-shadow: none;
}

.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  gap: 2px;
}

/* 浏览器式风格工具栏内容 */
.unified-toolbar-browser .toolbar-content {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  max-width: 100%;
  overflow-x: auto;
}

.unified-toolbar-browser .left-section {
  display: flex;
  align-items: center;
  gap: 2px;
  justify-content: flex-start;
}

.unified-toolbar-browser .center-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  grid-column: 2;
}

.unified-toolbar-browser .right-section {
  display: flex;
  align-items: center;
  gap: 2px;
  justify-content: flex-end;
  grid-column: 3;
}

.unified-toolbar-browser .toolbar-divider {
  flex-shrink: 0;
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

/* 悬浮风格工具图标 */
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
  filter: brightness(0); /* 黑色图标 */
}

.tool-icon-selected {
  outline: 2px solid #6965db;
  outline-offset: -2px;
}

/* 浏览器式风格工具图标 */
.unified-toolbar-browser .tool-icon {
  padding: 8px;
  border-radius: 4px;
  width: 36px;
  height: 36px;
  background-color: transparent;
  filter: brightness(0) invert(1); /* 白色图标 */
}

.unified-toolbar-browser .tool-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.unified-toolbar-browser .tool-icon:active {
  transform: none;
  background-color: rgba(255, 255, 255, 0.2);
}

.unified-toolbar-browser .tool-icon-selected {
  background-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.6); /* 蓝色光晕效果 */
}

.popup-icon-wrapper {
  position: relative; /* 为 config-popup 提供定位参考，不设置 z-index 避免创建堆叠上下文 */
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

/* 悬浮风格弹出图标 */
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
  filter: brightness(0); /* 黑色图标 */
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

/* 浏览器式风格弹出图标 */
.unified-toolbar-browser .popup-icon {
  padding: 8px;
  border-radius: 4px;
  width: 36px;
  height: 36px;
  background-color: transparent;
  filter: brightness(0) invert(1); /* 白色图标 */
}

.unified-toolbar-browser .popup-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
  opacity: 1;
}

.unified-toolbar-browser .popup-icon:active {
  transform: none;
  background-color: rgba(255, 255, 255, 0.2);
}

.unified-toolbar-browser .popup-icon-active {
  background-color: rgba(59, 130, 246, 0.3);
  opacity: 1;
}

/* 分隔线 */
.toolbar-divider {
  width: 1px;
  height: 24px;
  background-color: rgba(255, 255, 255, 0.3);
  margin: 0 8px;
}

.config-popup {
  position: absolute;
  top: 100%;
  left: 65%;
  transform: translateX(-50%);
  z-index: 3000; /* 确保在所有 PDF 页面元素之上 */
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

/* 笔迹样式选择器 */
.handwriting-style-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.handwriting-style-option {
  cursor: pointer;
  padding: 12px;
  border-radius: 8px;
  border: 1.5px solid #e8e8e8;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  background: #ffffff;
}

.handwriting-style-option:hover {
  border-color: #6965db;
  background-color: #fafafb;
}

.handwriting-style-option:active {
  transform: scale(0.98);
}

.handwriting-style-selected {
  border-color: #6965db;
  background-color: #e3e2fe;
  font-weight: 600;
}

.handwriting-style-icon {
  font-size: 20px;
  line-height: 1;
}

.handwriting-style-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.handwriting-style-label {
  font-size: 13px;
  color: #333333;
  font-weight: 500;
}

.handwriting-style-selected .handwriting-style-label {
  color: #6965db;
  font-weight: 600;
}

.handwriting-style-desc {
  font-size: 11px;
  color: #6b6b6b;
}

/* 悬浮风格操作按钮 */
.action-btn {
  color: #000000;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  width: 40px;
  height: 40px;
}

.action-btn:hover:not(:disabled) {
  background-color: #f5f5f5;
  color: #000000;
}

.action-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.action-btn:disabled {
  color: #d1d1d1;
  cursor: not-allowed;
}

/* 浏览器式风格操作按钮 */
.unified-toolbar-browser .action-btn {
  border-radius: 4px;
  width: 36px;
  height: 36px;
  color: #ffffff;
}

.unified-toolbar-browser .action-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.unified-toolbar-browser .action-btn:active:not(:disabled) {
  transform: none;
  background-color: rgba(255, 255, 255, 0.2);
}

.unified-toolbar-browser .action-btn:disabled {
  color: rgba(255, 255, 255, 0.4);
}

.action-icon {
  width: 20px;
  height: 20px;
  filter: brightness(0); /* 黑色图标 */
}

.unified-toolbar-browser .action-icon {
  filter: brightness(0) invert(1); /* 白色图标 */
}

/* 禁用用户选择，避免拖动时选中文本 */
.tool-icon,
.popup-icon,
.color-option,
.size-option,
.shape-option,
.handwriting-style-option {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

/* 浏览器式风格响应式设计 */
.unified-toolbar-browser .toolbar-content {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.unified-toolbar-browser .toolbar-content::-webkit-scrollbar {
  height: 4px;
}

.unified-toolbar-browser .toolbar-content::-webkit-scrollbar-thumb {
  background-color: #c0c0c0;
  border-radius: 2px;
}

.unified-toolbar-browser .toolbar-content::-webkit-scrollbar-track {
  background-color: transparent;
}

/* 悬浮风格响应式设计 */
@media (max-width: 768px) {
  .variant-floating .unified-toolbar-container {
    padding: 12px 0;
  }

  .variant-floating .toolbar-content {
    padding: 4px 8px;
  }

  .variant-floating .tool-icon,
  .variant-floating .popup-icon,
  .variant-floating .action-btn {
    width: 36px;
    height: 36px;
    padding: 8px;
  }

  .unified-toolbar-browser .tool-icon,
  .unified-toolbar-browser .popup-icon,
  .unified-toolbar-browser .action-btn {
    width: 32px;
    height: 32px;
    padding: 6px;
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
