/**
 * ChatInput - 聊天输入组件
 * 负责消息输入、发送、AI角色选择、联网搜索切换等功能
 */

import React, { useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Keyboard,
} from 'react-native'
import type { ChatInputProps } from '../../types/chat'

export interface ChatInputHandle {
  clearInputContent: () => void
  focus: () => void
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  (props, ref) => {
    const {
      value,
      placeholderText,
      isLoading,
      isRecording,
      enableWebSearch,
      selectedModel,
      type,
      canSend,
      isEditing = false,
      onChange,
      onSend,
      onFocus,
      onBlur,
      onStartVoiceInput,
      onStopVoiceInput,
      onVoiceMove,
      onShowImagePicker,
      onToggleWebSearch,
      onScrollToBottom,
      onSelectedModelChange,
      onCancelEdit,
    } = props

    const textInputRef = useRef<TextInput>(null)

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      clearInputContent: () => {
        onChange?.('')
        textInputRef.current?.clear()
      },
      focus: () => {
        textInputRef.current?.focus()
      },
    }))

    // 发送消息
    const handleSendMessage = useCallback(() => {
      if (!value?.trim() || !canSend || isLoading) {
        return
      }

      // 更新 value
      onChange?.(value)

      // 使用 setTimeout 确保父组件的 value 更新后再发送消息
      setTimeout(() => {
        onSend?.()
        // 清空输入
        onChange?.('')
        textInputRef.current?.clear()
      }, 0)
    }, [value, canSend, isLoading, onChange, onSend])

    // AI角色选项
    const aiRoleOptions = [
      { label: '同桌', value: 'mate' },
      { label: '学长', value: 'mentor' },
      { label: '大神', value: 'researcher' },
    ]

    // 根据选择的模式获取显示名称
    const getModelDisplayName = (model: string) => {
      const option = aiRoleOptions.find((opt) => opt.value === model)
      return option ? option.label : '同桌'
    }

    // 处理键盘回车键发送
    const handleKeyPress = useCallback(
      (e: any) => {
        if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
          e.preventDefault?.()
          handleSendMessage()
        }
      },
      [handleSendMessage]
    )

    return (
      <View style={styles.container}>
        {/* 输入框容器 */}
        <View style={styles.inputWrapper}>
          {/* 左侧控制区 */}
          <View style={styles.leftControls}>
            {/* 编辑状态指示器 */}
            {isEditing && (
              <View style={styles.editIndicator}>
                <Text style={styles.editText}>编辑消息</Text>
                <TouchableOpacity
                  onPress={onCancelEdit}
                  style={styles.cancelEditButton}
                >
                  <Text style={styles.cancelEditText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 功能按钮：仅在非编辑状态下显示 */}
            {!isEditing && (
              <>
                {/* 模式选择器 - 仅在AI模式下显示 */}
                {(type === 'ai-general' ||
                  type === 'ai-exercise' ||
                  type === 'ai-textbook') && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      // TODO: 实现角色选择菜单
                      // 暂时循环切换
                      const currentIndex = aiRoleOptions.findIndex(
                        (opt) => opt.value === selectedModel
                      )
                      const nextIndex =
                        (currentIndex + 1) % aiRoleOptions.length
                      onSelectedModelChange?.(
                        aiRoleOptions[nextIndex].value
                      )
                    }}
                  >
                    <Text style={styles.actionButtonText}>
                      {getModelDisplayName(selectedModel || 'mate')}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 联网搜索按钮 - 仅在AI模式下显示 */}
                {(type === 'ai-general' ||
                  type === 'ai-exercise' ||
                  type === 'ai-textbook') && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      enableWebSearch && styles.actionButtonActive,
                    ]}
                    onPress={onToggleWebSearch}
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        enableWebSearch && styles.actionButtonTextActive,
                      ]}
                    >
                      联网搜索
                    </Text>
                  </TouchableOpacity>
                )}

                {/* 公式按钮 - 所有模式显示 */}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    // TODO: 实现公式插入功能
                    Keyboard.dismiss()
                  }}
                >
                  <Text style={styles.actionButtonText}>公式</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* 输入框区域 */}
          <View style={styles.inputArea}>
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              value={value}
              placeholder={placeholderText}
              placeholderTextColor="#999"
              multiline
              editable={!isLoading && !isEditing}
              onChangeText={onChange}
              onFocus={onFocus}
              onBlur={onBlur}
              onSubmitEditing={handleSendMessage}
              returnKeyType="send"
              blurOnSubmit={false}
            />
          </View>

          {/* 右侧控制区 */}
          <View style={styles.rightControls}>
            {/* 语音按钮 - 仅教师对话显示 */}
            {type === 'teacher' && (
              <TouchableOpacity
                style={[
                  styles.controlIconButton,
                  isRecording && styles.controlIconButtonRecording,
                ]}
                onPressIn={onStartVoiceInput}
                onPressOut={onStopVoiceInput}
                onTouchMove={onVoiceMove}
              >
                <Text style={styles.controlIcon}>
                  {isRecording ? '🎤' : '🎤'}
                </Text>
              </TouchableOpacity>
            )}

            {/* 图片上传 - 仅教师对话显示 */}
            {type !== 'ai-general' &&
              type !== 'ai-exercise' &&
              type !== 'ai-textbook' && (
                <TouchableOpacity
                  style={styles.controlIconButton}
                  onPress={onShowImagePicker}
                >
                  <Text style={styles.controlIcon}>📷</Text>
                </TouchableOpacity>
              )}

            {/* 发送按钮 */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!canSend || isLoading) && styles.sendButtonDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={!canSend || isLoading}
            >
              {isLoading ? (
                <Text style={styles.sendButtonText}>...</Text>
              ) : isEditing ? (
                <Text style={styles.sendButtonText}>✓</Text>
              ) : (
                <Text style={styles.sendButtonText}>发送</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }
)

ChatInput.displayName = 'ChatInput'

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#7A7CFF',
    minHeight: 44,
  },
  leftControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
    flexWrap: 'wrap',
  },
  editIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
  },
  editText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  cancelEditButton: {
    padding: 4,
  },
  cancelEditText: {
    fontSize: 16,
    color: '#666',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  },
  actionButtonActive: {
    backgroundColor: '#e3f2fd',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#666',
  },
  actionButtonTextActive: {
    color: '#1976d2',
  },
  inputArea: {
    flex: 1,
    marginRight: 8,
    minHeight: 28,
    maxHeight: 200,
  },
  textInput: {
    fontSize: 16,
    color: '#000',
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlignVertical: 'top',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIconButtonRecording: {
    backgroundColor: 'rgba(234, 67, 53, 0.1)',
  },
  controlIcon: {
    fontSize: 20,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default ChatInput

