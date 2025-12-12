<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="isOpen"
        class="dialog-overlay"
        :style="{ zIndex: props.zIndex }"
        @click.self="handleOverlayClick"
        @mousemove="handleDrag"
        @mouseup="stopDrag"
        @touchmove="handleDrag"
        @touchend="stopDrag"
      >
        <div class="dialog-container" :class="{ fullscreen: fullscreen }" :style="dialogStyle">
          <q-splitter
            v-if="$slots['left-panel']"
            v-model="splitterModel"
            :limits="[12, 20]"
            separator-class="custom-splitter-separator"
            @update:model-value="handleSplitterChange"
            class="splitter-container"
          >
            <!-- 左侧面板 -->
            <template #before>
              <div class="left-panel">
                <slot name="left-panel"></slot>
              </div>
            </template>

            <!-- 右侧面板 -->
            <template #after>
              <div class="draggable-dialog-card">
                <!-- 对话框标题 -->
                <div
                  class="dialog-header-section draggable-header"
                  :style="{ background: headerBackgroundColor }"
                  @mousedown.prevent="startDrag"
                  @touchstart.prevent="startDrag"
                >
                  <!-- 左侧插槽 -->
                  <div
                    v-if="$slots['header-left']"
                    class="header-left"
                    @mousedown.stop
                    @touchstart.stop
                  >
                    <slot name="header-left"></slot>
                  </div>
                  <!-- 标题 -->
                  <div class="text-h6" :class="titleAlignClass">{{ title }}</div>
                  <!-- 右侧插槽 -->
                  <div
                    v-if="$slots['header-right']"
                    class="header-right"
                    @mousedown.stop
                    @touchstart.stop
                  >
                    <slot name="header-right"></slot>
                  </div>
                  <!-- 关闭按钮 -->
                  <button class="close-btn" @click="handleClose" @mousedown.stop @touchstart.stop>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>

                <!-- 主内容 -->
                <div
                  class="dialog-content-section"
                  :class="{ 'dialog-content-rounded': fullscreen }"
                >
                  <slot></slot>
                </div>

                <!-- 底部操作按钮区域 -->
                <div v-if="showFooter" class="dialog-footer-section">
                  <!-- 取消按钮 -->
                  <CommonActionButton
                    :label="cancelText"
                    size="mdCompact"
                    variant="ghost"
                    @click="emit('cancel')"
                  />
                  <!-- 确定按钮 -->
                  <CommonActionButton
                    :label="confirmText"
                    size="mdCompact"
                    :variant="confirmVariant"
                    :disabled="confirmDisabled"
                    @click="emit('confirm')"
                  />
                </div>

                <!-- 调整大小把手 -->
                <div
                  v-if="!props.autoSize"
                  class="resize-handle"
                  @mousedown.prevent.stop="startResize"
                  @touchstart.prevent.stop="startResize"
                ></div>
              </div>
            </template>
          </q-splitter>

          <!-- 无左侧面板时的主内容 -->
          <div v-else class="draggable-dialog-card">
            <!-- 非全屏：显示标题栏 -->
            <div
              v-if="!fullscreen"
              class="dialog-header-section draggable-header"
              :style="{ background: headerBackgroundColor }"
              @mousedown.prevent="startDrag"
              @touchstart.prevent="startDrag"
            >
              <!-- 标题左侧插槽 -->
              <div
                v-if="$slots['header-left']"
                class="header-left"
                @mousedown.stop
                @touchstart.stop
              >
                <slot name="header-left"></slot>
              </div>
              <!-- 标题 -->
              <div class="text-h6" :class="titleAlignClass">{{ title }}</div>
              <!-- 标题右侧插槽 -->
              <div
                v-if="$slots['header-right']"
                class="header-right"
                @mousedown.stop
                @touchstart.stop
              >
                <slot name="header-right"></slot>
              </div>
              <!-- 关闭按钮 -->
              <button class="close-btn" @click="handleClose" @mousedown.stop @touchstart.stop>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- 全屏：只显示右上角悬浮关闭按钮（左：大小切换，右：关闭） -->
            <div v-else class="fullscreen-top-buttons">
              <!-- 左侧：大小切换按钮 -->
              <img
                src="icons/Switcher.svg"
                alt="toggle size"
                class="switcher-btn"
                @click.stop="handleToggleFullscreen"
              />

              <!-- 右侧：关闭按钮 -->
              <img src="icons/close.svg" alt="close" class="close-btn" @click.stop="handleClose" />
            </div>

            <!-- 内容区域 -->
            <div class="dialog-content-section" :class="{ 'dialog-content-rounded': fullscreen }">
              <slot></slot>
            </div>

            <!-- 底部操作按钮区域 -->
            <div v-if="showFooter" class="dialog-footer-section">
              <!-- 取消按钮 -->
              <CommonActionButton
                :label="cancelText"
                size="mdCompact"
                variant="ghost"
                @click="emit('cancel')"
              />
              <!-- 确定按钮 -->
              <CommonActionButton
                :label="confirmText"
                size="mdCompact"
                :variant="confirmVariant"
                :disabled="confirmDisabled"
                @click="emit('confirm')"
              />
            </div>
            <!-- 调整大小把手 -->
            <div
              v-if="!props.autoSize"
              class="resize-handle"
              @mousedown.prevent.stop="startResize"
              @touchstart.prevent.stop="startResize"
            ></div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import CommonActionButton from './CommonActionButton.vue'

interface Props {
  modelValue: boolean
  title: string
  initialWidth?: number
  initialHeight?: number
  minWidth?: number
  minHeight?: number
  autoSize?: boolean
  titleAlign?: 'left' | 'center'
  headerBackgroundColor?: string
  titleFontSize?: string | number
  fullscreen?: boolean
  closeOnOverlayClick?: boolean
  showFooter?: boolean // 是否显示底部操作按钮区域
  confirmText?: string // 确定按钮文本
  cancelText?: string // 取消按钮文本
  confirmDisabled?: boolean // 确定按钮是否禁用
  confirmVariant?: 'primary' | 'danger' // 确认按钮样式：普通 / 删除
  zIndex?: number // 遮罩层 z-index，默认 9000
}

const props = withDefaults(defineProps<Props>(), {
  initialWidth: 800,
  initialHeight: 600,
  minWidth: 400,
  minHeight: 300,
  autoSize: false,
  titleAlign: 'center',
  headerBackgroundColor: '#fafafb',
  titleFontSize: 16,
  fullscreen: false,
  closeOnOverlayClick: true,
  showFooter: false,
  confirmText: '确定',
  cancelText: '取消',
  confirmDisabled: false,
  confirmVariant: 'primary',
  zIndex: 9000,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'splitter-change': [value: number]
  'toggle-fullscreen': []
  confirm: []
  cancel: []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const dialogPosition = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const dialogSize = ref({ width: props.initialWidth, height: props.initialHeight })
const isResizing = ref(false)
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

// 标题对齐样式类
const titleAlignClass = computed(() => {
  return props.titleAlign === 'left' ? 'title-align-left' : 'title-align-center'
})

// 流程：分屏比例（左侧面板占比）
const splitterModel = ref(18)

// 流程：处理分屏比例变化
const handleSplitterChange = (value: number) => {
  emit('splitter-change', value)
}

// 计算对话框样式，拖动或缩放时禁用过渡动画；全屏模式下固定为视口大小
const dialogStyle = computed(() => {
  if (props.fullscreen) {
    return {
      transform: 'translate(0px, 0px)',
      width: '100vw',
      height: '100vh',
      transition: 'none',
    }
  }
  if (props.autoSize) {
    return {
      transform: `translate(${dialogPosition.value.x}px, ${dialogPosition.value.y}px)`,
      width: 'auto',
      height: 'auto',
      transition: isDragging.value ? 'none' : 'transform 0.1s ease-out',
    }
  }
  return {
    transform: `translate(${dialogPosition.value.x}px, ${dialogPosition.value.y}px)`,
    width: `${dialogSize.value.width}px`,
    height: `${dialogSize.value.height}px`,
    transition: isDragging.value || isResizing.value ? 'none' : 'transform 0.1s ease-out',
  }
})

const startDrag = (event: MouseEvent | TouchEvent) => {
  if (props.fullscreen) return
  isDragging.value = true

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

  dragOffset.value = {
    x: clientX - dialogPosition.value.x,
    y: clientY - dialogPosition.value.y,
  }
}

const handleDrag = (event: MouseEvent | TouchEvent) => {
  if (isDragging.value) {
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

    dialogPosition.value = {
      x: clientX - dragOffset.value.x,
      y: clientY - dragOffset.value.y,
    }
  } else if (isResizing.value) {
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

    const deltaX = clientX - resizeStart.value.x
    const deltaY = clientY - resizeStart.value.y

    const newWidth = Math.max(props.minWidth, resizeStart.value.width + deltaX)
    const newHeight = Math.max(props.minHeight, resizeStart.value.height + deltaY)

    dialogSize.value = {
      width: Math.min(newWidth, window.innerWidth * 0.9),
      height: Math.min(newHeight, window.innerHeight * 0.9),
    }
  }
}

const stopDrag = () => {
  isDragging.value = false
  isResizing.value = false
}

const startResize = (event: MouseEvent | TouchEvent) => {
  if (props.fullscreen) return
  isResizing.value = true

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

  resizeStart.value = {
    x: clientX,
    y: clientY,
    width: dialogSize.value.width,
    height: dialogSize.value.height,
  }
}

const handleClose = () => {
  isOpen.value = false
}

const handleToggleFullscreen = () => {
  // 通知父组件执行全屏 / 非全屏大小切换
  emit('toggle-fullscreen')
}

const handleOverlayClick = () => {
  // 点击遮罩层关闭对话框，受 closeOnOverlayClick 控制
  if (!props.closeOnOverlayClick) return
  handleClose()
}

watch(isOpen, (newValue) => {
  if (newValue) {
    dialogSize.value = { width: props.initialWidth, height: props.initialHeight }
    dialogPosition.value = { x: 0, y: 0 }
    // 锁定 body 滚动
    document.body.style.overflow = 'hidden'
  } else {
    // 恢复 body 滚动
    document.body.style.overflow = ''
  }
})
</script>

<style lang="scss" scoped>
/* 遮罩层 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}

/* 对话框进出动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-fade-enter-active .dialog-container,
.dialog-fade-leave-active .dialog-container {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog-container,
.dialog-fade-leave-to .dialog-container {
  transform: scale(0.9) translateY(-20px);
  opacity: 0;
}

/* 对话框容器 */
.dialog-container {
  max-width: 90vw;
  max-height: 90vh;
  position: relative;
  border-radius: 16px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0 10px 40px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.dialog-container.fullscreen {
  max-width: 100vw;
  max-height: 100vh;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
  box-shadow: none;
}

/* 分屏容器 */
.splitter-container {
  width: 100%;
  height: 100%;
  background: transparent;

  :deep(.q-splitter__panel) {
    overflow: visible;
  }

  :deep(.q-splitter__before) {
    overflow: visible;
  }

  :deep(.q-splitter__after) {
    overflow: visible;
  }
}

/* 自定义分隔条样式 */
:deep(.custom-splitter-separator) {
  background: #e8e8e8;
  width: 1px !important;

  &:hover {
    background: #9059ff;
  }

  .q-splitter__separator-area {
    background: transparent;
  }
}

/* 左侧插槽面板 */
.left-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
}

.draggable-dialog-card {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.7);

  .dialog-header-section {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px 20px;
    position: relative;

    &.draggable-header {
      cursor: move;
      user-select: none;
    }

    .header-left {
      position: absolute;
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .text-h6 {
      font-size: 16px;
      font-weight: 600;
      color: #1e1e1e;
      letter-spacing: -0.01em;
      flex: 1;
      padding: 0 32px;

      &.title-align-center {
        text-align: center;
      }

      &.title-align-left {
        text-align: left;
        padding-left: 0;
        font-size: 18px;
      }
    }

    /* 内容区域通用样式 */
    .dialog-content-section {
      flex: 1;
      padding: 16px 20px;
      background-color: #ffffff;
      color: #333333;
      font-size: 16px;
      line-height: 1.5;
      overflow: auto;
    }

    .close-btn {
      position: absolute;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #6b6b6b;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;

      svg {
        width: 42px;
        height: 42px;
      }

      &:hover {
        background-color: rgba(0, 0, 0, 0.05);
        color: #1e1e1e;
      }

      &:active {
        background-color: rgba(0, 0, 0, 0.1);
        transform: scale(0.95);
      }
    }
  }

  .fullscreen-top-buttons {
    display: flex;
    justify-content: space-between;
    padding: 10px;

    .switcher-btn {
      width: 30px;
      height: 30px;
      border: none;
      background: transparent;
      color: #6b6b6b;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;

      img {
        width: 30px;
        height: 30px;
      }
    }

    .close-btn {
      width: 30px;
      height: 30px;
      border: none;
      background: transparent;
      color: #6b6b6b;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;

      img {
        width: 30px;
        height: 30px;
      }
    }
  }

  .dialog-content-section {
    flex: 1;
    padding: 0;
    overflow: auto;
    -ms-overflow-style: none;
    scrollbar-width: none;
    display: flex;
    flex-direction: column;
    background: #ffffff;
  }

  // 全屏状态下，内容区域顶部圆角（左上 / 右上）
  .dialog-content-rounded {
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    overflow: hidden;
    border: 1px solid #452626;
  }

  .resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 24px;
    height: 24px;
    cursor: nwse-resize;
    z-index: 10;

    &::after {
      content: '';
      position: absolute;
      bottom: 6px;
      right: 6px;
      width: 12px;
      height: 12px;
      border-right: 2px solid #d1d1d1;
      border-bottom: 2px solid #d1d1d1;
      border-radius: 0 0 2px 0;
      transition: border-color 0.2s ease;
    }

    &:hover::after {
      border-color: #6b6b6b;
    }
  }
}

/* Excalidraw 风格的滚动条 */
.dialog-content-section::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.dialog-content-section::-webkit-scrollbar-track {
  background: transparent;
}

.dialog-content-section::-webkit-scrollbar-thumb {
  background: transparent;
}

/* 底部操作按钮区域样式（复用 ScreenshotInputDialog 样式） */
.dialog-footer-section {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
  padding: 16px 20px;
  background: #ffffff;

  /* 按钮基础样式 */
  :deep(.cancel-btn),
  :deep(.confirm-btn) {
    min-width: 90px;
    width: 90px;
    height: 43px;
    border-radius: 12px;
    font-weight: 500;
    border: none;
    outline: none;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  :deep(.confirm-btn) {
    background-color: #6e55ff;
    color: #ffffff;

    &:hover:not(:disabled) {
      background-color: #5a4abd;
    }

    &:disabled {
      background-color: #a6aaf4;
      color: #ffffff;
      cursor: not-allowed;
    }
  }

  :deep(.cancel-btn) {
    background-color: #ffffff;
    color: #6e55ff;
    border: 1px solid #6e55ff;

    &:hover {
      background-color: #f3e8ff;
    }
  }
}
</style>

