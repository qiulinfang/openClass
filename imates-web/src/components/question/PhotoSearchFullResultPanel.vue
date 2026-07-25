<template>
  <!-- 结果全屏面板：拍照问答结果 (封装组件) -->
  <Transition name="drawer-slide">
    <div v-if="modelValue" class="photo-qa-drawer exercise-solve-container">
      <!-- 顶部导航栏 (完全对齐 ExerciseSolveViewNew.vue header) -->
      <header class="exercise-solve-header">
        <!-- 左侧：返回按钮与标题 -->
        <div class="header-left">
          <div class="left-header-back" @click="handleClose">
            <img :src="goBackIcon" alt="返回" class="back-icon" />
          </div>
          <div class="logo-section cursor-pointer" @click="handleClose">
            <div class="title-group">
              <h1 class="main-title">拍照搜题结果</h1>
              <p class="sub-title">MathRAG v2 智能精准判定</p>
            </div>
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
          <q-btn flat round dense icon="close" color="grey-8" title="重拍" @click="handleRetakeAndClose" />
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
                      <!-- 1. 拍照搜题模式：显示拍照切片及清空/重拍按钮 -->
                      <template v-if="activeTab === 'photo'">
                        <div class="card-sub-header row items-center justify-between q-px-sm q-py-xs">
                          <span class="text-subtitle2 text-weight-bold text-slate-800 row items-center">
                            <q-icon name="crop_original" size="18px" color="primary" class="q-mr-xs" />
                            拍照切图切片
                          </span>
                          <div class="row items-center q-gutter-xs">
                            <q-btn
                              v-if="croppedImageBase64 || cropPreviewImage"
                              flat
                              dense
                              size="xs"
                              color="grey-7"
                              icon="delete_outline"
                              label="清空图片"
                              @click="$emit('clear-photo')"
                            />
                            <q-btn
                              flat
                              dense
                              size="xs"
                              color="primary"
                              icon="camera_alt"
                              label="重新拍照"
                              @click="handleRetakeAndClose"
                            />
                          </div>
                        </div>
                        <div class="img-preview-box row items-center justify-center">
                          <img
                            v-if="croppedImageBase64 || cropPreviewImage"
                            :src="croppedImageBase64 || cropPreviewImage"
                            alt="拍照切图"
                            class="user-cropped-img"
                          />
                          <div v-else class="text-caption text-slate-400">暂无切图预览</div>
                        </div>
                      </template>

                      <!-- 2. 文字/关键词搜题模式：显示输入框、搜索和清空按钮 -->
                      <template v-else-if="activeTab === 'keyword'">
                        <div class="card-sub-header row items-center justify-between q-px-sm q-py-xs">
                          <span class="text-subtitle2 text-weight-bold text-slate-800 row items-center">
                            <q-icon name="search" size="18px" color="primary" class="q-mr-xs" />
                            关键词搜索
                          </span>
                          <q-btn
                            v-if="keywordText"
                            flat
                            dense
                            size="xs"
                            color="grey-7"
                            icon="clear"
                            label="清空"
                            @click="handleClearKeyword"
                          />
                        </div>
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
                      <div class="card-sub-header row items-center justify-between q-px-sm q-py-xs">
                        <span class="text-subtitle2 text-weight-bold text-slate-800 row items-center">
                          <q-icon name="format_list_bulleted" size="18px" color="primary" class="q-mr-xs" />
                          {{ activeTab === 'photo' ? '拍照匹配题目' : '关键词匹配题目' }}
                        </span>
                        <q-chip
                          v-if="currentQuestionData?.mathRagV2?.results"
                          size="xs"
                          color="indigo-1"
                          text-color="indigo-9"
                          class="text-weight-bold"
                        >
                          {{ currentQuestionData.mathRagV2.results.length }} 题命中
                        </q-chip>
                      </div>

                      <div class="candidate-list-scroll col overflow-auto q-px-xs q-py-xs">
                        <div v-if="isCurrentSearching" class="q-pa-md text-center">
                          <q-spinner-dots color="primary" size="32px" />
                          <div class="text-caption text-grey-7 q-mt-xs">检索中...</div>
                        </div>

                        <q-list
                          v-else-if="
                            currentQuestionData?.mathRagV2?.results &&
                            currentQuestionData.mathRagV2.results.length > 0
                          "
                          separator
                          class="rounded-borders"
                        >
                          <q-item
                            v-for="(candidate, cIdx) in currentQuestionData.mathRagV2.results"
                            :key="cIdx"
                            clickable
                            v-ripple
                            :active="
                              currentQuestionData.id === candidate.id ||
                              currentQuestionData.bmNo === String(candidate.id)
                            "
                            active-class="bg-blue-1 text-primary text-weight-bold"
                            class="q-pa-xs rounded-borders q-mb-xs"
                            @click="selectCandidateQuestion(candidate)"
                          >
                            <q-item-section>
                              <q-item-label class="text-body2 ellipsis-2-lines">
                                #{{ cIdx + 1 }}
                                <span
                                  class="markdown-content inline-markdown"
                                  v-html="renderQuestionContent(candidate)"
                                ></span>
                              </q-item-label>
                              <q-item-label caption class="row items-center q-gutter-xs q-mt-xs">
                                <q-badge
                                  size="xs"
                                  :color="
                                    candidate.same_question?.label === 'same'
                                      ? 'positive'
                                      : candidate.same_question?.label === 'likely_same'
                                        ? 'orange'
                                        : 'grey-6'
                                  "
                                >
                                  {{
                                    candidate.same_question?.label === 'same'
                                      ? '同题命中'
                                      : candidate.same_question?.label === 'likely_same'
                                        ? '疑似同题'
                                        : '相似题'
                                  }}
                                </q-badge>
                                <span class="text-grey-7"
                                  >匹配: {{ (candidate.score * 100).toFixed(0) }}%</span
                                >
                              </q-item-label>
                            </q-item-section>
                          </q-item>
                        </q-list>

                        <div v-else-if="currentQuestionData" class="q-pa-xs">
                          <q-item
                            active
                            active-class="bg-blue-1 text-primary"
                            class="rounded-borders"
                          >
                            <q-item-section>
                              <q-item-label class="text-body2 ellipsis-2-lines">
                                #1
                                <span
                                  class="markdown-content inline-markdown"
                                  v-html="renderQuestionContent(currentQuestionData)"
                                ></span>
                              </q-item-label>
                            </q-item-section>
                          </q-item>
                        </div>

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
                      <q-spinner-dots color="primary" size="40px" />
                      <div class="text-subtitle2 text-grey-7 q-mt-sm">正在检索题目并调取 MathRAG 智能分析...</div>
                    </div>

                    <div v-else-if="currentQuestionData" class="results-main-area">
                      <div class="mathrag-status-banner q-mb-sm row items-center justify-between">
                        <div class="row items-center q-gutter-xs">
                          <q-chip
                            v-if="currentQuestionData?.mathRagV2"
                            size="sm"
                            :color="mathRagBadge.color"
                            text-color="white"
                            icon="verified"
                          >
                            {{ mathRagBadge.text }}
                          </q-chip>
                          <q-chip
                            v-if="currentQuestionData?.mathRagV2?.autoReusable"
                            size="sm"
                            color="blue-1"
                            text-color="blue-9"
                            icon="auto_awesome"
                          >
                            支持自动解答复用
                          </q-chip>
                        </div>

                        <!-- 题目操作按钮区：收藏 & 加入我的练习 -->
                        <div class="question-header-actions row items-center q-gutter-xs">
                          <q-btn
                            flat
                            dense
                            size="sm"
                            :color="isFavoriteInChat ? 'amber-9' : 'grey-7'"
                            :icon="isFavoriteInChat ? 'star' : 'star_border'"
                            :label="isFavoriteInChat ? '已收藏' : '收藏'"
                            @click="handleFavoriteClick"
                          />
                          <q-btn
                            flat
                            dense
                            size="sm"
                            :color="isInPracticeList ? 'negative' : 'primary'"
                            :icon="isInPracticeList ? 'remove_circle_outline' : 'add_circle_outline'"
                            :label="isInPracticeList ? '移出练习' : '加入我的练习'"
                            @click="handleAddPracticeClick"
                          />
                        </div>

                        <div
                          v-if="
                            currentQuestionData?.mathRagV2?.conflicts &&
                            currentQuestionData.mathRagV2.conflicts.length > 0
                          "
                          class="conflict-alert-box full-width q-mt-xs"
                        >
                          <q-icon name="warning" color="warning" size="16px" class="q-mr-xs" />
                          <span class="text-caption text-orange-9">
                            提示：检测到差异 ({{ currentQuestionData.mathRagV2.conflicts.join(', ') }})，请注意甄别。
                          </span>
                        </div>
                      </div>
                      <div class="problem-text markdown-content" v-html="renderQuestionContent(currentQuestionData)"></div>
                    </div>

                    <div v-else class="empty-result-container text-center q-pa-md text-grey-6">
                      <q-icon name="search_off" size="40px" />
                      <div class="text-caption q-mt-xs">未选择或未匹配到题目</div>
                    </div>
                  </div>
                </div>

                <!-- 折叠切换控制按钮 -->
                <div class="collapse-toggle-btn" @click="toggleQuestionImage">
                  <img
                    :src="collapseToggleIcon"
                    alt="toggle"
                    class="collapse-toggle-svg"
                    :style="{ transform: isQuestionImageCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }"
                  />
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
                <img :src="textbookipIcon" alt="问AI" />
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
import SplitPanel from '@/components/base/SplitPanel.vue'
import DrawingBoardNew from '@/components/drawing/drawingBoardNew.vue'
import Toolbar from '@/components/drawing/Toolbar.vue'
import ExerciseChatPanelNew from '@/components/chat/chatpanel/ExerciseChatPanelNew.vue'
import FloatBubble from '@/components/base/Fab.vue'
import AutoHeightTextarea from '@/components/base/Textarea.vue'
import type { ExerciseItem } from '@/types'

import goBackIcon from '/icons/goback.svg'
import textbookipIcon from '/icons/textbookip.png'
import collapseToggleIcon from '/icons/collapse-toggle-icon.svg'
import zaipaiyitiIcon from '/icons/zaipaiyiti.svg'
import jiarulianxiIcon from '/icons/jiarulianxi.svg'
import shoucangIcon from '/icons/shoucang1.svg'
import xingxingLightIcon from '/icons/xingxing-light.svg'
import jiarulianxiLightIcon from '/icons/jiarulianxi-light.svg'

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
  background: linear-gradient(to right, #0f002e 4%, #ffffff 6%);
  width: 100%;
}

.panel-bg2 {
  height: 100%;
  background: linear-gradient(to left, #0f002e 4%, #ffffff 6%);
  width: 100%;
}

.panel-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to right, #0f002e 50%, #ffffff 50%);
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
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
}

.crop-preview-card,
.candidates-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.crop-preview-card {
  .img-preview-box {
    max-height: 160px;
    min-height: 100px;
    padding: 6px;
    background: #ffffff;
    border-top: 1px solid #f1f5f9;

    .user-cropped-img {
      max-width: 100%;
      max-height: 148px;
      object-fit: contain;
      border-radius: 6px;
    }
  }
}

.candidates-card {
  .card-sub-header {
    border-bottom: 1px solid #f1f5f9;
  }
}

.draft-card {
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
}

.question-image-section.collapsed {
  flex: 0.35 0 0;
}

.collapse-toggle-btn {
  position: relative;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  width: 48px;
  height: 14px;
  background: #ffffff;
  border: 1px solid rgba(110, 85, 255, 0.32);
  border-top: none;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

  .collapse-toggle-svg {
    width: 10px;
    height: 10px;
  }
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

.textbookip-float {
  position: absolute;
  bottom: 24px;
  z-index: 999;
  cursor: pointer;

  &.float-right {
    right: 24px;
  }

  &.float-left {
    left: 24px;
  }

  img {
    width: 48px;
    height: 48px;
    display: block;
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
