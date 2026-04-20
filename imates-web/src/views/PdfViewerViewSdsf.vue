<template>
  <!-- 全屏对话面板 -->
  <div class="fullscreen-chat-container">
    <PdfChatPanel 
      ref="chatPanelRef" 
      :attached-screenshots="aiTextbookStore.attachedScreenshots"
      :model-options="AI_ROLE_OPTIONS_JK"
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
    
      <MiniClass v-model="showMiniClassDialog" :class-url="miniClassUrl" question-title="小工具" fullscreen />

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
  name: 'PdfViewerViewSdsf',
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
import { AI_ROLE_OPTIONS_JK } from '@/constants/options'


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
  // 首都师范页面始终显示微课
  if (aiTextbookStore.schoolType === 'sdsf') return true
  
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
    console.error('[PdfViewerViewSdsf] confirmJoinClass failed:', e)
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


// 处理截图内容发送逻辑
const handlePdfSendWithScreenshot = async (text: string, shots: AttachedScreenshot[], selectedModel?: string) => {
  if (!shots || !shots.length) return

  aiTextbookStore.clearAttachedScreenshots()
  aiTextbookStore.clearScreenshotDrawingStates()

  const limitedShots = shots.slice(0, 3)
  const firstShot = limitedShots[0]
  const dataUrl = firstShot.dataUrl

  try {
    pdfViewerStore.openChatPanel()
    const currentResourceId = (route.query.resourceId as string) || aiTextbookStore.resourceId || ''
    if (currentResourceId) {
      aiTextbookStore.setResourceId(currentResourceId)
    }
    const now = Date.now()
    const sessionId = currentResourceId
      ? `ai-textbook-${currentResourceId}-${now}`
      : `ai-textbook-${now}`
    aiTextbookStore.currentSessionId = sessionId

    const fileName = `screenshot-${Date.now()}.jpg`
    const imageData = {
      filePath: fileName,
      base64DataUrl: dataUrl,
      width: firstShot.width,
      height: firstShot.height,
      fileSize: Math.round(dataUrl.length * 0.75),
    }

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

    await aiTextbookStore.sendMessage(
      text,
      selectedModel || 'mate',
      imageData,
      false,
      false,
      undefined,
      imageList,
    )

    const newSession: AiTextbookSession = {
      sessionId,
      sessionName: text,
      createTime: now,
      updateTime: now,
      msgCount: 0,
      pinned: false,
      thumbnailImage: dataUrl,
      hasImage: true,
      resourceId: currentResourceId || undefined,
      id: sessionId,
      question: text,
      answer: '',
    }
    addScreenshotSession(newSession)
    chatPanelRef.value?.reloadSessions?.()
  } catch (error) {
    console.error('[PdfViewerViewSdsf] 发送截图消息失败', error)
  }
}

const handlePdfRemoveScreenshot = (id: string) => {
  if (!id) return
  aiTextbookStore.removeAttachedScreenshot(id)
  aiTextbookStore.removeScreenshotDrawingState(id)
}

const handleEditScreenshot = (shotId: string) => {
  // 暂时保留空实现
}

// 生命周期
onMounted(async () => {
  try {
    // 设置学校类型为首都师范
    aiTextbookStore.setSchoolType('sdsf')
    
    await aiGeneralStore.loadSessions()

    checkClassroomStatus()
    androidBridge.onClassroomJoined(() => { isInClass.value = true })
    androidBridge.onClassroomExited(() => { isInClass.value = false })
    androidBridge.onClassroomStatusChanged((status: BridgeClassroomStatus) => {
      isInClass.value = !!status?.isInClass
    })

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

    // 为首都师范页面强制设置微课章节信息，以加载燕子剪纸微课
    aiTextbookStore.setChapterInfo({
      grade: '初一',
      subject: '数学',
      textbook: '探究型公开课',
      chapter_title: '燕子剪纸',
    })
  } catch (err) {
    console.error('PDF 加载失败:', err)
  }

  await nextTick()
  pdfViewerStore.openChatPanel()
  
  if (miniClassFabPos.value.x === 0 && miniClassFabPos.value.y === 0) {
    const container = (document.querySelector('.fullscreen-chat-container') as HTMLElement | null)
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

onBeforeUnmount(() => {
  pdfViewerStore.selectedTool = '' as any
  pdfViewerStore.closeChatPanel()
})
</script>

<style scoped>
.fullscreen-chat-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background-color: #f9fafb;
}

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

.join-class-button {
  background: #ffffff;
  border: none;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #666666;
  font-size: 14px;
  line-height: 1;
  font-weight: 500;
}

.join-class-button.in-class {
  box-shadow:
    0 0 0 2px rgba(252, 253, 82, 0.65),
    0 0 16px rgba(252, 253, 82, 0.75),
    0 0 28px rgba(252, 253, 82, 0.4);
  animation: join-class-glow 1.8s ease-in-out infinite;
}

@keyframes join-class-glow {
  0% { box-shadow: 0 0 0 2px rgba(252, 253, 82, 0.6); }
  50% { box-shadow: 0 0 0 3px rgba(252, 253, 82, 0.75); }
  100% { box-shadow: 0 0 0 2px rgba(252, 253, 82, 0.6); }
}
</style>
