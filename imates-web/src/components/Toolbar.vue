<template>
  <div class="toolbar-container">
    <!-- 合并的工具栏 -->
    <div class="unified-toolbar">
      <div class="toolbar-content">
        <!-- 左侧：顶部工具栏内容 -->
        <div class="left-section">
          <q-btn flat round dense icon="arrow_back" @click="goBack" />
        </div>
        <!-- 中间：功能工具栏内容 -->
        <div class="center-section">
          <!-- 工具选择和配置 -->
          <div class="tool-section">
            <div class="tool-buttons">
              <div
                v-for="tool in toolOptions"
                :key="tool.value"
                class="tool-icon-wrapper"
              >
                <img
                  :src="getToolIcon(tool.value)"
                  :class="getToolClass(tool.value)"
                  class="tool-icon"
                  @click="setSelectedTool(tool.value)"
                />
              </div>
              
              <!-- 弹出图标 -->
              <div class="popup-icon-wrapper">
                <img
                  :src="getPopupIconSrc()"
                  :class="getPopupIconClass()"
                  class="popup-icon"
                  @click="togglePopupIcon"
                />
                
                <!-- 自定义弹出气泡框 -->
                <div
                  v-if="showPopup"
                  class="custom-popup"
                  :style="getPopupStyle()"
                >
                  <div class="popup-content">
                    <!-- 高亮笔配置 -->
                    <div v-if="selectedTool === 'highlighter'" class="config-popup">
                      <!-- 颜色配置 -->
                      <div class="config-section">
                        <div class="section-header">
                          <span class="section-title">颜色</span>
                          <q-btn
                            flat
                            round
                            dense
                            size="sm"
                            @click="resetHighlighterColor"
                            class="reset-button"
                          >
                            <img src="/icons/reset.svg" alt="重置" class="reset-icon" />
                          </q-btn>
                        </div>
                        <div class="color-options">
                          <div
                            v-for="color in highlighterColors"
                            :key="color.value"
                            :class="['color-option', { 'color-selected': drawingConfig.highlighterColor === color.value }]"
                            :style="{ backgroundColor: color.value }"
                            @click="updateDrawingConfig({ highlighterColor: color.value })"
                          />
                        </div>
                      </div>
                      
                      <!-- 粗细配置 -->
                      <div class="config-section">
                        <div class="section-header">
                          <span class="section-title">粗细</span>
                        </div>
                        <div class="thickness-slider">
                        <q-slider
                          v-model="drawingConfig.highlighterWidth"
                            :min="0.5"
                            :max="5"
                            :step="0.1"
                            color="primary"
                            class="custom-slider"
                          />
                          <span class="thickness-value">{{ drawingConfig.highlighterWidth.toFixed(1) }}MM</span>
                        </div>
                      </div>
                      
                      <!-- 浓度配置 -->
                      <div class="config-section">
                        <div class="section-header">
                          <span class="section-title">浓度</span>
                        </div>
                        <div class="opacity-slider">
                          <q-slider
                            v-model="drawingConfig.highlighterOpacity"
                            :min="10"
                            :max="100"
                          :step="1"
                          color="primary"
                            class="custom-slider"
                        />
                          <span class="opacity-value">{{ drawingConfig.highlighterOpacity }}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- 画笔配置 -->
                    <div v-else-if="selectedTool === 'pen'" class="config-popup">
                      <!-- 颜色配置 -->
                      <div class="config-section">
                        <div class="section-header">
                          <span class="section-title">颜色</span>
                          <q-btn
                            flat
                            round
                            dense
                            size="sm"
                            @click="resetPenColor"
                            class="reset-button"
                          >
                            <img src="/icons/reset.svg" alt="重置" class="reset-icon" />
                          </q-btn>
                        </div>
                        <div class="color-options">
                          <div
                            v-for="color in penColors"
                            :key="color.value"
                            :class="['color-option', { 'color-selected': drawingConfig.penColor === color.value }]"
                            :style="{ backgroundColor: color.value }"
                            @click="updateDrawingConfig({ penColor: color.value })"
                          />
                        </div>
                      </div>
                      
                      <!-- 粗细配置 -->
                      <div class="config-section">
                        <div class="section-header">
                          <span class="section-title">粗细</span>
                        </div>
                        <!-- 预设粗细按钮 -->
                        <div class="thickness-presets">
                          <div
                            v-for="preset in thicknessPresets"
                            :key="preset.value"
                            :class="['thickness-preset', { 'preset-selected': drawingConfig.penWidth === preset.value }]"
                            @click="updateDrawingConfig({ penWidth: preset.value })"
                          >
                            <div 
                              class="thickness-line"
                              :style="{ 
                                width: preset.value * 2 + 'px',
                                height: preset.value + 'px'
                              }"
                            ></div>
                          </div>
                        </div>
                        <!-- 滑块 -->
                        <div class="thickness-slider">
                        <q-slider
                          v-model="drawingConfig.penWidth"
                            :min="0.5"
                            :max="5"
                            :step="0.1"
                          color="primary"
                            class="custom-slider"
                        />
                          <span class="thickness-value">{{ drawingConfig.penWidth.toFixed(1) }}MM</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- 橡皮擦配置 -->
                    <div v-else-if="selectedTool === 'eraser'" class="config-popup">
                      <!-- 大小配置 -->
                      <div class="config-section">
                        <div class="section-header">
                          <span class="section-title">大小</span>
                        </div>
                        <!-- 预设大小按钮 -->
                        <div class="size-presets">
                          <div
                            v-for="preset in eraserSizePresets"
                            :key="preset.value"
                            :class="['size-preset', { 'preset-selected': drawingConfig.eraserSize === preset.value }]"
                            @click="updateDrawingConfig({ eraserSize: preset.value })"
                          >
                            <img :src="preset.icon" :alt="preset.label" class="eraser-preset-icon" />
                          </div>
                        </div>
                        <!-- 滑块 -->
                        <div class="size-slider">
                          <q-slider
                            v-model="drawingConfig.eraserSize"
                            :min="0.5"
                            :max="5"
                            :step="0.1"
                            color="primary"
                            class="custom-slider"
                          />
                          <span class="size-value">{{ drawingConfig.eraserSize.toFixed(1) }}MM</span>
                        </div>
                      </div>
                      
                      <!-- 擦除模式配置 -->
                      <div class="config-section">
                        <div class="section-header">
                          <span class="section-title">擦除模式</span>
                        </div>
                        <div class="mode-options">
                          <div class="mode-option">
                            <span class="mode-label">像素擦除</span>
                            <q-toggle
                              v-model="isPixelMode"
                              color="primary"
                              @update:model-value="updateEraserMode"
                            />
                          </div>
                          <div class="mode-option">
                            <span class="mode-label">整笔擦除</span>
                            <q-toggle
                              v-model="isStrokeMode"
                              color="primary"
                              @update:model-value="updateEraserMode"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <!-- 整页删除按钮 -->
                      <div class="config-section">
                        <q-btn
                          color="negative"
                          label="整页删除"
                          @click="deleteEntirePage"
                          class="delete-page-btn"
                          size="sm"
                        />
                      </div>
                    </div>
                    
                    <!-- 圈选截图配置 -->
                    <div v-else-if="selectedTool === 'screenshot'" class="config-popup">
                      <!-- 截图模式配置 -->
                      <div class="config-section">
                        <div class="section-header">
                          <span class="section-title">截图模式</span>
                        </div>
                        <div class="mode-options">
                          <div class="mode-option">
                            <span class="mode-label">自定义形状</span>
                            <q-toggle
                              v-model="isCustomShape"
                              color="primary"
                              @update:model-value="updateScreenshotMode"
                            />
                          </div>
                          <div class="mode-option">
                            <span class="mode-label">矩形区域</span>
                            <q-toggle
                              v-model="isRectShape"
                              color="primary"
                              @update:model-value="updateScreenshotMode"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <!-- 截图操作按钮 -->
                      <div class="config-section">
                        <q-btn
                          color="primary"
                          label="开始截图"
                          @click="startScreenshot"
                          class="screenshot-btn"
                          size="sm"
                        />
                        <q-btn
                          color="grey"
                          label="取消截图"
                          @click="cancelScreenshot"
                          class="cancel-btn"
                          size="sm"
                          flat
                        />
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
        <!-- 右侧：对话按钮 -->
        <div class="right-section">
          <q-btn 
            flat 
            round 
            dense 
            icon="chat" 
            @click="toggleChatPanel"
            class="chat-button"
            :class="{ 'chat-button-active': chatPanelVisible }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'

// 定义事件
const emit = defineEmits<{
  'toggle-chat-panel': [visible: boolean]
  'delete-entire-page': []
  'start-screenshot': [mode: string]
  'cancel-screenshot': []
}>()

// 使用 Store
const store = usePdfViewerStore()
const router = useRouter()

// 对话面板状态
const chatPanelVisible = ref(false)

// 弹出气泡框状态
const showPopup = ref(false)
const popupPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })

// 计算属性
const selectedTool = computed({
  get: () => store.selectedTool,
  set: (value) => store.setSelectedTool(value)
})
const drawingConfig = computed(() => store.drawingConfig)

// 工具选项
const toolOptions = computed(() => store.toolOptions)
const highlighterColors = computed(() => store.highlighterColors)
const penColors = computed(() => store.penColors)
// const textColors = computed(() => store.textColors)
// const textSizes = computed(() => store.textSizes)
// const eraserModeOptions = computed(() => store.eraserModeOptions)

// 厚度预设选项
const thicknessPresets = computed(() => [
  { value: 0.5, label: '细' },
  { value: 1.5, label: '中' },
  { value: 3.0, label: '粗' }
])

// 橡皮擦大小预设选项
const eraserSizePresets = computed(() => [
  { value: 0.6, label: '小', icon: '/icons/eraserSmall.svg' },
  { value: 2.0, label: '中', icon: '/icons/eraserMedium.svg' },
  { value: 4.0, label: '大', icon: '/icons/eraserLarge.svg' }
])

// 橡皮擦模式状态
const isPixelMode = computed({
  get: () => drawingConfig.value.eraserMode === 'pixel',
  set: (value) => {
    if (value) {
      updateDrawingConfig({ eraserMode: 'pixel' })
    }
  }
})

const isStrokeMode = computed({
  get: () => drawingConfig.value.eraserMode === 'stroke',
  set: (value) => {
    if (value) {
      updateDrawingConfig({ eraserMode: 'stroke' })
    }
  }
})

// 截图模式状态
const screenshotMode = ref('custom') // 默认自定义形状

// 圈选截图模式状态
const isCustomShape = computed({
  get: () => screenshotMode.value === 'custom',
  set: (value) => {
    if (value) {
      screenshotMode.value = 'custom'
    }
  }
})

const isRectShape = computed({
  get: () => screenshotMode.value === 'rect',
  set: (value) => {
    if (value) {
      screenshotMode.value = 'rect'
    }
  }
})

// 获取教材名称（从路由参数）
// const textbookName = computed(() => {
//   // 这里可以从路由参数或 store 中获取
//   return 'PDF查看器'
// })

// 方法
const goBack = () => {
  router.back()
}

const updateDrawingConfig =  (config: Partial<typeof store.drawingConfig>) => {
  store.updateDrawingConfig(config)
}

// 重置画笔颜色
const resetPenColor = () => {
  store.updateDrawingConfig({ penColor: '#000000' }) // 重置为黑色
}

// 重置荧光笔颜色
const resetHighlighterColor = () => {
  store.updateDrawingConfig({ highlighterColor: '#00FFFF' }) // 重置为青色
}

// 更新橡皮擦模式
const updateEraserMode = () => {
  // 这个方法会在 toggle 的 update:model-value 事件中被调用
  // 实际的模式更新已经在 computed 的 setter 中处理
}

// 整页删除
const deleteEntirePage = () => {
  // 这里可以添加整页删除的逻辑
  console.log('整页删除功能')
  // 可以通过事件向父组件发送删除信号
  emit('delete-entire-page')
}

// 更新截图模式
const updateScreenshotMode = () => {
  // 这个方法会在 toggle 的 update:model-value 事件中被调用
  // 实际的模式更新已经在 computed 的 setter 中处理
}

// 开始截图
const startScreenshot = () => {
  console.log('开始截图，模式:', screenshotMode.value)
  // 通过事件向父组件发送开始截图信号
  emit('start-screenshot', screenshotMode.value)
}

// 取消截图
const cancelScreenshot = () => {
  console.log('取消截图')
  // 通过事件向父组件发送取消截图信号
  emit('cancel-screenshot')
}

const setSelectedTool = (tool: string) => {
  store.setSelectedTool(tool)
}

// 切换弹出图标状态
const togglePopupIcon = () => {
  showPopup.value = !showPopup.value
  if (showPopup.value) {
    // 计算弹出位置
    calculatePopupPosition()
  }
}

// 计算弹出位置
const calculatePopupPosition = () => {
  // 等待DOM更新完成
  nextTick(() => {
    // 获取弹出图标包装器元素
    const popupIconWrapper = document.querySelector('.popup-icon-wrapper') as HTMLElement
    if (!popupIconWrapper) {
      popupPosition.value = { x: 0, y: 0 }
      return
    }
    
    // 获取弹出图标包装器的位置和尺寸
    const rect = popupIconWrapper.getBoundingClientRect()
    
    // 计算弹出框位置
    // x: 弹出图标包装器宽度的一半
    // y: 弹出图标包装器底部 + 8px间距
    const x = rect.width / 2
    const y = rect.height + 8
    
    popupPosition.value = { 
      x: x,
      y: y 
    }
  })
}

// 获取弹出样式
const getPopupStyle = () => {
  return {
    left: `${popupPosition.value.x}px`,
    top: `${popupPosition.value.y}px`
  }
}

// 获取弹出图标源
const getPopupIconSrc = () => {
  const iconMap: Record<string, string> = {
    'highlighter': '/icons/highlightersettingsIcon.svg',
    'pen': '/icons/signaturePensettingsIcon.svg',
    'eraser': '/icons/erasersettingsIcon.svg',
    'screenshot': '/icons/screenshot.svg', // 截图工具没有专门的设置图标，使用原图标
    'select': '/icons/toolBox.svg' // 选择工具没有专门的设置图标，使用原图标
  }
  return iconMap[selectedTool.value] || '/icons/toolBox.svg'
}

// 获取弹出图标样式类
const getPopupIconClass = () => {
  return {
    'cursor-pointer': true,
    'popup-icon-active': showPopup.value
  }
}

// 点击外部关闭弹出框
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  // 检查点击是否在弹出框内部或弹出图标上
  if (target.closest('.custom-popup') || target.closest('.popup-icon')) {
    return // 不关闭弹出框
  }
  // 如果点击在弹出图标包装器上但不是图标本身，也不关闭
  if (target.closest('.popup-icon-wrapper')) {
    return
  }
  // 其他情况关闭弹出框
  showPopup.value = false
}

// 处理触摸事件（包括长按）
const handleTouchOutside = (event: TouchEvent) => {
  const target = event.target as HTMLElement
  // 检查触摸是否在弹出框内部或弹出图标上
  if (target.closest('.custom-popup') || target.closest('.popup-icon')) {
    return // 不关闭弹出框
  }
  // 如果触摸在弹出图标包装器上但不是图标本身，也不关闭
  if (target.closest('.popup-icon-wrapper')) {
    return
  }
  // 其他情况关闭弹出框
  showPopup.value = false
}

// 切换对话面板
const toggleChatPanel = () => {
  chatPanelVisible.value = !chatPanelVisible.value
  // 通过事件向父组件发送切换信号
  emit('toggle-chat-panel', chatPanelVisible.value)
}

// 获取工具图标
const getToolIcon = (toolValue: string) => {
  const iconMap: Record<string, string> = {
    'highlighter': '/icons/highlighter.svg',
    'pen': '/icons/signaturePen.svg',
    'eraser': '/icons/eraser.svg',
    'screenshot': '/icons/screenshot.svg',
    'select': '/icons/toolBox.svg'
  }
  return iconMap[toolValue] || '/icons/toolBox.svg'
}

// 获取工具样式类
const getToolClass = (toolValue: string) => {
  const isSelected = selectedTool.value === toolValue
  return {
    'cursor-pointer': true,
    'tool-icon-selected': isSelected
  }
}

// 生命周期钩子
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('touchstart', handleTouchOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('touchstart', handleTouchOutside)
})

</script>

<style scoped>
.toolbar-container {
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

.chat-button {
  transition: all 0.2s ease;
}

.chat-button-active {
  background-color: rgba(255, 255, 255, 0.2);
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
}

.popup-icon-active {
  background-color: rgba(255, 255, 255, 0.2);
}

.reset-icon {
  width: 36px;
  height: 36px;
}

.eraser-preset-icon {
  width: 18px;
  height: 18px;
}

/* 自定义弹出气泡框样式 */
.custom-popup {
  position: absolute;
  top: 0;
  left: 0;
  transform: translateX(-50%);
  z-index: 1000;
  animation: popupFadeIn 0.2s ease-out;
}

.popup-content {
  background: white;
  border-radius: 4px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12), 0 3px 6px rgba(0, 0, 0, 0.16);
  border: none;
  overflow: hidden;
}

.popup-arrow {
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid white;
  filter: drop-shadow(0 -2px 4px rgba(0, 0, 0, 0.12));
}

@keyframes popupFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.tool-icon-selected {
  background-color: rgba(255, 255, 255, 0.2);
  filter: brightness(1.2);
}



.color-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.selected-color {
  border: 2px solid #1976D2 !important;
  box-shadow: 0 2px 4px rgba(25, 118, 210, 0.3);
}

.config-popup {
  min-width: 240px;
  max-width: 320px;
  padding: 16px;
}

.config-section {
  margin-bottom: 20px;
}

.config-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.87);
  letter-spacing: 0.25px;
}

.reset-button {
  color: rgba(0, 0, 0, 0.6);
  padding: 4px;
}

.reset-button:hover {
  background: rgba(0, 0, 0, 0.04);
}

.color-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  position: relative;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-selected {
  border-color: #1976D2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.thickness-presets {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.thickness-preset {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.thickness-preset:hover {
  background: rgba(0, 0, 0, 0.08);
}

.preset-selected {
  background: rgba(25, 118, 210, 0.1);
  border-color: #1976D2;
}

.thickness-line {
  background: #1976D2;
  border-radius: 1px;
}

.thickness-slider {
  display: flex;
  align-items: center;
  gap: 12px;
}

.custom-slider {
  flex: 1;
}

.thickness-value {
  font-size: 14px;
  color: #1976D2;
  font-weight: 500;
  min-width: 50px;
  text-align: right;
  letter-spacing: 0.25px;
}

.opacity-slider {
  display: flex;
  align-items: center;
  gap: 12px;
}

.opacity-value {
  font-size: 14px;
  color: #1976D2;
  font-weight: 500;
  min-width: 50px;
  text-align: right;
  letter-spacing: 0.25px;
}

.size-presets {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.size-preset {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.size-preset:hover {
  background: rgba(0, 0, 0, 0.08);
}

.preset-selected {
  background: rgba(25, 118, 210, 0.1);
  border-color: #1976D2;
}


.size-slider {
  display: flex;
  align-items: center;
  gap: 12px;
}

.size-value {
  font-size: 14px;
  color: #1976D2;
  font-weight: 500;
  min-width: 50px;
  text-align: right;
  letter-spacing: 0.25px;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mode-label {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.87);
  font-weight: 400;
  letter-spacing: 0.25px;
}

.delete-page-btn {
  width: 100%;
  margin-top: 8px;
}

.screenshot-btn {
  width: 100%;
  margin-bottom: 8px;
}

.cancel-btn {
  width: 100%;
}

/* 保留原有的通用样式 */
.config-title {
  font-size: 16px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.87);
  margin-bottom: 16px;
  text-align: left;
  letter-spacing: 0.15px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 8px 0;
}

.config-item:last-child {
  margin-bottom: 0;
}

.config-label {
  font-size: 14px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.6);
  min-width: 48px;
  white-space: nowrap;
  letter-spacing: 0.25px;
}

.config-value {
  font-size: 14px;
  color: #1976D2;
  font-weight: 500;
  min-width: 40px;
  text-align: right;
  letter-spacing: 0.25px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .toolbar-content {
    padding: 8px 12px;
    min-height: 56px;
  }
  
  .left-section {
    gap: 8px;
  }
  
  .center-section {
    gap: 8px;
  }
  
  .tool-section {
    gap: 4px;
  }
  
  .tool-buttons {
    gap: 2px;
  }
  
  .tool-icon {
    padding: 6px;
    width: 45px;
    height: 45px;
  }
  
  .popup-icon {
    padding: 6px;
    width: 45px;
    height: 45px;
  }
  
  .reset-icon {
    width: 32px;
    height: 32px;
  }
  
  .eraser-preset-icon {
    width: 16px;
    height: 16px;
  }
  
 
  
  .toolbar-title {
    font-size: 16px;
  }
  
  .config-popup {
    min-width: 200px;
    max-width: 280px;
    padding: 12px;
  }
  
  .config-title {
    font-size: 14px;
    margin-bottom: 12px;
  }
  
  .config-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 12px;
    padding: 4px 0;
  }
  
  .config-label {
    min-width: auto;
    font-size: 13px;
  }
  
  .config-value {
    font-size: 13px;
  }
  
  .config-item .q-slider {
    width: 140px !important;
  }
  
  /* 移动端弹出气泡框调整 */
  .custom-popup {
    top: calc(100% + 4px);
  }
  
  .popup-content {
    border-radius: 6px;
  }
}
</style>
