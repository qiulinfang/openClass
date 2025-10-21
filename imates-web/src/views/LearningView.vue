<template>
  <div class="learning-content">
    <div class="app-bar">
      <div class="app-bar-content">
        <q-btn 
          flat 
          round 
          icon="arrow_back" 
          @click="goBack"
          class="back-button"
        />
        <div class="app-bar-title">
          <div class="breadcrumb">
            <span class="breadcrumb-item">去学习</span>
            <q-icon name="chevron_right" size="16px" class="breadcrumb-separator" />
            <span class="breadcrumb-current">{{ sectionName }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧：学习方案选择卡片 -->
      <div class="left-panel">
        <q-card class="scheme-card" elevation="2">
          <q-card-section class="card-header">
            <div class="card-title">
              <q-icon name="school" size="24px" class="title-icon" />
              <span>学习方案</span>
              <q-btn 
                flat 
                round 
                dense 
                icon="refresh" 
                size="sm"
                @click="refreshLearningPackages"
                :loading="loadingPackages"
                class="refresh-btn"
              >
                <q-tooltip>刷新学习方案</q-tooltip>
              </q-btn>
            </div>
          </q-card-section>
          
          <q-card-section class="card-content">
            <!-- 加载状态 -->
            <div v-if="loadingPackages" class="loading-container">
              <q-spinner color="primary" size="40px" />
              <div class="loading-text">正在加载学习方案...</div>
            </div>
            
            <!-- 学习方案列表 -->
            <div v-else-if="learningPackages.length > 0" class="scheme-list">
              <q-item 
                v-for="(scheme, index) in learningPackages" 
                :key="scheme.id"
                clickable
                :active="selectedSchemeIndex === index"
                @click="selectScheme(index)"
                class="scheme-item"
              >
                <q-item-section avatar>
                  <q-avatar 
                    :color="selectedSchemeIndex === index ? 'primary' : 'grey-4'"
                    text-color="white"
                    size="32px"
                  >
                    {{ index + 1 }}
                  </q-avatar>
                </q-item-section>
                
                <q-item-section>
                  <q-item-label class="scheme-name">{{ scheme.packageName }}</q-item-label>
                  <q-item-label caption class="scheme-desc">{{ scheme.description }}</q-item-label>
                </q-item-section>
                
                <q-item-section side v-if="selectedSchemeIndex === index">
                  <q-icon name="check_circle" color="primary" size="20px" />
                </q-item-section>
              </q-item>
            </div>
            
            <!-- 无数据状态 -->
            <div v-else class="empty-state">
              <q-icon name="school" size="48px" color="grey-5" />
              <div class="empty-text">暂无学习方案</div>
              <div class="empty-desc">该章节暂未配置学习资源</div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- 右侧：教学内容详情 -->
      <div class="right-panel">
        <!-- 教学内容简介卡片 -->
        <q-card class="intro-card" elevation="2">
          <q-card-section class="card-header">
            <div class="card-title">
              <q-icon name="description" size="24px" class="title-icon" />
              <span>教学内容简介</span>
            </div>
            <div class="learning-status">
              <q-chip 
                :color="selectedSchemeIndex >= 0 ? 'positive' : 'grey-5'"
                text-color="white"
                :icon="selectedSchemeIndex >= 0 ? 'check_circle' : 'radio_button_unchecked'"
              >
                {{ learningStatus }}
              </q-chip>
            </div>
          </q-card-section>
          
          <!-- 评价区域 -->
          <q-card-section class="rating-section">
            <div class="rating-container">
              <div class="rating-item">
                <div class="rating-label">
                  <q-icon name="star" size="20px" color="amber" />
                  <span>评价</span>
                </div>
                <q-rating
                  v-model="rating"
                  max="5"
                  size="2em"
                  color="amber"
                  icon="star"
                  @update:model-value="setRating"
                />
              </div>
              
              <div class="rating-item">
                <div class="rating-label">
                  <q-icon name="trending_up" size="20px" color="blue" />
                  <span>难度</span>
                </div>
                <q-rating
                  v-model="difficulty"
                  max="5"
                  size="2em"
                  color="blue"
                  icon="star"
                  @update:model-value="setDifficulty"
                />
              </div>
            </div>
          </q-card-section>

          <!-- 教学内容描述 -->
          <q-card-section class="content-description">
            <div class="description-text">
              {{ currentScheme?.description || '请选择学习方案查看详细内容' }}
            </div>
          </q-card-section>
        </q-card>

        <!-- 套餐资源卡片 -->
        <q-card class="resources-card" elevation="2">
          <q-card-section class="card-header">
            <div class="card-title">
              <q-icon name="folder" size="24px" class="title-icon" />
              <span>套餐资源</span>
            </div>
          </q-card-section>
          
          <q-card-section class="card-content">
            <!-- 无方案选择状态 -->
            <div v-if="!currentScheme" class="empty-resources">
              <q-icon name="folder_open" size="48px" color="grey-5" />
              <div class="empty-text">请先选择学习方案</div>
              <div class="empty-desc">选择学习方案后即可查看相关资源</div>
            </div>
            
            <!-- 资源文件列表 -->
            <div v-else-if="currentResources.length > 0" class="resources-grid">
              <q-card 
                v-for="(resource, index) in currentResources" 
                :key="resource.id"
                flat
                bordered
                :class="['resource-item', { 'resource-selected': selectedResourceIndex === index }]"
                @click="selectResource(index)"
                class="resource-card"
              >
                <q-card-section class="resource-content">
                  <div class="resource-icon">
                    <q-icon 
                      :name="getResourceIcon(resource.fileName)" 
                      size="40px" 
                      :color="selectedResourceIndex === index ? 'primary' : 'grey-6'"
                    />
                  </div>
                  <div class="resource-info">
                    <div class="resource-name">{{ resource.fileName }}</div>
                    <div class="resource-type">{{ getResourceType(resource.fileName) }}</div>
                    <div class="resource-size">{{ formatFileSize(resource.size) }}</div>
                  </div>
                  <div v-if="selectedResourceIndex === index" class="resource-check">
                    <q-icon name="check_circle" color="primary" size="20px" />
                  </div>
                </q-card-section>
              </q-card>
            </div>
            
            <!-- 无资源状态 -->
            <div v-else class="empty-resources">
              <q-icon name="folder_open" size="48px" color="grey-5" />
              <div class="empty-text">该方案暂无资源文件</div>
              <div class="empty-desc">请联系管理员添加学习资源</div>
            </div>
          </q-card-section>
        </q-card>

        <!-- 操作按钮 -->
        <div class="action-section">
          <q-btn 
            class="learning-btn"
            color="primary"
            size="lg"
            @click="startLearning"
            :disable="!canStartLearning"
            :loading="isLoading"
            icon="play_arrow"
            label="开始学习"
            no-caps
            rounded
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { apiService } from '../services/api-service'
import type { LearningPackage } from '../types'

// 路由
const router = useRouter()
const route = useRoute()

// 响应式数据
const sectionName = ref('')
const sectionId = ref('')
const textbookId = ref('')
const selectedSchemeIndex = ref(-1)
const selectedResourceIndex = ref(-1)
const rating = ref(0)
const difficulty = ref(0)
const isLoading = ref(false)
const loadingPackages = ref(false)

// 学习方案数据 - 从API获取
const learningPackages = ref<LearningPackage[]>([])

// 计算属性
const currentScheme = computed(() => {
  if (selectedSchemeIndex.value >= 0 && selectedSchemeIndex.value < learningPackages.value.length) {
    return learningPackages.value[selectedSchemeIndex.value]
  }
  return null
})

const learningStatus = computed(() => {
  if (selectedSchemeIndex.value >= 0) {
    return '已选择'
  }
  return '未选择'
})

const canStartLearning = computed(() => {
  return selectedSchemeIndex.value >= 0 && selectedResourceIndex.value >= 0
})

// 获取当前方案的所有资源文件
const currentResources = computed(() => {
  if (!currentScheme.value) return []
  return currentScheme.value.resourceList || []
})

// 方法
const goBack = () => {
  router.back()
}

const selectScheme = (index: number) => {
  selectedSchemeIndex.value = index
  // 重置资源选择
  selectedResourceIndex.value = -1
}

const selectResource = (index: number) => {
  selectedResourceIndex.value = index
}

const setRating = (value: number) => {
  rating.value = value
}

const setDifficulty = (value: number) => {
  difficulty.value = value
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

const getResourceType = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  const typeMap: Record<string, string> = {
    pdf: 'PDF文档',
    doc: 'Word文档',
    docx: 'Word文档',
    txt: '文本文件',
    jpg: '图片文件',
    jpeg: '图片文件',
    png: '图片文件',
    gif: '图片文件',
    mp4: '视频文件',
    avi: '视频文件',
    mov: '视频文件',
    mp3: '音频文件',
    wav: '音频文件',
    zip: '压缩文件',
    rar: '压缩文件'
  }
  return typeMap[extension || ''] || '未知文件'
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const startLearning = async () => {
  if (!canStartLearning.value) {
    return
  }
  
  isLoading.value = true
  
  try {
    const selectedScheme = currentScheme.value
    const selectedResource = currentResources.value[selectedResourceIndex.value]
    
    // 模拟异步操作
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 这里可以添加实际的学习逻辑
    console.log('开始学习:', {
      section: sectionName.value,
      sectionId: sectionId.value,
      textbookId: textbookId.value,
      scheme: selectedScheme,
      resource: selectedResource,
      rating: rating.value,
      difficulty: difficulty.value
    })
    
    // 可以跳转到具体的学习页面或打开资源
    // router.push('/learning-content')
  } finally {
    isLoading.value = false
  }
}

// 加载学习包数据
const loadLearningPackages = async () => {
  if (!textbookId.value) {
    console.warn('教材ID为空，无法加载学习包')
    return
  }
  
  loadingPackages.value = true
  
  try {
    console.log('开始加载学习包，教材ID:', textbookId.value)
    
    // 首先尝试从缓存加载
    const packages = await apiService.getLearningResources(textbookId.value, true)
    learningPackages.value = packages
    
    console.log('加载学习包成功:', packages)
    console.log('学习包数量:', packages.length)
    
    if (packages.length === 0) {
      console.log('该教材没有学习包数据，可能需要检查：')
      console.log('1. 服务器是否配置了学习包')
      console.log('2. 教材ID是否正确')
      console.log('3. API接口是否正常')
    }
  } catch (error) {
    console.error('加载学习包失败:', error)
    learningPackages.value = []
  } finally {
    loadingPackages.value = false
  }
}

// 刷新学习包数据（强制从服务器获取）
const refreshLearningPackages = async () => {
  if (!textbookId.value) {
    return
  }
  
  loadingPackages.value = true
  
  try {
    // 强制从服务器获取最新数据
    const packages = await apiService.getLearningResources(textbookId.value, false)
    learningPackages.value = packages
    
    console.log('刷新学习包成功:', packages)
  } catch (error) {
    console.error('刷新学习包失败:', error)
  } finally {
    loadingPackages.value = false
  }
}

// 生命周期
onMounted(async () => {
  // 从路由参数获取章节信息
  sectionName.value = route.query.sectionName as string || '学习内容'
  sectionId.value = route.query.nodeId as string || ''
  textbookId.value = route.query.textbookId as string || ''
  
  console.log('LearningView 接收到的参数:', {
    sectionName: sectionName.value,
    sectionId: sectionId.value,
    textbookId: textbookId.value
  })
  
  // 加载学习包数据
  await loadLearningPackages()
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
  min-height: 100vh;
  background-color: $background-color;
  font-family: 'Roboto', 'Noto Sans', sans-serif;
}

// Material Design App Bar
.app-bar {
  background-color: $primary-color;
  color: white;
  box-shadow: $elevation-2;
  position: sticky;
  top: 0;
  z-index: 1000;
  
  .app-bar-content {
    display: flex;
    align-items: center;
    padding: $spacing-md $spacing-lg;
    max-width: 1200px;
    margin: 0 auto;
    
    .back-button {
      margin-right: $spacing-md;
    }
    
    .app-bar-title {
      flex: 1;
      
      .breadcrumb {
        display: flex;
        align-items: center;
        gap: $spacing-sm;
        
        .breadcrumb-item {
          font-size: 16px;
          font-weight: 500;
          opacity: 0.8;
        }
        
        .breadcrumb-separator {
          opacity: 0.6;
        }
        
        .breadcrumb-current {
          font-size: 16px;
          font-weight: 500;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }
}

// 主要内容区域
.main-content {
  display: flex;
  gap: $spacing-lg;
  padding: $spacing-lg;
  max-width: 1200px;
  margin: 0 auto;
  min-height: calc(100vh - 80px);
}

// 左侧面板
.left-panel {
  width: 35%;
  min-width: 300px;
}

// 右侧面板
.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
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
    font-weight: 500;
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
.scheme-list {
  .scheme-item {
    border-radius: $border-radius-small;
    margin-bottom: $spacing-xs;
    transition: background-color 0.2s ease;
    
    &:hover {
      background-color: rgba(25, 118, 210, 0.04);
    }
    
    &.q-item--active {
      background-color: rgba(25, 118, 210, 0.08);
    }
    
    .scheme-name {
      font-size: 16px;
      font-weight: 500;
      color: $secondary-color;
    }
    
    .scheme-desc {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.6);
    }
  }
}

// 学习状态
.learning-status {
  .q-chip {
    font-size: 14px;
    font-weight: 500;
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
      font-weight: 500;
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

// 资源网格
.resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: $spacing-md;
}

// 加载状态样式
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
  gap: $spacing-md;
  
  .loading-text {
    color: $secondary-color;
    font-size: 14px;
  }
}

// 空状态样式
.empty-state, .empty-resources {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl;
  gap: $spacing-md;
  
  .empty-text {
    color: $secondary-color;
    font-size: 16px;
    font-weight: 500;
  }
  
  .empty-desc {
    color: $secondary-color;
    font-size: 14px;
    opacity: 0.7;
    text-align: center;
  }
}

// 资源卡片
.resource-card {
  border-radius: $border-radius-medium;
  transition: all 0.3s ease;
  cursor: pointer;
  
  &:hover {
    box-shadow: $elevation-3;
    transform: translateY(-2px);
  }
  
  &.resource-selected {
    border: 2px solid $primary-color;
    box-shadow: $elevation-3;
  }
  
  .resource-content {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    padding: $spacing-md;
    
    .resource-icon {
      flex-shrink: 0;
    }
    
    .resource-info {
      flex: 1;
      
      .resource-name {
        font-size: 16px;
        font-weight: 500;
        color: $secondary-color;
        margin-bottom: $spacing-xs;
      }
      
      .resource-type {
        font-size: 14px;
        color: rgba(0, 0, 0, 0.6);
        text-transform: capitalize;
        margin-bottom: $spacing-xs;
      }
      
      .resource-size {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.5);
      }
    }
    
    .resource-check {
      flex-shrink: 0;
    }
  }
}

// 操作按钮区域
.action-section {
  display: flex;
  justify-content: flex-end;
  padding: $spacing-lg 0;
  
  .learning-btn {
    min-width: 160px;
    height: 48px;
    font-size: 16px;
    font-weight: 500;
    border-radius: $border-radius-large;
    box-shadow: $elevation-2;
    transition: all 0.3s ease;
    
    &:hover:not(:disabled) {
      box-shadow: $elevation-3;
      transform: translateY(-1px);
    }
    
    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: $elevation-1;
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

// Material Design 响应式设计
@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
    gap: $spacing-md;
  }
  
  .left-panel {
    width: 100%;
    min-width: auto;
  }
  
  .resources-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: $spacing-md;
  }
  
  .app-bar-content {
    padding: $spacing-md;
  }
  
  .card-header {
    padding: $spacing-md;
  }
  
  .card-content {
    padding: $spacing-md;
  }
  
  .resources-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: $spacing-sm;
  }
  
  .resource-card .resource-content {
    flex-direction: column;
    text-align: center;
    gap: $spacing-sm;
  }
  
  .rating-container {
    gap: $spacing-md;
  }
  
  .rating-item {
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-sm;
  }
}

@media (max-width: 480px) {
  .resources-grid {
    grid-template-columns: 1fr;
  }
  
  .action-section {
    justify-content: center;
  }
  
  .learning-btn {
    width: 100%;
    max-width: 300px;
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
