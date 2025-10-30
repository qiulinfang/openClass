<template>
  <div 
    class="main-view"
    @mousemove="handleDrag"
    @mouseup="stopDrag"
    @touchmove="handleDrag"
    @touchend="stopDrag"
  >
    <!-- 功能菜单 -->
    <div class="function-menu">
      <!-- 用户头像 -->
      <div class="user-avatar">
        <img :src="avatarIcon" alt="avatar" style="width: 40px; height: 40px;" />
      </div>
      
      <div class="nav-items-container">
        <div class="nav-item" :class="{ active: activeNavItem === 'toolbox' }" @click="handleToolBoxClick">
          <img :src="toolBoxIcon" alt="功能箱" class="nav-icon" />
          <span class="nav-text">功能箱</span>
        </div>
        <div class="nav-item" :class="{ active: activeNavItem === 'resources' }" @click="handleMyResourcesClick">
          <img :src="downloadResourcesIcon" alt="我的资源" class="nav-icon" />
          <span class="nav-text">我的资源</span>
        </div>
        <div class="nav-item" :class="{ active: activeNavItem === 'exercises' }" @click="handleMyExercisesClick">
          <img :src="bookIcon" alt="我的习题" class="nav-icon" />
          <span class="nav-text">我的习题</span>
        </div>
        <div class="nav-item" :class="{ active: activeNavItem === 'knowledge' }" @click="handleKnowledgeGraphClick">
          <img :src="knowledgeGraphIcon" alt="知识图谱" class="nav-icon" />
          <span class="nav-text">知识图谱</span>
        </div>
      </div>
    </div>
    
    <!-- 内容区域 -->
    <div class="content-area">
      <router-view />
    </div>

    <!-- 悬浮功能按钮 -->
    <div 
      class="floating-fab"
      :style="fabStyle"
      @mousedown="startDrag"
      @touchstart="startDrag"
    >
      <q-fab
        icon="add"
        direction="up"
        color="purple"
        padding="md"
      >
        <q-fab-action
          color="purple-7"
          @click="handleDraftClick"
          icon="edit_note"
          label="草稿本"
          label-position="left"
        />
        <q-fab-action
          color="orange-7"
          @click="handleAIChatClick"
          icon="chat"
          label="与AI聊天"
          label-position="left"
        />
      </q-fab>
    </div>
    <!-- 草稿本对话框 -->
    <DraggableDialog 
      v-model="showDraftDialog" 
      title="草稿本"
      :initial-width="800"
      :initial-height="600"
    >
      <DrawingBoard />
    </DraggableDialog>

    <!-- AI聊天对话框 -->
    <DraggableDialog 
      v-model="uiStore.showAIChatDialog" 
      title="与AI聊天"
      :initial-width="1000"
      :initial-height="600"
      :min-width="600"
      :min-height="400"
    >
      <div class="ai-chat-content">
        <!-- 左侧聊天记录 -->
        <div class="left-panel">
          <SessionList 
            :records="questionRecords"
            :selected-record-id="aiGeneralStore.currentSession?.sessionId"
            title="聊天记录"
            @record-click="handleQuestionRecordClick"
            @record-rename="handleRecordRename"
            @record-pin="handleRecordPin"
            @record-delete="handleRecordDelete"
            @batch-delete="handleBatchDelete"
          >
            <template #header-actions>
              <q-btn
                flat
                round
                dense
                icon="bug_report"
                color="orange"
                size="sm"
                class="debug-btn"
                @click="showDebugPanel = true"
              >
                <q-tooltip>调试面板</q-tooltip>
              </q-btn>
              <q-btn
                flat
                round
                dense
                icon="add"
                color="primary"
                size="sm"
                class="new-chat-btn"
                :disable="!aiGeneralStore.canCreateSession"
                @click="handleNewChatClick"
              >
                <q-tooltip>
                  {{ 
                    aiGeneralStore.canCreateSession 
                      ? '新增对话' 
                      : (aiGeneralStore.isCreatingSession 
                          ? '创建中...' 
                          : '请先在当前会话中发送消息')
                  }}
                </q-tooltip>
              </q-btn>
            </template>
          </SessionList>
        </div>

        <!-- 右侧聊天界面 -->
        <div class="right-panel">
          <ChatView 
            type="ai-general"
          />
        </div>
      </div>
    </DraggableDialog>

    <!-- 调试面板 -->
    <ChatSessionDebugPanel v-model="showDebugPanel" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/uiStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { showMessage } from '@/utils'
import DrawingBoard from '@/components/DrawingBoard.vue'
import SessionList from '@/components/SessionList.vue'
import ChatView from '@/components/ChatView.vue'
import DraggableDialog from '@/components/DraggableDialog.vue'
import ChatSessionDebugPanel from '@/components/ChatSessionDebugPanel.vue'
import type { QuestionRecord, AiGeneralSession } from '@/types'

// 流程：导入图标资源
import avatarIcon from '/icons/avatar.svg'
import toolBoxIcon from '/icons/toolBox.svg'
import downloadResourcesIcon from '/icons/downloadResources.svg'
import bookIcon from '/icons/book.svg'
import knowledgeGraphIcon from '/icons/isKnowledgeGraphSelected.svg'

// 定义 props
interface Props {
  activeNavItem?: string
}

const props = withDefaults(defineProps<Props>(), {
  activeNavItem: 'knowledge'
})

// 定义 emits
const emit = defineEmits<{
  'nav-item-change': [item: string]
}>()

// 路由
const router = useRouter()
const route = useRoute()

// Store
const uiStore = useUIStore()
const aiGeneralStore = useAiGeneralChatStore()

// 响应式数据
const activeNavItem = ref(props.activeNavItem)

// 对话框显示状态
const showDraftDialog = ref(false)
const showDebugPanel = ref(false)

// 问题记录数据（计算属性：从AI通用会话转换）
const questionRecords = computed<QuestionRecord[]>(() => {
  return aiGeneralStore.sessions.map((session: AiGeneralSession) => ({
    id: session.sessionId,
    question: session.sessionName,
    answer: '',
    timestamp: session.updateTime,
    pinned: session.pinned || false
  }))
})

// 悬浮按钮拖动相关状态
const fabPosition = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const hasMoved = ref(false)

// 计算悬浮按钮样式
const fabStyle = computed(() => ({
  right: `${fabPosition.value.x}px`,
  bottom: `${fabPosition.value.y}px`
}))

// 开始拖动
const startDrag = (event: MouseEvent | TouchEvent) => {
  // 设置拖动状态
  isDragging.value = true
  hasMoved.value = false
  
  // 获取当前鼠标/触摸点位置
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  // 记录起始位置
  dragStartPos.value = { x: clientX, y: clientY }
  
  // 计算当前按钮的实际位置（从右下角算起）
  const currentRight = fabPosition.value.x
  const currentBottom = fabPosition.value.y
  
  // 计算按钮左上角的位置
  const buttonLeft = window.innerWidth - currentRight - 56 // 56是按钮宽度
  const buttonTop = window.innerHeight - currentBottom - 56 // 56是按钮高度
  
  // 保存鼠标相对按钮左上角的偏移
  dragOffset.value = {
    x: clientX - buttonLeft,
    y: clientY - buttonTop
  }
}

// 拖动中
const handleDrag = (event: MouseEvent | TouchEvent) => {
  // 检查是否正在拖动
  if (!isDragging.value) return
  
  // 获取鼠标/触摸点位置
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  // 计算移动距离
  const deltaX = Math.abs(clientX - dragStartPos.value.x)
  const deltaY = Math.abs(clientY - dragStartPos.value.y)
  
  // 如果移动距离超过5px，认为是拖动而不是点击
  if (deltaX > 5 || deltaY > 5) {
    hasMoved.value = true
    
    // 计算按钮左上角的新位置
    const newLeft = clientX - dragOffset.value.x
    const newTop = clientY - dragOffset.value.y
    
    // 限制在视口范围内
    const buttonSize = 56
    const constrainedLeft = Math.max(0, Math.min(window.innerWidth - buttonSize, newLeft))
    const constrainedTop = Math.max(0, Math.min(window.innerHeight - buttonSize, newTop))
    
    // 转换为 right 和 bottom 值
    fabPosition.value = {
      x: window.innerWidth - constrainedLeft - buttonSize,
      y: window.innerHeight - constrainedTop - buttonSize
    }
  }
}

// 停止拖动
const stopDrag = () => {
  isDragging.value = false
  hasMoved.value = false
}

// 初始化按钮位置
onMounted(() => {
  fabPosition.value = { x: 18, y: 18 }
})

// 处理草稿本点击
const handleDraftClick = () => {
  showDraftDialog.value = true
}

// 处理AI聊天点击
const handleAIChatClick = async () => {
  // 第1步：加载会话列表
  await aiGeneralStore.loadSessions()
  
  // 第2步：如果没有当前会话且有会话列表，加载第一个会话
  if (!aiGeneralStore.currentSession && aiGeneralStore.sessions.length > 0) {
    const firstSession = aiGeneralStore.sessions[0]
    await aiGeneralStore.switchSession(firstSession.sessionId)
  }
  
  // 第3步：打开对话框
  uiStore.openAIChatDialog()
}

// 处理问题记录点击
const handleQuestionRecordClick = async (record: QuestionRecord) => {
  // 第1步：切换到对应的会话
  await aiGeneralStore.switchSession(record.id)
}

// 处理新增对话点击
const handleNewChatClick = async () => {
  // 第1步：检查是否可以创建
  if (!aiGeneralStore.canCreateSession) {
    if (aiGeneralStore.isCreatingSession) {
      showMessage('正在创建会话，请稍候...', 'warning')
    } else {
      showMessage('请先在当前会话中发送消息', 'warning')
    }
    return
  }
  
  // 第2步：重置状态，准备新对话
  // 不立即创建会话，等用户发送第一条消息时，sendMessage会自动创建
  // 会话名称将使用用户的第一条消息内容（前30个字符）
  aiGeneralStore.resetState()
  
}

// 第1步：处理记录重命名
const handleRecordRename = async (record: QuestionRecord, newName: string) => {
  try {
    // 第1步：更新会话名称
    await aiGeneralStore.renameSession(record.id, newName)
    
    // 第2步：更新本地记录名称
    const index = aiGeneralStore.sessions.findIndex((s: AiGeneralSession) => s.sessionId === record.id)
    if (index >= 0) {
      aiGeneralStore.sessions[index].sessionName = newName
      await aiGeneralStore.saveSessions()
    }
    
    showMessage('重命名成功', 'success')
  } catch (error) {
    console.error('重命名失败:', error)
    showMessage('重命名失败', 'error')
  }
}

// 第2步：处理记录置顶/取消置顶
const handleRecordPin = async (record: QuestionRecord) => {
  try {
    await aiGeneralStore.togglePin(record.id)
    showMessage(record.pinned ? '已取消置顶' : '已置顶', 'success')
  } catch (error) {
    console.error('置顶操作失败:', error)
    showMessage('操作失败', 'error')
  }
}

// 第3步：处理记录删除
const handleRecordDelete = async (record: QuestionRecord) => {
  // 第1步：确认删除
  const confirmed = await new Promise<boolean>((resolve) => {
    // 使用 Quasar Dialog 进行确认
    import('quasar').then(({ Dialog }) => {
      Dialog.create({
        title: '确认删除',
        message: `确定要删除会话"${record.question}"吗？此操作无法撤销。`,
        cancel: true,
        persistent: true
      }).onOk(() => resolve(true))
        .onCancel(() => resolve(false))
    })
  })
  
  if (!confirmed) return
  
  try {
    // 第2步：删除会话
    await aiGeneralStore.deleteSession(record.id)
    showMessage('删除成功', 'success')
  } catch (error) {
    console.error('删除失败:', error)
    showMessage('删除失败', 'error')
  }
}

// 处理批量删除会话
const handleBatchDelete = async (recordIds: string[]) => {
  // 第1步：确认删除
  const confirmed = await new Promise<boolean>((resolve) => {
    import('quasar').then(({ Dialog }) => {
      Dialog.create({
        title: '确认删除',
        message: `确定要删除选中的 ${recordIds.length} 个会话吗？此操作无法撤销。`,
        cancel: true,
        persistent: true
      }).onOk(() => resolve(true))
        .onCancel(() => resolve(false))
    })
  })
  
  if (!confirmed) return
  
  try {
    // 第2步：批量删除会话
    for (const id of recordIds) {
      await aiGeneralStore.deleteSession(id)
    }
    showMessage(`已删除 ${recordIds.length} 个会话`, 'success')
  } catch (error) {
    console.error('批量删除失败:', error)
    showMessage('批量删除失败', 'error')
  }
}

// 监听路由变化，更新激活状态
watch(() => route.name, (newRouteName) => {
  switch (newRouteName) {
    case 'myProfile':
      activeNavItem.value = 'toolbox'
      break
    case 'myResources':
      activeNavItem.value = 'resources'
      break
    case 'exerciseSolve':
      activeNavItem.value = 'exercises'
      break
    case 'knowledgeGraph':
      activeNavItem.value = 'knowledge'
      break
    default:
      // 保持当前状态
      break
  }
  emit('nav-item-change', activeNavItem.value)
}, { immediate: true })

// 导航处理函数
const handleToolBoxClick = () => {
  activeNavItem.value = 'toolbox'
  emit('nav-item-change', 'toolbox')
  router.push({ name: 'myProfile' })
}

const handleMyResourcesClick = () => {
  activeNavItem.value = 'resources'
  emit('nav-item-change', 'resources')
  router.push({ name: 'myResources' })
}

const handleMyExercisesClick = () => {
  activeNavItem.value = 'exercises'
  emit('nav-item-change', 'exercises')
  router.push({ name: 'exerciseSolve' })
}

const handleKnowledgeGraphClick = () => {
  activeNavItem.value = 'knowledge'
  emit('nav-item-change', 'knowledge')
  router.push({ name: 'knowledgeGraph' })
}
</script>

<style lang="scss" scoped>
// 主视图容器
.main-view {
  width: 100%;
  height: 100vh;
  background: #100035;
  backdrop-filter: blur(5px);
  border-right: 1px solid rgba(229, 231, 235, 0.3);
  display: flex;
  flex-direction: row;
  position: relative;
  align-items: stretch;
}

// 左侧导航菜单
.function-menu {
  width: 7%;
  flex-shrink: 0;
  background: #100035;
  backdrop-filter: blur(5px);
  border-right: 1px solid rgba(229, 231, 235, 0.3);
  display: flex;
  flex-direction: column;
  position: relative;
  align-items: stretch;
  padding: 12px 0;
  
  .user-avatar {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 12px 0;
    height: 80px;
    flex-shrink: 0;
  }
  
  .nav-items-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px;
    margin: 2px 4px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    
    &.active {
      background: #2a1c4e;
      color: #9059FF;
      
      .nav-icon {
        filter: none;
        width: 32px;
        height: 32px;
      }
      
      .nav-text {
        color: white;
        font-family: 'PingFang SC', sans-serif;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
    }
    
    &:hover:not(.active) {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .nav-icon {
      width: 32px;
      height: 32px;
      filter: brightness(0) invert(1);
    }
    
    .nav-text {
      margin-top: 6px;
      font-size: 16px;
      font-weight: 500;
      color: white;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
  }
}

// 右侧内容区域
.content-area {
  flex: 1;
  height: 100vh;
  overflow: hidden;
}

// 悬浮功能按钮
.floating-fab {
  position: fixed;
  z-index: 9999;
  cursor: move;
  user-select: none;
  
  // 拖动时禁用 QFab 的点击动画
  &:active {
    cursor: grabbing;
  }
}

// AI聊天内容布局样式
.ai-chat-content {
  display: flex;
  height: 100%;
  overflow: hidden;
  
  .left-panel {
    width: 30%;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
    overflow: hidden;
    
    // 按钮样式（通过 slot 传递）
    .debug-btn {
      color: rgba(255, 152, 0, 0.9);
      transition: all 0.2s ease;
      
      &:hover {
        color: #ff9800;
        background: rgba(255, 152, 0, 0.1);
      }
    }
    
    .new-chat-btn {
      color: #9059ff;
      transition: all 0.2s ease;
      
      &:hover:not(.disabled) {
        color: #7647cc;
        background: rgba(144, 89, 255, 0.1);
      }
      
      &.disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }
  }
  
  .right-panel {
    flex: 1;
    background: white;
    overflow: hidden;
  }
}

// 教师对话内容布局样式
.teacher-chat-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// 响应式设计
@media (max-width: 768px) {
  .main-view {
    flex-direction: column;
  }
  
  .function-menu {
    width: 100%;
    height: auto;
    min-height: 80px;
  }
  
  .content-area {
    width: 100%;
    height: calc(100vh - 80px);
  }
  
  .ai-chat-content {
    flex-direction: column;
    
    .left-panel {
      width: 100%;
      height: 40%;
      border-right: none;
      border-bottom: 1px solid rgba(144, 89, 255, 0.3);
    }
    
    .right-panel {
      height: 60%;
    }
  }
}
</style>
