<template>
  <div class="drawing-board-view">
    <!-- 主内容：绘图板 -->
    <div class="drawing-board-container">
      <DrawingBoardNew
        ref="drawingBoardRef"
        :drawing-board-tools="drawingBoardTools"
        @clear="handleClearRequest"
        :showGrid="true"
      />
    </div>

    <!-- 清空画布确认对话框 -->
    <Dialog
      ref="clearDialogRef"
      title="清空确认"
      :confirmButtonText="'清空'"
      :cancelButtonText="'取消'"
      @confirm="confirmClearCanvas"
    >
      确定要清空画布吗？此操作不可撤销。
    </Dialog>
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
import Dialog from '@/components/base/Dialog.vue'
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

// ==================== 响应式数据 ====================
const drawingBoardRef = ref<InstanceType<typeof DrawingBoardNew> | null>(null)

// 清空画布确认对话框
const clearDialogRef = ref<InstanceType<typeof Dialog>>()

// ==================== 方法 ====================

// 清空画布确认对话框处理
const handleClearRequest = () => {
  clearDialogRef.value?.openDialog()
}

const confirmClearCanvas = () => {
  if (drawingBoardRef.value) {
    // 清空画布数据
    drawingBoardRef.value.loadData({
      objects: [],
      history: [[]],
      historyIndex: 0,
    })
  }
  clearDialogRef.value?.closeDialog()
}

const cancelClearCanvas = () => {
  clearDialogRef.value?.closeDialog()
}

</script>

<style lang="scss" scoped>
.drawing-board-view {
  width: 100%;
  height: 100%;
  background: #ffffff;
  overflow: hidden;
}


// 绘图板容器
.drawing-board-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
