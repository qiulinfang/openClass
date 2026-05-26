<template>
  <q-dialog v-model="isVisible" position="right" maximized>
    <q-card style="width: 700px; max-width: 90vw">
      <!-- 头部 -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">🔧 资源调试面板</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- 统计信息 -->
      <q-card-section>
        <q-banner class="bg-primary text-white" rounded>
          <template v-slot:avatar>
            <q-icon name="analytics" size="md" />
          </template>
          <div class="text-subtitle2">资源统计</div>
          <div class="text-caption">
            教材总数: {{ textbooks.length }} | 
            已下载: {{ downloadedCount }} | 
            下载中: {{ downloadingCount }} |
            存储大小: {{ storageSize }}
          </div>
        </q-banner>
      </q-card-section>

      <!-- 操作按钮组 -->
      <q-card-section class="q-pt-none">
        <div class="row q-gutter-sm">
          <q-btn
            outline
            color="primary"
            icon="refresh"
            label="刷新数据"
            @click="refreshData"
            size="sm"
          />
          <q-btn
            outline
            color="secondary"
            icon="download"
            label="导出教材数据"
            @click="exportTextbooksData"
            size="sm"
          />
          <q-btn
            outline
            color="negative"
            icon="delete_sweep"
            label="清空所有资源"
            @click="clearAllResources"
            size="sm"
          />
        </div>
      </q-card-section>

      <!-- 滚动测试工具 -->
      <q-separator />
      <q-card-section>
        <q-banner class="bg-info text-white" rounded>
          <template v-slot:avatar>
            <q-icon name="scroll" size="md" />
          </template>
          <div class="text-subtitle2">滚动测试工具</div>
          <div class="text-caption">测试下拉刷新功能和滚动状态</div>
        </q-banner>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="row q-gutter-sm q-mb-sm">
          <q-btn
            outline
            color="primary"
            icon="analytics"
            label="诊断滚动"
            @click="handleDiagnose"
            size="sm"
            :disable="!scrollToolsAvailable"
          >
            <q-tooltip>诊断滚动功能状态</q-tooltip>
          </q-btn>
          <q-btn
            outline
            :color="isMonitoring ? 'negative' : 'positive'"
            :icon="isMonitoring ? 'stop' : 'play_arrow'"
            :label="isMonitoring ? '停止监控' : '开始监控'"
            @click="toggleMonitoring"
            size="sm"
            :disable="!scrollToolsAvailable"
          >
            <q-tooltip>{{ isMonitoring ? '停止实时监控' : '开始实时监控滚动状态' }}</q-tooltip>
          </q-btn>
        </div>
        <div class="row q-gutter-sm">
          <q-btn
            outline
            color="secondary"
            icon="refresh"
            label="测试下拉刷新"
            @click="handleTestPullDown"
            size="sm"
            :disable="!scrollToolsAvailable || isTesting"
            :loading="isTesting"
          >
            <q-tooltip>自动测试下拉刷新功能</q-tooltip>
          </q-btn>
          <q-btn
            outline
            color="warning"
            icon="restart_alt"
            label="重置状态"
            @click="handleResetState"
            size="sm"
            :disable="!scrollToolsAvailable"
          >
            <q-tooltip>重置滚动状态到初始状态</q-tooltip>
          </q-btn>
          <q-btn
            outline
            color="info"
            icon="update"
            label="刷新尺寸"
            @click="handleRefreshSize"
            size="sm"
            :disable="!scrollToolsAvailable"
          >
            <q-tooltip>刷新 BScroll 尺寸（修复 maxScrollY 为 0 的问题）</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>

      <!-- 诊断结果显示 -->
      <q-card-section v-if="diagnosticResult" class="q-pt-none">
        <q-expansion-item
          icon="info"
          label="诊断结果"
          :caption="diagnosticResult ? '点击查看详情' : ''"
          default-opened
        >
          <q-card flat bordered>
            <q-card-section>
              <pre class="diagnostic-result">{{ formatDiagnosticResult(diagnosticResult) }}</pre>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-card-section>

      <!-- 教材列表 -->
      <q-separator />
      
      <q-card-section class="q-pa-none" style="max-height: 60vh; overflow-y: auto">
        <q-list separator>
          <q-item
            v-for="textbook in sortedTextbooks"
            :key="textbook.id"
            clickable
            @click="viewTextbookDetail(textbook)"
          >
            <q-item-section avatar>
              <q-avatar :color="getStatusColor(textbook)" text-color="white">
                <q-icon :name="getStatusIcon(textbook)" />
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ textbook.textbookName }}</q-item-label>
              <q-item-label caption>
                {{ textbook.textbookSubjectLabel }} | 
                {{ textbook.textbookGradeLabel }} {{ textbook.textbookSemesterLabel }}
              </q-item-label>
              <q-item-label caption>
                状态: {{ getStatusText(textbook) }} | 
                进度: {{ textbook.downloadedFiles }}/{{ textbook.totalFiles }}
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="info"
                  color="blue"
                  @click.stop="viewTextbookDetail(textbook)"
                >
                  <q-tooltip>查看详情</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="delete"
                  color="negative"
                  @click.stop="deleteTextbook(textbook)"
                >
                  <q-tooltip>删除教材</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>

          <q-item v-if="textbooks.length === 0">
            <q-item-section class="text-center text-grey-6">
              <div class="q-py-md">
                <q-icon name="inbox" size="48px" />
                <div class="q-mt-sm">暂无教材数据</div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 教材详情对话框 -->
  <q-dialog v-model="showDetailDialog" maximized>
    <q-card v-if="selectedTextbook" style="width: 900px; max-width: 95vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">教材详情</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-list bordered separator>
          <q-item>
            <q-item-section>
              <q-item-label caption>教材ID</q-item-label>
              <q-item-label>{{ selectedTextbook.textbookId }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>教材名称</q-item-label>
              <q-item-label>{{ selectedTextbook.textbookName }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>学科</q-item-label>
              <q-item-label>{{ selectedTextbook.textbookSubjectLabel }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>年级学期</q-item-label>
              <q-item-label>{{ selectedTextbook.textbookGradeLabel }} {{ selectedTextbook.textbookSemesterLabel }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>下载状态</q-item-label>
              <q-item-label>{{ getStatusText(selectedTextbook) }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>下载进度</q-item-label>
              <q-item-label>{{ selectedTextbook.downloadedFiles }} / {{ selectedTextbook.totalFiles }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>最后下载时间</q-item-label>
              <q-item-label>{{ formatDate(selectedTextbook.lastDownloadTime) }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>学习资源包数量</q-item-label>
              <q-item-label>{{ selectedTextbook.learningPackages?.length || 0 }} 个</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>本地文件数量</q-item-label>
              <q-item-label>{{ selectedTextbook.localFiles?.length || 0 }} 个</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <!-- 学习资源包列表 -->
      <q-card-section v-if="selectedTextbook.learningPackages && selectedTextbook.learningPackages.length > 0">
        <div class="text-subtitle2 q-mb-md">学习资源包 ({{ selectedTextbook.learningPackages.length }}个)</div>
        <q-scroll-area style="height: 200px">
          <q-list bordered separator dense>
              <q-item v-for="(pkg, index) in selectedTextbook.learningPackages" :key="index">
              <q-item-section>
                <q-item-label caption>#{{ index + 1 }}</q-item-label>
                <q-item-label class="q-mt-xs text-caption">
                  ID: {{ pkg.id }} | 名称: {{ pkg.packageName }} | 资源: {{ pkg.resourceList?.length || 0 }}个
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="delete"
                  color="negative"
                  @click.stop="deleteLearningPackage(index)"
                >
                  <q-tooltip>删除此学习资源包</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>

      <!-- 本地文件列表 -->
      <q-card-section v-if="selectedTextbook.localFiles && selectedTextbook.localFiles.length > 0">
        <div class="text-subtitle2 q-mb-md">本地文件 ({{ selectedTextbook.localFiles.length }}个)</div>
        <q-scroll-area style="height: 200px">
          <q-list bordered separator dense>
            <q-item v-for="(file, index) in selectedTextbook.localFiles" :key="index">
              <q-item-section>
                <q-item-label caption>#{{ index + 1 }}</q-item-label>
                <q-item-label class="q-mt-xs text-caption">{{ file.localPath || file.fileName }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="delete"
                  color="negative"
                  @click.stop="deleteLocalFile(index)"
                >
                  <q-tooltip>删除此本地文件</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { resourceManager } from '@/services/storage/resource-storage'
import type { UserTextbookInfo } from '@/types'
import { useQuasar } from 'quasar'
import { showMessage } from '../../utils'

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  close: []
}>()

// 响应式数据
const isVisible = computed({
  get: () => props.visible,
  set: (val) => {
    if (!val) emit('close')
  }
})

const textbooks = ref<UserTextbookInfo[]>([])
const storageSize = ref('0 KB')
const selectedTextbook = ref<UserTextbookInfo | null>(null)
const showDetailDialog = ref(false)

// 滚动测试工具相关
const $q = useQuasar()
const diagnosticResult = ref<any>(null)
const isMonitoring = ref(false)
const isTesting = ref(false)
const scrollToolsAvailable = computed(() => {
  return typeof window !== 'undefined' && 
         !!(window as any).myResourcesScrollTools &&
         !!(window as any).diagnoseMyResourcesScroll
})

// 计算属性
const downloadedCount = computed(() => {
  return textbooks.value.filter(t => t.isDownloaded).length
})

const downloadingCount = computed(() => {
  return textbooks.value.filter(t => t.downloadStatus === 1).length
})

const sortedTextbooks = computed(() => {
  if (!textbooks.value) return []
  return [...textbooks.value].sort((a, b) => {
    if (!a || !b) return 0
    // 按下载状态排序（下载中 > 已下载 > 未下载）
    if (a.downloadStatus !== b.downloadStatus) {
      const order = { 1: 0, 2: 1, 3: 2, 0: 3 }
      return (order[a.downloadStatus as keyof typeof order] || 999) - (order[b.downloadStatus as keyof typeof order] || 999)
    }
    
    // 安全获取字符串属性的方法
    const getSafeLabel = (val: any) => (val === null || val === undefined ? '' : String(val))
    
    // 按学科排序
    const subjectA = getSafeLabel(a.textbookSubjectLabel)
    const subjectB = getSafeLabel(b.textbookSubjectLabel)
    if (subjectA !== subjectB) {
      return subjectA.localeCompare(subjectB)
    }
    // 按年级排序
    const gradeA = getSafeLabel(a.textbookGradeLabel)
    const gradeB = getSafeLabel(b.textbookGradeLabel)
    return gradeA.localeCompare(gradeB)
  })
})

// 刷新数据
const refreshData = async () => {
  try {
    textbooks.value = await resourceManager.getUserLocalTextbooks()
    await calculateStorageSize()
  } catch (error) {
    console.error('刷新失败:', error)
  }
}

// 计算存储大小
const calculateStorageSize = async () => {
  try {
    let totalSize = 0
    
    for (const textbook of textbooks.value) {
      // 计算教材元数据大小
      totalSize += new Blob([JSON.stringify(textbook)]).size
      
      // 计算本地文件大小（如果有）
      if (textbook.localFiles) {
        for (const file of textbook.localFiles) {
          if (file.fileSize) {
            totalSize += file.fileSize
          }
        }
      }
    }
    
    // 格式化大小
    if (totalSize < 1024) {
      storageSize.value = `${totalSize} B`
    } else if (totalSize < 1024 * 1024) {
      storageSize.value = `${(totalSize / 1024).toFixed(2)} KB`
    } else if (totalSize < 1024 * 1024 * 1024) {
      storageSize.value = `${(totalSize / 1024 / 1024).toFixed(2)} MB`
    } else {
      storageSize.value = `${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`
    }
  } catch (error) {
    console.error('计算存储大小失败:', error)
    storageSize.value = '未知'
  }
}

// 导出教材数据
const exportTextbooksData = async () => {
  try {
    const exportData = {
      version: '1.0',
      exportTime: Date.now(),
      textbooks: textbooks.value
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `textbooks-data-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
  }
}

// 清空所有资源
const clearAllResources = async () => {
  try {
    // 删除所有教材数据
    for (const textbook of textbooks.value) {
      await resourceManager.indexedDB.delete('textbooks', textbook.id)
    }
    
    // 清空教材文件数据
    await resourceManager.indexedDB.clear('textbook_files')
    
    await refreshData()
  } catch (error) {
    console.error('清空失败:', error)
  }
}

// 查看教材详情
const viewTextbookDetail = (textbook: UserTextbookInfo) => {
  selectedTextbook.value = textbook
  showDetailDialog.value = true
}

// 删除教材
const deleteTextbook = async (textbook: UserTextbookInfo) => {
  try {
    await resourceManager.indexedDB.delete('textbooks', textbook.id)
    await refreshData()
  } catch (error) {
    console.error('删除失败:', error)
  }
}

// 删除单个本地文件
const deleteLocalFile = async (index: number) => {
  if (!selectedTextbook.value) {
    return
  }
  
  const file = selectedTextbook.value.localFiles?.[index]
  if (!file) {
    return
  }
  
  try {
    // 确认删除
    $q.dialog({
      title: '确认删除',
      message: `确定要删除文件 "${file.fileName || file.localPath}" 吗？`,
      cancel: true,
      persistent: true
    }).onOk(async () => {
      try {
        // 删除textbook_files表中的文件数据
        await resourceManager.indexedDB.delete('textbook_files', file.id)
        
        // 从localFiles数组中移除该文件
        if (selectedTextbook.value && selectedTextbook.value.localFiles) {
          selectedTextbook.value.localFiles.splice(index, 1)
          
          // 更新下载文件数
          const downloadedFiles = selectedTextbook.value.localFiles.filter(f => f.isDownloaded).length
          selectedTextbook.value.downloadedFiles = downloadedFiles
          
          // 如果所有文件都被删除，更新下载状态
          if (selectedTextbook.value.localFiles.length === 0) {
            selectedTextbook.value.isDownloaded = false
            selectedTextbook.value.downloadStatus = 0
          }
          
          // 更新教材数据到IndexedDB
          await resourceManager.indexedDB.update('textbooks', selectedTextbook.value)
          
          // 刷新主列表数据
          await refreshData()

          showMessage('文件删除成功', 'positive')
        }
      } catch (error) {
        console.error('删除文件失败:', error)
        showMessage('删除文件失败: ' + (error as Error).message, 'negative')
      }
    })
  } catch (error) {
    console.error('删除操作失败:', error)
  }
}

// 删除单个学习资源包
const deleteLearningPackage = async (index: number) => {
  if (!selectedTextbook.value) {
    return
  }
  
  const pkg = selectedTextbook.value.learningPackages?.[index]
  if (!pkg) {
    return
  }
  
  try {
    // 确认删除
    $q.dialog({
      title: '确认删除',
      message: `确定要删除学习资源包 "${pkg.packageName}" 吗？`,
      cancel: true,
      persistent: true
    }).onOk(async () => {
      try {
        // 从learningPackages数组中移除该资源包
        if (selectedTextbook.value && selectedTextbook.value.learningPackages) {
          selectedTextbook.value.learningPackages.splice(index, 1)
          
          // 更新教材数据到IndexedDB
          await resourceManager.indexedDB.update('textbooks', selectedTextbook.value)
          
          // 刷新主列表数据
          await refreshData()

          showMessage('学习资源包删除成功', 'positive')
        }
      } catch (error) {
        console.error('删除学习资源包失败:', error)
        showMessage('删除学习资源包失败: ' + (error as Error).message, 'negative')
      }
    })
  } catch (error) {
    console.error('删除操作失败:', error)
  }
}

// 获取状态颜色
const getStatusColor = (textbook: UserTextbookInfo): string => {
  switch (textbook.downloadStatus) {
    case 1: return 'blue'      // 下载中
    case 2: return 'positive'  // 已下载
    case 3: return 'orange'    // 已暂停
    default: return 'grey'     // 未下载
  }
}

// 获取状态图标
const getStatusIcon = (textbook: UserTextbookInfo): string => {
  switch (textbook.downloadStatus) {
    case 1: return 'downloading'
    case 2: return 'check_circle'
    case 3: return 'pause_circle'
    default: return 'cloud_download'
  }
}

// 获取状态文本
const getStatusText = (textbook: UserTextbookInfo): string => {
  switch (textbook.downloadStatus) {
    case 1: return '下载中'
    case 2: return '已下载'
    case 3: return '已暂停'
    default: return '未下载'
  }
}

// 格式化日期
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '无'
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN')
  } catch {
    return dateStr
  }
}

// 滚动测试工具方法
const handleDiagnose = () => {
  if (!scrollToolsAvailable.value) {
    showMessage('滚动工具不可用，请确保 MyResourcesView 页面已加载', 'negative')
    return
  }

  try {
    const diagnoseFn = (window as any).diagnoseMyResourcesScroll
    const result = diagnoseFn()
    diagnosticResult.value = result

    showMessage(result.hasBScrollInstance ? '诊断完成：滚动功能正常' : '诊断完成：滚动功能异常', result.hasBScrollInstance ? 'positive' : 'negative')
  } catch (error) {
    console.error('诊断失败:', error)
    showMessage('诊断失败：' + (error as Error).message, 'negative')
  }
}

const toggleMonitoring = () => {
  if (!scrollToolsAvailable.value) {
    showMessage('滚动工具不可用', 'negative')
    return
  }

  const tools = (window as any).myResourcesScrollTools
  
  if (isMonitoring.value) {
    tools.stopMonitoring()
    isMonitoring.value = false
    showMessage('已停止监控', 'info')
  } else {
    tools.startMonitoring(1000) // 每秒监控一次
    isMonitoring.value = true
    showMessage('已开始监控滚动状态', 'positive')
  }
}

const handleTestPullDown = async () => {
  if (!scrollToolsAvailable.value) {
    showMessage('滚动工具不可用', 'negative')
    return
  }

  isTesting.value = true
  try {
    const tools = (window as any).myResourcesScrollTools
    await tools.testPullDown()

    showMessage('下拉刷新测试完成', 'positive')
  } catch (error) {
    console.error('测试失败:', error)
    showMessage('测试失败：' + (error as Error).message, 'negative')
  } finally {
    isTesting.value = false
  }
}

const handleResetState = () => {
  if (!scrollToolsAvailable.value) {
    showMessage('滚动工具不可用', 'negative')
    return
  }

  try {
    const tools = (window as any).myResourcesScrollTools
    tools.resetState()

    showMessage('滚动状态已重置', 'positive')
  } catch (error) {
    console.error('重置失败:', error)
    showMessage('重置失败：' + (error as Error).message, 'negative')
  }
}

const handleRefreshSize = async () => {
  if (!scrollToolsAvailable.value) {
    showMessage('滚动工具不可用', 'negative')
    return
  }

  try {
    showMessage('正在刷新 BScroll 尺寸，请查看控制台日志...', 'info')
    
    const tools = (window as any).myResourcesScrollTools
    const success = await tools.refresh()
    
    if (success) {
      showMessage('BScroll 尺寸刷新完成！', 'positive')
      
      // 刷新后重新诊断
      setTimeout(() => {
        handleDiagnose()
      }, 300)
    } else {
      showMessage('BScroll 实例不存在，无法刷新', 'negative')
    }
  } catch (error) {
    console.error('刷新失败:', error)
    showMessage('刷新失败：' + (error as Error).message, 'negative')
  }
}

const formatDiagnosticResult = (result: any): string => {
  if (!result) return ''
  
  return JSON.stringify(result, null, 2)
}

// 组件挂载时加载数据
onMounted(() => {
  refreshData()
})

// 组件卸载时停止监控
onUnmounted(() => {
  if (isMonitoring.value && scrollToolsAvailable.value) {
    const tools = (window as any).myResourcesScrollTools
    tools.stopMonitoring()
  }
})
</script>

<style lang="scss" scoped>
:deep(.q-dialog__inner) {
  max-width: 700px;
}

.diagnostic-result {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
}
</style>

