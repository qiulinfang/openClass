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
    <div v-else ref="scrollWrapper" class="scroll-wrapper">
      <div class="scroll-content">
        <div ref="sessionItemsRef" class="session-items">
          <div
            v-for="record in filteredRecords"
            :key="record.id"
            class="session-item"
            :class="{
              'is-selected': selectedRecordId === record.id,
              'is-checked': selectedRecords.has(record.id),
              'is-selectable': isSelectionMode,
            }"
          >
            <!-- 批量选择复选框 -->
            <div v-if="isSelectionMode" class="session-checkbox">
              <q-checkbox
                :model-value="selectedRecords.has(record.id)"
                @update:model-value="toggleRecordSelection(record.id)"
                color="primary"
                size="sm"
              />
            </div>

            <div
              class="session-content"
              @click="handleItemClick(record)"
              @contextmenu.prevent="handleLongPress(record)"
            >
              <div class="session-title-row">
                <div class="session-title">{{ record.question }}</div>
                <div class="session-time">{{ formatTime(record.timestamp) }}</div>
              </div>
              <div v-if="record.answer" class="session-subtitle">
                {{ truncateText(record.answer, 100) }}
              </div>
            </div>

            <!-- 更多按钮（非选择模式下显示） -->
            <div v-if="!isSelectionMode" class="session-actions">
              <q-btn flat round dense icon="more_vert" size="sm" class="more-btn" @click.stop>
                <q-menu anchor="bottom right" self="top right" :offset="[0, 8]">
                  <q-list style="min-width: 150px">
                    <q-item clickable v-close-popup @click="handleRename(record)">
                      <q-item-section avatar>
                        <q-icon name="edit" size="xs" />
                      </q-item-section>
                      <q-item-section>重命名</q-item-section>
                    </q-item>

                    <q-item clickable v-close-popup @click="handlePin(record)">
                      <q-item-section avatar>
                        <q-icon name="push_pin" size="xs" />
                      </q-item-section>
                      <q-item-section>{{ record.pinned ? '取消置顶' : '置顶' }}</q-item-section>
                    </q-item>

                    <q-item clickable v-close-popup @click="handleFavorite(record)">
                      <q-item-section avatar>
                        <q-icon 
                          :name="isFavorite(record.id) ? 'star' : 'star_border'" 
                          size="xs"
                          :color="isFavorite(record.id) ? 'warning' : undefined"
                        />
                      </q-item-section>
                      <q-item-section>{{ isFavorite(record.id) ? '取消收藏' : '收藏' }}</q-item-section>
                    </q-item>

                    <q-item clickable v-close-popup @click="enterSelectionMode">
                      <q-item-section avatar>
                        <q-icon name="checklist" size="xs" />
                      </q-item-section>
                      <q-item-section>批量管理</q-item-section>
                    </q-item>

                    <q-separator />

                    <q-item
                      clickable
                      v-close-popup
                      @click="handleDelete(record)"
                      class="text-negative"
                    >
                      <q-item-section avatar>
                        <q-icon name="delete" size="xs" color="negative" />
                      </q-item-section>
                      <q-item-section>删除</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 重命名对话框 -->
    <q-dialog v-model="showRenameDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">重命名会话</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="newRecordName"
            autofocus
            dense
            label="会话名称"
            @keyup.enter="confirmRename"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="grey" v-close-popup />
          <q-btn flat label="确定" color="primary" @click="confirmRename" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { QuestionRecord } from '@/types'
import { useBetterScroll } from '../composables/useBetterScroll'
import { toggleQaFavorite, getFavoriteQas } from '../utils/favorites'
import { showMessage } from '../utils'

// 定义 props
interface Props {
  records?: QuestionRecord[]
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
  'record-click': [record: QuestionRecord]
  'record-rename': [record: QuestionRecord, newName: string]
  'record-pin': [record: QuestionRecord]
  'record-delete': [record: QuestionRecord]
  'batch-delete': [recordIds: string[]]
}>()

// 搜索关键词
const searchKeyword = ref('')

// 重命名对话框
const showRenameDialog = ref(false)
const currentRecord = ref<QuestionRecord | null>(null)
const newRecordName = ref('')

// 批量选择相关状态
const isSelectionMode = ref(false)
const selectedRecords = ref<Set<string>>(new Set())

// ==================== 计算属性 ====================

// 第1步：根据搜索关键词过滤会话列表
const filteredRecords = computed(() => {
  if (!searchKeyword.value || !searchKeyword.value.trim()) {
    return props.records
  }

  const keyword = searchKeyword.value.toLowerCase().trim()

  return props.records.filter((record) => {
    const question = record.question?.toLowerCase() || ''
    const answer = record.answer?.toLowerCase() || ''

    return question.includes(keyword) || answer.includes(keyword)
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
      selectedRecords.value.add(record.id)
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
const handleItemClick = (record: QuestionRecord) => {
  if (isSelectionMode.value) {
    toggleRecordSelection(record.id)
  } else {
    emit('record-click', record)
  }
}

// 第7步：处理长按（进入批量选择模式）
const handleLongPress = (record: QuestionRecord) => {
  if (!isSelectionMode.value) {
    enterSelectionMode()
    toggleRecordSelection(record.id)
  }
}

// 第2步：处理重命名
const handleRename = (record: QuestionRecord) => {
  currentRecord.value = record
  newRecordName.value = record.question
  showRenameDialog.value = true
}

// 第3步：确认重命名
const confirmRename = () => {
  if (currentRecord.value && newRecordName.value.trim()) {
    emit('record-rename', currentRecord.value, newRecordName.value.trim())
    showRenameDialog.value = false
  }
}

// 第4步：处理置顶/取消置顶
const handlePin = (record: QuestionRecord) => {
  emit('record-pin', record)
}

// 第5步：处理删除
const handleDelete = (record: QuestionRecord) => {
  emit('record-delete', record)
}

// 第6步：检查是否已收藏
const favoriteStatus = ref<Map<string, boolean>>(new Map())

const isFavorite = (recordId: string): boolean => {
  return favoriteStatus.value.get(recordId) ?? false
}

// 初始化收藏状态
const initFavoriteStatus = () => {
  const favorites = getFavoriteQas()
  favoriteStatus.value.clear()
  favorites.forEach(f => {
    favoriteStatus.value.set(f.record.id, true)
  })
}

// 第7步：处理收藏/取消收藏
const handleFavorite = (record: QuestionRecord) => {
  const wasFavorite = isFavorite(record.id)
  const success = toggleQaFavorite(record)
  
  if (success) {
    // 更新收藏状态
    favoriteStatus.value.set(record.id, !wasFavorite)
    showMessage(!wasFavorite ? '已收藏' : '已取消收藏', 'success')
  } else {
    showMessage('操作失败，请重试', 'error')
  }
}

// 监听 records 变化，更新收藏状态
watch(() => props.records, () => {
  initFavoriteStatus()
}, { deep: true })

// 初始化收藏状态
onMounted(() => {
  initFavoriteStatus()
})

// 截断文本
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// 格式化时间（相对时间）
const formatTime = (timestamp: number): string => {
  if (!timestamp) return ''
  
  const now = Date.now()
  const diff = now - timestamp
  
  // 小于1分钟：刚刚
  if (diff < 60 * 1000) {
    return '刚刚'
  }
  
  // 小于1小时：X分钟前
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return `${minutes}分钟前`
  }
  
  // 小于24小时：X小时前
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours}小时前`
  }
  
  // 小于48小时：昨天
  if (diff < 48 * 60 * 60 * 1000) {
    const date = new Date(timestamp)
    return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  
  // 小于7天：X天前
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    return `${days}天前`
  }
  
  // 其他：显示月/日 时:分
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  // 如果年份不是今年，显示年份
  const currentYear = new Date().getFullYear()
  if (date.getFullYear() !== currentYear) {
    return `${date.getFullYear()}/${month}/${day} ${hours}:${minutes}`
  }
  
  return `${month}/${day} ${hours}:${minutes}`
}

// ==================== DOM 引用 ====================
const sessionItemsRef = ref<HTMLElement | null>(null)
const scrollWrapper = ref<HTMLElement | null>(null)

// 使用 Better Scroll 组合式函数
const { init: initBScroll, scrollTo } = useBetterScroll(
  scrollWrapper,
  {
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
  },
  true, // 自动监听数据变化
  [() => filteredRecords.value.length, () => props.records.length],
)

// 流程：滚动到列表顶部
const scrollToTop = () => {
  scrollTo(0, 0, 300)
}

// 生命周期
onMounted(async () => {
  await initBScroll()
})

onUnmounted(() => {
  // BScroll 销毁由组合式函数自动处理
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
}

// 顶部标题栏
.session-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title {
    color: #333;
    font-size: 14px;
    font-weight: 500;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }
}

// 搜索栏
.search-bar {
  padding: 8px 16px 12px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;

  .search-input {
    width: 100%;
    font-size: 14px;
  }
}

// 批量选择工具栏
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
  overflow: hidden;
  position: relative;
}

.scroll-content {
  min-height: calc(100% + 1px);
}

.session-items {
  padding: 16px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #d0d0d0;
    border-radius: 3px;

    &:hover {
      background: #b0b0b0;
    }
  }
}

.session-item {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: stretch;
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    background: #fafafa;
    border-color: #d0d0d0;
  }

  // 当前选中的会话（激活状态）
  &.is-selected {
    background: #f0f7ff;
    border-color: #9059ff;

    .session-actions {
      opacity: 1;
    }
  }

  // 批量选择模式下被勾选的会话
  &.is-checked {
    background: #e3f2fd;
    border-color: #1976d2;
  }

  // 批量选择模式样式
  &.is-selectable {
    cursor: pointer;

    .session-content {
      padding-left: 8px;
    }
  }

  // 批量选择复选框
  .session-checkbox {
    display: flex;
    align-items: center;
    padding: 0 8px 0 12px;
  }

  .session-content {
    flex: 1;
    padding: 12px;
    cursor: pointer;
    min-width: 0;
  }

  .session-actions {
    display: flex;
    align-items: center;
    padding: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;

    .more-btn {
      color: #666;

      &:hover {
        color: #333;
      }
    }
  }

  .session-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .session-title {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    flex: 1;
    min-width: 0;
  }

  .session-time {
    font-size: 12px;
    color: #999;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .session-subtitle {
    font-size: 13px;
    color: #666;
    line-height: 1.4;
  }
}
</style>
