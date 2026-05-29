import React, { useState, useRef, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useUnreadMessageStore } from '@/stores/unreadMessageStore'
import { isSessionFavorite, toggleSessionFavorite, removeSessionFavorite } from '@/utils/storage/favorites'
import { showMessage } from '@/utils'
import SearchInput from '@/components/base/SearchInput'
import VirtualScroll from '@/components/base/VirtualScroll'
import Popover from '@/components/base/Popover'
import Dialog from '@/components/base/Dialog'
import search1Icon from '/icons/search1.svg'
import shoucangIcon from '/icons/shoucang1.svg'
import xingxingLightIcon from '/icons/xingxing-light.svg'
import addSessionIcon from '/icons/addsession.png'
import quxiaozhidingIcon from '/icons/quxiaozhiding.svg'
import zhidingIcon from '/icons/zhiding.svg'
import deleteIcon from '/icons/delete.svg'
import '@/components/chat/session/SessionTree.css'

export interface SessionTreeProps {
  onSessionSelected?: (type: 'ai' | 'teacher', sessionId: string) => void
  onAiSessionDeleted?: (sessionId: string, success: boolean, wasCurrentSession: boolean) => void
  onTeacherSessionDeleted?: (sessionId: string, success: boolean, wasCurrentSession: boolean) => void
  onCreateNewChat?: () => void
}

export interface SessionTreeRef {
  getSelectedCategory: () => string | null
  highlightSession: (sessionId: string | undefined) => void
}

interface TreeNode {
  id: string
  label: string
  category: string
  level: number
  children?: TreeNode[]
  sessionId?: string
  timestamp?: number
  subtitle?: string
  pinned?: boolean
  favorited?: boolean
}

export const SessionTree = forwardRef<SessionTreeRef, SessionTreeProps>(({
  onSessionSelected,
  onAiSessionDeleted,
  onTeacherSessionDeleted,
  onCreateNewChat,
}, ref) => {
  const aiGeneralStore = useAiGeneralChatStore()
  const teacherChatStore = useTeacherChatStore()
  const unreadStore = useUnreadMessageStore()

  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['category_ai', 'category_teacher']))
  const [favoriteUpdateTrigger, setFavoriteUpdateTrigger] = useState(0)
  const [showMoreMenu, setShowMoreMenu] = useState<Record<string, boolean>>({})
  const [pendingDeleteNode, setPendingDeleteNode] = useState<TreeNode | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const treeNodes = useMemo((): TreeNode[] => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    favoriteUpdateTrigger
    const nodes: TreeNode[] = []

    const aiSessionsList = searchKeyword
      ? aiGeneralStore.sessions.filter((s) => s.sessionName.toLowerCase().includes(searchKeyword.toLowerCase()))
      : aiGeneralStore.sessions

    const aiSessions = aiSessionsList
      .slice()
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return (b.updateTime || 0) - (a.updateTime || 0)
      })
      .map((s): TreeNode => ({
        id: `ai_${s.sessionId}`,
        label: s.sessionName,
        timestamp: s.updateTime,
        sessionId: s.sessionId,
        category: 'ai',
        level: 2,
        pinned: s.pinned || false,
        favorited: isSessionFavorite(s.sessionId),
      }))

    if (aiSessions.length > 0 || !searchKeyword) {
      nodes.push({
        id: 'category_ai',
        label: '学伴默认',
        category: 'ai',
        level: 1,
        children: aiSessions,
      })
    }

    const allTeacherSessions = Object.values(teacherChatStore.loadAllSessions())
    const filteredTeacherSessions = searchKeyword
      ? allTeacherSessions.filter((s) => s.sessionName.toLowerCase().includes(searchKeyword.toLowerCase()) || s.subject.toLowerCase().includes(searchKeyword.toLowerCase()))
      : allTeacherSessions

    const teacherChildren = filteredTeacherSessions.map((s): TreeNode => ({
      id: `teacher_${s.subject}_${s.sessionId}`,
      label: s.sessionName,
      timestamp: s.createTime,
      sessionId: s.sessionId,
      category: s.subject,
      level: 2,
    }))

    if (teacherChildren.length > 0) {
      nodes.push({
        id: 'category_teacher',
        label: '老师答疑',
        category: 'teacher',
        level: 1,
        children: teacherChildren,
      })
    }

    return nodes
  }, [searchKeyword, aiGeneralStore.sessions, teacherChatStore, favoriteUpdateTrigger])

  const toggleCategory = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSessionClick = async (node: TreeNode) => {
    if (node.level !== 2 || !node.sessionId) return
    
    unreadStore.clearUnread(node.sessionId)
    setSelectedSessionId(node.sessionId)
    setSelectedNodeId(node.id)

    if (node.category === 'ai') {
      onSessionSelected?.('ai', node.sessionId)
    } else {
      onSessionSelected?.('teacher', node.sessionId)
    }
  }

  const handlePin = async (e: React.MouseEvent, node: TreeNode) => {
    e.stopPropagation()
    if (!node.sessionId) return
    try {
      await aiGeneralStore.togglePin(node.sessionId)
      setShowMoreMenu(prev => ({ ...prev, [node.sessionId!]: false }))
      showMessage('操作成功', 'success')
    } catch (error) {
      showMessage('操作失败', 'error')
    }
  }

  const handleFavorite = (e: React.MouseEvent, node: TreeNode) => {
    e.stopPropagation()
    if (!node.sessionId) return
    const session = aiGeneralStore.sessions.find(s => s.sessionId === node.sessionId)
    if (!session) return
    if (toggleSessionFavorite(session)) {
      setFavoriteUpdateTrigger(v => v + 1)
      setShowMoreMenu(prev => ({ ...prev, [node.sessionId!]: false }))
      showMessage(isSessionFavorite(session.sessionId) ? '已收藏' : '已取消收藏', 'success')
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, node: TreeNode) => {
    e.stopPropagation()
    setPendingDeleteNode(node)
    setShowDeleteDialog(true)
    if (node.sessionId) setShowMoreMenu(prev => ({ ...prev, [node.sessionId!]: false }))
  }

  const confirmDelete = async () => {
    if (!pendingDeleteNode || !pendingDeleteNode.sessionId) return
    const { sessionId, category } = pendingDeleteNode
    try {
      if (category === 'ai') {
        const wasCurrent = aiGeneralStore.currentSession?.sessionId === sessionId
        await aiGeneralStore.deleteSession(sessionId)
        removeSessionFavorite(sessionId)
        onAiSessionDeleted?.(sessionId, true, wasCurrent)
        showMessage('会话已删除', 'success')
      } else {
        showMessage('老师会话不支持删除', 'warning')
      }
    } catch (error) {
      showMessage('删除失败', 'error')
    } finally {
      setShowDeleteDialog(false)
      setPendingDeleteNode(null)
    }
  }

  const findNodeById = useCallback((nodes: TreeNode[], targetId: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === targetId) return node
      if (node.children) {
        const found = findNodeById(node.children, targetId)
        if (found) return found
      }
    }
    return null
  }, [])

  const findNodeBySessionId = useCallback((nodes: TreeNode[], sid: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.sessionId === sid) return node
      if (node.children) {
        const found = findNodeBySessionId(node.children, sid)
        if (found) return found
      }
    }
    return null
  }, [])

  useImperativeHandle(ref, () => ({
    getSelectedCategory: () => {
      if (!selectedNodeId) return null
      const node = findNodeById(treeNodes, selectedNodeId)
      if (!node) return null
      if (node.level === 1) return node.category === 'teacher' ? null : node.category
      return node.category
    },
    highlightSession: (sid: string | undefined) => {
      if (!sid) {
        setSelectedSessionId(undefined)
        setSelectedNodeId(null)
        return
      }
      const node = findNodeBySessionId(treeNodes, sid)
      if (node) {
        setSelectedSessionId(sid)
        setSelectedNodeId(node.id)
      }
    }
  }))

  return (
    <div className="session-tree">
      <div className="tree-header">
        <SearchInput
          value={searchKeyword}
          onChange={setSearchKeyword}
          placeholder="搜索会话"
          className="search-input-custom"
          append={<img src={search1Icon} className="search-icon" alt="search" />}
        />
      </div>

      <div className="scroll-wrapper">
        <VirtualScroll className="scroll-content rubber-scroll">
          <div className="accordion-list">
            {treeNodes.map((category) => (
              <div key={category.id} className="accordion-item">
                <div className="accordion-header" onClick={() => toggleCategory(category.id)}>
                  <div className="header-content">
                    <span className="category-title">{category.label}</span>
                  </div>
                  <div className="category-actions">
                    {category.id === 'category_ai' && (
                      <div className="create-session-btn" onClick={(e) => { e.stopPropagation(); onCreateNewChat?.() }}>
                        <img src={addSessionIcon} className="create-session-icon" alt="新增会话" />
                      </div>
                    )}
                    <span className={`expand-icon ${expandedCategories.has(category.id) ? 'expanded' : ''}`}>▼</span>
                  </div>
                </div>

                <div className={`accordion-body ${expandedCategories.has(category.id) ? 'show' : ''}`}>
                  {category.children?.map((session) => (
                    <div
                      key={session.id}
                      className={`session-item ${selectedSessionId === session.sessionId ? 'active' : ''}`}
                      onClick={() => handleSessionClick(session)}
                    >
                      <div className="session-content">
                        <div className="session-main">
                          <span className="session-title">{session.label}</span>
                          {session.sessionId && unreadStore.hasUnread(session.sessionId) && (
                            <div className="unread-badge"></div>
                          )}
                        </div>
                      </div>

                      {session.sessionId && (
                        <Popover
                          visible={showMoreMenu[session.sessionId]}
                          onVisibleChange={(v) => setShowMoreMenu(prev => ({ ...prev, [session.sessionId!]: v }))}
                          placement="bottom"
                          offset={8}
                          showArrow={false}
                          content={
                            <div className="session-more-menu-card">
                              {session.category === 'ai' && (
                                <>
                                  <div className="more-menu-item-row" onClick={(e) => handlePin(e, session)}>
                                    <img src={session.pinned ? quxiaozhidingIcon : zhidingIcon} alt="置顶" width="18" height="18" />
                                    <div>{session.pinned ? '取消置顶' : '置顶'}</div>
                                  </div>
                                  <div className="more-menu-item-row" onClick={(e) => handleFavorite(e, session)}>
                                    <img src={session.favorited ? xingxingLightIcon : shoucangIcon} alt="收藏" width="18" height="18" />
                                    <div>{session.favorited ? '取消收藏' : '收藏'}</div>
                                  </div>
                                  <div className="session-more-menu-divider" />
                                </>
                              )}
                              <div className="session-more-menu-delete-wrapper">
                                <div className="more-menu-item-row" onClick={(e) => handleDeleteClick(e, session)}>
                                  <img src={deleteIcon} alt="删除" width="18" height="18" />
                                  <div className="text-delete">删除</div>
                                </div>
                              </div>
                            </div>
                          }
                        >
                          <button className="more-btn">⋮</button>
                        </Popover>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </VirtualScroll>
      </div>

      <Dialog
        open={showDeleteDialog}
        title="删除确认"
        confirmButtonText="删除"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteDialog(false)}
      >
        确定要删除会话 "{pendingDeleteNode?.label}" 吗？删除后无法恢复。
      </Dialog>
    </div>
  )
})

export default SessionTree
