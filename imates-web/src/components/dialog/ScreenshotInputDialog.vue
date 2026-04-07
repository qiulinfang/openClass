<template>
  <Modal
    v-model="localVisible"
    title="你想问什么问题呢？"
    :initial-width="900"
    :initial-height="900"
    :min-width="500"
    :min-height="450"
    :z-index="screenshotDialogZIndex"
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
            v-if="previewImage"
            ref="drawingBoardRef"
            :background-image="getOriginalImage()"
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
              :disabled="!currentShotId"
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

const screenshotDialogZIndex = 14000

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
  modelValue: boolean // 是否显示对话框（由 v-model 控制）
  mode?: 'single' | 'multiple' // 截图输入对话框工作模式，'single'=一张，'multiple'=多张(默认)
  initialShotId?: string // 打开时优先选中的截图（用于编辑已挂载截图）
  existingScreenshots?: AttachedScreenshot[] // 右侧缩略图列表，支持多图切换（父组件传入）
  drawingStatesFromParent?: Record<string, ScreenshotDrawingState> // 恢复每张图的绘图状态（标注/擦除历史，父组件传入）
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', screenshots: AttachedScreenshot[], states: Record<string, ScreenshotDrawingState>): void
  (e: 'add-more', screenshots: AttachedScreenshot[], states: Record<string, ScreenshotDrawingState>): void
  (e: 'cancel'): void
  (e: 'remove-screenshot', id: string): void
}

const props = withDefaults(defineProps<Props>(), {
  initialShotId: '',
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

// 本地截图列表，管理所有截图的最新状态（包括编辑后的 dataUrl）
const localScreenshots = ref<AttachedScreenshot[]>([])

const initFromProps = async () => {
  // 先同步父组件传进来的绘图状态
  drawingStates.value = { ...(props.drawingStatesFromParent || {}) }

  // 初始化本地截图列表（从 props 复制，保持独立）
  const list: AttachedScreenshot[] = []
  if (Array.isArray(props.existingScreenshots) && props.existingScreenshots.length > 0) {
    list.push(
      ...props.existingScreenshots.map((s) => ({
        ...s,
        originalDataUrl: s.originalDataUrl || s.dataUrl,
      })),
    )
  }
  localScreenshots.value = list

  // 优先使用 initialShotId，其次使用已有截图列表中的第一张
  const canUseInitialId = !!props.initialShotId && list.some((s) => s.id === props.initialShotId)

  if (canUseInitialId) {
    currentShotId.value = props.initialShotId || null
    previewImage.value = list.find((s) => s.id === props.initialShotId)?.dataUrl || ''
  } else if (list.length > 0) {
    currentShotId.value = list[0].id
    previewImage.value = list[0].dataUrl
  } else {
    currentShotId.value = null
    previewImage.value = ''
  }

  await nextTick()
  const id = currentShotId.value
  const state = id ? drawingStates.value[id] : undefined
  if (id && state && drawingBoardRef.value?.loadData) {
    drawingBoardRef.value.loadData(state)
  } else if (drawingBoardRef.value?.clearAll) {
    drawingBoardRef.value.clearAll()
  }
}

// 弹窗打开时初始化；并在弹窗打开期间，如果父组件更新了截图列表/初始选中/画板状态，也要同步
watch(
  () => [
    props.modelValue,
    props.mode,
    props.initialShotId,
    props.existingScreenshots,
    props.drawingStatesFromParent,
  ],
  async ([visible]) => {
    if (!visible) return
    await initFromProps()
  },
  { immediate: true },
)

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// 右侧缩略图数据源：从本地截图列表获取
const thumbnailList = computed(() => localScreenshots.value)

// 获取当前截图的原图数据（用于 DrawingBoard 背景）
const getOriginalImage = () => {
  const currentShot = localScreenshots.value.find((s) => s.id === currentShotId.value)
  // 优先使用原图，如果没有原图则使用当前截图数据
  return currentShot?.originalDataUrl || currentShot?.dataUrl || previewImage.value || ''
}

// 切换预览图片：点击右侧任意缩略图
const switchPreview = async (id: string) => {
  if (!id) return

  const prevId = currentShotId.value

  // 1. 先保存当前截图的画板状态并导出更新后的缩略图
  if (prevId && drawingBoardRef.value) {
    try {
      // 导出当前编辑后的图片（原图+笔记）作为新的缩略图
      if (drawingBoardRef.value.exportToJpg) {
        const exportedImage = drawingBoardRef.value.exportToJpg(0.9)
        // 更新本地截图列表中对应截图的缩略图 dataUrl（原图保持不变）
        const prevShot = localScreenshots.value.find((s) => s.id === prevId)
        if (prevShot && exportedImage) {
          prevShot.dataUrl = exportedImage // 更新缩略图
          // originalDataUrl 保持不变，确保下次编辑时仍使用原图
        }
      }

      // 保存画板状态
      if (drawingBoardRef.value.saveData) {
        const data = drawingBoardRef.value.saveData()
        drawingStates.value[prevId] = {
          objects: data.objects,
          history: data.history,
          historyIndex: data.historyIndex,
        }
      }
    } catch {
      // 静默处理错误，不输出日志
    }
  }

  // 2. 更新当前截图 ID 和预览图片
  currentShotId.value = id
  const target = localScreenshots.value.find((shot) => shot.id === id)
  previewImage.value = target?.dataUrl || ''

  // 3. 加载对应的画板状态：先强制清空画布，再加载新状态
  await nextTick()
  // 先清空画板，避免前一张图的笔迹残留
  if (drawingBoardRef.value?.clearAll) {
    drawingBoardRef.value.clearAll()
  }
  // 再加载新图的状态（如果有）
  const state = drawingStates.value[id]
  if (state && drawingBoardRef.value?.loadData) {
    drawingBoardRef.value.loadData(state)
  }
}

// 删除右侧某个已有截图缩略图
const handleRemoveThumbnail = (id: string) => {
  if (!id) return

  // 从本地截图列表中移除
  const idx = localScreenshots.value.findIndex((s) => s.id === id)
  if (idx >= 0) {
    localScreenshots.value.splice(idx, 1)
  }

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
}

// 将当前截图导出为 AttachedScreenshot 数组
const exportCurrentScreenshot = async (): Promise<AttachedScreenshot[] | null> => {
  // 确保画板状态/画面已渲染到最新（避免导出到旧图）
  await nextTick()

  // 获取当前编辑的截图
  const currentShot = localScreenshots.value.find((s) => s.id === currentShotId.value)
  if (!currentShot) {
    showMessage('截图数据丢失，请重新截图', 'error')
    return null
  }

  // 使用当前截图的 id
  const shotId = currentShotId.value
  if (!shotId) {
    showMessage('截图数据丢失，请重新截图', 'error')
    return null
  }

  // 从 DrawingBoard 导出 JPG 图片（包含背景截图 + 用户标注）
  let finalImageData = previewImage.value || currentShot.dataUrl || ''
  if (drawingBoardRef.value?.exportToJpg) {
    const exportedImage = drawingBoardRef.value.exportToJpg(0.9)
    if (!exportedImage) {
      showMessage('导出截图失败，请稍后重试', 'error')
      return null
    }

    finalImageData = exportedImage
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
    } catch {
      // 静默处理错误
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
    dataUrl: finalImageData, // 缩略图（原图+笔记）
    originalDataUrl: getOriginalImage(), // 原图数据
    width: size.width,
    height: size.height,
  }

  // 更新当前截图的 dataUrl（保持一致）
  const idx = localScreenshots.value.findIndex((s) => s.id === shotId)
  if (idx >= 0) {
    localScreenshots.value[idx].dataUrl = finalImageData
  }

  return [shot]
}

// 确定按钮：返回所有截图数组（全量回传）
const handleConfirm = async () => {
  const shots = await exportCurrentScreenshot()
  if (!shots) return

  const current = shots[0]
  const allShots = localScreenshots.value.map((s) =>
    s.id === current.id ? current : s
  )

  emit('confirm', allShots, { ...drawingStates.value })
}

// 继续截图：返回所有截图数组并关闭对话框，交给父组件继续触发截图流程
const handleAddMore = async () => {
  // 安全保护：如果当前缩略图数量已达上限，给出提示并中止
  if (localScreenshots.value.length >= MAX_SCREENSHOTS) {
    showMessage(`最多只能添加${MAX_SCREENSHOTS}张截图`, 'warning')
    return
  }

  const shots = await exportCurrentScreenshot()
  if (!shots) return

  const current = shots[0]
  const allShots = localScreenshots.value.map((s) =>
    s.id === current.id ? current : s
  )

  emit('add-more', allShots, { ...drawingStates.value })
}

// 取消按钮
const handleCancel = () => {
  emit('cancel')
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
