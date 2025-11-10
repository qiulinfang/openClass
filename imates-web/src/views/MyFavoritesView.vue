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
          >
            <div class="card-content">
              <!-- 问题内容和时间戳 -->
              <div class="card-text" v-html="renderContent(item.session.sessionName || '未命名会话')"></div>
              <div class="card-timestamp">{{ formatTimestamp(item.timestamp) }}</div>
            </div>
            
            <!-- 操作按钮区域 -->
            <div class="card-actions">
              <!-- 删除按钮 -->
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                class="delete-btn"
                @click.stop="handleDeleteSession(item.session)"
              >
                <q-tooltip>删除会话</q-tooltip>
              </q-btn>
              
              <!-- 查看按钮 -->
              <q-btn
                flat
                round
                dense
                icon="visibility"
                color="primary"
                class="view-btn"
                @click.stop="handleQaCardClick(item.session)"
              >
                <q-tooltip>查看会话</q-tooltip>
              </q-btn>
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
    
    <!-- 统一聊天对话框 -->
    <UnifiedChatDialog 
      ref="unifiedChatDialogRef"
      v-model="showUnifiedChatDialog"
      :initial-teacher-subject="initialTeacherSubject"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onActivated, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { getFavoriteSessions, getFavoriteExercises, removeSessionFavorite, type FavoriteSession, type FavoriteExercise } from '../utils/storage/favorites'
import { showMessage } from '../utils'
import { useTeacherGeneralChatStore } from '../stores/teacherGeneralChatStore'
import type { AiGeneralSession } from '../types/chat'
import type { ExerciseItem } from '../types/exercise'
import UnifiedChatDialog from '../components/UnifiedChatDialog.vue'

// 定义组件名称
defineOptions({
  name: 'MyFavoritesView'
})

const router = useRouter()

// 使用消息渲染器
const { renderMessageContent } = useMessageRenderer()

// 响应式数据
const activeTab = ref<'qa' | 'exercise'>('qa')
const qaFavorites = ref<FavoriteSession[]>([])
const exerciseFavorites = ref<FavoriteExercise[]>([])
const isLoadingQa = ref(false)
const isLoadingExercise = ref(false)

// 统一聊天对话框状态
const showUnifiedChatDialog = ref(false)
const unifiedChatDialogRef = ref<InstanceType<typeof UnifiedChatDialog> | null>(null)
const initialTeacherSubject = ref<'biology' | 'math'>('math')

// 方法
const goBack = () => {
  router.back()
}

// 判断收藏的对话类型（AI聊天还是教师通用对话）
const getChatType = (session: AiGeneralSession): { type: 'ai' | 'teacher-general', subject?: 'biology' | 'math' } => {
  // 第1步：检查是否是教师通用对话会话（使用统一存储格式）
  try {
    const teacherStore = useTeacherGeneralChatStore()
    const teacherSession = teacherStore.getSession(session.sessionId)

    if (teacherSession && teacherSession.subject) {
        return {
          type: 'teacher-general',
        subject: teacherSession.subject === 'biology' ? 'biology' : 'math'
      }
    }
  } catch (error) {
    console.error('检查教师会话失败:', error)
  }

  // 默认是 AI 聊天
  return { type: 'ai' }
}

// 教师会话消息数量缓存（避免重复加载）
const teacherMsgCountCache = ref<Record<string, number>>({})

// 异步加载教师会话的消息数量
const loadTeacherMsgCount = async (sessionId: string) => {
  // 如果已有缓存，直接返回
  if (teacherMsgCountCache.value[sessionId] !== undefined) {
    return
  }
  
  try {
    // 第1步：导入异步存储服务
    const { asyncStorage } = await import('../services/chat-storage')
    
    // 第2步：加载聊天历史
    const storageKey = `teacher_chat_${sessionId}`
    const history = await asyncStorage.loadChatHistory(storageKey)
    
    // 第3步：缓存消息数量
    if (history && history.messages) {
      teacherMsgCountCache.value[sessionId] = history.messages.length
    }
  } catch (error) {
    // 加载失败不影响显示，只是不显示消息数量
    console.warn('加载教师会话消息数量失败:', sessionId, error)
  }
}


// 处理问答卡片点击 - 打开 UnifiedChatDialog
const handleQaCardClick = async (session: AiGeneralSession) => {
  // 判断对话类型
  const chatType = getChatType(session)
  
  if (chatType.type === 'teacher-general' && chatType.subject) {
    initialTeacherSubject.value = chatType.subject
  }
  
  // 在打开对话框之前，先设置会话和加载历史（确保 SessionTree 初始化时能正确识别）
  if (chatType.type === 'teacher-general') {
    const teacherStore = useTeacherGeneralChatStore()
    const teacherSession = teacherStore.getSession(session.sessionId)
    if (teacherSession) {
      // 设置 localStorage
      const { getCurrentUserIdOrDefault } = await import('../utils/user/userId')
      const userId = getCurrentUserIdOrDefault()
      const storeSubject = teacherSession.subject === 'biology' ? 'BIOLOGY' : 'MATH'
      localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
      // 调用 store 的 setSession（设置当前会话）
      teacherStore.setSession(teacherSession)
      // 加载聊天历史（确保会话数据完整）
      await teacherStore.loadChatHistory(teacherSession.sessionId)
    }
  } else {
    // AI 聊天：在打开对话框之前先切换到对应的会话
    const { useAiGeneralChatStore } = await import('@/stores/aiGeneralChatStore')
    const aiGeneralStore = useAiGeneralChatStore()
    await aiGeneralStore.loadSessions()
    
    // 切换到对应的会话
    const foundSession = aiGeneralStore.sessions.find((s: AiGeneralSession) => s.sessionId === session.sessionId)
    if (foundSession) {
      await aiGeneralStore.switchSession(session.sessionId)
    } else {
      console.warn('未找到对应的 AI 会话:', session.sessionId)
    }
  }
  
  // 打开对话框（此时会话已经设置好，SessionTree 初始化时会正确识别）
  showUnifiedChatDialog.value = true
}

// 处理删除会话
const handleDeleteSession = async (session: AiGeneralSession) => {
  try {
    // 判断对话类型
    const chatType = getChatType(session)

    if (chatType.type === 'teacher-general') {
      // 删除教师会话
      const { useTeacherGeneralChatStore } = await import('@/stores/teacherGeneralChatStore')
      const teacherStore = useTeacherGeneralChatStore()
      
      // 删除会话（使用统一存储格式）
      teacherStore.deleteSession(session.sessionId)
      
      // 删除IndexedDB中的聊天历史
      await teacherStore.clearChatHistory(session.sessionId)
    } else {
      // 删除AI会话
      const { useAiGeneralChatStore } = await import('@/stores/aiGeneralChatStore')
      const aiGeneralStore = useAiGeneralChatStore()
      await aiGeneralStore.deleteSession(session.sessionId)
    }
    
    // 从收藏列表中移除
    removeSessionFavorite(session.sessionId)
    
    // 刷新列表
    await loadQaFavorites()
    
    showMessage('删除成功', 'success')
  } catch (error) {
    console.error('删除会话失败:', error)
    showMessage('删除失败，请重试', 'error')
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


// 加载问答收藏
const loadQaFavorites = async () => {
  isLoadingQa.value = true
  try {
    // 第1步：从工具函数获取收藏的会话
    const favorites = getFavoriteSessions()
    
    // 第2步：按时间戳倒序排列
    favorites.sort((a, b) => b.timestamp - a.timestamp)
    qaFavorites.value = favorites
    
    // 第3步：异步加载教师会话的消息数量（不阻塞渲染）
    favorites.forEach(favorite => {
      const chatType = getChatType(favorite.session)
      if (chatType.type === 'teacher-general') {
        // 异步加载，不等待结果
        loadTeacherMsgCount(favorite.session.sessionId).catch(() => {
          // 加载失败不影响显示
        })
      }
    })
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
  transition: all 0.2s ease;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  
  &:hover {
    box-shadow: 0 2px 8px 0 rgba(60, 64, 67, 0.15);
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &.qa-card {
    cursor: default; // 问答卡片不再整体可点击
  }
  
  &.exercise-card {
    cursor: pointer; // 练习卡片保持整体可点击
  }
  
  .card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    
    .delete-btn,
    .view-btn {
      width: 32px;
      height: 32px;
      min-height: 32px;
    }
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
  
  .card-timestamp {
    font-size: 12px;
    color: $text-tertiary;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid $card-border;
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
