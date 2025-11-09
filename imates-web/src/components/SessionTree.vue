<template>
  <div class="session-tree">
    <!-- 顶部标题栏 -->
    <div v-if="showHeader" class="tree-header">
      <div class="header-center">
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
      <div class="header-actions">
        <!-- 自定义按钮插槽 -->
        <slot name="header-actions"></slot>
      </div>
    </div>

    <!-- 树形结构 -->
    <div v-if="treeNodes.length > 0" ref="scrollWrapper" class="scroll-wrapper">
      <div class="scroll-content">
        <q-tree
          :nodes="treeNodes"
          node-key="id"
          :expanded="expandedNodes"
          @update:expanded="(val) => (expandedNodes = Array.isArray(val) ? [...val] : [])"
          :selected="selectedNodeId"
          @update:selected="handleNodeSelect"
          default-expand-all
          no-connectors
        >
          <template v-slot:default-header="prop">
            <div class="tree-node-header" :class="{ 'is-selected': isSelectedNode(prop.node) }">
              <!-- 一级节点（分类） -->
              <div v-if="prop.node.level === 1" class="category-node">
                <q-icon
                  :name="getCategoryIcon(prop.node.category)"
                  size="sm"
                  class="category-icon"
                />
                <span class="category-label">{{ prop.node.label }}</span>
                <span class="category-count">({{ prop.node.children?.length || 0 }})</span>
              </div>

              <!-- 二级节点（会话） -->
              <div v-else-if="prop.node.level === 2" class="session-node">
                <div class="session-content" @click.stop="handleSessionClick(prop.node)">
                  <div class="session-title-row">
                    <div class="session-title-wrapper">
                      <div class="session-title">{{ prop.node.label }}</div>
                      <div v-if="hasUnreadMessage(prop.node)" class="unread-badge"></div>
                    </div>
                    <div class="session-time">{{ formatTime(prop.node.timestamp) }}</div>
                  </div>
                  <div v-if="prop.node.subtitle" class="session-subtitle">
                    {{ prop.node.subtitle }}
                  </div>
                </div>
                <div class="session-actions">
                  <q-btn flat round dense icon="more_vert" size="sm" class="more-btn" @click.stop>
                    <q-menu anchor="bottom right" self="top right" :offset="[0, 8]">
                      <q-list style="min-width: 150px">
                        <q-item
                          v-if="prop.node.category === 'ai'"
                          clickable
                          v-close-popup
                          @click="handleRename(prop.node)"
                        >
                          <q-item-section avatar>
                            <q-icon name="edit" size="xs" />
                          </q-item-section>
                          <q-item-section>重命名</q-item-section>
                        </q-item>

                        <q-item
                          v-if="prop.node.category === 'ai'"
                          clickable
                          v-close-popup
                          @click="handlePin(prop.node)"
                        >
                          <q-item-section avatar>
                            <q-icon name="push_pin" size="xs" />
                          </q-item-section>
                          <q-item-section>
                            {{ prop.node.pinned ? '取消置顶' : '置顶' }}
                          </q-item-section>
                        </q-item>

                        <q-item
                          v-if="prop.node.category === 'ai'"
                          clickable
                          v-close-popup
                          @click="handleFavorite(prop.node)"
                        >
                          <q-item-section avatar>
                            <q-icon 
                              :name="prop.node.favorited ? 'star' : 'star_border'" 
                              size="xs"
                              :color="prop.node.favorited ? 'warning' : undefined"
                            />
                          </q-item-section>
                          <q-item-section>
                            {{ prop.node.favorited ? '取消收藏' : '收藏' }}
                          </q-item-section>
                        </q-item>

                        <q-separator />

                        <q-item
                          clickable
                          v-close-popup
                          @click="handleDelete(prop.node)"
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
          </template>
        </q-tree>
      </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { TeacherSession } from '@/stores/teacherGeneralChatStore'
import { useUnreadMessageStore } from '@/stores/unreadMessageStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherGeneralChatStore } from '@/stores/teacherGeneralChatStore'
import { asyncStorage } from '@/services/chat-storage'
import { useBetterScroll } from '@/composables/useBetterScroll'
import { isSessionFavorite, toggleSessionFavorite } from '@/utils/storage/favorites'
import { useQuasar } from 'quasar'
import { getCurrentUserIdOrDefault } from '@/utils/user/userId'

// 定义 props
interface Props {
  // 当前选中的会话ID（通用，可以是AI会话或教师会话）
  selectedSessionId?: string
  // 是否显示头部
  showHeader?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedSessionId: undefined,
  showHeader: true,
})

// 定义 emits
const emit = defineEmits<{
  'session-switched': [type: 'ai' | 'teacher', sessionId: string] // 会话切换完成事件（最终结果）
  'ai-session-deleted': [sessionId: string, success: boolean, wasCurrentSession: boolean]
  'teacher-session-deleted': [sessionId: string, success: boolean, wasCurrentSession: boolean]
}>()

// 搜索关键词
const searchKeyword = ref('')

// 展开的节点
const expandedNodes = ref<string[]>([])

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
const teacherChatStore = useTeacherGeneralChatStore()

// Quasar 实例（用于显示消息提示）
const $q = useQuasar()

// 监听未读消息变化，确保组件响应式更新
watch(
  () => unreadStore.unreadSessionsMap,
  () => {
    // 触发响应式更新
  },
  { deep: true },
)

// 收藏状态更新触发器（用于触发 treeNodes 重新计算收藏状态）
// 注意：收藏状态存储在 localStorage 中，不是响应式的，所以需要手动触发
const favoriteUpdateTrigger = ref(0)

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

  // 1. AI聊天（学伴对话）分类
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
      label: '学伴对话',
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
// 使用通用的 selectedSessionId，直接比较 sessionId
const isSelectedNode = (node: TreeNode): boolean => {
  if (node.level === 1) return false // 分类节点不可选中

  // 直接比较 sessionId，如果匹配则选中
  return props.selectedSessionId === node.sessionId
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

// 根据 sessionId 查找节点
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
  if (node.level !== 2 || !node.sessionId) return

  try {
  if (node.category === 'ai') {
      // AI 会话切换逻辑
    unreadStore.clearUnread(`ai_${node.sessionId}`)
      await aiGeneralStore.switchSession(node.sessionId)
      emit('session-switched', 'ai', node.sessionId)
  } else if (node.category === 'biology' || node.category === 'math') {
      // 教师会话切换逻辑
    unreadStore.clearUnread(`teacher_${node.sessionId}`)
      
      // 查找会话数据（使用响应式的 allSessions ref，Pinia 会自动解包）
      const allTeacherSessions = teacherChatStore.allSessions
      const session = allTeacherSessions.find(s => s.sessionId === node.sessionId)
      if (!session) {
        console.error('未找到教师会话:', node.sessionId)
        return
      }
      
      // 设置 localStorage 中的 currentTeacherSubject
      const userId = getCurrentUserIdOrDefault()
      const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
      localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
      
      // 设置会话并加载聊天历史
      teacherChatStore.setSession(session)
      await teacherChatStore.loadChatHistory(session.sessionId)
      
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

  try {
    const sessionId = currentSessionNode.value.sessionId
    const newName = newSessionName.value.trim()
    
    // 直接调用 store 方法完成重命名
    await aiGeneralStore.renameSession(sessionId, newName)
    
    // 更新本地会话列表中的名称
    const index = aiGeneralStore.sessions.findIndex(
      (s) => s.sessionId === sessionId,
    )
    if (index >= 0) {
      aiGeneralStore.sessions[index].sessionName = newName
      await aiGeneralStore.saveSessions()
    }
    
    // 关闭对话框
    showRenameDialog.value = false
    currentSessionNode.value = null
    
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

// 处理删除
const handleDelete = async (node: TreeNode) => {
  if (node.level !== 2 || !node.sessionId) return

  try {
  if (node.category === 'ai') {
      // 检查是否是当前会话
      const wasCurrentSession = aiGeneralStore.currentSession?.sessionId === node.sessionId
      
      // 直接调用 store 删除
      await aiGeneralStore.deleteSession(node.sessionId)
      
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
      
      // 第1步：删除聊天历史（直接使用存储服务，避免清空当前消息）
      const storageKey = `teacher-general-${node.sessionId}`
      await asyncStorage.removeChatHistory(storageKey)
      
      // 第2步：删除 localStorage 中的会话信息（使用 store 的方法，从统一存储中删除）
      // 新格式：所有会话统一存储在 {userId}_teacher-general-sessions 中
      // 格式：Record<string, TeacherSession>，key 是 sessionId
      teacherChatStore.deleteSession(node.sessionId)
      
      // 第3步：如果删除的是当前会话，清空当前会话和消息
      if (wasCurrentSession) {
        teacherChatStore.clearSession()
        teacherChatStore.clearMessages()
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
  }
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

// 监听 treeNodes 变化，确保当数据从无到有时能正确初始化 BetterScroll
watch(
  () => treeNodes.value.length,
  async (newLength, oldLength) => {
    // 当从无数据变为有数据时，重新初始化 BetterScroll
    if (oldLength === 0 && newLength > 0) {
      await nextTick()
      await initBScroll()
    }
  },
)

// 生命周期
onMounted(async () => {
  // 只有当有数据时才初始化
  if (treeNodes.value.length > 0) {
    await initBScroll()
  }
})

onUnmounted(() => {
  // BScroll 销毁由组合式函数自动处理
})

// 更新选中状态的辅助函数
const updateSelectedNode = (sessionId: string | undefined) => {
  if (sessionId) {
    const node = findNodeBySessionId(treeNodes.value, sessionId)
    if (node) {
      selectedNodeId.value = node.id
      
      // 清除新会话的未读标记
      if (node.category === 'ai') {
        unreadStore.clearUnread(`ai_${sessionId}`)
      } else if (node.category === 'biology' || node.category === 'math') {
        unreadStore.clearUnread(`teacher_${sessionId}`)
      }
    } else {
      // 如果找不到节点，可能是数据还未加载，先设置 selectedNodeId 为 null
      selectedNodeId.value = null
    }
  } else {
    selectedNodeId.value = null
  }
}

// 监听选中状态变化，更新树形组件的选中状态并清除未读标记
watch(
  () => props.selectedSessionId,
  (newSessionId, oldSessionId) => {
    // 清除旧会话的未读标记（如果切换了会话）
    if (oldSessionId && oldSessionId !== newSessionId) {
      // 需要判断旧会话的类型
      const oldNode = findNodeBySessionId(treeNodes.value, oldSessionId)
      if (oldNode) {
        if (oldNode.category === 'ai') {
          unreadStore.clearUnread(`ai_${oldSessionId}`)
        } else if (oldNode.category === 'biology' || oldNode.category === 'math') {
          unreadStore.clearUnread(`teacher_${oldSessionId}`)
        }
      }
    }

    // 更新新会话的选中状态
    updateSelectedNode(newSessionId)
  },
  { immediate: true },
)

// 监听 treeNodes 变化，当数据加载完成后重新更新选中状态
watch(
  () => treeNodes.value.length,
  () => {
    // 当树节点数据变化时，如果已有选中的 sessionId，重新查找并更新
    if (props.selectedSessionId) {
      updateSelectedNode(props.selectedSessionId)
    }
  },
)

// 监听 treeNodes 变化，自动展开所有一级节点
watch(
  () => treeNodes.value,
  (newNodes) => {
    if (newNodes.length > 0) {
      // 获取所有一级节点（分类节点）的 ID
      const firstLevelNodeIds = newNodes
        .filter((node) => node.level === 1)
        .map((node) => node.id)
      
      // 如果当前展开的节点不包含所有一级节点，则更新
      const currentExpanded = new Set(expandedNodes.value)
      const allFirstLevelExpanded = firstLevelNodeIds.every((id) => currentExpanded.has(id))
      
      if (!allFirstLevelExpanded) {
        // 合并现有展开节点和新的一级节点，去重
        const newExpandedNodes = Array.from(
          new Set([...expandedNodes.value, ...firstLevelNodeIds])
        )
        expandedNodes.value = newExpandedNodes
      }
    }
  },
  { immediate: true, deep: true },
)
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
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;

  .header-center {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;

    .search-input {
      width: 100%;
      font-size: 14px;
    }
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
}

.scroll-content {
  min-height: calc(100% + 1px);
  padding: 8px 0;
}

// 树节点头部
.tree-node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 40px;
  transition: all 0.2s ease;

  &.is-selected {
    background-color: #f0f7ff;
    border-radius: 6px;
  }

  // 二级节点选中时更显眼
  &.is-selected .session-node {
    background: linear-gradient(90deg, rgba(25, 118, 210, 0.12) 0%, rgba(25, 118, 210, 0.08) 100%);
    border-left: 3px solid #1976d2;
    box-shadow: 0 2px 8px rgba(25, 118, 210, 0.15);
    transform: translateX(2px);

    .session-title {
      color: #1976d2;
      font-weight: 600;
    }

    .session-time {
      color: #42a5f5;
      font-weight: 500;
    }

    .session-subtitle {
      color: #1976d2;
    }

    // 选中状态下显示更多功能按钮
    .session-actions {
      opacity: 1;
    }
  }
}

// 分类节点（一级）
.category-node {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  font-weight: 500;
  font-size: 14px;
  color: #333;

  .category-icon {
    color: #9059ff;
  }

  .category-label {
    flex: 1;
  }

  .category-count {
    font-size: 12px;
    color: #999;
    font-weight: normal;
  }
}

// 会话节点（二级）
.session-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
  min-height: 56px;
  padding: 8px 12px;
  margin: 0 -8px;
  border-left: 3px solid transparent;
  transition: all 0.2s ease;

  .session-content {
    flex: 1;
    min-width: 0;
    cursor: pointer;
    padding: 4px 0;
  }

  .session-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .session-title-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    position: relative;
  }

  .session-title {
    font-size: 13px;
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

  .session-time {
    font-size: 11px;
    color: #999;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .session-subtitle {
    font-size: 12px;
    color: #666;
    line-height: 1.4;
  }

  .session-actions {
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 0.2s ease;

    .more-btn {
      color: #666;

      &:hover {
        color: #333;
      }
    }
  }

  // 鼠标悬停时显示按钮
  &:hover .session-actions {
    opacity: 1;
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
