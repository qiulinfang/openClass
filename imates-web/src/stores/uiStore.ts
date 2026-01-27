/**
 * UI 状态管理 Store
 * 用于管理全局 UI 状态，如对话框显示等
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUIStore = defineStore('ui', () => {
  // AI聊天对话框显示状态
  const showAIChatDialog = ref(false)
  
  // 教师对话框显示状态
  const showTeacherChatDialog = ref(false)
  
  // 微课对话框显示状态
  const showMiniClassDialog = ref(false)
  const miniClassUrl = ref<string>('')
  const miniClassQuestionTitle = ref<string>('')
  
  // 打开 AI 聊天对话框
  const openAIChatDialog = () => {
    showAIChatDialog.value = true
  }
  
  // 关闭 AI 聊天对话框
  const closeAIChatDialog = () => {
    showAIChatDialog.value = false
  }
  
  // 打开教师对话框
  const openTeacherChatDialog = () => {
    showTeacherChatDialog.value = true
  }
  
  // 关闭教师对话框
  const closeTeacherChatDialog = () => {
    showTeacherChatDialog.value = false
  }
  
  // 打开微课对话框
  const openMiniClassDialog = (url: string, questionTitle?: string) => {
    miniClassUrl.value = url
    miniClassQuestionTitle.value = questionTitle || ''
    showMiniClassDialog.value = true
  }
  
  // 关闭微课对话框
  const closeMiniClassDialog = () => {
    showMiniClassDialog.value = false
    miniClassUrl.value = ''
    miniClassQuestionTitle.value = ''
  }
  
  return {
    showAIChatDialog,
    openAIChatDialog,
    closeAIChatDialog,
    showTeacherChatDialog,
    openTeacherChatDialog,
    closeTeacherChatDialog,
    showMiniClassDialog,
    miniClassUrl,
    miniClassQuestionTitle,
    openMiniClassDialog,
    closeMiniClassDialog
  }
})

