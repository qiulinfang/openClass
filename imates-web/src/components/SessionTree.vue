<template>
  <!-- 会话树组件 - 支持AI和教师会话的分层展示 -->
  <div class="session-tree">
    <!-- ============ 顶部搜索栏区域 ============ -->
    <div class="tree-header">
      <!-- 搜索输入框 - 支持实时搜索会话 -->
      <SearchInput v-model="searchKeyword" placeholder="搜索会话" class="search-input-custom">
        <template #append>
          <img :src="search1Icon" class="search-icon" alt="search" />
        </template>
      </SearchInput>

      <!-- 头部操作按钮区域 - 支持扩展自定义按钮 -->
      <div class="header-actions">
        <slot name="header-actions"></slot>
      </div>
    </div>

    <!-- ============ 会话列表区域 ============ -->
    <!-- 仅在有会话数据时显示列表 -->
    <div v-if="treeNodes.length > 0" ref="scrollWrapper" class="scroll-wrapper">
      <!-- 使用RubberBandList实现橡皮筋滚动效果 -->
      <RubberBandList
        class="scroll-content rubber-scroll"
        :enable-refresh="false"
        :enable-load-more="false"
      >
        <!-- 手风琴式分类列表 -->
        <div class="accordion-list">
          <!-- ============ 分类项循环 ============ -->
          <div v-for="category in treeNodes" :key="category.id" class="accordion-item">
            <!-- ============ 分类头部 - 点击展开/收起 ============ -->
            <div class="accordion-header" @click="toggleCategory(category.id)">
              <div class="header-content">
                <!-- 分类标题：如"学伴默认"、"老师答疑" -->
                <span class="category-title">{{ category.label }}</span>
              </div>

              <!-- 展开/收起图标 - 根据展开状态旋转 -->
              <q-icon
                name="expand_more"
                class="expand-icon"
                :class="{ expanded: expandedCategories.has(category.id) }"
              />
            </div>

            <!-- ============ 会话列表 - 带过渡动画 ============ -->
            <transition name="accordion">
              <div v-show="expandedCategories.has(category.id)" class="accordion-body">
                <!-- ============ 会话项循环 ============ -->
                <div
                  v-for="session in category.children"
                  :key="session.id"
                  class="session-item"
                  :class="{ active: isSelectedNode(session) }"
                  @click="handleSessionClick(session)"
                >
                  <!-- ============ 会话内容区域 ============ -->
                  <div class="session-content">
                    <!-- 会话标题行 - 包含标题和未读消息标识 -->
                    <div class="session-main">
                      <!-- 会话标题：AI会话名称或教师科目名称 -->
                      <span class="session-title">{{ session.label }}</span>

                      <!-- 未读消息红点 - 有未读消息时显示 -->
                      <div v-if="hasUnreadMessage(session)" class="unread-badge"></div>
                    </div>

                    <!-- 会话副标题 - 可选显示 -->
                    <div v-if="session.subtitle" class="session-subtitle">
                      {{ session.subtitle }}
                    </div>
                  </div>

                  <!-- ============ 更多操作菜单 ============ -->
                  <!-- 气泡弹窗菜单 - 仅对有sessionId的会话显示 -->
                  <BubblePopup
                    v-if="session.sessionId"
                    v-model="showMoreMenu[session.sessionId]"
                    placement="bottom"
                    :offset="8"
                    :show-arrow="false"
                  >
                    <!-- 触发按钮 - 更多操作按钮 -->
                    <template #trigger>
                      <q-btn flat round dense icon="more_vert" size="sm" class="more-btn"> </q-btn>
                    </template>

                    <!-- ============ 菜单内容 ============ -->
                    <div class="session-more-menu-card">
                      <!-- AI会话专用操作 -->
                      <template v-if="session.category === 'ai'">
                        <!-- 置顶/取消置顶 -->
                        <div
                          class="more-menu-item-row"
                          @click="closeMenuAndExecute(session.sessionId, () => handlePin(session))"
                        >
                          <img
                            :src="session.pinned ? 'icons/quxiaozhiding.svg' : 'icons/zhiding.svg'"
                            alt="置顶"
                            width="18"
                            height="18"
                          />
                          <div>{{ session.pinned ? '取消置顶' : '置顶' }}</div>
                        </div>

                        <!-- 收藏/取消收藏 -->
                        <div
                          class="more-menu-item-row"
                          @click="
                            closeMenuAndExecute(session.sessionId, () => handleFavorite(session))
                          "
                        >
                          <img
                            :src="session.favorited ? xingxingLightIcon : shoucangIcon"
                            alt="收藏"
                            width="18"
                            height="18"
                          />
                          <div>{{ session.favorited ? '取消收藏' : '收藏' }}</div>
                        </div>

                        <!-- 分隔线 -->
                        <div class="session-more-menu-divider"></div>
                      </template>

                      <!-- 通用操作：删除会话 -->
                      <div class="session-more-menu-delete-wrapper">
                        <div
                          class="more-menu-item-row"
                          @click="
                            closeMenuAndExecute(session.sessionId, () => handleDelete(session))
                          "
                        >
                          <img src="icons/delete.svg" alt="删除会话" width="18" height="18" />
                          <div class="text-delete">删除</div>
                        </div>
                      </div>
                    </div>
                  </BubblePopup>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </RubberBandList>
    </div>

    <!-- ============ 空状态显示 ============ -->
    <!-- 当没有会话数据时显示的空状态界面 -->
    <div v-else class="empty-state">
      <!-- 空状态图标 -->
      <q-icon name="chat" size="48px" color="grey-5" />

      <!-- 空状态标题 - 根据是否有搜索关键词显示不同内容 -->
      <div class="q-mt-md text-h6 text-grey-6">
        {{ searchKeyword ? '未找到匹配的会话' : '暂无会话' }}
      </div>

      <!-- 空状态描述 - 提供相应的提示信息 -->
      <div class="q-mt-sm text-caption text-grey-5">
        {{ searchKeyword ? '尝试使用其他关键词搜索' : '您的会话记录将显示在这里' }}
      </div>
    </div>

    <!-- ============ 删除确认对话框 ============ -->
    <!-- 会话删除前的确认对话框，防止误操作 -->
    <Dialog
      ref="deleteDialogRef"
      title="删除确认"
      :confirmButtonText="'删除'"
      :cancelButtonText="'取消'"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    >
      <!-- 显示具体的删除确认内容 -->
      {{ deleteConfirmContent }}
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useUnreadMessageStore } from '@/stores/unreadMessageStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import {
  isSessionFavorite,
  toggleSessionFavorite,
  removeSessionFavorite,
} from '@/utils/storage/favorites'
import { getUserId } from '@/services'
import { showMessage } from '../utils'
import SearchInput from './SearchInput.vue'
import RubberBandList from './base/VirtualList.vue'
import BubblePopup from './base/Popover.vue'
import Dialog from './base/Dialog.vue'
import search1Icon from '../../public/icons/search1.svg'
import shoucangIcon from '/icons/shoucang1.svg'
import xingxingLightIcon from '/icons/xingxing-light.svg'

// 定义 emits
const emit = defineEmits<{
  'session-switched': [type: 'ai' | 'teacher', sessionId: string] // 会话切换完成事件（最终结果）
  'ai-session-deleted': [sessionId: string, success: boolean, wasCurrentSession: boolean]
  'teacher-session-deleted': [sessionId: string, success: boolean, wasCurrentSession: boolean]
  'category-should-change': [category: 'ai-general' | 'teacher'] // 分类应该改变的事件（用于同步父组件的 activeCategory）
  'should-switch-session': [type: 'ai' | 'teacher', sessionId: string] // 应该切换会话的事件（用于初始化时通知父组件）
}>()

// 搜索关键词
const searchKeyword = ref('')

// 选中的会话ID（内部状态）
const _selectedSessionId = ref<string | undefined>()

// 展开的分类ID集合
const expandedCategories = ref<Set<string>>(new Set())

// 辅助函数：根据 sessionId 查找节点（需要在 getSessionCategory 之前定义）
const findNodeBySessionId = (nodes: TreeNode[], targetSessionId: string): TreeNode | null => {
  for (const node of nodes) {
    if (node.sessionId === targetSessionId) {
      return node
    }
    if (node.children) {
      const found = findNodeBySessionId(node.children, targetSessionId)
      if (found) return found
    }
  }
  return null
}

// 根据 sessionId 获取会话类型（需要在 computed setter 之前定义）
const getSessionCategory = (
  sessionId: string | undefined,
  nodes: TreeNode[]
): 'ai-general' | 'teacher' | null => {
  if (!sessionId) return null

  const node = findNodeBySessionId(nodes, sessionId)
  if (!node) return null

  if (node.category === 'ai') {
    return 'ai-general'
  } else if (
    [
      'CHINESE',
      'MATH',
      'ENGLISH',
      'POLITICS',
      'HISTORY',
      'GEOGRAPHY',
      'PHYSICS',
      'CHEMISTRY',
      'BIOLOGY',
    ].includes(node.category)
  ) {
    return 'teacher'
  }

  return null
}

// 选中的会话ID（computed 属性，用于双向绑定）
const selectedSessionId = computed({
  get: () => _selectedSessionId.value,
  set: (newSessionId: string | undefined) => {
    const oldSessionId = _selectedSessionId.value
    if (newSessionId === oldSessionId) {
      return
    }

    _selectedSessionId.value = newSessionId

    // 在 setter 中直接处理分类切换通知，而不是通过 watch
    if (newSessionId) {
      const category = getSessionCategory(newSessionId, treeNodes.value)
      if (category === 'teacher') {
        emit('category-should-change', 'teacher')
      } else if (category === 'ai-general') {
        emit('category-should-change', 'ai-general')
      }
    } else {
      // 如果选中状态被清空，切换到 AI 分类
      // 只有当之前有选中状态时才 emit，避免重复
      if (oldSessionId !== undefined) {
        emit('category-should-change', 'ai-general')
      }
    }
  },
})

// 选中的节点ID
const selectedNodeId = ref<string | null>(null)

// 未读消息 store
const unreadStore = useUnreadMessageStore()

// AI 和教师聊天 store
const aiGeneralStore = useAiGeneralChatStore()
const teacherChatStore = useTeacherChatStore()

// 收藏状态更新触发器（用于触发 treeNodes 重新计算收藏状态）
// 注意：收藏状态存储在 localStorage 中，不是响应式的，所以需要手动触发
const favoriteUpdateTrigger = ref(0)

// 会话更多菜单显示状态（key 为 sessionId）
const showMoreMenu = ref<Record<string, boolean>>({})

// 删除确认对话框
const deleteDialogRef = ref<InstanceType<typeof Dialog>>()
const pendingDeleteNode = ref<TreeNode | null>(null)

// 删除处理中状态
const deleting = ref(false)

// 删除确认内容
const deleteConfirmContent = computed(() => {
  return `确定要删除会话 "${pendingDeleteNode.value?.label || ''}" 吗？删除后无法恢复。`
})

// ==================== 计算属性 ====================

// 树节点类型定义
interface TreeNode {
  id: string
  label: string
  category:
    | 'ai'
    | 'teacher'
    | 'CHINESE'
    | 'MATH'
    | 'ENGLISH'
    | 'POLITICS'
    | 'HISTORY'
    | 'GEOGRAPHY'
    | 'PHYSICS'
    | 'CHEMISTRY'
    | 'BIOLOGY'
  level: number
  children?: TreeNode[]
  sessionId?: string
  timestamp?: number
  subtitle?: string
  pinned?: boolean
  favorited?: boolean
}

// 构建树形节点
// 使用 computed 从 store 的响应式数据中获取，自动同步更新
const treeNodes = computed<TreeNode[]>(() => {
  // 依赖 favoriteUpdateTrigger 来触发收藏状态重新计算
  void favoriteUpdateTrigger.value

  const nodes: TreeNode[] = []

  // 1. AI聊天（学伴默认）分类
  // aiGeneralStore.sessions 已经是响应式的 ref，computed 会自动追踪
  const aiSessionsList = searchKeyword.value
    ? aiGeneralStore.sessions.filter((session) => {
        const name = session.sessionName?.toLowerCase() || ''
        return name.includes(searchKeyword.value.toLowerCase().trim())
      })
    : aiGeneralStore.sessions

  const aiSessions = aiSessionsList
    .sort((a, b) => {
      // 置顶的排在前面
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      // 按更新时间倒序
      return b.updateTime - a.updateTime
    })
    .map(
      (session): TreeNode => ({
        id: `ai_${session.sessionId}`,
        label: session.sessionName,
        timestamp: session.updateTime,
        sessionId: session.sessionId,
        category: 'ai' as const,
        level: 2,
        pinned: session.pinned || false,
        favorited: isSessionFavorite(session.sessionId),
      })
    )

  if (aiSessions.length > 0 || !searchKeyword.value) {
    nodes.push({
      id: 'category_ai',
      label: '学伴默认',
      category: 'ai' as const,
      level: 1,
      children: aiSessions,
    })
  }

  // 2. 老师对话分类（包含所有写死的老师会话）
  const allTeacherSessions = Object.values(teacherChatStore.loadAllSessions())

  // 过滤老师会话（支持搜索）
  const filteredTeacherSessions = searchKeyword.value
    ? allTeacherSessions.filter((session) => {
        const name = session.sessionName?.toLowerCase() || ''
        const subject = session.subject?.toLowerCase() || ''
        const searchLower = searchKeyword.value.toLowerCase().trim()
        return name.includes(searchLower) || subject.includes(searchLower)
      })
    : allTeacherSessions

  // 为每个过滤后的会话创建树节点
  const teacherChildren: TreeNode[] = filteredTeacherSessions.map((session) => ({
    id: `teacher_${session.subject}_${session.sessionId}`,
    label: session.sessionName,
    timestamp: session.createTime,
    sessionId: session.sessionId,
    category: session.subject as
      | 'CHINESE'
      | 'MATH'
      | 'ENGLISH'
      | 'POLITICS'
      | 'HISTORY'
      | 'GEOGRAPHY'
      | 'PHYSICS'
      | 'CHEMISTRY'
      | 'BIOLOGY',
    level: 2,
  }))

  // 如果有匹配的老师会话，显示"老师对话"分类
  if (teacherChildren.length > 0) {
    nodes.push({
      id: 'category_teacher',
      label: '老师答疑',
      category: 'teacher' as const,
      level: 1,
      children: teacherChildren,
    })
  }

  return nodes
})

// VirtualList 组件会自动处理滚动，无需额外初始化

// 判断节点是否被选中
// 使用内部的 selectedSessionId，直接比较 sessionId
const isSelectedNode = (node: TreeNode): boolean => {
  if (node.level === 1) return false // 分类节点不可选中

  // 直接比较 sessionId，如果匹配则选中
  return selectedSessionId.value === node.sessionId
}

// ==================== 工具函数 ====================

// 根据ID查找节点
const findNodeById = (nodes: TreeNode[], targetId: string): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node
    }
    if (node.children) {
      const found = findNodeById(node.children, targetId)
      if (found) return found
    }
  }
  return null
}

// ==================== 方法 ====================

// 检查会话是否有未读消息
const hasUnreadMessage = (node: TreeNode): boolean => {
  if (!node.sessionId) return false

  // 直接使用原始sessionId作为未读key
  return unreadStore.hasUnread(node.sessionId)
}

// 处理会话点击（内部完成所有切换逻辑，只发送最终结果）
const handleSessionClick = async (node: TreeNode) => {
  console.log('[SessionTree] handleSessionClick 被调用，节点信息:', {
    id: node.id,
    category: node.category,
    sessionId: node.sessionId,
    label: node.label,
    level: node.level,
  })
  if (node.level !== 2 || !node.sessionId) {
    console.log('[SessionTree] 节点不符合会话点击条件，跳过处理')
    return
  }

  try {
    if (node.category === 'ai') {
      // AI 会话切换逻辑
      unreadStore.clearUnread(node.sessionId) // 直接使用原始sessionId
      await aiGeneralStore.switchSession(node.sessionId)
      // 更新内部维护的选中会话ID和节点ID
      // 使用 computed setter，会自动处理分类切换通知
      console.log('[SessionTree] 设置AI会话ID:', node.sessionId)
      selectedSessionId.value = node.sessionId
      selectedNodeId.value = node.id

      // 数据更新后，手动处理 treeNodes 变化（替代 watch）
      await nextTick()
      const oldLength = previousTreeNodesLength
      const newLength = treeNodes.value.length
      if (oldLength !== newLength) {
        console.log('[SessionTree] 树节点数量变化，触发handleTreeNodesChange')
        previousTreeNodesLength = newLength
        await handleTreeNodesChange(oldLength, newLength)
      }

      console.log('[SessionTree] 发出session-switched事件: ai,', node.sessionId)
      emit('session-switched', 'ai', node.sessionId)
    } else if (
      [
        'CHINESE',
        'MATH',
        'ENGLISH',
        'POLITICS',
        'HISTORY',
        'GEOGRAPHY',
        'PHYSICS',
        'CHEMISTRY',
        'BIOLOGY',
      ].includes(node.category)
    ) {
      // 教师会话切换逻辑
      console.log('[SessionTree] 处理教师会话切换')
      unreadStore.clearUnread(node.sessionId) // 直接使用原始sessionId

      // 查找会话数据（使用响应式的 allSessions ref，Pinia 会自动解包）
      const allTeacherSessions = Object.values(teacherChatStore.loadAllSessions())
      console.log('[SessionTree] 查找教师会话，当前会话数量:', allTeacherSessions.length)
      const session = allTeacherSessions.find((s) => s.sessionId === node.sessionId)
      if (!session) {
        console.error('[SessionTree] 未找到教师会话:', node.sessionId)
        return
      }

      // 设置 localStorage 中的 currentTeacherSubject
      const userId = getUserId()
      const storeSubject = session.subject || 'MATH'
      localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
      console.log('[SessionTree] 设置教师科目到localStorage:', storeSubject)

      // 设置会话并加载聊天历史
      console.log('[SessionTree] 设置教师会话:', session.sessionId)
      teacherChatStore.setSession(session)
      console.log('[SessionTree] 开始加载教师聊天历史')
      await teacherChatStore.loadChatHistory(session.sessionId, 1) // 首次加载第1页

      // 初始化WebSocket连接（新增）
      console.log('[SessionTree] 初始化教师WebSocket连接')
      await teacherChatStore.initMessageReceiver().catch((error) => {
        console.error('[SessionTree] 初始化教师WebSocket失败:', error)
      })

      // 更新内部维护的选中会话ID和节点ID
      // 使用 computed setter，会自动处理分类切换通知
      console.log('[SessionTree] 设置选中会话ID:', node.sessionId)
      selectedSessionId.value = node.sessionId
      selectedNodeId.value = node.id

      // 数据更新后，手动处理 treeNodes 变化（替代 watch）
      await nextTick()
      const oldLength = previousTreeNodesLength
      const newLength = treeNodes.value.length
      if (oldLength !== newLength) {
        previousTreeNodesLength = newLength
        await handleTreeNodesChange(oldLength, newLength)
      }

      emit('session-switched', 'teacher', node.sessionId)
    }
  } catch (error) {
    console.error('切换会话失败:', error)
  }
}

// 处理置顶
const handlePin = async (node: TreeNode) => {
  if (node.level !== 2 || node.category !== 'ai' || !node.sessionId) return

  try {
    // 直接调用 store 方法完成置顶操作
    await aiGeneralStore.togglePin(node.sessionId)

    // 显示成功消息
    showMessage('操作成功', 'positive')
  } catch (error) {
    console.error('置顶操作失败:', error)
    showMessage('操作失败，请重试', 'negative')
  }
}

// 关闭更多菜单并执行操作
const closeMenuAndExecute = (sessionId: string | undefined, action: () => void) => {
  if (!sessionId) return
  showMoreMenu.value[sessionId] = false
  action()
}

// 处理收藏
const handleFavorite = (node: TreeNode) => {
  if (node.level !== 2 || node.category !== 'ai' || !node.sessionId) return

  // 查找对应的会话数据
  const session = aiGeneralStore.sessions.find((s) => s.sessionId === node.sessionId)
  if (!session) {
    showMessage('未找到会话数据', 'negative')
    return
  }

  // 切换收藏状态
  const success = toggleSessionFavorite(session)
  if (success) {
    // 触发收藏状态重新计算
    favoriteUpdateTrigger.value++

    showMessage(isSessionFavorite(session.sessionId) ? '已收藏' : '已取消收藏', 'positive')
  } else {
    showMessage('操作失败，请重试', 'negative')
  }
}

// 处理删除 - 显示确认对话框
const handleDelete = (node: TreeNode) => {
  if (node.level !== 2 || !node.sessionId) return

  // 显示删除确认对话框
  pendingDeleteNode.value = node
  deleteDialogRef.value?.openDialog()
}

// 确认删除
const confirmDelete = async () => {
  const node = pendingDeleteNode.value
  if (!node) return
  deleting.value = true
  try {
    if (node.category === 'ai') {
      // 检查是否是当前会话
      const wasCurrentSession = aiGeneralStore.currentSession?.sessionId === node.sessionId

      // 直接调用 store 删除
      await aiGeneralStore.deleteSession(node.sessionId)

      // 如果该会话在收藏中，同步移除收藏
      try {
        removeSessionFavorite(node.sessionId)
      } catch (e) {
        console.warn('[SessionTree] 同步移除会话收藏失败（忽略）', e)
      }

      // 数据更新后，手动处理 treeNodes 变化（替代 watch）
      await nextTick()
      const oldLength = previousTreeNodesLength
      const newLength = treeNodes.value.length
      if (oldLength !== newLength) {
        previousTreeNodesLength = newLength
        await handleTreeNodesChange(oldLength, newLength)
      }

      // 发送删除结果事件
      emit('ai-session-deleted', node.sessionId, true, wasCurrentSession)

      // 显示成功消息
      showMessage('会话已删除', 'positive')
    } else if (
      [
        'CHINESE',
        'MATH',
        'ENGLISH',
        'POLITICS',
        'HISTORY',
        'GEOGRAPHY',
        'PHYSICS',
        'CHEMISTRY',
        'BIOLOGY',
      ].includes(node.category)
    ) {
      // 老师会话不支持删除
      showMessage('老师会话不支持删除', 'warning')
      return
    }
  } catch (error) {
    console.error('删除会话失败:', error)

    // 发送删除失败事件
    if (node.category === 'ai') {
      emit('ai-session-deleted', node.sessionId, false, false)
    } else if (node.category === 'BIOLOGY' || node.category === 'MATH') {
      emit('teacher-session-deleted', node.sessionId, false, false)
    }

    // 显示失败消息
    showMessage('删除失败，请重试', 'negative')
  } finally {
    // 清理状态
    deleting.value = false
    deleteDialogRef.value?.closeDialog()
    pendingDeleteNode.value = null
  }
}

// 取消删除
const cancelDelete = () => {
  deleteDialogRef.value?.closeDialog()
  pendingDeleteNode.value = null
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
    return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(
      2,
      '0'
    )}`
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

// 获取当前选中节点对应的分类
// 返回：'ai' | 教师科目 | null
// 如果选中的是一级分类节点，返回该分类
// 如果选中的是二级会话节点，返回该会话的分类
const getSelectedCategory = ():
  | 'ai'
  | 'CHINESE'
  | 'MATH'
  | 'ENGLISH'
  | 'POLITICS'
  | 'HISTORY'
  | 'GEOGRAPHY'
  | 'PHYSICS'
  | 'CHEMISTRY'
  | 'BIOLOGY'
  | null => {
  if (!selectedNodeId.value) {
    return null
  }

  // 查找选中的节点
  const selectedNode = findNodeById(treeNodes.value, selectedNodeId.value)
  if (!selectedNode) {
    return null
  }

  // 如果是一级分类节点
  if (selectedNode.level === 1) {
    // 如果是"老师对话"分类，返回null（需要进一步判断）
    if (selectedNode.category === 'teacher') {
      return null
    }
    return selectedNode.category as
      | 'ai'
      | 'CHINESE'
      | 'MATH'
      | 'ENGLISH'
      | 'POLITICS'
      | 'HISTORY'
      | 'GEOGRAPHY'
      | 'PHYSICS'
      | 'CHEMISTRY'
      | 'BIOLOGY'
  }

  // 如果是二级会话节点，返回会话的分类
  if (selectedNode.level === 2) {
    return selectedNode.category as
      | 'ai'
      | 'CHINESE'
      | 'MATH'
      | 'ENGLISH'
      | 'POLITICS'
      | 'HISTORY'
      | 'GEOGRAPHY'
      | 'PHYSICS'
      | 'CHEMISTRY'
      | 'BIOLOGY'
  }

  return null
}

// 切换到指定会话（供父组件调用）
const switchToSession = (type: 'ai' | 'teacher', sessionId: string) => {
  if (type === 'teacher') {
    // 触发教师会话切换逻辑（类似于 handleSessionClick 中的教师会话处理）
    const allTeacherSessions = Object.values(teacherChatStore.loadAllSessions())
    const session = allTeacherSessions.find((s) => s.sessionId === sessionId)
    if (session) {
      // 设置会话
      teacherChatStore.setSession(session)

      // 更新选中状态
      selectedSessionId.value = sessionId

      // 设置 localStorage
      const userId = getUserId()
      const storeSubject = session.subject
      localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)

      // 加载聊天历史（分页加载）
      teacherChatStore.loadChatHistory(session.sessionId, 1) // 首次加载第1页

      // 初始化WebSocket连接
      teacherChatStore.initMessageReceiver().catch((error) => {
        console.error('[SessionTree] 初始化教师WebSocket失败:', error)
      })

      // 通知父组件切换分类
      emit('category-should-change', 'teacher')
    }
  } else if (type === 'ai') {
    // AI 会话切换逻辑
    aiGeneralStore.switchSession(sessionId)
    selectedSessionId.value = sessionId
    emit('category-should-change', 'ai-general')
  }
}

// 暴露方法供父组件调用
defineExpose({
  getSelectedCategory,
  switchToSession,
})

// 更新选中状态的辅助函数（仅用于同步外部状态，不处理未读标记）
// 添加条件判断避免重复更新导致的死循环
const updateSelectedNode = (sessionId: string | undefined) => {
  // 如果 sessionId 相同，且对应的 nodeId 也相同，则跳过更新，避免死循环
  if (sessionId === _selectedSessionId.value) {
    if (sessionId) {
      const node = findNodeBySessionId(treeNodes.value, sessionId)
      if (node && node.id === selectedNodeId.value) {
        // 值没有变化，跳过更新
        return
      }
    } else {
      // 都是 undefined，跳过更新
      return
    }
  }

  if (sessionId) {
    const node = findNodeBySessionId(treeNodes.value, sessionId)
    if (node) {
      // 使用 computed setter，会自动处理分类切换通知
      selectedSessionId.value = sessionId
      selectedNodeId.value = node.id
    } else {
      // 如果找不到节点，可能是数据还未加载，先设置 selectedNodeId 为 null
      selectedNodeId.value = null
    }
  } else {
    // 使用 computed setter，会自动处理分类切换通知
    selectedSessionId.value = undefined
    selectedNodeId.value = null
  }
}

// 处理 treeNodes 变化时的副作用（初始化 BetterScroll 和更新选中状态）
// 替代 watch，在数据更新时手动调用
const handleTreeNodesChange = async (oldLength: number, newLength: number) => {
  await nextTick()
  if (_selectedSessionId.value) {
    const node = findNodeBySessionId(treeNodes.value, _selectedSessionId.value)
    // 只有当节点存在且 nodeId 可能变化时才更新（避免重复更新）
    if (node) {
      // 如果 nodeId 已经匹配，说明不需要更新，避免触发循环
      if (node.id !== selectedNodeId.value) {
        updateSelectedNode(_selectedSessionId.value)
      }
    }
  }
}

let previousTreeNodesLength = 0

// 从 stores 同步选中状态的函数（替代 watch）
const syncSelectedNodeFromStores = () => {
  // 优先检查教师会话
  const teacherSession = teacherChatStore.currentSession
  if (teacherSession?.sessionId) {
    // 如果 sessionId 没有变化，跳过更新（避免死循环）
    if (teacherSession.sessionId !== _selectedSessionId.value) {
      updateSelectedNode(teacherSession.sessionId)
    }
    return
  }

  // 检查 AI 会话
  const aiSession = aiGeneralStore.currentSession
  if (aiSession?.sessionId) {
    // 如果 sessionId 没有变化，跳过更新（避免死循环）
    if (aiSession.sessionId !== _selectedSessionId.value) {
      updateSelectedNode(aiSession.sessionId)
    }
    return
  }

  // 如果两个 store 都没有当前会话，且之前有选中状态，清空选中状态
  if (_selectedSessionId.value !== undefined) {
    updateSelectedNode(undefined)
  }
}

// 生命周期
onMounted(async () => {
  // 初始化 treeNodes 长度追踪
  previousTreeNodesLength = treeNodes.value.length

  // 默认展开所有分类
  treeNodes.value.forEach((node) => {
    expandedCategories.value.add(node.id)
  })

  // 初始化会话列表和选择
  await initializeSessions()

  // 初始化后，同步 store 的选中状态
  syncSelectedNodeFromStores()

  // 初始化后，处理 treeNodes 变化（确保 BetterScroll 正确初始化）
  await nextTick()
  const currentLength = treeNodes.value.length
  if (previousTreeNodesLength !== currentLength) {
    await handleTreeNodesChange(previousTreeNodesLength, currentLength)
    previousTreeNodesLength = currentLength
  }

  // VirtualList 组件会自动处理滚动，无需手动初始化
})

// 切换教师会话（内部辅助方法，用于对话框打开时的会话恢复）
const setTeacherSubject = async (sessionId: string, subject: 'BIOLOGY' | 'MATH') => {
  const allSessions = Object.values(teacherChatStore.loadAllSessions())
  const session = allSessions.find((s) => s.sessionId === sessionId)
  if (!session) return

  const userId = getUserId()
  const storeSubject = subject === 'BIOLOGY' ? 'BIOLOGY' : 'MATH'
  localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)

  teacherChatStore.setSession(session)
  await teacherChatStore.loadChatHistory(session.sessionId, 1) // 首次加载第1页
  emit('category-should-change', 'teacher')
  emit('should-switch-session', 'teacher', sessionId)
}

// 切换分类展开/折叠
const toggleCategory = (categoryId: string) => {
  if (expandedCategories.value.has(categoryId)) {
    expandedCategories.value.delete(categoryId)
  } else {
    expandedCategories.value.add(categoryId)
  }
}

// 初始化会话（组件挂载时执行）
const initializeSessions = async () => {
  // 加载AI会话列表
  await aiGeneralStore.loadSessions()

  // 优先检查是否有当前会话（无论是AI还是教师），如果有，选中它
  // 这样可以确保从收藏页点击的会话能正确选中
  const teacherSession = teacherChatStore.currentSession
  if (teacherSession?.sessionId) {
    // 如果有当前教师会话，优先选中它
    const allTeacherSessions = Object.values(teacherChatStore.loadAllSessions())
    const session = allTeacherSessions.find((s) => s.sessionId === teacherSession.sessionId)
    if (session && (session.subject === 'BIOLOGY' || session.subject === 'MATH')) {
      await setTeacherSubject(session.sessionId, session.subject)
      return
    }
  }

  // 检查是否有当前AI会话
  if (aiGeneralStore.currentSession?.sessionId) {
    // updateSelectedNode 内部会更新 selectedSessionId 和 selectedNodeId
    updateSelectedNode(aiGeneralStore.currentSession.sessionId)
    emit('category-should-change', 'ai-general')
    emit('should-switch-session', 'ai', aiGeneralStore.currentSession.sessionId)
  } else if (aiGeneralStore.sessions.length > 0) {
    // 如果有AI会话，选中第一个
    const firstSession = aiGeneralStore.sessions[0]
    // updateSelectedNode 内部会更新 selectedSessionId 和 selectedNodeId
    updateSelectedNode(firstSession.sessionId)
    emit('category-should-change', 'ai-general')
    emit('should-switch-session', 'ai', firstSession.sessionId)
  } else {
    // 检查是否有教师会话
    const allTeacherSessions = Object.values(teacherChatStore.loadAllSessions())
    if (allTeacherSessions.length > 0) {
      // 如果有教师会话，选中第一个
      const firstTeacherSession = allTeacherSessions[0]
      if (firstTeacherSession.subject === 'BIOLOGY' || firstTeacherSession.subject === 'MATH') {
        await setTeacherSubject(firstTeacherSession.sessionId, firstTeacherSession.subject)
      }
    } else {
      // 默认使用AI分类
      emit('category-should-change', 'ai-general')
    }
  }
}
</script>

<style lang="scss" scoped>
.session-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 顶部标题栏
.tree-header {
  padding: 16px 6px 0 6px;
  display: flex;
  align-items: center;
  background: #f7f6ff;

  .search-input-custom {
    flex: 1;
    min-width: 0;
  }

  .search-icon {
    width: 20px;
    height: 20px;
  }

  .header-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
}

// 滚动容器（BetterScroll 需要）
.scroll-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: #f7f6ff;
}

.scroll-content {
  min-height: calc(100% + 1px);
  background: #f7f6ff;
}

// 手风琴列表
.accordion-list {
  display: flex;
  flex-direction: column;
}

// 手风琴项
.accordion-item {
  &:last-child {
    border-bottom: none;
  }
}

// 分类头部
.accordion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  background-color: #f7f6ff;
  transition: background-color 0.2s ease;

  .header-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .category-title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  .expand-icon {
    color: #999;
    font-size: 24px;
    transition: transform 0.3s ease;

    &.expanded {
      transform: rotate(180deg);
    }
  }
}

// 会话列表区域
.accordion-body {
  background-color: #f7f6ff;
}

// 手风琴展开/收起动画
.accordion-enter-active,
.accordion-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.accordion-enter-from,
.accordion-leave-to {
  opacity: 0;
  max-height: 0;
}

.accordion-enter-to,
.accordion-leave-from {
  opacity: 1;
  max-height: 1000px;
}

// 会话项
.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin: 4px 8px;
  border-radius: 8px;
  background-color: #f5f3ff;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 8px;

  &:hover {
    background-color: #ede9fe;
  }

  &.active {
    background-color: #e8e9ff;

    .session-actions {
      font-weight: 400;
    }
  }

  .session-content {
    flex: 1;
    min-width: 0;
  }

  .session-main {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .session-title {
    font-size: 14px;
    color: #333;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-subtitle {
    font-size: 12px;
    color: #666;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .unread-badge {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #f44336;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(244, 67, 54, 0.2);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.1);
    }
  }

  .more-btn {
    color: #9e9e9e;
    opacity: 1;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  }
}

// 气泡框菜单样式
.session-more-menu-card {
  max-width: 100px;
  white-space: nowrap;
}

// 复用 QuestionList 的更多菜单行样式
.more-menu-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  font-size: 13px;
  line-height: 1.4;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 8px;
  white-space: nowrap;

  &:hover {
    background-color: rgba(15, 23, 42, 0.03);
  }

  img {
    flex-shrink: 0;
  }
}

// 菜单样式
:deep(.menu-item) {
  padding: 8px 12px;
  min-height: 40px;
  border-radius: 4px;
  margin: 2px 4px;

  &:hover {
    background-color: #f5f5f5;
  }

  &.delete-item:hover {
    background-color: #ffebee;
  }
}

// 空状态
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
</style>
