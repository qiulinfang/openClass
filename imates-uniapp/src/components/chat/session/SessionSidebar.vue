<template>
  <view v-if="visible" class="drawer-mask" @click="$emit('close')">
    <view class="drawer-content" @click.stop>
      <!-- 头部与搜索栏 -->
      <view class="drawer-header">
        <view class="header-top">
          <text class="drawer-title">历史对话</text>
          <button class="new-chat-btn" @click="$emit('create')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffffff" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <text class="new-chat-text">新对话</text>
          </button>
        </view>

        <!-- 搜索输入框 -->
        <view class="search-bar">
          <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94a3b8" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索历史会话..."
            class="search-input"
          />
          <text v-if="searchKeyword" class="clear-icon" @click="searchKeyword = ''">✕</text>
        </view>
      </view>

      <!-- 列表与按时间维度分组 -->
      <scroll-view scroll-y class="drawer-scroll">
        <view class="session-list">
          <!-- 置顶分组 -->
          <view v-if="pinnedSessions.length > 0" class="group-wrapper">
            <view class="group-header">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#7a7cff" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <text class="group-title pinned-title">置顶会话</text>
            </view>
            <view
              v-for="session in pinnedSessions"
              :key="session.sessionId"
              class="session-card active-pinned"
              :class="{ active: session.sessionId === activeSessionId }"
              @click="$emit('select', session.sessionId)"
            >
              <view class="card-body">
                <view class="card-top">
                  <text class="session-name">{{ session.sessionName }}</text>
                  <text class="session-time">{{ formatTime(session.updateTime) }}</text>
                </view>
                <text class="session-preview">{{ getPreviewText(session) }}</text>
              </view>
              <!-- 快捷控制按钮 -->
              <view class="card-actions" @click.stop>
                <text class="action-btn pin-btn active" title="取消置顶" @click="handleTogglePin(session.sessionId)">
                  📌
                </text>
                <text class="action-btn" title="重命名" @click="handleOpenRename(session)">
                  ✏️
                </text>
                <text class="action-btn del-btn" title="删除" @click="handleConfirmDelete(session.sessionId)">
                  🗑️
                </text>
              </view>
            </view>
          </view>

          <!-- 今天分组 -->
          <view v-if="todaySessions.length > 0" class="group-wrapper">
            <text class="group-title">今天</text>
            <view
              v-for="session in todaySessions"
              :key="session.sessionId"
              class="session-card"
              :class="{ active: session.sessionId === activeSessionId }"
              @click="$emit('select', session.sessionId)"
            >
              <view class="card-body">
                <view class="card-top">
                  <text class="session-name">{{ session.sessionName }}</text>
                  <text class="session-time">{{ formatTime(session.updateTime) }}</text>
                </view>
                <text class="session-preview">{{ getPreviewText(session) }}</text>
              </view>
              <view class="card-actions" @click.stop>
                <text class="action-btn pin-btn" title="置顶" @click="handleTogglePin(session.sessionId)">
                  📌
                </text>
                <text class="action-btn" title="重命名" @click="handleOpenRename(session)">
                  ✏️
                </text>
                <text class="action-btn del-btn" title="删除" @click="handleConfirmDelete(session.sessionId)">
                  🗑️
                </text>
              </view>
            </view>
          </view>

          <!-- 昨天分组 -->
          <view v-if="yesterdaySessions.length > 0" class="group-wrapper">
            <text class="group-title">昨天</text>
            <view
              v-for="session in yesterdaySessions"
              :key="session.sessionId"
              class="session-card"
              :class="{ active: session.sessionId === activeSessionId }"
              @click="$emit('select', session.sessionId)"
            >
              <view class="card-body">
                <view class="card-top">
                  <text class="session-name">{{ session.sessionName }}</text>
                  <text class="session-time">{{ formatTime(session.updateTime) }}</text>
                </view>
                <text class="session-preview">{{ getPreviewText(session) }}</text>
              </view>
              <view class="card-actions" @click.stop>
                <text class="action-btn pin-btn" title="置顶" @click="handleTogglePin(session.sessionId)">
                  📌
                </text>
                <text class="action-btn" title="重命名" @click="handleOpenRename(session)">
                  ✏️
                </text>
                <text class="action-btn del-btn" title="删除" @click="handleConfirmDelete(session.sessionId)">
                  🗑️
                </text>
              </view>
            </view>
          </view>

          <!-- 7天内分组 -->
          <view v-if="sevenDaysSessions.length > 0" class="group-wrapper">
            <text class="group-title">7天内</text>
            <view
              v-for="session in sevenDaysSessions"
              :key="session.sessionId"
              class="session-card"
              :class="{ active: session.sessionId === activeSessionId }"
              @click="$emit('select', session.sessionId)"
            >
              <view class="card-body">
                <view class="card-top">
                  <text class="session-name">{{ session.sessionName }}</text>
                  <text class="session-time">{{ formatTime(session.updateTime) }}</text>
                </view>
                <text class="session-preview">{{ getPreviewText(session) }}</text>
              </view>
              <view class="card-actions" @click.stop>
                <text class="action-btn pin-btn" title="置顶" @click="handleTogglePin(session.sessionId)">
                  📌
                </text>
                <text class="action-btn" title="重命名" @click="handleOpenRename(session)">
                  ✏️
                </text>
                <text class="action-btn del-btn" title="删除" @click="handleConfirmDelete(session.sessionId)">
                  🗑️
                </text>
              </view>
            </view>
          </view>

          <!-- 更早分组 -->
          <view v-if="earlierSessions.length > 0" class="group-wrapper">
            <text class="group-title">更早</text>
            <view
              v-for="session in earlierSessions"
              :key="session.sessionId"
              class="session-card"
              :class="{ active: session.sessionId === activeSessionId }"
              @click="$emit('select', session.sessionId)"
            >
              <view class="card-body">
                <view class="card-top">
                  <text class="session-name">{{ session.sessionName }}</text>
                  <text class="session-time">{{ formatTime(session.updateTime) }}</text>
                </view>
                <text class="session-preview">{{ getPreviewText(session) }}</text>
              </view>
              <view class="card-actions" @click.stop>
                <text class="action-btn pin-btn" title="置顶" @click="handleTogglePin(session.sessionId)">
                  📌
                </text>
                <text class="action-btn" title="重命名" @click="handleOpenRename(session)">
                  ✏️
                </text>
                <text class="action-btn del-btn" title="删除" @click="handleConfirmDelete(session.sessionId)">
                  🗑️
                </text>
              </view>
            </view>
          </view>

          <!-- 无搜索结果/空状态 -->
          <view v-if="filteredSessions.length === 0" class="empty-state">
            <text class="empty-text">暂无相关历史对话</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 重命名 Modal -->
    <view v-if="showRenameDialog" class="rename-modal-mask" @click="showRenameDialog = false">
      <view class="rename-modal-card" @click.stop>
        <text class="modal-title">重命名会话</text>
        <input
          v-model="editingSessionName"
          type="text"
          class="rename-input"
          placeholder="请输入新的会话名称..."
          focus
        />
        <view class="modal-actions">
          <button class="modal-btn cancel" @click="showRenameDialog = false">取消</button>
          <button class="modal-btn confirm" @click="handleConfirmRename">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AiGeneralSession } from '@/types/chat'

const props = defineProps<{
  visible: boolean
  sessions: AiGeneralSession[]
  activeSessionId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create'): void
  (e: 'select', sessionId: string): void
  (e: 'delete', sessionId: string): void
  (e: 'pin', sessionId: string): void
  (e: 'rename', sessionId: string, newName: string): void
}>()

const searchKeyword = ref('')
const showRenameDialog = ref(false)
const editingSessionId = ref('')
const editingSessionName = ref('')

const filteredSessions = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return props.sessions || []
  return (props.sessions || []).filter(s => (s.sessionName || '').toLowerCase().includes(kw))
})

const pinnedSessions = computed(() => {
  return filteredSessions.value.filter(s => s.pinned)
})

const unpinnedSessions = computed(() => {
  return filteredSessions.value.filter(s => !s.pinned)
})

const isToday = (time: number) => {
  const date = new Date(time)
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

const isYesterday = (time: number) => {
  const date = new Date(time)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return date.toDateString() === yesterday.toDateString()
}

const isWithin7Days = (time: number) => {
  const date = new Date(time)
  const now = new Date()
  const diffDays = (now.getTime() - date.getTime()) / (1000 * 3600 * 24)
  return diffDays > 1 && diffDays <= 7
}

const todaySessions = computed(() => {
  return unpinnedSessions.value.filter(s => isToday(s.updateTime || s.createTime || Date.now()))
})

const yesterdaySessions = computed(() => {
  return unpinnedSessions.value.filter(s => isYesterday(s.updateTime || s.createTime || Date.now()))
})

const sevenDaysSessions = computed(() => {
  return unpinnedSessions.value.filter(s => isWithin7Days(s.updateTime || s.createTime || Date.now()))
})

const earlierSessions = computed(() => {
  return unpinnedSessions.value.filter(s => {
    const t = s.updateTime || s.createTime || Date.now()
    return !isToday(t) && !isYesterday(t) && !isWithin7Days(t)
  })
})

const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const getPreviewText = (session: AiGeneralSession) => {
  if (session.lastMessage) return session.lastMessage
  if (session.userMessage) return session.userMessage
  return `${session.msgCount || 0} 条对话记录`
}

const handleTogglePin = (sessionId: string) => {
  emit('pin', sessionId)
}

const handleOpenRename = (session: AiGeneralSession) => {
  editingSessionId.value = session.sessionId
  editingSessionName.value = session.sessionName
  showRenameDialog.value = true
}

const handleConfirmRename = () => {
  if (!editingSessionName.value.trim()) return
  emit('rename', editingSessionId.value, editingSessionName.value.trim())
  showRenameDialog.value = false
}

const handleConfirmDelete = (sessionId: string) => {
  uni.showModal({
    title: '删除确认',
    content: '确定要删除该历史对话吗？删除后不可恢复。',
    confirmText: '删除',
    confirmColor: '#ef4444',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        emit('delete', sessionId)
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.drawer-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  z-index: 999;
  display: flex;
}

.drawer-content {
  width: 620rpx;
  height: 100%;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  box-shadow: 8rpx 0 32rpx rgba(122, 124, 255, 0.12);
}

.drawer-header {
  padding: 36rpx 28rpx 20rpx;
  border-bottom: 1rpx solid #f1f5f9;
  background-color: #ffffff;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.drawer-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.5rpx;
}

.new-chat-btn {
  font-size: 24rpx;
  background-color: #7a7cff;
  color: #ffffff;
  border-radius: 32rpx;
  padding: 10rpx 26rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  height: auto;
  line-height: 1.4;
  margin: 0;
  border: none;
  font-weight: 600;
  box-shadow: 0 4rpx 16rpx rgba(122, 124, 255, 0.35);
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.96);
    background-color: #6366f1;
  }
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  background-color: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 32rpx;
  padding: 0 24rpx;
  height: 68rpx;
  transition: all 0.2s ease;

  &:focus-within {
    border-color: #7a7cff;
    background-color: #ffffff;
    box-shadow: 0 0 0 4rpx rgba(122, 124, 255, 0.12);
  }

  .search-icon {
    margin-right: 12rpx;
  }

  .search-input {
    flex: 1;
    height: 100%;
    font-size: 26rpx;
    color: #1e293b;
  }

  .clear-icon {
    font-size: 24rpx;
    color: #94a3b8;
    padding: 8rpx;
  }
}

.drawer-scroll {
  flex: 1;
}

.session-list {
  padding: 24rpx 20rpx;
}

.group-wrapper {
  margin-bottom: 28rpx;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 14rpx;
  padding-left: 8rpx;
}

.group-title {
  font-size: 24rpx;
  color: #64748b;
  font-weight: 600;
  display: block;
  margin-bottom: 12rpx;
  padding-left: 8rpx;

  &.pinned-title {
    color: #7a7cff;
  }
}

/* 1:1 对齐 imates-web SessionItem 淡紫色淡雅风格 */
.session-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 26rpx;
  border-radius: 20rpx;
  margin-bottom: 14rpx;
  background-color: #f5f3ff;
  border: 1rpx solid transparent;
  transition: all 0.2s ease;

  &:active {
    background-color: #ede9fe;
  }

  &.active {
    background-color: #e8e9ff;
    border-color: #7a7cff;
    box-shadow: 0 4rpx 14rpx rgba(122, 124, 255, 0.15);

    .session-name {
      color: #7a7cff;
      font-weight: 700;
    }
  }

  &.active-pinned {
    border-left: 8rpx solid #7a7cff;
  }
}

.card-body {
  flex: 1;
  overflow: hidden;
  margin-right: 16rpx;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.session-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320rpx;
}

.session-time {
  font-size: 20rpx;
  color: #94a3b8;
}

.session-preview {
  font-size: 22rpx;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;

  .action-btn {
    font-size: 24rpx;
    padding: 6rpx;
    opacity: 0.7;

    &:active {
      opacity: 1;
      transform: scale(1.15);
    }
  }
}

.empty-state {
  text-align: center;
  padding: 80rpx 0;
  color: #94a3b8;
  font-size: 26rpx;
}

.rename-modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(15, 23, 42, 0.5);
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rename-modal-card {
  width: 580rpx;
  background-color: #ffffff;
  border-radius: 28rpx;
  padding: 36rpx;
  box-shadow: 0 12rpx 36rpx rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 24rpx;
  display: block;
}

.rename-input {
  background-color: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 20rpx;
  height: 76rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #1e293b;
  margin-bottom: 32rpx;

  &:focus {
    border-color: #7a7cff;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
}

.modal-btn {
  font-size: 26rpx;
  height: 68rpx;
  line-height: 68rpx;
  padding: 0 36rpx;
  border-radius: 34rpx;
  margin: 0;
  font-weight: 600;

  &.cancel {
    background-color: #f1f5f9;
    color: #64748b;
  }

  &.confirm {
    background-color: #7a7cff;
    color: #ffffff;
    box-shadow: 0 4rpx 14rpx rgba(122, 124, 255, 0.35);
  }
}
</style>
