/**
 * 资源状态全局 Store（对应 imates-web 的 useResourceStore + useKnowledgeGraphStore）
 * 职责：
 *   - 跨页面共享「当前教材」上下文（home 点击学习 → study 自动加载对应章节树）
 *   - 全局资源更新通知（有新更新时 Tab Badge 提示）
 *   - 已下载教材列表的全局缓存（避免 study 页面重复请求）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserTextbookInfo } from '@/services/api/resourceApi'

export const useResourceStore = defineStore('resource', () => {
  // ─── 当前激活的教材（home 点击"学习" → study 联动） ─────────────────────
  const currentTextbook = ref<UserTextbookInfo | null>(null)
  const currentTextbookId = ref<string>('')

  function setCurrentTextbook(textbook: UserTextbookInfo | null) {
    currentTextbook.value = textbook
    currentTextbookId.value = textbook
      ? String(textbook.textbookId || textbook.id)
      : ''
    console.log(`[ResourceStore] 当前教材设置: ${textbook?.textbookName || '(清空)'}`)
  }

  // ─── 全局资源更新通知（有更新时可在 Tab Bar 上显示 badge） ─────────────
  const hasUpdateNotification = ref(false)
  const updateCount = ref(0)

  function setUpdateNotification(has: boolean, count = 0) {
    hasUpdateNotification.value = has
    updateCount.value = count
    // uni-app TabBar 角标
    if (has && count > 0) {
      uni.setTabBarBadge({ index: 0, text: String(count) })
    } else {
      uni.removeTabBarBadge({ index: 0 })
    }
  }

  // ─── 已下载教材列表全局缓存（study 可直接读，避免重复网络请求） ──────────
  const downloadedTextbooks = ref<UserTextbookInfo[]>([])

  function setDownloadedTextbooks(list: UserTextbookInfo[]) {
    downloadedTextbooks.value = list
  }

  const hasDownloadedTextbooks = computed(() => downloadedTextbooks.value.length > 0)

  // ─── 教材更新标记（checkForUpdates 完成后通知 study 页面刷新） ──────────
  const pendingUpdateIds = ref<Set<string>>(new Set())

  function markTextbookHasUpdate(textbookId: string) {
    pendingUpdateIds.value.add(textbookId)
    setUpdateNotification(true, pendingUpdateIds.value.size)
  }

  function clearTextbookUpdate(textbookId: string) {
    pendingUpdateIds.value.delete(textbookId)
    if (pendingUpdateIds.value.size === 0) {
      setUpdateNotification(false, 0)
    }
  }

  const hasUpdateFor = (textbookId: string) => pendingUpdateIds.value.has(textbookId)

  return {
    // 当前教材
    currentTextbook,
    currentTextbookId,
    setCurrentTextbook,
    // 更新通知
    hasUpdateNotification,
    updateCount,
    setUpdateNotification,
    // 已下载列表
    downloadedTextbooks,
    hasDownloadedTextbooks,
    setDownloadedTextbooks,
    // 更新标记
    pendingUpdateIds,
    markTextbookHasUpdate,
    clearTextbookUpdate,
    hasUpdateFor
  }
})
