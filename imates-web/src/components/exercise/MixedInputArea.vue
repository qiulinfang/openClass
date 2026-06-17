<template>
  <div class="mixed-input-area" :class="[`type-${questionType}`, { 'is-disabled': disabled }]">
    <div class="input-label" v-if="label">{{ label }}</div>

    <div class="mixed-input-container">
      <!-- 悬浮工具栏 (手写模式下显示) -->
      <div class="floating-toolbar" v-if="!disabled && currentType === 'drawing'">
        <button class="toolbar-btn" @click="handleUndo" :disabled="!canUndo" title="撤销">
          <div class="icon-mask" style="mask-image: url('/icons/undo.svg'); -webkit-mask-image: url('/icons/undo.svg');"></div>
        </button>
        <button class="toolbar-btn" @click="handleRedo" :disabled="!canRedo" title="重做">
          <div class="icon-mask" style="mask-image: url('/icons/redo.svg'); -webkit-mask-image: url('/icons/redo.svg');"></div>
        </button>
        <button class="toolbar-btn has-options" :class="{ active: currentTool === 'draw' }" @click="selectTool('draw')" title="画笔">
          <div class="icon-mask" style="mask-image: url('/icons/signaturePen.svg'); -webkit-mask-image: url('/icons/signaturePen.svg');"></div>
        </button>
        <button class="toolbar-btn has-options" :class="{ active: currentTool === 'eraser-stroke' }" @click="selectTool('eraser-stroke')" title="橡皮">
          <div class="icon-mask" style="mask-image: url('/icons/eraser.svg'); -webkit-mask-image: url('/icons/eraser.svg');"></div>
        </button>
        <button class="toolbar-btn" @click="toggleHeight" title="调整高度">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M12 8v8" />
            <path d="m9 11 3-3 3 3" />
            <path d="m9 13 3 3 3-3" />
          </svg>
        </button>
        <button class="toolbar-btn text-red" @click="handleClear" title="清空">
          <div class="icon-mask" style="mask-image: url('/icons/delete.svg'); -webkit-mask-image: url('/icons/delete.svg');"></div>
        </button>
        <button class="toolbar-btn camera-btn" @click="switchType('photo')" title="拍照上传">
          <div class="icon-mask" style="mask-image: url('/icons/camera.svg'); -webkit-mask-image: url('/icons/camera.svg');"></div>
        </button>
      </div>

      <!-- 悬浮工具栏 (照片模式下显示，用来切换回手写) -->
      <div class="floating-toolbar" v-if="!disabled && currentType === 'photo'">
        <button class="toolbar-btn text-red" @click="handleClear" v-if="photoUrl" title="删除照片">
          <div class="icon-mask" style="mask-image: url('/icons/delete.svg'); -webkit-mask-image: url('/icons/delete.svg');"></div>
        </button>
        <button class="toolbar-btn active" @click="switchType('drawing')" title="切换回手写">
          <div class="icon-mask" style="mask-image: url('/icons/signaturePen.svg'); -webkit-mask-image: url('/icons/signaturePen.svg');"></div>
        </button>
      </div>

      <div class="mixed-input-body">
        <Transition name="mode-fade" mode="out-in">
          <!-- 画板输入 -->
          <div v-if="currentType === 'drawing'" key="drawing" class="drawing-board-wrapper" :style="{ height: boardHeight }">
            <DrawingBoardNew
              ref="drawingBoardRef"
              :showGrid="false"
              :show-toolbar="false"
              :disabled="disabled"
              :show-zoom-controls="false"
              :show-debug-panel="false"
              :initial-zoom="100"
              :min-zoom="1"
              :max-zoom="1"
              :allow-zoom="false"
              :allow-pan="false"
              @save="handleBoardSave"
            />
          </div>

          <!-- 照片上传 -->
          <div v-else key="photo" class="photo-input-wrapper" :class="{ 'is-disabled': disabled }" :style="{ minHeight: props.questionType === 'subjective' ? '400px' : '120px' }">
            <div v-if="photoUrl" class="uploaded-photo-container">
              <img :src="photoUrl" alt="作答照片" class="uploaded-photo-img" />
            </div>
            <div v-else class="upload-placeholder" @click="handleUploadPhoto" :class="{ disabled }">
              <svg class="camera-icon" xmlns="http://www.w3.org/2000/svg" height="36" viewBox="0 -960 960 960" width="36" fill="#94a3b8"><path d="M480-280q67 0 113.5-46.5T640-440q0-67-46.5-113.5T480-600q-67 0-113.5 46.5T320-440q0 67 46.5 113.5T480-280Zm0-80q-33 0-56.5-23.5T400-440q0-33 23.5-56.5T480-520q33 0 56.5 23.5T560-440q0 33-23.5 56.5T480-360ZM160-160q-33 0-56.5-23.5T80-240v-400q0-33 23.5-56.5T160-720h114l66-80h280l66 80h114q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H656l-66-80H370l-66 80H160v400Zm320-200Z"/></svg>
              <div class="upload-text">点击上传一张作答照片</div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, type ComponentPublicInstance } from 'vue'
import DrawingBoardNew from '../drawing/drawingBoardNew.vue'
import Textarea from '@/components/base/Textarea.vue'
import Button from '@/components/base/Button.vue'
import { useImagePicker } from '@/composables/useImagePicker'
import { showMessage } from '@/utils'
import { ConfirmDialog } from '@/services/business/dialog-service'
import type { StructuredAnswerItem } from '@/types/exercise'

interface Props {
  modelValue?: StructuredAnswerItem
  questionType?: 'fill' | 'subjective'
  label?: string
  placeholder?: string
  disabled?: boolean
  rows?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  questionType: 'fill',
  disabled: false,
  rows: 3
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: StructuredAnswerItem): void
  (e: 'change', value: StructuredAnswerItem): void
  (e: 'focus'): void
  (e: 'blur'): void
  }>()

const drawingBoardRef = ref<ComponentPublicInstance & { loadData: (data: unknown) => void; saveData: () => any; clearAll: () => void; exportToJpg?: (quality?: number) => string; handleToolbarToolChange: (tool: string) => void; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } | null>(null)
const currentType = ref<'drawing' | 'photo'>('drawing')
const photoUrl = ref('')

const canUndo = ref(false)
const canRedo = ref(false)
const currentTool = ref('draw')
const isExpanded = ref(false)

const boardHeight = computed(() => {
  if (isExpanded.value) {
    return '420px'
  }
  return props.questionType === 'subjective' ? '400px' : '180px'
})

const updateUndoRedoStates = () => {
  if (drawingBoardRef.value) {
    canUndo.value = drawingBoardRef.value.canUndo || false
    canRedo.value = drawingBoardRef.value.canRedo || false
  }
}

const handleUndo = () => {
  if (drawingBoardRef.value) {
    drawingBoardRef.value.undo()
    updateUndoRedoStates()
  }
}

const handleRedo = () => {
  if (drawingBoardRef.value) {
    drawingBoardRef.value.redo()
    updateUndoRedoStates()
  }
}

const selectTool = (tool: string) => {
  currentTool.value = tool
  if (drawingBoardRef.value) {
    drawingBoardRef.value.handleToolbarToolChange(tool)
  }
}

const toggleHeight = () => {
  isExpanded.value = !isExpanded.value
}

watch(() => drawingBoardRef.value, () => {
  if (drawingBoardRef.value) {
    updateUndoRedoStates()
  }
})

// 全局图片选择器
const { pickImage } = useImagePicker()

// 解析数据并初始化模式
const initFromValue = (val: StructuredAnswerItem | undefined) => {
  if (!val) {
    currentType.value = 'drawing'
    photoUrl.value = ''
    return
  }

  if (val.type === 'photo') {
    currentType.value = 'photo'
    photoUrl.value = val.photoUrl || ''
  } else {
    currentType.value = 'drawing'
    photoUrl.value = ''
  }
}

onMounted(() => {
  initFromValue(props.modelValue)
  // 画板数据加载
  if (currentType.value === 'drawing' && drawingBoardRef.value) {
    const data = props.modelValue?.boardData
    if (data) {
      drawingBoardRef.value.loadData(data)
    }
  }
})

watch(() => props.modelValue, (newVal) => {
  if (currentType.value === 'drawing' && drawingBoardRef.value) {
    const data = newVal?.boardData

    if (data) {
      const currentData = drawingBoardRef.value.saveData()
      if (JSON.stringify(currentData) !== JSON.stringify(data)) {
        drawingBoardRef.value.loadData(data)
      }
    }
  } else if (currentType.value === 'photo') {
    const incomingUrl = newVal?.photoUrl || ''
    if (photoUrl.value !== incomingUrl) {
      photoUrl.value = incomingUrl
    }
  }
}, { deep: true })

const hasContent = (): boolean => {
  if (currentType.value === 'drawing') {
    const currentData = drawingBoardRef.value?.saveData() as any
    const objects = currentData?.objects
    return Array.isArray(objects) && objects.length > 0
  } else if (currentType.value === 'photo') {
    return !!photoUrl.value
  }
  return false
}

const performSwitch = (type: 'drawing' | 'photo') => {
  const prevType = currentType.value
  currentType.value = type

  // 方案 2：彻底清除画板实例状态
  if (prevType === 'drawing' && drawingBoardRef.value) {
    drawingBoardRef.value.clearAll()
  }
  
  // 互斥逻辑：切换时，清空其他作答方式的数据并立即保存
  if (type === 'drawing') {
    photoUrl.value = ''
    const currentData = { objects: [], history: [[]], historyIndex: 0 }
    handleBoardSave(currentData)
  } else if (type === 'photo') {
    handlePhotoSave(photoUrl.value)
  }
}

const switchType = (type: 'drawing' | 'photo') => {
  if (props.disabled || currentType.value === type) return

  // 方案 1：防误触二次确认
  if (hasContent()) {
    ConfirmDialog({
      title: '确认切换',
      message: '切换作答方式将清空当前已写内容，确认切换吗？'
    }).onOk(() => {
      performSwitch(type)
    })
  } else {
    performSwitch(type)
  }
}

const handleBoardSave = (boardData: any) => {
  updateUndoRedoStates()
  const boardImg = drawingBoardRef.value?.exportToJpg?.(0.9) || undefined
  const newValue: StructuredAnswerItem = {
    type: 'board',
    boardData,
    boardImg
  }
  emit('update:modelValue', newValue)
  emit('change', newValue)
}

const handleUploadPhoto = async () => {
  if (props.disabled) return
  try {
    const imageInfo = await pickImage()
    if (!imageInfo) return
    
    if (imageInfo.base64DataUrl) {
      photoUrl.value = imageInfo.base64DataUrl
      handlePhotoSave(photoUrl.value)
    } else {
      showMessage('选择图片失败，请重试', 'error')
    }
  } catch (error) {
    console.error('选择图片失败:', error)
    showMessage('选择图片失败，请重试', 'error')
  }
}

const handlePhotoSave = (url: string) => {
  const newValue: StructuredAnswerItem = {
    type: 'photo',
    photoUrl: url
  }
  emit('update:modelValue', newValue)
  emit('change', newValue)
}

const handleRemovePhoto = () => {
  if (props.disabled) return
  photoUrl.value = ''
  handlePhotoSave('')
}

const handleClear = () => {
  if (currentType.value === 'drawing') {
    drawingBoardRef.value?.clearAll()
    handleBoardSave({ objects: [], history: [[]], historyIndex: 0 })
  } else if (currentType.value === 'photo') {
    handleRemovePhoto()
  }
}

defineExpose({
  clear: handleClear,
  getDrawingBoard: () => drawingBoardRef.value
})
</script>

<style scoped lang="scss">
.mixed-input-area {
  background: transparent;
  border: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-label {
  font-size: 16px;
  font-weight: 500;
  color: #1e293b;
  line-height: 1.6;
}

.mixed-input-container {
  position: relative;
  border: 1.5px solid #cbd5e1;
  border-radius: 16px;
  background: #ffffff;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: #6e55ff;
  }
}

.floating-toolbar {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 16px;
  background: transparent;
  padding: 0;
  border-radius: 0;
  box-shadow: none;
  border: none;
}

.toolbar-btn {
  background: transparent;
  border: none;
  padding: 0;
  outline: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #334155;
  transition: all 0.2s ease;
  width: 36px;
  height: 36px;
  position: relative;

  &:hover:not(:disabled) {
    color: #0f172a;
    background: rgba(0, 0, 0, 0.04);
  }

  &.active {
    color: #6e55ff;
    background: rgba(110, 85, 255, 0.08);
  }

  &.camera-btn {
    background: #6e55ff;
    color: #ffffff;
    border-radius: 8px;
    &:hover:not(:disabled) {
      background: #5b44e6;
      color: #ffffff;
    }
  }

  &.text-red {
    color: #ff5b5b;
    &:hover:not(:disabled) {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.05);
    }
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.25;
  }

  .icon-mask {
    width: 24px;
    height: 24px;
    background-color: currentColor;
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
    -webkit-mask-size: contain;
  }

  &.has-options::after {
    content: '';
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 0;
    height: 0;
    border-bottom: 4px solid #cbd5e1;
    border-left: 4px solid transparent;
  }
}

.mixed-input-body {
  width: 100%;
}

.drawing-board-wrapper {
  border: none;
  border-radius: 0;
  overflow: hidden;
  background: #fff;
}

.is-disabled {
  .drawing-board-wrapper {
    background: #f8fafc;
  }
}

.photo-input-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  border: none;
  border-radius: 0;
  background: #f8fafc;
  overflow: hidden;
  position: relative;
  transition: all 0.2s ease;
  width: 100%;
  
  .uploaded-photo-container {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #ffffff;
    
    .uploaded-photo-img {
      max-width: 100%;
      max-height: 380px;
      object-fit: contain;
    }
    
    .photo-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.4);
      padding: 2px;
      border-radius: 50%;
    }
  }
  
  .upload-placeholder {
    width: 100%;
    min-height: 120px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    padding: 16px;
    transition: transform 0.2s ease;
    
    &:hover:not(.disabled) {
      transform: translateY(-2px);
      
      .camera-icon {
        fill: #615efe;
        transform: scale(1.05);
      }
    }
    
    &.disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    
    .camera-icon {
      transition: all 0.2s ease;
    }
  }

  .upload-text {
    margin-top: 8px;
    font-size: 13px;
    color: #64748b;
  }
}

/* 极轻量化硬件加速 Mode 切换动效 */
.mode-fade-enter-active,
.mode-fade-leave-active {
  transition: opacity 0.15s ease;
}

.mode-fade-enter-from,
.mode-fade-leave-to {
  opacity: 0;
}
</style>
