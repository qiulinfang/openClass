<template>
  <div :class="['unified-toolbar-container', `variant-${variant}`, `orientation-${orientation}`]">
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
              <img
                v-if="shouldUseRawIcon(tool.icon)"
                :src="tool.icon"
                class="tool-icon raw-icon"
                alt=""
              />
              <div
                v-else
                :style="
                  getMaskIconStyle(
                    tool.icon,
                    SELECTABLE_ACTION_TOOLS.includes(tool.value) ? 'tool' : 'action',
                    SELECTABLE_ACTION_TOOLS.includes(tool.value) ? tool.value : undefined
                  )
                "
                class="tool-icon mask-icon"
              />
              <q-tooltip>{{ tool.label }}</q-tooltip>
            </div>

            <!-- 分隔线 -->
            <div v-if="drawingTools.length > 0" class="toolbar-divider-vertical"></div>

            <!-- 绘图工具 -->
            <!-- eslint-disable-next-line vue/no-v-for-template-key -->
            <template v-for="tool in drawingTools" :key="tool.value">
              <BubblePopup
                :model-value="activeToolPopup === tool.value"
                @update:model-value="
                  (val) => {
                    console.log('🎈 BubblePopup update:', {
                      tool: tool.value,
                      val,
                      currentPopup: activeToolPopup,
                    })
                    activeToolPopup = val ? tool.value : null
                  }
                "
                :placement="orientation === 'vertical' ? 'right' : 'bottom'"
                :show-arrow="true"
                :offset="4"
              >
                <template #trigger>
                  <div
                    v-if="tool"
                    class="tool-icon-wrapper"
                    @click.stop="handleToolClick(tool.value)"
                  >
                    <div
                      :style="
                        getMaskIconStyle(
                          isSubToolActive(tool) ? ALL_TOOLS[selectedTool].icon : tool.icon,
                          'tool',
                          isSubToolActive(tool) ? selectedTool : tool.value
                        )
                      "
                      class="tool-icon mask-icon"
                    />
                    <q-tooltip>{{ tool.label }}</q-tooltip>
                  </div>
                </template>

                <!-- 弹出内容：包含项（子工具选择）和 配置项 -->
                <div class="combined-popup-content">
                  <div class="popup-inner">
                    <!-- 1. 子工具选择器 (如形状切换) -->
                    <div v-if="tool.subTools && tool.subTools.length > 0" class="config-section">
                      <div class="section-title">
                        <q-icon name="category" size="16px" />
                        <span>切换形状</span>
                      </div>
                      <div class="section-content">
                        <div style="display: flex; justify-content: space-between">
                          <div
                            v-for="subTool in getSubToolOptions(tool.subTools)"
                            :key="subTool.value"
                            class="shape-grid-item"
                            :class="{ 'item-selected': selectedTool === subTool.value }"
                            @click="selectShapeTool(subTool.value)"
                          >
                            <div
                              :style="getMaskIconStyle(subTool.icon, 'tool', subTool.value)"
                              class="shape-grid-icon mask-icon"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 2. 具体的工具配置 (颜色、粗细、浓度、模式等) -->
                    <div v-if="getToolConfig(tool)" class="config-sections-wrapper">
                      <!-- 颜色配置 -->
                      <div v-if="getToolConfig(tool)?.showColorPicker" class="config-section">
                        <div class="section-title">
                          <q-icon name="palette" size="16px" />
                          <span>颜色</span>
                        </div>
                        <div class="section-content">
                          <div class="color-options">
                            <div
                              v-for="color in getToolConfig(tool)?.colors || []"
                              :key="color.value"
                              class="color-option"
                              :class="{ 'color-selected': toolConfig.color === color.value }"
                              @click="updateConfig({ color: color.value })"
                            >
                              <div
                                class="color-display"
                                :style="{ backgroundColor: color.value }"
                              ></div>
                              <q-tooltip>{{ color.label }}</q-tooltip>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- 粗细/大小配置 -->
                      <div v-if="getToolConfig(tool)?.showSizePicker" class="config-section">
                        <div class="section-title">
                          <q-icon name="line_weight" size="16px" />
                          <span>{{ getToolConfig(tool)?.sizeLabel || '粗细' }}</span>
                        </div>
                        <div class="section-content">
                          <div class="size-slider-wrapper" style="padding: 0 8px; width: 100%">
                            <PurpleSlider
                              :model-value="toolConfig.size || getMinSize(tool)"
                              @update:model-value="(val) => updateConfig({ size: val })"
                              :min="getMinSize(tool)"
                              :max="getMaxSize(tool)"
                              :step="getStepSize(tool)"
                            />
                          </div>
                        </div>
                      </div>

                      <!-- 透明度/浓度配置 -->
                      <div v-if="getToolConfig(tool)?.showOpacityPicker" class="config-section">
                        <div class="section-title">
                          <q-icon name="opacity" size="16px" />
                          <span>浓度</span>
                        </div>
                        <div class="section-content">
                          <div class="size-slider-wrapper" style="padding: 0 8px; width: 100%">
                            <PurpleSlider
                              :model-value="(toolConfig.opacity ?? 1) * 100"
                              @update:model-value="(val) => updateConfig({ opacity: val / 100 })"
                              :min="1"
                              :max="100"
                              :step="1"
                            />
                          </div>
                        </div>
                      </div>

                      <!-- 选择模式配置 -->
                      <div
                        v-if="getToolConfig(tool)?.showSelectionModePicker"
                        class="config-section"
                      >
                        <div class="section-title">
                          <q-icon name="crop_free" size="16px" />
                          <span>{{ getToolConfig(tool)?.selectionModeLabel || '选择模式' }}</span>
                        </div>
                        <div class="section-content">
                          <div class="selection-mode-options">
                            <div
                              v-for="mode in getToolConfig(tool)?.selectionModes || []"
                              :key="mode.value"
                              class="selection-mode-card"
                              :class="{
                                'selection-mode-selected': toolConfig.selectMode === mode.value,
                              }"
                              @click="updateConfig({ selectMode: mode.value })"
                            >
                              <div class="selection-mode-icon">
                                <q-icon :name="mode.icon" size="24px" />
                              </div>
                              <div class="selection-mode-info">
                                <div class="selection-mode-label">{{ mode.label }}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </BubblePopup>
            </template>
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
            <img v-if="shouldUseRawIcon(tool.icon)" :src="tool.icon" class="action-icon raw-icon" alt="" />
            <div v-else-if="isImageIcon(tool.icon)" :style="getMaskIconStyle(tool.icon, 'action')" />
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
import BubblePopup from '@/components/base/Popover.vue'
import PurpleSlider from '@/components/base/Slider.vue'

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
import shapeConfigIcon from '/icons/shape_config.svg' // 形状配置
import selectConfigIcon from '/icons/select_config.svg' // 选择配置
import redoIcon from '/icons/undo.svg' // 撤销
import undoIcon from '/icons/redo.svg' // 重做
import dustbinIcon from '/icons/delete.svg' // 清空（垃圾桶）
import askAiIcon from '/icons/askAI.svg' // 问问学伴
import pictureIcon from '/icons/picture1.svg' // 图片
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
  showOpacityPicker?: boolean // 透明度选择器
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
  opacity?: number
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
  // 移除冗余的 pen 配置，统一使用 draw

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
      showOpacityPicker: true,
    },
  },
  eraser: {
    value: 'eraser',
    label: '橡皮擦',
    icon: eraserIcon,
    config: {
      showSizePicker: true,
      sizes: [
        { value: 5, label: '小', icon: eraserSmallIcon },
        { value: 10, label: '中', icon: eraserMediumIcon },
        { value: 15, label: '大', icon: eraserLargeIcon },
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
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 3, label: '中', displayHeight: '3px' },
        { value: 5, label: '粗', displayHeight: '5px' },
        { value: 10, label: '特粗', displayHeight: '8px' },
      ],
      sizeLabel: '粗细',
      showOpacityPicker: true,
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
    config: {
      showSizePicker: true,
      sizes: [
        { value: 40, label: '小', icon: eraserSmallIcon },
        { value: 60, label: '中', icon: eraserMediumIcon },
        { value: 80, label: '大', icon: eraserLargeIcon },
      ],
      sizeLabel: '擦除范围',
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
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 3, label: '中', displayHeight: '3px' },
        { value: 5, label: '粗', displayHeight: '5px' },
        { value: 10, label: '特粗', displayHeight: '8px' },
      ],
      sizeLabel: '边框粗细',
      showOpacityPicker: true,
    },
  },
  circle: {
    value: 'circle',
    label: '圆形',
    icon: circleIcon,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 3, label: '中', displayHeight: '3px' },
        { value: 5, label: '粗', displayHeight: '5px' },
        { value: 10, label: '特粗', displayHeight: '8px' },
      ],
      sizeLabel: '边框粗细',
      showOpacityPicker: true,
    },
  },
  line: {
    value: 'line',
    label: '直线',
    icon: lineIcon,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 3, label: '中', displayHeight: '3px' },
        { value: 5, label: '粗', displayHeight: '5px' },
        { value: 10, label: '特粗', displayHeight: '8px' },
      ],
      sizeLabel: '粗细',
      showOpacityPicker: true,
    },
  },
  triangle: {
    value: 'triangle',
    label: '三角形',
    icon: triangleIcon,
    config: {
      showColorPicker: true,
      colors: [
        { value: '#212529', label: '黑色' },
        { value: '#dc3545', label: '红色' },
        { value: '#198754', label: '绿色' },
        { value: '#0d6efd', label: '蓝色' },
        { value: '#ffc107', label: '黄色' },
        { value: '#6610f2', label: '紫色' },
      ],
      showSizePicker: true,
      sizes: [
        { value: 1, label: '细', displayHeight: '1px' },
        { value: 3, label: '中', displayHeight: '3px' },
        { value: 5, label: '粗', displayHeight: '5px' },
        { value: 10, label: '特粗', displayHeight: '8px' },
      ],
      sizeLabel: '边框粗细',
      showOpacityPicker: true,
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
  insertImage: {
    value: 'insertImage',
    label: '插入图片',
    icon: pictureIcon,
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
  askAi: {
    value: 'askAi',
    label: '问问学伴',
    icon: askAiIcon,
    config: {
      showSelectionModePicker: true,
      selectionModes: [
        {
          value: 'rectangle',
          label: '矩形框选',
          icon: 'crop_square',
          description: '拖拽形成矩形选区',
        },
        {
          value: 'freeform',
          label: '自由框选',
          icon: 'polyline',
          description: '自由绘制选区',
        },
      ],
      selectionModeLabel: '截图模式',
    },
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
  'insert-image': []
  search: []
  'hide-notes': []
  help: []
}>()

// 使用 Store
const store = usePdfViewerStore()

// 弹出框控制
const activeToolPopup = ref<string | null>(null)

// 跟踪上一次选中的形状
const lastSelectedShape = ref<string | null>(null)

// 选择形状工具
const selectShapeTool = (tool: string) => {
  // 记录上一次选中的形状（如果是形状工具的话）
  const shapeTool = ALL_TOOLS['shape']
  if (shapeTool?.subTools?.includes(tool)) {
    lastSelectedShape.value = tool
  }
  emit('tool-change', tool)
}

// 判断当前工具包（如形状）的子工具是否被选中
const isSubToolActive = (tool: ToolOption) => {
  if (props.selectedTool === tool.value) return true
  if (tool.subTools && tool.subTools.includes(props.selectedTool)) return true
  return false
}

// 获取指定工具的配置
const getToolConfig = (tool: ToolOption) => {
  if (props.selectedTool === tool.value) return tool.config
  if (tool.subTools && tool.subTools.includes(props.selectedTool)) {
    return ALL_TOOLS[props.selectedTool]?.config
  }
  return tool.config
}

// 获取当前形状工具的图标
const getShapeIcon = () => {
  const tool = ALL_TOOLS[props.selectedTool]
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

// 所有工具选项（包含子工具，用于配置查找）
const toolOptions = computed(() => {
  const allToolNames = [
    ...toolsDistribution.value.left,
    ...toolsDistribution.value.middle,
    ...toolsDistribution.value.right,
  ]
  const baseTools = getToolOptions(allToolNames)

  // 额外查找子工具，确保子工具被选中时也能找到配置
  const allPossibleTools = [...baseTools]
  baseTools.forEach((tool) => {
    if (tool.subTools) {
      tool.subTools.forEach((subName) => {
        if (!allPossibleTools.find((t) => t.value === subName)) {
          const subTool = ALL_TOOLS[subName]
          if (subTool) allPossibleTools.push(subTool)
        }
      })
    }
  })

  return allPossibleTools
})

// 是否有可配置的工具
const hasConfigurableTools = computed(() => {
  return toolOptions.value.some((tool) => tool.config !== undefined)
})

// 当前工具的配置选项
const currentToolConfig = computed<ToolOption>(() => {
  // 1. 优先从当前工具栏工具中找
  let tool = toolOptions.value.find((t) => t.value === props.selectedTool)

  // 2. 如果找不到，尝试从所有内置工具库中直接查找（兜底，支持不在 tools 数组但在 ALL_TOOLS 中的工具，如具体形状）
  if (!tool) {
    tool = ALL_TOOLS[props.selectedTool]
  }

  return tool || { value: '', label: '', icon: '' }
})

// 粗细滑块配置
const getMinSize = (tool: ToolOption) => {
  const cfg = getToolConfig(tool)
  const sizes = cfg?.sizes
  if (!sizes || sizes.length === 0) return 1
  return Math.min(...sizes.map((s) => s.value))
}

const getMaxSize = (tool: ToolOption) => {
  const cfg = getToolConfig(tool)
  const sizes = cfg?.sizes
  if (!sizes || sizes.length === 0) return 10
  return Math.max(...sizes.map((s) => s.value))
}

const getStepSize = (tool: ToolOption) => {
  const cfg = getToolConfig(tool)
  const sizes = cfg?.sizes
  if (!sizes) return 1
  const hasDecimal = sizes.some((s) => s.value % 1 !== 0)
  return hasDecimal ? 0.5 : 1
}

// 监听工具切换，如果切换到没有配置的工具，关闭配置面板
watch(
  () => props.selectedTool,
  (newTool) => {
    const tool = toolOptions.value.find((t) => t.value === newTool)
    if (!tool?.config && activeToolPopup.value) {
      activeToolPopup.value = null
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

const shouldUseRawIcon = (iconPath: string) => {
  return typeof iconPath === 'string' && iconPath.includes('/icons/delete.svg')
}

// 处理工具点击
const handleToolClick = (toolName: string) => {
  console.log('🔧 handleToolClick:', toolName, {
    isSubToolActive: isSubToolActive(ALL_TOOLS[toolName]),
    selectedTool: props.selectedTool,
    activeToolPopup: activeToolPopup,
  })

  if (isSubToolActive(ALL_TOOLS[toolName])) {
    // 再次点击已选中的工具，切换弹出框
    const shouldOpen = activeToolPopup.value !== toolName
    console.log('📱 切换弹出框:', { current: activeToolPopup.value, shouldOpen, tool: toolName })
    activeToolPopup.value = shouldOpen ? toolName : null
  } else {
    // 点击未选中的工具，仅切换工具
    console.log('🔄 切换工具:', toolName)
    // 如果是形状工具，立即选择形状
    if (toolName === 'shape') {
      const shapeToSelect = lastSelectedShape.value || 'rectangle'
      console.log('🎯 选择形状:', shapeToSelect)
      selectShapeTool(shapeToSelect)
    } else {
      emit('tool-change', toolName)
    }
    console.log('❌ 关闭弹出框')
    activeToolPopup.value = null
  }
}

// 处理操作工具点击
const handleActionClick = (action: string) => {
  // 1. 根据操作类型触发对应的事件，并决定是否切换工具
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
      // 重做后切回绘画工具，便于继续写
      emit('tool-change', 'draw')
      break
    case 'clear':
      emit('clear')
      // 清空后切回绘画工具，便于继续写
      emit('tool-change', 'draw')
      break
    case 'insertImage':
      emit('insert-image')
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
    default:
      // 其他操作：点击操作按钮时，自动选择形状
      const shapeToSelect = lastSelectedShape.value || 'rectangle' // 默认选择第一个形状
      emit('tool-change', shapeToSelect)
      break
  }
}

// 配置按钮图标：根据当前选中工具使用对应 *_config 图标
const getPopupIcon = () => {
  const currentTool = currentToolConfig.value?.value
  switch (currentTool) {
    case 'draw':
      return signaturePenConfigIcon
    case 'select':
      return selectIcon
    case 'rectangle':
      return rectangleIcon
    case 'circle':
      return circleIcon
    case 'triangle':
      return triangleIcon
    case 'line':
      return lineIcon
    case 'highlighter':
      return highlighterConfigIcon
    case 'eraser':
    case 'eraser-draw':
    case 'eraser-stroke':
      return eraserIcon
    default:
      return signaturePenConfigIcon
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
    // 配置按钮：使用当前工具的颜色，但对橡皮擦做特殊处理防止不可见
    const currentTool = currentToolConfig.value?.value
    if (currentTool?.includes('eraser')) {
      backgroundColor = props.variant === 'browser' ? '#ffffff' : '#000000'
    } else if (props.toolConfig?.color) {
      backgroundColor = props.toolConfig.color.toString()
      // 如果颜色非常接近白色且不是 browser 模式，强制改为黑色以保证可见性
      if (backgroundColor.toLowerCase() === '#ffffff' && props.variant !== 'browser') {
        backgroundColor = '#000000'
      }
    } else {
      backgroundColor = props.variant === 'browser' ? '#ffffff' : '#000000'
    }
  }

  maskStyle['background-color'] = backgroundColor

  return maskStyle
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
    activeToolPopup.value = null
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
$color-text-tertiary: #9e9e9e;
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
:deep(:global(.bubble-popup)) {
  width: 300px !important;
}

// 带下拉菜单的工具
.config-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  // 逆时针旋转90度
  transform: rotate(-45deg);
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

.raw-icon {
  padding: 0;
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
  position: relative;
  /* 为 config-popup 提供定位参考，不设置 z-index 避免创建堆叠上下文 */
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

@keyframes popup-fade-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 统一配置弹出框内容
.combined-popup-content {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
}

.popup-inner {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width:265px;
}

.config-sections-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1e1e1e;
  font-weight: 600;
  font-size: 13px;
  user-select: none;

  .q-icon {
    color: $color-primary;
    opacity: 0.8;
  }

  span {
    opacity: 0.9;
  }
}

.section-content {
  width: 100%;
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

.shape-grid-item {
  cursor: pointer;
  padding: 12px 8px;
  border-radius: 12px;
  border: 1.5px solid $color-border;
  transition: all $transition-fast;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);

  &.item-selected {
    border-color: $color-primary;
    background-color: $color-bg-selected;

    .shape-grid-icon {
      background-color: $color-primary !important;
    }

    .shape-grid-label {
      color: $color-primary;
      font-weight: 700;
    }
  }
}

.shape-grid-icon {
  width: 24px;
  height: 24px;
  background-color: #666;
  transition: background-color $transition-fast;
}

.shape-grid-label {
  font-size: 12px;
  color: $color-text-secondary;
  font-weight: 500;
  transition: color $transition-fast;
}

// 笔迹样式选择器
.handwriting-style-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

// 选择模式选项 (重命名并增强布局)
.selection-mode-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  width: 100%;
  padding-top: 4px;
}

.selection-mode-card {
  cursor: pointer;
  padding: 12px 8px;
  border-radius: 12px;
  border: 1.5px solid $color-border;
  transition: all $transition-fast;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  min-height: 80px;

  &:hover {
    border-color: $color-primary;
    background-color: #fafafb;
    transform: translateY(-1px);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  }

  &:active {
    transform: scale(0.98);
  }
}

.selection-mode-selected {
  border-color: $color-primary;
  background-color: $color-bg-selected;
  border-width: 2px;
  padding: 9.5px 13.5px; // 抵消边框加粗

  .selection-mode-icon {
    color: $color-primary;
  }

  .selection-mode-label {
    color: $color-primary;
    font-weight: 700;
  }

  .selection-mode-desc {
    color: rgba($color-primary, 0.7);
  }
}

.selection-mode-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-secondary;
  transition: color $transition-fast;
}

.selection-mode-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}

.selection-mode-label {
  font-size: 13px;
  color: $color-text;
  font-weight: 600;
  transition: color $transition-fast;
}

.selection-mode-desc {
  font-size: 11px;
  color: $color-text-tertiary;
  transition: color $transition-fast;
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
