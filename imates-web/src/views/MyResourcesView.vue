<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="my-resources-view">
        <!-- 筛选区域 (固定在顶部) -->
        <div class="filter-section">
          <!-- 标题 -->
          <div class="filter-title">资源下载</div>
          
          <!-- 筛选器区域 -->
          <div class="filter-content">
            <!-- 年级 -->
            <div class="filter-dropdown-item">
              <label class="filter-label">年级:</label>
              <q-select
                v-model="selectedGrade"
                :options="gradeOptions"
                behavior="menu"
                emit-value
                map-options
                outlined
                dense
                class="filter-select"
                @update:model-value="handleFilterChange"
              />
            </div>
            
            <!-- 教材版本 -->
            <div class="filter-dropdown-item">
              <label class="filter-label">教材版本:</label>
              <q-select
                v-model="selectedVersion"
                :options="versionOptions"
                behavior="menu"
                emit-value
                map-options
                outlined
                dense
                class="filter-select"
                @update:model-value="handleFilterChange"
              />
            </div>
            
            <!-- 学科 -->
            <div class="filter-dropdown-item">
              <label class="filter-label">学科:</label>
              <q-select
                v-model="selectedSubject"
                :options="subjectOptions"
                behavior="menu"
                emit-value
                map-options
                outlined
                dense
                class="filter-select"
                @update:model-value="handleFilterChange"
              />
            </div>
            
            <!-- 进度 -->
            <div class="filter-dropdown-item">
              <label class="filter-label">进度:</label>
              <q-select
                v-model="selectedProgress"
                :options="progressOptions"
                behavior="menu"
                emit-value
                map-options
                outlined
                dense
                class="filter-select"
                @update:model-value="handleFilterChange"
              />
            </div>
          </div>
          
          <!-- 标签页区域 -->
          <div class="filter-tabs">
            <div
              v-for="tab in filterTabs"
              :key="tab.value"
              class="filter-tab"
              :class="{ active: activeTab === tab.value }"
              @click="setActiveTab(tab.value)"
            >
              <span class="tab-label">{{ tab.label }}</span>
              <q-badge
                v-if="tab.count > 0"
                color="negative"
                rounded
                class="tab-badge"
              >
                {{ tab.count }}
              </q-badge>
            </div>
          </div>
        </div>

        <!-- 加载状态 (固定) -->
        <div v-if="loading" class="loading-state q-pa-xl text-center">
          <q-spinner-dots size="50px" color="primary" />
          <div class="text-h6 text-grey-6 q-mt-md">正在加载资源...</div>
        </div>

        <!-- better-scroll 滚动容器 (仅包含教材列表) -->
        <div v-if="!loading && textbooks.length > 0" ref="scrollWrapper" class="scroll-wrapper">
          <div class="scroll-content">
            <!-- 教材列表 -->
            <div class="textbooks-container q-pa-md">
              <div class="textbooks-scroll-container">
                <div class="textbooks-grid">
                  <!-- 图片样式布局：左右结构 -->
                  <div
                    v-for="textbook in filteredTextbooks"
                    :key="textbook.id"
                    class="textbook-card"
                    :class="{
                      downloading: textbook.downloadStatus === 1,
                      paused: textbook.downloadStatus === 3,
                    }"
                  >
                    <!-- 左侧：封面图片 -->
                    <div class="textbook-cover">
                      <img
                        :src="getCoverImageUrl(textbook.textbookCover)"
                        :alt="textbook.textbookName"
                        loading="lazy"
                      />
                    </div>

                    <!-- 右侧：信息区域 -->
                    <div class="textbook-content">
                      <!-- 左侧：标题、版本和状态指示器 -->
                      <div class="textbook-info">
                        <!-- 标题和版本 -->
                        <div class="textbook-header">
                          <div class="textbook-title">{{ textbook.textbookName }}</div>
                          <div class="textbook-version">{{ textbook.textbookPublisher || '人教版' }}</div>
                        </div>
                        
                        <!-- 状态指示器 -->
                        <div class="status-indicator"
                          :class="{
                            'status-indicator-red': textbook.downloadStatus === 0,
                            'status-indicator-blue': textbook.downloadStatus === 1,
                            'status-indicator-green': textbook.downloadStatus === 2 && textbook.isDownloaded,
                            'status-indicator-orange': textbook.downloadStatus === 3 || textbook.hasUpdatesAvailable
                          }">
                          <!-- 未下载 -->
                          <template v-if="textbook.downloadStatus === 0">
                            <span class="status-dot status-dot-red"></span>
                            <span class="status-text">未下载</span>
                          </template>
                          <!-- 下载中 -->
                          <template v-else-if="textbook.downloadStatus === 1">
                            <span class="status-dot status-dot-blue"></span>
                            <span class="status-text">正在下载</span>
                          </template>
                          <!-- 下载完成 -->
                          <template v-else-if="textbook.downloadStatus === 2 && textbook.isDownloaded">
                            <span class="status-dot status-dot-green"></span>
                            <span class="status-text">下载完成</span>
                          </template>
                          <!-- 暂停 -->
                          <template v-else-if="textbook.downloadStatus === 3">
                            <span class="status-dot status-dot-orange"></span>
                            <span class="status-text">已暂停</span>
                          </template>
                          <!-- 有更新 -->
                          <template v-else-if="textbook.hasUpdatesAvailable">
                            <span class="status-dot status-dot-orange"></span>
                            <span class="status-text">有更新</span>
                          </template>
                        </div>
                      </div>

                      <!-- 右侧：操作按钮或进度条 -->
                      <div class="textbook-actions">
                          <!-- 下载中状态：显示进度条 -->
                          <template v-if="textbook.downloadStatus === 1">
                            <div class="download-progress-bar">
                              <div class="progress-bar-container">
                                <div 
                                  class="progress-bar-fill" 
                                  :style="{ width: Math.round((textbook.downloadedFiles / textbook.totalFiles) * 100) + '%' }"
                                ></div>
                                <span class="progress-text">{{ Math.round((textbook.downloadedFiles / textbook.totalFiles) * 100) }}%</span>
                              </div>
                            </div>
                          </template>
                          
                          <!-- 暂停状态：显示继续 -->
                          <template v-else-if="textbook.downloadStatus === 3">
                            <q-btn 
                              color="primary" 
                              label="继续" 
                              @click="downloadTextbook(textbook)" 
                              size="sm" 
                              unelevated 
                              no-caps
                              class="action-btn action-btn-download"
                            />
                          </template>
                          
                          <!-- 已下载状态：显示更新 -->
                          <template v-else-if="textbook.isDownloaded && textbook.downloadStatus === 2 && textbook.hasUpdatesAvailable">
                            <q-btn 
                              color="secondary" 
                              label="更新" 
                              @click="updateTextbook(textbook)" 
                              size="sm" 
                              unelevated 
                              no-caps
                              class="action-btn action-btn-update"
                            />
                          </template>
                          
                          <!-- 未下载或部分下载状态：显示下载/继续 -->
                          <template v-else>
                            <q-btn 
                              color="primary" 
                              label="下载" 
                              @click="downloadTextbook(textbook)" 
                              size="sm" 
                              unelevated 
                              no-caps
                              class="action-btn action-btn-download"
                            />
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>
                 </div>
               </div>
             </div>
          </div>

        <!-- 空状态 (固定) -->
            <div
              v-if="initialLoadCompleted && textbooks.length === 0"
              class="empty-state q-pa-xl text-center"
            >
              <q-icon name="book" size="80px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">暂无教材数据</div>
              <div class="text-body2 text-grey-5 q-mt-sm">请检查网络连接或重新登录</div>
              <q-btn
                color="primary"
                label="重新加载"
                icon="refresh"
                @click="loadResources"
                class="q-mt-md"
                unelevated
                rounded
              />
            </div>

        <!-- 调试面板 -->
        <ResourceDebugPanel v-if="isDev" :visible="showDebugPanel" @close="showDebugPanel = false" />

        <!-- 删除教材确认对话框 -->
        <q-dialog v-model="showDeleteDialog" persistent>
          <q-card style="min-width: 350px">
            <q-card-section>
              <div class="text-h6">删除教材</div>
            </q-card-section>

            <q-card-section class="q-pt-none">
              <div class="text-body1">
                确定要删除《{{ deleteTextbookName }}》吗？
              </div>
              <div class="text-body2 text-grey-7 q-mt-sm">
                删除后，该教材及其所有相关文件将从本地完全移除，且无法恢复。
              </div>
            </q-card-section>

            <q-card-actions align="right">
              <q-btn flat label="取消" color="grey" @click="showDeleteDialog = false" />
              <q-btn flat label="确定" color="negative" @click="confirmDeleteTextbook" :loading="deleting" />
            </q-card-actions>
          </q-card>
        </q-dialog>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { resourceManager } from '../services/resource-storage'
import { apiService } from '../services/api-service'
import { httpClient } from '../services/http-client'
import { showMessage } from '../utils'
import type { UserTextbookInfo } from '../types'
import ResourceDebugPanel from '../components/debug/ResourceDebugPanel.vue'
import { useBetterScroll } from '../composables/useBetterScroll'

// 第1步：判断是否显示调试功能（仅通过环境变量控制）
// 必须设置 VITE_ENABLE_DEBUG 环境变量来控制调试功能的显示
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

// 流程：移除PullDown插件导入，不再使用下拉刷新功能

// 流程：导入图标资源
import bookIcon from '/icons/book.svg'

// 路由
const router = useRouter()

// 响应式数据
const loading = ref(false)
const checkingUpdates = ref(false)
const textbooks = ref<UserTextbookInfo[]>([])
const selectedSubjects = ref(new Set<string>())
const updateCount = ref(0)
const showDebugPanel = ref(false)

// 筛选器数据
const selectedGrade = ref<string>('')
const selectedVersion = ref<string>('')
const selectedSubject = ref<string>('')
const selectedProgress = ref<string>('')
const activeTab = ref<string>('all')

// 筛选器选项
const gradeOptions = ref([
  { label: '全部', value: '' },
  { label: '高一', value: '高一' },
  { label: '高二', value: '高二' },
  { label: '高三', value: '高三' },
  { label: '初一', value: '初一' },
  { label: '初二', value: '初二' },
  { label: '初三', value: '初三' },
])

const versionOptions = ref([
  { label: '全部', value: '' },
  { label: '人教版', value: '人教版' },
  { label: '苏教版', value: '苏教版' },
  { label: '北师大版', value: '北师大版' },
  { label: '华师大版', value: '华师大版' },
])

const subjectOptions = ref([
  { label: '全部', value: '' },
  { label: '数学', value: '数学' },
  { label: '语文', value: '语文' },
  { label: '英语', value: '英语' },
  { label: '物理', value: '物理' },
  { label: '化学', value: '化学' },
  { label: '生物', value: '生物' },
  { label: '历史', value: '历史' },
  { label: '地理', value: '地理' },
  { label: '政治', value: '政治' },
])

// 进度选项 - 根据年级动态生成
const progressOptions = computed(() => {
  const baseOptions = [{ label: '全部', value: '' }]
  
  // 判断是否为初中
  const isMiddleSchool = selectedGrade.value === '初一' || 
                         selectedGrade.value === '初二' || 
                         selectedGrade.value === '初三'
  
  // 判断是否为高中
  const isHighSchool = selectedGrade.value === '高一' || 
                       selectedGrade.value === '高二' || 
                       selectedGrade.value === '高三'
  
  if (isMiddleSchool) {
    // 初中：上册和下册
    baseOptions.push(
      { label: '上册', value: '上册' },
      { label: '下册', value: '下册' }
    )
  } else if (isHighSchool) {
    // 高中：必修和选修
    baseOptions.push(
      { label: '必修', value: '必修' },
      { label: '选修', value: '选修' }
    )
  }
  
  return baseOptions
})

// 删除教材相关状态
const showDeleteDialog = ref(false)
const deleting = ref(false)
const deleteTextbookId = ref<string | null>(null)
const deleteTextbookName = ref('')

// 新增：本地数据优先显示相关状态
const hasLocalData = ref(false)
const initialLoadCompleted = ref(false)

// better-scroll 相关
const scrollWrapper = ref<HTMLElement | null>(null)

// 分类选项 - 基于学科动态生成
const categories = ref([{ label: '全部', value: 'all' }])

// 标签页数据（带计数）
const filterTabs = computed(() => {
  const notDownloaded = textbooks.value.filter(t => !t.isDownloaded || t.downloadStatus === 0).length
  const pendingUpdate = textbooks.value.filter(t => t.hasUpdatesAvailable || (t.isDownloaded && t.downloadStatus !== 2)).length

  return [
    { label: '全部', value: 'all', count: 0 },
    { label: '未下载', value: 'notDownloaded', count: notDownloaded },
    { label: '已下载', value: 'downloaded', count: 0 },
    { label: '待更新', value: 'pendingUpdate', count: pendingUpdate },
  ]
})

// 计算属性 - 支持新的筛选逻辑（年级、版本、学科、进度、标签页）
const filteredTextbooks = computed(() => {
  let result: UserTextbookInfo[] = [...textbooks.value]

  // 年级筛选
  if (selectedGrade.value) {
    result = result.filter((textbook) => textbook.textbookGradeLabel === selectedGrade.value)
  }

  // 版本筛选
  if (selectedVersion.value) {
    result = result.filter((textbook) => textbook.textbookPublisher === selectedVersion.value)
  }

  // 学科筛选
  if (selectedSubject.value) {
    result = result.filter((textbook) => textbook.textbookSubjectLabel === selectedSubject.value)
  }

  // 进度筛选（根据学期标签）
  if (selectedProgress.value) {
    result = result.filter((textbook) => {
      // 这里可以根据实际需求匹配学期标签或教材名称
      return textbook.textbookSemesterLabel?.includes(selectedProgress.value) || 
             textbook.textbookName?.includes(selectedProgress.value)
    })
  }

  // 标签页筛选
  if (activeTab.value === 'notDownloaded') {
    result = result.filter((textbook) => !textbook.isDownloaded || textbook.downloadStatus === 0)
  } else if (activeTab.value === 'downloaded') {
    result = result.filter((textbook) => textbook.isDownloaded && textbook.downloadStatus === 2 && !textbook.hasUpdatesAvailable)
  } else if (activeTab.value === 'pendingUpdate') {
    result = result.filter((textbook) => textbook.hasUpdatesAvailable || (textbook.isDownloaded && textbook.downloadStatus !== 2))
  }
  // 'all' 标签页不需要额外筛选

  // 排序确保每次加载顺序一致
  return result.sort((a, b) => {
    // 先按学科排序
    if (a.textbookSubjectLabel !== b.textbookSubjectLabel) {
      return a.textbookSubjectLabel.localeCompare(b.textbookSubjectLabel)
    }
    // 再按年级排序
    if (a.textbookGradeLabel !== b.textbookGradeLabel) {
      return a.textbookGradeLabel.localeCompare(b.textbookGradeLabel)
    }
    // 最后按教材名称排序
    return a.textbookName.localeCompare(b.textbookName)
  })
})

// 使用 Better Scroll 组合式函数
const { init: initBScroll } = useBetterScroll(
  scrollWrapper,
  {
    scrollY: true,
    scrollX: false,
    click: true,
    probeType: 2,
    bounce: {
      top: true,
      bottom: true,
    },
    bounceTime: 800,
    deceleration: 0.003,
    useTransition: true,
    HWCompositing: true,
  },
  true, // 自动监听数据变化
  [
    () => filteredTextbooks.value.length,
    () => textbooks.value.length
  ]
)
// 第2步：移除pullDownRefreshStatus状态，不再需要下拉刷新状态管理

// 切换学科选择
// 流程：获取完整的封面图片URL（处理file://环境）
const getCoverImageUrl = (coverUrl: string | undefined): string => {
  if (!coverUrl) return bookIcon

  // 流程：使用httpClient.buildFullUrl处理URL
  // 这会在file://环境下将相对路径转换为完整URL
  return httpClient.buildFullUrl(coverUrl)
}

// 处理筛选变化
const handleFilterChange = () => {
  // 当年级改变时，检查当前进度是否在新的选项中
  // 如果不在，清空进度选择
  if (selectedProgress.value) {
    const currentProgressValid = progressOptions.value.some(
      option => option.value === selectedProgress.value
    )
    if (!currentProgressValid) {
      selectedProgress.value = ''
    }
  }
  // 筛选逻辑已在 computed 中实现，这里可以添加其他处理
  // 如果需要，可以在这里触发数据重新计算或其他操作
}

// 设置活动标签页
const setActiveTab = (tab: string) => {
  activeTab.value = tab
}

// 合并服务器数据和本地数据 - 优化版本：先解构本地数据，再解构服务器数据
const mergeServerAndLocalData = (
  serverTextbooks: UserTextbookInfo[],
  localTextbooks: UserTextbookInfo[],
): UserTextbookInfo[] => {
  const mergedTextbooks: UserTextbookInfo[] = []

  // 0. 先对服务器数据进行去重处理（基于id）
  const uniqueServerTextbooks = serverTextbooks.reduce((acc: UserTextbookInfo[], current) => {
    const existingIndex = acc.findIndex((item) => item.id === current.id)
    if (existingIndex === -1) {
      // 不存在，直接添加
      acc.push(current)
    } else {
      // 存在重复，保留最新的（使用更大的id值）
      const existing = acc[existingIndex]
      if (current.id && existing.id && current.id > existing.id) {
        acc[existingIndex] = current
      } else {
      }
    }
    return acc
  }, [])

  // 1. 先添加所有去重后的服务器教材
  uniqueServerTextbooks.forEach((serverTextbook) => {
    // 查找对应的本地教材（通过textbookId匹配）
    const localTextbook = localTextbooks.find(
      (local) => local.textbookId === serverTextbook.textbookId,
    )

    if (localTextbook) {
      // 🔥 优化：先解构本地数据，再解构服务器数据，避免属性丢失
      const mergedTextbook: UserTextbookInfo = {
        // 先解构本地数据，保留本地状态和进度信息
        ...localTextbook,
        // 再解构服务器数据，更新服务器的最新信息（会覆盖本地的旧信息）
        ...serverTextbook,
        // 确保使用服务器的id字段作为主键
        id: serverTextbook.id || serverTextbook.textbookId,
        // 🔥 显式保留本地的localFiles字段（包含fileData），防止被服务器数据覆盖
        localFiles: localTextbook.localFiles || [],
        // 🔥 保留本地的下载状态字段
        downloadStatus: localTextbook.downloadStatus,
        downloadedFiles: localTextbook.downloadedFiles,
        isDownloaded: localTextbook.isDownloaded,
        lastDownloadTime: localTextbook.lastDownloadTime,
        // 保留方法（如果存在）
        updateStructure: localTextbook.updateStructure || (() => {}),
        updatePackages: localTextbook.updatePackages || (() => {}),
        getLocalResourceFileName: localTextbook.getLocalResourceFileName || (() => ''),
      }
      mergedTextbooks.push(mergedTextbook)
    } else {
      // 服务器新教材，添加到列表
      mergedTextbooks.push({
        ...serverTextbook,
        id: serverTextbook.id || serverTextbook.textbookId, // 🔥 确保有id字段作为主键
        isDownloaded: false,
        downloadStatus: 0,
        downloadedFiles: 0,
        totalFiles: 0,
        downloadPath: '',
        lastDownloadTime: '',
        learningPackages: [],
        structure: [], // 🔥 初始化空结构
        hasUpdatesAvailable: false, // 🔥 初始化更新状态
        localFiles: [], // 🔥 初始化空本地文件列表
        // 初始化方法
        updateStructure: () => {},
        updatePackages: () => {},
        getLocalResourceFileName: () => '',
      })
    }
  })

  // 2. 添加本地独有的教材（如果存在）
  localTextbooks.forEach((localTextbook) => {
    const existsInServer = uniqueServerTextbooks.some(
      (server) => server.textbookId === localTextbook.textbookId,
    )
    if (!existsInServer) {
      mergedTextbooks.push(localTextbook)
    }
  })

  return mergedTextbooks
}

// 加载本地数据（优先显示）
const loadLocalData = async (): Promise<UserTextbookInfo[]> => {
  try {
    // 从IndexedDB获取本地教材数据
    const localTextbooks = await resourceManager.getUserLocalTextbooks()

    if (localTextbooks && localTextbooks.length > 0) {
      hasLocalData.value = true
      return localTextbooks
    } else {
      hasLocalData.value = false
      return []
    }
  } catch {
    hasLocalData.value = false
    return []
  }
}

// 为所有教材检查学习资源包（并行处理）
const checkLearningPackagesForAllTextbooks = async (textbooks: UserTextbookInfo[]) => {
  // 并行处理所有教材的学习资源包检查
  const checkPromises = textbooks.map(async (textbook) => {
    try {
      // 调用 getLearningResources 检查学习资源包
      const packages = await apiService.getLearningResources(textbook.id, false)

      if (packages && packages.length > 0) {
        // 有学习资源包，更新教材信息
        textbook.learningPackages = packages
      } else {
        // 没有学习资源包
        textbook.learningPackages = []
      }
    } catch {
      // 检查失败，标记为无学习资源
      textbook.learningPackages = []
    }
  })

  // 等待所有检查完成
  await Promise.all(checkPromises)
}

// 检测和修复不一致的下载状态 - 优化版本，批量处理
const fixInconsistentDownloadStatus = async (textbooks: UserTextbookInfo[]) => {
  const updatesToSave: Array<{textbook: UserTextbookInfo, updates: {
    downloadStatus: number
    isDownloaded: boolean
    downloadedFiles: number
  }}> = []

  // 第1步：快速检查需要修复的教材
  for (const textbook of textbooks) {
    if (textbook.downloadStatus === 1) {
      const hasActiveDownload = apiService.hasActiveDownload(textbook.textbookId)
      
      if (!hasActiveDownload) {
        // 根据下载进度判断状态
        let newStatus: number
        let isDownloaded: boolean
        let downloadedFiles: number
        
        if (textbook.downloadedFiles > 0 && textbook.downloadedFiles < textbook.totalFiles) {
          newStatus = 3
          isDownloaded = false
          downloadedFiles = textbook.downloadedFiles
        } else if (textbook.downloadedFiles === textbook.totalFiles && textbook.totalFiles > 0) {
          newStatus = 2
          isDownloaded = true
          downloadedFiles = textbook.downloadedFiles
        } else {
          newStatus = 0
          isDownloaded = false
          downloadedFiles = 0
        }
        
        // 更新内存中的状态
        textbook.downloadStatus = newStatus
        textbook.isDownloaded = isDownloaded
        textbook.downloadedFiles = downloadedFiles
        
        // 收集需要保存的更新
        updatesToSave.push({
          textbook,
          updates: {
            downloadStatus: newStatus,
            isDownloaded,
            downloadedFiles
          }
        })
      }
    }
  }

  // 第2步：批量保存更新（如果有需要修复的）
  if (updatesToSave.length > 0) {
    const savePromises = updatesToSave.map(({textbook, updates}) => 
      resourceManager.updateTextbookInfo(textbook, updates)
    )
    await Promise.all(savePromises)
  }
}

// 加载资源数据（优化版本：本地数据优先显示）
const loadResources = async () => {
  // 重置初始加载状态
  initialLoadCompleted.value = false

  // 流程：立即加载本地数据
  const localTextbooks = await loadLocalData()
  if (localTextbooks.length > 0) {
    // 流程：有本地数据，立即显示
    textbooks.value = localTextbooks
    updateSubjectChips()
    initialLoadCompleted.value = true

    // 流程：在DOM更新后修复下载状态（不后台同步，用户可通过"检查更新"按钮手动同步）
    nextTick(() => {
      fixInconsistentDownloadStatus(localTextbooks)
    })
  } else {
    // 无本地数据，显示加载状态并获取服务器数据
    loading.value = true

    try {
      // 检查登录状态
      if (!resourceManager.isLoggedIn()) {
        // 尝试自动登录
        const autoLoginSuccess = await apiService.autoLogin(true)
        if (!autoLoginSuccess) {
          textbooks.value = []
          initialLoadCompleted.value = true
          return
        }
      }

      // 获取服务器教材数据
      const serverTextbooks = await apiService.fetchUserAllOnlineTextbooks()

      // 合并服务器数据和本地数据
      const mergedTextbooks = mergeServerAndLocalData(serverTextbooks, [])

      // 为每个教材检查学习资源包（并行处理）
      await checkLearningPackagesForAllTextbooks(mergedTextbooks)

      // 更新本地教材数据
      for (const textbook of mergedTextbooks) {
        await resourceManager.updateTextbookInfo(textbook)
      }

      // 更新教材列表
      textbooks.value = mergedTextbooks
      updateSubjectChips()
    } catch {
      showMessage('加载资源失败，请稍后重试', 'error')
      textbooks.value = []
    } finally {
      loading.value = false
      initialLoadCompleted.value = true
    }
  }
}

// BScroll 初始化由组合式函数处理

// 更新学科筛选选项 - 优化版本，避免重复计算
const updateSubjectChips = () => {
  // 第1步：检查是否需要更新（避免重复计算）
  const currentSubjects = new Set(textbooks.value.map((t) => t.textbookSubjectLabel))
  const currentSubjectKeys = Array.from(currentSubjects).sort().join(',')
  const lastSubjectKeys = categories.value.map(c => c.value).sort().join(',')
  
  if (currentSubjectKeys === lastSubjectKeys) {
    // 学科没有变化，跳过更新
    if (selectedSubjects.value.size === 0) {
      selectedSubjects.value.add('all')
    }
    return
  }

  // 第2步：构建新的学科选项
  const newCategories = [{ label: '全部', value: 'all' }]
  currentSubjects.forEach((subject) => {
    newCategories.push({ label: subject, value: subject })
  })

  categories.value = newCategories

  // 第3步：默认选择"全部"
  if (selectedSubjects.value.size === 0) {
    selectedSubjects.value.add('all')
  }
}

// 第11步：处理检查更新按钮点击
const handleCheckUpdates = async () => {
  // 第12步：调用检查更新逻辑
  await checkForUpdates()
}

// 检查更新 - 三级对比版本
const checkForUpdates = async () => {
  checkingUpdates.value = true

  try {
    // 开始执行三级更新检查
    const updatedTextbooks = await apiService.checkForUpdates()

    // 第一步：重置所有本地教材的更新状态（清除之前的更新标记）
    const resetPromises = textbooks.value.map(async (textbook) => {
      textbook.hasUpdatesAvailable = false
      
      // 🔥 保存更新状态到 IndexedDB（重置为无更新）
      await resourceManager.updateTextbookInfo(textbook, {
        hasUpdatesAvailable: false,
      })
    })

    // 等待所有重置完成
    await Promise.all(resetPromises)

    // 第二步：遍历服务器返回的需要更新的教材，在本地教材中查找并标记
    if (updatedTextbooks.length > 0) {
      const updatePromises = updatedTextbooks.map(async (updatedTextbook) => {
        // 在本地教材列表中查找对应的教材（通过 textbookId 匹配）
        const localTextbook = textbooks.value.find(
          (textbook) => textbook.textbookId === updatedTextbook.textbookId,
        )

        if (localTextbook) {
          // 找到了本地教材，标记为有更新
          localTextbook.hasUpdatesAvailable = true

          // 🔥 保存更新状态到 IndexedDB（标记为有更新）
          await resourceManager.updateTextbookInfo(localTextbook, {
            hasUpdatesAvailable: true,
          })
        } else {
          // 本地没有找到对应的教材（可能是新教材或已被删除）
          // 可以选择忽略，或者如果需要，可以添加到本地列表
          console.log(`[检查更新] 发现新教材或本地未找到: ${updatedTextbook.textbookName} (${updatedTextbook.textbookId})`)
        }
      })

      // 等待所有更新完成
      await Promise.all(updatePromises)

      updateCount.value = updatedTextbooks.length
      showMessage(`发现 ${updatedTextbooks.length} 个教材有更新`, 'success')
    } else {
      // 服务器没有返回需要更新的教材，所有教材都是最新版本
      updateCount.value = 0
      showMessage('所有教材都是最新版本', 'info')
    }
  } catch {
    showMessage('检查更新失败，请稍后重试', 'error')
  } finally {
    checkingUpdates.value = false
  }
}

// 下载教材 - 直接使用ApiService，移除不必要的中介方法
const downloadTextbook = async (textbook: UserTextbookInfo) => {
  // 🔒 防重复下载：检查是否已在下载中
  if (textbook.downloadStatus === 1) {
    console.warn(`[防重复下载] 教材《${textbook.textbookName}》已在下载中，忽略重复请求`)
    showMessage(`《${textbook.textbookName}》正在下载中，请勿重复操作`, 'warning')
    return
  }

  // 🔒 防重复下载：检查是否已下载完成
  if (textbook.downloadStatus === 2 && textbook.isDownloaded) {
    console.warn(`[防重复下载] 教材《${textbook.textbookName}》已下载完成，忽略重复请求`)
    return
  }

  // 设置下载状态
  textbook.downloadStatus = 1 // 下载中
  textbook.isDownloaded = false

  // ApiService.downloadTextbook内部会优先使用本地已有的学习资源包数据，无需重复处理

  try {
    // 1. 直接使用ApiService下载（优先使用本地已有的学习资源包数据）
    const success = await apiService.downloadTextbook(
      textbook,
      async (progress, downloadedCount) => {
        console.log('progress', progress, 'downloadedCount', downloadedCount)
        console.log(new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}))
        // 更新下载进度 - 使用实际下载的文件数
        textbook.downloadedFiles = downloadedCount
      },
    )

    // 现在数据会立即保存到IndexedDB，直接打印数据
    printLocalFilesData()

    if (success) {
      // 下载成功 - 需要从 IndexedDB 获取完整数据（包含 fileData）后再更新状态
      // 因为当前的 textbook 对象中的 localFiles 可能不包含 fileData（被瘦身处理了）
      const fullTextbook = await resourceManager.indexedDB.get('textbooks', textbook.id) as UserTextbookInfo
      
      if (fullTextbook) {
        // 更新完整教材的状态
        fullTextbook.isDownloaded = true
        fullTextbook.downloadStatus = 2 // 下载完成
        fullTextbook.downloadedFiles = fullTextbook.totalFiles
        fullTextbook.lastDownloadTime = new Date().toISOString()
        fullTextbook.hasUpdatesAvailable = false

        // 保存完整教材数据到IndexedDB（包含 localFiles 中的 fileData）
        await resourceManager.updateTextbookInfo(fullTextbook, {
          isDownloaded: true,
          downloadStatus: 2,
          downloadedFiles: fullTextbook.totalFiles,
          lastDownloadTime: new Date().toISOString(),
          hasUpdatesAvailable: false,
        })

        // 更新Vue组件中的textbook对象（用于显示）
        Object.assign(textbook, {
          ...fullTextbook,
          // 保留显示用的方法
          updateStructure: textbook.updateStructure,
          updatePackages: textbook.updatePackages,
          getLocalResourceFileName: textbook.getLocalResourceFileName
        })
      } else {
        // 如果无法获取完整数据，使用当前textbook更新
        textbook.isDownloaded = true
        textbook.downloadStatus = 2
        textbook.downloadedFiles = textbook.totalFiles
        textbook.lastDownloadTime = new Date().toISOString()
        textbook.hasUpdatesAvailable = false

        await resourceManager.updateTextbookInfo(textbook, {
          isDownloaded: true,
          downloadStatus: 2,
          downloadedFiles: textbook.totalFiles,
          lastDownloadTime: new Date().toISOString(),
          hasUpdatesAvailable: false,
        })
      }

      showMessage(`《${textbook.textbookName}》下载完成`, 'success')
    } else {
      // 下载失败
      textbook.downloadStatus = 0 // 下载失败
      textbook.isDownloaded = false

      showMessage(`《${textbook.textbookName}》下载失败`, 'error')
    }
  } catch (error) {
    // 修复：区分用户主动暂停和真正的下载失败
    if (error instanceof Error && error.name === 'AbortError') {
      // 用户主动暂停下载，保持暂停状态
      textbook.downloadStatus = 3 // 已暂停
      textbook.isDownloaded = false

      // 保存暂停状态到IndexedDB（使用立即更新）
      await resourceManager.updateTextbookInfo(textbook, {
        downloadStatus: 3,
        isDownloaded: false,
        downloadedFiles: textbook.downloadedFiles, // 🔥 保存已下载的文件数量
      })
    } else {
      // 真正的下载失败
      textbook.downloadStatus = 0 // 下载失败
      textbook.isDownloaded = false

      showMessage(
        `《${textbook.textbookName}》下载失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'error',
      )
    }
  }
}

// 暂停下载 - 直接使用ApiService
const pauseDownload = async (textbook: UserTextbookInfo) => {
  try {
    const success = await apiService.pauseDownload(textbook.textbookId)
    console.log('暂停')
    if (success) {
      textbook.downloadStatus = 3 // 已暂停
      textbook.isDownloaded = false

      // 保存暂停状态到IndexedDB（使用立即更新）
      await resourceManager.updateTextbookInfo(textbook, {
        downloadStatus: 3,
        isDownloaded: false,
        downloadedFiles: textbook.downloadedFiles, // 🔥 保存已下载的文件数量
      })
    } else {
      showMessage(`暂停《${textbook.textbookName}》失败`, 'error')
    }
  } catch (error) {
    showMessage(
      `暂停《${textbook.textbookName}》失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'error',
    )
  }
}

// 取消下载 - 直接使用ApiService
const cancelDownload = async (textbook: UserTextbookInfo) => {
  try {
    const success = await apiService.cancelDownload(textbook.textbookId)

    if (success) {
      // 重置下载状态
      textbook.downloadStatus = 0 // 未下载
      textbook.isDownloaded = false
      textbook.downloadedFiles = 0
        textbook.totalFiles = 0
        textbook.lastDownloadTime = ''

        // 保存取消状态到IndexedDB（使用立即更新）
        await resourceManager.updateTextbookInfo(textbook, {
          downloadStatus: 0,
          isDownloaded: false,
          downloadedFiles: 0,
          totalFiles: 0,
          lastDownloadTime: '',
        })
    } else {
      showMessage(`取消《${textbook.textbookName}》下载失败`, 'error')
    }
  } catch (error) {
    showMessage(
      `取消《${textbook.textbookName}》下载失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'error',
    )
  }
}

// 查看教材
const viewTextbook = (textbook: UserTextbookInfo) => {
  // 跳转到PDF查看页面，并传递教材信息
  router.push({
    name: 'pdfViewer',
    query: {
      textbookId: textbook.textbookId,
      textbookName: textbook.textbookName,
    },
  })
}

// 跳转到知识图谱
const goToKnowledgeGraph = (textbook: UserTextbookInfo) => {
  router.push({
    name: 'knowledgeGraph',
    query: {
      textbookId: textbook.textbookId,
      textbookName: textbook.textbookName,
    },
  })
}

// 更新教材 - 基于安卓原生逻辑完善
const updateTextbook = (textbook: UserTextbookInfo) => {
  // 重置更新状态
  textbook.hasUpdatesAvailable = false
  textbook.downloadStatus = 1 // 开始更新下载
  textbook.isDownloaded = false

  // 开始下载更新
  downloadTextbook(textbook)
}

// 处理删除教材 - 显示确认对话框
const handleDeleteTextbook = (textbook: UserTextbookInfo) => {
  // 如果正在下载或暂停，先取消下载
  if (textbook.downloadStatus === 1 || textbook.downloadStatus === 3) {
    // 先取消下载任务
    apiService.cancelDownload(textbook.textbookId).catch(() => {
      // 忽略取消下载的错误，继续删除流程
    })
  }

  // 显示删除确认对话框
  deleteTextbookId.value = textbook.id
  deleteTextbookName.value = textbook.textbookName
  showDeleteDialog.value = true
}

// 确认删除教材
const confirmDeleteTextbook = async () => {
  if (!deleteTextbookId.value) {
    return
  }

  deleting.value = true

  try {
    // 第1步：再次检查是否有正在进行的下载，如果有则取消
    const textbookToDelete = textbooks.value.find(t => t.id === deleteTextbookId.value)
    if (textbookToDelete && (textbookToDelete.downloadStatus === 1 || textbookToDelete.downloadStatus === 3)) {
      try {
        await apiService.cancelDownload(textbookToDelete.textbookId)
      } catch {
        // 忽略取消下载的错误，继续删除流程
      }
    }

    // 第2步：删除教材及其所有相关数据
    const success = await resourceManager.deleteTextbook(deleteTextbookId.value)

    if (success) {
      // 第3步：从列表中移除教材
      const index = textbooks.value.findIndex(t => t.id === deleteTextbookId.value)
      if (index !== -1) {
        textbooks.value.splice(index, 1)
      }

      // 第4步：如果删除后列表为空，重新加载数据
      if (textbooks.value.length === 0) {
        await loadResources()
      }

      showMessage(`《${deleteTextbookName.value}》已删除`, 'success')
      showDeleteDialog.value = false
    } else {
      showMessage(`删除《${deleteTextbookName.value}》失败`, 'error')
    }
  } catch (error) {
    console.error('删除教材失败:', error)
    showMessage(
      `删除《${deleteTextbookName.value}》失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'error',
    )
  } finally {
    deleting.value = false
    deleteTextbookId.value = null
    deleteTextbookName.value = ''
  }
}

// 生命周期
onMounted(async () => {
  // 第1步：记录 onMounted 开始时间
  const mountStartTime = performance.now()
  console.warn(`[onMounted] 开始时间: ${new Date().toLocaleTimeString('zh-CN')}`)

  // 第2步：加载资源数据
  const loadResourcesStartTime = performance.now()
  await loadResources()
  const loadResourcesEndTime = performance.now()
  console.warn(`[onMounted] loadResources 耗时: ${(loadResourcesEndTime - loadResourcesStartTime).toFixed(2)}ms`)

  // 第3步：初始化 better-scroll
  const initBScrollStartTime = performance.now()
  await initBScroll()
  const initBScrollEndTime = performance.now()
  console.warn(`[onMounted] initBScroll 耗时: ${(initBScrollEndTime - initBScrollStartTime).toFixed(2)}ms`)

  // 第4步：清理过期数据 - 延迟到后台执行
    resourceManager.cleanupExpiredData()

  // 第5步：记录 onMounted 总耗时
  const mountEndTime = performance.now()
  const totalTime = mountEndTime - mountStartTime
  console.warn(`[onMounted] 总耗时: ${totalTime.toFixed(2)}ms (${(totalTime / 1000).toFixed(2)}s)`)
  console.warn(`[onMounted] 完成时间: ${new Date().toLocaleTimeString('zh-CN')}`)

  // 定期检查更新（每60分钟）- 延迟启动
    setInterval(
      () => {
        if (!loading.value && !checkingUpdates.value) {
          checkForUpdates()
        }
      },
      60 * 60 * 1000,
    )
})

// 暂停所有正在下载的任务
const pauseAllDownloadingTasks = async () => {
  try {
    // 流程：查找所有正在下载的教材（downloadStatus === 1）
    const downloadingTextbooks = textbooks.value.filter(
      textbook => textbook.downloadStatus === 1
    )
    
    if (downloadingTextbooks.length === 0) {
      return
    }
    
    console.log(`[页面离开] 发现 ${downloadingTextbooks.length} 个正在下载的任务，开始暂停...`)
    
    // 流程：批量暂停所有正在下载的任务
    const pausePromises = downloadingTextbooks.map(async (textbook) => {
      try {
        // 调用API服务暂停下载
        const success = await apiService.pauseDownload(textbook.textbookId)
        
        if (success) {
          // 更新教材状态为已暂停
          textbook.downloadStatus = 3
          textbook.isDownloaded = false
          
          // 保存暂停状态到IndexedDB
          await resourceManager.updateTextbookInfo(textbook, {
            downloadStatus: 3,
            isDownloaded: false,
            downloadedFiles: textbook.downloadedFiles,
          })
          
          console.log(`[页面离开] ✅ 已暂停教材: ${textbook.textbookName}`)
        } else {
          console.warn(`[页面离开] ⚠️ 暂停教材失败: ${textbook.textbookName}`)
        }
      } catch (error) {
        console.error(`[页面离开] ❌ 暂停教材出错: ${textbook.textbookName}`, error)
      }
    })
    
    // 等待所有暂停操作完成
    await Promise.all(pausePromises)
    
    console.log(`[页面离开] 🎉 所有下载任务已暂停`)
  } catch (error) {
    console.error('[页面离开] 暂停下载任务时发生错误:', error)
  }
}

// 组件卸载时销毁 better-scroll 并暂停所有下载任务
onUnmounted(async () => {
  // 流程：页面离开时立即暂停所有正在下载的任务
  await pauseAllDownloadingTasks()
  
  // BScroll 销毁由组合式函数自动处理
})

// 调试方法：打印IndexedDB中的localFiles数据
const printLocalFilesData = async () => {
  // 获取所有用户教材
  const userTextbooks = await resourceManager.getUserLocalTextbooks()

  userTextbooks.forEach((textbook) => {
    // 打印localFiles数据
    if (textbook.localFiles && textbook.localFiles.length > 0) {
      // 注意：fileData已分离存储到textbook_files表，不在localFiles中
      // 如需检查文件数据是否存在，使用 resourceManager.hasFileData(textbook.id, file.id)
      // 文件元数据已存在
    }

    // 打印学习包信息
    if (textbook.learningPackages && textbook.learningPackages.length > 0) {
      textbook.learningPackages.forEach(() => {
        // 学习包信息已处理
      })
    }

    // 打印下载状态
    // 下载状态信息已处理
  })
}

</script>

<style lang="scss" scoped>
.q-layout {
  background: #f5f5f5;
}

.my-resources-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;

  // 筛选区域固定在顶部
  .filter-section {
    flex-shrink: 0;
  }

  // 加载状态固定
  .loading-state {
    flex: 1;
  }

  // better-scroll 滚动容器 (仅教材列表)
  .scroll-wrapper {
    flex: 1;
    overflow: hidden;
    position: relative;
    background-color: #eef0ff;
  }

  .scroll-content {
    min-height: calc(100% + 1px);
  }

  // 第13步：移除下拉刷新提示样式

  // 空状态固定
  .empty-state {
    flex: 1;
  }

  .page-header {
    margin-bottom: 32px;
    text-align: center;

    .page-title {
      font-size: 32px;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0;
    }
  }

  // 筛选区域 - 现代简洁版
  .filter-section {
    background: #ffffff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    
    .filter-title {
      text-align: center;
      font-size: 20px;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.87);
      padding: 16px 20px 12px;
    }

    .filter-content {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      align-items: center;
      padding: 12px 20px;
      
      .filter-dropdown-item {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .filter-label {
          font-size: 14px;
          color: rgba(0, 0, 0, 0.87);
          white-space: nowrap;
        }
        
        .filter-select {
          min-width: 150px;
          
          :deep(.q-field__control) {
            border: 1px solid rgba(0, 0, 0, 0.12);
            border-radius: 4px;
          }
        }
      }
    }
    
    .filter-tabs {
      padding: 0 20px;
      overflow: hidden; // 清除浮动
      
      .filter-tab {
        float: left;
        width: 120px;
        margin-right: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px 16px;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
        
        &:last-child {
          border-right: none;
          margin-right: 0;
        }
        
        .tab-label {
          font-size: 14px;
          color: rgba(0, 0, 0, 0.87);
          position: relative;
        }
        
        .tab-badge {
          position: absolute;
          top: 4px;
          right: 8px;
          font-size: 10px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        &.active {
          .tab-label {
            font-weight: 500;
            
            &::after {
              content: '';
              position: absolute;
              bottom: -12px;
              left: 0;
              right: 0;
              height: 2px;
              background: #9c27b0; // 紫色下划线
            }
          }
        }
      }
    }

    .action-buttons {
      display: flex;
      gap: 12px;
      align-items: center;
      
      .debug-btn {
        min-width: 100px;
      }
      
      .check-updates-btn {
        min-width: 100px;
      }
    }

    // 第14步：检查更新按钮样式
    .check-updates-btn {
      flex-shrink: 0;
      border-radius: 8px;
      padding: 8px 20px;
      font-weight: 500;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }

  .loading-state {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f0f0f0;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    .loading-text {
      font-size: 16px;
      color: #666;
      margin: 0;
    }
  }

  .textbooks-container {
    padding: 0;

    .textbooks-scroll-container {
      overflow: visible;
    }

    // 教材列表布局（改为单列或双列）
    .textbooks-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 22px;

      // 响应式调整
      @media (min-width: 768px) {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
      }
    }

    // 图片样式布局：左右结构卡片
    .textbook-card {
      display: flex;
      gap: 16px;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      background: #ffffff;
      contain: layout style paint;
      transform: translateZ(0);
      backface-visibility: hidden;

      // 左侧：封面图片
      .textbook-cover {
        width: 120px;
        height: 160px;
        flex-shrink: 0;
        background: #f5f5f5;
        border-radius: 6px;
        overflow: hidden;
        position: relative;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      // 右侧：内容区域
      .textbook-content {
        flex: 1;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        min-width: 0;

        // 左侧：标题、版本和状态指示器
        .textbook-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-width: 0;

          // 标题和版本
          .textbook-header {

            .textbook-title {
              font-size: 18px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 6px;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              line-height: 1.4;
            }

            .textbook-version {
              font-size: 14px;
              color: #6b7280;
              font-weight: 400;
            }
          }

          // 状态指示器
          .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 2px 4px;
            margin-top: 40px;
            border-radius: 4px;
            width: fit-content;

            .status-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              flex-shrink: 0;
            }

            .status-dot-red {
              background: #ffffff;
            }

            .status-dot-blue {
              background: #ffffff;
            }

            .status-dot-green {
              background: #ffffff;
            }

            .status-dot-orange {
              background: #ffffff;
            }

            .status-text {
              font-size: 14px;
              font-weight: 500;
              color: #ffffff;
            }

            &.status-indicator-red {
              background: #ef4444;
            }

            &.status-indicator-blue {
              background: #6e55ff;
            }

            &.status-indicator-green {
              background: #10b981;
            }

            &.status-indicator-orange {
              background: #f59e0b;
            }
          }
        }

        // 右侧：操作按钮
        .textbook-actions {
          flex-shrink: 0;

            .action-btn {
              min-width: 80px;
              border-radius: 20px;
              font-weight: 500;
            }

            .action-btn-download {
              background-color: #6e55ff !important;
              color: #ffffff !important;
            }

            .action-btn-update {
              background-color: #ffffff !important;
              color: #6e55ff !important;
              border: 1px solid #6e55ff !important;
            }

            // 下载进度条
            .download-progress-bar {
              width: 120px;
              
              .progress-bar-container {
                position: relative;
                width: 100%;
                height: 32px;
                background: #ffffff;
                border-radius: 16px;
                overflow: hidden;
                border: 1px solid rgba(0, 0, 0, 0.1);
                
                .progress-bar-fill {
                  position: absolute;
                  top: 0;
                  left: 0;
                  height: 100%;
                  background: #6e55ff;
                  transition: width 0.3s ease;
                  border-radius: 16px;
                }
                
                .progress-text {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  font-size: 14px;
                  font-weight: 500;
                  color: #6e55ff;
                  z-index: 2;
                  pointer-events: none;
                  white-space: nowrap;
                }
              }
            }
          }
        }
      }

      &:hover {
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.12),
          0 0 0 1px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
      }

      &:active {
        box-shadow:
          0 1px 2px rgba(0, 0, 0, 0.1),
          0 0 0 1px rgba(0, 0, 0, 0.05);
        transform: translateY(0);
      }

      &.downloading {
        border-left: 4px solid #3b82f6;
      }

      &.paused {
        border-left: 4px solid #f59e0b;
      }
    }

    // 以下为已删除的旧样式，不再使用
    .textbook-item-old {
      background: #ffffff;
      border-radius: 4px; // Material Design 圆角
      padding: 16px; // Material Design 间距
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.1),
        0 0 0 1px rgba(0, 0, 0, 0.05);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      gap: 16px;

      &:hover {
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.12),
          0 0 0 1px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
      }

      &:active {
        box-shadow:
          0 1px 2px rgba(0, 0, 0, 0.1),
          0 0 0 1px rgba(0, 0, 0, 0.05);
        transform: translateY(0);
      }

      &.downloading {
        border-left: 4px solid #2196f3; // Material Design 蓝色
      }

      &.paused {
        border-left: 4px solid #ff9800; // Material Design 橙色
      }

      .textbook-icon {
        width: 56px; // Material Design 标准尺寸
        height: 56px;
        background: #f5f5f5; // Material Design 背景色
        border-radius: 4px; // Material Design 圆角
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        img {
          width: 28px;
          height: 28px;
          object-fit: cover;
        }
      }

      .textbook-info {
        flex: 1;
        min-width: 0;

        .textbook-name {
          font-size: 16px;
          font-weight: 500; // Material Design 字重
          color: rgba(0, 0, 0, 0.87); // Material Design 主文本色
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.5;
        }

        .textbook-subject {
          font-size: 14px;
          color: rgba(0, 0, 0, 0.6); // Material Design 次要文本色
          margin: 0 0 2px 0;
          line-height: 1.4;
        }

        .textbook-publisher {
          font-size: 12px;
          color: rgba(0, 0, 0, 0.38); // Material Design 禁用文本色
          margin: 0 0 8px 0;
          line-height: 1.3;
        }

      }

      .textbook-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-end;

        .action-btn {
          padding: 8px 16px; // Material Design 按钮内边距
          border: none;
          border-radius: 4px; // Material Design 圆角
          font-size: 14px;
          font-weight: 500; // Material Design 字重
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          white-space: nowrap;
          text-transform: uppercase; // Material Design 大写文本
          letter-spacing: 0.5px; // Material Design 字母间距
          min-height: 36px; // Material Design 最小高度
          display: flex;
          align-items: center;
          justify-content: center;

          &:hover {
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }

          &:active {
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          }

          &.download {
            background: #2196f3; // Material Design 蓝色
            color: white;

            &:hover {
              background: #1976d2;
            }
          }

          &.pause {
            background: #ff9800; // Material Design 橙色
            color: white;

            &:hover {
              background: #f57c00;
            }
          }

          &.view {
            background: #4caf50; // Material Design 绿色
            color: white;

            &:hover {
              background: #388e3c;
            }
          }

          &.update {
            background: #ff5722; // Material Design 深橙色
            color: white;

            &:hover {
              background: #e64a19;
            }
          }
        }
      }
    }
  }

  .empty-state {
    text-align: center;
    padding: 48px 24px; // Material Design 间距
    background: #ffffff;
    border-radius: 4px; // Material Design 圆角
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.1),
      0 0 0 1px rgba(0, 0, 0, 0.05);

    .empty-icon {
      width: 80px;
      height: 80px;
      opacity: 0.38; // Material Design 禁用状态透明度
      margin-bottom: 16px;
    }

    .empty-title {
      font-size: 20px;
      font-weight: 500; // Material Design 字重
      color: rgba(0, 0, 0, 0.87); // Material Design 主文本色
      margin: 0 0 8px 0;
      line-height: 1.4;
    }

    .empty-description {
      font-size: 16px;
      color: rgba(0, 0, 0, 0.6); // Material Design 次要文本色
      margin: 0;
      line-height: 1.5;
    }
  }


@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .q-layout {
    background: #f5f5f5;
  }

  .my-resources-view {
    padding: 16px;
    min-height: calc(100vh - 56px);

    .page-header {
      margin-bottom: 24px;

      .page-title {
        font-size: 24px;
      }
    }

    .filter-section {
      .filter-title {
        font-size: 18px;
        padding: 12px 16px 8px;
      }

      .filter-content {
        display: flex;
        justify-content: space-between;
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
        padding: 10px 16px;
        
        .filter-dropdown-item {
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          
          .filter-label {
            font-size: 13px;
          }
          
          .filter-select {
            width: 100%;
            min-width: auto;
          }
        }
      }
      
      .filter-tabs {
        padding: 0 16px;
        
        .filter-tab {
          float: none;
          width: 100%;
          margin-right: 0;
          margin-bottom: 2px;
          border-right: none;
          border-bottom: 1px dashed rgba(0, 0, 0, 0.12);
          
          &:last-child {
            border-bottom: none;
            margin-bottom: 0;
          }
          
          &.active {
            .tab-label::after {
              bottom: -10px;
            }
          }
        }
      }
    }

    .textbooks-container {
      .textbooks-scroll-container {
        max-height: calc(100vh - 150px); // 移动端调整高度
        padding-right: 4px; // 移动端减少滚动条空间
      }

      .textbooks-grid {
        gap: 12px;
        padding: 12px 0;
      }

      .textbook-card {
        padding: 12px;
        gap: 12px;

        .textbook-cover {
          width: 100px;
          height: 133px;
        }

        .textbook-content {
          .textbook-header {
            .textbook-title {
              font-size: 16px;
            }

            .textbook-version {
              font-size: 13px;
            }
          }

          flex-direction: column;
          align-items: stretch;
          gap: 12px;

          .textbook-info {
            .status-indicator {
              .status-text {
                font-size: 13px;
              }
            }
          }

          .textbook-actions {
            align-self: flex-end;
            width: 100%;

            .action-btn {
              width: 100%;
              min-width: auto;
            }
          }
        }
      }

      .textbook-item {
        flex-direction: column;
        text-align: center;
        padding: 12px; // Material Design 移动端内边距

        .textbook-icon {
          width: 48px; // Material Design 移动端图标尺寸
          height: 48px;
          margin: 0 auto 8px;
        }

        .textbook-info {
          .textbook-name {
            font-size: 14px; // Material Design 移动端字体
            margin-bottom: 4px;
          }

          .textbook-subject {
            font-size: 12px;
          }

          .textbook-publisher {
            font-size: 11px;
            margin-bottom: 8px;
          }
        }

        .textbook-actions {
          flex-direction: row;
          justify-content: center;
          align-items: center;
          gap: 4px;

          .action-btn {
            padding: 6px 12px; // Material Design 移动端按钮内边距
            font-size: 12px;
            min-height: 32px;
          }
        }
      }
    }
  }
}
</style>
