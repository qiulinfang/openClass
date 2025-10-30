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
    <div v-if="!records || records.length === 0" class="empty-state">
      <q-icon name="chat" size="48px" color="grey-5" />
      <div class="q-mt-md text-h6 text-grey-6">暂无会话</div>
      <div class="q-mt-sm text-caption text-grey-5">您的会话记录将显示在这里</div>
    </div>

    <!-- 会话列表 -->
    <div v-else class="session-items">
      <div
        v-for="record in records"
        :key="record.id"
        class="session-item"
        :class="{ 
          'is-selected': selectedRecordId === record.id,
          'is-checked': selectedRecords.has(record.id),
          'is-selectable': isSelectionMode
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
        
        <div class="session-content" @click="handleItemClick(record)" @contextmenu.prevent="handleLongPress(record)">
          <div class="session-title">{{ record.question }}</div>
          <div v-if="record.answer" class="session-subtitle">
            {{ truncateText(record.answer, 100) }}
          </div>
        </div>
        
        <!-- 更多按钮（非选择模式下显示） -->
        <div v-if="!isSelectionMode" class="session-actions">
          <q-btn
            flat
            round
            dense
            icon="more_vert"
            size="sm"
            class="more-btn"
            @click.stop
          >
            <q-menu
              anchor="bottom right"
              self="top right"
              :offset="[0, 8]"
            >
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
                
                <q-item clickable v-close-popup @click="enterSelectionMode">
                  <q-item-section avatar>
                    <q-icon name="checklist" size="xs" />
                  </q-item-section>
                  <q-item-section>批量管理</q-item-section>
                </q-item>
                
                <q-separator />
                
                <q-item clickable v-close-popup @click="handleDelete(record)" class="text-negative">
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
import { ref } from 'vue'
import type { QuestionRecord } from '@/types'

// 定义 props
interface Props {
  records?: QuestionRecord[]
  selectedRecordId?: string  // 当前选中的会话ID
  showHeader?: boolean       // 是否显示头部
  title?: string            // 标题文字
}

const props = withDefaults(defineProps<Props>(), {
  records: () => [],
  selectedRecordId: undefined,
  showHeader: true,
  title: '聊天记录'
})

// 定义 emits
const emit = defineEmits<{
  'record-click': [record: QuestionRecord]
  'record-rename': [record: QuestionRecord, newName: string]
  'record-pin': [record: QuestionRecord]
  'record-delete': [record: QuestionRecord]
  'batch-delete': [recordIds: string[]]
}>()

// 重命名对话框
const showRenameDialog = ref(false)
const currentRecord = ref<QuestionRecord | null>(null)
const newRecordName = ref('')

// 批量选择相关状态
const isSelectionMode = ref(false)
const selectedRecords = ref<Set<string>>(new Set())

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
    props.records.forEach(record => {
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

// 截断文本
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
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

.session-items {
  flex: 1;
  overflow-y: auto;
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
  
  .session-title {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    margin-bottom: 6px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  
  .session-subtitle {
    font-size: 13px;
    color: #666;
    line-height: 1.4;
  }
}
</style>

