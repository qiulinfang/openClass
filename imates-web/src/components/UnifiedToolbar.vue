<template>
  <div
    :class="['unified-toolbar-container', `variant-${variant}`, `orientation-${orientation}`]"
    @click="showPopup = false"
  >
    <!-- 统一工具栏 -->
    <div
      :class="[
        'unified-toolbar',
        `unified-toolbar-${variant}`,
        `unified-toolbar-orientation-${orientation}`,
      ]"
    >
      <!-- 左侧插槽（工具栏外部） -->
      <div class="toolbar-slot toolbar-slot-left">
        <slot name="left-actions" />
      </div>

      <!-- 工具栏内容（有背景和边框） -->
      <div
        class="toolbar-content"
        :class="[`toolbar-content-orientation-${orientation}`]"
        :style="backgroundColor ? { 'background-color': backgroundColor } : {}"
      >
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
            <div
              v-if="isImageIcon(tool.icon)"
              :style="getMaskIconStyle(tool.icon, 'action')"
              class="action-icon mask-icon"
            />
            <q-tooltip>{{ tool.label }}</q-tooltip>
          </q-btn>
        </div>

        <!-- 中间区域 -->
        <div class="center-section">
          <div class="tool-row">
            <!-- 操作按钮 -->
            <div
              v-for="tool in middleActionTools"
              :key="tool.value"
              class="tool-icon-wrapper"
              :class="{ 'tool-disabled': toolStates[tool.value] === false }"
              @click="toolStates[tool.value] !== false && handleActionClick(tool.value)"
            >
              <div
                :style="getMaskIconStyle(
                  tool.icon, 
                  SELECTABLE_ACTION_TOOLS.includes(tool.value) ? 'tool' : 'action',
                  SELECTABLE_ACTION_TOOLS.includes(tool.value) ? tool.value : undefined
                )"
                class="tool-icon mask-icon"
              />
              <q-tooltip>{{ tool.label }}</q-tooltip>
            </div>

            <!-- 分隔线 -->
            <div v-if="drawingTools.length > 0" class="toolbar-divider-vertical"></div>

            <!-- 绘图工具 -->
            <template v-for="tool in drawingTools">
              <!-- 带下拉菜单的工具（如形状） -->
              <BubblePopup
                v-if="tool.subTools && tool.subTools.length > 0"
                :key="tool.value + '-dropdown'"
                v-model="showShapeDropdown"
                placement="bottom"
                :show-arrow="true"
                :offset="4"
              >
                <template #trigger>
                  <div class="tool-icon-wrapper tool-with-dropdown">
                    <div
                      :style="getMaskIconStyle(getShapeIcon(), 'tool', currentShapeTool)"
                      class="tool-icon mask-icon"
                    />
                    <!-- 下拉箭头（旋转90度） -->
                    <div class="dropdown-arrow">
                      <q-icon name="arrow_drop_down" size="14px" />
                    </div>
                  </div>
                </template>
                <!-- 下拉菜单内容 -->
                <div class="shape-dropdown-content">
                    <div
                      v-for="subTool in getSubToolOptions(tool.subTools)"
                      :key="subTool.value"
                      class="shape-dropdown-item"
                      :class="{ 'shape-dropdown-item-selected': currentShapeTool === subTool.value }"
                      @click="selectShapeTool(subTool.value)"
                    >
                      <div
                        :style="getMaskIconStyle(subTool.icon, 'tool', subTool.value)"
                        class="shape-dropdown-icon mask-icon"
                      />
                      <span class="shape-dropdown-label">{{ subTool.label }}</span>
                    </div>
                  </div>
              </BubblePopup>
              <!-- 普通工具 -->
              <div v-else :key="tool.value" class="tool-icon-wrapper">
                <div
                  :style="getMaskIconStyle(tool.icon, 'tool', tool.value)"
                  class="tool-icon mask-icon"
                  @click="handleToolClick(tool.value)"
                />
              </div>
            </template>

            <!-- 配置弹窗 -->
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

                  <!-- 选择模式配置（选择工具用） -->
                  <div
                    v-if="currentToolConfig.config?.showSelectionModePicker"
                    class="config-section"
                  >
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
                          :class="{
                            'handwriting-style-selected': toolConfig.selectMode === mode.value,
                          }"
                          @click="updateConfig({ selectMode: mode.value })"
                        >
                          <div class="handwriting-style-icon">
                            <q-icon :name="mode.icon" size="20px" />
                          </div>
                          <div class="handwriting-style-info">
                            <div class="handwriting-style-label">{{ mode.label }}</div>
                            <div v-if="mode.description" class="handwriting-style-desc">
                              {{ mode.description }}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 配置弹出框按钮 -->
          <div
            v-if="hasConfigurableTools && currentToolConfig.config"
            class="popup-icon-wrapper"
            @click.stop
          >
            <div
              :style="getMaskIconStyle(getPopupIcon(), 'config')"
              class="popup-icon mask-icon"
              @click.stop="togglePopup"
            />
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
            <div v-if="isImageIcon(tool.icon)" :style="getMaskIconStyle(tool.icon, 'action')" />
            <q-tooltip>{{ tool.label }}</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- 右侧插槽（工具栏外部） -->
      <div class="toolbar-slot toolbar-slot-right">
        <slot name="right-actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import BubblePopup from '@/components/BubblePopup.vue'

// 流程：导入图标资源
import eraserSettingsIcon from '/icons/erasersettingsIcon.svg' // 橡皮设置
import signaturePenIcon from '/icons/signaturePen.svg' // 签名笔
import highlighterIcon from '/icons/highlighter.svg' // 高亮笔
import eraserIcon from '/icons/eraser.svg' // 橡皮
import eraserSmallIcon from '/icons/eraserSmall.svg' // 小橡皮
import eraserMediumIcon from '/icons/eraserMedium.svg' // 中橡皮
import eraserLargeIcon from '/icons/eraserLarge.svg' // 大橡皮
import screenshotIcon from '/icons/screenshot.svg' // 截图
import screenshotSelectIcon from '/icons/screenshot_select.svg' // 截图选择
import resetIcon from '/icons/reset.svg' // 重置
import selectIcon from '/icons/select.svg' // 选择
import handIcon from '/icons/hand.svg' // 手
import handSelectIcon from '/icons/hand_select.svg' // 手选择
import insertTextIcon from '/icons/InsertText.svg' // 插入文本
import signaturePenConfigIcon from '/icons/signaturePen_config.svg' // 签名笔配置
import signaturePen_selectIcon from '/icons/signaturePen_select.svg' // 签名笔选择
import highlighterConfigIcon from '/icons/highlighter_config.svg' // 高亮笔配置
import highlighter_selectIcon from '/icons/highlighter_select.svg' // 高亮笔选择
import eraser_selectIcon from '/icons/eraser_select.svg' // 橡皮选择
import rectangleIcon from '/icons/rectangle.svg' // 矩形
import circleIcon from '/icons/circle.svg' // 圆形
import lineIcon from '/icons/line.svg' // 线
import triangleIcon from '/icons/triangle.svg' // 三角形
import redoIcon from '/icons/undo.svg' // 撤销
import undoIcon from '/icons/redo.svg' // 重做
import dustbinIcon from '/icons/dustbin.svg' // 清空（垃圾桶）

// 工具配置接口
interface ToolConfig {
  showColorPicker?: boolean
  colors?: Array<{ value: string; label: string }>
  showSizePicker?: boolean
  sizes?: Array<{ value: number; label: string; displayHeight?: string; icon?: string }>
  sizeLabel?: string // 自定义粗细/大小的标签
  showShapePicker?: boolean
  shapes?: Array<{ value: string; label: string; icon: string }>
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
  // 子工具列表（用于下拉菜单，如形状工具）
  subTools?: string[]
}

// 工具配置状态接口（用户当前选择的配置值）
interface ToolConfigState {
  color?: string
  size?: number
  shape?: string
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
    // 工具栏方向：horizontal=水平，vertical=垂直
    orientation?: 'horizontal' | 'vertical'
  }>(),
  {
    tools: () => [],
    selectedTool: '',
    toolConfig: () => ({}),
    toolStates: () => ({}),
    variant: 'floating',
    backgroundColor: undefined,
    orientation: 'horizontal',
  }
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
        { value: 2.5, label: '细', displayHeight: '1px' },
        { value: 3.0, label: '中', displayHeight: '2px' },
        { value: 3.5, label: '粗', displayHeight: '3px' },
      ],
      sizeLabel: '粗细',
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
        { value: 8, label: '细', displayHeight: '4px' },
        { value: 12, label: '中', displayHeight: '7px' },
        { value: 16, label: '粗', displayHeight: '10px' },
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
  // screenshot: {
  //   value: 'screenshot',
  //   label: '圈选截图',
  //   icon: screenshotIcon,
  //   config: {
  //     showShapePicker: true,
  //     shapes: [
  //       { value: 'rectangle', label: '矩形', icon: 'crop_square' },
  //       { value: 'polygon', label: '自由形状', icon: 'polyline' },
  //     ],
  //   },
  // },
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
        {
          value: 'rectangle',
          label: '矩形选择',
          icon: 'crop_square',
          description: '拖拽形成矩形选区',
        },
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
  'eraser-stroke': {
    value: 'eraser-stroke',
    label: '笔画橡皮',
    icon: eraserIcon,
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
  // PDF 页面锚点文字笔记工具（复用文本图标和配置）
  note: {
    value: 'note',
    label: '文字笔记',
    icon: insertTextIcon,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#FFCC00', label: '黄色' },
        { value: '#FF9900', label: '橙色' },
        { value: '#FF6666', label: '红色' },
        { value: '#66CCFF', label: '蓝色' },
        { value: '#66CC66', label: '绿色' },
        { value: '#000000', label: '黑色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 12, label: '小', displayHeight: '2px' },
        { value: 16, label: '中', displayHeight: '3px' },
        { value: 20, label: '大', displayHeight: '4px' },
      ],
      sizeLabel: '字体大小',
    },
  },
  rectangle: {
    value: 'rectangle',
    label: '矩形',
    icon: rectangleIcon,
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
    icon: circleIcon,
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
    icon: lineIcon,
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
    icon: triangleIcon,
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

  // 形状工具（带下拉菜单，包含直线）
  shape: {
    value: 'shape',
    label: '形状',
    icon: rectangleIcon,
    // 子工具列表，用于下拉菜单
    subTools: ['rectangle', 'circle', 'triangle', 'line'],
  },

  // 操作工具
  undo: {
    value: 'undo',
    label: '撤销',
    icon: undoIcon,
  },
  redo: {
    value: 'redo',
    label: '重做',
    icon: redoIcon,
  },
  clear: {
    value: 'clear',
    label: '清空画布',
    icon: dustbinIcon,
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

// 形状下拉菜单状态（由 BubblePopup 通过 v-model 管理）
const showShapeDropdown = ref(false)
// 当前选中的形状工具（默认矩形）
const currentShapeTool = ref('rectangle')

// 选择形状工具
const selectShapeTool = (tool: string) => {
  currentShapeTool.value = tool
  showShapeDropdown.value = false
  emit('tool-change', tool)
}

// 获取当前形状工具的图标
const getShapeIcon = () => {
  const tool = ALL_TOOLS[currentShapeTool.value]
  return tool?.icon || ALL_TOOLS['rectangle'].icon
}

// 获取子工具选项
const getSubToolOptions = (subToolNames: string[]) => {
  return subToolNames.map((name) => ALL_TOOLS[name]).filter((tool) => tool !== undefined)
}

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

// 操作工具列表（撤销、重做、清空、手型等）
const ACTION_TOOLS = ['search', 'undo', 'redo', 'clear', 'hideNotes', 'hand']

// 需要选中状态的操作工具（如 hand）
const SELECTABLE_ACTION_TOOLS = ['hand']

// 中间操作工具（如搜索、撤销、重做、清空、手型、隐藏笔记）
const middleActionTools = computed(() => {
  const tools = getToolOptions(toolsDistribution.value.middle).filter((tool) =>
    ACTION_TOOLS.includes(tool.value)
  )

  // 根据 hideNotes 状态动态修改 hideNotes 工具的图标和标签
  return tools.map((tool) => {
    if (tool.value === 'hideNotes') {
      return {
        ...tool,
        icon: store.hideNotes ? 'visibility_off' : 'visibility',
        label: store.hideNotes ? '隐藏笔记' : '显示笔记',
      }
    }
    return tool
  })
})

// 绘图工具（渲染到中间，不包含操作工具）
const drawingTools = computed(() => {
  return getToolOptions(toolsDistribution.value.middle).filter(
    (tool) => !ACTION_TOOLS.includes(tool.value)
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
  }
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
    case 'hand':
      // hand 是绘图工具，需要触发 tool-change
      emit('tool-change', action)
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

// 配置按钮图标：根据当前选中工具使用对应 *_config 图标
const getPopupIcon = () => {
  const currentTool = currentToolConfig.value?.value

  switch (currentTool) {
    case 'pen':
      return signaturePenConfigIcon || eraserSettingsIcon
    case 'highlighter':
      return highlighterConfigIcon || eraserSettingsIcon
    case 'eraser':
    case 'eraser-draw':
      // 橡皮暂时没有单独的 config 图标，使用通用设置图标
      return eraserSettingsIcon
    default:
      return eraserSettingsIcon
  }
}

// 生成 mask-image 样式：用于 SVG 图标的精准染色
// iconPath: SVG 文件路径
// type: 图标类型 - 'action'(操作按钮), 'tool'(绘图工具), 'config'(配置按钮)
// toolValue: 可选，当前工具值（用于判断是否选中）
const getMaskIconStyle = (
  iconPath: string,
  type: 'action' | 'tool' | 'config' = 'action',
  toolValue?: string
) => {
  // 基础 mask 样式
  const maskStyle: Record<string, string> = {
    '-webkit-mask-image': `url('${iconPath}')`,
    '-webkit-mask-repeat': 'no-repeat',
    '-webkit-mask-position': 'center',
    '-webkit-mask-size': 'contain',
    'mask-image': `url('${iconPath}')`,
    'mask-repeat': 'no-repeat',
    'mask-position': 'center',
    'mask-size': 'contain',
  }

  // 根据类型和当前配置确定背景色
  let backgroundColor = '#ffffff' // 默认白色（适合浏览器风格）

  if (type === 'action') {
    // 操作按钮：浏览器风格用白色，悬浮风格用黑色
    backgroundColor = props.variant === 'browser' ? '#ffffff' : '#000000'
  } else if (type === 'tool') {
    // 绘图工具：选中状态统一使用高亮色，其余保持原来的黑/白色
    if (toolValue && props.selectedTool === toolValue) {
      backgroundColor = '#909BFF'
    } else {
      backgroundColor = props.variant === 'browser' ? '#ffffff' : '#000000'
    }
  } else if (type === 'config') {
    // 配置按钮：使用当前工具的颜色（保留原逻辑）
    if (props.toolConfig?.color) {
      backgroundColor = props.toolConfig.color.toString()
    } else {
      backgroundColor = props.variant === 'browser' ? '#ffffff' : '#000000'
    }
  }

  maskStyle['background-color'] = backgroundColor

  return maskStyle
}

// 暴露关闭弹出框方法供外部调用
defineExpose({
  closePopup: () => {
    showPopup.value = false
  },
})
</script>

<style scoped lang="scss">
// SCSS 变量
$transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
$transition-normal: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
$color-primary: #6965db;
$color-border: #e8e8e8;
$color-text: #1e1e1e;
$color-text-secondary: #6b6b6b;
$color-bg-hover: #f5f5f5;
$color-bg-selected: #e3e2fe;

// ========== 悬浮风格（Excalidraw 风格） ==========
.variant-floating {
  .unified-toolbar-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 0;
  }
}

.unified-toolbar-floating {
  display: flex;
  align-items: center;
  gap: 20px;
}

// ========== 浏览器式风格（顶部固定工具栏） ==========
.variant-browser {
  .unified-toolbar-container {
    width: 100%;
    padding: 0;
    align-items: stretch;
    margin-top: -1px;
  }
}

.unified-toolbar-browser {
  width: 100%;
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
}

// 插槽容器样式
.toolbar-slot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.toolbar-slot-left {
  justify-content: flex-start;
}

.toolbar-slot-right {
  justify-content: flex-end;
}

.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  gap: 2px;
  // 悬浮风格的背景和边框
  background: #ffffff;
  border: 1px solid $color-border;
  border-radius: 14px;
  transition: all $transition-normal;
}

/* ========== 方向相关样式 ========== */

/* 垂直方向整体：内部块纵向堆叠 */
.unified-toolbar-orientation-vertical {
  flex-direction: column;
  align-items: stretch;
}

/* 垂直方向下，内容区域改为纵向布局 */
.toolbar-content-orientation-vertical {
  flex-direction: column;
  align-items: stretch;
}

/* 左/中/右区块改为竖直排列 */
.unified-toolbar-orientation-vertical {
  .left-section,
  .center-section,
  .right-section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .center-section {
    .tool-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }

  /* 垂直模式下，竖直分隔线改成横向分隔线 */
  .toolbar-divider-vertical {
    width: 100%;
    height: 1px;
    margin: 6px 0;
  }

  /* 操作按钮在竖直模式下左对齐，增加竖直间距 */
  .tool-icon-wrapper,
  .action-btn {
    justify-content: flex-start;
  }
}

.unified-toolbar-browser {
  .toolbar-content {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 8px;
    max-width: 100%;
    overflow-x: auto;
  }

  .left-section {
    display: flex;
    justify-content: flex-start;
    flex-shrink: 0;
  }

  .center-section {
    display: flex;
    flex: 1;
    justify-content: center;
  }

  .right-section {
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  .toolbar-divider {
    flex-shrink: 0;
  }
}

.left-section,
.center-section,
.right-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.center-section {
  .tool-row {
    display: flex;
    align-items: center;
    gap: 5px;
  }
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
  cursor: pointer;
  
  &.tool-disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
}

// BubblePopup 在工具栏中的对齐修复
:deep(.bubble-popup-wrapper) {
  display: inline-flex;
  align-items: center;
}

// 带下拉菜单的工具
.tool-with-dropdown {
  position: relative;
  cursor: pointer;
  
  .dropdown-arrow {
    position: absolute;
    right: -5px;
    bottom: -4px;
    width: 12px;
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    // 逆时针旋转90度
    transform: rotate(-45deg);
  }
}

// 形状下拉菜单内容（BubblePopup 内部）
.shape-dropdown-content {
  min-width: 90px;
}

.shape-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color $transition-fast;
  
  &:hover {
    background-color: $color-bg-hover;
  }
  
  &.shape-dropdown-item-selected {
    background-color: $color-bg-selected;
    color: $color-primary;
  }
}

.shape-dropdown-icon {
  width: 18px;
  height: 18px;
}

.shape-dropdown-label {
  font-size: 13px;
  white-space: nowrap;
}

// 垂直分隔线
.toolbar-divider-vertical {
  width: 1px;
  height: 24px;
  background-color: $color-border;
  margin: 0 6px;
}

// 悬浮风格工具图标
.tool-icon {
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    background-color: $color-bg-hover;
  }

  &:active {
    transform: scale(0.96);
  }
}

.unified-toolbar-browser {
  .tool-icon {
    padding: 8px;
    border-radius: 4px;
    width: 26px;
    height: 26px;
    background-color: transparent;
  }
}

.popup-icon-wrapper {
  position: relative; /* 为 config-popup 提供定位参考，不设置 z-index 避免创建堆叠上下文 */
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

// 悬浮风格弹出图标
.popup-icon {
  padding: 10px;
  border-radius: 8px;
  transition: all $transition-fast;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  cursor: pointer;
}

.unified-toolbar-browser {
  .popup-icon {
    padding: 8px;
    border-radius: 4px;
    width: 26px;
    height: 26px;
    background-color: transparent;

    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
      opacity: 1;
    }

    &:active {
      transform: none;
      background-color: rgba(255, 255, 255, 0.2);
    }
  }

  .popup-icon-active {
    background-color: rgba(59, 130, 246, 0.3);
    opacity: 1;
  }
}

/* 分隔线 */
.toolbar-divider {
  width: 1px;
  height: 24px;
  background-color: rgba(255, 255, 255, 0.3);
  margin: 0 8px;
}

// 配置弹窗
.config-popup {
  position: absolute;
  top: 100%;
  left: 65%;
  transform: translateX(-50%);
  z-index: 3000;
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
  background: #ffffff;
  border: 1px solid $color-border;
  border-radius: 12px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.04), 0 12px 32px rgba(0, 0, 0, 0.1),
    0 4px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.config-sections {
  padding: 16px;
}

.config-section {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: $color-text;
  font-weight: 600;
  margin-bottom: 12px;
  font-size: 13px;
  letter-spacing: -0.01em;
  user-select: none;
}

.section-content {
  color: $color-text;
}

// 颜色选项
.color-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  position: relative;
  cursor: pointer;
  transition: transform $transition-fast;

  &:hover {
    transform: scale(1.08);
  }

  &:active {
    transform: scale(0.98);
  }
}

.color-display {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid $color-border;
  transition: all $transition-fast;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.color-selected .color-display {
  border-color: $color-primary;
  box-shadow: inset 0 0 0 4px white, 0 2px 6px rgba(105, 101, 219, 0.3);
}

// 大小选项
.size-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.size-option {
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1.5px solid $color-border;
  transition: all $transition-fast;
  min-width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;

  &:hover {
    border-color: $color-primary;
    background-color: #fafafb;
  }

  &:active {
    transform: scale(0.98);
  }
}

.size-selected {
  border-color: $color-primary;
  background-color: $color-bg-selected;
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
  background-color: $color-text;
  border-radius: 2px;
}

.size-label {
  font-size: 12px;
  color: $color-text-secondary;
  font-weight: 500;
}

// 形状选项
.shape-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.shape-option {
  cursor: pointer;
  padding: 12px;
  border-radius: 8px;
  border: 1.5px solid $color-border;
  transition: all $transition-fast;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 80px;
  background: #ffffff;

  &:hover {
    border-color: $color-primary;
    background-color: #fafafb;
  }

  &:active {
    transform: scale(0.98);
  }
}

.shape-selected {
  border-color: $color-primary;
  background-color: $color-bg-selected;
  font-weight: 600;
}

.shape-label {
  font-size: 12px;
  color: $color-text-secondary;
  font-weight: 500;
}

// 笔迹样式选择器
.handwriting-style-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.handwriting-style-option {
  cursor: pointer;
  padding: 12px;
  border-radius: 8px;
  border: 1.5px solid $color-border;
  transition: all $transition-fast;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  background: #ffffff;

  &:hover {
    border-color: $color-primary;
    background-color: #fafafb;
  }

  &:active {
    transform: scale(0.98);
  }
}

.handwriting-style-selected {
  border-color: $color-primary;
  background-color: $color-bg-selected;
  font-weight: 600;

  .handwriting-style-label {
    color: $color-primary;
    font-weight: 600;
  }
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

.handwriting-style-desc {
  font-size: 11px;
  color: $color-text-secondary;
}

// 悬浮风格操作按钮
.action-btn {
  color: #000000;
  transition: all $transition-fast;
  border-radius: 8px;
  width: 26px;
  height: 26px;

  &:hover:not(:disabled) {
    background-color: $color-bg-hover;
    color: #000000;
  }

  &:active:not(:disabled) {
    transform: scale(0.96);
  }

  &:disabled {
    color: #d1d1d1;
    cursor: not-allowed;
  }
}

.unified-toolbar-browser {
  .action-btn {
    border-radius: 4px;
    width: 26px;
    height: 26px;
    color: #ffffff;

    &:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    &:active:not(:disabled) {
      transform: none;
      background-color: rgba(255, 255, 255, 0.2);
    }

    &:disabled {
      color: rgba(255, 255, 255, 0.4);
    }
  }
}

// mask-icon 基础样式
.mask-icon {
  display: block;
}

.action-icon {
  width: 20px;
  height: 20px;
}

// 禁用用户选择，避免拖动时选中文本
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

// 浏览器式风格响应式设计
.unified-toolbar-browser {
  .toolbar-content {
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;

    &::-webkit-scrollbar {
      height: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background-color: #c0c0c0;
      border-radius: 2px;
    }

    &::-webkit-scrollbar-track {
      background-color: transparent;
    }
  }
}

// 悬浮风格响应式设计
@media (max-width: 768px) {
  .variant-floating {
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
  }

  .unified-toolbar-browser {
    .tool-icon,
    .popup-icon,
    .action-btn {
      width: 32px;
      height: 32px;
      padding: 6px;
    }
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

// 平板设备适配
@media (min-width: 769px) and (max-width: 1024px) {
  .config-popup {
    min-width: 320px;
  }
}
</style>
