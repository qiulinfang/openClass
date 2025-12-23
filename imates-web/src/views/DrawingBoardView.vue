<template>
  <div class="drawing-board-view">
    <!-- 左侧：草稿列表面板 -->
    <div v-if="showDraftPanel" class="draft-panel-container">
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
              <div v-else class="thumbnail-placeholder"></div>
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
    </div>

    <!-- 主内容：绘图板 -->
    <div class="drawing-board-container">
      <!-- 左上角：汉堡菜单按钮 -->
      <div class="header-controls">
        <q-btn
          flat
          round
          dense
          :icon="showDraftPanel ? 'menu_open' : 'menu'"
          color="grey-7"
          size="md"
          @click="toggleDraftPanel"
          class="toggle-panel-btn"
        >
          <q-tooltip>{{ showDraftPanel ? '隐藏草稿列表' : '显示草稿列表' }}</q-tooltip>
        </q-btn>
      </div>

      <DrawingBoardNew
        ref="drawingBoardRef"
        :drawing-board-tools="drawingBoardTools"
        @content-change="updateCurrentDraftThumbnail"
        @clear="handleClearRequest"
        :showGrid="true"
      />
    </div>

    <!-- 清空画布确认对话框 -->
    <DraggableDialog
      v-model="showClearDialog"
      title="确认清空画布"
      :show-footer="true"
      confirm-text="清空"
      cancel-text="取消"
      confirm-variant="danger"
      :initial-width="360"
      :initial-height="190"
      :min-width="300"
      :min-height="160"
      @confirm="confirmClearCanvas"
      @cancel="cancelClearCanvas"
    >
      <div class="delete-confirm-content">
        {{ '确定要清空画布吗？此操作不可撤销。' }}
      </div>
    </DraggableDialog>
  </div>
</template>

<script setup lang="ts">
// 定义组件名称，便于 keep-alive 缓存和 Vue DevTools 识别
defineOptions({
  name: 'DrawingBoardView',
})

import { ref, onMounted, onBeforeUnmount } from 'vue'
import { showMessage } from '@/utils'
import DrawingBoardNew from '@/components/DrawingBoardNew.vue'
import DraggableDialog from '@/components/DraggableDialog.vue'
const drawingBoardTools = [
  'undo',
  'redo',
  'clear',
  'select',
  'hand',
  'draw',
  'eraser-draw',
  'shape',
]

// ==================== 草稿本数据模型 ====================
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

// ==================== 响应式数据 ====================
const showDraftPanel = ref(true) // 控制草稿列表显示隐藏

const drawingBoardRef = ref<InstanceType<typeof DrawingBoardNew> | null>(null)
const draftList = ref<Draft[]>([
  {
    id: `draft-${Date.now()}`,
    name: '草稿1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    objects: [],
    history: [[]],
    historyIndex: 0,
  },
])
const currentDraftIndex = ref(0)

// 清空画布确认对话框
const showClearDialog = ref(false)

// ==================== 方法 ====================
// 流程：切换草稿列表面板显示隐藏
const toggleDraftPanel = () => {
  showDraftPanel.value = !showDraftPanel.value
}

// 流程：新建草稿
const handleNewDraft = () => {
  // 第1步：保存当前草稿的绘图数据和缩略图
  if (drawingBoardRef.value) {
    const currentData = drawingBoardRef.value.saveData()
    const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
    draftList.value[currentDraftIndex.value].objects = currentData.objects
    draftList.value[currentDraftIndex.value].history = currentData.history
    draftList.value[currentDraftIndex.value].historyIndex = currentData.historyIndex
    draftList.value[currentDraftIndex.value].thumbnail = thumbnail
  }

  // 第2步：创建新草稿
  const newDraft: Draft = {
    id: `draft-${Date.now()}`,
    name: `草稿${draftList.value.length + 1}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    objects: [],
    history: [[]],
    historyIndex: 0,
  }

  draftList.value.push(newDraft)
  currentDraftIndex.value = draftList.value.length - 1

  // 第3步：清空绘图板并生成新草稿的缩略图
  if (drawingBoardRef.value) {
    drawingBoardRef.value.loadData({
      objects: [],
      history: [[]],
      historyIndex: 0,
    })
    // 第4步：为新建的空白草稿立即生成缩略图
    setTimeout(() => {
      if (drawingBoardRef.value) {
        const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
        draftList.value[currentDraftIndex.value].thumbnail = thumbnail
      }
    }, 100)
  }
}

// 流程：切换草稿
const switchDraft = (index: number) => {
  if (index < 0 || index >= draftList.value.length) {
    console.warn('[DrawingBoardView] ⚠️ 无效的草稿索引:', index)
    return
  }

  // 如果点击的是当前草稿，不需要切换
  if (index === currentDraftIndex.value) {
    return
  }
  // 第1步：保存当前草稿的绘图数据和缩略图
  if (drawingBoardRef.value) {
    const currentData = drawingBoardRef.value.saveData()
    const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
    draftList.value[currentDraftIndex.value].objects = currentData.objects
    draftList.value[currentDraftIndex.value].history = currentData.history
    draftList.value[currentDraftIndex.value].historyIndex = currentData.historyIndex
    draftList.value[currentDraftIndex.value].thumbnail = thumbnail
    draftList.value[currentDraftIndex.value].updatedAt = Date.now()
  }

  // 第2步：切换到新草稿
  currentDraftIndex.value = index

  // 第3步：加载新草稿的绘图数据
  if (drawingBoardRef.value) {
    const newDraft = draftList.value[index]
    drawingBoardRef.value.loadData({
      objects: newDraft.objects,
      history: newDraft.history,
      historyIndex: newDraft.historyIndex,
    })
    // 如果新草稿没有缩略图，生成一个
    setTimeout(() => {
      if (drawingBoardRef.value && !draftList.value[index].thumbnail) {
        const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
        draftList.value[index].thumbnail = thumbnail
      }
    }, 100)
  }

  // 第4步：更新草稿修改时间
  draftList.value[index].updatedAt = Date.now()
}

// 流程：删除草稿
const confirmDeleteDraft = (index: number) => {
  // 第1个草稿不允许删除
  if (index === 0) {
    showMessage('第一个草稿不能删除', 'warning')
    return
  }

  // 第1步：如果删除的是当前草稿，保存数据
  const oldCurrentIndex = currentDraftIndex.value
  const isDeletingCurrent = index === currentDraftIndex.value

  if (isDeletingCurrent && drawingBoardRef.value) {
    const currentData = drawingBoardRef.value.saveData()
    draftList.value[currentDraftIndex.value].objects = currentData.objects
    draftList.value[currentDraftIndex.value].history = currentData.history
    draftList.value[currentDraftIndex.value].historyIndex = currentData.historyIndex
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
        historyIndex: newDraft.historyIndex,
      })
    }
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

// 清空画布确认对话框处理
const handleClearRequest = () => {
  showClearDialog.value = true
}

const confirmClearCanvas = () => {
  if (drawingBoardRef.value) {
    // 清空画布数据
    drawingBoardRef.value.loadData({
      objects: [],
      history: [[]],
      historyIndex: 0,
    })
    // 更新缩略图
    updateCurrentDraftThumbnail()
  }
  showClearDialog.value = false
}

const cancelClearCanvas = () => {
  showClearDialog.value = false
}

// 生命周期：页面挂载时为当前草稿生成缩略图
onMounted(() => {
  setTimeout(() => {
    if (drawingBoardRef.value && !draftList.value[currentDraftIndex.value].thumbnail) {
      const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
      draftList.value[currentDraftIndex.value].thumbnail = thumbnail
    }
  }, 100)
})

// 生命周期：页面卸载前保存当前草稿
onBeforeUnmount(() => {
  if (drawingBoardRef.value) {
    const currentData = drawingBoardRef.value.saveData()
    const thumbnail = drawingBoardRef.value.getThumbnail(240, 160)
    draftList.value[currentDraftIndex.value].objects = currentData.objects
    draftList.value[currentDraftIndex.value].history = currentData.history
    draftList.value[currentDraftIndex.value].historyIndex = currentData.historyIndex
    draftList.value[currentDraftIndex.value].thumbnail = thumbnail
    draftList.value[currentDraftIndex.value].updatedAt = Date.now()
  }
})
</script>

<style lang="scss" scoped>
.drawing-board-view {
  width: 100%;
  height: 100vh;
  display: flex;
  background: #ffffff;
  overflow: hidden;
}

// 草稿面板容器
.draft-panel-container {
  width: 140px;
  height: 100%;
  border-right: 1px solid #e0e0e0;
  flex-shrink: 0;
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
      width: 100%;
      height: auto;
      aspect-ratio: 1 / 1;
      object-fit: contain;
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

// 绘图板容器
.drawing-board-container {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 头部控制按钮
.header-controls {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 100;
  display: flex;
  gap: 8px;
}

.toggle-panel-btn {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  &:hover {
    background: rgba(255, 255, 255, 1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

// 清除所有会话确认弹窗内容样式
.delete-confirm-content {
  height: 100%;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
  border: none;
}

</style>
