<template>
  <Modal
    v-model="localVisible"
    title="你想问什么问题呢？"
    :initial-width="900"
    :initial-height="900"
    :min-width="500"
    :min-height="450"
    :close-on-overlay-click="false"
    title-align="left"
    header-background-color="#ffffff"
    :show-footer="true"
    :confirm-text="'给学伴'"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
      <div class="screenshot-input-subtitle">
        你可以在图片上进行编辑，也可以添加多个截图一起问学伴！
      </div>

      <div class="screenshot-input-body">
        <!-- 左侧：截图编辑区域（集成 DrawingBoard） -->
        <div class="screenshot-editor">
          <DrawingBoard
            v-if="previewImage || screenshotDataUrl"
            ref="drawingBoardRef"
            :background-image="previewImage || screenshotDataUrl"
            :drawing-board-tools="['draw', 'eraser-draw', 'undo', 'redo']"
            layout-mode="fill"
            :show-zoom-control="false"
            :force-pen-color="'red'"
            toolbar-position="left"
          />
          <div v-else class="empty-placeholder">
            <q-icon name="image" size="48px" color="grey-5" />
            <span>暂无截图</span>
          </div>
        </div>
        <!-- 右侧：截图缩略图列表 + 继续截图按钮（竖直排列，仅多截图模式下显示） -->
        <div v-if="props.mode === 'multiple'" class="screenshot-side-panel">
          <div class="side-panel-body">
            <div v-if="thumbnailList.length" class="side-thumbs-list">
              <ScreenshotThumb
                v-for="shot in thumbnailList"
                :key="shot.id"
                :image-url="shot.dataUrl"
                :active="shot.id === currentShotId"
                :show-delete="true"
                @click="switchPreview(shot.id)"
                @remove="handleRemoveThumbnail(shot.id)"
              />
            </div>
            <div v-else class="side-empty-text">暂无可用截图</div>
          </div>
          <div
            class="side-panel-footer"
            v-if="thumbnailList.length < MAX_SCREENSHOTS"
          >
            <button
              type="button"
              class="add-more-btn"
              :disabled="!screenshotDataUrl"
              @click.stop.prevent="handleAddMore"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, type ComponentPublicInstance } from 'vue'
import Modal from '@/components/base/Modal.vue'
import DrawingBoard from '@/components/DrawingBoard.vue'
import ScreenshotThumb from '@/components/ScreenshotThumb.vue'
import { showMessage } from '@/utils'
import type { AttachedScreenshot } from '@/types'
import type { ScreenshotDrawingState } from '@/stores/aiTextbookChatStore'

// 最多允许挂载的截图数量
const MAX_SCREENSHOTS = 3

// DrawingBoard 暴露的方法类型
interface DrawingBoardExposed {
  exportToJpg: (quality?: number) => string
  hasContent: () => boolean
  clearAll: () => void
  // 保存当前画板状态（对象列表 + 历史记录）
  saveData: () => ScreenshotDrawingState
  // 加载指定的画板状态
  loadData: (data: ScreenshotDrawingState) => void
}

interface Props {
  modelValue: boolean
  screenshotDataUrl?: string
  // 已有的截图列表（来自上层，如 PdfViewerView 中的 pdfAttachedScreenshots）
  existingScreenshots?: AttachedScreenshot[]
  // 截图模式：single=单截图，multiple=多截图（默认）
  mode?: 'single' | 'multiple'
  // 父组件传入的绘图状态 map（key: screenshotId, value: DrawingState）
  drawingStatesFromParent?: Record<string, ScreenshotDrawingState>
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', screenshots: AttachedScreenshot[], states: Record<string, ScreenshotDrawingState>): void
  (e: 'add-more', screenshots: AttachedScreenshot[], states: Record<string, ScreenshotDrawingState>): void
  (e: 'cancel'): void
  (e: 'remove-screenshot', id: string): void
}

const props = withDefaults(defineProps<Props>(), {
  screenshotDataUrl: '',
  existingScreenshots: () => [],
  mode: 'multiple',
  drawingStatesFromParent: () => ({}),
})

const emit = defineEmits<Emits>()

// DrawingBoard 组件引用
const drawingBoardRef = ref<(ComponentPublicInstance & DrawingBoardExposed) | null>(null)

// 当前在画板中预览/编辑的截图 ID
const currentShotId = ref<string | null>(null)

// 当前在画板中预览/编辑的图片（可能是当前截图，也可能是已有截图之一）
const previewImage = ref<string>('')

// 每张截图对应的画板状态（objects + history 等），按截图 ID 索引
const drawingStates = ref<Record<string, ScreenshotDrawingState>>({})

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// 对话框打开时初始化预览图片和当前截图 ID，并根据需要加载对应的画板状态
watch(
  () => props.modelValue,
  async (newValue) => {
    if (newValue) {
      // 先同步父组件传进来的绘图状态
      if (props.drawingStatesFromParent) {
        drawingStates.value = { ...props.drawingStatesFromParent }
      }

      // 优先使用当前截图，其次使用已有截图列表中的第一张
      if (props.screenshotDataUrl) {
        currentShotId.value = 'current-capture'
        previewImage.value = props.screenshotDataUrl
      } else if (props.existingScreenshots && props.existingScreenshots.length > 0) {
        currentShotId.value = props.existingScreenshots[0].id
        previewImage.value = props.existingScreenshots[0].dataUrl
      } else {
        currentShotId.value = null
        previewImage.value = ''
      }

      await nextTick()
      const id = currentShotId.value
      const state = id ? drawingStates.value[id] : undefined
      if (id && state && drawingBoardRef.value?.loadData) {
        // 如果之前保存过该截图的画板状态，则恢复它
        drawingBoardRef.value.loadData(state)
      } else if (drawingBoardRef.value?.clearAll) {
        // 否则清空画板，基于当前 previewImage/backgroundImage 重新开始
        drawingBoardRef.value.clearAll()
      }
    }
  }
)

// 右侧缩略图数据源：当前截图 + 已有截图
const thumbnailList = computed(() => {
  const list: AttachedScreenshot[] = []

  if (props.screenshotDataUrl) {
    list.push({
      id: 'current-capture',
      dataUrl: props.screenshotDataUrl,
      width: 0,
      height: 0,
    })
  }

  if (Array.isArray(props.existingScreenshots) && props.existingScreenshots.length > 0) {
    list.push(...props.existingScreenshots)
  }

  return list
})

// 切换预览图片：点击右侧任意缩略图
const switchPreview = async (id: string) => {
  if (!id) return

  const prevId = currentShotId.value

  // 1. 先保存当前截图的画板状态
  if (prevId && drawingBoardRef.value?.saveData) {
    try {
      const data = drawingBoardRef.value.saveData()
      drawingStates.value[prevId] = {
        objects: data.objects,
        history: data.history,
        historyIndex: data.historyIndex,
      }
    } catch (e) {
      console.error('[ScreenshotInputDialog] saveData 失败', e)
    }
  }

  // 2. 更新当前截图 ID 和预览图片
  currentShotId.value = id
  const target = thumbnailList.value.find((shot) => shot.id === id)
  previewImage.value = target?.dataUrl || ''

  // 3. 加载对应的画板状态，如无则清空
  await nextTick()
  const state = drawingStates.value[id]
  if (state && drawingBoardRef.value?.loadData) {
    drawingBoardRef.value.loadData(state)
  } else if (drawingBoardRef.value?.clearAll) {
    drawingBoardRef.value.clearAll()
  }
}

// 删除右侧某个已有截图缩略图（通知上层移除）
const handleRemoveThumbnail = (id: string) => {
  if (!id) return

  console.log('[ScreenshotInputDialog] remove thumbnail (before)', {
    id,
    currentShotId: currentShotId.value,
    thumbnailCount: thumbnailList.value.length,
    thumbnails: thumbnailList.value.map((s) => ({ id: s.id, dataUrlHead: (s.dataUrl || '').slice(0, 40) })),
  })

  // 移除本地缓存的画板状态
  if (drawingStates.value[id]) {
    delete drawingStates.value[id]
  }

  // 如果删除的是当前正在编辑的截图，重置当前预览并清空画板
  if (currentShotId.value === id) {
    currentShotId.value = null
    previewImage.value = ''
    if (drawingBoardRef.value?.clearAll) {
      drawingBoardRef.value.clearAll()
    }
  }

  emit('remove-screenshot', id)

  console.log('[ScreenshotInputDialog] remove thumbnail (after emit)', {
    id,
    currentShotId: currentShotId.value,
    previewImageHead: (previewImage.value || '').slice(0, 40),
  })
}

// 将当前截图导出为 AttachedScreenshot 数组
const exportCurrentScreenshot = async (): Promise<AttachedScreenshot[] | null> => {
  console.log('[ScreenshotInputDialog] export screenshot (start)', {
    currentShotId: currentShotId.value,
    previewImageHead: (previewImage.value || '').slice(0, 40),
    screenshotDataUrlHead: (props.screenshotDataUrl || '').slice(0, 40),
    thumbnailCount: thumbnailList.value.length,
  })

  if (!previewImage.value && !props.screenshotDataUrl) {
    showMessage('截图数据丢失，请重新截图', 'error')

    console.log('[ScreenshotInputDialog] export screenshot (abort: missing data)', {
      currentShotId: currentShotId.value,
      previewImageHead: (previewImage.value || '').slice(0, 40),
      screenshotDataUrlHead: (props.screenshotDataUrl || '').slice(0, 40),
    })

    return null
  }

  // 确定本次导出的截图 id：如果当前 id 是已有截图，就继续用；否则生成新 id
  let shotId = currentShotId.value
  if (!shotId || shotId === 'current-capture') {
    shotId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  // 从 DrawingBoard 导出 JPG 图片（包含背景截图 + 用户标注）
  let finalImageData = previewImage.value || props.screenshotDataUrl || ''
  if (drawingBoardRef.value?.exportToJpg) {
    const exportedImage = drawingBoardRef.value.exportToJpg(0.9)
    if (exportedImage) {
      finalImageData = exportedImage
    }
  }

  // 保存当前画板状态到本地 drawingStates
  if (drawingBoardRef.value?.saveData) {
    try {
      const data = drawingBoardRef.value.saveData()
      drawingStates.value[shotId] = {
        objects: data.objects,
        history: data.history,
        historyIndex: data.historyIndex,
      }
    } catch (e) {
      console.error('[ScreenshotInputDialog] saveData 失败', e)
    }
  }

  // 通过 Image 获取宽高
  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
    }
    img.src = finalImageData
  })

  const shot: AttachedScreenshot = {
    id: shotId,
    dataUrl: finalImageData,
    width: size.width,
    height: size.height,
  }

  // 更新当前 id / 预览（保持一致）
  currentShotId.value = shotId
  previewImage.value = finalImageData

  console.log('[ScreenshotInputDialog] export screenshot (done)', {
    shotId,
    finalImageDataHead: (finalImageData || '').slice(0, 40),
    width: size.width,
    height: size.height,
  })

  return [shot]
}

// 确定按钮：返回当前截图数组，但不直接发送消息
const handleConfirm = async () => {
  const shots = await exportCurrentScreenshot()
  if (!shots) return
  emit('confirm', shots, { ...drawingStates.value })
  localVisible.value = false
}

// 继续截图：返回当前截图数组并关闭对话框，交给父组件继续触发截图流程
const handleAddMore = async () => {
  console.log('[ScreenshotInputDialog] add-more (start)', {
    currentShotId: currentShotId.value,
    thumbnailCount: thumbnailList.value.length,
    max: MAX_SCREENSHOTS,
  })

  // 安全保护：如果当前缩略图数量已达上限，给出提示并中止
  if (thumbnailList.value.length >= MAX_SCREENSHOTS) {
    showMessage(`最多只能添加${MAX_SCREENSHOTS}张截图`, 'warning')

    console.log('[ScreenshotInputDialog] add-more (abort: reach max)', {
      thumbnailCount: thumbnailList.value.length,
      max: MAX_SCREENSHOTS,
    })

    return
  }

  const shots = await exportCurrentScreenshot()
  if (!shots) return

  emit('add-more', shots, { ...drawingStates.value })
  localVisible.value = false

  console.log('[ScreenshotInputDialog] add-more (emitted)', {
    shots: shots.map((s) => ({ id: s.id, dataUrlHead: (s.dataUrl || '').slice(0, 40) })),
    statesKeys: Object.keys(drawingStates.value || {}).length,
  })
}

// 取消按钮
const handleCancel = () => {
  emit('cancel')
  localVisible.value = false
}
</script>

<style lang="scss" scoped>
.screenshot-input-subtitle {
  padding: 0 16px 0px 16px;
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  height: 5%;
}

.screenshot-input-body {
  display: flex;
  flex-direction: row;
  height: 100%;
  padding: 0 16px 16px 16px;
  gap: 12px;
}

.screenshot-editor {
  flex: 1;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  position: relative;
  overflow: hidden;

  // DrawingBoard 组件样式覆盖
  :deep(.canvas-demo-container) {
    background: transparent;
  }

  // fillContainer 模式下，Canvas 填满容器
  :deep(canvas) {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }

  // 工具栏样式调整（更紧凑）
  :deep(.toolbar-wrapper) {
    top: 8px;
  }

  // 隐藏 DrawingBoard 统一工具栏中的配置按钮
  :deep(.popup-icon-wrapper) {
    display: none !important;
  }

  .empty-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #9e9e9e;
    font-size: 14px;
  }
}

.screenshot-side-panel {
  width: 88px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-height: 95%;
  overflow-y: auto;
  padding: 5px;
}

.side-thumbs-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  :deep(.screenshot-thumb) {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
  }
}

.side-panel-body {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.side-thumb-wrapper {
  width: 72px;
  height: 72px;
  border-radius: 10px;
  overflow: hidden;
  background: #f5f5f5;
  position: relative;
}

.side-thumb-wrapper--active {
  border-color: #6e55ff;
  box-shadow: 0 0 0 2px rgba(110, 85, 255, 1);
}

.side-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.side-thumb-close {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
}

.side-thumb-close:hover {
  background: rgba(0, 0, 0, 0.7);
}

.side-empty-text {
  font-size: 12px;
  color: #9e9e9e;
}

.side-panel-footer {
  display: flex;
  justify-content: center;
  width: 100%;
}

.add-more-btn {
  width: 72px;
  height: 72px;
  border-radius: 10px;
  border: 1px dashed #c2c2d6;
  background-color: transparent;
  color: #c2c2d6;
  font-size: 32px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    border-color: #6e55ff;
    color: #6e55ff;
    background-color: rgba(110, 85, 255, 0.04);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
</style>
