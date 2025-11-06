<template>
  <div 
    v-if="isVisible" 
    class="pdf-debug-panel"
    :class="{ 'panel-collapsed': isCollapsed }"
  >
    <!-- 面板头部 -->
    <div class="panel-header" @click="toggleCollapse">
      <div class="header-title">
        <q-icon name="bug_report" size="sm" />
        <span>PDF调试面板</span>
      </div>
      <div class="header-actions">
        <q-btn 
          flat 
          dense 
          round 
          size="sm" 
          :icon="isCollapsed ? 'expand_more' : 'expand_less'"
          @click.stop="toggleCollapse"
        />
        <q-btn 
          flat 
          dense 
          round 
          size="sm" 
          icon="close"
          @click.stop="handleClose"
        />
      </div>
    </div>

    <!-- 面板内容 -->
    <div v-if="!isCollapsed" class="panel-content">
      <!-- 缩放控制 -->
      <div class="section">
        <div class="section-title">缩放控制</div>
        <div class="section-content">
          <!-- 缩放滑块 -->
          <div class="control-item">
            <label>缩放比例: {{ scalePercentage }}%</label>
            <q-slider
              v-model="scalePercentage"
              :min="50"
              :max="300"
              :step="1"
              label
              @update:model-value="handleScaleChange"
            />
          </div>
          
          <!-- 缩放百分比输入 -->
          <div class="control-item">
            <label>缩放百分比</label>
            <q-input
              v-model.number="scalePercentage"
              type="number"
              dense
              outlined
              :min="50"
              :max="300"
              suffix="%"
              @update:model-value="handleScaleChange"
            />
          </div>
          
          <!-- 快速缩放按钮 -->
          <div class="control-item">
            <label>快速缩放</label>
            <div class="button-group">
              <q-btn
                v-for="preset in scalePresets"
                :key="preset.value"
                size="sm"
                :label="preset.label"
                @click="handleQuickScale(preset.value)"
                :color="currentScale === preset.value ? 'primary' : 'grey-7'"
                outline
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 布局参数 -->
      <div class="section">
        <div class="section-title">布局参数</div>
        <div class="section-content">
          <!-- 页面间距 -->
          <div class="control-item">
            <label>页面间距 (px)</label>
            <q-input
              v-model.number="pageGap"
              type="number"
              dense
              outlined
              :min="0"
              :max="100"
              suffix="px"
              @blur="handlePageGapChange"
              @keyup.enter="handlePageGapChange"
            />
          </div>
          
          <!-- 重新计算布局按钮 -->
          <div class="control-item">
            <q-btn
              color="primary"
              size="sm"
              label="重新计算布局"
              @click="handleRecalculateLayout"
              :loading="isRecalculating"
            />
          </div>
          
          <!-- 当前页面布局信息 -->
          <div class="control-item">
            <label>当前页面布局</label>
            <div class="info-display">
              <div class="info-row">
                <span class="info-label">页码:</span>
                <span class="info-value">{{ currentPageInfo?.pageNum || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">顶部位置:</span>
                <span class="info-value">{{ currentPageInfo?.top?.toFixed(2) || '-' }}px</span>
              </div>
              <div class="info-row">
                <span class="info-label">宽度:</span>
                <span class="info-value">{{ currentPageInfo?.width?.toFixed(2) || '-' }}px</span>
              </div>
              <div class="info-row">
                <span class="info-label">高度:</span>
                <span class="info-value">{{ currentPageInfo?.height?.toFixed(2) || '-' }}px</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 渲染信息 -->
      <div class="section">
        <div class="section-title">渲染信息</div>
        <div class="section-content">
          <div class="info-display">
            <div class="info-row">
              <span class="info-label">设备像素比:</span>
              <span class="info-value">{{ devicePixelRatio }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Viewport宽度:</span>
              <span class="info-value">{{ viewportInfo.width?.toFixed(2) || '-' }}px</span>
            </div>
            <div class="info-row">
              <span class="info-label">Viewport高度:</span>
              <span class="info-value">{{ viewportInfo.height?.toFixed(2) || '-' }}px</span>
            </div>
            <div class="info-row">
              <span class="info-label">Canvas实际宽度:</span>
              <span class="info-value">{{ canvasActualWidth?.toFixed(2) || '-' }}px</span>
            </div>
            <div class="info-row">
              <span class="info-label">Canvas实际高度:</span>
              <span class="info-value">{{ canvasActualHeight?.toFixed(2) || '-' }}px</span>
            </div>
            <div class="info-row">
              <span class="info-label">Canvas显示宽度:</span>
              <span class="info-value">{{ canvasDisplayWidth?.toFixed(2) || '-' }}px</span>
            </div>
            <div class="info-row">
              <span class="info-label">Canvas显示高度:</span>
              <span class="info-value">{{ canvasDisplayHeight?.toFixed(2) || '-' }}px</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 页面信息 -->
      <div class="section">
        <div class="section-title">页面信息</div>
        <div class="section-content">
          <div class="info-display">
            <div class="info-row">
              <span class="info-label">当前页码:</span>
              <span class="info-value">{{ store.currentPage }} / {{ store.totalPages }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">总页数:</span>
              <span class="info-value">{{ store.totalPages }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">文档已加载:</span>
              <span class="info-value">{{ store.isDocLoaded ? '是' : '否' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import { toRaw } from 'vue'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const store = usePdfViewerStore()
const pdfCoreService = new PdfCoreService()

// 面板状态
const isCollapsed = ref(false)
const isVisible = computed(() => props.modelValue)
const isRecalculating = ref(false)

// 缩放相关
const scalePercentage = ref(100)
const scalePresets = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '100%', value: 1.0 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2.0 },
]

// 布局相关
const pageGap = computed({
  get: () => store.pageGap,
  set: (value) => {
    store.pageGap = value
  }
})

// 设备像素比
const devicePixelRatio = computed(() => window.devicePixelRatio || 1)

// 当前页面布局信息
const currentPageInfo = computed(() => {
  return store.pageLayouts.find(p => p.pageNum === store.currentPage)
})

// 当前缩放值
const currentScale = computed(() => store.scale)

// Viewport信息
const viewportInfo = ref({ width: 0, height: 0 })
const canvasActualWidth = ref(0)
const canvasActualHeight = ref(0)
const canvasDisplayWidth = ref(0)
const canvasDisplayHeight = ref(0)

// 更新viewport信息
const updateViewportInfo = async () => {
  if (!store.pdfDoc || !store.currentPage) {
    viewportInfo.value = { width: 0, height: 0 }
    canvasActualWidth.value = 0
    canvasActualHeight.value = 0
    canvasDisplayWidth.value = 0
    canvasDisplayHeight.value = 0
    return
  }

  try {
    const rawPdfDoc = toRaw(store.pdfDoc)
    const page = await rawPdfDoc.getPage(store.currentPage)
    const rawPage = toRaw(page)
    const viewport = rawPage.getViewport({ scale: store.scale })
    
    const dpr = devicePixelRatio.value
    
    viewportInfo.value = {
      width: viewport.width,
      height: viewport.height
    }
    
    canvasActualWidth.value = viewport.width * dpr
    canvasActualHeight.value = viewport.height * dpr
    canvasDisplayWidth.value = viewport.width
    canvasDisplayHeight.value = viewport.height
  } catch (error) {
    console.error('更新viewport信息失败:', error)
  }
}

// 监听缩放变化
watch(() => store.scale, (newScale) => {
  scalePercentage.value = Math.round(newScale * 100)
  updateViewportInfo()
}, { immediate: true })

// 监听当前页面变化
watch(() => store.currentPage, () => {
  updateViewportInfo()
})

// 监听布局变化
watch(() => store.pageLayouts, () => {
  updateViewportInfo()
}, { deep: true })

// 初始化viewport信息
onMounted(() => {
  updateViewportInfo()
  // 定期更新（以防其他地方修改了viewport）
  const interval = setInterval(updateViewportInfo, 1000)
  onUnmounted(() => clearInterval(interval))
})

// 处理缩放变化
const handleScaleChange = (percentage: number) => {
  const newScale = percentage / 100
  store.setScale(newScale)
  // scale变化会触发watch，自动重新计算布局（在PdfViewerView中）
}

// 处理快速缩放
const handleQuickScale = (scale: number) => {
  store.setScale(scale)
  scalePercentage.value = Math.round(scale * 100)
}

// 处理页面间距变化
const handlePageGapChange = async () => {
  // 页面间距变化后，需要重新计算布局
  if (!store.pdfDoc) {
    console.warn('PDF文档未加载')
    return
  }

  try {
    isRecalculating.value = true
    const layouts = await pdfCoreService.calculatePageLayouts(store.scale, store.pageGap)
    store.pageLayouts = layouts
    console.log('页面间距调整完成，布局重新计算:', { pageGap: store.pageGap, layouts })
  } catch (error) {
    console.error('页面间距调整失败:', error)
  } finally {
    isRecalculating.value = false
  }
}

// 重新计算布局
const handleRecalculateLayout = async () => {
  if (!store.pdfDoc) {
    console.warn('PDF文档未加载')
    return
  }

  try {
    isRecalculating.value = true
    const layouts = await pdfCoreService.calculatePageLayouts(store.scale, store.pageGap)
    store.pageLayouts = layouts
    console.log('布局重新计算完成:', layouts)
  } catch (error) {
    console.error('重新计算布局失败:', error)
  } finally {
    isRecalculating.value = false
  }
}

// 切换折叠
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

// 关闭面板
const handleClose = () => {
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
.pdf-debug-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 350px;
  max-height: calc(100vh - 100px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(10px);

  &.panel-collapsed {
    .panel-content {
      display: none;
    }
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: #eeeeee;
  }
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.section {
  margin-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 12px;

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }
}

.section-title {
  font-weight: 600;
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }
}

.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.info-display {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #f9f9f9;
  padding: 12px;
  border-radius: 4px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.info-label {
  color: #666;
  font-weight: 500;
}

.info-value {
  color: #333;
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

// 滚动条样式
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;

  &:hover {
    background: #555;
  }
}
</style>

