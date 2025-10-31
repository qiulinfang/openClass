<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="my-resources-view">
        <!-- 筛选区域 (固定在顶部) -->
        <div class="filter-section">
          <div class="filter-content">
            <!-- 第1步：学科筛选 -->
            <div class="filter-chips">
              <q-chip
                v-for="category in categories"
                :key="category.value"
                :selected="selectedSubjects.has(category.value)"
                :color="selectedSubjects.has(category.value) ? 'primary' : 'grey-3'"
                :text-color="selectedSubjects.has(category.value) ? 'white' : 'grey-8'"
                clickable
                @click="toggleSubject(category.value)"
                :label="category.label"
                size="md"
                class="filter-chip"
              />
            </div>
            
            <!-- 第2步：操作按钮组 -->
            <div class="action-buttons">
              <q-btn
                color="primary"
                icon="refresh"
                label="检查更新"
                @click="handleCheckUpdates"
                :loading="checkingUpdates"
                size="md"
                unelevated
                no-caps
                class="check-updates-btn"
              />
              
              <!-- 调试面板按钮 -->
              <q-btn
                color="secondary"
                icon="bug_report"
                label="调试面板"
                @click="showDebugPanel = true"
                size="md"
                unelevated
                no-caps
                class="debug-btn"
              />
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
                  <!-- 第1步：简化卡片结构，减少DOM层级 -->
                  <div
                    v-for="textbook in filteredTextbooks"
                    :key="textbook.id"
                    class="textbook-card"
                    :class="{
                      downloading: textbook.downloadStatus === 1,
                      paused: textbook.downloadStatus === 3,
                    }"
                  >
                  {{ textbook.downloadStatus }}
                    <!-- 第2步：教材封面容器 - 用原生div替换q-img -->
                    <div class="textbook-cover">
                      <!-- 第3步：原生img标签，比q-img性能更好 -->
                      <img
                        :src="getCoverImageUrl(textbook.textbookCover)"
                        :alt="textbook.textbookName"
                        loading="lazy"
                      />
                      
                      <!-- 第4步：下载/暂停状态覆盖层 - 合并为单一覆盖层 -->
                      <div
                        v-if="textbook.downloadStatus === 1 || textbook.downloadStatus === 3"
                        class="status-overlay"
                      >
                        <!-- 第5步：纯CSS圆形进度条替换q-circular-progress -->
                        <div v-if="textbook.downloadStatus === 1" class="progress-ring">
                          <svg width="60" height="60">
                            <circle class="progress-ring-circle-bg" cx="30" cy="30" r="26" />
                            <circle
                              class="progress-ring-circle"
                              cx="30"
                              cy="30"
                              r="26"
                              :style="{
                                strokeDashoffset: 163.36 * (1 - textbook.downloadedFiles / textbook.totalFiles)
                              }"
                            />
                          </svg>
                          <div class="progress-text">
                            {{ textbook.downloadedFiles }}/{{ textbook.totalFiles }}
                          </div>
                        </div>
                        
                        <!-- 第6步：暂停图标 - 用CSS图标替代 -->
                        <div v-else class="pause-indicator">
                          <div class="pause-icon"></div>
                          <div class="pause-text">已暂停</div>
                          <div class="pause-progress">
                            {{ textbook.downloadedFiles }}/{{ textbook.totalFiles }}
                          </div>
                        </div>
                      </div>

                      <!-- 第7步：教材信息覆盖层 (底部) -->
                      <div class="textbook-info-overlay">
                        <div class="textbook-name-overlay">
                          {{ textbook.textbookName }}
                        </div>
                        <div class="textbook-meta-overlay">
                          {{ textbook.textbookSubjectLabel }} {{ textbook.textbookGradeLabel }} {{ textbook.textbookSemesterLabel }}
                        </div>
                      </div>
                    </div>
                    <!-- 第8步：操作按钮区 - 简化条件逻辑 -->
                    <div class="textbook-actions">
                      <!-- 下载中状态：显示暂停和取消 -->
                      <template v-if="textbook.downloadStatus === 1">
                        <q-btn color="orange" icon="pause" label="暂停" @click="pauseDownload(textbook)" size="sm" unelevated no-caps />
                        <q-btn color="negative" icon="cancel" label="取消" @click="cancelDownload(textbook)" size="sm" unelevated no-caps />
                      </template>
                      
                      <!-- 暂停状态：显示继续和取消 -->
                      <template v-else-if="textbook.downloadStatus === 3">
                        <q-btn color="primary" icon="play_arrow" label="继续" @click="downloadTextbook(textbook)" size="sm" unelevated no-caps />
                        <q-btn color="negative" icon="cancel" label="取消" @click="cancelDownload(textbook)" size="sm" unelevated no-caps />
                      </template>
                      
                      <!-- 已下载状态：显示查看和去学习 -->
                      <template v-else-if="textbook.isDownloaded && textbook.downloadStatus === 2">
                        <q-btn color="positive" icon="visibility" label="查看" @click="viewTextbook(textbook)" size="sm" unelevated no-caps />
                        <q-btn color="primary" icon="school" label="去学习" @click="goToKnowledgeGraph(textbook)" size="sm" unelevated no-caps />
                        <q-btn v-if="textbook.hasUpdatesAvailable" color="secondary" icon="system_update" label="更新" @click="updateTextbook(textbook)" size="sm" unelevated no-caps />
                      </template>
                      
                      <!-- 部分下载状态：显示继续 -->
                      <template v-else-if="textbook.downloadedFiles > 0 && textbook.downloadedFiles < textbook.totalFiles">
                        <q-btn color="primary" icon="play_arrow" label="继续" @click="downloadTextbook(textbook)" size="sm" unelevated no-caps />
                      </template>
                      
                      <!-- 未下载状态：显示下载 -->
                      <template v-else>
                        <q-btn color="primary" icon="download" label="下载" @click="downloadTextbook(textbook)" size="sm" unelevated no-caps />
                      </template>
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
        <ResourceDebugPanel :visible="showDebugPanel" @close="showDebugPanel = false" />
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
import BScroll from '@better-scroll/core'
// 第1步：移除PullDown插件导入，不再使用下拉刷新功能

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

// 新增：本地数据优先显示相关状态
const hasLocalData = ref(false)
const initialLoadCompleted = ref(false)

// better-scroll 相关
const scrollWrapper = ref<HTMLElement | null>(null)
let bscroll: BScroll | null = null
// 第2步：移除pullDownRefreshStatus状态，不再需要下拉刷新状态管理

// 分类选项 - 基于学科动态生成
const categories = ref([{ label: '全部', value: 'all' }])

// 计算属性 - 简化的筛选逻辑，添加排序确保顺序一致
const filteredTextbooks = computed(() => {
  let result: UserTextbookInfo[]

  if (selectedSubjects.value.has('all') || selectedSubjects.value.size === 0) {
    result = textbooks.value
  } else {
    result = textbooks.value.filter((textbook) =>
      selectedSubjects.value.has(textbook.textbookSubjectLabel),
    )
  }

  // 排序确保每次加载顺序一致
  return [...result].sort((a, b) => {
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

// 切换学科选择
// 流程：获取完整的封面图片URL（处理file://环境）
const getCoverImageUrl = (coverUrl: string | undefined): string => {
  if (!coverUrl) return bookIcon

  // 流程：使用httpClient.buildFullUrl处理URL
  // 这会在file://环境下将相对路径转换为完整URL
  return httpClient.buildFullUrl(coverUrl)
}

const toggleSubject = (subject: string) => {
  if (subject === 'all') {
    selectedSubjects.value.clear()
    selectedSubjects.value.add('all')
  } else {
    selectedSubjects.value.delete('all')
    if (selectedSubjects.value.has(subject)) {
      selectedSubjects.value.delete(subject)
    } else {
      selectedSubjects.value.add(subject)
    }

    // 如果没有选择任何学科，自动选择"全部"
    if (selectedSubjects.value.size === 0) {
      selectedSubjects.value.add('all')
    }
  }
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

// 初始化 better-scroll
const initBScroll = async () => {
  await nextTick()

  if (!scrollWrapper.value) return

  // 如果已存在实例，先销毁
  if (bscroll) {
    bscroll.destroy()
  }

  // 第3步：创建 BScroll 实例，优化性能配置
  bscroll = new BScroll(scrollWrapper.value, {
    // 第4步：基础配置
    scrollY: true,
    scrollX: false,
    click: true,
    probeType: 2, // 降低probeType从3到2，减少滚动事件频率，提升性能
    
    // 第5步：橡皮筋效果配置
    bounce: {
      top: true,  // 启用顶部橡皮筋效果
      bottom: true, // 启用底部橡皮筋效果
    },
    bounceTime: 800, // 第6步：回弹动画时长（毫秒）- 调整此值改变回弹速度
                     // 默认700-800ms，值越大回弹越慢，越有弹性感
                     // 推荐范围：500-1500ms
    
    // 第7步：滚动减速度（影响惯性滚动和橡皮筋拉伸程度）
    deceleration: 0.003, // 默认0.0015-0.003，值越小减速越慢，惯性滚动距离越长
                         // 值越大，滚动停得越快，橡皮筋拉伸距离越短
                         // 推荐范围：0.001-0.006
    
    // 第8步：移除pullDownRefresh配置，不再使用下拉刷新
    // 第9步：性能优化配置
    useTransition: true, // 使用CSS transition提升性能
    HWCompositing: true, // 启用硬件加速
  })

  // 第9步：移除下拉刷新监听事件
  // 第10步：移除滚动状态监听（之前用于显示下拉刷新提示）
}

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

    if (updatedTextbooks.length > 0) {
      // 更新教材的更新状态
      const updatePromises = textbooks.value.map(async (textbook) => {
        const hasUpdate = updatedTextbooks.some(
          (update) => update.textbookId === textbook.textbookId,
        )

        textbook.hasUpdatesAvailable = hasUpdate

        // 🔥 保存更新状态到 IndexedDB（使用批量更新）
        await resourceManager.updateTextbookInfo(textbook, {
          hasUpdatesAvailable: hasUpdate,
        })
      })

      // 等待所有更新完成
      await Promise.all(updatePromises)

      updateCount.value = updatedTextbooks.length
      showMessage(`发现 ${updatedTextbooks.length} 个教材有更新`, 'success')
    } else {
      // 清除所有教材的更新状态
      const clearPromises = textbooks.value.map(async (textbook) => {
        textbook.hasUpdatesAvailable = false

        // 🔥 保存更新状态到 IndexedDB（使用批量更新）
        await resourceManager.updateTextbookInfo(textbook, {
          hasUpdatesAvailable: false,
        })
      })

      // 等待所有清除完成
      await Promise.all(clearPromises)

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
  
  // 销毁 better-scroll
  if (bscroll) {
    bscroll.destroy()
    bscroll = null
  }
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
    .filter-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .filter-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      flex: 1;
      align-items: center;
    }

    .filter-chip {
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      
      &:hover {
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0);
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

    // 教材网格布局
    .textbooks-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      justify-items: center;
      align-items: start;
      padding: 10px 0;

      // 响应式调整
      @media (max-width: 600px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      @media (max-width: 400px) {
        grid-template-columns: repeat(1, 1fr);
        gap: 16px;
      }
    }

    // 第1步：简化后的教材卡片样式
    .textbook-card {
      width: 100%;
      max-width: 240px;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      background: #ffffff;
      /* 第2步：性能优化 */
      contain: layout style paint;
      transform: translateZ(0);
      backface-visibility: hidden;
      will-change: transform;

      // 第3步：教材封面容器
      .textbook-cover {
        background: #f5f5f5;
        position: relative;
        padding-bottom: 150%; // 2:3比例
        overflow: hidden;
        transform: translateZ(0);

        // 第4步：原生img样式
        img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
      }

      // 第5步：状态覆盖层
      .status-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2;
      }

      // 第6步：纯CSS圆形进度环
      .progress-ring {
        position: relative;
        
        svg {
          transform: rotate(-90deg);
        }
        
        .progress-ring-circle-bg {
          fill: none;
          stroke: rgba(255, 255, 255, 0.3);
          stroke-width: 4;
        }
        
        .progress-ring-circle {
          fill: none;
          stroke: #fff;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-dasharray: 163.36;
          transition: stroke-dashoffset 0.3s ease;
        }
        
        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 12px;
          font-weight: 600;
        }
      }

      // 第7步：暂停指示器
      .pause-indicator {
        text-align: center;
        color: #ff9800;
        
        .pause-icon {
          width: 60px;
          height: 60px;
          margin: 0 auto 8px;
          background: #ff9800;
          border-radius: 50%;
          position: relative;
          
          &::before,
          &::after {
            content: '';
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 6px;
            height: 24px;
            background: white;
            border-radius: 2px;
          }
          
          &::before {
            left: 20px;
          }
          
          &::after {
            right: 20px;
          }
        }
        
        .pause-text {
          font-size: 14px;
          font-weight: 600;
          color: white;
          margin-bottom: 4px;
        }
        
        .pause-progress {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.9);
        }
      }

      // 教材信息覆盖层样式 - 半透明+毛玻璃组合
      .textbook-info-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 10px 8px;
        background: rgba(0, 0, 0, 0.4);  // 半透明黑色确保可读性
        backdrop-filter: blur(8px) saturate(120%);  // 适度毛玻璃
        -webkit-backdrop-filter: blur(8px) saturate(120%);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        color: white;

        .textbook-name-overlay {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.3;
          margin-bottom: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          line-clamp: 2;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);  // 简洁阴影
        }

        .textbook-meta-overlay {
          font-size: 11px;
          opacity: 0.9;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
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
        border-left: 4px solid #2196f3; // Material Design 蓝色
      }

      &.paused {
        border-left: 4px solid #ff9800; // Material Design 橙色
      }

      // 第10步：简化后的操作按钮区
      .textbook-actions {
        display: flex;
        gap: 8px;
        padding: 8px;
        justify-content: space-around;
        align-items: center;
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

        .download-progress {
          display: flex;
          align-items: center;
          gap: 12px;

          .progress-bar {
            flex: 1;
            height: 4px; // Material Design 进度条高度
            background: rgba(0, 0, 0, 0.12); // Material Design 进度条背景
            border-radius: 2px;
            overflow: hidden;

            .progress-fill {
              height: 100%;
              background: #2196f3; // Material Design 蓝色
              transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
          }

          .progress-text {
            font-size: 12px;
            color: rgba(0, 0, 0, 0.6); // Material Design 次要文本色
            white-space: nowrap;
            line-height: 1.3;
          }
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
      .filter-content {
        padding: 10px 16px;
        gap: 12px;
      }

      .filter-chips {
        gap: 6px;
      }

      .filter-chip {
        font-size: 13px;
      }
    }

    .textbooks-container {
      .textbooks-scroll-container {
        max-height: calc(100vh - 150px); // 移动端调整高度
        padding-right: 4px; // 移动端减少滚动条空间
      }

      .textbooks-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        padding: 8px 0;
      }

      .textbook-item-wrapper {
        max-width: 200px;
      }

      .textbook-card {
        max-width: 180px;

        // 移动端信息覆盖层优化
        .textbook-info-overlay {
          padding: 8px 6px;
          background: rgba(0, 0, 0, 0.45);  // 移动端稍深一点
          backdrop-filter: blur(6px) saturate(120%);
          -webkit-backdrop-filter: blur(6px) saturate(120%);

          .textbook-name-overlay {
            font-size: 12px;
            font-weight: 600;
            line-height: 1.25;
            margin-bottom: 2px;
          }

          .textbook-meta-overlay {
            font-size: 10px;
          }
        }

        .textbook-actions {
          gap: 4px;
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
