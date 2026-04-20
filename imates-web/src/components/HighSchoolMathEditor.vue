<template>
  <div class="hsm-container">
    <!-- 主体内容区 -->
    <div class="hsm-body">
      <!-- 左侧：手写区 -->
      <div class="hsm-col hsm-col--handwriting">
        <div class="hsm-canvas-container">
          <HandwritingCanvas
            ref="handwritingRef"
            :line-width="3"
            @change="handleHandwritingChange"
          />
          <div v-if="!hasHandwriting" class="hsm-placeholder">
            写出你想要的公式，右侧就会出现哦
          </div>
          <!-- 手写板工具栏 -->
          <div class="hsm-handwriting-toolbar">
            <button @click="undoHandwriting" :disabled="!canUndoHandwriting" class="toolbar-btn" title="撤销">
              <img :src="undoIcon" alt="撤销" />
            </button>
            <button @click="redoHandwriting" :disabled="!canRedoHandwriting" class="toolbar-btn" title="重做">
              <img :src="redoIcon" alt="重做" />
            </button>
            <button @click="clearHandwriting" class="toolbar-btn toolbar-btn--danger" title="清空">
              <img :src="clearIcon" alt="清空" />
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：识别区 -->
      <div class="hsm-col hsm-col--recognition">
        <div class="hsm-recognition-container">
          <div v-if="!formula && !isRecognizing" class="hsm-placeholder">
            点击你想要的公式就可以啦
          </div>
          <div v-else-if="isRecognizing" class="hsm-loading-state">
             <div class="spinner"></div>
             <span>正在识别中...</span>
          </div>
          <div v-else class="hsm-recognition-content">
            <div ref="previewArea" class="formula-preview"></div>
          </div>
          <div v-if="error" class="hsm-error-msg">
            {{ error }}
          </div>
        </div>
      </div>
    </div>

    <!-- 提示框 -->
    <div v-if="toast" class="hsm-toast">
      {{ toast }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import HandwritingCanvas from './base/HandwritingCanvas.vue'
import { apiService } from '../services/http/api-service'
import undoIcon from '/icons/undo.svg'
import redoIcon from '/icons/redo.svg'
import clearIcon from '/icons/delete.svg'

// Props
interface Props {
  modelValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: ''
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'confirm': [value: string]
  'cancel': []
}>()

// Reactive data
const formula = ref('')
const previewArea = ref<HTMLElement>()
const error = ref<string | null>(null)
const toast = ref('')

// 手写识别相关
const handwritingRef = ref<InstanceType<typeof HandwritingCanvas> | null>(null)
const isRecognizing = ref(false)
const hasHandwriting = ref(false)
const lastHandwritingBase64 = ref<string | null>(null)

// 撤销/重做状态
const canUndoHandwriting = ref(false)
const canRedoHandwriting = ref(false)

const updateToolbarStatus = () => {
  if (handwritingRef.value) {
    canUndoHandwriting.value = handwritingRef.value.canUndo()
    canRedoHandwriting.value = handwritingRef.value.canRedo()
  }
}

const clearHandwriting = () => {
  handwritingRef.value?.clear()
  hasHandwriting.value = false
  lastHandwritingBase64.value = null
  formula.value = ''
  updateToolbarStatus()
}

const undoHandwriting = () => {
  handwritingRef.value?.undo()
  updateToolbarStatus()
}

const redoHandwriting = () => {
  handwritingRef.value?.redo()
  updateToolbarStatus()
}

const handleHandwritingChange = (base64: string | null) => {
  lastHandwritingBase64.value = base64
  hasHandwriting.value = !!base64
  updateToolbarStatus()
  
  if (base64) {
    // 自动触发识别
    recognizeFormula(base64)
  } else {
    formula.value = ''
  }
}

const recognizeFormula = async (base64: string) => {
  isRecognizing.value = true
  error.value = null
  try {
    const result = await apiService.recognizeHandwrittenFormula(base64)
    if (result && result.latex) {
      formula.value = result.latex
      updatePreview()
    } else {
      formula.value = ''
    }
  } catch (e: any) {
    console.error('[HighSchoolMathEditor] 识别公式失败:', e)
    error.value = '识别失败，请重试'
    formula.value = ''
  } finally {
    isRecognizing.value = false
  }
}

const handleConfirm = () => {
  if (formula.value) {
    emit('update:modelValue', formula.value)
    emit('confirm', formula.value)
  }
}

// 在预览区域渲染当前公式的 KaTeX 表达式
const updatePreview = () => {
  if (!formula.value.trim()) return
  nextTick(() => {
    if (previewArea.value) {
      try {
        katex.render(formula.value, previewArea.value, {
          throwOnError: false,
          displayMode: true
        })
      } catch (e: any) {
        console.warn('KaTeX render error:', e)
      }
    }
  })
}

// 监听公式内容变化，自动更新预览
watch(() => formula.value, () => {
  updatePreview()
})

// 组件挂载时初始化
onMounted(() => {
  if (props.modelValue) {
    formula.value = props.modelValue
    updatePreview()
  }
  
  nextTick(() => {
    updateToolbarStatus()
  })
})
</script>

<style scoped>
.hsm-container {
  background: #ffffff;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
}

/* 主体内容区 */
.hsm-body {
  flex: 1;
  display: flex;
  padding: 0;
  gap: 24px;
  overflow: hidden;
}

.hsm-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 容器通用样式 */
.hsm-canvas-container,
.hsm-recognition-container {
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  position: relative;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hsm-recognition-container {
  background-color: #ffffff;
}

/* 占位文字 */
.hsm-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #94a3b8;
  font-size: 14px;
  pointer-events: none;
  text-align: center;
  width: 80%;
  line-height: 1.6;
}

/* 手写板工具栏 */
.hsm-handwriting-toolbar {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  background: white;
  padding: 8px 20px;
  border-radius: 30px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  border: 1px solid #f1f5f9;
}

.toolbar-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  transition: transform 0.2s;
}

.toolbar-btn img {
  width: 20px;
  height: 20px;
  opacity: 0.6;
}

.toolbar-btn:hover:not(:disabled) {
  transform: scale(1.1);
}

.toolbar-btn:hover:not(:disabled) img {
  opacity: 1;
}

.toolbar-btn:disabled {
  cursor: not-allowed;
}

.toolbar-btn:disabled img {
  opacity: 0.2;
}

.toolbar-btn--danger img {
  filter: invert(47%) sepia(82%) saturate(2487%) hue-rotate(336deg) brightness(101%) contrast(96%);
}

/* 识别内容展示 */
.hsm-recognition-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  padding: 20px;
}

.formula-preview {
  font-size: 28px;
  max-width: 100%;
  overflow-x: auto;
  color: #1e293b;
}

.hsm-error-msg {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  text-align: center;
  color: #ef4444;
  font-size: 12px;
}

/* 加载状态 */
.hsm-loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #64748b;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #f1f5f9;
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.hsm-toast {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.9);
  color: white;
  padding: 10px 24px;
  border-radius: 20px;
  font-size: 14px;
  z-index: 1000;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
</style>

