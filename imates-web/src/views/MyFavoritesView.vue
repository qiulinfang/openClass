<template>
  <div class="my-favorites-view">
    <!-- 顶部工具栏 -->
    <Toolbar :nav-items="navItems" v-model="activeTab">
      <template #left>
        <div class="back-btn" @click="goBack">
          <img :src="goBackIcon" alt="返回" class="back-icon" />
        </div>
      </template>
      <template #right>
        <div class="placeholder"></div>
      </template>
    </Toolbar>

    <!-- 内容区域 -->
    <div class="content-area">
      <!-- 会话收藏列表 -->
      <RubberBandList
        v-if="activeTab === 'session'"
        ref="qaListRef"
        class="list-container scroll-wrapper"
        :enable-refresh="true"
        :loading="isLoadingQa"
        @refresh="handleQaRefresh"
      >
        <div class="scroll-content">
          <div v-if="qaFavorites.length === 0 && !isLoadingQa" class="empty-state">
            <q-icon name="chat_bubble_outline" size="80px" color="grey-5" />
            <div class="text-h6 q-mt-md text-grey-7">暂无会话收藏</div>
            <div class="text-body2 text-grey-6 q-mt-sm">收藏的会话将显示在这里</div>
          </div>

          <div v-else class="favorites-list">
            <div
              v-for="(item, index) in qaFavorites"
              :key="item.id || index"
              class="favorite-card qa-card"
              @click="handleSessionFavoriteClick(item.session)"
            >
              <!-- 缩略图区域 -->
              <div class="card-content">
                <!-- 问题内容和时间戳 -->
                <div class="card-text" v-html="renderContent(item.session.sessionName)"></div>
                <div class="card-timestamp">{{ formatTimestamp(item.timestamp) }}</div>
              </div>

              <!-- 操作按钮区域（已移除删除/查看按钮） -->
              <div class="card-actions"></div>
            </div>
          </div>
        </div>
      </RubberBandList>

      <!-- 练习收藏列表 -->
      <RubberBandList
        v-if="activeTab === 'exercise'"
        ref="exerciseListRef"
        class="list-container scroll-wrapper"
        :enable-refresh="true"
        :loading="isLoadingExercise"
        @refresh="handleExerciseRefresh"
      >
        <div class="scroll-content">
          <div v-if="exerciseFavorites.length === 0 && !isLoadingExercise" class="empty-state">
            <q-icon name="quiz" size="80px" color="grey-5" />
            <div class="text-h6 q-mt-md text-grey-7">暂无练习收藏</div>
            <div class="text-body2 text-grey-6 q-mt-sm">收藏的练习题目将显示在这里</div>
          </div>

          <div v-else class="favorites-list">
            <div
              v-for="(item, index) in exerciseFavorites"
              :key="item.id || index"
              class="favorite-card exercise-card"
              @click="handleExerciseCardClick(item)"
            >
              <div class="card-content">
                <div
                  class="card-text"
                  v-html="renderContent(item.item.question || item.item.title)"
                ></div>
                <div class="card-timestamp">{{ formatTimestamp(item.timestamp) }}</div>
              </div>

              <!-- 操作按钮区域（已移除删除按钮） -->
              <div class="card-actions"></div>
            </div>
          </div>
        </div>
      </RubberBandList>

      <!-- 统一聊天对话框 -->
      <GlobalChatDialog
        ref="globalChatDialogRef"
        v-model="showUnifiedChatDialog"
        :initial-teacher-subject="initialTeacherSubject"
        :entry="unifiedChatEntry"
        @toggle-mode="handleToggleMode"
      />

      <!-- 图片预览对话框 -->
      <ImageViewer v-model="imageViewerVisible" :image-url="currentImageUrl" alt="会话缩略图" />

      <!-- 未找到记录提示对话框 -->
      <Dialog
        ref="notFoundDialogRef"
        title="记录不存在"
        confirm-button-text="删除记录"
        @confirm="deleteNotFoundRecord"
        @cancel="closeNotFoundDialog"
      >
        {{ notFoundDialogMessage }}
      </Dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onActivated, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import {
  getFavoriteSessions,
  getFavoriteExercises,
  removeSessionFavorite,
  removeExerciseFavorite,
  type FavoriteSession,
  type FavoriteExercise,
} from '../utils/storage/favorites'
import { showMessage } from '../utils'
import { useTeacherChatStore } from '../stores/teacherChatStore'
import type { AiGeneralSession } from '../types/chat'
import type { ExerciseItem } from '../types/exercise'
import GlobalChatDialog from '../components/dialog/GlobalChatDialog.vue'
import type { ChatEntry } from '../types/chat'
import RubberBandList from '../components/base/VirtualList.vue'
import Toolbar from '../components/base/Toolbar.vue'
import Dialog from '../components/base/Dialog.vue'
import { getUserId, getScopedStorageValue } from '../services'
import goBackIcon from '/icons/goback.svg'
import ImageViewer from '../components/ImageViewer.vue'
import { chatStorage } from '../services/storage/chat-storage'
import { loadQuestionsFromIndexedDB } from '../services/storage/question-storage'

// 定义组件名称
defineOptions({
  name: 'MyFavoritesView',
})

const router = useRouter()

const openMainChatPanelWithEntry = inject<(entry: ChatEntry) => void>('openMainChatPanelWithEntry')

// 使用消息渲染器
const { renderMessageContent } = useMessageRenderer()

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 响应式数据
const activeTab = ref<'session' | 'exercise'>('session')
const qaFavorites = ref<FavoriteSession[]>([])
const exerciseFavorites = ref<FavoriteExercise[]>([])
const isLoadingQa = ref(false)
const isLoadingExercise = ref(false)

const qaListRef = ref<InstanceType<typeof RubberBandList> | null>(null)
const exerciseListRef = ref<InstanceType<typeof RubberBandList> | null>(null)

// 列表滚动已改为使用 RubberBandList 橡皮筋滚动效果，不再依赖 BetterScroll

// 统一聊天对话框状态
const showUnifiedChatDialog = ref(false)
const globalChatDialogRef = ref<InstanceType<typeof GlobalChatDialog> | null>(null)
const initialTeacherSubject = ref<'biology' | 'math'>('math')
const unifiedChatEntry = ref<ChatEntry>({ mode: 'default', category: 'ai-general' })

// 图片预览状态
const imageViewerVisible = ref(false)
const currentImageUrl = ref('')

// 未找到记录提示对话框状态
const notFoundDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
const notFoundDialogMessage = ref('')
const targetFavoriteItem = ref<{ type: 'session' | 'exercise'; id: string } | null>(null)

// 导航项配置
const navItems = computed(() => [
  {
    key: 'session',
    label: '会话收藏',
  },
  {
    key: 'exercise',
    label: '练习收藏',
  },
])

// 方法
const goBack = () => {
  router.back()
}

const handleQaRefresh = async () => {
  if (isLoadingQa.value) {
    qaListRef.value?.finishRefresh?.()
    return
  }
  try {
    await loadQaFavorites()
  } finally {
    qaListRef.value?.finishRefresh?.()
  }
}

// 渲染内容（支持Markdown和公式）
const renderContent = (content: string) => {
  if (!content) return ''
  return renderMessageContent(content)
}

const handleExerciseRefresh = async () => {
  if (isLoadingExercise.value) {
    exerciseListRef.value?.finishRefresh?.()
    return
  }
  try {
    await loadExerciseFavorites()
  } finally {
    exerciseListRef.value?.finishRefresh?.()
  }
}

// 判断收藏的对话类型（AI聊天还是教师通用对话）
const getChatType = (
  session: AiGeneralSession
): { type: 'ai' | 'teacher'; subject?: 'biology' | 'math' } => {
  // 检查是否是教师通用对话会话（使用统一存储格式）
  try {
    const teacherStore = useTeacherChatStore()
    const teacherSession = teacherStore.loadAllSessions()[session.sessionId]

    if (teacherSession && teacherSession.subject) {
      return {
        type: 'teacher',
        subject: teacherSession.subject === 'BIOLOGY' ? 'biology' : 'math',
      }
    }
  } catch (error) {
    console.error('检查教师会话失败:', error)
  }

  // 默认是 AI 聊天
  return { type: 'ai' }
}

const showNotFoundDialog = (message: string, type: 'session' | 'exercise', favoriteId: string) => {
  notFoundDialogMessage.value = message
  targetFavoriteItem.value = { type, id: favoriteId }
  notFoundDialogRef.value?.openDialog()
}

const closeNotFoundDialog = () => {
  targetFavoriteItem.value = null
  notFoundDialogRef.value?.closeDialog()
}

const deleteNotFoundRecord = () => {
  if (!targetFavoriteItem.value) {
    closeNotFoundDialog()
    return
  }

  const { type, id } = targetFavoriteItem.value
  let success = false

  try {
    if (type === 'session') {
      // 删除会话收藏（直接使用收藏ID）
      success = removeSessionFavorite(id)
      if (success) {
        // 重新加载会话收藏列表
        loadQaFavorites()
        showMessage('已删除无效的会话收藏', 'success')
      }
    } else if (type === 'exercise') {
      // 删除练习收藏（直接使用收藏ID）
      success = removeExerciseFavorite(id)
      if (success) {
        // 重新加载练习收藏列表
        loadExerciseFavorites()
        showMessage('已删除无效的练习收藏', 'success')
      }
    }

    if (!success) {
      showMessage('删除收藏失败', 'error')
    }
  } catch (error) {
    console.error('删除收藏记录失败:', error)
    showMessage('删除收藏失败', 'error')
  }

  closeNotFoundDialog()
}

// 检查本地是否存在指定会话（教师通用或AI对话）并返回布尔值
const ensureLocalGeneralOrTeacherSessionExists = async (sessionId: string): Promise<boolean> => {
  const teacherStore = useTeacherChatStore()
  const teacherSession = teacherStore.loadAllSessions()?.[sessionId]
  if (teacherSession) return true

  const sessions = await chatStorage.loadGeneralSessions()
  return sessions.some((s) => s.sessionId === sessionId)
}

// 检查本地是否存在指定练习项记录
const ensureLocalExerciseExists = async (item: ExerciseItem): Promise<boolean> => {
  const ids = [item.bmNo, item.id].filter((v): v is string => !!v)
  if (ids.length === 0) return false

  const subjectKey = item.subject === 'biology' ? 'biology' : item.subject === 'math' ? 'math' : null
  const subjectsToTry = subjectKey ? [subjectKey] : ['math', 'biology']

  for (const subject of subjectsToTry) {
    const list = await loadQuestionsFromIndexedDB(subject)
    if (list && list.some((q) => ids.includes(q.bmNo) || ids.includes(q.id))) {
      return true
    }
  }
  return false
}

// 处理问答卡片点击 - 打开 UnifiedChatDialog
const handleQaCardClick = async (session: AiGeneralSession) => {
  // 判断对话类型
  const chatType = getChatType(session)

  if (chatType.type === 'teacher' && chatType.subject) {
    initialTeacherSubject.value = chatType.subject
  }

  if (chatType.type === 'teacher') {
    unifiedChatEntry.value = { mode: 'session', category: 'teacher', sessionId: session.sessionId }
  } else {
    unifiedChatEntry.value = { mode: 'session', category: 'ai-general', sessionId: session.sessionId }
  }

  // 打开对话框（此时会话已经设置好，SessionTree 初始化时会正确识别）
  showUnifiedChatDialog.value = true
}

const handleToggleMode = () => {
  showUnifiedChatDialog.value = false
  openMainChatPanelWithEntry?.(unifiedChatEntry.value)
}

// 处理会话收藏点击
const handleSessionFavoriteClick = async (session: AiGeneralSession) => {
  const localExists = await ensureLocalGeneralOrTeacherSessionExists(session.sessionId)
  if (!localExists) {
    showNotFoundDialog('本地未找到该会话记录', 'session', session.sessionId)
    return
  }
  await handleQaCardClick(session)
}

// 处理练习卡片点击 - 跳转到我的习题
const handleExerciseCardClick = async (favorite: FavoriteExercise) => {
  const item = favorite.item
  try {
    const localExists = await ensureLocalExerciseExists(item)
    if (!localExists) {
      showNotFoundDialog('本地未找到该题目记录', 'exercise', favorite.id)
      return
    }

    // 跳转到我的习题页面
    // 使用 questionId 参数来标识要定位的题目
    router.push({
      name: 'exerciseSolve',
      query: {
        questionId: item.bmNo || item.id,
        subject: item.subject === 'biology' ? 'SUBJECT_BIOLOGY' : 'SUBJECT_MATH',
        scene: 'favorites',
        token: getScopedStorageValue('token') || '',
      },
    })
  } catch (error) {
    console.error('跳转到我的习题失败:', error)
  }
}

// 加载问答收藏
const loadQaFavorites = async () => {
  isLoadingQa.value = true
  try {
    // 仅保留 AI 通用会话收藏
    const sessionFavs = getFavoriteSessions()
    qaFavorites.value = [...sessionFavs].sort((a, b) => b.timestamp - a.timestamp)
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

    // 橡皮筋列表不需手动刷新滚动实例
  } catch (error) {
    console.error('加载练习收藏失败:', error)
  } finally {
    isLoadingExercise.value = false
  }
}

// 监听标签页切换
watch(activeTab, async (newTab) => {
  if (newTab === 'session') {
    await loadQaFavorites()
  } else {
    await loadExerciseFavorites()
  }
})

// 生命周期
onMounted(async () => {
  // 加载当前标签页的收藏数据
  if (activeTab.value === 'session') {
    await loadQaFavorites()
  } else {
    await loadExerciseFavorites()
  }
})

// 监听路由激活，刷新收藏列表（从其他页面返回时）
onActivated(async () => {
  // 刷新当前标签页的收藏数据
  if (activeTab.value === 'session') {
    await loadQaFavorites()
  } else {
    await loadExerciseFavorites()
  }
})

// 暴露方法
defineExpose({
  loadQaFavorites,
  loadExerciseFavorites,
})
</script>

<style lang="scss" scoped>
// 变量定义
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
  background: #f6f8ff;
}

// 返回按钮样式
.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.back-icon {
  width: 25px;
  height: 25px;
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
  overflow: auto;
  position: relative;

  &.scroll-wrapper {
    height: 100%;
  }

  .scroll-content {
    padding: 12px;
    min-height: calc(100% + 1px); // 确保即使内容少也能滚动
    box-sizing: border-box;
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

// 会话收藏列表（使用 SessionItem 组件）
.session-favorites-list {
  display: flex;
  flex-direction: column;
  gap: 0;
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
  min-height: 96px;

  &:hover {
    box-shadow: 0 2px 8px 0 rgba(60, 64, 67, 0.15);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }

  &.qa-card {
    cursor: pointer; // 问答卡片现在整体可点击
  }

  &.exercise-card {
    cursor: pointer; // 练习卡片保持整体可点击
  }

  .card-thumbnail {
    flex-shrink: 0;
    width: 104px;
    height: 56px;
    aspect-ratio: 210 / 122;
    border-radius: 8px;
    overflow: hidden;
    background: #f6f8ff;
    position: relative;
    cursor: pointer;
    margin-right: 12px;

    .thumbnail-image {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      object-fit: cover;
    }

    .thumbnail-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      border-radius: 8px;
      transition: opacity 0.2s;

      .q-icon {
        color: white;
      }
    }

    &:hover .thumbnail-overlay {
      opacity: 1;
    }
  }

  .card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0; // 允许内容收缩
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
  .back-btn {
    width: 36px;
    height: 36px;
  }

  .back-icon {
    width: 22px;
    height: 22px;
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
