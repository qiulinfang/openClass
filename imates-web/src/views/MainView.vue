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
          <img :src="currentToolBoxIcon" alt="工具箱" class="nav-icon" />
          <span class="nav-text">工具箱</span>
        </div>
        <div class="nav-item" :class="{ active: activeNavItem === 'knowledge' }" @click="handleKnowledgeGraphClick">
          <img :src="currentKnowledgeGraphIcon" alt="知识图谱" class="nav-icon" />
          <span class="nav-text">知识图谱</span>
        </div>
        <div class="nav-item" :class="{ active: activeNavItem === 'exercises' }" @click="handleMyExercisesClick">
          <img :src="currentExerciseIcon" alt="我的习题" class="nav-icon" />
          <span class="nav-text">我的习题</span>
        </div>
      </div>
      
      <!-- 底部菜单项 -->
      <div class="nav-items-bottom">
        <div class="nav-item" :class="{ active: activeNavItem === 'resources' }" @click="handleMyResourcesClick">
          <div class="nav-icon-wrapper">
            <img :src="currentDownloadResourcesIcon" alt="资源下载" class="nav-icon" />
            <span class="notification-dot" v-if="hasResourceNotification"></span>
          </div>
          <span class="nav-text">资源下载</span>
        </div>
        <div class="nav-item" @click="handleLogoutClick">
          <img :src="currentLogoutIcon" alt="退出登录" class="nav-icon" />
          <span class="nav-text">退出登录</span>
        </div>
      </div>
    </div>
    
    <!-- 右侧主区域 -->
    <div class="right-main-area">
      <!-- 工具箱区域 -->
      <transition name="toolbox-transition">
        <div class="toolbox-area" v-if="showToolbox">
          <MyProfileView v-if="showToolbox" />
        </div>
      </transition>
      
      <!-- 内容区域 -->
      <div class="content-area">
        <router-view />
      </div>
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
    <DraftDialog v-model="showDraftDialog" />

    <!-- 统一聊天对话框 -->
    <UnifiedChatDialog 
      v-model="uiStore.showAIChatDialog" 
      initial-category="ai"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/uiStore'
import DraftDialog from '@/components/DraftDialog.vue'
import UnifiedChatDialog from '@/components/UnifiedChatDialog.vue'
import MyProfileView from '@/views/MyProfileView.vue'

// 流程：导入图标资源
// 第1步：导入普通状态图标
import avatarIcon from '/icons/avatar.svg'
import toolBoxIcon from '/icons/toolBox.svg'
import downloadResourcesIcon from '/icons/downloadResources.svg'
import knowledgeGraphIcon from '/icons/knowledge_graph.svg'
import exerciseIcon from '/icons/my_exercises.svg'
import logoutIcon from '/icons/logout.svg'

// 第2步：导入选中状态图标
import toolBoxSelectIcon from '/icons/toolBox_select.svg'
import downloadResourcesSelectIcon from '/icons/downloadResources_select.svg'
import knowledgeGraphSelectIcon from '/icons/knowledge_graph_select.svg'
import exerciseSelectIcon from '/icons/my_exercises_select.svg'

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

// 响应式数据
const activeNavItem = ref(props.activeNavItem)

// 对话框显示状态
const showDraftDialog = ref(false)

// 工具箱显示状态
const showToolbox = ref(false)

// 资源通知状态
const hasResourceNotification = ref(false)

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

// 第3步：根据选中状态计算当前应该显示的图标
const currentToolBoxIcon = computed(() => {
  return activeNavItem.value === 'toolbox' ? toolBoxSelectIcon : toolBoxIcon
})

const currentKnowledgeGraphIcon = computed(() => {
  return activeNavItem.value === 'knowledge' ? knowledgeGraphSelectIcon : knowledgeGraphIcon
})

const currentExerciseIcon = computed(() => {
  return activeNavItem.value === 'exercises' ? exerciseSelectIcon : exerciseIcon
})

const currentDownloadResourcesIcon = computed(() => {
  return activeNavItem.value === 'resources' ? downloadResourcesSelectIcon : downloadResourcesIcon
})

const currentLogoutIcon = computed(() => {
  // 退出登录没有选中状态，始终使用普通图标
  return logoutIcon
})

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
  // 打开对话框（组件内部会处理会话加载）
  uiStore.openAIChatDialog()
}

// 监听路由变化，更新激活状态
watch(() => route.name, (newRouteName) => {
  switch (newRouteName) {
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

// 切换工具箱显示状态
const toggleToolbox = () => {
  showToolbox.value = !showToolbox.value
}

// 导航处理函数
const handleToolBoxClick = () => {
  activeNavItem.value = 'toolbox'
  emit('nav-item-change', 'toolbox')
  // 点击功能箱菜单时切换工具箱显示状态
  toggleToolbox()
}

const handleMyResourcesClick = () => {
  activeNavItem.value = 'resources'
  emit('nav-item-change', 'resources')
  // 如果工具箱区域是打开的，则关闭它
  if (showToolbox.value) {
    showToolbox.value = false
  }
  router.push({ name: 'myResources' })
}

const handleMyExercisesClick = () => {
  activeNavItem.value = 'exercises'
  emit('nav-item-change', 'exercises')
  // 如果工具箱区域是打开的，则关闭它
  if (showToolbox.value) {
    showToolbox.value = false
  }
  router.push({ name: 'exerciseSolve' })
}

const handleKnowledgeGraphClick = () => {
  activeNavItem.value = 'knowledge'
  emit('nav-item-change', 'knowledge')
  // 如果工具箱区域是打开的，则关闭它
  if (showToolbox.value) {
    showToolbox.value = false
  }
  router.push({ name: 'knowledgeGraph' })
}

// 处理退出登录点击
const handleLogoutClick = async () => {
  try {
    // 如果工具箱区域是打开的，则关闭它
    if (showToolbox.value) {
      showToolbox.value = false
    }
    // 跳转到登录页面，清除本地存储等逻辑在路由守卫或登录页面处理
    router.push('/login')
  } catch (error) {
    console.error('退出登录失败:', error)
  }
}
</script>

<style lang="scss" scoped>
// 主视图容器
.main-view {
  width: 100%;
  height: 100vh;
  background: #3d3070;
  backdrop-filter: blur(5px);
  border-right: 1px solid rgba(229, 231, 235, 0.3);
  display: flex;
  flex-direction: row;
  position: relative;
  align-items: stretch;
}

// 左侧导航菜单
.function-menu {
  width: 8%;
  flex-shrink: 0;
  background: #ffffff;
  border-radius: 0 24px 24px 0;
  display: flex;
  flex-direction: column;
  position: relative;
  align-items: stretch;
  padding: 16px 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  z-index: 1001; // 确保功能菜单层级高于工具箱
  
  .user-avatar {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 12px 0;
    margin-bottom: 16px;
    flex-shrink: 0;
    
    img {
      border-radius: 50%;
      background: #e3f2fd;
      padding: 4px;
    }
  }
  
  .nav-items-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 8px;
  }
  
  .nav-items-bottom {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 8px;
    margin-top: auto;
    padding-top: 24px;
  }
  
  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    margin: 0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    position: relative;
    
    &.active {
      background: #f3e8ff;
      
      .nav-icon {
        opacity: 1;
        color: #9059FF;
        
        img {
          filter: none;
          opacity: 1;
        }
      }
      
      .nav-text {
        color: #9059FF;
        font-weight: 600;
      }
    }
    
    &:hover:not(.active) {
      background: #f9fafb;
    }
    
    .nav-icon-wrapper {
      position: relative;
      display: inline-block;
    }
    
    .nav-icon {
      width: 28px;
      height: 28px;
      transition: all 0.2s ease;
      font-size: 28px;
      color: #9ca3af;
      display: flex;
      align-items: center;
      justify-content: center;
      
      img {
        width: 100%;
        height: 100%;
        filter: grayscale(100%) brightness(0.6);
        opacity: 0.6;
        transition: all 0.2s ease;
      }
      
      // q-icon 样式
      &:not(img) {
        opacity: 0.6;
      }
    }
    
    .notification-dot {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 8px;
      height: 8px;
      background: #ef4444;
      border-radius: 50%;
      border: 2px solid #ffffff;
    }
    
    .nav-text {
      margin-top: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      transition: all 0.2s ease;
      font-family: 'PingFang SC', sans-serif;
    }
    
    &:hover:not(.active) {
      .nav-icon {
        opacity: 0.8;
        color: #6b7280;
        
        img {
          opacity: 0.8;
        }
      }
      
      .nav-text {
        color: #4b5563;
      }
    }
  }
}

// 右侧主区域
.right-main-area {
  flex: 1;
  display: flex;
  height: 100vh;
  overflow: hidden;
}

// 工具箱区域
.toolbox-area {
  position: fixed;
  left: 7.5%; // 左侧导航菜单的宽度
  top: 0;
  width: 28%;
  height: 100vh;
  background: #3D3070;
  border-bottom: 1px solid rgba(229, 231, 235, 0.3);
  overflow-y: auto;
  z-index: 999; // 层级低于功能菜单，不可覆盖功能菜单
  
  // 自定义滚动条样式
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  }
  
  // 调整MyProfileView在工具箱中的样式
  :deep(.profile-container) {
    min-height: auto;
    background: transparent;
  }
}

// 工具箱过渡动画 - 使用 translate 弹出效果
.toolbox-transition-enter-active,
.toolbox-transition-leave-active {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.toolbox-transition-enter-from {
  transform: translateX(-100%);
}

.toolbox-transition-enter-to {
  transform: translateX(0);
}

.toolbox-transition-leave-from {
  transform: translateX(0);
}

.toolbox-transition-leave-to {
  transform: translateX(-100%);
}

.content-area {
  position: relative;
  margin-left: 0;
  padding: 0;
  background-color: #e3f2fd;
  min-height: 100vh;
  width: 100%; // 默认宽度占满父容器（right-main-area）
  min-height: 0;
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

// 响应式设计
@media (max-width: 768px) {
  .main-view {
    flex-direction: column;
  }
  
  .function-menu {
    width: 100%;
    height: auto;
    min-height: 80px;
    border-radius: 0;
    margin: 0;
    flex-direction: row;
    padding: 8px;
    
    .user-avatar {
      margin-bottom: 0;
      margin-right: 8px;
    }
    
    .nav-items-container {
      flex-direction: row;
      flex: 1;
      gap: 4px;
    }
    
    .nav-items-bottom {
      flex-direction: row;
      margin-top: 0;
      padding-top: 0;
      margin-left: auto;
      gap: 4px;
    }
  }
  
  .right-main-area {
    width: 100%;
    height: calc(100vh - 80px);
  }
  
  .toolbox-area {
    width: 100%;
  }
  
  .content-area {
    width: 100%;
    flex: 1;
    min-height: 0;
  }
}
</style>
