<template>
  <view
    :class="[
      'suggested-questions-wrapper',
      size === 'small' ? 'wrapper--small' : 'wrapper--large',
    ]"
  >
    <view class="suggested-questions-card">
      <!-- 头部区域：带紫色网格背景与标题 -->
      <view class="suggestion-header">
        <view class="header-left-brand">
          <view class="mascot-badge">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6366f1" stroke-width="2">
              <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7z" />
              <circle cx="9" cy="14" r="1" fill="#6366f1" />
              <circle cx="15" cy="14" r="1" fill="#6366f1" />
            </svg>
          </view>
          <text class="header-title-text">猜你想问</text>
        </view>
      </view>

      <!-- 问题列表区域 -->
      <view class="suggestion-list">
        <view
          v-for="(suggestion, idx) in suggestedQuestions"
          :key="idx"
          class="suggestion-item"
        >
          <!-- 编辑模式：显示输入框 -->
          <template v-if="editingSuggestionIndex === idx">
            <input
              v-model="editingSuggestionText"
              class="suggestion-input"
              placeholder="输入你的常用问题"
              confirm-type="done"
              @confirm="saveSuggestionEdit(idx)"
              @blur="saveSuggestionEdit(idx)"
            />
          </template>

          <!-- 显示模式 -->
          <template v-else>
            <text class="suggestion-text" @click="handleSuggestionClick(suggestion)">
              {{ suggestion }}
            </text>

            <view class="suggestion-actions">
              <!-- 单项编辑按钮 -->
              <view
                class="suggestion-edit-btn-inline"
                @click.stop="startEditSuggestion(idx)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </view>

              <!-- 右箭头：点击发送 -->
              <view class="suggestion-arrow-wrap" @click.stop="handleSuggestionClick(suggestion)">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </view>
            </view>
          </template>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    size?: 'large' | 'small'
    type: 'ai-exercise' | 'ai-homework'
  }>(),
  {
    size: 'large',
    type: 'ai-exercise'
  }
)

const emit = defineEmits<{
  (e: 'select', suggestion: string): void
}>()

// 1:1 对齐 imates-web 的默认练习推荐问题
const DEFAULT_EXERCISE_SUGGESTIONS = [
  '能和我一起分析一下这道题的已知条件和想求的量之间的关系吗？',
  '这道题通常会用到哪些关键概念或公式？我应该先从哪里入手？',
  '有没有一个最关键的突破口？我应该关注哪个量的变化？',
  '能带我对比一下这题和我们最近学的知识点，看是哪里匹配的吗？',
  '点击编辑自定义问题...'
]

// 1:1 对齐 imates-web 的默认作业推荐问题
const DEFAULT_HOMEWORK_SUGGESTIONS = [
  '能讲讲这道题我的错因在哪吗？',
  '分析一下求解这道题的核心知识点需要掌握哪些？',
  '这道题的关键考点有哪些？',
  '作答此类题目需要掌握哪些技巧？',
  '点击编辑自定义问题...'
]

const SUGGESTIONS_STORAGE_PREFIX = 'suggested_questions_'

const getDefaultSuggestions = () => {
  return props.type === 'ai-homework' ? DEFAULT_HOMEWORK_SUGGESTIONS : DEFAULT_EXERCISE_SUGGESTIONS
}

const getStorageKey = () => `${SUGGESTIONS_STORAGE_PREFIX}${props.type}`

const suggestedQuestions = ref<string[]>([...getDefaultSuggestions()])
const editingSuggestionIndex = ref<number | null>(null)
const editingSuggestionText = ref('')

const loadSuggestedQuestions = () => {
  try {
    const saved = uni.getStorageSync(getStorageKey())
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length === suggestedQuestions.value.length) {
        suggestedQuestions.value = parsed
      }
    }
  } catch (e) {
    console.error('[SuggestedQuestions] 加载推荐问题失败:', e)
  }
}

const saveSuggestedQuestions = () => {
  try {
    uni.setStorageSync(getStorageKey(), JSON.stringify(suggestedQuestions.value))
  } catch (e) {
    console.error('[SuggestedQuestions] 保存推荐问题失败:', e)
  }
}

const startEditSuggestion = (index: number) => {
  editingSuggestionIndex.value = index
  editingSuggestionText.value =
    suggestedQuestions.value[index] === '点击编辑自定义问题...'
      ? ''
      : suggestedQuestions.value[index]
}

const saveSuggestionEdit = (index: number) => {
  if (editingSuggestionIndex.value !== index) return

  const newText = editingSuggestionText.value.trim()
  if (newText) {
    suggestedQuestions.value[index] = newText
    saveSuggestedQuestions()
  } else if (suggestedQuestions.value[index] === '') {
    suggestedQuestions.value[index] = '点击编辑自定义问题...'
  }
  editingSuggestionIndex.value = null
  editingSuggestionText.value = ''
}

const handleSuggestionClick = (suggestion: string) => {
  if (editingSuggestionIndex.value !== null) return

  if (suggestion === '点击编辑自定义问题...') {
    const idx = suggestedQuestions.value.indexOf(suggestion)
    if (idx !== -1) {
      startEditSuggestion(idx)
    }
    return
  }

  emit('select', suggestion)
}

onMounted(() => {
  loadSuggestedQuestions()
})
</script>

<style lang="scss" scoped>
.suggested-questions-wrapper {
  margin: 16rpx 24rpx;
}

.wrapper--small {
  margin: 12rpx 16rpx;
}

.suggested-questions-card {
  background-color: #f3f2ff;
  border-radius: 32rpx;
  padding: 16rpx 20rpx 20rpx;
  border: 1px solid #e0e0ff;
  box-shadow: 0 4rpx 16rpx rgba(122, 124, 255, 0.06);
}

.suggestion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 8rpx 16rpx 8rpx;
}

.header-left-brand {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.mascot-badge {
  width: 44rpx;
  height: 44rpx;
  background: #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 8rpx rgba(99, 102, 241, 0.15);
}

.header-title-text {
  font-size: 28rpx;
  font-weight: 700;
  color: #4338ca;
  letter-spacing: 0.5rpx;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  padding: 20rpx 24rpx;
  border-radius: 24rpx;
  min-height: 80rpx;
  transition: all 0.2s ease;

  &:active {
    background-color: #f8fafc;
  }
}

.suggestion-text {
  flex: 1;
  font-size: 28rpx;
  color: #374151;
  line-height: 1.45;
  font-weight: 500;
}

.suggestion-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-left: 16rpx;
  flex-shrink: 0;
}

.suggestion-edit-btn-inline {
  width: 44rpx;
  height: 44rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  transition: all 0.2s ease;

  &:active {
    color: #6366f1;
    background: #eef2ff;
  }
}

.suggestion-arrow-wrap {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a5b4fc;
  transition: color 0.2s ease;

  &:active {
    color: #6366f1;
  }
}

.suggestion-input {
  flex: 1;
  border: 1px solid #7a7cff;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #374151;
  background: #f8f8ff;
  padding: 12rpx 20rpx;
  height: 64rpx;
}
</style>
