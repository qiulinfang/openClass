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
      <!-- 右侧键盘图标 -->
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useQuestionStore } from '@/stores/questionStore'
import { toggleExerciseFavorite, isExerciseFavorite } from '@/utils/storage/favorites'
import { apiService } from '@/services/api-service'
import { showMessage } from '@/utils'
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

// 监听外部 modelValue 变化
watch(() => props.modelValue, (newVal) => {
  if (newVal !== inputText.value) {
    inputText.value = newVal || ''
  }
}, { immediate: true })

// 监听输入文本变化
watch(inputText, (newVal) => {
  emit('update:modelValue', newVal)
})

// 清理定时器
onUnmounted(() => {
  if (holdTimer.value) {
    clearTimeout(holdTimer.value)
  }
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

  .keyboard-icon {
    position: absolute;
    right: 12px;
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
</style>

