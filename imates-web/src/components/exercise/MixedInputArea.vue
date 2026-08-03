<template>
  <div
    ref="mixedInputAreaRef"
    class="mixed-input-area"
    :class="[`type-${questionType}`, { 'is-disabled': disabled }]"
    @pointerdown="handleFocus"
  >
    <div class="input-label" v-if="label">{{ label }}</div>

    <div class="mixed-input-container" :class="{ 'is-focused': isFocused }">
      <!-- 悬浮工具栏 -->
      <div class="floating-toolbar" v-if="!disabled && isFocused">
        <button class="toolbar-btn" @click="handleUndo" :disabled="!canUndo" title="撤销">
          <div
            class="icon-mask"
            :style="`mask-image: url(${undoIcon}); -webkit-mask-image: url(${undoIcon});`"
          ></div>
        </button>
        <button class="toolbar-btn" @click="handleRedo" :disabled="!canRedo" title="重做">
          <div
            class="icon-mask"
            :style="`mask-image: url(${redoIcon}); -webkit-mask-image: url(${redoIcon});`"
          ></div>
        </button>
        <button
          class="toolbar-btn has-options"
          :class="{ active: currentTool === 'draw' }"
          @click="selectTool('draw')"
          title="画笔"
        >
          <div
            class="icon-mask"
            :style="`mask-image: url(${currentTool === 'draw' ? signaturePenSelectIcon : signaturePenIcon}); -webkit-mask-image: url(${currentTool === 'draw' ? signaturePenSelectIcon : signaturePenIcon});`"
          ></div>
        </button>
        <button
          class="toolbar-btn has-options"
          :class="{ active: currentTool === 'eraser-stroke' }"
          @click="selectTool('eraser-stroke')"
          title="橡皮"
        >
          <div
            class="icon-mask"
            :style="`mask-image: url(${currentTool === 'eraser-stroke' ? eraserSelectIcon : eraserIcon}); -webkit-mask-image: url(${currentTool === 'eraser-stroke' ? eraserSelectIcon : eraserIcon});`"
          ></div>
        </button>
        <button class="toolbar-btn" @click="toggleHeight" title="调整高度">
          <div
            class="icon-mask"
            :style="`mask-image: url(${lagaoIcon}); -webkit-mask-image: url(${lagaoIcon});`"
          ></div>
        </button>
        <button class="toolbar-btn text-red" @click="handleClear" title="清空">
          <div
            class="icon-mask"
            :style="`mask-image: url(${deleteIcon}); -webkit-mask-image: url(${deleteIcon});`"
          ></div>
        </button>
        <button class="toolbar-btn" @click="handleUploadPhotoToCanvas" title="拍照上传">
          <img :src="cameraIcon" alt="拍照上传" style="width: 24px; height: 24px; display: block" />
        </button>
        <button v-if="photoUrl" class="toolbar-btn" @click="handleRecrop" title="重新裁剪">
          <div
            class="icon-mask"
            :style="`mask-image: url(${cropIcon}); -webkit-mask-image: url(${cropIcon});`"
          ></div>
        </button>
      </div>

      <div class="mixed-input-body">
        <!-- 画板输入 -->
        <div class="drawing-board-wrapper" :style="{ height: boardHeight }">
          <DrawingBoardNew
            ref="drawingBoardRef"
            :showGrid="false"
            :show-toolbar="false"
            :disabled="disabled || !isFocused"
            :show-zoom-controls="false"
            :show-debug-panel="false"
            :initial-zoom="100"
            :min-zoom="1"
            :max-zoom="1"
            :allow-zoom="false"
            :allow-pan="false"
            :backgroundImage="photoUrl"
            :backgroundContain="true"
            @save="handleBoardSave"
            @update-background="handleUpdateBackground"
          />
        </div>
      </div>
    </div>
    <!-- 统一裁剪组件 -->
    <ImageCropOverlay
      v-model="isCropVisible"
      :image-src="cropImageSrc"
      :is-inline="false"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />
    <!-- 清空确认对话框 -->
    <Dialog
      ref="clearDialogRef"
      title="确认清空"
      confirmButtonText="确认"
      cancelButtonText="取消"
      @confirm="confirmClear"
    >
      确定要清空当前输入区域的所有内容（包括手写内容和拍照图片）吗？
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  nextTick,
  type ComponentPublicInstance,
} from 'vue'
import DrawingBoardNew from '../drawing/drawingBoardNew.vue'
import { useImagePicker } from '@/composables/useImagePicker'
import { showMessage } from '@/utils'
import type { StructuredAnswerItem } from '@/types/exercise'
import ImageCropOverlay from '@/components/base/ImageCropper.vue'
import Dialog from '../base/Dialog.vue'
import undoIcon from '/icons/redo.svg'
import redoIcon from '/icons/undo.svg'
import signaturePenIcon from '/icons/signaturePen.svg'
import signaturePenSelectIcon from '/icons/signaturePen_select.svg'
import eraserIcon from '/icons/eraser.svg'
import eraserSelectIcon from '/icons/eraser_select.svg'
import deleteIcon from '/icons/delete.svg'
import cameraIcon from '/icons/camera.svg'
import lagaoIcon from '/icons/lagao.svg'
import cropIcon from '/icons/caijian.svg'

export interface Props {
  modelValue?: StructuredAnswerItem
  questionType?: 'fill' | 'subjective'
  label?: string
  placeholder?: string
  disabled?: boolean
  rows?: number | string
  activeBlankIndex?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  questionType: 'fill',
  disabled: false,
  rows: 3,
  activeBlankIndex: null,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: StructuredAnswerItem): void
  (e: 'change', value: StructuredAnswerItem): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const drawingBoardRef = ref<
  | (ComponentPublicInstance & {
      loadData: (data: unknown) => void
      saveData: () => any
      clearAll: () => void
      clearAllUndoable: () => void
      saveState?: (bgOverride?: string) => void
      exportToJpg?: (quality?: number) => string
      handleToolbarToolChange: (tool: string) => void
      undo: () => void
      redo: () => void
      canUndo: boolean
      canRedo: boolean
      resizeCanvas?: () => void
    })
  | null
>(null)

const clearDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
const photoUrl = ref('')
const originalPhotoUrl = ref('')
const isCropVisible = ref(false)
const cropImageSrc = ref('')

const canUndo = ref(false)
const canRedo = ref(false)
const currentTool = ref('draw')
const addedHeight = ref(0)
const cachedBoardImg = ref<string | undefined>(undefined)
let exportDebounceTimer: number | null = null

const boardHeight = computed(() => {
  const base = props.questionType === 'subjective' ? 400 : 220
  let contentHeight = base
  const boardData = props.modelValue?.boardData
  if (boardData && Array.isArray(boardData.objects)) {
    let maxY = 0
    for (const stroke of boardData.objects) {
      if (stroke.bounds && typeof stroke.bounds.maxY === 'number') {
        maxY = Math.max(maxY, stroke.bounds.maxY)
      } else if (Array.isArray(stroke.points)) {
        for (const pt of stroke.points) {
          if (typeof pt.y === 'number') {
            maxY = Math.max(maxY, pt.y)
          }
        }
      }
    }
    if (maxY > 0) {
      // 包含内容并留有 40px 的安全边距
      contentHeight = Math.max(contentHeight, maxY + 40)
    }
  }
  
  // 如果是已提交/只读状态 (disabled)，自动收缩到包含内容的实际高度（不低于基础高度），消除多余空白
  if (props.disabled) {
    return `${contentHeight}px`
  }
  
  // 编辑状态下，保留用户手动调整的高度和实际内容高度的最大值
  return `${Math.max(base + addedHeight.value, contentHeight)}px`
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
    nextTick(() => {
      if (drawingBoardRef.value) {
        const boardData = drawingBoardRef.value.saveData()
        handleBoardSave(boardData)
      }
    })
  }
}

const handleRedo = () => {
  if (drawingBoardRef.value) {
    drawingBoardRef.value.redo()
    updateUndoRedoStates()
    nextTick(() => {
      if (drawingBoardRef.value) {
        const boardData = drawingBoardRef.value.saveData()
        handleBoardSave(boardData)
      }
    })
  }
}

const handleUpdateBackground = (url: string) => {
  photoUrl.value = url
}

const mixedInputAreaRef = ref<HTMLDivElement | null>(null)
const isFocused = ref(false)
const lastActiveTool = ref('draw')

const selectTool = (tool: string) => {
  currentTool.value = tool
  if (tool) {
    lastActiveTool.value = tool
  }
  if (drawingBoardRef.value) {
    drawingBoardRef.value.handleToolbarToolChange(tool)
  }
}

const handleFocus = () => {
  if (props.disabled) return
  if (!isFocused.value) {
    isFocused.value = true
    emit('focus')
    // 聚焦时恢复上一次选择的工具
    selectTool(lastActiveTool.value)
  }
}

const handleBlur = () => {
  if (isFocused.value) {
    forceSave()
    isFocused.value = false
    emit('blur')
    currentTool.value = '' // 失去焦点，清除当前选中工具状态高亮
  }
}

const toggleHeight = () => {
  addedHeight.value += 150
  if (drawingBoardRef.value) {
    const boardData = drawingBoardRef.value.saveData()
    handleBoardSave(boardData)
  }
}

watch(boardHeight, () => {
  nextTick(() => {
    if (drawingBoardRef.value && typeof drawingBoardRef.value.resizeCanvas === 'function') {
      drawingBoardRef.value.resizeCanvas()
    }
  })
})

watch(
  () => drawingBoardRef.value,
  () => {
    if (drawingBoardRef.value) {
      updateUndoRedoStates()
      if (isFocused.value) {
        selectTool(lastActiveTool.value)
      }
    }
  },
)

// 全局图片选择器
const { pickImage } = useImagePicker()

// 解析数据并初始化
const initFromValue = (val: StructuredAnswerItem | undefined) => {
  photoUrl.value = val?.photoUrl || ''
  originalPhotoUrl.value = val?.originalPhotoUrl || ''
  addedHeight.value = val?.boardHeight || 0
  cachedBoardImg.value = val?.boardImg || undefined
}

onMounted(() => {
  initFromValue(props.modelValue)
  // 画板数据加载
  if (drawingBoardRef.value) {
    const data = props.modelValue?.boardData
    if (data) {
      drawingBoardRef.value.loadData(data)
    }
  }
})

watch(
  [() => props.modelValue, () => props.activeBlankIndex],
  ([newVal]) => {
    const incomingUrl = newVal?.photoUrl || ''
    if (photoUrl.value !== incomingUrl) {
      photoUrl.value = incomingUrl
    }

    const incomingOriginalUrl = newVal?.originalPhotoUrl || ''
    if (originalPhotoUrl.value !== incomingOriginalUrl) {
      originalPhotoUrl.value = incomingOriginalUrl
    }

    const incomingHeight = newVal?.boardHeight || 0
    if (addedHeight.value !== incomingHeight) {
      addedHeight.value = incomingHeight
    }

    const incomingBoardImg = newVal?.boardImg || undefined
    if (cachedBoardImg.value !== incomingBoardImg) {
      cachedBoardImg.value = incomingBoardImg
    }

    if (drawingBoardRef.value) {
      const data = newVal?.boardData
      const currentData = drawingBoardRef.value.saveData()
      const targetData = data || { objects: [], history: [[]], historyIndex: 0 }

      if (JSON.stringify(currentData) !== JSON.stringify(targetData)) {
        drawingBoardRef.value.loadData(targetData)
        if (!data || !Array.isArray(data.objects) || data.objects.length === 0) {
          drawingBoardRef.value.clearAll()
        }
      }
    }
  },
  { deep: true },
)

// 防抖生成并更新导出的 JPG 图片
const debounceExportImage = (boardData: any) => {
  if (exportDebounceTimer) {
    clearTimeout(exportDebounceTimer)
  }
  exportDebounceTimer = window.setTimeout(() => {
    if (drawingBoardRef.value) {
      const boardImg = drawingBoardRef.value.exportToJpg?.(0.9) || undefined
      cachedBoardImg.value = boardImg
      
      const newValue: StructuredAnswerItem = {
        type: 'board',
        boardData,
        boardImg,
        photoUrl: photoUrl.value || undefined,
        originalPhotoUrl: originalPhotoUrl.value || undefined,
        boardHeight: addedHeight.value,
      }
      emit('update:modelValue', newValue)
      emit('change', newValue)
    }
  }, 1000)
}

const handleBoardSave = (boardData: any) => {
  updateUndoRedoStates()
  
  // 立即生成并发送最新状态给父组件 Store，保持受控单向流
  const boardImg = drawingBoardRef.value?.exportToJpg?.(0.9) || cachedBoardImg.value
  cachedBoardImg.value = boardImg

  const newValue: StructuredAnswerItem = {
    type: 'board',
    boardData,
    boardImg,
    photoUrl: photoUrl.value || undefined,
    originalPhotoUrl: originalPhotoUrl.value || undefined,
    boardHeight: addedHeight.value,
  }
  emit('update:modelValue', newValue)
  emit('change', newValue)
}

const handleCropConfirm = async (croppedDataUrl: string) => {
  photoUrl.value = croppedDataUrl
  isCropVisible.value = false
  await nextTick()
  if (drawingBoardRef.value) {
    await drawingBoardRef.value.ensureBackgroundLoaded?.()
    // 保存裁剪状态变化到撤销/重做历史中
    drawingBoardRef.value.saveState?.()
    const currentData = drawingBoardRef.value.saveData()
    handleBoardSave(currentData)
  }
}

const handleCropCancel = () => {
  isCropVisible.value = false
  cropImageSrc.value = ''
}

const handleUploadPhotoToCanvas = async () => {
  if (props.disabled) return
  try {
    const imageInfo = await pickImage()
    if (!imageInfo) return

    if (imageInfo.base64DataUrl) {
      originalPhotoUrl.value = imageInfo.base64DataUrl
      cropImageSrc.value = imageInfo.base64DataUrl
      isCropVisible.value = true
    } else {
      showMessage('选择图片失败，请重试', 'error')
    }
  } catch (error) {
    console.error('选择图片失败:', error)
    showMessage('选择图片失败，请重试', 'error')
  }
}

const handleRecrop = () => {
  if (props.disabled) return
  if (originalPhotoUrl.value) {
    cropImageSrc.value = originalPhotoUrl.value
    isCropVisible.value = true
  } else if (photoUrl.value) {
    cropImageSrc.value = photoUrl.value
    isCropVisible.value = true
  }
}

const handleClear = () => {
  if (props.disabled) return
  const hasStrokes = drawingBoardRef.value && drawingBoardRef.value.saveData().objects.length > 0
  const hasPhoto = !!photoUrl.value

  if (!hasStrokes && !hasPhoto) return

  clearDialogRef.value?.openDialog()
}

const confirmClear = () => {
  clearDialogRef.value?.closeDialog()
  photoUrl.value = ''
  originalPhotoUrl.value = ''
  if (drawingBoardRef.value) {
    drawingBoardRef.value.clearAllUndoable()
  } else {
    handleBoardSave({ objects: [], history: [[]], historyIndex: 0 })
  }
}

const forceSave = () => {
  if (exportDebounceTimer) {
    clearTimeout(exportDebounceTimer)
    exportDebounceTimer = null
  }
  if (drawingBoardRef.value) {
    const boardData = drawingBoardRef.value.saveData()
    cachedBoardImg.value = drawingBoardRef.value.exportToJpg?.(0.9) || undefined
    const newValue: StructuredAnswerItem = {
      type: 'board',
      boardData,
      boardImg: cachedBoardImg.value,
      photoUrl: photoUrl.value || undefined,
      originalPhotoUrl: originalPhotoUrl.value || undefined,
      boardHeight: addedHeight.value,
    }
    emit('update:modelValue', newValue)
    emit('change', newValue)
  }
}

defineExpose({
  clear: handleClear,
  getDrawingBoard: () => drawingBoardRef.value,
  focus: handleFocus,
  blur: handleBlur,
  forceSave,
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
  border: 1.5px solid #d1cfe8;
  border-radius: 16px;
  background: #ffffff;
  overflow: hidden;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &.is-focused {
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
  gap: 8px;
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

  &.active {
    color: #6e55ff;
    background: rgba(110, 85, 255, 0.08);
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
