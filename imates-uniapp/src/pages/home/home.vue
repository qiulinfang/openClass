<template>
  <view class="my-resources-view">
    <!-- 筛选区域 (固定顶部) -->
    <view class="filter-section">
      <view class="filter-title">资源下载</view>

      <!-- 筛选器下拉组合 -->
      <view class="filter-content">
        <!-- 年级 -->
        <view class="filter-item">
          <text class="filter-label">年级:</text>
          <picker
            mode="selector"
            :range="gradeOptions"
            range-key="label"
            :value="gradeIndex"
            @change="onGradeChange"
          >
            <view class="picker-selector">
              <text>{{ gradeOptions[gradeIndex]?.label || '全部' }}</text>
              <text class="arrow">▼</text>
            </view>
          </picker>
        </view>

        <!-- 教材版本 -->
        <view class="filter-item">
          <text class="filter-label">教材版本:</text>
          <picker
            mode="selector"
            :range="versionOptions"
            range-key="label"
            :value="versionIndex"
            @change="onVersionChange"
          >
            <view class="picker-selector">
              <text>{{ versionOptions[versionIndex]?.label || '全部' }}</text>
              <text class="arrow">▼</text>
            </view>
          </picker>
        </view>

        <!-- 学科 -->
        <view class="filter-item">
          <text class="filter-label">学科:</text>
          <picker
            mode="selector"
            :range="subjectOptions"
            range-key="label"
            :value="subjectIndex"
            @change="onSubjectChange"
          >
            <view class="picker-selector">
              <text>{{ subjectOptions[subjectIndex]?.label || '全部' }}</text>
              <text class="arrow">▼</text>
            </view>
          </picker>
        </view>

        <!-- 下载状态 -->
        <view class="filter-item">
          <text class="filter-label">下载状态:</text>
          <picker
            mode="selector"
            :range="statusOptions"
            range-key="label"
            :value="statusIndex"
            @change="onStatusChange"
          >
            <view class="picker-selector">
              <text>{{ statusOptions[statusIndex]?.label || '全部' }}</text>
              <text class="arrow">▼</text>
            </view>
          </picker>
        </view>
      </view>
    </view>

    <!-- 资源核心列表区域 -->
    <scroll-view
      scroll-y
      class="textbooks-scroll"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <view v-if="filteredTextbooks.length > 0" class="textbooks-grid">
        <view
          v-for="textbook in filteredTextbooks"
          :key="textbook.textbookId || textbook.id"
          class="textbook-card"
          @click="handleLearnTextbook(textbook)"
        >
          <!-- 删除清除本地资料按钮 -->
          <view
            v-if="textbook.isDownloaded || (textbook.downloadStatus && textbook.downloadStatus !== 0)"
            class="textbook-delete-btn"
            @click.stop="handleDeleteTextbook(textbook)"
          >
            ✕
          </view>

          <!-- 左侧：封面图 -->
          <view class="textbook-cover">
            <image
              :src="getCoverImageUrl(textbook.textbookCover)"
              mode="aspectFill"
              class="cover-image"
            />
          </view>

          <!-- 右侧：信息与下载动作 -->
          <view class="textbook-content">
            <view class="textbook-info">
              <text class="textbook-title">{{ textbook.textbookName }}</text>
              <view class="textbook-sub-info">
                <text class="textbook-version">{{ textbook.textbookPublisher || '人教版' }}</text>
                <text v-if="textbook.textbookSemesterLabel" class="textbook-semester">
                  {{ textbook.textbookSemesterLabel }}
                </text>
              </view>

              <!-- 状态 Tag (使用状态点) -->
              <view class="status-tag-row">
                <text class="status-tag" :class="getDownloadStatusType(textbook)">
                  <text class="status-dot">•</text> {{ getDownloadStatusText(textbook) }}
                </text>
              </view>
            </view>

            <!-- 操作按钮/进度条分组 (完全对齐 imates-web) -->
            <view class="action-btn-area">
              <!-- 下载中状态：显示带百分比的进度条，点击进度条可暂停 -->
              <template v-if="textbook.downloadStatus === 1">
                <view
                  class="download-progress-bar"
                  @click.stop="handlePauseDownload(textbook)"
                >
                  <view class="progress-bar-container">
                    <view
                      class="progress-bar-fill"
                      :style="{ width: getDownloadProgress(textbook) + '%' }"
                    ></view>
                    <text class="progress-text">
                      {{ getDownloadProgress(textbook) }}%
                    </text>
                  </view>
                </view>
              </template>

              <!-- 暂停状态：显示“继续”按钮 -->
              <template v-else-if="textbook.downloadStatus === 3">
                <button class="action-btn action-btn-continue" @click.stop="downloadTextbook(textbook)">
                  继续
                </button>
              </template>

              <!-- 已下载未有更新：显示“学习”按钮 -->
              <template v-else-if="textbook.isDownloaded && textbook.downloadStatus === 2 && !textbook.hasUpdatesAvailable">
                <button class="action-btn action-btn-learn" @click.stop="handleLearnTextbook(textbook)">
                  学习
                </button>
              </template>

              <!-- 已下载且有更新：显示“更新”按钮 -->
              <template v-else-if="textbook.isDownloaded && textbook.downloadStatus === 2 && textbook.hasUpdatesAvailable">
                <button class="action-btn action-btn-update" @click.stop="downloadTextbook(textbook, true)">
                  更新
                </button>
              </template>

              <!-- 未下载：显示“下载”按钮 -->
              <template v-else>
                <button class="action-btn action-btn-download" @click.stop="downloadTextbook(textbook)">
                  下载
                </button>
              </template>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-box">
        <text class="empty-icon">📚</text>
        <text class="empty-text">暂无教材数据</text>
        <button class="reload-btn" @click="() => loadData()">重新加载</button>
      </view>
    </scroll-view>

    <!-- 学习资源大纲查看模态框 (对齐 imates-web LearningView) -->
    <LearningDetailModal
      v-model:visible="showLearningModal"
      :textbook-name="currentActiveTextbook?.textbookName || ''"
      :packages="activePackages"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ResourceApi, type UserTextbookInfo } from '@/services/api/resourceApi'
import { StorageService } from '@/services/storageService'
import { FileStorageService } from '@/services/fileStorageService'
import { useResourceStore } from '@/store/resourceStore'
import { ADDRESS_CATALOG } from '@/config/env-config'
import LearningDetailModal from '@/components/LearningDetailModal.vue'

const resourceStore = useResourceStore()

const isRefreshing = ref(false)
const textbooks = ref<UserTextbookInfo[]>([])

// 学习资源查看弹窗状态
const showLearningModal = ref(false)
const currentActiveTextbook = ref<UserTextbookInfo | null>(null)
const activePackages = ref<any[]>([])

// 模拟下载进度 map
const downloadProgressMap = ref<Record<string, number>>({})
let downloadTimers: Record<string, any> = {}

// 选项配置
const gradeOptions = [
  { label: '全部', value: '' },
  { label: '高一', value: '高一' },
  { label: '高二', value: '高二' },
  { label: '高三', value: '高三' }
]

const versionOptions = [
  { label: '全部', value: '' },
  { label: '人教版', value: '人教版' },
  { label: '浙教版', value: '浙教版' },
  { label: '苏教版', value: '苏教版' }
]

const subjectOptions = [
  { label: '全部', value: '' },
  { label: '数学', value: '数学' },
  { label: '生物', value: '生物' },
  { label: '物理', value: '物理' },
  { label: '化学', value: '化学' }
]

const statusOptions = [
  { label: '全部', value: '' },
  { label: '未下载', value: 'notDownloaded' },
  { label: '已下载', value: 'downloaded' },
  { label: '待更新', value: 'pendingUpdate' }
]

const gradeIndex = ref(0)
const versionIndex = ref(0)
const subjectIndex = ref(0)
const statusIndex = ref(0)

const onGradeChange = (e: any) => { gradeIndex.value = e.detail.value }
const onVersionChange = (e: any) => { versionIndex.value = e.detail.value }
const onSubjectChange = (e: any) => { subjectIndex.value = e.detail.value }
const onStatusChange = (e: any) => { statusIndex.value = e.detail.value }

const getCoverImageUrl = (coverPath?: string) => {
  if (!coverPath) return '/static/logo.png'
  if (coverPath.startsWith('http')) return coverPath
  return `${ADDRESS_CATALOG.IMATES_HTTP}${coverPath}`
}

const getDownloadStatusText = (textbook: UserTextbookInfo): string => {
  if (textbook.downloadStatus === 0) return '未下载'
  if (textbook.downloadStatus === 1) return '正在下载'
  if (textbook.hasUpdatesAvailable && textbook.downloadStatus === 2 && textbook.isDownloaded) return '有更新'
  if (textbook.downloadStatus === 2 && textbook.isDownloaded) return '下载完成'
  if (textbook.downloadStatus === 3) return '已暂停'
  return '未下载'
}

const getDownloadStatusType = (textbook: UserTextbookInfo): string => {
  if (textbook.downloadStatus === 0) return 'tag-red'
  if (textbook.downloadStatus === 1) return 'tag-blue'
  if (textbook.hasUpdatesAvailable && textbook.downloadStatus === 2 && textbook.isDownloaded) return 'tag-orange'
  if (textbook.downloadStatus === 2 && textbook.isDownloaded) return 'tag-green'
  if (textbook.downloadStatus === 3) return 'tag-gray'
  return 'tag-red'
}

const getDownloadProgress = (textbook: UserTextbookInfo): number => {
  const id = String(textbook.textbookId || textbook.id)
  return downloadProgressMap.value[id] || 0
}

const getStatusRank = (textbook: UserTextbookInfo): number => {
  if (textbook.isDownloaded && textbook.hasUpdatesAvailable) return 0
  if (!textbook.isDownloaded || textbook.downloadStatus === 0) return 1
  if (textbook.isDownloaded && textbook.downloadStatus === 2 && !textbook.hasUpdatesAvailable) return 2
  return 3
}

// ─── 工具：将本地元数据 merge 到教材列表 ────────────────────────────────────
/**
 * 对应 imates-web 的 mergeServerAndLocalData：
 * 先解构本地缓存（保留下载状态字段），再解构服务端数据（覆盖服务端最新信息）
 * 保证：刷新时服务端新字段覆盖旧信息，但本地下载进度字段不被覆盖为初始值
 */
const mergeServerAndLocal = (serverList: UserTextbookInfo[]): UserTextbookInfo[] => {
  return serverList.map(serverItem => {
    const id = String(serverItem.textbookId || serverItem.id)
    const localMeta = StorageService.getTextbookMeta(id)
    if (!localMeta) {
      // 纯服务端新教材 → 初始化本地状态字段
      return {
        ...serverItem,
        isDownloaded: false,
        downloadStatus: 0,
        downloadedFiles: 0,
        totalFiles: 0,
        hasUpdatesAvailable: false
      }
    }
    // 本地缓存存在：本地字段优先，服务端字段覆盖服务端内容（名称/封面/出版商等）
    return {
      ...localMeta,          // 1. 先铺本地状态
      ...serverItem,         // 2. 服务端信息覆盖（封面/名称/出版商等）
      // 3. 显式保留本地下载相关字段，防止服务端空值覆盖
      isDownloaded: localMeta.isDownloaded ?? false,
      downloadStatus: localMeta.downloadStatus ?? 0,
      downloadedFiles: localMeta.downloadedFiles ?? 0,
      totalFiles: localMeta.totalFiles ?? 0,
      hasUpdatesAvailable: localMeta.hasUpdatesAvailable ?? false,
      lastDownloadTime: localMeta.lastDownloadTime
    } as UserTextbookInfo
  })
}

/**
 * 对应 imates-web 的 fixInconsistentDownloadStatus：
 * App 崩溃 / 意外退出后，可能有教材永远停留在"下载中"(status=1)
 * 根据已下载文件数与总文件数推断真实状态并自动修复
 */
const fixInconsistentDownloadStatus = (list: UserTextbookInfo[]): void => {
  for (const item of list) {
    if (item.downloadStatus !== 1) continue  // 只修复卡在"下载中"的
    if (cancelMap[String(item.textbookId || item.id)]) continue // 用户当前确实在下载，跳过

    const downloaded = item.downloadedFiles ?? 0
    const total = item.totalFiles ?? 0

    if (downloaded > 0 && total > 0 && downloaded >= total) {
      // 文件数齐全 → 实际已完成
      item.downloadStatus = 2
      item.isDownloaded = true
      console.log(`[StatusRepair] ✅ 修复为"已完成": ${item.textbookName}`)
    } else if (downloaded > 0 && downloaded < total) {
      // 有部分文件 → 标记为已暂停
      item.downloadStatus = 3
      item.isDownloaded = false
      console.log(`[StatusRepair] ⏸️ 修复为"已暂停": ${item.textbookName} (${downloaded}/${total})`)
    } else {
      // 无文件 → 回退为未下载
      item.downloadStatus = 0
      item.isDownloaded = false
      console.log(`[StatusRepair] 🔄 修复为"未下载": ${item.textbookName}`)
    }
    // 将修复结果写回持久化
    StorageService.saveTextbookMeta(item)
  }
}

/**
 * 路径一：本地快速路径 — 毫秒级渲染已缓存教材（对应 imates-web loadResourcesLocalFastPath）
 * 仅使用已下载教材的本地元数据，立即渲染列表（不等待网络）
 */
const loadLocalFastPath = (): boolean => {
  const localMetas = StorageService.getAllTextbookMetas() as UserTextbookInfo[]
  if (localMetas.length === 0) return false

  textbooks.value = localMetas
  fixInconsistentDownloadStatus(textbooks.value)
  console.log(`[LoadStrategy] ⚡ 本地快速路径渲染: ${localMetas.length} 本教材`)
  return true
}

/**
 * 路径二：服务端刷新路径 — 后台静默拉取最新列表并双路合并（对应 imates-web loadResourcesServerRefreshPath）
 * 请求完成后与本地状态合并，更新教材列表，并持久化合并结果
 */
const loadServerRefreshPath = async (): Promise<void> => {
  try {
    const serverList = await ResourceApi.getTextbookList()
    if (!serverList || serverList.length === 0) {
      console.warn('[LoadStrategy] 服务端返回空列表')
      return
    }

    // 双路合并
    const merged = mergeServerAndLocal(serverList)
    textbooks.value = merged

    // 持久化合并后的状态（已下载的教材写入元数据）
    for (const item of merged) {
      if (item.isDownloaded || (item.downloadStatus ?? 0) > 0) {
        StorageService.saveTextbookMeta(item)
      }
    }

    // 同步已下载列表到全局 Store（供 study 页面使用）
    resourceStore.setDownloadedTextbooks(merged.filter(t => t.isDownloaded))

    // 状态自修复（服务端数据 merge 后再修复一次）
    fixInconsistentDownloadStatus(textbooks.value)
    console.log(`[LoadStrategy] 🔄 服务端刷新路径完成: ${merged.length} 本教材`)
  } catch (err) {
    console.error('[LoadStrategy] ❌ 服务端刷新失败:', err)
    // 失败时保留本地数据，不清空
  }
}

/**
 * 主加载入口：双路策略（对应 imates-web loadResources）
 * 1. 立即渲染本地缓存（本地快速路径）
 * 2. 后台刷新服务端数据（服务端刷新路径）
 */
const loadData = async (forceServer = false) => {
  const hasLocal = !forceServer && loadLocalFastPath()
  if (hasLocal) {
    // 有本地数据：立即渲染，后台静默刷新，刷新完成后延迟做更新检测
    loadServerRefreshPath().then(() => {
      setTimeout(() => checkForUpdates(), 1500)
    })
  } else {
    // 无本地数据（首次使用）：等待服务端响应后渲染
    await loadServerRefreshPath()
    // 首次加载后也做一次更新检测
    setTimeout(() => checkForUpdates(), 1500)
  }
}

/**
 * 后台更新检测 - 三级对比（对应 imates-web checkForUpdates）
 * 在服务端刷新路径完成后 1 秒延迟执行，避免阻塞主渲染流程
 *
 * 三级对比：
 *   Level 1: 本地文件元数据是否存在（是否真实下载过文件）
 *   Level 2: 服务端学习包 ID 是否新增/缺少
 *   Level 3: 资源文件 checksum 是否有变化
 */
const checkForUpdates = async (): Promise<void> => {
  // 只对已下载的教材做更新检测
  const downloadedItems = textbooks.value.filter(t => t.isDownloaded && t.downloadStatus === 2)
  if (downloadedItems.length === 0) return

  console.log(`[UpdateCheck] 🔍 开始后台更新检测，共 ${downloadedItems.length} 本已下载教材`)
  let updatedCount = 0

  for (const item of downloadedItems) {
    const textbookId = String(item.textbookId || item.id)

    try {
      // Level 1: 本地文件元数据检查
      const localFiles = FileStorageService.getAllFileMetas(textbookId)
      if (localFiles.length === 0) {
        // 本地无实际文件，视为需要重新下载
        if (!item.hasUpdatesAvailable) {
          item.hasUpdatesAvailable = true
          StorageService.saveTextbookMeta(item)
          updatedCount++
          console.log(`[UpdateCheck] 📦 Level1 需要更新（本地无文件）: ${item.textbookName}`)
        }
        continue
      }

      // Level 2 & 3: 拉取服务端最新资源包，对比包 ID + 文件 checksum
      const serverPackages = await ResourceApi.getLearningPackage(textbookId)
      if (!serverPackages || serverPackages.length === 0) continue

      // 构建本地文件 checksum 映射
      const localFileMap = new Map(localFiles.map(f => [f.fileId, f.checksum || '']))

      let needsUpdate = false

      for (const pkg of serverPackages) {
        const serverFiles: any[] = pkg.resourceList || pkg.resources || []

        for (const serverFile of serverFiles) {
          const fileId = serverFile.id || serverFile.fileId
          if (!fileId) continue

          // Level 2: 文件 ID 是否为新增
          if (!localFileMap.has(fileId)) {
            console.log(`[UpdateCheck] 📄 Level2 新增文件: ${serverFile.fileName || fileId}`)
            needsUpdate = true
            break
          }

          // Level 3: checksum 是否变化
          const serverChecksum = serverFile.checksum || serverFile.md5 || ''
          const localChecksum = localFileMap.get(fileId) || ''
          if (serverChecksum && localChecksum && serverChecksum !== localChecksum) {
            console.log(`[UpdateCheck] 🔄 Level3 checksum 变化: ${serverFile.fileName || fileId}`)
            needsUpdate = true
            break
          }
        }

        if (needsUpdate) break
      }

      if (needsUpdate && !item.hasUpdatesAvailable) {
        item.hasUpdatesAvailable = true
        StorageService.saveTextbookMeta(item)
        // 通知全局 Store（其他 tab 页可响应）
        resourceStore.markTextbookHasUpdate(textbookId)
        updatedCount++
        console.log(`[UpdateCheck] ⚠️ 教材需要更新: ${item.textbookName}`)
      }
    } catch (err) {
      console.warn(`[UpdateCheck] ❌ 检测失败: ${item.textbookName}`, err)
    }
  }

  if (updatedCount > 0) {
    console.log(`[UpdateCheck] ✅ 更新检测完成，${updatedCount} 本教材有更新`)
    // 触发视图刷新（因为直接修改了 item 属性）
    textbooks.value = [...textbooks.value]
  } else {
    console.log('[UpdateCheck] ✅ 更新检测完成，所有教材均为最新')
  }
}

const onRefresh = async () => {
  isRefreshing.value = true
  await loadServerRefreshPath()
  // 下拉刷新时也顺带做一次后台更新检测
  setTimeout(() => checkForUpdates(), 1000)
  isRefreshing.value = false
}


const filteredTextbooks = computed(() => {
  const grade = gradeOptions[gradeIndex.value]?.value
  const version = versionOptions[versionIndex.value]?.value
  const subject = subjectOptions[subjectIndex.value]?.value
  const status = statusOptions[statusIndex.value]?.value

  let result = textbooks.value.filter(t => t !== null && t !== undefined)

  if (grade) result = result.filter(t => t.textbookGradeLabel === grade)
  if (version) result = result.filter(t => t.textbookPublisher === version)
  if (subject) result = result.filter(t => t.textbookSubjectLabel === subject)

  if (status === 'notDownloaded') {
    result = result.filter(t => !t.isDownloaded || t.downloadStatus === 0)
  } else if (status === 'downloaded') {
    result = result.filter(t => t.isDownloaded && t.downloadStatus === 2 && !t.hasUpdatesAvailable)
  } else if (status === 'pendingUpdate') {
    result = result.filter(t => t.isDownloaded && t.hasUpdatesAvailable)
  }

  return result.sort((a, b) => {
    const rankA = getStatusRank(a)
    const rankB = getStatusRank(b)
    if (rankA !== rankB) return rankA - rankB

    const getSafeLabel = (val: any) => (val === null || val === undefined ? '' : String(val))
    const subjectA = getSafeLabel(a.textbookSubjectLabel)
    const subjectB = getSafeLabel(b.textbookSubjectLabel)
    if (subjectA !== subjectB) return subjectA.localeCompare(subjectB)

    return getSafeLabel(a.textbookName).localeCompare(getSafeLabel(b.textbookName))
  })
})


// 活跃的取消控制 map（每个教材一个标志）
const cancelMap: Record<string, boolean> = {}

// 点击下载/更新 —— 真实 uni.downloadFile 并发下载 + 进度回调 + 本地持久化
const downloadTextbook = async (item: UserTextbookInfo, isUpdate = false) => {
  const id = String(item.textbookId || item.id)
  console.log(`[DownloadManager] 🚀 1. 开始教材真实下载: ${item.textbookName}`, { id, isUpdate })

  item.downloadStatus = 1
  cancelMap[id] = false
  downloadProgressMap.value[id] = 0

  // Step 1: 拉取远端学习包资源清单
  console.log(`[DownloadManager] 📡 2. 拉取服务端资源包清单...`)
  let packages: any[] = []
  try {
    packages = await ResourceApi.getLearningPackage(id)
    console.log(`[DownloadManager] 📦 3. 清单拉取完成：${packages?.length || 0} 个资源包`, packages)
    if (packages?.length) item.learningPackages = packages
  } catch (err) {
    console.error('[DownloadManager] ❌ 拉取资源包清单失败:', err)
    item.downloadStatus = 0
    uni.showToast({ title: '获取资源清单失败', icon: 'none' })
    return
  }

  if (!packages?.length) {
    console.warn('[DownloadManager] ⚠️ 该教材无可用资源，终止')
    item.downloadStatus = 0
    uni.showToast({ title: '暂无可下载资源', icon: 'none' })
    return
  }

  // Step 2: 真实并发下载，监听真实进度
  console.log(`[DownloadManager] ⬇️ 4. 启动并发文件下载 (最大 3 并发)...`)
  try {
    await FileStorageService.downloadAllFiles(
      id,
      packages,
      (progress, done, total) => {
        // 用户已取消则跳过
        if (cancelMap[id]) return
        downloadProgressMap.value[id] = progress
        console.log(`[DownloadManager] ⏳ 进度 ${progress}% (${done}/${total})`)
      }
    )

    if (cancelMap[id]) {
      console.log('[DownloadManager] 🛑 用户取消了下载')
      item.downloadStatus = 3
      return
    }

    // Step 3: 全部完成 → 更新状态 + 持久化完整元数据
    const allFiles = FileStorageService.getAllFileMetas(id)
    downloadProgressMap.value[id] = 100
    item.downloadStatus = 2
    item.isDownloaded = true
    item.hasUpdatesAvailable = false
    item.totalFiles = allFiles.length
    item.downloadedFiles = allFiles.length
    item.lastDownloadTime = new Date().toISOString()

    // 持久化 ID 列表 + 完整元数据（供下次启动时本地快速路径 & 状态自修复使用）
    StorageService.saveDownloadedTextbookId(id)
    StorageService.saveTextbookMeta(item)
    console.log(`[DownloadManager] 🎉 5. 下载全部完成并本地持久化: ${item.textbookName} (${item.totalFiles} 个文件)`)
    uni.showToast({ title: isUpdate ? '更新完成' : '下载完成', icon: 'success' })
  } catch (err) {
    console.error('[DownloadManager] ❌ 下载过程发生异常:', err)
    item.downloadStatus = 0
    uni.showToast({ title: '下载失败，请重试', icon: 'none' })
  }
}

// 暂停 = 设置取消标志，文件并发 worker 会在下次循环检查到后停止
const handlePauseDownload = (item: UserTextbookInfo) => {
  const id = String(item.textbookId || item.id)
  cancelMap[id] = true
  item.downloadStatus = 3
  console.log(`[DownloadManager] ⏸️ 已暂停: ${item.textbookName}`)
  uni.showToast({ title: '已暂停下载', icon: 'none' })
}


// 点击“学习”按钮，打开对齐 imates-web LearningView 的学习资源查看弹窗
const handleLearnTextbook = async (item: UserTextbookInfo) => {
  if (item.isDownloaded && item.downloadStatus === 2) {
    currentActiveTextbook.value = item
    if (!item.learningPackages || item.learningPackages.length === 0) {
      const id = String(item.textbookId || item.id)
      const pkgs = await ResourceApi.getLearningPackage(id)
      item.learningPackages = pkgs
    }
    activePackages.value = item.learningPackages || []
    showLearningModal.value = true
  }
}

const handleDeleteTextbook = (item: UserTextbookInfo) => {
  uni.showModal({
    title: '提示',
    content: `确定要清除【${item.textbookName}】的本地资料吗？`,
    success: async (res) => {
      if (res.confirm) {
        const id = String(item.textbookId || item.id)
        cancelMap[id] = true
        delete downloadProgressMap.value[id]

        // 真实清理本地沙箱文件 + 元数据 + 持久化 ID
        await FileStorageService.clearTextbookFiles(id)

        item.isDownloaded = false
        item.downloadStatus = 0
        item.hasUpdatesAvailable = false
        item.learningPackages = undefined
        uni.showToast({ title: '已清除本地资料', icon: 'success' })
      }
    }
  })
}

onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.my-resources-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f5f7fa;
}

.filter-section {
  background-color: #ffffff;
  padding: 24rpx 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.03);
  z-index: 10;
}

.filter-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 20rpx;
}

.filter-content {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx 24rpx;
}

.filter-item {
  display: flex;
  align-items: center;
  font-size: 26rpx;
}

.filter-label {
  color: #6b7280;
  margin-right: 8rpx;
}

.picker-selector {
  display: flex;
  align-items: center;
  background: #f3f4f6;
  padding: 8rpx 16rpx;
  border-radius: 12rpx;
  color: #374151;

  .arrow {
    font-size: 18rpx;
    margin-left: 8rpx;
    color: #9ca3af;
  }
}

.textbooks-scroll {
  flex: 1;
  padding: 24rpx 30rpx;
  box-sizing: border-box;
}

.textbooks-grid {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.textbook-card {
  position: relative;
  display: flex;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}

.textbook-delete-btn {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 20rpx;
  background: #f3f4f6;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  z-index: 5;
}

.textbook-cover {
  width: 140rpx;
  height: 180rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background: #e5e7eb;
  margin-right: 24rpx;
  flex-shrink: 0;

  .cover-image {
    width: 100%;
    height: 100%;
  }
}

.textbook-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.textbook-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
  display: block;
}

.textbook-sub-info {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.textbook-semester {
  margin-left: 12rpx;
  background: #eff6ff;
  color: #3b82f6;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
}

.status-tag-row {
  margin-top: 10rpx;
}

.status-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;

  .status-dot {
    margin-right: 4rpx;
  }

  &.tag-red { background: #fee2e2; color: #ef4444; }
  &.tag-blue { background: #dbeafe; color: #3b82f6; }
  &.tag-orange { background: #ffedd5; color: #f97316; }
  &.tag-green { background: #dcfce7; color: #10b981; }
  &.tag-gray { background: #f3f4f6; color: #6b7280; }
}

.action-btn-area {
  display: flex;
  justify-content: flex-end;
  margin-top: 16rpx;
}

/* 下载动态进度条 */
.download-progress-bar {
  width: 140rpx;
  height: 56rpx;
  background: #e5e7eb;
  border-radius: 12rpx;
  overflow: hidden;
  position: relative;
}

.progress-bar-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: #6e55ff;
  transition: width 0.3s ease;
}

.progress-text {
  position: relative;
  z-index: 2;
  font-size: 22rpx;
  color: #1f2937;
  font-weight: bold;
}

.action-btn {
  font-size: 24rpx;
  border-radius: 12rpx;
  padding: 0 28rpx;
  height: 56rpx;
  line-height: 56rpx;
  margin: 0;

  &.action-btn-download { background: #6e55ff; color: #ffffff; }
  &.action-btn-learn { background: #10b981; color: #ffffff; }
  &.action-btn-update { background: #f97316; color: #ffffff; }
  &.action-btn-continue { background: #3b82f6; color: #ffffff; }
}

.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 120rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  color: #9ca3af;
  font-size: 28rpx;
  margin-bottom: 24rpx;
}

.reload-btn {
  background: #6e55ff;
  color: #ffffff;
  font-size: 26rpx;
  border-radius: 12rpx;
  padding: 0 32rpx;
  height: 64rpx;
  line-height: 64rpx;
}
</style>
