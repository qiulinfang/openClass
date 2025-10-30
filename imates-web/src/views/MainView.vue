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
      :initial-width="1200"
      :initial-height="700"
      @splitter-change="handleSplitterChange"
    >
      <!-- Header左侧：汉堡菜单按钮 -->
      <template #header-left>
        <q-btn
          flat
          round
          dense
          :icon="showDraftPanel ? 'menu_open' : 'menu'"
          color="grey-7"
          size="sm"
          @click="toggleDraftPanel"
        >
          <q-tooltip>{{ showDraftPanel ? '隐藏草稿列表' : '显示草稿列表' }}</q-tooltip>
        </q-btn>
      </template>
      
      <!-- 左侧：草稿列表 -->
      <template v-if="showDraftPanel" #left-panel>
        <div class="draft-panel">
          <!-- 草稿列表 -->
          <div class="draft-list">
            <!-- 草稿卡片 -->
            <div
              v-for="(draft, index) in draftList"
              :key="draft.id"
              class="draft-item"
              :class="{ 'is-active': currentDraftIndex === index }"
              @click="switchDraft(index)"
            >
              <!-- 左上角序号 -->
              <div class="draft-number">{{ index + 1 }}</div>
              
              <!-- 中间缩略图 -->
              <div class="draft-thumbnail">
                <img 
                  v-if="draft.thumbnail" 
                  :src="draft.thumbnail" 
                  alt="草稿缩略图"
                  class="thumbnail-image"
                />
                <div v-else class="thumbnail-placeholder">
                </div>
              </div>
              <!-- 右上角删除按钮 -->
              <q-btn
                v-if="index !== 0"
                flat
                round
                dense
                icon="close"
                size="sm"
                class="delete-btn"
                @click.stop="confirmDeleteDraft(index)"
              >
                <q-tooltip>删除草稿</q-tooltip>
              </q-btn>
            </div>

            <!-- 新增草稿按钮（在最后） -->
            <div class="add-draft-btn" @click="handleNewDraft">
              <q-icon name="add" size="32px" color="primary" />
            </div>
          </div>
        </div>
      </template>

      <!-- 主内容：绘图板 -->
      <DrawingBoard ref="drawingBoardRef" @content-change="updateCurrentDraftThumbnail" />
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
const showDraftPanel = ref(true) // 控制草稿列表显示隐藏

// 分屏比例
const splitterRatio = ref(18)

// 草稿本管理
interface DrawObject {
  type: 'path' | 'rectangle' | 'circle' | 'line' | 'triangle' | 'text'
  color: string
  lineWidth: number
  points?: { x: number; y: number }[]
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  text?: string
  fontSize?: number
  opacity?: number
}

interface Draft {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  thumbnail?: string
  // 绘图数据
  objects: DrawObject[]
  history: DrawObject[][]
  historyIndex: number
}

const drawingBoardRef = ref<InstanceType<typeof DrawingBoard> | null>(null)
const draftList = ref<Draft[]>([
  {
    id: `draft-${Date.now()}`,
    name: '草稿1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    objects: [],
    history: [[]],
    historyIndex: 0
  }
])
const currentDraftIndex = ref(0)

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

// 流程：切换草稿列表面板显示隐藏
const toggleDraftPanel = () => {
  showDraftPanel.value = !showDraftPanel.value
}

// 流程：处理分屏比例变化
const handleSplitterChange = (ratio: number) => {
  splitterRatio.value = ratio
  console.log('[MainView] 📊 分屏比例变化:', ratio)
}

// 流程：新建草稿
const handleNewDraft = () => {
  console.log('[MainView] 🆕 新建草稿')
  
  // 第1步：保存当前草稿的绘图数据和缩略图
  if (drawingBoardRef.value) {
    const currentData = drawingBoardRef.value.saveData()
    const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
    draftList.value[currentDraftIndex.value].objects = currentData.objects
    draftList.value[currentDraftIndex.value].history = currentData.history
    draftList.value[currentDraftIndex.value].historyIndex = currentData.historyIndex
    draftList.value[currentDraftIndex.value].thumbnail = thumbnail
    console.log('[MainView] 💾 已保存当前草稿数据')
  }
  
  // 第2步：创建新草稿
  const newDraft: Draft = {
    id: `draft-${Date.now()}`,
    name: `草稿${draftList.value.length + 1}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    objects: [],
    history: [[]],
    historyIndex: 0
  }
  
  draftList.value.push(newDraft)
  currentDraftIndex.value = draftList.value.length - 1
  
  // 第3步：清空绘图板并生成新草稿的缩略图
  if (drawingBoardRef.value) {
    drawingBoardRef.value.loadData({
      objects: [],
      history: [[]],
      historyIndex: 0
    })
    console.log('[MainView] 🎨 绘图板已清空')
    
    // 第4步：为新建的空白草稿立即生成缩略图
    setTimeout(() => {
      if (drawingBoardRef.value) {
        const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
        draftList.value[currentDraftIndex.value].thumbnail = thumbnail
        console.log('[MainView] 📸 已为新草稿生成缩略图')
      }
    }, 100)
  }
  
  console.log('[MainView] ✅ 新草稿已创建:', newDraft.name)
}

// 流程：切换草稿
const switchDraft = (index: number) => {
  if (index < 0 || index >= draftList.value.length) {
    console.warn('[MainView] ⚠️ 无效的草稿索引:', index)
    return
  }
  
  // 如果点击的是当前草稿，不需要切换
  if (index === currentDraftIndex.value) {
    console.log('[MainView] ℹ️ 已经是当前草稿，无需切换')
    return
  }
  
  console.log('[MainView] 📄 切换草稿:', {
    from: draftList.value[currentDraftIndex.value].name,
    to: draftList.value[index].name
  })
  
  // 第1步：保存当前草稿的绘图数据和缩略图
  if (drawingBoardRef.value) {
    const currentData = drawingBoardRef.value.saveData()
    const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
    draftList.value[currentDraftIndex.value].objects = currentData.objects
    draftList.value[currentDraftIndex.value].history = currentData.history
    draftList.value[currentDraftIndex.value].historyIndex = currentData.historyIndex
    draftList.value[currentDraftIndex.value].thumbnail = thumbnail
    draftList.value[currentDraftIndex.value].updatedAt = Date.now()
    console.log('[MainView] 💾 已保存当前草稿数据:', {
      draft: draftList.value[currentDraftIndex.value].name,
      objects: currentData.objects.length
    })
  }
  
  // 第2步：切换到新草稿
  currentDraftIndex.value = index
  
  // 第3步：加载新草稿的绘图数据
  if (drawingBoardRef.value) {
    const newDraft = draftList.value[index]
    drawingBoardRef.value.loadData({
      objects: newDraft.objects,
      history: newDraft.history,
      historyIndex: newDraft.historyIndex
    })
    console.log('[MainView] 📥 已加载新草稿数据:', {
      draft: newDraft.name,
      objects: newDraft.objects.length
    })
    
    // 如果新草稿没有缩略图，生成一个
    setTimeout(() => {
      if (drawingBoardRef.value && !draftList.value[index].thumbnail) {
        const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
        draftList.value[index].thumbnail = thumbnail
        console.log('[MainView] 📸 已为切换后的草稿生成缩略图')
      }
    }, 100)
  }
  
  // 第4步：更新草稿修改时间
  draftList.value[index].updatedAt = Date.now()
  
  console.log('[MainView] ✅ 草稿切换完成')
}

// 流程：删除草稿
const confirmDeleteDraft = (index: number) => {
  // 第1个草稿不允许删除
  if (index === 0) {
    showMessage('第一个草稿不能删除', 'warning')
    return
  }
  
  const draftName = draftList.value[index].name
  console.log('[MainView] 🗑️ 删除草稿:', draftName)
  
  // 第1步：如果删除的是当前草稿，保存数据
  const oldCurrentIndex = currentDraftIndex.value
  const isDeletingCurrent = index === currentDraftIndex.value
  
  if (isDeletingCurrent && drawingBoardRef.value) {
    const currentData = drawingBoardRef.value.saveData()
    draftList.value[currentDraftIndex.value].objects = currentData.objects
    draftList.value[currentDraftIndex.value].history = currentData.history
    draftList.value[currentDraftIndex.value].historyIndex = currentData.historyIndex
    console.log('[MainView] 💾 已保存即将删除的草稿数据')
  }
  
  // 第2步：删除草稿
  draftList.value.splice(index, 1)
  
  // 第3步：计算新的当前索引
  let newIndex = currentDraftIndex.value
  if (currentDraftIndex.value >= draftList.value.length) {
    newIndex = draftList.value.length - 1
  } else if (currentDraftIndex.value === index) {
    newIndex = Math.max(0, index - 1)
  } else if (index < currentDraftIndex.value) {
    // 删除的是当前草稿之前的，索引需要减1
    newIndex = currentDraftIndex.value - 1
  }
  
  // 第4步：如果当前索引改变了，加载新草稿的数据
  if (newIndex !== oldCurrentIndex || isDeletingCurrent) {
    currentDraftIndex.value = newIndex
    
    if (drawingBoardRef.value) {
      const newDraft = draftList.value[newIndex]
      drawingBoardRef.value.loadData({
        objects: newDraft.objects,
        history: newDraft.history,
        historyIndex: newDraft.historyIndex
      })
      console.log('[MainView] 📥 已加载草稿数据:', newDraft.name)
    }
  }
  
  console.log('[MainView] ✅ 草稿已删除:', draftName)
}

// 流程：监听草稿本对话框打开/关闭
watch(showDraftDialog, (isOpen) => {
  if (isOpen && drawingBoardRef.value) {
    // 对话框打开时，为当前草稿生成缩略图（如果还没有）
    setTimeout(() => {
      if (drawingBoardRef.value && !draftList.value[currentDraftIndex.value].thumbnail) {
        const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
        draftList.value[currentDraftIndex.value].thumbnail = thumbnail
        console.log('[MainView] 📸 已为草稿生成初始缩略图')
      }
    }, 100)
  } else if (!isOpen && drawingBoardRef.value) {
    // 对话框关闭时，保存当前草稿数据和缩略图
    const currentData = drawingBoardRef.value.saveData()
    const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
    draftList.value[currentDraftIndex.value].objects = currentData.objects
    draftList.value[currentDraftIndex.value].history = currentData.history
    draftList.value[currentDraftIndex.value].historyIndex = currentData.historyIndex
    draftList.value[currentDraftIndex.value].thumbnail = thumbnail
    draftList.value[currentDraftIndex.value].updatedAt = Date.now()
    console.log('[MainView] 💾 草稿本关闭，已保存草稿数据:', {
      draft: draftList.value[currentDraftIndex.value].name,
      objects: currentData.objects.length
    })
  }
})

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
    if (!aiGeneralStore.isCreatingSession) {
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
    
  } catch (error) {
    console.error('重命名失败:', error)
  }
}

// 第2步：处理记录置顶/取消置顶
const handleRecordPin = async (record: QuestionRecord) => {
  try {
    await aiGeneralStore.togglePin(record.id)
  } catch (error) {
    console.error('置顶操作失败:', error)
    showMessage('操作失败', 'error')
  }
}

// 第3步：处理记录删除
const handleRecordDelete = async (record: QuestionRecord) => {
  try {
    // 第1步：删除会话
    await aiGeneralStore.deleteSession(record.id)
    showMessage('删除成功', 'success')
  } catch (error) {
    console.error('删除失败:', error)
    showMessage('删除失败', 'error')
  }
}

// 处理批量删除会话
const handleBatchDelete = async (recordIds: string[]) => {
  try {
    // 第1步：批量删除会话
    for (const id of recordIds) {
      await aiGeneralStore.deleteSession(id)
    }
    showMessage(`已删除 ${recordIds.length} 个会话`, 'success')
  } catch (error) {
    console.error('批量删除失败:', error)
    showMessage('批量删除失败', 'error')
  }
}

// 新增：内容变化时更新当前草稿缩略图
const updateCurrentDraftThumbnail = () => {
  // 第1步：校验引用
  if (!drawingBoardRef.value) return
  // 第2步：生成缩略图
  const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
  // 第3步：写入当前草稿
  draftList.value[currentDraftIndex.value].thumbnail = thumbnail
  draftList.value[currentDraftIndex.value].updatedAt = Date.now()
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

// 草稿面板样式
.draft-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fafafb;
  
  .draft-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .draft-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    background: white;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    aspect-ratio: 1 / 1;
    
    &:hover {
      border-color: rgba(144, 89, 255, 0.5);
      box-shadow: 0 2px 8px rgba(144, 89, 255, 0.2);
      transform: scale(1.02);
      
      .delete-btn {
        opacity: 1;
      }
    }
    
    &.is-active {
      border-color: #9059ff;
      background: rgba(144, 89, 255, 0.02);
      
      .draft-number {
        background: #9059ff;
        color: white;
      }
    }
  }
  
  .draft-number {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(144, 89, 255, 0.1);
    color: #9059ff;
    font-size: 11px;
    font-weight: 600;
    border-radius: 50%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    z-index: 1;
  }
  
  .draft-thumbnail {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    overflow: hidden;
    background: #ffffff;
    
    .thumbnail-image {
      width: 100%;           /* 或指定固定宽度，如 200px */
      height: auto;
      aspect-ratio: 1 / 1;   /* 强制宽高比为 1:1 */
      object-fit: cover;     /* 裁剪多余部分，保持比例 */
      object-position: center;
    }
    
    .thumbnail-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }
  }
  
  .delete-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    opacity: 1;
    z-index: 10;
    
    :deep(.q-icon) {
      font-size: 16px;
    }
    
    &:hover {
      background: #ff4444;
      color: white;
      box-shadow: 0 3px 8px rgba(255, 68, 68, 0.4);
      transform: scale(1.1);
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
  
  // 新增草稿按钮（底部）
  .add-draft-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    border: 2px dashed rgba(144, 89, 255, 0.3);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(144, 89, 255, 0.02);
    margin-top: 4px;
    width: 100%;
    aspect-ratio: 1 / 1;
    
    &:hover {
      border-color: rgba(144, 89, 255, 0.6);
      background: rgba(144, 89, 255, 0.05);
      transform: scale(1.02);
    }
  }
}
</style>
