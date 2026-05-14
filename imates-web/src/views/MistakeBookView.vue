<template>
  <div class="mistake-book-view">
    <div class="header">
      <div class="back-btn" @click="goBack">
        <img src="/icons/back.svg" alt="back" />
        <span>返回</span>
      </div>
      <h1 class="title">错题本</h1>
    </div>
    
    <div class="mistake-content">
      <div v-if="loading" class="loading-state">
        <q-spinner color="primary" size="3em" />
        <p>正在加载错题...</p>
      </div>
      
      <div v-else-if="mistakes.length === 0" class="empty-state">
        <div class="placeholder">
          <img src="/icons/my_exercises.svg" alt="empty" class="empty-icon" />
          <p>错题本空空如也，快去练习吧</p>
        </div>
      </div>
      
      <div v-else class="mistake-list">
        <div v-for="item in mistakes" :key="item.id" class="mistake-card">
          <div class="card-header">
            <div class="source-info">
              <q-icon name="assignment" color="primary" size="20px" />
              <span class="homework-name">{{ item.homeworkName || '独立练习' }}</span>
              <span class="time">{{ formatDate(item.timestamp) }}</span>
            </div>
            <div class="actions">
              <q-btn
                flat
                dense
                color="primary"
                class="action-btn"
                @click="addToExerciseList(item)"
              >
                <q-icon name="add_circle_outline" size="18px" class="q-mr-xs" />
                <span>加入习题列表</span>
              </q-btn>
              <q-btn
                flat
                dense
                color="red"
                icon="delete_outline"
                @click="confirmDelete(item)"
              />
            </div>
          </div>
          
          <div class="card-body">
            <!-- 题干 -->
            <div class="question-stem">
              <div class="label">题目内容</div>
              <div class="content markdown-content" v-html="renderMessageContent(item.questionData.questionContent || item.questionData.title)"></div>
            </div>
            
            <div class="answer-comparison">
              <!-- 学生原始作答 -->
              <div class="original-answer">
                <div class="label">我的作答</div>
                <div class="answer-content">
                  <div v-if="item.originalAnswer" class="user-answer-detail">
                    <div v-if="item.originalAnswer.chooseList && item.originalAnswer.chooseList.length > 0" class="choice-answer">
                      <span class="prefix">选择：</span>
                      <span class="value">{{ item.originalAnswer.chooseList.join(', ') }}</span>
                    </div>
                    <div v-else-if="item.originalAnswer.judgmentValue" class="judgment-answer">
                      <span class="prefix">判断：</span>
                      <span class="value">{{ item.originalAnswer.judgmentValue }}</span>
                    </div>
                    <div v-else-if="item.originalAnswer.imageData" class="board-answer">
                      <img :src="item.originalAnswer.imageData" alt="我的手写过程" class="handwritten-image" @click="previewImage(item.originalAnswer.imageData)" />
                    </div>
                    <div v-else class="no-data">暂无详细作答记录</div>
                  </div>
                  <div v-else class="no-data">暂无记录</div>
                </div>
              </div>
              
              <!-- 标准答案 -->
              <div class="standard-answer">
                <div class="label">标准答案</div>
                <div class="answer-content markdown-content" v-html="renderMessageContent(item.questionData.answer)"></div>
              </div>
            </div>
            
            <!-- 题目解析 (可选展开) -->
            <div class="explanation-section" v-if="item.questionData.explanation">
              <q-expansion-item
                label="查看题目解析"
                header-class="explanation-header"
                dense
              >
                <div class="explanation-content markdown-content" v-html="renderMessageContent(item.questionData.explanation)"></div>
              </q-expansion-item>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片预览对话框 -->
    <q-dialog v-model="showPreview">
      <q-card style="max-width: 90vw; max-height: 90vh">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">作答过程回顾</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section>
          <img :src="previewUrl" style="width: 100%; object-fit: contain" />
        </q-card-section>
      </q-card>
    </q-dialog>

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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAllMistakes, deleteMistake, type MistakeItem } from '@/services/storage/mistake-storage'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { apiService } from '@/services/http/api-service'
import { showMessage } from '@/utils'
import Dialog from '@/components/base/Dialog.vue'

defineOptions({
  name: 'MistakeBookView'
})

const router = useRouter()
const { renderMessageContent } = useMessageRenderer()

const mistakes = ref<MistakeItem[]>([])
const loading = ref(true)
const showPreview = ref(false)
const previewUrl = ref('')
const deleteDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
const pendingDeleteItem = ref<MistakeItem | null>(null)

const goBack = () => {
  router.back()
}

const loadMistakes = async () => {
  loading.value = true
  try {
    mistakes.value = await getAllMistakes()
  } finally {
    loading.value = false
  }
}

const formatDate = (ts: number) => {
  const date = new Date(ts)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const previewImage = (url: string) => {
  previewUrl.value = url
  showPreview.value = true
}

const addToExerciseList = async (item: MistakeItem) => {
  try {
    const subject = item.questionData.subject || 'math'
    const success = await apiService.addQuestionToList(item.questionData, subject)
    if (success) {
      showMessage('已成功加入习题列表，快去练习吧', 'success')
    } else {
      showMessage('加入习题列表失败', 'error')
    }
  } catch (error) {
    showMessage('操作失败', 'error')
  }
}

const confirmDelete = (item: MistakeItem) => {
  pendingDeleteItem.value = item
  deleteDialogRef.value?.openDialog()
}

const doDelete = async () => {
  if (pendingDeleteItem.value) {
    try {
      await deleteMistake(pendingDeleteItem.value.id)
      await loadMistakes()
      showMessage('已从错题本移除', 'success')
    } catch (error) {
      showMessage('删除失败', 'error')
    }
  }
  deleteDialogRef.value?.closeDialog()
}

onMounted(() => {
  loadMistakes()
})
</script>

<style scoped lang="scss">
.mistake-book-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f7f6ff;
}

.header {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  z-index: 10;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #666;
  font-size: 16px;
  margin-right: 24px;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;

  &:hover {
    background: #f0f0ff;
  }
}

.back-btn img {
  width: 20px;
  height: 20px;
  margin-right: 4px;
}

.title {
  font-size: 20px;
  font-weight: bold;
  color: #333;
  margin: 0;
}

.mistake-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.loading-state, .empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
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

.mistake-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.mistake-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  border: 1px solid #edf2f7;
}

.card-header {
  padding: 16px 20px;
  background: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #edf2f7;

  .source-info {
    display: flex;
    align-items: center;
    gap: 8px;

    .homework-name {
      font-weight: 600;
      color: #2d3748;
    }

    .time {
      font-size: 13px;
      color: #a0aec0;
      margin-left: 8px;
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;

    .action-btn {
      font-size: 13px;
      padding: 4px 12px;
    }
  }
}

.card-body {
  padding: 20px;

  .label {
    font-size: 14px;
    font-weight: 600;
    color: #718096;
    margin-bottom: 8px;
    display: flex;
    align-items: center;

    &::before {
      content: '';
      width: 4px;
      height: 14px;
      background: #615efe;
      border-radius: 2px;
      margin-right: 8px;
    }
  }
}

.question-stem {
  margin-bottom: 24px;
  
  .content {
    font-size: 16px;
    color: #2d3748;
    line-height: 1.6;
  }
}

.answer-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;

  .answer-content {
    background: #f8fafc;
    border-radius: 12px;
    padding: 16px;
    min-height: 80px;
    font-size: 15px;
    color: #4a5568;
    border: 1px solid #edf2f7;
  }

  .original-answer .answer-content {
    border-color: #fed7d7;
    background: #fff5f5;
  }

  .standard-answer .answer-content {
    border-color: #c6f6d5;
    background: #f0fff4;
  }
}

.user-answer-detail {
  .prefix {
    font-weight: 600;
    color: #e53e3e;
  }
  
  .value {
    color: #2d3748;
  }

  .handwritten-image {
    max-width: 100%;
    max-height: 200px;
    border-radius: 8px;
    cursor: zoom-in;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.02);
    }
  }
}

.no-data {
  color: #a0aec0;
  font-style: italic;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.explanation-section {
  margin-top: 16px;
  border-top: 1px dashed #edf2f7;
  padding-top: 16px;

  :deep(.explanation-header) {
    color: #615efe;
    font-weight: 500;
    padding: 0;
    min-height: unset;
    
    .q-item__section--main {
      font-size: 14px;
    }
  }

  .explanation-content {
    margin-top: 12px;
    font-size: 14px;
    color: #4a5568;
    line-height: 1.6;
    padding: 12px;
    background: #f7fafc;
    border-radius: 8px;
  }
}
</style>
