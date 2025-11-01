<template>
  <div class="learning-content">
    <!-- 标题栏 -->
    <div class="dialog-header">
      <div class="dialog-title">
        <span>{{ sectionName }}</span>
      </div>
      <q-btn 
        flat 
        round 
        icon="close" 
        @click="emit('close')"
        class="close-btn"
      />
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧：学习方案选择 -->
      <div class="left-panel">
        <div class="scheme-section">
          
          <!-- 加载状态 -->
          <div v-if="loadingPackages" class="loading-container">
            <q-spinner color="primary" size="40px" />
            <div class="loading-text">正在加载学习方案...</div>
          </div>
          
          <!-- 学习方案列表 -->
          <div v-else-if="filteredLearningPackages.length > 0" ref="schemeListWrapper" class="scroll-wrapper scheme-list">
            <div class="scroll-content">
              <div 
                v-for="(scheme, index) in filteredLearningPackages" 
                :key="scheme.id"
                :class="['scheme-item', { 'scheme-selected': selectedSchemeIndex === index }]"
                @click="selectScheme(index)"
              >
              <div class="scheme-header">
                <span class="scheme-name">方案{{ index + 1 }}</span>
                <div class="difficulty-rating">
                  <span class="difficulty-label">难度</span>
                  <div class="stars">
                    <q-icon 
                      v-for="star in 5" 
                      :key="star"
                      name="star" 
                      size="18px" 
                      :color="star <= 3 ? '#ffc107' : '#e0e0e0'"
                    />
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
          
          <!-- 无数据状态 -->
          <div v-else class="empty-state">
            <q-icon name="school" size="48px" color="grey-5" />
            <div class="empty-text">该章节暂无学习方案</div>
          </div>
        </div>
      </div>

      <!-- 右侧：学习资源列表 -->
      <div class="right-panel">
        <div class="resources-section">
          <!-- 无方案选择状态 -->
          <div v-if="selectedSchemeIndex < 0" class="empty-resources">
            <q-icon name="folder_open" size="48px" color="grey-5" />
            <div class="empty-text">请先选择学习方案</div>
          </div>
          
          <!-- 资源文件列表 -->
          <div v-else-if="currentResources.length > 0" ref="resourcesListWrapper" class="scroll-wrapper resources-list">
            <div class="scroll-content">
              <div 
                v-for="(resource, index) in currentResources" 
                :key="resource.id"
                class="resource-item"
                tabindex="0"
                @click="selectResource(index)"
                @focus="handleResourceFocus(index)"
                @keydown.enter="selectResource(index)"
              >
              <div class="resource-thumbnail">
                <!-- 如果有缩略图则显示缩略图，否则显示图标 -->
                <img 
                  v-if="resource.thumbnail" 
                  :src="resource.thumbnail" 
                  :alt="resource.fileName"
                  class="thumbnail-image"
                />
                <q-icon 
                  v-else
                  :name="getResourceIcon(resource.fileName)" 
                  size="50px" 
                  color="grey-6"
                />
              </div>
              <div class="resource-info">
                <div class="resource-title">{{ resource.fileName }}</div>
                <div class="resource-size">{{ formatFileSize(resource.size) }}</div>
              </div>
              <div class="resource-action">
                <q-btn 
                  size="xl"
                  label="去学习"
                  @click.stop="startLearning(resource)"
                  no-caps
                  rounded
                  class="learning-btn"
                />
              </div>
            </div>
            </div>
          </div>
          
          <!-- 无资源状态 -->
          <div v-else class="empty-resources">
            <q-icon name="folder_open" size="48px" color="grey-5" />
            <div class="empty-text">该方案暂无资源文件</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { resourceManager } from '../services/resource-storage'
import type { LearningPackage, ResourceFile, LocalFileInfo } from '../types'
import { useBetterScroll } from '../composables/useBetterScroll'

// Props 定义
interface Props {
  nodeId?: string
  sectionName?: string
  level?: number
  textbookId?: string
}

const props = withDefaults(defineProps<Props>(), {
  nodeId: '',
  sectionName: '学习内容',
  level: 1,
  textbookId: ''
})

// Emits 定义
const emit = defineEmits<{
  close: []
}>()

// 路由
const router = useRouter()

// 响应式数据
const sectionName = ref(props.sectionName)
const sectionId = ref(props.nodeId)
const id = ref(props.textbookId)
const selectedSchemeIndex = ref(-1)
const selectedResourceIndex = ref(-1)
const isLoading = ref(false)
const loadingPackages = ref(false)

// Better Scroll 实例
const schemeListWrapper = ref<HTMLElement | null>(null)
const resourcesListWrapper = ref<HTMLElement | null>(null)

// 使用 Better Scroll 组合式函数 - 学习方案列表
const {
  init: initSchemeListBScroll,
  refresh: refreshSchemeListBScroll
} = useBetterScroll(
  schemeListWrapper,
  {
    scrollY: true,
    scrollX: false,
    click: true,
    bounce: {
      top: true,
      bottom: true,
      left: false,
      right: false
    },
    deceleration: 0.003,
    useTransition: true,
    HWCompositing: true,
  },
  true, // 自动监听数据变化
  [
    () => filteredLearningPackages.value.length
  ]
)

// 使用 Better Scroll 组合式函数 - 资源列表
const {
  init: initResourcesListBScroll,
  refresh: refreshResourcesListBScroll
} = useBetterScroll(
  resourcesListWrapper,
  {
    scrollY: true,
    scrollX: false,
    click: true,
    bounce: {
      top: true,
      bottom: true,
      left: false,
      right: false
    },
    deceleration: 0.003,
    useTransition: true,
    HWCompositing: true,
  },
  true, // 自动监听数据变化
  [
    () => currentResources.value.length
  ]
)

// 学习方案数据 - 从API获取
const learningPackages = ref<LearningPackage[]>([])
// 本地文件信息 - 用于获取缩略图
const localFiles = ref<LocalFileInfo[]>([])

// 计算属性
// 根据章节ID筛选学习方案（与安卓原生保持一致）
const filteredLearningPackages = computed(() => {
  if (!sectionId.value) {
    return learningPackages.value
  }
  
  return learningPackages.value.filter(pkg => {
    const hasSectionId = pkg.sectionId && pkg.sectionId.trim() !== ''
    return hasSectionId && 
      pkg.sectionId.toLowerCase() === sectionId.value.toLowerCase()
  })
})

const currentScheme = computed(() => {
  if (selectedSchemeIndex.value >= 0 && selectedSchemeIndex.value < filteredLearningPackages.value.length) {
    return filteredLearningPackages.value[selectedSchemeIndex.value]
  }
  return null
})

// 获取当前方案的所有资源文件（带缩略图信息）
const currentResources = computed(() => {
  if (!currentScheme.value) return []
  
  const resources = currentScheme.value.resourceList || []
  
  // 为每个资源添加缩略图信息
  return resources.map(resource => {
    const localFile = localFiles.value.find(file => file.id === resource.id)
    return {
      ...resource,
      thumbnail: localFile?.thumbnail
    }
  })
})

// 方法
const selectScheme = (index: number) => {
  selectedSchemeIndex.value = index
  // 重置资源选择
  selectedResourceIndex.value = -1
}

const selectResource = (index: number) => {
  selectedResourceIndex.value = index
}

// 处理资源项获得焦点
const handleResourceFocus = (index: number) => {
  selectedResourceIndex.value = index
}

const getResourceIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  const iconMap: Record<string, string> = {
    pdf: 'picture_as_pdf',
    doc: 'description',
    docx: 'description',
    txt: 'article',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    mp4: 'play_circle',
    avi: 'play_circle',
    mov: 'play_circle',
    mp3: 'audiotrack',
    wav: 'audiotrack',
    zip: 'folder_zip',
    rar: 'folder_zip'
  }
  return iconMap[extension || ''] || 'folder'
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 根据文件扩展名获取对应的视图路由名称
const getViewerRouteName = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase() || ''
  
  switch (extension) {
    case 'pdf':
      return 'pdfViewer'
    case 'html':
    case 'htm':
      return 'htmlViewer'
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'wmv':
    case 'flv':
    case 'webm':
      return 'videoViewer'
    default:
      // 默认使用PDF查看器
      return 'pdfViewer'
  }
}

const startLearning = async (resource: ResourceFile) => {
  if (!currentScheme.value) {
    console.error('没有选中的学习方案')
    return
  }
  
  isLoading.value = true
  
  try {
    const selectedScheme = currentScheme.value
    
    // 根据文件类型确定要跳转的路由
    const routeName = getViewerRouteName(resource.fileName)
    
    // 关闭对话框，让父组件处理后续的路由跳转
    emit('close')
    
    // 延迟执行路由跳转，确保对话框关闭动画完成
    setTimeout(() => {
      router.push({
        name: routeName,
        query: {
          id: id.value,
          textbookName: sectionName.value,
          resourceId: resource.id,
          fileName: resource.fileName,
          packageId: selectedScheme.id,
          packageName: selectedScheme.packageName
        }
      })
    }, 300)
  } catch (error) {
    console.error('开始学习失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 加载学习包数据
const loadLearningPackages = async () => {
  if (!id.value) {
    return
  }
  
  loadingPackages.value = true
  
  try {
    // 直接从IndexedDB获取教材信息，包含学习包数据
    const textbook = await resourceManager.getTextbookInfoById(id.value)
    
    if (textbook && textbook.learningPackages) {
      // 使用本地存储的学习包数据
      learningPackages.value = textbook.learningPackages
      
      // 同时加载本地文件信息（用于获取缩略图）
      if (textbook.localFiles) {
        localFiles.value = textbook.localFiles
      }
      
      // 自动选择第一个方案
      if (textbook.learningPackages.length > 0) {
        selectedSchemeIndex.value = 0
      }
    } else {
      // 如果没有本地数据，显示空状态
      learningPackages.value = []
      localFiles.value = []
    }
  } catch (error) {
    console.error('加载学习包失败:', error)
    learningPackages.value = []
    localFiles.value = []
  } finally {
    loadingPackages.value = false
  }
}

// 当章节ID变化时，重置选择状态
const resetSelection = () => {
  selectedSchemeIndex.value = -1
  selectedResourceIndex.value = -1
}

// 监听 props 变化
watch(() => props.nodeId, (newNodeId) => {
  sectionId.value = newNodeId
  resetSelection()
  loadLearningPackages()
})

watch(() => props.sectionName, (newSectionName) => {
  sectionName.value = newSectionName
})

watch(() => props.textbookId, (newTextbookId) => {
  id.value = newTextbookId
  resetSelection()
  loadLearningPackages()
})

// BScroll 初始化和刷新由组合式函数自动处理（已启用 autoWatch）

// 生命周期
onMounted(async () => {
  // 加载学习包数据
  await loadLearningPackages()
  // 初始化 BScroll（由组合式函数处理）
  await initSchemeListBScroll()
  await initResourcesListBScroll()
})

onUnmounted(() => {
  // BScroll 销毁由组合式函数自动处理
})
</script>

<style lang="scss" scoped>
// Material Design 色彩系统
$primary-color: #1976d2;
$primary-light: #42a5f5;
$primary-dark: #1565c0;
$secondary-color: #424242;
$surface-color: #ffffff;
$background-color: #fafafa;
$error-color: #d32f2f;
$success-color: #388e3c;
$warning-color: #f57c00;

// Material Design 阴影系统
$elevation-1: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
$elevation-2: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
$elevation-3: 0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23);
$elevation-4: 0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22);

// Material Design 圆角系统
$border-radius-small: 4px;
$border-radius-medium: 8px;
$border-radius-large: 16px;

// Material Design 间距系统
$spacing-xs: 4px;
$spacing-sm: 8px;
$spacing-md: 16px;
$spacing-lg: 24px;
$spacing-xl: 32px;

.learning-content {
  height: 100%;
  max-height: 100%;
  background-color: #1a094c;
  font-family: 'Roboto', 'Noto Sans', sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 对话框标题栏
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px 0;
  border-radius: 12px 12px 0 0;
  flex-shrink: 0;
  
  .dialog-title {
    display: flex;
    align-items: center;
    font-size: 28px;
    font-weight: 500;
    color: #ffffff;
  }
  
  .close-btn {
    color: #ffffff;
    width: 48px;
    height: 48px;
    font-size: 24px;
    
    &:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }
  }
}

// 主要内容区域
.main-content {
  display: flex;
  gap: 32px;
  padding: 0 32px;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  max-height: calc(100% - 80px); // 减去标题栏的高度
}

// 左侧面板
.left-panel {
  width: 300px;
  flex-shrink: 0;
  height: 100%;
  max-height: 100%;
  
  .scheme-section {
    height: 100%;
    max-height: 100%;
    background-color: #1a094c;
    border-radius: 50px;
    padding: 24px 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
}

// 右侧面板
.right-panel {
  flex: 1;
  overflow: hidden;
  min-width: 0;
  height: 100%;
  max-height: 100%;
  
  .resources-section {
    height: 100%;
    max-height: 100%;
    background-color: #1a094c;
    border-radius: 30px;
    padding: 24px 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
}

// Material Design 卡片样式
.scheme-card,
.intro-card,
.resources-card {
  border-radius: $border-radius-medium;
  box-shadow: $elevation-2;
  transition: box-shadow 0.3s ease;
  
  &:hover {
    box-shadow: $elevation-3;
  }
}

// 卡片头部
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-lg $spacing-lg $spacing-md;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  
  .card-title {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    font-size: 18px;
    font-weight: 400;
    color: $secondary-color;
    
    .title-icon {
      color: $primary-color;
    }
    
    .refresh-btn {
      margin-left: auto;
      color: $secondary-color;
      
      &:hover {
        color: $primary-color;
      }
    }
  }
}

// 卡片内容
.card-content {
  padding: $spacing-md $spacing-lg $spacing-lg;
}

// 学习方案列表
.scroll-wrapper.scheme-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  
  .scroll-content {
    min-height: calc(100% + 1px);
  }
  
  .scheme-item {
    margin-bottom: 16px;
    border-radius: 20px;
    padding: 32px 36px;
    cursor: pointer;
    transition: all 0.2s ease;
    background-color: rgba(255, 255, 255, 0.05);
    
    &:last-child {
      margin-bottom: 0;
    }
    
    &.scheme-selected {
      background-color: #312363;
      box-shadow: 0 4px 12px rgba(49, 35, 99, 0.3);
    }
    
    .scheme-header {
      display: flex;
      flex-direction: column;
      gap: 20px;
      
      .scheme-name {
        font-size: 26px;
        font-weight: 500;
        color: #ffffff;
        margin-bottom: 8px;
      }
      
      .difficulty-rating {
        display: flex;
        align-items: center;
        
        .difficulty-label {
          font-size: 20px;
          color: #ffffff;
          opacity: 0.8;
          padding-right: 12px;
        }
        
        .stars {
          flex: 0.8;
          display: flex;
          align-items: center;
          justify-content: space-around;
          gap: 10px;
        }
      }
    }
  }
}

// 学习状态
.learning-status {
  .q-chip {
    font-size: 14px;
    font-weight: 400;
  }
}

// 评价区域
.rating-section {
  .rating-container {
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
  }
  
  .rating-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .rating-label {
      display: flex;
      align-items: center;
      gap: $spacing-sm;
      font-size: 16px;
      font-weight: 400;
      color: $secondary-color;
    }
  }
}

// 内容描述
.content-description {
  .description-text {
    font-size: 16px;
    line-height: 1.6;
    color: $secondary-color;
    padding: $spacing-md;
    background-color: rgba(0, 0, 0, 0.04);
    border-radius: $border-radius-small;
    border-left: 4px solid $primary-color;
  }
}

// 资源列表
.scroll-wrapper.resources-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 20px;
  background-color: #312263;
  
  .scroll-content {
    min-height: calc(100% + 1px);
  }
  
  .resource-item {
    display: flex;
    align-items: center;
    margin: 7px 24px 0;
    padding: 20px 28px 20px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    
    &:focus {
      background-color: rgba(25, 118, 210, 0.1);
    }
    
    &:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
    
    .resource-thumbnail {
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      margin-right: 24px;
      flex-shrink: 0;
      overflow: hidden;
      
      .thumbnail-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 12px;
      }
    }
    
    .resource-info {
      flex: 1;
      min-width: 0;
      
      .resource-title {
        font-size: 22px;
        font-weight: 500;
        color: #ffffff;
        margin-bottom: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .resource-size {
        font-size: 18px;
        color: #ffffff;
        opacity: 0.7;
      }
    }
    
    .resource-action {
      flex-shrink: 0;
      margin-left: 24px;
    }
  }
}

// 加载状态样式
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
  
  .loading-text {
    color: #ffffff;
    font-size: 19px;
  }
}

// 空状态样式
.empty-state, .empty-resources {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
  
  .empty-text {
    color: #ffffff;
    font-size: 19px;
    font-weight: 500;
  }
}

// 学习按钮样式
.learning-btn {
  font-size: 18px ;
  padding: 16px 32px ;
  min-height: 52px ;
  font-weight: 500 ;
  border-radius: 8px ;
  background-color: #6e55ff ;
  color: #ffffff ;
}

// 响应式设计
@media (max-width: 1200px) {
  .learning-dialog-card {
    width: 95vw;
    height: 90vh;
    min-width: 700px;
    min-height: 500px;
  }
  
  .main-content {
    gap: 24px;
    padding: 24px;
  }
  
  .left-panel {
    width: 350px;
  }
}

@media (max-width: 1024px) {
  .learning-dialog-card {
    width: 95vw;
    height: 90vh;
    min-width: 600px;
    min-height: 500px;
  }
  
  .main-content {
    flex-direction: column;
    gap: 20px;
    max-height: calc(100% - 80px);
  }
  
  .left-panel {
    width: 100%;
    flex-shrink: 1;
    height: 300px;
    
    .scheme-section {
      height: 100%;
    }
  }
  
  .right-panel {
    height: 400px;
    
    .resources-section {
      height: 100%;
    }
  }
}

@media (max-width: 768px) {
  .learning-dialog-card {
    width: 95vw;
    height: 95vh;
    min-width: 400px;
    min-height: 400px;
  }
  
  .main-content {
    padding: 16px;
    gap: 16px;
  }
  
  .left-panel .scheme-section,
  .right-panel .resources-section {
    padding: 16px;
  }
  
  .scheme-item {
    padding: 20px 24px;
    
    .scheme-name {
      font-size: 22px;
    }
    
    .difficulty-label {
      font-size: 18px;
    }
  }
  
  .resource-item {
    padding: 16px 20px;
    
    .resource-title {
      font-size: 19px;
    }
    
    .resource-size {
      font-size: 15px;
    }
    
    .resource-thumbnail {
      width: 80px;
      height: 80px;
      margin-right: 16px;
    }
  }
}

@media (max-width: 480px) {
  .learning-dialog-card {
    width: 95vw;
    height: 95vh;
    min-width: 300px;
    min-height: 400px;
  }
  
  .main-content {
    padding: 12px;
    gap: 12px;
  }
  
  .left-panel .scheme-section,
  .right-panel .resources-section {
    padding: 12px;
  }
  
  .scheme-item,
  .resource-item {
    padding: 12px 16px;
  }
  
  .resource-item {
    flex-direction: column;
    text-align: center;
    gap: 12px;
    
    .resource-thumbnail {
      margin-right: 0;
      margin-bottom: 8px;
    }
    
    .resource-action {
      margin-left: 0;
    }
  }
}

// Material Design 动画
@keyframes material-ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}

// 焦点状态
.q-btn:focus,
.q-item:focus,
.resource-card:focus {
  outline: 2px solid $primary-color;
  outline-offset: 2px;
}

// 高对比度模式支持
@media (prefers-contrast: high) {
  .scheme-card,
  .intro-card,
  .resources-card {
    border: 2px solid $secondary-color;
  }
  
  .resource-card.resource-selected {
    border-width: 3px;
  }
}

// 减少动画模式支持
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
