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

    <!-- 会话列表 -->
    <RubberBandList v-if="filteredRecords && filteredRecords.length > 0" class="scroll-wrapper">
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
              @click="handleItemClick(record)"
              @checkbox-change="toggleRecordSelection(getRecordId(record))"
              @pin="handlePin(record)"
              @delete="handleDelete(record)"
              @enter-selection-mode="enterSelectionModeAndSelect(record)"
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
              @click="handleItemClick(record)"
              @checkbox-change="toggleRecordSelection(getRecordId(record))"
              @pin="handlePin(record)"
              @delete="handleDelete(record)"
              @enter-selection-mode="enterSelectionModeAndSelect(record)"
            />
          </div>
        </div>
      </div>
    </RubberBandList>

    <!-- 批量选择工具栏 - 新设计（与 ChatView 样式统一）-->
    <div v-if="isSelectionMode" class="selection-toolbar">
      <!-- 左侧：全选区域 -->
      <div class="selection-left" :title="isAllSelected ? '取消全选' : '全选'">
        <Checkbox
          :modelValue="isAllSelected"
          :indeterminate="selectedRecords.size > 0 && !isAllSelected"
          size="md"
          @update:modelValue="toggleSelectAll"
        />
        <span class="select-all-text">全选</span>
        <span class="selection-count">已选{{ selectedRecords.size }}/{{ filteredRecords.length }}</span>
      </div>

      <!-- 右侧：操作按钮组 -->
      <div class="selection-actions">
        <Button
          label="取消"
          variant="outline"
          size="md"
          @click="exitSelectionMode"
        />

        <Button
          label="删除"
          size="md"
          :disabled="selectedRecords.size === 0"
          @click="handleBatchDelete"
        />
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <Dialog
      v-model="showDeleteConfirm"
      title="确认删除"
      confirm-text="删除"
      cancel-text="取消"
      :confirm-color="'negative'"
      @confirm="executeDelete"
      @cancel="showDeleteConfirm = false"
    >
      {{ deleteConfirmContent }}
    </Dialog>

    <!-- 批量删除确认对话框 -->
    <Dialog
      v-model="showBatchDeleteConfirm"
      title="确认批量删除"
      confirm-text="删除"
      cancel-text="取消"
      :confirm-color="'negative'"
      @confirm="executeBatchDelete"
      @cancel="showBatchDeleteConfirm = false"
    >
      确定要删除选中的 {{ selectedRecords.size }} 个会话吗？删除后无法恢复。
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { AiTextbookSession } from '@/types'
import RubberBandList from '@/components/base/VirtualScroll.vue'
import SessionItem from './SessionItem.vue'
import Checkbox from '@/components/base/Checkbox.vue'
import Button from '@/components/base/Button.vue'
import Dialog from '@/components/base/Dialog.vue'

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
}

const props = withDefaults(defineProps<Props>(), {
  records: () => [],
  selectedRecordId: undefined,
  showHeader: true,
  title: '聊天记录',
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

// 删除确认对话框状态
const showDeleteConfirm = ref(false)
const showBatchDeleteConfirm = ref(false)
const pendingDeleteRecord = ref<AiTextbookSession | null>(null)
const deleteConfirmContent = computed(() => {
  if (pendingDeleteRecord.value) {
    const name = getRecordName(pendingDeleteRecord.value) || '该会话'
    return `确定要删除"${name}"吗？删除后无法恢复。`
  }
  return '确定要删除该会话吗？删除后无法恢复。'
})

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
		// 每个日期分组内的记录也按时间从新到旧排序
		sortedGroups[dateStr] = info.records.sort((a, b) => {
			const aTime = getRecordTimestamp(b)
			const bTime = getRecordTimestamp(a)
			return aTime - bTime // 倒序：新的在前
		})
	})

	return sortedGroups
})

// 根据搜索关键词过滤会话列表，并排序（pinned 在前）
// 置顶的会话无论是否匹配搜索关键词都要显示
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
      // 如果会话被置顶，无论是否匹配搜索关键词都要显示
      const isPinned = record.pinned

      if (isPinned) {
        return true
      }

      // 其他会话需要匹配搜索关键词
      const question = getRecordName(record).toLowerCase()
      const answer = record.answer?.toLowerCase() || ''
      return question.includes(keyword) || answer.includes(keyword)
    })

    console.log('filtered', filtered)
  }

  // 排序：pinned 的记录排在前面，同 pinned 状态的按时间从新到旧排序
  return filtered.sort((a, b) => {
    // 先按 pinned 排序
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    // 同 pinned 状态的，按时间从新到旧排序（更新时间大的在前）
    const aTime = getRecordTimestamp(b) // 注意：b 的时间更大应该在前
    const bTime = getRecordTimestamp(a)
    return aTime - bTime // 倒序：新的在前
  })
})

// ==================== 批量选择相关方法 ====================

// 切换会话选择状态
const toggleRecordSelection = (recordId: string) => {
  if (selectedRecords.value.has(recordId)) {
    selectedRecords.value.delete(recordId)
  } else {
    selectedRecords.value.add(recordId)
  }
}

// 全选/取消全选
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

// 判断是否全选
const isAllSelected = computed(() => {
  return filteredRecords.value.length > 0 && selectedRecords.value.size === filteredRecords.value.length
})

// 进入批量选择模式并选中指定记录（通过多选菜单触发）
const enterSelectionModeAndSelect = (record: AiTextbookSession) => {
  isSelectionMode.value = true
  selectedRecords.value.clear()
  toggleRecordSelection(getRecordId(record))
}

// 退出批量选择模式
const exitSelectionMode = () => {
  isSelectionMode.value = false
  selectedRecords.value.clear()
}

// 处理批量删除（显示确认对话框）
const handleBatchDelete = () => {
  if (selectedRecords.value.size === 0) return
  showBatchDeleteConfirm.value = true
}

// 执行批量删除
const executeBatchDelete = () => {
  const recordIds = Array.from(selectedRecords.value)
  emit('batch-delete', recordIds)
  showBatchDeleteConfirm.value = false
  // 退出选择模式
  exitSelectionMode()
}

// 处理项目点击（区分选择模式和普通模式）
const handleItemClick = (record: AiTextbookSession) => {
  if (isSelectionMode.value) {
    toggleRecordSelection(getRecordId(record))
  } else {
    emit('record-click', record)
  }
}

// 处理置顶/取消置顶
const handlePin = (record: AiTextbookSession) => {
  emit('record-pin', record)
}

// 处理删除（显示确认对话框）
const handleDelete = (record: AiTextbookSession) => {
  pendingDeleteRecord.value = record
  showDeleteConfirm.value = true
}

// 执行删除
const executeDelete = () => {
  if (pendingDeleteRecord.value) {
    emit('record-delete', pendingDeleteRecord.value)
    pendingDeleteRecord.value = null
  }
  showDeleteConfirm.value = false
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
  background-color: #f7f6ff;
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
  padding: 8px 12px;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.selection-toolbar .selection-left {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.selection-toolbar .select-all-text {
  color: #374151;
  font-size: 14px;
  margin-left: 4px;
}

.selection-toolbar .selection-count {
  color: #9ca3af;
  font-size: 12px;
  margin-left: 8px;
}

.selection-toolbar .selection-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: #f6f5ff;
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
