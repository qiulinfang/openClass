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
      v-model="showAIChatDialog" 
      title="与AI聊天"
      :initial-width="1000"
      :initial-height="600"
      :min-width="600"
      :min-height="400"
    >
      <div class="ai-chat-content">
        <!-- 左侧问题记录 -->
        <div class="left-panel">
          <div class="panel-header">
            <span class="panel-title">问题记录</span>
          </div>
          <div class="panel-content">
            <QuestionRecordList 
              :records="questionRecords"
              @record-click="handleQuestionRecordClick"
            />
          </div>
        </div>

        <!-- 右侧聊天界面 -->
        <div class="right-panel">
          <ChatView 
            type="ai-general"
          />
        </div>
      </div>
    </DraggableDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import DrawingBoard from '@/components/DrawingBoard.vue'
import QuestionRecordList from '@/components/QuestionRecordList.vue'
import ChatView from '@/components/ChatView.vue'
import DraggableDialog from '@/components/DraggableDialog.vue'
import type { QuestionRecord } from '@/types'

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

// 响应式数据
const activeNavItem = ref(props.activeNavItem)

// 对话框显示状态
const showDraftDialog = ref(false)
const showAIChatDialog = ref(false)

// 问题记录数据
const questionRecords = ref<QuestionRecord[]>([])

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
const handleAIChatClick = () => {
  showAIChatDialog.value = true
}

// 处理问题记录点击
const handleQuestionRecordClick = () => {
  // 可以在这里处理点击记录后的逻辑
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
    border-right: 1px solid rgba(144, 89, 255, 0.3);
    display: flex;
    flex-direction: column;
    background: rgba(20, 12, 50, 0.5);
    
    .panel-header {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(144, 89, 255, 0.2);
      
      .panel-title {
        color: white;
        font-size: 14px;
        font-weight: 500;
      }
    }
    
    .panel-content {
      flex: 1;
      overflow: hidden;
    }
  }
  
  .right-panel {
    flex: 1;
    background: white;
    overflow: hidden;
  }
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
