<template>
  <div class="mistake-book-view">
    <!-- 主体布局 -->
    <div class="main-layout">
      <!-- 左侧：图标 + 列表 -->
      <div class="layout-column left">
        <div class="column-header">
          <img :src="mistakeLogoIcon" alt="错题本" class="mistake-logo" />
        </div>
        <div class="column-main left-sidebar-card">
          <QuestionList
            class="mistake-question-list"
            type="mistake"
            :external-questions="mistakeStore.questions"
            :show-photo-search="false"
            :show-question-actions="false"
            :show-mistake-badge="false"
            @refresh="mistakeStore.fetchMistakes"
            @question-selected="handleQuestionSelected"
          />
        </div>
      </div>

      <!-- 中间装订线 -->
      <div class="layout-divider"></div>

      <!-- 右侧：筛选 + 内容 -->
      <div class="layout-column right">
        <div class="column-header">
          <div class="filter-tabs">
            <Select v-model="mistakeStore.filters.subject" :options="subjectOptions" variant="outline" class="filter-tab" />
            <Select v-model="mistakeStore.filters.source" :options="sourceOptions" variant="outline" class="filter-tab" />
          </div>
        </div>
        <div class="column-main right-content-card">
          <!-- 上部分：题目内容 -->
          <div class="question-section">
            <div class="question-body scroll-container">
              <div v-if="currentQuestionData?.structuredContent" class="structured-question-container">
                <ChoiceQuestion
                  v-if="currentQuestionData.type === 'single_choice' || currentQuestionData.type === 'multiple_choice'"
                  :question="currentQuestionData"
                  :model-value="currentQuestionChooseList"
                  :disabled="true"
                  show-title
                  :show-id="false"
                >
                  <template #extra>
                    <div class="mistake-source-info">
                      <span 
                        class="source-tag" 
                        v-if="latestRecord?.homeworkId"
                      >
                        来源于{{ latestRecord.homeworkName || '作业' }}
                      </span>
                      <span class="source-tag" v-else>来源于独立练习</span>
                    </div>
                  </template>
                </ChoiceQuestion>
                <FillBlankQuestion
                  v-else-if="currentQuestionData.type === 'fill_in_blank' || currentQuestionData.type === 'fill'"
                  :question="currentQuestionData"
                  :model-value="currentQuestionFillList"
                  :disabled="true"
                  show-title
                  :show-id="false"
                >
                  <template #extra>
                    <div class="mistake-source-info">
                      <span 
                        class="source-tag" 
                        v-if="latestRecord?.homeworkId"
                      >
                        来源于{{ latestRecord.homeworkName || '作业' }}
                      </span>
                      <span class="source-tag" v-else>来源于独立练习</span>
                    </div>
                  </template>
                </FillBlankQuestion>
                <JudgmentQuestion
                  v-else-if="currentQuestionData.type === 'true_false' || currentQuestionData.type === 'judgment'"
                  :question="currentQuestionData"
                  :model-value="currentQuestionJudgment"
                  :disabled="true"
                  show-title
                  :show-id="false"
                >
                  <template #extra>
                    <div class="mistake-source-info">
                      <span 
                        class="source-tag" 
                        v-if="latestRecord?.homeworkId"
                      >
                        来源于{{ latestRecord.homeworkName || '作业' }}
                      </span>
                      <span class="source-tag" v-else>来源于独立练习</span>
                    </div>
                  </template>
                </JudgmentQuestion>
                <BaseQuestion
                  v-else
                  :question="currentQuestionData"
                  show-title
                  :show-id="false"
                >
                  <template #extra>
                    <div class="mistake-source-info">
                      <span 
                        class="source-tag" 
                        v-if="latestRecord?.homeworkId"
                      >
                        来源于{{ latestRecord.homeworkName || '作业' }}
                      </span>
                      <span class="source-tag" v-else>来源于独立练习</span>
                    </div>
                  </template>
                </BaseQuestion>
              </div>
              <div v-else class="question-text markdown-content" v-html="renderMessageContent(currentQuestionData?.questionContent || currentQuestionData?.title || currentQuestionData?.question)"></div>
            </div>
          </div>

          <!-- 分隔线 -->
          <div class="section-divider"></div>

          <!-- 下部分：答案解析 + 按钮 -->
          <div class="answer-section" :class="{ 'is-expanded': showAnalysis }">
            <div class="answer-header-row">
              <div class="interaction-tabs">
                <div 
                  class="tab-item" 
                  :class="{ active: showAnalysis }"
                  @click="showAnalysis = !showAnalysis"
                >
                  查看解析
                  <div class="tab-indicator" v-if="showAnalysis"></div>
                </div>
              </div>

              <div class="header-actions">
                <Button
                  variant="ghost"
                  class="btn-remove"
                  label="移除"
                  @click="confirmDelete(currentMistake)"
                />
                <Button
                  variant="primary"
                  class="btn-add"
                  label="添加到习题"
                  @click="addToExerciseList(currentMistake)"
                />
              </div>
            </div>

            <!-- 答案/解析展示区 -->
            <div v-show="showAnalysis" class="answer-display scroll-container">
              <div class="explanation-content markdown-content">
                <div v-if="currentMistake?.questionData?.answer" class="standard-answer-section">
                  <div class="section-title">标准答案</div>
                  <div class="answer-text" v-html="renderMessageContent((currentMistake.questionData.answer || '').replace(/\$\s+/g, '$').replace(/\s+\$/g, '$'))"></div>
                </div>
                
                <div class="explanation-text-section">
                  <div class="section-title">题目解析</div>
                  <div class="answer-text" v-html="renderMessageContent((currentMistake?.questionData.explanation || '暂无解析').replace(/\$\s+/g, '$').replace(/\s+\$/g, '$'))"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片预览对话框 -->
    <Dialog
      ref="previewDialogRef"
      title="作答过程回顾"
      confirmButtonText="关闭"
      cancelButtonText=""
      @confirm="showPreview = false"
    >
      <div class="preview-dialog-content">
        <img :src="previewUrl" class="preview-image-large" />
      </div>
    </Dialog>

    <!-- 删除确认对话框 -->
    <Dialog
      ref="deleteDialogRef"
      title="删除确认"
      confirmButtonText="删除"
      cancelButtonText="取消"
      @confirm="doDelete"
    >
      确定要从错题本中移除这道题吗？
    </Dialog>

    <!-- 调试面板 (仅在开发环境显示) -->
    <DebugStylePanel 
      v-model="debugStyle" 
      :config="debugConfig" 
      title="Tab 细节微调" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMistakeStore } from '@/stores/mistakeStore'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { apiService } from '@/services/http/api-service'
import { showMessage } from '@/utils'
import Dialog from '@/components/base/Dialog.vue'
import Button from '@/components/base/Button.vue'
import Select from '@/components/base/Select.vue'
import QuestionList from '@/components/QuestionList.vue'
import ChoiceQuestion from '@/components/exercise/ChoiceQuestion.vue'
import FillBlankQuestion from '@/components/exercise/FillBlankQuestion.vue'
import JudgmentQuestion from '@/components/exercise/JudgmentQuestion.vue'
import BaseQuestion from '@/components/exercise/BaseQuestion.vue'
import DebugStylePanel from '@/components/dev/DebugStylePanel.vue'
import { parseQuestionStructure, mapBackendTypeToFrontend } from '@/utils/business/exercise-utils'
import type { ExerciseItem } from '@/types'
import type { MistakeItem } from '@/services/storage/mistake-storage'

import { SUBJECT_ID_TO_NAME, KNOWLEDGE_GRAPH_SUBJECT_OPTIONS } from '@/constants/subjects'
import tabBackfroundSvg from '/icons/tab_backfround.svg'
import mistakeLogoIcon from '/icons/mistakeLogo.svg'

defineOptions({
  name: 'MistakeBookView'
})

const router = useRouter()
const mistakeStore = useMistakeStore()
const { renderMessageContent } = useMessageRenderer()

const showPreview = ref(false)
const previewUrl = ref('')
const deleteDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
const previewDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
const pendingDeleteItem = ref<MistakeItem | null>(null)

// --- 调试面板配置 ---
const debugStyle = ref({
  height: 110,
  bottom: 0,
  left: -21,
  right: -1,
  bgSizeWidth: 90,
  bgSizeHeight: 100,
  showBgColor: false,
  dividerSize: 184 // 新增：装订线密度（每个书钉占用的高度）
})

const debugConfig = {
  height: { label: '高度', value: 110, min: 100, max: 250, unit: '%' },
  bottom: { label: '底部', value: 0, min: -40, max: 40, unit: 'px' },
  left: { label: '左偏', value: -21, min: -100, max: 100, unit: 'px' },
  right: { label: '右偏', value: -1, min: -100, max: 100, unit: 'px' },
  bgSizeWidth: { label: '图宽', value: 90, min: 50, max: 200, unit: '%' },
  bgSizeHeight: { label: '图高', value: 100, min: 50, max: 200, unit: '%' },
  dividerSize: { label: '装订密度', value: 184, min: 50, max: 300, unit: 'px' }, // 新增配置
  showBgColor: { label: '显色', value: false }
}
// ------------------

// 交互状态
const showAnalysis = ref(false)

/** 当前选中的错题（从 Store 获取） */
const currentMistake = computed(() => mistakeStore.currentMistake)

/** 当前选中的题目详情，确保包含结构化内容 */
const currentQuestionData = computed(() => {
  const data = currentMistake.value?.questionData
  if (!data) return null
  
  // 如果没有结构化内容但有原始结构化数据，尝试解析
  if (!data.structuredContent && data.questionStructureData) {
    const structured = parseQuestionStructure(data.questionStructureData)
    if (structured) {
      return {
        ...data,
        structuredContent: structured,
        type: data.type || mapBackendTypeToFrontend(structured.type || 'essay')
      }
    }
  }
  return data
})

/** 最新的一条作答记录 */
const latestRecord = computed(() => currentMistake.value?.practiceHistory?.[0] || null)

/** 这里的题目渲染是只读展示，所以 v-model 绑定到历史记录或空 */
const currentQuestionChooseList = computed(() => latestRecord.value?.originalAnswer?.chooseList || [])
const currentQuestionJudgment = computed(() => latestRecord.value?.originalAnswer?.judgmentValue || '')
const currentQuestionFillList = computed(() => latestRecord.value?.originalAnswer?.fillList || [])

// 监听题目切换，重置解析显示状态
watch(() => currentMistake.value?.bmNo, () => {
  showAnalysis.value = false
})

const subjectOptions = [
  { label: '全部学科', value: '全部学科' },
  ...KNOWLEDGE_GRAPH_SUBJECT_OPTIONS.map(opt => ({
    label: opt.label,
    value: opt.label
  }))
]

const sourceOptions = [
  { label: '全部来源', value: '全部来源' },
  { label: '随堂练习', value: '随堂练习' },
  { label: '课后作业', value: '课后作业' }
]

/** 处理题目选择事件（由 QuestionList 触发） */
const handleQuestionSelected = (question: ExerciseItem, index: number) => {
  mistakeStore.selectMistake(index)
}

const previewImage = (url: string) => {
  previewUrl.value = url
  showPreview.value = true
  previewDialogRef.value?.openDialog()
}

/** 添加到习题列表 */
const addToExerciseList = async (item: MistakeItem | null) => {
  if (!item) return
  try {
    const subject = item.questionData.subject || 'math'
    const response = await apiService.addQuestionToList(item.questionData, subject)
    if (response.success) {
      showMessage('已成功加入习题列表，快去练习吧', 'success')
    } else {
      showMessage('此题暂不支持加入习题集', 'error')
    }
  } catch (error) {
    showMessage('此题暂不支持加入习题集', 'error')
  }
}

/** 确认删除对话框 */
const confirmDelete = (item: MistakeItem | null) => {
  if (!item) return
  pendingDeleteItem.value = item
  deleteDialogRef.value?.openDialog()
}

/** 执行删除（通过 Store 闭环处理） */
const doDelete = async () => {
  if (pendingDeleteItem.value) {
    const index = mistakeStore.mistakes.findIndex(m => m.id === pendingDeleteItem.value?.id)
    if (index !== -1) {
      await mistakeStore.deleteMistake(index)
    }
  }
  deleteDialogRef.value?.closeDialog()
}

onMounted(async () => {
  await mistakeStore.fetchMistakes()
})

onUnmounted(() => {
  mistakeStore.clearState()
})
</script>

<style scoped lang="scss">
.mistake-book-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  // 双向渐变：135度角覆盖了从上到下和从左到右的过渡
  background: linear-gradient(135deg, #e9eaff 0%, #f2f3ff 50%, #f7f7f7 100%);
  padding: 8px 8px; // 进一步减小内边距
  box-sizing: border-box;
}

// 主布局
.main-layout {
  flex: 1;
  display: flex;
  gap: 0; // 移除间距，由 divider 控制
  min-height: 0;
  overflow: hidden;
  padding: 78px 12px 12px 12px; // 顶部留出足够空间给 header
  position: relative;
  z-index: 0;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: url('/icons/wangge.svg');
    background-repeat: repeat;
    background-position: top left;
    z-index: -1;
    pointer-events: none;
    opacity: 1; // 提高基础透明度
    
    // 优化后的双向渐变透明效果：纵向从 30% 开始淡出，横向从 60% 开始淡出
    -webkit-mask-image: linear-gradient(to bottom, black 30%, transparent 100%), 
                        linear-gradient(to right, black 60%, transparent 100%);
    mask-image: linear-gradient(to bottom, black 30%, transparent 100%), 
                linear-gradient(to right, black 60%, transparent 100%);
    -webkit-mask-composite: source-in;
    mask-composite: intersect;
  }
}

// 装订线样式
.layout-divider {
  width: 42px; // 调整宽度
  flex-shrink: 0;
  background-image: url('/icons/shuding.svg');
  background-repeat: repeat-y;
  background-size: 100% v-bind('debugStyle.dividerSize + "px"'); // 使用变量控制密度
  background-position: center;
  z-index: 20;
  margin: 0 -12px; // 让两侧卡片贴近并位于装订线下层
  pointer-events: none;
}

// 列布局
.layout-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;

  &.left {
    width: 320px;
  }
  &.right {
    flex: 1;
  }
}

// 列头部（图标或筛选）
.column-header {
  height: 0; // 设为0，依靠内容和绝对定位
  position: relative;
  z-index: 10;
  overflow: visible;
  
  .mistake-logo {
    position: absolute;
    bottom: 20px;
    width: 100px;
    height: auto;
  }

  .filter-tabs {
    position: absolute;
    bottom: 0;
    right: 32px;
    display: flex;
    gap: 8px;
    overflow: visible;

    .filter-tab {
      position: relative;
      overflow: visible;
      display: flex;
      align-items: flex-end;
      margin: 0 5px;

      &::before {
        content: '';
        position: absolute;
        left: v-bind('debugStyle.left + "px"');
        right: v-bind('debugStyle.right + "px"');
        bottom: v-bind('debugStyle.bottom + "px"');
        height: v-bind('debugStyle.height + "%"');
        background-image: url('/icons/tab_backfround.svg');
        background-size: v-bind('debugStyle.bgSizeWidth + "%"') v-bind('debugStyle.bgSizeHeight + "%"');
        background-repeat: no-repeat;
        background-position: center bottom;
        background-color: v-bind('debugStyle.showBgColor ? "rgba(255,0,0,0.3)" : "transparent"');
        pointer-events: none;
        z-index: -1;
      }

      :deep(.select-trigger--outline),
      :deep(.date-trigger) {
        background: transparent;
        border: none;
        color: #393548;
        height: 36px;
        padding: 0 16px;
        font-size: 13px;
        font-weight: 500;
        min-width: unset;

        &:hover {
          opacity: 0.9;
        }

        .select-icon, .date-icon {
          filter: none;
          opacity: 0.6;
          width: 14px;
        }
      }
    }
  }
}

// 主内容卡片
.column-main {
  flex: 1;
  background: white;
  border-radius: 32px;
  border: 1px solid rgba(238, 240, 247, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;

  // 统一的叠层阴影
  box-shadow: 
    0 6px 0 0 #ffffff,
    0 6px 12px 0 rgba(97, 94, 254, 0.08),
    0 12px 0 0 #ffffff,
    0 12px 20px 0 rgba(97, 94, 254, 0.04);
}

.left-sidebar-card {
}

.right-content-card {
  padding: 0; // 内部区域自行管理 padding
  display: flex;
  flex-direction: column;
}

.question-section {
  flex: 1;
  padding: 24px;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.section-divider {
  height: 1px;
  background: #f0f2f7;
  margin: 0 24px;
}

.answer-section {
  flex: none;
  display: flex;
  flex-direction: column;
  padding: 16px 24px 0px 24px;
  min-height: 0;
  border-radius: 0 0 32px 32px;
  overflow: hidden;

  &.is-expanded {
    flex: 1.2; // 稍微多给一点空间给解析
  }
}

.answer-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .interaction-tabs {
    margin-bottom: 0;
    border-bottom: none;
    gap: 24px;

    .tab-item {
      padding: 4px 0;
      font-size: 15px;
    }
  }

  .header-actions {
    display: flex;
    gap: 12px;

    .btn-remove {
      border: 1px solid #ff5e5e !important;
      color: #ff5e5e !important;
      border-radius: 12px !important;
      height: 36px;
      padding: 0 20px;
      background: white;
      
      &:hover {
        background: #fff5f5;
      }
    }

    .btn-add {
      border-radius: 12px !important;
      height: 36px;
      padding: 0 20px;
      background: #615efe;
    }
  }
}

.mistake-source-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 12px;
  flex: 1;

  .source-tag {
    background: #f0f2ff;
    color: #615efe;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 12px;
    display: flex;
    align-items: center;
  }

}

.latest-badge {
  display: inline-block;
  background: #615efe;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 12px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-item {
  background: white;
  border: 1px solid #f0f2ff;
  border-radius: 12px;
  padding: 12px;
  
  .history-item-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    border-bottom: 1px dashed #f0f2f7;
    padding-bottom: 4px;
    
    .history-time {
      font-size: 12px;
      color: #999;
    }
    
    .history-source {
      font-size: 12px;
      color: #615efe;
      background: #f0f2ff;
      padding: 0 6px;
      border-radius: 4px;
    }
  }
  
  .history-item-body {
    .history-answer-text {
      font-size: 14px;
      color: #333;
    }
    
    .history-answer-image {
      img {
        max-width: 100%;
        max-height: 120px;
        border-radius: 4px;
        cursor: zoom-in;
      }
    }
  }
}

.standard-answer-section, .explanation-text-section {
  margin-bottom: 24px;
  
  .section-title {
    font-weight: bold;
    color: #615efe;
    font-size: 15px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    
    &::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 14px;
      background: #615efe;
      margin-right: 8px;
      border-radius: 2px;
    }
  }
}

.answer-text {
  color: #374151;
  line-height: 1.7;
  font-size: 15px;
  
  :deep(p) {
    margin-bottom: 8px;
    &:last-child {
      margin-bottom: 0;
    }
  }
}

.question-body {
  flex: 1;
  min-height: 0;
  margin-bottom: 20px;
  padding-right: 8px;

  .question-text {
    font-size: 16px;
    color: #333;
    line-height: 1.8;
  }

  .question-image-container {
    margin-top: 12px;
    img {
      max-width: 100%;
      max-height: 200px;
      border-radius: 12px;
      cursor: zoom-in;
    }
  }
}

.interaction-tabs {
  display: flex;
  gap: 32px;
  margin-bottom: 12px;
  border-bottom: 1px solid #f0f2f7;

  .tab-item {
    font-size: 16px;
    color: #999;
    cursor: pointer;
    position: relative;
    padding: 8px 0;

    &.active {
      color: #333;
      font-weight: bold;

      .tab-indicator {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 20px;
        height: 3px;
        background: #615efe;
        border-radius: 2px;
      }
    }
  }
}

.answer-display {
  flex: 1;
  background: #fcfcff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid #f0f2ff;

  .no-data {
    color: #ccc;
    text-align: center;
    padding: 20px;
  }

  .handwritten-image {
    max-width: 100%;
    max-height: 300px;
    border-radius: 8px;
    cursor: zoom-in;

    .image-placeholder-small {
      width: 120px;
      height: 100%;
      background: #eeeeee;
      border-radius: 8px;
    }
  }
}

.scroll-container {
  overflow-y: auto;
  
  /* 自定义滚动条 */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #e0e0ff;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #d0d0ff;
  }
}

.loading-state, .empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  background: white;
  border-radius: 24px;
}

.placeholder {
  text-align: center;
}

.empty-icon {
  width: 160px;
  height: 160px;
  margin-bottom: 24px;
  opacity: 0.5;
}

.no-data {
  color: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.bottom-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f2f7;

  .btn-remove {
    border: 1px solid #ff5e5e !important;
    color: #ff5e5e !important;
    border-radius: 20px !important;
    min-width: 100px;
  }

  .btn-add {
    border-radius: 20px !important;
    min-width: 120px;
  }
}
</style>
