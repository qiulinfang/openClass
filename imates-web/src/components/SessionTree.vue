<template>
  <div class="session-tree">
    <!-- 顶部标题栏 -->
    <div class="tree-header">
      <SearchInput
        v-model="searchKeyword"
        placeholder="搜索会话"
        class="search-input-custom"
      >
        <template #append>
          <img :src="search1Icon" class="search-icon" alt="search" /> 
        </template>
      </SearchInput>
      <div class="header-actions">
        <!-- 自定义按钮插槽 -->
        <slot name="header-actions"></slot>
      </div>
    </div>

    <!-- 手风琴列表（使用 RubberBandList 实现橡皮筋效果） -->
    <div v-if="treeNodes.length > 0" ref="scrollWrapper" class="scroll-wrapper">
      <RubberBandList class="scroll-content rubber-scroll" :enable-refresh="false" :enable-load-more="false">
        <div class="accordion-list">
          <!-- 分类项 -->
          <div
            v-for="category in treeNodes"
            :key="category.id"
            class="accordion-item"
          >
            <!-- 分类头部 -->
            <div 
              class="accordion-header"
              @click="toggleCategory(category.id)"
            >
              <div class="header-content">
                <span class="category-title">{{ category.label }}</span>
              </div>
              <q-icon 
                name="expand_more" 
                class="expand-icon"
                :class="{ 'expanded': expandedCategories.has(category.id) }"
              />
            </div>

            <!-- 会话列表 -->
            <transition name="accordion">
              <div 
                v-show="expandedCategories.has(category.id)"
                class="accordion-body"
              >
                <div
                  v-for="session in category.children"
                  :key="session.id"
                  class="session-item"
                  :class="{ 'active': isSelectedNode(session) }"
                  @click="handleSessionClick(session)"
                >
                  <div class="session-content">
                    <div class="session-main">
                      <span class="session-title">{{ session.label }}</span>
                      <div v-if="hasUnreadMessage(session)" class="unread-badge"></div>
                    </div>
                    <div v-if="session.subtitle" class="session-subtitle">
                      {{ session.subtitle }}
                    </div>
                  </div>
                  <BubblePopup
                    v-if="session.sessionId"
                    v-model="showMoreMenu[session.sessionId]"
                    placement="bottom"
                    :offset="8"
                    :show-arrow="false"
                  >
                    <template #trigger>
                      <q-btn 
                        flat 
                        round 
                        dense 
                        icon="more_vert" 
                        size="sm" 
                        class="more-btn"
                      >
                      </q-btn>
                    </template>

                    <div class="session-more-menu-card">
                      <!-- 重命名 -->
                      <div
                        v-if="session.category === 'ai'"
                        class="more-menu-item-row"
                        @click="closeMenuAndExecute(session.sessionId, () => handleRename(session))"
                      >
                        <img src="icons/edit.svg" alt="重命名" width="18" height="18" />
                        <div>重命名</div>
                      </div>

                      <!-- 置顶 -->
                      <div
                        v-if="session.category === 'ai'"
                        class="more-menu-item-row"
                        @click="closeMenuAndExecute(session.sessionId, () => handlePin(session))"
                      >
                        <img src="icons/pin.svg" alt="置顶" width="18" height="18" />
                        <div>{{ session.pinned ? '取消置顶' : '置顶' }}</div>
                      </div>

                      <!-- 收藏 -->
                      <div
                        v-if="session.category === 'ai'"
                        class="more-menu-item-row"
                        @click="closeMenuAndExecute(session.sessionId, () => handleFavorite(session))"
                      >
                        <img src="icons/my_favorites.svg" alt="收藏" width="18" height="18" />
                        <div>{{ session.favorited ? '取消收藏' : '收藏' }}</div>
                      </div>

                      <!-- 分隔线 -->
                      <div v-if="session.category === 'ai'" class="session-more-menu-divider"></div>

                      <!-- 删除 -->
                      <div class="session-more-menu-delete-wrapper">
                        <div
                          class="more-menu-item-row"
                          @click="closeMenuAndExecute(session.sessionId, () => handleDelete(session))"
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

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <q-icon name="chat" size="48px" color="grey-5" />
      <div class="q-mt-md text-h6 text-grey-6">
        {{ searchKeyword ? '未找到匹配的会话' : '暂无会话' }}
      </div>
      <div class="q-mt-sm text-caption text-grey-5">
        {{ searchKeyword ? '尝试使用其他关键词搜索' : '您的会话记录将显示在这里' }}
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
            v-model="newSessionName"
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

    <!-- 删除确认对话框 -->
    <DraggableDialog
      v-model="showDeleteConfirmDialog"
      type="delete"
      :delete-content="deleteConfirmContent"
      :processing="deleting"
      processing-text="删除中..."
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import type { TeacherSession } from '@/stores/teacherChatStore'
import { useUnreadMessageStore } from '@/stores/unreadMessageStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { chatStorage } from '../services/storage/chat-storage'
import { useBetterScroll } from '@/composables/useBetterScroll'
import { isSessionFavorite, toggleSessionFavorite } from '@/utils/storage/favorites'
import { useQuasar } from 'quasar'
import { getUserId } from '@/services'
import SearchInput from './SearchInput.vue'
import RubberBandList from './base/VirtualList.vue'
import BubblePopup from './base/Popover.vue'
import DraggableDialog from './base/Modal.vue'
import search1Icon from '../../public/icons/search1.svg'

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
const getSessionCategory = (sessionId: string | undefined, nodes: TreeNode[]): 'ai-general' | 'teacher' | null => {
  if (!sessionId) return null
  
  const node = findNodeBySessionId(nodes, sessionId)
  if (!node) return null
  
  if (node.category === 'ai') {
    return 'ai-general'
  } else if (node.category === 'biology' || node.category === 'math') {
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

// 重命名对话框
const showRenameDialog = ref(false)
const currentSessionNode = ref<{ sessionId: string; label: string } | null>(null)
const newSessionName = ref('')

// 滚动容器引用
const scrollWrapper = ref<HTMLElement | null>(null)

// 未读消息 store
const unreadStore = useUnreadMessageStore()

// AI 和教师聊天 store
const aiGeneralStore = useAiGeneralChatStore()
const teacherChatStore = useTeacherChatStore()

// Quasar 实例（用于显示消息提示）
const $q = useQuasar()

// 收藏状态更新触发器（用于触发 treeNodes 重新计算收藏状态）
// 注意：收藏状态存储在 localStorage 中，不是响应式的，所以需要手动触发
const favoriteUpdateTrigger = ref(0)

// 会话更多菜单显示状态（key 为 sessionId）
const showMoreMenu = ref<Record<string, boolean>>({})

// 删除确认对话框
const showDeleteConfirmDialog = ref(false)
const pendingDeleteNode = ref<TreeNode | null>(null)

// 删除处理中状态
const deleting = ref(false)

// 删除确认内容
const deleteConfirmContent = computed(() => {
  return `确定要删除会话 "${pendingDeleteNode.value?.label || ''}" 吗？删除后无法恢复。`
})

// ==================== 计算属性 ====================

// 获取分类图标
const getCategoryIcon = (category: string): string => {
  const icons: Record<string, string> = {
    ai: 'smart_toy',
    teacher: 'school',
    biology: 'biotech',
    math: 'calculate',
  }
  return icons[category] || 'folder'
}

// 按科目分组教师会话，每个老师只保留一个会话（最新的）
// 使用 computed 从 store 的响应式数据中获取
const teacherSessionsBySubject = computed(() => {
  // 使用 store 的响应式 allSessions ref（在 computed 中会自动解包）
  const allTeacherSessions = teacherChatStore.allSessions
  const biology: TeacherSession[] = []
  const math: TeacherSession[] = []

  allTeacherSessions.forEach((session) => {
    if (session.subject === 'biology') {
      biology.push(session)
    } else if (session.subject === 'math') {
      math.push(session)
    }
  })

  // 每个老师只保留一个会话（按创建时间倒序，取最新的）
  const latestBiology = biology.sort((a, b) => b.createTime - a.createTime)[0] || null
  const latestMath = math.sort((a, b) => b.createTime - a.createTime)[0] || null

  return {
    biology: latestBiology ? [latestBiology] : [],
    math: latestMath ? [latestMath] : [],
  }
})

// 过滤会话列表（根据搜索关键词）
const filterSessions = <T extends { sessionName?: string }>(
  sessions: T[],
  keyword: string,
): T[] => {
  if (!keyword || !keyword.trim()) {
    return sessions
  }

  const lowerKeyword = keyword.toLowerCase().trim()
  return sessions.filter((session) => {
    const name = session.sessionName?.toLowerCase() || ''
    return name.includes(lowerKeyword)
  })
}

// 树节点类型定义
interface TreeNode {
  id: string
  label: string
  category: 'ai' | 'teacher' | 'biology' | 'math'
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
      }),
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

  // 2. 老师对话分类（包含所有老师的会话）
  const teacherChildren: TreeNode[] = []

  // 2.1 生物老师会话（每个老师只显示一个会话）
  const filteredBiologySessions = filterSessions(
    teacherSessionsBySubject.value.biology,
    searchKeyword.value,
  )
  if (filteredBiologySessions.length > 0) {
    const biologySession = filteredBiologySessions[0] // 只取第一个（最新的）
    teacherChildren.push({
      id: `teacher_biology_${biologySession.sessionId}`,
      label: biologySession.sessionName,
      timestamp: biologySession.createTime,
      subtitle: '生物老师',
      sessionId: biologySession.sessionId,
      category: 'biology' as const,
      level: 2,
    })
  }

  // 2.2 数学老师会话（每个老师只显示一个会话）
  const filteredMathSessions = filterSessions(
    teacherSessionsBySubject.value.math,
    searchKeyword.value,
  )
  if (filteredMathSessions.length > 0) {
    const mathSession = filteredMathSessions[0] // 只取第一个（最新的）
    teacherChildren.push({
      id: `teacher_math_${mathSession.sessionId}`,
      label: mathSession.sessionName,
      timestamp: mathSession.createTime,
      subtitle: '数学老师',
      sessionId: mathSession.sessionId,
      category: 'math' as const,
      level: 2,
    })
  }

  // 如果有老师会话或没有搜索关键词，显示"老师对话"分类
  if (teacherChildren.length > 0 || !searchKeyword.value) {
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

// 使用 Better Scroll 组合式函数（必须在 treeNodes 定义之后）
const { init: initBScroll } = useBetterScroll(
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
  [() => treeNodes.value.length],
)

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

// 处理节点选择
const handleNodeSelect = (nodeId: string | null) => {
  // 如果选中的是 null，直接清除选中状态
  if (!nodeId) {
    selectedNodeId.value = null
    return
  }

  // 查找选中的节点
  const selectedNode = findNodeById(treeNodes.value, nodeId)

  // 如果选中的是一级节点（分类节点），不允许选中，保持之前的选中状态
  if (selectedNode && selectedNode.level === 1) {
    // 保持当前选中状态不变，不更新 selectedNodeId
    return
  }

  // 如果选中的是二级节点，确保只选中这一个节点
  // 由于 selectedNodeId 是单个值，已经保证了只有一个节点被选中
  // 但为了确保一致性，我们更新选中状态
  selectedNodeId.value = nodeId
}

// 检查会话是否有未读消息
const hasUnreadMessage = (node: TreeNode): boolean => {
  if (!node.sessionId) return false

  if (node.category === 'ai') {
    // AI 会话未读 key 格式: ai_{sessionId}
    return unreadStore.hasUnread(`ai_${node.sessionId}`)
  } else if (node.category === 'biology' || node.category === 'math') {
    // 教师会话未读 key 格式: teacher_{sessionId}
    return unreadStore.hasUnread(`teacher_${node.sessionId}`)
  }

  return false
}

// 处理会话点击（内部完成所有切换逻辑，只发送最终结果）
const handleSessionClick = async (node: TreeNode) => {
  console.log('[SessionTree] handleSessionClick 被调用，节点信息:', {
    id: node.id,
    category: node.category,
    sessionId: node.sessionId,
    label: node.label,
    level: node.level
  })
  if (node.level !== 2 || !node.sessionId) {
    console.log('[SessionTree] 节点不符合会话点击条件，跳过处理')
    return
  }

  try {
    if (node.category === 'ai') {
      // AI 会话切换逻辑
      unreadStore.clearUnread(`ai_${node.sessionId}`)
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
    } else if (node.category === 'biology' || node.category === 'math') {
      // 教师会话切换逻辑
      console.log('[SessionTree] 处理教师会话切换')
      unreadStore.clearUnread(`teacher_${node.sessionId}`)

      // 查找会话数据（使用响应式的 allSessions ref，Pinia 会自动解包）
      const allTeacherSessions = teacherChatStore.allSessions
      console.log('[SessionTree] 查找教师会话，当前会话数量:', allTeacherSessions.length)
      const session = allTeacherSessions.find(s => s.sessionId === node.sessionId)
      if (!session) {
        console.error('[SessionTree] 未找到教师会话:', node.sessionId)
        return
      }

      // 设置 localStorage 中的 currentTeacherSubject
      const userId = getUserId()
      const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
      localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
      console.log('[SessionTree] 设置教师科目到localStorage:', storeSubject)

      // 设置会话并加载聊天历史
      console.log('[SessionTree] 设置教师会话:', session.sessionId)
      teacherChatStore.setSession(session)
      console.log('[SessionTree] 开始加载教师聊天历史')
      await teacherChatStore.loadChatHistory(session.sessionId)

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

// 处理重命名
const handleRename = (node: TreeNode) => {
  if (node.level !== 2 || node.category !== 'ai' || !node.sessionId) return

  currentSessionNode.value = { sessionId: node.sessionId, label: node.label }
  newSessionName.value = node.label
  showRenameDialog.value = true
}

// 确认重命名
const confirmRename = async () => {
  if (!currentSessionNode.value || !newSessionName.value.trim()) {
    return
  }

  let sessionId: string | undefined
  try {
    sessionId = currentSessionNode.value.sessionId
    const newName = newSessionName.value.trim()

    // 直接调用 store 方法完成重命名
    await aiGeneralStore.renameSession(sessionId, newName)

    // 更新本地会话列表中的名称（防护：再次查找）
    const index = aiGeneralStore.sessions.findIndex((s) => s.sessionId === sessionId)
    if (index >= 0) {
      aiGeneralStore.sessions[index].sessionName = newName
      await aiGeneralStore.saveSessions()
    }

    // 显示成功消息
    $q.notify({
      type: 'positive',
      message: '重命名成功',
      position: 'top',
      timeout: 1500,
    })
  } catch (error) {
    console.error('重命名失败:', error)
    $q.notify({
      type: 'negative',
      message: '重命名失败，请重试',
      position: 'top',
      timeout: 2000,
    })
  } finally {
    // 关闭对话框（保证无论成功或失败都会关闭），并清理状态
    showRenameDialog.value = false
    currentSessionNode.value = null
    newSessionName.value = ''
  }
}

// 处理置顶
const handlePin = async (node: TreeNode) => {
  if (node.level !== 2 || node.category !== 'ai' || !node.sessionId) return

  try {
    // 直接调用 store 方法完成置顶操作
    await aiGeneralStore.togglePin(node.sessionId)
    
    // 显示成功消息
    $q.notify({
      type: 'positive',
      message: '操作成功',
      position: 'top',
      timeout: 1500,
    })
  } catch (error) {
    console.error('置顶操作失败:', error)
    $q.notify({
      type: 'negative',
      message: '操作失败，请重试',
      position: 'top',
      timeout: 2000,
    })
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
  const session = aiGeneralStore.sessions.find(s => s.sessionId === node.sessionId)
  if (!session) {
    $q.notify({
      type: 'negative',
      message: '未找到会话数据',
      position: 'top',
    })
    return
  }
  
  // 切换收藏状态
  const success = toggleSessionFavorite(session)
  if (success) {
    // 触发收藏状态重新计算
    favoriteUpdateTrigger.value++
    
    $q.notify({
      type: 'positive',
      message: isSessionFavorite(session.sessionId) ? '已收藏' : '已取消收藏',
      position: 'top',
      timeout: 1500,
    })
  } else {
    $q.notify({
      type: 'negative',
      message: '操作失败，请重试',
      position: 'top',
    })
  }
}

// 处理删除 - 显示确认对话框
const handleDelete = (node: TreeNode) => {
  if (node.level !== 2 || !node.sessionId) return

  // 显示删除确认对话框
  pendingDeleteNode.value = node
  showDeleteConfirmDialog.value = true
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
      $q.notify({
        type: 'positive',
        message: '会话已删除',
        position: 'top',
        timeout: 1500,
      })
  } else if (node.category === 'biology' || node.category === 'math') {
      // 检查是否是当前会话
      const wasCurrentSession = teacherChatStore.currentSession?.sessionId === node.sessionId
      console.log('wasCurrentSession', wasCurrentSession)
      // 第1步：删除聊天历史（直接使用存储服务，避免清空当前消息）
      const storageKey = `teacher-general-${node.sessionId}`
      await chatStorage.removeChatHistory(storageKey)
      console.log('storageKey', storageKey)
      // 第2步：删除 localStorage 中的会话信息（使用 store 的方法，从统一存储中删除）
      // 新格式：所有会话统一存储在 {userId}_teacher-general-sessions 中
      // 格式：Record<string, TeacherSession>，key 是 sessionId
      console.log('node31235124365124', node)
      teacherChatStore.deleteSession(node.sessionId)
      
      // 第3步：如果删除的是当前会话，清空当前会话和消息
      if (wasCurrentSession) {
        teacherChatStore.clearSession()
        teacherChatStore.clearMessages()
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
      emit('teacher-session-deleted', node.sessionId, true, wasCurrentSession)
      
      // 显示成功消息
      $q.notify({
        type: 'positive',
        message: '会话已删除',
        position: 'top',
        timeout: 1500,
      })
    }
  } catch (error) {
    console.error('删除会话失败:', error)
    
    // 发送删除失败事件
    if (node.category === 'ai') {
      emit('ai-session-deleted', node.sessionId, false, false)
    } else if (node.category === 'biology' || node.category === 'math') {
      emit('teacher-session-deleted', node.sessionId, false, false)
    }
    
    // 显示失败消息
    $q.notify({
      type: 'negative',
      message: '删除失败，请重试',
      position: 'top',
      timeout: 2000,
    })
  } finally {
    // 清理状态
    deleting.value = false
    showDeleteConfirmDialog.value = false
    pendingDeleteNode.value = null
  }
}

// 取消删除
const cancelDelete = () => {
  showDeleteConfirmDialog.value = false
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

// 获取当前选中节点对应的分类
// 返回：'ai' | 'biology' | 'math' | null
// 如果选中的是一级分类节点，返回该分类
// 如果选中的是二级会话节点，返回该会话的分类
const getSelectedCategory = (): 'ai' | 'biology' | 'math' | null => {
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
    return selectedNode.category as 'ai' | 'biology' | 'math'
  }

  // 如果是二级会话节点，返回会话的分类
  if (selectedNode.level === 2) {
    return selectedNode.category as 'ai' | 'biology' | 'math'
  }

  return null
}

// 暴露方法供父组件调用
defineExpose({
  getSelectedCategory,
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
  // 当从无数据变为有数据时，重新初始化 BetterScroll
  if (oldLength === 0 && newLength > 0) {
    await nextTick()
    await initBScroll()
  }
  
  // 当树节点数据变化时，如果已有选中的 sessionId，重新查找并更新
  // 使用 nextTick 确保 treeNodes 已经更新完成
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
  treeNodes.value.forEach(node => {
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
  
  // 只有当有数据时才初始化
  if (treeNodes.value.length > 0) {
    await initBScroll()
  }
})

// 切换教师会话（内部辅助方法，用于对话框打开时的会话恢复）
const setTeacherSubject = async (sessionId: string, subject: 'biology' | 'math') => {
  const allSessions = teacherChatStore.allSessions
  const session = allSessions.find(s => s.sessionId === sessionId)
  if (!session) return
  
  const userId = getUserId()
  const storeSubject = subject === 'biology' ? 'BIOLOGY' : 'MATH'
  localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
  
  teacherChatStore.setSession(session)
  await teacherChatStore.loadChatHistory(session.sessionId)
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
    const allTeacherSessions = teacherChatStore.getAllSessions()
    const session = allTeacherSessions.find(s => s.sessionId === teacherSession.sessionId)
    if (session && (session.subject === 'biology' || session.subject === 'math')) {
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
    const allTeacherSessions = teacherChatStore.getAllSessions()
    if (allTeacherSessions.length > 0) {
      // 如果有教师会话，选中第一个
      const firstTeacherSession = allTeacherSessions[0]
      if (firstTeacherSession.subject === 'biology' || firstTeacherSession.subject === 'math') {
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
