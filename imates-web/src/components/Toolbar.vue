<template>
  <div class="toolbar-container">
    <!-- 顶部工具栏 -->
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn flat round dense icon="arrow_back" @click="goBack" />
        <q-toolbar-title>{{ textbookName || 'PDF查看器' }}</q-toolbar-title>
        
        <!-- 页面导航 -->
        <div class="page-navigation">
          <q-btn 
            flat 
            round 
            dense 
            icon="chevron_left" 
            :disable="!canGoToPreviousPage"
            @click="goToPreviousPage"
          />
          <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          <q-btn 
            flat 
            round 
            dense 
            icon="chevron_right" 
            :disable="!canGoToNextPage"
            @click="goToNextPage"
          />
        </div>
        
        <!-- 缩放控制 -->
        <div class="scale-control">
          <q-btn flat round dense icon="remove" @click="zoomOut" />
          <span class="scale-info">{{ scalePercentage }}%</span>
          <q-btn flat round dense icon="add" @click="zoomIn" />
        </div>
      </q-toolbar>
    </q-header>
    <!-- 功能工具栏 -->
    <q-header class="bg-grey-2">
      <q-toolbar class="toolbar-compact">
        <!-- 工具选择 -->
        <div class="tool-section">
          <span class="section-label">工具:</span>
          <q-btn-toggle
            v-model="selectedTool"
            :options="toolOptions"
            color="primary"
            text-color="white"
            toggle-color="primary"
            size="sm"
          />
        </div>
        
        <!-- 工具配置 -->
        <div v-if="selectedTool === 'highlighter'" class="tool-section">
          <span class="section-label">颜色:</span>
          <div class="color-options">
            <q-btn
              v-for="color in highlighterColors"
              :key="color.value"
              :color="color.value"
              :class="{ 'selected-color': drawingConfig.highlighterColor === color.value }"
              size="sm"
              round
              @click="updateDrawingConfig({ highlighterColor: color.value })"
            />
          </div>
          <span class="section-label">粗细:</span>
          <q-slider
            v-model="drawingConfig.highlighterWidth"
            :min="5"
            :max="30"
            :step="1"
            color="primary"
            style="width: 100px"
          />
        </div>
        
        <div v-if="selectedTool === 'pen'" class="tool-section">
          <span class="section-label">颜色:</span>
          <div class="color-options">
            <q-btn
              v-for="color in penColors"
              :key="color.value"
              :color="color.value"
              :class="{ 'selected-color': drawingConfig.penColor === color.value }"
              size="sm"
              round
              @click="updateDrawingConfig({ penColor: color.value })"
            />
          </div>
          <span class="section-label">粗细:</span>
          <q-slider
            v-model="drawingConfig.penWidth"
            :min="1"
            :max="10"
            :step="1"
            color="primary"
            style="width: 100px"
          />
        </div>
        
        <div v-if="selectedTool === 'text'" class="tool-section">
          <span class="section-label">颜色:</span>
          <div class="color-options">
            <q-btn
              v-for="color in textColors"
              :key="color.value"
              :color="color.value"
              :class="{ 'selected-color': drawingConfig.textColor === color.value }"
              size="sm"
              round
              @click="updateDrawingConfig({ textColor: color.value })"
            />
          </div>
          <span class="section-label">大小:</span>
          <q-select
            v-model="drawingConfig.textSize"
            :options="textSizes"
            dense
            style="width: 80px"
          />
        </div>
        
        <div v-if="['rectangle', 'circle', 'line', 'arrow'].includes(selectedTool)" class="tool-section">
          <span class="section-label">颜色:</span>
          <div class="color-options">
            <q-btn
              v-for="color in shapeColors"
              :key="color.value"
              :color="color.value"
              :class="{ 'selected-color': drawingConfig.shapeColor === color.value }"
              size="sm"
              round
              @click="updateDrawingConfig({ shapeColor: color.value })"
            />
          </div>
          <span class="section-label">粗细:</span>
          <q-select
            v-model="drawingConfig.shapeStrokeWidth"
            :options="shapeStrokeWidths"
            dense
            style="width: 80px"
          />
        </div>
        
        <div v-if="selectedTool === 'eraser'" class="tool-section">
          <span class="section-label">模式:</span>
          <q-btn-toggle
            v-model="drawingConfig.eraserMode"
            :options="eraserModeOptions"
            color="grey"
            text-color="white"
            toggle-color="grey"
            size="sm"
          />
          <span class="section-label">大小:</span>
          <q-slider
            v-model="drawingConfig.eraserSize"
            :min="10"
            :max="50"
            :step="5"
            color="grey"
            style="width: 100px"
          />
        </div>
        
        <!-- 操作按钮 -->
        <div class="tool-section">
          <q-btn
            color="negative"
            size="sm"
            icon="clear"
            label="清除页面"
            @click="clearCurrentPage"
          />
          <q-btn
            v-if="hasNotes"
            color="positive"
            size="sm"
            icon="download"
            label="导出笔记"
            @click="exportNotes"
          />
          <q-btn
            v-if="isDocLoaded"
            color="primary"
            size="sm"
            icon="save"
            label="保存项目"
            @click="saveProject"
          />
        </div>
      </q-toolbar>
    </q-header>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'

// 使用 Store
const store = usePdfViewerStore()
const router = useRouter()

// 计算属性
const currentPage = computed(() => store.currentPage)
const totalPages = computed(() => store.totalPages)
const scale = computed(() => store.scale)
const scalePercentage = computed(() => store.scalePercentage)
const selectedTool = computed({
  get: () => store.selectedTool,
  set: (value) => store.setSelectedTool(value)
})
const drawingConfig = computed(() => store.drawingConfig)
const canGoToPreviousPage = computed(() => store.canGoToPreviousPage)
const canGoToNextPage = computed(() => store.canGoToNextPage)
const hasNotes = computed(() => store.hasNotes)
const isDocLoaded = computed(() => store.isDocLoaded)

// 工具选项
const toolOptions = computed(() => store.toolOptions)
const highlighterColors = computed(() => store.highlighterColors)
const penColors = computed(() => store.penColors)
const textColors = computed(() => store.textColors)
const shapeColors = computed(() => store.shapeColors)
const textSizes = computed(() => store.textSizes)
const shapeStrokeWidths = computed(() => store.shapeStrokeWidths)
const eraserModeOptions = computed(() => store.eraserModeOptions)

// 获取教材名称（从路由参数）
const textbookName = computed(() => {
  // 这里可以从路由参数或 store 中获取
  return 'PDF查看器'
})

// 方法
const goBack = () => {
  router.back()
}

const goToPreviousPage = () => {
  if (canGoToPreviousPage.value) {
    store.setCurrentPage(currentPage.value - 1)
  }
}

const goToNextPage = () => {
  if (canGoToNextPage.value) {
    store.setCurrentPage(currentPage.value + 1)
  }
}

const zoomIn = () => {
  store.setScale(scale.value + 0.1)
}

const zoomOut = () => {
  store.setScale(scale.value - 0.1)
}

const updateDrawingConfig = (config: Partial<typeof store.drawingConfig>) => {
  store.updateDrawingConfig(config)
}

const clearCurrentPage = () => {
  const pageId = `page-${currentPage.value}`
  store.clearPageNotes(pageId)
  store.updateAnnotations(currentPage.value, [])
}

const exportNotes = () => {
  store.exportNotes()
}

const saveProject = async () => {
  try {
    await store.saveProject()
  } catch (error) {
    console.error('保存项目失败:', error)
  }
}
</script>

<style scoped>
.toolbar-container {
  width: 100%;
}

.page-navigation {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-info {
  font-size: 14px;
  font-weight: 500;
  min-width: 60px;
  text-align: center;
}

.scale-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scale-info {
  font-size: 14px;
  font-weight: 500;
  min-width: 50px;
  text-align: center;
}

.toolbar-compact {
  min-height: 48px;
}

.tool-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 16px;
}

.section-label {
  font-size: 12px;
  font-weight: 500;
  color: #666;
  white-space: nowrap;
}

.color-options {
  display: flex;
  gap: 4px;
}

.selected-color {
  border: 2px solid #1976D2 !important;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .tool-section {
    margin-right: 8px;
  }
  
  .section-label {
    font-size: 11px;
  }
  
  .page-info,
  .scale-info {
    font-size: 12px;
  }
}
</style>
