<template>
  <div class="session-list">
    <!-- 顶部标题栏（非批量选择模式） -->
    <div v-if="!isSelectionMode && showHeader" class="session-header">
      <div class="header-left">
        <span class="header-title">{{ title }}</span>
      </div>
      <div class="header-actions">
        <!-- 自定义按钮插槽 -->
        <slot name="header-actions"></slot>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div v-if="!isSelectionMode && showHeader" class="search-bar">
      <q-input
        v-model="searchKeyword"
        dense
        outlined
        placeholder="搜索会话..."
        clearable
        class="search-input"
      >
        <template v-slot:prepend>
          <q-icon name="search" size="xs" />
        </template>
      </q-input>
    </div>

    <!-- 批量选择工具栏 -->
    <q-toolbar v-if="isSelectionMode" class="selection-toolbar">
      <!-- 左侧：关闭按钮 -->
      <q-btn flat round icon="close" @click="exitSelectionMode" size="md" />

      <!-- 中间：选择状态 -->
      <div class="selection-info">
        <q-icon name="check_circle" class="selection-icon" />
        <span class="selection-text">{{ selectedRecords.size }} 个会话已选择</span>
      </div>

      <!-- 右侧：操作按钮 -->
      <div class="action-buttons">
        <!-- 全选/取消全选 -->
        <q-btn
          flat
          round
          icon="check_box"
          @click="toggleSelectAll"
          size="md"
          :color="selectedRecords.size === records.length ? 'primary' : 'grey-6'"
        >
          <q-tooltip>{{ selectedRecords.size === records.length ? '取消全选' : '全选' }}</q-tooltip>
        </q-btn>

        <!-- 批量删除 -->
        <q-btn
          flat
          round
          icon="delete"
          @click="handleBatchDelete"
          :disable="selectedRecords.size === 0"
          size="md"
          color="negative"
        >
          <q-tooltip>删除选中</q-tooltip>
        </q-btn>
      </div>
    </q-toolbar>

    <!-- 空状态 -->
    <div v-if="!filteredRecords || filteredRecords.length === 0" class="empty-state">
      <q-icon name="chat" size="48px" color="grey-5" />
      <div class="q-mt-md text-h6 text-grey-6">
        {{ searchKeyword ? '未找到匹配的会话' : '暂无会话' }}
      </div>
      <div class="q-mt-sm text-caption text-grey-5">
        {{ searchKeyword ? '尝试使用其他关键词搜索' : '您的会话记录将显示在这里' }}
      </div>
    </div>

    <!-- 会话列表 -->
    <RubberBandList v-else class="scroll-wrapper">
      <div class="scroll-content">
        <div ref="sessionItemsRef" class="session-items">
          <!-- 置顶会话区域 -->
          <div v-if="pinnedRecords.length > 0" class="date-group-wrapper">
            <div class="date-group-header">置顶</div>
            <!-- 会话列表 -->
            <SessionItem
              v-for="record in pinnedRecords"
              :key="getRecordId(record)"
              :record="record"
              :selected-record-id="selectedRecordId"
              :is-selection-mode="isSelectionMode"
              :selected-record-ids="selectedRecords"
              :show-favorite="showFavorite"
              @click="handleItemClick(record)"
              @contextmenu="handleLongPress(record)"
              @checkbox-change="toggleRecordSelection(getRecordId(record))"
              @pin="handlePin(record)"
              @delete="handleDelete(record)"
            />
          </div>
          <!--  按日期分组 -->
          <div v-for="(group, date) in groupedRecords" :key="date" class="date-group-wrapper">
            <div class="date-group-header">{{ date }}</div>
            <!-- 会话列表 -->
            <SessionItem
              v-for="record in group"
              :key="getRecordId(record)"
              :record="record"
              :selected-record-id="selectedRecordId"
              :is-selection-mode="isSelectionMode"
              :selected-record-ids="selectedRecords"
              :show-favorite="showFavorite"
              @click="handleItemClick(record)"
              @contextmenu="handleLongPress(record)"
              @checkbox-change="toggleRecordSelection(getRecordId(record))"
              @pin="handlePin(record)"
              @delete="handleDelete(record)"
            />
          </div>
        </div>
      </div>
    </RubberBandList>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { AiTextbookSession } from '@/types'
import RubberBandList from './RubberBandList.vue'
import SessionItem from './SessionItem.vue'
import { isQaFavorite, isSessionFavorite } from '@/utils/storage/favorites'

// 辅助函数：获取会话ID（兼容 id 和 sessionId）
const getRecordId = (record: AiTextbookSession): string => {
  return record.sessionId || record.id || ''
}

// 辅助函数：获取时间戳（兼容 timestamp 和 createTime）
const getRecordTimestamp = (record: AiTextbookSession): number => {
  return record.timestamp || record.createTime || Date.now()
}

// 辅助函数：获取会话名称（兼容 question 和 sessionName）
const getRecordName = (record: AiTextbookSession): string => {
  return record.question || record.sessionName || ''
}

// 定义 props
interface Props {
  records?: AiTextbookSession[]
  selectedRecordId?: string // 当前选中的会话ID
  showHeader?: boolean // 是否显示头部
  title?: string // 标题文字
  showFavorite?: boolean // 是否显示收藏功能
}

const props = withDefaults(defineProps<Props>(), {
  records: () => [],
  selectedRecordId: undefined,
  showHeader: true,
  title: '聊天记录',
  showFavorite: true,
})

// 定义 emits
const emit = defineEmits<{
  'record-click': [record: AiTextbookSession]
  'record-rename': [record: AiTextbookSession, newName: string]
  'record-pin': [record: AiTextbookSession]
  'record-delete': [record: AiTextbookSession]
  'batch-delete': [recordIds: string[]]
}>()

// 搜索关键词
const searchKeyword = ref('')

// 批量选择相关状态
const isSelectionMode = ref(false)
const selectedRecords = ref<Set<string>>(new Set())

// ==================== 计算属性 ====================

// 获取所有置顶的会话
const pinnedRecords = computed(() => {
  console.log('111filteredRecords', filteredRecords.value)
  return filteredRecords.value.filter((record) => record.pinned)
})

// 按日期对会话进行分组，排除 pinned 的会话（pinned 会话已单独显示），并按日期从近到远排序
const groupedRecords = computed(() => {
	console.log('111filteredRecords', filteredRecords.value)

	// 先按日期分组，同时记录每个分组中最新一条会话的时间戳
	const groups: Record<string, { records: AiTextbookSession[]; latestTimestamp: number }> = {}

	// 只处理非 pinned 的会话
	filteredRecords.value
		.filter((record) => !record.pinned)
		.forEach((record) => {
		  const ts = getRecordTimestamp(record)
		  const dateStr = formatDateForGrouping(ts)
		  if (!groups[dateStr]) {
		    groups[dateStr] = {
		      records: [],
		      latestTimestamp: ts,
		    }
		  }
		  groups[dateStr].records.push(record)
		  // 更新该日期分组的最新时间
		  if (ts > groups[dateStr].latestTimestamp) {
		    groups[dateStr].latestTimestamp = ts
		  }
		})

	// 根据每个日期分组中的最新时间倒序排序（越近的日期越靠上）
	const sortedEntries = Object.entries(groups).sort(([, a], [, b]) => b.latestTimestamp - a.latestTimestamp)

	// 重新组装为 Record<string, AiTextbookSession[]>，保持原有返回结构
	const sortedGroups: Record<string, AiTextbookSession[]> = {}
	sortedEntries.forEach(([dateStr, info]) => {
		sortedGroups[dateStr] = info.records
	})

	return sortedGroups
})

// 第1步：根据搜索关键词过滤会话列表，并排序（pinned 在前）
// 第2步：收藏或置顶的会话无论是否匹配搜索关键词都要显示
const filteredRecords = computed(() => {
  const sourceRecords = props.records || []
  let filtered: AiTextbookSession[] = []
  console.log('111sourceRecords', sourceRecords)
  if (!searchKeyword.value || !searchKeyword.value.trim()) {
    console.log('111no search keyword')
    filtered = sourceRecords
  } else {
    const keyword = searchKeyword.value.toLowerCase().trim()
    console.log('111search keyword', keyword)
    filtered = sourceRecords.filter((record) => {
      // 如果会话被收藏或置顶，无论是否匹配搜索关键词都要显示
      const recordId = getRecordId(record)
      const isQaFav = isQaFavorite(recordId)
      const isSessionFav = isSessionFavorite(recordId)
      const isFavorite = isQaFav || isSessionFav
      const isPinned = record.pinned
      
      if (isFavorite || isPinned) {
        return true
      }
      
      // 其他会话需要匹配搜索关键词
      const question = getRecordName(record).toLowerCase()
      const answer = record.answer?.toLowerCase() || ''
      return question.includes(keyword) || answer.includes(keyword)
    })

    console.log('filtered', filtered)
  }

  // 排序：pinned 的记录排在前面
  return filtered.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return 0
  })
})

// ==================== 批量选择相关方法 ====================

// 第1步：切换会话选择状态
const toggleRecordSelection = (recordId: string) => {
  if (selectedRecords.value.has(recordId)) {
    selectedRecords.value.delete(recordId)
  } else {
    selectedRecords.value.add(recordId)
  }
}

// 第2步：全选/取消全选
const toggleSelectAll = () => {
  if (selectedRecords.value.size === props.records.length) {
    selectedRecords.value.clear()
  } else {
    selectedRecords.value.clear()
    props.records.forEach((record) => {
      selectedRecords.value.add(getRecordId(record))
    })
  }
}

// 第3步：进入批量选择模式
const enterSelectionMode = () => {
  isSelectionMode.value = true
  selectedRecords.value.clear()
}

// 第4步：退出批量选择模式
const exitSelectionMode = () => {
  isSelectionMode.value = false
  selectedRecords.value.clear()
}

// 第5步：处理批量删除
const handleBatchDelete = () => {
  if (selectedRecords.value.size === 0) return

  const recordIds = Array.from(selectedRecords.value)
  emit('batch-delete', recordIds)

  // 退出选择模式
  exitSelectionMode()
}

// 第6步：处理项目点击（区分选择模式和普通模式）
const handleItemClick = (record: AiTextbookSession) => {
  if (isSelectionMode.value) {
    toggleRecordSelection(getRecordId(record))
  } else {
    emit('record-click', record)
  }
}

// 第7步：处理长按（进入批量选择模式）
const handleLongPress = (record: AiTextbookSession) => {
  if (!isSelectionMode.value) {
    enterSelectionMode()
    toggleRecordSelection(getRecordId(record))
  }
}

// 第4步：处理置顶/取消置顶
const handlePin = (record: AiTextbookSession) => {
  emit('record-pin', record)
}

// 第5步：处理删除
const handleDelete = (record: AiTextbookSession) => {
  emit('record-delete', record)
}


// 格式化日期以进行分组
const formatDateForGrouping = (timestamp: number): string => {
  if (!timestamp) return '未知日期'

  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return '今天'
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天'
  }

  // 如果是今年，则显示月/日
  if (date.getFullYear() === today.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  // 如果是往年，则显示年/月/日
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

// ==================== DOM 引用 ====================
const sessionItemsRef = ref<HTMLElement | null>(null)

// 流程：滚动到列表顶部（使用原生 DOM scroll）
const scrollToTop = () => {
  const el = sessionItemsRef.value?.closest('.scroll-wrapper') as HTMLElement | null
  if (el) {
    el.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 生命周期
onMounted(() => {
  // RubberBandList 使用原生滚动，无需额外初始化
  console.log('111mounted')
})

// 暴露方法给父组件
defineExpose({
  scrollToTop,
})
</script>

<style lang="scss" scoped>
.session-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #f7f7f7;
}

.session-header {
  padding: 16px 16px 16px 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .header-left {
    display: flex;
    align-items: center;
  }

  .header-title {
    color: #1a1a1a;
    font-size: 16px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.search-bar {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;

  .search-input {
    width: 100%;
    font-size: 14px;
    --q-field-control-height: 40px;
    --q-field-border-radius: 8px;
  }
}

.selection-toolbar {
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  padding: 8px 16px;
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;

  .selection-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;

    .selection-icon {
      color: #1976d2;
      font-size: 20px;
    }

    .selection-text {
      color: #333;
      font-size: 14px;
      font-weight: 500;
    }
  }

  .action-buttons {
    display: flex;
    gap: 4px;
  }
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.scroll-wrapper {
  flex: 1;
  position: relative;
  background-color: #f7f6ff;
}

.scroll-content {
  min-height: calc(100% + 1px);
}

.date-group-header {
  padding: 12px 16px;
  font-size: 13px;
  color: #8c8c8c;
  background-color: transparent;
  font-weight: 500;
}

.session-items {
  padding: 0;
}
</style>
