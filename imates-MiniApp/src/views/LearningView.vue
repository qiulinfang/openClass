<template>
  <Modal
    v-model="localVisible"
    :title="sectionName"
    :initial-width="700"
    :initial-height="900"
    title-align="left"
    header-background-color="#ffffff"
  >
    <view class="learning-content">
      <!-- 主要内容区域 -->
      <view class="main-content">
        <!-- 左侧：学习方案选择 -->
        <view class="left-panel">
          <view class="scheme-section">
            <!-- 加载状态 -->
            <view v-if="loadingPackages" class="loading-container">
              <view class="spinner"></view>
              <text class="loading-text">正在加载...</text>
            </view>

            <!-- 学习方案列表 -->
            <RubberBandList
              v-else-if="filteredLearningPackages.length > 0"
              class="scheme-list"
            >
              <view class="scroll-content">
                <view
                  v-for="(scheme, index) in filteredLearningPackages"
                  :key="scheme.id"
                  :class="['scheme-item', { 'scheme-selected': selectedSchemeIndex === index }]"
                  @click="selectScheme(index)"
                >
                  <view class="scheme-header">
                    <text class="scheme-name">{{ scheme.packageName }}</text>
                    <view class="difficulty-rating">
                      <text class="difficulty-label">难度</text>
                      <!-- 简化版难度显示 -->
                      <view class="stars">
                        <text v-for="i in 5" :key="i" class="star" :class="{ active: i <= getDifficultyValue(scheme) }">★</text>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </RubberBandList>

            <!-- 无数据状态 -->
            <view v-else class="empty-state">
              <image src="/static/icons/school.svg" mode="aspectFit" class="empty-icon" />
              <text class="empty-text">该章节暂无学习方案</text>
            </view>
          </view>
        </view>

        <!-- 右侧：学习资源列表 -->
        <view class="right-panel">
          <!-- 无方案选择状态 -->
          <view v-if="selectedSchemeIndex < 0" class="empty-resources">
            <image src="/static/icons/folder_open.svg" mode="aspectFit" class="empty-icon" />
            <text class="empty-text">请先选择学习方案</text>
          </view>

          <!-- 资源文件列表 -->
          <RubberBandList
            v-else-if="currentResources.length > 0"
            class="resources-list"
          >
            <view class="scroll-content">
              <view
                v-for="(resource, index) in currentResources"
                :key="resource.id"
                class="resource-item"
                @click="selectResource(index)"
              >
                <!-- 缩略图 -->
                <view class="resource-thumbnail">
                  <image
                    v-if="resource.thumbnail"
                    :src="resource.thumbnail"
                    mode="aspectFill"
                    class="thumbnail-image"
                  />
                  <image
                    v-else
                    :src="getResourceIcon(resource.fileName)"
                    mode="aspectFit"
                    class="type-icon"
                  />
                </view>
                <!-- 资源信息 -->
                <view class="resource-info">
                  <text class="resource-title">{{ resource.fileName }}</text>
                  <text class="resource-size">{{ formatFileSize(resource.size) }}</text>
                </view>
                <!-- 操作按钮 -->
                <Button
                  label="去学习"
                  size="sm"
                  class="resource-action"
                  @click.stop="startLearning(resource)"
                />
              </view>
            </view>
          </RubberBandList>

          <!-- 无资源状态 -->
          <view v-else class="empty-resources">
            <image src="/static/icons/folder_open.svg" mode="aspectFit" class="empty-icon" />
            <text class="empty-text">该方案暂无资源文件</text>
          </view>
        </view>
      </view>
    </view>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { resourceManager } from '../services/storage/resource-storage'
import { apiService, getUserId } from '../services'
import { androidBridge } from '../services/business/android-bridge'
import RubberBandList from '../components/base/VirtualScroll.vue'
import Modal from '../components/base/Modal.vue'
import Button from '../components/base/Button.vue'

interface Props {
  modelValue: boolean
  nodeId?: string
  sectionName?: string
  level?: number
  textbookId?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  nodeId: '',
  sectionName: '学习内容',
  level: 1,
  textbookId: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const sectionName = ref(props.sectionName)
const sectionId = ref(props.nodeId)
const textbookId = ref(props.textbookId)
const selectedSchemeIndex = ref(-1)
const selectedResourceIndex = ref(-1)
const loadingPackages = ref(false)
const learningPackages = ref<any[]>([])
const localFiles = ref<any[]>([])

const filteredLearningPackages = computed(() => {
  if (!sectionId.value) return learningPackages.value
  return learningPackages.value.filter(pkg => 
    pkg.sectionId && pkg.sectionId.toLowerCase() === sectionId.value.toLowerCase()
  )
})

const currentScheme = computed(() => {
  if (selectedSchemeIndex.value >= 0 && selectedSchemeIndex.value < filteredLearningPackages.value.length) {
    return filteredLearningPackages.value[selectedSchemeIndex.value]
  }
  return null
})

const currentResources = computed(() => {
  if (!currentScheme.value) return []
  const resources = currentScheme.value.resourceList || []
  return resources.map(resource => {
    const localFile = localFiles.value.find(file => file.id === resource.id)
    return { ...resource, thumbnail: localFile?.thumbnail }
  })
})

const selectScheme = (index: number) => {
  selectedSchemeIndex.value = index
  selectedResourceIndex.value = -1
}

const selectResource = (index: number) => {
  selectedResourceIndex.value = index
}

const getDifficultyValue = (scheme: any): number => {
  return scheme.difficulty || 1
}

const getResourceIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return `/static/icons/file_${ext || 'other'}.svg`
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const startLearning = async (resource: any) => {
  if (!currentScheme.value) return

  // 小程序端预览文件通常使用 uni.openDocument
  ;(uni as any).navigateTo({
    url: `/pages/pdf-viewer/index?id=${textbookId.value}&resourceId=${resource.id}&fileName=${resource.fileName}`
  })
}

const loadLearningPackages = async () => {
  if (!textbookId.value) return
  loadingPackages.value = true
  try {
    const textbook = await resourceManager.getTextbookInfoById(textbookId.value)
    if (textbook) {
      learningPackages.value = textbook.learningPackages || []
      localFiles.value = textbook.localFiles || []
      if (learningPackages.value.length > 0) {
        selectedSchemeIndex.value = 0
      }
    }
  } catch (error) {
    console.error('加载失败:', error)
  } finally {
    loadingPackages.value = false
  }
}

watch(() => props.nodeId, (val) => {
  sectionId.value = val
  loadLearningPackages()
})

onMounted(() => {
  loadLearningPackages()
})
</script>

<style scoped>
.learning-content {
  height: 100%;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
}

.main-content {
  display: flex;
  height: 100%;
}

.left-panel {
  width: 240rpx;
  border-right: 2rpx solid #f3f4f6;
  background-color: #f9fafb;
}

.scheme-section {
  height: 100%;
}

.scheme-item {
  padding: 24rpx;
  border-bottom: 2rpx solid #f3f4f6;
}

.scheme-selected {
  background-color: #ffffff;
  border-left: 8rpx solid #3b82f6;
}

.scheme-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2937;
  display: block;
  margin-bottom: 8rpx;
}

.difficulty-rating {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.difficulty-label {
  font-size: 22rpx;
  color: #6b7280;
}

.stars {
  display: flex;
}

.star {
  font-size: 20rpx;
  color: #d1d5db;
}

.star.active {
  color: #f59e0b;
}

.right-panel {
  flex: 1;
  background-color: #ffffff;
}

.resource-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 2rpx solid #f3f4f6;
}

.resource-thumbnail {
  width: 120rpx;
  height: 160rpx;
  background-color: #f3f4f6;
  border-radius: 12rpx;
  margin-right: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
}

.type-icon {
  width: 64rpx;
  height: 64rpx;
}

.resource-info {
  flex: 1;
}

.resource-title {
  font-size: 28rpx;
  color: #1f2937;
  display: block;
  margin-bottom: 8rpx;
}

.resource-size {
  font-size: 24rpx;
  color: #9ca3af;
}

.loading-container, .empty-state, .empty-resources {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40rpx;
}

.spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid #f3f4f6;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16rpx;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  width: 80rpx;
  height: 80rpx;
  margin-bottom: 16rpx;
  opacity: 0.3;
}

.empty-text {
  font-size: 24rpx;
  color: #9ca3af;
}
</style>
