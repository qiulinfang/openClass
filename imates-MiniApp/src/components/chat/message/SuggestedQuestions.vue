<template>
  <view
    :class="[
      'suggested-questions-wrapper',
      size === 'small' ? 'wrapper--small' : 'wrapper--large',
    ]"
    :style="layoutStyles"
  >
    <!-- 调试面板 (仅在开发环境下显示) -->
    <LayoutDebugger v-if="isDev" v-model="debugConfig" />
    <view style="height: 20px;"></view>
    <view class="suggested-questions-card">
      <!-- 头部区域：带紫色网格背景 -->
      <view class="suggestion-header">
        <!-- 左侧吉祥物图标 -->
        <image :src="mascotIcon" mode="aspectFit" class="mascot-icon" />
        <image :src="titleIcon" mode="aspectFit" class="title-img" />
        
        <!-- 移除顶部统一编辑按钮，改为单项编辑 -->
      </view>

      <!-- 问题列表区域 -->
      <view class="suggestion-list">
        <view v-for="(suggestion, idx) in suggestedQuestions" :key="idx" class="suggestion-item">
          <!-- 编辑模式：显示输入框 -->
          <template v-if="editingSuggestionIndex === idx">
            <input
              ref="suggestionInputRef"
              :value="editingSuggestionText"
              class="suggestion-input"
              placeholder="输入你的常用问题"
              @confirm="saveSuggestionEdit(idx)"
              @blur="saveSuggestionEdit(idx)"
              @input="(e) => editingSuggestionText = e.detail.value"
            />
          </template>
          <!-- 显示模式 -->
          <template v-else>
            <text class="suggestion-text" @click="handleSuggestionClick(suggestion)">{{
              suggestion
            }}</text>
            
            <view class="suggestion-actions">
              <!-- 单项编辑按钮：每个选项单独编辑 -->
              <button
                class="suggestion-edit-btn-inline"
                @click.stop="startEditSuggestion(idx)"
              >
                <text class="edit-icon">✎</text>
              </button>
              
              <!-- 右箭头：点击发送 -->
              <text class="suggestion-arrow" @click="handleSuggestionClick(suggestion)">→</text>
            </view>
          </template>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed, watch } from 'vue'
import mascotExerciseIcon from '/icons/changwenwenti.svg'
import mascotHomeworkIcon from '/icons/zuoyehaita.png'
import titleExerciseIcon from '/icons/cainixiangwen.svg'
import titleHomeworkIcon from '/icons/zuye_cainixiangwen.svg'
import gridBgIcon from '/icons/zisewangge.svg'
import LayoutDebugger from '../../debug/LayoutDebugger.vue'

const props = defineProps<{
  size?: 'large' | 'small'
  type: 'ai-exercise' | 'ai-homework'
}>()

const mascotIcon = computed(() => props.type === 'ai-homework' ? mascotHomeworkIcon : mascotExerciseIcon)
const titleIcon = computed(() => props.type === 'ai-homework' ? titleHomeworkIcon : titleExerciseIcon)
const isDev = computed(() => import.meta.env.VITE_ENABLE_DEBUG === 'true')

const emit = defineEmits<{
  (e: 'select', suggestion: string): void
}>()

// ==================== 调试配置 ====================
const EXERCISE_LAYOUT = {
  mascotWidth: 94,
  mascotTop: -16,
  mascotLeft: -24,
  cardPaddingLeft: 6,
  headerHeight: 40,
  headerPaddingLeft: 78,
  titleImgHeight: 45,
  listGap: 9,
  itemPadding: 8,
  textFontSize: 14
}

const HOMEWORK_LAYOUT = {
  mascotWidth: 67,
  mascotTop: -16,
  mascotLeft: 3,
  cardPaddingLeft: 6,
  headerHeight: 40,
  headerPaddingLeft: 78,
  titleImgHeight: 45,
  listGap: 9,
  itemPadding: 8,
  textFontSize: 14
}

const debugConfig = ref(props.type === 'ai-homework' ? { ...HOMEWORK_LAYOUT } : { ...EXERCISE_LAYOUT })

// 监听类型变化，切换对应的布局参数
watch(() => props.type, (newType) => {
  debugConfig.value = newType === 'ai-homework' ? { ...HOMEWORK_LAYOUT } : { ...EXERCISE_LAYOUT }
}, { immediate: true })

const layoutStyles = computed(() => ({
  '--mascot-width': `${debugConfig.value.mascotWidth}px`,
  '--mascot-top': `${debugConfig.value.mascotTop}px`,
  '--mascot-left': `${debugConfig.value.mascotLeft}px`,
  '--card-padding-left': `${debugConfig.value.cardPaddingLeft}px`,
  '--header-height': `${debugConfig.value.headerHeight}px`,
  '--header-padding-left': `${debugConfig.value.headerPaddingLeft}px`,
  '--title-img-height': `${debugConfig.value.titleImgHeight}px`,
  '--list-gap': `${debugConfig.value.listGap}px`,
  '--item-padding': `${debugConfig.value.itemPadding}px`,
  '--text-font-size': `${debugConfig.value.textFontSize}px`,
  '--grid-bg-url': `url(${gridBgIcon})`,
}))

// ==================== 推荐问题相关 ====================
// 默认练习推荐问题
const DEFAULT_EXERCISE_SUGGESTIONS = [
  '能和我一起分析一下这道题的已知条件和想求的量之间的关系吗？',
  '这道题通常会用到哪些关键概念或公式？我应该先从哪里入手？',
  '有没有一个最关键的突破口？我应该关注哪个量的变化？',
  '能带我对比一下这题和我们最近学的知识点，看是哪里匹配的吗？',
  '点击编辑自定义问题...',
]

// 默认作业推荐问题
const DEFAULT_HOMEWORK_SUGGESTIONS = [
  '能讲讲这道题我的错因在哪吗？',
  '分析一下求解这道题的核心知识点需要掌握哪些？',
  '这道题的关键考点有哪些？',
  '作答此类题目需要掌握哪些技巧？',
  '点击编辑自定义问题...',
]

// 本地存储 key 前缀
const SUGGESTIONS_STORAGE_PREFIX = 'suggested_questions_'

// 根据类型获取默认列表
const getDefaultSuggestions = () => {
  return props.type === 'ai-homework' ? DEFAULT_HOMEWORK_SUGGESTIONS : DEFAULT_EXERCISE_SUGGESTIONS
}

// 获取存储 Key
const getStorageKey = () => `${SUGGESTIONS_STORAGE_PREFIX}${props.type}`

// 推荐问题列表
const suggestedQuestions = ref<string[]>([...getDefaultSuggestions()])

// 编辑状态
const editingSuggestionIndex = ref<number | null>(null)
const editingSuggestionText = ref('')
const suggestionInputRef = ref<any>(null)

// 从本地存储加载推荐问题
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

// 保存推荐问题到本地存储
const saveSuggestedQuestions = () => {
  try {
    uni.setStorageSync(getStorageKey(), JSON.stringify(suggestedQuestions.value))
  } catch (e) {
    console.error('[SuggestedQuestions] 保存推荐问题失败:', e)
  }
}

// 开始编辑推荐问题
const startEditSuggestion = (index: number) => {
  editingSuggestionIndex.value = index
  editingSuggestionText.value = suggestedQuestions.value[index] === '点击编辑自定义问题...' 
    ? '' 
    : suggestedQuestions.value[index]
    
  // 下一帧聚焦输入框
  nextTick(() => {
    // 小程序中无法直接对 ref 使用 focus()，通常通过 :focus="true" 属性控制，此处暂不手动控制
  })
}

// 顶部按钮逻辑：开始编辑第一个"点击编辑..."或者最后一个
const startEditFirstEmptyOrCreate = () => {
  const idx = suggestedQuestions.value.findIndex(s => s === '点击编辑自定义问题...')
  if (idx !== -1) {
    startEditSuggestion(idx)
  } else {
    startEditSuggestion(suggestedQuestions.value.length - 1)
  }
}

// 保存编辑
const saveSuggestionEdit = (index: number) => {
  if (editingSuggestionIndex.value !== index) return

  const newText = editingSuggestionText.value.trim()
  if (newText) {
    suggestedQuestions.value[index] = newText
    saveSuggestedQuestions()
  } else if (suggestedQuestions.value[index] === '') {
     // 如果原来是空的且没填，恢复占位符
     suggestedQuestions.value[index] = '点击编辑自定义问题...'
  }
  editingSuggestionIndex.value = null
  editingSuggestionText.value = ''
}

// 取消编辑
const cancelSuggestionEdit = () => {
  editingSuggestionIndex.value = null
  editingSuggestionText.value = ''
}

// 点击推荐问题
const handleSuggestionClick = (suggestion: string) => {
  // 如果正在编辑，不响应点击
  if (editingSuggestionIndex.value !== null) return

  // 如果是默认的占位文本，提示编辑
  if (suggestion === '点击编辑自定义问题...') {
    const idx = suggestedQuestions.value.indexOf(suggestion)
    if (idx !== -1) {
      startEditSuggestion(idx)
    }
    return
  }

  // 直接发送该问题
  emit('select', suggestion)
}

// 组件挂载时加载保存的推荐问题
onMounted(() => {
  loadSuggestedQuestions()
})
</script>

<style scoped>
/* ==================== 整体包裹容器 ==================== */
.suggested-questions-wrapper {
  position: relative;
  padding-left: var(--card-padding-left, 40px); /* 使用变量 */
  margin: 0px 16px;
  max-width: 90%;
}

.wrapper--small {
  padding-left: 30px;
  margin: 10px 8px;
}

/* 吉祥物图标定位 */
.mascot-icon {
  position: absolute;
  left: var(--mascot-left, 0);
  top: var(--mascot-top, -10px);
  width: var(--mascot-width, 70px);
  height: auto;
  z-index: 1; /* 降低吉祥物层级，使其能被 list 遮盖 */
  pointer-events: none;
}

.wrapper--small .mascot-icon {
  width: 50px;
  top: -5px;
}

/* ==================== 主卡片样式 ==================== */
.suggested-questions-card {
  background-color: #f3f2ff; /* 浅紫色底 */
  border-radius: 16px;
  overflow: visible; /* 改为 visible 以允许吉祥物和阴影溢出 */
  display: flex;
  flex-direction: column;
  /* 去除阴影，改为渐变边框：上面透明，下面不透明 */
  box-shadow: none;
  border: 1.5px solid transparent;
  background-image: linear-gradient(#f3f2ff, #f3f2ff), 
                    linear-gradient(to bottom, transparent, rgba(122, 124, 255, 0.5));
  background-origin: border-box;
  background-clip: padding-box, border-box;
}

/* ==================== 头部区域 ==================== */
.suggestion-header {
  height: var(--header-height, 44px);
  padding: 0 12px 0 var(--header-padding-left, 78px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 1;
}

/* 紫色网格背景渐变效果 */
.suggestion-header::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: var(--grid-bg-url);
  background-size: cover;
  background-repeat: no-repeat;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  /* 渐变透明：顶部透明度为 0.2，向底部逐渐变为全透明 */
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 100%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 100%);
  z-index: -1;
}

.wrapper--small .suggestion-header {
  height: 36px;
  padding: 0 12px;
}

.title-img {
  height: var(--title-img-height, 20px);
  width: auto;
  object-fit: contain;
}

.wrapper--small .title-img {
  height: 16px;
}

/* 顶部编辑按钮 */
.header-edit-btn {
  width: 28px;
  height: 28px;
  background: white;
  border: 1px solid #e0e0ff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #7a7cff;
  transition: all 0.2s ease;
}

.header-edit-btn:hover {
  background: #f8f8ff;
  box-shadow: 0 2px 5px rgba(122, 124, 255, 0.2);
}

/* ==================== 列表区域 ==================== */
.suggestion-list {
  position: relative;
  z-index: 10;
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: var(--list-gap, 8px);
}

.wrapper--small .suggestion-list {
  padding: 6px 8px 8px;
  gap: 6px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--item-padding, 10px) 14px;
  background: #ffffff;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
}

.suggestion-item:hover {
  transform: translateY(-1px);
  box-shadow: none;
}

.suggestion-item:active {
  transform: scale(0.99);
}

.suggestion-text {
  flex: 1;
  font-size: var(--text-font-size, 14px);
  color: #374151;
  line-height: 1.4;
  font-weight: 500;
}

.wrapper--small .suggestion-text {
  font-size: 13px;
}

.suggestion-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 10px;
}

.suggestion-edit-btn-inline {
  background: transparent;
  border: none;
  color: #d1d5db;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.6;
}

.suggestion-item:hover .suggestion-edit-btn-inline {
  opacity: 1;
}

.suggestion-edit-btn-inline:hover {
  color: #6366f1;
  transform: scale(1.1);
}

.suggestion-arrow {
  color: #d1d5db;
  transition: color 0.2s;
}

.suggestion-item:hover .suggestion-arrow {
  color: #7a7cff;
}

.suggestion-input {
  flex: 1;
  border: 1px solid #7a7cff;
  border-radius: 6px;
  outline: none;
  font-size: 14px;
  color: #374151;
  background: #f8f8ff;
  padding: 4px 8px;
  line-height: 1.4;
}

.suggestion-input::placeholder {
  color: #9ca3af;
}
</style>

