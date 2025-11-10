<template>
  <div class="photo-search-drawer">
    <div class="drawer-content">
      <!-- 识别图片区域 -->
      <div class="drawer-image-section">
        <div class="image-tabs">
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

        <!-- 拍照搜题内容 -->
        <div v-if="activeTab === 'photo'" class="recognized-problem">
          <div
            class="problem-text"
            v-if="photoQuestionData"
            v-html="renderQuestionContent(photoQuestionData)"
          ></div>
          <div v-else class="no-question-placeholder">
            <q-icon name="quiz" size="48px" color="grey-5" />
            <p>未识别到题目</p>
          </div>
        </div>

        <!-- 关键词搜题内容 -->
        <div v-if="activeTab === 'keyword'" class="keyword-search-container">
          <div class="keyword-input-wrapper">
            <q-input
              v-model="keywordText"
              type="textarea"
              class="keyword-input"
              placeholder="可输入关键字进行精确搜题:&#10;输入题目的关键词,空格或逗号分隔多个关键词"
              :rows="4"
              outlined
              autogrow
              @keydown.ctrl.enter="handleKeywordSearch"
              @keydown.meta.enter="handleKeywordSearch"
            />
            <q-btn
              round
              class="keyword-search-btn"
              color="primary"
              icon="search"
              @click="handleKeywordSearch"
              :loading="isKeywordSearching"
              :disable="!keywordText.trim()"
            />
          </div>
          <!-- 关键词搜索结果展示 -->
          <div
            v-if="keywordQuestionData && activeTab === 'keyword'"
            class="keyword-search-result"
          >
            <div class="problem-text" v-html="renderQuestionContent(keywordQuestionData)"></div>
          </div>
        </div>
      </div>
      <!-- ChatView 区域 -->
      <div class="drawer-chat-section">
        <ChatView
          v-if="currentQuestionData"
          :key="currentQuestionData?.bmNo || 'default'"
          ref="chatViewRef"
          type="ai-exercise"
          :override-question="currentQuestionData"
        >
          <template #input>
            <PhotoSearchInput
              :model-value="chatInputMessage"
              :current-question="currentQuestionData"
              :placeholder-text="'按住提问'"
              :is-loading="isChatLoading"
              @update:model-value="chatInputMessage = $event"
              @send-message="handleChatSendMessage"
              @retake="handleRetake"
              @favorite="handleFavoriteInChat"
              @add-to-practice="handleAddToPracticeInChat"
              @blur="onChatInputBlur"
            />
          </template>
        </ChatView>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import ChatView from './ChatView.vue'
import PhotoSearchInput from './PhotoSearchInput.vue'
import { apiService } from '../services/api-service'
import { showMessage } from '../utils'
import type { ExerciseItem } from '../types'
import { useMessageRenderer } from '../composables/useMessageRenderer'

const route = useRoute()
const { renderMessageContent } = useMessageRenderer()

// 状态管理
const activeTab = ref<'photo' | 'keyword'>('photo')
const keywordText = ref<string>('')
const isKeywordSearching = ref(false)
const photoQuestionData = ref<ExerciseItem | null>(null)
const keywordQuestionData = ref<ExerciseItem | null>(null)

// ChatView 相关状态
const chatViewRef = ref<InstanceType<typeof ChatView> | null>(null)
const chatInputMessage = ref<string>('')
const isChatLoading = ref(false)

// 根据当前tab返回对应的题目数据
const currentQuestionData = computed(() => {
  return activeTab.value === 'photo' ? photoQuestionData.value : keywordQuestionData.value
})

// 渲染题目内容
const renderQuestionContent = (question: ExerciseItem) => {
  if (!question) return ''
  return renderMessageContent(question.question || '')
}

// 关键词搜索
const handleKeywordSearch = async () => {
  const keyword = keywordText.value.trim()
  if (!keyword) {
    showMessage('请输入关键词', 'warning')
    return
  }

  isKeywordSearching.value = true
  try {
    const subject = (route.query.subject as string) || 'math'
    const question = await apiService.searchQuestionByText(keyword, subject)
    
    if (question) {
      keywordQuestionData.value = question
      activeTab.value = 'keyword'
      showMessage('搜索成功', 'positive')
    } else {
      showMessage('未搜索到相关题目', 'warning')
    }
  } catch (error) {
    console.error('关键词搜索失败:', error)
    showMessage('搜索失败，请重试', 'negative')
  } finally {
    isKeywordSearching.value = false
  }
}

// 聊天相关方法
const handleChatSendMessage = () => {
  // PhotoSearchInput 的 send-message 事件不带参数
  // ChatView 组件会自己处理消息发送
  // 这里只需要更新状态
  if (chatInputMessage.value.trim()) {
    // 消息已通过 v-model 绑定到 chatInputMessage
    // ChatView 会处理实际的发送逻辑
  }
}

const handleRetake = () => {
  // 通知 Android 端重新拍照
  if (window.AndroidBridge) {
    window.AndroidBridge.openBlankPage()
  }
}

const handleFavoriteInChat = () => {
  // 收藏功能
  console.log('收藏题目')
}

const handleAddToPracticeInChat = () => {
  // 添加到练习
  console.log('添加到练习')
}

const onChatInputBlur = () => {
  // 输入框失焦处理
}

// 监听 Android 端传递的题目数据
const handleQuestionData = (question: ExerciseItem) => {
  photoQuestionData.value = question
  activeTab.value = 'photo'
}

// 监听路由参数变化
watch(() => route.query, (newQuery) => {
  if (newQuery.questionId) {
    // 如果有题目ID，可以加载题目数据
    console.log('题目ID:', newQuery.questionId)
  }
}, { immediate: true })

// 监听 Android Bridge 事件
onMounted(() => {
  // 注册全局方法，供 Android 调用
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).setPhotoSearchQuestionData = (questionData: ExerciseItem) => {
      handleQuestionData(questionData)
    }
  }
  
  // 监听 Android 端的关键词搜索结果
  if (typeof window !== 'undefined' && window.onDataUpdate) {
    const originalOnDataUpdate = window.onDataUpdate
    window.onDataUpdate = (type: string, data: unknown) => {
      if (type === 'keywordSearchResult') {
        keywordQuestionData.value = data as ExerciseItem
        activeTab.value = 'keyword'
      }
      if (originalOnDataUpdate) {
        originalOnDataUpdate(type, data)
      }
    }
  }
})

onUnmounted(() => {
  // 清理
  if (typeof window !== 'undefined') {
    delete (window as unknown as Record<string, unknown>).setPhotoSearchQuestionData
  }
})
</script>

<style scoped lang="scss">
.photo-search-drawer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}

.drawer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-image-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.image-tabs {
  display: flex;
  background: #f5f5f5;
  padding: 12px;
  gap: 0;
}

.tab-item {
  flex: 1;
  padding: 8px;
  text-align: center;
  font-size: 14px;
  color: #666666;
  background: #f5f5f5;
  cursor: pointer;
  transition: all 0.3s;
  
  &.active {
    background: #ffffff;
    color: #333333;
  }
}

.recognized-problem {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #ffffff;
}

.problem-text {
  line-height: 1.6;
  color: #333333;
}

.no-question-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: #999999;
  
  p {
    margin-top: 16px;
    font-size: 14px;
  }
}

.keyword-search-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.keyword-input-wrapper {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.keyword-input {
  flex: 1;
}

.keyword-search-btn {
  align-self: flex-start;
}

.keyword-search-result {
  flex: 1;
  overflow-y: auto;
  margin-top: 16px;
}

.drawer-chat-section {
  height: 50%;
  min-height: 300px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
