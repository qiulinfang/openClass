<template>
  <!-- 全屏对话面板 -->
  <div class="fullscreen-chat-container">
    <PdfChatPanel 
      ref="chatPanelRef" 
      :attached-screenshots="aiTextbookStore.attachedScreenshots"
      :model-options="AI_ROLE_OPTIONS"
      @send-with-screenshot="handlePdfSendWithScreenshot"
      @remove-screenshot="handlePdfRemoveScreenshot"
      @edit-screenshot="handleEditScreenshot"
      @select-and-ask-click="handleSelectAndAskFromChat" 
    >
      <template #header-actions>
        <button
          type="button"
          class="join-class-button"
          :class="{ 'in-class': isInClass }"
          @click="toggleJoinClass"
        >
          加入课堂
        </button>
      </template>
    </PdfChatPanel>
    
      <MiniClass v-model="showMiniClassDialog" :class-url="miniClassUrl" question-title="小工具" />

      <div
        v-if="shouldShowMiniClassFab && miniClassFabReady"
        class="mini-class-fab"
        :class="{ 'mini-class-fab--active': isPressingMiniClassFab, 'mini-class-fab--dragging': isDraggingMiniClassFab }"
        :style="{
          transform: `translate(${miniClassFabPos.x}px, ${miniClassFabPos.y}px) scale(var(--fab-scale, 1))`,
        }"
        @pointerdown="onMiniClassFabPointerDown"
      >
        <CommonActionButton
          label="微课"
          size="md"
          :icon="xiaogongjuIcon"
          @click="onMiniClassFabClick"
        />
      </div>

      <Dialog
        ref="joinClassDialogRef"
        :title="isInClass ? '确认退出课堂' : '课堂提示'"
        :confirmButtonText="isInClass ? '确认退出' : '确认加入'"
        :cancelButtonText="'取消'"
        @confirm="confirmJoinClass"
        @cancel="handleJoinClassDialogCancel"
      >
        {{ isInClass ? '确认退出课堂？' : '确认加入课堂？' }}
      </Dialog>
  </div>
</template>

<script lang="ts">
export default {
  name: 'pdfViewer',
}
</script>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, ref, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useAiTextbookChatStore, type ScreenshotDrawingState, getMiniClassConfig } from '@/stores/aiTextbookChatStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { showMessage } from '@/utils'
import type { AiTextbookSession, AttachedScreenshot } from '@/types'
import {
  addScreenshotSession,
} from '@/utils/storage/screenshotSessions'
import PdfChatPanel from '@/components/PdfChatPanel.vue'
import MiniClass from '@/components/MiniClass.vue'
import CommonActionButton from '@/components/base/Button.vue'
import Dialog from '@/components/base/Dialog.vue'
import xiaogongjuIcon from '/icons/xiaogongju.svg'
import { useUIStore } from '@/stores/uiStore'
import { getUserId } from '@/services/http/auth-service'
import { AndroidBridge } from '@/services/business/android-bridge'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'
import { AI_ROLE_OPTIONS } from '@/constants/options'


// 使用 pdfViewerStore 和路由
const pdfViewerStore = usePdfViewerStore()
const route = useRoute()

// 使用 exerciseStore 来发送AI消息
const aiTextbookStore = useAiTextbookChatStore()
// 使用通用 AI 会话（用于截图输入走通用会话）
const aiGeneralStore = useAiGeneralChatStore()

const uiStore = useUIStore()
const androidBridge = AndroidBridge.getInstance()
const showMiniClassDialog = computed({
  get: () => uiStore.showMiniClassDialog,
  set: (value) => {
    if (!value) {
      uiStore.closeMiniClassDialog()
    }
  },
})
const miniClassUrl = computed(() => uiStore.miniClassUrl)
const miniClassQuestionTitle = computed(() => uiStore.miniClassQuestionTitle)

const shouldShowMiniClassFab = computed(() => {
  const info = aiTextbookStore.chapterInfo
  if (!info) return false
  return !!getMiniClassConfig(info)
})

const miniClassFabPos = ref({ x: 0, y: 0 })
const miniClassFabReady = ref(false)
const isDraggingMiniClassFab = ref(false)
const isPressingMiniClassFab = ref(false)
const miniClassFabPointerId = ref<number | null>(null)
const miniClassFabStart = ref({
  pointerX: 0,
  pointerY: 0,
  startX: 0,
  startY: 0,
})
const miniClassFabMoved = ref(false)
const lastMiniClassFabDragEndAt = ref(0)
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const joinClassDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
const isInClass = ref(false)

const getStudentNameFromStorage = () => {
  try {
    const raw = localStorage.getItem('userInfo')
    if (!raw) return ''
    const parsed = JSON.parse(raw) as Partial<BridgeUserInfo> & Record<string, unknown>
    const name =
      (parsed as any)?.studentName ||
      (parsed as any)?.realName ||
      (parsed as any)?.name ||
      (parsed as any)?.nickName ||
      (parsed as any)?.account ||
      ''
    return typeof name === 'string' ? name : ''
  } catch {
    return ''
  }
}

const checkClassroomStatus = () => {
  try {
    const status = androidBridge.getClassroomStatus() as BridgeClassroomStatus | null
    isInClass.value = !!status?.isInClass
  } catch {
  }
}

const toggleJoinClass = () => {
  joinClassDialogRef.value?.openDialog()
}

const handleJoinClassDialogCancel = () => {
  joinClassDialogRef.value?.closeDialog()
}

const confirmJoinClass = () => {
  try {
    joinClassDialogRef.value?.closeDialog()

    if (isInClass.value) {
      const ok = androidBridge.exitClassroom()
      if (ok) {
        isInClass.value = false
      }
      return
    }

    const studentId = getUserId() || ''
    const studentName = getStudentNameFromStorage() || studentId || '用户'
    const isGuest = !studentId
    const ok = androidBridge.joinClassroom(studentId, studentName, isGuest)
    if (ok) {
      isInClass.value = true
    }
  } catch (e) {
    console.error('[PdfViewerView] confirmJoinClass failed:', e)
  }
}

const onMiniClassFabPointerMove = (e: PointerEvent) => {
  if (miniClassFabPointerId.value === null || e.pointerId !== miniClassFabPointerId.value) return

  const dx = e.clientX - miniClassFabStart.value.pointerX
  const dy = e.clientY - miniClassFabStart.value.pointerY

  if (!miniClassFabMoved.value && Math.hypot(dx, dy) > 4) {
    miniClassFabMoved.value = true
  }

  isDraggingMiniClassFab.value = true

  const container =
    (document.querySelector('.fullscreen-chat-container') as HTMLElement | null) ||
    (document.querySelector('.pdf-viewer-container') as HTMLElement | null)
  if (!container) return
  const rect = container.getBoundingClientRect()
  const btnSize = 56

  const nextX = miniClassFabStart.value.startX + dx
  const nextY = miniClassFabStart.value.startY + dy

  miniClassFabPos.value = {
    x: clamp(nextX, 8, rect.width - btnSize - 8),
    y: clamp(nextY, 8, rect.height - btnSize - 8),
  }
}

const onMiniClassFabPointerUp = (e: PointerEvent) => {
  if (miniClassFabPointerId.value === null || e.pointerId !== miniClassFabPointerId.value) return

  try {
    window.removeEventListener('pointermove', onMiniClassFabPointerMove)
    window.removeEventListener('pointerup', onMiniClassFabPointerUp)
    window.removeEventListener('pointercancel', onMiniClassFabPointerUp)
  } catch {
  }

  miniClassFabPointerId.value = null
  isDraggingMiniClassFab.value = false
  isPressingMiniClassFab.value = false
  if (miniClassFabMoved.value) {
    lastMiniClassFabDragEndAt.value = Date.now()
  }
}

const onMiniClassFabPointerDown = (e: PointerEvent) => {
  if (miniClassFabPointerId.value !== null) return
  miniClassFabPointerId.value = e.pointerId
  miniClassFabMoved.value = false
  isPressingMiniClassFab.value = true

  try {
    ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  } catch {
  }

  const container =
    (document.querySelector('.fullscreen-chat-container') as HTMLElement | null) ||
    (document.querySelector('.pdf-viewer-container') as HTMLElement | null)
  if (!container) return
  const rect = container.getBoundingClientRect()
  const btnSize = 56

  const current = miniClassFabPos.value
  const isDefault = current.x === 0 && current.y === 0
  const defaultX = rect.width - btnSize - 16
  const defaultY = rect.height - btnSize - 16

  miniClassFabStart.value = {
    pointerX: e.clientX,
    pointerY: e.clientY,
    startX: isDefault ? defaultX : current.x,
    startY: isDefault ? defaultY : current.y,
  }

  if (isDefault) {
    miniClassFabPos.value = {
      x: clamp(defaultX, 8, rect.width - btnSize - 8),
      y: clamp(defaultY, 8, rect.height - btnSize - 8),
    }
  }

  try {
    window.addEventListener('pointermove', onMiniClassFabPointerMove)
    window.addEventListener('pointerup', onMiniClassFabPointerUp)
    window.addEventListener('pointercancel', onMiniClassFabPointerUp)
  } catch {
  }
}

const onMiniClassFabClick = () => {
  if (Date.now() - lastMiniClassFabDragEndAt.value < 200) {
    return
  }
  const matched = getMiniClassConfig(aiTextbookStore.chapterInfo)
  if (!matched) return
  try {
    uiStore.openMiniClassDialog(matched.url, matched.title)
  } catch {
    uiStore.openMiniClassDialog(matched.url, matched.title)
  }
}

// ChatPanel 实例引用，用于在新增截图会话后刷新列表
const chatPanelRef = ref<InstanceType<typeof PdfChatPanel> | null>(null)

// 从右侧对话面板触发的“选中并问”
const handleSelectAndAskFromChat = () => {
  showMessage('当前页面不支持框选截图，请使用对话输入直接提问', 'info')
}


// 编辑已挂载截图（从 ChatInput 缩略图点击进入 / 或截图捕获后自动打开）
const editScreenshotDialogVisible = ref(false)
const editingShotId = ref('')
const lastCapturedShotId = ref('')

// 最多允许挂载的截图数量（与 ScreenshotInputDialog 保持一致）
const MAX_SCREENSHOTS = 3

// 处理截图捕获事件：接收 PdfPage 截图 blob，转换为 base64，并弹出输入对话框
const handleScreenshotCaptured = async (blob: Blob) => {
  try {
    // 检查截图数量是否已达上限（统一以 store 为准）
    const currentCount = aiTextbookStore.attachedScreenshots.length
    if (currentCount >= MAX_SCREENSHOTS) {
      showMessage(`最多只能添加 ${MAX_SCREENSHOTS} 张截图`, 'warning')
      // 退出截图模式
      pdfViewerStore.selectedTool = 'hand' as any
      return
    }

    const base64DataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    const shotId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const shot: AttachedScreenshot = {
      id: shotId,
      dataUrl: base64DataUrl, // 缩略图
      originalDataUrl: base64DataUrl, // 原图（新截图原图和缩略图相同）
      width: 0,
      height: 0,
    }

    // 单一数据源：立即写入 store（此时 ChatInput 缩略图会立刻出现）
    aiTextbookStore.appendAttachedScreenshots([shot])
    aiTextbookStore.setScreenshotDrawingStates({
      ...aiTextbookStore.screenshotDrawingStates,
      [shotId]: aiTextbookStore.screenshotDrawingStates[shotId] || { objects: [], history: [], historyIndex: -1 },
    } as any)

    lastCapturedShotId.value = shotId

    // 打开编辑弹窗并定位到新图
    editingShotId.value = shotId
    editScreenshotDialogVisible.value = true
  } catch (error) {
    console.error('[PdfViewerView] 处理截图数据失败', error)
  }
}

// 点击 ChatInput 缩略图：打开编辑弹窗并定位到指定截图
const handleEditScreenshot = (shotId: string) => {
  if (!shotId) return
  editingShotId.value = shotId
  editScreenshotDialogVisible.value = true
}

const handleEditScreenshotConfirm = (
  shots: AttachedScreenshot[],
  states: Record<string, ScreenshotDrawingState>,
) => {
  if (!shots || shots.length === 0) return

  // shots 代表“弹窗内最终确认的截图列表”（包含顺序变化/删除/内容编辑等）
  // 这里无论数量多少，都以 shots 为准全量覆盖 store，保证单一数据源一致
  aiTextbookStore.setAttachedScreenshots(shots)

  aiTextbookStore.setScreenshotDrawingStates({
    ...aiTextbookStore.screenshotDrawingStates,
    ...states,
  } as any)

  editScreenshotDialogVisible.value = false
  editingShotId.value = ''

  // 截图确认后：退出探索模式（重置选中工具）并打开对话面板
  pdfViewerStore.selectedTool = 'hand' as any
  pdfViewerStore.openChatPanel()
}

const handleEditScreenshotAddMore = () => {
  editScreenshotDialogVisible.value = false
  editingShotId.value = ''

  // 检查是否已达截图上限（统一以 store 为准）
  const currentCount = aiTextbookStore.attachedScreenshots.length
  if (currentCount >= MAX_SCREENSHOTS) {
    showMessage(`已达到最大截图数量 ${MAX_SCREENSHOTS} 张`, 'info')
    pdfViewerStore.selectedTool = 'hand' as any
    return
  }

  showMessage('当前页面不支持继续截图，请返回支持截图的页面', 'info')
}

const handleEditScreenshotCancel = () => {
  editScreenshotDialogVisible.value = false
  const shotId = editingShotId.value
  editingShotId.value = ''

  // 如果取消的是“刚截图新建的那张”，回滚删除（保持取消=放弃本次截图语义）
  if (shotId && lastCapturedShotId.value && shotId === lastCapturedShotId.value) {
    aiTextbookStore.removeAttachedScreenshot(shotId)
    aiTextbookStore.removeScreenshotDrawingState(shotId)
    lastCapturedShotId.value = ''
  }
}

// 从 ChatInput 发送携带截图的消息：复用原 handleScreenshotConfirm 的逻辑
const handlePdfSendWithScreenshot = async (text: string, shots: AttachedScreenshot[], selectedModel?: string) => {
  if (!shots || !shots.length) {
    return
  }

  // 用户点击发送时，立刻清空挂在输入框上的截图（无论后续发送成功与否）
  aiTextbookStore.clearAttachedScreenshots()
  aiTextbookStore.clearScreenshotDrawingStates()

  // 最多只保留前三张截图
  const limitedShots = shots.slice(0, 3)
  const firstShot = limitedShots[0]
  const dataUrl = firstShot.dataUrl

  try {
    // 打开对话面板并切换到 AI 问答 Tab
    pdfViewerStore.openChatPanel()
    // 设置当前教材ID
    const currentResourceId = (route.query.resourceId as string) || aiTextbookStore.resourceId || ''
    if (currentResourceId) {
      aiTextbookStore.setResourceId(currentResourceId)
    }
    // 为本次截图会话生成会话ID（同时作为存储键使用）
    const now = Date.now()
    const sessionId = currentResourceId
      ? `ai-textbook-${currentResourceId}-${now}`
      : `ai-textbook-${now}`
    aiTextbookStore.currentSessionId = sessionId

    const fileName = `screenshot-${Date.now()}.jpg`

    // 首图 imageData：用于截图接口（previewPictureQA）
    const imageData = {
      filePath: fileName,
      base64DataUrl: dataUrl,
      width: firstShot.width,
      height: firstShot.height,
      fileSize: Math.round(dataUrl.length * 0.75),
    }

    // 构建多图列表，包含最多前三张截图（全部放在 imageList 里传给 sendMessage）
    const imageList = limitedShots.map((shot, index) => {
      const shotDataUrl = shot.dataUrl
      const shotFileName = `screenshot-${Date.now()}-${index}.jpg`
      return {
        filePath: shotFileName,
        base64DataUrl: shotDataUrl,
        width: shot.width,
        height: shot.height,
        fileSize: Math.round(shotDataUrl.length * 0.75),
      }
    })

    // 通过 aiTextbookStore 发送消息：图片都挂在 imageList 上（最多3张），首图仍作为 imageData 走截图接口
    await aiTextbookStore.sendMessage(
      text,
      selectedModel || 'mate',
      imageData,
      false,
      false,
      undefined,
      imageList,
    )

    // 发送成功后，创建并持久化一条截图会话记录，结构与截图会话模块保持一致
    const newSession: AiTextbookSession = {
      sessionId,
      sessionName: text,
      createTime: now,
      updateTime: now,
      msgCount: 0,
      pinned: false,
      // 缩略图：直接使用当前截图的 base64 作为预览
      thumbnailImage: dataUrl,
      hasImage: true,
      resourceId: currentResourceId || undefined,
      // 兼容字段
      id: sessionId,
      question: text,
      answer: '',
    }
    addScreenshotSession(newSession)
    // 新增会话写入完成后，通知右侧对话面板刷新会话列表
    chatPanelRef.value?.reloadSessions?.()
  } catch (error) {
    console.error('[PdfViewerView] 发送截图消息失败', error)
  }
}

// 从 ScreenshotInputDialog 或 ChatInput 中删除截图
const handlePdfRemoveScreenshot = (id: string) => {
  if (!id) return

  // 单一数据源：统一从 store 中删除（无 temp 状态）
  aiTextbookStore.removeAttachedScreenshot(id)
  aiTextbookStore.removeScreenshotDrawingState(id)

  // 清理相关引用
  if (lastCapturedShotId.value === id) {
    lastCapturedShotId.value = ''
  }

  // 如果删除后没有截图了，关闭弹窗（最后一张图片一定处于编辑状态）
  if (aiTextbookStore.attachedScreenshots.length === 0) {
    editScreenshotDialogVisible.value = false
    editingShotId.value = ''
  }
}


// 生命周期
onMounted(async () => {
  try {
    // 设置学校类型为中关村一小（使用特定引导语）
    aiTextbookStore.setSchoolType('zgc')
    
    // 加载 aiGeneral 会话列表
    await aiGeneralStore.loadSessions()

    checkClassroomStatus()
    androidBridge.onClassroomJoined(() => {
      isInClass.value = true
    })
    androidBridge.onClassroomExited(() => {
      isInClass.value = false
    })
    androidBridge.onClassroomStatusChanged((status: BridgeClassroomStatus) => {
      isInClass.value = !!status?.isInClass
    })

    // 无 PdfPage：只基于路由参数初始化会话上下文
    const currentResourceId = (route.query.resourceId as string) || ''
    const currentSectionName = (route.query.sectionName as string) || (route.query.textbookName as string) || null
    aiTextbookStore.setSectionName(currentSectionName)

    const chapterInfo = {
      grade: (route.query.chapterGrade as string) || '',
      subject: (route.query.chapterSubject as string) || '',
      textbook: (route.query.chapterTextbook as string) || '',
      chapter_title: (route.query.chapterTitle as string) || '',
    }
    aiTextbookStore.setChapterInfo(
      chapterInfo.grade || chapterInfo.subject || chapterInfo.textbook || chapterInfo.chapter_title
        ? chapterInfo
        : null,
    )

    if (currentResourceId) {
      aiTextbookStore.setResourceId(currentResourceId)
      await aiTextbookStore.loadChatHistory(currentResourceId)
    }
  } catch (err) {
    console.error('PDF 加载失败:', err)
  }

  await nextTick()
  
  // 初始进入时打开聊天面板
  pdfViewerStore.openChatPanel()
  
  if (miniClassFabPos.value.x === 0 && miniClassFabPos.value.y === 0) {
    const container =
      (document.querySelector('.fullscreen-chat-container') as HTMLElement | null) ||
      (document.querySelector('.pdf-viewer-container') as HTMLElement | null)
    if (container) {
      const rect = container.getBoundingClientRect()
      const btnSize = 56
      miniClassFabPos.value = {
        x: clamp(16, 8, rect.width - btnSize - 8),
        y: clamp(Math.round(rect.height * 0.5 - btnSize), 8, rect.height - btnSize - 8),
      }
    }
  }

  miniClassFabReady.value = true
})

// 页面卸载前清理
onBeforeUnmount(() => {
  // 退出 PDF 页面时清空当前工具，避免影响其它页面
  pdfViewerStore.selectedTool = '' as any
  pdfViewerStore.closeChatPanel()
})
</script>

<style scoped>
.content-layout {
  flex: 1;
  display: flex;
  width: 100%;
  height: 100vh;
  min-height: 0;
}

.full-height {
  height: 100%;
  width: 100%;
}

.mini-class-fab {
  position: fixed;
  z-index: 1000;
  user-select: none;
  will-change: transform;
}

.mini-class-fab--active {
  --fab-scale: 0.95;
}

.mini-class-fab--dragging {
  transition: none;
}

:deep(.q-splitter),
:deep(.q-splitter__container),
:deep(.q-splitter__panel) {
  height: 100%;
  min-height: 0;
}

:deep(.q-splitter__before),
:deep(.q-splitter__after) {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 右侧对话面板容器（after 面板）：左侧圆角 + 柔和紫色阴影 */
:deep(.q-splitter__after) {
  border-top-left-radius: 16px;
  border-bottom-left-radius: 16px;
  /* 模拟截图中的竖向紫色阴影：略向左扩散，柔和过渡 */
  box-shadow: 0px 4px 10px 0px rgba(30, 0, 120, 0.32);
  z-index: 2;
}

.chat-panel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #e8e9ff;
}

/* 聊天面板头部 */
.chat-panel-header {
  background: #e8e9ff; /* 红色背景 */
  padding-top: 10px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

/* 移除 .chat-tabs 容器，因为 header 现在是 flex 容器 */

/* Tab 列表 */
.tab-list {
  display: flex;
  gap: 2px; /* Tab 之间的间距 */
}

/* 每个 Tab 项 */
.tab-item {
  position: relative;
  padding: 8px 18px;
  color: #a19cb6; /* 白色文字 */
  text-decoration: none;
  font-size: 15px;
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  background: transparent; /* 默认透明背景 */
  border-radius: 0; /* 移除圆角 */
  box-shadow: none; /* 移除阴影 */
  width: 100px;
}

/* 激活的 Tab 项 */
.tab-active {
  /* 使用 sessionbackgroung.png 作为激活状态背景 */
  background-image: url('/icons/sessionbackfround.png');
  background-repeat: no-repeat;
  background-size: 100% 100%;
  background-position: center center;
  color: #504b64;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  height: 40px; /* 保持原有高度 */
  line-height: 24px; /* 让文字在背景中垂直居中 */
  width: 100px;
}

/* 激活 Tab 底部下划线 */
.tab-active::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 30%;
  height: 3px;
  background: #6E55FF; /* 亮紫色下划线 */
  border-radius: 2px;
}

/* Tab 项的 hover 效果 */
.tab-item:hover:not(.tab-active) {
  opacity: 0.85;
  background: transparent; /* 确保 hover 时背景不变 */
}

/* 关闭按钮 */
.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #393548; /* 白色图标 */
  z-index: 1; /* 确保在前景 */
}

.chat-content-container {
  flex: 1;
  overflow: hidden;
}

.tab-content {
  height: 100%;
  border-radius: 20px;
}

.session-list-wrapper {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.pdf-viewer-container {
  width: 100%;
  position: relative;
  background-color: #0A0020;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.join-class-button {
  background: transparent;
  border: none;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  flex-shrink: 0;
  margin-left: 0;
  color: #ffffff;
  font-size: 14px;
  line-height: 1;
  font-weight: 500;
  background: #ffffff;
  color: #666666;
}

.join-class-button--top-right {
  position: absolute;
  top: 12px;
  right: 3px;
  z-index: 6;
  margin-left: 0;
}

.join-class-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  position: relative;
  z-index: 1;
}

.join-class-button.in-class {
  box-shadow:
    0 0 0 2px rgba(252, 253, 82, 0.65),
    0 0 16px rgba(252, 253, 82, 0.75),
    0 0 28px rgba(252, 253, 82, 0.4);
  animation: join-class-glow 1.8s ease-in-out infinite;
}

@keyframes join-class-glow {
  0% {
    box-shadow:
      0 0 0 2px rgba(252, 253, 82, 0.6),
      0 0 12px rgba(252, 253, 82, 0.55),
      0 0 22px rgba(252, 253, 82, 0.28);
  }
  50% {
    box-shadow:
      0 0 0 3px rgba(252, 253, 82, 0.75),
      0 0 20px rgba(252, 253, 82, 0.85),
      0 0 36px rgba(252, 253, 82, 0.45);
  }
  100% {
    box-shadow:
      0 0 0 2px rgba(252, 253, 82, 0.6),
      0 0 12px rgba(252, 253, 82, 0.55),
      0 0 22px rgba(252, 253, 82, 0.28);
  }
}


@keyframes breathe {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
  100% {
    opacity: 1;
  }
}

.exit-classroom {
  height: 100%;
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.exit-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  font-weight: 800;
  flex-shrink: 0;
}

.exit-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.exit-text .primary {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  line-height: 1.3;
}

.exit-text .secondary {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
}

.join-classroom-content {
  height: 100%;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.join-classroom-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.status-text {
  font-size: 13px;
  color: #6b7280;
}

/* 教室图片容器 */
.class-image-container {
  width: 100%;
  height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
  margin: 16px 0;
  border-radius: 8px;
  overflow: hidden;
}

.class-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* 全屏对话面板样式 */
.fullscreen-chat-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background-color: #f9fafb;
}

/* 微课浮层按钮 */
.mini-class-fab {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  user-select: none;
  will-change: transform;
  transition: transform 0.12s ease;
  touch-action: none;
  cursor: grab;
}

.mini-class-fab:active {
  cursor: grabbing;
}

/* 原有样式保留（以防其他地方引用） */
.full-height {
  height: 100%;
}

.full-width-before {
  width: 100% !important;
}

.chat-panel-visible {
  /* 保留用于其他可能的样式控制 */
  display: block;
}

/* PDF页面容器 - 支持横向和纵向滚动 */
.pdf-pages-container {
  height: 100%;
  width: 100%;
  /* 支持横向滚动 */
  overflow-x: auto;
  overflow-y: auto;
  /* 确保滚动条样式美观 */
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.3) rgba(0, 0, 0, 0.1);
  /* 当内容宽度超过容器时，允许横向滚动 */
  min-width: 100%;
  /* 确保内容不会被压缩 */
  width: max-content;
}

/* Webkit浏览器的滚动条样式 */
.pdf-pages-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.pdf-pages-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
}

.pdf-pages-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.pdf-pages-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

.pdf-page-item {
  display: flex;
  justify-content: flex-start;
  padding: 10px;
  /* 确保页面项不会被压缩，允许横向溢出 */
  min-width: fit-content;
  width: 100%;
  /* 防止flex压缩 */
  flex-shrink: 0;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.error-state {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 400px;
}

.empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 300px;
}


/* 当聊天面板隐藏时，让before插槽占据整个宽度 */
.full-width-before :deep(.q-splitter__before) {
  width: 100% !important;
}

:deep(.q-splitter__separator) {
  background-color: transparent;
  cursor: col-resize;
  position: relative;
  width: 16px;
  z-index: 5;
  margin: 0 -8px;
}
:deep(.q-splitter__after) {
  overflow: visible !important;
}

/* 在右侧面板上绘制 seekbar 效果 */
:deep(.q-splitter__after)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 10px;
  height: 100%;
  pointer-events: none;
  transform: translateX(-5px);
  background-image: url('/icons/seekbar.svg');
  background-repeat: no-repeat;
  background-position: center center;
  background-size: contain;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .pdf-page-item {
    padding: 5px 0;
  }

  .loading-state,
  .error-state {
    margin: 16px;
    max-width: calc(100% - 32px);
  }

  .tab-item {
    padding: 10px 12px;
    font-size: 13px;
    min-width: 60px;
  }

  .tab-item span {
    display: none;
    /* 移动端只显示图标 */
  }

  .tab-list {
    padding: 2px;
  }
}

/* 返回按钮样式 */
.goback-btn {
  padding: 8px;
}

.goback-icon {
  width: 24px;
  height: 24px;
  display: block;
}
</style>
