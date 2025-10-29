<template>
  <div class="debug-panel" v-if="isVisible">
    <div class="debug-header">
      <h3>IndexedDB 调试面板</h3>
      <div class="debug-controls">
        <button @click="refreshData" :disabled="isLoading" class="btn-refresh">
          {{ isLoading ? '刷新中...' : '刷新数据' }}
        </button>
        <button @click="exportData" class="btn-export">导出数据</button>
        <button @click="clearAllData" class="btn-clear">清空数据</button>
        <button @click="toggleAutoRefresh" class="btn-auto">
          {{ autoRefresh ? '停止自动刷新' : '开启自动刷新' }}
        </button>
        <button @click="closePanel" class="btn-close">关闭</button>
      </div>
    </div>

    <div class="debug-content">
      <!-- 统计信息 -->
      <div class="stats-section">
        <h4>数据统计</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">教材总数:</span>
            <span class="stat-value">{{ stats.totalTextbooks }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">已下载教材:</span>
            <span class="stat-value">{{ stats.downloadedTextbooks }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总文件数:</span>
            <span class="stat-value">{{ stats.totalFiles }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">已下载文件:</span>
            <span class="stat-value">{{ stats.downloadedFiles }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">存储大小:</span>
            <span class="stat-value">{{ formatBytes(stats.storageSize) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">最后更新:</span>
            <span class="stat-value">{{ stats.lastUpdate }}</span>
          </div>
        </div>
      </div>

      <!-- 教材列表 -->
      <div class="textbooks-section">
        <h4>教材详情</h4>
        <div class="textbooks-list">
          <div 
            v-for="textbook in textbooks" 
            :key="textbook.textbookId"
            class="textbook-item"
            :class="{ 'expanded': expandedTextbooks.includes(textbook.textbookId) }"
          >
            <div class="textbook-header" @click="toggleTextbook(textbook.textbookId)">
              <div class="textbook-info">
                <span class="textbook-name">{{ textbook.textbookName }}</span>
                <span class="textbook-id">ID: {{ textbook.textbookId }}</span>
              </div>
              <div class="textbook-stats">
                <span class="download-progress">
                  {{ textbook.downloadedFiles || 0 }}/{{ textbook.totalFiles || 0 }}
                </span>
                <span class="download-status" :class="getDownloadStatusClass(textbook)">
                  {{ getDownloadStatus(textbook) }}
                </span>
              </div>
              <div class="expand-icon">
                {{ expandedTextbooks.includes(textbook.textbookId) ? '▼' : '▶' }}
              </div>
            </div>
            
            <div v-if="expandedTextbooks.includes(textbook.textbookId)" class="textbook-details">
              <div class="detail-section">
                <h5>基本信息</h5>
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="detail-label">教材名称:</span>
                    <span class="detail-value">{{ textbook.textbookName }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">教材ID:</span>
                    <span class="detail-value">{{ textbook.textbookId }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">版本:</span>
                    <span class="detail-value">{{ textbook.textbookEditionYear }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">年级:</span>
                    <span class="detail-value">{{ textbook.textbookGradeLabel }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">学科:</span>
                    <span class="detail-value">{{ textbook.textbookSubjectLabel }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">出版社:</span>
                    <span class="detail-value">{{ textbook.textbookPublisher }}</span>
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <h5>下载信息</h5>
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="detail-label">已下载文件:</span>
                    <span class="detail-value">{{ textbook.downloadedFiles || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">总文件数:</span>
                    <span class="detail-value">{{ textbook.totalFiles || 0 }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">下载进度:</span>
                    <span class="detail-value">{{ getDownloadProgress(textbook) }}%</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">最后下载时间:</span>
                    <span class="detail-value">{{ textbook.lastDownloadTime || '未下载' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">有更新可用:</span>
                    <span class="detail-value">{{ textbook.hasUpdatesAvailable ? '是' : '否' }}</span>
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <h5>文件数据</h5>
                <div class="files-info">
                  <div class="files-summary">
                    <span>存储的文件数量: {{ getFileCount(textbook) }}</span>
                    <span>文件大小: {{ formatBytes(getFileSize(textbook)) }}</span>
                  </div>
                  <div class="files-list">
                    <div 
                      v-for="file in textbook.localFiles" 
                      :key="file.id"
                      class="file-item"
                    >
                      <span class="file-name">{{ file.fileName }}</span>
                      <span class="file-size">{{ formatBytes(file.fileSize) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <h5>操作</h5>
                <div class="action-buttons">
                  <button @click="deleteTextbook(textbook.textbookId)" class="btn-delete">
                    删除教材
                  </button>
                  <button @click="clearTextbookFiles(textbook.textbookId)" class="btn-clear-files">
                    清空文件
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 原始数据 -->
      <div class="raw-data-section">
        <h4>原始数据 (JSON)</h4>
        <div class="raw-data-controls">
          <button @click="toggleRawData" class="btn-toggle">
            {{ showRawData ? '隐藏' : '显示' }}原始数据
          </button>
        </div>
        <div v-if="showRawData" class="raw-data-content">
          <pre>{{ JSON.stringify(textbooks, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { resourceManager } from '../services/resource-manager'
import type { UserTextbookInfo } from '@/types/textbook'

interface Props {
  visible?: boolean
}

interface Stats {
  totalTextbooks: number
  downloadedTextbooks: number
  totalFiles: number
  downloadedFiles: number
  storageSize: number
  lastUpdate: string
}

const props = withDefaults(defineProps<Props>(), {
  visible: false
})

const emit = defineEmits<{
  close: []
}>()


// 响应式数据
const isVisible = ref(props.visible)
const isLoading = ref(false)
const textbooks = ref<UserTextbookInfo[]>([])
const expandedTextbooks = ref<string[]>([])
const showRawData = ref(false)
const autoRefresh = ref(false)
const refreshInterval = ref<number | null>(null)

// 计算属性
const stats = computed<Stats>(() => {
  const totalTextbooks = textbooks.value.length
  const downloadedTextbooks = textbooks.value.filter(t => (t.downloadedFiles || 0) > 0).length
  const totalFiles = textbooks.value.reduce((sum, t) => sum + (t.totalFiles || 0), 0)
  const downloadedFiles = textbooks.value.reduce((sum, t) => sum + (t.downloadedFiles || 0), 0)
  const storageSize = textbooks.value.reduce((sum, t) => sum + getFileSize(t), 0)
  const lastUpdate = new Date().toLocaleString()

  return {
    totalTextbooks,
    downloadedTextbooks,
    totalFiles,
    downloadedFiles,
    storageSize,
    lastUpdate
  }
})

// 方法
const refreshData = async () => {
  isLoading.value = true
  try {
    textbooks.value = await resourceManager.getUserLocalTextbooks()
    console.log('调试面板数据已刷新:', textbooks.value)
  } catch (error) {
    console.error('刷新数据失败:', error)
  } finally {
    isLoading.value = false
  }
}

const toggleTextbook = (textbookId: string) => {
  const index = expandedTextbooks.value.indexOf(textbookId)
  if (index > -1) {
    expandedTextbooks.value.splice(index, 1)
  } else {
    expandedTextbooks.value.push(textbookId)
  }
}

const toggleRawData = () => {
  showRawData.value = !showRawData.value
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    refreshInterval.value = setInterval(refreshData, 2000) // 每2秒刷新一次
  } else {
    if (refreshInterval.value) {
      clearInterval(refreshInterval.value)
      refreshInterval.value = null
    }
  }
}

const closePanel = () => {
  isVisible.value = false
  emit('close')
}

const exportData = () => {
  const data = {
    timestamp: new Date().toISOString(),
    stats: stats.value,
    textbooks: textbooks.value
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `indexeddb-debug-${new Date().getTime()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const clearAllData = async () => {
  try {
    // 清空所有存储的数据
    await resourceManager.indexedDB.clear('textbooks')
    await resourceManager.indexedDB.clear('files')
    await refreshData()
    console.log('所有数据已清空')
  } catch (error) {
    console.error('清空数据失败:', error)
  }
}

const deleteTextbook = async (textbookId: string) => {
  try {
    // 删除教材数据
    await resourceManager.indexedDB.delete('textbooks', textbookId)
    await refreshData()
    console.log('教材已删除:', textbookId)
  } catch (error) {
    console.error('删除教材失败:', error)
  }
}

const clearTextbookFiles = async (textbookId: string) => {
  try {
    const textbook = textbooks.value.find(t => t.textbookId === textbookId)
    if (textbook) {
      await resourceManager.updateTextbookInfo(textbook, {
        fileData: {},
        downloadedFiles: 0
      })
      await refreshData()
      console.log('教材文件已清空:', textbookId)
    }
  } catch (error) {
    console.error('清空教材文件失败:', error)
  }
}

// 工具方法
const getDownloadStatus = (textbook: UserTextbookInfo): string => {
  const downloaded = textbook.downloadedFiles || 0
  const total = textbook.totalFiles || 0
  
  if (downloaded === 0) return '未下载'
  if (downloaded === total) return '已完成'
  return '下载中'
}

const getDownloadStatusClass = (textbook: UserTextbookInfo): string => {
  const status = getDownloadStatus(textbook)
  switch (status) {
    case '未下载': return 'status-not-downloaded'
    case '已完成': return 'status-completed'
    case '下载中': return 'status-downloading'
    default: return ''
  }
}

const getDownloadProgress = (textbook: UserTextbookInfo): number => {
  const downloaded = textbook.downloadedFiles || 0
  const total = textbook.totalFiles || 0
  return total > 0 ? Math.round((downloaded / total) * 100) : 0
}

const getFileCount = (textbook: UserTextbookInfo): number => {
  return textbook.localFiles ? textbook.localFiles.length : 0
}

const getFileSize = (textbook: UserTextbookInfo): number => {
  if (!textbook.localFiles) return 0
  return textbook.localFiles.reduce((sum, file) => sum + file.fileSize, 0)
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 监听props变化
watch(() => props.visible, (newVal) => {
  isVisible.value = newVal
  if (newVal) {
    refreshData()
  }
})

// 生命周期
onMounted(() => {
  if (isVisible.value) {
    refreshData()
  }
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<style scoped>
.debug-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 80vw;
  height: 100vh;
  background: #1a1a1a;
  color: #ffffff;
  z-index: 9999;
  overflow-y: auto;
  border-left: 2px solid #333;
  font-family: 'Courier New', monospace;
}

.debug-header {
  background: #2a2a2a;
  padding: 16px;
  border-bottom: 1px solid #333;
  position: sticky;
  top: 0;
  z-index: 10;
}

.debug-header h3 {
  margin: 0 0 12px 0;
  color: #00ff00;
  font-size: 18px;
}

.debug-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.debug-controls button {
  padding: 6px 12px;
  border: 1px solid #555;
  background: #333;
  color: #fff;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.2s;
}

.debug-controls button:hover {
  background: #444;
  border-color: #666;
}

.debug-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-refresh {
  background: #0066cc !important;
}

.btn-export {
  background: #cc6600 !important;
}

.btn-clear {
  background: #cc0000 !important;
}

.btn-auto {
  background: #6600cc !important;
}

.btn-close {
  background: #666 !important;
}

.debug-content {
  padding: 16px;
}

.stats-section,
.textbooks-section,
.raw-data-section {
  margin-bottom: 24px;
  background: #2a2a2a;
  border-radius: 8px;
  padding: 16px;
}

.stats-section h4,
.textbooks-section h4,
.raw-data-section h4 {
  margin: 0 0 16px 0;
  color: #00ff00;
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: #333;
  border-radius: 4px;
}

.stat-label {
  color: #ccc;
}

.stat-value {
  color: #fff;
  font-weight: bold;
}

.textbooks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.textbook-item {
  background: #333;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;
}

.textbook-item:hover {
  background: #3a3a3a;
}

.textbook-header {
  display: flex;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid #444;
}

.textbook-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.textbook-name {
  font-weight: bold;
  color: #fff;
}

.textbook-id {
  font-size: 12px;
  color: #999;
}

.textbook-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  margin-right: 12px;
}

.download-progress {
  font-size: 14px;
  color: #00ff00;
}

.download-status {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
}

.status-not-downloaded {
  background: #666;
  color: #ccc;
}

.status-downloading {
  background: #ff6600;
  color: #fff;
}

.status-completed {
  background: #00cc00;
  color: #fff;
}

.expand-icon {
  color: #999;
  font-size: 12px;
}

.textbook-details {
  padding: 16px;
  background: #2a2a2a;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section h5 {
  margin: 0 0 8px 0;
  color: #00ff00;
  font-size: 14px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
  background: #333;
  border-radius: 4px;
}

.detail-label {
  color: #ccc;
  font-size: 12px;
}

.detail-value {
  color: #fff;
  font-size: 12px;
}

.files-info {
  background: #333;
  border-radius: 4px;
  padding: 12px;
}

.files-summary {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: #ccc;
}

.files-list {
  max-height: 200px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: #2a2a2a;
  margin-bottom: 2px;
  border-radius: 3px;
  font-size: 11px;
}

.file-name {
  color: #fff;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: #999;
  margin-left: 8px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-buttons button {
  padding: 6px 12px;
  border: 1px solid #555;
  background: #333;
  color: #fff;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
}

.btn-delete {
  background: #cc0000 !important;
}

.btn-clear-files {
  background: #cc6600 !important;
}

.raw-data-controls {
  margin-bottom: 12px;
}

.btn-toggle {
  padding: 6px 12px;
  border: 1px solid #555;
  background: #333;
  color: #fff;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
}

.raw-data-content {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.raw-data-content pre {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: #00ff00;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #2a2a2a;
}

::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #666;
}
</style>
