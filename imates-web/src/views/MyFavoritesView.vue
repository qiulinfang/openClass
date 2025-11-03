<template>
  <div class="my-favorites-view">
    <!-- 头部区域 -->
    <div class="header">
      <!-- 返回按钮 -->
      <q-btn
        flat
        round
        dense
        icon="arrow_back"
        @click="goBack"
        class="back-btn"
        color="white"
      />
      
      <!-- 标签页 -->
      <div class="tabs-container">
        <div
          class="tab"
          :class="{ active: activeTab === 'qa' }"
          @click="activeTab = 'qa'"
        >
          问答收藏
        </div>
        <div
          class="tab"
          :class="{ active: activeTab === 'exercise' }"
          @click="activeTab = 'exercise'"
        >
          练习收藏
        </div>
      </div>
      
      <!-- 占位符保持居中 -->
      <div class="placeholder"></div>
    </div>
    
    <!-- 内容区域 -->
    <div class="content-area">
      <!-- 问答收藏列表 -->
      <div v-if="activeTab === 'qa'" class="list-container">
        <div v-if="qaFavorites.length === 0 && !isLoadingQa" class="empty-state">
          <q-icon name="chat_bubble_outline" size="80px" color="grey-5" />
          <div class="text-h6 q-mt-md text-grey-7">暂无问答收藏</div>
          <div class="text-body2 text-grey-6 q-mt-sm">
            收藏的问答会话将显示在这里
          </div>
        </div>
        
        <div v-else class="favorites-list">
          <div
            v-for="(item, index) in qaFavorites"
            :key="item.id || index"
            class="favorite-card qa-card"
            @click="handleQaCardClick(item.record)"
          >
            <div class="card-content">
              <div class="card-text" v-html="renderContent(item.record.question)"></div>
              <div v-if="item.record.answer" class="card-answer">
                {{ truncateText(item.record.answer, 100) }}
              </div>
              <div class="card-timestamp">{{ formatTimestamp(item.timestamp) }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 练习收藏列表 -->
      <div v-if="activeTab === 'exercise'" class="list-container">
        <div v-if="exerciseFavorites.length === 0 && !isLoadingExercise" class="empty-state">
          <q-icon name="quiz" size="80px" color="grey-5" />
          <div class="text-h6 q-mt-md text-grey-7">暂无练习收藏</div>
          <div class="text-body2 text-grey-6 q-mt-sm">
            收藏的练习题目将显示在这里
          </div>
        </div>
        
        <div v-else class="favorites-list">
          <div
            v-for="(item, index) in exerciseFavorites"
            :key="item.id || index"
            class="favorite-card exercise-card"
            @click="handleExerciseCardClick(item.item)"
          >
            <div class="card-content">
              <div class="card-text" v-html="renderContent(item.item.question || item.item.title)"></div>
              <div class="card-timestamp">{{ formatTimestamp(item.timestamp) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 问答详情对话框 -->
    <QaDetailDialog
      v-model="showQaDialog"
      :question="currentQaRecord?.question || ''"
      :answer="currentQaRecord?.answer || ''"
    />
    
    <!-- 统一聊天对话框 -->
    <UnifiedChatDialog 
      ref="unifiedChatDialogRef"
      v-model="showUnifiedChatDialog"
      :initial-category="initialCategory"
      :initial-teacher-subject="initialTeacherSubject"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onActivated, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { getFavoriteQas, getFavoriteExercises } from '../utils/favorites'
import type { QuestionRecord } from '../types/chat'
import type { ExerciseItem } from '../types/exercise'
import QaDetailDialog from '../components/QaDetailDialog.vue'
import UnifiedChatDialog from '../components/UnifiedChatDialog.vue'
import { Subject } from '../types'

// 定义组件名称
defineOptions({
  name: 'MyFavoritesView'
})

const router = useRouter()

// 使用消息渲染器
const { renderMessageContent } = useMessageRenderer()

// 响应式数据
const activeTab = ref<'qa' | 'exercise'>('qa')
const qaFavorites = ref<Array<{
  id: string
  record: QuestionRecord
  timestamp: number
}>>([])
const exerciseFavorites = ref<Array<{
  id: string
  item: ExerciseItem
  timestamp: number
}>>([])
const isLoadingQa = ref(false)
const isLoadingExercise = ref(false)

// 问答对话框状态
const showQaDialog = ref(false)
const currentQaRecord = ref<QuestionRecord | null>(null)

// 统一聊天对话框状态
const showUnifiedChatDialog = ref(false)
const unifiedChatDialogRef = ref<InstanceType<typeof UnifiedChatDialog> | null>(null)
const initialCategory = ref<'ai' | 'teacher'>('ai')
const initialTeacherSubject = ref<'biology' | 'math'>('math')

// 方法
const goBack = () => {
  router.back()
}

// 判断收藏的对话类型（AI聊天还是教师答疑）
const getChatType = (record: QuestionRecord): { type: 'ai' | 'teacher', subject?: 'biology' | 'math' } => {
  // 检查是否是教师答疑会话（通过 localStorage key 判断）
  const teacherSessionKey = `teacher_chat_${record.id}_session`
  const teacherSessionData = localStorage.getItem(teacherSessionKey)
  
  if (teacherSessionData) {
    try {
      const session = JSON.parse(teacherSessionData)
      if (session && session.subject) {
        return {
          type: 'teacher',
          subject: session.subject === 'biology' ? 'biology' : 'math'
        }
      }
    } catch (error) {
      console.error('解析教师会话数据失败:', error)
    }
  }
  
  // 默认是 AI 聊天
  return { type: 'ai' }
}

// 处理问答卡片点击 - 打开 UnifiedChatDialog
const handleQaCardClick = async (record: QuestionRecord) => {
  // 判断对话类型
  const chatType = getChatType(record)
  initialCategory.value = chatType.type
  
  if (chatType.type === 'teacher' && chatType.subject) {
    initialTeacherSubject.value = chatType.subject
  }
  
  // 打开对话框
  showUnifiedChatDialog.value = true
  
  // 等待对话框打开并且会话列表加载完成
  await nextTick()
  // 再等待一个 tick，确保 UnifiedChatDialog 的 watch 已经执行
  await nextTick()
  
  if (unifiedChatDialogRef.value) {
    if (chatType.type === 'teacher') {
      // 确保加载了教师会话列表
      unifiedChatDialogRef.value.loadTeacherSessions()
      await nextTick()
      // 设置对应的教师会话
      unifiedChatDialogRef.value.setTeacherSession(record.id)
    } else {
      // AI 聊天：切换到对应的会话
      const { useAiGeneralChatStore } = await import('@/stores/aiGeneralChatStore')
      const aiGeneralStore = useAiGeneralChatStore()
      await aiGeneralStore.loadSessions()
      
      // 切换到对应的会话
      const session = aiGeneralStore.sessions.find((s: any) => s.sessionId === record.id)
      if (session) {
        await aiGeneralStore.switchSession(record.id)
      } else {
        console.warn('未找到对应的 AI 会话:', record.id)
      }
    }
  }
}

// 处理练习卡片点击 - 跳转到我的习题
const handleExerciseCardClick = async (item: ExerciseItem) => {
  try {
    // 跳转到我的习题页面
    // 使用 questionId 参数来标识要定位的题目
    router.push({
      name: 'exerciseSolve',
      query: {
        questionId: item.bmNo || item.id,
        subject: item.subject === 'biology' ? 'SUBJECT_BIOLOGY' : 'SUBJECT_MATH',
        token: localStorage.getItem('token') || ''
      }
    })
  } catch (error) {
    console.error('跳转到我的习题失败:', error)
  }
}

// 渲染内容（支持Markdown和公式）
const renderContent = (content: string) => {
  if (!content) return ''
  return renderMessageContent(content)
}

// 格式化时间戳
const formatTimestamp = (timestamp: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 截断文本
const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text || ''
  return text.substring(0, maxLength) + '...'
}

// 加载问答收藏
const loadQaFavorites = async () => {
  isLoadingQa.value = true
  try {
    // 从工具函数获取收藏的问答会话
    const favorites = getFavoriteQas()
    
    // 按时间戳倒序排列
    favorites.sort((a, b) => b.timestamp - a.timestamp)
    qaFavorites.value = favorites
  } catch (error) {
    console.error('加载问答收藏失败:', error)
  } finally {
    isLoadingQa.value = false
  }
}

// 加载练习收藏
const loadExerciseFavorites = async () => {
  isLoadingExercise.value = true
  try {
    // 从工具函数获取收藏的练习题目
    const favorites = getFavoriteExercises()
    
    // 按时间戳倒序排列
    favorites.sort((a, b) => b.timestamp - a.timestamp)
    exerciseFavorites.value = favorites
  } catch (error) {
    console.error('加载练习收藏失败:', error)
  } finally {
    isLoadingExercise.value = false
  }
}

// 监听标签页切换
watch(activeTab, async (newTab) => {
  if (newTab === 'qa') {
    await loadQaFavorites()
  } else {
    await loadExerciseFavorites()
  }
})

// 生命周期
onMounted(async () => {
  // 加载当前标签页的收藏数据
  if (activeTab.value === 'qa') {
    await loadQaFavorites()
  } else {
    await loadExerciseFavorites()
  }
})

// 监听路由激活，刷新收藏列表（从其他页面返回时）
onActivated(async () => {
  // 刷新当前标签页的收藏数据
  if (activeTab.value === 'qa') {
    await loadQaFavorites()
  } else {
    await loadExerciseFavorites()
  }
})

// 暴露方法
defineExpose({
  loadQaFavorites,
  loadExerciseFavorites
})
</script>

<style lang="scss" scoped>
// 变量定义
$header-bg: #5E4A8C;
$tab-active-color: #ffffff;
$tab-inactive-color: rgba(255, 255, 255, 0.6);
$card-bg: #ffffff;
$card-border: rgba(0, 0, 0, 0.06);
$text-primary: #202124;
$text-secondary: #5f6368;
$text-tertiary: #9aa0a6;

// 主容器
.my-favorites-view {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

// 头部样式
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: $header-bg;
  color: white;
  position: relative;
  z-index: 10;
  
  .back-btn {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
  }
  
  .tabs-container {
    display: flex;
    gap: 0;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 4px;
  }
  
  .tab {
    padding: 8px 24px;
    font-size: 15px;
    font-weight: 500;
    color: $tab-inactive-color;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 6px;
    white-space: nowrap;
    
    &.active {
      color: $tab-active-color;
      background: rgba(255, 255, 255, 0.2);
      font-weight: 600;
    }
    
    &:hover:not(.active) {
      color: rgba(255, 255, 255, 0.8);
    }
  }
  
  .placeholder {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }
}

// 内容区域
.content-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// 列表容器
.list-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  
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

// 空状态
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  padding: 32px 20px;
  
  .text-h6 {
    color: $text-secondary;
    font-weight: 400;
    margin-top: 16px;
  }
}

// 收藏列表
.favorites-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// 收藏卡片
.favorite-card {
  background: $card-bg;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid $card-border;
  box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 2px 8px 0 rgba(60, 64, 67, 0.15);
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  .card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .card-text {
    font-size: 14px;
    line-height: 1.5;
    color: $text-primary;
    word-wrap: break-word;
    word-break: break-word;
    
    :deep(p) {
      margin: 0 0 8px 0;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
    
    :deep(img) {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 8px 0;
    }
  }
  
  .card-answer {
    font-size: 13px;
    line-height: 1.5;
    color: $text-secondary;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid $card-border;
  }
  
  .card-timestamp {
    align-self: flex-end;
    font-size: 12px;
    color: $text-tertiary;
    margin-top: 4px;
  }
  
  .card-images {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  
  .card-image {
    max-width: 100%;
    max-height: 200px;
    border-radius: 8px;
    object-fit: contain;
    border: 1px solid $card-border;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .header {
    padding: 10px 12px;
    
    .tab {
      padding: 6px 20px;
      font-size: 14px;
    }
  }
  
  .list-container {
    padding: 8px;
  }
  
  .favorite-card {
    padding: 12px;
    
    .card-text {
      font-size: 13px;
    }
  }
}
</style>
