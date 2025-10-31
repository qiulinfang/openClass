<template>
  <q-card
    v-if="visible"
    class="debug-panel q-pa-md"
    flat
    bordered
  >
    <q-card-section class="q-pa-none">
      <div class="row items-center q-mb-md">
        <div class="text-h6 q-mr-sm">🔧 虚拟滚动调试面板</div>
        <q-space />
        <q-btn
          icon="close"
          flat
          round
          dense
          size="sm"
          @click="handleClose"
        />
      </div>

      <!-- 参数调整区域 -->
      <div class="debug-section q-mb-md">
        <div class="text-subtitle2 q-mb-sm">参数调整</div>
        
        <!-- 缓冲区 (overscan) -->
        <div class="q-mb-md">
          <div class="row items-center q-mb-xs">
            <span class="col">缓冲区 (overscan):</span>
            <span class="text-weight-bold text-primary">{{ localOverscan }}</span>
          </div>
          <q-slider
            v-model="localOverscan"
            :min="1"
            :max="20"
            :step="1"
            label
            label-text-color="primary"
            color="primary"
            @update:model-value="handleOverscanChange"
          />
          <div class="text-caption text-grey-7 q-mt-xs">
            控制上下额外渲染的项目数，值越大滚动越流畅但性能越低
          </div>
        </div>

        <!-- 估算高度 (estimatedItemHeight) -->
        <div class="q-mb-md">
          <div class="row items-center q-mb-xs">
            <span class="col">估算高度 (estimatedItemHeight):</span>
            <span class="text-weight-bold text-primary">{{ localEstimatedHeight }}px</span>
          </div>
          <q-slider
            v-model="localEstimatedHeight"
            :min="50"
            :max="500"
            :step="10"
            label
            label-text-color="primary"
            color="primary"
            @update:model-value="handleEstimatedHeightChange"
          />
          <div class="text-caption text-grey-7 q-mt-xs">
            估算的单个题目高度，用于计算可见范围
          </div>
        </div>
      </div>

      <q-separator class="q-mb-md" />

      <!-- 实时信息显示 -->
      <div class="debug-section q-mb-md">
        <div class="text-subtitle2 q-mb-sm">实时信息</div>
        
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">渲染数量:</span>
            <span class="info-value">{{ renderInfo.renderCount }} / {{ renderInfo.totalCount }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">渲染范围:</span>
            <span class="info-value">{{ renderInfo.start }} - {{ renderInfo.end }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">滚动位置:</span>
            <span class="info-value">{{ Math.round(scrollTop) }}px</span>
          </div>
          <div class="info-item">
            <span class="info-label">容器高度:</span>
            <span class="info-value">{{ Math.round(containerHeight) }}px</span>
          </div>
          <div class="info-item">
            <span class="info-label">滚动速度:</span>
            <span class="info-value">{{ scrollSpeed.toFixed(2) }} px/ms</span>
          </div>
          <div class="info-item">
            <span class="info-label">已缓存高度:</span>
            <span class="info-value">{{ cachedHeightCount }} 项</span>
          </div>
        </div>
      </div>

      <q-separator class="q-mb-md" />

      <!-- 操作按钮 -->
      <div class="debug-section">
        <div class="text-subtitle2 q-mb-sm">操作</div>
        <div class="row q-gutter-sm">
          <q-btn
            color="primary"
            outline
            icon="refresh"
            label="重置参数"
            @click="handleReset"
            size="sm"
          />
          <q-btn
            color="secondary"
            outline
            icon="file_download"
            label="导出配置"
            @click="handleExport"
            size="sm"
          />
          <q-btn
            color="secondary"
            outline
            icon="file_upload"
            label="导入配置"
            @click="handleImport"
            size="sm"
          />
          <q-btn
            color="info"
            outline
            icon="clear_all"
            label="清空高度缓存"
            @click="handleClearCache"
            size="sm"
          />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'

interface Props {
  visible: boolean
  overscan: number
  estimatedItemHeight: number
  renderInfo: {
    renderCount: number
    totalCount: number
    start: number
    end: number
    overscan: number
  }
  scrollTop: number
  containerHeight: number
  scrollSpeed: number
  cachedHeightCount: number
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'update:overscan', value: number): void
  (e: 'update:estimatedItemHeight', value: number): void
  (e: 'reset'): void
  (e: 'export'): void
  (e: 'import'): void
  (e: 'clearCache'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const $q = useQuasar()

const localOverscan = ref(props.overscan)
const localEstimatedHeight = ref(props.estimatedItemHeight)

// 同步外部传入的值
watch(() => props.overscan, (val) => {
  localOverscan.value = val
})

watch(() => props.estimatedItemHeight, (val) => {
  localEstimatedHeight.value = val
})

const handleClose = () => {
  emit('update:visible', false)
}

const handleOverscanChange = (val: number | null) => {
  const value = val ?? 6
  localOverscan.value = value
  emit('update:overscan', value)
}

const handleEstimatedHeightChange = (val: number | null) => {
  const value = val ?? 150
  localEstimatedHeight.value = value
  emit('update:estimatedItemHeight', value)
}

const handleReset = () => {
  emit('reset')
}

const handleExport = () => {
  emit('export')
}

const handleImport = () => {
  emit('import')
}

const handleClearCache = () => {
  emit('clearCache')
}
</script>

<style lang="scss" scoped>
.debug-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 400px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  z-index: 2000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  animation: gemini-dialog-enter 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);

  .debug-section {
    .text-subtitle2 {
      font-weight: 500;
      color: #202124;
      margin-bottom: 12px;
    }
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;

    .info-item {
      padding: 8px 12px;
      background: rgba(26, 115, 232, 0.05);
      border-radius: 8px;
      border: 1px solid rgba(26, 115, 232, 0.1);

      .info-label {
        display: block;
        font-size: 12px;
        color: #5f6368;
        margin-bottom: 4px;
      }

      .info-value {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: #1a73e8;
        font-family: 'Courier New', monospace;
      }
    }
  }
}
</style>

