<template>
  <div class="photo-search-input">
    <!-- 左侧按钮组 -->
    <div class="left-actions">
      <!-- 再拍一题 -->
      <div class="action-item" @click="handleRetake">
        <q-icon name="camera_alt" size="24px" />
        <span class="action-text">再拍一题</span>
      </div>
      
      <!-- 收藏 -->
      <div class="action-item" @click="handleFavorite">
        <q-icon 
          :name="isFavorite ? 'star' : 'star_border'" 
          :class="{ 'favorited': isFavorite }"
          size="24px" 
        />
        <span class="action-text">收藏</span>
      </div>
      
      <!-- 加入练习 -->
      <div class="action-item" @click="handleAddToPractice">
        <q-icon name="description" size="24px" />
        <span class="action-text">加入练习</span>
      </div>
    </div>
    <div 
          class="speech-icon" 
          :class="{ 'recognizing': isRecognizing }"
          @click="handleSpeechInput"
          :title="isRecognizing ? '正在识别中...' : '语音输入'"
        >
          <q-icon 
            :name="isRecognizing ? 'mic' : 'mic_none'" 
            size="20px"
            :class="{ 'pulse': isRecognizing }"
          />
        </div>
    <!-- 中间输入框 -->
    <div 
      class="input-container" 
      :class="{ 'holding': isHolding }"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchCancel"
    >
      <input
        ref="inputRef"
        v-model="inputText"
        type="text"
        class="input-field"
        :placeholder="props.placeholderText || props.placeholder"
        :disabled="props.isLoading"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown.enter="handleEnter"
      />
      <!-- 右侧图标组 -->
      <div class="right-icons">
        <!-- 语音输入按钮 -->

        <!-- 键盘图标 -->
        <div class="keyboard-icon" @click="handleKeyboardToggle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- 九宫格点 -->
            <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="6" r="1.5" fill="currentColor"/>
            <circle cx="18" cy="6" r="1.5" fill="currentColor"/>
            <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="18" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="6" cy="18" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
            <circle cx="18" cy="18" r="1.5" fill="currentColor"/>
            <!-- 底部横线 -->
            <line x1="4" y1="22" x2="20" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, onMounted } from 'vue'
import { useQuestionStore } from '@/stores/questionStore'
import { toggleExerciseFavorite, isExerciseFavorite } from '@/utils/storage/favorites'
import { apiService } from '@/services/api-service'
import { showMessage } from '@/utils'
import { androidBridge } from '@/services/android-bridge'
import type { ExerciseItem } from '@/types'

interface Props {
  modelValue?: string
  currentQuestion?: ExerciseItem | null
  onRetake?: () => void
  placeholder?: string
  'placeholder-text'?: string
  'is-loading'?: boolean
  'is-recording'?: boolean
  'can-send'?: boolean
  type?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '按住提问',
  'is-loading': false,
  'is-recording': false,
  'can-send': true,
  type: 'ai-exercise'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'send-message': []
  'retake': []
  'favorite': []
  'add-to-practice': []
  'blur': []
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const inputText = ref('')
const isHolding = ref(false)
const holdTimer = ref<number | null>(null)
const isFavorite = ref(false)
const isRecognizing = ref(false)

const questionStore = useQuestionStore()

// 检查收藏状态
const checkFavoriteStatus = () => {
  if (props.currentQuestion) {
    isFavorite.value = isExerciseFavorite(props.currentQuestion.id)
  }
}

// 监听题目变化，更新收藏状态
watch(() => props.currentQuestion, () => {
  checkFavoriteStatus()
}, { immediate: true, deep: true })

// 处理再拍一题
const handleRetake = () => {
  emit('retake')
  if (props.onRetake) {
    props.onRetake()
  }
}

// 处理收藏
const handleFavorite = () => {
  if (!props.currentQuestion) {
    showMessage('没有可收藏的题目', 'warning')
    return
  }
  
  const success = toggleExerciseFavorite(props.currentQuestion)
  if (success) {
    isFavorite.value = !isFavorite.value
    showMessage(isFavorite.value ? '已收藏' : '已取消收藏', 'success')
    emit('favorite')
  } else {
    showMessage('操作失败，请重试', 'error')
  }
}

// 处理加入练习
const handleAddToPractice = async () => {
  if (!props.currentQuestion) {
    showMessage('没有可添加的题目', 'warning')
    return
  }

  try {
    // 获取当前题目列表ID
    const questions = questionStore.questions
    const exercisesId = questions.map(q => q.bmNo || q.id).join(',')

    // 构建添加请求
    const questionData = {
      ...props.currentQuestion,
      exercisesId,
    }

    const subject = questionStore.currentSubject || 'math'
    const success = await apiService.addQuestionToList(questionData, subject)
    
    if (success) {
      showMessage('题目已添加到列表', 'success')
      // 刷新题目列表
      await questionStore.fetchQuestions(subject, false)
      emit('add-to-practice')
    } else {
      showMessage('添加题目失败', 'error')
    }
  } catch (error) {
    console.error('添加题目失败:', error)
    showMessage('添加题目失败', 'error')
  }
}

// 处理鼠标按下
const handleMouseDown = () => {
  startHold()
}

// 处理鼠标抬起
const handleMouseUp = () => {
  endHold()
}

// 处理鼠标离开
const handleMouseLeave = () => {
  endHold()
}

// 处理触摸开始
const handleTouchStart = (e: TouchEvent) => {
  e.preventDefault()
  startHold()
}

// 处理触摸结束
const handleTouchEnd = (e: TouchEvent) => {
  e.preventDefault()
  endHold()
}

// 处理触摸取消
const handleTouchCancel = (e: TouchEvent) => {
  e.preventDefault()
  endHold()
}

// 开始按住
const startHold = () => {
  isHolding.value = true
  // 500ms后触发发送（如果还在按住）
  holdTimer.value = window.setTimeout(() => {
    if (isHolding.value && inputText.value.trim()) {
      sendMessage()
    }
  }, 500)
}

// 结束按住
const endHold = () => {
  isHolding.value = false
  if (holdTimer.value) {
    clearTimeout(holdTimer.value)
    holdTimer.value = null
  }
}

// 发送消息
const sendMessage = () => {
  if (!inputText.value.trim() || props.isLoading) {
    return
  }
  
  const message = inputText.value.trim()
  inputText.value = ''
  emit('update:modelValue', '')
  emit('send-message')
}

// 处理输入框聚焦
const handleFocus = () => {
  // 可以在这里添加聚焦逻辑
}

// 处理输入框失焦
const handleBlur = () => {
  emit('blur')
}

// 处理回车键
const handleEnter = (e: KeyboardEvent) => {
  e.preventDefault()
  sendMessage()
}

// 处理键盘切换
const handleKeyboardToggle = () => {
  // 可以在这里添加键盘切换逻辑
  inputRef.value?.focus()
}

// 处理语音输入
const handleSpeechInput = () => {
  console.log('[PhotoSearchInput] 🎤 [语音识别] 用户点击语音输入按钮')
  
  // 如果正在识别，停止识别
  if (isRecognizing.value) {
    console.log('[PhotoSearchInput] 🛑 [语音识别] 正在识别中，停止识别')
    try {
      const result = androidBridge.stopSpeech()
      if (result.success) {
        console.log('[PhotoSearchInput] ✓ [语音识别] 停止成功')
        isRecognizing.value = false
        showMessage('已停止语音识别', 'info')
      } else {
        console.warn('[PhotoSearchInput] ⚠️ [语音识别] 停止失败:', result.message)
        showMessage(result.message || '停止语音识别失败', 'warning')
      }
    } catch (error) {
      console.error('[PhotoSearchInput] ❌ [语音识别] 停止异常:', error)
      showMessage('停止语音识别失败', 'error')
      isRecognizing.value = false
    }
    return
  }

  if (props.isLoading) {
    console.warn('[PhotoSearchInput] ⚠️ [语音识别] 正在处理中，忽略请求')
    showMessage('正在处理中，请稍候', 'warning')
    return
  }

  try {
    console.log('[PhotoSearchInput] 📞 [语音识别] 调用 androidBridge.startSpeech()')
    const result = androidBridge.startSpeech()
    
    if (!result.success) {
      console.error('[PhotoSearchInput] ❌ [语音识别] 启动失败:', result.message)
      showMessage(result.message || '语音识别启动失败', 'error')
      return
    }

    // 如果正在请求权限，不设置识别状态
    if (result.message === '正在请求录音权限') {
      console.log('[PhotoSearchInput] 📝 [语音识别] 正在请求录音权限')
      return
    }

    // 设置识别状态
    console.log('[PhotoSearchInput] ✓ [语音识别] 启动成功，设置识别状态为 true')
    isRecognizing.value = true
  } catch (error) {
    console.error('[PhotoSearchInput] ❌ [语音识别] 异常:', error)
    showMessage('语音识别功能不可用', 'error')
    isRecognizing.value = false
  }
}

// 处理语音识别结果
const handleSpeechResult = (data: { text: string | null; error: string | null }) => {
  console.log('[PhotoSearchInput] 🔔 [语音识别] handleSpeechResult 被调用')
  console.log('[PhotoSearchInput] 📥 [语音识别] 收到识别结果数据:', data)
  console.log('[PhotoSearchInput] 📊 [语音识别] 当前输入框值:', `"${inputText.value}"`)
  console.log('[PhotoSearchInput] 📊 [语音识别] 当前识别状态:', isRecognizing.value)
  
  // 更新识别状态
  isRecognizing.value = false
  console.log('[PhotoSearchInput] 📝 [语音识别] 识别状态更新: true -> false')
  
  const { text, error } = data
  console.log('[PhotoSearchInput] 🔍 [语音识别] 解析数据 - text:', text ? `"${text}" (长度: ${text.length})` : 'null', 'error:', error || 'null')
  
  if (error) {
    console.error('[PhotoSearchInput] ❌ [语音识别] 识别错误:', error)
    
    // 用户取消的情况，不显示错误消息（因为 stopSpeech 已经显示过提示了）
    if (error === '用户取消') {
      console.log('[PhotoSearchInput] ℹ️ [语音识别] 用户取消，不显示错误消息')
      console.log('[PhotoSearchInput] ✅ [语音识别] 取消处理完成，退出')
      return
    }
    
    console.log('[PhotoSearchInput] 📤 [语音识别] 准备显示错误消息')
    showMessage(error, 'error')
    console.log('[PhotoSearchInput] ✅ [语音识别] 错误处理完成，退出')
    return
  }

  if (text) {
    console.log('[PhotoSearchInput] ✓ [语音识别] 识别成功，文本:', `"${text}" (长度: ${text.length})`)
    // 将识别结果填充到输入框
    const oldText = inputText.value
    console.log('[PhotoSearchInput] 📝 [语音识别] 准备更新输入框内容')
    console.log('[PhotoSearchInput] 📝 [语音识别] 旧值:', `"${oldText}" (长度: ${oldText.length})`)
    console.log('[PhotoSearchInput] 📝 [语音识别] 新值:', `"${text}" (长度: ${text.length})`)
    
    inputText.value = text
    console.log('[PhotoSearchInput] ✅ [语音识别] 输入框值已更新')
    console.log('[PhotoSearchInput] 📊 [语音识别] 更新后输入框值:', `"${inputText.value}"`)
    
    console.log('[PhotoSearchInput] 📤 [语音识别] 准备显示成功消息')
    showMessage('语音识别成功', 'success')
    console.log('[PhotoSearchInput] ✅ [语音识别] 成功处理完成')
  } else {
    console.warn('[PhotoSearchInput] ⚠️ [语音识别] 识别结果为空')
    console.log('[PhotoSearchInput] ✅ [语音识别] 空结果处理完成')
  }
}

// 监听外部 modelValue 变化
watch(() => props.modelValue, (newVal) => {
  if (newVal !== inputText.value) {
    inputText.value = newVal || ''
  }
}, { immediate: true })

// 监听输入文本变化
watch(inputText, (newVal, oldVal) => {
  console.log('[PhotoSearchInput] 👀 [输入框] watch 监听器触发')
  console.log('[PhotoSearchInput] 📊 [输入框] 值变化 - 旧值:', `"${oldVal}"`, '新值:', `"${newVal}"`)
  console.log('[PhotoSearchInput] 📤 [输入框] 准备触发 update:modelValue 事件')
  emit('update:modelValue', newVal)
  console.log('[PhotoSearchInput] ✅ [输入框] update:modelValue 事件已触发')
})

// 监听语音识别结果事件
onMounted(() => {
  console.log('[PhotoSearchInput] 📡 [语音识别] 注册 speechResult 事件监听器')
  androidBridge.addEventListener('speechResult', handleSpeechResult)
})

// 清理定时器和事件监听器
onUnmounted(() => {
  console.log('[PhotoSearchInput] 🧹 [语音识别] 清理事件监听器')
  if (holdTimer.value) {
    clearTimeout(holdTimer.value)
  }
  androidBridge.removeEventListener('speechResult', handleSpeechResult)
})
</script>

<style scoped lang="scss">
.photo-search-input {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  width: 100%;
  box-sizing: border-box;
}

.left-actions {
  display: flex;
  gap: 16px;
  flex-shrink: 0;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
  user-select: none;

  &:hover {
    opacity: 0.7;
  }

  &:active {
    opacity: 0.5;
  }

  .q-icon {
    color: #666;
    transition: color 0.2s;
  }

  .q-icon.favorited {
    color: #ffc107;
  }

  .action-text {
    font-size: 12px;
    color: #666;
    line-height: 1;
  }
}

.input-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border-radius: 12px;
  border: 2px solid transparent;
  background-image: linear-gradient(white, white),
    linear-gradient(to right, #7A7CFF, #9C27B0);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  padding: 2px;
  transition: all 0.2s;
  min-height: 48px;

  &.holding {
    background-image: linear-gradient(white, white),
      linear-gradient(to right, #9C27B0, #7A7CFF);
    transform: scale(0.98);
  }

  .input-field {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    padding: 12px 40px 12px 16px;
    font-size: 16px;
    color: #333;
    width: 100%;
    box-sizing: border-box;

    &::placeholder {
      color: #9C27B0;
      opacity: 0.8;
    }

    &:focus {
      &::placeholder {
        opacity: 0.5;
      }
    }
  }

  .right-icons {
    position: absolute;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .speech-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    cursor: pointer;
    color: #666;
    transition: all 0.2s;

    &:hover {
      color: #9C27B0;
    }

    &.recognizing {
      color: #9C27B0;
    }

    .pulse {
      animation: pulse 1.5s ease-in-out infinite;
    }
  }

  .keyboard-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    cursor: pointer;
    color: #666;
    transition: color 0.2s;

    &:hover {
      color: #9C27B0;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}
</style>

