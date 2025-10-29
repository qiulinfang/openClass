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
            
            <!-- 第2步：检查更新按钮 -->
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

            <!-- 操作确认对话框 -->
            <q-dialog v-model="showConfirmDialog" persistent>
              <q-card style="min-width: 350px">
                <q-card-section class="row items-center">
                  <q-avatar icon="warning" color="orange" text-color="white" />
                  <span class="q-ml-sm text-h6">{{ confirmDialog.title }}</span>
                </q-card-section>

                <q-card-section>
                  <div class="text-body1">{{ confirmDialog.message }}</div>
                </q-card-section>

                <q-card-actions align="right">
                  <q-btn flat label="取消" color="grey" v-close-popup />
                  <q-btn flat label="确认" color="primary" @click="confirmAction" v-close-popup />
                </q-card-actions>
              </q-card>
            </q-dialog>

        <!-- 调试面板 -->
        <DebugPanel :visible="showDebugPanel" @close="showDebugPanel = false" />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { resourceManager } from '../services/resource-manager'
import { apiService } from '../services/api-service'
import { httpClient } from '../services/http-client'
import type { UserTextbookInfo } from '../types'
import DebugPanel from '../components/DebugPanel.vue'
import BScroll from '@better-scroll/core'
// 第1步：移除PullDown插件导入，不再使用下拉刷新功能

// Quasar 实例
const $q = useQuasar()

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

// 确认对话框
const showConfirmDialog = ref(false)
const confirmDialog = ref({
  title: '',
  message: '',
  action: null as (() => void) | null,
})

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

// 后台更新服务器数据
const updateServerData = async () => {
  try {
    // 检查登录状态
    if (!resourceManager.isLoggedIn()) {
      // 尝试自动登录
      const autoLoginSuccess = await apiService.autoLogin(true)
      if (!autoLoginSuccess) {
        return
      }
    }

    // 获取服务器教材数据
    const serverTextbooks = await apiService.fetchUserAllOnlineTextbooks()

    // 获取当前本地数据
    const localTextbooks = await resourceManager.getUserLocalTextbooks()

    // 合并服务器数据和本地数据
    const mergedTextbooks = mergeServerAndLocalData(serverTextbooks, localTextbooks)

    // 为每个教材检查学习资源包（并行处理）
    await checkLearningPackagesForAllTextbooks(mergedTextbooks)

    // 更新本地教材数据
    for (const textbook of mergedTextbooks) {
      await resourceManager.updateTextbookInfo(textbook)
    }
    // 平滑替换数据
    textbooks.value = mergedTextbooks
    updateSubjectChips()
  } catch {
    showMessage('后台更新失败，请稍后重试', 'error')
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

// 检测和修复不一致的下载状态
const fixInconsistentDownloadStatus = async (textbooks: UserTextbookInfo[]) => {
  let fixedCount = 0

  const fixPromises = textbooks.map(async (textbook) => {
    // 检查是否有downloadStatus为1但没有实际下载任务的情况
    if (textbook.downloadStatus === 1) {
      // 检查ApiService中是否有对应的下载控制器
      const hasActiveDownload = apiService.hasActiveDownload(textbook.textbookId)

      if (!hasActiveDownload) {
        fixedCount++

        // 根据下载进度判断状态
        if (textbook.downloadedFiles > 0 && textbook.downloadedFiles < textbook.totalFiles) {
          // 部分下载，设置为暂停状态
          textbook.downloadStatus = 3
          textbook.isDownloaded = false
        } else if (textbook.downloadedFiles === textbook.totalFiles && textbook.totalFiles > 0) {
          // 完全下载，设置为完成状态
          textbook.downloadStatus = 2
          textbook.isDownloaded = true
        } else {
          // 没有下载进度，设置为未下载状态
          textbook.downloadStatus = 0
          textbook.isDownloaded = false
          textbook.downloadedFiles = 0
        }

        // 保存修复后的状态到IndexedDB
        await resourceManager.updateTextbookInfo(textbook, {
          downloadStatus: textbook.downloadStatus,
          isDownloaded: textbook.isDownloaded,
          downloadedFiles: textbook.downloadedFiles,
        })
      }
    }
  })

  await Promise.all(fixPromises)

  if (fixedCount > 0) {
  }
}

// 加载资源数据（优化版本：本地数据优先显示）
const loadResources = async () => {
  // 重置初始加载状态
  initialLoadCompleted.value = false

  // 第一步：立即加载本地数据
  const localTextbooks = await loadLocalData()
  if (localTextbooks.length > 0) {
    // 检测和修复不一致的下载状态
    await fixInconsistentDownloadStatus(localTextbooks)

    // 有本地数据，立即显示
    textbooks.value = localTextbooks
    updateSubjectChips()
    initialLoadCompleted.value = true

    // 第6步：在DOM更新后后台更新服务器数据
    nextTick(() => {
      updateServerData()
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

// 更新学科筛选选项
const updateSubjectChips = () => {
  const subjects = new Set(textbooks.value.map((t) => t.textbookSubjectLabel))
  const newCategories = [{ label: '全部', value: 'all' }]

  subjects.forEach((subject) => {
    newCategories.push({ label: subject, value: subject })
  })

  categories.value = newCategories

  // 默认选择"全部"
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
  // 设置下载状态
  textbook.downloadStatus = 1 // 下载中
  textbook.isDownloaded = false

  // ApiService.downloadTextbook内部会优先使用本地已有的学习资源包数据，无需重复处理

  try {
    // 1. 直接使用ApiService下载（优先使用本地已有的学习资源包数据）
    const success = await apiService.downloadTextbook(
      textbook,
      async (progress, downloadedCount) => {
        // 更新下载进度 - 使用实际下载的文件数
        textbook.downloadedFiles = downloadedCount
      },
    )

    // 现在数据会立即保存到IndexedDB，直接打印数据
    printLocalFilesData()

    if (success) {
      // 下载成功 - 重新从IndexedDB获取最新的教材数据，避免使用过时的textbook对象
      const latestTextbook = await resourceManager
        .getUserLocalTextbooks()
        .then((textbooks) => textbooks.find((t) => t.textbookId === textbook.textbookId))

      if (latestTextbook) {
        // 使用最新的教材数据更新状态
        latestTextbook.isDownloaded = true
        latestTextbook.downloadStatus = 2 // 下载完成
        latestTextbook.downloadedFiles = latestTextbook.totalFiles
        latestTextbook.lastDownloadTime = new Date().toISOString()
        latestTextbook.hasUpdatesAvailable = false
        // 只更新下载状态，不覆盖localFiles数据
        await resourceManager.updateTextbookInfo(latestTextbook, {
          isDownloaded: true,
          downloadStatus: 2,
          downloadedFiles: latestTextbook.totalFiles,
          lastDownloadTime: new Date().toISOString(),
          hasUpdatesAvailable: false,
        })

        // 更新Vue组件中的textbook对象
        Object.assign(textbook, latestTextbook)
      } else {
        // 如果无法获取最新数据，使用原有逻辑
        textbook.isDownloaded = true
        textbook.downloadStatus = 2 // 下载完成
        textbook.downloadedFiles = textbook.totalFiles
        textbook.lastDownloadTime = new Date().toISOString()
        textbook.hasUpdatesAvailable = false

        // 立即保存下载状态到IndexedDB
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

      showMessage(`《${textbook.textbookName}》下载已暂停`, 'warning')
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

    if (success) {
      textbook.downloadStatus = 3 // 已暂停
      textbook.isDownloaded = false

      // 保存暂停状态到IndexedDB（使用立即更新）
      await resourceManager.updateTextbookInfo(textbook, {
        downloadStatus: 3,
        isDownloaded: false,
        downloadedFiles: textbook.downloadedFiles, // 🔥 保存已下载的文件数量
      })

      showMessage(`《${textbook.textbookName}》下载已暂停`, 'warning')
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
  // 确认取消操作
  const confirmed = confirm(
    `确定要取消《${textbook.textbookName}》的下载吗？已下载的文件将被删除。`,
  )
  if (!confirmed) {
    return
  }

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

      showMessage(`《${textbook.textbookName}》下载已取消`, 'info')
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
  showConfirmDialog.value = true
  confirmDialog.value = {
    title: '更新教材',
    message: `确定要更新教材"${textbook.textbookName}"吗？更新将下载最新的资源文件。`,
    action: () => {
      // 重置更新状态
      textbook.hasUpdatesAvailable = false
      textbook.downloadStatus = 1 // 开始更新下载
      textbook.isDownloaded = false

      // 开始下载更新
      downloadTextbook(textbook)
    },
  }
}

// 确认操作
const confirmAction = () => {
  if (confirmDialog.value.action) {
    confirmDialog.value.action()
  }
  closeConfirmDialog()
}

// 关闭确认对话框
const closeConfirmDialog = () => {
  showConfirmDialog.value = false
  confirmDialog.value = {
    title: '',
    message: '',
    action: null,
  }
}

// 显示消息 (使用 Quasar Notify)
const showMessage = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  const typeMap = {
    success: { color: 'positive', icon: 'check_circle' },
    error: { color: 'negative', icon: 'error' },
    warning: { color: 'warning', icon: 'warning' },
    info: { color: 'info', icon: 'info' }
  }

  const config = typeMap[type]

  $q.notify({
    message,
    color: config.color,
    icon: config.icon,
    position: 'top',
    timeout: 2500,
    actions: [
      { icon: 'close', color: 'white', flat: true, round: true }
    ]
  })
}

// 生命周期
onMounted(async () => {
  await loadResources()

  // 初始化 better-scroll
  await initBScroll()

  // 清理过期数据
  resourceManager.cleanupExpiredData()

  // 定期检查更新（每5分钟）
  setInterval(
    () => {
      if (!loading.value && !checkingUpdates.value) {
        checkForUpdates()
      }
    },
    60 * 60 * 1000,
  )
})

// 组件卸载时销毁 better-scroll
onUnmounted(() => {
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
      textbook.localFiles.forEach((file) => {
        if (file.fileData && file.fileData.length > 0) {
          // 文件数据存在
        } else {
          // 文件数据不存在或为空
        }
      })
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

  .confirm-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;

    .confirm-dialog {
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);

      .dialog-title {
        font-size: 18px;
        font-weight: 600;
        color: #1a1a1a;
        margin: 0 0 12px 0;
      }

      .dialog-message {
        font-size: 16px;
        color: #666;
        margin: 0 0 24px 0;
        line-height: 1.5;
      }

      .dialog-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;

        .btn-cancel {
          padding: 10px 20px;
          border: 2px solid #e0e0e0;
          border-radius: 6px;
          background: white;
          color: #666;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            border-color: #ccc;
            color: #333;
          }
        }

        .btn-confirm {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          background: #dc3545;
          color: white;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s ease;

          &:hover {
            background: #c82333;
          }
        }
      }
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
