<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="my-resources-view">

    <!-- 筛选区域 -->
    <h6>图片资源问一下涛哥</h6>
    <div class="filter-section q-pa-md">
      <q-card flat bordered class="q-pa-md">
        <div class="row items-center q-gutter-md">
          <div class="col-auto">
            <q-icon name="filter_list" size="sm" class="text-grey-6" />
            <span class="text-subtitle2 text-grey-7 q-ml-xs">学科筛选</span>
          </div>
          <div class="col">
            <q-chip-group>
              <q-chip
                v-for="category in categories"
                :key="category.value"
                :selected="selectedSubjects.has(category.value)"
                :color="selectedSubjects.has(category.value) ? 'primary' : 'grey-4'"
                :text-color="selectedSubjects.has(category.value) ? 'white' : 'grey-8'"
                clickable
                @click="toggleSubject(category.value)"
                :label="category.label"
              />
            </q-chip-group>
          </div>
          <div class="col-auto">
            <q-btn
              color="secondary"
              icon="system_update"
              label="检查更新"
              @click="checkForUpdates"
              :loading="checkingUpdates"
              :disable="loading || checkingUpdates"
              unelevated
            />
          </div>
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="download"
              label="批量下载"
              @click="downloadAllTextbooks"
              :disable="loading || checkingUpdates"
              unelevated
            />
          </div>
          <div class="col-auto">
            <q-btn
              color="orange"
              icon="pause"
              label="暂停全部"
              @click="pauseAllDownloads"
              :disable="loading || checkingUpdates"
              unelevated
            />
          </div>
        </div>
      </q-card>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state q-pa-xl text-center">
      <q-spinner-dots size="50px" color="primary" />
      <div class="text-h6 text-grey-6 q-mt-md">正在加载资源...</div>
    </div>


    <!-- 教材列表 -->
    <div v-else class="textbooks-container q-pa-md">
      <div class="textbooks-scroll-container">
        <div class="textbooks-grid">
          <div 
            v-for="textbook in filteredTextbooks" 
            :key="textbook.textbookId"
            class="textbook-item-wrapper"
          >
          <q-card 
            class="textbook-card"
            :class="{ 'downloading': textbook.downloadStatus === 1 }"
            flat
            bordered
          >
            <!-- 教材封面 -->
            <q-img
              :src="textbook.textbookCover || '/icons/book.svg'"
              :alt="textbook.textbookName"
              height="200px"
              class="textbook-cover"
            >
              <!-- 下载状态覆盖层 -->
              <div v-if="textbook.downloadStatus === 1" class="absolute-full flex flex-center bg-black-50">
                <q-circular-progress
                  :value="textbook.downloadedFiles / textbook.totalFiles"
                  size="60px"
                  :thickness="0.22"
                  color="white"
                  track-color="grey-8"
                  class="q-ma-md"
                >
                  <div class="text-white text-caption">
                    {{ Math.round((textbook.downloadedFiles / textbook.totalFiles) * 100) }}%
                  </div>
                </q-circular-progress>
              </div>
              
              <!-- 更新徽章 -->
              <div v-if="textbook.hasUpdatesAvailable" class="absolute-top-right">
                <q-badge color="red" floating>更新</q-badge>
              </div>
            </q-img>

            <!-- 教材信息 -->
            <q-card-section>
              <div class="text-h6 text-weight-bold textbook-name q-mb-xs">
                {{ textbook.textbookName }}
              </div>
              <div class="text-caption text-grey-6 q-mb-xs">
                {{ textbook.textbookSubjectLabel }} {{ textbook.textbookGradeLabel }} {{ textbook.textbookSemesterLabel }}
              </div>
              <div class="text-caption text-grey-5">
                {{ textbook.textbookPublisher }}
              </div>
              
              <!-- 下载进度条 -->
              <div v-if="textbook.downloadStatus === 1" class="q-mt-sm">
                <q-linear-progress
                  :value="textbook.downloadedFiles / textbook.totalFiles"
                  color="primary"
                  size="8px"
                  rounded
                  animated
                />
                <div class="text-caption text-grey-6 q-mt-xs text-center">
                  {{ textbook.downloadedFiles }}/{{ textbook.totalFiles }} 文件
                  <span class="q-ml-xs">
                    ({{ Math.round((textbook.downloadedFiles / textbook.totalFiles) * 100) }}%)
                  </span>
                </div>
              </div>
              
              <!-- 下载状态信息 -->
              <div v-else-if="textbook.downloadStatus === 2" class="q-mt-sm">
                <div class="text-caption text-positive text-center">
                  <q-icon name="check_circle" size="xs" class="q-mr-xs" />
                  已下载完成
                </div>
                <div v-if="textbook.lastDownloadTime" class="text-caption text-grey-5 text-center q-mt-xs">
                  下载时间: {{ formatDownloadTime(textbook.lastDownloadTime) }}
                </div>
              </div>
              
              <!-- 部分下载状态 -->
              <div v-else-if="textbook.downloadedFiles > 0 && textbook.downloadedFiles < textbook.totalFiles" class="q-mt-sm">
                <q-linear-progress
                  :value="textbook.downloadedFiles / textbook.totalFiles"
                  color="warning"
                  size="6px"
                  rounded
                />
                <div class="text-caption text-warning text-center q-mt-xs">
                  部分下载 {{ textbook.downloadedFiles }}/{{ textbook.totalFiles }} 文件
                </div>
              </div>
            </q-card-section>
            <!-- 操作按钮 -->
            <q-card-actions align="around" class="q-pa-md">
              <!-- 下载按钮 - 未下载状态 -->
              <q-btn
                v-if="!textbook.isDownloaded && textbook.downloadStatus !== 1 && textbook.downloadedFiles === 0"
                color="primary"
                icon="download"
                label="下载"
                @click="downloadTextbook(textbook)"
                unelevated
                rounded
                :loading="false"
              />
              
              <!-- 继续下载按钮 - 部分下载状态 -->
              <q-btn
                v-if="textbook.downloadedFiles > 0 && textbook.downloadedFiles < textbook.totalFiles && textbook.downloadStatus !== 1"
                color="primary"
                icon="play_arrow"
                label="继续"
                @click="downloadTextbook(textbook)"
                unelevated
                rounded
                :loading="false"
              />
              
              <!-- 暂停按钮 - 下载中状态 -->
              <q-btn
                v-if="textbook.downloadStatus === 1"
                color="orange"
                icon="pause"
                label="暂停"
                @click="pauseDownload(textbook)"
                unelevated
                rounded
                :loading="false"
              />
              
              <!-- 查看按钮 - 已下载状态 -->
              <q-btn
                v-if="textbook.isDownloaded && textbook.downloadStatus === 2"
                color="positive"
                icon="visibility"
                label="查看"
                @click="viewTextbook(textbook)"
                unelevated
                rounded
              />
              
              <!-- 更新按钮 - 有更新可用 -->
              <q-btn
                v-if="textbook.hasUpdatesAvailable && textbook.downloadStatus !== 1"
                color="secondary"
                icon="system_update"
                label="更新"
                @click="updateTextbook(textbook)"
                unelevated
                rounded
              />
              
              <!-- 重新下载按钮 - 下载失败状态 -->
              <q-btn
                v-if="textbook.downloadStatus === 0 && textbook.downloadedFiles === 0"
                color="negative"
                icon="refresh"
                label="重试"
                @click="downloadTextbook(textbook)"
                unelevated
                rounded
              />
              
              <!-- 更多操作菜单 -->
              <q-btn
                v-if="textbook.isDownloaded || textbook.downloadedFiles > 0"
                color="grey-7"
                icon="more_vert"
                round
                flat
              >
                <q-menu>
                  <q-list style="min-width: 120px">
                    <!-- 重新下载选项 -->
                    <q-item clickable v-close-popup @click="downloadTextbook(textbook)">
                      <q-item-section avatar>
                        <q-icon name="refresh" color="primary" />
                      </q-item-section>
                      <q-item-section>重新下载</q-item-section>
                    </q-item>
                    
                    <!-- 删除选项 -->
                    <q-item clickable v-close-popup @click="deleteTextbook(textbook)">
                      <q-item-section avatar>
                        <q-icon name="delete" color="negative" />
                      </q-item-section>
                      <q-item-section>删除</q-item-section>
                    </q-item>
                    
                    <!-- 查看详情选项 -->
                    <q-item clickable v-close-popup @click="viewTextbookDetails(textbook)">
                      <q-item-section avatar>
                        <q-icon name="info" color="info" />
                      </q-item-section>
                      <q-item-section>详情</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </q-card-actions>
          </q-card>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && filteredTextbooks.length === 0" class="empty-state q-pa-xl text-center">
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
          <q-btn 
            flat 
            label="确认" 
            color="primary" 
            @click="confirmAction"
            v-close-popup
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 下载进度对话框 -->
    <q-dialog v-model="showDownloadDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center">
          <q-avatar icon="download" color="primary" text-color="white" />
          <span class="q-ml-sm text-h6">下载进度</span>
        </q-card-section>

        <q-card-section>
          <div class="text-body1 q-mb-md">{{ currentDownloadTextbook?.textbookName }}</div>
          
          <!-- 总体进度 -->
          <div class="q-mb-md">
            <div class="text-caption text-grey-6 q-mb-xs">总体进度</div>
            <q-linear-progress
              :value="overallProgress"
              color="primary"
              size="12px"
              rounded
              animated
            />
            <div class="text-caption text-grey-6 q-mt-xs text-center">
              {{ Math.round(overallProgress * 100) }}%
            </div>
          </div>
          
          <!-- 文件进度 -->
          <div class="q-mb-md">
            <div class="text-caption text-grey-6 q-mb-xs">文件进度</div>
            <div class="text-body2 text-center">
              {{ currentDownloadedFiles }}/{{ currentTotalFiles }} 文件
            </div>
          </div>
          
          <!-- 当前下载文件 -->
          <div v-if="currentDownloadingFile" class="q-mb-md">
            <div class="text-caption text-grey-6 q-mb-xs">正在下载</div>
            <div class="text-body2">{{ currentDownloadingFile }}</div>
            <q-linear-progress
              :value="currentFileProgress"
              color="secondary"
              size="8px"
              rounded
              animated
            />
            <div class="text-caption text-grey-6 q-mt-xs text-center">
              {{ Math.round(currentFileProgress * 100) }}%
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn 
            flat 
            label="暂停" 
            color="orange" 
            @click="pauseCurrentDownload"
            v-if="currentDownloadTextbook"
          />
          <q-btn 
            flat 
            label="关闭" 
            color="grey" 
            v-close-popup
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 通知消息 -->
    <q-banner
      v-if="notification.show"
      :class="notification.type"
      class="fixed-top q-mt-sm"
      rounded
      dismissible
      @dismiss="notification.show = false"
    >
      <template v-slot:avatar>
        <q-icon :name="notification.icon" />
      </template>
      {{ notification.message }}
    </q-banner>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { resourceManager } from '../services/resource-manager'
import { apiService } from '../services/api-service'
import type { UserTextbookInfo } from '../types'

// 路由
const router = useRouter()

// 响应式数据
const loading = ref(false)
const checkingUpdates = ref(false)
const textbooks = ref<UserTextbookInfo[]>([])
const selectedSubjects = ref(new Set<string>())
const updateCount = ref(0)

// 确认对话框
const showConfirmDialog = ref(false)
const confirmDialog = ref({
  title: '',
  message: '',
  action: null as (() => void) | null
})

// 通知消息
const notification = ref({
  show: false,
  message: '',
  type: 'bg-positive text-white',
  icon: 'check'
})

// 下载进度对话框
const showDownloadDialog = ref(false)
const currentDownloadTextbook = ref<UserTextbookInfo | null>(null)
const currentDownloadingFile = ref('')
const currentFileProgress = ref(0)
const currentDownloadedFiles = ref(0)
const currentTotalFiles = ref(0)
const overallProgress = ref(0)

// 分类选项 - 基于学科动态生成
const categories = ref([
  { label: '全部', value: 'all' }
])

// 计算属性 - 简化的筛选逻辑
const filteredTextbooks = computed(() => {
  if (selectedSubjects.value.has('all') || selectedSubjects.value.size === 0) {
    return textbooks.value
  }
  
  return textbooks.value.filter(textbook => 
    selectedSubjects.value.has(textbook.textbookSubjectLabel)
  )
})


// 方法

// 切换学科选择
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

// 加载资源数据
const loadResources = async () => {
  loading.value = true
  try {
    // 检查登录状态
    if (!resourceManager.isLoggedIn()) {
      console.warn('用户未登录，尝试自动登录...')
      
      // 尝试自动登录
      const autoLoginSuccess = await apiService.autoLogin(true)
      if (!autoLoginSuccess) {
        console.warn('自动登录失败，无法加载资源')
        textbooks.value = []
        return
      }
      
      console.log('自动登录成功，继续加载资源')
    }

    // 使用与安卓原生一致的数据获取策略：优先服务器数据，与本地数据合并
    resourceManager.fetchUserAllOnlineTextbooks({
      onSuccess: (data) => {
        textbooks.value = data
        updateSubjectChips()
      },
      onError: (error) => {
        console.error('加载教材失败:', error)
        showMessage('加载教材失败，请稍后重试', 'error')
        textbooks.value = []
      }
    })
  } catch (error) {
    console.error('加载资源失败:', error)
    showMessage('加载资源失败，请稍后重试', 'error')
    textbooks.value = []
  } finally {
    loading.value = false
  }
}

// 更新学科筛选选项
const updateSubjectChips = () => {
  const subjects = new Set(textbooks.value.map(t => t.textbookSubjectLabel))
  const newCategories = [{ label: '全部', value: 'all' }]
  
  subjects.forEach(subject => {
    newCategories.push({ label: subject, value: subject })
  })
  
  categories.value = newCategories
  
  // 默认选择"全部"
  if (selectedSubjects.value.size === 0) {
    selectedSubjects.value.add('all')
  }
}

// 检查更新
const checkForUpdates = () => {
  checkingUpdates.value = true
  resourceManager.checkForUpdates({
    onUpdateAvailable: (updatedTextbooks) => {
      // 更新教材的更新状态
      textbooks.value.forEach(textbook => {
        const hasUpdate = updatedTextbooks.some(update => update.textbookId === textbook.textbookId)
        textbook.hasUpdatesAvailable = hasUpdate
      })
      updateCount.value = updatedTextbooks.length
      showMessage(`发现 ${updatedTextbooks.length} 个教材有更新`, 'success')
    },
    onNoUpdates: () => {
      textbooks.value.forEach(textbook => {
        textbook.hasUpdatesAvailable = false
      })
      updateCount.value = 0
      showMessage('所有教材都是最新版本', 'info')
    },
      onError: (error) => {
        console.error('检查更新失败:', error)
        showMessage('检查更新失败，请稍后重试', 'error')
      }
  })
  checkingUpdates.value = false
}

// 下载教材 - 基于安卓原生下载逻辑完善
const downloadTextbook = (textbook: UserTextbookInfo) => {
  console.log(`开始下载教材: ${textbook.textbookName}`)
  
  // 设置下载状态
  textbook.downloadStatus = 1 // 下载中
  textbook.isDownloaded = false
  
  // 显示下载进度对话框
  currentDownloadTextbook.value = textbook
  currentTotalFiles.value = textbook.totalFiles
  currentDownloadedFiles.value = textbook.downloadedFiles
  overallProgress.value = textbook.downloadedFiles / textbook.totalFiles
  showDownloadDialog.value = true
  
  resourceManager.downloadTextbook(textbook.id, {
    onSuccess: () => {
      textbook.isDownloaded = true
      textbook.downloadStatus = 2 // 下载完成
      textbook.downloadedFiles = textbook.totalFiles
      textbook.lastDownloadTime = new Date().toISOString()
      textbook.hasUpdatesAvailable = false
      
      // 更新进度对话框
      overallProgress.value = 1
      currentDownloadedFiles.value = textbook.totalFiles
      
      showMessage(`《${textbook.textbookName}》下载完成`, 'success')
      console.log(`教材 ${textbook.textbookName} 下载完成`)
      
      // 延迟关闭对话框
      setTimeout(() => {
        showDownloadDialog.value = false
        currentDownloadTextbook.value = null
      }, 2000)
    },
    onError: (error) => {
      textbook.downloadStatus = 0 // 下载失败
      textbook.isDownloaded = false
      
      console.error('下载失败:', error)
      showMessage(`《${textbook.textbookName}》下载失败: ${error}`, 'error')
      
      // 关闭对话框
      showDownloadDialog.value = false
      currentDownloadTextbook.value = null
    },
    onProgress: (progress) => {
      textbook.downloadStatus = 1 // 下载中
      textbook.downloadedFiles = Math.floor((progress / 100) * textbook.totalFiles)
      
      // 更新进度对话框
      overallProgress.value = progress / 100
      currentDownloadedFiles.value = textbook.downloadedFiles
      
      // 实时更新UI进度
      console.log(`教材 ${textbook.textbookName} 下载进度: ${progress}%`)
    }
  })
}

// 暂停下载 - 基于安卓原生逻辑完善
const pauseDownload = (textbook: UserTextbookInfo) => {
  console.log(`暂停下载教材: ${textbook.textbookName}`)
  
  resourceManager.pauseDownload(textbook.textbookId, {
    onSuccess: () => {
      textbook.downloadStatus = 0 // 暂停状态
      textbook.isDownloaded = false
      
      showMessage(`《${textbook.textbookName}》下载已暂停`, 'warning')
      console.log(`教材 ${textbook.textbookName} 下载已暂停`)
    },
    onError: (error) => {
      console.error('暂停下载失败:', error)
      showMessage(`暂停《${textbook.textbookName}》失败: ${error}`, 'error')
    }
  })
}

// 查看教材
const viewTextbook = (textbook: UserTextbookInfo) => {
  // 跳转到知识图谱页面，并传递教材信息
  router.push({
    name: 'knowledgeGraph',
    query: {
      textbookId: textbook.textbookId,
      textbookName: textbook.textbookName
    }
  })
}

// 更新教材 - 基于安卓原生逻辑完善
const updateTextbook = (textbook: UserTextbookInfo) => {
  console.log(`开始更新教材: ${textbook.textbookName}`)
  
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
    }
  }
}

// 删除教材 - 基于安卓原生逻辑完善
const deleteTextbook = (textbook: UserTextbookInfo) => {
  console.log(`准备删除教材: ${textbook.textbookName}`)
  
  showConfirmDialog.value = true
  confirmDialog.value = {
    title: '删除教材',
    message: `确定要删除教材"${textbook.textbookName}"吗？删除后将清除所有本地文件，需要重新下载。`,
    action: () => {
      resourceManager.deleteTextbook(textbook.textbookId, {
        onSuccess: () => {
          // 从列表中移除教材
          const index = textbooks.value.findIndex(t => t.textbookId === textbook.textbookId)
          if (index > -1) {
            textbooks.value.splice(index, 1)
          }
          
          showMessage(`《${textbook.textbookName}》删除成功`, 'success')
          console.log(`教材 ${textbook.textbookName} 删除成功`)
        },
        onError: (error) => {
          console.error('删除教材失败:', error)
          showMessage(`删除《${textbook.textbookName}》失败: ${error}`, 'error')
        }
      })
    }
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
    action: null
  }
}

// 格式化下载时间
const formatDownloadTime = (timeString: string): string => {
  try {
    const date = new Date(timeString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffMinutes < 1) {
      return '刚刚'
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`
    } else if (diffHours < 24) {
      return `${diffHours}小时前`
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      return date.toLocaleDateString('zh-CN')
    }
  } catch {
    return '未知时间'
  }
}

// 查看教材详情
const viewTextbookDetails = (textbook: UserTextbookInfo) => {
  console.log('查看教材详情:', textbook.textbookName)
  
  // 显示教材详细信息
  const details = `
教材名称: ${textbook.textbookName}
学科: ${textbook.textbookSubjectLabel}
年级: ${textbook.textbookGradeLabel} ${textbook.textbookSemesterLabel}
出版社: ${textbook.textbookPublisher}
ISBN: ${textbook.textbookIsbn}
总文件数: ${textbook.totalFiles}
已下载: ${textbook.downloadedFiles}
下载状态: ${getDownloadStatusText(textbook.downloadStatus)}
最后下载时间: ${textbook.lastDownloadTime ? formatDownloadTime(textbook.lastDownloadTime) : '未下载'}
更新状态: ${textbook.hasUpdatesAvailable ? '有更新可用' : '已是最新版本'}
  `
  
  showMessage(details, 'info')
}

// 获取下载状态文本
const getDownloadStatusText = (status: number): string => {
  switch (status) {
    case 0: return '未下载'
    case 1: return '下载中'
    case 2: return '已下载'
    default: return '未知状态'
  }
}

// 批量操作 - 下载所有教材
const downloadAllTextbooks = () => {
  const undownloadedTextbooks = filteredTextbooks.value.filter(t => !t.isDownloaded && t.downloadStatus !== 1)
  
  if (undownloadedTextbooks.length === 0) {
    showMessage('没有可下载的教材', 'info')
    return
  }
  
  showConfirmDialog.value = true
  confirmDialog.value = {
    title: '批量下载',
    message: `确定要下载所有 ${undownloadedTextbooks.length} 个教材吗？`,
    action: () => {
      undownloadedTextbooks.forEach(textbook => {
        downloadTextbook(textbook)
      })
      showMessage(`开始批量下载 ${undownloadedTextbooks.length} 个教材`, 'success')
    }
  }
}

// 暂停当前下载
const pauseCurrentDownload = () => {
  if (currentDownloadTextbook.value) {
    pauseDownload(currentDownloadTextbook.value)
    showDownloadDialog.value = false
    currentDownloadTextbook.value = null
  }
}

// 批量操作 - 暂停所有下载
const pauseAllDownloads = () => {
  const downloadingTextbooks = filteredTextbooks.value.filter(t => t.downloadStatus === 1)
  
  if (downloadingTextbooks.length === 0) {
    showMessage('没有正在下载的教材', 'info')
    return
  }
  
  downloadingTextbooks.forEach(textbook => {
    pauseDownload(textbook)
  })
  
  showMessage(`已暂停 ${downloadingTextbooks.length} 个教材的下载`, 'warning')
}

// 显示消息
const showMessage = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  notification.value = {
    show: true,
    message,
    type: type === 'success' ? 'bg-positive text-white' : 
          type === 'error' ? 'bg-negative text-white' :
          type === 'warning' ? 'bg-warning text-white' :
          'bg-info text-white',
    icon: type === 'success' ? 'check' :
          type === 'error' ? 'error' :
          type === 'warning' ? 'warning' :
          'info'
  }
  
  // 3秒后自动隐藏
  setTimeout(() => {
    notification.value.show = false
  }, 3000)
}

// 生命周期
onMounted(async () => {
  console.log('我的资源页面已加载')
  await loadResources()
  
  // 清理过期数据
  resourceManager.cleanupExpiredData()
  
  // 定期检查更新（每5分钟）
  setInterval(() => {
    if (!loading.value && !checkingUpdates.value) {
      checkForUpdates()
    }
  }, 5 * 60 * 1000)
})
</script>

<style lang="scss" scoped>
.q-layout {
  background: #f5f5f5;
}

.my-resources-view {
  padding: 24px;
  background: transparent;
  min-height: calc(100vh - 64px);

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

  .filter-section {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    .filter-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 16px;
    }

    .chip-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 20px;

      .chip {
        padding: 8px 16px;
        border: 2px solid #e0e0e0;
        border-radius: 20px;
        background: white;
        color: #666;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          border-color: #007bff;
          color: #007bff;
        }

        &.active {
          background: #007bff;
          border-color: #007bff;
          color: white;
        }
      }
    }

    .action-buttons {
      display: flex;
      gap: 12px;

      .btn-refresh,
      .btn-check-updates {
        padding: 10px 20px;
        border: 2px solid #007bff;
        border-radius: 6px;
        background: white;
        color: #007bff;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover:not(:disabled) {
          background: #007bff;
          color: white;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
    display: flex;
    flex-direction: column;
    gap: 16px;
    
    .textbooks-scroll-container {
      max-height: calc(100vh - 200px); // 减去筛选区域和页面的其他高度
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 8px; // 为滚动条留出空间
      
      // 自定义滚动条样式
      &::-webkit-scrollbar {
        width: 8px;
      }
      
      &::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }
      
      &::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 4px;
        
        &:hover {
          background: #a8a8a8;
        }
      }
      
      // Firefox 滚动条样式
      scrollbar-width: thin;
      scrollbar-color: #c1c1c1 #f1f1f1;
    }

    // 教材网格布局
    .textbooks-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      justify-items: center;
      align-items: start;
      padding: 10px 0;
      
      // 响应式调整
      @media (max-width: 600px) {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 16px;
      }
      
      @media (min-width: 1200px) {
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 24px;
      }
    }

    // 教材项包装器
    .textbook-item-wrapper {
      width: 100%;
      max-width: 320px;
      display: flex;
      justify-content: center;
    }

    // Material Design 教材卡片样式
    .textbook-card {
      width: 100%;
      max-width: 300px;
      border-radius: 4px; // Material Design 使用较小的圆角
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05); // Material Design 阴影
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); // Material Design 缓动函数
      overflow: hidden;
      background: #ffffff;

      &:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
      }

      &:active {
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
        transform: translateY(0);
      }

      &.downloading {
        border-left: 4px solid #2196F3; // Material Design 蓝色
      }
    }

    .textbook-item {
      background: #ffffff;
      border-radius: 4px; // Material Design 圆角
      padding: 16px; // Material Design 间距
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      gap: 16px;

      &:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
      }

      &:active {
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
        transform: translateY(0);
      }

      &.downloading {
        border-left: 4px solid #2196F3; // Material Design 蓝色
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
              background: #2196F3; // Material Design 蓝色
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
            background: #2196F3; // Material Design 蓝色
            color: white;

            &:hover {
              background: #1976D2;
            }
          }

          &.pause {
            background: #FF9800; // Material Design 橙色
            color: white;

            &:hover {
              background: #F57C00;
            }
          }

          &.view {
            background: #4CAF50; // Material Design 绿色
            color: white;

            &:hover {
              background: #388E3C;
            }
          }

          &.update {
            background: #FF5722; // Material Design 深橙色
            color: white;

            &:hover {
              background: #E64A19;
            }
          }

          &.delete {
            background: #F44336; // Material Design 红色
            color: white;

            &:hover {
              background: #D32F2F;
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
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);

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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
      padding: 16px;
      margin-bottom: 16px;

      .action-buttons {
        flex-direction: column;
      }
    }

    .textbooks-container {
      .textbooks-scroll-container {
        max-height: calc(100vh - 150px); // 移动端调整高度
        padding-right: 4px; // 移动端减少滚动条空间
      }
      
      .textbooks-grid {
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 8px; // Material Design 移动端间距
        padding: 8px 0;
      }
      
      .textbook-item-wrapper {
        max-width: 250px;
      }
      
      .textbook-card {
        max-width: 250px;
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
 