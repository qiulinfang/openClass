<template>
  <div class="draft-notebook-page">
    <div class="content-layout">
      <q-splitter
        v-model="splitterModel"
        :limits="[30, 70]"
        :disable="!draftStore.chatPanelVisible || isBoardCapturing"
        :class="['full-height', { 'full-width-before': !draftStore.chatPanelVisible }]"
      >
        <!-- 画板内容区域 -->
        <template v-slot:before>
          <div class="drawing-board-container">
            <DrawingHeader
              v-if="drawingBoardRef"
              :tools="drawingBoardRef.toolbarTools"
              :selected-tool="drawingBoardRef.toolbarSelectedTool"
              :tool-config="drawingBoardRef.toolbarToolConfig"
              :tool-states="{ undo: drawingBoardRef.canUndo, redo: drawingBoardRef.canRedo }"
              @tool-change="(tool) => drawingBoardRef?.handleToolbarToolChange(tool)"
              @config-change="(cfg) => drawingBoardRef?.handleToolbarConfigChange(cfg)"
              @undo="drawingBoardRef?.undo()"
              @redo="drawingBoardRef?.redo()"
              @clear="handleClearRequest"
              @back="handleBack"
            />
            <div v-else class="header-placeholder"></div>

            <div class="board-wrapper">
              <DrawingBoardNew
                ref="drawingBoardRef"
                :showGrid="false"
                :enableAskAi="true"
                :show-toolbar="false"
                @clear="handleClearRequest"
                @ask-ai-image-selected="handleAskAiImageSelected"
              />
            </div>
          </div>
        </template>

        <!-- 对话面板 -->
        <template v-slot:after v-if="draftStore.chatPanelVisible">
          <DraftNoteChatPanel
            ref="chatPanelRef"
            :is-exploring="isBoardCapturing"
            :is-capturing="isBoardCapturing"
            @close="draftStore.closeChatPanel()"
            @screenshot-click="handleScreenshotClick"
            @request-screenshot="handleChatPanelScreenshotRequest"
            @open-html-preview="handleOpenHtmlPreview"
          />
        </template>
      </q-splitter>
    </div>

    <Dialog
      ref="clearDialogRef"
      title="清空确认"
      :confirmButtonText="'清空'"
      :cancelButtonText="'取消'"
      @confirm="confirmClearCanvas"
      @cancel="cancelClearCanvas"
    >
      确定要清空画布吗？此操作不可撤销。
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import DrawingHeader from '@/components/header/DrawingHeader.vue'
import DrawingBoardNew from '@/components/drawingBoardNew.vue'
import Dialog from '@/components/base/Dialog.vue'
import DraftNoteChatPanel from '@/components/chat/chatpanel/DraftNoteChatPanel.vue'
import { useDraftStore } from '@/stores/draftStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'

const router = useRouter()
const draftStore = useDraftStore()
const aiGeneralStore = useAiGeneralChatStore()
const teacherChatStore = useTeacherChatStore()
const drawingBoardRef = ref<InstanceType<typeof DrawingBoardNew> | null>(null)
const clearDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
const chatPanelRef = ref<InstanceType<typeof DraftNoteChatPanel> | null>(null)

const splitterModel = ref(60) // 分隔比例（左侧占60%）
const isBoardCapturing = ref(false)

onBeforeUnmount(() => {
  draftStore.closeChatPanel()
})

type AskAiImageInfo = {
  filePath: string
  width: number
  height: number
  fileSize: number
  base64DataUrl?: string
}

const handleBack = () => {
  router.back()
}

const handleClearRequest = () => {
  clearDialogRef.value?.openDialog()
}

const confirmClearCanvas = () => {
  drawingBoardRef.value?.loadData({
    objects: [],
    history: [[]],
    historyIndex: 0,
  })
  clearDialogRef.value?.closeDialog()
}

const cancelClearCanvas = () => {
  clearDialogRef.value?.closeDialog()
}

const handleAskAiImageSelected = async (imageInfo: AskAiImageInfo) => {
  console.log('[DraftNotebookView] handleAskAiImageSelected:', imageInfo)
  isBoardCapturing.value = false
  // 切换回画笔模式
  drawingBoardRef.value?.handleToolbarToolChange('draw')

  // 打开右侧聊天面板并附加图片
  draftStore.openChatPanel()
  await nextTick()
  await chatPanelRef.value?.attachImageToAiGeneral?.(imageInfo)
}

const handleScreenshotClick = (active: boolean) => {
  console.log('[DraftNotebookView] handleScreenshotClick:', active)
  if (!active) {
    // 如果收到取消信号，关闭截图模式
    isBoardCapturing.value = false
    drawingBoardRef.value?.handleToolbarToolChange('draw')
  } else {
    handleChatPanelScreenshotRequest()
  }
}

const handleChatPanelScreenshotRequest = () => {
  if (!drawingBoardRef.value) return

  // 1. 开启画板截图模式
  isBoardCapturing.value = true
  drawingBoardRef.value.handleToolbarToolChange('askAi')
}

// 处理 HTML 预览点击
const handleOpenHtmlPreview = (payload: { url: string; html?: string }) => {
  const { url, html } = payload
  if (!url) return

  // 获取当前会话 ID（优先从老师会话获取，如果没有则从AI会话获取）
  const currentSessionId = teacherChatStore.currentSession?.sessionId || aiGeneralStore.currentSession?.sessionId
  console.log('[DraftNotebookView] handleOpenHtmlPreview:', { url, hasHtml: !!html, currentSessionId })

  // 如果有缓存的 HTML，存入 sessionStorage 供 HtmlPreviewView 使用
  if (html) {
    sessionStorage.setItem('htmlPreview_inlineContent', html)
  }

  router.push({
    name: 'htmlPreview',
    query: {
      url,
      sessionId: currentSessionId, // 传递会话 ID
      returnTo: router.currentRoute.value.fullPath,
      reopenPanel: 'draft',
    }
  })
}
</script>

<style lang="scss" scoped>
.draft-notebook-page {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0a0020;
  overflow: hidden;

  .content-layout {
    flex: 1;
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .full-height {
    height: 100%;
    width: 100%;
  }

  /* 当聊天面板隐藏时，让before插槽占据整个宽度 */
  .full-width-before :deep(.q-splitter__before) {
    width: 100% !important;
  }

  .drawing-board-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: #0a0020;
  }

  .board-wrapper {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  :deep(.q-splitter__separator) {
    background-color: transparent;
    cursor: col-resize;
    position: relative;
    width: 24px;
    margin-left: -12px;
    margin-right: -12px;
    z-index: 5;
    will-change: left, right;
  }

  /* 禁用时取消拖动手势 */
  :deep(.q-splitter--disabled) {
    .q-splitter__separator {
      cursor: default;
    }
  }

  // 对话面板容器样式（参考 PdfViewerView）
  :deep(.q-splitter__after) {
    border-top-left-radius: 16px;
    border-bottom-left-radius: 16px;
    box-shadow: 0px 4px 10px 0px rgba(30, 0, 120, 0.32);
    z-index: 2;
    background-color: #e8e9ff;
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
}
</style>
