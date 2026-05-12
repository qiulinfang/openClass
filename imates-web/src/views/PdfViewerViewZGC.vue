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
    </PdfChatPanel>

    <JoinClassroomButton />

    <!-- 微课悬浮按钮
    <DraggableFab
      v-if="shouldShowMiniClassFab"
      label="小框架"
      size="md"
      :icon="xiaogongju1Icon"
      :initial-pos="{ left: 16, bottom: 200 }"
      bounds-container=".fullscreen-chat-container"
      @click="onMiniClassFabClick"
    />

    新增悬浮按钮 (小工具11) -->
    <!-- <DraggableFab
      v-if="shouldShowMiniClassFab"
      label="画出高"
      size="md"
      :icon="xiaogongju2Icon"
      :initial-pos="{ left: 16, bottom: 280 }"
      bounds-container=".fullscreen-chat-container"
      @click="onTool11Click"
    />  -->

    <MiniClass v-model="showMiniClassDialog" :class-url="miniClassUrl" question-title="小工具" />
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
import JoinClassroomButton from '@/components/JoinClassroomButton.vue'
import DraggableFab from '@/components/base/DraggableFab.vue'
import xiaogongju1Icon from '/icons/xiaogongju1.svg'
import xiaogongju2Icon from '/icons/xiaogongju2.svg'
import { useUIStore } from '@/stores/uiStore'
import { AI_ROLE_OPTIONS } from '@/constants/options'

// 使用 pdfViewerStore 和路由
const pdfViewerStore = usePdfViewerStore()
const route = useRoute()

// 使用 exerciseStore 来发送AI消息
const aiTextbookStore = useAiTextbookChatStore()
// 使用通用 AI 会话（用于截图输入走通用会话）
const aiGeneralStore = useAiGeneralChatStore()

const uiStore = useUIStore()
const showMiniClassDialog = computed({
  get: () => uiStore.showMiniClassDialog,
  set: (value) => {
    if (!value) {
      uiStore.closeMiniClassDialog()
    }
  },
})
const miniClassUrl = computed(() => uiStore.miniClassUrl)

const shouldShowMiniClassFab = computed(() => {
  const info = aiTextbookStore.chapterInfo
  if (!info) return false
  return !!getMiniClassConfig(info)
})

const onMiniClassFabClick = () => {
  const matched = getMiniClassConfig(aiTextbookStore.chapterInfo)
  if (!matched) return
  uiStore.openMiniClassDialog(matched.url, matched.title)
}

const onTool11Click = () => {
  uiStore.openMiniClassDialog('https://www.imates.com.cn/wk/math/classtool11.html', '画出高')
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

// 处理截图捕获事件
const handleScreenshotCaptured = async (blob: Blob) => {
  try {
    const currentCount = aiTextbookStore.attachedScreenshots.length
    if (currentCount >= MAX_SCREENSHOTS) {
      showMessage(`最多只能添加 ${MAX_SCREENSHOTS} 张截图`, 'warning')
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

    aiTextbookStore.appendAttachedScreenshots([shot])
    aiTextbookStore.setScreenshotDrawingStates({
      ...aiTextbookStore.screenshotDrawingStates,
      [shotId]: aiTextbookStore.screenshotDrawingStates[shotId] || { objects: [], history: [], historyIndex: -1 },
    } as any)

    lastCapturedShotId.value = shotId
    editingShotId.value = shotId
    editScreenshotDialogVisible.value = true
  } catch (error) {
    console.error('[PdfViewerView] 处理截图数据失败', error)
  }
}

const handleEditScreenshot = (shotId: string) => {
  if (!shotId) return
  editingShotId.value = shotId
  editScreenshotDialogVisible.value = true
}

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

    const imageList = limitedShots.map((shot, index) => ({
      filePath: `screenshot-${Date.now()}-${index}.jpg`,
      base64DataUrl: shot.dataUrl,
      width: shot.width,
      height: shot.height,
      fileSize: Math.round(shot.dataUrl.length * 0.75),
    }))

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
    console.error('[PdfViewerView] 发送截图消息失败', error)
  }
}

const handlePdfRemoveScreenshot = (id: string) => {
  if (!id) return
  aiTextbookStore.removeAttachedScreenshot(id)
  aiTextbookStore.removeScreenshotDrawingState(id)
  if (lastCapturedShotId.value === id) {
    lastCapturedShotId.value = ''
  }
  if (aiTextbookStore.attachedScreenshots.length === 0) {
    editScreenshotDialogVisible.value = false
    editingShotId.value = ''
  }
}

onMounted(async () => {
  try {
    aiTextbookStore.setSchoolType('zgc')
    await aiGeneralStore.loadSessions()

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
  pdfViewerStore.openChatPanel()
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

:deep(.q-splitter__after) {
  border-top-left-radius: 16px;
  border-bottom-left-radius: 16px;
  box-shadow: 0px 4px 10px 0px rgba(30, 0, 120, 0.32);
  z-index: 2;
}

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
</style>
