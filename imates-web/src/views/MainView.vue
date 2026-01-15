<template>
  <div
    class="main-view"
    :style="mainViewStyle"
    @mousemove="handleDrag"
    @mouseup="stopDrag"
    @touchmove="handleDrag"
    @touchend="stopDrag"
  >
    <!-- 功能菜单：在部分路由（如作业答题、作业作答）隐藏 -->
    <div class="function-menu" v-if="!hideFunctionMenu">
      <!-- 用户头像 -->
      <div class="user-avatar" :class="{ 'in-class': isInClass }" @click="handleAvatarClick">
        <img :src="userAvatar" alt="avatar" style="width: 40px; height: 40px" />
        <div class="user-name">{{ displayUserName }}</div>
      </div>

      <!-- 导航菜单（根据学校配置渲染） -->
      <div class="nav-items-container">
        <div
          v-for="item in navMainItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: isNavItemActive(item.key) }"
          @click="handleNavItemClick(item)"
        >
          <div class="nav-icon-wrapper" v-if="item.key === 'toolbox'">
            <img :src="getNavIcon(item)" :alt="item.label" class="nav-icon" />
            <span class="notification-badge" v-if="userClientUnreadCount > 0">{{ userClientUnreadCount }}</span>
          </div>
          <img
            v-else
            :src="getNavIcon(item)"
            :alt="item.label"
            class="nav-icon"
          />
          <span class="nav-text">{{ item.label }}</span>
        </div>
      </div>

      <!-- 底部菜单项 -->
      <div class="nav-items-bottom">
        <div
          v-for="item in navBottomItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: isNavItemActive(item.key) }"
          @click="handleNavItemClick(item)"
        >
          <div class="nav-icon-wrapper" v-if="item.key === 'resources'">
            <img :src="getNavIcon(item)" :alt="item.label" class="nav-icon" />
            <span class="notification-dot" v-if="hasResourceNotification"></span>
          </div>
          <img
            v-else
            :src="getNavIcon(item)"
            :alt="item.label"
            class="nav-icon"
          />
          <span class="nav-text">{{ item.label }}</span>
        </div>
      </div>
    </div>

    <!-- 右侧主区域 -->
    <div class="right-main-area">
      <!-- 工具箱区域 -->
      <transition
        name="toolbox-transition"
        @after-enter="handleToolboxEnter"
        @after-leave="handleToolboxLeave"
      >
        <div class="toolbox-area" v-show="showToolbox" @click.stop>
          <MyProfileView v-if="showToolbox" />
        </div>
      </transition>

      <!-- 内容区域 -->
      <div class="content-area" @click="handleContentAreaClick">
        <!-- 使用带插槽的 router-view 写法，让 keep-alive 真正缓存子路由组件实例 -->
        <router-view v-slot="{ Component }">
          <keep-alive :include="cachedComponents">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </div>
    </div>

    <!-- 悬浮功能按钮（手动实现） -->
    <div
      v-if="showFab"
      class="floating-fab"
      :style="fabStyle"
      @mousedown="startDrag"
      @touchstart="startDrag"
    >
      <!-- 悬浮功能按钮 -->
      <button type="button" class="floating-fab-btn" :style="{ backgroundImage: `url(${ipGif})` }" @click.stop="handleFloatingFabClick"></button>

      <!-- 知识图谱未下载资源引导：气泡提示（贴近悬浮功能按钮） -->
      <div v-if="shouldShowGoResourcesHint && showGoResourcesBubble" class="go-resources-bubble">
        <div class="go-resources-text">请去资源下载寻找你想学习的教材哦</div>
        <button class="go-resources-btn" @click="goToResources">去资源下载</button>
      </div>
    </div>

    <!-- AI统一聊天对话框 -->
    <GlobalChatDialog
      v-model="uiStore.showAIChatDialog"
      @toggle-mode="handleToggleUnifiedChatMode"
    />

    <!-- 教师统一聊天对话框 -->
    <GlobalChatDialog
      ref="teacherChatDialogRef"
      v-model="showTeacherChatDialog"
      :initial-teacher-subject="teacherChatSubject"
      @session-created="handleTeacherSessionCreated"
    />

    <!-- 反馈与建议对话框 -->
    <FeedbackDialog v-model="showFeedbackDialog" />

    <!-- 个人信息对话框 -->
    <ProfileDialog
      v-model="showProfileDialog"
      :userInfo="currentUserInfo"
      @avatar-changed="handleAvatarChanged"
    />

    <!-- 主页右侧统一聊天面板 -->
    <MainChatPanel
      v-if="showMainChatPanel"
      @close="showMainChatPanel = false"
      @toggle-mode="handleToggleMainChatMode"
    />
    <!-- 草稿本对话框 -->
    <DraggableDialog
      v-model="showDraftNotebook"
      title="草稿本"
      :close-on-overlay-click="false"
      :show-overlay="false"
      :initial-width="1200"
      :initial-height="800"
    >
      <DrawingBoardView />
    </DraggableDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick, provide } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/uiStore'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useResourceStore } from '@/stores/resourceStore'
import GlobalChatDialog from '@/components/dialog/GlobalChatDialog.vue'
import FeedbackDialog from '@/components/dialog/FeedbackDialog.vue'
import ProfileDialog from '@/components/dialog/ProfileDialog.vue'
import MainChatPanel from '@/components/MainChatPanel.vue'
import MyProfileView from '@/views/MyProfileView.vue'
import DrawingBoardView from '@/views/DrawingBoardView.vue'
import DraggableDialog from '@/components/base/Modal.vue'
import { resourceManager } from '@/services/storage/resource-storage'
import { apiService } from '@/services/http/api-service'
import { androidBridge } from '@/services/business/android-bridge'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useUserClientStore } from '@/stores/userClientStore'
import { getCurrentSchoolAppConfig, type NavItemConfig, type NavKey } from '@/config/school-app-config'
import type { UserTextbookInfo } from '@/types'

// 流程：导入图标资源
// 第1步：导入普通状态图标
import avatarIcon from '/icons/avatar.svg'
import toolBoxIcon from '/icons/toolBox.svg'
import downloadResourcesIcon from '/icons/downloadResources.svg'
import knowledgeGraphIcon from '/icons/knowledge_graph.svg'
import exerciseIcon from '/icons/my_exercises.svg'
import drawingBoardIcon from '/icons/draw.svg'
import homeworkIcon from '/icons/homework.png'
import ipGif from '/icons/ip.gif'

// 第2步：导入选中状态图标
import toolBoxSelectIcon from '/icons/toolBox_select.svg'
import downloadResourcesSelectIcon from '/icons/downloadResources_select.svg'
import knowledgeGraphSelectIcon from '/icons/knowledge_graph_select.svg'
import exerciseSelectIcon from '/icons/my_exercises_select.svg'
import drawingBoardSelectIcon from '/icons/draw_select.png'
import homeworkSelectIcon from '/icons/homework_select.png'

// 定义 props
interface Props {
  activeNavItem?: string
}

const props = withDefaults(defineProps<Props>(), {
  activeNavItem: 'knowledge',
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
const pdfViewerStore = usePdfViewerStore()
const resourceStore = useResourceStore()
const teacherStore = useTeacherChatStore()
const userClientStore = useUserClientStore()

// 响应式数据
const activeNavItem = ref(props.activeNavItem)
const isInClass = ref(false)



// 当前学校应用配置（通过 VITE_SCHOOL_ID 区分不同学校版本）
const currentSchoolAppConfig = getCurrentSchoolAppConfig()

// 根据学校配置拆分主菜单和底部菜单
const navMainItems = computed(() => currentSchoolAppConfig.nav.main)
const navBottomItems = computed(() => currentSchoolAppConfig.nav.bottom)

// 用户头像显示：从用户信息中获取
const userAvatar = computed(() => {
  return currentUserInfo.value.avatarNew || avatarIcon
})

// 当前用户信息（用于传递给子组件）
const currentUserInfo = ref<{
  id: string
  name: string
  avatar: string
  avatarNew: string
  roles: string[]
}>({
  id: '',
  name: '',
  avatar: '',
  avatarNew: '',
  roles: []
})

// 更新当前用户信息
const updateCurrentUserInfo = () => {
  try {
    const rawUserInfo = localStorage.getItem('userInfo')
    if (rawUserInfo) {
      const parsed = JSON.parse(rawUserInfo)
      if (parsed && typeof parsed === 'object') {
        currentUserInfo.value = {
          id: parsed.id || '',
          name: parsed.name || '',
          avatar: parsed.avatar || '',
          avatarNew: parsed.avatarNew || '',
          roles: parsed.roles || []
        }
        return
      }
    }
  } catch (error) {
    console.warn('[MainView] parse userInfo from localStorage failed', error)
  }
  // 重置为空数据
  currentUserInfo.value = {
    id: '',
    name: '',
    avatar: '',
    avatarNew: '',
    roles: []
  }
}

// 设置用户信息到localStorage并更新响应式状态
const setUserInfoToStorage = (userInfo: {
  id: string
  name: string
  avatar: string
  avatarNew: string
  roles: string[]
}) => {
  try {
    // 更新localStorage
    localStorage.setItem('userInfo', JSON.stringify(userInfo))
    // 更新响应式状态
    currentUserInfo.value = { ...userInfo }
    console.log('[MainView] 用户信息已更新:', userInfo)
  } catch (error) {
    console.error('[MainView] 保存用户信息失败:', error)
  }
}

// 用户名显示：从当前用户信息中获取
const displayUserName = computed(() => {
  const name = currentUserInfo.value.name?.toString().trim()
  return name || '用户'
})

// keep-alive 缓存的组件列表
// 注意：这里的名称必须与组件的 name 选项匹配（defineOptions 或组件 export default 中的 name）
const cachedComponents = ref<string[]>([
  // 'knowledgeGraph',     // 知识图谱页面
  // 'pdfViewer',          // PDF 查看器
  // 'htmlViewer',         // HTML 查看器
  // 'videoViewer',        // 视频查看器
  // 'ExerciseSolveView',  // 我的习题页面
  'MyResourcesView', // 资源下载页面（资源页需要每次进入都强制刷新，这里不再缓存）
  // 'DrawingBoardView',   // 画板页面
  // 'FindExerciseView',   // 查找习题页面
  // 'MyFavoritesView',    // 我的收藏页面
  // 'learning',           // 去练习弹窗页（/app/learning）
  // 'learningContent'     // 去练习内容查看页（/app/learning-content）
  'MyHomeworkView', // 我的作业页面
])

// 对话框显示状态
const showTeacherChatDialog = ref(false)
const showFeedbackDialog = ref(false)
const showProfileDialog = ref(false)
const teacherChatSubject = ref<'biology' | 'math'>('math')
const teacherChatDialogRef = ref<InstanceType<typeof UnifiedChatDialog> | null>(null)

// 主页右侧聊天面板显示状态
const showMainChatPanel = ref(false)

// 工具箱显示状态
const showToolbox = ref(false)

// 工具箱对话框显示状态
const showDraftNotebook = ref(false)

// 资源通知状态
const hasResourceNotification = ref(false)

// 用户端未读消息数
const userClientUnreadCount = computed(() => userClientStore.unreadCount)

// 知识图谱未下载资源引导：气泡显示状态
const showGoResourcesBubble = ref(true)

// 是否已有任意已下载教材（本地）
const hasAnyDownloadedTextbook = ref<boolean | null>(null)

// 悬浮按钮拖动相关状态
const fabPosition = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const hasMoved = ref(false)

// 计算悬浮按钮样式
const fabStyle = computed(() => ({
  right: `${fabPosition.value.x}px`,
  bottom: `${fabPosition.value.y}px`,
}))

// 需要隐藏左侧导航菜单的路由
const routesHideFunctionMenu: string[] = ['homeworkExercise', 'homeworkAnswer']

// 是否隐藏左侧导航菜单
// 在作业作答 / 作业答题等专注场景隐藏，避免干扰
const hideFunctionMenu = computed(() => {
  const name = route.name as string | undefined
  return !!name && routesHideFunctionMenu.includes(name)
})

// 不显示悬浮按钮的路由
const routesHideFab: string[] = ['exerciseSolve', 'homeworkAnswer']

// 计算是否显示悬浮按钮：
// 1）在部分路由（routesHideFab）隐藏
// 2）在主页右侧聊天面板打开时隐藏（避免视觉和交互冲突）
// 3）在 PDF 查看页（pdfViewer）右侧聊天面板打开时隐藏悬浮按钮
const showFab = computed(() => {
  const name = route.name as string | undefined
  const isRouteAllowed = !name || !routesHideFab.includes(name)
  const isPdfChatOpen = name === 'pdfViewer' && pdfViewerStore.chatPanelVisible
  return isRouteAllowed && !showMainChatPanel.value && !isPdfChatOpen
})

// 计算是否需要显示“去资源下载”悬浮引导：
// 仅在知识图谱路由且尚未下载任何教材时显示
const shouldShowGoResourcesHint = computed(() => {
  return route.name === 'knowledgeGraph' && hasAnyDownloadedTextbook.value === false
})

// 计算主视图背景样式
const mainViewStyle = computed(() => {
  const routeName = route.name

  switch (routeName) {
    case 'knowledgeGraph':
      // 知识图谱页面：单一背景色
      return {
        background: '#271a43',
      }
    case 'exerciseSolve':
      // 我的习题页：上半部分 #3d3070，下半部分 #f7f6ff
      return {
        background: 'linear-gradient(to bottom, #0f002e 50%, #edeffe 50%)',
      }
    case 'myResources':
      // 资源下载页：上半部分 #ffffff，下半部分 #edeffe
      return {
        background: 'linear-gradient(to bottom, #ffffff 50%, #edeffe 50%)',
      }
    case 'myHomework':
      // 我的作业页：上半部分 #ffffff，下半部分 #f1f3ff，与 MyHomeworkView 匹配
      return {
        background: 'linear-gradient(to bottom, #ffffff 50%, #f1f3ff 50%)',
      }
    case 'homeworkAnswer':
      // 作业答题页：与我的作业保持同一体系，上半白色，下半淡紫色
      return {
        background: 'linear-gradient(to bottom, #25164b 50%, #f7f6ff 50%)',
      }
    case 'drawingBoard':
      // 画板页：纯白背景
      return {
        background: '#ffffff',
      }
    case 'findExercise':
      // 查找习题页：上半部分 #ffffff，下半部分 #f8f9fa
      return {
        background: 'linear-gradient(to bottom, #0f002e 50%, #f8f9fa 50%)',
      }
    case 'pdfViewer':
      // PDF查看器页：纯色背景
      return {
        background: '#0a0020',
      }
    default:
      // 默认背景色
      return {
        background: '#3d3070',
      }
  }
})

// 悬浮功能按钮点击逻辑：
// - 如果当前在 PDF 查看页（pdfViewer），则打开/关闭 PDF 页右侧对话面板
// - 否则，切换主页右侧统一聊天面板
const handleFloatingFabClick = () => {
  if (route.name === 'pdfViewer') {
    pdfViewerStore.chatPanelVisible = !pdfViewerStore.chatPanelVisible
  } else {
    showMainChatPanel.value = !showMainChatPanel.value
  }
}

// 第3步：根据选中状态计算当前应该显示的图标
// 工具箱图标仅由工具箱展开状态决定，与当前路由高亮无关
const currentToolBoxIcon = computed(() => {
  return showToolbox.value ? toolBoxSelectIcon : toolBoxIcon
})

const currentKnowledgeGraphIcon = computed(() => {
  return activeNavItem.value === 'knowledge' ? knowledgeGraphSelectIcon : knowledgeGraphIcon
})

const currentExerciseIcon = computed(() => {
  return activeNavItem.value === 'exercises' ? exerciseSelectIcon : exerciseIcon
})

// 示例：我的作业图标（暂复用我的习题图标）
const currentHomeworkIcon = computed(() => {
  return activeNavItem.value === 'homework' ? homeworkSelectIcon : homeworkIcon
})

const currentDrawingBoardIcon = computed(() => {
  return activeNavItem.value === 'drawingBoard' ? drawingBoardSelectIcon : drawingBoardIcon
})

const currentDownloadResourcesIcon = computed(() => {
  return activeNavItem.value === 'resources' ? downloadResourcesSelectIcon : downloadResourcesIcon
})

// 根据导航项配置获取当前应显示的图标（普通/选中）
const getNavIcon = (item: NavItemConfig) => {
  switch (item.iconType) {
    case 'toolbox':
      return currentToolBoxIcon.value
    case 'knowledge':
      return currentKnowledgeGraphIcon.value
    case 'exercises':
      return currentExerciseIcon.value
    case 'homework':
      return currentHomeworkIcon.value
    case 'drawingBoard':
      return currentDrawingBoardIcon.value
    case 'resources':
      return currentDownloadResourcesIcon.value
    default:
      return currentDownloadResourcesIcon.value
  }
}

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
  const buttonLeft = window.innerWidth - currentRight - 60 // 60是按钮宽度
  const buttonTop = window.innerHeight - currentBottom - 60 // 60是按钮高度

  // 保存鼠标相对按钮左上角的偏移
  dragOffset.value = {
    x: clientX - buttonLeft,
    y: clientY - buttonTop,
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
    const buttonSize = 60
    const constrainedLeft = Math.max(0, Math.min(window.innerWidth - buttonSize, newLeft))
    const constrainedTop = Math.max(0, Math.min(window.innerHeight - buttonSize, newTop))

    // 转换为 right 和 bottom 值
    fabPosition.value = {
      x: window.innerWidth - constrainedLeft - buttonSize,
      y: window.innerHeight - constrainedTop - buttonSize,
    }
  }
}

// 停止拖动
const stopDrag = () => {
  isDragging.value = false
  hasMoved.value = false
}

// 判断某个导航 key 是否处于激活状态
const isNavItemActive = (key: NavKey) => {
  if (key === 'toolbox') {
    return showToolbox.value
  }
  return activeNavItem.value === key
}

// 检查教材更新状态和未下载状态
const checkResourceUpdates = async () => {
  try {
    // 第1步：获取所有本地教材
    let textbooks = await resourceManager.getUserLocalTextbooks()

    // 第2步：如果本地没有数据，从服务器获取
    if (textbooks.length === 0) {
      try {
        // 检查登录状态
        if (!resourceManager.isLoggedIn()) {
          // 会话无效，跳转到登录页
          console.warn('❌ [MainView] 登录状态无效，跳转到登录页')
          await router.push({ name: 'login' })
            return
        }

        // 从服务器获取教材数据
        const serverTextbooks = await apiService.fetchUserAllOnlineTextbooks()

        if (serverTextbooks && serverTextbooks.length > 0) {
          // 将服务器数据保存到本地
          for (const textbook of serverTextbooks) {
            await resourceManager.updateTextbookInfo(textbook)
          }

          // 使用服务器数据进行检查
          textbooks = serverTextbooks
        }
      } catch (error) {
        // 获取服务器数据失败，使用本地数据（可能为空）
        console.warn('获取服务器教材数据失败:', error)
      }
    }

    // 第3步：检查是否有教材需要更新
    const hasUpdates = textbooks.some((textbook: UserTextbookInfo) => {
      return textbook.hasUpdatesAvailable === true
    })

    // 第4步：检查是否有教材未下载或未完全下载
    const hasUndownloaded = textbooks.some((textbook: UserTextbookInfo) => {
      // 判断条件：未下载或未完全下载
      // - isDownloaded === false 表示未下载
      // - downloadedFiles < totalFiles 表示未完全下载（部分下载也算未完成）
      // - downloadStatus === 0 表示未下载/下载失败
      if (textbook.totalFiles === 0) {
        // 如果总文件数为0，检查 isDownloaded 状态
        return !textbook.isDownloaded || textbook.downloadStatus === 0
      } else {
        // 如果总文件数大于0，检查下载进度
        return (
          !textbook.isDownloaded ||
          textbook.downloadedFiles < textbook.totalFiles ||
          textbook.downloadStatus === 0
        )
      }
    })

    // 第5步：更新通知状态（有更新或未下载都显示小红点）
    hasResourceNotification.value = hasUpdates || hasUndownloaded

    // 第6步：更新“是否已下载任意教材”状态：仅当存在 downloadStatus === 2 且 isDownloaded 为 true 的教材时为 true
    hasAnyDownloadedTextbook.value = textbooks.some((textbook: UserTextbookInfo) => {
      return textbook.isDownloaded === true && textbook.downloadStatus === 2
    })
  } catch {
    // 检查失败时，不显示通知且不显示引导
    hasResourceNotification.value = false
    hasAnyDownloadedTextbook.value = null
  }
}

// 监听 store 的 notificationTrigger 变化，触发通知检查
watch(
  () => resourceStore.notificationTrigger,
  () => {
    checkResourceUpdates()
  }
)

// 初始化按钮位置
onMounted(async () => {
  // 第1步：加载用户信息
  updateCurrentUserInfo()

  // 第2步：初始化按钮位置
  fabPosition.value = { x: 18, y: 18 }

  // 监听课堂状态，高亮头像
  const updateClassStatus = () => {
    const status = androidBridge.getClassroomStatus()
    isInClass.value = !!status?.isInClass
  }
  updateClassStatus()
  androidBridge.onClassroomJoined(updateClassStatus)
  androidBridge.onClassroomExited(() => {
    isInClass.value = false
  })
  androidBridge.onClassroomStatusChanged((status) => {
    isInClass.value = !!status?.isInClass
  })

  // 第2步：等待 Vue 渲染完成
  await nextTick()

  // 第3步：确保 IndexedDB 已初始化，然后检查教材更新状态
  // getUserLocalTextbooks 内部会检查并初始化 IndexedDB，所以直接调用即可
  await checkResourceUpdates()

  // 第4步：监听Android原生日志
  // 保存原有的回调（如果存在，可能是App.vue或LoginView中设置的）
  const previousCallback = window.onAndroidLog
  window.onAndroidLog = (level: string, tag: string, message: string) => {
    // 第1步：如果有原有回调，先调用它（保持App.vue或LoginView中的全局日志功能）
    if (previousCallback) {
      previousCallback(level, tag, message)
    }

    // 第2步：在MainView中打印日志
    const logMessage = `[Android-${tag}] ${message}`

    switch (level.toUpperCase()) {
      case 'DEBUG':
        break
      case 'INFO':
        break
      case 'WARN':
        console.warn(`[MainView] ⚠️ ${logMessage}`)
        break
      case 'ERROR':
        console.error(`[MainView] ❌ ${logMessage}`)
        break
      default:
        break
    }
  }

  // 第5步：监听悬浮FAB按钮的action事件（来自系统级悬浮按钮服务）
  window.addEventListener('floating-fab-action', (event: Event) => {
    const customEvent = event as CustomEvent<{ action: string }>
    const action = customEvent.detail?.action
    if (action === 'openAIChat') {
      handleAIChatClick()
    }
  })
})


// 跳转到资源下载页
const goToResources = () => {
  // 关闭气泡，避免返回时重复干扰
  showGoResourcesBubble.value = false
  activeNavItem.value = 'resources'
  emit('nav-item-change', 'resources')
  if (showToolbox.value) {
    showToolbox.value = false
  }
  router.push({ name: 'myResources' })
}

// 从全屏统一聊天对话框切换回右侧聊天面板
const handleToggleUnifiedChatMode = () => {
  // 关闭 AI 统一聊天对话框
  uiStore.showAIChatDialog = false
  // 打开主页右侧聊天面板
  showMainChatPanel.value = true
}

// 处理打开工具箱事件
const handleOpenToolbox = () => {
  console.log('handleOpenToolbox')
  console.log('showDraftNotebook', showDraftNotebook.value)
  showDraftNotebook.value = true
  console.log('showDraftNotebook', showDraftNotebook.value)
}

// 处理头像更改事件
const handleAvatarChanged = (newAvatarUrl: string) => {
  // 更新用户信息并持久化到localStorage
  setUserInfoToStorage({
    ...currentUserInfo.value,
    avatarNew: newAvatarUrl
  })
}

// 处理头像点击
const handleAvatarClick = () => {
  showProfileDialog.value = true
}


// 处理AI聊天点击
const handleAIChatClick = async () => {
  const routeName = route.name

  // 如果当前在 PDF 查看页面，则仅打开右侧 PDF 聊天面板
  if (routeName === 'pdfViewer') {
    pdfViewerStore.openChatPanel()
    return
  }

  // 其他页面仍然打开统一 AI 聊天对话框
  uiStore.openAIChatDialog()
}

// 监听路由变化，更新激活状态
watch(
  () => route.name,
  (newRouteName) => {
    switch (newRouteName) {
      case 'myResources':
        activeNavItem.value = 'resources'
        // 进入资源页面时检查更新状态
        checkResourceUpdates()
        break
      case 'myHomework':
        activeNavItem.value = 'homework'
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
  },
  { immediate: true }
)

// 切换工具箱显示状态
const toggleToolbox = () => {
  showToolbox.value = !showToolbox.value
}

// 关闭工具箱的方法（提供给子组件使用）
const closeToolbox = () => {
  showToolbox.value = false
}

// 处理教师会话创建事件
const handleTeacherSessionCreated = (sessionId: string, type: 'ai-general' | 'teacher') => {
  // 如果是教师会话，设置会话到 Store（使用统一存储格式）
  if (type === 'teacher') {
    const session = teacherStore.getSession(sessionId)
    if (session) {
      teacherStore.setSession(session)
    }
  }
}

// 打开教师聊天对话框
const openTeacherChatDialog = (subject: 'biology' | 'math' = 'math') => {
  teacherChatSubject.value = subject
  showTeacherChatDialog.value = true
}

// 打开反馈对话框
const openFeedbackDialog = () => {
  showFeedbackDialog.value = true
}

// 获取教师聊天对话框引用（供子组件调用方法）
const getTeacherChatDialogRef = () => {
  return teacherChatDialogRef.value
}

// 在右侧 panel 和统一 AI 聊天对话框之间切换
const handleToggleMainChatMode = () => {
  showMainChatPanel.value = false
  uiStore.openAIChatDialog()
}

// 通过 provide 向子组件提供关闭工具箱的方法和控制对话框的方法
// - closeToolbox: 关闭左侧工具箱
// - openTeacherChatDialog: 打开教师聊天对话框（全屏形式）
// - openMainChatPanel: 打开主页右侧统一聊天面板
// - openFeedbackDialog: 打开意见反馈对话框
// - getTeacherChatDialogRef: 获取教师聊天对话框引用
const openMainChatPanel = () => {
  showMainChatPanel.value = true
}

provide('closeToolbox', closeToolbox)
provide('openTeacherChatDialog', openTeacherChatDialog)
provide('openMainChatPanel', openMainChatPanel)
provide('openFeedbackDialog', openFeedbackDialog)
provide('getTeacherChatDialogRef', getTeacherChatDialogRef)
provide('openToolbox', handleOpenToolbox)

// 工具箱动画进入完成后的处理
const handleToolboxEnter = () => {
  // 动画完成后，移除 will-change 以节省内存
  // 由于 CSS 中已经设置了 will-change，这里主要是标记动画完成
  // 如果需要，可以通过 DOM 操作动态移除 will-change
}

// 工具箱动画离开完成后的处理
const handleToolboxLeave = () => {
  // 动画完成后清理，如果需要的话
}

// 处理内容区域点击事件
const handleContentAreaClick = () => {
  // 第1步：如果工具箱是打开的，则关闭它
  if (showToolbox.value) {
    showToolbox.value = false
  }
}

// 导航处理函数
const handleToolBoxClick = () => {
  // 点击功能箱菜单时仅切换工具箱显示状态
  toggleToolbox()
  // 仍然向父组件通知当前交互的是工具箱（如有需要）
  emit('nav-item-change', 'toolbox')
}

// 统一处理导航项点击，具体行为由 key/routeName 决定
const handleNavItemClick = (item: NavItemConfig) => {
  switch (item.key) {
    case 'toolbox':
      handleToolBoxClick()
      break
    case 'knowledge':
      handleKnowledgeGraphClick()
      break
    case 'exercises':
      handleMyExercisesClick()
      break
    case 'homework':
      handleMyHomeworkClick()
      break
    case 'drawingBoard':
      handleDrawingBoardClick()
      break
    case 'resources':
      handleMyResourcesClick()
      break
    default:
      // 兜底：如果配置了 routeName，则直接按路由跳转
      if (item.routeName) {
        router.push({ name: item.routeName })
      }
      break
  }
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

// 示例：我的作业导航点击处理
const handleMyHomeworkClick = () => {
  activeNavItem.value = 'homework'
  emit('nav-item-change', 'homework')
  // 如果工具箱区域是打开的，则关闭它
  if (showToolbox.value) {
    showToolbox.value = false
  }
  // 示例路由：跳转到名为 myHomework 的页面（请在路由配置中定义实际页面）
  router.push({ name: 'myHomework' })
}

const handleDrawingBoardClick = () => {
  activeNavItem.value = 'drawingBoard'
  emit('nav-item-change', 'drawingBoard')
  // 如果工具箱区域是打开的，则关闭它
  if (showToolbox.value) {
    showToolbox.value = false
  }
  router.push({ name: 'drawingBoard' })
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

</script>

<style lang="scss" scoped>
// 主视图容器
.main-view {
  width: 100%;
  height: 100vh;
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
    flex-direction: column;
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

    .user-name {
      margin-top: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #0f002e;
      text-align: center;
      word-break: break-all;
      line-height: 1.2;
    }

    &.in-class {
      background: linear-gradient(180deg, #e0f7ef 0%, #f6fffb 100%);
      border-radius: 16px;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
      animation: breathing 2s ease-in-out infinite;

      img {
        background: #d1fae5;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.35);
      }

      .user-name {
        color: #059669;
      }
    }

    // 点击效果
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 12px;

    &:hover {
      background: rgba(138, 99, 255, 0.05);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
      background: rgba(138, 99, 255, 0.08);
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
    padding: 9px 8px;
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
        color: #9059ff;

        img {
          filter: none;
          opacity: 1;
        }
      }

      .nav-text {
        color: #9059ff;
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

    .notification-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 18px;
      height: 18px;
      background: #ef4444;
      color: white;
      border-radius: 9px;
      border: 2px solid #ffffff;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      box-sizing: border-box;
    }

    .nav-text {
      margin-top: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #000000;
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
        color: #000000;
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
  width: 33%;
  height: 100vh;
  background: #3d3070;
  overflow-y: auto;
  z-index: 999; // 层级低于功能菜单，不可覆盖功能菜单
  // 启用 GPU 硬件加速，优化 webview 性能
  transform: translateZ(0);
  // 优化渲染性能
  backface-visibility: hidden;
  -webkit-overflow-scrolling: touch; // iOS 滚动优化
  // 注意：will-change 只在动画期间使用，避免内存泄漏
  box-shadow: -260px 0 0 0 rgba(61, 48, 112);
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

// 工具箱过渡动画 - 使用 translate 弹出效果，优化 GPU 加速
.toolbox-transition-enter-active,
.toolbox-transition-leave-active {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  // 启用 GPU 硬件加速，优化 webview 性能
  will-change: transform;
  // 使用 transform3d 强制启用硬件加速
  transform: translateZ(0);
  // 启用合成层优化
  backface-visibility: hidden;
  perspective: 1000px;
}

.toolbox-transition-enter-from {
  transform: translate3d(-100%, 0, 0);
}

.toolbox-transition-enter-to {
  transform: translate3d(0, 0, 0);
}

.toolbox-transition-leave-from {
  transform: translate3d(0, 0, 0);
}

.toolbox-transition-leave-to {
  transform: translate3d(-100%, 0, 0);
}

.content-area {
  position: relative;
  margin-left: 0;
  padding: 0;
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

  .floating-fab-btn {
    width: 120px;
    height: 120px;
    border: none;
    outline: none;
    /* 背景图片通过内联样式动态设置 */
    background: center center / cover no-repeat;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: box-shadow 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
  }

  // 拖动时禁用 QFab 的点击动画
  &:active {
    cursor: grabbing;
  }

  // 让引导气泡相对于悬浮按钮定位
  .go-resources-bubble {
    position: absolute;
    right: 72px; // 在按钮左侧偏移一段距离
    bottom: 8px; // 与按钮垂直居中略偏上
  }
}

// 引导气泡
.go-resources-bubble {
  position: relative;
  width: 240px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  font-size: 13px;
  color: #333333;
}

.go-resources-bubble::after {
  content: '';
  position: absolute;
  right: 10px;
  bottom: -8px;
  border-width: 8px;
  border-style: solid;
  border-color: #ffffff transparent transparent transparent;
}

.go-resources-text {
  line-height: 1.5;
}

.go-resources-btn {
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 14px;
  border: 1px solid #6e55ff;
  background: #ffffff;
  color: #6e55ff;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.go-resources-btn:hover {
  background: rgba(110, 85, 255, 0.06);
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

// 呼吸灯动画效果
@keyframes breathing {
  0%, 100% {
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.6);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.25);
  }
}
</style>
