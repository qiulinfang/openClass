/**
 * SessionDrawer - 会话列表抽屉组件
 * 负责会话列表展示、会话切换、会话管理（重命名、置顶、删除）、会话搜索和批量管理等功能
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  View,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Alert,
} from 'react-native'
import { useAiGeneralChatStore, type AiGeneralSession } from '../../stores/aiGeneralChatStore'

export interface SessionDrawerProps {
  visible: boolean
  currentSessionId?: string
  onClose: () => void
  onSessionSwitch?: (sessionId: string) => Promise<void>
  onSessionCreate?: () => void
  onSessionRename?: (sessionId: string, newName: string) => Promise<void>
  onSessionPin?: (sessionId: string) => Promise<void>
  onSessionDelete?: (sessionId: string) => Promise<void>
  onBatchDelete?: (sessionIds: string[]) => Promise<void>
}

const SessionDrawer: React.FC<SessionDrawerProps> = ({
  visible,
  currentSessionId,
  onClose,
  onSessionSwitch,
  onSessionCreate,
  onSessionRename,
  onSessionPin,
  onSessionDelete,
  onBatchDelete,
}) => {
  const store = useAiGeneralChatStore()

  // 状态管理
  const [searchKeyword, setSearchKeyword] = useState('')
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renamingSession, setRenamingSession] = useState<AiGeneralSession | null>(null)
  const [newSessionName, setNewSessionName] = useState('')

  // 计算属性：排序后的会话列表
  const sortedSessions = useMemo(() => {
    return [...store.sessions].sort((a, b) => {
      // 置顶会话优先
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      // 按更新时间倒序
      return b.updateTime - a.updateTime
    })
  }, [store.sessions])

  // 计算属性：过滤后的会话列表
  const filteredSessions = useMemo(() => {
    if (!searchKeyword.trim()) {
      return sortedSessions
    }

    const keyword = searchKeyword.toLowerCase().trim()

    return sortedSessions.filter((session) => {
      const sessionName = session.sessionName?.toLowerCase() || ''
      return sessionName.includes(keyword)
    })
  }, [sortedSessions, searchKeyword])

  // 切换会话选择状态
  const toggleSessionSelection = useCallback((sessionId: string) => {
    setSelectedSessions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId)
      } else {
        newSet.add(sessionId)
      }
      return newSet
    })
  }, [])

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedSessions.size === filteredSessions.length) {
      setSelectedSessions(new Set())
    } else {
      setSelectedSessions(new Set(filteredSessions.map((s) => s.sessionId)))
    }
  }, [filteredSessions, selectedSessions.size])

  // 进入批量选择模式
  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true)
    setSelectedSessions(new Set())
  }, [])

  // 退出批量选择模式
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedSessions(new Set())
  }, [])

  // 批量删除
  const handleBatchDelete = useCallback(() => {
    if (selectedSessions.size === 0) return

    const sessionIds = Array.from(selectedSessions)
    Alert.alert(
      '确认删除',
      `确定要删除 ${sessionIds.length} 个会话吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await onBatchDelete?.(sessionIds)
            exitSelectionMode()
          },
        },
      ]
    )
  }, [selectedSessions, onBatchDelete, exitSelectionMode])

  // 重命名会话
  const handleRename = useCallback((session: AiGeneralSession) => {
    setRenamingSession(session)
    setNewSessionName(session.sessionName)
    setShowRenameDialog(true)
  }, [])

  const confirmRename = useCallback(async () => {
    if (!renamingSession || !newSessionName.trim()) return

    try {
      await onSessionRename?.(renamingSession.sessionId, newSessionName.trim())
      setShowRenameDialog(false)
      setRenamingSession(null)
      setNewSessionName('')
    } catch (error) {
      console.error('重命名失败:', error)
      Alert.alert('错误', '重命名失败，请重试')
    }
  }, [renamingSession, newSessionName, onSessionRename])

  // 置顶/取消置顶
  const handlePin = useCallback(
    async (session: AiGeneralSession) => {
      try {
        await onSessionPin?.(session.sessionId)
      } catch (error) {
        console.error('置顶失败:', error)
        Alert.alert('错误', '操作失败，请重试')
      }
    },
    [onSessionPin]
  )

  // 删除会话
  const handleDelete = useCallback(
    (session: AiGeneralSession) => {
      Alert.alert(
        '确认删除',
        `确定要删除会话"${session.sessionName}"吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              await onSessionDelete?.(session.sessionId)
            },
          },
        ]
      )
    },
    [onSessionDelete]
  )

  // 会话切换
  const handleSessionSwitch = useCallback(
    (session: AiGeneralSession) => {
      if (isSelectionMode) {
        toggleSessionSelection(session.sessionId)
      } else {
        onSessionSwitch?.(session.sessionId).then(() => {
          onClose()
        })
      }
    },
    [isSelectionMode, onSessionSwitch, onClose, toggleSessionSelection]
  )

  // 格式化时间（相对时间）
  const formatTime = useCallback((timestamp: number): string => {
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

    // 其他：显示月/日 时:分
    const date = new Date(timestamp)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${month}/${day} ${hours}:${minutes}`
  }, [])

  // 渲染会话项
  const renderSessionItem = useCallback(
    ({ item }: { item: AiGeneralSession }) => {
      const isSelected = currentSessionId === item.sessionId
      const isChecked = selectedSessions.has(item.sessionId)

      return (
        <TouchableOpacity
          style={[
            styles.sessionItem,
            isSelected && styles.sessionItemActive,
            isChecked && styles.sessionItemChecked,
          ]}
          onPress={() => handleSessionSwitch(item)}
          onLongPress={() => {
            if (!isSelectionMode) {
              enterSelectionMode()
              toggleSessionSelection(item.sessionId)
            }
          }}
        >
          {/* 批量选择复选框 */}
          {isSelectionMode && (
            <View style={styles.checkbox}>
              <Text style={styles.checkboxText}>
                {isChecked ? '✓' : '○'}
              </Text>
            </View>
          )}

          {/* 会话内容 */}
          <View style={styles.sessionContent}>
            <View style={styles.sessionTitleRow}>
              <Text
                style={[
                  styles.sessionName,
                  item.pinned && styles.sessionPinned,
                ]}
                numberOfLines={1}
              >
                {item.pinned && '📌 '}
                {item.sessionName}
              </Text>
              <Text style={styles.sessionTime}>
                {formatTime(item.updateTime)}
              </Text>
            </View>
          </View>

          {/* 更多按钮（非选择模式下显示） */}
          {!isSelectionMode && (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => {
                Alert.alert(
                  '会话操作',
                  item.sessionName,
                  [
                    {
                      text: '重命名',
                      onPress: () => handleRename(item),
                    },
                    {
                      text: item.pinned ? '取消置顶' : '置顶',
                      onPress: () => handlePin(item),
                    },
                    {
                      text: '批量管理',
                      onPress: () => {
                        enterSelectionMode()
                        toggleSessionSelection(item.sessionId)
                      },
                    },
                    {
                      text: '删除',
                      style: 'destructive',
                      onPress: () => handleDelete(item),
                    },
                    {
                      text: '取消',
                      style: 'cancel',
                    },
                  ]
                )
              }}
            >
              <Text style={styles.moreButtonText}>⋮</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      )
    },
    [
      currentSessionId,
      selectedSessions,
      isSelectionMode,
      handleSessionSwitch,
      enterSelectionMode,
      toggleSessionSelection,
      handleRename,
      handlePin,
      handleDelete,
      formatTime,
    ]
  )

  // 重置状态（当抽屉关闭时）
  useEffect(() => {
    if (!visible) {
      setSearchKeyword('')
      exitSelectionMode()
      setShowRenameDialog(false)
    }
  }, [visible, exitSelectionMode])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.drawer}>
          {/* 标题栏 */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>会话列表</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 搜索栏 */}
          {!isSelectionMode && (
            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder="搜索会话..."
                placeholderTextColor="#999"
                value={searchKeyword}
                onChangeText={setSearchKeyword}
              />
            </View>
          )}

          {/* 批量选择工具栏 */}
          {isSelectionMode && (
            <View style={styles.selectionToolbar}>
              <TouchableOpacity onPress={exitSelectionMode} style={styles.toolbarButton}>
                <Text style={styles.toolbarButtonText}>✕</Text>
              </TouchableOpacity>
              <View style={styles.selectionInfo}>
                <Text style={styles.selectionIcon}>✓</Text>
                <Text style={styles.selectionText}>
                  {selectedSessions.size} 个会话已选择
                </Text>
              </View>
              <TouchableOpacity onPress={toggleSelectAll} style={styles.toolbarButton}>
                <Text style={styles.toolbarButtonText}>
                  {selectedSessions.size === filteredSessions.length ? '☑' : '☐'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBatchDelete}
                disabled={selectedSessions.size === 0}
                style={[
                  styles.toolbarButton,
                  selectedSessions.size === 0 && styles.toolbarButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.toolbarButtonText,
                    selectedSessions.size === 0 && styles.toolbarButtonTextDisabled,
                  ]}
                >
                  删除
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 会话列表 */}
          <FlatList
            data={filteredSessions}
            keyExtractor={(item) => item.sessionId}
            renderItem={renderSessionItem}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {searchKeyword ? '未找到匹配的会话' : '暂无会话'}
                </Text>
                <Text style={styles.emptyStateHint}>
                  {searchKeyword ? '尝试使用其他关键词搜索' : '您的会话记录将显示在这里'}
                </Text>
              </View>
            }
          />

          {/* 创建新会话按钮 */}
          {!isSelectionMode && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                onSessionCreate?.()
                onClose()
              }}
            >
              <Text style={styles.createButtonText}>+ 创建新会话</Text>
            </TouchableOpacity>
          )}

          {/* 重命名对话框 */}
          {showRenameDialog && (
            <Modal
              visible={showRenameDialog}
              transparent
              animationType="fade"
              onRequestClose={() => setShowRenameDialog(false)}
            >
              <View style={styles.dialogOverlay}>
                <View style={styles.dialogContent}>
                  <Text style={styles.dialogTitle}>重命名会话</Text>
                  <TextInput
                    style={styles.dialogInput}
                    placeholder="会话名称"
                    value={newSessionName}
                    onChangeText={setNewSessionName}
                    autoFocus
                  />
                  <View style={styles.dialogActions}>
                    <TouchableOpacity
                      style={styles.dialogButton}
                      onPress={() => setShowRenameDialog(false)}
                    >
                      <Text style={styles.dialogButtonText}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dialogButton, styles.dialogButtonPrimary]}
                      onPress={confirmRename}
                    >
                      <Text
                        style={[
                          styles.dialogButtonText,
                          styles.dialogButtonTextPrimary,
                        ]}
                      >
                        确定
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayTouchable: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '75%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  searchBar: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#000',
  },
  selectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  selectionInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  selectionIcon: {
    fontSize: 20,
    color: '#1976d2',
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  toolbarButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  toolbarButtonDisabled: {
    opacity: 0.5,
  },
  toolbarButtonText: {
    fontSize: 18,
    color: '#333',
  },
  toolbarButtonTextDisabled: {
    color: '#999',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  sessionItemActive: {
    backgroundColor: '#e3f2fd',
  },
  sessionItemChecked: {
    backgroundColor: '#e3f2fd',
  },
  checkbox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxText: {
    fontSize: 16,
    color: '#1976d2',
  },
  sessionContent: {
    flex: 1,
    marginRight: 8,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  sessionName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginRight: 8,
  },
  sessionPinned: {
    fontWeight: '600',
  },
  sessionTime: {
    fontSize: 12,
    color: '#999',
  },
  moreButton: {
    padding: 8,
  },
  moreButtonText: {
    fontSize: 20,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  emptyStateHint: {
    fontSize: 14,
    color: '#ccc',
  },
  createButton: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  createButtonText: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  dialogInput: {
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#000',
    marginBottom: 16,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dialogButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dialogButtonPrimary: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  dialogButtonText: {
    fontSize: 16,
    color: '#666',
  },
  dialogButtonTextPrimary: {
    color: '#fff',
  },
})

export default SessionDrawer

