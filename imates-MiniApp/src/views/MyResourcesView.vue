<template>
  <view class="my-resources-view">
    <!-- 筛选区域 -->
    <view class="filter-section">
      <view class="filter-title">资源下载</view>

      <view class="filter-content">
        <!-- 年级 -->
        <view class="filter-dropdown-item">
          <text class="filter-label">年级:</text>
          <CommonSelect
            v-model="selectedGrade"
            :options="gradeOptions"
            class="filter-select"
            placeholder="全部"
            @change="handleFilterChange"
          />
        </view>

        <!-- 教材版本 -->
        <view class="filter-dropdown-item">
          <text class="filter-label">教材版本:</text>
          <CommonSelect
            v-model="selectedVersion"
            :options="versionOptions"
            class="filter-select"
            placeholder="全部"
            @change="handleFilterChange"
          />
        </view>

        <!-- 学科 -->
        <view class="filter-dropdown-item">
          <text class="filter-label">学科:</text>
          <CommonSelect
            v-model="selectedSubject"
            :options="subjectOptions"
            class="filter-select"
            placeholder="全部"
            @change="handleFilterChange"
          />
        </view>

        <!-- 下载状态 -->
        <view class="filter-dropdown-item">
          <text class="filter-label">下载状态:</text>
          <CommonSelect
            v-model="selectedStatus"
            :options="statusOptions"
            class="filter-select"
            placeholder="全部"
            @change="handleFilterChange"
          />
        </view>
      </view>
    </view>

    <!-- 列表区域 -->
    <RubberBandList
      ref="rubberBandListRef"
      v-if="textbooks.length > 0"
      :enable-refresh="true"
      @refresh="handlePullDownRefresh"
    >
      <view class="scroll-content">
        <view class="textbooks-container">
          <view class="textbooks-grid">
            <view
              v-for="textbook in filteredTextbooks"
              :key="textbook.id"
              class="textbook-card"
              :class="{
                downloading: textbook.downloadStatus === 1,
                paused: textbook.downloadStatus === 3,
              }"
            >
              <!-- 删除按钮 -->
              <view
                v-if="textbook.isDownloaded || textbook.downloadStatus !== 0 || textbook.downloadedFiles > 0"
                @click.stop="handleDeleteTextbook(textbook)"
                class="textbook-delete-btn"
              >
                <image src="/static/icons/close.svg" mode="aspectFit" class="delete-icon" />
              </view>

              <!-- 左侧：封面 -->
              <view class="textbook-cover">
                <image
                  :src="getCoverImageUrl(textbook.textbookCover)"
                  mode="aspectFill"
                  class="cover-image"
                />
              </view>

              <!-- 右侧：信息 -->
              <view class="textbook-content">
                <view class="textbook-info">
                  <view class="textbook-header">
                    <text class="textbook-title">{{ textbook.textbookName }}</text>
                    <view class="textbook-version-info">
                      <text>{{ textbook.textbookPublisher || '人教版' }}</text>
                      <text v-if="textbook.textbookSemesterLabel" class="textbook-semester">
                        {{ textbook.textbookSemesterLabel }}
                      </text>
                    </view>
                  </view>

                  <StatusTag
                    :text="getDownloadStatusText(textbook)"
                    :type="getDownloadStatusType(textbook)"
                    size="sm"
                    dot
                  />
                </view>

                <view class="textbook-actions">
                  <view class="action-buttons-group">
                    <template v-if="textbook.downloadStatus === 1">
                      <view
                        class="download-progress-bar"
                        @click="handlePauseDownload(textbook)"
                      >
                        <view class="progress-bar-container">
                          <view
                            class="progress-bar-fill"
                            :style="{
                              width: getDownloadProgress(textbook.downloadedFiles, textbook.totalFiles) + '%',
                            }"
                          ></view>
                          <text class="progress-text">
                            {{ getDownloadProgress(textbook.downloadedFiles, textbook.totalFiles) }}%
                          </text>
                        </view>
                      </view>
                    </template>

                    <template v-else-if="textbook.downloadStatus === 3">
                      <button
                        @click="downloadTextbook(textbook)"
                        class="action-btn action-btn-continue"
                      >
                        继续
                      </button>
                    </template>

                    <template
                      v-else-if="
                        textbook.isDownloaded &&
                        textbook.downloadStatus === 2 &&
                        !textbook.hasUpdatesAvailable
                      "
                    >
                      <button
                        @click="handleLearnTextbook(textbook)"
                        class="action-btn action-btn-learn"
                      >
                        学习
                      </button>
                    </template>

                    <template
                      v-else-if="
                        textbook.isDownloaded &&
                        textbook.downloadStatus === 2 &&
                        textbook.hasUpdatesAvailable
                      "
                    >
                      <button
                        @click="downloadTextbook(textbook, true)"
                        class="action-btn action-btn-update"
                      >
                        更新
                      </button>
                    </template>

                    <template v-else>
                      <button
                        @click="downloadTextbook(textbook)"
                        class="action-btn action-btn-download"
                      >
                        下载
                      </button>
                    </template>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </RubberBandList>

    <!-- 空状态 -->
    <view
      v-if="initialLoadCompleted && textbooks.length === 0"
      class="empty-state"
    >
      <image src="/static/icons/book.svg" mode="aspectFit" class="empty-icon" />
      <text class="empty-text">暂无教材数据</text>
      <text class="empty-subtext">请检查网络连接或重新登录</text>
      <button @click="loadResources()" class="reload-btn">
        <text>重新加载</text>
      </button>
    </view>

    <!-- 清除本地资料对话框 -->
    <Dialog
      ref="deleteDialogRef"
      title="清除本地资料"
      confirmButtonText="确认清除"
      cancelButtonText="取消"
      @confirm="confirmDeleteTextbook"
      @cancel="cancelDeleteTextbook"
    >
      <view class="delete-dialog-content">
        确定要清除《{{ deleteTextbookName }}》的本地下载资料吗？清除后，该教材的所有相关文件将从本地移除，需要重新下载后才能学习。
      </view>
    </Dialog>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import StatusTag from '../components/base/Tag.vue'
import CommonSelect from '../components/base/Select.vue'
import RubberBandList from '../components/base/VirtualScroll.vue'
import Dialog from '../components/base/Dialog.vue'
import { resourceManager } from '../services/storage/resource-storage.js'
import { apiService } from '../services/http/api-service.js'
import { httpClient } from '../services/http/http-client.js'
import { showMessage } from '../utils/index.js'
import { useResourceStore } from '../stores/resourceStore.js'
import { useKnowledgeGraphStore } from '../stores/KnowledgeGraphStore.js'
import { RESOURCE_SUBJECT_OPTIONS } from '../constants/subjects.js'
import {
  RESOURCE_GRADE_OPTIONS,
  RESOURCE_VERSION_OPTIONS,
  RESOURCE_DOWNLOAD_STATUS_OPTIONS,
} from '../constants/options.js'

const resourceStore = useResourceStore()
const { setCurrentSubject, setCurrentTextbook } = useKnowledgeGraphStore()

const rubberBandListRef = ref<InstanceType<typeof RubberBandList> | null>(null)
const loading = ref(false)
const textbooks = ref<any[]>([])
const initialLoadCompleted = ref(false)

const selectedGrade = ref('')
const selectedVersion = ref('')
const selectedSubject = ref('')
const selectedStatus = ref('')

const deleteDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
const deleteTextbookId = ref<string | null>(null)
const deleteTextbookName = ref('')

const gradeOptions = ref(RESOURCE_GRADE_OPTIONS)
const versionOptions = ref(RESOURCE_VERSION_OPTIONS)
const subjectOptions = ref(RESOURCE_SUBJECT_OPTIONS)
const statusOptions = ref(RESOURCE_DOWNLOAD_STATUS_OPTIONS)

const getDownloadStatusText = (textbook: any): string => {
  if (textbook.downloadStatus === 0) return '未下载'
  if (textbook.downloadStatus === 1) return '正在下载'
  if (textbook.hasUpdatesAvailable && textbook.downloadStatus === 2 && textbook.isDownloaded)
    return '有更新'
  if (textbook.downloadStatus === 2 && textbook.isDownloaded) return '下载完成'
  if (textbook.downloadStatus === 3) return '已暂停'
  return '未下载'
}

const getDownloadStatusType = (textbook: any): 'red' | 'blue' | 'green' | 'orange' | 'gray' => {
  if (textbook.downloadStatus === 0) return 'red'
  if (textbook.downloadStatus === 1) return 'blue'
  if (textbook.hasUpdatesAvailable && textbook.downloadStatus === 2 && textbook.isDownloaded)
    return 'orange'
  if (textbook.downloadStatus === 2 && textbook.isDownloaded) return 'green'
  if (textbook.downloadStatus === 3) return 'gray'
  return 'red'
}

const getStatusRank = (textbook: any): number => {
  if (textbook.isDownloaded && textbook.hasUpdatesAvailable) return 0
  if (!textbook.isDownloaded || textbook.downloadStatus === 0) return 1
  if (textbook.isDownloaded && textbook.downloadStatus === 2 && !textbook.hasUpdatesAvailable) return 2
  return 3
}

const filteredTextbooks = computed(() => {
  let result = textbooks.value.filter(t => t)

  if (selectedGrade.value) {
    result = result.filter(t => t.textbookGradeLabel === selectedGrade.value)
  }
  if (selectedVersion.value) {
    result = result.filter(t => t.textbookPublisher === selectedVersion.value)
  }
  if (selectedSubject.value) {
    result = result.filter(t => t.textbookSubjectLabel === selectedSubject.value)
  }
  if (selectedStatus.value) {
    if (selectedStatus.value === 'notDownloaded') {
      result = result.filter(t => !t.isDownloaded || t.downloadStatus === 0)
    } else if (selectedStatus.value === 'downloaded') {
      result = result.filter(t => t.isDownloaded && t.downloadStatus === 2 && !t.hasUpdatesAvailable)
    } else if (selectedStatus.value === 'pendingUpdate') {
      result = result.filter(t => t.isDownloaded && t.hasUpdatesAvailable)
    }
  }

  return result.sort((a, b) => {
    const rankA = getStatusRank(a)
    const rankB = getStatusRank(b)
    if (rankA !== rankB) return rankA - rankB
    
    return (a.textbookSubjectLabel || '').localeCompare(b.textbookSubjectLabel || '') ||
           (a.textbookGradeLabel || '').localeCompare(b.textbookGradeLabel || '') ||
           (a.textbookName || '').localeCompare(b.textbookName || '')
  })
})

const getCoverImageUrl = (coverUrl: string | undefined): string => {
  if (!coverUrl) return '/static/images/book.png'
  return httpClient.buildFullUrl(coverUrl)
}

const getDownloadProgress = (downloadedFiles: number, totalFiles: number): number => {
  if (!totalFiles) return 0
  return Math.round((downloadedFiles / totalFiles) * 100)
}

const loadResources = async (isPullDownRefresh = false) => {
  loading.value = true
  try {
    const local = await resourceManager.getUserLocalTextbooks()
    if (!isPullDownRefresh && local.length > 0) {
      textbooks.value = local
    } else {
      const server = await apiService.fetchUserAllOnlineTextbooks()
      textbooks.value = server // 这里简化了合并逻辑，实际开发中需要使用 mergeServerAndLocalData
    }
  } catch (e) {
    showMessage('加载失败', 'error')
  } finally {
    loading.value = false
    initialLoadCompleted.value = true
  }
}

const handlePullDownRefresh = async () => {
  await loadResources(true)
  rubberBandListRef.value?.finishRefresh()
}

const handleFilterChange = () => {}

const handleLearnTextbook = (textbook: any) => {
  uni.navigateTo({
    url: `/pages/knowledge/graph?initSubject=${textbook.textbookSubjectLabel}&initTextbookId=${textbook.textbookId}`
  })
}

const downloadTextbook = async (textbook: any, isUpdate = false) => {
  // 小程序端下载逻辑适配
  showMessage(isUpdate ? '正在更新...' : '正在下载...', 'info')
}

const handlePauseDownload = (textbook: any) => {
  // 暂停逻辑适配
}

const handleDeleteTextbook = (textbook: any) => {
  deleteTextbookId.value = textbook.id
  deleteTextbookName.value = textbook.textbookName
  deleteDialogRef.value?.openDialog()
}

const confirmDeleteTextbook = async () => {
  if (deleteTextbookId.value) {
    await resourceManager.deleteTextbook(deleteTextbookId.value)
    await loadResources()
  }
  deleteDialogRef.value?.closeDialog()
}

const cancelDeleteTextbook = () => {
  deleteDialogRef.value?.closeDialog()
}

onMounted(() => {
  loadResources()
})
</script>

<style scoped>
.my-resources-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f8f9fa;
}

.filter-section {
  background-color: #ffffff;
  padding: 32rpx;
  border-bottom: 2rpx solid #e5e7eb;
}

.filter-title {
  font-size: 36rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}

.filter-content {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.filter-dropdown-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.filter-label {
  font-size: 28rpx;
  color: #6b7280;
}

.scroll-content {
  padding: 24rpx;
}

.textbooks-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}

.textbook-card {
  background-color: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
  position: relative;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.textbook-delete-btn {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  width: 40rpx;
  height: 40rpx;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.delete-icon {
  width: 24rpx;
  height: 24rpx;
  filter: brightness(0) invert(1);
}

.textbook-cover {
  width: 100%;
  height: 240rpx;
}

.cover-image {
  width: 100%;
  height: 100%;
}

.textbook-content {
  padding: 20rpx;
}

.textbook-title {
  font-size: 30rpx;
  font-weight: 600;
  display: block;
  margin-bottom: 8rpx;
}

.textbook-version-info {
  font-size: 24rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}

.textbook-actions {
  margin-top: 20rpx;
}

.action-btn {
  width: 100%;
  height: 64rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn-learn { background-color: #10b981; color: #ffffff; }
.action-btn-update { background-color: #f59e0b; color: #ffffff; }
.action-btn-download { background-color: #3b82f6; color: #ffffff; }
.action-btn-continue { background-color: #6b7280; color: #ffffff; }

.download-progress-bar {
  width: 100%;
  height: 40rpx;
  background-color: #e5e7eb;
  border-radius: 20rpx;
  overflow: hidden;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background-color: #3b82f6;
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 20rpx;
  color: #ffffff;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-icon {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 32rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #374151;
  margin-bottom: 12rpx;
}

.empty-subtext {
  font-size: 28rpx;
  color: #9ca3af;
  margin-bottom: 48rpx;
}

.reload-btn {
  width: 240rpx;
  height: 80rpx;
  background-color: #3b82f6;
  color: #ffffff;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-dialog-content {
  font-size: 28rpx;
  color: #4b5563;
  line-height: 1.6;
}
</style>
