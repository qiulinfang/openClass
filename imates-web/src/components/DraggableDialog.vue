<template>
  <q-dialog v-model="isOpen" position="standard" seamless persistent @hide="handleClose" >
    <div 
      class="dialog-container" 
      :style="dialogStyle"
      @mousemove="handleDrag"
      @mouseup="stopDrag"
      @touchmove="handleDrag"
      @touchend="stopDrag"
    >
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

        <!-- 主内容卡片 -->
        <template #after>
          <q-card class="draggable-dialog-card">
            <q-card-section 
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
              
              <div 
                class="text-h6" 
                :class="titleAlignClass"
                :style="{ fontSize: typeof props.titleFontSize === 'number' ? `${props.titleFontSize}px` : props.titleFontSize }"
              >{{ title }}</div>
              
              <button 
                class="close-btn"
                @click="handleClose"
                @mousedown.stop
                @touchstart.stop
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </q-card-section>

            <q-card-section class="dialog-content-section">
              <slot></slot>
            </q-card-section>

            <div 
              class="resize-handle"
              @mousedown.prevent.stop="startResize"
              @touchstart.prevent.stop="startResize"
            ></div>
          </q-card>
        </template>
      </q-splitter>

      <!-- 无左侧面板时的主内容 -->
      <q-card 
        v-else
        class="draggable-dialog-card"
      >
        <q-card-section 
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
          
          <div class="text-h6" :class="titleAlignClass">{{ title }}</div>
          
          <button 
            class="close-btn"
            @click="handleClose"
            @mousedown.stop
            @touchstart.stop
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </q-card-section>

        <q-card-section class="dialog-content-section">
          <slot></slot>
        </q-card-section>

        <div 
          class="resize-handle"
          @mousedown.prevent.stop="startResize"
          @touchstart.prevent.stop="startResize"
        ></div>
      </q-card>
    </div>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  modelValue: boolean
  title: string
  initialWidth?: number
  initialHeight?: number
  minWidth?: number
  minHeight?: number
  titleAlign?: 'left' | 'center'
  headerBackgroundColor?: string
  titleFontSize?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  initialWidth: 800,
  initialHeight: 600,
  minWidth: 400,
  minHeight: 300,
  titleAlign: 'center',
  headerBackgroundColor: '#fafafb',
  titleFontSize: 16
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'splitter-change': [value: number]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
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

// 计算对话框样式，拖动或缩放时禁用过渡动画
const dialogStyle = computed(() => ({
  transform: `translate(${dialogPosition.value.x}px, ${dialogPosition.value.y}px)`,
  width: `${dialogSize.value.width}px`,
  height: `${dialogSize.value.height}px`,
  transition: (isDragging.value || isResizing.value) ? 'none' : 'transform 0.1s ease-out'
}))

const startDrag = (event: MouseEvent | TouchEvent) => {
  isDragging.value = true
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  dragOffset.value = {
    x: clientX - dialogPosition.value.x,
    y: clientY - dialogPosition.value.y
  }
}

const handleDrag = (event: MouseEvent | TouchEvent) => {
  if (isDragging.value) {
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
    
    dialogPosition.value = {
      x: clientX - dragOffset.value.x,
      y: clientY - dragOffset.value.y
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
      height: Math.min(newHeight, window.innerHeight * 0.9)
    }
  }
}

const stopDrag = () => {
  isDragging.value = false
  isResizing.value = false
}

const startResize = (event: MouseEvent | TouchEvent) => {
  isResizing.value = true
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  resizeStart.value = {
    x: clientX,
    y: clientY,
    width: dialogSize.value.width,
    height: dialogSize.value.height
  }
}

const handleClose = () => {
  isOpen.value = false
}

watch(isOpen, (newValue) => {
  if (newValue) {
    dialogSize.value = { width: props.initialWidth, height: props.initialHeight }
    dialogPosition.value = { x: 0, y: 0 }
  }
})
</script>

<style lang="scss" scoped>
/* 对话框容器 */
.dialog-container {
  max-width: 90vw;
  max-height: 90vh;
  position: relative;
  border-radius: 16px;
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 10px 40px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
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
  background: #ffffff;
  
  .dialog-header-section {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e8e8e8;
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
      }
    }
    
    .close-btn {
      position: absolute;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #6b6b6b;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;
      
      svg {
        width: 20px;
        height: 20px;
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
  
  .dialog-content-section {
    flex: 1;
    padding: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    background: #ffffff;
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
  width: 8px;
  height: 8px;
}

.dialog-content-section::-webkit-scrollbar-track {
  background: transparent;
}

.dialog-content-section::-webkit-scrollbar-thumb {
  background: #d1d1d1;
  border-radius: 4px;
  
  &:hover {
    background: #b1b1b1;
  }
}
</style>

