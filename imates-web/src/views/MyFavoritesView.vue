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
      <RubberBandList v-if="activeTab === 'qa'" class="list-container scroll-wrapper">
        <div class="scroll-content">
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
              <!-- 缩略图区域 -->
              <div
                v-if="getQaFavoriteThumbnail(item)"
                class="card-thumbnail"
                @click.stop="handleThumbnailClick(item)"
              >
                <q-img
                  :src="getQaFavoriteThumbnail(item)"
                  :ratio="210 / 122"
                  fit="cover"
                  class="thumbnail-image"
                />
                <div class="thumbnail-overlay">
                  <q-icon name="zoom_in" size="20px" />
                </div>
              </div>
              
              <div class="card-content">
                <!-- 问题内容和时间戳 -->
                <div class="card-text" v-html="renderContent(getQaFavoriteName(item))"></div>
                <div class="card-timestamp">{{ formatTimestamp(item.timestamp) }}</div>
              </div>
              
              <!-- 操作按钮区域 -->
              <div class="card-actions">
                <!-- 删除按钮 -->
                <q-btn
                  flat
                  round
                  dense
                  icon="delete_outline"
                  color="negative"
                  class="delete-btn"
                  @click.stop="handleDeleteQaFavorite(item)"
                >
                  <q-tooltip>取消收藏</q-tooltip>
                </q-btn>
                
                <!-- 查看按钮 -->
                <q-btn
                  flat
                  round
                  dense
                  icon="visibility"
                  color="primary"
                  class="view-btn"
                  @click.stop="handleQaFavoriteClick(item)"
                >
                  <q-tooltip>查看会话</q-tooltip>
                </q-btn>
              </div>
            </div>
          </div>
        </div>
      </RubberBandList>
      
      <!-- 练习收藏列表 -->
      <RubberBandList v-if="activeTab === 'exercise'" class="list-container scroll-wrapper">
        <div class="scroll-content">
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
              
              <!-- 操作按钮区域 -->
              <div class="card-actions">
                <!-- 删除按钮 -->
                <q-btn
                  flat
                  round
                  dense
                  icon="delete_outline"
                  color="negative"
                  class="delete-btn"
                  @click.stop="handleDeleteExercise(item.item)"
                >
                  <q-tooltip>取消收藏</q-tooltip>
                </q-btn>
              </div>
            </div>
          </div>
        </div>
        </RubberBandList>
      </div>
    </div>
    
    <!-- 统一聊天对话框 -->
    <GlobalChatDialog
      ref="globalChatDialogRef"
      v-model="showUnifiedChatDialog"
      :initial-teacher-subject="initialTeacherSubject"
    />
    
    <!-- 图片预览对话框 -->
    <ImageViewer
      v-model="imageViewerVisible"
      :image-url="currentImageUrl"
      alt="会话缩略图"
    />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onActivated, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { getFavoriteSessions, getFavoriteQas, getFavoriteExercises, removeSessionFavorite, removeQaFavorite, removeExerciseFavorite, type FavoriteQa, type FavoriteExercise } from '../utils/storage/favorites'
import { showMessage } from '../utils'
import { useTeacherChatStore } from '../stores/teacherChatStore'
import type { AiGeneralSession, AiTextbookSession } from '../types/chat'
 import type { ExerciseItem } from '../types/exercise'
 import GlobalChatDialog from '../components/dialog/GlobalChatDialog.vue'
 import RubberBandList from '../components/base/VirtualList.vue'
 import { getUserId, getScopedStorageValue } from '../services'
 import ImageViewer from '../components/ImageViewer.vue'
 import { resourceManager } from '../services/storage/resource-storage'
 import type { UserTextbookInfo, LocalFileInfo } from '../types/textbook'

// 定义组件名称
defineOptions({
  name: 'MyFavoritesView'
})

const router = useRouter()

// 使用消息渲染器
const { renderMessageContent } = useMessageRenderer()

// 响应式数据
const activeTab = ref<'qa' | 'exercise'>('qa')
const qaFavorites = ref<FavoriteQa[]>([])
const exerciseFavorites = ref<FavoriteExercise[]>([])
const isLoadingQa = ref(false)
const isLoadingExercise = ref(false)

// 列表滚动已改为使用 RubberBandList 橡皮筋滚动效果，不再依赖 BetterScroll

// 统一聊天对话框状态
const showUnifiedChatDialog = ref(false)
const globalChatDialogRef = ref<InstanceType<typeof GlobalChatDialog> | null>(null)
const initialTeacherSubject = ref<'biology' | 'math'>('math')

// 图片预览状态
const imageViewerVisible = ref(false)
const currentImageUrl = ref('')

// 方法
const goBack = () => {
  router.back()
}

// 判断收藏的对话类型（AI聊天还是教师通用对话）
const getChatType = (session: AiGeneralSession): { type: 'ai' | 'teacher', subject?: 'biology' | 'math' } => {
  // 第1步：检查是否是教师通用对话会话（使用统一存储格式）
  try {
    const teacherStore = useTeacherChatStore()
    const teacherSession = teacherStore.getSession(session.sessionId)

    if (teacherSession && teacherSession.subject) {
        return {
          type: 'teacher',
        subject: teacherSession.subject === 'biology' ? 'biology' : 'math'
      }
    }
  } catch (error) {
    console.error('检查教师会话失败:', error)
  }

  // 默认是 AI 聊天
  return { type: 'ai' }
}

// 处理问答卡片点击 - 打开 UnifiedChatDialog
const handleQaCardClick = async (session: AiGeneralSession) => {
  // 判断对话类型
  const chatType = getChatType(session)
  
  if (chatType.type === 'teacher' && chatType.subject) {
    initialTeacherSubject.value = chatType.subject
  }
  
  // 在打开对话框之前，先设置会话和加载历史（确保 SessionTree 初始化时能正确识别）
  if (chatType.type === 'teacher') {
    const teacherStore = useTeacherChatStore()
    const teacherSession = teacherStore.getSession(session.sessionId)
    if (teacherSession) {
      // 设置 localStorage
      const userId = getUserId()
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

// 获取问答收藏的显示名称
const getQaFavoriteName = (favorite: FavoriteQa): string => {
  const record = favorite.record
  // 如果是 AiTextbookSession，使用 sessionName
  if ('sessionName' in record && record.sessionName) {
    return record.sessionName
  }
  // 如果是 QuestionRecord，使用 question
  if ('question' in record && record.question) {
    return record.question
  }
  return '未命名会话'
}

// 获取问答收藏的缩略图
const getQaFavoriteThumbnail = (favorite: FavoriteQa): string | undefined => {
  const record = favorite.record
  // 如果是 AiTextbookSession，检查是否有缩略图
  if ('thumbnailImage' in record && record.thumbnailImage) {
    return record.thumbnailImage
  }
  return undefined
}

// 处理缩略图点击
const handleThumbnailClick = (favorite: FavoriteQa) => {
  const thumbnail = getQaFavoriteThumbnail(favorite)
  if (thumbnail) {
    currentImageUrl.value = thumbnail
    imageViewerVisible.value = true
  }
}

// 将问答收藏转换为 AiGeneralSession（如果可能）
const convertQaFavoriteToSession = (favorite: FavoriteQa): AiGeneralSession | null => {
  const record = favorite.record
  // 如果是 AiTextbookSession，转换为 AiGeneralSession
  if ('sessionId' in record && record.sessionId) {
    const sessionName = ('sessionName' in record && record.sessionName) 
      ? record.sessionName 
      : ('question' in record && record.question) 
        ? record.question 
        : ''
    const createTime = ('createTime' in record && record.createTime) 
      ? record.createTime 
      : ('timestamp' in record && record.timestamp) 
        ? record.timestamp 
        : Date.now()
    const updateTime = ('updateTime' in record && record.updateTime) 
      ? record.updateTime 
      : ('timestamp' in record && record.timestamp) 
        ? record.timestamp 
        : Date.now()
    const msgCount = ('msgCount' in record && record.msgCount !== undefined) 
      ? record.msgCount 
      : 0
    const pinned = ('pinned' in record && record.pinned !== undefined) 
      ? record.pinned 
      : false
    
    return {
      sessionId: record.sessionId,
      sessionName,
      createTime,
      updateTime,
      msgCount,
      pinned
    }
  }
  return null
}

// 处理问答收藏点击
const handleQaFavoriteClick = async (favorite: FavoriteQa) => {
  const record = favorite.record
  
  // 检查是否是PDF问答会话（AiTextbookSession 且有 resourceId）
  if ('resourceId' in record && record.resourceId) {
    // 这是PDF问答会话，需要跳转到PDF查看器
    try {
      // 查找包含该 resourceId 的教材
      const allTextbooks = await resourceManager.indexedDB.getAll<UserTextbookInfo>('textbooks')
      const targetTextbook = allTextbooks.find((textbook: UserTextbookInfo) => {
        if (textbook.localFiles && Array.isArray(textbook.localFiles)) {
          return textbook.localFiles.some((file: LocalFileInfo) => file.id === record.resourceId)
        }
        return false
      })
      
      if (targetTextbook) {
        // 跳转到PDF查看器，传递 resourceId、教材ID 和会话ID
        const query: Record<string, string> = {
          resourceId: record.resourceId,
          id: targetTextbook.id
        }
        // 如果有 sessionId，也传递过去
        if ('sessionId' in record && record.sessionId) {
          query.sessionId = record.sessionId
        }
        router.push({
          name: 'pdfViewer',
          query
        })
      } else {
        showMessage('未找到对应的教材资源', 'warning')
      }
    } catch (error) {
      console.error('跳转到PDF查看器失败:', error)
      showMessage('跳转失败，请重试', 'error')
    }
    return
  }
  
  // 非PDF问答会话，使用原有逻辑
  const session = convertQaFavoriteToSession(favorite)
  if (session) {
    await handleQaCardClick(session)
  } else {
    // 如果是 QuestionRecord，可能需要特殊处理
    showMessage('无法打开此会话', 'warning')
  }
}

// 处理删除问答收藏
const handleDeleteQaFavorite = async (favorite: FavoriteQa) => {
  try {
    const record = favorite.record
    let recordId = ''
    
    // 获取记录ID
    if ('sessionId' in record && record.sessionId) {
      recordId = record.sessionId
    } else if ('id' in record && record.id) {
      recordId = record.id
    }
    
    if (!recordId) {
      showMessage('无法识别会话ID', 'error')
      return
    }
    
    // 先尝试删除问答收藏
    let success = removeQaFavorite(recordId)
    
    // 如果删除问答收藏失败，尝试删除会话收藏
    if (!success) {
      success = removeSessionFavorite(recordId)
    }
    
    if (success) {
      // 刷新列表
      await loadQaFavorites()
      showMessage('已取消收藏', 'success')
    } else {
      showMessage('取消收藏失败', 'error')
    }
  } catch (error) {
    console.error('删除问答收藏失败:', error)
    showMessage('操作失败，请重试', 'error')
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
        token: getScopedStorageValue('token') || ''
      }
    })
  } catch (error) {
    console.error('跳转到我的习题失败:', error)
  }
}

// 处理删除练习收藏
const handleDeleteExercise = async (item: ExerciseItem) => {
  try {
    // 取消收藏
    const itemId = item.id || item.bmNo
    if (itemId) {
      removeExerciseFavorite(itemId)
      
      // 刷新列表
      await loadExerciseFavorites()
      
      showMessage('已取消收藏', 'success')
    } else {
      showMessage('无法取消收藏，题目ID不存在', 'error')
    }
  } catch (error) {
    console.error('取消收藏失败:', error)
    showMessage('取消收藏失败，请重试', 'error')
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
    // 第1步：从工具函数获取收藏的问答
    const qaFavs = getFavoriteQas()
    
    // 第2步：从工具函数获取收藏的会话，转换为 FavoriteQa 格式
    const sessionFavs = getFavoriteSessions()
    const sessionFavsAsQa: FavoriteQa[] = sessionFavs.map(fav => ({
      id: fav.session.sessionId,
      type: 'qa' as const,
      record: {
        sessionId: fav.session.sessionId,
        sessionName: fav.session.sessionName,
        createTime: fav.session.createTime,
        updateTime: fav.session.updateTime,
        msgCount: fav.session.msgCount,
        pinned: fav.session.pinned,
        // 保留缩略图字段
        thumbnailImage: ('thumbnailImage' in fav.session && fav.session.thumbnailImage) 
          ? fav.session.thumbnailImage 
          : undefined,
        // 兼容字段
        id: fav.session.sessionId,
        question: fav.session.sessionName,
        timestamp: fav.session.updateTime
      } as AiTextbookSession,
      timestamp: fav.timestamp
    }))
    
    // 第3步：合并问答收藏和会话收藏
    const allFavorites = [...qaFavs, ...sessionFavsAsQa]
    
    // 第4步：按时间戳倒序排列
    allFavorites.sort((a, b) => b.timestamp - a.timestamp)
    qaFavorites.value = allFavorites
    
    // 橡皮筋列表不需手动刷新滚动实例
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
  overflow: hidden;
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
  
  .card-thumbnail {
    flex-shrink: 0;
    width: 104px;
    height: 56px;
    aspect-ratio: 210 / 122;
    border-radius: 8px;
    overflow: hidden;
    background: #f5f5f5;
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
