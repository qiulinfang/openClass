<template>
  <!-- 结果全屏面板：拍照问答结果 (封装组件) -->
  <Transition name="drawer-slide">
    <div v-if="modelValue" class="photo-qa-drawer exercise-solve-container">
      <!-- 顶部导航栏 (完全对齐 ExerciseSolveViewNew.vue header) -->
      <header class="exercise-solve-header">
        <!-- 左侧：返回按钮 -->
        <div class="header-left">
          <div class="left-header-back" @click="handleClose">
            <img :src="goBackIcon" alt="返回" class="back-icon" />
          </div>
        </div>

        <!-- 中间：图片 / 关键词 Tab 切换 (极简纯文本无背景框) -->
        <div class="header-center">
          <div class="image-tabs row items-center">
            <div
              class="tab-item"
              :class="{ active: activeTab === 'photo' }"
              @click="activeTab = 'photo'"
            >
              拍照搜题
            </div>
            <div
              class="tab-item"
              :class="{ active: activeTab === 'keyword' }"
              @click="activeTab = 'keyword'"
            >
              关键词搜题
            </div>
          </div>
        </div>

        <!-- 右侧：重拍（关闭全屏面板并返回拍照模式） -->
        <div class="header-right row items-center">
          <BaseButton size="xs" variant="ghost" label="✕" title="重拍" @click="handleRetakeAndClose" />
        </div>
      </header>

      <!-- 核心工作区 (完全对齐 ExerciseSolveViewNew.vue exercise-body) -->
      <div class="exercise-body">
        <SplitPanel
          ref="splitPanelRef"
          :initial-mode="splitMode"
          :left-config="[36, 30, 50]"
          :center-config="[64, 50, 80]"
          :right-config="[36, 36, 60]"
          :transition-duration="0.5"
          :transition-easing="'ease-in-out'"
          :show-splitters="true"
          :splitter-class="splitMode === 'left' ? 'handle-blue' : 'handle-indigo'"
          @mode-change="handleSplitModeChange"
        >
          <!-- 左侧列：【拍照切片原图 + 搜到的题目列表】 (完全对齐 ExerciseSolveViewNew 整体风格) -->
          <template #left="{ isVisible }">
            <div class="panel-bg1">
              <div
                class="panel-content"
                :class="{ 'panel-hidden': !isVisible, 'panel-visible': isVisible }"
                :style="{ width: '100%', minWidth: '300px' }"
              >
                <div class="panel-card problem-card">
                  <div class="panel-card-body q-pa-sm flex column full-height">
                    <!-- 上半部：依据搜题模式动态展示 (拍照搜题 -> 原图切片预览 + 清空重拍；文字搜题 -> 输入框 + 搜索/清空) -->
                    <div class="crop-preview-card q-mb-sm">
                      <!-- 1. 拍照搜题模式：显示拍照切片及重新拍照按钮 -->
                      <template v-if="activeTab === 'photo'">
                        <div class="img-preview-box relative-position row items-center justify-center">
                          <img
                            v-if="croppedImageBase64 || cropPreviewImage"
                            :src="croppedImageBase64 || cropPreviewImage"
                            alt="拍照切图"
                            class="user-cropped-img"
                          />
                          <div v-else class="text-caption text-slate-400">暂无切图预览</div>
                          <BaseButton
                            size="xs"
                            variant="outline"
                            label="重新拍照"
                            class="retake-btn"
                            @click="handleRetakeAndClose"
                          />
                        </div>
                      </template>

                      <!-- 2. 文字/关键词搜题模式：显示输入框、搜索和清空按钮 -->
                      <template v-else-if="activeTab === 'keyword'">
                        <div class="keyword-input-box q-pa-sm bg-white border-top-slate">
                          <AutoHeightTextarea
                            v-model="keywordText"
                            placeholder="请输入题目的关键字，多个词可用空格隔开"
                            :min-height="54"
                            :max-height="110"
                            :show-action-button="true"
                            action-button-class="keyword-search-btn"
                            action-button-color="primary"
                            action-button-icon="search"
                            :action-button-loading="isKeywordSearching"
                            :action-button-disabled="!keywordText.trim()"
                            @keydown.enter.prevent="$emit('keyword-search', keywordText)"
                            @action-click="$emit('keyword-search', keywordText)"
                          />
                        </div>
                      </template>
                    </div>

                    <!-- 下半部：搜到的候选题目列表卡片 (根据 activeTab 展示拍照或关键词的题目列表) -->
                    <div class="candidates-card col flex column overflow-hidden">

                      <div class="candidate-list-scroll col overflow-auto q-px-xs q-py-xs">
                        <div v-if="isCurrentSearching" class="q-pa-md text-center">
                          <BaseLoading text="检索中..." :size="28" />
                        </div>

                        <QuestionList
                          v-else-if="candidateExerciseItems.length > 0"
                          :questions="candidateExerciseItems"
                          :selected-question-id="currentQuestionData?.id || currentQuestionData?.bmNo"
                          :show-search="false"
                          :show-subject-filter="false"
                          :show-question-actions="false"
                          :show-send-to-ai="false"
                          :show-mistake-badge="false"
                          type="exercise"
                          @question-selected="handleQuestionListSelect"
                        >
                          <template #question-status="{ question }">
                            <div class="row items-center q-gutter-xs q-ml-xs">
                              <BaseTag
                                size="xs"
                                :text="
                                  (question as any).rawCandidate?.same_question?.label === 'same' ||
                                  (question as any).same_question?.label === 'same' ||
                                  question.mathRagV2?.sameQuestionLabel === 'same'
                                    ? '同题命中'
                                    : (question as any).rawCandidate?.same_question?.label === 'likely_same' ||
                                      (question as any).same_question?.label === 'likely_same' ||
                                      question.mathRagV2?.sameQuestionLabel === 'likely_same'
                                      ? '疑似同题'
                                      : '相似题'
                                "
                                :type="
                                  (question as any).rawCandidate?.same_question?.label === 'same' ||
                                  (question as any).same_question?.label === 'same' ||
                                  question.mathRagV2?.sameQuestionLabel === 'same'
                                    ? 'green'
                                    : (question as any).rawCandidate?.same_question?.label === 'likely_same' ||
                                      (question as any).same_question?.label === 'likely_same' ||
                                      question.mathRagV2?.sameQuestionLabel === 'likely_same'
                                      ? 'orange'
                                      : 'gray'
                                "
                              />
                              <span
                                v-if="
                                  (question as any).rawCandidate?.score !== undefined ||
                                  (question as any).score !== undefined
                                "
                                class="text-caption text-grey-7"
                              >
                                匹配: {{ (((question as any).rawCandidate?.score ?? (question as any).score ?? 0) * 100).toFixed(0) }}%
                              </span>
                            </div>
                          </template>
                        </QuestionList>

                        <div v-else class="text-caption text-grey-5 text-center q-pa-md">
                          {{ activeTab === 'photo' ? '暂无拍照切图匹配题目' : '暂无关键词搜题记录' }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 中间列：纯粹展示题目 + 草稿本 (对齐 ExerciseSolveViewNew draft-card) -->
          <template #center="{}">
            <div class="panel-bg"></div>
            <div class="panel-content" :style="{ width: '100%', minWidth: '500px' }">
              <div
                class="panel-card draft-card"
                :class="{ 'draft-mode-left': splitMode === 'left', 'draft-mode-right': splitMode === 'right' }"
              >
                <!-- 题目区域 (纯粹展示选中题目的详情与 Markdown/LaTeX 公式解析) -->
                <div class="question-image-section" :class="{ collapsed: isQuestionImageCollapsed }">
                  <div class="question-image-content">
                    <div v-if="isCurrentSearching" class="search-loading-container text-center q-pa-md">
                      <BaseLoading text="正在检索题目并调取 MathRAG 智能分析..." :size="36" />
                    </div>

                    <div v-else-if="currentQuestionData" class="results-main-area">
                      <div class="mathrag-status-banner q-mb-sm row items-center justify-end">
                        <!-- 题目操作按钮区：Debug 调试 & 收藏 & 加入我的练习 -->
                        <div class="question-header-actions row items-center q-gutter-xs">
                          <BaseButton
                            v-if="isDev && currentQuestionData"
                            size="xs"
                            variant="outline"
                            label="Debug 题目"
                            @click="logCurrentQuestionInfo"
                          />
                          <BaseButton
                            size="xs"
                            :variant="isFavoriteInChat ? 'primary' : 'ghost'"
                            :label="isFavoriteInChat ? '已收藏' : '收藏'"
                            @click="handleFavoriteClick"
                          />
                          <BaseButton
                            size="xs"
                            :variant="isInPracticeList ? 'danger' : 'outline'"
                            :label="isInPracticeList ? '移出练习' : '加入我的练习'"
                            @click="handleAddPracticeClick"
                          />
                        </div>
                      </div>
                      <div class="problem-text markdown-content" v-html="renderQuestionContent(currentQuestionData)"></div>
                    </div>

                    <div v-else class="empty-result-container text-center q-pa-md text-grey-6">
                      <div class="empty-search-icon">🔍</div>
                      <div class="text-caption q-mt-xs">未选择或未匹配到题目</div>
                    </div>
                  </div>
                </div>

                <!-- 折叠切换控制按钮 -->
                <div class="collapse-toggle-btn" @click="toggleQuestionImage">
                  <img :src="collapseToggleIcon" alt="toggle" class="collapse-toggle-svg" />
                </div>

                <!-- 草稿本区域（自带悬浮/内部工具栏） -->
                <div class="panel-card-body draft-body">
                  <DrawingBoardNew
                    ref="draftBoardRef"
                    :showGrid="false"
                    :initial-zoom="100"
                    :show-toolbar="true"
                  />
                </div>
              </div>

              <!-- 悬浮问 AI 图标按钮 FloatBubble -->
              <FloatBubble
                toggle-only
                :draggable="true"
                :drag-min-y="-300"
                :drag-max-y="30"
                :class="['textbookip-float', splitMode === 'left' ? 'float-right' : 'float-left']"
                @toggle="toggleAiPanel"
              >
                <img :src="textbookipIcon" alt="textbookip" />
              </FloatBubble>
            </div>
          </template>

          <!-- 右侧列：【AI 面板 - ExerciseChatPanelNew】 (完全对齐 ExerciseSolveViewNew) -->
          <template #right="{ isVisible }">
            <div class="panel-bg2">
              <div
                class="panel-content"
                :class="{ 'panel-hidden': !isVisible, 'panel-visible': isVisible }"
                :style="{ width: '100%', minWidth: '300px' }"
              >
                <div class="panel-card ai-chat-card">
                  <div class="panel-card-body">
                    <ExerciseChatPanelNew
                      ref="exerciseChatPanelRef"
                      :question="currentQuestionData"
                      :show-close-button="true"
                      @close="toggleAiPanel"
                      @send-message="handleSendMessageFromChild"
                      @add-session="handleAddSessionCard"
                      @screenshot-click="handleScreenshotClick"
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </SplitPanel>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseButton from '@/components/base/Button.vue'
import BaseTag from '@/components/base/Tag.vue'
import BaseLoading from '@/components/base/Loading.vue'
import SplitPanel from '@/components/base/SplitPanel.vue'
import DrawingBoardNew from '@/components/drawing/drawingBoardNew.vue'
import ExerciseChatPanelNew from '@/components/chat/chatpanel/ExerciseChatPanelNew.vue'
import FloatBubble from '@/components/base/Fab.vue'
import AutoHeightTextarea from '@/components/base/Textarea.vue'
import type { ExerciseItem } from '@/types'
import QuestionList from './QuestionList.vue'

import goBackIcon from '/icons/goback.svg'
import textbookipIcon from '/icons/textbookip.png'
import collapseToggleIcon from '/icons/collapse-toggle-icon.svg'

const props = defineProps<{
  modelValue: boolean
  activeTab?: 'photo' | 'keyword'
  croppedImageBase64: string
  cropPreviewImage: string
  isSearching: boolean
  photoQuestionData: ExerciseItem | null
  keywordQuestionData: ExerciseItem | null
  isKeywordSearching: boolean
  isFavoriteInChat: boolean
  isInPracticeList: boolean
  renderQuestionContent: (q: any) => string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'update:activeTab', val: 'photo' | 'keyword'): void
  (e: 'retake'): void
  (e: 'select-candidate', candidate: any): void
  (e: 'keyword-search', text: string): void
  (e: 'clear-photo'): void
  (e: 'clear-keyword'): void
  (e: 'chat-response'): void
  (e: 'send-message', msg: any): void
  (e: 'favorite'): void
  (e: 'add-practice'): void
}>()

const splitPanelRef = ref<InstanceType<typeof SplitPanel> | null>(null)
const draftBoardRef = ref<InstanceType<typeof DrawingBoardNew> | null>(null)
const exerciseChatPanelRef = ref<InstanceType<typeof ExerciseChatPanelNew> | null>(null)

const activeTab = computed({
  get: () => props.activeTab || 'photo',
  set: (val: 'photo' | 'keyword') => emit('update:activeTab', val)
})
const keywordText = ref('')
const splitMode = ref<'left' | 'right'>('left')
const isQuestionImageCollapsed = ref(true)

const handleFavoriteClick = (e: Event) => {
  e.stopPropagation()
  emit('favorite')
}

const handleAddPracticeClick = (e: Event) => {
  e.stopPropagation()
  emit('add-practice')
}

const isCurrentSearching = computed(() => {
  return activeTab.value === 'photo' ? props.isSearching : props.isKeywordSearching
})

const mathRagBadge = computed(() => {
  const label = currentQuestionData.value?.mathRagV2?.sameQuestionLabel
  if (label === 'same') return { color: 'positive', text: '同题精准命中' }
  if (label === 'likely_same') return { color: 'orange', text: '疑似同题' }
  return { color: 'grey-7', text: '题库相似推荐' }
})

const currentQuestionData = computed(() => {
  if (activeTab.value === 'photo') return props.photoQuestionData
  return props.keywordQuestionData
})

const isDev = import.meta.env.DEV

const logCurrentQuestionInfo = () => {
  console.log('=== [Dev Debug] PhotoSearch Current Selected Question ===')
  console.log('ID / bmNo:', currentQuestionData.value?.id || currentQuestionData.value?.bmNo)
  console.log('Title / Question:', currentQuestionData.value?.title || currentQuestionData.value?.question)
  console.log('MathRAG v2 Info:', currentQuestionData.value?.mathRagV2)
  console.log('Raw ExerciseItem Object:', currentQuestionData.value)
  console.log('========================================================')
}

const candidateExerciseItems = computed<ExerciseItem[]>(() => {
  const results = currentQuestionData.value?.mathRagV2?.results
  if (results && results.length > 0) {
    return results.map((candidate: any, index: number) => ({
      id: String(candidate.id || index),
      bmNo: String(candidate.id || index + 1),
      title: candidate.question || candidate.title || '',
      question: candidate.question || candidate.title || '',
      answer: candidate.answer || '',
      explanation: candidate.explanation || '',
      mathRagV2: candidate.mathRagV2 || {
        sameQuestionLabel: candidate.same_question?.label,
        probability: candidate.same_question?.probability,
      },
      rawCandidate: candidate,
    }))
  }
  if (currentQuestionData.value) {
    return [currentQuestionData.value]
  }
  return []
})

const handleQuestionListSelect = (question: ExerciseItem) => {
  const raw = (question as any).rawCandidate || question
  selectCandidateQuestion(raw)
}

const handleClearKeyword = () => {
  keywordText.value = ''
  emit('clear-keyword')
}

// 监听全屏面板关闭，完全重置子组件内部的搜索 Tab 与分屏等状态
watch(
  () => props.modelValue,
  (val) => {
    if (!val) {
      activeTab.value = 'photo'
      keywordText.value = ''
      splitMode.value = 'left'
      isQuestionImageCollapsed.value = true
    }
  },
)

// v-model (modelValue) 的双向计算属性
const isVisible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

const handleClose = () => {
  isVisible.value = false
}

const handleRetakeAndClose = () => {
  isVisible.value = false
  emit('retake')
}

const handleSplitModeChange = (newMode: 'left' | 'right') => {
  splitMode.value = newMode
}

const toggleAiPanel = () => {
  splitPanelRef.value?.toggle()
}

const toggleQuestionImage = () => {
  isQuestionImageCollapsed.value = !isQuestionImageCollapsed.value
}

const selectCandidateQuestion = (candidate: any) => {
  emit('select-candidate', candidate)
}

const handleAddSessionCard = async () => {
  const chatView = getChatViewRef() as any
  if (chatView?.addSessionCard) {
    await chatView.addSessionCard()
  }
}

const handleScreenshotClick = async (active: boolean) => {
  if (draftBoardRef.value) {
    if (active) {
      draftBoardRef.value.handleToolbarToolChange('askAi')
    } else {
      draftBoardRef.value.handleToolbarToolChange('draw')
    }
  }
}

const handleSendMessageFromChild = (msg: any) => {
  const chatView = getChatViewRef()
  if (chatView && typeof chatView.sendMessage === 'function') {
    chatView.inputMessage = typeof msg === 'string' ? msg : msg?.content || ''
    chatView.sendMessage()
  } else {
    emit('send-message', msg)
  }
}

const getChatViewRef = () => {
  if (exerciseChatPanelRef.value && typeof exerciseChatPanelRef.value.getChatViewRef === 'function') {
    return exerciseChatPanelRef.value.getChatViewRef()
  }
  return null
}

defineExpose({
  getChatViewRef,
  sendMessage: (msg: string) => {
    handleSendMessageFromChild(msg)
  }
})
</script>

<style scoped lang="scss">
/* 全屏容器 & 风格复原 ExerciseSolveViewNew.vue */
.photo-qa-drawer.exercise-solve-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background-color: #ffffff;
  z-index: 10002;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.exercise-solve-header {
  height: 60px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.left-header-back {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  width: 36px;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.2s;
  &:hover {
    background-color: #f1f5f9;
  }
  .back-icon {
    width: 20px;
    height: 20px;
  }
}

.main-title {
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0;
  color: #0f172a;
}

.sub-title {
  font-size: 11px;
  color: #64748b;
  margin: 0;
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.exercise-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* 分栏背景与卡片圆角 (复原 ExerciseSolveViewNew) */
.panel-content {
  height: 100%;
  position: relative;
  background: #ffffff;
  border-radius: 20px;
  transition: opacity 0.5s ease-in-out;
}

.panel-bg1 {
  height: 100%;
  background: linear-gradient(to right, #ffffff 4%, #ffffff 6%);
  width: 100%;
}

.panel-bg2 {
  height: 100%;
  background: linear-gradient(to left, #fefefe 4%, #ffffff 6%);
  width: 100%;
}

.panel-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to right, #ffffff 50%, #ffffff 50%);
  border-radius: 20px;
  z-index: -1;
}

.panel-hidden {
  opacity: 0;
  pointer-events: none;
}

.panel-visible {
  opacity: 1;
}

.panel-card {
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.problem-card {
  background: #f7f6ff;
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
}

.crop-preview-card,
.candidates-card {
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: hidden;
}

.crop-preview-card {
  .img-preview-box {
    max-height: 160px;
    min-height: 100px;
    padding: 8px;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin: 2px 4px;
    position: relative;

    .user-cropped-img {
      max-width: 100%;
      max-height: 148px;
      object-fit: contain;
      border-radius: 6px;
    }

    .retake-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #3b82f6;
      padding: 3px 8px;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

      &:hover {
        background: #ffffff;
      }
    }
  }
}

.header-close-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 50%;
  line-height: 1;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #1e293b;
  }
}

.custom-spinner-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  .dot {
    width: 6px;
    height: 6px;
    background-color: #6366f1;
    border-radius: 50%;
    animation: spinnerBounce 1.4s infinite ease-in-out both;

    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
  }

  &.large .dot {
    width: 10px;
    height: 10px;
  }
}

@keyframes spinnerBounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.custom-badge {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  color: #ffffff;
  line-height: 1.2;

  &.badge-same {
    background-color: #22c55e;
  }
  &.badge-likely {
    background-color: #f97316;
  }
  &.badge-similar {
    background-color: #94a3b8;
  }
}

.custom-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
  }

  &.debug-btn {
    color: #7c3aed;
    border-color: #ddd6fe;
    background: #f5f3ff;
  }

  &.favorite-btn.active {
    color: #d97706;
    border-color: #fde68a;
    background: #fffbeb;
  }

  &.practice-btn.active {
    color: #ef4444;
    border-color: #fecaca;
    background: #fef2f2;
  }
}

.empty-search-icon {
  font-size: 36px;
  margin-bottom: 8px;
}



.draft-card {
  display: flex;
  flex-direction: column;
  transition: border-radius 0.5s ease-in-out;
}

.draft-mode-left {
  border-top-left-radius: 0;
  border-top-right-radius: 20px;
}

.draft-mode-right {
  border-top-left-radius: 20px;
  border-top-right-radius: 0;
}

.panel-card-body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.question-image-section {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid rgba(110, 85, 255, 0.32);
  flex: 7 0 0;
  min-height: 0;
  transition: flex 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  margin: 8px 12px 0 12px;
  position: relative;
  will-change: flex;
  contain: layout paint;
}

.question-image-section.collapsed {
  flex: 0.25 0 0;
}

.collapse-toggle-btn {
  position: relative;
  top: -1px;
  height: auto;
  width: auto;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  padding: 0;
  align-self: center;
  background: transparent;
}

.collapse-toggle-svg {
  width: 100px;
  height: auto;
  display: block;
}

.image-tabs {
  display: flex;
  align-items: center;
  gap: 20px;

  .tab-item {
    padding: 6px 4px;
    font-size: 15px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    position: relative;
    transition: color 0.2s ease;

    &:hover {
      color: #334155;
    }

    &.active {
      color: #6366f1;
      font-weight: 700;

      &::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 0;
        right: 0;
        height: 2.5px;
        background: #6366f1;
        border-radius: 2px;
      }
    }
  }
}

/* FloatBubble 悬浮按钮样式 (与 ExerciseSolveViewNew 保持 100% 一致) */
.textbookip-float {
  position: absolute;
  bottom: 100px;
  z-index: 100;
  transition: left 0.5s ease-in-out, right 0.5s ease-in-out;
}

/* 做题模式（left）：紧贴草稿本右侧 */
.textbookip-float.float-right {
  right: -70px;
}

/* AI模式（right）：紧贴草稿本左侧 */
.textbookip-float.float-left {
  left: -70px;
}

/* 悬浮按钮图片大小 */
.textbookip-float img {
  width: 135px;
  object-fit: contain;
}

/* AI模式：IP形象带从小到大缩放过渡动画 */
.textbookip-float.float-left img {
  animation: ipScaleIn 0.1s ease-in-out forwards;
  transform: scaleX(-1);
}

@keyframes ipScaleIn {
  0% {
    transform: scaleX(-1) scale(0.75);
  }
  100% {
    transform: scaleX(-1) scale(1);
  }
}

.chat-action-group {
  display: flex;
  align-items: center;
  gap: 16px;

  .chat-action-item {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 12px;
    color: #475569;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background-color 0.2s;

    &:hover {
      background-color: #f1f5f9;
    }
  }
}

:deep(.inline-markdown) {
  display: inline;
  p {
    display: inline;
    margin: 0;
  }
  .katex, .MathJax {
    font-size: 0.95em;
  }
}
</style>
