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
    </PdfChatPanel>

    <JoinClassroomButton />

    <!-- 微课悬浮按钮 -->
    <DraggableFab
      v-if="shouldShowMiniClassFab"
      label="微课"
      size="md"
      :icon="xiaogongjuIcon"
      :initial-pos="{ left: 16, bottom: 200 }"
      bounds-container=".fullscreen-chat-container"
      @click="onMiniClassFabClick"
    />

    <MiniClass
      v-model="showMiniClassDialog"
      :class-url="miniClassUrl"
      question-title=" "
      fullscreen
      :show-close-button="false"
    >
      <template #header>
        <div class="sdsf-miniclass-tabs-container">
          <div class="sdsf-miniclass-tabs">
            <button
              class="sdsf-tab-btn"
              :class="{ active: activeMiniClassTab === 'swallow' }"
              @click="switchMiniClass('swallow')"
            >
              燕子互动
            </button>
            <button
              v-if="showBasketballTab"
              class="sdsf-tab-btn"
              :class="{ active: activeMiniClassTab === 'basketball' }"
              @click="switchMiniClass('basketball')"
            >
              篮球拼图
            </button>
          </div>
          <div class="user-account-info" v-if="userInfo">
            <span class="account-value">{{ userInfo.name || userInfo.userId || '未登录' }}</span>
          </div>
          <div class="placeholder"></div>
        </div>
      </template>
    </MiniClass>

    <!-- <div
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
    </div> -->
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
import {
  useAiTextbookChatStore,
  type ScreenshotDrawingState,
  getMiniClassConfig,
} from '@/stores/aiTextbookChatStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { showMessage } from '@/utils'
import { getUserInfo } from '@/services'
import type { AiTextbookSession, AttachedScreenshot } from '@/types'
import { addScreenshotSession } from '@/utils/storage/screenshotSessions'
import PdfChatPanel from '@/components/PdfChatPanel.vue'
import MiniClass from '@/components/MiniClass.vue'
import CommonActionButton from '@/components/base/Button.vue'
import JoinClassroomButton from '@/components/JoinClassroomButton.vue'
import DraggableFab from '@/components/base/DraggableFab.vue'
import xiaogongjuIcon from '/icons/xiaogongju.svg'
import { useUIStore } from '@/stores/uiStore'
import { AI_ROLE_OPTIONS_JK } from '@/constants/options'

// 使用 pdfViewerStore 和路由
const pdfViewerStore = usePdfViewerStore()
const route = useRoute()

// 使用 exerciseStore 来发送AI消息
const aiTextbookStore = useAiTextbookChatStore()
// 使用通用 AI 会话（用于截图输入走通用会话）
const aiGeneralStore = useAiGeneralChatStore()

const uiStore = useUIStore()
const userInfo = computed(() => getUserInfo())

// 篮球拼图标签显示筛选逻辑：账号尾部数字满足 (n-1) % 4 === 0
const showBasketballTab = computed(() => {
  if (!userInfo.value) return false
  const account = userInfo.value.userId || userInfo.value.name || ''
  const match = account.match(/\d+$/)
  if (!match) return false
  const num = parseInt(match[0], 10)
  return (num - 1) % 4 === 0
})

const showMiniClassDialog = computed({
  get: () => uiStore.showMiniClassDialog,
  set: (value) => {
    if (!value) {
      uiStore.closeMiniClassDialog()
    }
  },
})

// 微课切换逻辑
type MiniClassTab = 'swallow' | 'basketball'
const miniClassUrl = ref('https://www.imates.com.cn:9099/wk/math/swallow_puzzle.html')
const activeMiniClassTab = ref<MiniClassTab>('swallow')

function switchMiniClass(tab: MiniClassTab) {
  activeMiniClassTab.value = tab
  let url = ''
  if (tab === 'swallow') {
    url = 'https://www.imates.com.cn/wk/math/swallow_puzzle3.html'
  } else {
    url = 'https://www.imates.com.cn/wk/math/basketball2.html'
  }
  miniClassUrl.value = url
  // 如果对话框已经打开，通知 store 更新 URL 以触发 MiniClass 内部的 watch
  if (showMiniClassDialog.value) {
    uiStore.openMiniClassDialog(url, '小工具')
  }
}

const miniClassQuestionTitle = computed(() => uiStore.miniClassQuestionTitle)

const shouldShowMiniClassFab = computed(() => {
  // 首都师范页面始终显示微课
  if (aiTextbookStore.schoolType === 'sdsf') return true

  const info = aiTextbookStore.chapterInfo
  if (!info) return false
  return !!getMiniClassConfig(info)
})

const onMiniClassFabClick = () => {
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
const handlePdfSendWithScreenshot = async (
  text: string,
  shots: AttachedScreenshot[],
  selectedModel?: string
) => {
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
      imageList
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

    const currentResourceId = (route.query.resourceId as string) || ''
    const currentSectionName =
      (route.query.sectionName as string) || (route.query.textbookName as string) || null
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
        : null
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

    // 初始化微课 URL
    switchMiniClass('swallow')

    // 如果从登录页携带了 openMiniClass 参数，则自动打开微课
    if (route.query.openMiniClass === 'true') {
      onMiniClassFabClick()
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

.sdsf-miniclass-tabs-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
}

.sdsf-miniclass-tabs {
  display: inline-flex;
  align-items: center;
  gap: 24px;
  flex-shrink: 0;
}

.user-account-info {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  pointer-events: none;
}

.placeholder {
  flex-shrink: 0;
  width: 1px;
}

.account-value {
  font-size: 14px;
  color: #94a3b8;
  font-weight: 500;
}

.sdsf-tab-btn {
  height: 40px;
  padding: 0;
  font-size: 14px;
  font-weight: 500;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  user-select: none;
}

.sdsf-tab-btn:hover {
  color: #64748b;
}

.sdsf-tab-btn.active {
  color: #0f172a;
  font-weight: 600;
}

/* 底部指示线 */
.sdsf-tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: #0f172a;
  border-radius: 2px;
}
</style>
