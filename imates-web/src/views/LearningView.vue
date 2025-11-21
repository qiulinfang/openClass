<template>
  <DraggableDialog
    v-model="localVisible"
    :title="sectionName"
    :initial-width="700"
    :initial-height="500"
    :min-width="700"
    :min-height="500"
    title-align="left"
    header-background-color="#ffffff"
  >
    <div class="learning-content">
      <!-- 主要内容区域 -->
      <div class="main-content">
        <!-- 左侧：学习方案选择 -->
        <div class="left-panel">
          <div class="scheme-section">
            <!-- 加载状态 -->
            <div v-if="loadingPackages" class="loading-container">
              <q-spinner color="primary" size="24px" />
              <div class="loading-text">正在加载学习方案...</div>
            </div>

            <!-- 学习方案列表 -->
            <RubberBandList
              v-else-if="filteredLearningPackages.length > 0"
              class="scroll-wrapper scheme-list"
            >
              <div class="scroll-content-schemeList">
                <div
                  v-for="(scheme, index) in filteredLearningPackages"
                  :key="scheme.id"
                  :class="['scheme-item', { 'scheme-selected': selectedSchemeIndex === index }]"
                  @click="selectScheme(index)"
                >
                  <div class="scheme-header">
                    <span class="scheme-name">{{ scheme.packageName }}</span>
                    <div class="difficulty-rating">
                      <span class="difficulty-label">难度</span>
                      <q-rating
                        :model-value="getDifficultyValue(scheme)"
                        :max="5"
                        size="13px"
                        color="grey"
                        color-selected="yellow"
                        @update:model-value="(value) => updateDifficulty(scheme.id, value)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </RubberBandList>

            <!-- 无数据状态 -->
            <div v-else class="empty-state">
              <q-icon name="school" size="32px" color="grey-5" />
              <div class="empty-text">该章节暂无学习方案</div>
            </div>
          </div>
        </div>

        <!-- 右侧：学习资源列表 -->
        <div class="right-panel">
          <!-- 无方案选择状态 -->
          <div v-if="selectedSchemeIndex < 0" class="empty-resources">
            <q-icon name="folder_open" size="32px" color="grey-5" />
            <div class="empty-text">请先选择学习方案</div>
          </div>

          <!-- 资源文件列表 -->
          <RubberBandList
            v-else-if="currentResources.length > 0"
            class="scroll-wrapper resources-list"
          >
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
                <!-- 缩略图容器 -->
                <div class="resource-thumbnail">
                  <img
                    v-if="resource.thumbnail"
                    :src="resource.thumbnail"
                    :alt="resource.fileName"
                    class="thumbnail-image"
                  />
                  <q-icon
                    v-else
                    :name="getResourceIcon(resource.fileName)"
                    size="32px"
                    color="grey-6"
                  />
                </div>
                <!-- 资源信息 -->
                <div class="resource-info">
                  <div class="resource-title">{{ resource.fileName }}</div>
                  <div class="resource-size">{{ formatFileSize(resource.size) }}</div>
                </div>
                <!-- 操作按钮 -->
                <q-btn
                  size="sm"
                  label="去学习"
                  @click.stop="startLearning(resource)"
                  no-caps
                  rounded
                  class="learning-btn resource-action"
                />
              </div>
            </div>
          </RubberBandList>

          <!-- 无资源状态 -->
          <div v-else class="empty-resources">
            <q-icon name="folder_open" size="32px" color="grey-5" />
            <div class="empty-text">该方案暂无资源文件</div>
          </div>
        </div>
      </div>
    </div>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { resourceManager } from '../services/resource-storage'
import type { LearningPackage, ResourceFile, LocalFileInfo } from '../types'
import RubberBandList from '../components/RubberBandList.vue'
import { authStorageService } from '../services/auth-storage-service'
import DraggableDialog from '../components/DraggableDialog.vue'
import { thumbnailQueue } from '../utils/thumbnail/thumbnail-queue'
import { isPdfFile } from '../utils/thumbnail/pdf-thumbnail'
import { isImageFile } from '../utils/thumbnail/image-thumbnail'
import { isHtmlFile } from '../utils/thumbnail/html-thumbnail'
import { isVideoFile } from '../utils/thumbnail/video-thumbnail'

// Props 定义
interface Props {
  modelValue: boolean // 对话框显示/隐藏
  nodeId?: string // 当前节点ID
  sectionName?: string // 当前章节名称
  level?: number // 当前学习级别
  textbookId?: string // 当前教材ID
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  nodeId: '',
  sectionName: '学习内容',
  level: 1,
  textbookId: '',
})

// Emits 定义
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

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

// 学习方案数据 - 从API获取
const learningPackages = ref<LearningPackage[]>([])
// 本地文件信息 - 用于获取缩略图
const localFiles = ref<LocalFileInfo[]>([])
// 当前教材的textbookId（用于更新缩略图）
const currentTextbookId = ref<string>('')

// 根据章节ID筛选学习方案（与安卓原生保持一致）
const filteredLearningPackages = computed(() => {
  if (!sectionId.value) {
    return learningPackages.value
  }

  return learningPackages.value.filter((pkg) => {
    const hasSectionId = pkg.sectionId && pkg.sectionId.trim() !== ''
    return hasSectionId && pkg.sectionId.toLowerCase() === sectionId.value.toLowerCase()
  })
})

// 当前选中的学习方案
const currentScheme = computed(() => {
  if (
    selectedSchemeIndex.value >= 0 &&
    selectedSchemeIndex.value < filteredLearningPackages.value.length
  ) {
    return filteredLearningPackages.value[selectedSchemeIndex.value]
  }
  return null
})

// 获取当前方案的所有资源文件（带缩略图信息）
const currentResources = computed(() => {
  if (!currentScheme.value) return []

  const resources = currentScheme.value.resourceList || []

  // 为每个资源添加缩略图信息
  return resources.map((resource) => {
    const localFile = localFiles.value.find((file) => file.id === resource.id)
    return {
      ...resource,
      thumbnail: localFile?.thumbnail,
    }
  })
})

// 列表滚动改为使用 RubberBandList 橡皮筋滚动效果，不再依赖 BetterScroll

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

const getDifficultyValue = (scheme: LearningPackage): number => {
  // 优先从 localStorage 读取用户自定义的难度
  const savedDifficulty = getSavedDifficulty(scheme.id)
  if (savedDifficulty !== null) {
    return savedDifficulty
  }

  // 如果 scheme 有 difficulty 属性，使用它；否则默认返回 1
  const schemeWithDifficulty = scheme as LearningPackage & { difficulty?: number }
  return schemeWithDifficulty.difficulty || 1
}

// 从 localStorage 读取保存的难度
const getSavedDifficulty = (packageId: string): number | null => {
  try {
    const DIFFICULTY_KEY = `learning_package_difficulty_${packageId}`
    const saved = localStorage.getItem(DIFFICULTY_KEY)
    if (saved) {
      const value = parseInt(saved, 10)
      if (!isNaN(value) && value >= 1 && value <= 5) {
        return value
      }
    }
  } catch (error) {
    console.error('读取难度失败:', error)
  }
  return null
}

// 保存难度到 localStorage 和 IndexedDB
const updateDifficulty = async (packageId: string, difficulty: number) => {
  try {
    // 验证难度值
    if (isNaN(difficulty) || difficulty < 1 || difficulty > 5) {
      console.warn('无效的难度值:', difficulty)
      return
    }

    // 保存到 localStorage
    const DIFFICULTY_KEY = `learning_package_difficulty_${packageId}`
    localStorage.setItem(DIFFICULTY_KEY, difficulty.toString())

    // 更新到 IndexedDB 的学习包数据中
    if (id.value) {
      const textbook = await resourceManager.getTextbookInfoById(id.value)
      if (textbook && textbook.learningPackages) {
        const packageIndex = textbook.learningPackages.findIndex((pkg) => pkg.id === packageId)
        if (packageIndex !== -1) {
          // 更新学习包的难度属性
          const updatedPackage = {
            ...textbook.learningPackages[packageIndex],
            difficulty: difficulty,
          } as LearningPackage & { difficulty: number }

          textbook.learningPackages[packageIndex] = updatedPackage

          // 保存到 IndexedDB
          await resourceManager.updateTextbookInfo(textbook, undefined)

          // 更新本地响应式数据
          const localPackageIndex = learningPackages.value.findIndex((pkg) => pkg.id === packageId)
          if (localPackageIndex !== -1) {
            learningPackages.value[localPackageIndex] = updatedPackage
          }

          console.log('难度已保存:', packageId, difficulty)
        }
      }
    }
  } catch (error) {
    console.error('保存难度失败:', error)
  }
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
    rar: 'folder_zip',
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

    // 保持对话框打开，不关闭（用户可以在查看PDF的同时继续浏览其他学习资源）
    // localVisible.value = false  // 已移除：保持对话框打开状态

    // 执行路由跳转
    try {
      await router.push({
        name: routeName,
        query: {
          id: id.value,
          textbookName: sectionName.value,
          resourceId: resource.id,
          fileName: resource.fileName,
          packageId: selectedScheme.id,
          packageName: selectedScheme.packageName,
          // 传递学习对话框所需的信息，用于返回时重新打开对话框
          fromLearning: 'true',
          learningNodeId: sectionId.value,
          learningLevel: props.level?.toString() || '1',
        },
      })

      // 路由跳转成功后，标记节点为已学习
      // 只有当节点ID存在且不为空时才标记
      if (sectionId.value && sectionId.value.trim() !== '') {
        markNodeAsLearned(sectionId.value)
      }
    } catch (routeError) {
      console.error('路由跳转失败:', routeError)
    }
  } catch (error) {
    console.error('开始学习失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 标记节点为已学习
const markNodeAsLearned = (nodeId: string) => {
  try {
    const userId = authStorageService.getCurrentUserIdOrDefault()
    const LEARNED_NODES_KEY = `${userId}_LEARNED_NODES`
    // 从localStorage加载已学习的节点ID列表
    const saved = localStorage.getItem(LEARNED_NODES_KEY)
    let learnedNodeIds: Set<string>

    if (saved) {
      const ids = JSON.parse(saved) as string[]
      learnedNodeIds = new Set(ids)
    } else {
      learnedNodeIds = new Set()
    }

    // 添加当前节点到已学习列表
    learnedNodeIds.add(nodeId)

    // 保存回localStorage
    const ids = Array.from(learnedNodeIds)
    localStorage.setItem(LEARNED_NODES_KEY, JSON.stringify(ids))

    console.log('节点已标记为已学习:', nodeId)
  } catch (error) {
    console.error('标记节点为已学习失败:', error)
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
    console.time('教材信息加载')  
    const textbook = await resourceManager.getTextbookInfoById(id.value)
    console.timeEnd('教材信息加载')
    if (textbook && textbook.learningPackages) {
      console.time('学习包数据加载')
      // 保存教材的textbookId（用于更新缩略图）
      currentTextbookId.value = textbook.textbookId
      // 将学习包数据赋值给 learningPackages
      learningPackages.value = textbook.learningPackages
      console.timeEnd('学习包数据加载')
      console.time('教材信息:')
      // 只处理当前章节的包
      if (sectionId.value) {
        const lowerSectionId = sectionId.value.toLowerCase()
        for (const pkg of learningPackages.value) {
          const hasSectionId = pkg.sectionId && pkg.sectionId.trim() !== ''
          if (!hasSectionId || pkg.sectionId!.toLowerCase() !== lowerSectionId) continue
          // 优先使用 IndexedDB 中的难度
          const pkgWithDifficulty = pkg as LearningPackage & { difficulty?: number }
          // 如果学习包中已存在难度，直接使用
          if (pkgWithDifficulty.difficulty !== undefined && pkgWithDifficulty.difficulty !== null) {
            const DIFFICULTY_KEY = `learning_package_difficulty_${pkg.id}`
            localStorage.setItem(DIFFICULTY_KEY, pkgWithDifficulty.difficulty.toString())
            continue
          }
          // 如果学习包中不存在难度，从 localStorage 读取
          const savedDifficulty = getSavedDifficulty(pkg.id)
          if (savedDifficulty !== null) {
            pkgWithDifficulty.difficulty = savedDifficulty
          }
        }
      }
      console.timeEnd('学习包数据加载')
      // 同时加载本地文件信息（用于获取缩略图）
      if (textbook.localFiles) {
        console.time('本地文件信息加载')
        localFiles.value = textbook.localFiles
        console.timeEnd('本地文件信息加载')
      }

      // 自动选择第一个方案
      if (textbook.learningPackages.length > 0) {
        selectedSchemeIndex.value = 0
      }
      
      // 数据加载完成后，延迟检查缩略图（等待UI渲染完成）
      console.time('缩略图检查')
      await checkAndGenerateThumbnails()
      console.timeEnd('缩略图检查')
    } else {
      // 如果没有本地数据，显示空状态
      learningPackages.value = []
      localFiles.value = []
      currentTextbookId.value = ''
    }
  } catch (error) {
    console.error('加载学习包失败:', error)
    learningPackages.value = []
    localFiles.value = []
    currentTextbookId.value = ''
  } finally {
    loadingPackages.value = false
  }
}

// 当章节ID变化时，重置选择状态
const resetSelection = () => {
  selectedSchemeIndex.value = -1
  selectedResourceIndex.value = -1
}

/**
 * 检查并生成资源文件的缩略图
 * 当资源列表显示时，检查每个资源文件是否需要生成缩略图
 */
const checkAndGenerateThumbnails = async () => {
  // 如果没有选中方案或没有教材ID，直接返回
  if (!currentScheme.value || !currentTextbookId.value || !id.value) {
    return
  }

  try {
    // 获取当前方案的所有资源文件
    const resources = currentScheme.value.resourceList || []
    
    // 遍历每个资源文件
    for (const resource of resources) {
      // 第1步：检查是否是支持生成缩略图的文件类型（PDF、图片、HTML或视频）
      const isPdf = isPdfFile(resource.fileName)
      const isImage = isImageFile(resource.fileName)
      const isHtml = isHtmlFile(resource.fileName)
      const isVideo = isVideoFile(resource.fileName)
      
      if (!isPdf && !isImage && !isHtml && !isVideo) {
        // 不支持的文件类型，跳过
        continue
      }
      
      // 第2步：查找对应的本地文件信息
      const localFile = localFiles.value.find(file => file.id === resource.id)
      
      // 第3步：检查是否需要生成缩略图
      // 条件：文件已下载 && 没有缩略图
      if (localFile && localFile.isDownloaded && !localFile.thumbnail) {
        // 第4步：从IndexedDB读取文件数据
        const fileData = await resourceManager.getFileData(id.value, resource.id)
        
        if (fileData && fileData.length > 0) {
          // 第5步：添加到缩略图生成队列
          thumbnailQueue.addTask({
            fileId: resource.id,
            textbookId: currentTextbookId.value,
            fileName: resource.fileName,
            fileData: fileData,
            // 缩略图生成完成后，更新本地localFiles，以便UI立即显示
            onComplete: (fileId: string, thumbnail: string) => {
              const file = localFiles.value.find(f => f.id === fileId)
              if (file) {
                file.thumbnail = thumbnail
                console.log(`[缩略图生成] 已完成: ${resource.fileName}`)
              }
            }
          })
          
          console.log(`[缩略图生成] 已添加任务: ${resource.fileName}`)
        }
      }
    }
  } catch (error) {
    console.error('检查并生成缩略图失败:', error)
  }
}

// 监听 props 变化
watch(
  () => props.nodeId,
  (newNodeId) => {
    sectionId.value = newNodeId
    resetSelection()
    loadLearningPackages()
  },
)

watch(
  () => props.sectionName,
  (newSectionName) => {
    sectionName.value = newSectionName
  },
)

watch(
  () => props.textbookId,
  (newTextbookId) => {
    id.value = newTextbookId
    resetSelection()
    loadLearningPackages()
  },
)

// 监听当前方案变化，触发缩略图检查
watch(
  () => currentScheme.value,
  async (newScheme) => {
    if (newScheme) {
      // 方案切换后，延迟检查缩略图（等待localFiles加载完成）
      await new Promise(resolve => setTimeout(resolve, 100))
      await checkAndGenerateThumbnails()
    }
  },
  { immediate: false }
)

// 监听资源列表变化，触发缩略图检查
watch(
  () => currentResources.value.length,
  async () => {
    if (currentResources.value.length > 0) {
      // 资源列表变化后，检查缩略图
      await checkAndGenerateThumbnails()
    }
  },
  { immediate: false }
)

// BScroll 初始化和刷新由组合式函数自动处理（已启用 autoWatch）

// 生命周期
onMounted(async () => {
  // 如果通过路由访问（没有传入 modelValue 或 modelValue 为 false），自动显示对话框
  if (!props.modelValue && router.currentRoute.value.name === 'learning') {
    localVisible.value = true
  }
  console.time('学习包加载')
  // 加载学习包数据
  await loadLearningPackages()
  console.timeEnd('学习包加载')
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
$elevation-1:
  0 1px 3px rgba(0, 0, 0, 0.12),
  0 1px 2px rgba(0, 0, 0, 0.24);
$elevation-2:
  0 3px 6px rgba(0, 0, 0, 0.16),
  0 3px 6px rgba(0, 0, 0, 0.23);
$elevation-3:
  0 10px 20px rgba(0, 0, 0, 0.19),
  0 6px 6px rgba(0, 0, 0, 0.23);
$elevation-4:
  0 14px 28px rgba(0, 0, 0, 0.25),
  0 10px 10px rgba(0, 0, 0, 0.22);

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
  background-color: #ffffff;
  font-family: 'Roboto', 'Noto Sans', sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 覆盖 DraggableDialog 的 title 样式
:deep(.dialog-header-section) {
  .text-h6 {
    font-size: 20px !important;
    font-weight: 600 !important;
  }
  
  .text-h6.title-align-left {
    font-size: 18px !important;
  }
}

// 主要内容区域
.main-content {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

// 左侧面板
.left-panel {
  width: 200px;
  height: 100%;
  max-height: 100%;

  .scheme-section {
    height: 100%;
    max-height: 100%;
    background-color: transparent;
    border-radius: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
}

// 右侧面板
.right-panel {
  flex: 1;
  min-width: 0;
  height: 100%;
  max-height: 100%;
  background-color: #f5f4ff;
  border-radius: 8px;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  background-color: #f5f4ff;

  .scroll-content-schemeList {
    min-height: calc(100% + 1px);
    background-color: #ffffff;

  }

  .scheme-item {
    margin-bottom: 8px;
    border-radius: 6px;
    padding: 10px 12px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:last-child {
      margin-bottom: 0;
    }

    &.scheme-selected {
      background-color: #f5f4ff;
      box-shadow: none;
      padding: 8px 12px;
    }

    .scheme-header {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .scheme-name {
        font-size: 17px;
        font-weight: 500;
        color: #212121;
        margin-bottom: 4px;
      }

      .difficulty-rating {
        display: flex;
        align-items: center;

        .difficulty-label {
          font-size: 14px;
          color: #212121;
          opacity: 1;
          padding-right: 8px;
        }

        :deep(.q-rating) {
          flex: 0.8;
          font-size: 14px;
        }

        :deep(.q-rating__icon) {
          text-shadow: none;
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
  border-radius: 0;
  background-color: #f5f4ff;

  .scroll-content {
    min-height: calc(100% + 1px);
    background-color: #f5f4ff;
  }

  .resource-item {
    display: flex;
    align-items: center;
    margin: 0px 12px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    background-color: #ffffff;

    &:focus {
      background-color: rgba(106, 85, 255, 0.1);
    }

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .resource-thumbnail {
      width: 60px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #e4e2e2;
      border-radius: 6px;
      margin: 8px;
      flex-shrink: 0;
      overflow: hidden;

      .thumbnail-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 6px;
      }
    }

    .resource-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 53px;

      .resource-title {
        font-size: 16px;
        font-weight: 500;
        color: #212121;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .resource-size {
        font-size: 13px;
        color: #757575;
        opacity: 1;
      }
    }

    .resource-action {
      flex-shrink: 0;
      margin-left: 8px;
      margin-right: 12px;
      align-self: center;
    }
  }
}

// 加载状态样式
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 12px;
  gap: 12px;

  .loading-text {
    color: #757575;
    font-size: 14px;
  }
}

// 空状态样式
.empty-state,
.empty-resources {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 12px;
  gap: 12px;

  .empty-text {
    color: #757575;
    font-size: 14px;
    font-weight: 500;
  }
}

// 学习按钮样式
.learning-btn {
  font-size: 16px;
  padding: 6px 16px;
  width: 100px;
  min-height:40px;
  font-weight: 500;
  border-radius: 12px;
  background-color: #6e55ff;
  color: #ffffff;

  :deep(.q-btn__content) {
    font-size: 14px;
  }

  :deep(.q-btn:before) {
    box-shadow: none;
  }

  &:hover {
    background-color: #5a4abd;
  }
}

// 响应式设计
@media (max-width: 1200px) {
  .main-content {
    gap: 24px;
  }

  .left-panel {
    width: 200px;
  }
}

@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
    gap: 20px;
  }

  .left-panel {
    flex: 0 0 auto;
    width: 100%;
    height: 300px;
    max-width: none;

    .scheme-section {
      height: 100%;
    }
  }

  .right-panel {
    flex: 0 0 auto;
    height: 400px;
    background-color: #f5f4ff;
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: 16px;
    gap: 16px;
  }

  .left-panel .scheme-section {
    background-color: #f5f4ff;
    padding: 16px;
  }

  .right-panel {
    padding: 16px;
  }

  .scheme-item {
    padding: 20px 24px;

    &.scheme-selected {
      padding: 16px 24px;
    }

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
      font-size: 22px;
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
  .main-content {
    padding: 12px;
    gap: 12px;
  }

  .left-panel .scheme-section {
    background-color: #f5f4ff;
    padding: 12px;
  }

  .right-panel {
    padding: 12px;
  }

  .scheme-item,
  .resource-item {
    padding: 12px 16px;

    &.scheme-selected {
      padding: 10px 16px;
    }
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
      width: 100%;
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
