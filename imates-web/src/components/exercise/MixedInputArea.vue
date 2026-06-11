<template>
  <div class="mixed-input-area" :class="[`type-${questionType}`, { 'is-disabled': disabled }]">
    <div class="mixed-input-header">
      <slot name="header-left">
        <div class="input-label" v-if="label">{{ label }}</div>
      </slot>
      <div class="input-controls" v-if="!disabled">
        <div class="input-type-tabs">
          <div 
            class="type-tab" 
            :class="{ active: currentType === 'text' }"
            @click="switchType('text')"
          >键盘</div>
          <div 
            class="type-tab" 
            :class="{ active: currentType === 'drawing' }"
            @click="switchType('drawing')"
          >手写</div>
          <div 
            class="type-tab" 
            :class="{ active: currentType === 'photo' }"
            @click="switchType('photo')"
          >照片</div>
        </div>
        <Button 
          title="清空内容"
          size="sm"
          variant="ghost"
          @click="handleClear"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
          </template>
        </Button>
      </div>
    </div>

    <div class="mixed-input-body">
      <Transition name="mode-fade" mode="out-in">
        <!-- 文本输入 -->
        <div v-if="currentType === 'text'" key="text" class="text-input-wrapper">
          <Textarea
            v-if="isTextArea"
            v-model="textContent"
            :placeholder="placeholder"
            :disabled="disabled"
            :minHeight="240"
            :maxHeight="320"
            @update:modelValue="handleTextUpdate"
            @focus="$emit('focus')"
            @blur="$emit('blur')"
          />
          <input
            v-else
            v-model="textContent"
            class="native-input"
            type="text"
            :placeholder="placeholder"
            :disabled="disabled"
            @input="e => handleTextUpdate((e.target as HTMLInputElement).value)"
            @focus="$emit('focus')"
            @blur="$emit('blur')"
          />
        </div>

        <!-- 画板输入 -->
        <div v-else-if="currentType === 'drawing'" key="drawing" class="drawing-board-wrapper" :style="{ height: boardHeight }">
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
            @save="handleBoardSave"
          />
        </div>

        <!-- 照片上传 -->
        <div v-else key="photo" class="photo-input-wrapper" :class="{ 'is-disabled': disabled }" :style="{ minHeight: props.questionType === 'subjective' ? '300px' : '120px' }">
          <div v-if="photoUrl" class="uploaded-photo-container">
            <img :src="photoUrl" alt="作答照片" class="uploaded-photo-img" />
            <div class="photo-overlay" v-if="!disabled">
              <Button 
                title="删除照片"
                size="xs"
                variant="danger"
                @click="handleRemovePhoto" 
              >
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                </template>
              </Button>
            </div>
          </div>
          <div v-else class="upload-placeholder" @click="handleUploadPhoto" :class="{ disabled }">
            <svg class="camera-icon" xmlns="http://www.w3.org/2000/svg" height="36" viewBox="0 -960 960 960" width="36" fill="#94a3b8"><path d="M480-280q67 0 113.5-46.5T640-440q0-67-46.5-113.5T480-600q-67 0-113.5 46.5T320-440q0 67 46.5 113.5T480-280Zm0-80q-33 0-56.5-23.5T400-440q0-33 23.5-56.5T480-520q33 0 56.5 23.5T560-440q0 33-23.5 56.5T480-360ZM160-160q-33 0-56.5-23.5T80-240v-400q0-33 23.5-56.5T160-720h114l66-80h280l66 80h114q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H656l-66-80H370l-66 80H160v400Zm320-200Z"/></svg>
            <div class="upload-text">点击上传一张作答照片</div>
          </div>
        </div>
      </Transition>
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

interface SubjectiveAnswer {
  type: 'text' | 'board' | 'photo'
  textContent?: string
  boardData?: unknown
  photoUrl?: string
}

type MixedModelValue = string | SubjectiveAnswer

interface Props {
  modelValue?: MixedModelValue
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
  (e: 'update:modelValue', value: MixedModelValue): void
  (e: 'change', value: MixedModelValue): void
  (e: 'focus'): void
  (e: 'blur'): void
  }>()

const drawingBoardRef = ref<ComponentPublicInstance & { loadData: (data: unknown) => void; saveData: () => unknown; clearAll: () => void } | null>(null)
const currentType = ref<'text' | 'drawing' | 'photo'>('text')
const textContent = ref('')
const photoUrl = ref('')

const isTextArea = computed(() => props.questionType === 'subjective')
const boardHeight = computed(() => props.questionType === 'subjective' ? '400px' : '160px')

// 全局图片选择器
const { pickImage } = useImagePicker()

// 解析数据并初始化模式
const initFromValue = (val: MixedModelValue | undefined) => {
  if (!val) {
    currentType.value = 'text'
    textContent.value = ''
    photoUrl.value = ''
    return
  }

  // 填空题
  if (props.questionType === 'fill') {
    const valStr = typeof val === 'string' ? val : ''
    if (valStr.startsWith('{') && valStr.includes('"objects"')) {
      currentType.value = 'drawing'
      photoUrl.value = ''
    } else if (valStr.startsWith('{') && valStr.includes('"type":"photo"')) {
      currentType.value = 'photo'
      try {
        const parsed = JSON.parse(valStr)
        photoUrl.value = parsed.photoUrl || ''
      } catch (e) {
        photoUrl.value = ''
      }
      textContent.value = ''
    } else {
      currentType.value = 'text'
      textContent.value = valStr
      photoUrl.value = ''
    }
  } 
  // 主观题
  else {
    const subVal = val as SubjectiveAnswer
    if (subVal.type === 'board') {
      currentType.value = 'drawing'
      photoUrl.value = ''
    } else if (subVal.type === 'photo') {
      currentType.value = 'photo'
      photoUrl.value = subVal.photoUrl || ''
      textContent.value = ''
    } else {
      currentType.value = 'text'
      textContent.value = subVal.textContent || ''
      photoUrl.value = ''
    }
  }
}

onMounted(() => {
  initFromValue(props.modelValue)
  // 画板数据加载
  if (currentType.value === 'drawing' && drawingBoardRef.value) {
    let data = null
    if (props.questionType === 'fill') {
      const val = typeof props.modelValue === 'string' ? props.modelValue : ''
      if (val && val.startsWith('{') && val.includes('"objects"')) {
        try {
          data = JSON.parse(val)
        } catch (e) {
          console.error('Parse drawing data failed', e)
        }
      }
    } else {
      const subVal = props.modelValue as SubjectiveAnswer | undefined
      data = subVal?.boardData
    }
    
    if (data) {
      drawingBoardRef.value.loadData(data)
    }
  }
})

watch(() => props.modelValue, (newVal) => {
  if (currentType.value === 'drawing' && drawingBoardRef.value) {
    let data = null
    if (props.questionType === 'fill') {
      const val = typeof newVal === 'string' ? newVal : ''
      if (val && val.startsWith('{') && val.includes('"objects"')) {
        try {
          data = JSON.parse(val)
        } catch (e) {
          console.error('Parse drawing data failed', e)
        }
      }
    } else {
      const subVal = newVal as SubjectiveAnswer | undefined
      data = subVal?.boardData
    }

    if (data) {
      const currentData = drawingBoardRef.value.saveData()
      if (JSON.stringify(currentData) !== JSON.stringify(data)) {
        drawingBoardRef.value.loadData(data)
      }
    }
  } else if (currentType.value === 'photo') {
    let incomingUrl = ''
    if (props.questionType === 'fill') {
      const val = typeof newVal === 'string' ? newVal : ''
      if (val && val.startsWith('{') && val.includes('"type":"photo"')) {
        try {
          const parsed = JSON.parse(val)
          incomingUrl = parsed.photoUrl || ''
        } catch (e) {
          incomingUrl = ''
        }
      }
    } else {
      const subVal = newVal as SubjectiveAnswer | undefined
      incomingUrl = subVal?.photoUrl || ''
    }
    if (photoUrl.value !== incomingUrl) {
      photoUrl.value = incomingUrl
    }
  } else if (currentType.value === 'text') {
    let incomingText = ''
    if (props.questionType === 'fill') {
      incomingText = typeof newVal === 'string' ? newVal : ''
    } else {
      const subVal = newVal as SubjectiveAnswer | undefined
      incomingText = subVal?.textContent || ''
    }
    if (textContent.value !== incomingText) {
      textContent.value = incomingText
    }
  }
}, { deep: true })

const hasContent = (): boolean => {
  if (currentType.value === 'text') {
    return textContent.value.trim().length > 0
  } else if (currentType.value === 'drawing') {
    const currentData = drawingBoardRef.value?.saveData() as any
    const objects = currentData?.objects
    return Array.isArray(objects) && objects.length > 0
  } else if (currentType.value === 'photo') {
    return !!photoUrl.value
  }
  return false
}

const performSwitch = (type: 'text' | 'drawing' | 'photo') => {
  const prevType = currentType.value
  currentType.value = type

  // 方案 2：彻底清除画板实例状态
  if (prevType === 'drawing' && drawingBoardRef.value) {
    drawingBoardRef.value.clearAll()
  }
  
  // 互斥逻辑：切换时，清空其他作答方式的数据并立即保存
  if (type === 'text') {
    photoUrl.value = ''
    handleTextUpdate(textContent.value)
  } else if (type === 'drawing') {
    textContent.value = ''
    photoUrl.value = ''
    const currentData = { objects: [], history: [[]], historyIndex: 0 }
    handleBoardSave(currentData)
  } else if (type === 'photo') {
    textContent.value = ''
    handlePhotoSave(photoUrl.value)
  }
}

const switchType = (type: 'text' | 'drawing' | 'photo') => {
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

const handleTextUpdate = (val: string | number | null) => {
  const finalVal = val === null ? '' : String(val)
  if (props.questionType === 'fill') {
    emit('update:modelValue', finalVal)
    emit('change', finalVal)
  } else {
    const newValue: SubjectiveAnswer = {
      type: 'text',
      textContent: finalVal
    }
    emit('update:modelValue', newValue)
    emit('change', newValue)
  }
}

const handleBoardSave = (boardData: unknown) => {
  if (props.questionType === 'fill') {
    const str = JSON.stringify(boardData)
    emit('update:modelValue', str)
    emit('change', str)
  } else {
    const newValue: SubjectiveAnswer = {
      boardData,
      type: 'board'
    }
    emit('update:modelValue', newValue)
    emit('change', newValue)
  }
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
  if (props.questionType === 'fill') {
    const str = url ? JSON.stringify({ type: 'photo', photoUrl: url }) : ''
    emit('update:modelValue', str)
    emit('change', str)
  } else {
    const newValue: SubjectiveAnswer = {
      type: 'photo',
      photoUrl: url
    }
    emit('update:modelValue', newValue)
    emit('change', newValue)
  }
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
  } else {
    textContent.value = ''
    handleTextUpdate('')
  }
}

defineExpose({
  clear: handleClear,
  getDrawingBoard: () => drawingBoardRef.value
})
</script>

<style scoped lang="scss">
.mixed-input-area {
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;

  &.is-active {
    border-color: #615efe;
    box-shadow: 0 0 0 2px rgba(97, 94, 254, 0.1);
  }
}

.mixed-input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.input-label {
  font-weight: 600;
  font-size: 14px;
  color: #334155;
}

.input-controls {
  display: flex;
  align-items: center;
}

.input-type-tabs {
  display: flex;
  background: #e2e8f0;
  padding: 3px;
  border-radius: 8px;
  gap: 2px;

  .type-tab {
    padding: 3px 12px;
    font-size: 13px;
    border-radius: 6px;
    cursor: pointer;
    color: #64748b;
    font-weight: 500;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      color: #334155;
    }

    &:active {
      transform: scale(0.95);
    }

    &.active {
      background: white;
      color: #615efe;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
    }
  }
}

.native-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  background-color: #fff;
  transition: all 0.2s ease;
  outline: none;

  &:focus {
    border-color: #615efe;
    box-shadow: 0 0 0 2px rgba(97, 94, 254, 0.1);
  }

  &:disabled {
    background-color: #f8fafc;
    color: #94a3b8;
    cursor: not-allowed;
  }
}

.native-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  background-color: #fff;
  transition: all 0.2s ease;
  outline: none;
  resize: vertical;
  font-family: inherit;

  &:focus {
    border-color: #615efe;
    box-shadow: 0 0 0 2px rgba(97, 94, 254, 0.1);
  }

  &:disabled {
    background-color: #f8fafc;
    color: #94a3b8;
    cursor: not-allowed;
  }
}

.drawing-board-wrapper {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  
  &:focus-within {
    border-color: #615efe;
  }
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
  border: 1.5px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  overflow: hidden;
  position: relative;
  transition: all 0.2s ease;
  
  &:hover:not(.is-disabled) {
    border-color: #615efe;
    background: #f1f5f9;
  }
  
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
