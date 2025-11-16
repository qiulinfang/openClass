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
              <q-badge v-if="tab.count > 0" color="negative" rounded class="tab-badge">
                {{ tab.count }}
              </q-badge>
            </div>
          </div>

          <!-- 调试按钮区域（仅开发环境） -->
          <div v-if="isDev" class="filter-actions">
            <button
              @click="showDebugPanel = true"
              class="debug-btn"
            >
              <i class="material-icons">bug_report</i>
              <span>调试面板</span>
            </button>
            <button
              @click="printScrollDimensions"
              class="debug-btn"
            >
              <i class="material-icons">print</i>
              <span>打印尺寸</span>
            </button>
          </div>
        </div>

        <!-- better-scroll 滚动容器 (仅包含教材列表) -->
        <div v-if="textbooks.length > 0" ref="scrollWrapper" class="scroll-wrapper">
          <div ref="scrollContent" class="scroll-content">
            <!-- 下拉刷新提示 -->
            <div
              v-if="showPullDownRefresh"
              class="pull-down-refresh"
              :class="{
                refreshing: refreshStatus === 'refreshing',
                success: refreshStatus === 'success',
                error: refreshStatus === 'error',
              }"
            >
              <span class="pull-down-text">
                <template v-if="refreshStatus === 'pulling'">
                  {{ pullDistance >= PULL_THRESHOLD ? '释放刷新' : '下拉刷新' }}
                </template>
                <template v-else-if="refreshStatus === 'refreshing'">
                  <span class="refresh-spinner"></span>
                </template>
                <template v-else-if="refreshStatus === 'success'"> 刷新成功 </template>
                <template v-else-if="refreshStatus === 'error'"> 刷新失败 </template>
              </span>
            </div>
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
                    <!-- 删除按钮（右上角） -->
                    <button
                      @click.stop="handleDeleteTextbook(textbook)"
                      class="textbook-delete-btn"
                      title="删除教材"
                    >
                      <i class="material-icons">close</i>
                    </button>

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
                          <div class="textbook-version">
                            {{ textbook.textbookPublisher || '人教版' }}
                          </div>
                        </div>

                        <!-- 状态指示器 -->
                        <div
                          class="status-indicator"
                          :class="{
                            'status-indicator-red': textbook.downloadStatus === 0,
                            'status-indicator-blue': textbook.downloadStatus === 1,
                            'status-indicator-green':
                              textbook.downloadStatus === 2 && textbook.isDownloaded,
                            'status-indicator-gray': textbook.downloadStatus === 3,
                            'status-indicator-orange': textbook.hasUpdatesAvailable,
                          }"
                        >
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
                          <!-- 有更新（优先显示，即使已下载完成） -->
                          <template
                            v-else-if="textbook.hasUpdatesAvailable && textbook.downloadStatus === 2 && textbook.isDownloaded"
                          >
                            <span class="status-dot status-dot-orange"></span>
                            <span class="status-text">有更新</span>
                          </template>
                          <!-- 下载完成 -->
                          <template
                            v-else-if="textbook.downloadStatus === 2 && textbook.isDownloaded"
                          >
                            <span class="status-dot status-dot-green"></span>
                            <span class="status-text">下载完成</span>
                          </template>
                          <!-- 暂停 -->
                          <template v-else-if="textbook.downloadStatus === 3">
                            <span class="status-dot status-dot-gray"></span>
                            <span class="status-text">已暂停</span>
                          </template>
                        </div>
                      </div>
                      <!-- 右侧：操作按钮或进度条 -->
                      <div class="textbook-actions">
                        <div class="action-buttons-group">
                          <!-- 下载中状态：显示进度条，点击进度条可暂停（包括更新时的下载） -->
                          <template v-if="textbook.downloadStatus === 1">
                            <div
                              class="download-progress-bar clickable"
                              @click="handlePauseDownload(textbook)"
                              :title="'点击暂停下载'"
                            >
                              <div class="progress-bar-container">
                                <div
                                  class="progress-bar-fill"
                                  :style="{
                                    width:
                                      getDownloadProgress(
                                        textbook.downloadedFiles,
                                        textbook.totalFiles,
                                      ) + '%',
                                  }"
                                ></div>
                                <span class="progress-text"
                                  >{{
                                    getDownloadProgress(
                                      textbook.downloadedFiles,
                                      textbook.totalFiles,
                                    )
                                  }}%</span
                                >
                              </div>
                            </div>
                          </template>

                          <!-- 暂停状态：显示继续 -->
                          <template v-else-if="textbook.downloadStatus === 3">
                            <button
                              @click="downloadTextbook(textbook)"
                              class="action-btn action-btn-continue"
                            >
                              继续
                            </button>
                          </template>

                          <!-- 已下载但没有更新：显示“学习”按钮 -->
                          <template
                            v-else-if="
                              textbook.isDownloaded &&
                              textbook.downloadStatus === 2 &&
                              !textbook.hasUpdatesAvailable
                            "
                          >
                            <button
                              @click="handleLearnTextbook(textbook)"
                              class="action-btn action-btn-download"
                            >
                              学习
                            </button>
                          </template>

                          <!-- 已下载状态：显示更新 -->
                          <template
                            v-else-if="
                              textbook.isDownloaded &&
                              textbook.downloadStatus === 2 &&
                              textbook.hasUpdatesAvailable
                            "
                          >
                            <button
                              @click="updateTextbook(textbook)"
                              class="action-btn action-btn-update"
                            >
                              更新
                            </button>
                          </template>

                          <!-- 未下载或部分下载状态：显示下载/继续 -->
                          <template v-else>
                            <button
                              @click="downloadTextbook(textbook)"
                              class="action-btn action-btn-download"
                            >
                              下载
                            </button>
                          </template>
                        </div>
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
          <button
            @click="loadResources"
            class="reload-btn"
          >
            <i class="material-icons">refresh</i>
            <span>重新加载</span>
          </button>
        </div>

        <!-- 调试面板 -->
        <ResourceDebugPanel
          v-if="isDev"
          :visible="showDebugPanel"
          @close="showDebugPanel = false"
        />

        <!-- 删除教材确认对话框 -->
        <q-dialog v-model="showDeleteDialog" persistent>
          <q-card style="min-width: 350px">
            <q-card-section>
              <div class="text-h6">删除教材</div>
            </q-card-section>

            <q-card-section class="q-pt-none">
              <div class="text-body1">确定要删除《{{ deleteTextbookName }}》吗？</div>
              <div class="text-body2 text-grey-7 q-mt-sm">
                删除后，该教材及其所有相关文件将从本地完全移除，且无法恢复。
              </div>
            </q-card-section>

            <q-card-actions align="right">
              <button
                class="dialog-btn dialog-btn-cancel"
                @click="showDeleteDialog = false"
              >
                取消
              </button>
              <button
                class="dialog-btn dialog-btn-confirm"
                @click="confirmDeleteTextbook"
                :disabled="deleting"
              >
                <span v-if="deleting">删除中...</span>
                <span v-else>确定</span>
              </button>
            </q-card-actions>
          </q-card>
        </q-dialog>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { resourceManager } from '../services/resource-storage'
import { apiService } from '../services/api-service'
import { httpClient } from '../services/http-client'
import { showMessage } from '../utils'
import type { UserTextbookInfo, TextbookVersion } from '../types'
import ResourceDebugPanel from '../components/debug/ResourceDebugPanel.vue'
import { useResourceStore } from '../stores/resourceStore'
import { useKnowledgeGraphStore } from '../stores/KnowledgeGraphStore'
import BScroll from '@better-scroll/core'
import PullDown from '@better-scroll/pull-down'

// 第1步：注册下拉刷新插件
BScroll.use(PullDown)

// 第2步：判断是否显示调试功能（仅通过环境变量控制）
// 必须设置 VITE_ENABLE_DEBUG 环境变量来控制调试功能的显示
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

// 流程：导入图标资源
import bookIcon from '/images/book.png'

// 路由

// Store
const resourceStore = useResourceStore()
const { setCurrentSubject, setCurrentTextbook } = useKnowledgeGraphStore()

// 路由
const router = useRouter()

// 响应式数据
const loading = ref(false)
const checkingUpdates = ref(false)
const textbooks = ref<UserTextbookInfo[]>([])
// 资源更新检查定时器
let resourceUpdateCheckTimer: ReturnType<typeof setInterval> | null = null
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
  { label: '沪科技版', value: '沪科技版' },
  { label: '苏教版', value: '苏教版' },
  { label: '鲁教版', value: '鲁教版' },
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
  const isMiddleSchool =
    selectedGrade.value === '初一' ||
    selectedGrade.value === '初二' ||
    selectedGrade.value === '初三'

  // 判断是否为高中
  const isHighSchool =
    selectedGrade.value === '高一' ||
    selectedGrade.value === '高二' ||
    selectedGrade.value === '高三'

  if (isMiddleSchool) {
    // 初中：上册和下册
    baseOptions.push({ label: '上册', value: '上册' }, { label: '下册', value: '下册' })
  } else if (isHighSchool) {
    // 高中：必修和选修
    baseOptions.push({ label: '必修', value: '必修' }, { label: '选修', value: '选修' })
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
const scrollContent = ref<HTMLElement | null>(null)
const bscrollInstance = ref<BScroll | null>(null)
const isPullingDown = ref(false)
const pullDistance = ref(0) // 下拉距离（像素）
const PULL_THRESHOLD = 60 // 触发刷新的阈值（与 Better Scroll 配置保持一致）
const isPulling = ref(false) // 是否正在下拉（未达到阈值）
const refreshStatus = ref<'idle' | 'pulling' | 'refreshing' | 'success' | 'error'>('idle') // 刷新状态

// 分类选项 - 基于学科动态生成
const categories = ref([{ label: '全部', value: 'all' }])

// 标签页数据（带计数）
const filterTabs = computed(() => {
  const notDownloaded = textbooks.value.filter(
    (t) => !t.isDownloaded || t.downloadStatus === 0,
  ).length
  const pendingUpdate = textbooks.value.filter(
    (t) => t.isDownloaded && t.hasUpdatesAvailable,
  ).length

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
      return (
        textbook.textbookSemesterLabel?.includes(selectedProgress.value) ||
        textbook.textbookName?.includes(selectedProgress.value)
      )
    })
  }

  // 标签页筛选
  if (activeTab.value === 'notDownloaded') {
    result = result.filter((textbook) => !textbook.isDownloaded || textbook.downloadStatus === 0)
  } else if (activeTab.value === 'downloaded') {
    result = result.filter(
      (textbook) =>
        textbook.isDownloaded && textbook.downloadStatus === 2 && !textbook.hasUpdatesAvailable,
    )
  } else if (activeTab.value === 'pendingUpdate') {
    result = result.filter(
      (textbook) =>
        textbook.isDownloaded && textbook.hasUpdatesAvailable,
    )
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

// 计算属性 - 是否显示下拉刷新提示
const showPullDownRefresh = computed(() => {
  // 正在刷新中或完成状态，或下拉距离大于0时显示
  return (
    refreshStatus.value === 'refreshing' ||
    refreshStatus.value === 'success' ||
    refreshStatus.value === 'error' ||
    pullDistance.value > 0
  )
})

// 第1步：初始化 Better Scroll 并配置下拉刷新
const initBScroll = async () => {
  await nextTick()

  if (scrollWrapper.value && !bscrollInstance.value) {
    // 第2步：创建带下拉刷新的 BScroll 实例
    bscrollInstance.value = new BScroll(scrollWrapper.value, {
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
      pullDownRefresh: {
        threshold: PULL_THRESHOLD, // 触发刷新的阈值
        stop: 40, // 刷新完成后停止的位置
      },
    })

    // 第3步：监听滚动事件，追踪下拉距离
    bscrollInstance.value.on('scroll', (pos: { x: number; y: number }) => {
      // 当向下滚动超过顶部时（y > 0），表示正在下拉
      if (
        pos.y > 0 &&
        refreshStatus.value !== 'refreshing' &&
        refreshStatus.value !== 'success' &&
        refreshStatus.value !== 'error'
      ) {
        pullDistance.value = pos.y
        isPulling.value = true
        refreshStatus.value = 'pulling'
      } else if (pos.y <= 0 && refreshStatus.value === 'pulling') {
        // 回到顶部或向上滚动，重置下拉状态
        pullDistance.value = 0
        isPulling.value = false
        refreshStatus.value = 'idle'
      }
    })

    // 第4步：监听下拉刷新事件
    bscrollInstance.value.on('pullingDown', async () => {
      isPullingDown.value = true
      isPulling.value = false
      refreshStatus.value = 'refreshing'

      await handlePullDownRefresh()
    })
  }
}

// 跳转到知识图谱学习当前教材
const handleLearnTextbook = (textbook: UserTextbookInfo) => {
  if (!textbook.textbookId) {
    showMessage('当前教材缺少 textbookId，无法打开知识图谱', 'warning')
    return
  }

  const subjectMap: Record<string, string> = {
    '数学': 'math',
    '语文': 'chinese',
    '英语': 'english',
    '物理': 'physics',
    '化学': 'chemistry',
    '生物': 'biology',
    '地理': 'geography',
    '历史': 'history',
    '政治': 'politics'
  }

  const subjectLabel = textbook.textbookSubjectLabel || '数学'
  const subject = subjectMap[subjectLabel] || 'math'
  // 通过路由跳转到知识图谱页面，同时携带用于初始化的 query 参数（使用 initSubject/initTextbookId 区分入口）
  router.push({
    name: 'knowledgeGraph',
    query: {
      initSubject: subject,
      initTextbookId: textbook.textbookId
    }
  })
}

// 第4步：处理下拉刷新
const handlePullDownRefresh = async () => {
  try {
    // 确保 isPullingDown 状态已设置（由 pullingDown 事件处理函数设置）
    if (!isPullingDown.value) {
      isPullingDown.value = true
      refreshStatus.value = 'refreshing'
    }

    // 流程：下拉刷新时暂停所有正在下载的任务
    await pauseAllDownloadingTasks()

    // [maxScrollY调试] 刷新开始时的 maxScrollY
    if (bscrollInstance.value) {
    }

    // 直接调用数据加载，不重新加载页面
    await loadResources()

    // [maxScrollY调试] 数据加载完成后的 maxScrollY
    if (bscrollInstance.value) {
    }

    // 数据加载成功，更新刷新状态
    refreshStatus.value = 'success'
    await nextTick()

    // 等待一段时间后重置状态（显示成功提示）
    refreshStatus.value = 'idle'
    isPulling.value = false
    pullDistance.value = 0
  } catch {
    showMessage('刷新失败，请稍后重试', 'error')

    // 更新刷新状态为错误
    refreshStatus.value = 'error'
    await nextTick()

    // 等待一段时间后重置状态
    refreshStatus.value = 'idle'
    isPulling.value = false
    pullDistance.value = 0
  } finally {
    // 重置下拉刷新标志
    isPullingDown.value = false
    // 完成下拉刷新动画（必须在 finally 中调用，确保总是执行）
    if (bscrollInstance.value) {
      try {
        // 步骤1：等待 DOM 更新
        await nextTick()
        // 步骤2：先刷新尺寸（在 finishPullDown 之前，确保尺寸正确）
        bscrollInstance.value.refresh()
        // 步骤3：完成下拉刷新动画（标准实现必需，确保动画正确结束）
        bscrollInstance.value.finishPullDown()
        // 步骤4：等待动画完成，再次刷新尺寸（确保 finishPullDown 后状态正确）
        await nextTick()
        await new Promise(resolve => requestAnimationFrame(resolve))
        bscrollInstance.value.refresh()
      } catch (error) {
        console.error('[refresh日志] 下拉刷新完成前 - 调用失败:', error)
        // 即使出错，也要尝试完成动画，确保状态正确
        try {
          bscrollInstance.value?.finishPullDown()
        } catch (finishError) {
          console.error('[refresh日志] finishPullDown 调用失败:', finishError)
        }
      }
    }
  }
}

// 第6步：监听数据变化，自动刷新 BScroll
watch(
  [() => filteredTextbooks.value.length, () => textbooks.value.length],
  () => {
    nextTick(() => {
      if (bscrollInstance.value) {
        bscrollInstance.value.refresh()
      }
    })
  },
  { deep: true },
)

// 切换学科选择
const getCoverImageUrl = (coverUrl: string | undefined): string => {
  if (!coverUrl) return bookIcon
  return httpClient.buildFullUrl(coverUrl)
}

// 安全计算下载进度百分比，避免NaN
// 如果 totalFiles 为 0 或 undefined，返回 0
const getDownloadProgress = (downloadedFiles: number, totalFiles: number): number => {
  if (!totalFiles || totalFiles === 0) {
    return 0
  }
  return Math.round((downloadedFiles / totalFiles) * 100)
}

// 处理筛选变化
const handleFilterChange = () => {
  // 当年级改变时，检查当前进度是否在新的选项中
  // 如果不在，清空进度选择
  if (selectedProgress.value) {
    const currentProgressValid = progressOptions.value.some(
      (option) => option.value === selectedProgress.value,
    )
    if (!currentProgressValid) {
      selectedProgress.value = ''
    }
  }
  // 筛选逻辑已在 computed 中实现，这里可以添加其他处理
  // 如果需要，可以在这里触发数据重新计算或其他操作
}

// 打印滚动尺寸信息
const printScrollDimensions = async () => {
  if (!bscrollInstance.value) {
    console.warn('BetterScroll 实例不存在')
    showMessage('BetterScroll 实例不存在', 'warning')
    return
  }

  // 等待 DOM 更新
  await nextTick()

  // 从 BetterScroll 实例获取
  const maxScrollYBefore = bscrollInstance.value.maxScrollY
  
  // BetterScroll 实例可能包含这些属性，但类型定义中可能没有
  // 尝试多种方式获取内部属性
  const bsInstance = bscrollInstance.value as BScroll & {
    wrapperHeight?: number
    scrollerHeight?: number
    hasVerticalScroll?: boolean
    scroller?: {
      height?: number
      width?: number
    }
    wrapper?: {
      height?: number
      width?: number
    }
    y?: number
    // BetterScroll 内部可能使用的其他属性名
    scrollBehaviorY?: {
      maxScrollY?: number
      wrapperHeight?: number
      contentHeight?: number
    }
    scrollBehavior?: {
      maxScrollY?: number
      wrapperHeight?: number
      contentHeight?: number
    }
  }
  
  // 尝试多种方式获取 wrapperHeight
  const wrapperHeight = 
    bsInstance.wrapperHeight || 
    bsInstance.wrapper?.height ||
    bsInstance.scrollBehaviorY?.wrapperHeight ||
    bsInstance.scrollBehavior?.wrapperHeight ||
    undefined
  
  // 尝试多种方式获取 scrollerHeight
  const scrollerHeight = 
    bsInstance.scrollerHeight || 
    bsInstance.scroller?.height ||
    bsInstance.scrollBehaviorY?.contentHeight ||
    bsInstance.scrollBehavior?.contentHeight ||
    undefined
  
  
  // 从 DOM 元素获取（备用方案）
  const wrapperDomHeight = scrollWrapper.value?.clientHeight || 0
  const contentDomHeight = scrollContent.value?.scrollHeight || 0

  // 计算期望的 maxScrollY
  const calculatedMaxScrollY = wrapperHeight && scrollerHeight 
    ? wrapperHeight - scrollerHeight 
    : wrapperDomHeight && contentDomHeight 
    ? wrapperDomHeight - contentDomHeight 
    : null
  
  // 尝试刷新并再次检查
  bscrollInstance.value.refresh()
  await nextTick()

  // 刷新后再次获取
  const maxScrollYAfter = bscrollInstance.value.maxScrollY
  const bsInstanceAfter = bscrollInstance.value as BScroll & {
    wrapperHeight?: number
    scrollerHeight?: number
    hasVerticalScroll?: boolean
    scroller?: { height?: number }
    wrapper?: { height?: number }
    y?: number
    scrollBehaviorY?: {
      maxScrollY?: number
      wrapperHeight?: number
      contentHeight?: number
    }
    scrollBehavior?: {
      maxScrollY?: number
      wrapperHeight?: number
      contentHeight?: number
    }
  }
  const wrapperHeightAfter = 
    bsInstanceAfter.wrapperHeight || 
    bsInstanceAfter.wrapper?.height ||
    bsInstanceAfter.scrollBehaviorY?.wrapperHeight ||
    bsInstanceAfter.scrollBehavior?.wrapperHeight ||
    undefined
  const scrollerHeightAfter = 
    bsInstanceAfter.scrollerHeight || 
    bsInstanceAfter.scroller?.height ||
    bsInstanceAfter.scrollBehaviorY?.contentHeight ||
    bsInstanceAfter.scrollBehavior?.contentHeight ||
    undefined

  // 刷新后的 DOM 尺寸（可能变化）
  const wrapperDomHeightAfter = scrollWrapper.value?.clientHeight || 0
  const contentDomHeightAfter = scrollContent.value?.scrollHeight || 0

  // 计算刷新后的期望 maxScrollY
  const calculatedMaxScrollYAfter = wrapperHeightAfter && scrollerHeightAfter 
    ? wrapperHeightAfter - scrollerHeightAfter 
    : wrapperDomHeightAfter && contentDomHeightAfter 
    ? wrapperDomHeightAfter - contentDomHeightAfter 
    : calculatedMaxScrollY

  // 根据刷新后的信息进行后续处理
  // 诊断问题
  if (maxScrollYAfter === 0 && calculatedMaxScrollYAfter !== null && calculatedMaxScrollYAfter < 0) {
    console.warn('⚠️ 检测到问题：maxScrollY 为 0，但应该可以滚动！')
    console.warn('  期望 maxScrollY:', calculatedMaxScrollYAfter)
    console.warn('  实际 maxScrollY:', maxScrollYAfter)
    console.warn('  可能原因：')
    console.warn('    1. BetterScroll 未正确计算尺寸')
    console.warn('    2. DOM 元素尺寸获取时机不对')
    console.warn('    3. 需要重新初始化 BetterScroll 实例')
  }

  // 同时显示消息提示
  const scrollable = maxScrollYAfter < 0
  const statusMessage = scrollable 
    ? `✅ 可以滚动\n滚动距离: ${Math.abs(maxScrollYAfter)}px`
    : `❌ 无法滚动\nmaxScrollY: ${maxScrollYAfter}`
  showMessage(
    `尺寸信息已打印到控制台\n刷新前: maxScrollY=${maxScrollYBefore}\n刷新后: maxScrollY=${maxScrollYAfter}\n${statusMessage}`,
    scrollable ? 'info' : 'warning',
  )
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
  const updatesToSave: Array<{
    textbook: UserTextbookInfo
    updates: {
      downloadStatus: number
      isDownloaded: boolean
      downloadedFiles: number
    }
  }> = []

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
            downloadedFiles,
          },
        })
      }
    }
  }

  // 第2步：批量保存更新（如果有需要修复的）
  if (updatesToSave.length > 0) {
    const savePromises = updatesToSave.map(({ textbook, updates }) =>
      resourceManager.updateTextbookInfo(textbook, updates),
    )
    await Promise.all(savePromises)
  }
}

// 加载资源数据（优化版本：本地数据优先显示）
const loadResources = async () => {
  const isPullDownRefresh = isPullingDown.value

  // 重置初始加载状态
  initialLoadCompleted.value = false

  // 流程：立即加载本地数据
  const localTextbooks = await loadLocalData()

  // 🔥 下拉刷新时强制从服务器获取最新数据，不使用本地缓存
  if (localTextbooks.length > 0 && !isPullDownRefresh) {
    // 流程：有本地数据且不是下拉刷新，立即显示
    textbooks.value = localTextbooks
    updateSubjectChips()
    // [maxScrollY调试] 本地数据更新后
    if (bscrollInstance.value) {
    }
    initialLoadCompleted.value = true

    // 流程：在DOM更新后修复下载状态（下拉刷新时会自动执行三级对比检测更新）
    await nextTick()
    fixInconsistentDownloadStatus(localTextbooks)
    // [maxScrollY调试] DOM更新后
    if (bscrollInstance.value) {
      // 🔥 刷新 BetterScroll 以更新尺寸计算
      bscrollInstance.value.refresh()
      await nextTick()
    }
  } else {
    // 无本地数据或下拉刷新，显示加载状态并获取服务器数据
    loading.value = true

    try {
      // 检查登录状态
      const isLoggedIn = resourceManager.isLoggedIn()

      if (!isLoggedIn) {
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
      const mergedTextbooks = mergeServerAndLocalData(serverTextbooks, localTextbooks)

      // 为每个教材检查学习资源包（并行处理）
      await checkLearningPackagesForAllTextbooks(mergedTextbooks)

      // 更新本地教材数据
      for (const textbook of mergedTextbooks) {
        await resourceManager.updateTextbookInfo(textbook)
      }

      // 更新教材列表
      textbooks.value = mergedTextbooks
      await nextTick()

      // 🔥 下拉刷新时执行三级对比标记更新（异步执行，不阻塞UI）
      // 在下拉刷新完成后，异步执行三级对比，标记有更新的教材
      apiService
        .checkForUpdates()
        .then((updatedTextbooks) => {
          // 使用公共函数标记更新状态（不显示通知，避免干扰用户）
          markUpdatesFromCheckResult(updatedTextbooks, false).catch((error) => {
            console.warn('下拉刷新时标记更新状态失败:', error)
          })
        })
        .catch((error) => {
          // 三级对比失败不影响下拉刷新的成功，只记录错误
          console.warn('下拉刷新时执行三级对比失败:', error)
        })
      // [maxScrollY调试] 服务器数据更新后
      if (bscrollInstance.value) {
        // 🔥 刷新 BetterScroll 以更新尺寸计算
        bscrollInstance.value.refresh()
        await nextTick()
      }
      updateSubjectChips()
      await nextTick()
      // [maxScrollY调试] updateSubjectChips后
      if (bscrollInstance.value) {
        // 🔥 再次刷新，因为 updateSubjectChips 可能更新了 DOM
        bscrollInstance.value.refresh()
        await nextTick()
      }
    } catch {
      showMessage('加载资源失败，请稍后重试', 'error')
      textbooks.value = []
    } finally {
      loading.value = false
      initialLoadCompleted.value = true
      // 确保最终状态正确刷新
      await nextTick()
      // [maxScrollY调试] loadResources完成
      if (bscrollInstance.value) {
        // 🔥 最终刷新，确保尺寸计算正确
        bscrollInstance.value.refresh()
        await nextTick()
      }
    }
  }
}

// 更新学科筛选选项 - 优化版本，避免重复计算
const updateSubjectChips = () => {
  // 第1步：检查是否需要更新（避免重复计算）
  const currentSubjects = new Set(textbooks.value.map((t) => t.textbookSubjectLabel))
  const currentSubjectKeys = Array.from(currentSubjects).sort().join(',')
  const lastSubjectKeys = categories.value
    .map((c) => c.value)
    .sort()
    .join(',')

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

/**
 * 标记更新状态 - 从三级对比结果中标记教材更新状态
 * @param updatedTextbooks 三级对比返回的需要更新的教材列表
 * @param showNotification 是否显示通知消息（默认true）
 */
const markUpdatesFromCheckResult = async (
  updatedTextbooks: TextbookVersion[],
  showNotification = true,
): Promise<void> => {
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
      }
    })

    // 等待所有更新完成
    await Promise.all(updatePromises)

    updateCount.value = updatedTextbooks.length
    if (showNotification) {
      showMessage(`发现 ${updatedTextbooks.length} 个教材有更新`, 'success')
    }
  } else {
    // 服务器没有返回需要更新的教材，所有教材都是最新版本
    updateCount.value = 0
    if (showNotification) {
      showMessage('所有教材都是最新版本', 'info')
    }
  }

  // 使用 store 通知其他组件更新状态已变化
  resourceStore.markUpdateCheckCompleted()
}

// 检查更新 - 三级对比版本
const checkForUpdates = async () => {
  checkingUpdates.value = true

  try {
    // 开始执行三级更新检查
    const updatedTextbooks = await apiService.checkForUpdates()

    // 使用公共函数标记更新状态
    await markUpdatesFromCheckResult(updatedTextbooks, true)
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
    showMessage(`《${textbook.textbookName}》正在下载中，请勿重复操作`, 'warning')
    return
  }

  // 🔒 防重复下载：检查是否已下载完成且无更新（有更新时允许重新下载）
  if (textbook.downloadStatus === 2 && textbook.isDownloaded && !textbook.hasUpdatesAvailable) {
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
        // 更新下载进度 - 使用实际下载的文件数
        textbook.downloadedFiles = downloadedCount
      },
    )

    if (success) {
      // 下载成功 - 需要从 IndexedDB 获取完整数据（包含 fileData）后再更新状态
      // 因为当前的 textbook 对象中的 localFiles 可能不包含 fileData（被瘦身处理了）
      // 使用三层降级策略查询：id主键 -> textbookId索引 -> getAll（兼容旧数据库无索引的情况）
      const fullTextbook = await resourceManager.getTextbookByIdOrTextbookIdWithFallback(
        textbook.id,
        textbook.textbookId,
        '下载',
      )

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
          getLocalResourceFileName: textbook.getLocalResourceFileName,
        })

        // 使用 store 通知其他组件教材已更新完成
        resourceStore.markTextbookUpdated()
      } else {
        // 降级方案：如果主键查询和索引查询都失败，使用 getAll + 手动查找
        let foundTextbook: UserTextbookInfo | null = null

        // 获取所有教材数据
        const allTextbooks = await resourceManager.indexedDB.getAll<UserTextbookInfo>('textbooks')

        // 优先通过 id 查找
        foundTextbook = allTextbooks.find((t: UserTextbookInfo) => t.id === textbook.id) || null
        if (!foundTextbook) {
          // 如果通过 id 找不到，尝试通过 textbookId 查找（可能有多个相同 textbookId）
          const byTextbookId = allTextbooks.filter(
            (t: UserTextbookInfo) => t.textbookId === textbook.textbookId,
          )
          if (byTextbookId.length > 0) {
            // 如果有多个相同 textbookId，选择最新的（id 最大的）
            foundTextbook = byTextbookId.reduce((latest, current) => {
              return current.id > latest.id ? current : latest
            })
          }
        }

        if (foundTextbook) {
          // 找到了完整教材数据，使用它更新状态
          foundTextbook.isDownloaded = true
          foundTextbook.downloadStatus = 2 // 下载完成
          foundTextbook.downloadedFiles = foundTextbook.totalFiles
          foundTextbook.lastDownloadTime = new Date().toISOString()
          foundTextbook.hasUpdatesAvailable = false

          // 保存完整教材数据到IndexedDB（包含 localFiles 中的 fileData）
          await resourceManager.updateTextbookInfo(foundTextbook, {
            isDownloaded: true,
            downloadStatus: 2,
            downloadedFiles: foundTextbook.totalFiles,
            lastDownloadTime: new Date().toISOString(),
            hasUpdatesAvailable: false,
          })

          // 更新Vue组件中的textbook对象（用于显示）
          Object.assign(textbook, {
            ...foundTextbook,
            // 保留显示用的方法
            updateStructure: textbook.updateStructure,
            updatePackages: textbook.updatePackages,
            getLocalResourceFileName: textbook.getLocalResourceFileName,
          })
        } else {
          // 降级方案2：如果还是找不到，使用当前textbook更新
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

          // 发送自定义事件，通知其他组件教材已下载完成
          window.dispatchEvent(new CustomEvent('textbook-updated'))
        }
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

// 更新教材 - 基于安卓原生逻辑完善
const updateTextbook = (textbook: UserTextbookInfo) => {
  // 🔒 防重复下载：检查是否已在下载中
  if (textbook.downloadStatus === 1) {
    showMessage(`《${textbook.textbookName}》正在下载中，请勿重复操作`, 'warning')
    return
  }

  // 重置更新状态（但保留hasUpdatesAvailable，让downloadTextbook处理）
  // 注意：不要提前设置downloadStatus=1，让downloadTextbook函数来设置，避免状态检查冲突

  // 开始下载更新（downloadTextbook会自动设置downloadStatus=1）
  downloadTextbook(textbook)
}

// 处理暂停下载 - 用户主动暂停单个教材
const handlePauseDownload = async (textbook: UserTextbookInfo) => {
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
        downloadedFiles: textbook.downloadedFiles, // 保存已下载的文件数量
      })

      showMessage(`《${textbook.textbookName}》已暂停`, 'info')
    } else {
      showMessage(`《${textbook.textbookName}》暂停失败`, 'error')
    }
  } catch (error) {
    console.error('暂停下载失败:', error)
    showMessage(
      `《${textbook.textbookName}》暂停失败: ${error instanceof Error ? error.message : '未知错误'}`,
      'error',
    )
  }
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
    const textbookToDelete = textbooks.value.find((t) => t.id === deleteTextbookId.value)
    if (
      textbookToDelete &&
      (textbookToDelete.downloadStatus === 1 || textbookToDelete.downloadStatus === 3)
    ) {
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
      const index = textbooks.value.findIndex((t) => t.id === deleteTextbookId.value)
      if (index !== -1) {
        textbooks.value.splice(index, 1)
      }

      // 第4步：刷新 BScroll 实例（如果存在）
      await nextTick()
      if (bscrollInstance.value) {
        bscrollInstance.value.refresh()
      }

      // 第5步：如果删除后列表为空，重新加载数据
      if (textbooks.value.length === 0) {
        await loadResources()
      }

      showMessage(`《${deleteTextbookName.value}》已删除`, 'success')
      showDeleteDialog.value = false
    } else {
      showMessage(`删除《${deleteTextbookName.value}》失败`, 'error')
    }
  } catch (error) {
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
  // 第1步：加载资源数据
  await loadResources()

  // 第2步：初始化 better-scroll（带下拉刷新）
  await initBScroll()

  // 第3步：清理过期数据 - 延迟到后台执行
  resourceManager.cleanupExpiredData()

  // 定期检查更新（每60分钟）- 延迟启动
  // 注意：App.vue中已有全局资源自动更新检查，这里的定时器作为页面级别的额外检查
  resourceUpdateCheckTimer = setInterval(
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
    const downloadingTextbooks = textbooks.value.filter((textbook) => textbook.downloadStatus === 1)

    if (downloadingTextbooks.length === 0) {
      return
    }

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
        }
      } catch {
        // 静默处理错误
      }
    })

    // 等待所有暂停操作完成
    await Promise.all(pausePromises)
  } catch {
    // 静默处理错误
  }
}

// 组件卸载时销毁 better-scroll 并暂停所有下载任务
onUnmounted(async () => {
  // 流程：页面离开时立即暂停所有正在下载的任务
  await pauseAllDownloadingTasks()

  // 第1步：销毁 BScroll 实例
  if (bscrollInstance.value) {
    bscrollInstance.value.destroy()
    bscrollInstance.value = null
  }

  // 第2步：清理资源更新检查定时器
  if (resourceUpdateCheckTimer) {
    clearInterval(resourceUpdateCheckTimer)
    resourceUpdateCheckTimer = null
  }
})
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

  // 下拉刷新提示样式
  .pull-down-refresh {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 16px;
    min-height: 48px;

    &.success {
      .pull-down-text {
        color: #10b981;
      }
    }

    &.error {
      .pull-down-text {
        color: #ef4444;
      }
    }

    .pull-down-text {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.6);
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .refresh-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      border-top: 2px solid rgba(0, 0, 0, 0.6);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }
  }

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
    }

    // 调试按钮区域样式
    .filter-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 8px 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      gap: 8px;

      .debug-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: none;
        outline: none;
        border-radius: 4px;
        background: transparent;
        color: #6e55ff;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        min-width: auto;

        i.material-icons {
          font-size: 18px;
        }

        &:hover {
          background: rgba(110, 85, 255, 0.1);
        }

        &:active {
          background: rgba(110, 85, 255, 0.2);
        }
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
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.1),
        0 0 0 1px rgba(0, 0, 0, 0.05);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      background: #ffffff;
      contain: layout style paint;
      transform: translateZ(0);
      backface-visibility: hidden;
      position: relative;

      // 删除按钮（右上角）- Material Design 风格
      .textbook-delete-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        min-width: 32px;
        padding: 0;
        border: none;
        outline: none;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.9);
        color: rgba(0, 0, 0, 0.54);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

        i.material-icons {
          font-size: 18px;
        }

        &:hover {
          background-color: rgba(255, 255, 255, 1);
          color: rgba(193, 0, 21, 0.87);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        &:active {
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.2),
            0 0 1px rgba(0, 0, 0, 0.1);
          transform: scale(0.95);
        }
      }

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
            margin-top: 44px;
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

            .status-dot-gray {
              background: #ffffff;
            }

            .status-text {
              font-size: 12px;
              font-weight: 500;
              color: #ffffff;
            }

            &.status-indicator-blue {
              background: rgba(110, 85, 255, 0.64);
            }

            &.status-indicator-green {
              background: rgba(16, 185, 129, 0.64);
            }

            &.status-indicator-gray {
              background: rgba(107, 114, 128, 0.64);
            }

            &.status-indicator-orange {
              background: rgba(245, 158, 11, 0.64);
            }

            &.status-indicator-red {
              background: rgba(239, 68, 68, 0.64);
            }
          }
        }

        // 右侧：操作按钮
        .textbook-actions {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          width: 90px;

          .action-buttons-group {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            width: 100%;
          }

          .action-btn {
            min-width: 90px;
            width: 90px;
            height: 43px;
            border-radius: 12px;
            font-weight: 500;
            border: none;
            outline: none;
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

          // 下载进度条（可点击暂停）
          .download-progress-bar {
            min-width: 90px;
            width: 90px;

            &.clickable {
              cursor: pointer;
              user-select: none;

              &:hover {
                .progress-bar-container {
                  border-color: #f59e0b;
                  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
                }
              }

              &:active {
                .progress-bar-container {
                  transform: scale(0.98);
                }
              }
            }

            .progress-bar-container {
              position: relative;
              width: 100%;
              height: 43px;
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              border: 1px solid rgba(0, 0, 0, 0.1);

              .progress-bar-fill {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                background: rgba(110, 85, 255, 0.3);
                transition: width 0.3s ease;
                border-radius: 12px;
                z-index: 1;
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
  }

  .reload-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    padding: 10px 24px;
    border: none;
    outline: none;
    border-radius: 4px;
    background-color: rgba(110, 85, 255, 0.64);
    color: #ffffff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    i.material-icons {
      font-size: 18px;
    }

    &:hover {
      background-color: rgba(90, 66, 230, 0.64);
      box-shadow: 0 2px 4px rgba(110, 85, 255, 0.3);
    }

    &:active {
      background-color: rgba(77, 53, 204, 0.64);
      box-shadow: 0 1px 2px rgba(110, 85, 255, 0.3);
    }
  }
}

// 对话框按钮样式
.dialog-btn {
  padding: 8px 16px;
  border: none;
  outline: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 64px;

  &.dialog-btn-cancel {
    background: transparent;
    color: rgba(0, 0, 0, 0.6);

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    &:active {
      background: rgba(0, 0, 0, 0.1);
    }
  }

  &.dialog-btn-confirm {
    background-color: rgba(193, 0, 21, 0.64);
    color: #ffffff;
    margin-left: 8px;

    &:hover:not(:disabled) {
      background-color: rgba(160, 0, 18, 0.64);
      box-shadow: 0 2px 4px rgba(193, 0, 21, 0.3);
    }

    &:active:not(:disabled) {
      background-color: rgba(144, 0, 16, 0.64);
      box-shadow: 0 1px 2px rgba(193, 0, 21, 0.3);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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

      .filter-actions {
        padding: 8px 16px;
        justify-content: center;

        .debug-btn {
          width: 100%;
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

        .textbook-delete-btn {
          top: 4px;
          right: 4px;
        }

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

            .download-progress-bar {
              width: 100%;
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
