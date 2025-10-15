<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="my-resources-view">

    <!-- 筛选区域 -->
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
      <div class="row q-gutter-md">
        <div 
          v-for="textbook in filteredTextbooks" 
          :key="textbook.textbookId"
          class="col-12 col-sm-6 col-md-4 col-lg-3"
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
                />
                <div class="text-caption text-grey-6 q-mt-xs text-center">
                  {{ textbook.downloadedFiles }}/{{ textbook.totalFiles }} 文件
                </div>
              </div>
            </q-card-section>

            <!-- 操作按钮 -->
            <q-card-actions align="around" class="q-pa-md">
              <!-- 下载按钮 -->
              <q-btn
                v-if="!textbook.isDownloaded && textbook.downloadStatus !== 1"
                color="primary"
                icon="download"
                label="下载"
                @click="downloadTextbook(textbook)"
                unelevated
                rounded
              />
              
              <!-- 暂停按钮 -->
              <q-btn
                v-if="textbook.downloadStatus === 1"
                color="orange"
                icon="pause"
                label="暂停"
                @click="pauseDownload(textbook)"
                unelevated
                rounded
              />
              
              <!-- 查看按钮 -->
              <q-btn
                v-if="textbook.isDownloaded"
                color="positive"
                icon="visibility"
                label="查看"
                @click="viewTextbook(textbook)"
                unelevated
                rounded
              />
              
              <!-- 更新按钮 -->
              <q-btn
                v-if="textbook.hasUpdatesAvailable"
                color="secondary"
                icon="system_update"
                label="更新"
                @click="updateTextbook(textbook)"
                unelevated
                rounded
              />
              
              <!-- 更多操作菜单 -->
              <q-btn
                v-if="textbook.isDownloaded"
                color="grey-7"
                icon="more_vert"
                round
                flat
              >
                <q-menu>
                  <q-list style="min-width: 100px">
                    <q-item clickable v-close-popup @click="deleteTextbook(textbook)">
                      <q-item-section avatar>
                        <q-icon name="delete" color="negative" />
                      </q-item-section>
                      <q-item-section>删除</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </q-card-actions>
          </q-card>
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
      console.warn('用户未登录，无法加载资源')
      textbooks.value = []
      return
    }

    // 使用与安卓原生一致的数据获取策略：优先服务器数据，与本地数据合并
    resourceManager.fetchUserAllOnlineTextbooks({
      onSuccess: (data) => {
        textbooks.value = data
        updateSubjectChips()
      },
      onError: (error) => {
        console.error('加载教材失败:', error)
        textbooks.value = []
      }
    })
  } catch (error) {
    console.error('加载资源失败:', error)
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
      showMessage(`检查更新失败: ${error}`, 'error')
    }
  })
  checkingUpdates.value = false
}

// 下载教材
const downloadTextbook = (textbook: UserTextbookInfo) => {
  resourceManager.downloadTextbook(textbook.textbookId, {
    onSuccess: () => {
      textbook.isDownloaded = true
      textbook.downloadStatus = 2 // 下载完成
      showMessage('下载完成', 'success')
    },
    onError: (error) => {
      showMessage(`下载失败: ${error}`, 'error')
    },
    onProgress: (progress) => {
      textbook.downloadStatus = 1 // 下载中
      textbook.downloadedFiles = Math.floor((progress / 100) * textbook.totalFiles)
    }
  })
}

// 暂停下载
const pauseDownload = (textbook: UserTextbookInfo) => {
  resourceManager.pauseDownload(textbook.textbookId, {
    onSuccess: () => {
      textbook.downloadStatus = 0 // 暂停
      showMessage('下载已暂停', 'warning')
    },
    onError: (error) => {
      showMessage(`暂停失败: ${error}`, 'error')
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

// 更新教材
const updateTextbook = (textbook: UserTextbookInfo) => {
  showConfirmDialog.value = true
  confirmDialog.value = {
    title: '更新教材',
    message: `确定要更新教材"${textbook.textbookName}"吗？`,
    action: () => {
      downloadTextbook(textbook)
    }
  }
}

// 删除教材
const deleteTextbook = (textbook: UserTextbookInfo) => {
  showConfirmDialog.value = true
  confirmDialog.value = {
    title: '删除教材',
    message: `确定要删除教材"${textbook.textbookName}"吗？删除后需要重新下载。`,
    action: () => {
      resourceManager.deleteTextbook(textbook.textbookId, {
        onSuccess: () => {
          const index = textbooks.value.findIndex(t => t.textbookId === textbook.textbookId)
          if (index > -1) {
            textbooks.value.splice(index, 1)
          }
          showMessage('删除成功', 'success')
        },
        onError: (error) => {
          showMessage(`删除失败: ${error}`, 'error')
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

    .textbook-item {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s ease;
      display: flex;
      gap: 16px;

      &:hover {
        transform: translateY(-2px);
      }

      &.downloading {
        border-left: 4px solid #007bff;
      }

      .textbook-icon {
        width: 60px;
        height: 60px;
        background: #f0f0f0;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        img {
          width: 32px;
          height: 32px;
          object-fit: cover;
        }
      }

      .textbook-info {
        flex: 1;
        min-width: 0;

        .textbook-name {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 8px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .textbook-subject {
          font-size: 14px;
          color: #666;
          margin: 0 0 4px 0;
        }

        .textbook-publisher {
          font-size: 12px;
          color: #999;
          margin: 0 0 12px 0;
        }

        .download-progress {
          display: flex;
          align-items: center;
          gap: 12px;

          .progress-bar {
            flex: 1;
            height: 6px;
            background: #f0f0f0;
            border-radius: 3px;
            overflow: hidden;

            .progress-fill {
              height: 100%;
              background: #007bff;
              transition: width 0.3s ease;
            }
          }

          .progress-text {
            font-size: 12px;
            color: #666;
            white-space: nowrap;
          }
        }
      }

      .textbook-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-end;

        .action-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;

          &.download {
            background: #007bff;
            color: white;

            &:hover {
              background: #0056b3;
            }
          }

          &.pause {
            background: #ffc107;
            color: #1a1a1a;

            &:hover {
              background: #e0a800;
            }
          }

          &.view {
            background: #28a745;
            color: white;

            &:hover {
              background: #1e7e34;
            }
          }

          &.update {
            background: #ff6b6b;
            color: white;

            &:hover {
              background: #e55a5a;
            }
          }

          &.delete {
            background: #dc3545;
            color: white;

            &:hover {
              background: #c82333;
            }
          }
        }
      }
    }
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    .empty-icon {
      width: 80px;
      height: 80px;
      opacity: 0.5;
      margin-bottom: 20px;
    }

    .empty-title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 8px 0;
    }

    .empty-description {
      font-size: 16px;
      color: #666;
      margin: 0;
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
      .textbook-item {
        flex-direction: column;
        text-align: center;

        .textbook-actions {
          flex-direction: row;
          justify-content: center;
          align-items: center;
        }
      }
    }
  }
}
</style>
 