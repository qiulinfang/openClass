<template>
  <Modal 
    v-model="localVisible" 
    title="问答详情"
    :initial-width="700"
    :initial-height="600"
    :min-width="500"
    :min-height="400"
    title-align="left"
    header-background-color="#ffffff"
    class="qa-detail-dialog"
  >
    <div class="qa-detail-content">
      <!-- 问题区域 -->
      <div class="qa-section question-section">
        <div class="section-title">
          <q-icon name="help_outline" class="section-icon" />
          <span>问题</span>
        </div>
        <div class="section-content" v-html="renderContent(question)"></div>
      </div>

      <!-- 答案区域 -->
      <div v-if="answer" class="qa-section answer-section">
        <div class="section-title">
          <q-icon name="check_circle" class="section-icon" />
          <span>答案</span>
        </div>
        <div class="section-content" v-html="renderContent(answer)"></div>
      </div>

      <!-- 无答案提示 -->
      <div v-else class="qa-empty-state">
        <q-icon name="info" size="48px" color="grey-5" />
        <div class="empty-text">暂无答案内容</div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import Modal from '../base/Modal.vue'

interface Props {
  modelValue: boolean
  question: string
  answer?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  question: '',
  answer: ''
})

const emit = defineEmits<Emits>()

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 使用消息渲染器
const { renderMessageContent } = useMessageRenderer()

// 渲染内容（支持Markdown和公式）
const renderContent = (content: string) => {
  if (!content) return ''
  return renderMessageContent(content)
}
</script>

<style lang="scss" scoped>
.qa-detail-dialog {
  :deep(.dialog-header-section) {
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }
}

.qa-detail-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
    
    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }
}

.qa-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #202124;
  
  .section-icon {
    font-size: 20px;
  }
}

.question-section {
  .section-icon {
    color: #1976d2;
  }
}

.answer-section {
  .section-icon {
    color: #4caf50;
  }
}

.section-content {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: #202124;
  word-wrap: break-word;
  word-break: break-word;

  :deep(p) {
    margin: 0 0 12px 0;
    
    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 12px 0;
  }

  :deep(code) {
    background: #e8eaed;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
  }

  :deep(pre) {
    background: #f1f3f4;
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 12px 0;
  }

  :deep(ul), :deep(ol) {
    margin: 12px 0;
    padding-left: 24px;
  }

  :deep(li) {
    margin: 6px 0;
  }

  :deep(blockquote) {
    border-left: 3px solid #1976d2;
    margin: 12px 0;
    padding: 8px 16px;
    background: #e3f2fd;
    border-radius: 4px;
  }
}

.qa-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #9aa0a6;

  .empty-text {
    margin-top: 16px;
    font-size: 14px;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .qa-detail-content {
    padding: 16px;
    gap: 20px;
  }

  .section-title {
    font-size: 15px;
    
    .section-icon {
      font-size: 18px;
    }
  }

  .section-content {
    padding: 12px;
    font-size: 13px;
  }
}
</style>
