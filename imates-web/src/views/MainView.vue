<template>
  <div 
    class="main-view"
    @mousemove="handleDrag"
    @mouseup="stopDrag"
    @touchmove="handleDrag"
    @touchend="stopDrag"
    @click="handleMainViewClick"
  >
    <!-- 功能菜单 -->
    <div class="function-menu">
      <!-- 用户头像 -->
      <div class="user-avatar">
        <img src="/icons/avatar.svg" alt="avatar" style="width: 40px; height: 40px;" />
      </div>
      
      <div class="nav-items-container">
        <div class="nav-item" :class="{ active: activeNavItem === 'toolbox' }" @click="handleToolBoxClick">
          <img src="/icons/toolBox.svg" alt="功能箱" class="nav-icon" />
          <span class="nav-text">功能箱</span>
        </div>
        <div class="nav-item" :class="{ active: activeNavItem === 'resources' }" @click="handleMyResourcesClick">
          <img src="/icons/downloadResources.svg" alt="我的资源" class="nav-icon" />
          <span class="nav-text">我的资源</span>
        </div>
        <div class="nav-item" :class="{ active: activeNavItem === 'exercises' }" @click="handleMyExercisesClick">
          <img src="/icons/book.svg" alt="我的习题" class="nav-icon" />
          <span class="nav-text">我的习题</span>
        </div>
        <div class="nav-item" :class="{ active: activeNavItem === 'knowledge' }" @click="handleKnowledgeGraphClick">
          <img src="/icons/isKnowledgeGraphSelected.svg" alt="知识图谱" class="nav-icon" />
          <span class="nav-text">知识图谱</span>
        </div>
      </div>
    </div>
    
    <!-- 内容区域 -->
    <div class="content-area">
      <router-view />
    </div>

    <!-- 悬浮可拖动图标 -->
    <div 
      class="floating-icon"
      :style="floatingIconStyle"
      @mousedown.prevent="startDrag"
      @touchstart.prevent="startDrag"
      @click.stop
    >
      <img src="/icons/toolBox.svg" alt="悬浮图标" />
    </div>

    <!-- 气泡框 -->
    <div 
      v-if="showBubble"
      class="bubble-menu"
      :style="bubbleMenuStyle"
    >
      <div class="bubble-option" @click="handleDraftClick">
        <img src="/icons/book.svg" alt="草稿本" class="option-icon" />
        <span>草稿本</span>
      </div>
      <div class="bubble-option" @click="handleAIChatClick">
        <img src="/icons/avatar.svg" alt="与AI聊天" class="option-icon" />
        <span>与AI聊天</span>
      </div>
    </div>
    <button @click="showDraftDialog = true">显示草稿本对话框</button>
    <button @click="showAIChatDialog = true">显示AI聊天对话框</button>
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

// 悬浮图标拖动相关状态
const floatingIconPosition = ref({ x: window.innerWidth - 80, y: window.innerHeight - 80 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const dragStartPosition = ref({ x: 0, y: 0 })

// 气泡框相关状态
const showBubble = ref(false)

// 对话框显示状态
const showDraftDialog = ref(false)
const showAIChatDialog = ref(false)

// 问题记录数据
const questionRecords = ref<QuestionRecord[]>([])

// 计算悬浮图标样式
const floatingIconStyle = computed(() => ({
  left: `${floatingIconPosition.value.x}px`,
  top: `${floatingIconPosition.value.y}px`
}))

// 计算气泡框样式
const bubbleMenuStyle = computed(() => {
  const iconSize = 60
  const bubbleWidth = 160
  const bubbleHeight = 120
  
  let left = floatingIconPosition.value.x + iconSize + 10
  let top = floatingIconPosition.value.y
  
  if (left + bubbleWidth > window.innerWidth) {
    left = floatingIconPosition.value.x - bubbleWidth - 10
  }
  
  if (top + bubbleHeight > window.innerHeight) {
    top = window.innerHeight - bubbleHeight - 10
  }
  
  return {
    left: `${left}px`,
    top: `${top}px`
  }
})

// 开始拖动
const startDrag = (event: MouseEvent | TouchEvent) => {
  // 设置拖动状态
  isDragging.value = true
  
  // 计算鼠标/触摸点相对图标左上角的偏移
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  dragOffset.value = {
    x: clientX - floatingIconPosition.value.x,
    y: clientY - floatingIconPosition.value.y
  }
  
  dragStartPosition.value = {
    x: floatingIconPosition.value.x,
    y: floatingIconPosition.value.y
  }
}

// 拖动中
const handleDrag = (event: MouseEvent | TouchEvent) => {
  // 检查是否正在拖动
  if (!isDragging.value) return
  
  // 获取鼠标/触摸点位置
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  // 计算新位置
  let newX = clientX - dragOffset.value.x
  let newY = clientY - dragOffset.value.y
  
  // 限制在视口范围内
  const iconSize = 60
  newX = Math.max(0, Math.min(window.innerWidth - iconSize, newX))
  newY = Math.max(0, Math.min(window.innerHeight - iconSize, newY))
  
  // 更新位置
  floatingIconPosition.value = { x: newX, y: newY }
}

// 停止拖动
const stopDrag = () => {
  // 计算拖动距离
  const dragDistance = Math.sqrt(
    Math.pow(floatingIconPosition.value.x - dragStartPosition.value.x, 2) +
    Math.pow(floatingIconPosition.value.y - dragStartPosition.value.y, 2)
  )
  
  // 判断是否是点击（拖动距离小于5px认为是点击）
  if (dragDistance < 5) {
    showBubble.value = !showBubble.value
  }
  
  // 重置拖动状态
  isDragging.value = false
}

// 关闭气泡框
const closeBubble = () => {
  showBubble.value = false
}

// 处理主视图点击（点击其他区域关闭气泡框）
const handleMainViewClick = () => {
  if (showBubble.value) {
    closeBubble()
  }
}

// 处理草稿本点击
const handleDraftClick = () => {
  closeBubble()
  showDraftDialog.value = true
}

// 处理AI聊天点击
const handleAIChatClick = () => {
  closeBubble()
  showAIChatDialog.value = true
}

// 处理问题记录点击
const handleQuestionRecordClick = () => {
  // 可以在这里处理点击记录后的逻辑
}

// 组件挂载时初始化位置
onMounted(() => {
  // 设置初始位置在右下角
  floatingIconPosition.value = {
    x: window.innerWidth - 80,
    y: window.innerHeight - 80
  }
})

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

// 悬浮可拖动图标
.floating-icon {
  position: fixed;
  width: 60px;
  height: 60px;
  background: rgba(144, 89, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
  user-select: none;
  
  &:hover {
    transform: scale(1.1);
    background: rgba(144, 89, 255, 1);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  img {
    width: 32px;
    height: 32px;
    filter: brightness(0) invert(1);
  }
}

// 气泡框 - 参考 KnowledgeGraph 样式
.bubble-menu {
  position: fixed;
  background: #4A3A6B;
  border-radius: 20px;
  padding: 12px;
  z-index: 10000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: bubbleIn 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 120px;
  
  .bubble-option {
    border: none;
    border-radius: 21px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'PingFang SC', 'PingFangSC-Regular', sans-serif;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    
    &:first-child {
      background: rgba(129, 95, 255, 0.9);
      
      &:hover {
        background: rgba(107, 79, 255, 1);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
    }
    
    &:last-child {
      background: rgba(255, 151, 103, 0.9);
      
      &:hover {
        background: rgba(255, 138, 77, 1);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }
    }
    
    &:active {
      transform: translateY(0);
    }
    
    .option-icon {
      width: 20px;
      height: 20px;
      filter: brightness(0) invert(1);
    }
    
    span {
      white-space: nowrap;
    }
  }
}

@keyframes bubbleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
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
